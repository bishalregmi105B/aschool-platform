# ASchool Master Audit — Part 2: Plugin Audits (Tier 1 + Tier 2)

---

## TIER 1 — CORE (Free, 5 Plugins)

---

### PLUGIN #1: Attendance Management | Tier: Core | Price: Free

**OVERALL STATUS: ⚠️ PARTIAL** | **SCORE: 72/100** | **Standard: Meets (basic)**

**WEB FRONTEND**
- ✅ Dashboard page: `/dashboard/attendance`
- ✅ Mark attendance (class-based)
- ✅ Student attendance history `/attendance/student/<id>`
- ✅ School overview `/attendance/school-overview`
- ❌ Missing: Bulk attendance import page
- ❌ Missing: Attendance analytics/charts page
- ⚠️ No skeleton loaders confirmed

**BACKEND API** — [attendance.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/attendance.py) (559 lines, 14 routes)
- ✅ POST `/mark` — Mark attendance (batch per class)
- ✅ POST `/submit` — Finalize attendance
- ✅ GET `/students/<class_id>` — Get students for marking
- ✅ GET `/student/<id>` — Individual history
- ✅ GET `/student/<id>/summary` — Summary stats
- ✅ GET `/list` — List with filters
- ✅ GET `/summary` — Aggregate summary
- ✅ GET `/school-overview` — Full school view
- ✅ POST/GET `/teachers/mark`, `/teachers/list` — Teacher attendance
- ✅ CRUD `/leave-requests` — Leave management with approve/reject
- ❌ Missing: Bulk attendance export (CSV/PDF)
- ❌ Missing: Geofenced/GPS attendance validation

**DATABASE** — [attendance.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/attendance.py) (62 lines)
- ✅ `Attendance` model with school_id, student_id, class_id, section_id, date, status
- ✅ `TeacherAttendance` model
- ✅ `LeaveRequest` model with approval workflow
- ⚠️ No unique constraint on (student_id, date) — allows duplicate entries

**BACKGROUND WORKERS**
- ✅ `attendance_alerts_daily` — Celery beat at 16:30
- ✅ [attendance_alerts.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/tasks/attendance_alerts.py) — Sends SMS/push for absent students

**MOBILE APP**
- ✅ Teacher: `attendance_screen.dart` — Mark attendance
- ✅ Parent: `child_attendance.dart` — View child attendance
- ✅ Admin: `attendance_overview.dart` + `holiday_list_screen.dart`
- ❌ Student app: No attendance view screen
- ❌ No offline attendance marking

**INTEGRATIONS**
- ✅ Attendance → SMS (via attendance_alerts task)
- ❌ Attendance → Fee Collection (absent-day deduction) — NOT WIRED
- ❌ Attendance → WhatsApp — NOT WIRED
- ❌ Attendance → Analytics — NO EVENT EMISSION
- ❌ Biometric → Attendance — NOT IMPLEMENTED

---

### PLUGIN #2: Notices & Circulars | Tier: Core | Price: Free

**OVERALL STATUS: ✅ PASS** | **SCORE: 78/100** | **Standard: Meets**

**WEB FRONTEND**
- ✅ `/dashboard/notices` — List + create/edit/delete
- ✅ Rich text editor for notice body
- ✅ File attachment support
- ⚠️ No print-friendly view for circulars

**BACKEND API** — [notices.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/notices.py) (294 lines, 33 route refs)
- ✅ CRUD endpoints (list, create, update, delete)
- ✅ Audience targeting (class/section/role)
- ✅ Event management (Notice + Event models)
- ❌ Missing: Bulk delete, acknowledgment tracking

**DATABASE** — [notice.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/notice.py) (60 lines)
- ✅ `Notice` + `Event` models with school_id
- ❌ No `read_receipts` or acknowledgment table

**MOBILE APP**
- ✅ Teacher: `teacher_notices_screen.dart`
- ✅ Parent: `parent_notices_screen.dart`
- ✅ Student: `student_notices.dart`
- ✅ Admin: `notices_screen.dart`
- ✅ Push notification on new notice

---

### PLUGIN #3: Academic Setup | Tier: Core | Price: Free

**OVERALL STATUS: ✅ PASS** | **SCORE: 80/100** | **Standard: Meets**

**WEB FRONTEND**
- ✅ `/dashboard/academics` — Classes, sections, subjects, streams, mediums, shifts
- ✅ Academic year management
- ✅ Semester management

**BACKEND API** — [academics.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/academics.py) (914 lines, 113 route refs)
- ✅ Full CRUD for: AcademicYear, Semester, Medium, Stream, Shift, Class, Section, Subject
- ✅ Class-subject mapping
- ✅ Promote students endpoint
- ✅ Academic rollover

**DATABASE** — [academic.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/academic.py) (127 lines)
- ✅ 8 models: AcademicYear, Semester, Medium, Stream, Shift, Class, Section, Subject

**BACKGROUND WORKERS**
- ✅ `academic_rollover_daily` — Daily at 00:05

**MOBILE APP**
- ✅ Admin: `class_sections_screen.dart`, `class_subjects_screen.dart`
- ✅ Teacher: `class_section_screen.dart`

---

### PLUGIN #4: School Website (Basic) | Tier: Core | Price: Free

**OVERALL STATUS: ⚠️ PARTIAL** | **SCORE: 65/100** | **Standard: Below**

**WEB FRONTEND**
- ✅ `/school/[slug]` — Public school website
- ✅ `/dashboard/settings/website-design` — Theme customization
- ⚠️ Basic template only, no page editor in basic tier

**BACKEND API** — [website.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/website.py) (261 lines, 32 route refs)
- ✅ Public website content API
- ✅ Custom domain resolution
- ✅ Theme/branding settings
- ❌ No SEO meta fields for basic website

**DATABASE** — [website.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/website.py) (67 lines)
- ✅ `WebsitePage`, `WebsiteTheme`, `WebsiteForm`, `WebsiteFormSubmission`

**BACKGROUND WORKERS**
- ✅ `website_sync` + `website_live_sync` — Real-time content sync
- ✅ `sitemap_rebuild` — Nightly at 02:00

---

### PLUGIN #5: Basic Reports | Tier: Core | Price: Free

**OVERALL STATUS: ⚠️ PARTIAL** | **SCORE: 60/100** | **Standard: Below**

**WEB FRONTEND**
- ✅ `/dashboard/reports` — Report hub
- ✅ `/dashboard/reports/exam` — Exam reports
- ✅ `/dashboard/reports/expense` — Expense reports
- ✅ `/dashboard/reports/teacher` — Teacher reports
- ❌ Missing: Attendance report, fee collection report, student demographics

**BACKEND API** — [reports.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/reports.py) (239 lines)
- ✅ Report generation endpoints
- ❌ No CSV/Excel export for basic reports
- ❌ No scheduled report delivery

**BACKGROUND WORKERS**
- ✅ [report_generation.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/tasks/report_generation.py) — 12,508 lines, comprehensive PDF generation

---

## TIER 2 — STARTER (10 Plugins)

---

### PLUGIN #6: Fee Collection | Tier: Starter

**OVERALL STATUS: ✅ PASS** | **SCORE: 75/100** | **Standard: Meets**

**WEB FRONTEND** — 5 pages
- ✅ `/dashboard/fees` — Dashboard
- ✅ `/dashboard/fees/structure` — Fee structure setup
- ✅ `/dashboard/fees/types` — Fee types
- ✅ `/dashboard/fees/collect` — Collection page
- ✅ `/dashboard/fees/defaulters` — Defaulter list
- ✅ `/dashboard/fees/reports` — Fee reports
- ❌ Missing: Online payment status tracking page

**BACKEND API** — [fees.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/fees.py) (1718 lines, 114 route refs) — **LARGEST API FILE**
- ✅ FeeStructure CRUD
- ✅ FeeCollection create/update
- ✅ Payment recording (cash, eSewa, Khalti)
- ✅ Receipt generation
- ✅ Defaulter listing with filters
- ✅ Fee summary/analytics
- ⚠️ No idempotency key on payment creation
- ❌ Missing: Refund API endpoint
- ❌ Missing: Fee waiver/scholarship endpoint

**DATABASE** — [fee.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/fee.py) (89 lines)
- ✅ `FeeStructure`, `FeeCollection`, `FeeReceipt`
- ❌ No `FeeWaiver` or `Scholarship` model
- ❌ No `payment_gateway_ref` column for reconciliation

**BACKGROUND WORKERS**
- ✅ `dispatch_fee_reminders` — Daily at 08:00

**MOBILE APP**
- ✅ Parent: `fee_payment_screen.dart` — View + pay fees
- ✅ Admin: `fees_management.dart`
- ❌ Student: No fee view

**INTEGRATIONS**
- ✅ Fee → SMS (fee reminders via task)
- ❌ Fee → WhatsApp (NOT WIRED)
- ❌ Fee → HR Payroll (income feed NOT WIRED)

---

### PLUGIN #7: Exams & Results | Tier: Starter

**OVERALL STATUS: ✅ PASS** | **SCORE: 76/100** | **Standard: Meets**

**WEB FRONTEND** — 7 pages
- ✅ `/dashboard/exams` — Exam list
- ✅ `/dashboard/exams/schedule` — Exam scheduling
- ✅ `/dashboard/exams/marks` — Marks entry
- ✅ `/dashboard/exams/grades` — Grade setup
- ✅ `/dashboard/exams/results` — Results view
- ✅ `/dashboard/exams/report-cards` — Report card generation
- ✅ `/dashboard/exams/online` + `/online/questions` — Online exam builder

**BACKEND API** — [exams.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/exams.py) (1690 lines, 119 route refs)
- ✅ Exam CRUD, marks entry, result calculation
- ✅ Online exam with MCQ/written questions
- ✅ Report card PDF generation
- ✅ Nepal grading system (GPA calculation)
- ✅ Bulk marks entry

**DATABASE** — [exam.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/exam.py) (188 lines)
- ✅ `Exam`, `Marks`, `ReportCard`, `OnlineExam`, `OnlineExamAttempt`

**MOBILE APP**
- ✅ Teacher: `offline_exam_screen.dart`, `online_exam_screen.dart`, `report_cards_screen.dart`, `marks_entry_screen.dart`
- ✅ Parent: `results_screen.dart`, `parent_marksheet_screen.dart`
- ✅ Student: `student_exams_screen.dart`, `student_results.dart`, `student_marksheet_screen.dart`
- ✅ Admin: `exams_screen.dart`, `exam_results_screen.dart`

---

### PLUGIN #8: Library Management | Tier: Starter

**OVERALL STATUS: ⚠️ PARTIAL** | **SCORE: 62/100** | **Standard: Below**

**WEB FRONTEND** — 4 pages
- ✅ `/dashboard/library` — Dashboard
- ✅ `/dashboard/library/books` — Book catalog
- ✅ `/dashboard/library/checkout` — Issue/return
- ✅ `/dashboard/library/transactions` — Transaction history
- ❌ Missing: Book categories management, barcode scanner page

**BACKEND API** — [library.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/library.py) (176 lines)
- ✅ Book CRUD, issue/return
- ❌ Missing: Book reservation, fine calculation, bulk import

**BACKGROUND WORKERS**
- ✅ `library_overdue_check` — Daily at 07:30

**MOBILE APP**
- ✅ Student: `student_library.dart`
- ✅ Admin: `library_screen.dart`
- ❌ Teacher: No library screen
- ❌ No QR/barcode scanning

---

### PLUGIN #9: SMS Notifications | Tier: Starter

**OVERALL STATUS: ⚠️ PARTIAL** | **SCORE: 65/100** | **Standard: Below**

**WEB FRONTEND**
- ✅ `/dashboard/sms` — SMS dashboard with send/history
- ✅ `/dashboard/communications/templates` — Message templates

**BACKEND API** — [sms.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/sms.py) + [communications.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/communications.py) (571 lines combined)
- ✅ Send SMS (single + bulk)
- ✅ SMS log/history
- ✅ Template management
- ✅ Credit check
- ❌ Missing: Opt-out/unsubscribe management
- ❌ Missing: Delivery report webhook

**MOBILE APP**
- ✅ Admin: `announcements_screen.dart`
- ❌ No SMS management in teacher/parent apps

---

### PLUGIN #10: WhatsApp Bot | Tier: Starter

**OVERALL STATUS: ⚠️ PARTIAL** | **SCORE: 58/100** | **Standard: Below**

**WEB FRONTEND**
- ✅ `/dashboard/communications/whatsapp` — WhatsApp config + message log

**BACKEND API** — [whatsapp_bot.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/whatsapp_bot.py) (130 lines)
- ✅ Webhook verification
- ✅ Message sending
- ✅ Template management
- ❌ Missing: Auto-reply bot logic (only sends, doesn't process inbound intelligently)
- ❌ Missing: Interactive message buttons

**DATABASE** — [notification.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/notification.py) (97 lines)
- ✅ `WhatsAppMessage`, `WhatsAppBotConfig`

---

### PLUGIN #11: Assignments & Homework | Tier: Starter

**OVERALL STATUS: ⚠️ PARTIAL** | **SCORE: 68/100** | **Standard: Below**

**WEB FRONTEND**
- ✅ `/dashboard/assignments` — Create/view assignments

**BACKEND API** — [assignments.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/assignments.py) (280 lines, 35 route refs)
- ✅ Assignment CRUD
- ✅ Submission upload
- ✅ Teacher grading
- ❌ Missing: Peer review, late submission policies, plagiarism check integration

**DATABASE** — [assignment.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/assignment.py) (66 lines)
- ✅ `Assignment`, `AssignmentSubmission`

**MOBILE APP**
- ✅ Teacher: `assignments_screen.dart`
- ✅ Parent: `homework_screen.dart`
- ✅ Student: `homework_screen.dart`
- ✅ Admin: `assignments_screen.dart`

**INTEGRATIONS**
- ❌ Assignments → AI Auto-Grading: NOT WIRED
- ❌ Assignments → E-Library: NOT WIRED
- ❌ Assignments → Gamification: NOT WIRED

---

### PLUGIN #12: E-Library & Digital Content | Tier: Starter

**OVERALL STATUS: ⚠️ PARTIAL** | **SCORE: 55/100** | **Standard: Below**

**WEB FRONTEND**
- ✅ `/dashboard/elibrary` — Digital content browser

**BACKEND API** — [elibrary.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/elibrary.py) (113 lines)
- ✅ Digital book listing
- ✅ Past papers
- ✅ OER resources
- ❌ Missing: Content upload, categorization, search within content

**DATABASE** — [digital_content.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/digital_content.py) (63 lines)
- ✅ `DigitalBook`, `PastPaper`, `OERResource`

**MOBILE APP**
- ✅ Student: `elibrary_screen.dart`
- ❌ Teacher/Parent/Admin: No e-library screens

---

### PLUGIN #13: PT Conference Scheduler | Tier: Starter

**OVERALL STATUS: ⚠️ PARTIAL** | **SCORE: 63/100** | **Standard: Below**

**WEB FRONTEND**
- ✅ `/dashboard/conferences` — Conference management

**BACKEND API** — [conferences.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/conferences.py) (219 lines, 22 route refs)
- ✅ Conference CRUD
- ✅ Slot management
- ✅ Booking/cancellation
- ✅ Conference notes
- ❌ Missing: Video call integration (Zoom/Google Meet)

**DATABASE** — [conference.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/conference.py)
- ✅ `PTConference`, `ConferenceSlot`, `ConferenceNotes`

**MOBILE APP**
- ✅ Parent: `pt_conference_screen.dart`
- ❌ Teacher/Admin: No conference screens

---

### PLUGIN #14: Student Dismissal/Pickup | Tier: Starter

**OVERALL STATUS: ⚠️ PARTIAL** | **SCORE: 64/100** | **Standard: Below**

**WEB FRONTEND**
- ✅ `/dashboard/dismissal` — Dismissal management

**BACKEND API** — [dismissal.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/dismissal.py) (181 lines)
- ✅ Authorized pickup person management
- ✅ Dismissal record creation
- ✅ QR-based verification
- ❌ Missing: Parent notification on pickup, photo verification

**DATABASE** — [dismissal.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/dismissal.py)
- ✅ `AuthorizedPickup`, `DismissalRecord`

**MOBILE APP**
- ✅ Parent: `dismissal_qr_screen.dart` — QR code display
- ❌ Admin: No dismissal screen
- ❌ No guard/gate app for scanning

---

### PLUGIN #15: Incident Reporting | Tier: Starter

**OVERALL STATUS: ⚠️ PARTIAL** | **SCORE: 62/100** | **Standard: Below**

**WEB FRONTEND**
- ✅ `/dashboard/incidents` — Incident list + management

**BACKEND API** — [incidents.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/incidents.py) (192 lines)
- ✅ Incident CRUD
- ✅ Witness statements
- ✅ Action tracking
- ❌ Missing: Severity escalation workflow, parent notification, attachment support

**DATABASE** — [incident.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/incident.py) (81 lines)
- ✅ `Incident`, `WitnessStatement`, `IncidentAction`

**MOBILE APP**
- ✅ Admin: `incident_screen.dart`
- ❌ Teacher/Parent: No incident screens

---

> **Continue to Part 3** for Tier 3 (Growth) + Tier 4 (Premium) plugin audits.
