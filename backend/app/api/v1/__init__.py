"""API v1 package — core blueprint with all route modules."""
from flask import Blueprint

api_v1_bp = Blueprint("api_v1", __name__)

# Modules whose blueprints are mounted below. Plugin manifests pointing at
# these paths are skipped by the loader so each route exists exactly once
# (previously ~10 modules were registered twice: static + manifest).
STATICALLY_MOUNTED_MODULES = {
    "app.api.v1.auth",
    "app.api.v1.schools",
    "app.api.v1.super_admin",
    "app.api.v1.users",
    "app.api.v1.students",
    "app.api.v1.staff",
    "app.api.v1.plugins",
    "app.api.v1.academics",
    "app.api.v1.analytics",
    "app.api.v1.mobile",
    "app.api.v1.parent_app",
    "app.api.v1.student_app",
    "app.api.v1.teacher",
    "app.api.v1.sse",
    "app.api.v1.webhooks",
    "app.api.v1.search",
    "app.api.v1.files",
    "app.api.v1.iemis_importer",
    "app.api.v1.communications",
    "app.api.v1.sliders",
    "app.api.v1.themes",
    "app.api.v1.elibrary",
    "app.api.v1.benchmarking",
    "app.api.v1.design_studio",
    "app.api.v1.ai_usage",
    "app.api.v1.notifications",
    "app.api.v1.faqs",
    "app.api.v1.db_backup_api",
    "app.api.v1.hostel",
    # WP-style move (2026-08-30): these seven plugin blueprints live in their
    # module folders (app/plugins/modules/<slug>/routes.py); app/api/v1/<slug>.py
    # is a 2-line re-export shim. They are STILL mounted statically below (via
    # the shim) so their manifest paths are listed here to keep the loader from
    # double-registering them.
    "app.plugins.modules.white_label.routes",
    "app.plugins.modules.multi_branch.routes",
    "app.plugins.modules.biometric.routes",
    "app.plugins.modules.ai_adaptive_learning.routes",
    "app.plugins.modules.social_ads.routes",
    "app.plugins.modules.disaster_management.routes",
    "app.plugins.modules.incident_management.routes",
}

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

# Notification Center — in-app notifications (always available)
from app.api.v1.notifications import notifications_bp
api_v1_bp.register_blueprint(notifications_bp)

# FAQ management — school FAQ CRUD
from app.api.v1.faqs import faqs_bp
api_v1_bp.register_blueprint(faqs_bp)

# Database backup management API
from app.api.v1.db_backup_api import db_backup_api_bp
api_v1_bp.register_blueprint(db_backup_api_bp)

# Hostel management — rooms, allocations, occupancy
from app.api.v1.hostel import hostel_bp
api_v1_bp.register_blueprint(hostel_bp)

# White-Label Branding — custom domain + branding overrides (premium plugin;
# routes self-gate via @plugin_required("white_label"))
from app.api.v1.white_label import white_label_bp
api_v1_bp.register_blueprint(white_label_bp)

# Multi-Branch Chain — org/branch registry + cross-branch analytics (premium
# plugin; routes self-gate via @plugin_required("multi_branch"))
from app.api.v1.multi_branch import multi_branch_bp
api_v1_bp.register_blueprint(multi_branch_bp)

# Biometric Integration — ZKTeco-style fingerprint device management, keyed
# punch ingestion, health monitoring (premium plugin; routes self-gate via
# @plugin_required("biometric"); device endpoints auth via X-Device-Key)
from app.api.v1.biometric import biometric_bp
api_v1_bp.register_blueprint(biometric_bp)

# AI Adaptive Learning — per-student learning paths + mastery records
# (premium plugin; routes self-gate via @plugin_required("ai_adaptive_learning");
# LLM calls go through AITokenHub with a labeled deterministic fallback)
from app.api.v1.adaptive_learning import adaptive_learning_bp
api_v1_bp.register_blueprint(adaptive_learning_bp)

# Social Ads — ad campaign CRUD + honest in-school audience estimates
# (growth plugin; routes self-gate via @plugin_required("social_ads");
# no Meta Ads wiring — reach/impressions stay real (0) until delivery exists)
from app.api.v1.social_ads import social_ads_bp
api_v1_bp.register_blueprint(social_ads_bp)

# Disaster Management — drills + participation + overview + seismic alerts
# (premium plugin; premium tier of `emergency`. Routes mount under
# /emergency to match the frontend calls and self-gate via
# @plugin_required("disaster_management"); emergency models reused)
from app.api.v1.disaster_management import disaster_management_bp
api_v1_bp.register_blueprint(disaster_management_bp)

# Incident Management — assignment/workflow/escalation/analytics on top of
# the base incidents plugin (growth plugin; routes self-gate via
# @plugin_required("incident_management"); no base /incidents route duplicated)
from app.api.v1.incident_management import incident_management_bp
api_v1_bp.register_blueprint(incident_management_bp)
