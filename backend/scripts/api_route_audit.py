"""Safe API route audit for the ASchool Flask app.

The script logs in as the demo school admin, tests every registered API GET
route, and probes non-GET routes with OPTIONS so destructive handlers are not
executed during an audit.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from typing import Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from extensions import db


LOGIN_EMAIL = "admin@demo.aschool.com.np"
LOGIN_PASSWORD = "changeme123"
ZERO_UUID = "00000000-0000-0000-0000-000000000000"
PARAM_RE = re.compile(r"<(?:(?P<converter>[^:<>]+):)?(?P<name>[^<>]+)>")


@dataclass
class RouteResult:
    method: str
    rule: str
    path: str
    status: int
    outcome: str


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit ASchool API routes with safe probes.")
    parser.add_argument("--json", action="store_true", help="Print full JSON results.")
    args = parser.parse_args()

    app = create_app()
    app.config["TESTING"] = False
    app.config["PROPAGATE_EXCEPTIONS"] = False

    with app.app_context():
        client = app.test_client()
        headers, login_user = _login(client)
        samples = _sample_values(login_user)
        results = _audit_routes(app, client, headers, samples)

    failing = [item for item in results if item.status >= 500]
    get_results = [item for item in results if item.method == "GET"]
    option_results = [item for item in results if item.method == "OPTIONS"]

    summary = {
        "login": LOGIN_EMAIL,
        "total_probes": len(results),
        "get_probes": len(get_results),
        "options_probes": len(option_results),
        "server_errors": len(failing),
        "status_counts": _status_counts(results),
    }

    if args.json:
        print(json.dumps({"summary": summary, "failures": [asdict(item) for item in failing], "results": [asdict(item) for item in results]}, indent=2, sort_keys=True))
    else:
        print(json.dumps(summary, sort_keys=True))
        if failing:
            print("SERVER ERRORS:")
            for item in failing:
                print(f"{item.method} {item.path} -> {item.status} ({item.rule})")
    return 1 if failing else 0


def _login(client) -> tuple[dict[str, str], dict[str, Any]]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
    )
    payload = response.get_json(silent=True) or {}
    token = ((payload.get("data") or {}).get("access_token") or "")
    user = (payload.get("data") or {}).get("user") or {}
    if response.status_code != 200 or not token:
        raise RuntimeError(f"Login failed with status {response.status_code}: {payload}")
    return {"Authorization": f"Bearer {token}"}, user


def _sample_values(login_user: dict[str, Any]) -> dict[str, str]:
    from app.models.academic import AcademicYear, Class, Section, Subject
    from app.models.student import Guardian, Student
    from app.models.user import User

    school_id = login_user.get("school_id") or ZERO_UUID
    admin_user_id = login_user.get("id") or ZERO_UUID
    teacher = User.query.filter_by(school_id=school_id, role="teacher", is_deleted=False).first()

    samples = {
        "school_id": school_id,
        "user_id": str(teacher.id) if teacher else admin_user_id,
        "teacher_id": str(teacher.id) if teacher else admin_user_id,
        "created_by_id": admin_user_id,
        "year_id": _first_id(AcademicYear, school_id),
        "academic_year_id": _first_id(AcademicYear, school_id),
        "class_id": _first_id(Class, school_id),
        "section_id": _first_id(Section, school_id),
        "subject_id": _first_id(Subject, school_id),
        "student_id": _first_id(Student, school_id),
        "guardian_id": _first_id(Guardian, school_id),
        "source_type": "students",
        "qr_code": "missing",
        "filepath": "missing",
        "filename": "missing",
    }

    table_samples = {
        "alumni_id": "alumni",
        "asset_id": "assets",
        "attendance_id": "attendance",
        "book_id": "books",
        "bus_id": "buses",
        "category_id": "diary_categories",
        "course_id": "courses",
        "doc_id": "designer_documents",
        "event_id": "events",
        "exam_id": "exams",
        "fee_id": "fee_structures",
        "file_id": "file_records",
        "folder_id": "file_folders",
        "incident_id": "incidents",
        "inquiry_id": "admission_inquiries",
        "issue_id": "book_issues",
        "lesson_id": "lessons",
        "log_id": "iemis_import_logs",
        "notice_id": "notices",
        "page_id": "website_pages",
        "post_id": "social_posts",
        "pr_id": "procurement_requests",
        "quiz_id": "quizzes",
        "route_id": "bus_routes",
        "section_id": "sections",
        "semester_id": "semesters",
        "shift_id": "shifts",
        "stop_id": "bus_stops",
        "stream_id": "streams",
        "template_id": "communication_templates",
        "theme_id": "website_themes",
        "visitor_id": "visitors",
    }
    for name, table_name in table_samples.items():
        samples.setdefault(name, _first_table_id(table_name, school_id))

    return samples


def _first_id(model, school_id: str) -> str:
    query = model.query
    if hasattr(model, "school_id"):
        query = query.filter(model.school_id == school_id)
    if hasattr(model, "is_deleted"):
        query = query.filter(model.is_deleted.is_(False))
    row = query.first()
    return str(row.id) if row else ZERO_UUID


def _first_table_id(table_name: str, school_id: str) -> str:
    if not re.fullmatch(r"[a-z_]+", table_name):
        return ZERO_UUID
    try:
        table_exists = db.session.execute(
            db.text("select to_regclass(:table_name)"),
            {"table_name": f"public.{table_name}"},
        ).scalar()
        if not table_exists:
            return ZERO_UUID
        columns = {
            row[0]
            for row in db.session.execute(
                db.text(
                    """
                    select column_name
                    from information_schema.columns
                    where table_schema = 'public' and table_name = :table_name
                    """
                ),
                {"table_name": table_name},
            )
        }
        where_parts = []
        params: dict[str, Any] = {}
        if "school_id" in columns:
            where_parts.append("school_id = :school_id")
            params["school_id"] = school_id
        if "is_deleted" in columns:
            where_parts.append("is_deleted = false")
        where_sql = f" where {' and '.join(where_parts)}" if where_parts else ""
        return str(
            db.session.execute(
                db.text(f"select id from {table_name}{where_sql} limit 1"),
                params,
            ).scalar()
            or ZERO_UUID
        )
    except Exception:
        db.session.rollback()
        return ZERO_UUID


def _audit_routes(app, client, headers: dict[str, str], samples: dict[str, str]) -> list[RouteResult]:
    results: list[RouteResult] = []
    seen: set[tuple[str, str]] = set()
    for rule in sorted(app.url_map.iter_rules(), key=lambda item: item.rule):
        if not (rule.rule.startswith("/api/v1") or rule.rule == "/health"):
            continue
        methods = sorted((rule.methods or set()) - {"HEAD", "OPTIONS"})
        for method in methods:
            probe_method = "GET" if method == "GET" else "OPTIONS"
            key = (probe_method, rule.rule)
            if key in seen:
                continue
            seen.add(key)
            path = _materialize_rule(rule.rule, samples)
            response = client.open(path, method=probe_method, headers=headers, buffered=False)
            try:
                results.append(
                    RouteResult(
                        method=probe_method,
                        rule=rule.rule,
                        path=path,
                        status=response.status_code,
                        outcome=_outcome(response.status_code),
                    )
                )
            finally:
                response.close()
    return results


def _materialize_rule(rule: str, samples: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        converter = match.group("converter") or "string"
        name = match.group("name")
        value = samples.get(name)
        if not value:
            if converter == "uuid" or name.endswith("_id"):
                value = ZERO_UUID
            elif converter == "path":
                value = "missing"
            else:
                value = "missing"
        return str(value)

    return PARAM_RE.sub(replace, rule)


def _outcome(status: int) -> str:
    if status < 400:
        return "ok"
    if status < 500:
        return "client_error_expected_for_missing_inputs"
    return "server_error"


def _status_counts(results: list[RouteResult]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in results:
        key = str(item.status)
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items(), key=lambda pair: int(pair[0])))


if __name__ == "__main__":
    raise SystemExit(main())
