"""S-A1 fees depth: invoices, installments, carry-forward, offline slips,
day closure + due-date/grouping columns on fee_collections (A-01, A-24).

Money stays on fee_collections/fee_receipts; the new tables are grouping
documents (fee_invoices), schedules (fee_installments), workflow rows
(fee_carry_forwards, fee_offline_submissions) and a control row
(fee_day_closures). No stored balances — totals are computed from lines.

Revision ID: s_a1_fees_depth
Revises: s12_spine_01
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "s_a1_fees_depth"
down_revision = "s12_spine_01"
branch_labels = None
depends_on = None

# Matches BaseModel exactly (TIMESTAMPTZ + server defaults) — the drift gate
# compares model metadata against the migrated schema column by column.
_BASE_COLUMNS = [
    sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False,
              server_default=sa.text("gen_random_uuid()")),
    sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
              nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
              nullable=False),
    sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
]


def _enum(name: str, *values: str) -> None:
    op.execute(
        f"DO $$ BEGIN CREATE TYPE {name} AS ENUM ({', '.join(repr(v) for v in values)}); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )


def upgrade():
    _enum("fee_invoice_status", "pending", "partial", "paid", "waived")
    _enum("carry_forward_type", "due", "credit")
    _enum("carry_forward_status", "pending", "applied", "reversed")
    _enum("offline_method", "bank", "cheque")
    _enum("offline_submission_status", "pending", "approved", "rejected")
    _enum("day_closure_status", "closed", "open")

    op.create_table(
        "fee_invoices",
        *_BASE_COLUMNS,
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("academic_year", sa.String(length=10), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("period_key", sa.String(length=20), nullable=True),
        sa.Column("due_date_bs", sa.String(length=20), nullable=True),
        sa.Column(
            "status", postgresql.ENUM(
                "pending", "partial", "paid", "waived",
                name="fee_invoice_status", create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fee_invoices_student_id", "fee_invoices", ["student_id"])
    op.create_index("ix_fee_invoices_period_key", "fee_invoices", ["period_key"])
    op.create_index("ix_fee_invoices_status", "fee_invoices", ["status"])
    op.create_index(
        "ix_fee_invoices_school_student", "fee_invoices", ["school_id", "student_id"]
    )

    op.create_table(
        "fee_installments",
        *_BASE_COLUMNS,
        sa.Column("structure_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("due_date_bs", sa.String(length=20), nullable=True),
        sa.Column("is_generated", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["structure_id"], ["fee_structures.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fee_installments_structure_id", "fee_installments", ["structure_id"])
    op.create_index(
        "uq_fee_installments_structure_seq", "fee_installments",
        ["structure_id", "seq"], unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "fee_carry_forwards",
        *_BASE_COLUMNS,
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_year_bs", sa.String(length=10), nullable=False),
        sa.Column("to_year_bs", sa.String(length=10), nullable=False),
        sa.Column("balance", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "balance_type", postgresql.ENUM(
                "due", "credit", name="carry_forward_type", create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("due_date_bs", sa.String(length=20), nullable=True),
        sa.Column(
            "status", postgresql.ENUM(
                "pending", "applied", "reversed",
                name="carry_forward_status", create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("applied_collection_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["applied_collection_id"], ["fee_collections.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fee_carry_forwards_student_id", "fee_carry_forwards", ["student_id"])
    op.create_index(
        "uq_fee_carry_forward_student_year", "fee_carry_forwards",
        ["student_id", "from_year_bs", "to_year_bs"], unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "fee_carry_forward_logs",
        *_BASE_COLUMNS,
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("balance", sa.Numeric(12, 2), nullable=True),
        sa.Column("balance_type", sa.String(length=10), nullable=True),
        sa.Column("from_year_bs", sa.String(length=10), nullable=True),
        sa.Column("to_year_bs", sa.String(length=10), nullable=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("detail", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_fee_carry_forward_logs_student_id", "fee_carry_forward_logs", ["student_id"]
    )

    op.create_table(
        "fee_offline_submissions",
        *_BASE_COLUMNS,
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "method", postgresql.ENUM(
                "bank", "cheque", name="offline_method", create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("bank_name", sa.String(length=200), nullable=True),
        sa.Column("reference_no", sa.String(length=200), nullable=True),
        sa.Column("paid_on_bs", sa.String(length=20), nullable=True),
        sa.Column("slip_file_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("collection_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "status", postgresql.ENUM(
                "pending", "approved", "rejected",
                name="offline_submission_status", create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("receipt_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["slip_file_id"], ["managed_files.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_fee_offline_submissions_student_id", "fee_offline_submissions", ["student_id"]
    )
    op.create_index(
        "ix_fee_offline_submissions_status", "fee_offline_submissions", ["status"]
    )
    op.create_index(
        "ix_fee_offline_submissions_created_by_id", "fee_offline_submissions",
        ["created_by_id"],
    )

    op.create_table(
        "fee_day_closures",
        *_BASE_COLUMNS,
        sa.Column("closure_date_bs", sa.String(length=20), nullable=False),
        sa.Column("closure_date_ad", sa.DateTime(), nullable=True),
        sa.Column("collected_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status", postgresql.ENUM(
                "closed", "open", name="day_closure_status", create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("denominations", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("expected_total", sa.Numeric(12, 2), nullable=True),
        sa.Column("counted_total", sa.Numeric(12, 2), nullable=True),
        sa.Column("difference", sa.Numeric(12, 2), nullable=True),
        sa.Column("closed_at", sa.DateTime(), nullable=True),
        sa.Column("closed_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reopened_at", sa.DateTime(), nullable=True),
        sa.Column("reopened_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["collected_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["closed_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reopened_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_fee_day_closures_closure_date_bs", "fee_day_closures", ["closure_date_bs"]
    )
    op.create_index(
        "ix_fee_day_closures_collected_by_id", "fee_day_closures", ["collected_by_id"]
    )
    op.create_index(
        "uq_fee_day_closures_date_user", "fee_day_closures",
        ["closure_date_bs", "collected_by_id"], unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    # fee_collections: explicit BS due date + invoice/installment grouping
    op.add_column(
        "fee_collections", sa.Column("due_date_bs", sa.String(length=20), nullable=True)
    )
    op.add_column(
        "fee_collections",
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "fee_collections",
        sa.Column("installment_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "fee_collections",
        sa.Column("fine_accrued_on_bs", sa.String(length=20), nullable=True),
    )
    op.create_foreign_key(
        "fk_fee_collections_invoice", "fee_collections", "fee_invoices",
        ["invoice_id"], ["id"],
    )
    op.create_foreign_key(
        "fk_fee_collections_installment", "fee_collections", "fee_installments",
        ["installment_id"], ["id"],
    )
    op.create_index("ix_fee_collections_invoice_id", "fee_collections", ["invoice_id"])
    op.create_index("ix_fee_collections_due_date_bs", "fee_collections", ["due_date_bs"])


def downgrade():
    op.drop_index("ix_fee_collections_due_date_bs", table_name="fee_collections")
    op.drop_index("ix_fee_collections_invoice_id", table_name="fee_collections")
    op.drop_constraint("fk_fee_collections_installment", "fee_collections", type_="foreignkey")
    op.drop_constraint("fk_fee_collections_invoice", "fee_collections", type_="foreignkey")
    op.drop_column("fee_collections", "fine_accrued_on_bs")
    op.drop_column("fee_collections", "installment_id")
    op.drop_column("fee_collections", "invoice_id")
    op.drop_column("fee_collections", "due_date_bs")
    op.drop_index("uq_fee_day_closures_date_user", table_name="fee_day_closures")
    op.drop_index("ix_fee_day_closures_collected_by_id", table_name="fee_day_closures")
    op.drop_index("ix_fee_day_closures_closure_date_bs", table_name="fee_day_closures")
    op.drop_table("fee_day_closures")
    op.drop_index("ix_fee_offline_submissions_created_by_id", table_name="fee_offline_submissions")
    op.drop_index("ix_fee_offline_submissions_status", table_name="fee_offline_submissions")
    op.drop_index("ix_fee_offline_submissions_student_id", table_name="fee_offline_submissions")
    op.drop_table("fee_offline_submissions")
    op.drop_index("ix_fee_carry_forward_logs_student_id", table_name="fee_carry_forward_logs")
    op.drop_table("fee_carry_forward_logs")
    op.drop_index("uq_fee_carry_forward_student_year", table_name="fee_carry_forwards")
    op.drop_index("ix_fee_carry_forwards_student_id", table_name="fee_carry_forwards")
    op.drop_table("fee_carry_forwards")
    op.drop_index("uq_fee_installments_structure_seq", table_name="fee_installments")
    op.drop_index("ix_fee_installments_structure_id", table_name="fee_installments")
    op.drop_table("fee_installments")
    op.drop_index("ix_fee_invoices_school_student", table_name="fee_invoices")
    op.drop_index("ix_fee_invoices_status", table_name="fee_invoices")
    op.drop_index("ix_fee_invoices_period_key", table_name="fee_invoices")
    op.drop_index("ix_fee_invoices_student_id", table_name="fee_invoices")
    op.drop_table("fee_invoices")
    for t in ("day_closure_status", "offline_submission_status", "offline_method",
              "carry_forward_status", "carry_forward_type", "fee_invoice_status"):
        op.execute(f"DROP TYPE IF EXISTS {t}")
