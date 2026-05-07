"""Overdue book notifications — alerts students/parents about overdue library books."""
from extensions import celery
from app.plugins.events import emit_for_school
import logging

logger = logging.getLogger(__name__)


@celery.task(name="library_overdue_check")
def check_overdue_books():
    """Run daily: notify about overdue library books.

    Only fires for schools with the 'library' plugin active.
    """
    from extensions import db
    from app.models.library import BookCheckout
    from app.models.plugin import SchoolPlugin
    from datetime import date

    today = date.today()

    active_schools = (
        db.session.query(SchoolPlugin.school_id)
        .filter_by(plugin_slug="library", active=True)
        .all()
    )

    for (school_id,) in active_schools:
        try:
            overdue = BookCheckout.query.filter(
                BookCheckout.school_id == school_id,
                BookCheckout.due_date < today,
                BookCheckout.returned_at.is_(None),
            ).all()

            for checkout in overdue:
                emit_for_school(
                    "library.book_overdue",
                    school_id=str(school_id),
                    checkout_id=str(checkout.id),
                    student_id=str(checkout.student_id),
                    book_id=str(checkout.book_id),
                    due_date=str(checkout.due_date),
                )

            logger.info("Found %d overdue books for school %s", len(overdue), school_id)
        except Exception:
            logger.exception("Failed overdue check for school %s", school_id)
