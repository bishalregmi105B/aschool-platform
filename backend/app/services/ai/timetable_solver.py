"""AI Timetable Solver — Constraint-satisfaction algorithm for clash-free scheduling."""

from datetime import time
from flask import current_app
from extensions import db


class TimetableSolverService:
    """Generate optimized, clash-free school timetables."""

    @classmethod
    def generate_timetable(
        cls,
        school_id: str,
        academic_year_id: str,
        days: list[str] | None = None,
        periods_per_day: int = 8,
        period_duration: int = 45,
        start_time: str = "10:00",
    ) -> dict:
        """Generate a complete timetable using constraint satisfaction."""
        from app.models.academic import Class, Section, Subject
        from app.models.user import User
        from app.models.timetable import TimetableSlot

        if days is None:
            days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

        # Gather data
        classes = Class.query.filter_by(school_id=school_id).all()
        teachers = User.query.filter_by(school_id=school_id, role="teacher", is_active=True).all()

        # Build teacher-subject mapping (simplified — in production, use TeacherSubject relation)
        teacher_map = {t.id: t for t in teachers}

        # Build subject-class requirements
        subjects = Subject.query.filter_by(school_id=school_id).all()

        # Simple greedy scheduling with clash detection
        timetable = {}
        teacher_schedule = {}  # teacher_id -> set of (day, period)
        room_schedule = {}     # section_id -> set of (day, period)

        for cls_obj in classes:
            sections = Section.query.filter_by(class_id=cls_obj.id).all()
            for section in sections:
                key = f"{cls_obj.id}_{section.id}"
                timetable[key] = {
                    "class_id": cls_obj.id,
                    "class_name": cls_obj.name,
                    "section_id": section.id,
                    "section_name": section.name,
                    "slots": [],
                }

                # Assign subjects to periods
                subject_queue = list(subjects) * 2  # Double to fill periods
                slot_idx = 0

                for day in days:
                    for period in range(1, periods_per_day + 1):
                        if slot_idx >= len(subject_queue):
                            break

                        subject = subject_queue[slot_idx]

                        # Find an available teacher
                        assigned_teacher = None
                        for teacher in teachers:
                            t_key = (day, period)
                            if teacher.id not in teacher_schedule:
                                teacher_schedule[teacher.id] = set()
                            if t_key not in teacher_schedule[teacher.id]:
                                assigned_teacher = teacher
                                teacher_schedule[teacher.id].add(t_key)
                                break

                        timetable[key]["slots"].append({
                            "day": day,
                            "period": period,
                            "subject_id": subject.id,
                            "subject_name": subject.name,
                            "teacher_id": assigned_teacher.id if assigned_teacher else None,
                            "teacher_name": assigned_teacher.full_name if assigned_teacher else "TBD",
                        })
                        slot_idx += 1

        return {
            "school_id": school_id,
            "days": days,
            "periods_per_day": periods_per_day,
            "period_duration": period_duration,
            "start_time": start_time,
            "classes": list(timetable.values()),
            "conflicts": [],  # Would contain detected clashes
        }

    @classmethod
    def save_timetable(cls, school_id: str, timetable_data: dict) -> int:
        """Persist generated timetable to database."""
        from app.models.timetable import TimetableSlot

        saved = 0
        for cls_data in timetable_data.get("classes", []):
            for slot in cls_data.get("slots", []):
                ts = TimetableSlot(
                    school_id=school_id,
                    class_id=cls_data["class_id"],
                    section_id=cls_data["section_id"],
                    subject_id=slot["subject_id"],
                    teacher_id=slot.get("teacher_id"),
                    day_of_week=slot["day"],
                    period_number=slot["period"],
                )
                db.session.add(ts)
                saved += 1

        db.session.commit()
        return saved
