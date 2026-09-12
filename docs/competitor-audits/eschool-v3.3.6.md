# Competitor Deep Audit: eSchool v3.3.6 (Virtual School Management System)

**Product:** eSchool — Virtual School Management System (Flutter app + Laravel admin panel), CodeCanyon item 38335673, vendor WRTEAM (wrteam.in, India)
**Audited copy:** `Other Projects/eSchool v3.3.6/eSchool v3.3.6/codecanyon-38335673-eschool-virtual-school-management-system-flutter-app-with-laravel-admin-panel/`
**Laravel root (referred to as `PHP_Code/`):** `ESCHOOL Admin Panel 3.3.6_extracted/ESCHOOL Admin Panel 3.3.6/PHP Code/PHP_Code_x/PHP_Code`
**Flutter roots:** `Flutter App Codes 3.3.6_extracted/Flutter App Codes 3.3.6/eSchool 3.3.6/e-school` (combined student+parent app) and `.../eSchoolTeacher 3.3.6/e-school-teacher` (teacher app)
**Docs:** `eSchool-Documentation_extracted/eSchool-Documentation` (Docusaurus docs site shipped with the product: `features/`, `admin-panel/`, `mobile-app/`, `faqs/`, `changelog/`, `web-page/`, `support/`)
**Audit date:** 2026-09-11

**Stack:** Laravel 12 / PHP 8.3, Sanctum token auth, Blade + jQuery + bootstrap-table admin UI (no SPA framework), MySQL, 2 Flutter apps on BLoC, FCM push (HTTP v1), Envato one-time license validated against `validator.wrteam.in` (domain-locked). **Single school per install — NOT multi-tenant.**

**Headline numbers:**

| Metric | Count | Source |
|---|---|---|
| Web route definitions | 314 (36 are `Route::resource`) | `PHP_Code/routes/web.php` (580 lines) |
| API route definitions | 141 (~124 unique endpoints) | `PHP_Code/routes/api.php` (275 lines) |
| Controllers | 56 (46 web + 4 API + 6 Auth) | `PHP_Code/app/Http/Controllers/` |
| Models | 73 | `PHP_Code/app/Models/` |
| Migrations | 66 | `PHP_Code/database/migrations/` |
| Blade views | 199 (147 excluding vendor/errors) | `PHP_Code/resources/views/` |
| Flutter student app | 303 Dart files, 100 screen files, 53 cubits, 13 repositories, 43 models | `e-school/lib/` |
| Flutter teacher app | 286 Dart files, 92 screen files, 57 cubits, 14 repositories, 42 models | `e-school-teacher/lib/` |
| Mobile API served by | **3 god-controllers** (Teacher 3,799 LOC, Student 3,391 LOC, Parent 2,940 LOC) | `PHP_Code/app/Http/Controllers/Api/` |

**Composer dependencies of note** (`PHP_Code/composer.json`): `laravel/framework ^12`, `laravel/sanctum`, `spatie/laravel-permission` (roles/permissions), `maatwebsite/excel` (bulk import/export), `barryvdh/laravel-dompdf` (PDFs), `intervention/image`, `google/apiclient` (FCM OAuth), `razorpay/razorpay`, `stripe/stripe-php`, `unicodeveloper/laravel-paystack` (L12 fork), `awobaz/compoships` (composite-key relations), `mahesh-kerai/update-generator` (in-app updater), `dacoto/laravel-wizard-installer` (web installer). **No conferencing SDK of any kind.**

**Audit method & scope:** read in full — `PHP_Code/routes/web.php` (580 lines) and `routes/api.php` (275 lines); `sidebar.blade.php` menu (962 lines); `composer.json` and both `pubspec.yaml` files; both apps' screen trees, `homeBottomsheetMenu.dart`, `api.dart`, `studyMaterial.dart`; `notification_helper.php`; `FeesTypeController`, `SystemUpdateController`, `InstallPurchaseController`, `CheckRole` middleware; migrations and seeders inventories; documentation site features. ASchool claims were verified against `backend/app/plugins/modules/*/manifest.yaml`, `backend/app/models/question_bank.py`, `backend/app/utils/nepali_date.py`, `backend/app/realtime.py`, and `flutter_parent/lib/features/fees/fee_payment_screen.dart`. Vendor `vendor/`, `node_modules`, and `__MACOSX` trees were skipped.

---

## Deep re-audit (v2) — implementation-level (2026-09-12)

- **v2 status**: covered — both route files read line-by line with per-endpoint controller verification; online-exam runner traced end-to-end (Dart screens/widgets/cubits/models + Laravel controllers + migration schema + scoring math); fees/payment state machine (init → intent → webhook → receipt, both apps + all 4 gateways); assignments/homework flow both sides; live-class join path; ops-flag launch wiring (splash → app_configuration → dialogs); ASchool-side verification of every v1 gap claim. remaining — admin blade form-field-level audit (fees collection form, online-exam question form, id-card template editor), ParentApiController/TeacherApiController full line-read (spot-read only), seed/demo data, teacher-app screen-by-screen widget dump (only timetable-link + nav read).

### V2-R. Route coverage — line-by-line corrections and additions

- `PHP_Code/routes/web.php` (580 lines): confirmed structure of v1 §1.1. Line-verified highlights: payment webhooks `webhook/razorpay|stripe|paystack|flutterwave` + `response/paystack|flutterwave/success` (488-493); unauthenticated `/clear` (505), `/storage-link` (513), `/migrate` (523), `/seeder_install` (539); chat retention cron `delete-chat-message/cron-job` (485); online-exam T&C stored via `online-exam/store-terms-conditions` (352); fees surface (311-344) incl. `fees/paid/store`, `fees/optional-paid/store`, `fees/compulsory-paid/store`, `fees/transaction-logs`, `fees/paid/receipt-pdf/{id}`; assignment evaluation via `PUT assignment-submission/{id}` (239).
- `PHP_Code/routes/api.php` (275 lines): 141 definitions confirmed. v2 additions: the student group's `get-payment-status` route (api.php:98) actually targets **`ParentApiController::getPaymentStatus`** (copy-paste across god-controllers; a duplicate body also sits in `StudentApiController.php:3152`); parent group has **no** `get-online-exam-questions`/`submit-online-exam-answers` routes (150-153: list/result only) — parents can read but never take exams; teacher group has zero online-exam authoring endpoints (question authoring is admin-web only, `web.php:354-366`); the only per-student middleware scoping in the teacher group is `CheckStudent` for 2 result routes (224-227).

### V2-A. Trace a — Online-exam runner: exact state machine (Dart + Laravel)

**Tables** (`PHP_Code/database/migrations/2022_12_12_033204_online_exam_module.php`): `online_exams` (class_subject_id, title, `exam_key` bigint, duration minutes, start_date, end_date, session_year_id); `online_exam_questions` (question_type tinyint `0 simple / 1 equation`, question 1024, image_url, note); `online_exam_question_options` (question_id, option); `online_exam_question_answers` (question_id → option id; **many rows per question = multi-answer**); `online_exam_question_choices` (online_exam_id + question_id + marks — per-exam attach); `student_online_exam_statuses` (student_id, online_exam_id, **status tinyint: `1 in-progress, 2 completed` — the only two states**); `online_exam_student_answers` (student_id, online_exam_id, question_id→choice, option_id, submitted_date).

**Server attempt lifecycle** (`PHP_Code/app/Http/Controllers/Api/StudentApiController.php`):
1. `getOnlineExamList` (1506-1622): list only exams where `end_date >= now` AND `whereDoesntHave('student_attempt', student)` (1543-1556) — **attempted exams silently vanish from the list; there is no "retake" concept anywhere**. Response ships `exam_key` to the client (1593).
2. `getOnlineExamQuestions` (1624-1709): validates `exam_id`+`exam_key` (1638-1641); rejects if ANY status row exists → `student_already_attempted_exam` (1644-1647); checks **only** `start_date` (1650-1655, no `end_date` check); **creates status row with status=1 BEFORE serving questions** (1658-1662). Response per question includes `options` **and `answers` (correct option ids + text)** (1684-1699).
3. `submitOnlineExamAnswers` (1711-1780): one-shot POST `{online_exam_id, answers_data:[{question_id, option_id[]}]}`; rejects if any answer rows already exist (1729-1732); per answer verifies choice belongs to exam (1741) and each option belongs to the question (1744); inserts one row per option (1751-1760); flips status 1→2 (1762-1767). **No duration check, no end-date check, no signature, no scoring here.**
4. Scoring is **read-time, never persisted**: `getOnlineExamReport` (1782-1926) marks a question correct only if the submitted option set covers every `online_exam_question_answers` row (all-or-nothing, 1829-1834), sums `choices.marks` for correct questions (1849); identical recompute in `getOnlineExamResult`/result-list (2021, 2105). Report derives `total/attempted/missed/percentage` per subject on the fly.

**Dart runner** (`e-school/lib/ui/screens/exam/onlineExam/`):
- Entry: `lib/ui/widgets/examOnlineListContainer.dart` — parent mode explicitly no-op (129-131); client date guard "exam is today" (136-163); tap → non-dismissible `ExamOnlineKeyBottomsheetContainer` modal.
- Gate sheet `lib/ui/widgets/examOnlineKeyBottomsheetContainer.dart`: exam rules HTML from **global settings** (`appConfigurationCubit.fetchExamRules()`, line 105; cubit `appConfigurationCubit.dart:124-129` ← `ApiController.php:237-241`), "I agree" checkbox (client-only, 47-86), numeric **exam-key field validated client-side against the value delivered in the list payload** (309-323), then `ExamOnlineCubit.startExam` → GET `student/get-online-exam-questions?exam_id&exam_key` (`examRepository.dart:36-56`).
- `examOnlineScreen.dart` (584 lines): `WakelockPlus.enable()` on init / disable on dispose (64, 72); options shuffled **client-side** per fetch (`models/question.dart:34`); PageView one question at a time; multi-answer note "select N answers" from `correctAnswer.length` (407-425); answers held **only in memory** — `Map<int,List<int>> selectedAnswersWithQuestionId` (49) + cubit `updateQuestionWithAnswer` (`cubits/examOnlineCubit.dart:95-112`); **no per-question autosave endpoint exists**; questions pre-sorted low→high marks (cubit 66-84).
- **Timer** `widgets/examTimerContainer.dart:17-36`: pure client countdown from `duration−1min 59s`, `Timer.periodic(1s)`; expiry → `navigateToResultScreen` → `finishExamOnline` → `submitAnswers` (230-256). No server sync; killing the app resets the clock.
- **Anti-cheat** (`examOnlineScreen.dart:51-104`): on `AppLifecycleState.paused` a 5-second `canGiveExamAgainTimer` starts; if the student stays away >5 s the exam **auto-submits**; resume within 5 s cancels and resets. That is the entire anti-cheat (no fullscreen, no screenshot, no tab detection). **v1 correction: the `canGiveExamAgainTimer` is an away-timer, not a "retake cooldown" (v1 §3.2).**
- Palette `widgets/examQuestionStatusBottomSheetContainer.dart`: **2 states only** — attempted (onSecondary) / not attempted (error red) (83-99), grouped by marks value with answered/unanswered counters, Submit button.
- Option widgets: single-answer toggle vs multi-answer capped at the **correct-answer count** with snackbar (`optionContainer.dart:83-112`); LaTeX via `TeXView` KaTeX engine when `question_type==1` (153-172); module-global mutable `newSubmittedId` list (24) cleared on page change.
- Completion: Lottie dialog → Home or `Routes.resultOnline` (`resultOnlineScreen.dart` gets examId, fetches `get-online-exam-result`).

**Exact state machine:** `hidden (list-filtered) → [enter key + accept rules] → status=1 (in-progress, created on question fetch) → [submit | timer-expire | away>5s | quit-confirm] → answers persisted, status=2 (completed) → scored lazily on every result/report read`. No `expired`, no `graded`, no `abandoned` state; no resume; no retake; no server-side cap on time.

**ASchool delta** (`backend/app/api/v1/exams.py`, `backend/app/models/exam.py`, `flutter_student/lib/features/exams/student_exams_screen.dart`):

| Aspect | eSchool (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|---|
| Answer key to client | Shipped in questions payload (`StudentApiController.php:1684-1699`; consumed `question.dart:36-38`, UI announces count `examOnlineScreen.dart:407-425`) | Stripped for students — `_student_safe_questions` (`backend/app/api/v1/exams.py:1735-1745`) | ASchool already fixed the leak | Reject eSchool pattern (V2-01) |
| Scoring | Read-time recompute, no persisted score (`StudentApiController.php:1829-1854`) | Scored once at submit, stored (`exams.py:434-446` `_score_online_exam` 1999-2015) | ASchool better + cheaper | Keep; add partial-credit policy |
| Attempt model | 2 states, created before questions, blocks re-fetch forever (`:1644-1662`) | Single `OnlineExamAttempt` row with `started_at/submitted_at`, but **no duplicate-attempt check → infinite resubmits** (`models/exam.py:193-204`; `exams.py:388-457`) | Complementary gaps | **Adopt**: unique (exam,student) attempt + in-progress state |
| Window enforcement | List only end_date; questions endpoint checks only start_date (`:1543-1556, 1650-1655`) | Both ends enforced at submit (`exams.py:423-430`) | ASchool correct | Keep (V2-04) |
| Timer | Client-only (`examTimerContainer.dart:17-36`) | Client `Timer.periodic` auto-submit (`student_exams_screen.dart:365-378`) — also client-only | Parity gap in both | Adapt: server-side remaining-time in GET response |
| Anti-cheat | Away>5s auto-submit (`examOnlineScreen.dart:51-104`) | None | eSchool ahead | **Adopt** lifecycle auto-submit |
| Autosave | None | None | Both fail on kill | **Adopt**: PATCH attempt.answers per question |
| Palette / wakelock / LaTeX / multi-answer UI | All present (`examQuestionStatusBottomSheetContainer.dart:83-99`; `examOnlineScreen.dart:64`; `optionContainer.dart:153-172`; multi-answer cap 83-112) | None in runner (`student_exams_screen.dart` 540 lines, single page, no wakelock/latex/palette) | eSchool clearly ahead | **Adopt all four** |

### V2-B. Trace b — Fees + payment: exact state machine

**Tables** (`PHP_Code/database/migrations/2022_11_11_065720_fees_module.php` + installment migrations): `fees_types` (choiceable 0/1), `fees_classes` (class_id, fees_type_id, amount), `fees_choiceables` (student opt-ins, `is_due_charges`, status), `payment_transactions` (`payment_gateway` tinyint **1-razorpay 2-stripe** per comment :55, order_id, payment_id, payment_signature, `payment_status` **0 failed / 1 succeed / 2 pending** :59, total_amount, `date`), `fees_paids` (mode **0 cash 1 cheque 2 online** :71, is_fully_paid, aggregate per student+class+year), `installment_fees` + `paid_installment_fees` (due_date, due_charges, status).

**Flow** (`StudentApiController.php` / `ParentApiController.php` / `WebhookController.php`):
1. `getFeesDetails` (2737-2851): splits compulsory vs choiceable vs installments; **read-path repair — a transaction still `2 pending` older than 1 hour is flipped to `0 failed` on every read** (2767-2776, also in `getFeesPaymentTransactions` 3085-3096); exposes session-year `fee_due_date`/`fee_due_charges` (2833-2835) and `is_fee_pending`.
2. `storeFeesTransaction` (2854-2974): validated `payment_method in 1,2,3,4`, `type_of_fee in 0,1,2`, `is_fully_paid in 0,1` (2856-2861); creates transaction status=2 (2898); creates placeholder `FeesChoiceable`/`PaidInstallmentFee` rows status=0 keyed by `payment_transaction_id` (2904-2938); calls `PaymentService::create(gw)->createAndFormatPaymentIntent` (`app/Services/Payment/{RazorpayPayment,StripePayment,PaystackPayment,FlutterwavePayment}.php` — gateway metadata carries all reconciliation ids incl. JSON lists of placeholder row ids, 2940-2955); saves gateway `order_id`.
3. Client pays (native `razorpay_flutter` checkout with `razorpay_api_key` from settings, `feesDetailsScreen.dart:789-864,1364`; `flutter_stripe`; Paystack/Flutterwave via `webviewPaymentScreen.dart` with `authorization_url`, 756-777). `storeFees` (2977-3001) then saves **client-supplied `payment_id`/`payment_signature` unverified**.
4. Verification: webhook is the trust anchor — Razorpay `WebhookController::razorpay` (21-229) computes HMAC but **only logs a mismatch** (63-69) then `verifyWebhookSignature` throws into catch (70, 225); on `payment.captured` sets status=1, flips placeholders to paid, upserts `FeesPaid` (+is_fully_paid, due charges), pushes "Payment Success" (72-172); on `payment.failed` sets 0, deletes status-0 placeholders, pushes "Payment Failed" (184-217). Stripe uses proper `\Stripe\Webhook::constructEvent` (230-259).
5. Fallback verification `get-payment-status` (routed api.php:98/123 → `ParentApiController.php:2377`; copy `StudentApiController.php:3152-3182`) — **polls Stripe's API only** (`https://api.stripe.com/v1/payment_intents/`) regardless of gateway.
6. Failure UX: `failPaymentTransactionStatus` (3114-3150) lets the **client** mark a transaction failed + pushes "Payment Failed".
7. Receipts: server-rendered dompdf base64 (`feesPaidReceiptPDF` 3017-3072, view `resources/views/fees/fees_receipt`); transaction log paginated (3074-3111); student nudge `send-fee-notification` (3184+) to father/mother/guardian user ids.
8. Ops gate: splash redirects fee-due students to `studentFeePaymentDueScreen` when `compulsory_fee_payment_mode == '1'` (`splashScreen.dart:66-75`, flag from `ApiController.php:179`).

**ASchool delta** (`backend/app/api/v1/fees.py`, `backend/app/models/fee.py`, `flutter_parent/lib/features/fees/fee_payment_screen.dart`):

| Aspect | eSchool (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|---|
| Init | status=2 pending + placeholder rows + gateway intent (`:2854-2974`) | `PaymentInitiation` status `initiated` + hosted checkout, eSewa/Khalti/FonePay (`fees.py:1792-1889`; `models/fee.py:155-186`) | ASchool has the same shape, Nepal gateways | Keep (V2-10) |
| Trust anchor | Webhook (razorpay verify broken, logs only, `WebhookController.php:63-70`) | `/webhooks/{esewa,khalti,fonepay}/callback` + amount cross-check (`fees.py:1829-1889`) | ASchool correct | Keep |
| Verification UX | `FeesPaymentVerification` screen: pending/success/fail Lottie + `storeFees` call (`feesPaymentVerification.dart:55-67,159-195`) | None — `_GatewayWebViewScreen` renders gateway HTML and stops (`fee_payment_screen.dart:88-121,351-364`) | eSchool ahead | **Adopt** verification screen + polling |
| Receipts | Server PDF base64 + email template (`:3017-3072`) | `FeeReceipt` model exists (`models/fee.py:94`); no mobile receipt flow | Model ahead, UX behind | **Adopt** download-receipt button |
| Fee nudges | `send-fee-notification` → 3 guardians (`:3184-3196`) | `fees.py:1177-1182` defaulter remind (admin-side) | Parent-side nudge missing | **Adopt** ask-parents-to-pay cubit |
| Pending sweeper | 1-hour read-path auto-fail (`:2767-2776`) | None | eSchool ahead | **Adopt** (cheap) |
| Gateway ids | Magic ints 1-4 across SQL comment + Dart switch (`feesDetailsScreen.dart:686-696`) | Named providers (`fees.py:1804`) | ASchool better | Reject ints |
| Due charges / installments | Session-year due date + charges; installment due_charges per row (`:2815-2835`) | FeeStructure monthly batch (`fees.py:751-756`) | eSchool models late fees explicitly | **Adopt** due-date + late-charge fields |

### V2-C. Trace c — Homework (assignments). There is no diary in eSchool

- Submission `StudentApiController::submitAssignment` (998-1092): text XOR files; one submission per student; if rejected (status 2) and `assignment.resubmission` → flips to **status 3 (resubmitted)** and physically deletes old files (1043-1057); else "already submitted"; notifies the **subject teacher** (`Notification` send_to=2 + FCM, 1060-1085).
- Evaluation `TeacherApiController::updateAssignmentSubmission` (617-670): `status in 1,2`; accept=1 stores `points`, reject=2 **nulls points**; free-text feedback; notifies the student (send_to=3). `assignment_submissions.editing` column (0 uneditable / 1 editable) added by `2023_09_26_123001_add_column_status_in_assignment_submissions.php`, later dropped by `2024_04_25_110112_remove_editing_column...`. Web admin counterpart `PUT assignment-submission/{id}` (`web.php:239`).
- Status vocabulary: 0 submitted → 1 accepted / 2 rejected / 3 resubmitted. Notifications fire in both directions with `type` strings `assignment` / `assignment_submission`.
- **No diary/homework-note module exists anywhere in the PHP app** (grep `diary` across `PHP_Code/app`: zero hits). "Homework" == assignments.
- **ASchool**: `backend/app/api/v1/assignments.py:195-252` (submit with `is_late` computed vs due date + `assignment.submitted` event) and `:283-311` (grade → status `graded` + feedback); `backend/app/models/diary.py` + `flutter_student/lib/features/diary/` exist. Verdict: ASchool ahead (is_late, events, diary); **adapt** eSchool's explicit accept/reject + resubmission flag and both-direction push vocabulary.

### V2-D. Trace d — Live classes verified at implementation level: confirmed fake

- Columns: `timetables.live_class_url` + `link_name` (`PHP_Code/database/migrations/2024_05_28_153727_add_column_in_timetables_table.php:16-17`).
- Teacher writes via `teacher/update-timetable-link` (`TeacherApiController.php:3777-3795`): validation is only `live_class_link => nullable|url` — **no permission gate and no ownership check** (every other teacher endpoint calls `noPermissionThenSendJson`), so any authenticated teacher token can rewrite any timetable row's link by id.
- Student join: `e-school/lib/ui/widgets/timetableContainer.dart:277-296` — a text button that `launchUrl(Uri.parse(linkCustomUrl), mode: LaunchMode.externalApplication)`, i.e. hands the URL to the OS (Zoom/Meet/browser). No in-app room, no join window check, no attendance, no recording. Same `url_launcher` handoff in the teacher app (`e-school-teacher/lib/ui/screens/home/tabs/timeTableContainer.dart:215`).
- **ASchool**: `backend/app/plugins/modules/lms/manifest.yaml` (Jitsi live classes + recorded library) and `conferences` plugin — real rooms. Verdict: nothing to adopt; the only transferable nuance is teacher-editable join links **on the timetable slot** (surface link editing where the schedule lives), with the ownership check eSchool forgot (V2-12).

### V2-E. Trace e — Server-driven ops flags: exact launch wiring

- Payload: `GET /api/settings?type=app_settings` (`ApiController.php:100-253`) returns per-platform `app_link/ios_app_link/app_version/ios_app_version/force_app_update/app_maintenance` (161-166), the **teacher-app twins** `teacher_app_link/teacher_ios_app_link/teacher_app_version/teacher_ios_app_version/teacher_force_app_update/teacher_app_maintenance` (170-175), `online_payment`, `is_demo` (env), `compulsory_fee_payment_mode`, `is_student_can_pay_fees`, a `chat_settings` sub-object (186-191), `holiday_days`, `payment_options` (currency, `fees_due_date`, `fees_due_charges`, and per-gateway blocks **including `razorpay_api_key` and `razorpay_webhook_secret`**, 203-235), `online_exam_terms_condition` (237-241), plus server-derived `semester_breaks` (121-153). Theme colors ship in the same settings store (v1 §1.9) and reach the apps through the same client.
- Flutter consumption: `splashScreen.dart:42-43` fires `AppConfigurationCubit.fetchAppConfiguration()` pre-auth; failure = blocking retry screen. Maintenance: `appUnderMaintenance()` == '1' **replaces the home body** (`homeScreen.dart:454-455`, `parentHomeScreen.dart:568-585`) with `AppUnderMaintenanceContainer`. Force update: rendered only when `forceUpdate()` == '1' **AND** `UiUtils.forceUpdate(serverVersion)` compares installed `version+build` (package_info_plus) vs server string, semver-segments OR build number (`uiUtils.dart:473-499`, dialog `homeScreen.dart:491-507` → `lib/ui/widgets/forceUpdateDialogContainer.dart`). So force flag alone never blocks an up-to-date app — the comparison is client-side.
- **ASchool**: `backend/app/api/v1/mobile.py:21-63` (`/mobile/bootstrap`: role, installed_plugins, per-role visibility, dashboard payload — superset of eSchool's config client) and `:44-88` (`/mobile/version` GET/PUT with per-app `student|teacher|parent|admin_min_version` + store urls; **server-side** `_compare_versions` flips `force_update`). Consumers exist: `aschool_shared/lib/services/mobile_version_service.dart`, `aschool_shared/lib/services/plugin_provider.dart:161`, admin editor `flutter_admin/lib/features/settings/settings_screen.dart:516-591`. **Gap: `aschool_shared/lib/widgets/force_update_dialog.dart` and `mobile_version_service.dart` are imported by NO role app** (grep across the four app trees: zero hits) — the stack is built but unwired. Verdict: 1 wiring task per app; also add `maintenance` flag + per-platform payloads to `/mobile/version` to reach full parity (V2-13).

### V2-F. Screen coverage (v2 additions — exact widget inventory)

- **Runner screens** (student app): `examOnlineListContainer.dart` (subject filter chips + paginated list + shimmer + refresh), `examOnlineKeyBottomsheetContainer.dart` (rules HTML + agree checkbox + key field), `examOnlineScreen.dart` (appbar: subject/title/marks/timer; PageView of `questionContainer` + `optionContainer`s; bottom docked bar: View-details + prev/next circles; palette bottom sheet; completion Lottie dialog), `resultOnlineScreen.dart`. Cubits: `examOnlineCubit` (fetch/arrange/answer/submit), `examsOnlineCubit` (list paging), `examTabSelectionCubit` (subject filter).
- **Fees screens** (student app, 7 files / 3,051 LOC): `feesDetailsScreen.dart` (1,470 — tabs due/paid, installment toggle, due-charge row, gateway resolve, razorpay listeners 145-168, success/fail handlers 1394-1463), `studentFeePaymentDueScreen.dart` (286 — compulsory-mode lock screen), `feesPaymentVerification.dart` (196 — pending/success/fail Lottie), `feesStatusScreen.dart` (371), `feesTransactionScreen.dart` (393), `webviewPaymentScreen.dart` (165), `widgets/paymentSelection.dart` (68 — options built from server-enabled gateways only, lines 28-31), `widgets/studentDownloadFeePaidReceiptButton.dart` (102).
- **Admin blades for the runner**: `resources/views/online_exam/` (6: index, add/edit, exam_questions, terms-conditions, result views) + `online-exam-question` resource views; T&C saved to one global settings key (`OnlineExamController.php:839-851`) — **v1 correction: the "per-exam T&C" is a single global `online_exam_terms_condition` setting** shown to every exam.
- **Mobile-nav comparison:**

| Surface | eSchool (file:line) | ASchool (file:line) | Verdict |
|---|---|---|---|
| Student shell | 4 tabs Home/Chat/Assignments/Menu + slide-up 9-tile grid (`homeScreen.dart:133-158`, `homeBottomsheetMenu.dart`) | `Drawer` with grouped sections (`flutter_student/lib/screens/shell_screen.dart:19-185`) | **Adopt** tab+grid (still open from v1) |
| Parent shell | Same app, role at login; child cards → child-scoped screens (`parentHomeScreen.dart`, `CheckChild` `api.php:129`) | Separate app; chat screen exists (`flutter_parent/lib/features/chat/parent_chat_screen.dart`) | Keep 5 apps; reuse child-card pattern |
| Teacher shell | 4 tabs Home/Schedule/Profile/Settings (`e-school-teacher/home/homeScreen.dart:59-78`) | `flutter_teacher/lib` (own shell) | Parity |
| Server-driven nav | Static Dart menu list | `/mobile/bootstrap` visibility per role (`mobile.py:21-42`, `plugin_provider.dart:161`) | ASchool ahead — feed it into the grid |

### V2-G. New v2 findings (each with evidence)

1. **V2-01 — Answer key shipped to student devices.** Questions payload includes `answers` (correct option ids + text): `PHP_Code/app/Http/Controllers/Api/StudentApiController.php:1684-1699`; client parses it `question.dart:36-38` and prints the correct-count `examOnlineScreen.dart:407-425`; option cap equals correct count `optionContainer.dart:89`. Any student with a proxy can read the key mid-exam. ASchool already strips it (`backend/app/api/v1/exams.py:1735-1745`) — keep, and add a regression test asserting no `correct_answer` key in student responses.
2. **V2-02 — Razorpay webhook secret + api key delivered to mobile clients, and mismatch only logged.** `ApiController.php:203-211` serializes `razorpay_webhook_secret` (and key) into `settings?type=app_settings`; `WebhookController.php:34` reads the secret from **env**, and `:63-70` only logs "Signature Matched"/never rejects before `verifyWebhookSignature` throws. Knowing the leaked secret, a client can POST a forged `payment.captured` with a valid HMAC and get fees marked paid. ASchool: gateway secrets stay in `backend/app/api/v1/fees.py` gateway configs server-side — adopt a rule: never serialize credential/webhook-secret fields in any `/api/v1` settings payload.
3. **V2-03 — v1 correction: "retake cooldown timer" does not exist.** `canGiveExamAgainTimer` is the 5-second away-auto-submit (`examOnlineScreen.dart:51-104`). Retake control is entirely the server list filter (`StudentApiController.php:1543-1556`) + the once-ever attempt row (`:1644-1662`); no admin "reset attempt"/"allow retake" route exists in `web.php`.
4. **V2-04 — No server-side time authority.** Timer is client-only (`examTimerContainer.dart:17-36`); submit has zero duration/end-date checks (`StudentApiController.php:1711-1780`); `getOnlineExamQuestions` checks only start_date (`:1650-1655`) so a stale exam_key can fetch questions after the window. ASchool enforces both ends (`exams.py:423-430`) — extend it with per-attempt elapsed-time accounting.
5. **V2-05 — No autosave + no resume + no retake (worst combination).** Answers live only in Dart state (`examOnlineScreen.dart:49,230-240`); the status row (created before questions, `:1658-1662`) permanently blocks re-fetch with `student_already_attempted_exam`. App kill = lost work and a burned attempt. ASchool has the opposite bug: unlimited duplicate submissions (`exams.py:388-457` has no existing-attempt check). Adopt the synthesis: attempt row with `in_progress`, per-question autosave PATCH, unique active attempt, server decide resume-vs-retake.
6. **V2-06 — Unanswered questions are submitted as `option_id: [0]`.** `examOnlineScreen.dart:232-235` (`submittedAnswerId ?? [0]`); server's option check (`:1744`) fails for id 0, so a fully-blank submit inserts no rows → the idempotency check (`:1729-1732`) stays untriggered and the student can resubmit. Exact edge-case to avoid in any port.
7. **V2-07 — All-or-nothing multi-answer scoring, recomputed on every read, never persisted.** `StudentApiController.php:1829-1834` (any missing correct option voids the question), same math inline in result endpoints (2021+, 2105+); N+1 query storm per student per exam. ASchool persists the score once (`exams.py:434-446`) — keep persisted scoring; decide partial-credit policy explicitly.
8. **V2-08 — The exam "key" is theater.** `exam_key` is delivered in the exam list (`:1593`) and validated client-side against that same value (`examOnlineKeyBottomsheetContainer.dart:309-323`) before the server re-check (`:1638-1641`). It is an acknowledgment token, not a secret — do not copy as-is; if ASchool wants a key gate, the server must not send the key to the exam-taker role.
9. **V2-09 — Read-path pending-transaction sweeper.** Any `payment_status=2` transaction older than 1 hour is failed on read (`:2767-2776`, `:3085-3096`). Cheap, idempotent — adopt in `backend/app/api/v1/fees.py` summary/collections reads (or a Celery beat task).
10. **V2-10 — Client-reported payment state is trusted twice.** `storeFees` persists client-supplied `payment_id`/`payment_signature` with no verification (`:2977-3001`); `failPaymentTransactionStatus` lets any student token fail their own transaction (`:3114-3150`); `get-payment-status` polls Stripe even for Razorpay orders (`:3152-3182`). Webhooks remain the only real anchor. ASchool's `PaymentInitiation`+`/webhooks/*` design (`fees.py:1792-1889`) is already correct — adopt only the verification *screen*.
11. **V2-11 — `update-timetable-link` has no permission/ownership gate.** `TeacherApiController.php:3777-3795` — any teacher can set `live_class_url` on any timetable id. Contrast: sibling endpoints call `noPermissionThenSendJson(...)`. Add ownership checks to any ASchool equivalent in `backend/app/api/v1/lms.py`.
12. **V2-12 — Force-update stack exists in ASchool but is unwired.** eSchool renders maintenance/force-update from home (`homeScreen.dart:454-507`); ASchool ships `aschool_shared/lib/widgets/force_update_dialog.dart` + `aschool_shared/lib/services/mobile_version_service.dart` and the admin editor (`flutter_admin/lib/features/settings/settings_screen.dart:516-591`), yet zero imports in `flutter_student|flutter_parent|flutter_teacher|flutter_admin` trees. Wire splash-time `MobileVersionService.check()` + dialog into all five apps; add a `maintenance` flag to `/mobile/version` (`backend/app/api/v1/mobile.py:44-88`).
13. **V2-13 — eSchool's per-exam T&C is actually global.** `OnlineExamController.php:839-851` stores one `Settings` row `online_exam_terms_condition`; served app-wide via `ApiController.php:237-241`; shown once per exam start with a client-side checkbox (`examOnlineKeyBottomsheetContainer.dart:36-110`). v1 §3.2 overstated it. ASchool `OnlineExam.instructions` is per-exam — already better.
14. **V2-14 — Parent role can never take online exams (intentional).** No question/submit routes under `parent/*` (`api.php:150-153`) and the Dart entry no-ops for parents (`examOnlineListContainer.dart:129-131`). Mirror this role rule in `backend/app/api/v1/exams.py` if parents should view-only.
15. **V2-15 — Assignment status vocabulary differs; adopt the resubmission flag.** eSchool: 0 submitted / 1 accepted / 2 rejected / 3 resubmitted + `editing` lock (`2023_09_26_123001...php`) + both-direction pushes (`StudentApiController.php:1060-1085`, `TeacherApiController.php:641-660`). ASchool: `submitted → graded` with feedback, `is_late`, domain events (`backend/app/api/v1/assignments.py:195-252, 283-311`) — richer, but add explicit accept/reject + resubmission window to match teacher workflows.
16. **V2-16 — ASchool parent chat now exists (v1 §5.1 update).** `backend/app/api/v1/communications.py:38-53` (contacts/messages via `chat_service`) + `flutter_parent/lib/features/chat/parent_chat_screen.dart`. Still missing vs eSchool: admin retention policy (`chat_setting.blade.php` + cron `web.php:485`), read-receipt table, per-message file/size limits from settings (`ApiController.php:186-191`), and dedicated chat push (`chatNotificationsUtils.dart`).
17. **V2-17 — eSchool has no diary module at all** (grep `diary` over `PHP_Code/app`: zero files). ASchool's `backend/app/models/diary.py` + `flutter_student/lib/features/diary/` are a differentiator to keep; the student "homework" feature (`flutter_student/lib/features/homework/homework_screen.dart`) maps to assignments only.
18. **V2-18 — Role-scoped god-controller cross-imports.** Student routes call `ParentApiController::getPaymentStatus` (`api.php:98`) — the three god-controllers are mutually entangled; when porting any endpoint keep one owner (ASchool: `parent_app.py`/`student_app.py` already split ownership).

---

## [1] INVENTORY — Laravel Admin Panel

### 1.1 Routes

- **Web** (`PHP_Code/routes/web.php`, 580 lines): all authenticated routes grouped under `['middleware' => ['Role','auth']]` + `language` middleware. 314 `Route::` definitions; 36 resource declarations expand to ~200 CRUD URIs. Every list screen pairs a resource route with a bespoke `*_list` JSON endpoint for the bootstrap-table UI (e.g. `subject` + `subject-list`, `class` + `class-list`, `attendance` + `student-attendance-list`).
- **API** (`PHP_Code/routes/api.php`, 275 lines): 141 definitions / ~124 endpoints. Groups:
  - `student/*` (~48 endpoints) — middleware `auth:sanctum` + `student.session.active` (`PHP_Code/app/Http/Middleware/EnsureStudentSessionIsActive.php`)
  - `parent/*` (~40) — `parent.children.session.active` + inner group with `CheckChild` middleware (`api.php:129`) so every child-scoped endpoint receives the child id from the client
  - `teacher/*` (~40) — `auth:sanctum`, with `CheckStudent` middleware for per-student result endpoints (`api.php:224-227`)
  - General: `holidays`, `sliders`, `current-session-year`, `settings`, `forgot-password`, `get-events-list`, `get-events-details`, `get-session-year`, `change-password` (`api.php:264-275`)
- **Operational backdoors (do-not-copy security smell):** `web.php:505-546` exposes unauthenticated `/clear`, `/migrate`, `/storage-link`, `/seeder_install` Artisan routes; `web.php:485` a cron-triggered chat cleanup route.
- **Payment webhooks:** `webhook/razorpay|stripe|paystack|flutterwave` + success-callback routes (`web.php:488-493`) → `PHP_Code/app/Http/Controllers/WebhookController.php`.
- **Installer/licensing:** `install/purchase` GET/POST (`web.php:69-72`) → `InstallPurchaseController.php` posts `{purchase_code, domain_url}` to `https://validator.wrteam.in/eschool_validator` and stores the code in env (`APPSECRET`).

### 1.2 Controllers (56 files, with the heavyweights)

Web controllers (46): `StudentController` (2,820 LOC — students CRUD, bulk import, roll numbers, ID cards, bonafide/leaving certificates, results, online registration), `FeesTypeController` (1,808 LOC — entire fees domain), `ExamController`, `OnlineExamController`, `OnlineExamQuestionController`, `ExamTimetableController`, `ClassSchoolController`, `ClassTeacherController`, `SubjectTeacherController`, `TimetableController`, `AttendanceController`, `AssignmentController`, `LessonController`, `LessonTopicController`, `AnnouncementController`, `NotificationController`, `EventController`, `HolidayController`, `LeaveController`, `LeaveMasterController`, `SessionYearController`, `StudentSessionController` (promotion), `TeacherController`, `ParentsController`, `StaffController`, `UserController`, `RoleController`, `SettingController` (general/app/FCM/email/chat/privacy pages), `WebSettingController` (school-website CMS), `WebController` (public site), `MediaController` (photo/video galleries), `SliderController`, `CategoryController`, `LanguageController`, `MediumController`, `SectionController`, `StreamController`, `ShiftController`, `SemesterController`, `SubjectController`, `FormFieldController` (dynamic fields), `SystemUpdateController` (zip updater), `InstallPurchaseController`, `WebhookController`, `HomeController` (dashboard/profile/password).
API (4): `Api/ApiController.php` (412 LOC — shared/general + FCM device registration), `Api/StudentApiController.php` (3,391), `Api/ParentApiController.php` (2,940), `Api/TeacherApiController.php` (3,799).
Auth (6): standard Laravel UI scaffold in `Auth/`.

### 1.3 Models (73) — full data model

- **Academic core:** `ClassSchool`, `ClassSection`, `ClassSubject`, `ClassTeacher`, `Subject`, `SubjectTeacher`, `Section`, `Stream`, `Shift`, `Mediums` (instruction language, e.g. English/Nepali — a multi-medium concept ASchool could mirror), `Semester`, `SessionYear`, `StudentSessions` (per-year enrollment rows; powers promotion), `StudentSubject`, `ElectiveSubjectGroup`, `PromoteStudents`, `FormField` (dynamic student fields).
- **People:** `User`, `Students`, `Teacher`, `Parents`, `Staff`.
- **Learning/content:** `Lesson`, `LessonTopic`, `File` (study material), `Assignment`, `AssignmentSubmission`, `Timetable` (with `link_name`/`link_url` live-class fields).
- **Assessment:** `Exam`, `ExamClass`, `ExamMarks`, `ExamResult`, `ExamTimetable`, `Grade`, `OnlineExam`, `OnlineExamQuestion`, `OnlineExamQuestionOption`, `OnlineExamQuestionChoice`, `OnlineExamQuestionAnswer`, `OnlineExamStudentAnswer`, `StudentOnlineExamStatus` (attempt tracking).
- **Finance:** `FeesType`, `FeesClass` (class-wise fee assignment), `FeesChoiceable` (optional/elective fees), `InstallmentFee`, `PaidInstallmentFee`, `FeesPaid`, `PaymentTransaction`.
- **Communication:** `Announcement`, `Notification`, `UserNotification`, `ChatRoom`, `ChatMember`, `ChatMessage`, `ChatFile`, `ReadMessage`, `ContactUs`.
- **Operations/CMS:** `Attendance`, `Leave`, `LeaveDetail`, `LeaveMaster`, `Holiday`, `Event`, `MultipleEvent` (multi-day event schedules), `Category`, `Media`, `MediaFile`, `Slider`, `Settings` (key-value: type/message), `WebSetting`, `EducationalProgram`, `Faq`, `Language` (with `is_rtl`).

### 1.4 Migrations (66) — release engineering pattern

Baseline `create_all_tables.php`, then feature modules as separate files: `fees_module.php`, `online_exam_module.php`, `create_all_leave_manage_table.php`, `create_dynamic_form_fields.php`, `all_chat_table.php`, `create_notifications.php`, `create_user_notifications.php`, `create_staffs_table.php`, `create_shifts_table.php`, `create_streams_table.php`, `create_multiple_events_table.php`, `create_languages_table.php`, `generate_roll_number.php`, `is_rtl_in_language.php`, `add_fcm_id_to_users.php`, `add_column_device_type_in_users_table.php`, `add_column_free_app_use_date_in_session_years_table.php` (free-trial tracking for the vendor's licensing), plus patch migrations. **Versioned release migrations:** `create_3.2.1_version.php`, `create_3.3.0_version.php`, `create_3.3.1_version.php` — each release ships its own cumulative migration; the in-app updater runs `/migrate` after the zip install. Seeders: `InstallationSeeder`, `DummyDataSeeder` (demo school), `AddSuperAdminSeeder`.

### 1.5 Views (199 blade; 147 app views)

Largest dirs: `students/` (18: index, details, create, add_bulk_data, assign-class, assign_roll_no, online_registration, reset_password, generate_id + id_card_settings + id_card_template, generate_result + result_template, bonafide_certificate + bonafide_template, leaving_certificate + leaving_template, email), `settings/` (12: index, app_settings, fcm_key, email_configuration, chat_setting, language_setting, privacy_policy, terms_condition, contact_us, about_us, reset_password, update_profile), `web/` (11 — public site), `web_settings/` (8), `fees/` (8: fees_types, fees_class, fees_paid, fees_pending, fees_transaction_logs, fees_receipt, fees_config, pdf_email), `layouts/` (7), `timetable/` (6), `online_exam/` (6), `leave/` (6), `auth/` (6), `exams/` (5), `class/` (4), `attendance/` (4).
**Admin UI stack:** Blade + jQuery + bootstrap-table (server-side JSON), select2, CKEditor-4 AND TinyMCE, datepicker/daterangepicker, ekko-lightbox, jquery-toast, color-picker, custom Bootstrap theme with `rtl.css` (`PHP_Code/public/assets/`); Vite + Tailwind 4 present only for build plumbing.

### 1.6 Admin sidebar menu — full map (24 groups, ~70 sub-items)

Source: `PHP_Code/resources/views/layouts/sidebar.blade.php` (962 lines). Labels are translated keys from the language files.

1. **Dashboard** — `/home`; role-aware stats (teacher/student/parent counts, boys/girls percentages) in `HomeController::index` (lines 99-168).
2. **Academics** — medium, section, stream, shift, subject, semester, class, class subjects (`class.subject`), elective subjects (`class.select-elective-subjects` + assign flow), class teacher, subject teachers, assign class to students, promote students, form fields (dynamic custom fields with drag-rank).
3. **Students** — category, add student, **online registration approval queue**, assign roll numbers, students list, **generate ID cards** (+ id-card settings/template), **generate result** PDF, reset password (admin-driven), **bulk create** (Excel via maatwebsite/excel).
4. **Teacher** — teachers list, teacher details view.
5. **Parents** — parents CRUD + search.
6. **Staff Management** — roles & permissions (spatie UI), staff CRUD.
7. **Leave** — leave apply, leave master (types), leave report, leave requests (approve/reject), staff leave, student leave requests.
8. **Timetable** — create/edit timetable (subject-teacher-class validity checks via `checkTimetable`), class timetable view, teacher timetable view; slots accept **`link_name` + `link_url`** (the "live class" link).
9. **Attendance** — create (per class-section-date), bulk create, view, report with Excel export (`student/export`).
10. **Subject Lesson** — lessons, lesson topics (with file attachments; `file/delete/{id}`).
11. **Student Assignment** — create (subject-teacher scoped), submissions review/grade.
12. **Exam** — exams (create, attach classes), exam timetable (subject/date/session), upload marks (per subject or per student), exam results (marks editing + publish flow), grades (grading-scale CRUD).
13. **Fees** — fees types, class fees assignment (`fees/classes`), fees paid (collect: compulsory + optional choiceable + installments), transaction logs, receipt.
14. **Online Exam** — online exams (with class-section targeting + percentage pass key + duration), question bank (choice / true-false / **equation-based**), per-exam terms & conditions.
15. **Custom Notifications** — push composer (role/class targeting, FCM topics).
16. **Announcement** — targeted announcements with attachments.
17. **Sliders** — app + website hero slider management.
18. **Holiday list.**
19. **Events** — events with multi-day schedules (`MultipleEvent`, `view-schedule`).
20. **Session Years** — academic years, current-session switch, installment data cleanup.
21. **Web Settings** — content blocks, educational programs, photo gallery, video gallery, FAQ, contact-us inbox with reply.
22. **System Settings** — app settings (per-app version/force-update/maintenance flags: `app_link`, `app_version`, `force_app_update`, `app_maintenance` + iOS + teacher variants), general settings (school identity, logos, theme/secondary colors, timezone, date/time format, reCAPTCHA, `online_payment` toggle), languages (CRUD, RTL flag, sample export), FCM keys, chat settings, fees config (4 gateways), email config with SMTP verification (`verify-email-settings`), ID-card settings, privacy policy, contact-us, about-us, terms-condition.
23. **System Update** — upload zip + purchase code → validate → extract → run migrations (`SystemUpdateController.php`; validator.wrteam.in check at line 58).
24. **Profile** — edit-profile, change-password (plus `/update-warning-modal` helper route).

### 1.7 Public "virtual school" website (the acquisition funnel)

`PHP_Code/app/Http/Controllers/WebController.php` + `resources/views/web/` (`master`, `header`, `footer`, `index`, `about-us`, `contact-us`, `photos`, `photos-details`, `videos`, `registration`, `error-404`):
- Marketing pages driven by WebSettings CMS (content blocks, educational programs, sliders, galleries, FAQ).
- Contact form stores leads (`ContactUs` model) with admin reply.
- **Student online registration** (`web/registration.blade.php` → `WebController::studentRegistration`, dynamic form fields included) → lands in admin **online-registration** queue → admin approves → becomes a student record. Marketing site + admission funnel + LMS + fees in one coherent product story — this is what "sells" as a virtual school.

### 1.8 Complete mobile API surface map (from `PHP_Code/routes/api.php`)

- **General (9):** `holidays`, `sliders`, `current-session-year`, `settings`, `forgot-password`, `get-events-list`, `get-events-details`, `get-session-year`, `change-password`.
- **Student (~48):** `login`, `forgot-password`, `logout`, `dashboard`, `subjects`, `class-subjects`, `select-subjects`, `parent-details`, `timetable`, `lessons`, `lesson-topics`, `assignments`, `submit-assignment`, `edit-assignment`, `delete-assignment-submission`, `attendance`, `announcements`, `get-exam-list`, `get-exam-details`, `exam-marks`, `get-online-exam-list`, `get-online-exam-questions`, `submit-online-exam-answers`, `get-online-exam-result-list`, `get-online-exam-result`, `get-online-exam-report`, `get-assignments-report`, `get-profile-data`, `get-notification`, `get-user-list`, `send-message`, `get-user-message`, `read-all-message`, `fees-details`, `add-fees-transaction`, `store-fees`, `fees-paid-list`, `fees-paid-receipt-pdf`, `fees-transactions-list`, `fail-payment-transaction`, `academic-calendar-pdf`, `send-fee-notification`, `apply-leave`, `get-leave-list`, `delete-leave`, `get-payment-status`.
- **Parent (~40):** the same surface as student but child-scoped (`CheckChild` middleware): `subjects`, `class-subjects`, `timetable`, `lessons`, `lesson-topics`, `assignments`, `attendance`, `teachers`, `get-exam-*`, `exam-marks`, `fees-*`, `get-online-exam-*`, `get-*-report`, `academic-calendar-pdf`, `apply-leave`/`get-leave-list`/`delete-leave`; plus parent-own endpoints: `announcements`, `fees-paid-receipt-pdf`, `fees-transactions-list`, `get-profile-data`, `fail-payment-transaction`, `get-notification`, `get-payment-status`, and the four chat endpoints.
- **Teacher (~40):** `dashboard`, `classes`, `subjects`, assignment CRUD (`get-assignment`, `create-assignment`, `update-assignment`, `delete-assignment`), submission review (`get-assignment-submission`, `update-assignment-submission`), file ops (`delete-file`, `update-file`), lesson CRUD (`get-lesson`, `create-lesson`, `update-lesson`, `delete-lesson`), topic CRUD (`get-topic`, `create-topic`, `update-topic`, `delete-topic`), announcement CRUD, attendance (`get-attendance`, `submit-attendance`), exams (`get-exam-list`, `get-exam-details`, `submit-exam-marks/subject`, `submit-exam-marks/student`, `get-student-result`, `get-student-marks`, `get-student-result-pdf`), students (`student-list`, `student-details`), `academic-calendar-pdf`, `teacher_timetable`, `get-profile-details`, `get-notification`, chat ×4, leaves ×3, student leaves ×2, `update-timetable-link` (live-class link editor).
- **Pattern observations:** every role reimplements chat/leave/notifications/profile (no shared abstraction); lists are POST (`get-leave-list`, `get-user-message`); payment failures are client-reported; gateway verification is poll-based (`get-payment-status`) rather than server-push; PDFs (receipt, calendar, results) are generated server-side and downloaded.

### 1.9 Settings inventory (single key-value store drives almost everything)

All settings live in one `settings` table (`Settings` model, type/message pairs; helper `PHP_Code/app/Helpers/settings_helper.php` — `getSettings($type)`, `get_language()`, `getTimeFormat()`, `getDateFormat()`, `getTimezoneList()`). Observed keys and their effects:

- **Branding/theming:** `school_name`, `school_email`, `school_phone`, `school_address`, `school_tagline`, `logo1`/`logo2`, `favicon`, `login_image`, `theme_color`, `secondary_color`, `facebook`/`instagram`/`linkedin`, `maplink` — theme colors propagate to the web front-site and both Flutter apps via the settings API.
- **Locale:** `date_formate`, `time_formate`, `time_zone`, `session_year` (active academic year).
- **Payments:** `online_payment` master toggle + per-gateway `razorpay_status/api_key/secret_key/webhook_secret/webhook_url/currency_code`, `stripe_status/publishable_key/secret_key/webhook_secret/webhook_url/currency_code`, `paystack_status/public_key/secret_key/webhook_url/currency_code`, `flutterwave_status/public_key/secret_key/webhook_url/currency_code` (`FeesTypeController.php:733-754`).
- **App governance:** `app_link`, `app_version`, `force_app_update`, `app_maintenance`, `ios_app_link`, `ios_app_version`, `teacher_app_link`, `teacher_app_version`, `teacher_force_app_update`, `teacher_ios_app_version`, `teacher_app_maintenance`.
- **Integrations:** FCM project credentials (HTTP v1), SMTP config with live verify (`verify-email-settings`), `recaptcha_site_key`/`recaptcha_secret_key`/`recaptcha_status`.
- **Content pages:** `privacy_policy`, `terms_condition`, about/contact blocks.
- **Chat policy:** retention days, message max chars, file size/count limits, deletion window (rendered in `chat_setting.blade.php`).
- Lesson for ASchool: one flat, auditable key-value config with typed readers is what makes the server-driven UX (§4.3) possible; ASchool's plugin `config_schema.yaml` system is the same idea — make sure every mobile-consumed flag goes through it.

---

## [2] MOBILE — Flutter Apps (deep audit)

### 2.1 Architecture and cross-cutting systems (both apps)

- **Two apps, not five.** `e-school` = **combined Student + Parent app**: role chosen at login (`lib/ui/screens/auth/authScreen.dart`, `studentLoginScreen.dart`, `parentLoginScreen.dart`). `e-school-teacher` = teacher-only. No admin app; admins are web-only.
- **State management:** flutter_bloc everywhere — 53 cubits in student (`lib/cubits/`, incl. `appConfigurationCubit`, `appLocalizationCubit`, `authCubit`, `feesPaymentCubit`, `examsOnlineCubit`, `chat/` subfolder), 57 in teacher. Repository layer: 13 repos (student) / 14 (teacher) in `lib/data/repositories/`; 43/42 typed models in `lib/data/models/`.
- **Endpoint registry:** `lib/utils/api.dart` (student) — every URL as a static constant, e.g. lines 48-194 for `student/*`; mirrors `PHP_Code/routes/api.php` exactly. Base URL + JWT from Hive auth box (`lib/utils/api.dart:39`).
- **Polish layer:** Lottie animations (`assets/animations/`), shimmer skeleton loaders, `flutter_animate`, `google_fonts`, `cached_network_image`, SVG assets, `readmore`, `timeago`, `any_link_preview` (chat URL previews), `carousel_slider`, `dotted_border`.
- **Localization:** 3 bundled languages (`assets/languages/{en,hi,ur}.json`), Urdu → **full RTL**; language picker at onboarding; admin can add languages server-side (`Language` model with `is_rtl`). Note: only 3 languages ship despite the language-management UI.
- **Theming:** server-supplied `theme_color`/`secondary_color` from settings API → `ColorScheme`; no user-facing dark-mode toggle found in `lib/app/app.dart`.
- **Offline:** **essentially none.** Hive stores only the auth box (JWT, selected child, cached settings) — `authRepository.dart`, `settingsRepository.dart`, `utils/api.dart:39`. No offline data caching, no mutation queue, no sync. Same gap ASchool's apps have.
- **Push:** `firebase_messaging` + `awesome_notifications` + iOS `ImageNotification` service extension (rich images). Server side (`PHP_Code/app/Helpers/notification_helper.php`): FCM **HTTP v1** with OAuth access-token caching (`getAccessToken()`, line 199), **per-role topics × platform split** (`topicMap` → e.g. studentAndroid/studentIOS topics, lines 115-149), plus per-user token sends. Chat has its own push util (`chatNotificationsUtils.dart`). `firebase_crashlytics` + `firebase_analytics` wired into both pubspecs.
- **App governance:** server flags `app_version`, `force_app_update`, `app_maintenance` (+iOS and teacher variants) rendered as blocking dialogs (`home/widgets/forceUpdateDialogContainer.dart`, `appUnderMaintenanceContainer.dart`). Admin edits in `resources/views/settings/app_settings.blade.php`.
- **Onboarding:** `showcaseview` coach marks (teacher app, `homeScreen.dart` showcase keys); none in student app v3.3.6 (custom showcase widget deleted per changelog).

### 2.2 Student+Parent app — every screen (100 files in `lib/ui/screens/`)

- **Bottom nav = 4 items** (`home/homeScreen.dart:133-158`): **Home / Chat / Assignments / Menu**. The Menu tab opens a **bottom-sheet grid** (`home/widgets/moreMenuBottomsheetContainer.dart`) driven by a single data list `lib/utils/homeBottomsheetMenu.dart` with 9 tiles: attendance, timetable, notice board, exams, results, reports, parent profile, academic calendar, settings. 13 destinations total with only 4 tabs — the key nav idea worth stealing.
- **Home** (`home/homeScreen.dart`, `home/widgets/homeContainer.dart`): today's timetable, pending assignments, upcoming exams, exam results, events, sliders, latest announcements; notification badge refreshed on app resume via lifecycle hook (`homeScreen.dart` `didChangeAppLifecycleState`).
- **Auth:** role select → student (gr-number+password) or parent (phone/email); forgot-password bottom-sheets; T&C + privacy acceptance container.
- **Academics:** `subjects` → `selectSubjectsScreen` (elective self-selection) → `subjectDetails` (chapters + announcements tabs) → `chapterDetails` → `topicDetailsScreen`; `timetable` per day; `childTimeTableScreen` in parent mode.
- **Content viewers:** `fileViews/pdfFileScreen.dart` (flutter_pdfview), `fileViews/imageFileScreen.dart`, `playVideo/playVideoScreen.dart` (YouTube via `youtube_player_flutter` + uploaded videos via `video_player` with custom `playPauseButton`/`videoControlsContainer`).
- **Assessments:** `exam/examScreen` (tabs: exam list / timetable / results), `exam/examTimeTableScreen.dart`, `resultScreen.dart`, `resultOnline/resultOnlineScreen.dart`, `reports/` (subject-wise detailed analytics combining online-exam + assignment performance: `reports/subjectWiseDetailedReport.dart`, `reportSubjectsContainer.dart`), and the **online-exam runner** (§3.2).
- **Assignments:** list with status filters, submit/edit/delete with file-picker bottom-sheets (`assignment/widgets/uploadAssignmentFilesBottomsheetContainer.dart`), **undo-snackbar** deletion pattern (`undoAssignmentBottomsheetContainer.dart`).
- **Attendance** (calendar with per-day status), **notice board**, **notifications**, `eventsDetailsScreen`, **leaves** (`leave/addLeaveScreen.dart`, `manageLeavesScreen.dart`, month picker, per-day status), **academic calendar** (`academicCalendar/`: holidays, semester breaks, offline-exam days, `downloadAcademicCalendarContainer` — server PDF).
- **Fees (complete payment UX):** `feesDetailsScreen` (due/paid tabs), `studentFeePaymentDueScreen`, `fees/widgets/paymentSelection.dart` (gateway picker from server-enabled gateways, lines 28-29), **native SDKs** `razorpay_flutter` + `flutter_stripe` (pubspec), `fees/webviewPaymentScreen.dart` (fallback), `feesTransactionScreen`, `feesPaymentVerification` (server `get-payment-status` polling), `feesStatusScreen`, receipt PDF download (`studentDownloadFeePaidReceiptButton`), and `askParentsToPayFeesCubit` (student nudges parent to pay).
- **Chat:** `chatUsersScreen` (+search, profile), `chatMessagesScreen` (attachments, read receipts, link previews, keyboard-visibility handling).
- **Parent mode:** `parentHomeScreen.dart` (748 lines) renders **child cards**; tapping a child opens child-scoped screens: `childDetailsScreen`, `childAssignmentsScreen`, `childAttendanceScreen`, `childResultsScreen`, `childTeachers`, `childTimeTableScreen`, plus per-child fees/leave/online-exams; backend enforces via `CheckChild` middleware.
- **Misc:** about, contact, privacy, terms, settings (language, password, profile), splash (app-config fetch + maintenance check).

### 2.3 Teacher app — every screen (92 files in `lib/ui/screens/`)

- **Bottom nav = 4 items** (`home/homeScreen.dart:59-78`): **Home / Schedule / Profile / Settings**.
- **Home tab** (`home/tabs/homeContainer/`): class-teacher class card, subject-teacher class cards, today's timetable (`homeContainerTodaysTimetableContainer`), exams (`homeContainerExamItemContainer`), **staff leave approvals and student leave requests inline** (`homeContainerStaffLeavesContainer.dart`, `homeContainerStudentLeaveRequestContainer.dart`).
- **Academic CRUD:** `classScreen`, `subjectScreen`, `lessonsScreen` → `addOrEditLessonScreen`, `topcisByLessonScreen` → `topicsScreen` → `addOrEditTopicScreen` (lesson→topic→files hierarchy; `delete-file`/`update-file` APIs).
- **Assignments:** `assignmentsScreen`, `add&editAssignmentScreen`, **accept/reject submissions** with dedicated bottom-sheets (`assignment/widgets/acceptAssignmentBottomsheetContainer.dart`, `rejectAssignmentBottomsheetContainer.dart`), grading + feedback.
- **Attendance:** `attendanceScreen` (mark by class-section + date, per-student status toggles).
- **Exams:** `exam/examScreen`, `examTimeTableScreen`, `result/` — **marks entry by subject OR by student** (`result/addResultForAllStudentsScreen.dart`, `result/addResultOfStudentScreen.dart`, `addMarksContainer`), student result PDF (`get-student-result-pdf`).
- **Students:** `searchStudentScreen`, `studentDetailsScreen` (profile, attendance, fees, results), `studentLeaves/manageStudentLeavesScreen` (approve/reject with reason — `reason_of_rejection` migration).
- **Announcements:** `announcementsScreen` + `addOrEditAnnouncementScreen` (create/update/delete, targeted).
- **Own workflow:** leaves (apply/manage with session-year picker), academic calendar, chat (same stack), notifications, **Schedule tab with live-class link editor** (`home/widgets/addUpdateTimetableLinkBottomsheetContainer.dart` — `link_name` + `link_custom_url`), settings (language bottom-sheet, change password, logout, about).
### 2.4 API consumption

- **~124 API endpoints consumed across both apps**, all listed in `lib/utils/api.dart`; notable API quirks: lists sent via POST (`get-leave-list`, `get-user-message`), client-reported payment failures (`fail-payment-transaction`), poll-based gateway verification (`get-payment-status`).

### 2.5 Chat system (identical stack in both apps — 8 files each, `lib/ui/screens/chat/`)

- `chatUsersScreen.dart` (list with unread counts) → `chatUserSearchScreen.dart` → `chatMessagesScreen.dart` (paged history via `POST get-user-message`) → `chatUserProfileScreen.dart`.
- Widgets: `attachmentDialog.dart` (file/image attach with size+count limits from chat settings), `messageSendingWidget.dart`, `singleMessageItem.dart`/`messageItemComponents.dart` (read-receipt ticks, `timeago`), `any_link_preview` for URLs.
- Cubits: `cubits/chat/` (users, messages, send, read-all). Push: `utils/notificationUtils/chatNotificationsUtils.dart` sends per-message notifications so the app can badge even when backgrounded.
- Server retention: `automatically_messages_removed_days`, `from_date`/`to_date` scheduled deletion, `max_characters_in_text_message`, `max_file_size_in_bytes`, `max_files_or_images_in_one_message` (admin `chat_setting.blade.php`); cron `delete-chat-message/cron-job` enforces it.

### 2.6 Fee payment sequence (student app, end to end)

1. `feesDetailsScreen` loads `student/fees-details` (dues split compulsory / choiceable / installments).
2. `studentFeePaymentDueScreen` → select items → `paymentSelection.dart` renders only server-enabled gateways (reads gateway status flags from settings API).
3. Razorpay/Stripe checkout via native SDKs; Paystack/Flutterwave via `webviewPaymentScreen.dart`.
4. Transaction created with `add-fees-transaction`, confirmed by `get-payment-status` polling + server webhook; failure path: `fail-payment-transaction` marks it failed client-side.
5. Success: `feesTransactionScreen` history, `feesStatusScreen` summary, receipt PDF download, parent nudge via `send-fee-notification`/`askParentsToPayFeesCubit`.

### 2.7 What the mobile apps deliberately do NOT have

No offline data layer (Hive = auth/settings only), no dark-mode toggle, no admin app, no conferencing, no library/hostel/transport/GPS/health modules, no gamification, no timetable-master editing (admin-only), no push-preference management. Every screen is an online, request/response view of the Laravel API — the polish is in motion design and empty states, not resilience.

---

## [3] "VIRTUAL SCHOOL" SPECIFICS — why this product sells

### 3.1 Live classes: there is NO video-conferencing integration

`grep -ri "zoom|jitsi|bigbluebutton|google meet"` across `PHP_Code/app` and views → **zero hits**; composer has no conferencing SDK. "Live classes" are **external meeting URLs attached to timetable slots**: `timetables.link_name` + `link_url`/`link_custom_url` (admin `TimetableController::linkUpdate` line 288; teacher app editor `addUpdateTimetableLinkBottomsheetContainer.dart`; student app opens via `url_launcher`). The sellable "virtual school" is the **sum of the funnel** (marketing site → online admission → lessons/content → online exams → chat → online fees → results PDFs), not any deep integration. Lesson for ASchool: the moat is workflow completeness and polish, not a Zoom badge.

### 3.2 Online exams (the strongest single feature)

- **Admin** (`OnlineExamController.php`, `OnlineExamQuestionController.php`, views `resources/views/online_exam/`): per-exam class-section targeting, duration, percentage pass key, **terms & conditions page per exam**; question types validated as `'question_type' => 'required|in:0,1'` (`OnlineExamQuestionController.php:61`) — type 0 = choice with **multi-option + multi-answer** support, type 1 = **equation-based (LaTeX)** (`exam_questions.blade.php:53` "equation_based"). Five models track the full attempt lifecycle (`OnlineExamStudentAnswer`, `StudentOnlineExamStatus`), auto-scoring, result lists.
- **Student runner** (`e-school/lib/ui/screens/exam/onlineExam/examOnlineScreen.dart`): countdown timer with auto-submit (`ExamTimerContainer`), **question-palette bottom sheet** with answered/marked/unseen states (`examQuestionStatusBottomSheetContainer.dart`), **wakelock_plus** keeps the screen awake, retake-cooldown timer (`canGiveExamAgainTimer`, lines 51-98), LaTeX rendering via `flutter_tex 4.0.9`. This is a genuinely strong exam UX that beats most CodeCanyon peers and matches what ASchool should guarantee in its own runner.
- **Admin flow end to end:** create exam (title, class-section, subject, duration, percentage pass key, status) → `get-class-subject-questions` pulls from the shared question bank or author new questions (choice/equation/true-false, option-level management with `remove-options`/`remove-answers`) → attach per-exam T&C → students attempt in-app → auto-score (`OnlineExamStudentAnswer`) → result list + per-subject reports surfaced in both the apps (`reports/subjectWiseDetailedReport.dart`) and panel (`online-exam/result/{id}`).
- **Assessment weakness to exploit:** online exams are scored objectively only — no long-answer, no rubrics, no AI grading, no question randomization per student, no anti-cheat beyond the T&C page. ASchool's question bank + AI suite should dwarf this; the steal is only the runner UX.

### 3.3 Content management

`Lesson → LessonTopic → File` (models + `api.php:196-206` teacher CRUD). Study-material types defined in the student model `lib/data/models/studyMaterial.dart:2`: **`file`, `youtubeVideo`, `uploadedVideoUrl`, `other`** — deliberately simple, deliberately video-first (YouTube links cost the school nothing to host). In-app playback with custom controls, PDF and image viewers. Lessons/topics carry session-year scoping and are searchable (`search-lesson` route).

### 3.4 Monetization model of the product itself

- **One-time Envato license** (purchase code + domain lock via `validator.wrteam.in`, `InstallPurchaseController.php`), NOT SaaS; `add_column_free_app_use_date_in_session_years_table.php` hints at trial tracking.
- **In-app self-updater** (`SystemUpdateController.php`): admin uploads release zip + purchase code → validated → extracted → `/migrate` runs version-gated migrations. Twelve years of CodeCanyon lessons baked into this flow.
- **Schools collect fees online** via Razorpay / Stripe / Paystack / Flutterwave — each gateway has status toggle, keys, webhook secret, webhook URL, currency code stored in the settings table and edited on `fees-config` (`FeesTypeController.php:733-780`); webhooks reconcile transactions (`WebhookController.php`); students/parents pay **in-app via native SDKs** with a full transaction-state machine, receipt PDFs, and parent-nudge pushes.
- No internal subscription/recurring billing; no internal multi-school tenancy; single `school_name` setting.

### 3.5 Academic operations depth (supporting cast)

- **Session years + promotion:** `SessionYear` + `StudentSessions` give per-year enrollment rows; `promote-student` resource + `getPromoteData` promote cohorts with carry-forward (`previous_session_year_id` migration); fees config is per session year (`deleteInstallmentData`).
- **Timetable integrity:** `checkTimetable` endpoint validates teacher/section/subject clashes before save (`TimetableController.php:200`); separate class-timetable and teacher-timetable views; subject-teacher assignment (`SubjectTeacher`) is the join that makes both views consistent.
- **Exam pipeline:** exam → attach classes (`ExamClass`) → exam timetable per subject/date → marks upload per subject or per student (`exams/upload-marks`) → result editing (`update-result-marks`) → publish (`exams/publish/{id}`) → per-student result PDF with template; grading scales CRUD (`grades` routes).
- **Attendance reporting:** per-student export to Excel (`attendance/student/export`), report views by class/date range (`attendace_report`).
- **Events:** single events plus multi-day schedules (`MultipleEvent`, `view-schedule`, `events-update`); events of `type=exam` surface on the academic calendar (`add_type_to_events_table.php` migration, rendered by `calendarOfflineExamContainer.dart` in the apps).
- **Language/medium management:** admin CRUD for app/panel languages (sample export, `set-language/{lang}`), plus `Mediums` as an academic dimension (classes and subjects are medium-scoped — `class-subject-list/{medium_id}`), i.e. a school can run parallel English-medium and Nepali-medium classes. This medium concept is genuinely relevant for Nepal and worth mirroring in ASchool's academics plugin.

---

## [4] UI/UX PATTERNS WORTH STEALING (admin panel + apps)

1. **Bottom nav (4 tabs) + "more menu" bottom-sheet grid** — 13 destinations, shallow nav, data-driven from one `Menu` list (`e-school/lib/utils/homeBottomsheetMenu.dart`). Directly applicable to ASchool's student-app drawer bug and admin-app depth.
2. **Parent mode = child cards → child-scoped screens** (`parentHomeScreen.dart` + `child*Screen.dart`, backend `CheckChild` middleware `api.php:129`). Explicit, scalable multi-child pattern; each child screen is a thin re-skin of the student screen.
3. **Server-driven app governance:** force-update, maintenance mode, per-platform app version, theme colors, gateway toggles — one `app_configuration` payload at launch (`appConfigurationCubit.dart`; `app_settings` admin page). Zero releases needed for ops changes.
4. **Uniform server-side table convention in admin:** every module pairs its resource routes with a `*_list` JSON endpoint consumed by bootstrap-table — one consistent filterable/paginated pattern across ~70 tables (`routes/web.php`).
5. **Dynamic form fields** (`FormField` model with rank ordering, `FormFieldController::changeRank`) — admins extend the student registration form with no code; values persist in a `dynamic_fields` JSON column and surface in the apps (`dynamicField.dart`).
6. **Fees domain modeling:** choiceable (optional/elective) fees per class, installments with partial-payment tracking, gateway-agnostic `PaymentTransaction` log with webhook reconciliation, receipt PDF + email template (`fees/pdf_email.blade.php`), "ask parents to pay" nudge.
7. **Online-exam runner UX:** question palette, wakelock, auto-submit, retake cooldown, LaTeX questions, per-exam T&C gate.
8. **Rich push pipeline:** FCM HTTP v1 + OAuth token caching, per-role topics × Android/iOS split, rich-image iOS notifications, chat push separated from general push (`notification_helper.php`).
9. **Feedback polish:** shimmer loaders, Lottie empty states, undo-snackbar deletions, toast notifications (admin), showcaseview coach marks (teacher app), `timeago` timestamps.
10. **Academic calendar as one artifact:** holidays + semester breaks + offline-exam events on a single calendar with a downloadable PDF (`academic_calendar_pdf.blade.php`; `getAcademicCalendarPdf` endpoint for all three roles).
11. **Document generation pack:** ID-card generator with photo/logo settings and templates (`students/id_card_template.blade.php`), bonafide + leaving certificates with editable templates, result PDF with template (`result_template.blade.php`). (ASchool's design_studio covers this — but note how these are bundled as *student-record* features, not a designer tool.)
12. **Shipped documentation site:** per-feature docs (`eSchool-Documentation/features/*.md`: academics, announcements, assignments, attendance, chat, custom-notifications, document-generation, exams, fee-payment, holidays, leave-management, lessons-topics, semester, sliders, student-management, student-registration, teacher-management, timetable) + app customization guides (theme, font, language, package name, Firebase, release). Docs are part of the sales pitch.
13. **Permission granularity as UX:** spatie abilities are checked per feature in UI and API (e.g. `SettingController::delete_chat_messages` gates on `Auth::user()->can('chat-message-delete')`, line 715) — role editing in the panel is a first-class screen (`roles` resource + `roles-list/{id}`).
14. **Email hardening UX:** SMTP config page has a "verify" action and test-mail route (`sendtest`), so schools debug deliverability from the panel rather than support tickets; chat/fee/notification emails reuse one blade (`fees/pdf_email.blade.php` shows the PDF+email pattern).
15. **Installer as a product step:** `dacoto/laravel-wizard-installer` fork gives a step-by-step web install (purchase code → DB → admin), meaning a non-technical school can self-deploy — relevant to ASchool's self-hosted onboarding story.

---

## [5] WHAT ASCHOOL LACKS (specific gaps, with evidence)

1. **In-app 1:1 chat.** eSchool ships full messaging: rooms/members/messages/files/read-receipts (`ChatRoom`, `ChatMember`, `ChatMessage`, `ChatFile`, `ReadMessage` models), unread badges, URL previews, dedicated chat push, and **admin retention policy** (`chat_setting.blade.php` fields: `automatically_messages_removed_days`, `max_characters_in_text_message`, `max_file_size_in_bytes`, `max_files_or_images_in_one_message`, scheduled deletion window) enforced by cron (`web.php:485`, `SettingController::delete_chat_messages`). ASchool has Socket.IO infra (`backend/app/realtime.py`) and `api/v1/communications.py` but no comparable per-user chat in the mobile apps — verify and close.
2. **Native payment SDKs in mobile.** eSchool embeds `razorpay_flutter` + `flutter_stripe` (in-app payment sheets, no browser redirect). ASchool's parent fee flow is WebView/server-redirect (`flutter_parent/lib/features/fees/fee_payment_screen.dart:351` `_GatewayWebViewScreen`, gateway switch at lines 314-316). Even keeping eSewa/Khalti redirect flows, ASchool should adopt eSchool's **transaction-state machine**: pending/verified/failed + client-side fail reporting (`fail-payment-transaction`) + verification screen + receipt PDF.
3. **Force-update / maintenance-mode governance.** eSchool checks server flags for version, forced update, and maintenance per app per platform (`app_settings` admin page). No equivalent found in ASchool's five Flutter apps — cheap to add, high ops value.
4. **Onboarding coach marks + rich push images.** showcaseview teacher onboarding; iOS notification image service extension. Absent in ASchool apps.
5. **Crashlytics + Analytics in all apps.** eSchool bundles both in every pubspec. If ASchool's apps lack a crash pipeline, this is a parity gap.
6. **Mobile online-exam runner details.** ASchool's `backend/app/models/question_bank.py` is richer in types (mcq/short_answer/long_answer/true_false + `solution_latex`, PaperBlueprint) — but verify the Flutter runner renders LaTeX/multi-answer MCQs and implements palette + wakelock + auto-submit + retake cooldown like `examOnlineScreen.dart`.
7. **Fee nudges.** `send-fee-notification` + `askParentsToPayFeesCubit` — small collections feature worth mirroring in ASchool fees plugin.
8. **Admission funnel wiring.** eSchool: public site form (`web/registration.blade.php`) → dynamic fields → admin approval queue (`online-registration`) → enrolled student. ASchool has `admission` + `website_builder` + `basic_website` plugins — verify they are wired end-to-end (public form → queue → approve → enrollment) as one flow.
9. **Elective subject groups with student self-selection.** `ElectiveSubjectGroup` model, admin assign flow (`class.select-elective-subjects`), student app `selectSubjectsScreen`. Relevant to NEB +2 streams; nepal_curriculum should match/exceed.
10. **Per-release migration discipline.** eSchool ships `create_3.3.x_version.php` cumulative migrations per release; adopt version-bundled migration groups for ASchool self-hosted updates.

### 5.11 Quick parity checklist (eSchool feature → ASchool status → action)

| eSchool feature (evidence) | ASchool today | Action |
|---|---|---|
| In-app chat + retention (`all_chat_table.php`, `chat_setting.blade.php`) | Socket.IO exists, no chat product | Build chat plugin |
| Native pay SDKs (`razorpay_flutter`, `flutter_stripe` pubspecs) | WebView redirect (`fee_payment_screen.dart:351`) | Add transaction-state machine + verification UX |
| Force-update/maintenance flags (`app_settings.blade.php`) | Not found in apps | Add `app_configuration` launch payload |
| Showcase onboarding + Crashlytics + Analytics (pubspecs) | Not verified | Audit the 5 apps; add both |
| Exam runner UX (`examOnlineScreen.dart`) | question_bank richer server-side | Verify runner: palette/wakelock/LaTeX/auto-submit |
| Fee nudges (`send-fee-notification`) | Not found | Add to fees plugin |
| Admission funnel (WebController → online-registration) | admission + website_builder exist | Verify end-to-end wiring |
| Elective groups + self-selection (`selectSubjectsScreen`) | nepal_curriculum exists | Match NEB stream model |
| ID card / bonafide / leaving certificates (`students/*.blade.php`) | design_studio bulk PDFs | Covered — but bundle as record features |
| Academic calendar PDF (`getAcademicCalendarPdf`) | Not verified in mobile | Cheap win for all apps |
| Multi-medium classes (`Mediums`, `class-subject-list/{medium_id}`) | Not found | Consider for nepal_curriculum |

---

## [6] WHAT ASCHOOL DOES BETTER

1. **Scale and architecture:** ~756 API endpoints vs ~124; 44 plugin modules vs 46 monolithic controllers (3 of which are 3-4k-line god-classes serving all mobile traffic); Flask + pgvector + Celery vs a synchronous Laravel monolith; Next.js 216-page dashboard with manifest-driven sidebar vs Blade + jQuery + bootstrap-table.
2. **True multi-tenant SaaS** with per-school isolation and plugin entitlements vs one-school-per-install with a domain-locked Envato validator; eSchool has no internal billing/recurring concept at all.
3. **Nepal-native capability:** BS dates (`backend/app/utils/nepali_date.py`), iEMIS compliance + iemis_importer, SEE/NEB grading, Sparrow SMS, eSewa/Khalti/FonePay (`backend/app/plugins/modules/fees/manifest.yaml` lists `esewa_gateway`, `khalti_gateway`, `fonepay_gateway`). eSchool has zero Nepal-specific capability, and its gateways (Razorpay/Stripe/Paystack/Flutterwave) poorly cover Nepali domestic payments.
4. **Feature breadth eSchool cannot match:** ai_suite (24 tools + tutor + workbench), ai_teacher, ai_adaptive_learning, alumni, biometric, disaster_management, dismissal, elibrary, emergency, gamification, gps_tracking, health_records, hostel, hr_payroll, incident_management, incidents, inventory, library_management, multi_branch, student_portfolio, visitor_management, wellbeing, whatsapp_bot, white_label, design_studio, compliance — none of these exist in eSchool.
5. **Live classes are real in ASchool:** the LMS plugin manifest (`lms/manifest.yaml`) specifies "Live classes via Jitsi, recorded class library, course builder" — versus eSchool's pasted external URL on a timetable slot.
6. **Assessment depth:** question bank with paper blueprints (`PaperBlueprint` in `question_bank.py`), SEE/NEB grading — vs eSchool's flat online-exam + marks-entry model.
7. **Mobile coverage:** 5 role apps + unified vs eSchool's 2 apps and **no admin app**.
8. **Extensibility:** plugin manifests carrying events, entitlements, UI nav, and mobile feature folders vs eSchool's hand-coded sidebar blade and god-controllers.
9. **Security posture:** eSchool exposes unauthenticated `/migrate`, `/clear`, `/seeder_install` routes (`web.php:505-546`), stores all secrets (gateway keys, SMTP, FCM) in a plaintext settings table, and ships a licensing model that encourages nulled distributions (the audited copy itself is a nulled distribution). ASchool's SaaS model avoids this class of problem entirely.
10. **Content spine:** content_spine/teaching_content/textbook models + AI workbench dwarf `Lesson→Topic→File`.
11. **Bilingual-by-design UI:** ASchool plugin manifests carry `name` and `name_nepali` labels (e.g. `conferences/manifest.yaml`: "Parent-Teacher Conferences" / "अभिभावक-शिक्षक भेटघाट") — eSchool's apps ship only en/hi/ur and its admin labels are English keys translated via PHP lang files; neither puts Nepali first.
12. **Async job architecture:** Celery workers + pgvector give ASchool PDF/WhatsApp/AI pipelines off the request path; eSchool generates dompdf PDFs synchronously in web requests and has no queue usage outside the Laravel default (`create_jobs_table.php` exists but no heavy workers).

---

## [7] ORGANIZATION LESSONS for ASchool's plugin / nav / mobile structure

1. **Nav architecture:** 4-tab bottom nav + bottom-sheet "more" grid beats a deep drawer for students. Implement the ASchool student-app menu as a data-driven grid (directly from plugin manifests' mobile nav sections) instead of the current drawer; eSchool proves 13 destinations stay navigable this way.
2. **One manifest, all surfaces:** in eSchool, adding a feature means hand-editing the blade sidebar + 2 Flutter apps + 3 API controllers. ASchool manifests already carry nav + mobile feature folders — push further so new plugins auto-appear in the Next.js sidebar sections and the mobile more-menu grids.
3. **Parent-child scoping:** one `CheckChild` middleware + thin child-scoped screens is the cleanest multi-child pattern seen; adopt for the ASchool parent app instead of duplicating endpoints.
4. **Server-driven ops config:** add an `app_configuration` launch payload (force-update, maintenance, min versions, theme) consumed by all five ASchool apps.
5. **Consistent list-endpoint envelope:** eSchool's `resource` + `*_list` pairing kept 70 admin tables uniform; standardize one paginated response envelope across all 756 ASchool endpoints consumed by the Next.js tables.
6. **Release engineering:** per-release migration bundles + an update flow kept 66 migrations coherent across years; adopt version-bundled migration groups for ASchool self-hosted deployments.
7. **Docs as product:** ship per-feature docs + customization guides with ASchool (eSchool's Docusaurus site materially reduces support load and sells the product).
8. **Combined-app tradeoff:** eSchool's dual-mode student+parent app halves maintenance; ASchool's 5 apps are justified by depth, but the unified app should reuse the parent child-card pattern and role-switch-at-login flow.
9. **Fees data model:** adopt the choiceable-fees / installment / transaction-log triplet (it models Nepali school fee realities — optional charges, installments — well) even though the gateways differ.
10. **Chat as a plugin candidate:** mirror eSchool's split (general push vs chat push, read-receipt table, admin retention policy with size/count/day limits) on ASchool's existing Socket.IO layer.
11. **Don't copy:** POST-for-list APIs, client-reported payment failures without server verification, unauthenticated Artisan routes, secrets in a plaintext settings table, 3-4k-line controllers.
12. **Menu labels as data:** eSchool's sidebar renders translated keys (`menu-title">{{ __('academics') }}`) and the apps pull labels from `labelKeys.dart` + language JSON — one source of truth per surface. ASchool should ensure the Next.js sidebar and Flutter apps both consume the manifest's bilingual labels rather than hardcoding strings.
13. **Empty states and skeletons as a standard:** eSchool's apps pair every list screen with shimmer + Lottie empty states via shared widgets (`lib/ui/widgets/` — 73 files in the student app); make this a lint-level convention in ASchool's five apps so plugin screens get it for free.
14. **Calendar unification:** attendance days, holidays, semester breaks, exams, and events all render through ONE calendar component (`table_calendar`) in both apps — ASchool's timetable/attendance/exams/conferences plugins should feed a single calendar surface too.

---

## [8] VERDICT

| Dimension | eSchool v3.3.6 | ASchool |
|---|---|---|
| Architecture | Laravel monolith, Blade+jQuery, 3 API god-controllers (3.4-3.8k LOC) | Flask plugins + Next.js + 5 Flutter apps |
| Scope | ~455 route defs, ~15 feature domains, 73 models | ~756 endpoints, 44 plugins, AI layer, pgvector/Celery |
| Mobile polish | High (Lottie, showcase, exam-runner UX, native pay SDKs, governance dialogs) | Medium (teacher deepest, admin shallow, zero offline, no governance flags) |
| Nepal fit | None (India/global gateways, AD dates only) | Native (BS dates, iEMIS, SEE/NEB, eSewa/Khalti, Sparrow) |
| Virtual-school story | Coherent end-to-end funnel (site→admission→content→exam→fees→results) | Stronger parts, weaker single-story packaging |
| Business model | One-time Envato license, zip self-updater | Multi-tenant SaaS + plugin entitlements |
| Live classes | External URL on timetable slot | Jitsi integration + recorded library (LMS) |
| Offline support | None (Hive = auth only) | None — both must invest |
| In-app chat | Full product (rooms, receipts, retention) | Socket.IO infra only |
| Shipped docs | Docusaurus per-feature site | README-level only |
| Extensibility | Hand-coded sidebar + god-controllers | Plugin manifests drive nav, entitlements, mobile folders |

**Top steal list (priority order):** (1) more-menu bottom-sheet nav for the student app; (2) child-card parent mode with scoping middleware; (3) server-driven force-update/maintenance/theme config for all five apps; (4) payment transaction-state machine + receipts + fee nudges; (5) online-exam runner UX (palette, wakelock, LaTeX, auto-submit, retake cooldown); (6) admission funnel wiring from public site to enrollment; (7) in-app chat with admin retention policy; (8) per-feature shipped docs; (9) uniform list-endpoint envelope; (10) per-release migration bundles.

**Risks if ASchool ignores this audit:**

- eSchool's mobile polish (bottom-sheet nav, onboarding coach marks, governance dialogs, native pay sheets) is exactly what buyers demo first; ASchool's student drawer bug and admin app shallowness will lose head-to-head evaluations even where backend capability is superior.
- The chat + fee-nudge + admission-funnel trio is the "sticky daily-use" loop of a school product; without chat and nudges, ASchool apps get opened only for checks, not conversations.
- Nepali schools evaluating "virtual school" readiness will compare the online-exam runner and live-class experience line by line — eSchool's runner (palette/wakelock/LaTeX/auto-submit) is the benchmark to beat, and ASchool must verify parity in its own Flutter runner before claiming it.

**Recommended follow-up verifications inside ASchool (triggered by this audit):**

1. Confirm whether any ASchool Flutter app implements force-update/maintenance gates; if not, add one shared `app_config` cubit to `aschool_shared`.
2. Trace the parent-app fee payment happy path with a real eSewa/Khalti sandbox and check server-side verification vs client-reported success.
3. Check whether the student-app online-exam feature (if present) renders `solution_latex`/multi-answer MCQs and enforces wakelock + auto-submit.
4. Decide chat: build on `realtime.py` (Socket.IO) or keep WhatsApp Bot as the channel — but pick deliberately, since eSchool's chat is a daily-use anchor.
5. Wire `basic_website`/`website_builder` public admission form into the `admission` plugin's approval queue, then into `academics` enrollment.

**Bottom line:** eSchool v3.3.6 is a polished, narrow, single-school "virtual school" workflow — content + online exams + fees + chat — with above-average mobile polish for the CodeCanyon market and excellent product packaging (docs, funnel, release engineering). Architecturally it is a decade behind ASchool's plugin/SaaS model, it has zero Nepal-specific capability, and its "live classes" are just external links. Its lessons for ASchool live almost entirely in mobile UX patterns, ops governance, and packaging — not backend architecture.
