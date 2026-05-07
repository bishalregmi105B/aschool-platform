"""IEMIS Importer models — tracks import jobs."""
from sqlalchemy import Column, DateTime, Enum, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID

from app.models.base import SchoolModel


class IemisImportLog(SchoolModel):
    """Tracks every IEMIS import attempt — success, partial, or failure."""

    __tablename__ = "iemis_import_logs"

    imported_by = Column(PGUUID(as_uuid=True))
    format_code = Column(String(50), nullable=False)       # student_namewise | school_level
    filename = Column(String(512))
    total_rows = Column(Integer, default=0)
    imported_rows = Column(Integer, default=0)
    skipped_rows = Column(Integer, default=0)
    error_rows = Column(Integer, default=0)
    status = Column(
        Enum("pending", "processing", "completed", "partial", "failed",
             name="iemis_import_status"),
        default="pending",
    )
    errors = Column(JSONB, default=list)      # [{row, field, message}, ...]
    summary = Column(JSONB, default=dict)     # summary stats
    completed_at = Column(DateTime)

    def to_dict(self):
        return {
            "id": str(self.id),
            "format_code": self.format_code,
            "filename": self.filename,
            "total_rows": self.total_rows,
            "imported_rows": self.imported_rows,
            "skipped_rows": self.skipped_rows,
            "error_rows": self.error_rows,
            "status": self.status,
            "errors": self.errors or [],
            "summary": self.summary or {},
            "imported_by": str(self.imported_by) if self.imported_by else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
