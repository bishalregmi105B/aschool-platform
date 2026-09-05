"""Phase D-2: AI tool catalog columns on ai_tool_registry

D1 §C.3 + D3 §D.1: the catalog becomes the single driver of the AI tool grid
(ui_type → result component), grounding policy, cost badges and document
routing — the Sahayatri catalog-as-data pattern, ported onto the existing
registry instead of a second table. endpoint/frontend_path/is_premium are
deliberately NOT carried over (one dispatcher route; min_plan_tier already
expresses premium).

Revision ID: f6b2d8e4c1a9
Revises: e5a8c2d7f3b1
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa

revision = "f6b2d8e4c1a9"
down_revision = "e5a8c2d7f3b1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ai_tool_registry",
                  sa.Column("trigger_phrases", sa.Text(),
                            server_default="[]", nullable=False))
    op.add_column("ai_tool_registry",
                  sa.Column("budget", sa.String(10), server_default="tier1",
                            nullable=False))
    op.add_column("ai_tool_registry",
                  sa.Column("failure_modes", sa.Text(), nullable=True))
    op.add_column("ai_tool_registry",
                  sa.Column("reference_pack", sa.String(80), nullable=True))
    op.add_column("ai_tool_registry",
                  sa.Column("output_document_type", sa.String(20),
                            server_default="none", nullable=False))
    op.add_column("ai_tool_registry",
                  sa.Column("ui_type", sa.String(30), server_default="form",
                            nullable=False))
    op.add_column("ai_tool_registry",
                  sa.Column("icon", sa.String(16), nullable=True))
    op.add_column("ai_tool_registry",
                  sa.Column("sort_order", sa.Integer(), server_default="0",
                            nullable=False))
    op.add_column("ai_tool_registry",
                  sa.Column("badge", sa.String(20), nullable=True))
    op.add_column("ai_tool_registry",
                  sa.Column("input_schema_name", sa.String(100), nullable=True))
    op.add_column("ai_tool_registry",
                  sa.Column("grounding", sa.String(12), server_default="optional",
                            nullable=False))
    op.create_index("ix_atr_category_sort", "ai_tool_registry",
                    ["category", "sort_order"])
    op.create_index("ix_atr_ui_type", "ai_tool_registry", ["ui_type"])


def downgrade():
    op.drop_index("ix_atr_ui_type", table_name="ai_tool_registry")
    op.drop_index("ix_atr_category_sort", table_name="ai_tool_registry")
    for col in ("trigger_phrases", "budget", "failure_modes", "reference_pack",
                "output_document_type", "ui_type", "icon", "sort_order",
                "badge", "input_schema_name", "grounding"):
        op.drop_column("ai_tool_registry", col)
