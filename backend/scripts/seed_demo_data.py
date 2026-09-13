"""Demo-data seeder — fills the demo tenant so the six canonical benchmark
tasks are completable live (plan 6.7-6 / WO-10).

Extends seed.py (which creates the school + admin): this script adds the
academic skeleton (year → classes → sections), 40 students with guardians,
fee collections, and one exam with marks for Class 10. Idempotent — safe to
re-run; each step no-ops when its data already exists.

Run inside the container:  python scripts/seed_demo_data.py
"""
import random
import uuid
from datetime import date

from app import create_app
from extensions import db
from app.models.academic import AcademicYear, Class, Section, Subject
from app.models.exam import Exam
from app.models.fee import FeeCollection, FeeType
from app.models.school import School
from app.models.student import Guardian, Student
from app.models.user import User

random.seed(2083)

FIRST_M = ["Aarav", "Bibek", "Kiran", "Nabin", "Dipesh", "Rajesh", "Suman", "Hari", "Bikash", "Prakash", "Dinesh", "Manish", "Arjun", "Ramesh", "Deepak", "Naresh"]
FIRST_F = ["Sita", "Maya", "Sarita", "Anita", "Gita", "Priya", "Kamala", "Nisha", "Laxmi", "Rita", "Sabina", "Pooja", "Sunita", "Muna", "Anjali", "Kabita"]
FIRST_NP = ["आरव", "बिबेक", "किरण", "नविन", "दिपेश", "राजेश", "सुमन", "हरि", "विकास", "प्रकाश", "दिनेश", "मनिष", "अर्जुन", "रमेश", "दिपक", "नरेश"]
LAST = ["Sharma", "Nepali", "Gurung", "Tamang", "Shrestha", "Thapa", "Magar", "Rai", "Bhandari", "Acharya", "Karki", "Basnet", "Poudel", "Adhikari", "Dahal", "Bhattarai"]
LAST_NP = ["शर्मा", "नेपाली", "गुरुङ", "तामाङ", "श्रेष्ठ", "थापा", "मगर", "राई", "भण्डारी", "आचार्य", "कार्की", "बस्नेत", "पौडेल", "अधिकारी", "दाहाल", "भट्टराई"]
WARDS = ["Baneshwor - 10", "Kalanki - 14", "Chabahil - 8", "Patan - 5", "Bhaktapur - 7"]


def seed_demo_data():
    app = create_app()
    with app.app_context():
        school = School.query.filter_by(slug="demo").first()
        if not school:
            print("✗ demo school missing — run seed.py first")
            return

        # ── 1. Academic year (current) ─────────────────────────────────
        year = AcademicYear.query.filter_by(school_id=school.id, name="2083-84").first()
        if not year:
            year = AcademicYear(
                school_id=school.id,
                name="2083-84",
                name_nepali="२०८३-८४",
                start_date_bs="2083-01-01",
                end_date_bs="2083-12-30",
                start_date_ad=date(2026, 4, 14),
                end_date_ad=date(2027, 4, 13),
                is_current=True,
            )
            db.session.add(year)
            db.session.commit()
            print("✓ Academic year 2083-84 (current)")
        else:
            print("• Academic year exists")

        # ── 2. Classes 1-10 + sections ─────────────────────────────────
        made_classes = 0
        for grade in range(1, 11):
            klass = Class.query.filter_by(
                school_id=school.id, numeric_grade=grade, academic_year_id=year.id
            ).first()
            if not klass:
                klass = Class(
                    school_id=school.id,
                    name=f"Grade {grade}",
                    name_nepali=f"कक्षा {grade}",
                    numeric_grade=grade,
                    sort_order=grade,
                    academic_year_id=year.id,
                )
                db.session.add(klass)
                db.session.flush()
                made_classes += 1
            # Two sections for grades 5-10, one for 1-4
            sec_names = ["A", "B"] if grade >= 5 else ["A"]
            for sn in sec_names:
                if not Section.query.filter_by(class_id=klass.id, name=sn).first():
                    db.session.add(Section(
                        school_id=school.id, class_id=klass.id, name=sn, capacity=40
                    ))
        db.session.commit()
        print(f"✓ Classes (created {made_classes}) + sections")

        # ── 3. Students + guardians ────────────────────────────────────
        existing = Student.query.filter_by(school_id=school.id, is_deleted=False).count()
        if existing < 40:
            class_10 = Class.query.filter_by(
                school_id=school.id, numeric_grade=10, academic_year_id=year.id
            ).first()
            sec_a = Section.query.filter_by(class_id=class_10.id, name="A").first()
            sec_b = Section.query.filter_by(class_id=class_10.id, name="B").first()
            class_9 = Class.query.filter_by(
                school_id=school.id, numeric_grade=9, academic_year_id=year.id
            ).first()
            sec_9a = Section.query.filter_by(class_id=class_9.id, name="A").first() if class_9 else None

            created = 0
            for i in range(40 - existing):
                male = random.random() < 0.5
                fn = random.choice(FIRST_M if male else FIRST_F)
                fnp = random.choice(FIRST_NP)
                ln = random.choice(LAST)
                lnp = random.choice(LAST_NP)
                # 20 in 10-A, 12 in 10-B, 8 in 9-A
                if created < 20:
                    sec = sec_a
                elif created < 32:
                    sec = sec_b
                else:
                    sec = sec_9a or sec_a
                stu = Student(
                    school_id=school.id,
                    first_name=fn,
                    first_name_nepali=fnp,
                    last_name=ln,
                    last_name_nepali=lnp,
                    gender="male" if male else "female",
                    dob_bs=f"{random.randint(2068, 2071)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                    student_id=f"STU-{2083}{created + 1:04d}",
                    roll_number=created + 1,
                    class_id=sec.class_id,
                    section_id=sec.id,
                    academic_year_id=year.id,
                    status="active",
                    address={"ward": random.choice(WARDS), "district": "Kathmandu"},
                )
                db.session.add(stu)
                db.session.flush()
                db.session.add(Guardian(
                    school_id=school.id,
                    student_id=stu.id,
                    full_name=f"{random.choice(FIRST_M if random.random() < 0.7 else FIRST_F)} {ln}",
                    phone=f"98{random.randint(10**8, 10**9 - 1)}",
                    relation="father" if random.random() < 0.6 else "mother",
                ))
                created += 1
            db.session.commit()
            print(f"✓ Students + guardians (created {created})")
        else:
            print(f"• {existing} students exist")

        # ── 4. Fee types + collections ─────────────────────────────────
        if not FeeType.query.filter_by(school_id=school.id).count():
            ft = FeeType(school_id=school.id, name="Monthly Tuition", description="Monthly tuition fee", is_system=True)
            db.session.add(ft)
            db.session.commit()
            print("✓ FeeType: Monthly Tuition")
        students = Student.query.filter_by(school_id=school.id, is_deleted=False).all()
        fc_count = FeeCollection.query.filter_by(school_id=school.id, is_deleted=False).count()
        if fc_count == 0:
            for stu in students:
                for month in ["01", "02"]:
                    paid = month == "01"  # month 1 paid, month 2 due
                    db.session.add(FeeCollection(
                        school_id=school.id,
                        student_id=stu.id,
                        academic_year="2083-84",
                        fee_item_name="Monthly Tuition",
                        amount=2500,
                        month_bs=month,
                        year_bs="2083",
                        payment_status="paid" if paid else "pending",
                        payment_method="cash" if paid else None,
                    ))
            db.session.commit()
            print(f"✓ Fee collections (2 months × {len(students)} students; month 1 paid, month 2 due)")
        else:
            print(f"• {fc_count} fee collections exist")

        # ── 5. Exam with marks for Class 10 ────────────────────────────
        exam = Exam.query.filter_by(school_id=school.id, name="First Terminal Examination").first()
        if not exam:
            exam = Exam(
                school_id=school.id,
                name="First Terminal Examination",
                name_nepali="प्रथम त्रैमासिक परीक्षा",
                exam_type="terminal",
                academic_year_id=year.id,
                start_date_bs="2083-05-04",
                end_date_bs="2083-05-12",
                start_date_ad=date(2026, 8, 20),
                end_date_ad=date(2026, 8, 28),
            )
            db.session.add(exam)
            db.session.commit()
            print("✓ Exam: First Terminal Examination (Class 10 context)")
        else:
            print("• Exam exists")

        print("\n🎉 Demo data seeded — all six benchmark tasks now completable.")


if __name__ == "__main__":
    seed_demo_data()
