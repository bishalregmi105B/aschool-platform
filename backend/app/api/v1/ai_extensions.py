"""AW-09/10/11 extension routes (PD coach, live polls, QTI export)."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.plugins.decorators import plugin_required
from app.services.ai import extensions as ext
from app.utils.decorators import school_required
from app.utils.response import success_response, error_response

extensions_bp = Blueprint("ai_extensions", __name__, url_prefix="/ai/ext")

# PD coach (AW-09) — registered onto the workbench blueprint's url space
ext.register_pd_routes(extensions_bp)
# live polls (AW-10)
ext.register_poll_routes(extensions_bp)


@extensions_bp.route("/qti/export", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("ai_suite")
def qti_export():
    """QTI 3.0 export over the school's question bank (AW-11)."""
    from app.models.question_bank import QuestionBankItem

    subject_id = request.args.get("subject_id")
    query = QuestionBankItem.query.filter(
        QuestionBankItem.school_id == g.school_id,
        QuestionBankItem.is_deleted.is_(False),
        QuestionBankItem.is_approved.is_(True),
    )
    if subject_id:
        query = query.filter(QuestionBankItem.subject_id == subject_id)
    items = query.limit(100).all()
    if not items:
        return error_response("No approved questions to export", 404)
    xml = ext.qti_export(items)
    return success_response({"qti_xml": xml, "item_count": len(items)})
