# MASTER EXECUTION PLAN — 2026-09-12

> Supersedes the sequencing of `MASTER_PLAN_2026-09-10_FULL_PLATFORM_V2.md` Part 5 and
> `COMPETITOR_CROSS_AUDIT_PLAN_2026-09-11.md` §4 by merging them into ONE sprint list.
> Built on top of the **v2 implementation-level re-audits** (2026-09-12) now heading every
> report in `docs/competitor-audits/*.md` — the v1 feature-level audits remain below the v2
> sections as context.
>
> Status at plan time: S0 (defect sweep) **done**, S12 (AI foundation: G-01..G-12, content
> spine, loader, review gate) **done** on `feat/s12-ai-foundation`. S1–S11 not started.
> S13 (AI grounding + retrieval) not started.

---

## Part 1 — Per-project consolidation (v2 re-audits → work items)

Each section cites the v2 section of its report. New work items discovered by the v2 round
continue the A-scheme as **A-31..A-37**; v2 refinements to existing A-items are marked ↻.

### 1.1 InfixEdu v9.4.0 → `infixedu-v9.4.0.md` §"Deep re-audit (v2)"

The decade-deep product. v2 traced: fees v2 lifecycle (invoice→chield→transaction→approve
math, carry-forward, wallet, due-block), exam→result engine (mark distribution, dual
GPA/percent grade axes, merit, custom-result weighting), online exams (autosave, live
marking), student lifecycle (multi-year `student_records`, promote snapshot, roll rules),
attendance (P/L/A/F/H + subject-wise + 3-step import + absent-SMS cron), and V2-01..V2-14.

| ID | Work item | Files to touch | Scope | Effort | Depends | Acceptance |
|---|---|---|---|---|---|---|
| A-01 ↻ | **Fees depth**: `fee_invoices` + `fee_installments` (amount/due_bs/paid/fine/waiver per line), cross-year carry-forward w/ signed balances + log, AR aging report, fines + waivers reports, **offline bank-slip/cheque approval queue** (upload → admin approve/reject → receipt), receipt-number configurator (prefix+sequence per school) | `backend/app/models/fee.py`, `backend/app/api/v1/fees.py`, new migration, `backend/app/tasks/fee_reminders.py`, `frontend/app/dashboard/fees/**` (installment editor, aging page, approval queue), `aschool_shared/lib/repositories/fee_repository.dart` | BE+WE+MB | L | S12 branch merged | Contract tests for installment math + carry-forward (incl. negative/credit balances); approval queue e2e (web); aging buckets 30/60/90 by class; drift gate pass |
| A-02 ↻ | **Per-event notification matrix**: event × channel (push/SMS/email/WhatsApp) × audience toggles, admin UI; backed by the E-01 canonical event vocabulary | `backend/app/models/notification.py` (+`NotificationRule`), `backend/app/api/v1/notifications.py`, `backend/app/services/notification_engine.py`, `frontend/app/dashboard/notifications/` (matrix page), manifests (`events:`) | BE+WE | M | P-F E-01..E-03 (S-A2) | Matrix CRUD contract tests; a rule change flips real sends in test (absent alert + fee reminder ride it) |
| A-03 ↻ | **Custom result-card engine**: per-school report-card layout definitions (sections/columns/weightings) rendered by one engine; design_studio data-fill from `exam_result` fields; exam-type weighting input (`final = Σ weight×term_gpa`) | `backend/app/models/exam.py` (+`ReportCardLayout`, `ExamTypeWeight`), `backend/app/api/v1/exams.py`, `backend/app/services/designer/` (exam_result data source), `frontend/app/dashboard/exams/report-cards/` | BE+WE | L | S-A2 (A-32), designer D2 | Two schools with different SEE-style layouts render correct cards from the same data; weighting math unit-tested (25/25/50) |
| A-04 | **Print-twin discipline**: every list/report gets a print/PDF twin (WeasyPrint, T-05) | all `backend/app/api/v1/*.py` report routes + `frontend` print buttons | BE+WE | M | T-05 WeasyPrint in prod | Smoke test per PDF route; zero 501 PDFs |
| A-05 ↻ | **Online-exam hardening**: (P0) attempt integrity — unique active attempt per (exam, student), `in_progress` state, per-question autosave PATCH, server remaining-time authority; (UX) palette, wakelock, LaTeX, multi-answer, away>5 s auto-submit, T&C gate | `backend/app/api/v1/exams.py`, `backend/app/models/exam.py` (attempt columns + partial unique), `flutter_student/lib/features/exams/**` (runner rebuild), `frontend/app/dashboard/exams/online/` | BE+WE+MB | L | — | Regression: duplicate submit 409; autosave round-trip; kill-and-resume restores answers; answer key never in student payload (test asserts) |
| A-08 ↻ | **Native fee-pay UX**: verification screen (pending/success/fail) after gateway return, receipt PDF download in-app, "ask parents to pay" nudge, 1-h pending sweeper (read-path or beat) | `backend/app/api/v1/fees.py`, `backend/app/tasks/`, `flutter_parent/lib/features/fees/**`, `flutter_student/lib/features/fees/**` | BE+MB | M | — | Sandbox eSewa/Khalti happy path lands on verification screen; receipt downloads; sweeper test |
| A-28 | **Import UX**: template → preview temp table → commit for bulk uploads | `backend/app/api/v1/iemis_importer.py`, `students.py`, `attendance.py`, `frontend/app/dashboard/bulk-uploads/` | BE+WE | M | — | Attendance + student imports show preview grid before commit |
| A-31 ⭐new | **Student enrollment records**: `student_enrollments` (student, class, section, academic_year, roll_number, is_promoted, is_default) re-pointing marks/attendance/fees; promotion snapshot table; graduate=revert path | `backend/app/models/student.py`, `backend/app/api/v1/students.py`, `exams.py`, `attendance.py`, `fees.py` (re-point), migration + backfill | BE | L | — (structural) | All existing queries return identical results pre/post backfill (parity test); promote creates snapshot row + new enrollment; drift gate |
| A-32 ⭐new | **Exam marks depth**: `mark_components` (per exam×subject, CQ/MCQ/practical/oral), per-school `grade_scales` (SEE/NEB presets), tabulation sheet + grade legend + merit-list print artifacts | `backend/app/models/exam.py`, `backend/app/api/v1/exams.py`, `frontend/app/dashboard/exams/grades/` (+print), reports | BE+WE | M | A-31 (enrollment FK) | Component totals validated ≤ exam max; SEE scale seeded; tabulation print renders class×subject grid |
| A-33 ⭐new | **Attendance depth**: subject/period-wise register, `holiday` type + per-day holiday marking, absent-SMS digest (Sparrow, per-school send window, template placeholders), monthly print register | `backend/app/models/attendance.py`, `backend/app/api/v1/attendance.py`, new beat task, `frontend/app/dashboard/attendance/` (month grid + print), manifests | BE+WE | M | — | Subject attendance keyed to timetable periods; absent digest fires once/day in window; print register PDF |
| A-34 ⭐new | **Multi-medium academics**: medium dimension on classes/subjects (English/Nepali medium parallel) | `backend/app/models/academic.py`, `backend/app/api/v1/academics.py`, manifests | BE+WE | S | — | Two mediums coexist per class; timetable/attendance respect medium |
| A-35 ⭐new | **Dynamic registration/custom fields**: per-role field definitions (drag-rank) + `dynamic_fields` JSONB on student/staff; surfaces in admission wizard + profiles + iEMIS mapping | `backend/app/models/admission.py` (+`CustomFieldDef`), `backend/app/api/v1/admission.py`, `students.py`, `frontend/app/dashboard/settings/` | BE+WE | M | — | Admin adds a field → appears in public form + admin wizard + student profile without deploy |

### 1.2 eSchool v3.3.6 → `eschool-v3.3.6.md` §"Deep re-audit (v2)"

Traced: the online-exam runner end-to-end (2-state attempt, created-before-questions, answer
key shipped to device — we already fixed that; away>5 s auto-submit; client-only timer),
fees/payment state machine, homework, live classes (confirmed fake), ops-flag launch wiring.
Key ASchool bug found by comparison: **our `submit_online_exam` has no duplicate-attempt
check** (opposite of eSchool's burned-attempt bug) — folded into A-05 (P0).

| ID | Work item | Files | Scope | Effort | Depends | Acceptance |
|---|---|---|---|---|---|---|
| A-06 ↻ | **Mobile nav**: 4-tab bottom nav + data-driven "More" bottom-sheet grid from `/mobile/bootstrap` visibility (student app first, then parent) | `flutter_student/lib/screens/shell_screen.dart`, new `more_menu.dart`, `aschool_shared` | MB | M | — | 13 destinations reachable in ≤2 taps; drawer bug gone; plugin-gated tiles |
| A-07 ↻ | **Server-driven ops flags**: wire existing `force_update_dialog` + `mobile_version_service` into ALL FIVE apps at splash; add `maintenance` flag + per-platform payload to `/mobile/version` | `backend/app/api/v1/mobile.py`, `flutter_admin/teacher/student/parent/user` splash screens, `aschool_shared/lib/widgets/force_update_dialog.dart` | BE+MB | S | — | Flip flag → app blocks until update (manual test per app); maintenance screen replaces home |
| A-30 ↻ | **Coach marks + crash reporting**: showcaseview on first-run key screens; Sentry/Crashlytics hook in all apps | `aschool_shared`, 5 app `main.dart`s, pubspecs | MB | S | — | Crash test event reaches dashboard; coach marks show once (flagged in shared prefs) |
| A-38 ⭐new | **Elective subject groups + self-selection** (NEB +2 streams): `ElectiveSubjectGroup` analog, student self-selection endpoint | `backend/app/models/academic.py`, `student_app.py`, `flutter_student/lib/features/subjects/` | BE+MB | M | A-34 | Student selects within group caps; timetable/attendance use the choice |
| A-39 ⭐new | **Chat hardening**: admin retention policy (days, max chars, file size/count), read receipts, dedicated chat push — on existing Socket.IO + `chat_service` | `backend/app/services/chat_service.py`, `communications.py`, `flutter_*` chat screens | BE+MB | M | — | Retention cron deletes per policy; read receipt round-trip; limits enforced client+server |

### 1.3 Mighty School Pro v1.6 → `mighty-school-pro-v1.6.md` §"Deep re-audit (v2)"

Traced: accounting GL line-by-line (the "double entry" is mostly single-entry with inverted
journal columns, two competing balance models, hardcoded CoA seed) — the **7-point A-23
mini-design** in §V2.2 is the blueprint (two-sided vouchers, no stored balances, FY-start
opening equity, nature-aware classification, the 11 reports as one SQL shape). Plus payroll
advance/due/return lifecycle, fees engine math (5-dim pricing, FIFO sub-head allocation),
exam engine, 15-dim question taxonomy, SMS depth, V2-01..V2-14 (incl. `call_user_func`
success_hook RCE pattern in all 13 gateways).

| ID | Work item | Files | Scope | Effort | Depends | Acceptance |
|---|---|---|---|---|---|---|
| A-18 ↻ | **Question-bank taxonomy**: add board/chapter/topic/difficulty/source/year free-text dimensions + filters to `QuestionBankItem` (we have unit/outcome FKs post-S13) | `backend/app/models/question_bank.py`, `backend/app/api/v1/ai_tools.py` (bank CRUD), `frontend/app/dashboard/ai-tools/question-bank/` | BE+WE | M | S13 spine ALTER | Filter round-trip per dimension; dedupe still enforced |
| A-19 ↻ | **Permission-keyed sidebar**: `domain.action` permission names = manifest nav keys; server-side enforcement 1:1 with menu gating (closes O-04/B-17) | `backend/app/plugins/modules/*/manifest.yaml`, `backend/app/plugins/validator.py`, `backend/app/api/v1/plugins.py`, `frontend/app/dashboard/settings/roles/page.tsx` | BE+WE | M | O-04 | Every nav leaf has a permission key; non-granted role gets 403 + hidden nav (contract test) |
| A-20 | **Domain wizards**: startup→map→configure→execute→report scaffold for fees/imports/year-close | `frontend/components/wizard/` (new shared), per-domain pages | WE | M | — | Fees year-close wizard completes end-to-end with report step |
| A-21 ↻ | **SMS ops**: prepaid balance ledger per school, templates with merge fields, phone books, sent log | `backend/app/api/v1/sms.py`, `backend/app/plugins/modules/sms_notifications/`, `frontend/app/dashboard/sms/` | BE+WE | M | A-02 matrix | Balance decrements per send; merge-field preview; low-balance alert |
| A-23 ↻ | **`accounting` plugin (new)**: two-sided voucher engine per the mini-design — `accounting_categories/groups/ledgers` (NO stored balance), `accounting_vouchers` + `accounting_voucher_lines` (CHECK debit×credit=0), balanced-post enforcement, nature-aware reports (trial balance, income statement, balance sheet, cash flow, ledger, fund summary), FY-start (Shrawan 1) opening-balance equity journal, seed CoA skeleton (7 categories/24 groups), fee→GL + payroll→GL posting via event listeners | `backend/app/models/accounting.py` (new), `backend/app/api/v1/accounting.py` (new), `backend/app/plugins/modules/accounting/` (new manifest), `backend/app/services/accounting/`, listeners on `fees.collected`/payroll events | BE+WE | L | A-01 (fee heads stable), founder go | Post balanced voucher → reports correct (golden double-entry test suite); unbalanced post 422; cross-tenant isolation tests; BS-date FY start |
| A-40 ⭐new | *(merged into A-34)* | | | | | |

### 1.4 EduEx LMS v2.0 → `eduex-lms-v2.0.md` §"Deep re-audit (v2)"

Traced: locking (read-only theater — submit paths unchecked), certificates (derivable codes,
PII leak), monetization (7 unscoped verify endpoints, subscription expiry unenforced),
discussions (4 tables, zero notification fan-out), V2-01..V2-12. §V2.8 is a **concrete
adoption design** for our conventions (SchoolModel, @plugin_required, O(n) sequence calc).

| ID | Work item | Files | Scope | Effort | Depends | Acceptance |
|---|---|---|---|---|---|---|
| A-12 ↻ | **LMS sequential locking + resume** per §V2.8(1): `Course.require_sequential`, `GET /lms/courses/<id>/learn` (`current_item`/`is_accessible`/`locked_reason`), `POST .../complete` enforcing accessibility (the check EduEx forgot), completion flips on POST only, emits `lms.course_completed` | `backend/app/models/lms.py`, `backend/app/services/lms/sequence_service.py` (new), `backend/app/api/v1/lms.py`, `flutter_student/lib/features/lms/` | BE+MB | M | — | Locked item write 403; resume returns correct current_item; completion parity test; O(n) query count test |
| A-13 ↻ | **Certificates + public verification** per §V2.8(2): `CertificateTemplate` + `IssuedCertificate` (random `CERT-<school4>-<hex8>`, dedicated `issued_at`), weasyprint PDF, timed signed download URLs, public `/public/verify-certificate/<code>` exact-match, minimal PII | `backend/app/models/lms.py`, `backend/app/services/lms/certificate_service.py` (new), `backend/app/api/v1/lms.py`, public blueprint route, `frontend/app/dashboard/lms/` | BE+WE | M | A-12 | Issued on completion; verify page resolves/404s correctly; code not derivable (test); revoked hides |
| A-14 ↻ | **Course discussions** per §V2.8(3): 4 tables w/ unique like constraints, pin/announcement (course-teacher only), **event-bus fan-out** (`lms.discussion_*` → notifications) which EduEx lacks, 15-min edit window | `backend/app/models/lms.py`, `backend/app/api/v1/lms.py`, manifests, `flutter_student/teacher` lms screens | BE+MB | M | A-12 | Non-enrolled 403; unique-like toggle; pin permission enforced; reply notifies course teacher |
| A-41 ⭐new | **LMS authoring depth**: nested-save authoring endpoint + lesson/topic reorder + preview lessons (`is_preview`) | `backend/app/api/v1/lms.py`, `backend/app/models/lms.py`, teacher portal | BE+WE | M | — | One payload creates course+topics+lessons; reorder persists; preview visible pre-enrollment |

### 1.5 InstiKit v5.5.0 → `instikit-school-v5.5.0.md` §"Deep re-audit (v2)"

Traced: fee engine (16-table chain, waterfall installments, secondary concession, dual
verification before receipt), admission funnel, day closure (till lock works), approval
engine (level-by-level + return-to-level), website blocks (v1 correction: exports are Excel
dumps, not presets), V2-01..V2-13 (unauthenticated integration surface, display-only seat
caps, no lockForUpdate on payment complete — we must do both right).

| ID | Work item | Files | Scope | Effort | Depends | Acceptance |
|---|---|---|---|---|---|---|
| A-09 ↻ | **Admission funnel**: `AdmissionRegistration` staging model; public slug-scoped wizard (enquiry → registration w/ document uploads → fee → conversion) with OTP/token continuation; **seat caps enforced with `FOR UPDATE`** (InstiKit's don't enforce — ours must); printable application; admin approval → auto-provision (account, enrollment, fee structure) | `backend/app/models/admission.py`, `backend/app/api/v1/admission.py`, public blueprint endpoints, `frontend/app/school/[slug]/admission/` | BE+WE | L | A-35 (custom fields) | Over-cap admission blocked under concurrency test; full funnel e2e: enquiry→registered→paid→enrolled student |
| A-22 ↻ | **Guest payments**: `PaymentInitiation.context ∈ {admission_fee, event_ticket, guest_fee}`; public lookup/initiate/complete/fail endpoints; instructions screen for offline | `backend/app/models/fee.py` (context column), `backend/app/api/v1/fees.py` public routes, `frontend/app/school/[slug]/pay/` | BE+WE | M | A-09 | Guest pays admission fee without account; double-callback idempotent (test) |
| A-15 ↻(corrected) | **Website blocks + presets**: reusable named `WebsiteBlock` rows (slider/stat/testimonial/accordion + CTA/event/news/gallery), JSON preset export/import via manifest `website_presets:` (NOT InstiKit's Excel dumps); unknown page slug → 404, portal handoff for page-less menus | `backend/app/models/` (website), `backend/app/api/v1/website_builder.py`, `frontend/components/website/SectionRenderer.tsx` | BE+WE | M | P-C W-01..W-05 | Preset installs into fresh tenant; blocks rehydrate; handoff lands on branded login |
| A-24 ↻ | **Day closure / day book**: `FeeDayClosure` (BS-first date, denomination matrix, user+date till lock in `record_payment`, day-book facet with user-wise collection) | `backend/app/models/fee.py` (+closure), `backend/app/api/v1/fees.py`, `frontend/app/dashboard/fees/day-closure/` | BE+WE | M | A-01 | Closed user+date blocks new payments; day book totals == collections; reopen audited |
| A-25 ↻ | **Generic approval engine**: `workflow` concept — `ApprovalWorkflow/Step/Case/CaseStep` with return-to-level + `emit()` side effects; first consumers: fee waivers, leave, TC issuance | `backend/app/models/workflow.py` (new), `backend/app/api/v1/workflows.py` (new), `backend/app/plugins/modules/workflow/` | BE+WE | L | — | Waiver request walks 2 levels w/ return; consumed by fees + hr leave; audit trail |
| A-26 | Helpdesk tickets, gate pass, correspondence log, mess module, asset registry — as separate marketplace-able plugins | new modules | BE+WE | L (each S/M) | A-25 | Each installs via marketplace; base flows pass |
| A-37 ⭐new | **Admin ops surfaces**: user access logs (login events), record view logs (sensitive reads), forced password change toggle, support impersonation (super-admin only, audited) | `backend/app/models/` (audit), `backend/app/api/v1/users.py`, `frontend/app/dashboard/settings/` | BE+WE | M | — | Login/view events land in viewer; impersonation session is flagged + expires |

### 1.6 SchoolBusTrack v2.3 → `schoolbustrack-v2.3.md` §"Deep re-audit (v2)"

Traced: the full trip lifecycle (publish/assign/end crons, ride_status 0/1/2/3), geofence
engine (5 radii, per-passenger triggers, dead toggles), board/alight flows, coins economy
(double-spend replayable), parent tracking UX. §V2.7 = **6-table transport schema design**
(TIMESTAMPTZ not TIME; per-instance socket room; dual ingest ESP32+driver phone; offline
store-and-forward). §V2.9 = driver MVP (5 screens, 4 endpoints, GPS params).

| ID | Work item | Files | Scope | Effort | Depends | Acceptance |
|---|---|---|---|---|---|---|
| A-10 ↻ | **Trip model**: `transport_trips` (recurring, direction) → `transport_trip_instances` (unique per date, driver/bus snapshot, last-fix cache, per-instance room) → `transport_trip_instance_stops` (sequence, planned/actual TIMESTAMPTZ) → `transport_trip_reservations` (ride_status 0/1/2/3+4, boarded/dropped ts, fee_status); minute beat: publish/assign/force-end with task locks; **board/alight + missed-pickup alerts**; end blocked while passengers aboard; fees gate (not coins) | `backend/app/models/transport.py` (extend), `backend/app/api/v1/transport.py`, new `backend/app/tasks/transport_trips.py`, migration | BE | L | founder go (re-scope approved) | Instance publishes daily; ride_status transitions enforced (contract tests); missed-pickup alert fires; end-with-passengers 409 |
| A-11 ↻ | **Transport notifications + driver flow**: `transport_notification_prefs` (per-student radius + 7 events) + `transport_alert_log` (30-min dedup); geofence engine in `process_gps_data` (replace 2 km admin-only alert); driver MVP: start w/ stop reorder, running map + coaching banners, QR board, drop-off (flutter_user transport tab); parent app: per-trip socket room, stale banner, stop timeline, call-driver | `backend/app/tasks/gps_processing.py`, `backend/app/api/v1/transport.py`, `flutter_user` (+shared), `flutter_parent/lib/features/bus_tracker/`, `frontend/app/dashboard/transport/` | BE+MB+WE | L | A-10 | Simulated GPS walk stamps arrivals; parent receives near/arrived/missed per prefs; driver phone ingest == ESP32 ingest parity test |
| A-42 ⭐new | **Transport ops reports**: missed-pickup register, trip history per route/driver, ETA from GPSLog haversine (replaces static `eta_minutes`), GPS replay viewer | `backend/app/api/v1/transport.py`, `parent_app.py`, `frontend/app/dashboard/transport/reports/` | BE+WE | M | A-10, A-11 | ETA improves on live position vs static (test with two fixes); replay renders a past trip |

### 1.7 InfixEdu add-on modules → `infixedu-addon-modules.md` §"Deep re-audit (v2)"

Line-level pass on all four modules; lessons adopted into A-16/A-17/A-09. New v2 findings
(wired live-class gaps, seeded credentials, client-trusted RazorPay capture, staging→provision
pipeline details) are recorded there; nothing new needing a separate A-item beyond:

| ID | Work item | Files | Scope | Effort | Depends | Acceptance |
|---|---|---|---|---|---|---|
| A-16 ↻ | **Live-class hardening** — ⚠ starts with a P0 fix in OUR tree (addon-audit V2-24): `VideoService.create_live_class()` passes kwargs that don't exist on `LiveClass` (`room_id/join_url/duration_minutes/ends_at` vs the real `jitsi_room_id/duration_mins`), sets a `status` value outside the model's choices, and **zero routes call VideoService** — create/start/end are unreachable via API today. Fix that, then: Jitsi JWT (moderator=teacher claim, expiring, room-scoped), true interval-overlap conflict detection (vs timetable + existing meetings — not start-point-only like Zoom addon), early-join window (`join_window_mins`), recording attach (file/link) after end, recurring series (`series_id` + materialization), per-school creation quota | `backend/app/services/lms/video_service.py`, `backend/app/api/v1/lms.py`, `backend/app/models/lms.py`, `conferences.py` | BE | M | — | Student token lacks moderator rights (decoded test); overlapping booking 409; live-class create/start/end reachable through API (the V2-24 regression test); recording attaches and renders |
| A-17 ↻ | **Addon manifest engineering**: optional `migrations:` map + `data_retention: keep\|purge` in manifest; "Configure" CTA + connection-test per integration plugin; marketplace listing metadata (`changelog_url`, `screenshots`, `publisher`) | `backend/app/plugins/loader.py`, `validator.py`, `backend/app/api/v1/plugins.py`, manifests | BE | M | — | Validator accepts/rejects per schema; uninstall honors retention; CTA runs live config test |

### 1.8 Refined work-item status vs the old A-list

A-01..A-30 all remain live (A-02, A-03, A-04, A-05, A-06, A-07, A-08, A-09, A-10, A-11,
A-12, A-13, A-14, A-15, A-16, A-17, A-18, A-19, A-20, A-21, A-22, A-23, A-24, A-25, A-26,
A-27, A-28, A-29, A-30) with the v2 refinements marked ↻ above. New from v2: **A-31,
A-32, A-33, A-34, A-35, A-36, A-37, A-38, A-39, A-41, A-42** (A-36 = student exit
documents: TC issuance with payment gating + auto-disable, character/bonafide certificates
via design_studio, transcript print, graduate revert — from MSP LayoutCert + InfixEdu
graduate module; A-40 merged into A-34).

---

## Part 2 — THE sprint list (one sequence, all sources)

Sprint execution order (founder priority): **S-A1 → S-A5 (P0 adoptions) → S13 → S14 → S15 →
S16 → S17 → S18 → S19 → S20 → S21 → S22+**. Waves S1–S4/S6–S11 from MASTER_PLAN v2 are
absorbed into the slots shown (their items ride the sprint that touches the area). Every
sprint: one feature branch `feat/s<id>-<slug>`, ALL implementation finished first, ONE full
test pass at the end, conventional commit, AUDIT_INDEX entry appended.

Standing gates every sprint: `pytest` (backend) · drift gate `DATABASE_URL=postgresql://aschool:aschool@localhost:5435/aschool_drift_check python scripts/check_migration_drift.py` ·
`tsc --noEmit` · `flutter analyze` 0 errors · new-endpoint contract tests · AUDIT_INDEX row.

| Sprint | Scope (work-item IDs) | Demo-able outcome |
|---|---|---|
| **S-A1 — Fees depth** (BE-heavy) | A-01 (installments, carry-forward, AR aging, fines/waivers reports, offline-slip approval queue, receipt designer), A-08 (verification screen, receipt download, nudge, sweeper), A-24 (day closure/day book) | "Collect a term fee in 3 installments, record a bank-slip payment, approve it, print the receipt, see aging + day book" |
| **S-A2 — Exam & attendance integrity** | A-05 (attempt integrity P0 + runner UX web+Flutter), A-32 (mark components, grade scales, tabulation/merit prints), A-33 (subject attendance, holiday type, absent-SMS, print register), A-28 (3-step import UX) | "Run an online exam with palette/autosave/resume; enter component marks; print tabulation + merit list; subject-wise register with absent-SMS" |
| **S-A3 — Platform services** | A-02 (notification matrix) + P-F E-01..E-05 (events vocabulary + emits + listeners + CI audit), A-07 (ops flags into 5 apps + maintenance), A-30 (crash reporting + coach marks), A-37 (ops surfaces), A-19 (permission-keyed sidebar + O-04 roles page) | "Admin toggles a notification rule and ops flag, sees it live in the apps; roles page is real; access logs viewer" |
| **S-A4 — Transport re-scope** | A-10 (trip model), A-11 (prefs + geofence + driver MVP), A-42 (ETA + reports + replay) | "Bus publishes today's trips, driver boards by QR, parent gets approach/missed alerts with per-student radius, ETA is real" |
| **S-A5 — Admission funnel & portal** | A-09 (funnel + provisioning + seat caps), A-22 (guest payments), A-35 (custom fields), A-31 (student_enrollments structural), A-34 (mediums), A-36 (exit documents/TC) | "Parent applies on the public site, pays fee as guest, admin approves → account + enrollment provisioned; TC prints after dues clear" |
| **S13 — AI grounding + retrieval** (per FINAL_AI_PLATFORM_PLAN) | I.2 retrieval upgrade (filter-first → hybrid → RRF → reranker → CRAG-lite → token-budget assembly), T1 context packs (`context_curriculum_rag`, tutor grounding per turn), citations UI, golden-set eval runner + gates (recall@20 ≥0.95, groundedness ≥0.90, NE-gap ≤10) | "ask 'प्रकाशको वर्ण विक्षेप' → lesson plan cites Grade-10 Science chunks with page refs; citations render in the tool result" |
| **S14 — Question engine** (I.5) | bank curation UI, blueprint materialization, KAQG generation w/ provenance, model sets, QTI v2, A-18 taxonomy | "Generate 3 model sets from a spec grid with zero overlap, teacher reviews, publishes" |
| **S15 — Designer D1+D2 + print twins** | II.1+II.2 (Devanagari print correctness, QR verify, bulk jobs, preflight, brand kit), A-03 (custom result cards), A-04 (print-twin sweep) | "Bulk-generate 200 branded ID cards w/ QR verify page; two schools' report cards differ by layout config" |
| **S16 — Mobile AI wave 1** | student grounded tutor client + photo→solve, teacher comments/parent-message/morning brief, A-06 (nav grid), M-A1..A-5 admin depth, M-C1..C4, offline attendance draft (M-F3) | "Student photographs a question → hint ladder, Socratic lock on live assignment; teacher gets morning brief" |
| **S17 — Designer D3 + Writer** | II.3 (text-to-design VASCAR loop, writer AI actions, RAG research panel, paper→print), A-12/A-13/A-14/A-16/A-41 (LMS trio + live-class hardening), A-15 (site blocks/presets), A-20 (wizards) | "Prompt → 3 editable poster variants; finish a course → certificate with public verify; course has pinned discussions" |
| **S18 — Mobile AI wave 2 + parent** | parent digest/NL-QA/WhatsApp bot, admin NL-over-SIS + board report, AI-teacher Flutter client, A-38 (electives), A-39 (chat hardening), A-17 (addon manifest), A-21 (SMS ops), M-B/M-D/M-E items | "Parent asks 'how is my child doing?' in Nepali → cited digest; WhatsApp bot answers fees questions" |
| **S19 — Adaptive + accounting** | I.7 outcome-keyed mastery + SM-2 + practice loop, voice capture + EN tutor voice, **A-23 accounting plugin** (voucher engine + reports + GL posting), A-25 workflow engine | "Fee collection posts to GL; trial balance balances; adaptive path recommends the next practice set" |
| **S20 — Innovator tier** | agentic design jobs, widget digests, MCP surfaces, A-26 (helpdesk/gate-pass/mess/assets as plugins), A-27, A-29 | "Sunday evening: next week's bilingual notice posters queued for approval" |

---

## Part 3 — Standing "do not adopt" list (COMPETITOR_CROSS_AUDIT_PLAN §3 + v2 confirmations)

- Monolith organization (blade/jQuery god-controllers, 3-4k-LOC API controllers, one giant Flutter menu builder).
- Addon zip-upload without signatures (RCE-by-design); license checks as file markers; per-install Envato licensing.
- Coins-wallet transport metering (gate on fees plugin status instead); branch = `branch_id` column flip (our chain architecture stands).
- Device-local wishlist (EduEx); client-trusted quiz timers and client-reported payment failures; answer keys shipped to clients.
- GET-side-effect completion (EduEx enroll-on-read); per-gateway payment columns (keep JSON settings rows); instructor payouts/marketplace (wrong business model for schools).
- Mock AI screens — AI must be real or absent; hardcoded `123456` provisioning passwords; unauthenticated artisan routes (`/migrate`, `/clear`, `/seeder_install`).
- Secrets or webhook secrets in any client-facing settings payload (eSchool V2-02); `call_user_func` success hooks from request data (MSP V2-14).
- Stored-balance accounting columns mutated in CRUD paths (MSP's dual-model divergence); hardcoded institute/ledger ids in posting; income classification by sign-masks client-side.
- Public/unauthenticated socket channels for positions (SBT); TIME-only event timestamps; last-position-only GPS (our GPSLog history is the moat).
- Staging→approve flows with fixed passwords, enumerable uniqueness endpoints, no verification challenge (InfixEdu ParentReg) — adopt the pipeline, not the holes.
- Display-only seat caps (InstiKit) — if we ship seat caps they must enforce under concurrency.
- "More modules on the sidebar": menu sprawl killed all seven; our 12-section manifest sidebar + N-06 command palette stays.
- v2-confirmed anti-patterns never to port: money math done twice with different units (RazorPay addon records amount/100 but debits raw paise); join-time guards written as `!$status == 'started'` (dead code); cross-tenant listing leaks via `(x AND y) OR y IS NULL` filters; `max()+1` sequences without locks; auth calls inside migrations; secret-key model objects returned to browsers.

---

## Part 4 — Founder decisions (none block S-A1)

1. Transport re-scope approved as schema addition? (A-10 six tables — recommended yes.)
2. `accounting` plugin (A-23) target before Nepali FY start (Shrawan 1)? Sprint S19 as planned.
3. LMS trio (A-12/13/14) in S17 — acceptable, or pull into S-A5?
4. Marketplace zip-sideload: keep manifest-only until third-party authors exist (recommended).
5. Photo→solve policy: hint ladder + unlockable full solution (recommended), Socratic-locked on live assignments.
6. WhatsApp bot: Meta Cloud API direct (recommended) vs BSP.
7. On-device AI (Gemma 3n packs): after cloud tier proves usage (recommended).
8. Designer collaboration (Yjs): deferred (recommended).
9. NE voice tutor ASR WER gate threshold: sign off criteria when S19 nears.
10. A-31 `student_enrollments` is our first structural re-point (marks/attendance/fees FK change) — schedule
    confirm (S-A5), and confirm the due-login block policy: ASchool will gate **portal features**
    (results/transcript), never login (adaptation of InfixEdu's due-block).
