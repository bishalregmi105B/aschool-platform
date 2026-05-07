"""Plan-compatible health model aliases."""

from app.models.health_records import HealthProfile, Immunization, MedicalVisit
from app.models.student import StudentHealthRecord

__all__ = ["HealthProfile", "MedicalVisit", "Immunization", "StudentHealthRecord"]
