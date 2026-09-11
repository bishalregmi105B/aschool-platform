# Competitor Audit: Mighty School Pro v1.6 (Codecanyon 57385565, FueDevs LTD)

- **Audited**: 2026-09-11
- **Source**: `Other Projects/Mighty School Pro v1.6/.../codecanyon-57385565-mighty-school-pro-school-management-system-erp-multibranch-saas-all-in-one/` — three deliverables:
  - `install-api-code-v1.6_x/` — Laravel 11 API + web installer (the canonical backend)
  - `updated-api-code-v1.6_x/` — patched shared `app/` kernel (1,470 files: Traits, Jobs, Mail, Helpers, Enums)
  - `web-app-desktop-code-v1.6_x/web-app-desktop-code-v1.6/` — Flutter app ("web + desktop", also Android/iOS)
  - A second local copy exists at `/home/bishal-regmi/Desktop/ASchool/Mighty School Pro v1.6` (identical; skimmed, no extra info). Note: the bundled "Online Documentation (Updated).html" is a redirect page to a nulled-script site — provenance is unofficial, but the code is complete and self-consistent.
- **Purpose**: deep audit against **ASchool** (Nepal-focused multi-tenant school SaaS: Flask ~756 endpoints, pgvector, Celery, 50 plugins, Next.js 216-page manifest-driven dashboard, 5 Flutter apps, iEMIS / BS dates / SEE-NEB / eSewa / Khalti / Sparrow).
- **Headline**: marketing says "Multibranch SaaS All-in-One". The SaaS layer is quota middleware + manual renewals with a broken trial-provisioning bug; a "branch" is a name column on a table; the multi-tenant story is two integer columns and hand-written `where()` clauses with zero global scopes. Meanwhile the accounting + payroll + fees depth is genuinely strong, and the entire UI is a single Flutter codebase — not Next.js, not Blade.

---

## 0. Verdict in 10 bullets

1. **Architecture surprise**: there is *no* Blade admin panel and no Next.js. The entire UI — public marketing site, admin panel, student/parent portals — is **one Flutter (GetX) app** (1,858 dart files, 197 routes) deployed as web + Windows/macOS/Linux desktop + Android/iOS from a single codebase (`web-app-desktop-code-v1.6_x/.../lib/`). The Laravel side is a pure JSON API (19 nwidart modules, 456 API routes) plus payment-gateway host pages.
2. **The "multibranch SaaS" claim is thin**: a Branch is just `institute_id, name, status` (`Modules/Authentication/app/Models/Branch.php`). No branch settings beyond a branch-scoped `settings` table, no branch admins, no cross-branch consolidated reporting, no branch-scoped pages. "Changing branch" literally **overwrites the logged-in user's `branch_id` column** (`Modules/SystemConfiguration/app/Http/Controllers/API/UtilityController.php::changeBranch`) — one branch at a time.
3. **SaaS billing is manual and partially broken**: `Plan` = `student_limit, branch_limit, price, duration_days` (`Modules/Authentication/app/Models/Plan.php`); renewal = super-admin records a payment by hand (`OnboardingsController::upgrade`); tenant upgrade-request queue exists. The trial created on tenant approval is **hardcoded to `institute_id => 1`** (`OnboardingsController.php` ~line 139), so newly approved tenants get no subscription and `CheckSubscription` would 403 them.
4. **Dangerous leftovers**: `app/Console/Kernel.php` schedules `system:reset` **every minute**, and that command runs `migrate:fresh` + reseed on the production DB (`app/Console/Commands/ResetSystemData.php`). Also: IDOR in `BranchController::update/destroy`, `changeBranch` without ownership validation, a SQL backup endpoint using `addslashes` writing into `uploads/`, `demo.sql` shipped in the web root, and the ChatGPT API key hardcoded in Flutter source.
5. **Where it is genuinely strong**: **double-entry accounting** (chart of accounts, groups, categories, ledgers, journal/receipt/payment/contra/fund-transfer, funds; full statements — `Modules/Accounting/`, 31 API routes), **payroll with accounting integration** (`Modules/Payroll/Models/PayrollAccountingMapping.php`), and a **fees engine** (heads/sub-heads/mapping/amount+date config/waivers/fines/quick-collection/unpaid reports).
6. **Exam & assessment depth**: offline exam engine (mark configs per exam+code, grades, remarks, merit types, grand-final class exams, exam attendance, admit cards + seat plans, result cards) *plus* a question-bank taxonomy of 15 dimensions (`Modules/QuestionBank/Repositories/`) and quiz delivery with per-quiz fines.
7. **Print-first discipline**: ID cards, transfer certificates, testimonials, result cards, payslips, admit cards, seat plans, 9 certificate types — server print routes in `routes/web.php` + client-side `pdf`/`printing`; blade PDF layouts in `resources/views/layouts/pdf`.
8. **Nepal relevance ~zero**: currency `$`/USD, timezone `Asia/Dhaka`, gateways Stripe/PayPal/RazorPay/Paytm/Paystack/Flutterwave/SSLCommerz/MercadoPago/Paymob/Paytabs/LiqPay/SenangPay/PVit/bKash; SMS via Twilio/Nexmo/Msg91/Releans/Hubtel/SignalWire/SmsTo/ViaTech/Paradox/Alphanet/Akandit/GlobalSMS/SMS019/2Factor — no eSewa/Khalti/FonePay, no Sparrow, AD dates only, locales `en`+`bn`.
9. **AI is a marketing veneer**: one Flutter chat screen wired to `chat_gpt_sdk` with a compile-time API key constant (`lib/util/app_constants.dart`). No tools, no tutor context, no prompt engineering.
10. **Most transferable ideas for ASchool**: the per-domain "startup → map → configure → execute → report" wizard pattern; permission-named sidebar keys shared 1:1 between backend permissions and menu gating; per-institute public website CMS + public "apply for institute" onboarding funnel; device-limit control for e-learning content; SMS balance purchasing + template short-codes.

---

## 1. INVENTORY — codebase map and counts

### 1.1 Raw counts (Laravel backend, vendor skipped)

| Artifact | Count | Evidence |
|---|---|---|
| nwidart Laravel modules | 19 | `install-api-code-v1.6_x/Modules/` |
| Route definitions | 534 in modules (456 API + 78 web) + 28 in root `routes/` | `grep -c "Route::" Modules/*/routes/*.php`; root `routes/api.php` (8), `routes/web.php` (20) |
| Module route files | 33 (19 `api.php`; only Gateways (55) and Library (23) use `web.php` meaningfully) | `Modules/*/routes/` |
| Controller classes | 172 | `find Modules app -name "*Controller.php"` |
| Model classes | 185 | `find Modules app -path "*Models*"` |
| Migrations | ~201 module + 4 root | `Modules/*/database/migrations/`, `database/migrations/` |
| Seeders | 58 | `find Modules -name "*Seeder.php"` |
| Automated tests | 5 files | `find Modules tests -name "*Test.php"` — effectively untested |
| Spatie permissions seeded | 166, named `domain.action` | `Modules/Authentication/database/seeders/PermissionSeeder.php` |
| Locales (backend) | 2: `en.json`, `bn.json` | `install-api-code-v1.6_x/lang/` |
| Database | MySQL (`SHOW TABLES` raw usage) | `Modules/SystemConfiguration/app/Http/Controllers/API/UtilityController.php` |
| Queues / websockets / search / vector | none (one `SendSmsJob.php` exists; its scheduler line is commented out) | `updated-api-code-v1.6_x/app/Jobs/SendSmsJob.php`, `app/Console/Kernel.php` |
| Default timezone/currency | `Asia/Dhaka`, `$`/USD | `OnboardingsController.php` default settings rows; `lib/util/app_constants.dart` |

### 1.2 Per-module breakdown (controllers / models / API routes)

| Module | Ctrl | Models | API routes | What it owns |
|---|---|---|---|---|
| Academic | 32 | 45 | 65 | classes, sections, shifts, subjects, routines, attendance, migration, device control, notices, events, custom fields |
| Student | 5 | 2 | 49 | student CRUD/bulk import, student auth (password + OTP), student dashboard, assignments, student quiz |
| Authentication | 16 | 13 | 47 | users, roles, permissions, institute, branch, plans, subscriptions, onboarding, SaaS settings |
| Elearning | 13 | 14 | 39 | courses, lessons, chapters, contents, enrollment, zoom, quizzes |
| Frontend | 10 | 14 | 32 | public website CMS (banners, testimonials, policies, onboarding, themes) |
| Finance | 10 | 14 | 31 | fee heads/sub-heads, mapping, collections, waivers, fines, digital payments |
| Accounting | 6 | 8 | 31 | chart of accounts, journal, contra, funds, 11+ financial reports |
| ParentModule | 2 | 2 | 28 | parent portal over children (11 view domains) |
| QuestionBank | 21 | 21 | 23 | 15-taxonomy question bank + question papers |
| Examination | 3 | 11 | 21 | exams, mark configs, grades, remarks, merit, result cards |
| Payroll | 3 | 9 | 21 | salary heads, payroll mapping, payslips, advance/due salary |
| Teacher | 6 | 5 | 17 | teacher portal, assignments, gamification service |
| SMS | 5 | 5 | 9 | phone books, templates, balance purchase, sent log |
| SystemConfiguration | 2 | 2 | 10 | settings, branch/year switch, backup, domain check |
| Hostel | 9 | 9 | 10 | hostels, rooms, members, meals, bills |
| Gateways | 15 | 1 | 8 (+55 web) | 14 payment gateway integrations |
| Library | 3 | 4 | 7 (+23 web) | books, categories, issue/return, members |
| Transport | 5 | 5 | 6 | buses, routes, stops, drivers, members |
| LayoutCert | 1 | 2 | 2 (+web) | transfer certificate, testimonial, ID-card print routes |

### 1.3 Flutter app counts (`web-app-desktop-code-v1.6_x/web-app-desktop-code-v1.6/`)

| Artifact | Count | Evidence |
|---|---|---|
| Dart files | 1,858 | `find lib -name "*.dart" \| wc -l` |
| Top-level feature folders | 46 | `lib/feature/` |
| Page/screen/view dart files | ~333 | `find lib/feature -name "*page*\|*screen*\|*view*.dart"` |
| Registered routes | 197 `customPage(...)` (+6 commented out); 237 path constants; ~180 route getters | `lib/helper/route_helper.dart` (1,150 lines) |
| State management | GetX everywhere | `pubspec.yaml` (`get: ^4.6.6`), `lib/api_handle/` |
| Deploy targets | web, android, ios, windows, macos, linux | repo folders; `vercel.json`, `firebase.json` |
| Themes | light + dark, OpenSans, purple-family brand (`Color(0xFF081D5F)`…) | `lib/theme/`, `lib/util/styles.dart` |
| Notable deps | syncfusion_flutter_charts/calendar/pdfviewer, pdf+printing, mobile_scanner, vdocipher_flutter, youtube_player, html_editor_enhanced, chat_gpt_sdk | `pubspec.yaml` |

### 1.4 Feature enumeration — what each module contains (paths relative to `install-api-code-v1.6_x/`)

**Academic (largest, 65 routes)**
- Config: academic sessions/years (`Modules/Academic/app/Models/AcademicYear.php`), classes, sections, groups, shifts + assign-shift, subjects + subject configs, departments, periods, class assigns, class routines, picklists, student categories.
- Daily ops: student attendance (single + bulk + monthly report + summary), staff attendance, QR-code attendance (`studentQrCodeAttendance`), device attendance (`studentDeviceAttendance`), leave types.
- Content: syllabus (create/view per class), assignments (teacher create/edit/store, student submit/view), notices + per-user read state (`UserNotice.php`), events, contact messages.
- Transfer machinery: `StudentMigration.php` (session promotion/pushback/migration list), `StudentSession.php`, cross-branch student migration.
- Extensions: `CustomField.php` + `CustomFieldValue.php` (per-institute dynamic student fields), `DeviceControl.php` + `UserDevice.php` (per-user device allow-list/limit for e-learning), principal/teacher `Signature.php`, `AbsentFine.php`, `ResultCard.php`, `ExamAttendance.php`, `ExamSchedule.php`, SmsLog, LibraryMember (misplaced here).

**Student (49 routes)**
- CRUD + `students-bulk-imports` (+ download template), status toggles, search.
- Auth: `StudentAuthController.php` — password login, OTP sent/verify (`v1/student-otp-*`), **tenant resolved by `X-Domain` header** (line ~335).
- Portal: dashboard (with gamification + behavior), my-attendance, my-subjects, my-courses, class lessons, my-syllabus, my-transactions, library history, unpaid fee info, fines reports (attendance/lab/quiz).

**Authentication (47 routes) — SaaS core, see Section 2**
- Institute (`app/Models/Institute.php`: owner_id, assigned_to, domain, platform, theme_id), Branch, Plan, Subscription, SubscriptionItem, SubscriptionUpgradeRequest, SAASSetting, SAASSubscription (email capture only), SAASFaq, InstituteImageSetting(s), Feedback.
- `OnboardingsController.php` — approve public application → institute + "Main Branch" + admin user + ~40 default settings rows + trial subscription (buggy, see 2.3).
- `BranchController.php`, `PlanController.php`, `UserController.php`, `RoleController.php`, `PermissionController.php`, `UtilityController.php` (domain check via WHOIS-ish `DomainHelper`).

**Examination (`Modules/Examination/Models/`)**
- Exam, ClassExam, ExamCode (+MarkConfigExamCode), ExamMark, ExamGrade, Grade, MarkConfig, MeritProcessType, RemarkConfig, ShortCode, GrandFinalClassExam.
- Flows: exam startup → assign exams to classes → mark config per exam+code → mark input (`ExamMarkInputController`) → grades/remarks → results + result cards → exam routines; admit card + seat plan live in routine module (`admit_and_seat_plan`).

**Finance (`Modules/Finance/Models/`)**
- Fee, FeeHead, FeeSubHead, FeeMap (+FeeMapFeeSubHead, FeeMapFund), FeeDateConfig (installments), StudentCollection + StudentCollectionDetails + StudentCollectionDetailsSubHead (per-sub-head splits), Waiver + AttendanceWaiver + StudentWaiverConfig, AttendanceFine; lab/quiz fines via routes (`get-lab-fine-amount/{student_id}`, `student/quiz-fine-report`).
- Smart/quick collection: `APIQuickCollectionController.php` — bulk collection across students/classes.
- Digital payments: `digital-payment/{settingId}` + status endpoint — per-gateway payment settings records that parents/students pay through.
- Reports: unpaid summary/reports, head-wise payment, class-wise payment summary, monthly collections, collection invoice per student.

**Accounting (`Modules/Accounting/app/Models/`) — real double entry**
- AccountingType, AccountingCategory, AccountingGroup, AccountingLedger (chart of accounts), AccountingFund, AccountTransaction + AccountTransactionDetail (journal lines), PaymentHistory.
- Vouchers: journal, receipt, payment, contra, fund transfer (routes `account-journal-transfer`, `account-contra-transfer`, `account-fund-transfer`).
- Reports (11): `report/income-statement(-details)`, `report/balance-sheet(-details)`, `report/trial-balance(-details)`, `report/cash-flow-statement(-monthly)`, `report/cash-book-account`, `report/ledger-book-account`, `report/journal-wise`, `report/ledger-wise`, `report/voucher-wise`, `report/user-wise`, `report/fund-summary(-monthly)`, cash summary.

**Payroll (`Modules/Payroll/Models/`)**
- SalaryHead, SalaryHeadUserPayroll, UserPayroll, PayrollAccountingMapping (**posts salary payments into the GL**), PayslipInvoice, PayslipSalary, PayslipSalaryHead, Payment, PaymentMethod.
- Flows: staff salary config → salary create → payment process; **advance salary → due salary → return advance**; salary statement report; payslip PDFs.

**Elearning (39 routes)**
- Courses + categories + sub-categories, lessons, chapters (+ reorder), contents (video via VdoCipher/YouTube), `ContentVisibilityController` (per-class content visibility toggles), enrollment, course FAQs/features/rooms/days/zooms, Zoom meetings (`zoom_meetings` migration in root `database/migrations/`), quizzes + attempts + results, public store endpoints (`publicStore`, `category-wise-courses`) consumed by the Flutter landing page.

**QuestionBank (23 routes, 21 repos)**
- Taxonomy: boards, classes, subjects, chapters, topics, levels, difficulty levels, groups, sources, sub-sources, tags, types, years, sessions, tests (`Modules/QuestionBank/Repositories/`).
- Question CRUD, question categories, question paper creation (Flutter `lib/feature/question_bank/question/presentation/screens/question_paper_create_screen.dart`).

**SMS (9 routes)**
- PhoneBook, PhoneBookCategory, SmsBalance, SmsPurchase (prepaid balance), SmsTemplate with short-code merge fields (`short-code` route), compose/send, sent-SMS report; bulk absent-notify from attendance (`sendAbsentBulkSms`, `student-absent-attendance-bulk-sms`).
- 14 gateways in `updated-api-code-v1.6_x/app/Traits/SmsGatewayForMessage.php`: twilio, nexmo, msg_91, releans, hubtel, signal_wire, sms_to, viatech, paradox, alphanet, akandit, global_sms, sms_019, two_factor.

**Hostel** — Hostel, HostelCategory, Room, RoomMember, HostelMember, Meal, MealPlan, MealEntry, HostelBill (`Modules/Hostel/app/Models/`).
**Transport** — Bus, BusRoute, BusStop, Driver, TransportMember (`Modules/Transport/app/Models/`). No GPS/tracking anywhere (grep).
**LayoutCert** — TransferCertificate, Testimonial (`Modules/LayoutCert/Models/`); ID-card print lists from root `routes/web.php`; in the UI the certificate builder exposes **9 document types** (see 3.3).
**Frontend (32 routes)** — Banner, AboutUs, WhyChooseUs, Testimonial, FaqQuestion, Policy, Page, AcademicImage, MobileAppSection, ReadyToJoinUs, OurHistory, Contact, Onboarding (public institute application), Theme.
**ParentModule (28 routes)** — my-children, default-child assign/get, parent views of subjects/routine/assignments/attendance/fees/library/notices/events/exams/behavior.
**Teacher (17 routes)** — profile, class schedule, assignment CRUD, events/notices, `Services/Gamification/GamificationService.php` (student points/rewards).

### 1.5 What the root `routes/web.php` (20 routes) reveals

The only server-rendered pages are: the installer wizard (`/install/*`: requirements → permissions → purchase key → database), `/upgrade` (zip upload), `/saas-landing-page`, `/student-vital/{encodedData}` (public QR student page — base64 decode of institute/branch/student ids in `app/Http/Controllers/WebsiteController.php::vital`), and three `*-list-for-card-print/{encodedData}` routes for student/staff ID cards. There is no Blade admin panel — the admin UI is 100% Flutter.

### 1.6 Update package (`updated-api-code-v1.6_x/`, 1,470 files)

Contains the shared `app/` kernel that gets patched between releases: `Traits/` (HasPermissionTrait, HasPermissionWebTrait, Trackable, PaymentProcess, StudentCollectionTrait, AccountingCalculationTrait, SmsGatewayForMessage, HasUuid, RequestSanitizerTrait, SlugAbleTrait, ResponseTrait, Authenticatable), `Jobs/SendSmsJob.php`, `Mail/InstituteOnboardingMail.php`, `Mail/SupportTicketCreatedMail.php`, `Helpers/` (general.php, DomainHelper.php, InstituteHelper.php), `Enums/` (VoucherType, RoleEnum, UserLogAction, LeaveStatusEnum, MonthsEnum). The bundled update note requires running `php artisan migrate` manually after file updates.

---

## 2. MULTIBRANCH / SAAS CLAIM — audited hard

**Marketing**: "School Management System ERP Multibranch SaaS All-in-One".
**Reality**: single MySQL DB, single Laravel app, rows scoped by two integer columns; tenant = an `institutes` row; branch = a label under it.

### 2.1 Tenancy model
- Tenant resolution for staff: `get_institute_id()` = `auth()->user()->institute_id` and `get_branch_id()` = `auth()->user()->branch_id` (`install-api-code-v1.6_x/app/Helpers/general.php:20,28`). Every domain row carries `institute_id`; 126 of ~197 module migrations also carry `branch_id`.
- **Zero Eloquent global scopes** (grep `addGlobalScope` = 0 hits). Scoping is hand-written `->where('institute_id', get_institute_id())` in every controller/repository — the source of every isolation bug below.
- Public/student surfaces resolve tenant via an **`X-Domain` header** (browser host → `institutes.domain`): `updated-api-code-v1.6_x/app/Helpers/InstituteHelper.php::getInstituteIdByDomain`, consumed at `Modules/Student/.../StudentAuthController.php:335` and `Modules/Frontend/.../FrontendController.php:727` (`lib/api_handle/api_client.dart:41` sends `'X-Domain'`). There is **no server-side host-based tenancy middleware** — the domain column exists mainly so one Flutter web build (Vercel-hosted) can serve any institute's public site and student login.
- Institute extras: `owner_id`, `assigned_to` (support/user assignment), `domain`, `platform`, `theme_id` (`Modules/Authentication/app/Models/Institute.php`).

### 2.2 Branches: what they actually are
- `Branch = ['institute_id', 'name', 'status']` (`Modules/Authentication/app/Models/Branch.php`) — no address, no code, no per-branch config UI, no branch admins.
- CRUD: `Modules/Authentication/app/Http/Controllers/API/BranchController.php`. **`update()` and `destroy()` fetch by id with no `institute_id` check — IDOR: any tenant admin can rename or delete another tenant's branch.**
- Switching branch: `UtilityController::changeBranch` (`Modules/SystemConfiguration/.../UtilityController.php:34`) **overwrites the current user's `users.branch_id`** without validating the target branch belongs to the caller's institute. You see one branch at a time; there is no consolidated cross-branch dashboard, no consolidated finance, no branch-scoped portals. The only cross-branch surface is `all-students-get` / `all_student_view_list` and plan-limit counting.
- Per-branch state: branch-scoped rows in the `settings` table (e.g. `academic_year` is set per institute+branch via `academicYearChange`), plus branch_id on all domain tables. Student cross-branch transfer exists (`student-branch-migration`, Flutter `lib/feature/students_information/student_migration/`).

### 2.3 SaaS packages & billing
- `Plan`: `name, description, student_limit, branch_limit, price, duration_days, is_custom, is_free` (`Modules/Authentication/app/Models/Plan.php`) — **pure quota plan; no per-feature/module gating** (all 19 modules always on for every plan; no seat types, no add-ons).
- Enforcement: `install-api-code-v1.6_x/app/Http/Middleware/CheckSubscription.php` — 403s **every request** (reads included) when: no active subscription, expired, `students().count() >= student_limit`, or `branches().count() >= branch_limit`. Two COUNT queries per request; expiry is date-based only (`Subscription::isActive()`: `status === 'active' && now()->lte($this->end_date)`).
- **Trial-provisioning bug**: `OnboardingsController::approve()` creates the trial with hardcoded `'institute_id' => 1` and dereferences an undefined `$plan` variable ("Create a subscription for institute_id = 1" comment, ~line 139). Newly approved tenants get no usable subscription; the demo institute's row is the one updated. Unless an operator manually runs `upgrade()` for each tenant, `CheckSubscription` will 403 them.
- Renewals: **no webhooks, no auto-renew, no invoice table** — the invoice is a JSON blob on the subscription row (`invoice_details`). Super admin records a manual payment via `OnboardingsController::upgrade` (validates `payment_method`, `amount_paid`, `extra_days`); tenants can file a `requestUpgrade` (pending `SubscriptionUpgradeRequest`) which the super admin approves via `approveRequest`. Payment method on tenant-initiated requests is hardcoded `'online'` but nothing online actually happens.
- Public SaaS funnel: `/saas-landing-page`, `get-packages` (public), `saas-subscriptions-email-store` (email capture — the entire `SAASSubscription` model is `['email']`), `apply-institute` (public form → `Onboarding` row with `collected_data` JSON + logo) → super-admin `approve-request`. `SAASFaq` powers a SaaS marketing FAQ.
- Super-admin ops: `saas-dashboard-data`, `saas-subscriptions` CRUD, `saas-settings-update/upload-logo/updateMailConfig/getMailConfig` (per-tenant mail config!), `institute-image-saas-settings`, `request-upgrade-list`, plus `administration-backup-database` and `system/clear-cache` utilities.
- License enforcement = installer purchase-key step (`InstallController::keyWorld` in root `routes/web.php` flow) + a `storage/mightySchool` marker file written by `ResetSystemData` — trivially bypassable; demo `demo.sql` ships in the web root.

### 2.4 Tenant lifecycle walkthrough (as implemented)

1. **Discovery**: prospect hits `/saas-landing-page` (Laravel) or the Flutter landing page; browses `get-packages`, `saas-faqs`, `ready-to-join-us` CMS rows; submits `saas-subscriptions-email-store` (just an email) or the full `apply-institute` form (institute name/type/email/phone/domain + logo + admin user name/email/phone/password) → stored as a pending `Onboarding` row.
2. **Approval**: super admin lists pending onboardings (`OnboardingsController::index` — no pagination guard on visibility, any super admin), clicks approve → transaction creates Institute, "Main Branch", admin User (role 2, `'System Admin'`), ~40 `settings` rows (school_name "Demo Collage", timezone `Asia/Dhaka`, currency `$`, sms_gateway `twilio`, zoom keys empty, `app_version`, `app_url`, social links, `eiin_code`, `exam_result_phone`, `tuition_fee_phone`, …), and the (buggy) trial Subscription + SubscriptionItem. Sends `InstituteOnboardingMail`.
3. **Operation**: tenant admin logs into the Flutter app; `CheckSubscription` validates the (broken) subscription; user configures academic structure; every query is filtered by the user's institute_id/branch_id.
4. **Expiry**: when `end_date` passes, `CheckSubscription` 403s every request — the tenant is locked out of **reads too** until the super admin records a renewal (`upgrade()`) or approves their `requestUpgrade`.
5. **Limits**: adding students/branches 403s at plan limits — enforced at request time by counting, not at provisioning.

### 2.5 Verdict on the claim, and comparison with ASchool
- **"Multibranch"**: nominally true (rows carry branch_id; students can migrate between branches) but there is no branch as an administrative unit — no branch settings, no branch-scoped reports, no branch admin role concept, no consolidated analytics. Switching = mutating the user row.
- **"SaaS"**: quota middleware + manual renewals + a broken trial. No feature gating, no payment automation, no tenant self-service beyond an upgrade *request* form.
- ASchool's `multi_branch` + `white_label` already exceed this on isolation, branding, and admin UX.
- **Worth adopting from MSP's SaaS layer**: the public marketing funnel (packages page + email capture + FAQ + apply-for-institute approval queue); tenant-initiated upgrade-request workflow with super-admin payment recording (fits Nepal's manual-banking reality); per-tenant mail config; per-plan hard quotas (student/branch) if we want simple plans; the `X-Domain` public-site pattern (our website_builder could serve tenant sites off one deployment the same way).

---

## 3. UI/UX PATTERNS

### 3.1 One Flutter app for everything
- The same codebase renders the public marketing/landing site (`lib/feature/landing_page/presentation/screens/web_landing_page.dart`), the admin panel, teacher/student/parent portals, auth, and splash. Desktop width gets `WebHomScreen`; narrow widths get a bottom nav (`lib/feature/dashboard/presentation/dashboard_screen.dart`, `ResponsiveHelper.isDesktop(context)` branching).
- Role shell: `DashboardController` swaps navigation sets by role — `parentsItem`, `studentsItem`, admin default (dashboard_screen.dart:51-60). Parent and student each get ~11 dedicated screens (route constants `parentSubject…parentBehaviour`, `studentSubject…studentBehaviour` in `lib/helper/route_helper.dart`).

### 3.2 Menu organization (from `lib/feature/sidebar/controller/side_menu_bar_controller.dart`, ~1,000 lines)
- Hardcoded builder `_buildSideMenuItems()` wrapped in per-item permission checks: `if(profileController.hasPermission("dashboard"))`, `hasPermission("master_configuration.roles")` (lines 109, 768). The keys match the backend's 166 Spatie permission names exactly — one naming scheme end-to-end.
- Client-side menu search (`filterMenu`) filters nested items by title.
- Top-level sections: Dashboard; Branch; Student Information (student list, migration, migration pushback, migration list, student branch migration, all-student view); Student Attendance (attendance, reports, monthly report; *absent fine commented out*); Academic Configuration (session, shift, class, section, group, period, subjects, student categories, department, picklist, signature; *subject_config commented out*); Staff Information (staff attendance + report, teacher list, staff list); Payroll Management (start-up, mapping, assign, salary slip, salary, due, advance; *return advance/statement/payment info commented out*); Fees Management (start-up, mapping, amount config, date config, waiver, waiver config, smart collection, paid/unpaid info); Accounting (ledger, fund, category, group, payment, receipt, contra, journal, fund transfer, chart of accounts + 6 report screens); Routine (syllabus, assignments, class routine, exam routine, admit & seat plan); Library (categories, books, members, issue, issue search/report); Exam (exam, start-up, mark config, remark config, mark input, marksheet, results); **Certificates & Layouts (9 types)**: general recommendation letter, testimonial, attendance certificate, HSC recommendation letter, abroad letter, transfer certificate, character certificate, study certificate, bonafide certificate, migration certificate, ID card; SMS (config, template, phone book category, phone book, sent, absent SMS, purchase, report); Notice; Event; User Activities; Question Bank (category, add question, question, class, group, subject, chapter, types, level, topics, sources, sub-sources, year, board, tag, question paper); Courses (category, course, add course); Fees Reports (monthly, head-wise, unpaid, payment ratio); Administrator (system settings, payment gateway, role, employee, database backup, zoom config/meeting); Subscription; ChatGPT.

### 3.3 Design system
- Light + dark Material themes, `OpenSans` (`lib/theme/light_theme.dart:3`), brand purples/navy (`lib/util/styles.dart:53-55`).
- Syncfusion for charts, calendar, PDF viewer (`pubspec.yaml`); `pdf` + `printing` for client-side document generation; `flutter_inappwebview`/`html_editor_enhanced` for rich content; `mobile_scanner` for QR attendance; shimmer skeletons; custom master layout + breadcrumb (`lib/common/global_widget/global_master_layout_widget.dart`, `lib/common/coutom_royte_path/custom_route_path_widget.dart` — sic).
- Per-feature folder convention: `logic/` (GetX controller), `domain/` (model + repository), `presentation/screens|widgets/` — e.g. `lib/feature/fees_management/fees_head/`. Tables are custom paginated lists with search bars, not server-driven DataTables.
- Theming/branding: `institutes.theme_id` + CMS theme picker (`lib/feature/cms_management/cms_settings/presentation/widgets/select_theme_widget.dart`); logo via settings upload; the whole public site is CMS rows (banners, testimonials, why-choose-us, mobile-app section with QR codes, ready-to-join, policies).
- i18n: backend `_lang()` JSON lookup with 2 locales (`app/Helpers/general.php:34`, `lang/{en,bn}.json`); Flutter GetX `.tr` + language feature (`lib/feature/language/`, `lib/localization/`).

### 3.4 Worked examples of the screen flow patterns

- **Fees (most complete domain)**: `FeesStartupScreen` (create fee) → `FeesMappingScreen` (attach heads to classes/sections) → `FeesAmountConfigScreen` + `FeeDateConfigScreen` (amounts and due dates per class) → `SmartCollectionScreen` + `QuickCollectionDetailsScreen` (bulk collection with per-sub-head splits) → `PaidReportScreen` / `UnPaidReportScreen` / fees reports hub (`fee_monthly_report`, `head_wise_info`, `payment_ratio_info`). Fines and waivers sit alongside (`FineWaiverScreen`, `WaiverConfigScreen`).
- **Accounting**: config screens (chart of accounts, groups, categories, funds, ledgers) → voucher screens (journal, receipt, payment, contra, fund transfer) → a reports hub with six statement screens (balance sheet, trial balance, cash flow, income statement, fund-wise, ledger/voucher/user-wise) rendered with Syncfusion charts.
- **Exam**: `ExamStartupScreen` → `ExamScreen` (assign exams to classes) → `MarkConfigScreen` → `MarkInputScreen` → `ReMarkConfigScreen` (remarks) → `ExamResultScreen` + marksheet config → print via result cards/admit/seat-plan.
- **Certificates**: `LayoutAndCertificateManagementScreen` configures layouts; `CertificateScreen` takes a `CertificateTypeEnum` (9 types, `lib/feature/layout_and_certificate/enum/certificate_type_enum.dart`) and renders the fillable document; printing is client-side `pdf`/`printing`.
- **Content (e-learning)**: course → chapters (reorderable) → contents with video provider choice; `ContentVisibilityController` toggles what each class sees; device allow-list gates playback (`DeviceControl`).
- **Everything is a list + form + report triangle**: every feature folder has the same three screens — this uniformity is why one developer can ship here, and it is the pattern ASchool plugin UIs already follow via manifests.

---

## 4. WHAT ASCHOOL LACKS (evidence-backed gaps)

1. **General-ledger / double-entry accounting — biggest gap.** Chart of accounts, accounting groups/categories, ledgers, journal/receipt/payment/contra/fund-transfer, funds, and 11 financial reports (`Modules/Accounting/routes/api.php`: `report/income-statement`, `report/balance-sheet`, `report/trial-balance`, `report/cash-flow-statement(-monthly)`, `report/cash-book-account`, `report/ledger-book-account`, `report/journal-wise`, `report/voucher-wise`, `report/user-wise`, `report/fund-summary`). ASchool has fees + hr_payroll + inventory but no GL; fee income and salary expense never reconcile into one balance sheet. A `ledger`/`accounting` plugin with fee/salary/inventory auto-posting would close this.
2. **Payroll→accounting posting + advance-salary lifecycle.** `Modules/Payroll/Models/PayrollAccountingMapping.php` maps salary payments into GL accounts; advance/due/return-advance flows (`Modules/Payroll/routes/api.php`: `advanceSalaryPayment`, `dueSalaryPayment`, `returnSalaryPayment`), payslip invoices (`PayslipInvoice.php`), salary statement. Audit ASchool `hr_payroll` against this list.
3. **Fees sub-features.** Quick/smart bulk collection (`APIQuickCollectionController.php`); date config (installment scheduling) + amount config; three fine types (attendance, lab, quiz) each with fine report + waiver; per-sub-head collection splits (`StudentCollectionDetailsSubHead.php`); class-wise payment summary + head-wise + monthly + payment-ratio reports; per-gateway "digital payment" settings students actually pay through (`digital-payment/{settingId}`).
4. **School-document generators (print pipeline).** 9 certificate types + ID cards (sidebar list in 3.2; `Modules/LayoutCert/Models/TransferCertificate.php`, `Testimonial.php`), bulk card print lists (`routes/web.php`: `student-list-for-card-print/{encodedData}` etc.), principal/teacher signature uploads used on documents (`Modules/Academic/app/Models/Signature.php`, `TeacherSignature.php`), admit cards + seat plans (`admit_and_seat_plan`), result-card layouts (`Modules/Academic/app/Models/ResultCard.php`). ASchool's design_studio (canvas + writer + bulk PDFs) is the right engine — it lacks the structured document templates and per-student merge pipeline.
5. **Student migration engine.** Session-wise promotion with pushback, migration lists, and cross-branch migration (`Modules/Academic/app/Models/StudentMigration.php`, `StudentSession.php`). If ASchool's admission plugin lacks promote/pushback, this is the reference flow.
6. **Public SaaS funnel + onboarding approval queue.** Packages page, email capture, apply-for-institute form with logo, super-admin approval that creates institute + main branch + admin user + ~40 default settings rows in one transaction (`OnboardingsController::approve`). ASchool's white_label could adopt this as a self-serve onboarding wizard (minus the bugs).
7. **SMS operations depth.** Prepaid SMS balance purchasing (`Modules/SMS/Models/SmsBalance.php`, `SmsPurchase.php`), phone books + categories, templates with short-code merge fields, sent-SMS reports, bulk absent-notify hooks. ASchool `sms_notifications` (Sparrow) should verify quota/balance, merge templates, and phone books.
8. **Device control for e-learning.** Per-student device allow-list/limit so paid course content opens only on registered devices (`Modules/Academic/app/Models/DeviceControl.php`, routes `elearning-student-device-delete/{deviceId}`, `studentDeviceStatus`). Nothing like it in ASchool's lms/elibrary.
9. **Hostel meal management.** Meal plans, daily meal entries, meal-based billing (`Modules/Hostel/app/Models/Meal.php`, `MealEntry.php`, `MealPlan.php`, `HostelBill.php`) — richer than room+member tracking.
10. **QR student "vital" pages.** Base64-encoded QR → public student profile/result page (`app/Http/Controllers/WebsiteController.php::vital`, route `/student-vital/{encodedData}`) + QR self-attendance (`studentQrCodeAttendance`).
11. **Custom fields framework.** Per-institute dynamic fields with values (`Modules/Academic/app/Models/CustomField.php`, `CustomFieldValue.php`) — cheap extensibility for iEMIS extra fields without migrations.
12. **Tenant public-website CMS content types.** Banners, testimonials, why-choose-us, FAQs, policy pages, academic images, events, mobile-app promo, themes (`Modules/Frontend/Models/`). Check ASchool `website_builder`/`basic_website` covers these as tenant-scoped content types rather than freeform pages only.

### 4.1 Gap → ASchool plugin mapping

| MSP capability | Evidence | Nearest ASchool plugin | Gap severity |
|---|---|---|---|
| Double-entry GL + 11 statements | `Modules/Accounting/` | fees, hr_payroll (partial) | **High** — no ledger plugin |
| Payroll posts to GL + advance/due/return | `Modules/Payroll/Models/PayrollAccountingMapping.php`, routes | hr_payroll | **High** if unverified |
| Smart bulk fee collection + fines + waivers | `APIQuickCollectionController.php`, `AttendanceFine.php`, `Waiver.php` | fees | Medium — verify sub-features |
| 9 certificate/ID document types + bulk print | Sidebar 3.2, `Modules/LayoutCert/`, root `routes/web.php` | design_studio | **High** — engine exists, templates missing |
| Session promotion/pushback/branch migration | `Modules/Academic/app/Models/StudentMigration.php` | admission | Medium — verify |
| Public SaaS funnel + approval queue | `Modules/Frontend/app/Models/Onboarding.php`, `OnboardingsController` | white_label | Medium |
| SMS balance purchase + templates + phone books | `Modules/SMS/Models/SmsBalance.php`, `SmsTemplate.php` | sms_notifications | Medium |
| Device allow-list for e-learning content | `Modules/Academic/app/Models/DeviceControl.php` | lms | Medium |
| Hostel meals + meal billing | `Modules/Hostel/app/Models/Meal*.php`, `HostelBill.php` | hostel | Low-Medium |
| QR public student page + QR attendance | `WebsiteController.php::vital`, `studentQrCodeAttendance` | (none) | Low |
| Custom fields framework | `Modules/Academic/app/Models/CustomField.php` | (none generic) | Low-Medium |
| Tenant CMS content types | `Modules/Frontend/Models/` | website_builder, basic_website | Low |
| Zoom live classes | `Modules/Elearning/.../ZoomController.php`, `zoom_meetings` table | lms / conferences | Low (conferences exists) |
| Gamification (points/rewards for students) | `Modules/Teacher/Services/Gamification/` | gamification | None (already have) |

---

## 5. WHAT ASCHOOL DOES BETTER

1. **True multi-tenancy & white-label** vs shared-table institute_id + user-row branch flips. MSP's own core CRUD proves the risk: `BranchController::update/destroy` are cross-tenant writable.
2. **Nepal stack** — BS dates, iEMIS export/import (`iemis_importer`, `compliance`), SEE/NEB grading (`nepal_curriculum`), Sparrow SMS, eSewa/Khalti/FonePay — vs Bangladesh/India/Africa-centric rails (bKash, Paytm, RazorPay, SSLCommerz, Paystack), `bn`/`en` locales, `Asia/Dhaka` defaults.
3. **AI platform** — 24-tool ai_suite + tutor + workbench + ai_teacher vs one hardcoded ChatGPT chat screen with a compile-time API key (`web-app-desktop-code-v1.6_x/.../lib/util/app_constants.dart`: `chatGptApiKey = 'your ApiKey'`).
4. **Scale & async architecture** — ~756 Flask endpoints, Celery workers, pgvector, realtime vs 456 synchronous Laravel routes, no queues, no search index, no vector store.
5. **Frontend separation** — Next.js 216 pages with manifest-driven sidebar vs a 1,000-line hardcoded Flutter menu builder where every new menu item edits one giant file, and disabled features are commented-out lines (absent fine, return advance, `studentFees` route).
6. **Safety engineering** — ASchool has no `migrate:fresh` on a scheduler (MSP: `system:reset` **every minute** in `app/Console/Kernel.php` → `app/Console/Commands/ResetSystemData.php`), no raw-SQL backup endpoint (MSP: `UtilityController::backupDatabase` string-concatenates dumps with `addslashes` and writes `uploads/backup/DB-BACKUP-*.sql`), no client-side secrets, no `demo.sql` in web root.
7. **Domain breadth** — biometric attendance, GPS transport tracking (MSP transport has zero tracking), visitor management, health records, wellbeing, disaster/emergency, dismissal, conferences, alumni, incidents, gamification as a first-class plugin (MSP buries it in Teacher module), online exams + question bank as standalone plugins (MSP quizzes are e-learning-coupled only).
8. **Role-native mobile** — 5 dedicated Flutter apps vs one web-first build where mobile is a bottom-nav shell over desktop screens and student/parent portals share the admin codebase.
9. **Testability & CI surface** — ASchool's plugin kernel (manifests, registry, entitlements, events) vs 5 test files in a 19-module backend.
10. **Documentation** — MSP ships no real documentation in-package (the "Online Documentation" HTML is a redirect stub); ASchool maintains in-repo plugin-development guides and audit docs, which is a real adoption advantage for self-hosted buyers.

---

## 6. ORGANIZATION LESSONS for ASchool

1. **Module boundary honesty.** nwidart layout (`Modules/<Name>/{app,Models,Repositories,Services,routes,database}`) is a good skeleton, but MSP leaks: LibraryMember and DeviceControl live in Academic, Gamification in Teacher, StudentAuth in Student, Branch in Authentication — with cross-module FKs everywhere. ASchool's kernel should keep a shared-kernel model layer and forbid plugins defining other plugins' domain objects.
2. **Permission names as menu keys.** `academic_configuration.classes`, `master_configuration.roles` (`PermissionSeeder.php`) are used verbatim by the Flutter `hasPermission(...)` menu gating — one naming scheme across backend, storage, and nav. Adopt the 1:1 mapping in the manifest sidebar so menu hiding is automatically enforced server-side too (in MSP the Flutter gating is cosmetic; the API enforces separately — two sources of truth).
3. **The "startup → map → configure → execute → report" wizard pattern.** Fees = `fees_start_up → fees_mapping → amount_config/date_config → smart_collection → paid/unpaid reports`; Payroll = `payroll_start_up → payroll_mapping → payroll_assign → salary → salary_statement`; Exams = `exam_start_up → assign → mark_config → mark_input → results`. Every complex domain guides setup before transactions — a standard wizard scaffold worth copying into fees/hostel/library/exam plugins.
4. **Settings scoping.** `Setting {institute_id, branch_id, type, name, value}` gives branch-level overrides of institute defaults in one table (`academicYearChange` flips `academic_year` per branch). ASchool's config_store could add an institute-default → branch-override lookup chain cheaply.
5. **Single source of role truth.** MSP duplicates `role_id` + free-text `user_type` on users and hardcodes `role_id => 2` / `'System Admin'` during provisioning (`OnboardingsController::approve`) — a bug farm. Keep one authoritative role binding per user.
6. **Content visibility as data.** Elearning's `ContentVisibilityController` + `content-visibility-bulk-toggle` + chapter reorder are generic publish-control patterns reusable by elibrary/lms/portfolio.
7. **Print artifact registry.** MSP treats "everything prints" as first-class (dedicated print routes, blade PDF layouts in `resources/views/layouts/pdf/`, client-side pdf/printing). Keep a registry of printable document types per plugin routed through design_studio templates (ID, TC, testimonial, payslip, admit card, character/bonafide/migration/study/abroad letters).
8. **Anti-patterns to avoid (observed here).** Quota middleware that counts rows per request and blocks reads (`CheckSubscription.php`); hardcoded IDs in provisioning (`institute_id => 1`); demo/dev commands on production schedulers; DB dumps via string concatenation; feature flags by commenting code; demo SQL in web root; license checks as file markers.
9. **One UI codebase, many targets — cautionary.** MSP proves one Flutter app can cover admin + teacher + student + parent + public site + desktop, at the cost of giant files, `ResponsiveHelper` branching everywhere, and role spaghetti in the dashboard shell. ASchool's 5-app split is more maintainable; the transferable bit is centralizing design tokens (`lib/util/styles.dart`) and shared widgets (`lib/common/global_widget/`).
10. **Public-store/landing integration.** The e-learning store endpoints (`publicStore`, `category-wise-courses`, course details by slug) are consumed directly by the public landing page — i.e., the marketing site and the catalog are one surface. ASchool's basic_website + lms could share catalog widgets the same way.

---

### Appendix A — Security / quality findings (file:line evidence)

| # | Finding | Location |
|---|---|---|
| 1 | `system:reset` scheduled `everyMinute()`; runs `migrate:fresh` + reseed on the live DB | `install-api-code-v1.6_x/app/Console/Kernel.php`; `app/Console/Commands/ResetSystemData.php` |
| 2 | IDOR: branch update/destroy unscoped by institute | `Modules/Authentication/app/Http/Controllers/API/BranchController.php:46-70` |
| 3 | `changeBranch` doesn't validate target branch ownership | `Modules/SystemConfiguration/app/Http/Controllers/API/UtilityController.php:34-51` |
| 4 | Trial subscription hardcoded to `institute_id => 1`; undefined `$plan` dereferenced | `Modules/Authentication/app/Http/Controllers/API/OnboardingsController.php` (~line 139) |
| 5 | SQL backup via string concatenation + `addslashes`, written into `uploads/backup/` | `UtilityController.php::backupDatabase` |
| 6 | ChatGPT API key as a compile-time constant in client source | `web-app-desktop-code-v1.6_x/.../lib/util/app_constants.dart` |
| 7 | `demo.sql` shipped in web root | `install-api-code-v1.6_x/demo.sql` |
| 8 | License = purchase key in installer + `storage/mightySchool` marker file | `app/Http/Controllers/WEB/InstallController.php`; `ResetSystemData.php` |
| 9 | `create_option()` helper interpolates table/column names into raw SQL | `app/Helpers/general.php:85-120` |
| 10 | Expired-subscription handling blocks reads for the whole tenant (middleware on everything) | `app/Http/Middleware/CheckSubscription.php` |
| 11 | 5 test files for 19 modules; UI logic untested | `find Modules tests -name "*Test.php"` |

### Appendix B — quick path glossary (for follow-up digging)

- Backend root: `.../install-api-code-v1.6_x/` (Laravel 11; `composer.json`; `modules_statuses.json`; `demo.sql`)
- Shared kernel patch: `.../updated-api-code-v1.6_x/app/` (Traits/Jobs/Mail/Helpers/Enums — the files that change between releases)
- Flutter app: `.../web-app-desktop-code-v1.6_x/web-app-desktop-code-v1.6/lib/` — `helper/route_helper.dart` (all routes), `feature/sidebar/controller/side_menu_bar_controller.dart` (menu tree), `api_handle/api_client.dart` (`X-Domain`), `util/app_constants.dart` (base URL, version, GPT key)
- SaaS core: `Modules/Authentication/` (Institute/Branch/Plan/Subscription/Onboarding/SAAS*), `app/Http/Middleware/CheckSubscription.php`
- Accounting core: `Modules/Accounting/`, `Modules/Payroll/`, `Modules/Finance/`
- Exam core: `Modules/Examination/`, `Modules/QuestionBank/`, `Modules/Elearning/`
- Print core: `Modules/LayoutCert/`, root `routes/web.php`, `resources/views/layouts/pdf/`
- Installer/licensing: `app/Http/Controllers/WEB/InstallController.php`, `resources/views/install/`

### Appendix C — representative API surface by module (route URIs extracted from `Modules/*/routes/api.php`)

The route count per module (Section 1.2) maps to these URIs — useful for mapping MSP screens to ASchool endpoints 1:1.

**Academic (65)**: `academicYearChange`, class/section/shift/subject/period/department/picklist CRUD, `class-routine(s)`, `check-teacher-availability`, `assign-shifts`, `assign-subjects`, `assign-classes`, `syllabus`, `view_syllabus/{id}`, `assignment(s)`, `store_assignment`, `update_assignment`, `assignment-submit`, `student-attendance`, `student-attendance-status`, `student-attendance-delete`, `studentAttendanceReport`, `student-attendance-monthly-report-view`, `studentAttendanceSummary`, `staffs-attendance`, `staffAttendanceReport`, `reports-student-attendance`, `reports-staffs-attendance`, `get-attendance-fine-amount/{student_id}`, `student-qr-code-attendance`, `studentDeviceAttendance`, `student-migration`, `students-get-students-migration`, `studentBranchMigration`, `notice(s)`, `event(s)`, `custom-fields`, `custom-field-values`, `signature(s)`, `teacher-signatures`, `backupDatabase`, `clearAllCache`, `dateConfig`.

**Student (49)**: `student(s)` CRUD, `students-bulk-imports(-download-file)`, `students-status`, `student-search`, `student-profile`, `student-profile-update`, `v1/student-login`, `v1/student-otp-sent|verify|login`, `dashboardData`, `studentDashboard*`, `student/my-*` (attendance, subjects, courses, syllabus, transactions), `student/unpaid-info`, `student/payment-fee-info`, `student/library-history`, `student/{attendance,lab,quiz}-fine-report`, `student/gamifications`, `student/behaviors`, `student-account-delete`.

**Authentication (47)**: `register`, `user(s)` CRUD, `user-logs`, `role(s)`, `permission(s)`, `branch(es)` apiResource, `get-packages`, `saas-subscriptions` apiResource, `saas-subscriptions-email-store`, `saas-dashboard-data`, `saas-settings-update|upload-logo|mail-update|mail-config`, `saas-faqs`, `institute-image-saas-settings`, `administration/general_settings`, `administration-change-branch|year`, `administration-upload-logo`, `subscription/upgrade`, `request-upgrade`, `request-upgrade-list`, `approve-request/{id}`, `apply-institute` (public onboarding), `feedbacks`.

**Elearning (39)**: `courses`, `course-details/{slug}`, `course-categories|subcategories`, `enrollment-course`, `enrollments/list`, `chapter(s)`, `chapter-reorder`, `chapters-reorder-contents`, `contents`, `contentDelete`, `content-visibility-bulk-toggle`, `course-rooms|days|zooms|faqs|features`, `quiz(zes)`, `quiz-start|submit|finish|results|details`, `zoom-meetings` CRUD, `publicStore`, `category-wise-courses`.

**Frontend (32)**: `frontend/banners|about-us|why-choose-us|testimonials|faq|academicImages|gallery-images|policies|pages|events|contact-us|ready-to-join-us|mobile-app-section|themes|onboarding` — all tenant-resolved by `X-Domain`.

**Finance (31)**: `fee-head(s)`, `fee-sub-head(s)` + deletes, `fees-mapping`, `fee-date-config(|-search)`, `amount-config`, `waiver(s)`, `waiver-config`, `attendance-fine(s)`, `quick-collection`, `quick-collection-student`, `student-collection-invoice/{id}`, `student-collection-sub-head-wise-calculation`, `digital-payment(|/{settingId}|/status/{settingId})`, `unpaid-summery|unpaid-reports|unpaid-info`, `getHeadWisePayment`, `class-wise-payment-summary`, `report/get-monthly-fee-collections`.

**Accounting (31)**: `accounting-categories|groups|ledgers|funds`, `chart-of-accounts`, `cartOfAccounts`, `account-journal-transfer`, `account-contra-transfer`, `account-fund-transfer`, `accountTransaction(s)`, `fundSummary(|Monthly)`, plus the 11 `report/*` statement endpoints listed in 1.4.

**ParentModule (28)**: `parent/my-children`, `default-child-assign|get`, `parent/{subjects,class-routine,exams,attendance,fees,library,notices,events,assignments,behaviour}`.

**QuestionBank (23)**: `question-bank-{boards,classes,subjects,chapters,topics,levels,difficulty-levels,groups,sources,sub-sources,tags,types,years,sessions,tests}`, `question-categories`, `questions`, `updateQuestions`, `question-categories-wise-subjects`.

**Examination (21)**: `exams`, `exam-list`, `class-exam`, `exam-assign-store`, `exam-code|exam-code-store|exam-code-update`, `exam-essentials`, `exam-grade|exam-grade-store|exam-grade-update`, `examMarkInput` (ExamMarkInputController), `exam-routine(s)`, `exam-results`, `result-cards`, `remarks-config`, `semester-exam-settings-mark-config`, `general-exam-store`.

**Payroll (21)**: `staff-salary-config(|Create)`, `user-salary-assign`, `salary-create(-store)`, `salary-payment-create|process`, `advance-salary-payment`, `due-salary-payment`, `return-salary-payment`, `salary-statement`, `salary-heads`, `payslip` endpoints.

**Teacher (17)**: `teacher/assignments` CRUD (`create-assignment`, `store-assignment`, `edit-assignment/{id}`, `update-assignment/{id}`, `destroy-assignment/{id}`, `view-assignment`), `teacher/class-schedule`, `teacher/my-profile`, `teacher/notices|events`, `checkTeacherAvailability`.

**Hostel (10)**: hostel/category/room/room-member/member/meal/meal-plan/meal-entry/bill CRUD.
**SMS (9)**: `sms-compose`, `sms-send`, `sms-template`, `short-code`, `phone-book(|-category)`, `sms-purchase`, `sentSMSReport`, `sendAbsentBulkSms`.
**Gateways (8 API + 55 web)**: `digital-payment`, `payment-request` API; web callback/host pages for 14 gateways.
**Library (7 API + 23 web)**: `books`, `book-categories`, `books-issue|return`, `bookReturn`, `books-issue-reports`, `get-library-members`.
**Transport (6)**: `buses`, `bus-routes`, `bus-stops`, `drivers`, `transport-members`.
**LayoutCert (2)**: layout/certificate generation endpoints (heavy lifting is client-side + print web routes).
**SystemConfiguration (10)**: `administration/*`, `system/clear-cache|link-storage|unlink-storage`, `drop-database` (!), `domainCheck`, `settings`, `dateConfig`.
