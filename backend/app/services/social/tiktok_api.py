"""TikTok for Developers API — post management and analytics."""
import logging
import httpx

logger = logging.getLogger(__name__)

TIKTOK_API_URL = "https://open.tiktokapis.com/v2"


class TikTokAPI:
    """TikTok for Developers API wrapper."""

    def __init__(self, access_token: str):
        self.token = access_token
        self.client = httpx.Client(timeout=30)

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def get_user_info(self) -> dict:
        """Get TikTok user profile info."""
        r = self.client.get(
            f"{TIKTOK_API_URL}/user/info/",
            headers=self._headers(),
            params={"fields": "display_name,avatar_url,follower_count,following_count,likes_count,video_count"},
        )
        return r.json()

    def get_videos(self, max_count: int = 20) -> dict:
        """Get user's recent videos."""
        r = self.client.post(
            f"{TIKTOK_API_URL}/video/list/",
            headers=self._headers(),
            json={"max_count": max_count},
        )
        return r.json()

    def get_video_comments(self, video_id: str, max_count: int = 50) -> dict:
        """Get comments on a video."""
        r = self.client.post(
            f"{TIKTOK_API_URL}/comment/list/",
            headers=self._headers(),
            json={"video_id": video_id, "max_count": max_count},
        )
        return r.json()

    def reply_to_comment(self, video_id: str, comment_id: str, text: str) -> dict:
        """Reply to a comment."""
        r = self.client.post(
            f"{TIKTOK_API_URL}/comment/reply/",
            headers=self._headers(),
            json={"video_id": video_id, "comment_id": comment_id, "text": text},
        )
        return r.json()
