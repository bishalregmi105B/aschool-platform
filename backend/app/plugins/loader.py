"""
Plugin Loader — discovers YAML manifests and registers Flask blueprints.

Discovery order (Odoo-style):
  1. app/plugins/modules/*/manifest.yaml  ← new self-contained module packages
  2. app/plugins/manifests/*.yaml          ← legacy flat manifests (backward compat)

All plugin blueprints are loaded once at startup. The @plugin_required
decorator handles per-school access control at request time.
"""

import importlib
import logging
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


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
    def discover_and_register(cls, app):
        """Scan module directories and register each plugin's Flask blueprint."""
        cls._plugins.clear()
        registered_blueprints: set[str] = set()

        # ── 1. New Odoo-style modules (modules/{slug}/manifest.yaml) ──────
        if cls._modules_dir.exists():
            for manifest_file in sorted(cls._modules_dir.rglob("manifest.yaml")):
                if manifest_file.parent == cls._modules_dir:
                    continue  # skip orphaned manifest.yaml at root
                cls._load_manifest(app, manifest_file, registered_blueprints)
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
                cls._load_manifest(
                    app, manifest_file, registered_blueprints, legacy=True
                )

        logger.info(
            "PluginLoader: %d modules registered (%d from modules/, legacy fills gaps)",
            len(cls._plugins),
            sum(1 for m in cls._plugins.values() if m.get("_source") == "module"),
        )

    @classmethod
    def _load_manifest(
        cls, app, manifest_file: Path, registered_blueprints: set, legacy: bool = False
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
        cls._plugins[slug] = manifest

        bp_path = manifest.get("api_blueprint")
        if bp_path and bp_path not in registered_blueprints:
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
                    registered_blueprints.add(bp_path)
                    logger.info(
                        "Registered blueprint: %s (%s)",
                        slug,
                        "module" if not legacy else "legacy",
                    )
                else:
                    logger.warning(
                        "Plugin %s: no blueprint object in %s", slug, bp_path
                    )
            except ImportError:
                logger.debug("Plugin %s: blueprint %s not found (skip)", slug, bp_path)

        logger.info("Loaded %d plugin manifests", len(cls._plugins))

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
    def get_frontend_sidebar(cls, installed_slugs: list[str], user_role: str) -> list:
        """Build dynamic sidebar items for a school based on installed plugins.

        Returns ordered list of sidebar items for the given role, with:
        - Routes normalized to /dashboard/ prefix
        - Section info for grouping in the frontend
        - Icon name string (maps to Lucide component on frontend)
        """
        sidebar = []
        for slug in installed_slugs:
            manifest = cls._plugins.get(slug)
            if not manifest:
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

            section = sb.get("section")
            # Skip items marked for bottom_nav — frontend handles those separately
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
        """Return plugin items specifically marked for the sidebar bottom nav."""
        items = []
        for slug in installed_slugs:
            manifest = cls._plugins.get(slug)
            if not manifest:
                continue
            fe = manifest.get("frontend") or {}
            sb = fe.get("sidebar") or {}
            if sb.get("section") != "bottom_nav":
                continue
            visible_to = sb.get("visible_to", [])
            if visible_to and "all" not in visible_to and user_role not in visible_to:
                continue
            items.append(
                {
                    "slug": slug,
                    "label": sb.get("label") or manifest.get("name", slug),
                    "icon": sb.get("icon") or manifest.get("icon", "Package"),
                    "route": fe.get("route", "/dashboard"),
                }
            )
        return items
