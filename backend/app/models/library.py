"""Library models."""
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import SchoolModel


class Book(SchoolModel):
    __tablename__ = "books"

    title = Column(String(500), nullable=False)
    author = Column(String(300))
    isbn = Column(String(20))
    publisher = Column(String(300))
    category = Column(String(100))
    total_copies = Column(Integer, default=1)
    available_copies = Column(Integer, default=1)
    shelf_location = Column(String(50))
    cover_url = Column(Text)
    barcode = Column(String(50))
    is_available = Column(Boolean, default=True)


class BookTransaction(SchoolModel):
    __tablename__ = "book_transactions"

    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    issued_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    return_date = Column(Date)
    status = Column(
        Enum("issued", "returned", "overdue", "lost", name="book_tx_status"),
        default="issued",
    )
    fine_amount = Column(Numeric(8, 2), default=0)
    fine_paid = Column(Boolean, default=False)

    book = relationship("Book", backref="transactions")
    student = relationship("Student", backref="book_transactions")
    issued_by = relationship("User")


class BookIssue(SchoolModel):
    __tablename__ = "book_issues"

    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    issued_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    issued_date = Column(Date)
    due_date = Column(Date, nullable=False)
    returned_date = Column(Date)
    status = Column(
        Enum("issued", "returned", "overdue", "lost", name="book_issue_status"),
        default="issued",
    )

    book = relationship("Book", backref="issues")
    student = relationship("Student", backref="book_issues")
