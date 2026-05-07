"""Website and app banner slider model."""
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.models.base import SchoolModel


class SchoolSlider(SchoolModel):
    __tablename__ = "school_sliders"

    title = Column(String(300), nullable=False)
    subtitle = Column(Text)
    image_url = Column(Text, nullable=False)
    link_url = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    starts_at = Column(DateTime)
    ends_at = Column(DateTime)
