"""FAQ model."""
import uuid
from datetime import datetime, timezone

from app.extensions import db


class FAQ(db.Model):
    __tablename__ = "faqs"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True)
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), default="General")
    is_active = db.Column(db.Boolean, default=True)
    is_deleted = db.Column(db.Boolean, default=False)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def __repr__(self) -> str:
        return f"<FAQ {self.id}: {self.question[:40]}>"
