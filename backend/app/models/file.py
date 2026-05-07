"""ManagedFile and FileFolder models — centralized file storage."""
from sqlalchemy import BigInteger, Column, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class FileFolder(SchoolModel):
    """Folder for organising ManagedFiles. Supports nested folders via parent_id."""

    __tablename__ = "file_folders"

    name = Column(String(255), nullable=False)
    parent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("file_folders.id", ondelete="CASCADE"),
        nullable=True,
    )

    files = relationship(
        "ManagedFile",
        back_populates="file_folder",
        lazy="dynamic",
        primaryjoin="and_(ManagedFile.folder_id==FileFolder.id, ManagedFile.is_deleted==False)",
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "school_id": str(self.school_id),
            "name": self.name,
            "parent_id": str(self.parent_id) if self.parent_id else None,
            "file_count": self.files.count(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ManagedFile(SchoolModel):
    """Metadata record for every file stored in R2 (or local storage).

    The actual binary lives in Cloudflare R2; this table stores the
    reference so every module can link to files by UUID.
    """

    __tablename__ = "managed_files"

    # Uploader
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Storage details
    key = Column(Text, nullable=False)           # R2 object key, e.g. "school_id/invoices/abc.pdf"
    url = Column(Text, nullable=False)           # Public URL
    original_name = Column(String(512))          # Original filename as uploaded
    mime_type = Column(String(128))              # MIME type
    size_bytes = Column(BigInteger, default=0)   # File size in bytes
    extension = Column(String(32))               # e.g. "pdf", "jpg"

    # Organisation
    folder = Column(String(255), default="general")   # legacy string folder label
    folder_id = Column(
        UUID(as_uuid=True),
        ForeignKey("file_folders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    file_folder = relationship("FileFolder", back_populates="files", primaryjoin="ManagedFile.folder_id==FileFolder.id")
    file_type = Column(
        Enum("image", "document", "video", "audio", "spreadsheet", "other",
             name="managed_file_type"),
        default="other",
    )
    tags = Column(JSONB, default=list)            # free-form tags for search

    # Module cross-linking — which module/entity owns this file
    linked_module = Column(String(100))          # e.g. "fees", "attendance", "students"
    linked_entity_id = Column(UUID(as_uuid=True)) # FK to the owning entity (nullable)

    # Access
    is_public = Column(
        Enum("public", "private", "school_only", name="file_visibility"),
        default="school_only",
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "key": self.key,
            "url": self.url,
            "original_name": self.original_name,
            "mime_type": self.mime_type,
            "size_bytes": self.size_bytes,
            "extension": self.extension,
            "folder": self.folder,
            "folder_id": str(self.folder_id) if self.folder_id else None,
            "file_type": self.file_type,
            "tags": self.tags or [],
            "linked_module": self.linked_module,
            "linked_entity_id": str(self.linked_entity_id) if self.linked_entity_id else None,
            "is_public": self.is_public,
            "uploaded_by": str(self.uploaded_by) if self.uploaded_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
