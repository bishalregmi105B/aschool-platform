"""Bulk Document Generator — Mass generate ID cards, certificates, report cards."""

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

        query = Student.query.filter_by(school_id=school_id, status="active")
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
                "photo": student.photo_url or "",
                "photo_url": student.photo_url or "",
                **school_fields,
            }
            html = TemplateEngineService.render_html(resolved_template_id, data, school_config, school_id=school_id)
            canvas_json = TemplateEngineService.render_document(resolved_template_id, data, school_config, school_id=school_id)
            cards.append({
                "student_id": str(student.id),
                "student_name": data["name"],
                "template_id": resolved_template_id,
                "template_width": template_meta.get("width"),
                "template_height": template_meta.get("height"),
                "html": html,
                "canvas_json": canvas_json,
            })

        return cards

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

        resolved_template_id = TemplateEngineService.resolve_template_id(template_id or "marksheet")
        if not TemplateEngineService.get_template(resolved_template_id, school_id=school_id):
            resolved_template_id = "marksheet"
        template_meta = TemplateEngineService.get_template(resolved_template_id, school_id=school_id) or {}

        exam = Exam.query.get(exam_id)
        if not exam:
            return []

        students = Student.query.filter_by(school_id=school_id, class_id=class_id, status="active").all()
        marksheets = []

        for student in students:
            marks_list = Marks.query.filter_by(exam_id=exam_id, student_id=student.id).all()
            if not marks_list:
                continue

            subjects_data = []
            total_obtained = 0
            total_full = 0

            for m in marks_list:
                subjects_data.append({
                    "subject": m.subject_name if hasattr(m, "subject_name") else str(m.subject_id),
                    "full_marks": m.full_marks,
                    "pass_marks": m.pass_marks,
                    "obtained": m.obtained_marks,
                    "grade": cls._calculate_grade(m.obtained_marks, m.full_marks),
                })
                total_obtained += m.obtained_marks or 0
                total_full += m.full_marks or 0

            percentage = round(total_obtained / total_full * 100, 1) if total_full else 0

            class_name = student.klass.name if getattr(student, "klass", None) else ""
            section_name = student.section.name if getattr(student, "section", None) else ""
            roll_no = str(student.roll_number) if student.roll_number is not None else ""

            data = {
                "name": f"{student.first_name} {student.last_name}",
                "class": class_name,
                "class_name": class_name,
                "section": section_name,
                "section_name": section_name,
                "roll_no": roll_no,
                "roll_number": roll_no,
                "subjects_marks": subjects_data,
                "total": total_obtained,
                "percentage": percentage,
                "grade": cls._percentage_to_gpa(percentage),
                **school_fields,
            }

            html = TemplateEngineService.render_html(resolved_template_id, data, school_config, school_id=school_id)
            canvas_json = TemplateEngineService.render_document(resolved_template_id, data, school_config, school_id=school_id)
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

        # Calculate ranks
        marksheets.sort(key=lambda x: x["percentage"], reverse=True)
        for i, ms in enumerate(marksheets, 1):
            ms["rank"] = i

        return marksheets

    @staticmethod
    def _calculate_grade(obtained: float, full: float) -> str:
        if not full:
            return "N/A"
        pct = obtained / full * 100
        if pct >= 90: return "A+"
        if pct >= 80: return "A"
        if pct >= 70: return "B+"
        if pct >= 60: return "B"
        if pct >= 50: return "C+"
        if pct >= 40: return "C"
        if pct >= 30: return "D"
        return "E"

    @staticmethod
    def _percentage_to_gpa(pct: float) -> str:
        if pct >= 90: return "4.0"
        if pct >= 80: return "3.6"
        if pct >= 70: return "3.2"
        if pct >= 60: return "2.8"
        if pct >= 50: return "2.4"
        if pct >= 40: return "2.0"
        return "1.6"
