# Competitor Deep Audit: EduEx LMS v2.0 (Laravel + Flutter)

**Audited:** `Other Projects/EduEx LMS v2.0/EduEx LMS v2.0/codecanyon-61977497-eduex-the-ultimate-learning-management-system-lms-with-flutter-mobile-app/`
**Compared against:** ASchool (multi-tenant Nepal school SaaS; lms + assignments + elibrary plugins, 50+ plugins, 5 Flutter apps)
**Date:** 2026-09-11
**Audit method:** Full static read of Laravel app (routes/controllers/models/migrations/services/views), full read of Flutter app (`lib/`), documentation site, then line-level comparison with `ASchool/backend/app/api/v1/lms.py`, `ASchool/backend/app/models/lms.py`, and `ASchool/backend/app/plugins/modules/lms/`.

Paths below are relative to the audited root unless prefixed `ASchool/`. Two Laravel copies exist (`Eduex Laravel_x/` and `Eduex Laravel_extracted/`); `diff -rq` confirms they are identical. All paths cited use `Eduex Laravel_x/Eduex Laravel/` (shortened to `Laravel/`).

---

## 1. INVENTORY (everything, counted)

**TL;DR:** EduEx v2.0 is a Laravel 11 course-marketplace LMS (Codecanyon item 61977497) shipped with one student-facing Flutter app. It is a **monetization-first** LMS: 3 pricing models, 10 payment gateways, instructor payouts — wrapped around a video-lesson learning core with sequential locking, MCQ quizzes, file assignments, PDF certificates with public verification, two-layer discussions, and an external-link live-class scheduler. No push notifications, no offline downloads, no Jitsi embedding, and the "AI learning path" app screens are mocks. Full counts below.

### 1.1 Laravel side — headline counts

| Artifact | Count | Where |
|---|---|---|
| Route files | 8 (web, api, admin, instructor, student, auth, install, console) | `Laravel/routes/*.php` (1,048 lines total) |
| API routes | 181 registered routes | `Laravel/routes/api.php` |
| Controllers | 148 PHP files | `Laravel/app/Http/Controllers/{Admin(39),Api(31+Instructor/13),Front(17),Instructor(21),Student(17),Auth(5),Setup(7)}` |
| Eloquent models | 60 | `Laravel/app/Models/` |
| Migrations | 90 | `Laravel/database/migrations/` |
| Blade views | 264 | `Laravel/resources/views/` |
| Services | 21 | `Laravel/app/Services/` (GeminiService, LiveClassService, RevenueShareService, CouponService, ChatService, SubscriptionService, PaymentGatewayService, CertificateVerificationService, OtpService, ThemeService, LanguageManagerService, ...) |
| Repositories | 1 (only CourseDiscussionRepository) | `Laravel/app/Repositories/` |
| Seeders | 13 | `Laravel/database/seeders/` |
| Roles | 3 (admin, instructor, student) via spatie permission | `Laravel/routes/admin.php:42`, `RoleSeeder.php` |

### 1.2 Route inventory per surface

| Route file | Lines | Purpose |
|---|---|---|
| `Laravel/routes/web.php` | 134 | Public marketing site + checkout + payment callbacks (9 gateways) + cron |
| `Laravel/routes/api.php` | 288 (181 `Route::` calls) | Student app API + full instructor app API (the "Flutter API") |
| `Laravel/routes/admin.php` | 264 | Admin panel: 18 settings panels, courses, bundles, enrollments, payments, withdrawals, reviews, coupons, subscription plans, frontend manager, theme, updater, impersonation |
| `Laravel/routes/instructor.php` | 167 | Web instructor: dashboard, builder, events (6-tab wizard), earnings, discussions, live classes, chat |
| `Laravel/routes/student.php` | 121 | Web student: course access loop (load/complete/progress/quiz/assignment/next/prev/search/sidebar/completion/certificate), discussions, community, AI chat, messages |
| `Laravel/routes/auth.php`, `install.php`, `console.php` | 74 | OTP-enabled auth, installer wizard, scheduler |

Notable: the student web surface (`routes/student.php:33-51`) exposes fine-grained AJAX verbs (`item/next`, `item/previous`, `sidebar/refresh`, `search` within course) — a fully client-hydrated player, not page reloads.

### 1.3 Feature-by-feature inventory (Laravel)

**Auth & users** (`Laravel/app/Http/Controllers/Auth/`, `Api/AuthController.php`)
- Email/password login, OTP login verify/resend (`LoginOtpController.php`, `OtpService.php`), forgot/reset password, 2FA columns on users (`2025_11_01_234952_add_two_factor_columns_to_users_table.php`), reCAPTCHA (`RecaptchaService.php`), account self-deletion with admin approval queue (`AccountDeletionRequest.php`, `Admin/AccountDeletionController.php`), per-user notification preferences (`UserNotificationSetting.php`).

**Course catalog & authoring** (`Laravel/app/Http/Controllers/Instructor/CourseBuilderController.php` — 1,372 lines)
- Course → CourseTopic (section) → three item types: Lesson, Quiz, Assignment (`app/Models/CourseTopic.php` has `lessons()`, `quizzes()`, `assignments()`).
- Course fields: title, rich description, featured image, intro video, visibility, public/private, max_students, difficulty, `pricing_model`/`regular_price`/`sale_price`, schedule date, category + language taxonomies, tags, requirements, objectives, `is_live_course` (`app/Models/Course.php:18-45`).
- Lesson = **video only**: `video_type` enum (local file, `url`, `youtube`, `vimeo` — widened by `2026_06_24_110947_alter_lessons_table_change_video_type_enum.php`), duration, `is_preview` flag, optional `live_class_id` (`app/Models/Lesson.php:19-31`). No article/PDF/downloadable item type at lesson level.
- Save/update is one nested JSON payload with validation like `topics.*.quizzes.*.time_limit` (`Laravel/app/Http/Requests/StoreCourseRequest.php:80`).
- **AI assist:** `CourseBuilderController::generateDescription()` (line 1331) calls `GeminiService` to generate an HTML course description from the title.
- Draft → submit → admin approve/reject workflow with reasons (`Admin/CourseController.php:approve/reject`, `courses.pending` route; `2025_11_06_171821_add_approval_reason_to_courses_table.php`), soft delete with `deleted_date`, "full delete".

**Progress model**
- `LessonProgress` per user+lesson+enrollment: `is_completed`, `completed_at`, `progress_percentage`, `last_accessed_at` (`app/Models/LessonProgress.php`).
- Course completion = every lesson completed + every quiz passed + every assignment submitted; computed in `CourseTopic::getProgressStats()` (`app/Models/CourseTopic.php:47-79`) and `Student/StudentCourseController::isCourseCompleted()`; auto-flips enrollment to `completed` on view (`StudentCourseController.php:58-62`).
- **Sequential locking:** `isItemAccessible()` (`StudentCourseController.php:957-980`) denies item N+1 until item N complete → built-in drip/completion gating, no config needed.

**Certificates** (`Laravel/app/Http/Controllers/Api/CertificateController.php`, `Student/CertificatesController.php`, `Front/CertificateVerificationController.php`)
- Generated on-the-fly with barryvdh/dompdf (`Pdf::loadView('student.certificate', ...)`, Api/CertificateController.php:105), custom background image base64-embedded, deterministic cert number `CERT-%06d-<md5hash>` (`app/Models/Enrollment.php::getCertificateNumberAttribute`), **public verification** by code (web + API + instructor app), **signed download URLs** (`->middleware('signed')`, api.php:54).

**Quizzes/exams engine** (`app/Models/Quiz.php`, `QuizQuestion.php`, `QuizAttempt.php`, `QuizAttemptAnswer.php`)
- Quiz: passing_score, time_limit, order. Questions: `options` JSON + `correct_answer` **int index** — effectively single-correct MCQ only (`type` defaults `'multiple-choice'` everywhere in CourseBuilderController.php:216,715,724,760,790).
- Attempts record per-answer correctness, score %, passed, time_taken (`Student/StudentCourseController::submitQuiz()` lines 477-537). **Timer not enforced server-side** (started_at=completed_at=now; `time_limit` only rendered to client). Unlimited retakes.

**Assignments** (`app/Models/Assignment.php`, `AssignmentSubmission.php`, + file tables)
- Instructions + attachment files; student submits text+files (`SubmitAssignmentRequest`); instructor grades with `grade` + feedback, statuses incl. STATUS_GRADED (`Instructor/AssignmentsController.php:226-240`).

**Live classes** (`app/Models/LiveClass.php`, `app/Services/LiveClassService.php`)
- Scheduled sessions with external **join_url** (instructor pastes Zoom/Meet/Jitsi link), status machine scheduled→live→ended/cancelled, optional lesson link (flips `lesson.is_live`), uploaded `recording_url`/`recording_video_path`, reminder-minutes platform setting (`2026_06_24_200004_seed_live_class_platform_settings.php`), enrolled-student notifications, start/end endpoints (`routes/api.php:284-285`). **No embedded SDK, no auto-provisioned rooms.**

**Monetization (deep)** — 9 online gateways + offline (`app/Services/PaymentGatewayService.php:22-30`): razorpay, stripe, paystack, flutterwave, paypal, sslcommerz, mollie, bkash, xpay, each with its own verify/callback route pair (`routes/api.php:96-102,131`, `routes/web.php:62-72`) and per-gateway credential columns in `payments` (8 migrations). Plus:
- **Courses** priced free/paid with sale price; **bundles** (`Bundle.php`, `BundleCourse.php`, `BundleEnrollment.php`) with bundle checkout that fan-outs enrollment activation via `Enrollment::booted()` observer (`app/Models/Enrollment.php:26-64`).
- **Subscription plans** (monthly/quarterly/half_yearly/yearly/lifetime, course_limit, features JSON) mapping plans→courses and plans→bundles (`2026_08_05_080314_create_subscription_system_tables.php`); "Netflix mode" enroll-via-subscription per course.
- **Coupons** (% or fixed, validity window, usage limit, course-scoped, instructor-owned) + usage ledger (`Coupon.php`, `CouponService.php`).
- **Instructor marketplace payouts:** revenue share fixed/percentage (`RevenueShareService.php`), instructor `balance` on users, withdrawal requests + admin approval (`InstructorWithdrawal.php`, `Admin/WithdrawalController.php`), earnings + subscription-sales dashboards.
- **Offline payments** with instructions + admin approve queue (`payments/offline-pending`).

**Marketplace/community/social**
- Instructor approval pipeline (`/become-instructor`, `Admin/InstructorController.php:approve/reject`), public instructor directory + profiles (`Front/InstructorController.php`, `routes/web.php:46-49`).
- **Reviews + moderation + instructor replies** (`Review.php`, `ReviewReply.php`, avg rating computed on Course).
- **Course discussions** (threaded Q&A per course): questions, replies, likes on both, instructor pin/announcement toggles, repository+service layer (`CourseDiscussionRepository.php`, `2026_06_24_081355_create_course_discussions_tables.php`).
- **Platform-wide Community Q&A**: questions with tags/views, answers, up/down morphic votes, accepted-answer (`CommunityQuestion/Answer/Vote.php`).
- **1:1 chat** student↔instructor with request/accept/decline gate, attachments, unread counts, **polling** (no websockets) (`Conversation.php`, `ChatMessage.php`, `ChatService.php`, api.php:144-153).

**Engagement extras**
- **AI chat tutor** per student with persisted history (`AiChatMessage.php`, `Student/AiChatController.php`, Gemini, last-10-message context).
- **Focus/pomodoro timer** (`FocusSession.php`) and **habit tracker** with weekly targets + logs (`Habit.php`, `HabitLog.php`) — standalone student self-regulation tools, no LMS coupling.
- **Events** with speakers/highlights/bookings/tickets/QR verify/export/email (`Event.php`, `EventBooking.php`, `EventHighlight.php`, `EventSpeaker.php`).
- **Blog** with categories/comments, custom pages, menu builder, banners, FAQ, testimonials, newsletter, marquee, SEO, theme upload (`Admin/FrontendSettingController.php` — 12 route groups), **full i18n language manager** with runtime translation editing (`LanguageManagerService.php`, `admin/languages/translations.blade.php`).
- Admin: impersonate student/instructor (`Admin/ImpersonationController.php`), reports dashboard, quiz-attempt & submission browsers, **in-app updater** (`Admin/UpdaterController.php`), system maintenance (cache/logs/storage), codecanyon-style **installer wizard** (`Setup/` 7 controllers, `routes/install.php`), license middleware (`routes/admin.php:42`), cron-via-URL (`routes/web.php:118`).

**Model catalogue by domain** (`Laravel/app/Models/`, 60 files):
- Learning: `Course`, `CourseTopic`, `Lesson`, `LessonProgress`, `Quiz`, `QuizQuestion`, `QuizAttempt`, `QuizAttemptAnswer`, `Assignment`, `AssignmentFile`, `AssignmentSubmission`, `AssignmentSubmissionFile`, `LiveClass`
- Commerce: `Payment`, `PaymentGatewaySetting`, `Enrollment`, `Bundle`, `BundleCourse`, `BundleEnrollment`, `Coupon`, `CouponUsage`, `SubscriptionPlan`, `UserSubscription`, `InstructorWithdrawal`
- Social: `Review`, `ReviewReply`, `CourseDiscussion`, `CourseDiscussionReply`, `CourseDiscussionLike`, `CourseDiscussionReplyLike`, `CommunityQuestion`, `CommunityAnswer`, `CommunityVote`, `Conversation`, `ChatMessage`, `ChatAttachment`
- Engagement: `AiChatMessage`, `FocusSession`, `Habit`, `HabitLog`, `Event`, `EventBooking`, `EventHighlight`, `EventSpeaker`
- Platform/CMS: `User`, `CourseCategory`, `CourseLanguage`, `BlogPost`, `BlogCategory`, `BlogComment`, `Banner`, `Menu`, `MenuItem`, `CustomPage`, `FrontendSetting`, `PlatformSetting`, `NewsletterSubscriber`, `UserNotificationSetting`, `AccountDeletionRequest`, `AdminNotificationHistory`

**Migrations group into 9 waves** (see filenames in `Laravel/database/migrations/`): L11-2025 core learning (courses→quiz attempts), payments per-gateway columns (6 separate migrations, Stripe→Mollie→bKash→XPay), marketplace economics (balances, commission, withdrawals), CMS/frontend, notifications, wellbeing (focus/habits), community, AI chat, chat/conversations, bundles, coupons, discussions+live classes (v1.3-era), and the v2.0 subscription system.

**Controllers by role** (`Laravel/app/Http/Controllers/`): `Admin/` 39 (includes `ImpersonationController`, `UpdaterController`, `SystemMaintenanceController`, `PaymentGatewayController`), `Api/` 18 + `Api/Instructor/` 13 (mirror of instructor web for mobile), `Front/` 17 (marketing + enrollment), `Instructor/` 21, `Student/` 17, `Auth/` 5, `Setup/` 7 (installer wizard steps).

### 1.4 Flutter app — headline counts

- 144 dart files; **67 screens** under `Eduex Flutter/lib/screens/` (one student-facing app; instructor API exists in backend but **no instructor mobile app shipped** — `lib/screens/instructor/` contains only `all_instructors_screen.dart` + `instructor_profile_screen.dart` for student-side browsing).
- Architecture: provider + ChangeNotifier (9 providers, `lib/config/app_providers.dart`), hand-rolled services (21 in `lib/services/`), named routes in `lib/router/app_router.dart` (32 named routes, protected-route guard list), models 26 in `lib/models/`.
- Key dependencies (`Eduex Flutter/pubspec.yaml`): `youtube_player_flutter`, `video_player`, `vimeo_video_player`, `chewie`, `razorpay_flutter`, `flutter_sslcommerz`, `flutter_stripe`, `mollie_flutter` (git), `webview_flutter`, `no_screenshot`, `share_plus`, `flutter_localizations` + `l10n/` (en, bn), `shimmer` skeletons, `file_picker`, `open_filex`, `http` + polling.
- **Conspicuously absent:** `firebase_messaging`/any push SDK, `flutter_downloader`/`hive`/`sqflite` (no offline), `jitsi_meet` (live classes open externally), any socket/WS package (chat is HTTP poll).

### 1.5 Flutter screen inventory by area

| Area | Screens (files under `Eduex Flutter/lib/screens/`) |
|---|---|
| Entry | `splash/splash_screen.dart`, `splash_wrapper.dart`, `onboarding/onboarding_screen.dart`, `auth/auth_screen.dart`, `auth/otp_verification_screen.dart`, `auth/forgot_password_screen.dart`, `auth/reset_password_screen.dart` |
| Discovery | `home/home_screen.dart` + `home2_screen.dart` (two switchable homepage layouts), `courses/courses_screen.dart`, `categories/*`, `category_detail/*`, `instructor/*`, `bundles/*` (3), `wishlist/wishlist_screen.dart` |
| Course detail | `course_detail/course_detail_screen.dart` (2,105 lines), `checkout_screen.dart`, `offline_payment_screen.dart`, `enrollment_success_screen.dart`, skeleton loaders |
| Learning | `course_access/course_access_screen.dart` (751 lines, video player + sidebar), `course_access/quiz_attempt_screen.dart`, `course_access/assignment_submit_screen.dart`, `course_access/course_discussion_detail_screen.dart` + `widgets/course_discussion_tab.dart` |
| Dashboard | `dashboard/dashboard_screen.dart`, `my_courses_screen.dart`, `my_assignments_screen.dart` + `assignment_detail_screen.dart`, `my_quiz_attempts_screen.dart`, `certificates_screen.dart` + `certificate_view_screen.dart` + `certificate_verification_screen.dart`, `payments_screen.dart`, `my_ticket_bookings_screen.dart` + `ticket_view_screen.dart` |
| Social | `chat/conversations_screen.dart`, `chat/chat_screen.dart`, `community/qa_room_screen.dart`, `community/question_detail_screen.dart`, `notifications/notifications_screen.dart` |
| AI | `ai_chat/ai_chat_screen.dart`, `ai_suggestions/ai_suggestions_screen.dart`, `ai_learning_path/ai_learning_path_screen.dart` (last two have **no backend** — zero HTTP calls, mock data) |
| Wellness | `study_timer/pomodoro_timer_screen.dart`, `study_timer/focus_progress_screen.dart`, `study_timer/task_breakdown_screen.dart`, `habit_tracker/weekly_review_screen.dart` |
| Money | `subscriptions/subscriptions_screen.dart`, `subscription_checkout_screen.dart`, `offline_subscription_payment_screen.dart`, `profile/my_subscription_screen.dart`, `profile/payment_history_screen.dart`, `profile/payment_detail_screen.dart` |
| Events | `events/events_screen.dart`, `event_detail_screen.dart`, `ticket_booking_screen.dart`, `payment_screen.dart`, `booking_confirmation_screen.dart` |
| Profile | `profile/profile_screen.dart`, `edit_profile_screen.dart`, `change_password_screen.dart`, `settings_screen.dart`, `notification_settings_screen.dart`, `privacy_terms_screen.dart`, `rate_app_sheet.dart`, `share_app_sheet.dart`, `common/webview_screen.dart` |

---

## 2. LMS DEPTH (feature-by-feature verdicts)

### 2.1 Course authoring UX — STRONG
Single-page builder (`Instructor/CourseBuilderController.php` + `resources/views/instructor/course-builder.blade.php`): one nested payload creates course + topics + lessons + quizzes + questions + assignments + attachments atomically (DB transaction, `store()` line 84). Rich per-course metadata (objectives, requirements, tags, difficulty, language, category), intro video, preview lessons (`is_preview`), max-students caps, public/private, scheduled publish, is_live_course mode. Admin approval workflow with reasons. **Weak spots:** lesson content is video-only (no article/PDF/audio lesson types — confirmed `app/Models/Lesson.php:19-31` fillable list); no lesson-level rich text; no bulk import/CSV; no cloning/duplication of courses.

### 2.2 Progress tracking — SOLID, simple
Per-lesson LessonProgress rows + quiz `passed` + assignment `submitted` rolled up per topic (`CourseTopic::getProgressStats()`) and per course; sequential unlocking is enforced server-side (`StudentCourseController::isItemAccessible()`, lines 957-980) with a clean "locked" JSON response (line 209-215) that the app surfaces. **Weak spots:** no video watch-position tracking (LessonProgress `progress_percentage` exists but updateProgress is only driven by client calls), no time-spent analytics, no instructor-side per-student progress drill-down UI (only enrollment status lists).

### 2.3 Certificates — STRONG (best-in-class for codecanyon)
DomPDF generation, template with background, deterministic verification code, **public verification page** (`routes/web.php:14` verify-certificate) + API + signed download URLs (`api.php:54` middleware `signed`). Certificates listed per completed enrollment, downloadable from web and app (`dashboard/certificate_view_screen.dart`).

### 2.4 Live classes — SHALLOW but integrated
It's a scheduler around a pasted `join_url` (`app/Services/LiveClassService.php::schedule`), with status transitions, lesson linking, recordings (URL or uploaded file streamed via `Api/FileController::stream`), reminders, enrolled-student notifications, and both web + app surfaces (banner + sidebar entries). No embedded meeting (no Jitsi SDK/Zoom SDK), no attendance capture, no analytics.

### 2.5 Quizzes/exams — THIN engine
MCQ-only (single correct int index, `app/Models/QuizQuestion.php`), auto-graded percent, passing score, per-answer review results view (`prepareQuizResultsData`). **No** multi-select, true/false as distinct type, essay/manual grading, question bank reuse, randomized order, negative marking, attempt limits, **server-enforced timer** (client-rendered only). Time limit + passing score are the only config knobs.

### 2.6 Assignments — ADEQUATE
Files + instructions out, files + text in, instructor grade/feedback with status flow; assignment browser per instructor (`Instructor/AssignmentsController.php`), admin-level submission browser. No rubrics, no due dates (!), no resubmission rules, no late flags — `Assignment.php:19-31` has no `due_date` column.

### 2.7 Q&A/discussions — STRONG (two layers)
(1) Per-course discussions: threads, replies, likes, instructor **pin + announcement** flags, deletion rights; full repository/service separation. (2) Community Q&A room: tags, views, up/down votes, accepted answers, moderation by asker. Plus 1:1 gated chat with attachments. This trio is the richest "social learning" surface in this product class.

### 2.8 Notes/announcements
Course discussion announcements (pinned instructor posts) + email notification prefs + notifications center (`Api/NotificationController.php`, `Admin/NotificationController.php` with resend). No per-lesson note-taking feature anywhere.

### 2.9 Monetization — VERY STRONG (the product's center of gravity)
10 gateways incl. regional SSLCOMMERZ/bKash (Bangladesh), xpay; **three monetization models** (one-off course, bundles, subscription plans with course limits); coupons with scopes; instructor marketplace with commission config (`revenue.distribution` fixed/percentage in `RevenueShareService.php`), balances, withdrawals, earnings analytics; offline/manual payments with admin approval; payment receipts download (`api.php:110`).

### 2.10 Ratings/wishlists/gamification
Reviews 1-5 with moderation + instructor replies + avg rating appended on Course (`app/Models/Course.php:173-185`). Wishlist is **client-only SharedPreferences** (`Eduex Flutter/lib/services/wishlist_service.dart` — no backend table; device-local, lost on reinstall). Gamification is **absent** in the LMS proper; the closest is the separate pomodoro/habit tracker (no points/badges/leaderboards).

### 2.11 Offline/AI
- Offline video: **none**. All video streams over HTTP (`Api/FileController::stream` is a raw `BinaryFileResponse` — no HLS/DASH, no signed expiring URLs, no range hardening, and the path is accepted as a query param → path-traversal surface; lines 15-43).
- AI: Gemini chat tutor with history persistence (`Student/AiChatController.php`), one-shot course-description generation (`CourseBuilderController::generateDescription()`). The marketing "AI learning path" and "AI suggestions" app screens are UI-only mocks (no backend routes; verified zero HTTP references in `lib/screens/ai_suggestions/ai_suggestions_screen.dart` and no `suggestions|learning_path` in `routes/api.php`).

### 2.12 Checkout & enrollment state machine
- Enrollment lifecycle: `pending → approved → completed | cancelled` (`app/Models/Enrollment.php` constants); only `approved|completed` grants learning access (`StudentCourseController::show()` line 46-49).
- One `Payment` row carries gateway-specific columns (Stripe intent ids, PayPal order ids, SSLCommerz val_id, bKash payment id, XPay tx id) and a `coupon` set of columns (`2026_06_24_000003_add_coupon_fields_to_payments_table.php`), plus commission breakdown persisted in `payments.notes` as JSON for audit (`RevenueShareService.php` header comment).
- Every gateway follows the same contract: create → redirect/SDK → `verify` API (app) or `callback` route (web) → enrollment approve → revenue share → notifications. Adding gateway #11 means adding a column migration + 2 routes + 1 verify method — a pattern, not a framework.
- Enrollment approvals (offline path) are manual: `Admin/EnrollmentController::approve/reject/cancel/complete` (`routes/admin.php:125-133`).

### 2.13 Notifications & email layer
- DB notifications + per-user channel preferences (`UserNotificationSetting.php`, `Api/ProfileController::getNotificationSettings`), queued mails (`app/Mail/` incl. `CourseUpdatedMail` broadcast to enrolled students on course update — `CourseBuilderController::notifyCourseUpdate()` line 1194), admin notification history with resend (`Admin/NotificationController::resend`), OTP mails (`OtpService.php`), live-class schedule notifications (`App\Notifications\LiveClassNotification`).
- All email templates in `resources/views/emails/`; SMTP configurable at runtime (`SmtpConfigurator.php`) — relevant because schools rarely control their server's mail stack.

### 2.14 Admin control surface (why competitors feel "complete")
18 settings panels (`routes/admin.php:45-102`): platform, AI (Gemini key/model), email templates, SMTP, account-deletion policy, course policies (auto-approve toggles), branding, chat on/off, contact, authentication (OTP/2FA), reCAPTCHA, revenue share, withdrawals, support/custom-scripts, cron, **live-class** (enable + reminder minutes), gateway matrix, plus language manager with runtime key editing. For a buyer, this surface is the product; ASchool's equivalent is spread across plugin settings pages and is thinner per-feature.


---

## 3. FLUTTER APP (UX patterns detail)

### 3.1 Course player (`lib/screens/course_access/course_access_screen.dart`)
- **One scaffold, three content modes**: lesson video / quiz / assignment rendered in the same shell with a curriculum sidebar; `current_item` from API resumes where the student left off (API-driven resume, `initState` → `_fetchCourseCurriculum()` lines 76-107).
- **Anti-piracy UX:** `NoScreenshot.instance.screenshotOff()` on entering the player and `screenshotOn()` on dispose (lines 43-53) — screenshots + screen recording blocked on the learning screen.
- **Multi-source player switching** in one screen: YouTube (`YoutubePlayerBuilder` line 347), Vimeo (`VimeoVideoPlayer` line 725), native file/URL via `video_player`+`chewie` (line 729) — picked from `video.video_type`.
- Live class inside player: lesson shows LIVE badge and Join button launching `join_url` externally (lines 696-701); recordings fall back to `recording_url` → same button.

### 3.2 Payments in-app
Gateway-native SDKs for Razorpay (`razorpay_flutter`), Stripe (`flutter_stripe`), SSLCOMMERZ (`flutter_sslcommerz`), Mollie (`mollie_flutter`), each with a `/payments/*/verify` API round-trip (`routes/api.php:96-102`); bKash/xpay/paystack/flutterwave/paypal via webview fallback (`common/webview_screen.dart`); **offline payment screen** with instructions (`course_detail/offline_payment_screen.dart`, `subscriptions/offline_subscription_payment_screen.dart`).

### 3.3 Push, offline, chat
- **No push notifications at all** — in-app notifications list polls `/api/notifications`. For an LMS whose engagement loops (live class starting, assignment graded, new reply) are time-sensitive, this is the single biggest mobile gap.
- **No downloads/offline mode**; no local DB beyond `SharedPreferences` (auth token, settings, wishlist).
- Chat = `GET /messages/{id}/poll` on a timer (`api.php:152`); attachments supported.
- i18n: `lib/l10n/` with `lang_en.dart`, `lang_bn.dart` (Bengali) — language switch in settings.

### 3.4 Misc patterns worth noting
Two homepage layouts switchable by config (`lib/config/config.dart` `HomePageType`), shimmer skeleton loading on every list (`*_skeletons.dart` files), ticket QR + verification screens, certificate verification from within the app, event booking with QR ticket (`dashboard/ticket_view_screen.dart`), payment receipt download.

### 3.5 Information architecture (student app)
Bottom navigation (`lib/widgets/bottom_nav_bar.dart`) is **Home / Courses / Dashboard / Community(Q&A) / Profile**, with everything else pushed as named routes from `app_router.dart`. Learning content lives one tap deep from either My Courses or Home's "continue learning" strip. Certificate verification and wishlist are reachable from Profile rather than the nav — i.e., the IA is learning-first, account-second; our student app buries courses two levels under subject/class trees (`ASchool/flutter_student/lib/features/` — lms is one of 24 feature folders).

### 3.6 Role coverage verdict
- Student: complete journey — browse → wishlist (local) → checkout (3 native gateways + webview fallbacks + offline) → learn (resume, locked items) → quiz/assignment → certificate → review → discuss → chat instructor → verify cert → events. Nothing major missing for a D2C learner.
- Instructor: **web-only** (full panel), despite the API shipping a complete instructor surface (`Api/Instructor/*` 13 controllers) clearly built for a second app that was never included in the package — wasted API surface from our point of view, but a free blueprint if ASchool ever needs a teacher LMS app.
- Parent/admin: none mobile.

---

## 4. UI/UX PATTERNS WORTH STEALING FOR ASCHOOL

1. **Sequential curriculum locking with server authority** (`Student/StudentCourseController.php:957-980`): curriculum API returns `is_accessible` per item and a specific `locked` error; the client never has to guess. Directly transplantable into `ASchool/backend/app/api/v1/lms.py` course-detail payload.
2. **"Resume where you left off"**: `current_item` + `current_item_type` in the learn payload (`StudentCourseController::show()` lines 79-80) — our `StudentProgress.last_position_secs` already stores better data but nothing composes it into a next-up item.
3. **Completion page → certificate moment**: `courses/{id}/completion` + auto certificate (`routes/student.php:49-50`) — finishing a course should always end in a celebratory screen with the artifact, not a dead list.
4. **Public certificate verification by code** (`Front/CertificateVerificationController.php`, `/verify-certificate`): employer-verifiable certificates; cheap to add, high credibility for Nepal job-seeking students.
5. **Anti-screenshot on paid content** (`no_screenshot` in the player, `course_access_screen.dart:43-53`): one-line addition to our Flutter course player; also motivates HLS/signed URLs.
6. **Discussion announcements/pins** (`routes/api.php:271-272` togglePin/toggleAnnouncement): teacher broadcast inside course Q&A — maps perfectly to our notices plugin but scoped per course.
7. **Offline/manual payment queue** (`payments/offline-pending` + approve): every Nepal school takes cash/bank-transfer; an instructions screen + admin approve queue is a must-have mirror of our fees plugin for any future paid LMS.
8. **Wishlist** (client-side at minimum): cheap retention signal for older students browsing courses; our student portal has nothing equivalent today.
9. **Dual homepage layouts + theme upload** (`Admin/FrontendSettingController.php` theme routes): white-label-friendly; we already have white_label plugin — a per-tenant "choose homepage composition" lever is a natural extension.
10. **In-app updater + installer wizard** (`Admin/UpdaterController.php`, `Setup/`): self-hosted appeal; low priority for our SaaS but the version-stamp-in-DB pattern (`2026_03_28_105315_add_initial_system_version_to_platform_settings.php`) is worth copying for plugin schema migrations (`schema_version` in manifests).
11. **Skeleton loaders + two home layouts** in Flutter (`courses_skeletons.dart`, `home2_screen.dart`) — perceived-performance polish our 5 Flutter apps can adopt in `aschool_shared`.
12. **Event tickets with QR verification** (`Api/Instructor/EventController::verifyTicket`) — reusable for school events/parent-teacher meetings.
13. **OTP login as first-class flow** (`routes/api.php:34-39` verify/resend; `OtpService.php`): phone-first auth matters in Nepal where email adoption among parents is low; our auth already has phone fields but the OTP UX contract (verify + resend endpoints) is a good reference.
14. **In-course content search API** (`routes/student.php:50` `courses/{courseId}/search`): students searching inside a course's lessons/quizzes/assignments — trivial query, big usability win for exam-revision use cases (SEE/NEB past-paper style study).

---

## 5. WHAT ASCHOOL's LMS LACKS (gaps vs EduEx, with evidence)

Scoring ASchool's current LMS surface: `ASchool/backend/app/api/v1/lms.py` = 612 lines / **20 endpoints**; `ASchool/backend/app/models/lms.py` = 9 models (Course, Lesson, Topic, StudyMaterial, LiveClass, StudentProgress, Quiz, QuizAttempt, Enrollment); the lms plugin manifest promises "course builder, AI adaptive learning paths, student watch analytics" (`ASchool/backend/app/plugins/modules/lms/manifest.yaml`) but the code delivers a fraction.

| # | Gap | EduEx evidence | ASchool evidence | Severity |
|---|---|---|---|---|
| 1 | **No certificates at all** | DomPDF + verification + signed URLs (`Api/CertificateController.php`) | zero `certificate` hits in `app/models/lms.py` or `app/api/v1/lms.py` | HIGH — biggest visible feature gap |
| 2 | **No monetization of LMS content** | 10 gateways, courses/bundles/subscriptions/coupons/payouts (§2.9) | courses are class-bound free content; only fees plugin handles money (`app/services/payments/esewa_gateway.py`, `khalti_gateway.py` exist but unconnected to LMS) | HIGH for tuition/coaching revenue; LOW if LMS is a bundle-in |
| 3 | **No discussions/Q&A per course** | threads+likes+pins (`2026_06_24_081355_create_course_discussions_tables.php`) | nothing in `models/lms.py`; only global `notices` plugin | HIGH for engagement |
| 4 | **No ratings/reviews** | `Review.php` + moderation + replies | absent | MEDIUM |
| 5 | **Quiz engine too thin** | even EduEx's MCQ engine beats ours: no question-bank reuse, no per-question config | `Quiz.questions` is one JSONB blob with no attempt limit, no passing score, no per-question marks in API (`api/v1/lms.py:312-336` attempt endpoint) — note our separate exams+question-bank plugin already has the hard parts; LMS quizzes should reuse it | HIGH but cheap via reuse |
| 6 | **No sequential/drip unlocking** | `isItemAccessible()` server-enforced chain | `lms.py` progress endpoints have no gating concept | MEDIUM |
| 7 | **No resume/next-up composition** | `current_item` in learn payload | `StudentProgress.last_position_secs` exists (`models/lms.py:129`) but unused by API | LOW (data already there) |
| 8 | **No preview lessons / public catalog** | `is_preview`, intro video, public course pages + instructor directory | all `/courses` routes are `@jwt_required` + `@school_required` (`api/v1/lms.py:29-32`) — fine for a school, but no course "storefront" even for prospective parents | LOW-MEDIUM |
| 9 | **No offline/downloads, no streaming hardening** | EduEx also fails here (raw BinaryFileResponse) — mutual gap | `ASchool/app/services/lms/video_service.py` handles Jitsi rooms only; no VOD pipeline | OPPORTUNITY to leapfrog with HLS |
| 10 | **No push notifications for LMS events** | EduEx lacks push too, but emits email + in-app for live-class schedule/changes (`LiveClassService::notifyEnrolledStudents`) | manifest emits `lms.class_started/ended/course_completed` events but consumers are thin | MEDIUM (we have sms/whatsapp plugins to exploit) |
| 11 | **No instructor earnings/marketplace** | payouts, withdrawals, commission (`RevenueShareService.php`) | out of scope for school SaaS — correctly skipped | N/A (deliberate) |
| 12 | **Course authoring UX in portals** | 1,372-line builder saving nested curriculum in one call | `create_course`/`create_lesson` are flat REST calls; no nested-save, no reorder endpoints for lessons/topics/materials (`api/v1/lms.py` has PUT only for lessons) | MEDIUM — teacher UX |
| 13 | **AI learning surfaces are vaporware in EduEx; ours are real but unconnected** | mock screens (`ai_suggestions_screen.dart` has no backend) | we have real `ai_adaptive_learning` + `ai_suite` (17 tool routes in `api/v1/ai_tools.py`) but `lms.py` never calls them — the promised "AI adaptive learning paths" in our manifest is unimplemented in LMS code | HIGH-VALUE differentiator if wired |

Also note: EduEx has **no due dates on assignments** — ASchool's assignments plugin already beats it there (`ASchool/backend/app/api/v1/assignments.py:262-314` grading + `ai-grade` endpoint at line 316, which EduEx lacks entirely).

### 5.1 Flow-level comparison (student "take a course" journey)

| Step | EduEx | ASchool today |
|---|---|---|
| Find course | Public catalog w/ search, rating filter, category/language, bundles, wishlist (`routes/web.php:60-64`, `Front/CoursesController::index` filters) | Courses only visible inside portal after login (`@jwt_required @school_required` on every route, `api/v1/lms.py:29-32`) |
| Enroll | Paid (10 gateways) / free / subscription / coupon / bundle fan-out | Enroll endpoint exists (`api/v1/lms.py:337`) but no payment path |
| Learn | Resume + sequential lock + sidebar progress + live banner + in-course search API | Lesson list + study materials + progress POST (`api/v1/lms.py:390`); no locking, no resume composition |
| Assess | Quiz (auto-graded MCQ, results view) + assignment (file submit, graded) | Quiz attempt + score only; assignments plugin is actually richer (due dates + AI grade) but lives in a separate plugin, not in the course flow |
| Get credit | Certificate with public verification | Nothing |
| Interact | Discussions, likes, pins, announcements, 1:1 chat, community Q&A | None inside LMS (notices plugin is school-wide) |
| Stay engaged | Notifications, emails, pomodoro/habits, events | Gamification plugin exists but not wired to LMS completion |

### 5.2 Where EduEx is a warning, not a benchmark
- **Per-gateway payment columns** (8 migrations mutating `payments`) don't scale — keep gateway config in a JSON settings row like our fees plugin, not columns.
- **Client-trusted quiz timer and completion auto-flip on GET** (`StudentCourseController::show()` mutating enrollment on read, line 58-62) — side effects in GET handlers; we should do completion on explicit progress POST only.
- **Raw path-param streaming** (`Api/FileController::stream`) — see §7.6.
- **Two extractions of the same zip in the package** and `dashboard_old.blade.php` leftovers show ship hygiene we should avoid.


---

## 6. WHAT ASCHOOL DOES BETTER

1. **Whole-school context beats standalone LMS.** EduEx's "class" is a course buyer list; ASchool ties `Course.subject_id/class_id/section` to real academic structure (`ASchool/backend/app/models/lms.py:26-28`) and the LMS plugin declares `depends_on: [attendance, academics]` with event wiring (`lms.listens: attendance.marked`) — EduEx has nothing equivalent.
2. **Live classes actually provisioned.** Our `VideoService.create_live_class()` auto-generates a Jitsi room per session (`ASchool/backend/app/services/lms/video_service.py:19-21`) vs EduEx's manual paste-a-link (`app/Services/LiveClassService.php`).
3. **50+ plugin breadth:** exams + question bank (which EduEx's quiz engine only gestures at), fees with eSewa/Khalti/Fonepay (`app/services/payments/`), gamification (badges/points/leaderboards/houses — `api/v1/gamification.py`), elibrary (DigitalBook/PastPaper/OER — `models/digital_content.py`), iemis_importer, nepal_curriculum, timetable, transport, health_records, etc. EduEx compensates with events/blog/marketing pages — content-site breadth, not school breadth.
4. **Nepal stack is unique:** BS dates (`aschool_shared/lib/widgets/bs_date_field.dart`, `nepali_date_display.dart`), iEMIS import plugin, SEE/NEB curriculum alignment, eSewa/Khalti/Fonepay rails. EduEx's "regional" gateways are Bangladesh-centric (bKash, SSLCOMMERZ) and irrelevant here; its date handling is Gregorian-only.
5. **Real AI, 17+ tool routes** (`api/v1/ai_tools.py`) + ai-grade for assignments (`assignments.py:316`) + ai_tutor + adaptive_learning — versus EduEx's one Gemini chat endpoint and mock suggestion screens. We just need to connect it to the LMS surface.
6. **Multi-tenancy & roles.** EduEx is single-tenant with 3 global roles (`role:admin` middleware, `routes/admin.php:42`); every ASchool model inherits `SchoolModel` with school scoping and `@school_required`/`@plugin_required` guards — a fundamentally harder architecture already solved.
7. **Parent visibility.** ASchool has parent_app/parent portals and per-role manifest tabs (including "Child's Courses / Watch History" in the lms manifest); EduEx has no parent concept at all.
8. **Assignment grading depth:** rubric-free but includes an **AI grade endpoint** (`ASchool .../assignments.py:316`) and due-date semantics absent in EduEx.

---

## 7. ORGANIZATION LESSONS — what our lms plugin should become

EduEx proves the ceiling of a course-commerce LMS in ~90 migrations / 148 controllers. The lesson for ASchool is not "add everything" but **carve the lms plugin into bounded sub-modules** so growth doesn't rot the 612-line `api/v1/lms.py`:

1. **Split into 5 internal modules** (mirroring EduEx's clean seams, one table-cluster each), all under `app/plugins/modules/lms/` with sub-manifests or capability groups:
   - **courses/** — Course, Topic (fix inversion: today `Topic.lesson_id` hangs topics under lessons, backwards vs EduEx's Course→Topic→Item — `ASchool/models/lms.py:63-73`), Lesson with `content_type` already in schema (video/text/quiz/assignment — `models/lms.py:47-48`); add reorder + nested-save endpoint.
   - **progress/** — StudentProgress + resume/next-up composition + sequential gating service; feed watch-time into analytics.
   - **assessments/** — Quiz/QuizAttempt *delegating to the exams question bank* instead of JSONB blobs; attempt limits + passing score + server timer.
   - **certificates/** — new model (template, issued cert, verification code), DomPDF-equivalent in Python (weasyprint/reportlab), public verify route; event `lms.course_completed` (already emitted in manifest) becomes the trigger.
   - **commerce/** (optional, later) — paid course/subscription tables; do NOT build gateways, reuse `fees` plugin rails (eSewa/Khalti) via the existing payments service.
2. **Copy the event-driven glue pattern:** EduEx's `Enrollment::booted()` observer auto-activating bundle enrollments (`app/Models/Enrollment.php:26-64`) is a clean example of cross-aggregate reactions we should express through our plugin event bus (`emits/listens` in manifests) rather than model boot hooks.
3. **Keep the sequential-lock + resume API contract** from §4.1-4.2 — it is the cheapest big UX win and defines a stable contract for all 5 Flutter apps + Next.js web.
4. **Fix the lms manifest's promises-or-code mismatch:** "AI adaptive learning paths" and "student watch analytics" are advertised (`plugins/modules/lms/manifest.yaml` description) but unimplemented in `api/v1/lms.py`; either wire `ai_adaptive_learning` into course detail (recommended — it's our differentiator vs EduEx's fake AI screens) or drop the copy.
5. **Port the 3 best engagement loops, skip the rest:** discussions-with-pins, certificate verification, wishlist. Skip instructor marketplace/payouts (wrong business model for schools), events/blog/marketing-site features (our website_builder covers it), and the pomodoro/habit app (our gamification plugin subsumes it).
6. **Team-wide warning:** EduEx's `Api/FileController::stream` accepting `?path=` is a live path-traversal defect; when we build VOD streaming, sign URLs and forbid raw path params from day one.

### 7.1 Suggested module boundaries (target state for `app/plugins/modules/lms/`)

```
lms/
  courses/      Course, Topic(→under Course), Lesson(content_type), StudyMaterial
                API: nested-save authoring endpoint, reorder endpoints, preview flags
  progress/     StudentProgress + ResumeService(current_item) + SequencingService(is_accessible)
                emits lms.lesson_completed, lms.course_completed (already declared)
  assessments/  thin Quiz adapter delegating item storage to exams question bank
                attempt policy: max_attempts, passing_score, server timer
  certificates/ CertificateTemplate, IssuedCertificate(verification_code)
                public /verify route; listens lms.course_completed; PDF render service
  commerce/     (phase 3, optional) PaidCourse price rows reusing fees-plugin gateways
  discussions/  (phase 2) CourseDiscussion, Reply, Like; pin/announcement for teachers
```

### 7.2 Sequencing the work (highest leverage first)

| Phase | Deliverable | Closes gap | Effort |
|---|---|---|---|
| 1a | Resume/next-up + sequential lock on course detail | §5 rows 6,7 | Small (data exists) |
| 1b | Certificates + public verification | §5 row 1 (highest severity) | Medium |
| 1c | Course discussions with pin/announcement | §5 row 3 | Medium |
| 2a | Quiz policy (attempts, passing score, timer) via exams question bank | §5 row 5 | Medium |
| 2b | Nested course authoring + reorder for teacher portal | §5 row 12 | Medium |
| 2c | Wire ai_adaptive_learning into course flow; ship real "AI path" | §5 row 13 (differentiator) | Medium |
| 3 | Commerce (paid courses/coupons) on fees rails; offline-pay queue | §5 row 2 | Large, optional |
| 3b | HLS/signed streaming + downloads + no_screenshot in player | §5 row 9 | Large |

### 7.3 What NOT to copy
Instructor payouts/marketplace (wrong for schools), events/blog/marketing CMS (website_builder covers it), pomodoro/habit standalone apps (gamification plugin subsumes), per-gateway payment columns, GET-side-effect completion, and mock AI screens (our AI must be real or absent).

### Bottom line
EduEx v2.0 is a **course-commerce machine with a mediocre learning core** (video-only lessons, MCQ-only quizzes, no push, no offline, mock AI). Its monetization stack, certificates with public verification, discussions, and polished sequential-learning mobile UX are the parts to beat-then-borrow. ASchool loses to it today on **certificates, discussions, authoring UX, and monetization readiness**, and beats it on **live-class provisioning, AI reality, assignment grading, Nepal stack, and architectural ceiling** — a gap closable with one focused lms-plugin iteration (progress+certificates+discussions+nested authoring) without touching our 50-plugin breadth.

---

### Appendix A — verification pointers (for re-audit)
- Identical Laravel copies: `diff -rq Eduex Laravel_x Eduex Laravel_extracted` → empty.
- No-push proof: no `firebase|push|fcm` in `Eduex Flutter/pubspec.yaml`.
- No-offline proof: no `downloader|hive|sqflite|drift` in pubspec; only `SharedPreferences` hits in `lib/`.
- Wishlist local-only: `Eduex Flutter/lib/services/wishlist_service.dart` (SharedPreferences only; no corresponding model/route in Laravel).
- Mock AI screens: zero HTTP calls in `lib/screens/ai_suggestions/ai_suggestions_screen.dart`; no matching routes in `Laravel/routes/api.php`.
- Quiz MCQ-only: `'correct_answer' => 'integer'` cast (`Laravel/app/Models/QuizQuestion.php:27`).
- Timer unenforced: `started_at => now(), completed_at => now()` in `submitQuiz` (`Laravel/app/Http/Controllers/Student/StudentCourseController.php:497-498`).
- ASchool gap baselines: `ASchool/backend/app/api/v1/lms.py` (20 routes), `ASchool/backend/app/models/lms.py` (9 models, no certificate/review/discussion), `ASchool/backend/app/plugins/modules/lms/manifest.yaml`.
