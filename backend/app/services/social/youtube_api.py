"""YouTube Data API v3 — channel and video management."""
import logging
import httpx

logger = logging.getLogger(__name__)

YT_API_URL = "https://www.googleapis.com/youtube/v3"


class YouTubeAPI:
    """YouTube Data API v3 wrapper."""

    def __init__(self, access_token: str):
        self.token = access_token
        self.client = httpx.Client(timeout=30)

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def get_channel(self) -> dict:
        r = self.client.get(
            f"{YT_API_URL}/channels",
            headers=self._headers(),
            params={"part": "snippet,statistics", "mine": "true"},
        )
        return r.json()

    def get_videos(self, channel_id: str, max_results: int = 25) -> dict:
        r = self.client.get(
            f"{YT_API_URL}/search",
            headers=self._headers(),
            params={
                "part": "snippet",
                "channelId": channel_id,
                "maxResults": max_results,
                "order": "date",
                "type": "video",
            },
        )
        return r.json()

    def get_video_stats(self, video_ids: list[str]) -> dict:
        r = self.client.get(
            f"{YT_API_URL}/videos",
            headers=self._headers(),
            params={"part": "statistics,snippet", "id": ",".join(video_ids)},
        )
        return r.json()

    def get_comments(self, video_id: str, max_results: int = 50) -> dict:
        r = self.client.get(
            f"{YT_API_URL}/commentThreads",
            headers=self._headers(),
            params={
                "part": "snippet",
                "videoId": video_id,
                "maxResults": max_results,
                "order": "time",
            },
        )
        return r.json()
