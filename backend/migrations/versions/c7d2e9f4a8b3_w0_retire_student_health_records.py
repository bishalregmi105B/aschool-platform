"""W0 dedup: retire the duplicate student_health_records table

Two tables stored "a student's health": `student_health_records`
(app/models/student.py, the older model) and `health_profiles`
(app/models/health_records.py, the one the health_records API and the parent
app actually read and write). The dedup audit (Cluster G) called the merge;
a grep confirmed `StudentHealthRecord` has zero readers and zero writers —
only the model definition and the models/health.py re-export shim reference it.

This migration copies any legacy rows that carry data the newer table lacks
(blood_group/height/weight/allergies) into `health_profiles` — creating a
profile row per student that does not already have one — then drops
`student_health_records`. models/student.py loses the class and the shim is
deleted with this revision.

Revision ID: c7d2e9f4a8b3
Revises: e8b1c4d6a9f2
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa

revision = "c7d2e9f4a8b3"
down_revision = "e8b1c4d6a9f2"
branch_labels = None
depends_on = None


def upgrade():
    # Carry over whatever the legacy table holds onto the canonical profiles.
    # Column mapping: chronic_conditions → medical_conditions; the 20-char
    # legacy emergency_contact maps to emergency_phone (a phone-length field);
    # vaccination_records (JSONB) and notes have no health_profiles counterpart
    # and are dropped with the table. Unique(student_id) means one profile per
    # student, so students that already have a profile are left untouched.
    op.execute(
        """
        INSERT INTO health_profiles (
            id, school_id, student_id, blood_group, height_cm, weight_kg,
            allergies, medical_conditions, emergency_phone, doctor_name,
            doctor_phone, insurance_info, last_checkup_date,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(), r.school_id, r.student_id,
            r.blood_group, r.height_cm, r.weight_kg,
            COALESCE(r.allergies, '{}'::text[]),
            COALESCE(r.chronic_conditions, '{}'::text[]),
            r.emergency_contact, r.doctor_name, r.doctor_phone,
            COALESCE(r.insurance_info, '{}'::jsonb),
            r.last_checkup_date,
            NOW(), NOW()
        FROM student_health_records r
        JOIN students s ON s.id = r.student_id AND s.is_deleted = false
        WHERE NOT EXISTS (
            SELECT 1 FROM health_profiles p WHERE p.student_id = r.student_id
        )
        AND (
            r.blood_group IS NOT NULL OR r.height_cm IS NOT NULL
            OR r.weight_kg IS NOT NULL
            OR COALESCE(array_length(r.allergies, 1), 0) > 0
            OR COALESCE(array_length(r.chronic_conditions, 1), 0) > 0
            OR r.vaccination_records IS NOT NULL
            OR r.emergency_contact IS NOT NULL
            OR r.doctor_name IS NOT NULL OR r.doctor_phone IS NOT NULL
            OR r.insurance_info IS NOT NULL OR r.last_checkup_date IS NOT NULL
            OR r.notes IS NOT NULL
        )
        """
    )
    op.execute('DROP TABLE IF EXISTS "student_health_records" CASCADE')


def downgrade():
    # Recreate the legacy table shape; migrated data is NOT copied back —
    # health_profiles remains the source of truth even on rollback.
    op.create_table(
        "student_health_records",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("school_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("schools.id")),
        sa.Column("student_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("students.id"), nullable=False),
        sa.Column("height_cm", sa.Numeric(5, 2)),
        sa.Column("weight_kg", sa.Numeric(5, 2)),
        sa.Column("blood_group", sa.String(5)),
        sa.Column("allergies", sa.Text(), server_default="{}"),
        sa.Column("medical_notes", sa.Text()),
        sa.Column("vision_check", sa.String(200)),
        sa.Column("dental_check", sa.String(200)),
        sa.Column("last_checkup_date", sa.Date()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false")),
    )
    op.create_index(
        op.f("ix_student_health_records_school_id"),
        "student_health_records", ["school_id"],
    )
