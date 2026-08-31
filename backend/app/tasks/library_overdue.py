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
    from app.models.library import BookIssue
    from app.models.plugin import SchoolPlugin
    from datetime import date

    today = date.today()

    active_schools = (
        db.session.query(SchoolPlugin.school_id)
        .filter(
            # the plugin was renamed library → library_management; both row
            # generations exist across deployments
            SchoolPlugin.plugin_slug.in_(["library", "library_management"]),
            SchoolPlugin.active == True,  # noqa: E712
        )
        .all()
    )

    for (school_id,) in active_schools:
        try:
            overdue = BookIssue.query.filter(
                BookIssue.school_id == school_id,
                BookIssue.status == "issued",
                BookIssue.due_date < today,
            ).all()

            for issue in overdue:
                emit_for_school(
                    "library.book_overdue",
                    school_id=str(school_id),
                    issue_id=str(issue.id),
                    student_id=str(issue.student_id) if issue.student_id else None,
                    book_id=str(issue.book_id),
                    due_date=str(issue.due_date),
                )

            logger.info("Found %d overdue books for school %s", len(overdue), school_id)
        except Exception:
            logger.exception("Failed overdue check for school %s", school_id)
