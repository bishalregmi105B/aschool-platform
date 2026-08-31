"""
Plugin Loader — discovers YAML manifests and registers Flask blueprints.

Discovery order (Odoo-style):
  1. app/plugins/modules/*/manifest.yaml  ← new self-contained module packages
  2. app/plugins/manifests/*.yaml          ← legacy flat manifests (backward compat)

All plugin blueprints are loaded once at startup. The @plugin_required
decorator handles per-school access control at request time.
WP-style catalog model (2026-08-30): the plugins DIRECTORY is the catalog
source of truth. The DB `plugins` table is only a per-school-install-state
store plus a backward-compatible MIRROR of the catalog (refresh_registry()
upserts it from the scanned manifests); nothing ever seeds the catalog.
"""

import importlib
import logging
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

# Categories allowed by the plugins.category enum — anything else falls back
# to "starter" so a bad manifest header can never break the mirror upsert.
_VALID_CATEGORIES = {"core", "starter", "growth", "premium", "add_on"}


class PluginLoader:
    """Discovers plugin manifests and registers their Flask blueprints.

    Supports two discovery paths:
    - *New* (Odoo-style): app/plugins/modules/{slug}/manifest.yaml
    - *Legacy*: app/plugins/manifests/{slug}.yaml
    New modules take precedence over legacy manifests of the same slug.
    """

    _plugins: dict = {}
    _modules_dir = Path(__file__).parent / "modules"  # Odoo-style module packages
    _manifests_dir = Path(__file__).parent / "manifests"  # Legacy flat manifests

    @classmethod
    def _scan_manifests(cls) -> set[str]:
        """Rescan both manifest sources into the in-memory registry.

        Returns the set of blueprint module paths the manifests point at
        (informational; mounting is decided in discover_and_register).
        Does NOT touch Flask — safe to call at any time (refresh_registry).
        """
        cls._plugins.clear()
        registered: set[str] = set()

        # ── 1. New Odoo-style modules (modules/{slug}/manifest.yaml) ──────
        if cls._modules_dir.exists():
            for manifest_file in sorted(cls._modules_dir.rglob("manifest.yaml")):
                if manifest_file.parent == cls._modules_dir:
                    continue  # skip orphaned manifest.yaml at root
                cls._load_manifest(manifest_file, registered)
        else:
            logger.debug(
                "Modules directory not found: %s (using legacy manifests)",
                cls._modules_dir,
            )

        # ── 2. Legacy flat manifests (backward compat) ────────────────────
        if cls._manifests_dir.exists():
            for manifest_file in sorted(cls._manifests_dir.glob("*.yaml")):
                if manifest_file.name.startswith("_"):
                    continue
                cls._load_manifest(manifest_file, registered, legacy=True)

        logger.info(
            "PluginLoader: %d modules registered (%d from modules/, legacy fills gaps)",
            len(cls._plugins),
            sum(1 for m in cls._plugins.values() if m.get("_source") == "module"),
        )
        return registered

    @classmethod
    def _load_manifest(
        cls, manifest_file: Path, registered_blueprints: set, legacy: bool = False
    ):
        try:
            manifest = yaml.safe_load(manifest_file.read_text())
        except yaml.YAMLError as e:
            logger.error("Failed to parse %s: %s", manifest_file, e)
            return

        slug = manifest.get("slug")
        if not slug:
            logger.warning("Manifest %s missing 'slug'", manifest_file)
            return

        # New modules always win over legacy
        if slug in cls._plugins and not legacy:
            logger.debug("Module slug '%s' already loaded, skipping duplicate", slug)
            return
        if slug in cls._plugins and cls._plugins[slug].get("_source") == "module":
            return  # new module already loaded; skip legacy duplicate

        manifest["_source"] = "legacy" if legacy else "module"
        manifest["_manifest_path"] = str(manifest_file)

        # ── Extended header fields (WP-style plugin headers) ─────────────
        module_dir = (
            manifest_file.parent if manifest_file.parent != cls._manifests_dir else None
        )
        manifest["_author"] = manifest.get("author") or ""

        # config_schema: a `config_schema: true` (or a relative path) header
        # points at the settings-screen definition next to the manifest.
        cfg_schema = manifest.get("config_schema")
        if module_dir is not None:
            if cfg_schema is True:
                manifest["_config_schema_path"] = str(
                    module_dir / "config_schema.yaml"
                )
            elif isinstance(cfg_schema, str) and cfg_schema:
                manifest["_config_schema_path"] = str(module_dir / cfg_schema)
            elif (module_dir / "config_schema.yaml").exists():
                manifest["_config_schema_path"] = str(
                    module_dir / "config_schema.yaml"
                )
            else:
                manifest["_config_schema_path"] = None
        else:
            manifest["_config_schema_path"] = None

        # hooks module: explicit `hooks:` header, else auto-detect the WP-style
        # default (hooks.py next to the manifest) for module packages.
        hooks = manifest.get("hooks")
        if isinstance(hooks, str) and hooks:
            manifest["_hooks_module"] = hooks
        elif module_dir is not None and (module_dir / "hooks.py").exists():
            manifest["_hooks_module"] = (
                f"app.plugins.modules.{slug}.hooks"
                if manifest.get("_source") == "module"
                else None
            )
            if manifest["_hooks_module"] is None:
                # Legacy manifests have no package home — skip auto hooks.
                manifest.pop("_hooks_module")
        else:
            manifest["_hooks_module"] = None

        cls._plugins[slug] = manifest
        if manifest.get("api_blueprint"):
            registered_blueprints.add(manifest["api_blueprint"])

    @classmethod
    def discover_and_register(cls, app):
        """Scan module directories and register each plugin's Flask blueprint."""
        cls._scan_manifests()

        # Blueprints mounted statically by the core app must not be
        # re-registered from manifests (that created duplicate URL rules).
        # Only the STATICALLY_MOUNTED set counts as "already mounted" — the
        # scan's returned paths are the manifests that still NEED mounting.
        try:
            from app.api.v1 import STATICALLY_MOUNTED_MODULES

            already_mounted: set[str] = set(STATICALLY_MOUNTED_MODULES)
        except ImportError:  # pragma: no cover — defensive
            already_mounted = set()

        cls._register_manifest_blueprints(app, already_mounted)

    @classmethod
    def _register_manifest_blueprints(cls, app, already_mounted: set) -> None:
        """Mount every manifest blueprint that is not statically mounted.

        Split from the scan so refresh_registry() can rescan the directory
        without touching Flask — blueprint mounting happens exactly once,
        at startup. Import failures are logged and non-fatal: a broken
        plugin module must never take the whole app down.
        """
        for slug, manifest in list(cls._plugins.items()):
            bp_path = manifest.get("api_blueprint")
            if not bp_path or bp_path in already_mounted:
                continue
            try:
                mod = importlib.import_module(bp_path)
                bp = (
                    getattr(mod, f"{slug}_bp", None)
                    or getattr(mod, "bp", None)
                    or cls._find_blueprint(mod)
                )
                if bp:
                    app.register_blueprint(
                        bp, url_prefix=f"/api/v1{bp.url_prefix or ''}"
                    )
                    already_mounted.add(bp_path)
                    logger.info(
                        "Registered blueprint: %s (%s)",
                        slug,
                        manifest.get("_source", "module"),
                    )
                else:
                    logger.warning(
                        "Plugin %s: no blueprint object in %s", slug, bp_path
                    )
            except ImportError:
                logger.debug("Plugin %s: blueprint %s not found (skip)", slug, bp_path)

    @classmethod
    def _find_blueprint(cls, module):
        """Safely find a Blueprint in module vars, skipping Werkzeug proxies."""
        from flask import Blueprint

        for v in vars(module).values():
            try:
                if isinstance(v, Blueprint):
                    return v
            except RuntimeError:
                continue
        return None

    @classmethod
    def get_manifest(cls, slug: str) -> dict | None:
        return cls._plugins.get(slug)

    @classmethod
    def get_all_manifests(cls) -> dict:
        return cls._plugins

    @classmethod
    def get_module_dir(cls, slug: str) -> Path | None:
        """Directory of a module-package plugin, if it has one."""
        manifest = cls._plugins.get(slug)
        if not manifest or manifest.get("_source") != "module":
            return None
        path = Path(manifest.get("_manifest_path", "")).parent
        return path if path != cls._manifests_dir else None

    @classmethod
    def get_config_schema(cls, slug: str) -> list[dict]:
        """Settings-screen fields for a plugin from its config_schema.yaml.

        Returns [] when the plugin carries no schema (the settings UI then
        falls back to the generic key/value editor).
        """
        manifest = cls._plugins.get(slug)
        if not manifest:
            return []
        schema_path = manifest.get("_config_schema_path")
        if not schema_path:
            return []
        try:
            data = yaml.safe_load(Path(schema_path).read_text())
        except (OSError, yaml.YAMLError) as e:
            logger.error("Failed to parse config schema for %s: %s", slug, e)
            return []
        if not data:
            return []
        fields = data.get("fields", []) if isinstance(data, dict) else data
        return fields if isinstance(fields, list) else []

    @classmethod
    def get_hooks(cls, slug: str):
        """Import and return a plugin's lifecycle hooks module, or None.

        Import failures are logged (warning) and returned as None — a broken
        hooks module must never take the app or the install flow down.
        """
        manifest = cls._plugins.get(slug)
        if not manifest:
            return None
        module_path = manifest.get("_hooks_module")
        if not module_path:
            return None
        try:
            return importlib.import_module(module_path)
        except Exception as e:  # noqa: BLE001 — never fatal by contract
            logger.warning("Plugin %s: hooks module %s failed to import: %s",
                           slug, module_path, e)
            return None

    # ── DB catalog mirror (WP: filesystem is the catalog, DB only mirrors) ──

    @classmethod
    def refresh_registry(cls) -> dict:
        """Rescan the plugin directories and UPSERT the `plugins` mirror table.

        The plugins directory is the catalog source of truth (zero seeding):
        - missing folders' mirror rows are created (published=True unless the
          manifest itself says `published: false`);
        - existing rows get additive field syncs from their manifests;
        - DB rows whose folder/manifest vanished are unpublished
          (published=False — never deleted, history is preserved).
        """
        cls._scan_manifests()

        from app.models.plugin import Plugin
        from extensions import db

        created = updated = 0
        scanned_slugs: set[str] = set()
        for slug, m in cls._plugins.items():
            scanned_slugs.add(slug)
            price_monthly = m.get("price_monthly") or 0
            price_yearly = m.get("price_yearly") or 0
            try:
                price_monthly = float(price_monthly)
                price_yearly = float(price_yearly)
            except (TypeError, ValueError):
                price_monthly = price_yearly = 0.0
            is_free = bool(m.get("is_free", price_monthly == 0))
            category = m.get("category") or "core"
            if category not in _VALID_CATEGORIES:
                category = "starter"
            is_published = bool(m.get("published", True))
            fields = dict(
                name=m.get("name") or slug,
                name_nepali=m.get("name_nepali") or "",
                description=m.get("description") or "",
                category=category,
                price_monthly=price_monthly,
                price_yearly=price_yearly,
                is_free=is_free,
                version=m.get("version") or "1.0.0",
                emoji=m.get("emoji"),
                icon=m.get("icon"),
                depends_on=m.get("depends_on") or [],
                conflicts_with=m.get("conflicts_with") or [],
                api_blueprint=m.get("api_blueprint"),
            )

            existing = Plugin.query.filter_by(slug=slug).first()
            if not existing:
                plugin = Plugin(slug=slug, is_published=is_published, **fields)
                db.session.add(plugin)
                created += 1
                continue
            # Additive mirror sync — the manifest wins over drift, the DB
            # keeps fields manifests don't carry (screenshots, tags, stats).
            for key, value in fields.items():
                if getattr(existing, key, None) != value:
                    setattr(existing, key, value)
            if bool(existing.is_published) != is_published:
                existing.is_published = is_published
            updated += 1
        db.session.commit()

        # Unpublish mirror rows whose plugin folder/manifest is gone.
        deactivated = 0
        orphans = Plugin.query.filter(
            Plugin.slug.notin_(scanned_slugs) if scanned_slugs else Plugin.slug.isnot(None),
            Plugin.is_published.is_(True),
        ).all()
        for row in orphans:
            row.is_published = False
            deactivated += 1
        if deactivated:
            db.session.commit()

        result = {
            "scanned": len(cls._plugins),
            "created": created,
            "updated": updated,
            "deactivated": deactivated,
        }
        logger.info("Plugin registry refreshed: %s", result)
        return result

    # ── Core slugs always included regardless of installation status ──────────
    CORE_ALWAYS_SLUGS: list[str] = [
        "dashboard",
        "students",
        "teachers",
        "users",
        "academics",
        "attendance",
        "notices",
        "basic_reports",
    ]

    # ── Bottom-nav slugs always included ─────────────────────────────────────
    BOTTOM_NAV_ALWAYS_SLUGS: list[str] = [
        "marketplace_nav",
        "plugins_nav",
        "settings_core",
    ]

    # ── Fallback section mapping (used when manifest has no explicit section) ─
    # E232 (2026-08-31): user-approved sidebar information architecture.
    # The sidebar reads top-to-bottom in the order the frontend's
    # PLUGIN_SECTION_ORDER renders: Dashboard / Academics / Learning /
    # Money / Operations / Communication / Design & Web / Insights /
    # Student Life / Safety & Compliance / Growth / Admin. Everything here
    # matches the `section:` values now written into the manifests; this map
    # remains the fallback for manifests without an explicit section.
    SLUG_SECTION_MAP: dict[str, str | None] = {
        # null section = no header (Dashboard)
        "dashboard": None,
        # Academics
        "students": "Academics",
        "teachers": "Academics",
        "academics": "Academics",
        "timetable": "Academics",
        "attendance": "Academics",
        # Learning
        "lms": "Learning",
        "elibrary": "Learning",
        "digital_content": "Learning",  # deprecated dup of elibrary
        "library": "Learning",  # deprecated dup of library_management
        "library_management": "Learning",
        "assignments": "Learning",
        "exams": "Learning",
        "student_portfolio": "Learning",
        "portfolio": "Learning",  # deprecated dup of student_portfolio
        # Money
        "fees": "Money",
        "hr_payroll": "Money",
        "admission": "Money",
        # Operations
        "inventory": "Operations",
        "visitor_management": "Operations",
        "dismissal": "Operations",
        "gps_tracking": "Operations",
        "biometric": "Operations",
        "conferences": "Operations",
        "hostel": "Operations",
        # Communication
        "notices": "Communication",
        "sms_notifications": "Communication",
        "whatsapp_bot": "Communication",
        # Design & Web
        "design_studio": "Design & Web",
        "website_builder": "Design & Web",
        "basic_website": "Design & Web",
        "white_label": "Design & Web",
        # Insights
        "basic_reports": "Insights",
        "ai_suite": "Insights",
        # Admin
        "users": "Admin",
        "multi_branch": "Admin",
        "file_management": "Admin",
        # Student Life
        "gamification": "Student Life",
        "wellbeing": "Student Life",
        "health_records": "Student Life",
        # Safety & Compliance
        "incidents": "Safety & Compliance",
        "incident_management": "Safety & Compliance",
        "emergency": "Safety & Compliance",
        "disaster_management": "Safety & Compliance",
        "compliance": "Safety & Compliance",
        # Growth
        "alumni": "Growth",
        "social_ads": "Growth",
        "social_hub": "Growth",  # withdrawn plugin — sidebar hidden anyway
        # AI plugins merged into ai_suite (manifests carry section "Insights",
        # sidebar hidden via visible_to: [] — entries kept for completeness)
        "advanced_analytics": "Insights",
        "ai_grading": "Insights",
        "ai_tutor": "Insights",
        "ai_tools": "Insights",
        "ai_adaptive_learning": "Insights",
        "ai_insights": "Insights",
        "benchmarking": "Insights",
    }

    # ── Sidebar supersede map (E238, 2026-08-31) ─────────────────────────────
    # Two-tier plugin chains that share ONE frontend route (base tier +
    # paid upgrade, e.g. basic_website free → website_builder premium, which
    # depends_on the base). Both plugins stay PUBLISHED (same verdict as
    # incidents/incident_management — distinct tiers of one chain, not
    # duplicates), but when the upgrade is installed+active the base tier's
    # sidebar entry is SUPERSEDED so Design & Web shows a single "Website"
    # entry instead of two nav items pointing at /dashboard/website-builder.
    # value = the upgrade slug whose acceptable-slug family supersedes the key.
    SIDEBAR_SUPERSEDED_BY: dict[str, str] = {
        "basic_website": "website_builder",
    }

    @classmethod
    def get_frontend_sidebar(cls, installed_slugs: list[str], user_role: str) -> list:
        """Build dynamic sidebar items for a school based on installed plugins.

        Always includes CORE_ALWAYS_SLUGS first (regardless of installation),
        then appends installed plugin slugs (deduped). Returns ordered list with:
        - Routes normalized to /dashboard/ prefix
        - Section info for grouping in the frontend (manifest field, else SLUG_SECTION_MAP)
        - Icon name string (maps to Lucide component on frontend)

        Visibility rules (E230/E231/E232, 2026-08-31):
        - `coming_soon: true` manifests NEVER render a sidebar item (the
          feature is in final testing — routes stay gated+mounted, but the
          nav entry is hidden until release).
        - Alias-aware: an item renders when ANY acceptable slug (itself, its
          alias target, or legacy aliases of it — the same single-hop
          expansion used by @plugin_required) is installed. This is what
          surfaces the single "AI Suite" nav entry for schools that installed
          one of the deprecated individual AI plugins, and canonical entries
          for schools still holding legacy duplicate installs.
        - Role scoping via `visible_to` is unchanged.
        """
        from app.plugins.decorators import _acceptable_plugin_slugs

        # Merge core + installed, preserving order and deduplicating
        all_slugs: list[str] = list(
            dict.fromkeys([*cls.CORE_ALWAYS_SLUGS, *installed_slugs])
        )
        installed_set = {str(s) for s in installed_slugs}

        # Bundle slugs are never the installed slug of legacy schools (a
        # school that installed ai_tools does not have an ai_suite row), so
        # also consider every manifest whose ACCEPTABLE slug family (itself
        # + alias target + legacy aliases) intersects the installs — that is
        # what surfaces the single "AI Suite" entry for legacy AI installs.
        for slug in sorted(cls._plugins):
            if slug not in all_slugs and _acceptable_plugin_slugs(slug) & installed_set:
                all_slugs.append(slug)

        sidebar = []
        for slug in all_slugs:
            manifest = cls._plugins.get(slug)
            if not manifest:
                continue

            # Coming-soon plugins are hidden from navigation entirely.
            if manifest.get("coming_soon"):
                continue

            # Deprecated manifests (merged/withdrawn plugins) never render a
            # sidebar entry — their canonical successor's entry shows instead
            # via the alias family above, and the routes stay gated.
            if manifest.get("deprecated"):
                continue

            fe = manifest.get("frontend")
            if not fe:
                continue  # plugin has no frontend (API-only)

            sb = fe.get("sidebar")
            if not sb:
                continue  # plugin explicitly opts out of sidebar

            visible_to = sb.get("visible_to", [])
            # Show if: visible_to is empty (open), contains "all", or matches role
            if visible_to and "all" not in visible_to and user_role not in visible_to:
                continue

            # Installed+active check with single-hop alias expansion — the
            # same acceptable-slug set @plugin_required accepts.
            acceptable = _acceptable_plugin_slugs(slug)
            if not acceptable & installed_set:
                continue

            section = sb.get("section")
            # Use SLUG_SECTION_MAP as fallback when manifest has no explicit section
            if section is None:
                section = cls.SLUG_SECTION_MAP.get(slug)
            # Skip items marked for bottom_nav — handled by get_bottom_nav_items
            if section == "bottom_nav":
                continue

            # Normalize route to always start with /dashboard/
            def _normalize_route(route: str | None) -> str:
                if not route:
                    return "/dashboard"
                if route.startswith("/dashboard"):
                    return route
                return f"/dashboard{route}"

            route = _normalize_route(fe.get("route", ""))

            subitems = []
            for item in sb.get("subitems", []):
                sub_route = _normalize_route(item.get("route"))
                subitems.append(
                    {
                        "label": item.get("label"),
                        "route": sub_route,
                    }
                )

            sidebar.append(
                {
                    "slug": slug,
                    "label": sb.get("label") or manifest.get("name", slug),
                    "label_nepali": sb.get("label_nepali"),
                    "icon": sb.get("icon") or manifest.get("icon", "Package"),
                    "section": section,
                    "route": route,
                    "subitems": subitems,
                }
            )

        return sidebar

    @classmethod
    def get_bottom_nav_items(cls, installed_slugs: list[str], user_role: str) -> list:
        """Return plugin items specifically marked for the sidebar bottom nav.

        Always includes BOTTOM_NAV_ALWAYS_SLUGS (Settings, Marketplace) and
        any installed plugin marked section: bottom_nav. Includes subitems.
        """
        all_slugs: list[str] = list(
            dict.fromkeys([*cls.BOTTOM_NAV_ALWAYS_SLUGS, *installed_slugs])
        )
        items = []
        for slug in all_slugs:
            manifest = cls._plugins.get(slug)
            if not manifest:
                continue
            if manifest.get("coming_soon"):
                continue  # E231: coming-soon plugins are hidden from nav
            fe = manifest.get("frontend") or {}
            sb = fe.get("sidebar") or {}
            if sb.get("section") != "bottom_nav":
                continue
            visible_to = sb.get("visible_to", [])
            if visible_to and "all" not in visible_to and user_role not in visible_to:
                continue

            def _normalize(route: str | None) -> str:
                if not route:
                    return "/dashboard"
                if route.startswith("/dashboard"):
                    return route
                return f"/dashboard{route}"

            subitems = [
                {"label": s.get("label"), "route": _normalize(s.get("route"))}
                for s in sb.get("subitems", [])
            ]
            items.append(
                {
                    "slug": slug,
                    "label": sb.get("label") or manifest.get("name", slug),
                    "icon": sb.get("icon") or manifest.get("icon", "Package"),
                    "route": _normalize(fe.get("route", "/dashboard")),
                    "subitems": subitems,
                }
            )
        return items
