"""Compatibility registry wrapper around AppLoader."""

from app.apps.loader import AppLoader


class PluginRegistry:
    """Plan-compatible plugin registry facade."""

    @staticmethod
    def get(slug: str) -> dict | None:
        return AppLoader.get_manifest(slug)

    @staticmethod
    def all() -> dict:
        return AppLoader.get_all_manifests()

    @staticmethod
    def sidebar(installed_slugs: list[str], user_role: str) -> list[dict]:
        return AppLoader.get_frontend_sidebar(installed_slugs, user_role)
