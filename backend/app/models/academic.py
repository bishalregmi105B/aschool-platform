"""Academic structure: years, semesters, classes, sections, subjects, streams."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class AcademicYear(SchoolModel):
    __tablename__ = "academic_years"

    name = Column(String(20), nullable=False)  # "2081-82"
    name_nepali = Column(String(20))
    start_date_bs = Column(String(10))
    end_date_bs = Column(String(10))
    start_date_ad = Column(Date)
    end_date_ad = Column(Date)
    is_current = Column(Boolean, default=False)


class Semester(SchoolModel):
    __tablename__ = "semesters"

    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    name = Column(String(100), nullable=False)
    name_nepali = Column(String(100))
    start_date_bs = Column(String(10))
    end_date_bs = Column(String(10))
    start_date_ad = Column(Date)
    end_date_ad = Column(Date)
    sort_order = Column(Integer, default=0)
    is_current = Column(Boolean, default=False)

    academic_year = relationship("AcademicYear", backref="semesters")


class Medium(SchoolModel):
    __tablename__ = "mediums"

    name = Column(String(100), nullable=False)
    name_nepali = Column(String(100))
    code = Column(String(20))
    is_default = Column(Boolean, default=False)


class Stream(SchoolModel):
    __tablename__ = "streams"

    name = Column(String(100), nullable=False)
    name_nepali = Column(String(100))
    code = Column(String(20))
    description = Column(Text)
    class_ids = Column(ARRAY(UUID(as_uuid=True)))
    is_default = Column(Boolean, default=False)


class Shift(SchoolModel):
    __tablename__ = "shifts"

    name = Column(String(100), nullable=False)
    name_nepali = Column(String(100))
    start_time = Column(Time)
    end_time = Column(Time)
    is_default = Column(Boolean, default=False)


class Class(SchoolModel):
    __tablename__ = "classes"

    name = Column(String(50), nullable=False)  # "Grade 10", "Class 5"
    name_nepali = Column(String(50))
    numeric_grade = Column(Integer)  # 10, 5
    sort_order = Column(Integer, default=0)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"))
    medium_id = Column(UUID(as_uuid=True), ForeignKey("mediums.id"))
    stream_id = Column(UUID(as_uuid=True), ForeignKey("streams.id"))

    sections = relationship("Section", back_populates="klass")
    academic_year = relationship("AcademicYear", backref="classes")
    medium = relationship("Medium")
    stream = relationship("Stream")


class Section(SchoolModel):
    __tablename__ = "sections"

    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    name = Column(String(10), nullable=False)  # "A", "B", "Orchid"
    capacity = Column(Integer, default=40)
    class_teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    medium_id = Column(UUID(as_uuid=True), ForeignKey("mediums.id"))
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id"))

    klass = relationship("Class", back_populates="sections")
    class_teacher = relationship("User", backref="class_teacher_of")
    medium = relationship("Medium")
    shift = relationship("Shift")


class Subject(SchoolModel):
    __tablename__ = "subjects"

    name = Column(String(100), nullable=False)
    name_nepali = Column(String(100))
    code = Column(String(20))
    credit_hours = Column(Integer)
    subject_type = Column(String(20))  # compulsory, optional, elective
    class_ids = Column(ARRAY(UUID(as_uuid=True)))
    teacher_ids = Column(ARRAY(UUID(as_uuid=True)))
    stream_id = Column(UUID(as_uuid=True), ForeignKey("streams.id"))
    has_practical = Column(Boolean, default=False)
    full_marks = Column(Integer, default=100)
    pass_marks = Column(Integer, default=32)
    practical_full_marks = Column(Integer)
    practical_pass_marks = Column(Integer)

    stream = relationship("Stream")
