"""Social media models: SocialAccount, SocialPost, SocialMessage, AdCampaign."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class SocialAccount(SchoolModel):
    __tablename__ = "social_accounts"

    platform = Column(
        Enum("facebook", "instagram", "tiktok", "youtube", name="social_platform"),
        nullable=False,
    )
    account_id = Column(String(200))
    account_name = Column(String(200))
    access_token = Column(Text)
    token_expires_at = Column(DateTime)
    page_id = Column(String(200))
    page_name = Column(String(200))
    follower_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    connected_at = Column(DateTime)
    ai_auto_reply = Column(Boolean, default=False)
    ai_reply_mode = Column(
        Enum("full_auto", "draft_approve", name="ai_reply_mode"), default="draft_approve"
    )
    ai_reply_language = Column(
        Enum("nepali", "english", "auto", name="ai_reply_language"), default="auto"
    )


class SocialPost(SchoolModel):
    __tablename__ = "social_posts"

    platforms = Column(ARRAY(String))
    content_en = Column(Text)
    content_ne = Column(Text)
    media_urls = Column(JSONB, default=list)
    post_type = Column(
        Enum("post", "reel", "story", "youtube", name="post_type"), default="post"
    )
    status = Column(
        Enum("draft", "scheduled", "published", "failed", name="post_status"),
        default="draft",
    )
    scheduled_at = Column(DateTime)
    published_at = Column(DateTime)
    platform_post_ids = Column(JSONB, default=dict)
    organic_reach = Column(Integer, default=0)
    organic_engagement = Column(Integer, default=0)
    organic_clicks = Column(Integer, default=0)
    is_boosted = Column(Boolean, default=False)
    boost_campaign_id = Column(UUID(as_uuid=True), ForeignKey("ad_campaigns.id"))

    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_by = relationship("User")


class SocialMessage(SchoolModel):
    __tablename__ = "social_messages"

    platform = Column(String(20), nullable=False)
    external_id = Column(String(200))
    sender_id = Column(String(200))
    sender_name = Column(String(200))
    sender_avatar = Column(Text)
    message_type = Column(
        Enum("comment", "dm", name="message_type"), nullable=False
    )
    content = Column(Text)
    media_url = Column(Text)
    post_id = Column(UUID(as_uuid=True), ForeignKey("social_posts.id"))
    direction = Column(
        Enum("inbound", "outbound", name="message_direction"), nullable=False
    )
    is_ai_replied = Column(Boolean, default=False)
    ai_confidence = Column(Float)
    ai_draft = Column(Text)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_admission_lead = Column(Boolean, default=False)
    sentiment = Column(
        Enum("positive", "neutral", "negative", name="sentiment_type")
    )
    status = Column(
        Enum("new", "replied", "ignored", "flagged", name="message_status"),
        default="new",
    )
    replied_at = Column(DateTime)

    post = relationship("SocialPost", backref="messages")
    approved_by = relationship("User")


class AdCampaign(SchoolModel):
    __tablename__ = "ad_campaigns"

    post_id = Column(UUID(as_uuid=True), ForeignKey("social_posts.id"))
    platform = Column(
        Enum("facebook", "instagram", name="ad_platform"), nullable=False
    )
    fb_campaign_id = Column(String(200))
    fb_adset_id = Column(String(200))
    fb_ad_id = Column(String(200))
    daily_budget_npr = Column(Numeric(10, 2))
    total_budget_npr = Column(Numeric(10, 2))
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    status = Column(String(20), default="draft")
    objective = Column(String(50))
    targeting = Column(JSONB, default=dict)
    ai_suggested = Column(Boolean, default=False)
    spend_npr = Column(Numeric(10, 2), default=0)
    reach = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    cost_per_click = Column(Numeric(8, 2))
    inquiries_received = Column(Integer, default=0)
    leads_generated = Column(Integer, default=0)

    post = relationship("SocialPost", foreign_keys=[post_id])


# ── Internal Social Hub (school-internal posts/comments/groups) ──


class Post(SchoolModel):
    __tablename__ = "hub_posts"

    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    post_type = Column(String(20), default="text")  # text, image, poll, event
    media_urls = Column(JSONB, default=list)
    likes = Column(JSONB, default=list)  # list of user_id strings
    visibility = Column(String(20), default="school")  # school, class, group
    is_deleted = Column(Boolean, default=False)

    author = relationship("User", backref="hub_posts")
    comments = relationship("Comment", back_populates="post", lazy="dynamic")


class Comment(SchoolModel):
    __tablename__ = "hub_comments"

    post_id = Column(UUID(as_uuid=True), ForeignKey("hub_posts.id"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_deleted = Column(Boolean, default=False)

    post = relationship("Post", back_populates="comments")
    author = relationship("User")


class Group(SchoolModel):
    __tablename__ = "hub_groups"

    name = Column(String(200), nullable=False)
    description = Column(Text)
    group_type = Column(String(30), default="class")  # class, club, staff, custom
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    member_count = Column(Integer, default=0)
    is_deleted = Column(Boolean, default=False)

    creator = relationship("User")
