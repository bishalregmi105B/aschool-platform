# Competitor Deep Audit: InstiKit School v5.5.0 (ScriptMint)

**Product:** InstiKit Premium — "Most Comprehensive School/College/Institute/Academy Management Kit", CodeCanyon-style self-hosted ERP, vendor ScriptMint (scriptmint.com, instikit.com). First release 13 July 2018; v5.5 released 16 Dec 2025.
**Audited copy:** `Other Projects/InstiKit School v5.5.0 Nulled/InstiKit School v5.5.0 Nulled/instikit-most-comprehensive-school-college-institute-and-academy-management-kit_x/instikit-most-comprehensive-school-college-institute-and-academy-management-kit/` (referred to below as `INSTIKIT/`)
**Audit date:** 2026-09-11

**STACK CORRECTION (important):** the working brief described InstiKit as "WordPress-based school kit (WP theme + plugins)". **It is not WordPress at all.** v5.5.0 is a **Laravel 12 + Vue 3 SPA + Tailwind CSS 4** application (Laravel 12 confirmed in `INSTIKIT/composer.json` and the v5.3 changelog entry "Laravel 12 upgrade, Tailwind CSS 4 upgrade"; v4.0.0 changelog: "Rewritten from scratch with latest version of Laravel, Vue.js & Tailwind CSS"). There are no CPTs, no shortcodes, no WP themes, no plugin marketplace. This audit therefore treats it as what it is: a monolithic self-hosted school ERP with a built-in public website builder — arguably a closer competitor to ASchool than a WP kit would be. All "WP patterns" questions below are answered as "architecture patterns" against the real code.

**Stack in one line:** PHP 8.2 / Laravel 12, MySQL, Sanctum token auth, spatie/laravel-permission (with team support), Vue 3 SPA (prebuilt, 957 code-split JS chunks in `public/build/assets/`, source not shipped), minimal Livewire (2 components: `app/Livewire/Counter.php`, `app/Livewire/Query.php`), Laravel Folio not meaningfully used, Blade only for the public site + print/report templates (182 blade views), Horizon queues (`.env` ships `QUEUE_CONNECTION=sync`), Pusher broadcasting, mpdf + spatie/browsershot for PDFs, maatwebsite/excel for import/export, Twilio, Razorpay/Stripe SDKs. Distribution model: **one install = one organization** (Envato Regular/Extended license per `INSTIKIT/README.md`; a "nulled" copy with no license-check code found anywhere under `app/`).

**Headline numbers:**

| Metric | Count | Source |
|---|---|---|
| Route statements | 1,410 (1,197 are explicit verbs get/post/patch/put/delete) | `INSTIKIT/routes/` (17 route files + 31 module files) |
| Controllers | 699 | `app/Http/Controllers/` |
| Models | 224 | `app/Models/` |
| Service classes | 696 (the real business logic lives here) | `app/Services/` |
| DB migrations | 236 (~200 tables) | `database/migrations/` |
| Blade views | 182 | `resources/views/` |
| SPA JS chunks | 957 (Vite code-split, ~1 chunk per screen/action) | `public/build/assets/` |
| Export/Import classes | 39 | `app/Exports/`, `app/Imports/` |
| Admin modules in menu | 33 top-level | `resources/var/modules.json` |
| Roles | 17 predefined | `resources/var/permission.json` |
| Payment gateways | 10 + bank transfer + guest/anonymous payment | `app/Services/Finance/PaymentGateway/` |
| Languages | en only (extensible via `lang/`, runtime locale sync endpoint) | `lang/en/` |

**Audit method & scope:** read in full or in large part — `INSTIKIT/routes/app.php` (232 lines, the authenticated API), `routes/guest.php` (76 lines, public funnel), `routes/api.php`, `routes/site.php`, `routes/integration.php`, `routes/report.php`, `routes/web.php`; all 236 migration filenames; `resources/var/modules.json`, `resources/var/permission.json`, `resources/var/config.json` (37 config groups incl. 14 feature flags); `app/Services/SiteService.php` (273 lines, website builder); `app/Enums/Site/BlockType.php`; `app/Models/Team.php`, `app/Models/Device.php`, `app/Models/Exam/OnlineExamQuestion.php`, `app/Models/Exam/*` (14 models); `app/Http/Controllers/SiteController.php` and the `Site/` controllers; print template trees under `resources/views/print/`; gateway services under `app/Services/Finance/PaymentGateway/`; `.env`, `README.md` (full version log v4.0→v5.5). ASchool claims were verified against `backend/app/plugins/modules/` (44 plugin dirs), `backend/app/api/v1/` (60 route files, 706 route decorators), `backend/README.md`, and `docs/competitor-audits/eschool-v3.3.6.md`. `vendor/` was skipped.

---

## 1. Product Inventory

### 1.1 One install, four surfaces

| Surface | Tech | Entry |
|---|---|---|
| Public website (the "kit's" website+portal fusion) | Blade + Tailwind, DB-driven pages/menus/blocks, 2 themes (`default`, `modern`) + `custom` theme mode | `routes/site.php`, `app/Http/Controllers/SiteController.php`, `resources/views/site/` |
| Guest funnel API (no login) | JSON API behind `feature.available` middleware | `routes/guest.php` |
| Authenticated app (all 17 roles use the same SPA) | Vue 3 SPA at `/app/{any}` served by `resources/views/app.blade.php`; API under `/api/app/*` | `routes/web.php` (lines 74-80), `app/Providers/RouteServiceProvider.php` |
| Machine integration | Tally ERP export + biometric device timesheet push | `routes/integration.php` |

### 1.2 Admin module inventory (from `resources/var/modules.json`, with controller/model paths)

| Module | Children (menu items) | Key paths |
|---|---|---|
| **Reception** | enquiry, visitor_log, gate_pass, complaint, call_log, correspondence | `app/Http/Controllers/Reception/` (23 files), `create_gate_passes_table.php`, `create_call_logs_table.php`, `create_correspondences_table.php` |
| **Academic** | department, period (school year, archivable), division, course, batch, subject, class_timing, timetable, book_list, certificate, id_card | `app/Models/Academic/` (22 models: Session, Program, ProgramType, Course, Batch, Subject, Timetable*, CertificateTemplate, IdCardTemplate, EnrollmentSeat…), `app/Http/Controllers/Academic/` (60 files) |
| **Student** | registration, roll_number, health_record, subject(elective), attendance, fee_allocation, promotion, **edit_request**, leave_request, transfer_request, transfer, **alumni**, report | `app/Http/Controllers/Student/` (103 files!), `app/Models/Student/` (13 models), `create_enrollment_seats_table.php` (seat-wise admission), `create_student_diaries_table.php` |
| **Finance** | payment_method, fee_group, fee_head, fee_concession, fee_structure, **ledger_type, ledger**, **transaction** (+categories, vouchers, cheque clearing, day book), receipt, report | `app/Http/Controllers/Finance/` (61 files), fee engine: `create_fee_allocations/installments/components/concessions/refunds_*` migrations (16 fee tables), `create_day_closures_table.php` |
| **Exam** | term, grade, assessment, **observation**, **competency**, schedule, form, report | `app/Models/Exam/` (14), marksheets: cumulative, credit-based, exam-wise (`resources/views/print/exam/`), online exam with attempts (`OnlineExam/Question/Submission.php`), mark auto-lock |
| **Employee** | department, designation, attendance, leave, payroll, edit_request | `app/Http/Controllers/Employee/` (82 files), `create_employee_work_shifts_table.php`, `create_payroll_records_table.php`, salary templates + conditional formulas, payment advice print |
| **Resource (LMS-lite)** | book_list, diary, assignment, lesson_plan, syllabus, online_class, learning_material, download | `app/Http/Controllers/Resource/` (21 files), assignment submissions + teacher evaluation (`create_assignment_submissions_table.php`), online class = external meeting link (`app/Models/Resource/OnlineClass.php` stores `url`; `app/Enums/Resource/OnlineClassPlatform.php`) |
| **Transport** | route, circle, fee, vehicle | `app/Services/Transport/` (14 services), stoppage import (`StoppageImportService.php`), vehicle fuel/expense/service/case records (`create_vehicle_*_records_table.php`), transport fee wired into fee engine (`create_transport_fee_records_table.php`) |
| **Calendar** | holiday, celebration, event | `create_holidays_table.php`, `create_events_table.php` |
| **Discipline** | incident | `app/Enums/Discipline/`, `create_incidents_table.php` |
| **Gallery** | (images w/ watermark option) | `create_galleries_table.php`, v4.6 "Watermark in Gallery Images" |
| **Guardian** | parent records + guardian import + parent ID cards | `app/Models/Guardian.php`, `GuardianController.php` |
| **Contact** | contact book + edit requests + bulk messaging | `app/Models/Contact.php`, `ContactEditRequest.php` |
| **Mess** | menu_item, meal, meal_log | `app/Services/Mess/`, `create_meal_logs_table.php` |
| **Inventory** | stock_category, stock_item, stock_requisition, stock_purchase, stock_transfer, stock_adjustment | `app/Http/Controllers/Inventory/` (33 files), item copies, vendor statements (`app/Services/Inventory/VendorStatementService.php`) |
| **Communication** | announcement, email, sms (+ WhatsApp templates, push) | `app/Services/Config/SMSGateway/` (custom HTTP gateway), `app/Http/Controllers/Config/WhatsAppTemplateController.php`, v5.0 "WhatsApp Integration" |
| **Library** | book, book_addition, transaction | `app/Http/Controllers/Library/` (19 files), book copies + fines (`create_book_copies_table.php`), library reports |
| **Blog / News** | (public site content w/ categories+tags) | `app/Http/Controllers/Blog/`, `News/`, site routes `routes/site.php` |
| **Approval** | type, request, pending_requests, processed_requests | **Generic multi-level approval engine**: `create_approval_types/levels/requests_table.php`, `app/Http/Controllers/Approval/` |
| **Task** | (tasks w/ checklists + members) | `create_tasks/checklists/members_table.php` |
| **Helpdesk** | faq, ticket | `create_tickets/assignees/messages_table.php` |
| **Activity** | trip (w/ participants) | `create_trips/participants_table.php` |
| **Hostel** | hostel (blocks/floors/rooms), room_allocation | `app/Services/Hostel/` (9 services) |
| **Form** | custom form builder (fields + submissions) | `create_forms/form_fields/submissions*_table.php` |
| **Asset** | building (→ floors → rooms) | `app/Http/Controllers/Asset/`, `create_floors/rooms_table.php` |
| **Site** | page, menu, block | `app/Http/Controllers/Site/` (10 controllers), `create_site_pages/menus/blocks_table.php` |
| **Recruitment** | vacancy, application | `create_job_vacancies/records/applications_table.php`, public apply via guest routes |
| **Custom field** | custom fields on Student/Employee/Registration | `app/Enums/CustomFieldForm.php`, `create_custom_fields_table.php` |
| **User / Team** | users, roles, permissions, impersonation, teams | `app/Http/Controllers/Team/`, `UserImpersonationController.php` |
| **Utility** | todo (kanban lists), backup, activity log | `app/Http/Controllers/Utility/` |

Cross-cutting: **Post wall** (Facebook-like feed w/ pinned announcements, `routes/chat.php`, `app/Models/Post.php`), **Chat** (realtime, Pusher, `chat:access` permission), **Dialogue** (structured student/guardian ↔ institute thread, `app/Models/Dialogue.php`), **Service requests** (student/guardian raise requests, `app/Models/Student/ServiceRequest.php`), **Reminder** with notifications, **Tags & groups** (polymorphic `taggables`), **View logs + User access logs** (`create_view_logs/user_access_logs_table.php`).

### 1.3 Roles (all in `resources/var/permission.json`)

`admin, observer, manager, principal, staff, accountant, librarian, exam-incharge, transport-incharge, inventory-incharge, mess-incharge, hostel-incharge, attendance-assistant, receptionist, student, guardian, user`. Every route carries `permission:` middleware; the file ships a full default role→permission matrix that admins can re-assign per team (role-wise or user-wise, `app/Http/Controllers/Team/PermissionController.php`).

**Student and guardian get exactly 29 permissions each** (verified identical lists): view own profile/attendance/fees/marksheet/exam schedule/online exams/announcements/events/gallery/assignments/diary/learning materials/book lists, pay fees online, create complaints, raise leave/service/transfer requests, dialogue with institute, comment+read on the post wall, manage todos. This is a **complete front-end portal with no content-creation surface** — deliberately read-mostly.

### 1.4 Money flows (10 gateways + 3 guest flows)

- Gateways: Razorpay, Stripe, PayPal, Paystack, Billdesk, CCAvenue, Billplz (MY), Hubtel (GH), Amwalpay (OM), Payzone — `app/Services/Finance/PaymentGateway/{Razorpay,Stripe,Paypal,Paystack,Billdesk,Ccavenue,Billplz,Hubtel,Amwalpay,Payzone}.php` + response views `resources/views/gateways/`.
- Bank transfer payment + admin approval (`create_bank_transfers_table.php`), cheque/DD clearing dates, transaction import, day closure for cashiers, payment-link QR codes, guest/anonymous fee payment by looking up a student, registration-fee online payment with due dates, refund records, fee concession logs, head-wise & installment-wise payment.
- **No Nepal gateway anywhere** (no eSewa/Khalti/FonePay/connectIPS; `resources/var/currencies.json` defaults USD).

### 1.5 Where the weight sits (routes & controllers per domain)

API route statements per module file (`routes/modules/*.php`) — the honest feature-complexity ranking:

| Module file | Route stmts | Controllers (files in `app/Http/Controllers/<Domain>/`) |
|---|---|---|
| `student.php` | 183 | Student: 103 |
| `employee.php` | 106 | Employee: 82 |
| `exam.php` | 84 | Exam: 39 |
| `academic.php` | 79 | Academic: 60 |
| `finance.php` | 67 | Finance: 61 |
| `transport.php` | 43 | Transport: 38 |
| `inventory.php` | 42 | Inventory: 33 |
| `reception.php` | 41 | Reception: 23 |
| `resource.php` | 27 | Resource: 21 |
| `library.php` | 27 | Library: 19 |
| `site.php` | 20 | Site: 16 |
| `task.php` | 19 | Task: 8 |

Plus cross-cutting `routes/app.php` (232 lines: teams, users, config, options, custom fields, dashboards, todos, backups, activity logs, media, tags, attendance QR) and `routes/guest.php` (76 lines: the public funnel). The Student domain alone (183 routes / 103 controllers) is bigger than all of eSchool v3.3.6's API surface.

### 1.6 Release cadence (evidence: version log in `INSTIKIT/README.md`)

v4.0.0 (20 Sep 2024) → v5.5 (16 Dec 2025): **17 releases in 15 months**, nearly monthly, each with 5–50 named features:

| Version | Date | Marquee features |
|---|---|---|
| 4.0.0 | 2024-09-20 | Full rewrite (Laravel/Vue/Tailwind); Recruitment, Mess, Activity, Custom Form, Gallery modules |
| 4.1.0 | 2024-09-30 | Alumni, Discipline, keyboard nav, Send Email, Billdesk/CCAvenue status checks |
| 4.2.0 | 2024-10-07 | SMS gateway, custom fields, elective attendance, QR attendance, Paystack |
| 4.3.0 | 2024-10-21 | Realtime chat, assignment submit/evaluate, academic departments |
| 4.4.0 | 2024-11-12 | **Online Exam module**, manual backup, department/program access scoping |
| 4.5–4.8 | 2024-11→2025-01 | Color themes, tags/groups, mobile app support, watermarks, blog, fee installments |
| 4.9–4.10 | 2025-02→03 | Biometric addon, QR attendance, half-day leave, IP filter, bulk payroll |
| 5.0 | 2025-05-05 | **Wall feed, WhatsApp, bank-transfer approval, OTP login, enquiry→registration→admission funnel, guest payments** |
| 5.1 | 2025-06-03 | **Multi-level approval, push notifications, installments, Amwalpay** |
| 5.2 | 2025-06-08 | Tasks/reminders, payment QR, vehicle expense/case records, dedicated doc/account/qualification modules |
| 5.3 | 2025-08-31 | Laravel 12, **website events/announcements/gallery/blocks**, employee tickets, FAQ, **day closure**, day book |
| 5.4 | 2025-11-04 | Custom attendance types, competency evaluation, **online enquiry module**, vehicle fuel records |
| 5.5 | 2025-12-16 | Registration fee payment, secondary concession, user access logs, verification, Hubtel, head-wise fee summary |

This cadence is the product's core marketing engine.

---

## 2. Architecture Patterns Worth Stealing

*(No WP patterns exist — this section maps the Laravel/monolith equivalents and what's genuinely worth copying.)*

### 2.1 Multi-institute in one install: Organization → Team → Period

- `create_organizations_table.php` + `update_teams_table_with_organization_column.php`: an **Organization owns many Teams** (each Team = one institute/branch/campus). Every domain table carries `team_id` (`update_configs_table_with_team_id_column.php`); `app/Models/Team.php` has `HasConfig` concern so **each institute has its own config overlay**; spatie permission runs in teams mode; users span teams via `config('config.teams')` (`scopeAllowedTeams` in `app/Models/Team.php`).
- Route-level tenant context: guest endpoints take `{team}` explicitly (`routes/guest.php`: `app/guest-payments/{team}/periods`), so **one public funnel serves all institutes** — the closest thing to ASchool's multi-tenancy without real tenancy.
- Role/permission import between different installations (`app/Services/...` + "Import Role & Permission between different Installation" in v4.10 changelog) — a migration aid for their own installed base.

### 2.2 Website + portal fusion (the single most instructive pattern)

1. **Menus are the site map**: a `site_menus` row has slug + optional `page_id`; `SiteService::getPage()` (`app/Services/SiteService.php`) resolves menu → page, builds breadcrumbs from parent menus, reads per-page SEO (`meta_title/description/keywords` stored in page `seo` JSON).
2. **Pages are structured markdown with layout markers**: content is parsed (`MarkdownParser` support trait, incl. math via league/commonmark) then `#SECTION#…#SECTION#` and `#CONTAINER#…#CONTAINER#` markers are regex-expanded into Tailwind flex layouts; **named Blocks** referenced inside are hydrated from `site_blocks` (with `position`, assets, `menu_id` links) and rendered by theme partials `resources/views/site/default/{announcement,blog,cta,event,gallery,news,index,page}.blade.php`.
3. **Only 4 block types** (`app/Enums/Site/BlockType.php`): `slider, accordion, stat_counter, testimonial` — plus CTA/event/news/gallery/blog blades. The "builder" is deliberately tiny; the flexibility comes from markers + arbitrary markdown, not a widget zoo.
4. **Same-domain continuity rules**: if a menu has no page (or slug unknown), `SiteService` **redirects to `/app`** (the portal SPA). So the public site and the login-gated app are one brand, one URL space, one install.
5. **The guest funnel is the fusion's engine** (`routes/guest.php`, all behind `feature.available:*` flags + `guest` middleware): online enquiry (wizard) → registration (wizard with document uploads, photo, verification, minimal vs full variants, find/verify endpoints, printable form) → **registration fee payment online** → admission conversion (seat-wise via `enrollment_seats`). Plus: **guest fee payment** (find student → see fee detail → pay, `GuestPaymentController`), **public transfer-certificate verification** (`app/transfer-certificate/verify`), **public job applications**. No login ever required.
6. SPA gets a read API for the same content: `/app/pages/{slug}`, `/app/site/posts` (`routes/api.php`, `SiteController::pageView`, `Site\View\PostController`) — so the mobile/companion surface can render site content too.

### 2.3 Config-as-data everywhere

- One `configs` table, team-scoped, seeded from `resources/var/config.json`: **418 options across 37 groups** — `system(23), feature(14), notification(14), auth(27), assets(7), mail(8), sms(16), whatsapp(22), site(4), student(55), employee(45), finance(76), reception(17), exam(4), resource(15), inventory(16), transport(7), task(6), helpdesk(6), …`
- Each option has an **`is_public` flag**; public ones ride to the SPA in the boot payload (`GET /api/config` with `optional.auth:sanctum`, `routes/api.php`). The SPA never hardcodes formats — date/time format, currency, direction (LTR/RTL), color scheme all arrive as config.
- 14 **feature flags** (`config.json → feature`): enable_todo, enable_backup, enable_activity_log, enable_online_registration (+ instruction text fields), enable_post, enable_guest_payment, enable_job_application, enable_transfer_certificate_verification. The `feature.available` middleware makes guest flows toggleable per install without deploys.
- Master data uses an `options` table with `OptionVerifier` middleware and import/reorder endpoints (`routes/app.php` Option section) — i.e., lists like blood groups, religions, document types are user-editable rows, not enums.
- **Document numbering as config**: every document type has prefix/digit/suffix options, many with date tokens — e.g. `finance.payment_number_prefix = TP%YEAR_SHORT%%MONTH_NUMBER_SHORT%`, `receipt_number_prefix = TR%YEAR_SHORT%%MONTH_NUMBER_SHORT%`, student `registration_number_prefix = SM`, provisional admission `PSM`, announcements `CASM` (`config.json` groups student/finance). 76 finance options alone include custom bank-code fields (bank_code1..3 with labels + required flags) and currency denominations for cash counting.
- **Auth is a config surface** (27 auth options): enable_registration, email verification, **account approval**, 2FA toggle, OAuth per-provider (Google/Facebook/Twitter/GitHub/Microsoft client id/secret stored as options), OTP login, login throttle limits, reset token lifetime (`config.json → auth`; realized in `routes/auth.php` + `app/Http/Controllers/Auth/OAuthController.php`).

### 2.4 The three domain engines worth studying

**Fee engine (16 migrations, `database/migrations/create_fee_*.php`):** `fee_groups → fee_structures → fee_structure_components → fee_components → fee_heads` (heads carry tax, `update_fee_heads_table_with_tax_column.php`); allocation via `fee_allocations` + `student_fees → student_fee_records → student_fee_payments`; installments (`fee_installments` + records) with per-installment concession restrictions (v4.10); concessions with records + logs + round-off (v5.2); refunds (`fee_refunds` + records); gender-wise fee structures (v5.0); sibling fee linkage (v4.9); transport fees ride the same engine (`create_transport_fee_records_table.php`). Payment services split by flow: `app/Services/Student/{PaymentService, OnlinePaymentService, HeadWisePaymentService, MultiHeadWisePaymentService, GuestPaymentService, AnonymousPaymentService, RegistrationPaymentService, OnlineRegistrationPaymentService, GuestRegistrationPaymentService}.php` — **nine distinct payment flows sharing one gateway layer**.

**Timetable engine (`app/Models/Academic/`):** `Timetable → TimetableAllocation → TimetableRecord`, with `ClassTiming → ClassTimingSession` (multiple session allotments, v4.7), `Period` (per session/division/batch, archivable — v5.3), rooms as subjects of allocation (`TimetableAllocation.php` belongsTo Room, Subject, Employee), subject-incharge with multiple batches (v4.1), teacher timetable + batch-wise print (v5.3/v4.1), division/course/batch-wise period update (v4.9). Teacher-conflict-free scheduling by construction: allocation is teacher+room+session aware at the model level.

**Attendance engine:** `student_attendances` + `attendance_types` (custom types per student, v5.5) + `AttendanceSession` enum (morning/day/half-day — v4.10 "Half Day Leave" precedent), elective-subject attendance via `subject_wise_students` (`create_subject_wise_students_table.php`), QR-code marking endpoint (`POST /attendance/qr-code`, `POST /attendance/mark` in `routes/app.php`), student clock in/out (v5.1, `create_student_timesheets_table.php`), attendance migration when course/batch changes (v5.2), biometric timesheet ingestion (`routes/integration.php`), attendance-assistant role, past-day edit limit (`student.attendance_past_day_limit = 7` in config.json), employee attendance + work shifts + timesheets (`create_employee_attendances/records/work_shifts_table.php`).

### 2.5 Workflow patterns worth cloning

- **Edit-request pattern**: students/employees/guardians can't touch core records; they file edit requests (contact/employee/student edit-request tables + `RequestRecord`, `Emergency Contact Detail in Student & Employee Edit Request` in v5.2) which staff approve. Change-control for a school context.
- **Generic approval engine**: `approval_types/levels/requests` — any workflow can define multi-level approvals (v5.1 "Multi-level Approval Module"), consumed by `app/Http/Controllers/Approval/`.
- **Day closure / day book**: cashier accountability — `create_day_closures_table.php`, "Day Book with User-wise Collection" (v5.3), transaction vouchers + print, transaction categories. Financial audit trail at the counter level, not just the ledger.
- **Exam data model**: Terms → Exams → Schedules; marks as Records; Grades; **Assessments** (rubric-ish), **Observations** + `ObservationMarkService`, **Competencies** + records (competency-based evaluation, v5.4 — NEP-flavored), exam forms (registration for exam + admit card print), mark auto-lock, weightage, credit-based marksheet service (`app/Services/Exam/CreditBasedMarksheetService.php`, `CumulativeMarksheetService.php`).
- **Device/integration ingestion**: `devices` table (`app/Models/Device.php`, team-scoped, `meta` JSON), biometric pushes raw timesheets to `POST /attendance/timesheet` + `POST /attendance/import` with `throttle:biometric` (`routes/integration.php`); Tally transactions export endpoint for accountants.
- **Print pipeline**: every list has an mPDF print template under `resources/views/print/{academic,student,finance,exam,employee,transport,inventory,library,reception}/` with shared headers (`exam/header.blade.php`), signatory blocks (`exam/signatory.blade.php`), certificate templates with variable substitution (`resources/var/certificate-template-variables.json`), ID-card templates (`resources/var/id-card-templates.json`), custom certificate numbering (v5.3).
- **Bulk onboarding**: 39 Export/Import classes + `DownloadFormatController` (`routes/web.php`) serving downloadable sample import formats; imports exist for students, guardians, courses, batches, stock items/categories, roles/permissions, transactions, custom fees, transport stoppages.
- **Hardening middleware stack** (`app/Http/Middleware/`): `TwoFactorSecurity`, `ScreenLock` (idle lock), `XssProtection`, `UnderMaintenance`, `RestrictedActionInTestMode` (test-mode guard), `FeatureAvailable`, `OptionVerifier`, per-route throttles (`throttle:otp`, `throttle:biometric`), failed-login-attempt surfacing + IP blacklist/whitelist (v4.10), forced password change (`ForceChangePasswordController.php`), user impersonation with unimpersonate (`routes/app.php`), login via email/SMS OTP (v5.0), user access logs per login (v5.5).

---

## 3. UI/UX Patterns

- **One SPA, all roles.** `/app/{any}` catch-all (`routes/web.php` lines 74–80) boots a single Vue 3 app for admin, teacher, accountant, student, guardian. Role-based menus + permission-filtered routes; "Show/Hide Menus" + "Menu Reorder" (v4.2/v5.1) let each install curate its own nav.
- **Extreme code splitting**: 957 prebuilt chunks (e.g. `Absentee-ClX5ISR1.js`, `ExamReport-D6d7eMXk.js`) — one chunk per screen/action/dialog, gzipped. Navigation is effectively per-view lazy loading; no mega-bundle.
- **Dashboard is endpoint-per-widget** (`routes/app.php` Dashboard section): `dashboard/stat`, `student-chart-data`, `transaction-chart-data`, `employee-attendance-summary`, `schedule`, `timetable`, `transport-route`, `mess-schedule`, `institute-info`, `form-list`, `gallery`, `celebration`. The role sees a widget grid assembled from whatever it has permission for — birthday/celebration widget (v4.8), pinned announcements & events on the wall feed (v5.0), student/employee timetable in the feed (v4.1), fee concession & course-wise fee charts (v5.3).
- **Keyboard-first polish** (v4.1): keyboard navigation for student/employee search and for menus — rare in this market.
- **Report hub as a page, reports as services**: `routes/report.php` + `resources/views/reports/{student,finance,exam}/index.blade.php` render filter UIs outside the SPA on the site layout, each backed by a dedicated `app/Services/**/Report/*Service.php` (e.g. `app/Services/Finance/Report/HeadWiseFeePaymentService.php`, `PaymentMethodWiseFeePaymentDetailListService.php` — note the combinatorial naming: every report has a List + Detail + Export variant).
- **Everything prints.** Receipts, vouchers, marksheets (4 variants), admit cards, exam forms, ID cards (students, employees, **parents/guardians** v5.0), certificates (transfer certificate with **public verification**), payroll salary sheets + payment advice, timetables (batch-wise, teacher-wise v5.3), sibling lists, online registration forms. Templates are Blade + mpdf, header/signatory partials shared.
- **Public site UX**: two maintained themes (`default`, `modern`) + `custom` mode (custom theme edited via CodeMirror — `@codemirror/lang-*` chunks in `public/build/assets/manifest.json`), homepage blocks (slider/stat counter/testimonial/accordion/CTA), news/blog with category+tag archive routes (`routes/site.php` `/b/{slug}/category/{cat}`), event/announcement/gallery detail pages with SEO, FAQ module (v5.3), alumni events, downloadable book lists per course.
- **Mobile approach**: no app ships in this repo. v4.7 added "Mobile Application Support" = the same `/api/app/*` API + `devices` table + push templates + `testAppNotification` config endpoint (`routes/app.php`). Any Flutter/RN app is a separate SKU riding the API. Responsiveness is Tailwind-based (site blades use `md:flex-row` etc.); the SPA is desktop-first with mobile-tolerant layout.
- **Chat & realtime**: Pusher-backed chat for `observer` role (`chat:access`), realtime post comments; `notification.mp3` in `public/` for in-app notification sound.

- **Portal UX for students/guardians (their 29 permissions):** the SPA renders a read-mostly portal: own profile + attendance list + subject-wise attendance, fee allocation/payment history with online payment and downloadable receipts, exam schedule + marksheet access, online exam attempts, announcements/events/gallery, assignments + submissions, diary, learning materials, online class links (join window enforced by `resource.online_class_joining_period` minutes, `app/Models/Resource/OnlineClass.php`), complaints (create/edit own), leave/service/transfer requests, dialogue thread with the institute, wall read + comment, todos. **Every write is mediated**: no direct profile edits (edit requests instead), no content creation. Sibling view (v4.9 "Sibling record in Student Fee Payment") lets one guardian account see/pay across children.
- **Auth UX depth**: login via password, email OTP, or SMS OTP (v5.0); account approval + email verification toggles; OAuth (5 providers); 2FA (`TwoFactorSecurity` middleware); `ScreenLock` (auto-lock UI after idle); forced password change toggle per user (`routes/app.php` `toggle-force-change-password`); impersonation (`UserImpersonationController.php`) for support; login-as-support token route (`LoginAsSupportController.php` in `routes/web.php`).

---

## 4. What ASchool Lacks (InstiKit features we don't have — with evidence)

Verified against `backend/app/plugins/modules/` (44 plugins: academics, admission, ai_*, alumni, assignments, attendance, basic_reports, basic_website, biometric, compliance, conferences, design_studio, dismissal, disaster_management, elibrary, emergency, exams, fees, file_management, gamification, gps_tracking, health_records, hr_payroll, iemis_importer, incident_management, incidents, inventory, library_management, lms, multi_branch, nepal_curriculum, notices, sms_notifications, student_portfolio, timetable, visitor_management, website_builder, wellbeing, whatsapp_bot, white_label) and `backend/app/api/v1/` (60 route files).

**High priority (revenue/completeness gaps):**

1. **Admission funnel depth** — we have `admission` plugin, but InstiKit's chain enquiry → registration → admission is end-to-end online: wizard forms with per-step document upload, registration fee payment, verification codes, printable forms, enquiry-to-registration and registration-to-admission conversion, seat-wise enrollment (`routes/guest.php`, `create_enrollment_seats_table.php`). Our funnel exists but "online registration fee + verification + seat caps + printable forms" are not evidenced anywhere in `backend/app/api/v1/admission.py`.
2. **Guest fee payment without an account** (`routes/guest.php`: `app/guest-payments/{student}/initiate|complete|fail` + anonymous variant) — parents pay by finding the student; no login needed. Our fees flow lives in the parent app (`flutter_parent/lib/features/fees/`). A public "pay fees" page per school website is an easy, high-conversion steal.
3. **Public transfer-certificate verification** (`app/transfer-certificate/verify`) — any school can authenticate a leaving certificate online. Zero cost, big trust win. Nothing similar in `api/v1/students.py` or `exams.py`.
4. **Recruitment/job board** — vacancies + public applications (`create_job_vacancies_table.php`, `Recruitment/Job/VacancyController.php`). Our hr_payroll has no hiring surface.
5. **Day closure / day book / transaction vouchers** (`create_day_closures_table.php`, v5.3) — counter-level cash accountability. Our fees module (eSewa/Khalti/FonePay, refunds, idempotency) is strong on digital but has no cashier day-closure concept.
6. **Front-desk suite**: gate pass, call log, correspondence (`create_gate_passes_table.php`, `create_call_logs_table.php`, `create_correspondences_table.php`). We have visitor_management + dismissal; gate pass and front-desk logs are missing.
7. **Mess/cafeteria module** (`app/Services/Mess/`, meal logs, menu items, mess schedule dashboard widget) — absent from our 44 plugins.
8. **Generic approval workflow engine** (`create_approval_types/levels/requests_table.php`) — we have per-feature approvals at best; a reusable multi-level engine would power leave, expenses, content publishing, multi_branch.
9. **Edit-request pattern** (`ContactEditRequest`, student/employee edit requests) — self-service data correction with staff approval; fits our wellbeing/compliance posture. Not in `api/v1/users.py`/`students.py`.
10. **Asset/building registry** (`app/Http/Controllers/Asset/`, rooms/floors) — we have inventory only.
11. **Helpdesk tickets** (`create_tickets/assignees/messages_table.php`) — internal + parent support desk with assignment. We ship `faqs.py` only.

**Medium priority:**

12. **Certificate + ID-card template engines** with variable substitution and custom numbering (`resources/var/certificate-template-variables.json`, `IdCardTemplate.php`) — our design_studio covers posters/sites; academic certificate/ID generation with verification is a distinct, sellable surface.
13. **Custom form builder** (`create_forms/form_fields/submissions*_table.php`) — generic forms for surveys/club signups; nothing similar in our plugin list.
14. **Employee full-cycle depth**: work shifts, biometric timesheet ingestion endpoints (`routes/integration.php`), payroll with conditional formulas + pay heads + bulk processing + payment advice print. Our hr_payroll + biometric exist but hiring, shifts, and Tally-style export are absent.
15. **Vehicle lifecycle records**: fuel, service, expense, case records per vehicle (`create_vehicle_*_records_table.php`) — our gps_tracking does live tracking (which InstiKit entirely lacks) but fleet maintenance books are missing.
16. **Inventory depth**: requisitions, transfers, returns, adjustments, item copies, vendor statements (`app/Http/Controllers/Inventory/` 33 files, `VendorStatementService.php`).
17. **Competency/observation-based evaluation** (`app/Models/Exam/Competency.php`, `Observation.php`, `CompetencyEvaluationService.php`) — relevant to Nepal's NEP shift; our nepal_curriculum + exams should absorb this.
18. **Alumni events** (v4.1 "Alumni Module, Events for Alumni") — we have alumni; event tie-in unclear.
19. **Library reports + book copies/fines granularity** — elibrary exists; compare fine/copy management depth.
20. **Import/export polish**: downloadable sample formats per import (`DownloadFormatController`), bulk update of student/employee details, import of transactions/guardians/courses/batches/stoppages/roles.
21. **Ops UX**: user impersonation, force password change, screen lock, IP blacklist/whitelist, failed-login surfacing, user access logs (v5.5), activity log viewer UI. We have TOTP MFA + lockout (stronger) but lack the admin *visibility* surfaces (access logs, view logs).

**Lower priority / polish:**

22. **Document numbering series as config** (prefix/digit/suffix with date tokens for receipts, payments, registrations, transfers, expenses, announcements — `config.json`) — we hardcode number formats; schools ask for these constantly.
23. **Engagement layer**: wall feed with pinned posts, realtime chat, dialogue threads, service requests, reminders with notifications, celebration/birthday widgets, gallery watermarking. Our notices + WhatsApp bot cover broadcasting; the *in-portal conversational* layer (dialogue + service request + complaint with logs, `create_complaint_logs_table.php`) is absent.
24. **Examination ops**: exam form (student exam registration) + admit card printing (`resources/views/print/exam/exam-form*.blade.php`), mark locking (v5.4 "Improved Locking of Exam Marks"), weightage records (v5.3), credit-based and cumulative marksheets. Our exams module is strong on authoring (question bank) but the *operations* side (forms, admit cards, locks, board-style marksheet layouts) is thinner.

---

## 5. What ASchool Does Better (honest assessment)

1. **True multi-tenancy.** InstiKit's Organization/Team is an *intra-install* grouping: one DB, one codebase, shared config namespace, and the license forbids reselling (one install per purchase). ASchool is real SaaS: per-school slugs + SSR sites (`{slug}.aschool.com.np`), tenant-scoped everything, onboarding without ops. InstiKit cannot onboard a school without a server.
2. **Scale & delivery.** InstiKit ships `QUEUE_CONNECTION=sync`, `CACHE_DRIVER=file`, `SESSION_DRIVER=file` (`.env`) — i.e., out of the box it doesn't even use its own queues/redis; realistic deployments are single-server MySQL. ASchool: Pg16 + Redis 7 + Celery beat + Socket.IO + Firebase RTDB (`backend/README.md`). 1,410 route statements in one Laravel app with 696 service classes is maintainable, but there's no horizontal story, no read replicas, no per-tenant isolation.
3. **Mobile.** InstiKit has **no app** — API hooks only. ASchool has 5 Flutter apps (admin/teacher/parent/student/user) sharing `aschool_shared` with queued token refresh. For Nepal parent engagement, this is decisive.
4. **API-first & ecosystem.** InstiKit's API is private to its own SPA — no public API docs, no webhooks, no third-party integration story beyond Tally/biometric push endpoints. ASchool has versioned `/api/v1` (60 modules, ~706 route decorators), webhooks (`api/webhooks/`), SSE + Socket.IO realtime.
5. **Nepal localization.** Verified absence in InstiKit: no BS calendar (no Bikram Sambat anywhere under `app/`, `lang/`; date formats are Gregorian templates in `config.json`), no iEMIS, no SEE/NEB grading, no Nepali gateways (no eSewa/Khalti/FonePay), default timezone Asia/Kolkata + USD. ASchool owns all of these (`iemis_importer`, `nepal_curriculum`, BS utils, Sparrow SMS, eSewa ePay v2/Khalti v2+FonePay with refunds and idempotency).
6. **AI.** InstiKit has none (no AI references outside our imagination — verified grep). ASchool: ai_suite, ai_teacher, adaptive learning, ai_tutor, token-hub quota gateway.
7. **Realtime tracking.** InstiKit transport = routes/stoppages/fees/vehicle records; **no GPS, no live tracking, no parent notification on arrival** (verified: no gps refs under `app/Services/Transport/`). ASchool's ESP32→RTDB→Socket.IO live map is a category they don't play in.
8. **Security depth.** InstiKit: 2FA middleware, XSS middleware, purifier, failed-login table — decent, but a nulled distribution circulating publicly with `.env` shipped (APP_KEY included in the package!) is its real security posture. ASchool: TOTP MFA, ClamAV, bleach sanitization, CSRF origin guard, JWT+cookie rotation with revocation, strict CSP, boot-time refusal without configured SMS.
9. **Content/collaboration categories InstiKit lacks entirely**: question bank (verified absent — online exams only have 3 question types: `app/Enums/Exam/OnlineExamQuestionType.php`: mcq, single_line, multi_line; a **file-upload type is commented out**), LMS with courses/progress, video conferencing (online class is just a stored URL — `app/Models/Resource/OnlineClass.php`), gamification, wellbeing, disaster/emergency/dismissal, student portfolio, compliance, white label.
10. **Website architecture.** InstiKit's site builder is one-site-per-install with 4 block types and regex-expanded markdown. ASchool's website_builder/design_studio does per-school SSR/ISR Next.js sites with real multi-tenant theming — better SEO, better perf, better ops. (InstiKit's *fusion* with the portal on one domain is the one thing theirs does more cleanly — see §6.)

**Parity scorecard (category by category):**

| Category | InstiKit v5.5 | ASchool |
|---|---|---|
| Multi-tenancy | Organization/Team in one install (§2.1) | Real SaaS, per-school subdomains + SSR sites — **win** |
| Public website | Built-in, 2 themes, 4 block types, portal on same domain | website_builder + basic_website + design_studio — **win**, minus fusion (§6.2) |
| Admission funnel | Enquiry→Registration(+fee, verification)→Admission, guest flows | admission plugin, funnel depth thinner — **gap** |
| Fees | 16-table engine, 9 payment flows, 10 gateways, day closure | eSewa/Khalti/FonePay, refunds, idempotency — **parity on rails, gap on counter ops** |
| Exams | Marks ops (forms, admit cards, marksheets ×4, locks, competency) | Question bank + authoring — **split** |
| Attendance | Types, sessions, QR, clock-in/out, biometric ingest | attendance + biometric plugins — **parity** |
| Transport | Routes/fees/vehicle records; **no GPS** | GPS live tracking + notifications — **win** |
| LMS / question bank / conferencing | LMS-lite only, no question bank, URL-only classes | lms, elibrary, exams question bank, conferences — **win** |
| HR | Shifts, payroll formulas, recruitment, bulk payroll | hr_payroll + biometric; no hiring — **parity** |
| AI | None | ai_suite/ai_teacher/adaptive — **win** |
| Mobile | None bundled (API hooks) | 5 Flutter apps — **win** |
| Nepal | None (no BS/iEMIS/SEE/NEP gateways) | Core identity — **win** |
| Workflow/approvals | Generic multi-level engine + edit requests | Per-feature only — **gap** |
| Scale story | Single server, sync queues by default | Pg16/Redis/Celery/Socket.IO/RTDB — **win** |

---

## 6. Organization Lessons (for our plugin marketplace & website builder)

1. **Steal the guest funnel wholesale.** A school's website should end in actions, not brochures: `enquiry → registration(+fee) → admission`, `pay fees (no login)`, `verify a certificate`, `apply for a job`, `raise an enquiry` — each as a feature-flagged public endpoint (`feature.available` pattern, `routes/guest.php`). Concretely: add `public_funnel` capabilities to our `admission` and `fees` plugin manifests, exposed through website_builder page blocks. This is the single highest-leverage idea in the whole codebase.
2. **The redirect trick**: when a public page slug doesn't resolve, redirect to the portal login instead of 404 (`app/Services/SiteService.php::getPage`). Website and portal share one domain, one brand, one cookie journey. Our `{slug}.aschool.com.np` sites + `app.aschool.com.np` portal should adopt a branded hand-off (school-branded login screen when coming from a school site).
3. **Blocks should be few and named, not a widget supermarket.** InstiKit ships 4 block types + content blades; pages are markdown with `#SECTION#`/`#CONTAINER#` markers referencing named reusable blocks. For our website_builder: reusable named blocks with position + assets + `menu_id` linkage beats 50 page-builder widgets; it also makes blocks portable across schools (marketplace SKU-able).
4. **Menus are the information architecture.** Model the site as menus→pages (with parent breadcrumbs + per-page SEO JSON), and let non-page menus point to blocks or modules (events, gallery, blog archives at `/b/{slug}/category/{cat}`). Our website_builder should ship this primitive rather than free-form pages only.
5. **Config-as-data with `is_public`.** One settings table + JSON seed + public flag consumed by the SPA boot payload. Our Next.js/Flutter apps currently hardcode more than they should; a `GET /config` boot payload with per-school public settings (currency, BS/AD format, colors) would simplify 5 Flutter apps + 216 web pages.
6. **Build the two reusable workflow engines**: (a) multi-level approval (`approval_types/levels/requests`), (b) edit-request-with-approval. Both are cross-plugin (leave, fees concession, content, multi_branch ops) and would give our marketplace a "workflow" category instead of N bespoke implementations.
7. **Permission matrix as a shipped file.** `resources/var/permission.json` (17 roles × full matrix) doubles as documentation and seed. Our plugin manifests list permissions per plugin; add a shipped role→permission default matrix so new tenants get sensible roles (principal, accountant, exam-incharge, receptionist…) on day one.
8. **Import/export as an onboarding feature.** Downloadable sample formats per import (`DownloadFormatController`), imports for every master data type, delete-imported-students-at-once (v4.3). For school migrations (including from InstiKit installs), our iemis_importer should grow a generic "import anything with a sample file" UX.
9. **Ship a public changelog with monthly cadence.** InstiKit's README version log (17 releases/15 months, each with named features) is half its sales pitch. Our `docs/` should carry a public-facing release log; our marketplace should render per-plugin changelogs from manifests.
10. **Dashboard = widgets = endpoints.** Role dashboards assembled from small permission-gated endpoints (`dashboard/celebration`, `dashboard/timetable`, `dashboard/mess-schedule`) let plugins contribute widgets via manifest — a natural extension of our plugin system (declare dashboard widgets in `manifest.yaml`, render whatever the role can see).
11. **Counter-grade finance controls sell to accountants.** Day closure, day book user-wise collection, transaction vouchers/categories, cheque clearing, payment-link QR. Nepali school front offices run on cash/cheque; our digital-gateway excellence needs these analog complements.
12. **Licensing framing**: Envato Regular (1 instance) vs Extended (multiple instances, commercial) is exactly our marketplace's future (per-school vs white-label agency). Their "Import Role & Permission between different Installation" acknowledges the pain of per-instance ops — our central SaaS is the answer; market it against exactly that pain.
13. **Exportable site presets are a marketplace primitive.** InstiKit ships `app/Http/Controllers/Site/BlockExportController.php` and `PageExportController.php` — pages and blocks export as files and re-import into any install. For our website_builder, sell/distribute school-website presets (admissions-focused, kindergarten, +2 college) as installable page/block bundles; plugin manifests can carry `website_presets` alongside routes and permissions.
14. **Nine payment flows, one gateway layer** (§2.4): separate services for online/guest/anonymous/registration/guest-registration/head-wise/multi-head flows all funnel into the same `PaymentGateway/*` classes with shared initiate/complete/fail callbacks. Our fees plugin should grow payment contexts the same way (admission fee, event fee, guest fee) instead of one monolithic pay endpoint — each new context is then a manifest flag, not a fork.

---

## Appendix: Verification Notes

- **Not WordPress**: `INSTIKIT/composer.json` (`laravel/framework ^12.0`, no WP packages); `artisan` at root; `README.md` v4.0.0 changelog "Rewritten from scratch with latest version of Laravel, Vue.js & Tailwind CSS".
- **Module tree**: `resources/var/modules.json` (33 top modules, printed in full during audit).
- **Roles/permissions**: `resources/var/permission.json`; student/guardian permission sets verified identical (29 each).
- **Guest funnel**: `routes/guest.php` read in full; every route flagged with `feature.available:*`.
- **Gateways**: 10 classes in `app/Services/Finance/PaymentGateway/`; no Nepal gateway (grep for esewa/khalti/fonepay/connectips: no hits).
- **Nepal features**: grep for `nepali|iemis|bikram|bs calendar` across `app/ lang/ config/ resources/var/` → no hits (only `country.json` contains Nepal as a country row).
- **No GPS**: no gps/live-tracking refs under `app/Services/Transport/` or `app/Models/Transport/`.
- **No question bank / no conferencing**: greps for `question_bank`, `zoom|jitsi|agora|webrtc` → only `app/Enums/Resource/OnlineClassPlatform.php` (URL template platform enum); `OnlineClass` stores a `url`.
- **No subscription/billing** (it's a per-license download): grep `subscription|billing_plan` in models → no hits.
- **No license-check code** in the shipped copy (nulled) — licensing terms come from `README.md` only.
- **Multi-institute**: `app/Models/Team.php` (`organization()` belongsTo, `scopeAllowedTeams`), `update_configs_table_with_team_id_column.php`, `{team}` params in `routes/guest.php`.
- **ASchool side**: `backend/app/plugins/modules/` (44 dirs), `backend/app/api/v1/` (60 files, 706 route decorators), `backend/README.md` (5 apps, stack), prior audit format from `docs/competitor-audits/eschool-v3.3.6.md`.
