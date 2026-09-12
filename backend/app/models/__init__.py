"""Models package — import all models so Alembic can discover them."""
from app.models.base import BaseModel, SchoolModel  # noqa: F401
from app.models.school import School, SchoolWebsite, SchemeGrade, SchoolReceiptCounter  # noqa: F401
from app.models.plugin import Plugin, SchoolPlugin, PluginUsageLog  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.user_aos_settings import UserAOSSettings  # noqa: F401
from app.models.user_access_log import UserAccessLog  # noqa: F401
from app.models.student_enrollment import StudentEnrollment, PromotionRecord  # noqa: F401
from app.models.custom_field import CustomFieldDef  # noqa: F401
from app.models.exit_document import StudentExitDocument  # noqa: F401
from app.models.monitoring import MobileCrashReport  # noqa: F401
from app.models.student import Student, Guardian  # noqa: F401
from app.models.student_transfer import StudentTransfer  # noqa: F401
from app.models.academic import AcademicYear, Semester, Medium, Stream, Shift, Class, Section, Subject  # noqa: F401
from app.models.attendance import (  # noqa: F401
    Attendance,
    TeacherAttendance,
    LeaveRequest,
    SubjectAttendance,
)
from app.models.exam import (  # noqa: F401
    Exam,
    Marks,
    ReportCard,
    OnlineExam,
    OnlineExamAttempt,
    MarkComponent,
    GradeScale,
)
from app.models.fee import (  # noqa: F401
    FeeStructure,
    FeeCollection,
    FeeReceipt,
    FeeType,
    PaymentInitiation,
    StudentScholarship,
    FeeRefund,
    FeeInvoice,
    FeeInstallment,
    FeeCarryForward,
    FeeCarryForwardLog,
    FeeOfflineSubmission,
    FeeDayClosure,
)
from app.models.notice import Notice, Event  # noqa: F401
from app.models.chat import ChatThread, ChatMessage  # noqa: F401
from app.models.slider import SchoolSlider  # noqa: F401
from app.models.diary import DiaryCategory, DiaryEntry  # noqa: F401
from app.models.assignment import Assignment, AssignmentSubmission  # noqa: F401
from app.models.transport import (  # noqa: F401
    Route,
    Bus,
    BusStop,
    GPSLog,
    TransportTrip,
    TransportTripInstance,
    TransportTripInstanceStop,
    TransportTripReservation,
    TransportNotificationPref,
    TransportAlertLog,
)
from app.models.library import (  # noqa: F401
    Book,
    BookCopy,
    BookFine,
    BookFinePayment,
    BookIssue,
    BookPurchaseOrder,
    BookPurchaseOrderItem,
    BookRack,
    BookReservation,
    BookTransaction,
    BookVendor,
    StocktakeItem,
    StocktakeSession,
)
from app.models.lms import Course, Lesson, Topic, StudyMaterial, LiveClass, StudentProgress, Quiz, QuizAttempt, Enrollment  # noqa: F401
from app.models.admission import (  # noqa: F401
    AdmissionForm,
    AdmissionApplication,
    AdmissionLead,
    AdmissionInquiry,
    EnrollmentSeatCap,
    AdmissionRegistration,
)
from app.models.notification import SMSLog, WhatsAppMessage, PushNotification, NotificationTemplate, WhatsAppBotConfig, NotificationRule  # noqa: F401
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
from app.models.designer_document_revision import DesignerDocumentRevision  # noqa: F401
from app.models.health_records import HealthProfile, MedicalVisit, Immunization  # noqa: F401
from app.models.visitor import Visitor, VisitorAppointment  # noqa: F401
from app.models.alumni import Alumni, AlumniEvent, AlumniDonation  # noqa: F401
from app.models.hr_payroll import StaffPayroll, StaffLeave, StaffAppraisal  # noqa: F401
from app.models.inventory import Asset, ProcurementRequest, AssetAuditLog  # noqa: F401
from app.models.file import FileFolder, ManagedFile  # noqa: F401
from app.models.iemis import IemisImportLog  # noqa: F401
from app.models.school_chain import SchoolChain, SchoolChainMember  # noqa: F401
from app.models.adaptive_learning import LearningPath, MasteryRecord  # noqa: F401
from app.models.staff import Staff, StaffMember  # noqa: F401
from app.models.communication import Notice as CommunicationNotice  # noqa: F401
from app.models.hr import StaffPayroll as HRPayrollAlias  # noqa: F401
from app.models.analytics import WeeklyInsightReport as AnalyticsInsightReport  # noqa: F401
from app.models.designer import DesignerDocument as DesignerDocumentAlias  # noqa: F401
from app.models.ai_teacher import (  # noqa: F401
    AITeacherServiceKey,
    AITeacherLesson,
    AITeacherLessonChapter,
    AITeacherMessage,
    AITeacherMastery,
    AITeacherLearningEvent,
)
from app.models.teaching_content import (  # noqa: F401
    TeachingSection,
    TeachingSectionVersion,
    TeachingSectionOutcome,
    TeachingNote,
    TeachingExample,
    TeachingMisconception,
    TeachingFormula,
    TeachingExamTip,
    TeachingKeyTerm,
    TeachingMedia,
    TeachingContentSnapshot,
    TeachingContentReview,
)
from app.models.revoked_token import RevokedToken  # noqa: F401,E402 — must be in metadata for create_all/Alembic autogenerate
from app.models.biometric import BiometricDevice, BiometricPunch, BiometricSyncLog  # noqa: F401
from app.models.disaster_management import DisasterDrill, DrillParticipation  # noqa: F401
from app.models.incident_management import IncidentEscalation, IncidentWorkflowEvent  # noqa: F401
# faqs / hostel tables have migrations (c1d2e3f4a5b6, d2e3f4a5b6c7) but were
# absent here — autogenerate treated the models as orphaned and could emit
# drops for live tables (D-01).
from app.models.faq import FAQ  # noqa: F401
from app.models.webhook import ProcessedWebhookEvent  # noqa: F401
from app.models.system import SystemSetting  # noqa: F401
from app.models.question_bank import (
    QuestionBankItem,
    QuestionSubpart,
    QuestionRubricStep,
    PaperBlueprint,
    GeneratedPaper,
)  # noqa: F401
from app.models.curriculum import CurriculumFramework, CurriculumUnit, LearningOutcome, SubjectOffering  # noqa: F401
# W5-B #7 / W5-C A3: textbook_* + curriculum_* tables are referenced by FK from
# question_bank_items/question_subparts — these imports must stay registered in
# db.metadata or create_all/alembic autogenerate raise NoReferencedTableError.
from app.models.textbook import (  # noqa: F401
    TextbookCorpus,
    TextbookPage,
    TextbookChapter,
    TextbookSection,
    TextbookAsset,
)
from app.models.curriculum_graph import (  # noqa: F401
    CurriculumConcept,
    ConceptPrerequisite,
    ConceptMisconception,
)
from app.models.document_chunk import DocumentChunk  # noqa: F401
from app.models.money import ClassSubject, SectionSubjectTeacher, FeeStructureItem  # noqa: F401
from app.models.contact import ContactMessage  # noqa: F401
from app.models.ai_workbench import (  # noqa: F401
    AIGeneration,
    AINutritionFacts,
    AIToolRegistry,
    SchoolAIToolSettings,
    AIContentLibraryItem,
    TutorSessionPlan,
    TutorSession,
    TutorMessage,
    IEPPlan,
    GuardianAIConsent,
    ModerationFlag,
    AIToolAnalyticsDaily,
    StudentAIProfile,
)
from app.models.hostel import Hostel, HostelRoom, HostelAllocation  # noqa: F401
from app.models.content_spine import (  # noqa: F401
    ContentSource,
    ContentUnit,
    ContentChunk,
    ExtractionRun,
    QuestionPaper,
    PaperQuestion,
    GoldenSetItem,
    EvalRun,
)
