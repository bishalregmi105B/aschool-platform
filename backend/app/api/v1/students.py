"""Students CRUD API."""
import io
import os
import zipfile

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.student import Guardian, Student
from app.utils.decorators import role_required, school_required
from app.utils.file_upload import upload_file as _upload_file
from app.utils.pagination import paginate
from app.utils.validators import validate_password_strength
from app.utils.response import (
    created_response,
    error_response,
    no_content_response,
    success_response,
)
from app.utils.teacher_scope import teacher_allowed_class_ids
from extensions import db

students_bp = Blueprint("students", __name__, url_prefix="/students")


@students_bp.route("", methods=["GET"])
@jwt_required()
@school_required
def list_students():
    """List students for the current school."""
    query = Student.query.filter_by(school_id=g.school_id, is_deleted=False)

    if g.role == "teacher" and g.user_id:
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        if not allowed_class_ids:
            items, meta = paginate(query.filter(Student.id.is_(None)))
            return success_response([], meta={"pagination": meta})
        query = query.filter(Student.class_id.in_(allowed_class_ids))

    user_id = request.args.get("user_id")
    if user_id:
        query = query.filter_by(user_id=user_id)

    guardian_user_id = request.args.get("guardian_user_id")
    if guardian_user_id:
        query = query.join(
            Guardian,
            (Guardian.student_id == Student.id) & (Guardian.is_deleted.is_(False)),
        ).filter(Guardian.user_id == guardian_user_id).distinct()

    class_id = request.args.get("class_id")
    if class_id:
        query = query.filter_by(class_id=class_id)

    section_id = request.args.get("section_id")
    if section_id:
        query = query.filter_by(section_id=section_id)

    academic_year_id = request.args.get("academic_year_id")
    if academic_year_id:
        query = query.filter_by(academic_year_id=academic_year_id)

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    gender = request.args.get("gender")
    if gender:
        query = query.filter_by(gender=gender)

    grade = request.args.get("grade")
    if grade:
        query = query.filter(Student.academic_year == grade)

    search = request.args.get("search")
    if search:
        query = query.filter(
            Student.first_name.ilike(f"%{search}%")
            | Student.last_name.ilike(f"%{search}%")
            | Student.student_id.ilike(f"%{search}%")
        )

    query = query.order_by(Student.roll_number)
    items, meta = paginate(query)
    return success_response([s.to_dict() for s in items], meta={"pagination": meta})


@students_bp.route("/<uuid:student_id>", methods=["GET"])
@jwt_required()
@school_required
def get_student(student_id):
    """Get a single student with guardians."""
    student = Student.query.get(student_id)
    if not student or student.is_deleted or str(student.school_id) != str(g.school_id):
        return error_response("Student not found", 404)

    if g.role == "teacher" and g.user_id:
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids if cid}
        if not allowed_class_ids_set or str(student.class_id) not in allowed_class_ids_set:
            return error_response("Student not found", 404)

    data = student.to_dict()
    guardians = Guardian.query.filter_by(student_id=student.id, is_deleted=False).all()
    data["guardians"] = [_guardian_dict(gd) for gd in guardians]
    return success_response(data)


from app.models.student import Guardian, Student
from app.models.user import User
from app.plugins.entitlements import student_cap_error
from app.services.student_numbers import ensure_student_numbers
from app.utils.password import generate_default_password

@students_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin", "staff")
def create_student():
    """Enroll a new student."""
    data = request.get_json(silent=True) or {}
    required = ["first_name", "last_name", "class_id"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}", 400)

    # Server-side plan cap (E2): reject enrollment beyond School.max_students.
    cap_error = student_cap_error(g.school_id, incoming_count=1)
    if cap_error:
        return error_response(cap_error, 403)

    # Duplicate roll number guard
    roll_number = data.get("roll_number")
    if roll_number is not None:
        existing = Student.query.filter_by(
            school_id=g.school_id,
            class_id=data["class_id"],
            roll_number=roll_number,
            is_deleted=False,
        ).first()
        if existing:
            return error_response(
                f"Roll number {roll_number} is already assigned in this class", 409
            )

    student = Student(school_id=g.school_id)
    _populate_student(student, data)
    # E235: auto-assign the enrollment (admission) number and the next free
    # class roll when the caller did not provide them. Generation takes a
    # SELECT … FOR UPDATE lock on the School row inside this same
    # transaction, so concurrent enrollments can never mint the same number.
    ensure_student_numbers(student)
    db.session.add(student)
    db.session.flush()

    # Create associated user for student
    user = User(
        school_id=g.school_id,
        role="student",
        full_name=f"{student.first_name} {student.last_name}".strip(),
        phone=data.get("phone", ""),
        email=data.get("email") or None,
    )
    if data.get("password"):
        ok, pw_error = validate_password_strength(data["password"])
        if not ok:
            return error_response(pw_error, 400)
        user.set_password(data["password"])
    else:
        user.set_password(generate_default_password(user, student))
    
    db.session.add(user)
    db.session.flush()
    student.user_id = user.id

    # Create guardians if provided
    for gd_data in data.get("guardians", []):
        guardian = Guardian(
            school_id=g.school_id,
            student_id=student.id,
        )
        _populate_guardian(guardian, gd_data)
        parent_user = _resolve_or_create_parent_user(gd_data, student)
        if parent_user:
            guardian.user_id = parent_user.id
        db.session.add(guardian)

    db.session.commit()
    return created_response(student.to_dict())


@students_bp.route("/<uuid:student_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin", "teacher", "staff")
def update_student(student_id):
    """Update student profile."""
    student = Student.query.get(student_id)
    if not student or student.is_deleted or str(student.school_id) != str(g.school_id):
        return error_response("Student not found", 404)

    if g.role == "teacher" and g.user_id:
        allowed_class_ids = teacher_allowed_class_ids(g.school_id, g.user_id)
        allowed_class_ids_set = {str(cid) for cid in allowed_class_ids if cid}
        if not allowed_class_ids_set or str(student.class_id) not in allowed_class_ids_set:
            return error_response("Student not found", 404)

    data = request.get_json(silent=True) or {}
    _populate_student(student, data)
    
    if data.get("password") and student.user_id:
        user = User.query.get(student.user_id)
        if user:
            ok, pw_error = validate_password_strength(data["password"])
            if not ok:
                return error_response(pw_error, 400)
            user.set_password(data["password"])

    if student.user_id:
        user = User.query.get(student.user_id)
        if user:
            # users.phone is NOT NULL: the web edit dialogs send `phone: null`
            # whenever the phone field is left blank (the common case — student
            # users are enrolled without one), and storing None here violated
            # the constraint and 500ed the whole profile edit (E100).
            if "phone" in data:
                user.phone = data.get("phone") or ""
            if "email" in data:
                user.email = data.get("email") or None

    db.session.commit()
    return success_response(student.to_dict())


@students_bp.route("/<uuid:student_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def delete_student(student_id):
    """Soft-delete a student."""
    student = Student.query.get(student_id)
    if not student or student.is_deleted or str(student.school_id) != str(g.school_id):
        return error_response("Student not found", 404)
    student.soft_delete()
    return no_content_response()


@students_bp.route("/bulk-delete", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def bulk_delete_students():
    """Soft-delete multiple students by ID list."""
    data = request.get_json(silent=True) or {}
    ids = data.get("ids", [])
    if not ids:
        return error_response("No student IDs provided", 400)
    count = 0
    for sid in ids:
        student = Student.query.get(sid)
        if student and not student.is_deleted and str(student.school_id) == str(g.school_id):
            student.soft_delete()
            count += 1
    db.session.commit()
    return success_response({"deleted": count})


@students_bp.route("/batch-roll-numbers", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin", "staff", "teacher")
def batch_roll_numbers():
    """Batch-update roll numbers for multiple students in one call."""
    data = request.get_json(silent=True) or {}
    updates = data.get("updates", [])
    if not updates or not isinstance(updates, list):
        return error_response("updates list is required", 400)

    updated = 0
    for item in updates:
        sid = item.get("student_id")
        roll = item.get("roll_number")
        if not sid:
            continue
        # E163: int(roll) used to raise an unhandled ValueError (500) for
        # non-numeric strings like "abc"; validate up-front instead.
        if roll not in (None, ""):
            try:
                roll = int(roll)
            except (TypeError, ValueError):
                return error_response(
                    f"Invalid roll_number {roll!r} — must be a whole number", 400
                )
        student = Student.query.filter_by(
            id=sid, school_id=g.school_id, is_deleted=False
        ).first()
        if student:
            student.roll_number = roll
            updated += 1

    db.session.commit()
    return success_response({"updated": updated})


@students_bp.route("/bulk-profile-images", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def bulk_profile_images():
    """Accept a ZIP of images named by student admission number, update photo_url.

    Expected ZIP structure:  ADM1023.jpg, ADM1024.png, ...
    The filename stem (without extension) is matched against Student.student_id.
    """
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename.lower().endswith(".zip"):
        return error_response("Please upload a .zip file", 400)

    _ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    details = []
    total = 0
    updated = 0
    skipped = 0

    try:
        zip_bytes = uploaded.read()
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for name in zf.namelist():
                base = os.path.basename(name)
                stem, ext = os.path.splitext(base)
                stem = stem.strip()
                ext = ext.lower()

                # Skip directories and unsupported types
                if not stem or ext not in _ALLOWED_EXT:
                    continue

                total += 1
                student = Student.query.filter_by(
                    school_id=g.school_id, student_id=stem, is_deleted=False
                ).first()

                if not student:
                    skipped += 1
                    details.append({"filename": base, "student_id": stem, "status": "not_found"})
                    continue

                try:
                    img_bytes = zf.read(name)

                    class _FileWrap:
                        """Minimal file-like wrapper for upload_file utility."""
                        filename = f"photo{ext}"
                        content_type = (
                            "image/jpeg" if ext in (".jpg", ".jpeg") else
                            "image/png" if ext == ".png" else
                            "image/webp" if ext == ".webp" else
                            "image/gif"
                        )

                        def __init__(self, data: bytes):
                            self._buf = io.BytesIO(data)

                        def read(self, *args):
                            return self._buf.read(*args)

                        def seek(self, *args):
                            return self._buf.seek(*args)

                    url = _upload_file(_FileWrap(img_bytes), "student-photos", f"{stem}{ext}")
                    student.photo_url = url
                    updated += 1
                    details.append({"filename": base, "student_id": stem, "status": "updated"})
                except Exception as exc:
                    skipped += 1
                    details.append({"filename": base, "student_id": stem, "status": "error", "message": str(exc)})
    except zipfile.BadZipFile:
        return error_response("The uploaded file is not a valid ZIP archive", 400)

    db.session.commit()
    return success_response({
        "total": total,
        "updated": updated,
        "skipped": skipped,
        "errors": [d["message"] for d in details if d["status"] == "error"],
        "details": details,
    })


# ── Promotion ──────────────────────────────────────────────

# Only these statuses may be promoted. transferred_out / dropped_out /
# graduated students must NEVER move (the old endpoint blindly moved every
# non-deleted row, which also re-promoted students who had already left).
PROMOTABLE_STATUSES = ("active", "transferred_in", "on_leave")


def _student_display_name(student) -> str:
    return f"{student.first_name or ''} {student.last_name or ''}".strip()


def _promote_order_key(student):
    """Merge order for roll renumbering: old roll (nulls last), then name."""
    roll = student.roll_number
    return (
        roll is None,
        roll if roll is not None else 0,
        (student.first_name or "").lower(),
        (student.last_name or "").lower(),
    )


def _class_sections(class_id):
    from app.models.academic import Section

    return (
        Section.query.filter_by(class_id=class_id, is_deleted=False)
        .order_by(Section.name)
        .all()
    )


def _resolve_target_section(student, section_by_name, fallback_section):
    """Map a student's old section (by NAME) onto the target class's sections.

    Same rule as the nightly rollover task; falls back to the first section of
    the target class, or None when the target class has no sections at all.
    """
    old_name = (student.section.name or "").strip().lower() if student.section and student.section.name else ""
    if old_name and old_name in section_by_name:
        return section_by_name[old_name]
    return fallback_section


def _load_class_roster(school_id, class_id):
    return (
        Student.query.options(db.selectinload(Student.section))
        .filter_by(school_id=school_id, class_id=class_id, is_deleted=False)
        .all()
    )


def _group_by_section(students):
    """students → {section_id: [students]} keeping insertion order."""
    groups: dict = {}
    for student in students:
        groups.setdefault(student.section_id, []).append(student)
    return groups


def _renumber_class_rolls(school_id, class_id):
    """Renumber rolls 1..N within each section of the target class.

    Existing students of the target class and the freshly promoted ones are
    interleaved in the same per-section sequence (old roll nulls last, then
    name).
    """
    groups = _group_by_section(_load_class_roster(school_id, class_id))
    for group in groups.values():
        group.sort(key=_promote_order_key)
        for idx, student in enumerate(group, start=1):
            student.roll_number = idx


def _next_free_roll(school_id, class_id, section_id, taken: set) -> int | None:
    """First roll number ≥ 1 not already claimed in this target section."""
    roster = _load_class_roster(school_id, class_id)
    for student in roster:
        if student.section_id != section_id:
            continue
        if student.roll_number is not None:
            taken.add(student.roll_number)
    roll = 1
    while roll in taken:
        roll += 1
    return roll


def _keep_roll_assignments(school_id, class_id, promoted_students):
    """roll_strategy "keep": keep each promoted student's current roll when it
    is free in the target section, else the next free roll. Existing students
    of the target class never move. Returns per-student clash resolutions
    (only where the old roll was already taken) for the response."""
    per_section_taken: dict = {}
    for student in _load_class_roster(school_id, class_id):
        if student in promoted_students or student.roll_number is None:
            continue
        per_section_taken.setdefault(student.section_id, set()).add(
            student.roll_number
        )

    resolutions = []
    for student in promoted_students:
        taken = per_section_taken.setdefault(student.section_id, set())
        if student.roll_number is None or student.roll_number in taken:
            old_roll = student.roll_number
            new_roll = _next_free_roll(school_id, class_id, student.section_id, taken)
            student.roll_number = new_roll
            if old_roll is not None:
                resolutions.append(
                    {
                        "student_id": str(student.id),
                        "name": _student_display_name(student),
                        "old_roll": old_roll,
                        "assigned_roll": new_roll,
                        "reason": "roll already taken in target section",
                    }
                )
        if student.roll_number is not None:
            taken.add(student.roll_number)
    return resolutions


def _find_roll_conflicts(school_id, class_id, roster=None):
    """Duplicate roll numbers within the class, per section.

    Returns entries like {roll_number, section_id, section_name, count,
    student_ids, student_names} for every roll number shared by 2+ students.
    """
    members = roster if roster is not None else _load_class_roster(school_id, class_id)
    conflicts = []
    for group in _group_by_section(members).values():
        by_roll: dict = {}
        for student in group:
            if student.roll_number is None:
                continue
            by_roll.setdefault(student.roll_number, []).append(student)
        for roll in sorted(by_roll):
            same = by_roll[roll]
            if len(same) > 1:
                section = same[0].section
                conflicts.append(
                    {
                        "roll_number": roll,
                        "section_id": str(section.id) if section else None,
                        "section_name": section.name if section else None,
                        "count": len(same),
                        "student_ids": [str(s.id) for s in same],
                        "student_names": [_student_display_name(s) for s in same],
                    }
                )
    return conflicts


@students_bp.route("/promote/preview", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def promote_preview():
    """Preview a class promotion — who moves, where sections land, and which
    roll numbers would clash after merging into the target class."""
    from app.models.academic import Class

    from_class_id = request.args.get("from_class_id")
    to_class_id = request.args.get("to_class_id")
    if not from_class_id or not to_class_id:
        return error_response("from_class_id and to_class_id are required", 400)
    if str(from_class_id) == str(to_class_id):
        return error_response("Source and target class must differ", 400)

    source = Class.query.filter_by(
        id=from_class_id, school_id=g.school_id, is_deleted=False
    ).first()
    target = Class.query.filter_by(
        id=to_class_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not source or not target:
        return error_response("Source and target class must belong to this school", 404)

    source_students = _load_class_roster(g.school_id, from_class_id)
    target_students = _load_class_roster(g.school_id, to_class_id)

    target_sections = _class_sections(to_class_id)
    section_by_name = {(s.name or "").strip().lower(): s for s in target_sections}
    fallback_section = target_sections[0] if target_sections else None

    # Merged per-section rosters: existing target students + every promotable
    # source student. Used for both the renumber roll preview and the
    # keep-rolls conflict preview.
    merged: dict = {}
    for student in target_students:
        merged.setdefault(student.section_id, []).append(student)

    students_payload = []
    for student in source_students:
        will_promote = student.status in PROMOTABLE_STATUSES
        target_section = (
            _resolve_target_section(student, section_by_name, fallback_section)
            if will_promote
            else None
        )
        if will_promote:
            merged.setdefault(
                target_section.id if target_section else None, []
            ).append(student)
        students_payload.append(
            {
                "id": str(student.id),
                "name": _student_display_name(student),
                "student_code": student.student_id,
                "roll_no": student.roll_number,
                "status": student.status,
                "will_promote": will_promote,
                "target_section_name": (
                    target_section.name if target_section else None
                ),
                "target_roll_preview": None,  # filled after renumber pass
            }
        )

    by_student_id = {row["id"]: row for row in students_payload}
    for group in merged.values():
        group.sort(key=_promote_order_key)
        for idx, student in enumerate(group, start=1):
            row = by_student_id.get(str(student.id))
            if row is not None:
                row["target_roll_preview"] = idx

    section_name_by_id = {s.id: s.name for s in target_sections}
    conflicts_preview = []
    for group in merged.values():
        by_roll: dict = {}
        for student in group:
            if student.roll_number is None:
                continue
            by_roll.setdefault(student.roll_number, []).append(student)
        for roll in sorted(by_roll):
            same = by_roll[roll]
            if len(same) > 1:
                conflicts_preview.append(
                    {
                        "roll_number": roll,
                        "section_name": section_name_by_id.get(same[0].section_id),
                        "count": len(same),
                        "student_ids": [str(s.id) for s in same],
                        "student_names": [_student_display_name(s) for s in same],
                    }
                )

    section_mappings = {}
    for student in source_students:
        if student.status not in PROMOTABLE_STATUSES:
            continue
        old_name = (student.section.name or "").strip() if student.section and student.section.name else ""
        target_section = _resolve_target_section(student, section_by_name, fallback_section)
        key = old_name or "(no section)"
        section_mappings[key] = target_section.name if target_section else None

    return success_response(
        {
            "students": students_payload,
            "target_class_student_count": len(target_students),
            "conflicts_preview": conflicts_preview,
            "section_mappings": section_mappings,
            "target_section_count": len(target_sections),
        }
    )


@students_bp.route("/promote", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def promote_students():
    """Promote students of one class into another class.

    Body:
        from_class_id, to_class_id   (required, must differ)
        academic_year_id             optional — stamped onto promoted students
                                     (defaults to the target class's own year)
        roll_strategy                "keep" (default) leaves roll numbers alone
                                     and reports clashes; "renumber" renumbers
                                     1..N per section of the target class
        student_ids                  optional explicit promote list — omitted
                                     means every eligible student

    Eligible = status in (active, transferred_in, on_leave). transferred_out /
    dropped_out / graduated students are never moved. Single transaction: any
    failure rolls everything back.
    """
    from app.models.academic import Class

    data = request.get_json(silent=True) or {}
    from_class_id = data.get("from_class_id")
    to_class_id = data.get("to_class_id")
    if not from_class_id or not to_class_id:
        return error_response("from_class_id and to_class_id are required", 400)
    if str(from_class_id) == str(to_class_id):
        return error_response("Source and target class must differ", 400)

    roll_strategy = data.get("roll_strategy") or "keep"
    if roll_strategy not in ("keep", "renumber"):
        return error_response("roll_strategy must be 'keep' or 'renumber'", 400)
    student_ids = data.get("student_ids")
    if student_ids is not None and not isinstance(student_ids, list):
        return error_response("student_ids must be a list of student IDs", 400)
    selected_ids = {str(sid) for sid in student_ids} if student_ids is not None else None

    source = Class.query.filter_by(
        id=from_class_id, school_id=g.school_id, is_deleted=False
    ).first()
    target = Class.query.filter_by(
        id=to_class_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not source or not target:
        return error_response("Source and target class must belong to this school", 404)

    students = _load_class_roster(g.school_id, from_class_id)
    if not students:
        return error_response("No students found in the source class", 400)

    target_sections = _class_sections(to_class_id)
    section_by_name = {(s.name or "").strip().lower(): s for s in target_sections}
    fallback_section = target_sections[0] if target_sections else None

    # Target academic year: explicit body value wins, else the target class's
    # own year; when neither exists the student's year is left untouched.
    target_year_id = data.get("academic_year_id") or target.academic_year_id
    if target_year_id:
        from app.models.academic import AcademicYear

        # Guard against junk strings ("None", "undefined", …) — assigning one
        # into a UUID column would 500 the whole request at flush time.
        if not AcademicYear.query.filter_by(
            id=target_year_id, school_id=g.school_id, is_deleted=False
        ).first():
            return error_response(
                "academic_year_id does not match an academic year of this school", 400
            )

    promoted_students = []
    skipped = []
    section_mappings = {}

    for student in students:
        name = _student_display_name(student)
        if student.status not in PROMOTABLE_STATUSES:
            skipped.append(
                {
                    "student_id": str(student.id),
                    "name": name,
                    "reason": f"status '{student.status}' is not promotable",
                }
            )
            continue
        if selected_ids is not None and str(student.id) not in selected_ids:
            skipped.append(
                {"student_id": str(student.id), "name": name, "reason": "not selected"}
            )
            continue

        old_name = (student.section.name or "").strip() if student.section and student.section.name else ""
        target_section = _resolve_target_section(student, section_by_name, fallback_section)

        student.class_id = to_class_id
        # Never keep a section row that belongs to another class.
        student.section_id = target_section.id if target_section else None
        if target_year_id:
            student.academic_year_id = target_year_id

        if old_name:
            section_mappings[old_name] = target_section.name if target_section else None
        elif fallback_section is not None:
            section_mappings.setdefault("(no section)", fallback_section.name)
        promoted_students.append(student)

    if not promoted_students:
        return success_response(
            {
                "promoted": 0,
                "promoted_count": 0,
                "to_class_id": str(to_class_id),
                "skipped": skipped,
                "roll_conflicts": [],
                "section_mappings": section_mappings,
            }
        )

    roll_conflicts: list = []
    try:
        db.session.flush()
        if roll_strategy == "renumber":
            _renumber_class_rolls(g.school_id, to_class_id)
        else:
            roll_conflicts = _find_roll_conflicts(g.school_id, to_class_id)
        db.session.commit()
    except Exception:
        import logging

        db.session.rollback()
        logging.getLogger(__name__).exception(
            "Promotion failed for school %s (%s -> %s)", g.school_id, from_class_id, to_class_id
        )
        return error_response("Promotion failed and was rolled back", 500)

    return success_response(
        {
            "promoted": len(promoted_students),  # legacy key (old callers)
            "promoted_count": len(promoted_students),
            "to_class_id": str(to_class_id),
            "skipped": skipped,
            "roll_conflicts": roll_conflicts,
            "section_mappings": section_mappings,
        }
    )


# ── Guardians ──────────────────────────────────────────────


@students_bp.route("/bulk-reset-passwords", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def bulk_reset_passwords():
    """Reset login passwords for the given students to the school default.

    Uses the same system default formula as enrollment
    (generate_default_password → {class}{section}{roll}.{first}, e.g.
    7a12.ram); system defaults are
    exempt from the user-chosen password policy. Returns the generated
    passwords so the admin can hand them out.
    """
    from app.utils.password import generate_default_password

    data = request.get_json(silent=True) or {}
    ids = data.get("student_ids", [])
    if not ids or not isinstance(ids, list):
        return error_response("student_ids list is required", 400)

    results = []
    for sid in ids:
        student = Student.query.filter_by(
            id=sid, school_id=g.school_id, is_deleted=False
        ).first()
        if not student or not student.user_id:
            continue
        user = User.query.get(student.user_id)
        if not user or not user.is_active:
            continue
        password = generate_default_password(user, student)
        user.set_password(password)
        results.append(
            {
                "student_id": student.student_id or str(student.id),
                "full_name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
                "password": password,
            }
        )

    if not results:
        return error_response("No matching active students found", 400)

    db.session.commit()
    return success_response({"reset": len(results), "passwords": results})


@students_bp.route("/transfers", methods=["GET"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin", "staff")
def list_transfers():
    """List transfer certificates / withdrawals for the current school."""
    from app.models.student_transfer import StudentTransfer

    query = StudentTransfer.query.filter_by(
        school_id=g.school_id, is_deleted=False
    ).order_by(StudentTransfer.created_at.desc())

    search = request.args.get("search")
    if search:
        query = query.join(Student).filter(
            db.or_(
                Student.first_name.ilike(f"%{search}%"),
                Student.last_name.ilike(f"%{search}%"),
                Student.student_id.ilike(f"%{search}%"),
            )
        )

    items, meta = paginate(query)
    return success_response(
        [_transfer_dict(t) for t in items], meta={"pagination": meta}
    )


@students_bp.route("/transfers", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin")
def create_transfer():
    """Issue a transfer certificate / withdrawal / migration for a student.

    Marks the student transferred_out in the same transaction; an unknown
    student leaves no row behind.
    """
    from app.models.student_transfer import StudentTransfer

    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    if not student_id:
        return error_response("student_id is required", 400)

    student = Student.query.filter_by(
        id=student_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not student:
        return error_response("student_id does not match a student at this school", 404)

    transfer_type = data.get("transfer_type") or "tc"
    if transfer_type not in ("tc", "withdrawal", "migration"):
        return error_response("transfer_type must be tc, withdrawal or migration", 400)

    transfer = StudentTransfer(
        school_id=g.school_id,
        student_id=student.id,
        transfer_type=transfer_type,
        reason=data.get("reason"),
        destination_school=data.get("destination_school"),
        status="completed",
        created_by_id=get_jwt_identity(),
    )
    student.status = "transferred_out"
    db.session.add(transfer)
    db.session.commit()
    return created_response(_transfer_dict(transfer))


def _transfer_dict(t) -> dict:
    student = t.student
    return {
        "id": str(t.id),
        "student_id": str(t.student_id),
        "student_name": (
            f"{student.first_name or ''} {student.last_name or ''}".strip()
            if student
            else None
        ),
        "student_code": student.student_id if student else None,
        "transfer_type": t.transfer_type,
        "reason": t.reason,
        "destination_school": t.destination_school,
        "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@students_bp.route("/<uuid:student_id>/guardians", methods=["GET"])
@jwt_required()
@school_required
def list_guardians(student_id):
    """List guardians for a student."""
    student = Student.query.get(student_id)
    if not student or student.is_deleted or str(student.school_id) != str(g.school_id):
        return error_response("Student not found", 404)
    guardians = Guardian.query.filter_by(student_id=student.id, is_deleted=False).all()
    return success_response([_guardian_dict(gd) for gd in guardians])


@students_bp.route("/<uuid:student_id>/guardians", methods=["POST"])
@jwt_required()
@school_required
@role_required("superadmin", "school_admin", "staff")
def add_guardian(student_id):
    """Add a guardian to a student."""
    student = Student.query.get(student_id)
    if not student or student.is_deleted or str(student.school_id) != str(g.school_id):
        return error_response("Student not found", 404)

    data = request.get_json(silent=True) or {}
    guardian = Guardian(school_id=g.school_id, student_id=student.id)
    _populate_guardian(guardian, data)
    parent_user = _resolve_or_create_parent_user(data, student)
    if parent_user:
        guardian.user_id = parent_user.id
    db.session.add(guardian)
    db.session.commit()
    return created_response(_guardian_dict(guardian))


# ── Helpers ────────────────────────────────────────────────


def _populate_student(student: Student, data: dict):
    allowed = {
        "first_name", "first_name_nepali", "last_name", "last_name_nepali",
        "student_id", "roll_number", "class_id", "section_id",
        "academic_year_id", "gender", "dob_bs", "dob_ad", "blood_group",
        "religion", "ethnicity", "caste", "mother_tongue",
        "disability", "disability_type", "nationality", "photo_url", "address",
        "previous_school", "status", "admission_date_bs",
        "admission_number",
    }
    for key in allowed:
        if key in data:
            setattr(student, key, data[key])


def _populate_guardian(guardian: Guardian, data: dict):
    allowed = {
        "full_name", "full_name_nepali", "relation", "phone", "phone_2",
        "email", "occupation", "address", "is_primary", "user_id",
    }
    for key in allowed:
        if key in data:
            setattr(guardian, key, data[key])


def _resolve_or_create_parent_user(guardian_data: dict, student: "Student | None" = None) -> User | None:
    """Resolve guardian to an existing parent user or create one when safe."""
    explicit_user_id = guardian_data.get("user_id")
    if explicit_user_id:
        user = User.query.filter_by(
            id=explicit_user_id,
            school_id=g.school_id,
            is_deleted=False,
        ).first()
        if user:
            return user

    full_name = (guardian_data.get("full_name") or "").strip()
    phone = (guardian_data.get("phone") or "").strip()
    email = (guardian_data.get("email") or "").strip().lower()

    if phone:
        existing_by_phone = User.query.filter_by(
            school_id=g.school_id,
            phone=phone,
            is_deleted=False,
        ).first()
        if existing_by_phone:
            if existing_by_phone.role == "parent":
                if full_name and existing_by_phone.full_name != full_name:
                    existing_by_phone.full_name = full_name
                if email and not existing_by_phone.email:
                    existing_by_phone.email = email
                return existing_by_phone
            return None

    if email:
        existing_by_email = User.query.filter(
            User.school_id == g.school_id,
            User.email.ilike(email),
            User.is_deleted.is_(False),
        ).first()
        if existing_by_email:
            if existing_by_email.role == "parent":
                if full_name and existing_by_email.full_name != full_name:
                    existing_by_email.full_name = full_name
                if phone and not existing_by_email.phone:
                    existing_by_email.phone = phone
                return existing_by_email
            return None

    # Phone is required on User model; do not create parent users without phone.
    if not phone:
        return None

    parent_user = User(
        school_id=g.school_id,
        role="parent",
        full_name=full_name or "Parent/Guardian",
        phone=phone,
        email=email or None,
    )
    parent_user.set_password(generate_default_password(parent_user, student))
    db.session.add(parent_user)
    db.session.flush()
    return parent_user


def _guardian_dict(guardian: Guardian) -> dict:
    return {
        "id": str(guardian.id),
        "full_name": guardian.full_name,
        "full_name_nepali": getattr(guardian, "full_name_nepali", None),
        "relation": guardian.relation,
        "phone": guardian.phone,
        "email": getattr(guardian, "email", None),
        "occupation": getattr(guardian, "occupation", None),
        "is_primary": guardian.is_primary,
    }
