# ASchool Backend Feature-Completeness Audit

Date: 2026-09-04 · Scope: `backend/app/api/v1/**`, `backend/app/plugins/modules/**` (7 real-code modules), `backend/app/services/**`, `backend/app/models/**`, `backend/app/tasks/**`. Companion to `ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md` (architecture/duplication — NOT repeated here). Read-only audit.

Method: every blueprint's routes mapped (`@*_bp.route`), spot-read of the load-bearing handlers, stub-marker grep (`TODO|FIXME|NotImplementedError|coming soon|501` — the codebase is nearly clean of these), service/task wiring checks, and a consumer cross-check (`grep` of `frontend/app|components|lib` + the 5 `flutter_*/lib` trees for each URL fragment).

**Headline: 680 routes / ~1,300 methods across 68 blueprints; 577 routes plugin-gated. The backend is far more complete than the UI — roughly 90–95% of buyer-expected features have real, tenant-scoped implementations with 507 tests. The gaps are concentrated in: subject-wise attendance, academic transcripts, custom grading scales, payroll Nepali tax rules, non-Khalti refunds, AI timetable quality, and a set of orphan endpoints with zero UI.**

Status legend: **IMPL** = endpoint + real logic · **PARTIAL** = endpoint exists, logic incomplete/naive · **MISSING** = no endpoint · **STUB** = returns fake/empty · **NO-UI** = implemented, zero web+flutter consumers found.

---

## 1. Core domains

### 1.1 Auth & users — 98% complete
| Feature | Status | Evidence |
|---|---|---|
| Login (admin/staff), student login, JWT refresh | IMPL | `app/api/v1/auth.py:1-872` (16 routes) |
| OTP send/verify (Sparrow SMS), forgot/reset password | IMPL | `auth.py` `/send-otp`,`/verify-otp`,`/forgot-password` |
| TOTP 2FA (setup/verify/disable/challenge), logout-all, token revocation | IMPL | `auth.py` `/totp/*`; `models/revoked_token.py`; `tests/test_token_revocation.py` |
| Push registration (FCM dedup max-5, OneSignal player ids) | IMPL | `auth.py:785-840` |
| User CRUD, toggle-active, reset-default-password, guardian unlink | IMPL | `app/api/v1/users.py:23-265` |
| RBAC (`role_required`), school scoping (`school_required`) | IMPL | `app/utils/decorators.py`; cross-tenant 403 at `app/__init__.py:427-446` |
| Gaps | — | Password policy/rotation not configurable per school (S) |

### 1.2 Students — 95% complete
| Feature | Status | Evidence |
|---|---|---|
| CRUD + rich filters (class/section/status/gender/grade/search) + pagination | IMPL | `app/api/v1/students.py:26-114` |
| Bulk delete, batch roll-numbers, bulk profile images, bulk password resets | IMPL | `students.py:248-545` |
| Promotion preview + commit | IMPL | `students.py:545-811` |
| Student transfers (issue/accept TC) | IMPL | `students.py:858-947`; `models/student_transfer.py` |
| Guardians read/add | IMPL | `students.py:947-959` |
| Student cap enforcement (plan entitlements) | IMPL | `students.py:26` import `student_cap_error`; `tests/test_provisioning_and_caps.py` |
| Gaps | — | Character/transfer-certificate PDF generation (design_studio covers bulk docs but no one-click TC doc); Guardian **edit/delete** endpoints missing (only POST/GET) (S) |

### 1.3 Academics (years/semesters/mediums/streams/shifts/classes/sections/subjects) — 95% complete
All 22 routes IMPL with soft-delete and tenant checks: `app/api/v1/academics.py:36-660`. NEB/SEE curriculum grids exist as models (`models/curriculum.py` SubjectOffering with THFM/THPM/PRFM) but **have no API routes** — curriculum data is seed/read-only internally (NO-UI + no-API: `curriculum_frameworks`, `subject_offerings` tables). Academic rollover task: `app/tasks/academic_rollover.py` (beat 00:05 daily).

### 1.4 Attendance — 85% complete
| Feature | Status | Evidence / gap |
|---|---|---|
| Daily mark/submit (upsert, enum-validated, teacher class-scoping) | IMPL | `app/api/v1/attendance.py:22-178` |
| Student/summary/list/school-overview reports | IMPL | `attendance.py:213-440` |
| Teacher attendance (mark/list) | IMPL | `attendance.py:440-533` |
| Student leave requests (list/create/approve/reject) | IMPL | `attendance.py:533-620` |
| Biometric punch → attendance row (device-key auth, idempotent replay guard, SAVEPOINTs) | IMPL | `app/plugins/modules/biometric/routes.py:192-215,582-660` |
| Daily absent-parent alert | **PARTIAL** | `app/tasks/attendance_alerts.py` emits `attendance.student_absent` (beat 16:30) but **grep finds no `@on("attendance.student_absent")` listener** — `app/plugins/listeners.py` registers 18 events, none for it. Alerts are logged, not delivered. Effort **S** (wire listener → WhatsApp/SMS/push like `fee.paid`). |
| Subject-wise / period-wise attendance | **MISSING** | `models/attendance.py` `Attendance` has no `subject_id`; no route. Effort **M**. |
| Leave → attendance integration | **PARTIAL** | Approve/reject only flips status (`attendance.py:586-620`); no Attendance rows written for the leave window; rejection reason explicitly not persisted (`attendance.py:612-614`). Effort **S–M**. |
| Leave types / quotas / half-day policies | **MISSING** | No leave-type master. Effort **S**. |

### 1.5 Fees — 90% complete (strongest domain)
| Feature | Status | Evidence / gap |
|---|---|---|
| Fee types CRUD, structures + apply + BS-cycle dedup (`_structure_cycle_key`) | IMPL | `app/api/v1/fees.py:146-253,632-947,2329-2464` |
| Batch monthly billing + auto monthly generation (BS-calendar, beat 00:45) | IMPL | `fees.py:742-793`; task `auto_generate_monthly_fees` |
| Scholarships/discounts CRUD (percent/fixed, validity window) | IMPL | `fees.py:794-907` (stacking covered by `tests/test_fees_discount_stacking.py`) |
| Collections CRUD, partial payments, late fines, status resolution | IMPL | `fees.py:1211-1497,2633-2697` |
| Receipts (numbered, hash, PDF via WeasyPrint), student statement PDF | IMPL | `fees.py:1498-1757`; honest 501 when WeasyPrint absent (`fees.py:1551,1600`) |
| Defaulters + SMS reminder (queued → Celery → Sparrow; per-log outcome) | IMPL | `fees.py:1117-1210`; `app/tasks/fee_reminders.py` (beat 08:00); `tasks/sms_sender.py` |
| Online payments: eSewa/Khalti/FonePay gateways + signed callbacks + QR upload | IMPL | `fees.py:1758-1896`; `app/api/webhooks/__init__.py:23-250` (`_finalize_fee_payment`, idempotent) |
| Refunds | **PARTIAL** | Khalti only (`fees.py:1897-1990` returns 422 for esewa/fonepay); refund amount = full payable (no partial refunds). Effort **M**. |
| Payment-method config with credential masking | IMPL | `fees.py:253-386,2039-2120` |
| Collections CSV export, summary, outstanding, recent | IMPL | `fees.py:387-631,1019-1116` |
| Bank/cash reconciliation, day-close report | **MISSING** | No reconciliation endpoint. Effort **M**. |
| Fee ledger/accounting export (journal) | **MISSING** | CSV only. Effort **M**. |

### 1.6 Exams — 88% complete
| Feature | Status | Evidence / gap |
|---|---|---|
| Exam CRUD, publish, results (per exam + aggregate) | IMPL | `app/api/v1/exams.py:217-563,882-1027` |
| Marks entry (bulk, single-transaction pre-validation, teacher subject/class scoping) | IMPL | `exams.py:638-844` |
| Nepal NEB/SEE grading (GRADE_TABLE, GPA credit-weighted), competition ranks (1,1,3) | IMPL | `exams.py:133-141,990-1020`; `app/utils/nepal_grading.py`; `tests/test_nepal_grading.py`, `test_marks_validation_and_ranks.py` |
| Marksheets (JSON/HTML), grade-sheet, report cards (single + bulk PDF), designer marksheet | IMPL | `exams.py:1028-1598` (bulk PDF via `designer/bulk_generator.py`) |
| Online exams (create/submit/attempt), question bank | IMPL | `exams.py:258-456`; `models/question_bank.py` |
| Exam scheduling | **PARTIAL** | Exam has start/end dates only; no per-subject schedule/seat plan/invigilation duty. Effort **M**. |
| Admit cards | IMPL | `design_studio.py /bulk/admit-cards` |
| Custom per-school grading scale | **MISSING** | `GRADE_TABLE` is a module constant (`nepal_grading.py`); `/grade-table` is read-only (`exams.py:205-216`). Effort **M**. |
| Multi-term transcript / TC marks integration | **MISSING** | No transcript endpoint (grep: only AI-audio "transcript" hits). Effort **L**. |
| Re-evaluation/recheck workflow | **MISSING** | Effort **M**. |

### 1.7 Timetable — 75% complete
Slots CRUD + scoped-save + teacher view IMPL (`app/api/v1/timetable.py:20-254`). **The "AI solver" is a naive greedy stub**: `app/services/ai/timetable_solver.py:44-88` assigns subjects round-robin (`subject_queue = list(subjects) * 2`), ignores teacher→subject qualification (`teacher_map` built at line 40 but never consulted when choosing `assigned_teacher`), no max-periods-per-subject/week, and returns `"conflicts": []  # Would contain detected clashes` (line 88, placeholder). Effort **L** to make production-grade. Room/lab constraints: no room model at all (MISSING).

### 1.8 HR & Payroll — 88% complete
| Feature | Status | Evidence / gap |
|---|---|---|
| Staff stats, payroll CRUD, monthly generate (settings-driven, allowances/deductions JSONB), approve, pay, bulk-action, payslip HTML/PDF | IMPL | `app/api/v1/hr_payroll.py:25-632`; `tasks/payroll_monthly.py` (beat 1st 00:10); `tests/test_hr_payroll_math.py` |
| Staff leave (create/approve/patch/report) | IMPL | `hr_payroll.py:633-895` |
| Appraisals CRUD (E185 tenant guards) | IMPL | `hr_payroll.py:901-1000` |
| Expense categories + expenses CRUD | IMPL | `hr_payroll.py:1004-1434` |
| Tax | **PARTIAL** | Flat `taxRate` % of basic (`hr_payroll.py:226,287-288`); no Nepal TDS slabs, SSF/PF employer split, or annual tax certificate. Effort **M**. |
| Staff documents/contracts, attendance linkage | **MISSING** | Effort **M**. |
| Staff onboard/offboard workflow | **MISSING** | Effort **S**. |

### 1.9 Communications — 92% complete
| Feature | Status | Evidence |
|---|---|---|
| Notices + events CRUD (BS-date validated), audience targeting | IMPL | `app/api/v1/notices.py` |
| Diary categories + entries | IMPL | `app/api/v1/communications.py:586-700` |
| SMS send/history/templates/stats (Sparrow; per-message outcome task; no fake "sent") | IMPL | `app/api/v1/sms.py`; `tasks/sms_sender.py:9-46` |
| Broadcast SMS/push/email/WhatsApp with honest per-channel outcomes, audience resolver (guardian-linked parents, defaulters-only) | IMPL | `communications.py:234-560` (E122/B-03 fixed) |
| In-app notifications inbox, unread-count, mark-read | IMPL | `app/api/v1/notifications.py` |
| Push: OneSignal primary + FCM legacy fallback task | IMPL | `services/communications/onesignal_service.py`; `tasks/push_notifications.py` |
| WhatsApp Cloud send + inbound webhook (verify/signature, auto-reply match, school resolve by phone id) | IMPL | `services/communications/whatsapp_cloud.py`; `app/api/webhooks/__init__.py:252-483` |
| Chat (threads/messages) | IMPL | `services/chat_service.py`; `communications.py:35-129`; parent threads in `parent_app.py:712-760` |
| Email templates builder | **MISSING** | Plain SMTP only. Effort **S**. |
| Two-way parent-teacher chat policy (thread gating by class teacher) | PARTIAL | Thread creation is `/send`-driven; no thread-level ACL model. Effort **S**. |

### 1.10 Transport & GPS — 85% complete
Routes/stops/buses CRUD IMPL (`app/api/v1/transport.py:21-250`). GPS ingest validated (`transport.py:264-310`), plus Firebase RTDB poller every 15 s → persist → Socket.IO room broadcast + geofence/route-deviation task (`tasks/gps_firebase_poller.py`, `tasks/gps_processing.py`; `tests/test_gps_pipeline.py`). Parent bus-location in `parent_app.py` (`/bus-info`, `/bus-location/<bus_id>`). **Transport fee integration is MISSING** — stop assignment exists on the stop (`student_ids`), but no transport-fee billing linkage to the fees domain (Nepal buyers bill bus fees monthly). Effort **M**. Driver/conductor are just user links on Bus; driver app/manifest workflow MISSING (S). Live ETA prediction MISSING (S).

### 1.11 Admission — 95% complete
Inquiries/applications CRUD, status flow, public admission-inquiry from website, dashboard funnel, follow-up task (`tasks/admission_followup.py`, beat 09:00; `admission.accepted`/`admission.enrolled` listeners convert to students — `listeners.py:569-776`). Gaps: entrance-exam scheduling for applicants (MISSING, S); online admission form-fee payment not linked to fees (S).

### 1.12 Library — 95% complete
Books CRUD, issues/return, teacher view, settings, overdue task (beat 07:30, `tasks/library_overdue.py`), student app browsing + request (`student_app.py /library`,`/library/request`).

### 1.13 LMS — 90% complete
Courses/lessons/topics/materials/quizzes+attempts/enroll/progress (`app/api/v1/lms.py`, 17 routes) + adaptive-learning routes (§2) + video service (`services/lms/video_service.py`). Certificate generation per course completion MISSING (S); SCORM/xAPI MISSING (acceptable).

### 1.14 Assignments — 95% complete
CRUD, submissions, grading, parent view (`tests/test_parent_assignments.py`), AI auto-grade (`assignments.py:323` AutoGraderService; web+flutter consumers found).

### 1.15 Website (public + builder + white-label) — 92% complete
Public site: 15 routes incl. contact/admission-inquiry with rate limiting (5/h) and tenant-by-slug (`app/api/v1/website.py`). Builder: 27 routes (pages/sections/draft publish+revert+history restore/themes/AI design+copy/SEO/publish) IMPL (`website_builder.py`). White-label: domain verify + branding + theme (`modules/white_label/routes.py`, 175 LOC; custom-domain DNS verify exists). Theme engine + nightly sitemap + website sync tasks. **Duplicate custom-domain feature** in both website_builder (`/domain`) and white_label (`/domain`) — see plugin audit Cluster C.

### 1.16 Analytics & reports — 85% complete
`/analytics/overview|academic|financial|benchmarking|teacher-dashboard|superadmin-dashboard` (`app/api/v1/analytics.py`, **ungated** — duplication-audit §4.8) + `reports.py` 7 gated summary/PDF routes + daily aggregate task. Gaps: no custom report builder, no district/provincial EMIS cross-analysis beyond compliance (M).

### 1.17 Files & design studio — 95% complete
Folders/upload/presigned/usage/stock-search/stock-import (`files.py`, 12 routes); design studio: data-sources, templates, render, bulk id-cards/marksheets/admit-cards/certificates/attendance-ledger, writer (research/DOCX), revisions+restore (34 routes). Bulk DOCX/PDF fallback 501s are honest env-gating.

### 1.18 Hostel — 90% complete
Hostels/rooms/allocations/checkout/summary (`hostel.py`, 9 routes; tenant-isolation test exists). Room maintenance requests, mess management MISSING (S–M each).

### 1.19 Inventory — 85% complete
Assets CRUD + QR scan lookup, procurement + approve, audits (`inventory.py`, 11 routes). **UI consumes none of it** (see §4). Stock movement ledger between locations, vendors/suppliers MISSING (M).

### 1.20 Safety cluster (emergency/incidents/visitor/dismissal) — 90% complete
- Emergency: alerts+resolve, plans, headcounts (`emergency.py` 9 routes) — headcount has **flutter-only consumer**.
- Incidents: base CRUD/statements/actions (`incidents.py`) + full workflow module (§2).
- Visitor: checkin/checkout/appointments (appointments endpoint has **zero UI**).
- Dismissal: authorized-pickup CRUD, records, QR verify (`dismissal.py`; parent app consumes status).

### 1.21 Other gated modules — 90%+ each
Wellbeing (mood/surveys/counselor), health records (profiles/visits/immunizations), gamification (badges/points/leaderboard/houses/rewards + streak task), alumni (events/donations; donations flutter-only), compliance (EMIS generate/download, audit-logs flutter-only), conferences (slots/book/notes; coming_soon flag), elibrary, portfolio, IEMIS importer (template/validate/import/history; 9 web hits), db backup API, search, sliders/faqs/themes, super-admin overview.

---

## 2. The 7 real plugin modules (4,374 LOC)

| Module | Routes | Verdict |
|---|---|---|
| **biometric** | 18: devices CRUD/regenerate-key/sync, punches, logs, sync-logs, overview + device-facing `/ingest`,`/heartbeat` (X-Device-Key) | **Real and strong.** Idempotent batch ingest with replay guards, SAVEPOINT concurrency handling, atomic validation, punch→Attendance upsert (`routes.py:192-215,582-660`). Tests: `test_biometric.py`. Gaps: no device firmware/SDK, no offline-window dedupe window config (S). |
| **incident_management** | 10: overview/active/escalations/assign/status/escalate/resolve/conference/audit/reports | **Real.** Workflow state machine over shared `incidents` table + 2 own tables; SLA/escalation logic present; `incident.created` listener (`listeners.py:777-841`). Tests: `test_incident_management_api.py`. Pricing inverted vs base `incidents` (see plugin audit §4.5). |
| **disaster_management** | 7: drills CRUD, participation, `/disaster/overview`, `/seismic-alerts` | **Real.** Readiness score from real drill/plan history; reuses EvacuationPlan/EmergencyAlert. Seismic alerting = manual alert rows, **no live seismic API feed** (manifest once claimed `earthquake_api` — fiction, per plugin audit §4.4). Tests: `test_disaster_management_api.py`. |
| **multi_branch** | 7: chain overview/dashboard/analytics, branches CRUD (create-or-link real tenant Schools) | **Real.** Cross-branch SQL aggregates scoped to owned chain members (`routes.py:100-160`); honest composite score. Tests: `test_multi_branch.py`. Gaps: no consolidated billing or inter-branch student transfer (M). |
| **ai_adaptive_learning** | 7 under `/lms/*`: learning-paths (+generate-ai), mastery CRUD/assess, adaptive-progress | **Real + honest AI.** LLM path via AITokenHub (quota→429), deterministic rule-based fallback labelled `source="rule_based_fallback"` (`routes.py:1-30`); mastery from real Marks. Gaps: hardcoded thresholds 80/60 (`routes.py:54-55`); **16 legacy gates remain `ai_adaptive_learning` not `ai_suite`** (plugin audit P0-1) — split-brain risk. Tests: `test_adaptive_learning_api.py`. |
| **white_label** | 8: overview, domain GET/POST/verify, branding GET/PUT, theme GET/PUT | Real; thin but complete for its scope. Only 1 test file hit. |
| **social_ads** (deprecated) | 9 | Honest zero-metrics stubs (no Meta/TikTok ad service). Delete (plugin audit). |

AI layer overall: `ai_workbench` (14 routes, tool registry/nutrition/settings/generation library/IEP), `ai_tools` (16: question-paper v2, lesson-plan, timetable+save, remarks, homework-help, insights weekly/daily/risk, letter-writer, question-bank CRUD), `ai_tutor` (6, guardian consent + session monitor), `ai_capture` (voice/photo → draft, 501 on missing vision provider), `ai_usage` quota admin (role-guarded). All route through `AITokenHub` with honest 502s — no fabricated output found.

---

## 3. Dead tables / model-layer findings

- `models/curriculum.py` (`curriculum_frameworks`, `subject_offerings`) — NEB subject grids, **no API surface** (dead unless wired).
- `models/ai_workbench.py` includes GuardianAIConsent/TutorSessionPlan — consumed by `ai_tutor.py` ✓ (not dead).
- `document_chunks` — written only by `services/ai/extensions.seed_pd_framework` (called at boot, `app/__init__.py:569-571`) and read by RAGService inside extensions; **no user-facing knowledge-upload endpoint** → half-dead (documents can't be ingested by schools) (S to expose, M with embeddings admin).
- `plugin_usage_logs` — zero callers (plugin audit §4.11).
- API surface without models: none found — every blueprint backs real tables.
- Legacy 2-line re-export shims (`api/v1/{biometric,white_label,multi_branch,disaster_management,incident_management,adaptive_learning,social_ads}.py`) still mounted.

## 4. Endpoints with NO web UI (and usually no flutter) — quick wins

Ranked by likely buyer value; web=flutter consumer counts from grep (0/0 unless noted).

1. `GET/POST /attendance/leave-requests*` — student leave workflow, approve/reject built, **no page anywhere**.
2. `GET /attendance/school-overview` — flutter only.
3. `POST /assignments/<id>/ai-grade` surface used, but `/submissions/<sub>/grade` alias route unused (cosmetic).
4. `GET /exams/<id>/grade-sheet` — 1 web hit only (grade-sheet page exists; verify link from exam detail).
5. Visitor `POST /visitor/appointments*` (3 routes) — pre-booked visits, 0/0.
6. Inventory `POST/GET /procurement*` + `/assets/scan/<qr>` — procurement approvals + QR scan, 0/0 (assets list has web UI).
7. Compliance `GET /compliance/audit-logs` — flutter only.
8. Emergency `POST /alerts/<id>/headcount` — flutter only.
9. Alumni `GET/POST /donations` — flutter only.
10. AI: `POST /ai/iep`, `GET/PUT /ai/moderation/flags*` (workbench) — 0/0.
11. AI: `POST /ai/capture/photo|voice` + `/confirm` — voice page exists? 6 hits for "capture" but confirm flow unbound; QTI export `/ai/ext/qti/export` 0/0.
12. AI tools: `/insights/risk-alerts`, `/generated-papers/<id>` — 0/0 (daily-brief flutter-only).
13. Students `GET /students/transfers` management page — 1 web hit (transfer creation in profile; no admin transfer list page verified).
14. Fees `GET /receipts/<id>` alias + `/students/<id>/statement/pdf` — statement has 1 hit; receipts alias unused by web.
15. White-label `POST /white-label/domain/verify` — page exists; verify button wiring not found (4 hits for white-label overall).
16. HR `GET /payroll/<id>/payslip` PDF — payslip 1 hit only (flutter 0).
17. `GET /schools/current/notification-settings` — web settings page uses different key; verify.
18. Database backup `GET /database-backup` — 0 consumer found in web grep (status page may hardcode).
19. Multi-branch `GET /chain/dashboard` — 1 hit; `/chain/analytics` 0.
20. `GET /search` global search endpoint — web uses client-side search (69 incidental hits, no API call found).

(Note: grep-based; a dynamic API client could hide usage — spot-verify before dropping anything.)

## 5. Backend-incomplete — build list by Nepal sales impact

1. **Attendance absent-alert delivery** — event emitted, **no listener**: parents never notified. S. (`tasks/attendance_alerts.py:51`, `plugins/listeners.py`)
2. **Subject/period-wise attendance** — no model column/routes. M. (`models/attendance.py`)
3. **Multi-term transcript** — report cards per exam only; SEE/NEB buyers expect grade-XII transcripts. L.
4. **Timetable solver** — greedy, ignores teacher qualifications, `conflicts: []` placeholder. L. (`services/ai/timetable_solver.py:40-88`)
5. **Custom grading scales per school** — constant GRADE_TABLE. M. (`app/utils/nepal_grading.py`)
6. **Payroll Nepal tax** — flat taxRate; no TDS slabs/SSF/PF employer, no annual tax report. M. (`hr_payroll.py:226-288`)
7. **Non-Khalti refunds + partial refunds** — 422 for eSewa/FonePay. M. (`fees.py:1907-1909`)
8. **Transport fee billing linkage** — routes/stops exist, no fee item generation from stop enrollment. M.
9. **Leave→attendance write-through + leave types/quotas**; rejection reason dropped. S–M. (`attendance.py:586-620`)
10. **Bank reconciliation / day-close** for fees. M.
11. **Exam scheduling detail** (subject-wise schedule, seat plan, invigilation). M.
12. **AI suite gate split-brain** — 16+7 legacy-slug gates vs ai_suite (P0 in plugin audit; functional 403 risk). S.
13. **Curriculum (NEB grids) API** — tables seeded, no endpoints to manage/read. S.
14. **RAG document ingestion** — schools can't upload their own policy docs. S–M.
15. **Guardian edit/delete + staff documents** CRUD gaps. S.
16. **Hostel mess/maintenance**, **inventory vendors/stock-ledger** — secondary modules. M each.
17. **Re-evaluation/recheck exam workflow** — missing. M.
18. **Email template engine** — plain SMTP. S.
19. **Plan-grant bypass for coming_soon plugins** (plugin audit §4.12). S.
20. **Seismic feed integration** for disaster_management (currently manual alerts). S.

## 6. Security / tenancy notes (beyond plugin audit)

- Tenant scoping is consistently strong: every domain filters `school_id=g.school_id`, pre-validates FKs tenant-side (E17/E185 guards), and parents/students are Guardian/role-linked (e.g. `parent_app.py:57-63`; teacher class scoping `attendance.py:40-46`, `exams.py:677-700`). `test_tenant_isolation.py` covers it.
- Device-facing biometric endpoints skip JWT by design (X-Device-Key, per-device hash, key shown once) — acceptable, but no per-device rate limit seen (`biometric/routes.py:582`).
- `/attendance/school-overview`, `/analytics/*`, `/ai-usage/stats|logs` are role-guarded but **not plugin-gated** — decide core-vs-plugin (duplication audit §4.8).
- `benchmarking/rankings` cross-school loop remains a load/privacy smell (plugin audit §4.7).
- PDF/DOCX export endpoints return honest 501 when WeasyPrint/python-docx absent — **deployment must install these or all PDF features (receipts, marksheets, report cards, payslips) break**. `requirements.txt` includes weasyprint; verify on the production image.
- `sms_gateway.py` speaks plain `http://` to Sparrow (`sms_gateway.py:8,25`) — request confidentiality only.

## 7. Bottom line

Backend is ~92% feature-complete for a Nepal K-12 SaaS. Build list (top): alert-delivery wiring, subject attendance, transcripts, timetable solver, tax rules, eSewa/FonePay refunds, transport fees, grading-scale config, curriculum API. UI teams have ~20 ready-made endpoints to surface — leave-requests, visitor appointments, procurement/QR, headcount, donations, IEP/moderation, QTI, risk-alerts are all live and orphaned.
