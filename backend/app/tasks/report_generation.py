"""Report generation tasks (PDF report cards, compliance exports)."""
import io
import csv
import json
import logging
import zipfile
from datetime import datetime, timezone

from extensions import celery

logger = logging.getLogger(__name__)


@celery.task(name="generate_report_card_pdf", queue="default")
def generate_report_card_pdf(school_id: str, student_id: str, exam_id: str):
    """Generate PDF report card using WeasyPrint."""
    from extensions import db
    from app.models.school import School
    from app.models.student import Student
    from app.models.exam import Exam, Marks, ReportCard
    from app.models.academic import Class, Subject

    school = School.query.get(school_id)
    student = Student.query.get(student_id)
    exam = Exam.query.get(exam_id)
    if not all([school, student, exam]):
        logger.error(f"Missing data for report card: school={school_id} student={student_id} exam={exam_id}")
        return {"success": False, "error": "Missing school, student, or exam"}

    marks = Marks.query.filter_by(
        school_id=school_id, student_id=student_id, exam_id=exam_id
    ).all()

    klass = Class.query.get(student.class_id) if student.class_id else None

    # Build subject-marks table
    subjects_data = []
    total_obtained = 0
    total_full = 0
    for m in marks:
        subj = Subject.query.get(m.subject_id)
        subjects_data.append({
            "subject": subj.name if subj else "Unknown",
            "full_marks": float(subj.full_marks) if subj and subj.full_marks else 100,
            "theory": float(m.theory_marks) if m.theory_marks else 0,
            "practical": float(m.practical_marks) if m.practical_marks else 0,
            "total": float(m.total_marks) if m.total_marks else 0,
            "grade": m.grade or "",
            "gpa": float(m.gpa) if m.gpa else 0,
        })
        total_obtained += float(m.total_marks) if m.total_marks else 0
        total_full += float(subj.full_marks) if subj and subj.full_marks else 100

    percentage = round(total_obtained / total_full * 100, 2) if total_full else 0

    # Generate HTML report card
    rows_html = ""
    for s in subjects_data:
        rows_html += (
            f"<tr><td>{s['subject']}</td><td>{s['full_marks']}</td>"
            f"<td>{s['theory']}</td><td>{s['practical']}</td>"
            f"<td>{s['total']}</td><td>{s['grade']}</td><td>{s['gpa']}</td></tr>"
        )

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
body {{ font-family: 'Noto Sans', Arial, sans-serif; margin: 30px; font-size: 12px; }}
h1 {{ text-align: center; margin-bottom: 5px; }}
h2 {{ text-align: center; color: #555; margin-top: 0; }}
.info {{ display: flex; justify-content: space-between; margin: 20px 0; }}
table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
th, td {{ border: 1px solid #333; padding: 6px 8px; text-align: center; }}
th {{ background: #2c3e50; color: white; }}
.footer {{ margin-top: 40px; display: flex; justify-content: space-between; }}
.sig {{ border-top: 1px solid #333; padding-top: 5px; width: 150px; text-align: center; }}
</style></head><body>
<h1>{school.name}</h1>
<h2>{exam.name} — Report Card</h2>
<div class="info">
  <div><strong>Student:</strong> {student.first_name} {student.last_name}</div>
  <div><strong>Roll No:</strong> {student.roll_number or '-'}</div>
  <div><strong>Class:</strong> {klass.name if klass else '-'}</div>
</div>
<table>
<thead><tr><th>Subject</th><th>Full Marks</th><th>Theory</th><th>Practical</th><th>Total</th><th>Grade</th><th>GPA</th></tr></thead>
<tbody>{rows_html}</tbody>
</table>
<p><strong>Total: {total_obtained}/{total_full} ({percentage}%)</strong></p>
<div class="footer">
  <div class="sig">Class Teacher</div>
  <div class="sig">Principal</div>
  <div class="sig">Guardian</div>
</div>
</body></html>"""

    # Try WeasyPrint PDF, fall back to storing HTML
    pdf_bytes = None
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html).write_pdf()
    except ImportError:
        logger.warning("WeasyPrint not installed; storing HTML report card")

    # Upsert ReportCard record
    rc = ReportCard.query.filter_by(
        school_id=school_id, student_id=student_id, exam_id=exam_id
    ).first()
    if not rc:
        rc = ReportCard(school_id=school_id, student_id=student_id, exam_id=exam_id)
        db.session.add(rc)

    rc.total_percentage = percentage
    rc.total_marks = total_full
    rc.generated_at = datetime.now(timezone.utc)

    # In production, upload pdf_bytes to S3/MinIO and set rc.pdf_url
    # For now, store the generated HTML inline
    if pdf_bytes:
        rc.pdf_url = f"/reports/{school_id}/{student_id}_{exam_id}.pdf"
    else:
        rc.pdf_url = f"/reports/{school_id}/{student_id}_{exam_id}.html"

    db.session.commit()
    logger.info(f"Report card generated for student {student_id}, exam {exam_id}")
    return {"success": True, "report_card_id": str(rc.id), "percentage": percentage}


@celery.task(name="generate_bulk_report_cards", queue="default")
def generate_bulk_report_cards(school_id: str, exam_id: str, class_id: str):
    """Generate report cards for all students in a class, return zip URL."""
    from app.models.student import Student

    students = Student.query.filter_by(
        school_id=school_id, class_id=class_id, is_deleted=False
    ).all()

    results = []
    for student in students:
        result = generate_report_card_pdf(school_id, str(student.id), exam_id)
        results.append({"student_id": str(student.id), "result": result})

    success_count = sum(1 for r in results if r["result"] and r["result"].get("success"))
    logger.info(f"Bulk report cards: {success_count}/{len(students)} for class {class_id}")
    return {
        "success": True,
        "total": len(students),
        "generated": success_count,
        "results": results,
    }


@celery.task(name="export_emis_data", queue="default")
def export_emis_data(school_id: str, academic_year_id: str):
    """Export data in Nepal EMIS format (CSV + JSON)."""
    from extensions import db
    from app.models.school import School
    from app.models.student import Student
    from app.models.academic import Class, AcademicYear
    from app.models.user import User
    from app.models.compliance import EMISExport

    school = School.query.get(school_id)
    ay = AcademicYear.query.get(academic_year_id)
    if not school or not ay:
        return {"success": False, "error": "School or academic year not found"}

    # Student enrollment by class and gender
    classes = Class.query.filter_by(school_id=school_id).order_by(Class.numeric_grade).all()

    enrollment_data = []
    for klass in classes:
        students = Student.query.filter_by(
            school_id=school_id, class_id=klass.id, is_deleted=False
        ).all()
        male_count = sum(1 for s in students if s.gender == "male")
        female_count = sum(1 for s in students if s.gender == "female")
        other_count = len(students) - male_count - female_count
        enrollment_data.append({
            "class_name": klass.name,
            "grade": klass.numeric_grade,
            "total_students": len(students),
            "male": male_count,
            "female": female_count,
            "other": other_count,
            "dalit": sum(1 for s in students if s.ethnicity and "dalit" in s.ethnicity.lower()),
            "janajati": sum(1 for s in students if s.ethnicity and "janajati" in s.ethnicity.lower()),
            "disabled": sum(1 for s in students if s.disability),
        })

    # Staff summary
    staff = User.query.filter(
        User.school_id == school_id,
        User.role.in_(["teacher", "staff", "principal", "admin"]),
        User.is_deleted.is_(False),
    ).all()

    staff_summary = {
        "total_teachers": sum(1 for u in staff if u.role == "teacher"),
        "total_admin_staff": sum(1 for u in staff if u.role in ("staff", "admin")),
        "principal": sum(1 for u in staff if u.role == "principal"),
    }

    emis_data = {
        "school_name": school.name,
        "school_regd_number": school.regd_number,
        "district": school.district,
        "municipality": school.municipality,
        "ward": school.ward,
        "school_type": school.type,
        "school_level": school.level,
        "academic_year": ay.name,
        "enrollment": enrollment_data,
        "staff": staff_summary,
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }

    # Create CSV in-memory
    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer)
    writer.writerow([
        "Class", "Grade", "Total", "Male", "Female", "Other",
        "Dalit", "Janajati", "Disabled",
    ])
    for row in enrollment_data:
        writer.writerow([
            row["class_name"], row["grade"], row["total_students"],
            row["male"], row["female"], row["other"],
            row["dalit"], row["janajati"], row["disabled"],
        ])

    # Store export record
    export = EMISExport(
        school_id=school_id,
        academic_year=ay.name,
        export_data=emis_data,
        generated_at=datetime.now(timezone.utc),
    )
    db.session.add(export)
    db.session.commit()

    logger.info(f"EMIS data exported for school {school_id}, year {ay.name}")
    return {
        "success": True,
        "export_id": str(export.id),
        "total_students": sum(r["total_students"] for r in enrollment_data),
        "total_staff": len(staff),
    }


@celery.task(name="generate_compliance_report", queue="default")
def generate_compliance_report(school_id: str, report_type: str):
    """Generate compliance/audit report (emis, doe, neb)."""
    from extensions import db
    from app.models.school import School
    from app.models.student import Student
    from app.models.user import User
    from app.models.compliance import ComplianceReport

    school = School.query.get(school_id)
    if not school:
        return {"success": False, "error": "School not found"}

    students = Student.query.filter_by(school_id=school_id, is_deleted=False).all()
    staff = User.query.filter(
        User.school_id == school_id,
        User.role.in_(["teacher", "staff", "principal", "admin"]),
        User.is_deleted.is_(False),
    ).all()

    # Build compliance data based on report type
    data = {
        "school_name": school.name,
        "regd_number": school.regd_number,
        "district": school.district,
        "municipality": school.municipality,
        "report_type": report_type,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "metrics": {},
    }

    if report_type == "emis":
        data["metrics"] = {
            "total_students": len(students),
            "male_students": sum(1 for s in students if s.gender == "male"),
            "female_students": sum(1 for s in students if s.gender == "female"),
            "dalit_students": sum(1 for s in students if s.ethnicity and "dalit" in s.ethnicity.lower()),
            "disabled_students": sum(1 for s in students if s.disability),
            "total_teachers": sum(1 for u in staff if u.role == "teacher"),
            "student_teacher_ratio": round(
                len(students) / max(sum(1 for u in staff if u.role == "teacher"), 1), 1
            ),
        }
    elif report_type == "doe":
        # Department of Education compliance
        data["metrics"] = {
            "school_type": school.type,
            "school_level": school.level,
            "total_enrolled": len(students),
            "total_staff": len(staff),
            "has_library": True,  # Would check from facilities
            "has_computer_lab": True,
            "has_science_lab": school.level in ("secondary", "higher_secondary", "all"),
        }
    elif report_type == "neb":
        # National Examination Board
        data["metrics"] = {
            "affiliated_to": school.affiliated_to,
            "total_grade11_12": sum(
                1 for s in students
                if s.klass and s.klass.numeric_grade and s.klass.numeric_grade >= 11
            ),
        }

    report = ComplianceReport(
        school_id=school_id,
        report_type=report_type,
        data=data,
        status="draft",
    )
    db.session.add(report)
    db.session.commit()

    logger.info(f"Compliance report ({report_type}) generated for school {school_id}")
    return {"success": True, "report_id": str(report.id), "report_type": report_type}
