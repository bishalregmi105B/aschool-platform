"""Compatibility registry wrapper around PluginLoader."""

from app.plugins.loader import PluginLoader


class PluginRegistry:
    """Plan-compatible plugin registry facade."""

    @staticmethod
    def get(slug: str) -> dict | None:
        return PluginLoader.get_manifest(slug)

    @staticmethod
    def all() -> dict:
        return PluginLoader.get_all_manifests()

    @staticmethod
    def sidebar(installed_slugs: list[str], user_role: str) -> list[dict]:
        return PluginLoader.get_frontend_sidebar(installed_slugs, user_role)
