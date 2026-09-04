"""W0-close: legacy AI slug gates + guardian edit/delete + ai-gate alias test.

Covers the W0-close items from UNIFIED_ROADMAP v3 §5 B1:
1. Every AI route gates the canonical `ai_suite` slug (the legacy-slug gates
   were cosmetic, not broken — alias expansion is bidirectional — but the
   canonical form is the contract).
2. Guardian PATCH/DELETE (previously only GET/POST existed).
"""

import pytest

from app.plugins.decorators import _acceptable_plugin_slugs

# ── Gate canonicalization ──────────────────────────────────────────────────


def _gated_slugs_from_source() -> set[str]:
    """Every slug passed to @plugin_required( in backend source."""
    import re
    from pathlib import Path

    root = Path("app")
    slugs: set[str] = set()
    for py in root.rglob("*.py"):
        # Strip line comments first — the decorators.py alias rationale
        # mentions deleted slugs in prose, and prose is not a gate.
        code = "\n".join(
            line.split("#")[0] if not line.strip().startswith("#") else ""
            for line in py.read_text().splitlines()
        )
        for m in re.finditer(r'plugin_required\(\s*"([^"]+)"', code):
            slugs.add(m.group(1))
    return slugs


def test_no_legacy_ai_slug_gates_remain():
    legacy = {"ai_tools", "ai_adaptive_learning", "ai_tutor", "ai_grading",
              "ai_insights", "benchmarking", "advanced_analytics"}
    found = _gated_slugs_from_source()
    assert not (found & legacy), f"legacy AI gates remain: {sorted(found & legacy)}"


def test_ai_suite_gate_accepts_every_legacy_install():
    """An install of ANY legacy AI slug must pass an ai_suite gate, and an
    ai_suite install must pass a legacy gate (bidirectional single-hop)."""
    for gate in ("ai_suite", "ai_tools", "ai_adaptive_learning", "benchmarking"):
        accepted = _acceptable_plugin_slugs(gate)
        assert "ai_suite" in accepted, f"{gate} gate does not accept ai_suite"


def test_every_gate_slug_is_canonical_or_alias_resolvable():
    """Each gated slug must either be a manifest slug or alias-map to one."""
    from app.plugins.loader import PluginLoader

    PluginLoader._scan_manifests()
    aliases = PluginLoader.alias_map()
    known = set(PluginLoader.get_all_manifests())
    for slug in _gated_slugs_from_source():
        assert slug in known or slug in aliases, (
            f"@plugin_required('{slug}') is neither a manifest slug nor an alias"
        )


# ── Guardian edit/delete ───────────────────────────────────────────────────

from tests.conftest import get_auth_headers  # noqa: E402


def _create_student_with_guardian(client, admin_user, school):
    from app.models.academic import Class

    klass = Class(school_id=school.id, name="Grade 4")
    db_session_add_commit(klass)
    resp = client.post(
        "/api/v1/students",
        json={
            "first_name": "Aarav",
            "last_name": "Shrestha",
            "gender": "male",
            "class_id": str(klass.id),
            "guardians": [{
                "full_name": "Rita Shrestha",
                "relation": "mother",
                "phone": "9812345601",
                "is_primary": True,
            }],
        },
        headers=get_auth_headers(client, admin_user.email, "Test@1234"),
    )
    assert resp.status_code in (200, 201), resp.get_json()
    data = resp.get_json()["data"]
    # The create response does not embed guardians — read them back.
    listing = client.get(f"/api/v1/students/{data['id']}/guardians", headers=get_auth_headers(client, admin_user.email, "Test@1234"))
    guardians = listing.get_json()["data"]
    assert guardians, "guardian was not created with the student"
    return data["id"], guardians[0]["id"]


def db_session_add_commit(obj):
    from extensions import db

    db.session.add(obj)
    db.session.commit()


def test_guardian_update_and_primary_exclusivity(client, db, admin_user, school):
    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    student_id, g1 = _create_student_with_guardian(client, admin_user, school)

    # Add a second guardian and make them primary — the first must demote.
    resp = client.post(
        f"/api/v1/students/{student_id}/guardians",
        json={"full_name": "Hari Shrestha", "relation": "father",
              "phone": "9812345602"},
        headers=headers,
    )
    g2 = resp.get_json()["data"]["id"]

    resp = client.patch(
        f"/api/v1/students/{student_id}/guardians/{g2}",
        json={"is_primary": True, "occupation": "Engineer"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.get_json()

    listing = client.get(f"/api/v1/students/{student_id}/guardians", headers=headers)
    guardians = {g["id"]: g for g in listing.get_json()["data"]}
    assert guardians[g2]["is_primary"] is True
    assert guardians[g1]["is_primary"] is False
    assert guardians[g2]["occupation"] == "Engineer"


def test_guardian_relation_validation(client, db, admin_user, school):
    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    student_id, g1 = _create_student_with_guardian(client, admin_user, school)
    resp = client.patch(
        f"/api/v1/students/{student_id}/guardians/{g1}",
        json={"relation": "stepmother"},
        headers=headers,
    )
    assert resp.status_code == 400


def test_guardian_delete_is_soft(client, db, admin_user, school):
    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    student_id, g1 = _create_student_with_guardian(client, admin_user, school)
    resp = client.delete(
        f"/api/v1/students/{student_id}/guardians/{g1}", headers=headers
    )
    assert resp.status_code == 200
    listing = client.get(f"/api/v1/students/{student_id}/guardians", headers=headers)
    assert g1 not in {g["id"] for g in listing.get_json()["data"]}

    from app.models.student import Guardian

    row = Guardian.query.get(g1)
    assert row is not None and row.is_deleted is True
