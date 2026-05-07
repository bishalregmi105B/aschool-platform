"""LMS Video Service — Jitsi live class management + recording."""
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class VideoService:
    """Manages live classes via Jitsi Meet and recorded class library."""

    JITSI_DOMAIN = "meet.jit.si"  # Self-hosted or JaaS domain

    @staticmethod
    def create_live_class(school_id: str, course_id: str, teacher_id: str,
                          title: str, scheduled_at: datetime, duration_min: int = 45) -> dict:
        """Schedule a live class and generate Jitsi room."""
        from extensions import db
        from app.models.lms import LiveClass
        import uuid

        room_id = f"aschool-{school_id[:8]}-{uuid.uuid4().hex[:8]}"
        join_url = f"https://{VideoService.JITSI_DOMAIN}/{room_id}"

        live_class = LiveClass(
            school_id=school_id,
            course_id=course_id,
            teacher_id=teacher_id,
            title=title,
            room_id=room_id,
            join_url=join_url,
            scheduled_at=scheduled_at,
            duration_minutes=duration_min,
            ends_at=scheduled_at + timedelta(minutes=duration_min),
            status="scheduled",
        )
        db.session.add(live_class)
        db.session.commit()

        return {
            "id": str(live_class.id),
            "room_id": room_id,
            "join_url": join_url,
            "scheduled_at": str(scheduled_at),
        }

    @staticmethod
    def start_class(class_id: str) -> dict:
        """Mark a live class as started."""
        from extensions import db
        from app.models.lms import LiveClass

        lc = LiveClass.query.get(class_id)
        if not lc:
            return {"error": "Class not found"}
        lc.status = "live"
        lc.started_at = datetime.utcnow()
        db.session.commit()
        return {"status": "live", "join_url": lc.join_url}

    @staticmethod
    def end_class(class_id: str) -> dict:
        """End a live class and mark for recording processing."""
        from extensions import db
        from app.models.lms import LiveClass

        lc = LiveClass.query.get(class_id)
        if not lc:
            return {"error": "Class not found"}
        lc.status = "completed"
        lc.ended_at = datetime.utcnow()
        db.session.commit()
        return {"status": "completed"}


class ContentEngine:
    """Organizes course content: chapters → lessons → resources."""

    @staticmethod
    def create_course(school_id: str, title: str, subject_id: str = None,
                      teacher_id: str = None, description: str = None) -> dict:
        """Create a new course."""
        from extensions import db
        from app.models.lms import Course

        course = Course(
            school_id=school_id,
            title=title,
            subject_id=subject_id,
            teacher_id=teacher_id,
            description=description,
            status="draft",
        )
        db.session.add(course)
        db.session.commit()
        return {"id": str(course.id), "title": title, "status": "draft"}

    @staticmethod
    def add_lesson(course_id: str, title: str, content: str = None,
                   video_url: str = None, order: int = 0) -> dict:
        """Add a lesson to a course."""
        from extensions import db
        from app.models.lms import Lesson

        lesson = Lesson(
            course_id=course_id,
            title=title,
            content=content,
            video_url=video_url,
            order=order,
        )
        db.session.add(lesson)
        db.session.commit()
        return {"id": str(lesson.id), "title": title}

    @staticmethod
    def get_course_structure(course_id: str) -> dict:
        """Get full course structure with lessons."""
        from app.models.lms import Course, Lesson

        course = Course.query.get(course_id)
        if not course:
            return None
        lessons = Lesson.query.filter_by(
            course_id=course_id
        ).order_by(Lesson.order).all()

        return {
            "id": str(course.id),
            "title": course.title,
            "description": course.description,
            "lessons": [
                {"id": str(l.id), "title": l.title, "order": l.order, "video_url": l.video_url}
                for l in lessons
            ],
        }
