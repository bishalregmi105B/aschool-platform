"""Meta Graph API integration — Facebook + Instagram management."""
import logging
import httpx

logger = logging.getLogger(__name__)

META_GRAPH_URL = "https://graph.facebook.com/v19.0"


class MetaGraphAPI:
    """Wrapper for Facebook + Instagram Graph API."""

    def __init__(self, page_token: str, page_id: str, ig_account_id: str = None):
        self.page_token = page_token
        self.page_id = page_id
        self.ig_account_id = ig_account_id
        self.client = httpx.Client(timeout=30)

    def _headers(self):
        return {"Authorization": f"Bearer {self.page_token}"}

    # ── Facebook Page ──────────────────────────────────────

    def get_page_info(self) -> dict:
        """Get Facebook page info."""
        r = self.client.get(
            f"{META_GRAPH_URL}/{self.page_id}",
            params={"fields": "name,followers_count,fan_count,link,picture", "access_token": self.page_token},
        )
        return r.json()

    def publish_post(self, message: str, link: str = None, image_url: str = None) -> dict:
        """Publish a post to Facebook page."""
        data = {"message": message, "access_token": self.page_token}
        if link:
            data["link"] = link

        if image_url:
            r = self.client.post(
                f"{META_GRAPH_URL}/{self.page_id}/photos",
                data={**data, "url": image_url},
            )
        else:
            r = self.client.post(
                f"{META_GRAPH_URL}/{self.page_id}/feed",
                data=data,
            )
        return r.json()

    def get_page_posts(self, limit: int = 25) -> dict:
        """Get recent page posts."""
        r = self.client.get(
            f"{META_GRAPH_URL}/{self.page_id}/posts",
            params={
                "fields": "message,created_time,full_picture,permalink_url,shares,likes.summary(true),comments.summary(true)",
                "limit": limit,
                "access_token": self.page_token,
            },
        )
        return r.json()

    def get_post_insights(self, post_id: str) -> dict:
        """Get insights/metrics for a specific post."""
        r = self.client.get(
            f"{META_GRAPH_URL}/{post_id}/insights",
            params={
                "metric": "post_impressions,post_engagements,post_reactions_by_type_total",
                "access_token": self.page_token,
            },
        )
        return r.json()

    def get_page_insights(self, period: str = "day") -> dict:
        """Get page-level insights."""
        r = self.client.get(
            f"{META_GRAPH_URL}/{self.page_id}/insights",
            params={
                "metric": "page_impressions,page_engaged_users,page_fans",
                "period": period,
                "access_token": self.page_token,
            },
        )
        return r.json()

    def reply_to_comment(self, comment_id: str, message: str) -> dict:
        """Reply to a comment on a post."""
        r = self.client.post(
            f"{META_GRAPH_URL}/{comment_id}/comments",
            data={"message": message, "access_token": self.page_token},
        )
        return r.json()

    # ── Instagram ──────────────────────────────────────────

    def ig_get_profile(self) -> dict:
        """Get Instagram business account profile."""
        if not self.ig_account_id:
            return {"error": "No Instagram account linked"}
        r = self.client.get(
            f"{META_GRAPH_URL}/{self.ig_account_id}",
            params={
                "fields": "username,name,followers_count,media_count,profile_picture_url",
                "access_token": self.page_token,
            },
        )
        return r.json()

    def ig_get_media(self, limit: int = 25) -> dict:
        """Get recent Instagram media."""
        if not self.ig_account_id:
            return {"data": []}
        r = self.client.get(
            f"{META_GRAPH_URL}/{self.ig_account_id}/media",
            params={
                "fields": "caption,media_type,media_url,permalink,timestamp,like_count,comments_count",
                "limit": limit,
                "access_token": self.page_token,
            },
        )
        return r.json()

    def ig_publish_photo(self, image_url: str, caption: str) -> dict:
        """Publish a photo to Instagram (2-step process)."""
        if not self.ig_account_id:
            return {"error": "No Instagram account linked"}

        # Step 1: Create container
        r1 = self.client.post(
            f"{META_GRAPH_URL}/{self.ig_account_id}/media",
            data={"image_url": image_url, "caption": caption, "access_token": self.page_token},
        )
        container_id = r1.json().get("id")
        if not container_id:
            return r1.json()

        # Step 2: Publish
        r2 = self.client.post(
            f"{META_GRAPH_URL}/{self.ig_account_id}/media_publish",
            data={"creation_id": container_id, "access_token": self.page_token},
        )
        return r2.json()
