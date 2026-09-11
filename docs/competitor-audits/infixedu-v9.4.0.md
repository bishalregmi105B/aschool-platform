# Competitor Audit: InfixEdu v9.4.0 (Codecanyon, Infixedu/Spondonit)

- **Audited**: 2026-09-11
- **Source**: `Other Projects/InfixEdu v9.4.0/.../InfixEdu v9.4.0 Main Application/upload_extracted` (Laravel monolith, ~88k files incl. vendor; vendor/node_modules skipped), plus `InfixEdu School Modules/` (addon zips) and `Documentation/` (an HTML page linking to online docs only — no offline documentation).
- **Purpose**: deep audit against **ASchool** (Nepal-focused multi-tenant school SaaS: Flask, 756 endpoints, 50 plugins, Next.js dashboard 216 pages, 5 Flutter apps, iEMIS/BS dates/eSewa/Khalti/Sparrow).

---

## 0. Verdict in 10 bullets

1. InfixEdu is an extremely feature-dense Laravel monolith: **18 route files, ~2,733 route definitions, 357 controllers, ~368 model classes, 343 migrations, 981 blade views**.
2. Depth is in the "boring" school domains InfixEdu has had 9+ years to polish: **fees lifecycle** (carry-forward, installments, fines, waivers, bank-slip approval, due-blocking), **exam/result engine** (custom report-card builder, seat plans, merit lists, tabulation, results archive), and **print artifacts** (certificates, ID cards, payslips, bulk printing).
3. Multi-tenancy is a **single-database, `school_id` + global-scope** design (`app/Scopes/SchoolScope.php`), resolved per-request by `SubdomainMiddleware` into `app('school')`. The "Saas" module itself (superadmin, packages, subscriptions) is a separately sold addon and is **not included** in the base package.
4. The addon system is Laravel-Module style: zip upload → extracted into `Modules/`, `module.json` + `<Name>.json` manifest, `moduleStatusCheck()` gating everywhere, Envato purchase verification (`app/Http/Controllers/VerifyController.php`).
5. Sidebar/menu is **database-driven per school** (`sm_menus`, seeded from `default_menus` on school creation in `app/SmSchool.php::insertMenu()`), cached 600s, editable at runtime by the bundled `MenuManage` module — even per-user menus (`user-custom-menu`).
6. UI is legacy jQuery + Bootstrap + AdminBSB-era templates with ~60 server-rendered blade view folders; DataTables via a shared server-side partial + `DatatableQueryController`; almost no frontend framework.
7. Mobile is served by two API layers: legacy `routes/api.php` (739 endpoints, token-per-user) and `routes/v2api.php` (223 endpoints, resource-style controllers under `app/Http/Controllers/api/v2/`).
8. Nepal relevance is zero: AD/Gregorian only (`dateConvert()` in `app/Helpers/Helper.php`), no iEMIS, no SEE/NEB grading, no eSewa/Khalti in base (Khalti is an addon); gateways are PayPal/Stripe/PayUMoney/RazorPay (+Xendit/PhonePay/MercadoPago/CCAvenue/ToyyibPay/Khalti as addons).
9. Code quality is mixed: heavy blade+jQuery, duplicated controllers (`SmStudentAdmissionController_old.php`, `XSmClassRoutineNewController.php`, `.blade - Copy.php`, `old`/`backup` files), commented-out blocks, broad exception swallowing (`catch (Exception) return back()`).
10. The most transferable ideas for ASchool: DB-driven menu manager, **custom result/report-card settings engine**, **fees carry-forward + due-login-block**, per-event notification settings, dynamic registration fields, and the "everything prints" discipline (certificates/ID/bulk-print modules).

---

## 1. INVENTORY — codebase map and counts

### 1.1 Raw counts

| Artifact | Count | Evidence |
|---|---|---|
| Route definition statements | ~2,733 | `grep -chE "Route::(get|post|resource|match|put|delete)" routes/*.php` |
| Controller classes | 357 | `app/Http/Controllers/**` (159 under `Admin/*`) |
| Model classes (root, legacy `App\` namespace) | 177 | `app/Sm*.php` |
| Model classes (modern `App\Models\`) | 191 | `app/Models/` |
| Migrations | 343 | `database/migrations/` |
| Blade views | 981 | `resources/views/**` |
| Bundled modules (`Modules/`) | 16 | see 1.5 |
| Addon slots in `modules_statuses.json` | 48 | many are separately-sold addons, absent from this package |
| Locales shipped | 9 | `resources/lang/{ar,be,bn,ca,en,es,fr,hi,indo}` |
| Theme packages (frontend) | 1 bundled | `resources/views/themes/edulia` |

### 1.2 Route files (`routes/`)

| File | Lines | Role |
|---|---|---|
| `admin_tenant.php` | 2,369 (1,355 route defs) | The whole staff/admin back office — despite the name, this is the main application (shared admin + tenant middleware stack) |
| `api.php` | 1,141 (739 defs) | Legacy mobile API (per-user token) |
| `v2api.php` | 322 (223 defs) | v2 mobile API (role-scoped controllers) |
| `tenant.php` | 374 | Public frontend (school website), auth, shared panel routes |
| `parent.php`, `student.php`, `teacher.php` | 56/134/3 | Role panels |
| `alumni.php`, `graduate.php` | 14/13 | Alumni panel, graduate list |
| `pagebuilder.php`, `optionbuilder.php` | 62/21 | Frontend page builder + generic settings builder |
| `admin.php`, `infix_api.php`, `api-list.php`, `configuration.php`, `channels.php`, `console.php`, `web.php` | misc | glue (web.php is 19 lines and includes the others) |

### 1.3 Controller layout (`app/Http/Controllers/Admin/*` — 159 classes in 22 folders)

`Academics` (16) · `SystemSettings` (17) · `FrontSettings` (30, the website CMS) · `FeesCollection` (12) · `StudentInfo` (11) · `AdminSection` (9) · `Examination` (9) · `Accounts` (7) · `Hr` (7) · `Inventory` (6) · `Communicate` (5) · `Dormitory` (4) · `Leave` (4) · `OnlineExam` (4) · `Transport` (4) · `Library` (3) · `Report` (3) · `RolePermission` (3) · `Style` (2) · plus root-level controllers (`SmAcademicCalendarController`, `ShiftController`, `TeacherEvaluationController`, `SmCustomFieldController`, `GatewayPaymentController`, `ImportController`, `DatatableQueryController`, etc.).

Panels outside Admin: `Student/`, `Parent/`, `Alumni/AlumniPanelController`, `Customer/` (shop purchases), `api/` + `api/v2/` (mobile), `Theme/Edulia/` (frontend).

### 1.4 Schema = feature truth (`database/migrations/`)

Core academics: `sm_academic_years`, `sm_sessions`, `sm_classes`, `sm_sections`, `sm_class_sections`, `sm_subjects`, `sm_assign_subjects`, `sm_class_times`, `sm_class_rooms`, `sm_class_routines`, `sm_optional_subjects`, `sm_academic_calendars`.

Students/staff: `sm_students`, `student_records` (multi-year class records — a student row per academic year/class, `2018_01_04_105604_create_student_records_table.php`), `sm_parents`, `sm_staffs`, `sm_student_categories/groups`, `sm_student_promotions`, `sm_student_timelines`, `sm_student_documents`, `sm_custom_fields`.

Fees (old module): `sm_fees_groups/types/masters/assigns/discounts/payments`, `sm_fees_carry_forwards`, `sm_bank_payment_slips`; Fees v2 module: `fm_fees_invoices`, `fm_fees_invoice_chields` (installment rows), `fm_fees_transactions`, `fm_fees_weavers` (waivers) under `Modules/Fees/Database/Migrations/`.

Exams: `sm_exams`, `sm_exam_types/setups/schedules`, `sm_marks_grades`, `sm_marks_registers(+child)`, `sm_exam_marks_registers`, `sm_temporary_meritlists`, `sm_result_stores`, `sm_custom_temporary_results`, `sm_seat_plans(+child)`, `sm_online_exams` + `sm_online_exam_questions` (`type` = M/T/F + suitable_words for fill-blanks), `sm_question_banks` (`type` M/T/F), `sm_question_groups/levels`.

Ops domains: `sm_book*`/`sm_book_issues`, `sm_library_members`, `sm_items*` (category/store/receive/sell/issue), `sm_suppliers`, `sm_vehicles`/`sm_routes`/`sm_assign_vehicles`, `sm_dormitory_lists`/`sm_room_types`/`sm_room_lists`, `sm_visitors`, `sm_complaints`, `sm_postal_dispatches/receives`, `sm_phone_call_logs`, `sm_events`, `sm_holidays`, `sm_weekends`, `sm_notices`, `sm_notifications`, `sm_email_sms_logs`, `sm_leave_*`, `sm_hr_salary_templates`, `sm_hr_payroll_generates`, `sm_hourly_rates`, `sm_bank_accounts`, `sm_chart_of_accounts`, `sm_add_incomes/expenses`, `sm_amount_transfers`.

Platform tables: `sm_schools`, `sm_general_settings`, `sm_modules`, `infix_module_managers` (addon registry), `sm_menus` + `default_menus` (sidebar), `sm_role_permissions`, `sm_module_permissions`, `sm_languages` + `sm_language_phrases` (DB-backed i18n), `sm_background_settings`, `sm_styles`, `sm_smtp/email/sms/payment_gateway_settings`, `sm_header_menu_managers` (frontend menu), `sm_home_page_settings`, `sm_dashboard_settings`.

### 1.5 Bundled modules (`Modules/`) — enabled state from `modules_statuses.json`

| Module | What it adds (from `Modules/<m>/Routes/web.php`) | Default |
|---|---|---|
| `Fees` | Fees v2: invoices (auto/manual), installments (`directFees/*` routes in admin_tenant.php), waivers, bank-payment approval, due/fine/payment/balance/waiver reports, gateway service charge | ON |
| `Lesson` | Lesson plans + topics per class/section/subject, incl. university-semester variant | ON |
| `ExamPlan` | Admit-card designer + generation, seat-plan generator | ON |
| `DownloadCenter` | Content types + download/upload content sharing | ON |
| `Chat` | Pusher-based 1:1 chat (frontend in `api/v2/Admin/Chat/*`) | ON |
| `Wallet` | Student wallet: deposit approval, refunds, transactions, pay fees from wallet | ON |
| `BulkPrint` | Bulk print: student/staff ID cards, fees receipts, payslips, certificates, LMS certificates | ON |
| `RolePermission` | Granular role→route permission UI | ON |
| `MenuManage` | Drag-order backend menu, per-section settings, reset defaults | ON |
| `TemplateSettings` | Email/SMS template editor | ON |
| `TwoFactorAuth` | 2FA settings + verify/resend flow | ON |
| `StudentAbsentNotification` | Auto absent-SMS config | ON |
| `BehaviourRecords` | Incidents catalog, assign incidents to students, points, rank reports | ON |
| `StudyMaterialSupport`, `VideoWatch` | content support + watch-log tracing | ON |
| `Lead` | Admission lead CRM (present but no routes extracted; `lead_fields` in `resources/var/defaults.json`) | off |

Referenced-but-not-bundled addons (48 slots): `Saas`, `SaasSubscription`, `SaasRolePermission`, `SaasHr`, `Branch`, `University`, `Lms`, `Zoom`, `BBB`, `Gmeet`, `InAppLiveClass`, `OnlineExam`, `Certificate`, `AiContent`, `WhatsappSupport`, `InfixBiometrics`, `QRCodeAttendance`, `ParentRegistration`, `Alumni`, `KhaltiPayment`, `RazorPay`, `XenditPayment`, `PhonePay`, `MercadoPago`, `CcAveune`, `ToyyibPay`, `HimalayaSms`, `AWSS3`, `News`, `PDF`, `Forum`, `CustomMenu`, `AppSlider`, … — full list in `resources/views/backEnd/menu/staff.blade.php` (`$paid_modules`) and `modules_statuses.json`.

### 1.6 Feature enumeration (from `routes/admin_tenant.php`, grouped)

- **Dashboard/To-do**: `/dashboard`, `admin-dashboard`, `dashboard/display-setting` (widget show/hide), to-do CRUD (`add-toDo` … `get-to-do-list`).
- **Academics**: classes, sections, subjects, optional subjects, class rooms, class times/periods, class routines (day-wise grid editor `class-routine-new`, print per teacher), assign subjects, assign class teachers, shifts (`/shifts`, `shift-setting`, per-shift classes), academic calendar, holidays, weekends.
- **Students**: admission wizard (`student-admission`, ajax roll/section/sibling checks), bulk import (`import-student`, Excel format download), student list/grid with search + field visibility settings, profiles with documents + **timeline** (`student-timeline-store`), **assign class across years** (`student/{id}/assign-class`, `student-record-*`), promote (`student-promote*` with roll regeneration), disabled students, login reports + admin password reset, export PDF/Excel.
- **Attendance**: student daily (per class/section), subject-wise attendance, staff attendance, Excel bulk import for each, holiday marking, monthly print registers (`student-attendance/print/...`), subject attendance average report.
- **Exams**: exam types, exam setup (per-subject mark distribution), exam schedule + print, marks register + import, marks grades, exam attendance, **seat plans**, position reports (per exam / all exams), tabulation sheet, merit list (+ custom merit list), mark sheet report (normal/student/percent/custom), **final vs subject mark sheets** (`final_mark_sheet`, `subject_mark_sheet`), results archive + previous class results, marks-by-SMS, exam signature settings, **custom result settings** (`custom-result-setting` — user-defined report-card layout/columns), progress cards (grade + percent variants), online exams (publish, question assign, auto-marking + manual marking views `online_answer_marking.blade.php`, marks register), question bank (groups, levels, M/T/F types), exam reset.
- **Fees**: fee groups/types/discounts (with assign-by-class search), masters (single + group), assign to students, collect fees (student-wise), payment receipts/invoices print, due search + due email, bank payment slips with approve/reject, carry-forward (`fees-forward`, settings + log views), Fees-v2 direct fees (installments `directFees/editSubPaymentModal`, invoice settings, payment reminders), fine report, balance report, transaction report, **due-fees login permission** (block login when dues, `due_fees_login_permission` + middleware `app/Http/Middleware/FeesDueCheckMiddleware.php`).
- **Accounts**: income/expense heads, add income/expense w/ documents, chart of accounts, bank accounts + statements, fund transfer, search account, transaction report, profit-by-date, payroll report.
- **HR**: departments, designations, staff directory/grid, staff admission w/ custom fields + documents + timeline, staff disable/enable, staff attendance + import, leave types/defines/apply/approve (+ pending/approved ajax tables), payroll: hourly rate, salary template (earnings/deductions), generate payroll, pay payroll, payslip print, payroll report.
- **Homework/Study material**: homework list/evaluation/evaluation report; upload content (assignment/study material/syllabus/other downloads) with per-class assignment; teacher content download views.
- **Communicate**: notice board (audience-targeted, email+SMS send), send email/SMS + logs, notification settings **per event** (`notification_settings`, `notification_event_modal/{id}/{key}`), SMS templates, custom SMS gateway settings + test send, events, news with comments moderation, forum (topics, comments, votes) — via `UserForumController`/`UserNewsController`, user PDF library, **phone call log / postal receive / postal dispatch / complaint (+types)** front-desk set.
- **Library**: books, categories, members (incl. parents), issue/return, all-issued search, library subjects.
- **Inventory**: categories, items, stores, suppliers, receive (+payments, cancel), sell (+payments, print, cancel), issue/return.
- **Transport**: routes, vehicles, assign vehicle (student), transport report.
- **Dormitory**: dormitory list, room types, rooms, student assign + report.
- **Frontend CMS (FrontSettings, 30 controllers)**: page builder (`frontend-page-builder`, `routes/pagebuilder.php`), home page widget manager (`admin-home-page`), header menu drag-drop manager (`header-menu-manager`), news + categories, courses + categories, testimonials, home slider, expert teachers, photo/video galleries, speech slider, donors, downloadable forms, contact page, about page, custom links, social media icons, custom pages, **public exam result page / class routine page / exam routine page / academic calendar** (`front_result`, `front-class-routine`, `front-exam-routine`, `front-academic-calendar`), Tawk + Facebook Messenger plugin settings.
- **System settings**: general settings, background settings (login screen), color style + **theme upload/install/remove** (`theme/upload|install|remove`, make-default), currency manager (multi-currency), language settings + **phrase-level translation editor** (`get-translation-terms`, `translation-term-update`) + language file export/import, date formats, timezones, SMS settings (Clickatell/Twilio/Msg91/Textlocal/AfricasTalking), email settings + test mail, payment gateways (PayPal/Stripe/PayUMoney + bank), API permission, **module permission** per role, **login access control**, login-password-reset policy, **button disable/enable** (UI-level permission), user logs, cron job page, backup (DB + files, download/restore — `app/Helpers/Dumper/Shuttle_Dumper.php`), **system update from vendor server** (`update-system`, `versionUpdateInstall`), maintenance mode, about-system, addons manager (`manage-adons`), **view-as role/parent/superadmin**, custom fields builder (student/staff/donor registration fields), exam signature settings, display settings.
- **Frontend/portal**: student panel (`resources/views/backEnd/studentPanel/*`), parent panel with per-child tabs, alumni panel (`routes/alumni.php`), graduate list, customer panel (shop), public school website via `routes/tenant.php` + Edulia theme.

### 1.7 Blade view-folder map (`resources/views/backEnd/<folder>/`, file counts)

| Folder | Files | Contents |
|---|---|---|
| `studentInformation` | 65 | admission wizard, student list/grid/profile, promote, custom fields, disabled students, login report |
| `examination` | 57 | exams, schedules, marks register, online exams, seat plans, marksheets, question bank |
| `systemSettings` | 47 | general/email/sms/payment settings, languages, currency, addons, backup, custom result settings, utilities |
| `frontSettings` | 53 | website CMS objects (news, courses, galleries, sliders, pages, routines public pages) |
| `studentPanel` | 44 | student portal pages (profile, fees, online exam, homework, attendance, transport, dormitory) |
| `feesCollection` | 44 | fee types/groups/discounts/masters, collect fees, bank slips, reports |
| `parentPanel` | 31 | parent portal incl. per-child tab includes (`inc/_dashboard_*`) |
| `admin` | 38 | roles, users, permissions, module mgmt, section settings |
| `humanResource` | 36 | staff directory, documents, timelines, leave, payroll/payslips |
| `reports` | 39 | tabulation, merit lists, progress cards, marksheet reports + prints, archives |
| `inventory` | 27 | items, stores, suppliers, receive/sell/issue flows |
| `accounts` | 15 | incomes, expenses, banks, transactions |
| `communicate` | 13 | notices, email/sms logs, events, notification settings |
| `library` | 11 | books, members, issue/return |
| `academics` | 20 | classes, sections, subjects, routines, optional subjects |
| `global` | 16 | super-admin "global *" shared-content screens |
| `customField` | 5 | registration custom-field builder |
| `graduate`, `alumniPanel`, `shift`, `transport`, `dormitory`, `events`, `homework`, `teacherEvaluation`, `notification_setting` | 2–7 each | smaller domains |
| `themeManager` | 1 | theme install surface |

Other top-level view roots: `auth/` (login), `frontEnd/` + `themes/edulia` (website), `lms/` (when Lms addon active), `pagebuilder/`, `plugins/`, `install/`, `errors/`, `components/` (sidebar components), `layouts/` (app/builder/pb-site).

### 1.8 Role panels (`routes/`)

- **Student panel** (`routes/student.php`, 70 route defs): dashboard, profile + document upload/download, fees payment via PayPal/Stripe (`studentPayByPaypal`, `fees-payment-stripe`), online exams (take, submit, answer-script view `student-answer-script/{exam_id}/{s_id}`), class routine + routine print, own attendance + monthly print, results, exam schedule, homework download, teacher directory, book list/issue, transport/dormitory views, syllabus, timeline doc download, university-semester variants (`university/student/*`).
- **Parent panel** (`routes/parent.php`, 36): children switching (`backEnd/menu/parent_children_menu.blade.php`), per-child fees/attendance/homework/exam, child bank-slip store, child info/list.
- **Teacher** (`routes/teacher.php` is a stub — teacher powers ride the staff panel + `app/Http/Controllers/teacher/*` for API: homework, content, leave, search).
- **Alumni** (`routes/alumni.php`): alumni dashboard + directory; **Graduate** (`routes/graduate.php`): graduate list ajax (`GraduateListController.php`).
- **Customer** (shop buyer): `customer-dashboard`, `customer-purchases` (`routes/tenant.php`).

### 1.9 Mobile API surface

- `routes/api.php` (739 endpoints): legacy flat endpoints for login, students, fees, exams, attendance, library, inventory, transport, dormitory, leave, notices, plus SaaS-aware (`banks/{school_id}`).
- `routes/v2api.php` (223 endpoints): versioned controllers in `app/Http/Controllers/api/v2/` grouped per persona (`Student/`, `Teacher/`, `Parent/`, `Admin/`), including live-class adapters per provider (`Student/Class/{Zoom,GMeet,BBB,Jitsi}Controller.php`) and payments (`Student/Payment/{Wallet,PaymentHandler}Controller.php`).
- FCM push: `PushNotificationController`, `set-fcm_key` routes.

---

### 1.10 Settings surface enumeration (`resources/views/backEnd/systemSettings/`, 47 pages)

System/tenant config pages, each a route group in `routes/admin_tenant.php` under `Admin\SystemSettings\*`:

- Identity: `generalSettingsView` / `updateGeneralSettings` (name, logo, email, phone, address, currency, date format, timezone), `updateSettings` (frontend flags), `backgroundSetting` (login-screen gallery via `SmBackgroundSetting`), `preloader`.
- Academic scaffolding: `academic_year`, `session`, `baseSetup/` (base group + base setup dropdowns), `weekend`, `optional_subject_setup`.
- Fees/exams configuration: `feesCarryForward*` (settings/view/log), `custom_result_settings` + `custom_result_setting_add`, `fees_settings`/`exam_settings` groups (limits.json section ids).
- Communication: `emailSettingsView` (SMTP + test mail), `smsSettings` (5 gateway tabs + custom gateway + templates), `notification_setting/` (per-event matrix).
- Payments: `paymentMethodSettings` (PayPal/Stripe/PayUMoney/bank + active toggles), gateway callback controller `PaymentGatewayCallbackController.php`.
- People/permissions: `role/` (roles + permission matrix), `modulePermission` + `assignModulePermission`, `apiPermission`, `login_access_control`, `login-password-reset`, `buttonDisableEnable`, `user/` (user list).
- i18n & money: `languageSettings`/`languageSetup`/`language_export`/`language_import` (phrase editor), `manageCurrency` + `create_update_currency`.
- Platform ops: `backupSettings`, `cron_job`, `utilityView` (`utilities/{action}`: clear cache etc.), `aboutSystem`, `displaySetting` (dashboard widgets), `ManageAddOns`, `plugin_setting` (Tawk/Messenger), `customLinks`, `system_reactivated`, `tableEmpty` (empty-table diagnostics).

This is the most complete settings taxonomy in the codebase — 47 distinct admin pages vs ASchool needing one per plugin.

---

## 2. UI/UX PATTERNS

### 2.1 Layout system
- Backend master: `resources/views/backEnd/master.blade.php` = `@include(header)` + `@yield('mainContent')` + `@include(footer)`; `resources/views/layouts/app.blade.php` and `builder.blade.php` for other surfaces.
- Header partial `backEnd/partials/header.blade.php` carries: academic-year switcher (`change-academic-year`), language switcher, notifications, view-as dropdown, RTL toggle route (`theme-style-rtl`), user menu.
- Partials library in `backEnd/partials/`: `data_table_css/js`, `date_picker_css_js`, `date_range_picker_css_js`, `multi_select_js`, `server_side_datatable`, import dialogs (`student-import`, `register-import`, `subject-import`), `alertMessage` (Toastr), role sidebars (`staff/student/parents`).
- Search/CRUD convention: nearly every list page is a "criteria row + table + modal add/edit" blade; ajax helpers under `routes/admin_tenant.php` `ajax*` (~40 endpoints) feed dependent dropdowns (class→section→subject→shift/branch).

### 2.2 Sidebar & menu organization (the interesting part)
- Fully **database-driven**: `SmMenu` rows per school (3 levels: section-separators → groups → items), seeded per school on creation from `default_menus` in `app/SmSchool.php::insertMenu()`; rendered by `resources/views/components/sidebar-component.blade.php` → `backEnd/menu/{staff,student,parent}.blade.php` + `*_sub_menu.blade.php`.
- Rendering is gated 4 ways per item: `userPermission(route)` (role-route perms), `moduleStatusCheck(module)` (addon active), `isModuleForSchool()` + `isMenuAllowToShow()` (SaaS package assignment), plus fees-status switch choosing between the two fees modules (`generalSetting()->fees_status`).
- Sections are rendered as `menu_seperator` labels; a small script hides empty separators (`sidebar-component.blade.php` lines 69–84).
- The bundled `MenuManage` module gives runtime reordering (`arrange-table-row-position`, `reordering`), per-section config, and reset-to-default — i.e., **each school can reorganize its own sidebar**.
- Per-user menus exist too: `user-custom-menu/{slug}` + `StoreMenuController` — individual users can pin a personal menu subset.
- Distinct menus per persona: staff (largest), student, parent (children-submenu), SaaS superadmin (`saas::menu.Saas`), and `without_saas_school_admin_menu.blade.php`.

### 2.3 Forms & tables
- Server-side DataTables: `backEnd/partials/server_side_datatable.blade.php` + `DatatableQueryController.php` exposes ~30 `*-datatable` ajax endpoints (see routes: `student-list-datatable`, `income-list-datatable`, …). Client-side variant via `data_table_js.blade.php`.
- Excel import pattern everywhere: template download (`download_student_file`, `download-staff-attendance-file`) → upload → temp-table preview (`StudentBulkTemporary`, `StudentAttendanceBulk`, `SmStaffAttendanceImport`) → commit (`*-bulk-store`).
- Print pattern: every report has a paired print route (`mark-sheet-report/print/...`, `student-attendance/print/...`, `print-payslip`, certificate/ID generation print views) — printing is first-class.

### 2.4 Dashboards
- One main admin dashboard (`backEnd/dashboard.blade.php`) with **user-configurable widget visibility**: `dashboard/display-setting` + `systemSettings/displaySetting.blade.php` backed by `SmDashboardSetting`.
- Separate dashboards per persona: `backEnd/parentPanel/parent_dashboard.blade.php`, `backEnd/alumniPanel/alumni_dashboard.blade.php`, `backEnd/customerPanel/customer_dashboard.blade.php`, student panel dashboard views; SaaS superadmin dashboard comes from the Saas addon (`superadmin-dashboard` route).
- The academic-year selector in the header re-scopes the whole dashboard (data scopes filter by `academic_id` + `school_id`).

### 2.5 Report card / marksheet UI
- Deepest UX area. Views under `backEnd/reports/` and `backEnd/examination/`: mark sheet (normal/student/percent/old), **final marksheet** vs **subject marksheet**, merit list + print, custom merit list, tabulation sheet + print (incl. localized print variant `tabulation_sheet_report_print_lang.blade.php`), progress cards (grade-based and percent-based, whole-class variant), position reports, results archive.
- **Custom result engine** (differentiator): `custom-result-setting` CRUD (`systemSettings/custom_result_setting_add.blade.php`) lets a school define which columns/sections/rubrics appear on its report card; results are then rendered from `SmCustomTemporaryResult` + `CustomResultSetting.php` root model. This is how InfixEdu satisfies wildly different report-card formats without code changes.
- Exam signature settings (stamp/signature per exam print) — `ExamSignatureSettingsController.php`.

### 2.6 Multi-language
- Shipped locales: `resources/lang/{ar,be,bn,ca,en,es,fr,hi,indo}`.
- Runtime language manager: add language rows (`sm_languages`), edit **phrase-level translations in DB** (`sm_language_phrases`, `language-setup/{id}`, `get-translation-terms`, `translation-term-update`), export/import lang files (`lang-file-export/{lang}`, `file-export`), per-user locale switch (`locale/{locale}` in `routes/tenant.php`), cached menu/lang names (`$menu->lang_name`).
- **RTL**: toggle route `theme-style-rtl` + `backEnd/partials/rtl` partial injected by `css.blade.php` (class-based, CSS-only; shipped Arabic locale is the target).

### 2.7 Themes & skins
- Backend skin = `SmStyle` color themes: `color-style`, `make-default-theme/{id}` (`Admin/Style` controllers) — palette swap only.
- Frontend themes are full packages: theme upload/install/remove routes (`theme/upload|install|remove`) + bundled `themes/edulia` (Edulia has its own controllers `app/Http/Controllers/Theme/Edulia/*`, pagebuilder views and demo content); `activeTheme()` helper switches frontend rendering in `routes/tenant.php` (`if (activeTheme() !== 'edulia')`).
- Background settings control login-screen imagery; preloader partial; **page builder** for the public website (`routes/pagebuilder.php`, `PageBuilderController.php`, `views/pagebuilder`).

### 2.8 Onboarding / installer
- `resources/views/install/`: welcome → environment check (`checkEnvironmentPage.blade.php`) → DB setup (`installPage2`) → purchase verification (`check_purchase_page`, `pro_verification_page`) → system setup (`systemSetupPage`) → confirmation.
- Purchase code verified against **Envato API** in `app/Http/Controllers/VerifyController.php` (`Envato::verifyPurchase`, item id `23876323`); stored in `sm_general_settings` (`system_purchase_code`, `envato_user`); re-check middleware `Http/Middleware/CheckVerify.php` + `PurchaseVerification.php`.
- In-app updater: `database-upgrade`, `update-system`, `versionUpdateInstall` + root `config.json` (version 9.4.0, release 20/08/2026, migration manifest) — the vendor server (spondonit.com) ships update zips and migration lists.

### 2.9 UX observations worth copying (and avoiding)
- **Good**: dependent-dropdown ajax fan-out (`/academic-year-get-class`, `/branch-get-shifts`, `/ajax-get-roll-id`, `/ajaxSubjectFromExamType` … ~40 endpoints) keeps long forms workable; every destructive action has a confirm modal view (`delete-*-view` routes); settings pages group by domain with left-tab sub-nav (`systemSettings/*`).
- **Good**: academic-year awareness is visible everywhere (header switcher + scoped lists), and "view as role/parent" (`view-as-role`, `view-as-parent`, `view-as-superadmin`) lets admins verify each persona quickly.
- **Bad**: page-level consistency relies on copy-paste — duplicated ajax endpoints exist for the same dropdowns across years of patches; legacy v1 views remain (`mark_sheet_report_old.blade.php`, `addToDo_old.blade.php`, `.blade - Copy.php`, `.blade copy.php` files in `backEnd/reports/`).
- **Bad**: navigation depth — the staff sidebar holds well over 100 leaf items; sections (separators) are the only grouping, there is no command palette, favorites, or search-over-menu (there is global content search: `SmSearchController.php`).
- **Bad**: form validation UX is server-round-trip Toastr toasts; there is no client-side validation framework beyond browser defaults.

---

## 3. MULTI-BRANCH / SAAS ARCHITECTURE

- **Data model**: one database. Every domain table has `school_id` FK (`database/migrations/2014_11_01_000001_create_sm_schools_table.php` and beyond). `sm_schools` holds domain, school_code, package_id, plan_type (`yearly|monthly|once`), starting/ending dates, `is_enabled` login flag, active_status.
- **Tenancy resolution**: `app/Http/Middleware/SubdomainMiddleware.php` resolves the school from the subdomain via `SaasSchool()` (helper in `app/Helpers/saas.php`), binds `app()->instance('school', $school)`, and loads a per-school chat/settings valuestore. Root domain shows the landing page (`LandingController@index` when `config('app.app_sync')`).
- **Scoping**: global Eloquent scopes in `app/Scopes/` (`SchoolScope`, `AcademicSchoolScope`, `StatusAcademicSchoolScope`, `ActiveStatusSchoolScope`, `GlobalAcademicScope`) automatically add `where school_id` (and academic year) to queries — controllers rarely filter manually.
- **Academic session layer**: separate from tenancy — `sm_academic_years` + `YearCheck` (`app/Support/YearCheck.php`); header switcher `change-academic-year` re-scopes all data; "Global *" routes (`global-section`, `global-class`, `global-exam`...) let super admins create content shared across schools/years.
- **SaaS module (sold separately, not in this package)**: superadmin menu (`saas::menu.Saas`), packages, per-school module assignment (`isModuleForSchool()` in `app/Helpers/saas.php`), subscription payments (`Modules\Saas\Entities\SmSubscriptionPayment` referenced from `app/SmSchool.php::subscription()`), school admin "view as school" (`view-as-superadmin`), school secret login (`school-secret-login`). Related addons: `SaasSubscription`, `SaasRolePermission`, `SaasHr`.
- **Intra-school branches**: handled by a `Branch` addon + a built-in **shift** system. Evidence: `branch_id` params threaded through attendance/routine print routes (`student-attendance/print/{class_id}/{section_id}/{month}/{year}/{shift?}/{branch_id?}`), `BranchDataController.php`, `ShiftModuleDataGetController.php`, `/shifts` CRUD + `shift-setting`, and ajax endpoints `/branch-get-shifts`, `/shift-get-class`.
- **Middleware inventory** (`app/Http/Middleware/`, 31 classes) — the feature-policy layer: `SubdomainMiddleware` (tenancy), `UserRolePermission` (route perms), `ModulePermissionMiddleware` (addon gating), `SubscriptionAccessUrl` (plan gating of routes), `ThemeCheckMiddleware` (frontend theme), `StudentMiddleware`/`ParentMiddleware`/`CustomerMiddleware`/`AlumniMiddleware` (persona panels), `FeesDueCheckMiddleware` (dues block), `TwoFactorMiddleware`, `CheckVerify`/`PurchaseVerification` (license), `XSS` (input sanitize), `Localization`, `CheckMaintenanceMode`, `RouteServe` (auto route cache), `HttpsProtocol`, `ForceJsonResponse` (API), `SAMiddleware` (super-admin), `CheckDashboardMiddleware` (dashboard route gate), `CheckUserMiddleware`.
- **Implication for ASchool**: InfixEdu's tenancy is transparent to feature code because of the global scopes; the cost is that every table carries `school_id` + `academic_id` and migrations are 343-files-deep of duplicated column additions.

---

## 4. MODULE / ADDON SYSTEM

- **Bundled core modules** live in `Modules/<Name>/` (Laravel-Modules layout): `module.json` (name/alias/providers), `Entities/`, `Http/Controllers`, `Http/Requests`, `Routes/web.php` + `Routes/api.php`, `Providers/{Name}ServiceProvider.php` + `RouteServiceProvider.php`, `Database/Migrations`, `Resources/views`, `Resources/var/limits.json` (module limits). Example: `Modules/Fees/` (full listing in 1.5).
- **Route registration**: each module's `RouteServiceProvider` maps its routes; blade hooks call `moduleStatusCheck('Alias')` (→ `app/Support/ModuleRegistry::isActive()` via `app/Helpers/Helper.php`) before showing entries; `modules_statuses.json` at repo root stores on/off state; `generalSetting()->fees_status` even picks *which* fees module renders (v1 `fees_collection` vs v2 `Fees`).
- **Addon installation** (`moduleFileUpload` in `app/Http/Controllers/Admin/SystemSettings/SmSystemSettingController.php:3479`): admin uploads a zip → stored to `storage/app/module_file` → extracted to `storage/app/tempUpdate` → copied into `base_path('Modules/')` → `moduleVerify(zipname)` if defined → module migration run → enable/disable via `manage-adons-enable|disable` (`app/Http/Controllers/Admin/SystemSettings/SmAddOnsController`). There is no signature check or dependency resolution beyond `module.json`'s `requires` field (empty in practice).
- **Addon manifests** (from `InfixEdu School Modules/` samples): `RazorPay.zip` → `RazorPay/module.json` (providers list) + `RazorPay/RazorPay.json` containing `{"RazorPay": {"item_id": "27721206", "migration": {...}, "versions": ["2.0"], "url": "https://spondonit.com/contact"}}` — the `<Name>.json` file is the license/registration artifact checked against the Envato item id. Jitsi addon (`Jitsi_v1.4.zip`) adds `Entities/JitsiMeeting`, settings view, live-class routes under the same conventions.
- **Licensing**: Envato purchase-code verification at install (2.8) + per-module verification hooks (`Moduleverify.blade.php`, `ProModuleverify.blade.php` in `views/install/`); "Download Center" style upsell pages (`Download More Addons.html` in the modules folder).
- **Packaging economics**: the base purchase excludes most differentiating modules. The staff menu hard-codes the paid list `$paid_modules = ['Branch','CbseExam','Zoom','University','Gmeet','QRCodeAttendance','BBB','ParentRegistration','InfixBiometrics','AiContent','Lms','Certificate','Jitsi','WhatsappSupport','InAppLiveClass','OnlineExam']` (`resources/views/backEnd/menu/staff.blade.php:3`) — i.e., online exams, LMS, certificates, live classes, biometrics, and the entire SaaS layer are extra purchases, each with its own Envato item id (RazorPay addon: `item_id 27721206` in `RazorPay/RazorPay.json`).
- **Module refresh**: `ModuleRefresh` route re-scans installed modules; `versionUpdateInstall` and `post('moduleFileUpload')` are the only install paths; module state toggles rewrite `modules_statuses.json` from the UI.
- **Weaknesses to note**: module enable/disable writes a JSON file (file-writable state in prod), the addon upload path extracts arbitrary PHP into the app (RCE-by-design if an admin account is compromised), and there's no per-module service contract — cross-module calls go through `moduleStatusCheck()` conditionals scattered in blade and controllers (`routes/tenant.php` lines with `if (moduleStatusCheck('Lms'))`).

---

## 5. WHAT ASCHOOL LACKS — concrete gap list (InfixEdu has, ASchool does not)

### 5.0 Domain coverage matrix

| Domain | InfixEdu v9.4.0 | ASchool today | Gap? |
|---|---|---|---|
| Admission CRM | `admission-query` + follow-ups + `Lead` addon | admission plugin | Follow-up pipeline + lead stages |
| Students records | multi-year records, timeline, custom fields | student_portfolio | Timeline + custom registration fields |
| Attendance | daily + subject-wise + staff + Excel import + print registers | attendance | Subject-wise + print register + bulk import UX |
| Timetable | day-wise routine editor + per-shift + print | timetable | Shift dimension |
| Exams core | types, setup, schedule, seat plans, marks register | exams | Seat plans, mark distribution setup |
| Report cards | custom-result engine, merit list, tabulation, archive | basic_reports | Entire custom-result engine |
| Online exams | publish, auto+manual marking, script view | online exams + question bank | Marking workflow parity check |
| Fees | carry-forward, installments, fines, waivers, bank slips, wallet, due-block | fees (eSewa/Khalti/FonePay) | §5.1–8 lifecycle features |
| Accounting | incomes/expenses, chart of accounts, banks, fund transfer | — (basic_reports only) | Full accounts ledger |
| HR/Payroll | templates, generate/pay payroll, payslips, leave engine | hr_payroll | Leave engine depth (types→define→approve) |
| Library | books, members, issue/return | library (copies/holds/fines/stocktake) | ASchool ahead on copies/holds/stocktake; issue-flow parity fine |
| Inventory | suppliers, receive/sell/issue w/ payments | inventory | ASell/receive payments flow |
| Transport | routes/vehicles/assign + reports | — | Whole domain |
| Hostel/Dormitory | dormitory, room types, rooms, assign | hostel | ASchool likely ahead (modern); parity check |
| Communicate | notices, email/SMS logs, per-event settings, forum, news comments | notices, sms_notifications | Notification matrix, forum, comment moderation |
| Front-desk | complaints, postal, phone-call logs | incident_management (different) | Postal/phone-call log set |
| Website CMS | page builder, theme, menus, galleries, public results/routines | website_builder, basic_website | Public result/routine pages, header-menu manager |
| Live classes | Zoom/BBB/Gmeet/Jitsi/InApp (all addons) | conferences | Verify provider coverage |
| Behaviour | incidents + points + rank reports | incidents, incident_management | Points/rank reporting |
| Multi-branch | Branch addon + shifts | multi_branch | ASchool ahead (native) |
| Nepal | none (Khalti/HimalayaSms addon slots) | iEMIS, BS dates, SEE/NEB, Sparrow | ASchool ahead |
| AI | `AiContent` addon slot only | ai_suite, ai_teacher | ASchool far ahead |

### 5.1 Itemized gaps

Ordered by likely user value. Evidence paths are InfixEdu's.

**Fees**
1. **Fees carry-forward across academic years** — outstanding balances roll into the new year: `fees-forward`, `fees-carry-forward-settings-view`, `fees-carry-forward-log-view` (routes/admin_tenant.php) + `app/SmFeesCarryForward.php` + `systemSettings/feesCarryForward*.blade.php`.
2. **Installment-based invoicing** — an invoice is split into installment child rows with per-installment payments: `fm_fees_invoice_chields` (Modules/Fees/Database/Migrations/2021_07_31_072347...), `directFees/editSubPaymentModal`, `directFees/deleteSubPayment`, `direct-fees-total-payment`.
3. **Due-fees login blocking** — a student/parent cannot log in (or selected features) while dues exist, toggleable: `due_fees_login_permission` + `app/Http/Middleware/FeesDueCheckMiddleware.php`.
4. **Bank payment slip workflow** — offline bank transfer with slip upload → admin approve/reject: `bank-payment-slip`, `approve-fees-payment`, `reject-fees-payment`, `app/SmBankPaymentSlip.php`.
5. **Fines & waiver accounting as reports**: `fine-report`, `student-fine-report`, `waiver-report` (Modules/Fees/Routes/web.php), `fm_fees_weavers`.
6. **Wallet with deposits/refunds & approvals** (Modules/Wallet): deposit approval queue, refund request queue, wallet transactions, pay fees from wallet.
7. **Gateway service charge** per method: `gateway-service-charge` (Modules/Fees/Routes/web.php).
8. **Due reminders**: `directFees/paymentReminder`, `direct_fees_reminders` (resources/var/defaults.json).

**Exams & results**
9. **Custom report-card settings engine** — school-defined report-card layouts/columns without code: `custom-result-setting` + `app/CustomResultSetting.php` + `SmCustomTemporaryResult`.
10. **Seat-plan generator + admit-card designer** with layout switcher: `seat-plan*` routes, `Modules/ExamPlan` (`admitcard/setting`, `changeAdmitCardLayout`, `seatplan/generate`), `sm_seat_plans`.
11. **Exam signature settings** (printed signature/stamp per exam): `exam-signature-settings` + `ExamSignatureSettingsController.php`.
12. **Merit list & position engine** (temporary merit lists, per-exam and cumulative positions, custom merit lists): `merit-list-report`, `all-exam-report-position`, `custom-merit-list`, `app/SmTemporaryMeritlist.php`.
13. **Tabulation sheet + localized print**: `reports-tabulation-sheet`, `tabulation_sheet_report_print_lang.blade.php`.
14. **Results archive / previous-class results viewer** for alumni-style lookups: `results-archive`, `previous-record`, `previousClassResults.blade.php`.
15. **Marks distribution / grade setup per exam** (subject-level mark distribution before marks entry): `exam-setup/{id}`, `app/SmExamSetup.php`, `SmExamSetting`.
16. **Marks by SMS** push after result publication: `send-marks-by-sms`, `app/SmMarksSendSms.php`.
17. **Online-exam manual marking with answer-script view**: `online-exam-marking`, `online_answer_marking.blade.php`, `online_answer_auto_marking.blade.php`.
18. **Exam attendance** as its own register: `exam-attendance*`, `app/SmExamAttendance.php`.

**Student information**
19. **Dynamic registration custom fields** (per role: student/staff/donor) configurable at runtime: `student-registration-custom-field*`, `staff-reg-custom-field*`, `donor-reg-custom-field*` + `SmCustomFieldController.php`.
20. **Student timeline** (chronological activity log on profile with attachments): `student-timeline-store`, `app/SmStudentTimeline.php`.
21. **Certificate builder + bulk ID-card/print factory** (layout designers, default templates, bulk by class): `student-certificate` CRUD, `generate-certificate-print`, `student-id-card` + `Modules/BulkPrint` (staff ID, fees receipts, payslips, certificates bulk).
22. **Sibling linkage during admission**: `ajaxSiblingInfo`, `ajaxSectionSibling` (routes/admin_tenant.php).
23. **Multi-year student records** (one row per class/year with restore/soft-delete): `student/{id}/assign-class`, `student-record-restore/{record_id}`, `student_records` migration.
24. **Student login reports + admin password reset**: `student-login-report`, `reset-student-password`.

**Communication / front desk**
25. **Per-event notification settings matrix** (choose email/SMS/push per system event): `notification_settings`, `notification_event_modal/{id}/{key}`, `notification-settings-update`.
26. **Front-desk module set**: phone call log, postal receive, postal dispatch, complaints + types (`phone-call`, `postal-receive`, `postal-dispatch`, `complaint` resource routes).
27. **Admission query CRM with follow-ups** (+ Lead addon): `admission-query`, `query-followup-store`, `app/SmAdmissionQueryFollowup.php`, `Modules/Lead`.
28. **School forum & moderated news comments** for the community: `user-forum-*` (topics, votes), news comment moderation (`news-comment-status`), `UserForumController.php`, `UserNewsController.php`.
29. **SMS/email template editor** (Modules/TemplateSettings: `email-template`, `sms-template`).
30. **Custom SMS gateway + test SMS** (any provider via URL template): `save-custom-sms-setting`, `send-test-sms`.

**Frontend website / CMS**
31. **Drag-and-drop page builder for the public site**: `routes/pagebuilder.php`, `PageBuilderController.php`, `views/pagebuilder`, theme `themes/edulia` with demo content.
32. **Public result / routine / calendar pages** (parents check results and routines without login): `front_result`, `front-class-routine`, `front-exam-routine`, `front-academic-calendar`.
33. **Header menu manager + homepage widget manager**: `header-menu-manager`, `add-element`, `reordering`, `admin-home-page` (`app/SmHeaderMenuManager.php`, `SmHomePageSetting.php`).
34. **Rich school-site content objects**: home slider, expert teachers, testimonials, photo/video galleries, donors, downloadable forms, speech slider, courses (public), events (`/home-slider`, `/expert-teacher`, `/donor`, `form-download`, `speech-slider`, `course-list` routes).
35. **Third-party site plugins**: Tawk.to + Facebook Messenger settings (`plugin/tawk-setting`, `plugin/facebook-messenger-setting`).

**System / platform**
36. **Phrase-level translation editor + language file export/import** (non-devs can complete a translation): `language-setup/{id}`, `get-translation-terms`, `lang-file-export/{lang}`.
37. **Multi-currency manager with conversion endpoint**: `manage-currency`, `currency-converter` (api.php), `app/SmCurrency.php`.
38. **Built-in DB+files backup with restore** (no server shell needed): `backup-store`, `get-backup-db`, `restore-database/{id}` + `app/Helpers/Dumper/Shuttle_Dumper.php`.
39. **Self-updater** from vendor server (version + migration manifest in `config.json`): `update-system`, `post('admin/update-system')`, `versionUpdateInstall`.
40. **Base-setup option manager** (school-defined dropdowns reused across the app): `base-group`, `base-setup` + `SmBaseGroup/SmBaseSetup`.
41. **Role/route permission matrix + module-permission assignment + UI-button disable** (granular, DB-stored): `assign-permission/{id}`, `module-permission`, `button-disable-enable`, `app/SmRolePermission.php`, `Modules/RolePermission`.
42. **Login access control** (per-role login windows/rules): `login-access-control`, `SmLoginAccessControlController.php`.
43. **Shift system** (morning/day/evening school shifts with per-shift classes, routines, attendance, and print routing): `/shifts`, `shift-setting`, `shift` params in print routes, `ShiftController.php`.
44. **Teacher evaluation by students with approval workflow**: `teacher-evaluation-setting`, `teacher-approved/pending/wise-evaluation-report` + `TeacherEvaluationController.php` + migrations `2023_07_21_081453_add_teacher_evaluation_sidebarmenu.php`.
45. **Weekend/holiday-aware attendance** (weekend table + "holiday store" during attendance): `weekend` resource, `student-attendance-holiday`, `app/SmWeekend.php`.
46. **2FA addon behavior** (Modules/TwoFactorAuth: verify/resend/settings), **user activity log viewer** (`user-log`), **maintenance mode toggle** (`maintenance_mode`), **cron job settings page** (`cron-job`).

**Nepal-relevant echoes**
47. InfixEdu has no Nepal specifics, but its **Khalti addon slot** (`modules_statuses.json` "KhaltiPayment") shows the same gateway ASchool ships — the gap is not the gateway but the surrounding fee-engine features (1–8) that Nepali schools bill with.

---

## 6. WHERE ASCHOOL IS AHEAD

1. **Architecture**: InfixEdu is a single Laravel monolith with blade + jQuery (~981 blades, no SPA), where ASchool is Flask (756 JSON endpoints) + Next.js (216 pages, manifest-driven sidebar) + 5 Flutter apps. InfixEdu's mobile support is bolted on via two parallel API generations (`routes/api.php` + `routes/v2api.php`) with duplicated logic; ASchool's Flutter apps consume one API surface.
2. **True plugin architecture**: ASchool's 50 plugins vs InfixEdu's 16 bundled modules + 48 addon *slots* where most addons are absent, sold separately, and installed as raw zip drops (§4). InfixEdu's "plugin boundary" is blade conditionals, not an API contract.
3. **Multi-tenancy model**: InfixEdu's SaaS layer is an addon you must buy and self-assemble; per-school module assignment exists but package/subscription management is in a separate module. ASchool has tenancy + billing as platform primitives.
4. **AI**: InfixEdu's only AI surface is the `AiContent` addon slot (not bundled). ASchool ships ai_suite (24 tools + tutor + workbench) and ai_teacher — an entire category InfixEdu cannot answer.
5. **Nepal localization**: BS calendar (ASchool native) vs InfixEdu AD-only (`dateConvert()` in `app/Helpers/Helper.php`); iEMIS compliance + iemis_importer, SEE/NEB grading, Sparrow SMS, eSewa/Khalti/FonePay native — none exist in InfixEdu base (Khalti/HimalayaSms are unbundled addon slots only).
6. **Safety & wellbeing stack**: disaster_management, emergency, dismissal, wellbeing, health_records, gps_tracking, conferences, visitor_management (full), biometric — InfixEdu has only visitor logs (`sm_visitors`) and an unbundled `InfixBiometrics` addon; no dismissal, emergency, GPS, or health domains at all.
7. **Modern content**: website_builder + design_studio (canvas/writer/bulk PDFs) vs a legacy pagebuilder tied to the Edulia PHP theme; elibrary/student_portfolio/gamification have no InfixEdu equivalents (nearest: DownloadCenter + BehaviourRecords points).
8. **Ops observability**: Celery + pgvector vs InfixEdu's cron page + Shuttle DB dump; ASchool's background jobs are real queues.
9. **Code hygiene**: InfixEdu carries `_old`, `- Copy`, `backup`, `XSmClassRoutineNewController`, duplicated `SmStudentAdmissionController_old.php` files and commented-out route blocks (`routes/tenant.php` news/course blocks) — ASchool's manifest-driven structure avoids this drift.
10. **White-label & branding**: ASchool white_label plugin; InfixEdu hard-codes its own branding in installer/about pages (`about-system`, `views/install/welcome_to_infix.blade.php`).

---

## 7. ORGANIZATION LESSONS FOR ASCHOOL (50-plugin sidebar & backend)

1. **DB-driven, school-copyable menu** (§2.2): ship a default menu seed per role (like `default_menus` → `sm_menus` via `SmSchool::insertMenu()`), then let each school reorder/hide via UI (MenuManage equivalent). ASchool's manifest-driven sidebar is a good spine; adding a per-tenant overrides table + reset-defaults gives InfixEdu's flexibility without its runtime fragility.
2. **Menu gating should compose four checks** exactly like InfixEdu's blade guards: (a) role permission on route, (b) plugin enabled, (c) tenant plan/module assignment, (d) feature flag — implement once in the sidebar manifest pipeline instead of scattering.
3. **Separator-based grouping with auto-hide**: InfixEdu renders section separators and hides any empty group client-side (`sidebar-component.blade.php` lines 69–84) — with 50 plugins ASchool should define ~10–12 stable separator groups (mirror of its controller split): Academics (timetable, curriculum, lms, elibrary), Assessment (exams, online exams, question bank, report cards), People (admission, students, staff/hr, alumni), Money (fees, wallet), Operations (library, inventory, hostel, transport, biometric, visitor, dismissal), Safety (emergency, disaster, wellbeing, health, incidents), Communication (notices, SMS, whatsapp, conferences), Site (website builder, basic website), Compliance (iEMIS), System.
4. **One settings spine with per-domain sections**: InfixEdu funnels every config through `Admin/SystemSettings` + a `general_settings` row + domain settings tables (`sm_email_settings`, `sm_sms_gateway`, `sm_payment_gateway_settings`...), each with a settings page. ASchool should ensure each plugin registers exactly one settings section into a unified settings tree (like `optionbuilder.php`), not ad-hoc pages.
5. **Report-card configurability as a feature, not code** (§2.5): adopt a "custom result setting" model — per-school report-card layout definitions rendered by one engine — before Nepali schools each ask for their own format (SEE/NEB makes this even more valuable).
6. **Fees engine completeness**: pick up gaps §5.1–8 in priority order: carry-forward → installments → due-login-block → bank-slip approval → fines/waivers reporting. These are the features every Nepali billing office asks for first.
7. **Per-event notification matrix** (§5.25): a single notification-settings table keyed by system event × channel (push/SMS/email/WhatsApp) replaces per-plugin notification toggles — InfixEdu's `notification_event_modal` pattern is the reference.
8. **Dynamic registration fields per role** (§5.19): needed for iEMIS variance between school types; store as custom-field definitions rather than new migrations.
9. **"Everything prints" discipline**: every list ASchool ships should have a print/export twin route from day one (InfixEdu pairs every report with `/print/...`); bulk-print as a shared capability (IDs, certificates, receipts, payslips) not per-plugin code.
10. **Import pipeline pattern**: template download → temp table preview → commit (`StudentBulkTemporary` → `student-bulk-store`); adopt this three-step UX in ASchool's importers (iemis_importer already has the data; copy the UX).
11. **Global-scope tenancy**: InfixEdu proves that centralizing tenant + academic-year scoping in ORM layers (or Flask equivalents: session-scoped query helpers) keeps 750 endpoints consistent; make `school_id` + `academic_year_id` mandatory indexes at schema review.
12. **Addon hygiene**: InfixEdu's module.json + manifest json (Envato item id) is a simple license/install contract; ASchool's plugin system should formalize: manifest → migrations → routes → menu entries → permissions → settings, so third-party plugins (and internal ones) install identically — and add the dependency/signature checks InfixEdu lacks (§4 weaknesses).
13. **License/entitlement UX without Envato**: InfixEdu couples feature access to Envato purchase codes and per-module manifests; ASchool can do the same job with plan-tier flags on its own billing — but copy the *installation* part (upload zip → migrate → enable → menu appears) as the acceptance test for the plugin SDK.
14. **Print-artifact templates are data, not code**: certificates, ID cards, admit cards, payslips, and invoices in InfixEdu are template rows with layout switchers (`changeAdmitCardLayout`, `set-default-certificate/{id}/{type}`, `invoice-settings` in Modules/BulkPrint) — ASchool's design_studio should absorb these as template objects (canvas-rendered) rather than hard-coded print views.
15. **Academic-year as a first-class axis**: every InfixEdu list/report answers "which year?" via the header switcher + scopes. ASchool must decide explicitly whether its BS-year + AD-year duality replaces this axis, and make every plugin query it from one helper (like `YearCheck::getAcademicId()`), never from raw `date()`.
16. **Search parity**: InfixEdu ships a global content search (`SmSearchController.php`) across students/staff/pages; with 50 plugins, ASchool's sidebar needs this more than InfixEdu does — consider command-palette search over the sidebar manifest (cheap because the manifest already exists).

---

## Appendix A — Key evidence paths (absolute, short-form relative to `upload_extracted/`)

- Route layer: `routes/admin_tenant.php` (main back office), `routes/api.php` (739 legacy mobile), `routes/v2api.php` (223 v2 mobile), `routes/tenant.php` (public site), `routes/pagebuilder.php`.
- Tenancy: `app/Http/Middleware/SubdomainMiddleware.php`, `app/Scopes/SchoolScope.php`, `app/Scopes/AcademicSchoolScope.php`, `app/SmSchool.php`, `app/Helpers/saas.php`.
- Menus: `resources/views/components/sidebar-component.blade.php`, `resources/views/backEnd/menu/staff.blade.php`, `Modules/MenuManage/`, `app/SmSchool.php::insertMenu()`.
- Addons: `app/Http/Controllers/Admin/SystemSettings/SmSystemSettingController.php:3479` (`moduleFileUpload`), `modules_statuses.json`, `Modules/Fees/module.json`, `/tmp`-inspected `RazorPay/{module.json,RazorPay.json}` from `InfixEdu School Modules/`.
- Licensing/install: `app/Http/Controllers/VerifyController.php`, `app/Envato/Envato.php`, `resources/views/install/*`, `config.json`.
- Results engine: `resources/views/backEnd/reports/`, `resources/views/backEnd/examination/`, `app/CustomResultSetting.php`, `app/SmCustomTemporaryResult.php`, `systemSettings/custom_result_setting_add.blade.php`.
- Fees engine: `Modules/Fees/`, `app/SmFeesCarryForward.php`, `systemSettings/feesCarryForward*.blade.php`, `app/Http/Middleware/FeesDueCheckMiddleware.php`.
- Helpers: `app/Helpers/{Helper,Basic,FeesHelper,SmsHelper,EmailHelper,saas}.php`, `app/Support/YearCheck.php`, `app/Support/ModuleRegistry.php`.

## Appendix B — Code quality, security and maintainability notes

- **Dead code shipped**: `app/Http/Controllers/SmStudentAdmissionController_old.php`, `XSmClassRoutineNewController.php`, `app/AbcTest.php`, `resources/views/backEnd/reports/mark_sheet_report_old.blade.php`, `merit_list_report_print.blade copy.php`, `systemSettings/color_theme.blade - Copy.php`, `backEnd/dashboard/addToDo_old.blade.php`; large commented route blocks in `routes/tenant.php` (news/course v1 blocks).
- **Exception handling**: pervasive `try { … } catch (Exception) { Toastr::error('Operation Failed'); return back(); }` (see `VerifyController.php`, `app/Helpers/Helper.php::dateConvert`) — errors are swallowed rather than logged/re-thrown; makes debugging and data-integrity auditing hard.
- **Security surface**:
  - Addon upload (`moduleFileUpload`) extracts an admin-supplied zip straight into `Modules/` and runs its migrations — intended feature, but a compromised admin account gains arbitrary PHP execution; no signature verification.
  - `moduleFileUpload` has its outer `try` block commented out (`/* try { */ … /* } catch */`) — exceptions escape raw.
  - CSRF/CORS/HTTPS middlewares exist (`VerifyCsrfToken`, `Cors`, `HttpsProtocol`), and an `XSS` input-filter middleware; OAuth/Laravel Passport tables are migrated for API tokens.
  - License data stored in plain settings rows (`system_purchase_code`, `envato_user`) — trivially copyable between installs.
- **Schema churn**: migrations show heavy incremental patching (e.g., `2025_04_29_130721_add_default_sm_menus_data.php`, `2026_01_20_113910_shift_menu_fix_on_sm_menus_table.php`, repeated mark-sheet-menu dedupe migrations `2026_06_22_000002`, `2026_07_23_112206`, `2026_07_26_000001`) — menu data integrity is maintained by ever-more migration patches rather than idempotent seeds.
- **Naming inconsistency**: legacy `App\Sm*` root models vs `App\Models\*` (191 files) both active; `SmPaymentMethhod` (sic), `SmStaffAttendence` (sic) — two generations of conventions coexist.
- **i18n depth**: translations are largely DB phrase rows (`sm_language_phrases`) keyed by English strings, with per-menu `lang_name` keys; blip risk: phrase table must exist per school (`resources/var/defaults.json` lists seeded tables).
- **Performance posture**: menu cached per user/school 600s (`getMenus` in `app/Helpers/Basic.php`), per-school chat settings valuestore; no queue usage in core (jobs folder exists but thin); DB dumps via PHP (`Shuttle_Dumper`) instead of native tooling — fine on small schools, risky at scale.
