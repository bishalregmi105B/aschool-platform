"""Document Store Service — CRUD for saved designer canvas documents."""
from __future__ import annotations

import uuid

from extensions import db


class DocumentStoreService:
    """Persist and retrieve designer canvas documents."""

    @staticmethod
    def list_documents(school_id, doc_type: str | None = None) -> list[dict]:
        from app.models.designer_document import DesignerDocument

        query = DesignerDocument.for_school(school_id)
        if doc_type:
            query = query.filter(DesignerDocument.template_type == doc_type)
        docs = query.order_by(DesignerDocument.updated_at.desc()).all()
        return [d.to_dict() for d in docs]

    @staticmethod
    def get_document(school_id, doc_id: str) -> dict | None:
        from app.models.designer_document import DesignerDocument

        doc = DesignerDocument.query.filter_by(
            id=doc_id, school_id=school_id, is_deleted=False
        ).first()
        return doc.to_dict() if doc else None

    @staticmethod
    def save_document(
        school_id,
        user_id,
        doc_id: str | None,
        name: str,
        template_type: str,
        canvas_state: dict,
        thumbnail_url: str,
    ) -> dict:
        from app.models.designer_document import DesignerDocument
        from app.models.designer_document_revision import DesignerDocumentRevision

        if doc_id:
            doc = DesignerDocument.query.filter_by(
                id=doc_id, school_id=school_id, is_deleted=False
            ).first()
            if not doc:
                doc = DesignerDocument(school_id=school_id, created_by_id=user_id)
                db.session.add(doc)
        else:
            doc = DesignerDocument(school_id=school_id, created_by_id=user_id)
            db.session.add(doc)

        # Snapshot the previous state for version history (keep last 10, FIFO).
        if doc.id is not None and doc.canvas_state:
            revision = DesignerDocumentRevision(
                school_id=school_id,
                document_id=doc.id,
                created_by_id=user_id,
                name=doc.name,
                canvas_state=doc.canvas_state,
                thumbnail_url=doc.thumbnail_url,
            )
            db.session.add(revision)
            db.session.flush()
            kept = (
                DesignerDocumentRevision.query.filter_by(
                    document_id=doc.id, school_id=school_id, is_deleted=False
                )
                .order_by(DesignerDocumentRevision.created_at.desc())
                .all()
            )
            for stale in kept[10:]:
                stale.soft_delete()

        doc.name          = name
        doc.template_type = template_type
        doc.canvas_state  = canvas_state
        doc.thumbnail_url = thumbnail_url
        db.session.commit()
        return doc.to_dict()

    @staticmethod
    def delete_document(school_id, doc_id: str) -> bool:
        from app.models.designer_document import DesignerDocument

        doc = DesignerDocument.query.filter_by(
            id=doc_id, school_id=school_id, is_deleted=False
        ).first()
        if not doc:
            return False
        doc.soft_delete()
        return True

    @staticmethod
    def list_revisions(school_id, doc_id: str) -> list[dict]:
        from app.models.designer_document_revision import DesignerDocumentRevision

        revisions = (
            DesignerDocumentRevision.query.filter_by(
                document_id=doc_id, school_id=school_id, is_deleted=False
            )
            .order_by(DesignerDocumentRevision.created_at.desc())
            .limit(10)
            .all()
        )
        return [r.to_dict() for r in revisions]

    @staticmethod
    def get_revision(school_id, revision_id: str) -> dict | None:
        from app.models.designer_document_revision import DesignerDocumentRevision

        rev = DesignerDocumentRevision.query.filter_by(
            id=revision_id, school_id=school_id, is_deleted=False
        ).first()
        if not rev:
            return None
        out = rev.to_dict()
        out["canvas_state"] = rev.canvas_state
        return out
