"""Admission models."""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class AdmissionForm(SchoolModel):
    __tablename__ = "admission_forms"

    academic_year = Column(String(10))
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    title = Column(String(300), nullable=False)
    form_fields = Column(JSONB, default=list)  # dynamic form builder
    is_active = Column(Boolean, default=True)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    max_seats = Column(Integer)
    filled_seats = Column(Integer, default=0)

    klass = relationship("Class", backref="admission_forms")


class AdmissionApplication(SchoolModel):
    __tablename__ = "admission_applications"

    form_id = Column(
        UUID(as_uuid=True), ForeignKey("admission_forms.id")
    )
    inquiry_id = Column(UUID(as_uuid=True), ForeignKey("admission_inquiries.id"))
    student_name = Column(String(300), nullable=False)
    dob = Column(DateTime)
    gender = Column(String(10))
    parent_name = Column(String(300))
    parent_phone = Column(String(20), nullable=False)
    parent_email = Column(String(200))
    guardian_name = Column(String(300))
    guardian_phone = Column(String(20))
    guardian_email = Column(String(200))
    applied_class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    class_applied = Column(String(50))
    previous_school = Column(String(300))
    address = Column(Text)
    form_data = Column(JSONB, default=dict)
    documents = Column(JSONB, default=list)
    status = Column(
        Enum(
            "submitted",
            "under_review",
            "shortlisted",
            "interview",
            "accepted",
            "rejected",
            "waitlisted",
            "enrolled",
            name="admission_status",
        ),
        default="submitted",
    )
    remarks = Column(Text)
    test_score = Column(Float)
    interview_score = Column(Float)
    merit_rank = Column(Integer)
    notes = Column(Text)
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    form = relationship("AdmissionForm", backref="applications")
    inquiry = relationship("AdmissionInquiry", backref="applications")
    reviewed_by = relationship("User")


class AdmissionLead(SchoolModel):
    __tablename__ = "admission_leads"

    source = Column(String(50))  # facebook, instagram, whatsapp, website, walk_in
    parent_name = Column(String(300))
    phone = Column(String(20))
    email = Column(String(200))
    message = Column(Text)
    interested_class = Column(String(50))
    ai_score = Column(Float)  # 0-1 lead quality
    status = Column(
        Enum("new", "contacted", "converted", "lost", name="lead_status"),
        default="new",
    )
    follow_up_date = Column(DateTime)
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    notes = Column(Text)

    assigned_to = relationship("User")


class AdmissionInquiry(SchoolModel):
    __tablename__ = "admission_inquiries"

    student_name = Column(String(300))
    guardian_name = Column(String(300))
    phone = Column(String(20))
    email = Column(String(200))
    class_applied = Column(String(50))
    source = Column(String(50))  # walk_in, phone, website, social_media, referral
    status = Column(String(30), default="new")  # new, contacted, converted, lost
    notes = Column(Text)
    follow_up_date = Column(DateTime)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"))


class EnrollmentSeatCap(SchoolModel):
    """A-09 seat caps per class+year — ENFORCED with SELECT … FOR UPDATE at
    conversion time (InstiKit shipped the table but never enforced it)."""

    __tablename__ = "enrollment_seats"

    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"))
    max_seat = Column(Integer, nullable=False)

    klass = relationship("Class")

    __table_args__ = (
        Index(
            "uq_enrollment_seats_class_year",
            "school_id", "class_id", "academic_year_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )


class AdmissionRegistration(SchoolModel):
    """A-09 public funnel staging row: submitted from the school's public
    site (no account created), reviewed by the office, converted into a
    guardian account + student + application in one transaction."""

    __tablename__ = "admission_registrations"

    student_first_name = Column(String(120), nullable=False)
    student_last_name = Column(String(120))
    student_dob_bs = Column(String(10))
    gender = Column(String(20))
    guardian_name = Column(String(200), nullable=False)
    guardian_relation = Column(String(30))
    guardian_phone = Column(String(20), nullable=False, index=True)
    guardian_email = Column(String(200))
    previous_school = Column(String(200))
    applied_class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    documents = Column(JSONB, default=list)
    dynamic_fields = Column(JSONB, default=dict)
    status = Column(String(20), nullable=False, server_default="submitted", index=True)
    registration_number = Column(String(50))
    verification_token = Column(String(100), index=True)
    source = Column(String(30))
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    review_notes = Column(Text)
    application_id = Column(UUID(as_uuid=True), ForeignKey("admission_applications.id"))
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))

    applied_class = relationship("Class")
    reviewed_by = relationship("User")
    student = relationship("Student")
