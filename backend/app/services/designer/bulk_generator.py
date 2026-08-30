"""Bulk Document Generator — Mass generate ID cards, certificates, report cards."""

from extensions import db
from app.utils.nepali_date import today_bs


def _absolute_url(path: str) -> str:
    """Return an absolute URL for an upload path using the current Flask request."""
    if not path:
        return ""
    if path.startswith(("http://", "https://", "data:")):
        return path
    try:
        from flask import request as _req
        base = _req.host_url.rstrip("/")
        return base + (path if path.startswith("/") else "/" + path)
    except RuntimeError:
        return path


def _qr_data_uri(payload: str, box_size: int = 3) -> str:
    """Render a payload as a PNG data-URI QR code.

    Returns "" when the qrcode lib is unavailable or the payload is empty —
    the canvas renderer drops empty image objects, so templates degrade
    gracefully to a blank QR box.
    """
    if not payload:
        return ""
    try:
        import io

        import qrcode

        img = qrcode.make(payload, box_size=box_size, border=1)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        import base64

        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return ""


class BulkGeneratorService:
    """Generate documents in bulk for entire classes or schools."""

    @staticmethod
    def _school_fields(school) -> dict:
        if not school:
            return {
                "school_name": "",
                "school_address": "",
                "school_phone": "",
                "school_email": "",
                "school_website": "",
                "school_logo": "",
            }
        return {
            "school_name": school.name or "",
            "school_address": school.address or "",
            "school_phone": school.phone or "",
            "school_email": school.email or "",
            "school_website": school.website_external or "",
            "school_logo": school.logo_url or "",
        }

    @classmethod
    def generate_bulk_id_cards(
        cls,
        school_id: str,
        class_id: str | None = None,
        template_id: str | None = None,
    ) -> list[dict]:
        """Generate ID cards for all students (or students in a specific class)."""
        from app.models.student import Student
        from app.models.school import School
        from app.services.designer.template_engine import TemplateEngineService

        school = School.query.get(school_id)
        school_config = {
            "name": school.name if school else "",
            "address": school.address if school else "",
            "phone": school.phone if school else "",
            "email": school.email if school else "",
            "website": school.website_external if school else "",
            "logo_url": school.logo_url if school else "",
        }
        school_fields = cls._school_fields(school)

        resolved_template_id = TemplateEngineService.resolve_template_id(template_id or "id_card_standard")
        if not TemplateEngineService.get_template(resolved_template_id, school_id=school_id):
            resolved_template_id = "id_card_standard"
        template_meta = TemplateEngineService.get_template(resolved_template_id, school_id=school_id) or {}

        query = (
            Student.query.options(
                db.selectinload(Student.klass),
                db.selectinload(Student.section),
                db.selectinload(Student.user),
                db.selectinload(Student.guardians),
            )
            .filter_by(school_id=school_id, status="active")
        )
        if class_id:
            query = query.filter_by(class_id=class_id)

        students = query.all()
        cards = []

        for student in students:
            class_name = student.klass.name if getattr(student, "klass", None) else ""
            section_name = student.section.name if getattr(student, "section", None) else ""
            roll_no = str(student.roll_number) if student.roll_number is not None else ""
            enrollment_number = student.admission_number or student.student_id or ""

            # Prefer student account phone, then primary guardian phone as fallback.
            phone = ""
            if getattr(student, "user", None) and getattr(student.user, "phone", None):
                phone = student.user.phone
            else:
                guardians = getattr(student, "guardians", []) or []
                primary = next((g for g in guardians if getattr(g, "is_primary", False) and getattr(g, "phone", None)), None)
                if primary:
                    phone = primary.phone
                else:
                    any_guardian = next((g for g in guardians if getattr(g, "phone", None)), None)
                    phone = any_guardian.phone if any_guardian else ""

            data = {
                "name": f"{student.first_name} {student.last_name}",
                "class": class_name,
                "class_name": class_name,
                "section": section_name,
                "section_name": section_name,
                "roll_no": roll_no,
                "roll_number": roll_no,
                "enrollment_number": enrollment_number,
                "dob": student.dob_bs or (student.dob_ad.isoformat() if student.dob_ad else ""),
                "address": student.address.get("permanent", "") if isinstance(student.address, dict) else (student.address or ""),
                "blood_group": student.blood_group or "",
                "phone": phone,
                "photo": _absolute_url(student.photo_url or ""),
                "photo_url": _absolute_url(student.photo_url or ""),
                # QR verification payload (scannable identity string; a public
                # verify URL can replace this once an endpoint exists).
                "qr_code": _qr_data_uri(
                    f"ASCHOOL-ID|{school_id}|{student.id}|{enrollment_number}"
                ),
                **school_fields,
            }
            html = TemplateEngineService.render_html(
                resolved_template_id, data, school_config,
                school_id=school_id, template_meta=template_meta or None,
            )
            canvas_json = TemplateEngineService.render_document(
                resolved_template_id, data, school_config,
                school_id=school_id, template_meta=template_meta or None,
            )
            cards.append({
                "student_id": str(student.id),
                "student_name": data["name"],
                "student_roll": roll_no,
                "template_id": resolved_template_id,
                "template_width": template_meta.get("width"),
                "template_height": template_meta.get("height"),
                "html": html,
                "canvas_json": canvas_json,
            })

        return cards

    @classmethod
    def _active_students(cls, school_id: str, class_id: str | None):
        from app.models.student import Student

        query = (
            Student.query.options(
                db.selectinload(Student.klass),
                db.selectinload(Student.section),
                db.selectinload(Student.user),
                db.selectinload(Student.guardians),
            )
            .filter_by(school_id=school_id, status="active")
        )
        if class_id:
            query = query.filter_by(class_id=class_id)
        return query.all()

    @classmethod
    def _guardian_name(cls, student, mother: bool = False, primary_only: bool = False) -> str:
        """Resolve a guardian display name for template tokens.

        mother=True picks the guardian with relation == 'mother'; otherwise
        the primary guardian (or father) is preferred.
        """
        guardians = list(getattr(student, "guardians", []) or [])
        if not guardians:
            return ""
        if mother:
            match = next((g for g in guardians if g.relation == "mother" and g.full_name), None)
            if match:
                return match.full_name
            return ""
        if primary_only:
            match = next(
                (g for g in guardians if g.relation == "father" and g.full_name),
                None,
            ) or next((g for g in guardians if g.is_primary and g.full_name), None)
            if match:
                return match.full_name
        match = next((g for g in guardians if g.is_primary and g.full_name), None)
        return match.full_name if match else ""

    @classmethod
    def _render_for_student(
        cls,
        school_id,
        student,
        template_meta,
        resolved_template_id,
        school_config,
        data_extra,
    ):
        # Latent NameError fix: this helper renders via the template engine but
        # (unlike the other generators) never imported it — bulk admit cards and
        # bulk certificates 500'd on every call before this import existed.
        from app.services.designer.template_engine import TemplateEngineService

        class_name = student.klass.name if getattr(student, "klass", None) else ""
        section_name = student.section.name if getattr(student, "section", None) else ""
        roll_no = str(student.roll_number) if student.roll_number is not None else ""
        enrollment_number = student.admission_number or student.student_id or ""

        data = {
            "student_name": f"{student.first_name} {student.last_name}",
            "name": f"{student.first_name} {student.last_name}",
            "father_name": cls._guardian_name(student, primary_only=True),
            "mother_name": cls._guardian_name(student, mother=True),
            "admission_date": student.admission_date_bs
            or (student.admission_date_ad.isoformat() if getattr(student, "admission_date_ad", None) else ""),
            "class": class_name,
            "class_name": class_name,
            "section": section_name,
            "section_name": section_name,
            "roll_no": roll_no,
            "roll_number": roll_no,
            "enrollment_number": enrollment_number,
            "symbol_no": enrollment_number,
            "dob": student.dob_bs
            or (student.dob_ad.isoformat() if getattr(student, "dob_ad", None) else ""),
            "photo": _absolute_url(student.photo_url or ""),
            "photo_url": _absolute_url(student.photo_url or ""),
            **data_extra,
        }

        html = TemplateEngineService.render_html(
            resolved_template_id,
            data,
            school_config,
            school_id=school_id,
            template_meta=template_meta or None,
        )
        canvas_json = TemplateEngineService.render_document(
            resolved_template_id,
            data,
            school_config,
            school_id=school_id,
            template_meta=template_meta or None,
        )
        return {
            "student_id": str(student.id),
            "student_name": data["name"],
            "student_roll": roll_no,
            "template_id": resolved_template_id,
            "template_width": template_meta.get("width") if template_meta else None,
            "template_height": template_meta.get("height") if template_meta else None,
            "html": html,
            "canvas_json": canvas_json,
        }

    @classmethod
    def generate_bulk_admit_cards(
        cls,
        school_id: str,
        class_id: str | None = None,
        exam_id: str | None = None,
        template_id: str | None = None,
    ) -> list[dict]:
        """Generate admit cards for all students (optionally one class) for an exam."""
        from app.models.exam import Exam
        from app.models.school import School
        from app.services.designer.template_engine import TemplateEngineService

        school = School.query.get(school_id)
        school_config = {
            "name": school.name if school else "",
            "address": school.address if school else "",
            "phone": school.phone if school else "",
            "email": school.email if school else "",
            "website": school.website_external if school else "",
            "logo_url": school.logo_url if school else "",
        }
        school_fields = cls._school_fields(school)

        exam = Exam.query.filter(
            Exam.id == exam_id, Exam.school_id == school_id
        ).first() if exam_id else None

        resolved_template_id = TemplateEngineService.resolve_template_id(
            template_id or "admit_card_standard"
        )
        template_meta = (
            TemplateEngineService.get_template(resolved_template_id, school_id=school_id)
            or {}
        )

        students = cls._active_students(school_id, class_id)

        exam_data = {
            "exam_name": exam.name if exam else "",
            "exam_type": (getattr(exam, "exam_type", "") or "") if exam else "",
            "exam_year": (
                exam.academic_year.name if getattr(exam, "academic_year", None) else ""
            ),
            "exam_instructions": (exam.instructions or "") if exam else "",
            **school_fields,
        }

        return [
            cls._render_for_student(
                school_id, student, template_meta, resolved_template_id,
                school_config, exam_data,
            )
            for student in students
        ]

    @classmethod
    def generate_bulk_certificates(
        cls,
        school_id: str,
        class_id: str | None = None,
        certificate_type: str = "character",
        template_id: str | None = None,
    ) -> list[dict]:
        """Generate certificates (character/transfer/merit/participation)."""
        from datetime import date

        from app.models.school import School
        from app.services.designer.template_engine import TemplateEngineService

        school = School.query.get(school_id)
        school_config = {
            "name": school.name if school else "",
            "address": school.address if school else "",
            "phone": school.phone if school else "",
            "email": school.email if school else "",
            "website": school.website_external if school else "",
            "logo_url": school.logo_url if school else "",
        }
        school_fields = cls._school_fields(school)

        default_templates = {
            "character": "character_certificate",
            "transfer": "transfer_certificate",
            "merit": "merit_certificate",
            "participation": "participation_certificate",
        }
        resolved_template_id = TemplateEngineService.resolve_template_id(
            template_id or default_templates.get(certificate_type, "character_certificate")
        )
        template_meta = (
            TemplateEngineService.get_template(resolved_template_id, school_id=school_id)
            or {}
        )

        students = cls._active_students(school_id, class_id)

        cert_common = {
            "certificate_type": certificate_type,
            "issue_date": today_bs(),
            "issue_date_ad": date.today().isoformat(),
            **school_fields,
        }

        return [
            cls._render_for_student(
                school_id, student, template_meta, resolved_template_id,
                school_config, cert_common,
            )
            for student in students
        ]

    @classmethod
    def generate_bulk_marksheets(
        cls,
        school_id: str,
        exam_id: str,
        class_id: str,
        template_id: str | None = None,
    ) -> list[dict]:
        """Generate marksheets for all students who took an exam."""
        from app.models.student import Student
        from app.models.exam import Exam, Marks
        from app.models.school import School
        from app.services.designer.template_engine import TemplateEngineService

        school = School.query.get(school_id)
        school_config = {
            "name": school.name if school else "",
            "address": school.address if school else "",
            "phone": school.phone if school else "",
            "email": school.email if school else "",
            "website": school.website_external if school else "",
            "logo_url": school.logo_url if school else "",
        }
        school_fields = cls._school_fields(school)

        # The registry "marksheet" template is the data-driven one (writer
        # engine with a subject_rows table + {name}/{exam_name}/{gpa} tokens),
        # so bulk output carries each student's real marks.
        resolved_template_id = TemplateEngineService.resolve_template_id(template_id or "marksheet")
        if not TemplateEngineService.get_template(resolved_template_id, school_id=school_id):
            resolved_template_id = "marksheet"
        template_meta = TemplateEngineService.get_template(resolved_template_id, school_id=school_id) or {}

        from app.models.academic import Subject

        exam = Exam.query.get(exam_id)
        if not exam:
            return []

        # Pre-load all subjects referenced by this exam
        subject_map: dict = {}
        if exam.subject_ids:
            for subj in Subject.query.filter(Subject.id.in_(exam.subject_ids)).all():
                subject_map[str(subj.id)] = subj
        else:
            from app.models.academic import Class as ClassModel
            klass = ClassModel.query.get(class_id)
            if klass:
                for subj in Subject.query.filter(Subject.class_ids.any(klass.id)).all():
                    subject_map[str(subj.id)] = subj

        students = (
            Student.query.options(
                db.selectinload(Student.klass),
                db.selectinload(Student.section),
                db.selectinload(Student.guardians),
            )
            .filter_by(school_id=school_id, class_id=class_id, status="active")
            .order_by(Student.roll_number)
            .all()
        )

        # Batch-fetch every mark for these students in ONE query (avoids
        # a per-student SELECT + lazy subject loads → N+1).
        marks_by_student: dict = {}
        if students:
            all_marks = (
                Marks.query.options(db.selectinload(Marks.subject))
                .filter(
                    Marks.exam_id == exam_id,
                    Marks.is_deleted == False,  # noqa: E712
                    Marks.student_id.in_([s.id for s in students]),
                )
                .all()
            )
            for m in all_marks:
                marks_by_student.setdefault(str(m.student_id), []).append(m)

        marksheets = []

        for student in students:
            marks_list = marks_by_student.get(str(student.id), [])
            marks_by_subject = {str(m.subject_id): m for m in marks_list}

            subjects_data = []
            total_obtained = 0.0
            total_full = 0.0
            total_credit_hours = 0.0
            weighted_gpa_sum = 0.0

            # Use configured subject order; fall back to whatever marks exist
            subject_ids_ordered = list(subject_map.keys()) or list(marks_by_subject.keys())
            for sid in subject_ids_ordered:
                subj = subject_map.get(sid)
                m = marks_by_subject.get(sid)

                subj_name = subj.name if subj else (m.subject.name if m and m.subject else "Unknown")
                full = float(m.full_marks or (subj.full_marks if subj else 100) or 100) if m else float(subj.full_marks or 100)
                th_full = float(subj.full_marks - (subj.practical_full_marks or 0)) if subj and subj.has_practical else full
                pr_full = float(subj.practical_full_marks or 0) if subj and subj.has_practical else 0.0
                pass_m = float(m.pass_marks or (subj.pass_marks if subj else 32) or 32) if m else float(subj.pass_marks or 32)
                credit = float(subj.credit_hours or 0) if subj else 0.0

                if m:
                    th_obt = float(m.theory_marks or 0)
                    pr_obt = float(m.practical_marks or 0)
                    total_obt = float(m.total_marks or m.obtained_marks or (th_obt + pr_obt))
                    grade = m.grade or cls._neb_grade(total_obt, full)
                    gpa_val = float(m.gpa or cls._neb_gpa(total_obt, full))
                    # Compute TH and IN grades separately for IEMIS grade sheet
                    if subj and subj.has_practical and pr_full and th_full:
                        th_grade_val = cls._neb_grade(th_obt, th_full)
                        th_gpa_val   = cls._neb_gpa(th_obt, th_full)
                        in_grade_val = cls._neb_grade(pr_obt, pr_full)
                        in_gpa_val   = cls._neb_gpa(pr_obt, pr_full)
                    else:
                        # No separate practical marks — IN uses same overall grade
                        th_grade_val = grade
                        th_gpa_val   = gpa_val
                        in_grade_val = grade
                        in_gpa_val   = gpa_val
                else:
                    th_obt = pr_obt = total_obt = 0.0
                    grade = "—"
                    gpa_val = 0.0
                    th_grade_val = in_grade_val = "—"
                    th_gpa_val = in_gpa_val = 0.0

                subjects_data.append({
                    "subject": subj_name,
                    "th_full": th_full,
                    "th_obtained": th_obt,
                    "pr_full": pr_full,
                    "pr_obtained": pr_obt,
                    "full_marks": full,
                    "pass_marks": pass_m,
                    "obtained": total_obt,
                    "grade": grade,
                    "gpa": gpa_val,
                    "th_grade": th_grade_val,
                    "th_gpa": th_gpa_val,
                    "in_grade": in_grade_val,
                    "in_gpa": in_gpa_val,
                    "credit_hours": credit,
                    "has_practical": bool(subj.has_practical) if subj else bool(pr_full),
                })
                total_obtained += total_obt
                total_full += full
                if credit:
                    total_credit_hours += credit
                    weighted_gpa_sum += gpa_val * credit

            percentage = round(total_obtained / total_full * 100, 1) if total_full else 0.0
            # Weighted GPA if credit hours configured, otherwise simple average
            if total_credit_hours > 0:
                gpa_avg = round(weighted_gpa_sum / total_credit_hours, 2)
            else:
                scored = [s["gpa"] for s in subjects_data if s.get("gpa", 0) > 0]
                gpa_avg = round(sum(scored) / len(scored), 2) if scored else 0.0
            overall_grade = cls._neb_grade_from_gpa(gpa_avg)

            class_name = student.klass.name if getattr(student, "klass", None) else ""
            section_name = student.section.name if getattr(student, "section", None) else ""
            roll_no = str(student.roll_number) if student.roll_number is not None else ""
            dob = student.dob_bs or (student.dob_ad.isoformat() if student.dob_ad else "")
            symbol_no = getattr(student, "symbol_number", "") or ""
            enrollment_number = student.admission_number or student.student_id or ""

            data = {
                "name": f"{student.first_name} {student.last_name}",
                "class": class_name,
                "class_name": class_name,
                "section": section_name,
                "section_name": section_name,
                "roll_no": roll_no,
                "roll_number": roll_no,
                "dob": dob,
                "dob_ad": student.dob_ad.strftime("%Y-%m-%d") if student.dob_ad else "",
                "symbol_no": symbol_no,
                "enrollment_number": enrollment_number,
                "iemis_code": getattr(school, "regd_number", "") or "",
                "exam_name": exam.name or "",
                "exam_year": (
                    exam.start_date_bs[:4] if exam.start_date_bs
                    else (str(exam.start_date.year) if exam.start_date else
                          (str(exam.created_at.year) if exam.created_at else ""))
                ),
                "subjects_marks": subjects_data,
                "total": total_obtained,
                "total_full": total_full,
                "percentage": percentage,
                "grade": overall_grade,
                "gpa": gpa_avg,
                "total_credit_hours": total_credit_hours,
                **school_fields,
            }

            html = TemplateEngineService.render_html(
                resolved_template_id, data, school_config,
                school_id=school_id, template_meta=template_meta or None,
            )
            canvas_json = TemplateEngineService.render_document(
                resolved_template_id, data, school_config,
                school_id=school_id, template_meta=template_meta or None,
            )
            marksheets.append({
                "student_id": str(student.id),
                "student_name": data["name"],
                "total": total_obtained,
                "percentage": percentage,
                "template_id": resolved_template_id,
                "template_width": template_meta.get("width"),
                "template_height": template_meta.get("height"),
                "html": html,
                "canvas_json": canvas_json,
            })

        # Calculate ranks after all have been processed
        marksheets.sort(key=lambda x: x["percentage"], reverse=True)
        for i, ms in enumerate(marksheets, 1):
            ms["rank"] = i

        return marksheets

    # ── NEB Grading helpers ──────────────────────────────────────────────────
    @staticmethod
    def _neb_grade(obtained: float, full: float) -> str:
        if not full:
            return "NG"
        pct = obtained / full * 100
        if pct >= 90: return "A+"
        if pct >= 80: return "A"
        if pct >= 70: return "B+"
        if pct >= 60: return "B"
        if pct >= 50: return "C+"
        if pct >= 40: return "C"
        if pct >= 35: return "D"
        return "NG"

    @staticmethod
    def _neb_gpa(obtained: float, full: float) -> float:
        if not full:
            return 0.0
        pct = obtained / full * 100
        if pct >= 90: return 4.0
        if pct >= 80: return 3.6
        if pct >= 70: return 3.2
        if pct >= 60: return 2.8
        if pct >= 50: return 2.4
        if pct >= 40: return 2.0
        if pct >= 35: return 1.6
        return 0.0

    @staticmethod
    def _neb_grade_from_gpa(gpa: float) -> str:
        if gpa >= 3.9: return "A+"
        if gpa >= 3.5: return "A"
        if gpa >= 3.1: return "B+"
        if gpa >= 2.7: return "B"
        if gpa >= 2.3: return "C+"
        if gpa >= 1.9: return "C"
        if gpa >= 1.5: return "D"
        return "NG"
