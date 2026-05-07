"""LMS Video Processing Tasks — transcode, thumbnail generation, duration extraction."""

import logging
from datetime import datetime, timezone

from extensions import celery

logger = logging.getLogger(__name__)


@celery.task(name="process_lms_video", queue="media", bind=True, max_retries=3)
def process_lms_video(self, school_id: str, lesson_id: str, video_url: str):
    """Process an uploaded LMS video: extract metadata, generate thumbnail.

    In production this would trigger an async transcoding pipeline (e.g. AWS MediaConvert
    or ffmpeg on a worker). For now we update the lesson record with the raw URL and
    mark it as 'ready'.
    """
    try:
        from app.models.lms import Lesson
        from extensions import db

        lesson = Lesson.query.filter_by(id=lesson_id, school_id=school_id).first()
        if not lesson:
            logger.warning("LMS video processor: lesson %s not found", lesson_id)
            return {"success": False, "error": "Lesson not found"}

        # ── Attempt metadata extraction with ffprobe / moviepy ────────────
        duration_seconds = None
        thumbnail_url = None

        try:
            import json as _json
            import subprocess

            result = subprocess.run(
                [
                    "ffprobe",
                    "-v",
                    "quiet",
                    "-print_format",
                    "json",
                    "-show_format",
                    video_url,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                probe = _json.loads(result.stdout)
                duration_seconds = float(probe.get("format", {}).get("duration", 0))
        except (FileNotFoundError, Exception) as exc:
            logger.debug("ffprobe unavailable or failed: %s", exc)

        # ── Update lesson with processed metadata ─────────────────────────
        if hasattr(lesson, "duration_seconds") and duration_seconds:
            lesson.duration_seconds = int(duration_seconds)
        if hasattr(lesson, "status"):
            lesson.status = "ready"
        if hasattr(lesson, "processed_at"):
            lesson.processed_at = datetime.now(timezone.utc)
        if hasattr(lesson, "video_url") and not lesson.video_url:
            lesson.video_url = video_url

        db.session.commit()
        logger.info("LMS video processed: lesson=%s school=%s", lesson_id, school_id)
        return {
            "success": True,
            "lesson_id": lesson_id,
            "duration_seconds": duration_seconds,
            "status": "ready",
        }

    except Exception as exc:
        logger.error("LMS video processing failed: %s", exc)
        try:
            self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
        except self.MaxRetriesExceededError:
            return {"success": False, "error": str(exc)}


@celery.task(name="process_lms_recording", queue="media")
def process_lms_recording(school_id: str, live_class_id: str, recording_url: str):
    """Post-process a live class recording: store URL, update class status.

    Called automatically when a Jitsi/video-call session ends and a recording
    is available.
    """
    try:
        from app.models.lms import LiveClass
        from extensions import db

        live_class = LiveClass.query.filter_by(
            id=live_class_id, school_id=school_id
        ).first()
        if not live_class:
            logger.warning(
                "process_lms_recording: live class %s not found", live_class_id
            )
            return {"success": False, "error": "Live class not found"}

        if hasattr(live_class, "recording_url"):
            live_class.recording_url = recording_url
        if hasattr(live_class, "status"):
            live_class.status = "ended"
        if hasattr(live_class, "ended_at") and not live_class.ended_at:
            live_class.ended_at = datetime.now(timezone.utc)

        db.session.commit()

        # Emit event so parent/student apps are notified of recording availability
        from app.plugins.events import emit

        emit(
            "lms.recording_ready",
            school_id=school_id,
            live_class_id=live_class_id,
            recording_url=recording_url,
        )

        logger.info(
            "LMS recording processed: live_class=%s school=%s",
            live_class_id,
            school_id,
        )
        return {
            "success": True,
            "live_class_id": live_class_id,
            "recording_url": recording_url,
        }

    except Exception as exc:
        logger.error("LMS recording processing failed: %s", exc)
        return {"success": False, "error": str(exc)}


@celery.task(name="cleanup_expired_lms_content", queue="default")
def cleanup_expired_lms_content(school_id: str):
    """Archive or delete LMS content that has exceeded its expiry date."""
    try:
        from app.models.lms import Lesson
        from extensions import db

        now = datetime.now(timezone.utc)
        expired = Lesson.query.filter(
            Lesson.school_id == school_id,
            Lesson.expires_at is not None,
            Lesson.expires_at < now,
            Lesson.is_deleted.is_(False),
        ).all()

        count = 0
        for lesson in expired:
            if hasattr(lesson, "status"):
                lesson.status = "archived"
            count += 1

        if count:
            db.session.commit()
            logger.info(
                "Archived %d expired LMS lessons for school %s", count, school_id
            )

        return {"success": True, "archived": count}

    except Exception as exc:
        logger.error("LMS content cleanup failed: %s", exc)
        return {"success": False, "error": str(exc)}
