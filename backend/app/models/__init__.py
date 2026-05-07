"""Models package — import all models so Alembic can discover them."""
from app.models.base import BaseModel, SchoolModel  # noqa: F401
from app.models.school import School, SchoolWebsite, SchemeGrade  # noqa: F401
from app.models.plugin import Plugin, SchoolPlugin, PluginUsageLog  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.student import Student, Guardian, StudentHealthRecord  # noqa: F401
from app.models.academic import AcademicYear, Semester, Medium, Stream, Shift, Class, Section, Subject  # noqa: F401
from app.models.attendance import Attendance, TeacherAttendance, LeaveRequest  # noqa: F401
from app.models.exam import Exam, Marks, ReportCard, OnlineExam, OnlineExamAttempt  # noqa: F401
from app.models.fee import FeeStructure, FeeCollection, FeeReceipt  # noqa: F401
from app.models.notice import Notice, Event  # noqa: F401
from app.models.chat import ChatThread, ChatMessage  # noqa: F401
from app.models.slider import SchoolSlider  # noqa: F401
from app.models.diary import DiaryCategory, DiaryEntry  # noqa: F401
from app.models.assignment import Assignment, AssignmentSubmission  # noqa: F401
from app.models.transport import Route, Bus, BusStop, GPSLog  # noqa: F401
from app.models.social import SocialAccount, SocialPost, SocialMessage, AdCampaign, Post, Comment, Group  # noqa: F401
from app.models.library import Book, BookTransaction, BookIssue  # noqa: F401
from app.models.lms import Course, Lesson, Topic, StudyMaterial, LiveClass, StudentProgress, Quiz, QuizAttempt, Enrollment  # noqa: F401
from app.models.admission import AdmissionForm, AdmissionApplication, AdmissionLead, AdmissionInquiry  # noqa: F401
from app.models.notification import SMSLog, WhatsAppMessage, PushNotification, NotificationTemplate, WhatsAppBotConfig  # noqa: F401
from app.models.gamification import Badge, StudentBadge, PointsLog, House, Reward  # noqa: F401
from app.models.wellbeing import MoodCheckin, WellbeingSurvey, WellbeingSurveyResponse, CounselorSession, MoodEntry, CounselorNote  # noqa: F401
from app.models.dismissal import AuthorizedPickup, DismissalRecord  # noqa: F401
from app.models.emergency import EmergencyAlert, EvacuationPlan, EmergencyHeadcount  # noqa: F401
from app.models.incident import Incident, WitnessStatement, IncidentAction  # noqa: F401
from app.models.portfolio import StudentPortfolio, PortfolioItem, MicroCredential  # noqa: F401
from app.models.digital_content import DigitalBook, PastPaper, OERResource  # noqa: F401
from app.models.conference import PTConference, ConferenceSlot, ConferenceNotes  # noqa: F401
from app.models.compliance import ComplianceReport, EMISExport, AuditLog  # noqa: F401
from app.models.timetable import Timetable, TimetablePeriod, Substitution, TimetableSlot  # noqa: F401
from app.models.website import WebsitePage, WebsiteTheme, WebsiteForm, WebsiteFormSubmission  # noqa: F401
from app.models.ai_insight import WeeklyInsightReport, DailyBrief, RiskAlert  # noqa: F401
from app.models.ai_token import AISchoolQuota, AIUsageLog  # noqa: F401
from app.models.designer_template import DesignerTemplate  # noqa: F401
from app.models.designer_document import DesignerDocument  # noqa: F401
from app.models.health_records import HealthProfile, MedicalVisit, Immunization  # noqa: F401
from app.models.visitor import Visitor, VisitorAppointment  # noqa: F401
from app.models.alumni import Alumni, AlumniEvent, AlumniDonation  # noqa: F401
from app.models.hr_payroll import StaffPayroll, StaffLeave, StaffAppraisal  # noqa: F401
from app.models.inventory import Asset, ProcurementRequest, AssetAuditLog  # noqa: F401
from app.models.file import FileFolder, ManagedFile  # noqa: F401
from app.models.iemis import IemisImportLog  # noqa: F401
from app.models.staff import Staff, StaffMember  # noqa: F401
from app.models.communication import Notice as CommunicationNotice  # noqa: F401
from app.models.health import StudentHealthRecord as LegacyStudentHealthRecord  # noqa: F401
from app.models.hr import StaffPayroll as HRPayrollAlias  # noqa: F401
from app.models.analytics import WeeklyInsightReport as AnalyticsInsightReport  # noqa: F401
from app.models.designer import DesignerDocument as DesignerDocumentAlias  # noqa: F401
from app.models.ad_campaign import AdCampaign as AdCampaignAlias  # noqa: F401
