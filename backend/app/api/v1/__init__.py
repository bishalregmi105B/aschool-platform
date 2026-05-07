"""API v1 package — core blueprint with all route modules."""
from flask import Blueprint

api_v1_bp = Blueprint("api_v1", __name__)

# Core routes (always available, not plugin-gated)
from app.api.v1.auth import auth_bp
from app.api.v1.schools import schools_bp
from app.api.v1.super_admin import super_admin_bp
from app.api.v1.users import users_bp
from app.api.v1.students import students_bp
from app.api.v1.staff import staff_bp
from app.api.v1.plugins import plugins_bp
from app.api.v1.academics import academics_bp
from app.api.v1.analytics import analytics_bp
from app.api.v1.mobile import mobile_bp
from app.api.v1.parent_app import parent_app_bp
from app.api.v1.student_app import student_app_bp
from app.api.v1.teacher import teacher_bp
from app.api.v1.sse import sse_bp
from app.api.v1.webhooks import webhooks_v1_bp

api_v1_bp.register_blueprint(auth_bp)
api_v1_bp.register_blueprint(schools_bp)
api_v1_bp.register_blueprint(super_admin_bp)
api_v1_bp.register_blueprint(users_bp)
api_v1_bp.register_blueprint(students_bp)
api_v1_bp.register_blueprint(staff_bp)
api_v1_bp.register_blueprint(plugins_bp)
api_v1_bp.register_blueprint(academics_bp)
api_v1_bp.register_blueprint(analytics_bp)
api_v1_bp.register_blueprint(mobile_bp)
api_v1_bp.register_blueprint(parent_app_bp)
api_v1_bp.register_blueprint(student_app_bp)
api_v1_bp.register_blueprint(teacher_bp)
api_v1_bp.register_blueprint(sse_bp)
api_v1_bp.register_blueprint(webhooks_v1_bp)

# Unified search (core, not plugin-gated)
from app.api.v1.search import search_bp
api_v1_bp.register_blueprint(search_bp)

# Plugin blueprints — explicitly registered here so they sit under /api/v1/
from app.api.v1.files import files_bp
from app.api.v1.iemis_importer import iemis_importer_bp
from app.api.v1.communications import communications_bp
from app.api.v1.sliders import sliders_bp
from app.api.v1.themes import themes_bp
from app.api.v1.elibrary import elibrary_bp
from app.api.v1.benchmarking import benchmarking_bp
from app.api.v1.design_studio import design_studio_bp
api_v1_bp.register_blueprint(files_bp)
api_v1_bp.register_blueprint(iemis_importer_bp)
api_v1_bp.register_blueprint(communications_bp)
api_v1_bp.register_blueprint(sliders_bp)
api_v1_bp.register_blueprint(themes_bp)
api_v1_bp.register_blueprint(elibrary_bp)
api_v1_bp.register_blueprint(benchmarking_bp)
api_v1_bp.register_blueprint(design_studio_bp)

# Additional plugin API routes are registered dynamically by PluginLoader.discover_and_register()
# See: app/plugins/loader.py
# Plugin blueprints: attendance_bp, notices_bp, fees_bp, exams_bp, reports_bp, website_bp, etc.

# AI Token Hub — admin stats & quota management (always registered, not plugin-gated)
from app.api.v1.ai_usage import ai_usage_bp
api_v1_bp.register_blueprint(ai_usage_bp)
