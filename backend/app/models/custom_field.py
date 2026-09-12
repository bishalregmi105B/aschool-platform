"""A-35: dynamic registration/custom-field definitions (per role/form).

Schools extend the admission/registration forms without code — the same
lever InfixEdu's SmCustomField and eSchool's FormField gave them. Values
live in `students.dynamic_fields` / `staff.dynamic_fields` keyed by def id.
"""
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import SchoolModel


class CustomFieldDef(SchoolModel):
    __tablename__ = "custom_field_defs"

    form_name = Column(String(50), nullable=False, index=True)  # student_registration|staff_registration
    label = Column(String(200), nullable=False)
    label_nepali = Column(String(200))
    field_type = Column(String(30), nullable=False)  # text|textarea|number|date|select|multiselect|checkbox
    required = Column(Boolean, default=False)
    choices = Column(JSONB, default=list)
    rank = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
