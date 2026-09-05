# W3-A1b — Complete Table Catalog

**196 tables** declared across 66 files in `backend/app/models/` (unique
`__tablename__` count; verified by enumeration). 199 model classes total — the
extra 3 are `SchoolIsolationError` (an exception, `base.py:78`) plus the two
abstract bases `BaseModel`/`SchoolModel` (`base.py:10`, `:46`).

## Conventions (apply to every row unless noted)

`BaseModel` (`app/models/base.py:10-43`) gives every table:
- `id` UUID PK, `default=uuid.uuid4` + `server_default=gen_random_uuid()` (`:17-22`)
- `created_at`/`updated_at` **TIMESTAMPTZ** with `server_default=now()` and
  `onupdate=now()` (`:23-31`)
- `is_deleted` Boolean NOT NULL default false (`:32-34`) → soft delete everywhere
- `soft_delete()` commits immediately (`:36-38`); `active()` classmethod (`:40-43`)

`SchoolModel` (`base.py:46-75`) adds `school_id UUID NOT NULL FK schools.id, index=True`
(`:51-53`) and the `for_school()` / `for_school_and_year()` guards (`:55-75`).

Legend for the catalog columns:
- **Scope**: `inherit` = SchoolModel (school_id NOT NULL); `own-NN` = own
  school_id NOT NULL column; `own-NULL` = own nullable school_id (platform rows
  allowed); `NONE` = no school_id at all
- **J/A** = count of JSONB / ARRAY columns in that model
- **U/I/C** = UniqueConstraint / Index / CheckConstraint declarations

Three tables deviate from BaseModel entirely (hand-rolled `db.Model`):
`faqs` (`app/models/faq.py:8`), `hostels`/`hostel_rooms`/`hostel_allocations`
(`app/models/hostel.py:8,27,54`). They have `id` UUID with a **Python-only**
default (no `server_default`), naive-`default=lambda datetime.now(timezone.utc)`
timestamps, **no `updated_at`** on the hostel three, and `is_deleted` without
`nullable=False` — so `is_deleted IS NULL` rows are possible.

## Catalog

All `path:line` are relative to `backend/app/models/`. PK is UUID for all 196.

| # | table | class | path:line | domain / plugin | scope | J/A | U/I/C |
|---|---|---|---|---|---|---|---|
| 1 | academic_years | AcademicYear | academic.py:20 | academics (core) | inherit | 0/0 | 0/0/0 |
| 2 | semesters | Semester | academic.py:32 | academics | inherit | 0/0 | 0/0/0 |
| 3 | mediums | Medium | academic.py:48 | academics | inherit | 0/0 | 0/0/0 |
| 4 | streams | Stream | academic.py:57 | academics | inherit | 0/1 | 0/0/0 |
| 5 | shifts | Shift | academic.py:68 | academics | inherit | 0/0 | 0/0/0 |
| 6 | classes | Class | academic.py:78 | academics | inherit | 0/0 | 0/0/0 |
| 7 | sections | Section | academic.py:95 | academics | inherit | 0/0 | 0/0/0 |
| 8 | subjects | Subject | academic.py:111 | academics | inherit | 0/2 | 0/0/0 |
| 9 | learning_paths | LearningPath | adaptive_learning.py:36 | ai_adaptive_learning | inherit | 4/0 | 0/0/0 |
| 10 | mastery_records | MasteryRecord | adaptive_learning.py:103 | ai_adaptive_learning | inherit | 0/0 | 1/0/0 |
| 11 | admission_forms | AdmissionForm | admission.py:20 | admission (growth) | inherit | 1/0 | 0/0/0 |
| 12 | admission_applications | AdmissionApplication | admission.py:36 | admission | inherit | 2/0 | 0/0/0 |
| 13 | admission_leads | AdmissionLead | admission.py:84 | admission | inherit | 0/0 | 0/0/0 |
| 14 | admission_inquiries | AdmissionInquiry | admission.py:105 | admission | inherit | 0/0 | 0/0/0 |
| 15 | weekly_insight_reports | WeeklyInsightReport | ai_insight.py:10 | ai_suite | inherit | 1/0 | 0/0/0 |
| 16 | daily_briefs | DailyBrief | ai_insight.py:21 | ai_suite | inherit | 1/0 | 0/0/0 |
| 17 | risk_alerts | RiskAlert | ai_insight.py:29 | ai_suite | inherit | 1/0 | 0/0/0 |
| 18 | ai_teacher_service_keys | AITeacherServiceKey | ai_teacher.py:50 | ai_teacher (premium) | inherit | 0/0 | 0/0/0 |
| 19 | ai_teacher_lessons | AITeacherLesson | ai_teacher.py:82 | ai_teacher | inherit | 2/0 | 0/0/3 |
| 20 | ai_teacher_lesson_chapters | AITeacherLessonChapter | ai_teacher.py:181 | ai_teacher | inherit | 1/0 | 1/0/1 |
| 21 | ai_teacher_messages | AITeacherMessage | ai_teacher.py:222 | ai_teacher | inherit | 0/0 | 1/0/1 |
| 22 | ai_teacher_mastery | AITeacherMastery | ai_teacher.py:246 | ai_teacher | inherit | 0/0 | 1/0/1 |
| 23 | ai_teacher_learning_events | AITeacherLearningEvent | ai_teacher.py:290 | ai_teacher | inherit | 1/0 | 0/0/0 |
| 24 | ai_school_quotas | AISchoolQuota | ai_token.py:11 | AITokenHub (core) | inherit | 0/0 | 0/0/0 |
| 25 | ai_usage_logs | AIUsageLog | ai_token.py:34 | AITokenHub | inherit | 1/0 | 0/0/0 |
| 26 | ai_generations | AIGeneration | ai_workbench.py:28 | ai_workbench | inherit | 2/0 | 0/0/0 |
| 27 | ai_nutrition_facts | AINutritionFacts | ai_workbench.py:54 | ai_workbench | **NONE** | 2/0 | 0/0/0 |
| 28 | ai_tool_registry | AIToolRegistry | ai_workbench.py:86 | ai_workbench | **NONE** | 2/0 | 0/0/0 |
| 29 | ai_tool_settings | SchoolAIToolSettings | ai_workbench.py:145 | ai_workbench | inherit | 1/0 | 1/0/0 |
| 30 | ai_content_library_items | AIContentLibraryItem | ai_workbench.py:160 | ai_workbench | inherit | 2/0 | 0/0/0 |
| 31 | tutor_session_plans | TutorSessionPlan | ai_workbench.py:177 | ai_workbench AW-06 | inherit | 0/0 | 0/0/0 |
| 32 | tutor_sessions | TutorSession | ai_workbench.py:194 | ai_workbench AW-06 | inherit | 0/0 | 0/1/0 |
| 33 | tutor_messages | TutorMessage | ai_workbench.py:215 | ai_workbench AW-06 | inherit | 0/0 | 0/0/0 |
| 34 | iep_plans | IEPPlan | ai_workbench.py:228 | ai_workbench AW-07 | inherit | 2/0 | 0/0/0 |
| 35 | guardian_ai_consents | GuardianAIConsent | ai_workbench.py:247 | ai_workbench AW-04 | inherit | 0/0 | 1/0/0 |
| 36 | moderation_flags | ModerationFlag | ai_workbench.py:266 | ai_workbench AW-04 | inherit | 0/0 | 0/0/0 |
| 37 | ai_tool_analytics_daily | AIToolAnalyticsDaily | ai_workbench.py:282 | ai_workbench | inherit | 0/0 | 1/0/0 |
| 38 | student_ai_profiles | StudentAIProfile | ai_workbench.py:302 | ai_workbench | inherit | 0/0 | 1/0/0 |
| 39 | alumni | Alumni | alumni.py:10 | alumni (growth) | inherit | 0/0 | 0/0/0 |
| 40 | alumni_events | AlumniEvent | alumni.py:32 | alumni | inherit | 0/0 | 0/0/0 |
| 41 | alumni_donations | AlumniDonation | alumni.py:47 | alumni | inherit | 0/0 | 0/0/0 |
| 42 | assignments | Assignment | assignment.py:21 | assignments (starter) | inherit | 0/1 | 0/0/0 |
| 43 | assignment_submissions | AssignmentSubmission | assignment.py:42 | assignments | inherit | 0/1 | 0/0/0 |
| 44 | attendance | Attendance | attendance.py:10 | attendance (core) | inherit | 0/0 | 1/0/0 |
| 45 | teacher_attendance | TeacherAttendance | attendance.py:39 | attendance | inherit | 0/0 | 1/0/0 |
| 46 | leave_requests | LeaveRequest | attendance.py:62 | attendance | inherit | 0/0 | 0/0/0 |
| 47 | biometric_devices | BiometricDevice | biometric.py:36 | biometric (premium) | inherit | 0/0 | 1/0/0 |
| 48 | biometric_punches | BiometricPunch | biometric.py:90 | biometric | inherit | 1/0 | 0/3/0 |
| 49 | biometric_sync_logs | BiometricSyncLog | biometric.py:139 | biometric | inherit | 1/0 | 0/0/0 |
| 50 | chat_threads | ChatThread | chat.py:10 | messaging (core) | inherit | 0/0 | 1/0/0 |
| 51 | chat_messages | ChatMessage | chat.py:30 | messaging | inherit | 0/0 | 0/0/0 |
| 52 | compliance_reports | ComplianceReport | compliance.py:10 | compliance (growth) | inherit | 1/0 | 0/0/0 |
| 53 | emis_exports | EMISExport | compliance.py:24 | compliance | inherit | 1/0 | 0/0/0 |
| 54 | audit_logs | AuditLog | compliance.py:39 | platform audit | **own-NULL** | 2/0 | 0/0/0 |
| 55 | pt_conferences | PTConference | conference.py:11 | conferences (growth) | inherit | 0/0 | 0/0/0 |
| 56 | conference_slots | ConferenceSlot | conference.py:23 | conferences | inherit | 0/0 | 0/0/0 |
| 57 | conference_notes | ConferenceNotes | conference.py:45 | conferences | inherit | 0/0 | 0/0/0 |
| 58 | contact_messages | ContactMessage | contact.py:12 | website (W-04) | inherit | 0/0 | 0/0/0 |
| 59 | curriculum_frameworks | CurriculumFramework | curriculum.py:19 | nepal_curriculum | **own-NULL** | 0/0 | 1/0/0 |
| 60 | curriculum_units | CurriculumUnit | curriculum.py:48 | nepal_curriculum | **NONE** | 0/0 | 1/0/0 |
| 61 | learning_outcomes | LearningOutcome | curriculum.py:75 | nepal_curriculum | **NONE** | 0/0 | 1/0/0 |
| 62 | subject_offerings | SubjectOffering | curriculum.py:100 | nepal_curriculum | **own-NULL** | 0/0 | 1/0/0 |
| 63 | designer_documents | DesignerDocument | designer_document.py:13 | design_studio | inherit | 1/0 | 0/0/0 |
| 64 | designer_document_revisions | DesignerDocumentRevision | designer_document_revision.py:15 | design_studio | inherit | 1/0 | 0/0/0 |
| 65 | designer_templates | DesignerTemplate | designer_template.py:12 | design_studio | **own-NULL, no FK** | 4/0 | 1/0/0 |
| 66 | diary_categories | DiaryCategory | diary.py:10 | diary | inherit | 0/0 | 0/0/0 |
| 67 | diary_entries | DiaryEntry | diary.py:18 | diary | inherit | 0/1 | 0/0/0 |
| 68 | digital_books | DigitalBook | digital_content.py:18 | elibrary (starter) | inherit | 0/0 | 0/0/0 |
| 69 | past_papers | PastPaper | digital_content.py:36 | elibrary | inherit | 0/0 | 0/0/0 |
| 70 | oer_resources | OERResource | digital_content.py:52 | elibrary | inherit | 0/1 | 0/0/0 |
| 71 | disaster_drills | DisasterDrill | disaster_management.py:34 | disaster_management | inherit | 0/0 | 0/0/0 |
| 72 | drill_participations | DrillParticipation | disaster_management.py:59 | disaster_management | inherit | 0/1 | 0/0/0 |
| 73 | authorized_pickups | AuthorizedPickup | dismissal.py:10 | dismissal (premium) | inherit | 0/0 | 0/0/0 |
| 74 | dismissal_records | DismissalRecord | dismissal.py:28 | dismissal | inherit | 0/0 | 0/0/0 |
| 75 | document_chunks | DocumentChunk | document_chunk.py:17 | RAG (A-05) | **own-NULL** | 1/0 | 0/0/0 |
| 76 | emergency_alerts | EmergencyAlert | emergency.py:20 | emergency (premium) | inherit | 0/0 | 0/0/0 |
| 77 | evacuation_plans | EvacuationPlan | emergency.py:51 | emergency | inherit | 1/0 | 0/0/0 |
| 78 | emergency_headcounts | EmergencyHeadcount | emergency.py:63 | emergency | inherit | 0/1 | 0/0/0 |
| 79 | exams | Exam | exam.py:24 | exams (starter) | inherit | 0/2 | 0/0/0 |
| 80 | marks | Marks | exam.py:83 | exams | inherit | 0/0 | 0/1 uq-partial/0 |
| 81 | report_cards | ReportCard | exam.py:135 | exams | inherit | 0/0 | 0/0/0 |
| 82 | online_exams | OnlineExam | exam.py:169 | exams | inherit | 1/0 | 0/0/0 |
| 83 | online_exam_attempts | OnlineExamAttempt | exam.py:194 | exams | inherit | 1/0 | 0/0/0 |
| 84 | fee_types | FeeType | fee.py:23 | fees (starter) | inherit | 0/0 | 0/0/0 |
| 85 | fee_structures | FeeStructure | fee.py:31 | fees | inherit | 1/0 | 0/0/0 |
| 86 | fee_collections | FeeCollection | fee.py:43 | fees | inherit | 0/0 | 0/0/0 |
| 87 | fee_receipts | FeeReceipt | fee.py:95 | fees | inherit | 0/0 | 0/1 uq-partial/0 |
| 88 | fee_refunds | FeeRefund | fee.py:135 | fees (S-13) | inherit | 0/0 | 0/0/0 |
| 89 | payment_initiations | PaymentInitiation | fee.py:172 | fees (E60) | inherit | 0/0 | 0/0/0 |
| 90 | student_scholarships | StudentScholarship | fee.py:195 | fees | inherit | 0/0 | 0/0/0 |
| 91 | file_folders | FileFolder | file.py:12 | file_management (core) | inherit | 0/0 | 0/0/0 |
| 92 | managed_files | ManagedFile | file.py:46 | file_management | inherit | 1/0 | 0/0/0 |
| 93 | badges | Badge | gamification.py:19 | gamification (growth) | inherit | 1/0 | 0/0/0 |
| 94 | student_badges | StudentBadge | gamification.py:31 | gamification | inherit | 0/0 | 0/0/0 |
| 95 | points_logs | PointsLog | gamification.py:46 | gamification | inherit | 0/0 | 0/0/0 |
| 96 | houses | House | gamification.py:62 | gamification | inherit | 0/0 | 0/0/0 |
| 97 | rewards | Reward | gamification.py:75 | gamification | inherit | 0/0 | 0/0/0 |
| 98 | health_profiles | HealthProfile | health_records.py:18 | health_records (growth) | inherit | 1/2 | 0/0/0 |
| 99 | medical_visits | MedicalVisit | health_records.py:39 | health_records | inherit | 0/0 | 0/0/0 |
| 100 | immunizations | Immunization | health_records.py:57 | health_records | inherit | 0/0 | 0/0/0 |
| 101 | staff_payroll | StaffPayroll | hr_payroll.py:10 | hr_payroll (growth) | inherit | 2/0 | 0/0/0 |
| 102 | staff_leaves | StaffLeave | hr_payroll.py:31 | hr_payroll | inherit | 0/0 | 0/0/0 |
| 103 | staff_appraisals | StaffAppraisal | hr_payroll.py:49 | hr_payroll | inherit | 2/0 | 0/0/0 |
| 104 | expense_categories | ExpenseCategory | hr_payroll.py:67 | hr_payroll | inherit | 0/0 | 0/0/0 |
| 105 | expenses | Expense | hr_payroll.py:74 | hr_payroll | inherit | 0/0 | 0/0/0 |
| 106 | iemis_import_logs | IemisImportLog | iemis.py:11 | iemis_importer (add_on) | inherit | 2/0 | 0/0/0 |
| 107 | incidents | Incident | incident.py:19 | incidents (premium) | inherit | 0/1 | 0/0/0 |
| 108 | witness_statements | WitnessStatement | incident.py:69 | incidents | inherit | 0/0 | 0/0/0 |
| 109 | incident_actions | IncidentAction | incident.py:83 | incidents | inherit | 0/0 | 0/0/0 |
| 110 | incident_escalations | IncidentEscalation | incident_management.py:31 | incident_management | inherit | 0/0 | 0/0/0 |
| 111 | incident_workflow_events | IncidentWorkflowEvent | incident_management.py:57 | incident_management | inherit | 0/0 | 0/0/0 |
| 112 | assets | Asset | inventory.py:10 | inventory (growth) | inherit | 0/0 | 0/0/0 |
| 113 | procurement_requests | ProcurementRequest | inventory.py:31 | inventory | inherit | 1/0 | 0/0/0 |
| 114 | asset_audit_logs | AssetAuditLog | inventory.py:50 | inventory | inherit | 2/0 | 0/0/0 |
| 115 | books | Book | library.py:21 | library_management | inherit | 0/0 | 0/0/0 |
| 116 | book_transactions | BookTransaction | library.py:37 | library_management | inherit | 0/0 | 0/0/0 |
| 117 | book_issues | BookIssue | library.py:58 | library_management | inherit | 0/0 | 0/0/0 |
| 118 | courses | Course | lms.py:21 | lms (growth) | inherit | 0/0 | 0/0/0 |
| 119 | lessons | Lesson | lms.py:41 | lms | inherit | 1/0 | 0/0/0 |
| 120 | topics | Topic | lms.py:64 | lms | inherit | 0/0 | 0/0/0 |
| 121 | study_materials | StudyMaterial | lms.py:77 | lms | inherit | 0/0 | 0/0/0 |
| 122 | live_classes | LiveClass | lms.py:94 | lms | inherit | 0/0 | 0/0/0 |
| 123 | student_progress | StudentProgress | lms.py:116 | lms | inherit | 0/0 | 0/0/0 |
| 124 | quizzes | Quiz | lms.py:134 | lms | inherit | 1/0 | 0/0/0 |
| 125 | quiz_attempts | QuizAttempt | lms.py:149 | lms | inherit | 1/0 | 0/0/0 |
| 126 | enrollments | Enrollment | lms.py:163 | lms | inherit | 1/0 | 0/0/0 |
| 127 | class_subjects | ClassSubject | money.py:23 | academics (D-06) | inherit | 0/0 | 1/0/0 |
| 128 | section_subject_teachers | SectionSubjectTeacher | money.py:50 | academics (D-06) | inherit | 0/0 | 1/0/0 |
| 129 | fee_structure_items | FeeStructureItem | money.py:74 | fees (D-06) | inherit | 1/0 | 1/0/0 |
| 130 | notices | Notice | notice.py:21 | notices (core) | inherit | 0/3 | 0/0/0 |
| 131 | events | Event | notice.py:45 | notices | inherit | 0/0 | 0/0/0 |
| 132 | sms_logs | SMSLog | notification.py:19 | sms_notifications | inherit | 0/0 | 0/0/0 |
| 133 | whatsapp_messages | WhatsAppMessage | notification.py:39 | whatsapp_bot | inherit | 1/0 | 0/0/0 |
| 134 | push_notifications | PushNotification | notification.py:64 | notifications | inherit | 1/0 | 0/0/0 |
| 135 | notification_templates | NotificationTemplate | notification.py:80 | notifications | inherit | 1/0 | 0/0/0 |
| 136 | whatsapp_bot_configs | WhatsAppBotConfig | notification.py:91 | whatsapp_bot | inherit | 2/0 | 0/0/0 |
| 137 | in_app_notifications | InAppNotification | notification.py:107 | notifications | inherit | 1/0 | 0/0/0 |
| 138 | plugins | Plugin | plugin.py:26 | platform catalog | **NONE** | 1/5 | 0/0/0 |
| 139 | school_plugins | SchoolPlugin | plugin.py:82 | platform install | own-NN | 1/0 | 1/0/0 |
| 140 | plugin_usage_logs | PluginUsageLog | plugin.py:117 | platform billing | own-NN | 0/0 | 0/0/0 |
| 141 | student_portfolios | StudentPortfolio | portfolio.py:10 | student_portfolio | inherit | 2/0 | 0/0/0 |
| 142 | portfolio_items | PortfolioItem | portfolio.py:25 | student_portfolio | inherit | 2/0 | 0/0/0 |
| 143 | micro_credentials | MicroCredential | portfolio.py:40 | student_portfolio | inherit | 0/0 | 0/0/0 |
| 144 | question_bank_items | QuestionBankItem | question_bank.py:17 | exams / A-03 | inherit | 2/0 | 0/0/0 |
| 145 | paper_blueprints | PaperBlueprint | question_bank.py:74 | exams / A-03 | inherit | 1/0 | 0/0/0 |
| 146 | generated_papers | GeneratedPaper | question_bank.py:105 | exams / A-03 | inherit | 1/0 | 0/0/0 |
| 147 | revoked_tokens | RevokedToken | revoked_token.py:21 | auth (core) | **NONE** | 0/0 | 0/1/0 |
| 148 | schools | School | school.py:24 | platform tenant root | **NONE** | 10/1 | 0/0/0 |
| 149 | school_websites | SchoolWebsite | school.py:196 | basic_website | own-NN | 2/0 | 0/0/0 |
| 150 | scheme_grades | SchemeGrade | school.py:218 | exams grading | own-NN | 1/0 | 0/0/0 |
| 151 | school_receipt_counters | SchoolReceiptCounter | school.py:240 | fees (D-02) | own-NN | 0/0 | 1/0/0 |
| 152 | school_chains | SchoolChain | school_chain.py:27 | multi_branch (premium) | inherit=**owner** | 0/0 | 0/1 uq-partial/0 |
| 153 | school_chain_members | SchoolChainMember | school_chain.py:64 | multi_branch | inherit=**branch** | 0/0 | 0/2 uq-partial/0 |
| 154 | school_sliders | SchoolSlider | slider.py:8 | basic_website | inherit | 0/0 | 0/0/0 |
| 155 | students | Student | student.py:27 | students (core) | inherit | 1/2 | 0/0/0 |
| 156 | guardians | Guardian | student.py:198 | students | inherit | 1/0 | 0/0/0 |
| 157 | student_transfers | StudentTransfer | student_transfer.py:14 | students | inherit | 0/0 | 0/0/0 |
| 158 | system_settings | SystemSetting | system.py:13 | platform ops | **NONE** | 1/0 | 0/0/0 |
| 159 | teaching_sections | TeachingSection | teaching_content.py:45 | ai_teacher content | **own-NULL** | 2/0 | 3/0/3 |
| 160 | teaching_section_versions | TeachingSectionVersion | teaching_content.py:145 | ai_teacher content | **own-NULL** | 1/0 | 1/0/1 |
| 161 | teaching_section_outcomes | TeachingSectionOutcome | teaching_content.py:282 | ai_teacher content | **NONE** | 0/0 | 1/0/1 |
| 162 | teaching_notes | TeachingNote | teaching_content.py:316 | ai_teacher content | **NONE** | 0/0 | 1/0/1 |
| 163 | teaching_examples | TeachingExample | teaching_content.py:362 | ai_teacher content | **NONE** | 1/0 | 1/0/2 |
| 164 | teaching_misconceptions | TeachingMisconception | teaching_content.py:417 | ai_teacher content | **NONE** | 0/0 | 0/0/1 |
| 165 | teaching_formulas | TeachingFormula | teaching_content.py:464 | ai_teacher content | **NONE** | 1/0 | 0/0/0 |
| 166 | teaching_exam_tips | TeachingExamTip | teaching_content.py:503 | ai_teacher content | **NONE** | 1/0 | 0/0/1 |
| 167 | teaching_key_terms | TeachingKeyTerm | teaching_content.py:550 | ai_teacher content | **NONE** | 0/0 | 1/0/0 |
| 168 | teaching_media | TeachingMedia | teaching_content.py:588 | ai_teacher content | **NONE** | 0/0 | 0/0/2 |
| 169 | teaching_content_snapshots | TeachingContentSnapshot | teaching_content.py:638 | ai_teacher content | **own-NULL** | 1/0 | 1/0/0 |
| 170 | teaching_content_reviews | TeachingContentReview | teaching_content.py:665 | ai_teacher content | **own-NULL** | 0/0 | 0/0/1 |
| 171 | timetables | Timetable | timetable.py:17 | timetable (starter) | inherit | 0/0 | 0/0/0 |
| 172 | timetable_periods | TimetablePeriod | timetable.py:30 | timetable | inherit | 0/0 | 0/0/0 |
| 173 | substitutions | Substitution | timetable.py:50 | timetable | inherit | 0/0 | 0/0/0 |
| 174 | timetable_slots | TimetableSlot | timetable.py:73 | timetable | inherit | 0/0 | 0/0/0 |
| 175 | routes | Route | transport.py:22 | gps_tracking (premium) | inherit | 0/0 | 0/0/0 |
| 176 | buses | Bus | transport.py:32 | gps_tracking | inherit | 0/0 | 0/0/0 |
| 177 | bus_stops | BusStop | transport.py:53 | gps_tracking | inherit | 0/1 | 0/0/0 |
| 178 | gps_logs | GPSLog | transport.py:69 | gps_tracking | inherit | 0/0 | 0/0/0 |
| 179 | users | User | user.py:23 | identity (core) | **own-NULL** | 2/2 | 0/0/0 |
| 180 | visitors | Visitor | visitor.py:10 | visitor_management | inherit | 0/0 | 0/0/0 |
| 181 | visitor_appointments | VisitorAppointment | visitor.py:30 | visitor_management | inherit | 0/0 | 0/0/0 |
| 182 | processed_webhook_events | ProcessedWebhookEvent | webhook.py:16 | payments (S-13) | **own-NULL** | 0/0 | 1/0/0 |
| 183 | website_pages | WebsitePage | website.py:10 | website_builder | inherit | 2/0 | 0/0/0 |
| 184 | website_themes | WebsiteTheme | website.py:31 | website_builder | inherit | 2/0 | 0/0/0 |
| 185 | website_forms | WebsiteForm | website.py:46 | website_builder | inherit | 1/0 | 0/0/0 |
| 186 | website_form_submissions | WebsiteFormSubmission | website.py:56 | website_builder | inherit | 1/0 | 0/0/0 |
| 187 | mood_checkins | MoodCheckin | wellbeing.py:19 | wellbeing (growth) | inherit | 0/0 | 0/0/0 |
| 188 | wellbeing_surveys | WellbeingSurvey | wellbeing.py:35 | wellbeing | inherit | 2/0 | 0/0/0 |
| 189 | wellbeing_survey_responses | WellbeingSurveyResponse | wellbeing.py:48 | wellbeing | inherit | 1/0 | 0/0/0 |
| 190 | counselor_sessions | CounselorSession | wellbeing.py:62 | wellbeing | inherit | 0/0 | 0/0/0 |
| 191 | mood_entries | MoodEntry | wellbeing.py:84 | wellbeing | inherit | 0/0 | 0/0/0 |
| 192 | counselor_notes | CounselorNote | wellbeing.py:97 | wellbeing | inherit | 0/0 | 0/0/0 |
| 193 | faqs | FAQ | faq.py:9 | faqs (core) | own-NN, **CASCADE** | 0/0 | 0/0/0 |
| 194 | hostels | Hostel | hostel.py:10 | hostel | own-NN, **CASCADE** | 0/0 | 0/0/0 |
| 195 | hostel_rooms | HostelRoom | hostel.py:29 | hostel | own-NN, **CASCADE** | 0/0 | 0/0/0 |
| 196 | hostel_allocations | HostelAllocation | hostel.py:56 | hostel | own-NN, **CASCADE** | 0/0 | 0/0/0 |

Plus one **out-of-band table created at request time**: `teacher_pd_progress`
(`app/services/ai/extensions.py:120-125`) — no model, no migration, PK
`teacher_id` alone, and no `school_id` (cross-tenant by construction).

## Alias-only model files (no tables of their own)

| file | what it re-exports | path:line |
|---|---|---|
| `analytics.py` | WeeklyInsightReport/DailyBrief/RiskAlert from ai_insight, AISchoolQuota/AIUsageLog from ai_token, PluginUsageLog from plugin | analytics.py:3-5 |
| `communication.py` | Notification* + Notice | communication.py:3-10 |
| `hr.py` | StaffPayroll/StaffLeave/StaffAppraisal from hr_payroll | hr.py:3 |
| `staff.py` | `Staff = User`, `StaffMember = User` — **no staff table exists** | staff.py:5-6 |
| `designer.py` | DesignerTemplate + DesignerDocument + WebsitePage + WebsiteTheme | designer.py:3-5 |

`models/__init__.py` imports all five aliases (`:55-59`), including
`from app.models.hr import StaffPayroll as HRPayrollAlias` — re-importing the
same mapped class under a second name.

## Tables with NO tenant column at all (10)

`plugins` (plugin.py:26), `revoked_tokens` (revoked_token.py:21), `schools`
(school.py:24), `system_settings` (system.py:13), `ai_nutrition_facts`
(ai_workbench.py:54), `ai_tool_registry` (ai_workbench.py:86),
`curriculum_units` (curriculum.py:48), `learning_outcomes` (curriculum.py:75),
plus the 8 `teaching_*` block tables that inherit tenancy transitively through
`version_id → teaching_section_versions.school_id`:
`teaching_section_outcomes`, `teaching_notes`, `teaching_examples`,
`teaching_misconceptions`, `teaching_formulas`, `teaching_exam_tips`,
`teaching_key_terms`, `teaching_media`.

The first four are legitimately platform-global. `curriculum_units` /
`learning_outcomes` inherit scope from `curriculum_frameworks.school_id`, and the
`teaching_*` blocks from their version — both are *derived* tenancy, which means
**every query on those tables must join upward or it is unscoped**.

## Nullable-school_id tables (platform + tenant rows share a table) — 11

`users` (user.py:25), `audit_logs` (compliance.py:41),
`curriculum_frameworks` (curriculum.py:21), `subject_offerings` (curriculum.py:102),
`designer_templates` (designer_template.py:17 — nullable AND **no ForeignKey**),
`document_chunks` (document_chunk.py:19), `processed_webhook_events` (webhook.py:20),
`teaching_sections` (teaching_content.py:47),
`teaching_section_versions` (teaching_content.py:147),
`teaching_content_snapshots` (teaching_content.py:640),
`teaching_content_reviews` (teaching_content.py:667).

`users.school_id` being nullable is the one with a security consequence — see
A1a §1.4 and A1c.

## JSONB / ARRAY columns that should be normalized

| table.column | path:line | already-normalized replacement | verdict |
|---|---|---|---|
| `subjects.class_ids` ARRAY | academic.py:118 | `class_subjects` (money.py:23) | dual-write risk; ARRAY still read |
| `subjects.teacher_ids` ARRAY | academic.py:119 | `section_subject_teachers` (money.py:50) | same |
| `fee_structures.fee_items` JSONB | fee.py:35 | `fee_structure_items` (money.py:74) | same — two sources of fee truth |
| `streams.class_ids` ARRAY | academic.py:63 | none | needs a junction |
| `exams.class_ids` + `subject_ids` ARRAY | exam.py:45-46 | none | multi-class exams unqueryable by FK |
| `notices.target_class_ids` ARRAY | notice.py:32 | none | no FK integrity on targeting |
| `incidents.involved_student_ids` ARRAY | incident.py:43 | none | no FK; blocks "incidents for student X" |
| `emergency_headcounts.missing_student_ids` ARRAY | emergency.py:72 | none | same |
| `drill_participations.missing_student_ids` ARRAY | disaster_management.py:68 | none | same |
| `bus_stops.student_ids` ARRAY | transport.py:63 | none | duplicates `students.bus_stop_id` (student.py:88) — **two directions of the same link** |
| `online_exams.questions` JSONB | exam.py:179 | `question_bank_items` (question_bank.py:17) | question bank bypassed |
| `quizzes.questions` JSONB | lms.py:138 | same | same |
| `generated_papers.questions` JSONB | question_bank.py:120 | intentional snapshot | acceptable (immutable paper) |
| `enrollments.completed_lessons` JSONB | lms.py:168 | `student_progress` (lms.py:116) | two progress stores |
| `schools.*` 10× JSONB config bags | school.py:111-119 | none | settings/fee/exam/ai/notification/social_ai/gamification/admission/website config |
| `users.permissions` JSONB | user.py:77 | none — also holds `totp_secret` (user.py:98-102) | secrets in a settings bag |
| `learning_paths.steps/…` 4× JSONB | adaptive_learning.py:49-52 | none | documented design |
| `wellbeing_surveys.target_class_ids` JSONB | wellbeing.py:39 | none | JSONB where ARRAY(UUID) or junction belongs |
## Notable constraints & indexes (the whole set)

Partial unique indexes (correctly excluding soft-deleted rows):
- `uq_fee_receipts_school_receipt_number` on (school_id, receipt_number) WHERE
  `is_deleted = false` (fee.py:120-125)
- `uq_marks_exam_student_subject` on (school_id, exam_id, student_id, subject_id)
  WHERE `is_deleted = false` (exam.py:97-102)
- `uq_school_chains_owner` on (school_id) WHERE not deleted (school_chain.py:43-48)
- `uq_school_chain_member_school` / `uq_school_chain_member_code`
  (school_chain.py:85-98)
- `uq_biometric_punch_device_punch` WHERE `device_punch_id IS NOT NULL`
  (biometric.py:92-97)

Plain unique constraints: `attendance` (school,student,date) attendance.py:12-15;
`teacher_attendance` (school,user,date) attendance.py:41-44; `chat_threads`
(school,a,b) chat.py:12-17; `school_plugins` (school,slug) plugin.py:83;
`school_receipt_counters` (school,fiscal_year_bs) school.py:249;
`mastery_records` (school,student,subject) adaptive_learning.py:105-107;
`class_subjects` money.py:42-45; `section_subject_teachers` money.py:64-67;
`fee_structure_items` money.py:97-100; `ai_tool_settings` ai_workbench.py:153;
`guardian_ai_consents` ai_workbench.py:257; `ai_tool_analytics_daily`
ai_workbench.py:293; `student_ai_profiles` ai_workbench.py:309;
`processed_webhook_events` webhook.py:23-25; curriculum 4× (curriculum.py:31,60,84,114);
teaching_content 10× (see A1f).

Column-level `unique=True`: `schools.slug` (school.py:29), `plugins.slug`
(plugin.py:28), `users` — **none**, `health_profiles.student_id`
(health_records.py:21), `fee_receipts.idempotency_key` (fee.py:109),
`assets.asset_code` (inventory.py:13 — **globally unique, not per-school**),
`revoked_tokens.jti` (revoked_token.py:23), `system_settings.key` (system.py:15),
`ai_nutrition_facts.tool_key` (ai_workbench.py:56),
`ai_tool_registry.tool_key` (ai_workbench.py:88),
`ai_teacher_service_keys.key_id` (ai_teacher.py:52).

CHECK constraints exist only in `ai_teacher.py` (5) and `teaching_content.py` (14)
— the two newest model files. Every other status/enum-ish `String` column is
validated in Python at the route edge only.

## Missing unique constraints (data-integrity gaps)

| table | should be unique on | why | path:line |
|---|---|---|---|
| `users` | (school_id, phone) and (school_id, email) | `phone` is NOT NULL and is a login identifier; duplicates make OTP login ambiguous | user.py:43-44 |
| `students` | (school_id, student_id), (school_id, admission_number) | both are printed identifiers used for student-login | student.py:50, :62 |
| `academic_years` | (school_id, name) + one `is_current` | two current years silently break rollover | academic.py:22, :28 |
| `classes` | (school_id, academic_year_id, name) | duplicate "Grade 10" rows | academic.py:80 |
| `sections` | (school_id, class_id, name) | duplicate "A" sections | academic.py:98 |
| `subjects` | (school_id, code) | mark import keys off code | academic.py:115 |
| `books` | (school_id, isbn) or (school_id, barcode) | scanner double-adds | library.py:25, :32 |
| `assets` | should be (school_id, asset_code), currently GLOBAL unique | one school's code blocks another's | inventory.py:13 |
| `alumni` | (school_id, student_id) | repeat graduation rows | alumni.py:12 |
| `student_portfolios` | (school_id, student_id) | portfolio is 1:1 in the UI | portfolio.py:12 |
| `fee_structures` | (school_id, class_id, academic_year) | two structures for one class-year | fee.py:33-34 |
| `timetables` | (school_id, class_id, section_id, academic_year) | duplicate grids | timetable.py:19-21 |
| `timetable_slots` | (school_id, class_id, section_id, day_of_week, period_number) | double-booked period | timetable.py:75-80 |
| `hostel_allocations` | (school_id, student_id) WHERE status='active' | a student in two rooms | hostel.py:56-61 |
| `enrollments` | (school_id, course_id, student_id) | duplicate enrolments | lms.py:163-166 |
| `student_progress` | (school_id, student_id, course_id, lesson_id) | progress rows multiply | lms.py:116-122 |
| `school_sliders` | (school_id, sort_order) — soft | not integrity-critical | slider.py:14 |
| `faqs` | (school_id, question) | import duplicates | faq.py:13 |
