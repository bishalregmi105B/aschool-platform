"""MoE compliance reports — generates government-required reports."""
import logging
from datetime import date

logger = logging.getLogger(__name__)


class MoEReportService:
    """Generate Ministry of Education Flash Reports and EMIS data."""

    @staticmethod
    def generate_flash_report(school_id: str, report_type: str = "flash_1") -> dict:
        """Generate MoE Flash Report I or II."""
        from app.models.school import School
        from app.models.student import Student
        from app.models.staff import Staff
        from extensions import db
        from sqlalchemy import func

        school = School.query.get(school_id)
        if not school:
            return {"error": "School not found"}

        # Student counts by gender and class
        students = Student.query.filter_by(school_id=school_id, is_deleted=False).all()
        total = len(students)
        male = sum(1 for s in students if getattr(s, 'gender', '') == 'male')
        female = sum(1 for s in students if getattr(s, 'gender', '') == 'female')

        report = {
            "school_name": school.name,
            "school_name_nepali": school.name_nepali,
            "regd_number": school.regd_number,
            "district": school.district,
            "municipality": school.municipality,
            "ward": school.ward,
            "report_type": report_type,
            "generated_date": str(date.today()),
            "academic_year": school.academic_year_start_bs,
            "enrollment": {
                "total": total,
                "male": male,
                "female": female,
                "other": total - male - female,
            },
            "staff_count": school.total_staff or 0,
            "school_type": school.type,
            "school_level": school.level,
        }
        return report

    @staticmethod
    def generate_emis_export(school_id: str) -> dict:
        """Generate EMIS-compatible data export."""
        report = MoEReportService.generate_flash_report(school_id, "emis")
        report["format"] = "EMIS"
        report["version"] = "2026"
        return report
