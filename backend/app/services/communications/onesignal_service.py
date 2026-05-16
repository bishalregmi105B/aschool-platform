"""OneSignal Push Notification Service.

Replaces direct FCM usage. OneSignal handles both Android (FCM) and iOS (APNs)
delivery through a single API, with automatic retry and delivery tracking.

Documentation: https://documentation.onesignal.com/reference/create-notification
"""

import logging

import requests
from flask import current_app

logger = logging.getLogger(__name__)


class OneSignalService:
    """OneSignal REST API v1 integration for push notifications."""

    BASE_URL = "https://onesignal.com/api/v1"

    @classmethod
    def _app_id(cls) -> str:
        return current_app.config["ONESIGNAL_APP_ID"]

    @classmethod
    def _headers(cls) -> dict:
        return {
            "Authorization": f"Basic {current_app.config['ONESIGNAL_REST_API_KEY']}",
            "Content-Type": "application/json",
        }

    @classmethod
    def _is_configured(cls) -> bool:
        """Check if OneSignal is properly configured."""
        return bool(
            current_app.config.get("ONESIGNAL_APP_ID")
            and current_app.config.get("ONESIGNAL_REST_API_KEY")
        )

    # ── Single device notification ──────────────────────────────────────

    @classmethod
    def send_to_player(
        cls,
        player_id: str,
        title: str,
        body: str,
        data: dict | None = None,
        url: str | None = None,
    ) -> dict:
        """Send push notification to a specific player/device.

        Args:
            player_id: OneSignal player ID (subscription ID)
            title: Notification title
            body: Notification body text
            data: Additional key-value data payload for deep linking
            url: URL to open when notification is tapped
        """
        return cls.send_to_players([player_id], title, body, data, url)

    # ── Multi-device notification ───────────────────────────────────────

    @classmethod
    def send_to_players(
        cls,
        player_ids: list[str],
        title: str,
        body: str,
        data: dict | None = None,
        url: str | None = None,
    ) -> dict:
        """Send push notification to multiple specific players."""
        if not cls._is_configured():
            logger.warning("OneSignal not configured — skipping push notification")
            return {"success": False, "error": "OneSignal not configured"}

        payload = {
            "app_id": cls._app_id(),
            "include_player_ids": player_ids,
            "headings": {"en": title},
            "contents": {"en": body},
        }
        if data:
            payload["data"] = data
        if url:
            payload["url"] = url

        return cls._send(payload)

    # ── Segment-based notification ──────────────────────────────────────

    @classmethod
    def send_to_segment(
        cls,
        segments: list[str],
        title: str,
        body: str,
        data: dict | None = None,
        filters: list[dict] | None = None,
    ) -> dict:
        """Send push notification to OneSignal segments.

        Common segments: 'Subscribed Users', 'Active Users', 'Inactive Users'
        For school-scoped sends, use filters with tags like school_id.
        """
        if not cls._is_configured():
            logger.warning("OneSignal not configured — skipping push notification")
            return {"success": False, "error": "OneSignal not configured"}

        payload = {
            "app_id": cls._app_id(),
            "included_segments": segments,
            "headings": {"en": title},
            "contents": {"en": body},
        }
        if data:
            payload["data"] = data
        if filters:
            payload["filters"] = filters

        return cls._send(payload)

    # ── School-scoped notification (via tags) ───────────────────────────

    @classmethod
    def send_to_school(
        cls,
        school_id: str,
        title: str,
        body: str,
        roles: list[str] | None = None,
        data: dict | None = None,
    ) -> dict:
        """Send notification to all users of a school, optionally filtered by role.

        Uses OneSignal tags for server-side filtering without fetching user records.
        Tags expected on device:
            - school_id: UUID of the school
            - role: user role (teacher, parent, student, etc.)
        """
        if not cls._is_configured():
            logger.warning("OneSignal not configured — skipping push notification")
            return {"success": False, "error": "OneSignal not configured"}

        # Build filters: match school_id tag
        filters = [
            {"field": "tag", "key": "school_id", "relation": "=", "value": str(school_id)},
        ]

        # Optionally filter by role(s)
        if roles:
            for i, role in enumerate(roles):
                if i > 0:
                    filters.append({"operator": "OR"})
                filters.append(
                    {"field": "tag", "key": "role", "relation": "=", "value": role}
                )

        payload = {
            "app_id": cls._app_id(),
            "included_segments": ["All"],
            "filters": filters,
            "headings": {"en": title},
            "contents": {"en": body},
        }
        if data:
            payload["data"] = data

        return cls._send(payload)

    # ── Helpers ─────────────────────────────────────────────────────────

    @classmethod
    def _send(cls, payload: dict) -> dict:
        """Execute the OneSignal API call with error handling."""
        try:
            resp = requests.post(
                f"{cls.BASE_URL}/notifications",
                headers=cls._headers(),
                json=payload,
                timeout=15,
            )
            result = resp.json()

            if resp.status_code in (200, 201):
                return {
                    "success": True,
                    "notification_id": result.get("id"),
                    "recipients": result.get("recipients", 0),
                    "errors": result.get("errors"),
                }

            logger.error("OneSignal API error %s: %s", resp.status_code, result)
            return {
                "success": False,
                "error": result.get("errors", [str(resp.status_code)]),
            }

        except requests.Timeout:
            logger.error("OneSignal API timeout")
            return {"success": False, "error": "timeout"}
        except Exception as exc:
            logger.exception("OneSignal API call failed: %s", exc)
            return {"success": False, "error": str(exc)}

    @classmethod
    def register_player_tags(cls, player_id: str, tags: dict) -> dict:
        """Update tags on a OneSignal player (e.g., school_id, role).

        Called after login to associate device with school + role.
        """
        if not cls._is_configured():
            return {"success": False, "error": "OneSignal not configured"}

        try:
            resp = requests.put(
                f"{cls.BASE_URL}/players/{player_id}",
                headers=cls._headers(),
                json={
                    "app_id": cls._app_id(),
                    "tags": tags,
                },
                timeout=10,
            )
            return {"success": resp.status_code == 200, "response": resp.json()}
        except Exception as exc:
            logger.exception("Failed to update OneSignal player tags: %s", exc)
            return {"success": False, "error": str(exc)}
