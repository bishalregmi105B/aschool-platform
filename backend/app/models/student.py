"""Student, Guardian, and StudentHealthRecord models."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    Date,
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

try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    Vector = None


class Student(SchoolModel):
    __tablename__ = "students"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Name (denormalized for quick access)
    first_name = Column(String(150), nullable=False)
    first_name_nepali = Column(String(150))
    last_name = Column(String(150), nullable=False)
    last_name_nepali = Column(String(150))
    gender = Column(Enum("male", "female", "other", name="student_gender"))
    dob_bs = Column(String(10))
    dob_ad = Column(Date)
    address = Column(JSONB)

    # Academic
    student_id = Column(String(50))
    roll_number = Column(Integer)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"))
    semester_id = Column(UUID(as_uuid=True), ForeignKey("semesters.id"))
    stream_id = Column(UUID(as_uuid=True), ForeignKey("streams.id"))
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id"))
    medium_id = Column(UUID(as_uuid=True), ForeignKey("mediums.id"))
    academic_year = Column(String(10))
    admission_date_bs = Column(String(10))
    admission_date_ad = Column(Date)
    admission_number = Column(String(50))

    # Personal
    nationality = Column(String(100), default="Nepali")
    religion = Column(String(100))
    ethnicity = Column(String(100))
    caste = Column(String(100))                           # EMIS: जाति
    mother_tongue = Column(String(100))                   # EMIS: मातृभाषा
    blood_group = Column(String(5))
    disability = Column(String(200))
    disability_type = Column(                             # EMIS: अपाङ्गता प्रकार
        String(50),
        nullable=True,
    )
    # EMIS structured address fields (permanent)
    permanent_province = Column(String(100))
    permanent_district = Column(String(100))
    permanent_municipality = Column(String(100))
    permanent_ward = Column(String(10))
    # EMIS structured address fields (temporary / current)
    temporary_province = Column(String(100))
    temporary_district = Column(String(100))
    temporary_municipality = Column(String(100))
    temporary_ward = Column(String(10))
    previous_school = Column(String(300))
    transport_enrolled = Column(Boolean, default=False)
    bus_stop_id = Column(UUID(as_uuid=True), ForeignKey("bus_stops.id"))

    # Status
    status = Column(
        Enum(
            "active",
            "transferred_in",
            "transferred_out",
            "dropped_out",
            "graduated",
            "on_leave",
            name="student_status",
        ),
        default="active",
    )

    # Documents
    photo_url = Column(Text)
    birth_cert_url = Column(Text)
    character_cert_url = Column(Text)

    # AI
    risk_score = Column(Float)
    risk_level = Column(Enum("low", "medium", "high", "critical", name="risk_level"))
    learning_style = Column(String(50))
    strengths = Column(ARRAY(Text))
    weaknesses = Column(ARRAY(Text))
    embedding = Column(Vector(1536)) if Vector else None

    # Gamification
    total_points = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)

    # Relationships
    user = relationship("User", backref="student_profile")
    klass = relationship("Class", backref="students")
    section = relationship("Section", backref="students")
    semester = relationship("Semester")
    stream = relationship("Stream")
    shift = relationship("Shift")
    medium = relationship("Medium")
    guardians = relationship("Guardian", back_populates="student")

    def to_dict(self):
        # Resolve class/section names from relationships
        class_name = None
        section_name = None
        if self.klass:
            class_name = self.klass.name
        if self.section:
            section_name = self.section.name

        from app.utils.password import generate_default_password
        default_pw = None
        if self.user:
            default_pw = generate_default_password(self.user, self)

        return {
            "id": str(self.id),
            "student_id": self.student_id,
            "enrollment_number": self.admission_number or self.student_id,
            "email": self.user.email if self.user else None,
            "phone": self.user.phone if self.user else None,
            "roll_number": self.roll_number,
            "first_name": self.first_name or "",
            "last_name": self.last_name or "",
            "full_name": f"{self.first_name or ''} {self.last_name or ''}".strip(),
            "gender": self.gender,
            "dob_bs": self.dob_bs,
            "dob_ad": str(self.dob_ad) if self.dob_ad else None,
            "blood_group": self.blood_group,
            "class_id": str(self.class_id) if self.class_id else None,
            "class_name": class_name,
            "section_id": str(self.section_id) if self.section_id else None,
            "section_name": section_name,
            "academic_year_id": str(self.academic_year_id) if self.academic_year_id else None,
            "semester_id": str(self.semester_id) if self.semester_id else None,
            "semester_name": self.semester.name if self.semester else None,
            "stream_id": str(self.stream_id) if self.stream_id else None,
            "stream_name": self.stream.name if self.stream else None,
            "shift_id": str(self.shift_id) if self.shift_id else None,
            "shift_name": self.shift.name if self.shift else None,
            "medium_id": str(self.medium_id) if self.medium_id else None,
            "medium_name": self.medium.name if self.medium else None,
            "academic_year": self.academic_year,
            "admission_number": self.admission_number,
            "admission_date_bs": self.admission_date_bs,
            "nationality": self.nationality,
            "religion": self.religion,
            "ethnicity": self.ethnicity,
            "address": self.address,
            "status": self.status,
            "photo_url": self.photo_url,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "total_points": self.total_points or 0,
            "current_streak": self.current_streak or 0,
            "school_id": str(self.school_id),
            "login_id": self.student_id,
            "default_password_hint": default_pw,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Guardian(SchoolModel):
    __tablename__ = "guardians"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Contact info (denormalized — guardian may not have a user account)
    full_name = Column(String(300), nullable=False)
    full_name_nepali = Column(String(300))
    phone = Column(String(20))
    phone_2 = Column(String(20))
    email = Column(String(200))
    address = Column(JSONB)

    relation = Column(
        Enum("father", "mother", "guardian", "other", name="guardian_relation"),
        nullable=False,
    )
    is_primary = Column(Boolean, default=False)
    occupation = Column(String(200))
    annual_income_range = Column(String(50))
    education_level = Column(String(100))
    workplace = Column(String(200))

    # Relationships
    student = relationship("Student", back_populates="guardians")
    user = relationship("User", backref="guardian_profile")


class StudentHealthRecord(SchoolModel):
    __tablename__ = "student_health_records"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    height_cm = Column(Numeric(5, 2))
    weight_kg = Column(Numeric(5, 2))
    blood_group = Column(String(5))
    allergies = Column(ARRAY(Text))
    chronic_conditions = Column(ARRAY(Text))
    vaccination_records = Column(JSONB, default=dict)
    emergency_contact = Column(String(20))
    doctor_name = Column(String(200))
    doctor_phone = Column(String(20))
    insurance_info = Column(JSONB, default=dict)
    last_checkup_date = Column(Date)
    notes = Column(Text)

    student = relationship("Student", backref="health_records")
