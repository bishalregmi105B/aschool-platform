"""Unified Social Hub — manages all social platforms from one interface."""
import logging
from app.services.social.meta_api import MetaGraphAPI
from app.services.social.tiktok_api import TikTokAPI
from app.services.social.youtube_api import YouTubeAPI

logger = logging.getLogger(__name__)


class SocialHubService:
    """Unified social media management across platforms."""

    def __init__(self, school):
        self.school = school
        self._fb = None
        self._tiktok = None
        self._youtube = None

    @property
    def facebook(self) -> MetaGraphAPI | None:
        if not self._fb and self.school.facebook_page_token:
            self._fb = MetaGraphAPI(
                page_token=self.school.facebook_page_token,
                page_id=self.school.facebook_page_id,
                ig_account_id=self.school.instagram_account_id,
            )
        return self._fb

    @property
    def tiktok(self) -> TikTokAPI | None:
        if not self._tiktok and self.school.tiktok_token:
            self._tiktok = TikTokAPI(self.school.tiktok_token)
        return self._tiktok

    @property
    def youtube(self) -> YouTubeAPI | None:
        if not self._youtube and self.school.youtube_token:
            self._youtube = YouTubeAPI(self.school.youtube_token)
        return self._youtube

    def get_all_profiles(self) -> dict:
        """Get unified profile info across all connected platforms."""
        profiles = {}
        if self.facebook:
            try:
                profiles["facebook"] = self.facebook.get_page_info()
                if self.school.instagram_account_id:
                    profiles["instagram"] = self.facebook.ig_get_profile()
            except Exception as e:
                logger.error("Facebook API error: %s", e)
        if self.tiktok:
            try:
                profiles["tiktok"] = self.tiktok.get_user_info()
            except Exception as e:
                logger.error("TikTok API error: %s", e)
        if self.youtube:
            try:
                profiles["youtube"] = self.youtube.get_channel()
            except Exception as e:
                logger.error("YouTube API error: %s", e)
        return profiles

    def publish_to_all(self, message: str, image_url: str = None, platforms: list = None) -> dict:
        """Cross-post to all (or selected) platforms."""
        results = {}
        target = platforms or ["facebook", "instagram", "tiktok"]

        if "facebook" in target and self.facebook:
            try:
                results["facebook"] = self.facebook.publish_post(message, image_url=image_url)
            except Exception as e:
                results["facebook"] = {"error": str(e)}

        if "instagram" in target and self.facebook and image_url:
            try:
                results["instagram"] = self.facebook.ig_publish_photo(image_url, message)
            except Exception as e:
                results["instagram"] = {"error": str(e)}

        return results

    def get_unified_feed(self, limit: int = 10) -> list:
        """Get recent posts from all platforms in a unified feed."""
        feed = []
        if self.facebook:
            try:
                posts = self.facebook.get_page_posts(limit=limit)
                for p in posts.get("data", []):
                    feed.append({"platform": "facebook", "data": p})
            except Exception:
                pass
        if self.facebook and self.school.instagram_account_id:
            try:
                media = self.facebook.ig_get_media(limit=limit)
                for m in media.get("data", []):
                    feed.append({"platform": "instagram", "data": m})
            except Exception:
                pass
        return feed
