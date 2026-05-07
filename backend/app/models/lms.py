"""LMS models: Course, Lesson, Topic, StudyMaterial, LiveClass, progress, quizzes."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Course(SchoolModel):
    __tablename__ = "courses"

    title = Column(String(300), nullable=False)
    description = Column(Text)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    instructor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    thumbnail_url = Column(Text)
    is_published = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    status = Column(String(20), default="draft")  # draft, published, archived
    total_lessons = Column(Integer, default=0)
    total_duration_mins = Column(Integer, default=0)

    teacher = relationship("User", foreign_keys=[teacher_id], backref="courses_teaching")
    instructor = relationship("User", foreign_keys=[instructor_id])
    lessons = relationship("Lesson", back_populates="course")


class Lesson(SchoolModel):
    __tablename__ = "lessons"

    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    title = Column(String(300), nullable=False)
    content = Column(Text)
    content_type = Column(String(20), default="video")  # video, text, quiz, assignment
    video_url = Column(Text)
    file_url = Column(Text)
    duration_mins = Column(Integer)
    duration_minutes = Column(Integer)
    sort_order = Column(Integer, default=0)
    lesson_type = Column(
        Enum("video", "text", "quiz", "assignment", name="lesson_type"), default="video"
    )
    resources = Column(JSONB, default=list)
    is_published = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)

    course = relationship("Course", back_populates="lessons")
    topics = relationship("Topic", back_populates="lesson")
    study_materials = relationship("StudyMaterial", back_populates="lesson")


class Topic(SchoolModel):
    __tablename__ = "topics"

    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_published = Column(Boolean, default=True)

    lesson = relationship("Lesson", back_populates="topics")
    study_materials = relationship("StudyMaterial", back_populates="topic")


class StudyMaterial(SchoolModel):
    __tablename__ = "study_materials"

    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"))
    topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id"))
    title = Column(String(300), nullable=False)
    description = Column(Text)
    material_type = Column(String(30), default="file")
    file_url = Column(Text, nullable=False)
    thumbnail_url = Column(Text)
    sort_order = Column(Integer, default=0)
    is_published = Column(Boolean, default=True)

    lesson = relationship("Lesson", back_populates="study_materials")
    topic = relationship("Topic", back_populates="study_materials")


class LiveClass(SchoolModel):
    __tablename__ = "live_classes"

    title = Column(String(300), nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"))
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"))
    scheduled_at = Column(DateTime, nullable=False)
    duration_mins = Column(Integer, default=45)
    jitsi_room_id = Column(String(200))
    recording_url = Column(Text)
    status = Column(
        Enum("scheduled", "live", "ended", "cancelled", name="live_class_status"),
        default="scheduled",
    )
    attendee_count = Column(Integer, default=0)

    teacher = relationship("User")
    course = relationship("Course", backref="live_classes")


class StudentProgress(SchoolModel):
    __tablename__ = "student_progress"

    student_id = Column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"))
    progress_pct = Column(Float, default=0)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime)
    watch_time_mins = Column(Integer, default=0)
    last_position_secs = Column(Integer, default=0)

    student = relationship("Student", backref="course_progress")
    course = relationship("Course", backref="student_progress")


class Quiz(SchoolModel):
    __tablename__ = "quizzes"

    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    title = Column(String(300), nullable=False)
    questions = Column(JSONB, default=list)  # [{question, options, correct_answer, marks}]
    total_marks = Column(Integer, default=0)
    time_limit_minutes = Column(Integer)
    sort_order = Column(Integer, default=0)
    is_published = Column(Boolean, default=True)

    course = relationship("Course", backref="quizzes")
    attempts = relationship("QuizAttempt", back_populates="quiz")


class QuizAttempt(SchoolModel):
    __tablename__ = "quiz_attempts"

    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    answers = Column(JSONB, default=dict)
    score = Column(Float)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    quiz = relationship("Quiz", back_populates="attempts")
    student = relationship("User", backref="quiz_attempts")


class Enrollment(SchoolModel):
    __tablename__ = "enrollments"

    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    progress_percentage = Column(Float, default=0)
    completed_lessons = Column(JSONB, default=list)  # list of lesson_id strings
    enrolled_at = Column(DateTime)
    status = Column(String(20), default="active")  # active, completed, dropped

    course = relationship("Course", backref="enrollments")
    student = relationship("User", backref="course_enrollments")
