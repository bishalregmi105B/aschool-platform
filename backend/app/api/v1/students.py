"""Students CRUD API."""
import io
import os
import zipfile

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.student import Guardian, Student
from app.utils.decorators import role_required, school_required
from app.utils.file_upload import upload_file as _upload_file
from app.utils.pagination import paginate
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
        parent_user = _resolve_or_create_parent_user(gd_data)
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
            user.set_password(data["password"])

    if student.user_id:
        user = User.query.get(student.user_id)
        if user:
            if "phone" in data:
                user.phone = data.get("phone") or None
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
        student = Student.query.filter_by(
            id=sid, school_id=g.school_id, is_deleted=False
        ).first()
        if student:
            student.roll_number = int(roll) if roll not in (None, "") else None
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


# ── Guardians ──────────────────────────────────────────────


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
    parent_user = _resolve_or_create_parent_user(data)
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
        "religion", "ethnicity", "nationality", "photo_url", "address",
        "previous_school", "status", "admission_date_bs",
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


def _resolve_or_create_parent_user(guardian_data: dict) -> User | None:
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
    parent_user.set_password(generate_default_password(parent_user))
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
