"""add name/content/media_url to ad_campaigns (social_ads E30)

The social_ads plugin (growth, NPR 499) was published-but-empty: the
AdCampaign table existed but had no identity or creative fields of its own
(no name, no ad copy, no media), so no API could serve the campaigns page.
This migration adds the three columns the campaigns API needs; everything
else (platform, objective, targeting JSONB, budgets, dates, delivery
counters) is reused as-is.

Revision ID: f6a9c2e4b7d1
Revises: e8a3d5f7c2b4
Create Date: 2026-08-29
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f6a9c2e4b7d1"
down_revision = "e8a3d5f7c2b4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ad_campaigns", sa.Column("name", sa.String(length=200),
                                            nullable=True))
    op.add_column("ad_campaigns", sa.Column("content", sa.Text(),
                                            nullable=True))
    op.add_column("ad_campaigns", sa.Column("media_url", sa.Text(),
                                            nullable=True))


def downgrade():
    op.drop_column("ad_campaigns", "media_url")
    op.drop_column("ad_campaigns", "content")
    op.drop_column("ad_campaigns", "name")
