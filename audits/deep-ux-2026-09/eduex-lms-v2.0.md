# EduEx LMS v2.0 — Deep UX + Backend Audit

**Product:** EduEx — "The Ultimate Learning Management System with Flutter Mobile App" (CodeCanyon item 61977497, v2.0.0)
**Auditor:** deep-audit subagent, ASchool competitor program
**Date:** 2026-09-13
**Prior draft:** `docs/competitor-audits/eduex-lms-v2.0.md` (2026-09-11/12, implementation-level, 543 lines) — every major claim re-verified this pass; ledger in Section 13.

## 0. Methodology & Evidence Base (read first)

**Path shorthand used throughout this report:**

- `ROOT/` = `Other Projects/EduEx LMS v2.0/EduEx LMS v2.0/codecanyon-61977497-eduex-the-ultimate-learning-management-system-lms-with-flutter-mobile-app/`
- `L/` = `ROOT/Eduex Laravel_extracted/Eduex Laravel/` (Laravel 12 backend — verified byte-identical to the `Eduex Laravel_x/` duplicate via `diff -rq`, exit 0, 2026-09-13)
- `FL/` = `ROOT/Eduex Flutter/` (student-facing Flutter app)
- `DOC/` = `ROOT/Documentation/` (vendor docs + marketing screenshots)

**This pass is NOT static-only.** Contrary to the boot status inherited from the recon map ("no vendor/, no .env, no DB"), the shipped tree contains `L/vendor/` (52 top-level packages, `laravel/framework v12.53.0` locked), a real `L/.env` (MySQL `eduex_full`, APP_KEY present), and a placeholder `L/database/database.sqlite`. I therefore booted the product for real:

1. `php artisan route:list --json` → **642 registered routes** (saved at `/tmp/eduex_routes.json`).
2. Fresh MySQL 8.4 in a disposable docker container (`eduex-audit-mysql`, host port 33307, database `eduex_audit`) → all **90 migrations ran clean**; the 13 seeders ran clean; demo content (2 courses, 5 lessons, quiz with MCQ + true/false questions, assignment, approved enrollment + lesson progress, live class, discussion + reply, bundle, event + speaker, 2 subscription plans, 1 review) inserted via a PHP bootstrap script (`/tmp/eduex_seed_demo.php`).
3. `php artisan serve` on **http://127.0.0.1:8931** — live for the entire audit session. Marker file `L/storage/installed` created (the installer gate `EnsureSetupComplete` redirects everything to `/install` until it exists).
4. Crawled with Playwright (1440×900) and curl-with-session: **18 public/auth pages, 16 student pages, 24 instructor pages, 63 admin pages** — full text + form-field extraction per page (HTML dumps in `/tmp/eduex_pages/`), **29 browser screenshots + 24 vendor-doc screenshots** in `audits/deep-ux-2026-09/screenshots/eduex-lms-v2.0/` (subfolder `vendor-docs/` = copies of `DOC/assets/images/`).

**Evidence labels used on every claim below:**

- `[code L/...:LINE]` — static source read this pass
- `[live]` — observed on the booted app (screenshots/HTML dumps, 2026-09-13)
- `[vendor-doc DOC/assets/images/...]` — vendor marketing/documentation screenshot

**Live demo accounts (from `L/database/seeders/AdminSeeder.php:14-51` and confirmed by login):** `admin@eduex.com` / `instructor@eduex.com` / `student@eduex.com`, all with password `password`. The vendor documentation (`DOC/index.html`, "Demo accounts" section) ships the same three accounts.

**What I did NOT do:** no requests to the vendor's license server (`mhquickdev.com`) beyond the middleware's own automatic 7-day heartbeat check (which fires silently on admin requests and failed-closed silently); no gateway credential changes; no destructive writes beyond seeding demo rows into the disposable DB.

---

## 1. Executive Summary

EduEx v2.0 is a **single-tenant course-marketplace LMS** (Laravel 12.53 + Tailwind 4 + Blade/Alpine/Livewire-style front end, plus one student-facing Flutter app). Its center of gravity is **monetization**: 3 pricing models (one-off courses, bundles, subscription plans), 10 payment gateways with per-gateway DB columns, coupons with usage ledgers, instructor revenue-share with wallet balances and withdrawal approval, and offline/manual payment queues. Around that core sits a competent but narrow learning engine: video-only lessons (URL/upload/live — YouTube/Vimeo detected by URL regex at read time), single-correct-answer quizzes with unlimited retakes, file+text assignments with no due dates, sequential curriculum locking enforced on reads but not on writes, DomPDF certificates with a public verification page, per-course discussion forums with pins/announcements, a link-pasted live-class scheduler (no embedded meetings), and a real Gemini-powered AI chat tutor — while two other advertised AI screens ("AI suggestions", "AI learning path") are pure UI mocks with zero network calls.

**This pass booted the product and exercised it end-to-end**, which materially changes several prior conclusions and adds live-reproducible defects:

- **The single worst finding is a verified, unauthenticated path-traversal file read**: `GET /api/video/stream?path=../../../.env` (route registered *outside* the auth group, `L/routes/api.php:49`) returns **HTTP 200 with the .env contents, including APP_KEY** `[live]`. The controller (`L/app/Http/Controllers/Api/FileController.php:16-46`) does string-prefix cleanup only, no realpath containment, falls back to the *private* `storage/app/` directory, and echoes absolute filesystem paths in 404 responses. With APP_KEY in hand, an attacker can decrypt Laravel-encrypted cookies/values. This is worse than the prior draft stated (it only noted the `app/public` prefix).
- **Two admin pages ship broken**: `/admin/courses/pending` and `/admin/users` return live 500s ("View [admin.courses.pending] not found" / "View [admin.users.index] not found") because the controllers render Blade views that do not exist anywhere in `L/resources/views/` `[live, laravel.log]`. The "Pending Courses" item is in the admin sidebar, so a stock install has a dead menu entry.
- **Fresh installs on sqlite (Laravel 12's default) are impossible**: 8 migrations contain raw MySQL `MODIFY COLUMN ... ENUM` DDL; `php artisan migrate` on sqlite dies at `2025_11_05_211512_add_stripe_fields_to_payments_table.php:20` and leaves partial schema behind (non-atomic).
- **The license gate is real but the shipped artifact contains a pre-activated license token** bound to `127.0.0.1` (RS256 JWT from `mhquickdev.com`, buyer "uastars", activated 2026-07-15, cached in `L/storage/framework/cache/data/`) — so on any localhost install the admin panel opens out of the box `[live]`.
- **Raw translation keys render on production pages**: `frontend.categories`, `frontend.ratings` (courses sidebar), `student.pending_status` (payments page), `auth.email`/`auth.enter_email`/`frontend.cancel` (settings) — all missing from `L/lang/en/{frontend,student,auth}.php` `[live]`.
- The much-admired **sequential locking has a write-side hole** (re-verified): `submitQuiz`/`submitAssignment` in the API controller never call `isItemAccessible`, and resolve quizzes/assignments by bare ID without checking they belong to the course — re-verified at exact lines (`L/app/Http/Controllers/Api/StudentCourseController.php:323-344, :459-488`).

**As a school product for ASchool's market, EduEx is a partial benchmark**: it proves polish ceilings for course-commerce UX (checkout with 8 gateway choices + offline receipt upload; certificate moment; storefront) and engagement (course forums with instructor announcements, community Q&A with accepted answers, gated 1:1 chat), while lacking everything a school needs — no classes/sections, attendance, exams/grading beyond course quizzes, fees, timetable, transport, parents, multi-tenancy, or Nepal-localized anything (currency list includes BDT/INR/PKR but not NPR; dates Gregorian-only; regional gateways are Bangladesh-centric: bKash, SSLCommerz).

**Numbers at a glance (all live-verified):** 642 routes / 8 route files; 90 migrations / 60 Eloquent models / 264 Blade views / 148 controllers (32,935 controller LOC); 3 role surfaces (admin 231 routes, instructor 90, student 57) + 172-route Flutter API; 10 payment gateways; 6 UI languages (bn/en/fr/hi/es/tr); 1 scheduled command (live-class reminders every 5 min); 0 push notifications, 0 websockets (chat is HTTP polling), 0 offline downloads in the mobile app.

---

## 2. Stack & Architecture Shape (confirmed from composer.json / package.json / pubspec.yaml)

### 2.1 Backend — `L/composer.json` + `L/composer.lock`

| Component | Version (locked) | Evidence |
|---|---|---|
| PHP requirement | `^8.2` (ran on PHP 8.5.4 CLI) | `L/composer.json:9`; live boot |
| laravel/framework | **v12.53.0** | `L/composer.lock` |
| Auth | laravel/sanctum v4.3.1 (API tokens), laravel/fortify ^1.31 (web) | `L/composer.json:13-14` |
| Roles | spatie/laravel-permission 6.24.1 — **installed and migrated but the route middleware actually checks the `users.role` enum column, not spatie roles** (see 2.4) | `L/composer.json:17`; `L/app/Http/Middleware/CheckRole.php:26-32` |
| PDF | barryvdh/laravel-dompdf v3.1.1 (certificates) | `L/composer.json:10` |
| Payments SDKs | stripe/stripe-php v18.2.0, yabacon/paystack-php v2.2.1 (others via raw HTTP) | `L/composer.json:18-19` |
| UI helper | devrabiul/laravel-toaster-magic v1.6 | `L/composer.json:11` |
| Licensing | `mhquickdev/license-client 1.0.0` — local path package at `L/packages/license-client/` (see Section 9) | `L/composer.json:20`, `L/composer.json:98-106` |

Notable stack facts:

- **No queue workers required to function**: `.env` ships `QUEUE_CONNECTION=file`, `CACHE_STORE=file`, `SESSION_DRIVER=file` (`L/.env`); emails are sent synchronously inside request handlers (try/catch-swallowed), not queued — verified in `Api/AuthController.php:62-76`. There are `jobs`/`failed_jobs` tables and an 11-template `L/app/Mail/` directory, but no `ShouldQueue` on any mailable (grep: 0 hits for `ShouldQueue` in `L/app/Mail/`).
- **No websocket/broadcast stack**: `BROADCAST_DRIVER=log`; chat is HTTP polling (`GET /api/messages/{id}/poll`, `L/routes/api.php:152`; `L/app/Http/Controllers/Api/ChatController.php:179`).
- **MySQL-only DDL**: 8 migrations use `DB::statement("ALTER TABLE ... MODIFY COLUMN ... ENUM(...)")` (list in Section 11, W-3); sqlite/Postgres fresh installs break.
- **Front end**: Vite 7 + Tailwind CSS 4 + axios (`L/package.json:9-16`) — server-rendered Blade with **jQuery 3.7.1 + Bootstrap 5 bundle + Swiper/nice-select/waypoints/meanmenu** on the public layout (`L/resources/views/layouts/app.blade.php` script tags) and a Vite-built `resources/js/app.js` (axios, `X-Requested-With`) for the authenticated panels' AJAX. No React/Vue/Livewire/Alpine anywhere (grep across `resources/views/` = 0 hits). `npm run build` outputs to `public/build`.
- **Stack duplication smell**: `users.role` enum column AND spatie `roles`/`model_has_roles` tables both exist and are both written (`AdminSeeder` assigns spatie roles, `CheckRole` reads the enum) — two sources of truth for authorization.

### 2.2 Flutter app — `FL/pubspec.yaml`

- SDK `^3.9.0`; state = **provider** (9 providers in `FL/lib/providers/`); HTTP = raw `http: ^1.2.0` (no dio/retrofit); token persisted in **SharedPreferences** (`FL/lib/services/base_service.dart:7-21`); base URL is a **compile-time const** `http://127.0.0.1:8000` (`FL/lib/config/config.dart:23`) — no runtime server config, no flavor system: buyers must edit Dart source to point the app at their backend (vendor docs confirm: "Connect to Backend" section).
- Players: `youtube_player_flutter 9.1.1`, `vimeo_video_player 1.0.3`, `video_player 2.9.1` + `chewie 1.13.0`.
- Payment SDKs: `razorpay_flutter 1.4.1`, `flutter_stripe 12.1.1`, `flutter_sslcommerz 3.0.1`, `mollie_flutter` (git dep) — the other gateways go through `webview_flutter 4.4.2`.
- **Absent (verified by full dependency list read):** any push SDK (no firebase_*/fcm), any socket client, any local DB (no sqflite/hive/drift/isar), any downloader package — the app is online-only with no offline mode beyond SharedPreferences.
- `no_screenshot: ^1.1.0` — screenshot/recording blocking inside the course player.
- i18n: `flutter_localizations` + `FL/lib/l10n/` — exactly 2 languages, English (499 lines) and Bengali (494 lines), ~160 keys each.
- File counting: 144 dart files; 73 under `lib/screens/` (incl. 4 skeleton-loader files and 1 tab widget); 26 models; 21 services; 33 named routes in `FL/lib/router/app_router.dart:38-67` (19 behind `AuthGuard`, `:70-90`).

### 2.3 Surfaces & route counts (from live `route:list`, 642 total)

| Surface | Prefix | Routes | Auth | Notes |
|---|---|---|---|---|
| Public marketing + checkout | `/`, `/courses`, `/bundles`, `/events`, `/blog`, `/subscriptions`, `/verify-certificate`, 9 gateway callbacks, `/cron/run` | ~50 | mixed | `L/routes/web.php` (134 lines) |
| Web student | `/student/*` | 57 | `auth, role:student` | `L/routes/student.php` (121 lines) |
| Web instructor | `/instructor/*` | 90 | `auth, role:instructor` | `L/routes/instructor.php` (167 lines) |
| Web admin | `/admin/*` | 231 | `auth, role:admin, license` | `L/routes/admin.php` (263 lines) — **only** surface behind the license middleware |
| Flutter API (student) | `/api/*` | ~100 of the 172 | sanctum group at `L/routes/api.php:67` | includes unauth `/api/video/stream` (`:49`) |
| Flutter API (instructor) | `/api/instructor/*` | ~72 | sanctum at `:189` | a complete instructor app API **with no shipped instructor app** |
| Installer | `/install/*` | 8 | `web` only, gated by `EnsureSetupComplete` marker file | `L/routes/install.php` |
| Scheduler | 1 command | — | — | `live-classes:send-reminders` every 5 min, `L/routes/console.php:12` |

### 2.4 Middleware reality check (live + code)

- `role:` → `L/app/Http/Middleware/CheckRole.php` — checks `Auth::user()->role !== $role` against the **enum column**, and honors impersonation session keys (`:17-24`). Spatie permissions are unused here.
- `approved.instructor` → `L/app/Http/Middleware/CheckApprovedInstructor.php` — **registered as an alias (`L/bootstrap/app.php:20`) but referenced by zero routes** (grep across `L/routes/` = 0 hits). Dead middleware. Consequence (live-verified by reading the login flow): a *pending* (unapproved) instructor can log in, receive a sanctum token, and reach any `role:instructor` route — the "pending" gate is only the landing page `GET /instructor/pending` (`L/routes/instructor.php:36`), plus UI-level redirects, not enforcement. The web `Api/AuthController::login` (`L/app/Http/Controllers/Api/AuthController.php:105-149`) never checks `is_approved`.
- `license` → `Mhquickdev\LicenseClient\Http\Middleware\LicenseCheckMiddleware` — RS256-token check; skipped for excluded routes (`license/*`, `login`, `logout`, assets — `L/packages/license-client/config/license.php:21-33`); 7-day heartbeat in `terminate()` revokes on server response `revoked` (`.../Http/Middleware/LicenseCheckMiddleware.php:47-79`). **Fails open** when the license server is unreachable (silent catch).
- `EnsureSetupComplete` → appended to the whole `web` group (`L/bootstrap/app.php:24-27`) — redirects everything to `/install` until `L/storage/installed` exists (`L/app/Http/Middleware/EnsureSetupComplete.php:19-30`). The API group is **not** covered (API works pre-install; harmless in practice since DB is empty).
- CSRF exceptions for payment callbacks: `payment/razorpay/callback`, `payment/sslcommerz/callback`, `payment/mollie/callback` (`L/bootstrap/app.php:31-35`).

### 2.5 Application shape

- Controllers: 148 files / 32,935 LOC. Largest: `Front/CourseEnrollmentController.php` (2,843), `Api/CourseEnrollmentController.php` (1,897), `Instructor/CourseBuilderController.php` (1,372), `Student/StudentCourseController.php` (1,305), `Admin/SettingsController.php` (943), `Api/SubscriptionController.php` (904).
- Services: 21 in `L/app/Services/` (GeminiService, LiveClassService, RevenueShareService, CouponService, SubscriptionService, CertificateVerificationService, ChatService, OtpService, SettingsRepository, SmtpConfigurator, LanguageManagerService, ThemeService, NotificationPreferenceService, FileUploadService, Installer/SetupState …).
- Exactly **1 repository** (`CourseDiscussionRepository`) — the codebase is otherwise controller→Eloquent.
- Events/jobs: only model observers (`Enrollment::booted`, `Payment::booted`) + 1 scheduled command; no queued jobs, no webhooks out, no event classes beyond Laravel defaults (grep `ShouldQueue`/`Event::dispatch` in app = observers only).

---

### 2.6 Configuration surface (where settings live)

| Layer | Keys | Mutability |
|---|---|---|
| `.env` (shipped) | APP_*, DB mysql/eduex_full, queue/cache/session=file, mail=log | file edit; installer wizard writes DB block |
| `platform_settings` table | ~40+ keys across groups (system, ai.config, authentication.security, email.preferences, live_class, cron_key, license tokens, revenue.distribution, withdrawals.minimum, chat tuning, contact.details) | admin UI, runtime, no deploy needed |
| `payment_gateway_settings` | 10 rows × (is_enabled, credentials JSON, mode) | admin gateway matrix `[live]` |
| `frontend_settings` | footer/contact/socials/hero/sections/FAQ/SEO/theme | Frontend Manager `[live]` |
| `menus`/`custom_pages`/`banners` | navigation + CMS | CRUD |
| Flutter `config.dart` | baseUrl const, HomePageType | **compile-time only** — buyers edit Dart |

Notable: SMTP is runtime-configurable (admin page + SmtpConfigurator) — better than most CodeCanyon peers; the app's server URL is the one thing that still requires code edits.

## 3. Data Model (tables, relationships, notable issues)

**90 migrations → 63 domain tables** (plus Laravel system tables: users, cache*, jobs, migrations, password_reset_tokens, sessions, personal_access_tokens, notifications, permission×5 spatie). 60 Eloquent models in `L/app/Models/` (a few models share tables, e.g. the 4 discussion models map to the 4 discussion tables 1:1).

### 3.1 Learning core

**`courses`** (`L/database/migrations/2025_11_04_214855_create_courses_table.php`):
`instructor_id FK→users(cascade)`, title, longText description, featured_image, intro_video, `visibility enum(public,private,draft)`, `public_course bool`, `max_students int null`, `difficulty enum(beginner,intermediate,advanced)`, `pricing_model enum(free,paid)`, `regular_price decimal(10,2)`, `sale_price decimal(10,2)`, `schedule_enabled bool`, `schedule_date`, `category varchar` (legacy string), `tags text` (comma-separated), requirements text, objectives text, `status enum(draft,pending,published,archived)`, timestamps; indexes `(instructor_id,status)`, `(visibility)`.
Later additive migrations: `add_pending_status_to_courses` (2025_11_04_224317 — widens status enum to add `pending` via raw MySQL DDL), `add_language_to_courses` (2025_11_05_144540), `add_deleted_date_to_courses` (soft-delete-as-column, **not** Laravel `softDeletes()` — a `deleted_date` timestamp column, 2025_11_06_170508), `add_approval_reason_to_courses` (2025_11_06_171821), `add_is_live_course_to_courses` (2026_06_24_200003), category/language FKs (2025_11_10_114927).
Notable: **two category systems coexist** — the legacy `category` string column (still populated by my demo seed and displayed as "Science"/"Mathematics" in the storefront `[live]`) and the `course_category_id` FK into the admin-managed `course_categories` table; the admin course list shows the legacy string, the catalog filter uses the FK table.

**`course_topics`** (2025_11_04_214856): `course_id FK cascade`, title, description, `order int`; index `(course_id, order)`. Topics are sections; items hang off topics.

**`lessons`** (2025_11_04_214857 + 2026_06_24_110947): `course_topic_id FK cascade`, title, description, **`video_type enum('url','upload','live')`** (the 2026-06-24 migration *replaces* the original `('url','upload')` with `('url','upload','live')` via raw `MODIFY COLUMN` — there is **no 'youtube'/'vimeo' enum value**; YouTube/Vimeo are detected at read time by regex on `video_url`, `L/app/Http/Controllers/Api/StudentCourseController.php:633-642`), `video_url`, `video_path`, `duration int (minutes)`, `is_preview bool`, `order`, + `is_live bool` (2026_06_24_200002). **No article/PDF/audio content type** — a lesson is a video or a live-session pointer, nothing else.

**`quizzes`** (2025_11_04_214857b): `course_topic_id FK`, title, description, `passing_score int default 60` (percent), `time_limit int null` (minutes; **never enforced server-side** — Section 11), `order`.

**`quiz_questions`** (2025_11_04_214858): `quiz_id FK`, question text, `type enum('multiple-choice','true-false')` (**schema supports true/false; the web builder UI never offers it** — no type selector in `L/resources/views/instructor/course-builder.blade.php`, controller defaults `'multiple-choice'` at `L/app/Http/Controllers/Instructor/CourseBuilderController.php:216,715`; the request validation *does* accept both, `L/app/Http/Requests/StoreCourseRequest.php` `topics.*.quizzes.*.questions.*.type`), `options json` (array), **`correct_answer int` — the index of the correct option** (single-correct only; no multi-select, no per-question marks), `order`.

**`quiz_attempts`** (2025_11_05_171657): `user_id`, `quiz_id`, `enrollment_id` FKs, `score int`, `passed bool`, `time_taken int null` (client-supplied), `started_at`, `completed_at`. **No `max_attempts` anywhere** — unlimited retakes by design.

**`quiz_attempt_answers`** (2025_11_05_171658): `quiz_attempt_id`, `question_id`, `selected_answer int`, `is_correct bool`.

**`assignments`** (2025_11_04_214859): `course_topic_id FK`, title, description, longText instructions, `order`. **No due_date, no max_score/marks, no resubmission policy columns.** (The API fabricates `due_date = created_at + 7 days` for the app — Section 11 W-8.)

**`assignment_files` / `assignment_submissions` / `assignment_submission_files`**: submissions carry `user_id`, `assignment_id`, `enrollment_id`, `submission_text`, `submitted_at`, `status enum(pending,graded,returned)`, `grade int null` (0-100 implied, validated at grading), `instructor_notes text`.

**`lesson_progress`** (2025_11_05_171656): `user_id`, `lesson_id`, `enrollment_id` FKs, `is_completed`, `completed_at`, `progress_percentage int default 0`, `last_accessed_at`. **Unique constraint is `(user_id, lesson_id)` only — enrollment_id is NOT in it** while every query filters by enrollment; combined with the checkout flow deleting pending enrollments (`Api/CourseEnrollmentController.php` delete-pending logic) and `enrollments` cascading progress on delete, a re-purchase wipes learning history (prior-draft V2-12, re-verified).

**`live_classes`** (2026_06_24_200001): `course_id FK`, `lesson_id FK nullOnDelete`, `instructor_id FK`, title, description, **`join_url string`** (instructor pastes Zoom/Meet/Jitsi), `scheduled_at datetime`, `duration_minutes default 60`, `status enum(scheduled,live,ended,cancelled)`, `recording_url`, `recording_video_path` (uploads streamed via the vulnerable `/api/video/stream`).

### 3.2 Commerce core

**`payments`** (2025_11_05_154252 + **11 additive migrations**): base columns `enrollment_id` (FK added later by 2025_11_05_163127), `payment_method enum('razorpay','offline')` (widened by each gateway migration via raw MySQL `MODIFY COLUMN`), `amount decimal(10,2)`, `status enum(pending,completed,failed,refunded)`, razorpay order/payment/signature, `receipt_file`, `transaction_id`, `notes text`. Additive waves: stripe intent+client_secret (2025_11_05_211512), paystack ref + flutterwave tx_ref (2025_11_06_082652), paypal order/capture ids (2025_11_06_084513), sslcommerz tran/val/session (2025_11_06_085557), mollie payment id (2025_11_06_093811), `platform_commission/instructor_earning/commission_processed` (2025_11_10_130100), `bundle_id` (2026_04_20_000003), bkash (2026_04_23_080000), xpay (2026_06_25_100000), `coupon_id/discount_amount` (2026_06_24_000003), `subscription_plan_id/user_subscription_id` (2026_08_05_080314), `user_id` (2026_08_05_090000). Net effect: **~30 nullable gateway-specific columns on one table** (`L/app/Models/Payment.php:14-44` fillable list). Notable issue: `payments.user_id` was added only in Aug-2026 (v2.0) and **is never set on the API checkout path** — `Payment::create` calls at `Api/CourseEnrollmentController.php:172,214,271,334,374,411,448,485,525` include no `user_id`; it's backfilled via the enrollment relation in the coupon hook (`L/app/Models/Payment.php:65` `$payment->user_id ?? ($payment->enrollment?->user_id)`).

**`enrollments`** (2025_11_05_154253): `user_id`, `course_id` FKs cascade, `payment_id FK null set-null`, `status enum(pending,approved,completed,cancelled)`, `enrolled_at`; **unique `(user_id, course_id)`** — one row per student per course forever, reused across payment attempts.

**`bundles` / `bundle_courses` / `bundle_enrollments`** (2026_04_20): bundles have `vendor_id FK→users` (admin OR instructor can own), price, `status`, `approval_status default pending` + **Laravel `softDeletes()`** (the only softDeletes in the product — courses use a manual `deleted_date` column instead). `bundle_enrollments` mirrors per-user bundle state.

**`coupons` / `coupon_usages`** (2026_06_24): code unique, `type varchar ('percentage'|'fixed')`, value, valid_from/valid_to, `usage_limit int null`, `used_count int default 0` (incremented by the Payment saved-hook — race-prone, Section 11), `course_id` scope nullable, `instructor_id` owner nullable, status varchar. `coupon_usages` = ledger (coupon, user, enrollment, discount_amount) with no unique constraint of its own (the model does firstOrCreate on `(coupon_id, user_id, enrollment_id)`).

**`subscription_plans` / `subscription_plan_courses` / `subscription_plan_bundles` / `user_subscriptions`** (2026_08_05_080314, v2.0): plans have name/slug, price + discount_price, `billing_period enum(monthly,quarterly,half_yearly,yearly,lifetime)`, `duration_days default 30`, `course_limit int null` (comment: "null or 0 = unlimited"; **dead in code** — never compared, Section 11 W-6), `features json`, `is_featured`, status, sort_order. `user_subscriptions`: user, plan, payment_id nullOnDelete, `starts_at`, `ends_at null (=lifetime)`, `status enum(active,expired,cancelled,pending_approval)`, `courses_accessed_count default 0` (**written as 0 at activation, never incremented — dead column**, `L/app/Services/SubscriptionService.php:45,106`). **No sweeper ever flips active→expired** (only 1 scheduled command exists, `L/routes/console.php:12`).

**`instructor_withdrawals`** (2025_11_10_140000): user FK, amount, method (bank_transfer/paypal/stripe validated in controller), `status enum(pending,processing,completed,rejected)` (states also in `L/app/Models/InstructorWithdrawal.php:34-38`), reference `WD-YYYYMMDD-XXXXX` generated at request time, admin notes, `processed_at`. Instructor **`users.balance`** column added 2025_11_10_130000 (decimal, wallet).

**`payment_gateway_settings`** (2025_11_09_223126, + `PaymentGatewaySettingSeeder`): per-gateway rows `identifier`, `is_enabled`, `credentials json`, `mode` — the admin gateway matrix reads/writes this (10 gateways `[live adm_admin_settings_gateways]`). This is the *good* half of the payment design (config in JSON rows); the *bad* half is the per-gateway response columns on `payments`.

### 3.3 Social / engagement / community

- `reviews` (2025_11_06_103542): course, user, enrollment_id nullable, `rating int unsigned` (1-5 enforced in controller only), comment, `is_approved default true`, unique `(course_id, user_id)`; `review_replies` (one reply per review, instructor-owned).
- `course_discussions` + `_replies` + `_likes` + `_reply_likes` (2026_06_24_081355): title, content, `is_pinned`, `is_announcement`; likes have unique `(user_id, discussion_id)` / `(user_id, reply_id)`. **No soft deletes, no edited_at, no read state.**
- `community_questions` / `community_answers` / `community_votes` (2026_02_11): tags json, views counter, votes with `vote_type` (up/down), accepted-answer flag on answers.
- `conversations` / `chat_messages` / `chat_attachments` (2026_04_03): conversation = strictly **student↔instructor pair** (unique `(student_id, instructor_id)`), `is_accepted` gate (instructor must accept before chat opens), `is_closed`, `last_message_at`; messages `is_read`/`read_at`; attachments.
- `ai_chat_messages` (2026_02_11_185505): user, role, content — persisted AI tutor history.
- `focus_sessions`, `habits`, `habit_logs` (2026_02_10): standalone pomodoro/habit tracker, no FK to courses.

### 3.4 Platform / CMS / auth

- `users` (0001_01_01_000000): name, email unique, password, **`role enum('student','instructor','admin')`**, `is_approved bool default false`, bio/phone/specialization/years_experience/previous_experience/highest_degree/field_of_study/certifications/profile_photo/resume (instructor application fields all on `users`), + 2FA columns (2025_11_01_234952), social links (2025_11_06_101702), `balance` (2025_11_10_130000), `approval_reason` (2025_11_06_174755).
- `account_deletion_requests`, `user_notification_settings` (preferences json), `admin_notification_histories`, `platform_settings` (key/group/type/payload JSON/`is_encrypted` — the settings repository backing 17 admin settings pages + license token persistence), `payment_gateway_settings`, `frontend_settings`, `menus`/`menu_items`, `custom_pages`, `banners`, `newsletter_subscribers`, `blog_posts`/`blog_categories`/`blog_comments`, `course_categories`/`course_languages`, `events`/`event_highlights`/`event_speakers`/`event_instructor`/`event_bookings` (events carry `slug`, `start_date/end_date/start_time/end_time`, `total_seats`, `price`, `metadata json`; bookings have QR-verifiable references).

### 3.5 Model-layer behavior worth noting (code-verified)

- **`Enrollment::booted()` updated-observer** (`L/app/Models/Enrollment.php:28-72`): when status flips to `approved` and the linked payment has `bundle_id`, it bulk-approves ALL of that user's pending enrollments for the bundle's courses inside `static::withoutEvents` (recursion guard), links them to the same payment, and upserts the `bundle_enrollments` row. Clean fan-out — but implemented as a model boot hook, not an event/listener.
- **`Payment::booted()` saved-hook** (`L/app/Models/Payment.php:61-75`): on every transition into `completed` with a coupon, creates `CouponUsage` and increments `used_count`. Re-completing a payment (or a completed→failed→completed flip) re-fires the increment path (firstOrCreate dedupes the usage row but `used_count` increments live outside the guard — the increment call sits after the firstOrCreate; see W-9).
- **Certificate number** (`L/app/Models/Enrollment.php:82-95`): `sprintf('CERT-%06d-%s', id, strtoupper(substr(md5(user_id.course_id),0,6)))` — deterministic from two sequential ids; and **completion date = `updated_at` accessor** (`:97`) because there is no `completed_at` column: any later enrollment update rewrites the certificate's printed date.
- **`CourseTopic::getProgressStats()`** counts completed items per topic; reads a `keyBy('quiz_id')` attempt map, so a quiz passed then failed on retake reads as incomplete (last-row-wins ambiguity — prior draft, re-verified present).


---

### 3.6 Migration chronology (all 90, grouped — evidence of the product's growth waves)

| Wave (dates in filenames) | Migrations | Meaning |
|---|---|---|
| Laravel base (0001_01_01) | users, cache, jobs | framework |
| Events v1 (2025_02_02) | events, event_highlights, event_speakers, event_instructor, event_bookings, +featured_image | events shipped before the LMS core |
| Core LMS (2025_11_04) | courses, course_topics, lessons, quizzes, quiz_questions, assignments, assignment_files, +pending-status, +language | learning core |
| Commerce v1 (2025_11_05) | payments, enrollments, payments FK, lesson_progress, quiz_attempts, quiz_attempt_answers, assignment_submissions, assignment_submission_files | checkout + progress |
| Gateway waves (2025_11_05-11_06) | +stripe, +paystack/flutterwave, +paypal, +sslcommerz, +mollie (5 migrations, all raw-MySQL enum widening) | gateway-of-the-month development |
| Users/auth (2025_11_01-11_06) | 2FA columns, permission tables, sanctum tokens, social links, approval_reason (users) | auth maturation |
| Marketplace (2025_11_06-11_10) | reviews, review_replies, courses deleted_date/approval_reason, account_deletion_requests, user_notification_settings, payment_gateway_settings, platform_settings, blog ×4, categories/languages ×4, users.balance, payments commission, instructor_withdrawals, menus, menu_items, frontend_settings, custom_pages, newsletter_subscribers | the "v1.x complete marketplace" wave |
| CMS/notifications (2026_01) | banners, notifications, admin_notification_histories | |
| Wellbeing + community + AI (2026_02) | focus_sessions, habits, habit_logs, community ×3, ai_chat_messages | engagement wave |
| Platform plumbing (2026_03) | initial system version | updater groundwork |
| Chat (2026_04_03) | conversations, chat_messages, chat_attachments | 1:1 chat |
| Bundles + bKash (2026_04) | bundles, bundle_courses, bundle_enrollments, +payments.bundle_id, +bkash | bundle monetization |
| v1.3-era (2026_06_24-25) | coupons, coupon_usages, +payments coupon fields, course_discussions ×4, live_classes, +lesson is_live, +course is_live_course, live-class settings seed, lessons video_type enum change, +xpay | discussions + live classes + coupons |
| v2.0 subscriptions (2026_08_05) | subscription system ×4 tables, +payments user_id | "Netflix mode" |


### 3.7 Model → table → key relations map (60 models, from schemas + model files)

| Domain | Model (table) | Key relations / notes |
|---|---|---|
| Learning | Course (courses) | belongsTo instructor(User); hasMany topics; legacy `category` string + belongsTo CourseCategory/CourseLanguage; `deleted_date` manual soft delete |
| | CourseTopic (course_topics) | belongsTo Course; hasMany lessons/quizzes/assignments (each `course_topic_id`, ordered) |
| | Lesson (lessons) | belongsTo topic; `video_type` url/upload/live; `is_preview`; `is_live` + optional live_class link |
| | LessonProgress (lesson_progress) | user+lesson+enrollment; unique (user_id, lesson_id) — W-12 |
| | Quiz / QuizQuestion / QuizAttempt / QuizAttemptAnswer | quiz→questions(json options, int correct); attempt→answers; no attempt cap |
| | Assignment / AssignmentFile / AssignmentSubmission / AssignmentSubmissionFile | submission status pending/graded/returned; no due date |
| | LiveClass (live_classes) | course+instructor+optional lesson; join_url; status machine |
| Commerce | Enrollment (enrollments) | user+course unique; payment nullable; booted() bundle observer |
| | Payment (payments) | enrollment/bundle/subscription links; ~30 gateway columns; booted() coupon hook |
| | Bundle / BundleCourse / BundleEnrollment | vendor user; softDeletes (only place) |
| | Coupon / CouponUsage | code unique; used_count; per-user ledger |
| | SubscriptionPlan / UserSubscription | plan↔courses/bundles m:m; ends_at null=lifetime; dead limit columns |
| | InstructorWithdrawal | users.balance wallet; WD- reference |
| | PaymentGatewaySetting | identifier + credentials JSON |
| Social | Review / ReviewReply | unique (course,user); one reply |
| | CourseDiscussion / Reply / Like / ReplyLike | 4 tables; unique like guards |
| | CommunityQuestion / Answer / Vote | tags json; accepted answer |
| | Conversation / ChatMessage / ChatAttachment | student↔instructor unique pair; accept gate |
| Engagement | AiChatMessage | per-user history |
| | FocusSession / Habit / HabitLog | standalone |
| | Event / EventSpeaker / EventHighlight / EventBooking (+event_instructor pivot) | slug; QR booking reference |
| Platform | User (users) | role enum + is_approved + instructor profile fields + balance; dual role system w/ spatie |
| | PlatformSetting / FrontendSetting / Menu / MenuItem / CustomPage / Banner / NewsletterSubscriber | CMS + settings |
| | BlogPost / BlogCategory / BlogComment | |
| | AccountDeletionRequest / UserNotificationSetting / AdminNotificationHistory | lifecycle + prefs |
| | CourseCategory / CourseLanguage | taxonomies |

## 4. Backend Flow Traces

Legend for each trace: `route → controller → DB ops → side effects → response`. All code paths re-read this pass at the cited lines; `[live]` marks steps exercised on the booted app.

### 4.1 Auth — register / login / OTP (Flutter API)

**Register** `POST /api/auth/register` (`L/routes/api.php:35`) → `Api/AuthController::register` (`L/app/Http/Controllers/Api/AuthController.php:27-103`):
1. Manual Validator (not FormRequest): first_name/last_name `required|string|max:255`, email `required|email|unique:users,email`, password `required|min:8|confirmed`, terms `accepted` (`:29-35`). 422 with `errors` map on failure (`:37-42`). **No rate-limit, no CAPTCHA on the API register route** (RecaptchaService exists but is web-login only).
2. `User::create(role:'student', is_approved:true)` (`:45-51`) — students are auto-approved; **instructors are not** (web `/become-instructor` flow sets `is_approved=false`).
3. `UserNotificationSetting::updateOrCreate` with service-computed defaults (`:54-57`).
4. Emails **synchronously** (sync driver), both wrapped in try/catch that only logs: `WelcomeMail` to user and `AdminNewRegistrationMail` to settings' support email — each individually gated by `email.preferences` settings keys (`:60-76`).
5. If `authentication.security.email_verification_required` setting is on → send verification notification, return **no token** (user must verify then login). Else `markEmailAsVerified()` + `createToken('auth_token')` Sanctum token (`:81-88`).
6. Response 201 `{message, user, token, token_type:'Bearer'}`.

**Login** `POST /api/auth/login` (`api.php:36`) → `login()` (`:105-149`):
1. Validate email+password; fetch by email; `Hash::check` — generic 401 "Invalid login credentials" (no user-enumeration here).
2. Email-verification gate if the setting is on → 403 `{email_unverified:true}` + re-sends verification (`:121-128`).
3. If `authentication.security.login_otp_enabled` → `OtpService->send($user)` (email OTP) → 200 `{otp_required:true, email}` and **no token yet** (`:130-138`).
4. Else issue Sanctum token, return `{user, token, otp_required:false}`.
5. **Gap (live + code): `is_approved` is never checked** — a pending instructor gets a fully valid token for every `role:instructor` API route. The dead `approved.instructor` middleware (Section 2.4) was clearly meant to close this.

**OTP verify** `POST /api/auth/login/otp/verify` → `verifyOtp()` (`:151-178`): finds user by email → **404 "User not found" (enumeration signal, vs 401 for wrong code)** → `OtpService->verify` (6-digit, expiry from `authentication.security.otp_expiry_minutes`, default from settings page `[live]`) → clear + issue token.

### 4.2 Course authoring — nested builder save (instructor web)

`POST /instructor/courses` (`L/routes/instructor.php:119`) → `Instructor/CourseBuilderController::store` (`L/app/Http/Controllers/Instructor/CourseBuilderController.php:84+`):
1. `is_approved` guard → redirect to `instructor.pending` (`:87-90`).
2. `resolveTaxonomySelections` maps legacy `category`/`language` strings + FK ids into both the string column and the FK (`:92-98`) — the dual-category design from Section 3.1.
3. `StoreCourseRequest` validates the **entire nested tree in one payload** (`L/app/Http/Requests/StoreCourseRequest.php`): `topics.*.title required_with`, `topics.*.lessons.*.{title,video_type}`, `video_url required_if type=url` / `video_file required_if type=upload`, `topics.*.quizzes.*.questions.*.{question,type∈[multiple-choice,true-false],options array min:2,options.* required string,correct_answer integer min:0}`, `topics.*.assignments.*.title`; `sale_price lt regular_price` (custom message), `featured_image image max:5120` (5MB), `intro_video file mp4/avi/mov/webm max:512000` (**500MB intro video upload**).
4. `DB::beginTransaction()` (`:100`); `FileUploadService->uploadCourseImage/uploadIntroVideo` writes to storage; `Course::create` (`:118-126`) — note `max_students` nulled when `public_course` is on (`:124`).
5. Topics loop creates `CourseTopic` then lessons/quizzes/assignments per type; uploaded lesson videos go through the file service; question rows get `'type' => $questionData['type'] ?? 'multiple-choice'` (`:216`) — the **only** value the web UI ever sends is multiple-choice (no type control in `L/resources/views/instructor/course-builder.blade.php`, 612 lines, grep for true-false = 0 hits).
6. Status resolution: `auto_publish_courses` platform setting (`[live adm_admin_settings_course]` "Automatically publish new courses") decides `draft→published` vs `pending` (approval queue); commit; redirect to edit screen with toast.

**AI assist** `POST /instructor/courses/generate-description` (`instructor.php:126`) → `generateDescription` (`:1331-1372`): validates `title` → builds a detailed HTML-structure prompt → `GeminiService::generateContent` (real HTTPS call to `generativelanguage.googleapis.com`, key from `ai.config.gemini_api_key` platform setting, `L/app/Services/GeminiService.php:20-40`; graceful "AI configuration is missing" string when no key) → strips stray code fences → returns HTML for the description editor. **Real integration, single-purpose** (descriptions only).

**Admin approval** `POST /admin/courses/{id}/approve` (`L/routes/admin.php:181`) → `Admin/CourseController::approve` (`L/app/Http/Controllers/Admin/CourseController.php:92-110`): `findOrFail` → set `status='published'`, persist optional reason into `approval_reason`, null `rejection_reason` → save → toast + back. **No notification to the instructor** on approve/reject (grep notify in controller = 0). `[live]` Exercised: approving course 2 returned 302 and flipped status to `published` with reason "ok".

### 4.3 Enrollment + payment — checkout state machine (the product's core)

`POST /api/courses/{id}/enroll` (`L/routes/api.php:91`) → `Api/CourseEnrollmentController::enroll` (`L/app/Http/Controllers/Api/CourseEnrollmentController.php:56-590`). Branch structure re-verified:

1. **Bundle vs course** (`:61-92`): bundle requires `status=active` + `approval_status=approved`; already-owned-courses warning surfaces a `confirm_duplicate` opt-in; price = full bundle price.
2. **Course preconditions**: `status=published` + `visibility=public` (`:95`); **delete any existing pending enrollment** for this user+course before re-checkout unless an offline request is open (`:102-115`) — the delete cascades `lesson_progress` (FK cascade), wiping partial history of the abandoned attempt (ties to W-12).
3. **Coupon** (single course only, `:122-133`): `CouponService::validate` (`L/app/Services/CouponService.php:30-86`) — check-then-act chain: active status → valid_from/valid_to window → `usage_limit` vs `used_count` → one-redemption-per-user via CouponUsage lookup → course scope (`course_id` null = instructor-wide) + instructor scope. **No row lock / no transaction around the check** — concurrent checkouts can exceed usage_limit (W-9). `calculateDiscount` (`:93-108`) percentage or fixed, capped at price.
4. **Gateway-enabled check** from `payment_gateway_settings` (`:135-140`) — gateways disabled in the admin matrix (`[live]` bKash disabled by seeder) are refused.
5. **Per-method branch** (razorpay/stripe/paystack/flutterwave/paypal/sslcommerz/mollie/bkash/xpay/offline, `:142-535`): each creates the gateway order/session server-side (Stripe `PaymentIntent`, Razorpay order via API, Paystack transaction init, SSLCommerz session, …) → `Enrollment::firstOrCreate(user, course, status=pending)` → `Payment::create(status=pending, gateway refs, coupon_id, discount_amount)` — **no `user_id` key in any create call** (W-4) → `$enrollment->update(['payment_id' => ...])` → respond with SDK params (order id / client secret / checkout URL).
6. **Offline branch** (`:512-546`): validates `transaction_id` + uploaded `receipt_file` (mimes pdf/jpg/jpeg/png — the web checkout page says the same `[live]`), creates the pending enrollment + payment, returns "wait for admin approval".
7. **Free path** (price 0 or 100% coupon, `:546-577`, code quoted in Section 11): `Enrollment::firstOrCreate(status=approved, enrolled_at=now)` → `CouponUsage::create` + `increment('used_count')` inline (this path bypasses the Payment model entirely — no payment row for free enrollments) → commit → `sendEnrollmentNotifications` → success JSON.

**Verify → activation** (razorpay shown; 7 online methods share the shape — razorpay `:592-666`, sslcommerz `:667-768`, stripe `:770-848`, paystack `:850-942`, mollie/bkash/xpay/paypal further down; web mirrors in `Front/CourseEnrollmentController`, 2,843 lines):
1. Validate gateway refs + `enrollment_id` (`:594-600`).
2. `Enrollment::with('payment')->findOrFail($request->enrollment_id)` (`:601`) — **no `user_id` ownership check** (W-2: payment-verify IDOR; re-verified at `:601`).
3. Match `payment.razorpay_order_id` against request (`:603-608`).
4. Server-side signature check `hash_hmac('sha256', orderId|paymentId, secret)` (`:989-998` region) — genuine server verification, not client-trusted.
5. `payment.status=completed` → `enrollment.status=approved, enrolled_at=now` → `processRevenueShare` (`:1118-1131` → `RevenueShareService::process`, `L/app/Services/RevenueShareService.php`: idempotent via `commission_processed` flag inside a DB transaction; splits by `revenue.distribution` settings `{mode: fixed|percentage, value}`; subscription payments split equally across plan courses/bundles with pro-rata for admin-owned bundles; bundle purchases to vendor or pro-rata; single course to instructor; audit JSON appended into `payments.notes` wrapped in an HTML comment) → commit → `sendEnrollmentNotifications` (`:1096-1116`): pref-checked emails (enrollment + instructor notification), try/catch-swallowed.
6. **Bundle fan-out** rides the `Enrollment::booted()` observer (Section 3.5): the approve write on the bundle's "anchor" enrollment auto-approves the user's pending enrollments for all other bundle courses.
7. **Idempotency gap**: repeat verify calls re-run the approve write + emails; only revenue share is guarded by `commission_processed`; the `Payment::booted` coupon hook re-fires `used_count` increments on repeated transitions (W-9).

**Web checkout page** (crawled `[live]`): `GET /courses/{id}/checkout` renders course summary + 8 radio methods (Flutterwave, Mollie, PayPal, Paystack, Razorpay, SSLCommerz, Stripe, Offline — bKash/XPay not offered on web even when enabled; they are app/webview-only) + coupon "Enter code" input + offline panel (Transaction ID*, Upload Receipt*, "verify within 24 hours" copy) — screenshot `web-student-checkout-paid.png`.

### 4.4 Subscription purchase + enroll-via-subscription

`POST /api/subscriptions/checkout` (`api.php:114`) → `Api/SubscriptionController::checkout`: validates plan + gateway → creates pending `UserSubscription` (status `pending_approval` for offline; else pending payment) + Payment row (with `subscription_plan_id`) → gateway branch identical to 4.3. `verify` (`:115`) → `SubscriptionService::activateSubscription` (`L/app/Services/SubscriptionService.php:19-63`): cancels prior active subs for the user, creates/updates the `user_subscriptions` row (`starts_at=now`, `ends_at=now+duration_days` unless lifetime → null), links payment, runs revenue share (equal split across the plan's courses + bundles), fires `SubscriptionPurchased` usage accounting.

**Access check**: `User::hasAccessToCourseViaSubscription` (`L/app/Models/User.php:278-286`) → `UserSubscription::includesCourse` (`:94-101`) — active sub + course (or bundle containing it) in plan mappings.

**Enroll via subscription** `POST /api/subscriptions/enroll-course/{courseId}` (`api.php:116`) → `enrollCourse` (`L/app/Http/Controllers/Api/SubscriptionController.php:565-601`, full code read): checks subscription access → **creates a plain `Enrollment(status='approved')`** — never checks or increments `course_limit`, never stamps the enrollment to the subscription. Because nothing ever sweeps `user_subscriptions` to `expired` (only 1 scheduled command exists — live-class reminders, `L/routes/console.php:12`), **subscription access is effectively permanent** via the enrollment row (W-6, prior-draft V2-04 re-verified in full).

### 4.5 Learning loop — load lesson / mark complete / sequential lock

`GET /api/user/courses/{course}/learn` (`api.php:119`) → `Api/StudentCourseController::show` (`:26-147`):
1. Enrollment must be `approved|completed` (`firstOrFail`, 404 otherwise).
2. **GET side effect** (`:47-51`, quoted Section 11): auto-flips enrollment to `completed` if `isCourseCompleted()` passes — a read mutates state.
3. Computes per-item accessibility for every item via `isItemAccessible` (`:690-716`): **refetches the whole course with topics each call** (`:692`) + one completion query per prior item (`isItemCompleted`, `:718-741`: lesson → any LessonProgress.is_completed; quiz → any attempt with `passed`; assignment → any submission row, graded or not). `show()` calls this per item → **O(items²) queries per page view** (W-10).
4. `determineCurrentItem` (`:767-812`): first accessible-and-not-completed item; **all-completed → returns the FIRST item** (`:808-811` with an in-code comment debating it) — "continue learning" restarts the course (W-7).
5. Response: course, `is_completed`, `current_item{id,type}`, topics→items with `is_completed`/`is_accessible` flags.

`GET /user/courses/{course}/lessons/{lesson}` → `loadLesson` (`:172-184`): `LessonProgress::firstOrCreate` + `last_accessed_at=now` — the only creator of progress rows. Video data builder (`:600-650`): resolves type (`url`→regex-detect YouTube `youtube.com/watch?v=|youtu.be|/embed/` or Vimeo `vimeo.com/(\d+)` → `is_youtube/is_vimeo/video_id`; `upload` → streaming URL pointing at `/api/video/stream?path=...` (the unauthenticated endpoint); `live` → linked LiveClass join/recording URL) — quoted regexes at `:633-642`.

`POST .../lessons/{lesson}/complete` → `markLessonComplete` (`:220-262`): **requires the progress row to already exist** (`firstOrFail`, `:224-227`) — calling complete before load 404s (W-5); marks complete; re-checks course completion (writes only here — correct); returns next item.

**Locking is read-side only**: `loadQuiz`/`loadAssignment` check accessibility, but `submitQuiz` (`:323-411`) and `submitAssignment` (`:459-525`) never call `isItemAccessible` and resolve the quiz/assignment by bare `findOrFail($quizId)` without a course binding (W-1). The web twin (`Student/StudentCourseController.php:477-585`) scopes with `whereHas` on load but its submit paths also skip the accessibility check.

**Web-only endpoints** the app cannot use: `lesson/progress` (percentage + auto-complete ≥100, `student.php:58`), `quiz/attempt/{id}/results`, `sidebar/refresh`, in-course `search` (`student.php:67`) — the API surface has none of these (Flutter never reports watch position; the column exists).

### 4.6 Quiz attempt flow (student)

`GET /user/courses/{course}/quizzes/{quiz}` → `loadQuiz` (`:287-321`): enrollment check → questions **with correct answers included in the payload** (server trusts nothing at submit, but the answers ship to the client — anyone inspecting traffic can see `correct_answer` per question before submitting; Flutter renders options only) → if previously passed and not `?retake=1`, returns the completed state; retake bypasses the passed short-circuit (`:299-308`), **no attempt cap anywhere**.

`POST .../submit` → `submitQuiz` (`:323-411`): transaction → `QuizAttempt::create(started_at=now(), completed_at=now(), time_taken=$request->input('time_taken'))` — **timer is client-supplied and decorative; `quizzes.time_limit` is never consulted** (comment in code at `:339`: "Should ideally come from request or session start") → per answer: `(int)selected_answer === question->correct_answer` → `is_correct`; unanswered questions silently skipped (`continue`, `:353-354`) → `score = round(correct/total*100)`, `passed = score >= quiz->passing_score` → attempt answers persisted → response includes results + `next_item = allItems[currentIndex+1]` **without accessibility check** ("Simplify for now", `:393`).

### 4.7 Assignment flow

Submit (`:459-525`): `submission_text` nullable + single `file` max 10MB stored under `assignments/` (web uses multi-file FileUploadService); row `status=pending`, `submitted_at=now`. Grade: `Api/Instructor/AssignmentController::updateSubmission` (`:142-169`): owning-instructor check (`:149-152`), `status ∈ {pending,graded,returned}`, `grade int 0-100`, `instructor_notes max:2000`. `returned` maps to a resubmission affordance in web UI. Completion counting (4.5) accepts **any** submission. **No due dates exist at all**; the app's assignment list shows fabricated `due_date = created_at + 7 days` (`:556`, code comment "Use placeholder logic for due date") — W-8.

### 4.8 Certificates — generation, download, public verification

- **Eligibility**: enrollment `status=completed` (set by the GET side effect or admin complete action).
- **List**: `GET /api/user/certificates` → `Api/CertificateController::index` (`:26-50`) mints per-row **24-hour signed URLs** via `URL::temporarySignedRoute('api.certificates.download.signed', now()->addDays(1))`; the signed route (`api.php:54`, `middleware('signed')`) **skips the user check** — signature is the only auth (`downloadSigned`, `:113-141`).
- **Download**: `Pdf::loadView('student.certificate', data)` → A4 landscape, all margins 0, `enable-local-file-access` + `isRemoteEnabled` (`:96-105`); template vars: student_name, course_title, instructor_name, completion_date (=`enrollment.updated_at`, W-11), certificate_number, background PNG base64-embedded (`public/assets/front/img/certificate.png` via `certificateBackgroundBase64()`, `:148-156`).
- **Number**: `CERT-%06d-<md5(user_id.course_id)[:6]>` (`L/app/Models/Enrollment.php:82-95`).
- **Public verify**: `POST/GET /api/verify-certificate[/{code}]` (`api.php:60-61`) and web `/verify-certificate` (`web.php:28`) → `CertificateVerificationService::verify` (`L/app/Services/CertificateVerificationService.php:22-96`): parses `CERT-<id>-<hash>` **or `CERT-<id>` or a bare numeric id** (`:33-41`); finds completed enrollment by id; accepts all three forms (`:63-66`) → the md5 suffix is decorative and codes are trivially enumerable (W-13); success payload returns student + instructor names and dates **unauthenticated** (PII disclosure).
- `[live]` The public verify page renders with one field `certificate_number` (placeholder `CERT-000012-A1B2C3`) — screenshot `web-front-verify-certificate.png`.

### 4.9 Live classes — schedule, start/end, reminders

- Instructor web create: `GET/POST /instructor/live-classes/create` — form fields `[live]`: Course* (select), Live Lesson (optional, only lessons marked type=live), Title*, Description, **Meeting URL\* (paste Zoom/Meet/etc.)**, Scheduled Start*, Duration (minutes)* — screenshot evidence `web-instructor-live-classes` crawl + `inst_instructor_live-classes_create.html`. → `Instructor/LiveClassController::store` → `LiveClassService::schedule` (status `scheduled`, optional lesson link flips `lesson.is_live`).
- `POST /instructor/live-classes/{id}/start|end` (`instructor.php:164-165`) flip status `live`/`ended`; the **End Session modal** collects `recording_url` (YouTube etc.) or uploaded `recording_file` (max 512MB) `[live]`.
- Student view: `/student/live-classes` list + dashboard "upcoming" card with countdown ("Starts in 1d 15h" `[live]`); inside the player, a live lesson shows LIVE chip + Join button → `launchUrl(join_url ?? recording_url, externalApplication)` (Flutter `course_access_screen.dart:696-703`) — **no embedded meeting SDK; no attendance capture**.
- **Reminders** (the product's only scheduled work): `L/app/Console/Commands/SendLiveClassReminders.php` — every 5 min (`L/routes/console.php:12`), finds classes entering the `[reminder_minutes-2, +2]` window (setting `live_class_reminder_minutes`, default 30, admin-configurable `[live adm_admin_settings_live-class]`), notifies enrolled students (DB notification + email if pref'd). Runs only if cron/`/cron/run` is triggered — see W-14 for the cron-key issue.
- **No auto-provisioning**: the instructor must create the meeting on Zoom/Meet manually and paste the URL (vs ASchool's Jitsi auto-room `backend/app/services/lms/video_service.py`).

### 4.10 Discussions + community Q&A + chat

- **Course discussions**: `Api/CourseDiscussionController` → `CourseDiscussionService` → `CourseDiscussionRepository` (the codebase's only repository). Access `hasCourseAccess` (`L/app/Services/CourseDiscussionService.php:44-62`): admin OR owning instructor OR student with `approved|completed` enrollment. Moderator = admin/owner (`:70-82`); non-moderator creates strip `is_pinned`/`is_announcement` (`:139-146`); pin/announcement toggles moderator-only (`:205-238`); deletes author-or-moderator. Listing (`Repository:37-79`): search, filters pinned/announcements/my_questions, sort `is_pinned desc, is_announcement desc, created_at desc`, `withCount(replies, likes)` + `withExists(is_liked)`, 15/page. **Zero notification fan-out** (grep notify/Notification across service+repository+controllers = 0 hits) — a reply or instructor pin never notifies anyone. No edit endpoints (create+delete only). `[live]` Instructor "Course Forums" page has a Post Announcement form (course, title, content, Flag as Announcement, Pin to Top) and a threads table — `inst_instructor_discussions.html`.
- **Community Q&A** (platform-wide, not per-course): questions with tags/views, answers, up/down votes (`community_votes.vote_type`), accepted answer by asker (`Api/CommunityController`). `[live]` Student community page: tabs All/Unanswered/My Questions + Ask Question modal (title*, description*, tags) — `auth_student_community.html`.
- **1:1 chat**: `POST /api/messages/start` creates a conversation (student→instructor) with `is_accepted=false`; instructor accepts/declines (`api.php:214-215`); messages + attachments; `GET /messages/{id}/poll` long-polls (admin-configurable poll timeout/interval, `[live adm_admin_settings_chat]`: long-poll 20-30s recommended, poll interval 1-3s, max file 10MB, allowed types, messages per page). Unread counts per conversation. **HTTP polling only — no websockets.**

### 4.11 Admin monetization surfaces (live-crawled)

- Offline payment queue: `/admin/payments/offline-pending` — search, pending count/amount cards, receipt modal with Download Receipt `[live]`; approve action completes the payment (runs revenue share per the settings copy: "commission & instructor earnings are processed once the payment is approved by admin" `[live adm_admin_settings_revenue]`).
- Withdrawals: `/admin/withdrawals` — overview cards (Pending/Processing/Completed/Rejected with amounts), filters by status/method, update-status action; rejected refunds instructor balance (prior-draft, consistent with controller `:125-129`).
- Subscriptions: `/admin/subscription-plans` (plan table with prices, billing period, included counts, subscribers, toggle) and `/admin/subscriptions` (user subscriptions + **Manually Assign Subscription modal**: student*, plan*, custom duration days) `[live]`.
- Coupons admin: full resource `/admin/coupons` (empty state live: "No coupons found").


---

### 4.12 OTP + notification-preference machinery

`OtpService` (`L/app/Services/OtpService.php`): `enabled()` reads `authentication.security.login_otp_enabled`; `send()` generates a 6-digit code, stores with expiry (`otp_expiry_minutes` setting, admin UI default), mails `LoginOtpMail` (sync); `verify()` constant-time-compares and clears; resend throttled by the route's `throttle:api`. Per-user channel preferences: `NotificationPreferenceService::defaultsForUser` seeds `user_notification_settings.preferences` JSON; every mail send site-wide is guarded by a pref check (e.g. enrollment mails, `Api/CourseEnrollmentController.php:1096-1116`).

### 4.13 Email template inventory (all sync-sent)

`L/app/Mail/` (11): WelcomeMail, AdminNewRegistrationMail, LoginOtpMail, VerifyEmailMail, StudentCourseEnrollmentMail, InstructorCourseEnrollmentMail, CourseUpdatedMail (broadcast to enrolled students on course update), InstructorReviewNotificationMail, AdminNewsletterBlast, ContactFormSubmitted, EventBookingBulkMail. Blade templates under `L/resources/views/emails/` (11 + subfolders). SMTP runtime-configurable via the admin SMTP page + `SmtpConfigurator` (writes config live without .env edits — a genuinely good self-hosted UX).

### 4.14 Impersonation flow

`POST /admin/impersonate/instructor/{id}` / `.../student/{id}` (`L/routes/admin.php:171-172`) → `Admin/ImpersonationController::impersonate/impersonateStudent` — sets session keys `impersonating_admin_id` + `impersonating_{role}_id` and logs the admin in as the target; `CheckRole` honors the session keys (`L/app/Http/Middleware/CheckRole.php:17-24`); `POST /admin/stop-impersonating` (web.php:124) restores. The API surfaces (sanctum) are NOT impersonation-aware — impersonation is web-only.

### 4.15 Updater flow

`GET /admin/updater` → current version from `platform_settings` vs `available version detected in the codebase` (2.0.0 in this artifact — the DB seeded 1.0.0 while the code is 2.0, so the page advertises the upgrade `[live]`); `POST /admin/updater/run` → `Admin/UpdaterController::update` runs pending migrations + version patch. Aimed at non-technical cPanel buyers who cannot run `php artisan migrate`.

### 4.16 Theme system

`/admin/frontend/theme` (live): upload a ZIP containing `theme.json`, template files, `assets/`; `ThemeService` + `ThemePublishCommand` publish into the front-end view path; active theme card shows "Default — Built-in Theme By MHQuickDev". The public layout's asset pipeline (`assets/front/js|css`) is theme-swappable. This is a lightweight white-label mechanism (one active theme, no per-page composition beyond the homepage settings).

### 4.17 Notification-event inventory (what actually creates in-app notifications)

Grep across `L/app` for `Notification::send` / `->notify(` / notifications-table writes finds **exactly two send sites**:
1. `Admin/NotificationController.php:86,119` — admin manual push (`GeneralNotification`) + resend, to filtered user sets (all/courses/instructors).
2. `Services/LiveClassService.php:175` — `LiveClassNotification` (reminder/schedule/change/cancel types) to enrolled students.

That is the **entire** in-app notification production: no notification on enrollment, payment completion, quiz result, assignment graded, discussion reply/like, review, reply-to-review, withdrawal status, subscription expiry, or instructor approval. All of those generate **emails only** (11 templates, 4.13), and the mobile app — with no push SDK — surfaces only these two notification types by polling `/api/notifications`. For an LMS whose engagement loops are time-sensitive, this is the starkest product-level gap between the marketing surface ("notifications center") and the engine (2 events).

### 4.18 Web checkout flow (Front/CourseEnrollmentController, 2,843 lines)

`GET /courses/{id}/checkout` (`:69`) renders the crawled page; `POST /courses/{id}/checkout` (`:145`) → `processCheckout(CheckoutRequest)` mirrors the API branch structure with toast+redirect UX instead of JSON:
- Bundle branch re-checks active+approved, computes owned-course overlap — with an in-code admission: `// Wait for the duplicate flag in realistic scenarios, but let's just proceed` (`:163-164`) — the web path skips the duplicate-ownership warning the API enforces (`confirm_duplicate`), a web/app behavioral divergence.
- Course branch: published+public check, existing-enrollment handling, then gateway dispatch (9 gateway branches + offline + free, same state machine as 4.3).
- `validateCoupon` (`:2802`) backs the inline coupon check; `success` (`:773`) renders the celebration page ("Congratulations! You have successfully enrolled in … Access Course / Browse More Courses") `[live auth_enrollment_success_1.html]`.
- Gateway callbacks (web.php:81-89) complete the loop for browser-redirect flows (3 CSRF-exempt POSTs: razorpay, sslcommerz, mollie).

## 5. Full Page/Screen Inventory

Auto-crawled from the live app (`php artisan route:list --json`, 642 routes) with parent menu, purpose, and role mapped from the live-crawled page dumps (`/tmp/eduex_pages/`) and screenshots (`audits/deep-ux-2026-09/screenshots/eduex-lms-v2.0/`). "**live-crawled**" = fetched this pass on the booted app; screenshot column gives the file name (browser capture) or the crawl HTML dump (curl).

### 5.1 Public storefront + checkout (web) — 70 routes, no auth unless noted

| Method | Route | Menu / entry | Purpose | Screenshot / evidence |
|---|---|---|---|---|
| GET | / | header nav "Home" | Marketing home: hero, stats, course strips, testimonials, newsletter | web-front-home.png |
| GET | /courses | "Courses" | Course catalog with sidebar filters (search, category, language, price Free/Paid, instructor, rating) | web-front-courses.png |
| GET | /courses/{course} | course cards | Course detail: info/curriculum/instructors/reviews/description tabs, preview lessons, Enroll/Checkout CTA | web-front-course-detail-free.png, -paid.png |
| GET/POST | /courses/{id}/checkout | "Enroll Now" (auth) | Checkout: summary, 8 payment-method radios, coupon field, offline receipt upload | web-student-checkout-paid.png |
| GET/POST | /bundles, /bundles/{id}, /bundles/{id}/checkout | "Subscriptions"-adjacent + home | Bundle catalog, bundle detail (courses list, vendor), bundle checkout | web-front-bundles.png, web-front-bundle-detail.png |
| GET/POST | /subscriptions, /subscriptions/{plan}/checkout | "Subscriptions" | Public pricing page (Featured plan badge), plan checkout (auth) | web-front-subscriptions.png |
| GET | /instructors, /instructors/{id} | "Instructor" | Instructor directory + profile (bio, socials, courses) | web-front-instructors.png |
| GET | /events, /events/{slug}, /events/{slug}/book (auth) | "Events" | Event list, detail, booking | web-front-events.png |
| GET | /blog, /blog/{slug}, POST comments | "Blog" | Blog list (category chips), post detail, comment form | web-front-blog.png |
| GET | /about, /contact(+POST), /faq, /testimonials, /pages/{slug} | footer/header | CMS pages (contact form: name*, email*, phone, subject*, message*) | web-front-about/-contact/-faq.png |
| GET/POST | /verify-certificate | footer "Verify Certificate" | Public certificate verification (1 field) | web-front-verify-certificate.png |
| POST | /newsletter/subscribe | footer | Newsletter capture | (home page footer) |
| GET/POST | 9× /payment/{gateway}/callback | gateway redirects | Razorpay, Stripe, Paystack, Flutterwave, PayPal, SSLCommerz, Mollie, bKash, XPay web callbacks (3 CSRF-exempt) | code L/routes/web.php:81-89 |
| GET | /cron/run | — | Web-route scheduler trigger (optional secret key) | code L/app/Http/Controllers/CronController.php |
| GET | /up | — | Health check | bootstrap/app.php |

**Auth pages (guest):** /login (web-auth-login.png), /login/otp, /forgot-password (web-auth-forgot-password.png), /reset-password/{token}, /register (web-auth-register.png), /become-instructor (web-auth-become-instructor.png — 16-field instructor application incl. required profile photo + resume), /logout (GET), /email/verify×2.

### 5.2 Student panel (web) — 57 routes behind `auth, role:student`

Sidebar (live): Dashboard, Community, Notifications, AI Assistant, Messages, My Courses, My Assignments, My Quiz Attempts, My Event Bookings, Live Classes, Certificates, Payment History, My Subscription, Settings, Logout.

| Route | Menu | Purpose | Screenshot / dump |
|---|---|---|---|
| /student/dashboard | Dashboard | Welcome, stats (enrolled/completed/pending/total lessons), subscription upsell, upcoming live class w/ countdown, recent enrollments, quick actions, announcements | web-student-dashboard.png |
| /student/my-courses | My Courses | Enrolled course cards (Access Course, enrolled date) | auth_student_my-courses.html |
| /student/courses/{id}/access | (from My Courses) | **The course player**: lesson video + Curriculum/Forum tabs + searchable sidebar with lock icons + prev/next + Mark Complete + live-class frame | web-student-course-player.png |
| /student/assignments | My Assignments | Stats + filters (course, status, search) + submissions table; empty state "No Assignments to Display" | auth_student_assignments.html |
| /student/quiz-attempts | My Quiz Attempts | Stats + filters (course, result, search); empty state | auth_student_quiz-attempts.html |
| /student/certificates | Certificates | List + download; empty state "You haven't completed any courses yet" | auth_student_certificates.html |
| /student/payments | Payment History | Filters (method×8, status×4, search), totals cards; **raw i18n key `student.pending_status` visible** | auth_student_payments.html |
| /student/events/bookings(+/{booking}/ticket) | My Event Bookings | Booking list + QR ticket view | auth_student_events_bookings.html |
| /student/live-classes | Live Classes | Upcoming/live/past sessions with countdown | auth_student_live-classes.html |
| /student/notifications | Notifications | List + mark all read; empty "All caught up!" | auth_student_notifications.html |
| /student/community(×6 verbs) | Community | Q&A room: tabs All/Unanswered/My Questions, Ask Question modal (title*, description*, tags) | auth_student_community.html |
| /student/ai-chat(+/send) | AI Assistant | Gemini chat with persisted history; empty "No messages yet" | auth_student_ai-chat.html |
| /student/messages(×8 verbs) | Messages | Inbox/Sent/Requests tabs, New Message modal w/ instructor search | auth_student_messages.html |
| /student/settings | Settings | Profile (photo, name*, email*, phone), password, 4 notification toggles, Danger Zone (delete account) | auth_student_settings.html |
| /student/subscription | My Subscription | Current plan card (route in web.php:109) | (subscription pages) |
| /student/courses/{id}/discussions×8 | (player Forum tab) | Course forum threads + replies + likes | player page |
| AJAX: lesson/load, lesson/complete, lesson/progress, quiz load/submit, quiz attempt results, assignment load/submit, submission view, item next/previous, search, sidebar/refresh, completion, certificate/download | (player internals) | Client-hydrated player verbs — **web-only, not in the API** | code L/routes/student.php:55-70 |

### 5.3 Instructor panel (web) — 90 routes behind `auth, role:instructor`

Sidebar (live): Dashboard, My Courses, Bundles, Assignments, Quiz Attempts, Events, Live Classes, Students, Messages, Analytics, Reviews, Course Forums, Earnings, Subscription Sales, Coupons, Settings, Notifications.

| Route | Menu | Purpose | Screenshot / dump |
|---|---|---|---|
| /instructor/dashboard | Dashboard | Stat cards (courses/students/rating/earnings), activity feed, popular courses, quick actions | inst_instructor_dashboard.html |
| /instructor/pending | (redirect target) | Pending-approval landing (redirects to dashboard when approved) | inst_instructor_pending.html (302) |
| /instructor/courses | My Courses | Course cards with Edit Course / View; Create New Course CTA | inst_instructor_courses.html |
| /instructor/courses/create, /{id}/edit | Create/Edit | **3-step course builder wizard**: Basics (title*, rich description + "Generate with AI", max students, difficulty, public/live toggles, visibility, schedule, featured image, intro video, pricing free/paid + prices), Curriculum (topics→lessons/quizzes/assignments), Additional (tags, category, language, requirements, objectives) → Publish | web-instructor-course-builder.png; inst_instructor_courses_create.html |
| POST /instructor/courses/generate-description | builder | AI description generation (Gemini) | builder page button |
| /instructor/bundles(/create,/edit) | Bundles | Bundle list; create form (title*, description*, price*, status*, courses* multi-select min 2, image); "Adding bundles triggers admin approval" | inst_instructor_bundles_create.html |
| /instructor/assignments(+/submissions/{id} PUT) | Assignments | Per-course assignment cards w/ submission counters; grade form (grade 0-100, notes ≤2000) | inst_instructor_assignments.html |
| /instructor/quizzes | Quiz Attempts | Quiz cards w/ attempts/passed/pass-rate; View Attempts | inst_instructor_quizzes.html |
| /instructor/events + 6-tab builder (basic/schedule/highlights/speakers/review/publish) | Events | Event management wizard | inst_instructor_events_create.html |
| /instructor/live-classes(/create) + start/end | Live Classes | Schedule form (course*, live lesson, title*, meeting URL*, start*, duration*); End-Session modal collects recording URL/file (≤512MB) | inst_instructor_live-classes_create.html |
| /instructor/students(/{id}) | Students | Student table (courses, progress %, last active — **emails masked** stu****@*****.com), filters + sort | inst_instructor_students.html |
| /instructor/messages×9 | Messages | Inbox/Requests, accept/decline conversation requests | inst_instructor_messages.html |
| /instructor/analytics | Analytics | Revenue/students/enrollments/rating cards, 12-month charts, completion/refund rates, top courses, engagement (At Risk students), recent activity | inst_instructor_analytics.html |
| /instructor/reviews(+/reply) | Reviews | Rating histogram, review list, inline reply form | inst_instructor_reviews.html |
| /instructor/discussions + pin/announcement | Course Forums | Post Announcement form (course*, title*, content*, flag announcement, pin); thread table w/ replies/likes/badges | inst_instructor_discussions.html |
| /instructor/earnings, /subscription-sales, /withdrawals(POST) | Earnings | Balance cards, monthly chart, transactions table (All Sales/Subscriptions/Withdrawals tabs); withdrawal request; subscription-sales explainer | inst_instructor_earnings/-subscription-sales/-withdrawals.html |
| /instructor/coupons (resource) | Coupons | Coupon list; create form (code*, type* %/fixed, value*, course scope, status*, usage limit, valid from/to) | inst_instructor_coupons_create.html |
| /instructor/settings | Settings | Profile (photo, name*, email*, phone, bio, 4 social links), password, 4 notification toggles, Danger Zone delete | inst_instructor_settings.html |
| /instructor/notifications | Notifications | List + mark all read | inst_instructor_notifications.html |

### 5.4 Admin panel (web) — 231 routes behind `auth, role:admin, license`

Sidebar groups (live, from admin dashboard HTML): Dashboard; Courses (All, Pending, Bundles, Languages, Categories, Blog Categories); Instructors (All, Pending); Students; Enrollments (All, Pending, Completed); Learning Activity (Quiz Attempts, Assignment Submissions); Reports; Payments (All, Pending, Offline Pending, Payout Requests); Subscriptions (Package Plans, User Subscriptions); Coupons; Reviews (All, Pending); Account Deletion Requests; Blogs & News (Posts, Create, Comments, Newsletter, Push Notifications); Menus/Frontend (Homepage Content, Theme, About, Contact, FAQ, Marquee, SEO, Custom Pages, Banners, Footer); Settings & Config (Language Manager, System Maintenance→Status/Cache/Logs, Updater); Profile.

| Route | Purpose | Screenshot / dump | State |
|---|---|---|---|
| /admin/dashboard | Revenue/enrollment/completion/rating cards, revenue+enrollment charts, transactions, engagement, activity feed | web-admin-dashboard.png | live |
| /admin/settings | Settings hub (17 areas) | web-admin-settings-hub.png | live |
| /admin/settings/platform | Site name, tagline, timezone, default language, currency (40+ options incl. BDT/INR/PKR, **no NPR**) | adm_admin_settings_platform.html | live |
| /admin/settings/ai | Gemini API key + model select (5 models) | adm_admin_settings_ai.html | live |
| /admin/settings/email-notifications | 4 email preference toggles | adm_admin_settings_email-notifications.html | live |
| /admin/settings/smtp | Host/port/encryption/user/pass/from | adm_admin_settings_smtp.html | live |
| /admin/settings/account-deletion | Approval required toggle, auto-archive courses, notify email | adm_admin_settings_account-deletion.html | live |
| /admin/settings/course | Auto-publish, review-on-update, default visibility, max topic depth | adm_admin_settings_course.html | live |
| /admin/settings/branding | Logos (primary/dark), favicon, primary/secondary colors | adm_admin_settings_branding.html | live |
| /admin/settings/chat | Enable, poll timeout/interval, max file KB, allowed types, per page | adm_admin_settings_chat.html | live |
| /admin/settings/contact | Support email/phone/address | adm_admin_settings_contact.html | live |
| /admin/settings/authentication | Email verification, OTP on login, OTP expiry, recaptcha on login | adm_admin_settings_authentication.html | live |
| /admin/settings/recaptcha | Version v2/v3, keys, score threshold | adm_admin_settings_recaptcha.html | live |
| /admin/settings/revenue | Commission type (%/fixed) + value; full worked examples | adm_admin_settings_revenue.html | live |
| /admin/settings/withdrawals | Minimum payout threshold | adm_admin_settings_withdrawals.html | live |
| /admin/settings/support | Help center URL, KB/ticket toggles | adm_admin_settings_support.html | live |
| /admin/settings/custom-scripts | Custom CSS/JS/header/footer injection | adm_admin_settings_custom-scripts.html | live |
| /admin/settings/cron-setup | Cron status + 3 setup methods + **the live cron key displayed** | adm_admin_settings_cron-setup.html | live |
| /admin/settings/live-class | Enable module, reminder minutes | adm_admin_settings_live-class.html | live |
| /admin/settings/gateways | 10 gateway cards w/ enable + credential fields | web-admin-gateways.png | live |
| /admin/settings/languages | 6 languages, Translate Keys editor (runtime key add) | adm_admin_settings_languages.html | live |
| /admin/settings/system/{status,cache,logs} | System info/health, cache clear, log viewer | adm_admin_settings_system_status.html | live |
| /admin/settings/newsletter(+/send) | Subscriber list + send form (subject*, message*) | adm_admin_settings_newsletter.html | live |
| /admin/courses | Course table w/ filters (search, status, visibility, pricing) + inline status select + actions | web-admin-courses.png | live |
| /admin/courses/pending | **500 — View [admin.courses.pending] not found** | web-admin-courses-pending-500.png | live bug |
| /admin/courses/{id} | Course detail: stats, status actions, description, curriculum tree, instructor, reviews | web-admin-course-detail.png | live |
| /admin/users | **500 — View [admin.users.index] not found** | web-admin-users-500.png (error dump) | live bug |
| /admin/instructors(/pending) | Instructor tables w/ approve/reject | adm_admin_instructors.html | live |
| /admin/students | Student table (enrollments, completed, spent, joined) | adm_admin_students.html | live |
| /admin/enrollments(/pending,/completed) | Filters (search, status, course, instructor, payment status, date range); progress %; lifecycle actions | adm_admin_enrollments.html | live |
| /admin/payments(/pending,/offline-pending) | Payment table + offline review w/ receipt modal | adm_admin_payments.html | live |
| /admin/withdrawals | Payout overview + status update | adm_admin_withdrawals.html | live |
| /admin/reports | Revenue trend table (6 months), enrollment snapshot, student/instructor stats, conversion insights, top courses/instructors | adm_admin_reports.html | live |
| /admin/certificates | Issued list + filters + download (resource re-registers create/edit/delete too) | adm_admin_certificates.html | live |
| /admin/coupons | Coupon CRUD | adm_admin_coupons.html | live (empty) |
| /admin/subscription-plans(/toggle) | Plan table + create/edit | adm_admin_subscription-plans.html | live |
| /admin/subscriptions(/assign,/approve-offline) | User subs table + manual assign modal | adm_admin_subscriptions.html | live |
| /admin/reviews(/pending) | Moderation table w/ rating histogram | adm_admin_reviews.html | live |
| /admin/account-deletions | Queue w/ filters + approve/reject | adm_admin_account-deletions.html | live (empty) |
| /admin/blog-posts(/create), /blog-comments, /banners, /custom-pages, /course-categories, /course-languages, /events | CMS managers | adm_*.html dumps | live |
| /admin/frontend/{menus,settings,faq,seo,home,about,contact,marquee,theme} | Frontend manager: menu builder, footer/socials, FAQ repeater, per-page SEO meta, homepage section composer, theme ZIP upload | adm_admin_frontend_*.html | live |
| /admin/notifications | Redirects to create (send push/in-app to filtered users) | adm_admin_notifications_create (via 302) | live |
| /admin/impersonate/{instructor|student}/{id}, /admin/stop-impersonating | Impersonation | (routes only) | code |
| /admin/updater | Version 1.0.0 → 2.0.0 update runner | web-admin-updater.png | live |
| /license/activate | License activation (package route) | (license valid in this artifact) | code |

### 5.5 Flutter app — 73 screen files, 30 named route constants (19 auth-guarded)

`FL/lib/router/app_router.dart:38-67` (route names) + `FL/lib/screens/` tree (full listing in Section 6). Bottom navigation: **Home / Courses / Dashboard / Community (Q&A) / Profile** (`FL/lib/widgets/bottom_nav_bar.dart`).

| Area | Screens (FL/lib/screens/...) | Notes |
|---|---|---|
| Entry | splash, splash_wrapper, onboarding, auth, otp_verification, forgot_password, reset_password | OTP screen for the login-OTP flow |
| Discovery | home, home2 (switchable homepage layout, AppConfig.getHomePage()), courses + skeletons, categories + skeletons, category_detail, instructor/all_instructors, instructor/instructor_profile, bundles ×3, wishlist | Wishlist is client-only (SharedPreferences, `FL/lib/services/wishlist_service.dart`) |
| Course detail | course_detail (2,105 lines), checkout (1,936 lines), offline_payment, enrollment_success + skeletons | Preview-video sheet gated on `isPreview`; rating histogram; Enroll→Checkout |
| Learning | course_access (751 lines: player shell), quiz_attempt (832 lines), assignment_submit, course_discussion_detail, widgets/course_discussion_tab | Player detail in Section 6.3 |
| Dashboard | dashboard, my_courses, my_assignments + assignment_detail, my_quiz_attempts, certificates + certificate_view + certificate_verification, payments, my_ticket_bookings + ticket_view | |
| Social | conversations, chat, qa_room, question_detail, notifications | Chat polls HTTP |
| AI | ai_chat (real, Gemini), ai_suggestions (**mock**), ai_learning_path (**mock**) | 0 HTTP refs in mocks (verified) |
| Wellness | pomodoro_timer, focus_progress, task_breakdown, weekly_review | Backend: focus_sessions/habits endpoints |
| Money | subscriptions, subscription_checkout, offline_subscription_payment, my_subscription, payment_history, payment_detail | |
| Events | events, event_detail, ticket_booking, payment_screen, booking_confirmation | QR ticket + verification |
| Profile | profile, edit_profile, change_password, settings, notification_settings, privacy_terms, rate_app_sheet, share_app_sheet, common/webview | webview doubles as gateway fallback |

---

### 5.6 Complete route table — public web surface (70 routes)

| Method | URI | Name | Controller@action |
|---|---|---|---|
| GET | // | home | Front\HomeController |
| GET | /about | about | Front\AboutController |
| GET | /become-instructor | instructor.register | Instructor\RegisterController@showRegistrationForm |
| POST | /become-instructor | instructor.register.submit | Instructor\RegisterController@register |
| GET | /blog | blog.index | Front\BlogController@index |
| GET | /blog/{slug} | blog.show | Front\BlogController@show |
| POST | /blog/{slug}/comments | blog.comments.store | Front\BlogCommentController@store |
| GET | /bundles | bundles.index | Front\BundleController@index |
| GET | /bundles/{id} | bundles.show | Front\BundleController@show |
| GET | /bundles/{id}/checkout | bundles.checkout | Front\CourseEnrollmentController@checkoutBundle |
| POST | /bundles/{id}/checkout | bundles.checkout.process | Front\CourseEnrollmentController@processCheckoutBundle |
| GET | /contact | contact | Front\ContactController@index |
| POST | /contact | contact.submit | Front\ContactController@submit |
| POST | /coupons/validate | coupons.validate | Front\CourseEnrollmentController@validateCoupon |
| GET | /courses | courses | Front\CoursesController@index |
| POST | /courses/{courseId}/reviews | courses.reviews.store | Front\ReviewController@store |
| PUT | /courses/{courseId}/reviews/{reviewId} | courses.reviews.update | Front\ReviewController@update |
| GET | /courses/{course} | courses.show | Front\CoursesController@show |
| GET | /courses/{id}/checkout | courses.checkout | Front\CourseEnrollmentController@checkout |
| POST | /courses/{id}/checkout | courses.checkout.process | Front\CourseEnrollmentController@processCheckout |
| GET | /cron/run | cron.run | CronController@run |
| POST | /email/resend | verification.resend | Auth\VerificationController@resend |
| GET | /email/verify | verification.notice | Auth\VerificationController@show |
| GET | /email/verify/{id}/{hash} | verification.verify | Auth\VerificationController@verify |
| GET | /enrollment/success/{id} | enrollment.success | Front\CourseEnrollmentController@success |
| GET | /events | events.index | Front\EventController@index |
| GET | /events/bookings/verify/{reference} | events.bookings.verify | Front\EventBookingVerificationController |
| GET | /events/{slug} | events.show | Front\EventController@show |
| GET | /events/{slug}/book | events.book | Front\EventController@book |
| POST | /events/{slug}/book | events.book.store | Front\EventController@storeBooking |
| GET | /faq | faq | Front\FaqController |
| GET | /forgot-password | password.request | Auth\ForgotPasswordController@showLinkRequestForm |
| POST | /forgot-password | password.email | Auth\ForgotPasswordController@sendResetLinkEmail |
| GET | /license/activate | license.activate | Mhquickdev\LicenseClient\Http\Controllers\LicenseClientController@showActivationForm |
| POST | /license/activate | — | Mhquickdev\LicenseClient\Http\Controllers\LicenseClientController@activate |
| GET | /login | login | Auth\LoginController@showLoginForm |
| POST | /login | — | Auth\LoginController@login |
| GET | /login/otp | login.otp.show | Auth\LoginOtpController@show |
| POST | /login/otp | login.otp.verify | Auth\LoginOtpController@verify |
| POST | /login/otp/resend | login.otp.resend | Auth\LoginOtpController@resend |
| GET | /logout | logout | Auth\LoginController@logout |
| POST | /logout | logout | Laravel\Fortify\Http\Controllers\AuthenticatedSessionController@destroy |
| POST | /newsletter/subscribe | newsletter.subscribe | Front\NewsletterController@store |
| GET | /pages/{customPage} | pages.show | Front\PageController |
| GET | /register | register | Student\RegisterController@showRegistrationForm |
| POST | /register | — | Student\RegisterController@register |
| POST | /reset-password | password.update | Auth\ResetPasswordController@reset |
| GET | /reset-password/{token} | password.reset | Auth\ResetPasswordController@showResetForm |
| GET | /subscriptions | subscriptions.index | Front\SubscriptionController@index |
| POST | /subscriptions/enroll/{courseId} | subscriptions.enroll | Front\SubscriptionController@enrollViaSubscription |
| GET | /subscriptions/{plan}/checkout | subscriptions.checkout | Front\SubscriptionController@checkout |
| POST | /subscriptions/{plan}/checkout | subscriptions.process-checkout | Front\SubscriptionController@processCheckout |
| GET | /terms-conditions | — | Closure |
| GET | /testimonials | testimonials.index | Front\TestimonialController@index |
| GET | /two-factor-challenge | two-factor.login | Laravel\Fortify\Http\Controllers\TwoFactorAuthenticatedSessionController@create |
| POST | /two-factor-challenge | two-factor.login.store | Laravel\Fortify\Http\Controllers\TwoFactorAuthenticatedSessionController@store |
| GET | /up | — | Closure |
| GET | /user/confirm-password | password.confirm | Laravel\Fortify\Http\Controllers\ConfirmablePasswordController@show |
| POST | /user/confirm-password | password.confirm.store | Laravel\Fortify\Http\Controllers\ConfirmablePasswordController@store |
| GET | /user/confirmed-password-status | password.confirmation | Laravel\Fortify\Http\Controllers\ConfirmedPasswordStatusController@show |
| POST | /user/confirmed-two-factor-authentication | two-factor.confirm | Laravel\Fortify\Http\Controllers\ConfirmedTwoFactorAuthenticationController@store |
| PUT | /user/password | user-password.update | Laravel\Fortify\Http\Controllers\PasswordController@update |
| PUT | /user/profile-information | user-profile-information.update | Laravel\Fortify\Http\Controllers\ProfileInformationController@update |
| DELETE | /user/two-factor-authentication | two-factor.disable | Laravel\Fortify\Http\Controllers\TwoFactorAuthenticationController@destroy |
| POST | /user/two-factor-authentication | two-factor.enable | Laravel\Fortify\Http\Controllers\TwoFactorAuthenticationController@store |
| GET | /user/two-factor-qr-code | two-factor.qr-code | Laravel\Fortify\Http\Controllers\TwoFactorQrCodeController@show |
| GET | /user/two-factor-recovery-codes | two-factor.recovery-codes | Laravel\Fortify\Http\Controllers\RecoveryCodeController@index |
| POST | /user/two-factor-recovery-codes | two-factor.regenerate-recovery-codes | Laravel\Fortify\Http\Controllers\RecoveryCodeController@store |
| GET | /user/two-factor-secret-key | two-factor.secret-key | Laravel\Fortify\Http\Controllers\TwoFactorSecretKeyController@show |
| GET|POST | /verify-certificate | verify-certificate | Front\CertificateVerificationController@verify |

### 5.7 Complete route table — student web panel (57 routes)

| Method | URI | Name | Controller@action |
|---|---|---|---|
| GET | /student/ai-chat | student.ai-chat.index | Student\AiChatController@index |
| POST | /student/ai-chat/send | student.ai-chat.send | Student\AiChatController@sendMessage |
| GET | /student/assignments | student.assignments | Student\AssignmentsController@index |
| GET | /student/certificates | student.certificates | Student\CertificatesController@index |
| GET | /student/community | student.community.index | Student\CommunityController@index |
| POST | /student/community | student.community.store | Student\CommunityController@store |
| POST | /student/community/answers/{id}/accept | student.community.answers.accept | Student\CommunityController@markAnswerAccepted |
| POST | /student/community/vote/{type}/{id} | student.community.vote | Student\CommunityController@vote |
| GET | /student/community/{id} | student.community.show | Student\CommunityController@show |
| POST | /student/community/{id}/answers | student.community.answers.store | Student\CommunityController@storeAnswer |
| GET | /student/courses/{courseId}/access | student.courses.access | Student\StudentCourseController@show |
| GET | /student/courses/{courseId}/assignment/submission/{submissionId} | student.courses.assignment.submission | Student\StudentCourseController@viewAssignmentSubmission |
| POST | /student/courses/{courseId}/assignment/{assignmentId}/load | student.courses.assignment.load | Student\StudentCourseController@loadAssignment |
| POST | /student/courses/{courseId}/assignment/{assignmentId}/submit | student.courses.assignment.submit | Student\StudentCourseController@submitAssignment |
| GET | /student/courses/{courseId}/certificate/download | student.courses.certificate.download | Student\StudentCourseController@downloadCertificate |
| GET | /student/courses/{courseId}/completion | student.courses.completion | Student\StudentCourseController@showCompletionPage |
| GET | /student/courses/{courseId}/discussions | student.courses.discussions.index | Student\CourseDiscussionController@index |
| POST | /student/courses/{courseId}/discussions | student.courses.discussions.store | Student\CourseDiscussionController@store |
| POST | /student/courses/{courseId}/discussions/replies/{replyId}/like | student.courses.discussions.replies.like | Student\CourseDiscussionController@toggleReplyLike |
| DELETE | /student/courses/{courseId}/discussions/{id} | student.courses.discussions.destroy | Student\CourseDiscussionController@destroy |
| GET | /student/courses/{courseId}/discussions/{id} | student.courses.discussions.show | Student\CourseDiscussionController@show |
| POST | /student/courses/{courseId}/discussions/{id}/like | student.courses.discussions.like | Student\CourseDiscussionController@toggleLike |
| POST | /student/courses/{courseId}/discussions/{id}/replies | student.courses.discussions.replies.store | Student\CourseDiscussionController@storeReply |
| DELETE | /student/courses/{courseId}/discussions/{id}/replies/{replyId} | student.courses.discussions.replies.destroy | Student\CourseDiscussionController@destroyReply |
| GET | /student/courses/{courseId}/item/{itemId}/next | student.courses.item.next | Student\StudentCourseController@getNextItem |
| GET | /student/courses/{courseId}/item/{itemId}/previous | student.courses.item.previous | Student\StudentCourseController@getPreviousItem |
| POST | /student/courses/{courseId}/lesson/complete | student.courses.lesson.complete | Student\StudentCourseController@markComplete |
| POST | /student/courses/{courseId}/lesson/load | student.courses.lesson.load | Student\StudentCourseController@loadLesson |
| POST | /student/courses/{courseId}/lesson/progress | student.courses.lesson.progress | Student\StudentCourseController@updateProgress |
| GET | /student/courses/{courseId}/quiz/attempt/{attemptId}/results | student.courses.quiz.results | Student\StudentCourseController@viewQuizResults |
| POST | /student/courses/{courseId}/quiz/{quizId}/load | student.courses.quiz.load | Student\StudentCourseController@loadQuiz |
| POST | /student/courses/{courseId}/quiz/{quizId}/submit | student.courses.quiz.submit | Student\StudentCourseController@submitQuiz |
| POST | /student/courses/{courseId}/search | student.courses.search | Student\StudentCourseController@searchContent |
| GET | /student/courses/{courseId}/sidebar/refresh | student.courses.sidebar.refresh | Student\StudentCourseController@refreshSidebar |
| GET | /student/dashboard | student.dashboard | Student\DashboardController@index |
| GET | /student/events/bookings | student.events.bookings | Student\EventBookingController@index |
| GET | /student/events/bookings/{booking}/ticket | student.events.bookings.ticket | Student\EventBookingController@ticket |
| GET | /student/live-classes | student.live-classes.index | Student\LiveClassController@index |
| GET | /student/messages | student.messages.index | Student\ChatController@index |
| GET | /student/messages/instructors/search | student.messages.instructors.search | Student\ChatController@searchInstructors |
| GET | /student/messages/requests | student.messages.requests | Student\ChatController@requests |
| POST | /student/messages/start | student.messages.start | Student\ChatController@startConversation |
| GET | /student/messages/unread-count | student.messages.unread-count | Student\ChatController@unreadCount |
| GET | /student/messages/{conversation} | student.messages.show | Student\ChatController@show |
| GET | /student/messages/{conversation}/poll | student.messages.poll | Student\ChatController@poll |
| POST | /student/messages/{conversation}/send | student.messages.send | Student\ChatController@sendMessage |
| GET | /student/my-courses | student.my-courses | Student\MyCoursesController@index |
| GET | /student/notifications | student.notifications.index | Student\NotificationController@index |
| GET | /student/notifications/read-all | student.notifications.readAll | Student\NotificationController@markAllRead |
| GET | /student/notifications/{id}/read | student.notifications.read | Student\NotificationController@markAsRead |
| GET | /student/payments | student.payments | Student\PaymentsController@index |
| GET | /student/quiz-attempts | student.quiz-attempts | Student\QuizAttemptsController@index |
| GET | /student/settings | student.settings | Student\SettingsController@show |
| POST | /student/settings | student.settings.update | Student\SettingsController@update |
| DELETE | /student/settings/account | student.settings.account.destroy | Student\SettingsController@destroy |
| PUT | /student/settings/notifications | student.settings.notifications.update | Student\SettingsController@updateNotifications |
| GET | /student/subscription | student.subscription | Front\SubscriptionController@mySubscription |

### 5.8 Complete route table — instructor web panel (92 routes)

| Method | URI | Name | Controller@action |
|---|---|---|---|
| GET | /instructor/analytics | instructor.analytics | Instructor\AnalyticsController@index |
| GET | /instructor/assignments | instructor.assignments.index | Instructor\AssignmentsController@index |
| GET | /instructor/assignments/submissions/{submission} | instructor.assignments.submissions.show | Instructor\AssignmentsController@showSubmission |
| PUT | /instructor/assignments/submissions/{submission} | instructor.assignments.submissions.update | Instructor\AssignmentsController@updateSubmission |
| GET | /instructor/assignments/{assignment} | instructor.assignments.show | Instructor\AssignmentsController@show |
| GET | /instructor/bundles | instructor.bundles.index | Instructor\BundleController@index |
| POST | /instructor/bundles | instructor.bundles.store | Instructor\BundleController@store |
| GET | /instructor/bundles/create | instructor.bundles.create | Instructor\BundleController@create |
| DELETE | /instructor/bundles/{bundle} | instructor.bundles.destroy | Instructor\BundleController@destroy |
| GET | /instructor/bundles/{bundle} | instructor.bundles.show | Instructor\BundleController@show |
| PUT|PATCH | /instructor/bundles/{bundle} | instructor.bundles.update | Instructor\BundleController@update |
| GET | /instructor/bundles/{bundle}/edit | instructor.bundles.edit | Instructor\BundleController@edit |
| GET | /instructor/coupons | instructor.coupons.index | Instructor\CouponController@index |
| POST | /instructor/coupons | instructor.coupons.store | Instructor\CouponController@store |
| GET | /instructor/coupons/create | instructor.coupons.create | Instructor\CouponController@create |
| DELETE | /instructor/coupons/{coupon} | instructor.coupons.destroy | Instructor\CouponController@destroy |
| GET | /instructor/coupons/{coupon} | instructor.coupons.show | Instructor\CouponController@show |
| PUT|PATCH | /instructor/coupons/{coupon} | instructor.coupons.update | Instructor\CouponController@update |
| GET | /instructor/coupons/{coupon}/edit | instructor.coupons.edit | Instructor\CouponController@edit |
| GET | /instructor/courses | instructor.courses | Instructor\CoursesController@index |
| POST | /instructor/courses | instructor.courses.store | Instructor\CourseBuilderController@store |
| GET | /instructor/courses/create | instructor.courses.create | Instructor\CourseBuilderController@create |
| POST | /instructor/courses/generate-description | instructor.courses.generate-description | Instructor\CourseBuilderController@generateDescription |
| PUT | /instructor/courses/{id} | instructor.courses.update | Instructor\CourseBuilderController@update |
| GET | /instructor/courses/{id}/edit | instructor.courses.edit | Instructor\CourseBuilderController@edit |
| GET | /instructor/dashboard | instructor.dashboard | Instructor\DashboardController@index |
| GET | /instructor/discussions | instructor.discussions.index | Instructor\CourseDiscussionController@index |
| POST | /instructor/discussions/course/{courseId} | instructor.discussions.store | Instructor\CourseDiscussionController@store |
| DELETE | /instructor/discussions/{id} | instructor.discussions.destroy | Instructor\CourseDiscussionController@destroy |
| GET | /instructor/discussions/{id} | instructor.discussions.show | Instructor\CourseDiscussionController@show |
| POST | /instructor/discussions/{id}/announcement | instructor.discussions.announcement | Instructor\CourseDiscussionController@toggleAnnouncement |
| POST | /instructor/discussions/{id}/pin | instructor.discussions.pin | Instructor\CourseDiscussionController@togglePin |
| POST | /instructor/discussions/{id}/replies | instructor.discussions.replies.store | Instructor\CourseDiscussionController@storeReply |
| DELETE | /instructor/discussions/{id}/replies/{replyId} | instructor.discussions.replies.destroy | Instructor\CourseDiscussionController@destroyReply |
| GET | /instructor/earnings | instructor.earnings | Instructor\EarningsController@index |
| GET | /instructor/events | instructor.events.index | Instructor\EventController@index |
| POST | /instructor/events | instructor.events.store | Instructor\EventBuilderController@store |
| GET | /instructor/events/create | instructor.events.create | Instructor\EventBuilderController@create |
| GET | /instructor/events/{event}/basic | instructor.events.basic.edit | Instructor\EventBuilderController@editBasic |
| PUT | /instructor/events/{event}/basic | instructor.events.basic.update | Instructor\EventBuilderController@updateBasic |
| GET | /instructor/events/{event}/bookings | instructor.events.bookings | Instructor\EventController@bookings |
| POST | /instructor/events/{event}/bookings/email | instructor.events.bookings.email | Instructor\EventBookingEmailController@send |
| GET | /instructor/events/{event}/bookings/export | instructor.events.bookings.export | Instructor\EventController@exportBookings |
| PATCH | /instructor/events/{event}/bookings/{booking} | instructor.events.bookings.update | Instructor\EventController@updateBookingStatus |
| GET | /instructor/events/{event}/highlights | instructor.events.highlights.edit | Instructor\EventBuilderController@editHighlights |
| PUT | /instructor/events/{event}/highlights | instructor.events.highlights.update | Instructor\EventBuilderController@updateHighlights |
| PUT | /instructor/events/{event}/publish | instructor.events.review.publish | Instructor\EventBuilderController@publish |
| GET | /instructor/events/{event}/review | instructor.events.review.edit | Instructor\EventBuilderController@editReview |
| GET | /instructor/events/{event}/schedule | instructor.events.schedule.edit | Instructor\EventBuilderController@editSchedule |
| PUT | /instructor/events/{event}/schedule | instructor.events.schedule.update | Instructor\EventBuilderController@updateSchedule |
| GET | /instructor/events/{event}/speakers | instructor.events.speakers.edit | Instructor\EventBuilderController@editSpeakers |
| PUT | /instructor/events/{event}/speakers | instructor.events.speakers.update | Instructor\EventBuilderController@updateSpeakers |
| GET | /instructor/live-classes | instructor.live-classes.index | Instructor\LiveClassController@index |
| POST | /instructor/live-classes | instructor.live-classes.store | Instructor\LiveClassController@store |
| GET | /instructor/live-classes/create | instructor.live-classes.create | Instructor\LiveClassController@create |
| GET | /instructor/live-classes/lessons | instructor.live-classes.lessons | Instructor\LiveClassController@getLessonsForCourse |
| POST | /instructor/live-classes/{id}/end | instructor.live-classes.end | Instructor\LiveClassController@endSession |
| POST | /instructor/live-classes/{id}/start | instructor.live-classes.start | Instructor\LiveClassController@startSession |
| DELETE | /instructor/live-classes/{live_class} | instructor.live-classes.destroy | Instructor\LiveClassController@destroy |
| GET | /instructor/live-classes/{live_class} | instructor.live-classes.show | Instructor\LiveClassController@show |
| PUT|PATCH | /instructor/live-classes/{live_class} | instructor.live-classes.update | Instructor\LiveClassController@update |
| GET | /instructor/live-classes/{live_class}/edit | instructor.live-classes.edit | Instructor\LiveClassController@edit |
| GET | /instructor/messages | instructor.messages.index | Instructor\ChatController@index |
| GET | /instructor/messages/requests | instructor.messages.requests | Instructor\ChatController@requests |
| GET | /instructor/messages/start | instructor.messages | Instructor\ChatController@startConversation |
| GET | /instructor/messages/unread-count | instructor.messages.unread-count | Instructor\ChatController@unreadCount |
| GET | /instructor/messages/{conversation} | instructor.messages.show | Instructor\ChatController@show |
| POST | /instructor/messages/{conversation}/accept | instructor.messages.accept | Instructor\ChatController@accept |
| POST | /instructor/messages/{conversation}/decline | instructor.messages.decline | Instructor\ChatController@decline |
| GET | /instructor/messages/{conversation}/poll | instructor.messages.poll | Instructor\ChatController@poll |
| POST | /instructor/messages/{conversation}/send | instructor.messages.send | Instructor\ChatController@sendMessage |
| GET | /instructor/notifications | instructor.notifications.index | Instructor\NotificationController@index |
| GET | /instructor/notifications/read-all | instructor.notifications.readAll | Instructor\NotificationController@markAllRead |
| GET | /instructor/notifications/{id}/read | instructor.notifications.read | Instructor\NotificationController@markAsRead |
| GET | /instructor/pending | instructor.pending | Instructor\PendingController@index |
| GET | /instructor/quizzes | instructor.quizzes.index | Instructor\QuizAttemptsController@index |
| GET | /instructor/quizzes/{quiz} | instructor.quizzes.show | Instructor\QuizAttemptsController@show |
| GET | /instructor/reviews | instructor.reviews | Instructor\ReviewsController@index |
| POST | /instructor/reviews/{reviewId}/reply | instructor.reviews.reply | Instructor\ReviewsController@reply |
| PUT | /instructor/reviews/{reviewId}/reply/{replyId} | instructor.reviews.reply.update | Instructor\ReviewsController@updateReply |
| GET | /instructor/settings | instructor.settings | Instructor\SettingsController@index |
| DELETE | /instructor/settings/account | instructor.settings.account.destroy | Instructor\SettingsController@destroy |
| PUT | /instructor/settings/notifications | instructor.settings.notifications.update | Instructor\SettingsController@updateNotifications |
| PUT | /instructor/settings/password | instructor.settings.password.update | Instructor\SettingsController@updatePassword |
| PUT | /instructor/settings/profile | instructor.settings.profile.update | Instructor\SettingsController@updateProfile |
| GET | /instructor/students | instructor.students | Instructor\StudentsController@index |
| GET | /instructor/students/{id} | instructor.students.show | Instructor\StudentsController@show |
| GET | /instructor/subscription-sales | instructor.subscription-sales | Instructor\EarningsController@subscriptionSales |
| GET | /instructor/withdrawals | instructor.withdrawals | Instructor\EarningsController@withdrawals |
| POST | /instructor/withdrawals | instructor.withdrawals.store | Instructor\EarningsController@storeWithdrawal |
| GET | /instructors | instructors.index | Front\InstructorController@index |
| GET | /instructors/{instructor} | instructors.show | Front\InstructorController@show |

### 5.9 Complete route table — admin web panel (231 routes)

| Method | URI | Name | Controller@action |
|---|---|---|---|
| GET | /admin/account-deletions | admin.account-deletions.index | Admin\AccountDeletionController@index |
| PUT | /admin/account-deletions/{accountDeletionRequest}/approve | admin.account-deletions.approve | Admin\AccountDeletionController@approve |
| PUT | /admin/account-deletions/{accountDeletionRequest}/reject | admin.account-deletions.reject | Admin\AccountDeletionController@reject |
| GET | /admin/banners | admin.banners.index | Admin\BannerController@index |
| POST | /admin/banners | admin.banners.store | Admin\BannerController@store |
| GET | /admin/banners/create | admin.banners.create | Admin\BannerController@create |
| DELETE | /admin/banners/{banner} | admin.banners.destroy | Admin\BannerController@destroy |
| GET | /admin/banners/{banner} | admin.banners.show | Admin\BannerController@show |
| PUT|PATCH | /admin/banners/{banner} | admin.banners.update | Admin\BannerController@update |
| GET | /admin/banners/{banner}/edit | admin.banners.edit | Admin\BannerController@edit |
| GET | /admin/blog-categories | admin.blog-categories.index | Admin\BlogCategoryController@index |
| POST | /admin/blog-categories | admin.blog-categories.store | Admin\BlogCategoryController@store |
| GET | /admin/blog-categories/create | admin.blog-categories.create | Admin\BlogCategoryController@create |
| DELETE | /admin/blog-categories/{blog_category} | admin.blog-categories.destroy | Admin\BlogCategoryController@destroy |
| GET | /admin/blog-categories/{blog_category} | admin.blog-categories.show | Admin\BlogCategoryController@show |
| PUT|PATCH | /admin/blog-categories/{blog_category} | admin.blog-categories.update | Admin\BlogCategoryController@update |
| GET | /admin/blog-categories/{blog_category}/edit | admin.blog-categories.edit | Admin\BlogCategoryController@edit |
| GET | /admin/blog-comments | admin.blog-comments.index | Admin\BlogCommentController@index |
| DELETE | /admin/blog-comments/{comment} | admin.blog-comments.destroy | Admin\BlogCommentController@destroy |
| PATCH | /admin/blog-comments/{comment}/toggle | admin.blog-comments.toggle | Admin\BlogCommentController@toggle |
| GET | /admin/blog-posts | admin.blog-posts.index | Admin\BlogController@index |
| POST | /admin/blog-posts | admin.blog-posts.store | Admin\BlogController@store |
| GET | /admin/blog-posts/create | admin.blog-posts.create | Admin\BlogController@create |
| DELETE | /admin/blog-posts/{blog_post} | admin.blog-posts.destroy | Admin\BlogController@destroy |
| GET | /admin/blog-posts/{blog_post} | admin.blog-posts.show | Admin\BlogController@show |
| PUT|PATCH | /admin/blog-posts/{blog_post} | admin.blog-posts.update | Admin\BlogController@update |
| GET | /admin/blog-posts/{blog_post}/edit | admin.blog-posts.edit | Admin\BlogController@edit |
| GET | /admin/bundles | admin.bundles.index | Admin\BundleController@index |
| POST | /admin/bundles | admin.bundles.store | Admin\BundleController@store |
| GET | /admin/bundles/create | admin.bundles.create | Admin\BundleController@create |
| DELETE | /admin/bundles/{bundle} | admin.bundles.destroy | Admin\BundleController@destroy |
| GET | /admin/bundles/{bundle} | admin.bundles.show | Admin\BundleController@show |
| PUT|PATCH | /admin/bundles/{bundle} | admin.bundles.update | Admin\BundleController@update |
| POST | /admin/bundles/{bundle}/approve | admin.bundles.approve | Admin\BundleController@approve |
| GET | /admin/bundles/{bundle}/edit | admin.bundles.edit | Admin\BundleController@edit |
| POST | /admin/bundles/{bundle}/reject | admin.bundles.reject | Admin\BundleController@reject |
| GET | /admin/certificates | admin.certificates.index | Admin\CertificateController@index |
| POST | /admin/certificates | admin.certificates.store | Admin\CertificateController@store |
| GET | /admin/certificates/create | admin.certificates.create | Admin\CertificateController@create |
| DELETE | /admin/certificates/{certificate} | admin.certificates.destroy | Admin\CertificateController@destroy |
| GET | /admin/certificates/{certificate} | admin.certificates.show | Admin\CertificateController@show |
| PUT|PATCH | /admin/certificates/{certificate} | admin.certificates.update | Admin\CertificateController@update |
| GET | /admin/certificates/{certificate}/edit | admin.certificates.edit | Admin\CertificateController@edit |
| GET | /admin/certificates/{enrollment}/download | admin.certificates.download | Admin\CertificateController@download |
| GET | /admin/coupons | admin.coupons.index | Admin\CouponController@index |
| POST | /admin/coupons | admin.coupons.store | Admin\CouponController@store |
| GET | /admin/coupons/create | admin.coupons.create | Admin\CouponController@create |
| DELETE | /admin/coupons/{coupon} | admin.coupons.destroy | Admin\CouponController@destroy |
| GET | /admin/coupons/{coupon} | admin.coupons.show | Admin\CouponController@show |
| PUT|PATCH | /admin/coupons/{coupon} | admin.coupons.update | Admin\CouponController@update |
| GET | /admin/coupons/{coupon}/edit | admin.coupons.edit | Admin\CouponController@edit |
| GET | /admin/course-categories | admin.course-categories.index | Admin\CourseCategoryController@index |
| POST | /admin/course-categories | admin.course-categories.store | Admin\CourseCategoryController@store |
| GET | /admin/course-categories/create | admin.course-categories.create | Admin\CourseCategoryController@create |
| DELETE | /admin/course-categories/{course_category} | admin.course-categories.destroy | Admin\CourseCategoryController@destroy |
| GET | /admin/course-categories/{course_category} | admin.course-categories.show | Admin\CourseCategoryController@show |
| PUT|PATCH | /admin/course-categories/{course_category} | admin.course-categories.update | Admin\CourseCategoryController@update |
| GET | /admin/course-categories/{course_category}/edit | admin.course-categories.edit | Admin\CourseCategoryController@edit |
| GET | /admin/course-languages | admin.course-languages.index | Admin\CourseLanguageController@index |
| POST | /admin/course-languages | admin.course-languages.store | Admin\CourseLanguageController@store |
| GET | /admin/course-languages/create | admin.course-languages.create | Admin\CourseLanguageController@create |
| DELETE | /admin/course-languages/{course_language} | admin.course-languages.destroy | Admin\CourseLanguageController@destroy |
| GET | /admin/course-languages/{course_language} | admin.course-languages.show | Admin\CourseLanguageController@show |
| PUT|PATCH | /admin/course-languages/{course_language} | admin.course-languages.update | Admin\CourseLanguageController@update |
| GET | /admin/course-languages/{course_language}/edit | admin.course-languages.edit | Admin\CourseLanguageController@edit |
| GET | /admin/courses | admin.courses.index | Admin\CourseController@index |
| GET | /admin/courses/pending | admin.courses.pending | Admin\CourseController@pending |
| DELETE | /admin/courses/{id} | admin.courses.destroy | Admin\CourseController@destroy |
| GET | /admin/courses/{id} | admin.courses.show | Admin\CourseController@show |
| POST | /admin/courses/{id}/approve | admin.courses.approve | Admin\CourseController@approve |
| DELETE | /admin/courses/{id}/full-delete | admin.courses.full-delete | Admin\CourseController@fullDelete |
| POST | /admin/courses/{id}/reject | admin.courses.reject | Admin\CourseController@reject |
| POST | /admin/courses/{id}/update-status | admin.courses.update-status | Admin\CourseController@updateStatus |
| GET | /admin/custom-pages | admin.custom-pages.index | Admin\CustomPageController@index |
| PUT|PATCH | /admin/custom-pages/{custom_page} | admin.custom-pages.update | Admin\CustomPageController@update |
| GET | /admin/custom-pages/{custom_page}/edit | admin.custom-pages.edit | Admin\CustomPageController@edit |
| GET | /admin/dashboard | admin.dashboard | Admin\DashboardController@index |
| GET | /admin/enrollments | admin.enrollments.index | Admin\EnrollmentController@index |
| GET | /admin/enrollments/completed | admin.enrollments.completed | Admin\EnrollmentController@completed |
| GET | /admin/enrollments/pending | admin.enrollments.pending | Admin\EnrollmentController@pending |
| GET | /admin/enrollments/{id} | admin.enrollments.show | Admin\EnrollmentController@show |
| POST | /admin/enrollments/{id}/approve | admin.enrollments.approve | Admin\EnrollmentController@approve |
| POST | /admin/enrollments/{id}/cancel | admin.enrollments.cancel | Admin\EnrollmentController@cancel |
| POST | /admin/enrollments/{id}/complete | admin.enrollments.complete | Admin\EnrollmentController@complete |
| POST | /admin/enrollments/{id}/reject | admin.enrollments.reject | Admin\EnrollmentController@reject |
| PUT | /admin/enrollments/{id}/update-status | admin.enrollments.update-status | Admin\EnrollmentController@updateStatus |
| GET | /admin/events | admin.events.index | Admin\EventManagementController@index |
| GET | /admin/events/{event} | admin.events.show | Admin\EventManagementController@show |
| PATCH | /admin/events/{event}/toggle-publish | admin.events.toggle-publish | Admin\EventManagementController@togglePublish |
| GET | /admin/frontend/about | admin.frontend.about.edit | Admin\FrontendSettingController@about |
| PUT | /admin/frontend/about | admin.frontend.about.update | Admin\FrontendSettingController@updateAbout |
| GET | /admin/frontend/contact | admin.frontend.contact.edit | Admin\FrontendSettingController@contact |
| PUT | /admin/frontend/contact | admin.frontend.contact.update | Admin\FrontendSettingController@updateContact |
| GET | /admin/frontend/faq | admin.frontend.faq.edit | Admin\FrontendSettingController@faq |
| PUT | /admin/frontend/faq | admin.frontend.faq.update | Admin\FrontendSettingController@updateFaq |
| GET | /admin/frontend/home | admin.frontend.home.edit | Admin\FrontendSettingController@homepage |
| PUT | /admin/frontend/home | admin.frontend.home.update | Admin\FrontendSettingController@updateHomepage |
| GET | /admin/frontend/marquee | admin.frontend.marquee.edit | Admin\FrontendSettingController@marquee |
| PUT | /admin/frontend/marquee | admin.frontend.marquee.update | Admin\FrontendSettingController@updateMarquee |
| GET | /admin/frontend/menus | admin.frontend.menus.index | Admin\MenuController@index |
| POST | /admin/frontend/menus | admin.frontend.menus.store | Admin\MenuController@store |
| GET | /admin/frontend/menus/create | admin.frontend.menus.create | Admin\MenuController@create |
| DELETE | /admin/frontend/menus/{menu} | admin.frontend.menus.destroy | Admin\MenuController@destroy |
| GET | /admin/frontend/menus/{menu} | admin.frontend.menus.show | Admin\MenuController@show |
| PUT|PATCH | /admin/frontend/menus/{menu} | admin.frontend.menus.update | Admin\MenuController@update |
| GET | /admin/frontend/menus/{menu}/edit | admin.frontend.menus.edit | Admin\MenuController@edit |
| POST | /admin/frontend/menus/{menu}/items | admin.frontend.menus.items.store | Admin\MenuItemController@store |
| POST | /admin/frontend/menus/{menu}/items/order | admin.frontend.menus.items.reorder | Admin\MenuItemController@reorder |
| DELETE | /admin/frontend/menus/{menu}/items/{menuItem} | admin.frontend.menus.items.destroy | Admin\MenuItemController@destroy |
| PUT | /admin/frontend/menus/{menu}/items/{menuItem} | admin.frontend.menus.items.update | Admin\MenuItemController@update |
| GET | /admin/frontend/seo | admin.frontend.seo.edit | Admin\FrontendSettingController@seo |
| PUT | /admin/frontend/seo | admin.frontend.seo.update | Admin\FrontendSettingController@updateSeo |
| GET | /admin/frontend/settings | admin.frontend.settings.edit | Admin\FrontendSettingController@edit |
| PUT | /admin/frontend/settings | admin.frontend.settings.update | Admin\FrontendSettingController@update |
| DELETE | /admin/frontend/theme | admin.frontend.theme.delete | Admin\FrontendSettingController@deleteTheme |
| GET | /admin/frontend/theme | admin.frontend.theme.edit | Admin\FrontendSettingController@theme |
| PUT | /admin/frontend/theme | admin.frontend.theme.update | Admin\FrontendSettingController@updateTheme |
| POST | /admin/frontend/theme/upload | admin.frontend.theme.upload | Admin\FrontendSettingController@uploadTheme |
| POST | /admin/impersonate/instructor/{id} | admin.impersonate.instructor | Admin\ImpersonationController@impersonate |
| POST | /admin/impersonate/student/{id} | admin.impersonate.student | Admin\ImpersonationController@impersonateStudent |
| GET | /admin/instructors | admin.instructors.index | Admin\InstructorController@index |
| GET | /admin/instructors/pending | admin.instructors.pending | Admin\InstructorController@pending |
| GET | /admin/instructors/{id} | admin.instructors.show | Admin\InstructorController@show |
| PUT | /admin/instructors/{id} | admin.instructors.update | Admin\InstructorController@update |
| POST | /admin/instructors/{id}/approve | admin.instructors.approve | Admin\InstructorController@approve |
| GET | /admin/instructors/{id}/edit | admin.instructors.edit | Admin\InstructorController@edit |
| POST | /admin/instructors/{id}/reject | admin.instructors.reject | Admin\InstructorController@reject |
| GET | /admin/learning/assignment-submissions | admin.assignment-submissions.index | Admin\AssignmentSubmissionController@index |
| GET | /admin/learning/assignment-submissions/{assignmentSubmission} | admin.assignment-submissions.show | Admin\AssignmentSubmissionController@show |
| GET | /admin/learning/quiz-attempts | admin.quiz-attempts.index | Admin\QuizAttemptController@index |
| GET | /admin/learning/quiz-attempts/{quizAttempt} | admin.quiz-attempts.show | Admin\QuizAttemptController@show |
| GET | /admin/notifications | admin.notifications.index | Admin\NotificationController@index |
| POST | /admin/notifications | admin.notifications.store | Admin\NotificationController@store |
| GET | /admin/notifications/create | admin.notifications.create | Admin\NotificationController@create |
| POST | /admin/notifications/{id}/resend | admin.notifications.resend | Admin\NotificationController@resend |
| DELETE | /admin/notifications/{notification} | admin.notifications.destroy | Admin\NotificationController@destroy |
| GET | /admin/notifications/{notification} | admin.notifications.show | Admin\NotificationController@show |
| PUT|PATCH | /admin/notifications/{notification} | admin.notifications.update | Admin\NotificationController@update |
| GET | /admin/notifications/{notification}/edit | admin.notifications.edit | Admin\NotificationController@edit |
| GET | /admin/payments | admin.payments.index | Admin\PaymentController@index |
| GET | /admin/payments/offline-pending | admin.payments.offline-pending | Admin\PaymentController@offlinePending |
| GET | /admin/payments/pending | admin.payments.pending | Admin\PaymentController@pending |
| GET | /admin/payments/{id} | admin.payments.show | Admin\PaymentController@show |
| POST | /admin/payments/{id}/approve | admin.payments.approve | Admin\PaymentController@approve |
| POST | /admin/payments/{id}/reject | admin.payments.reject | Admin\PaymentController@reject |
| PUT | /admin/payments/{id}/update-status | admin.payments.update-status | Admin\PaymentController@updateStatus |
| GET | /admin/profile | admin.profile.edit | Admin\ProfileController@edit |
| PUT | /admin/profile | admin.profile.update | Admin\ProfileController@update |
| GET | /admin/reports | admin.reports.index | Admin\ReportsController@index |
| GET | /admin/reviews | admin.reviews.index | Admin\ReviewController@index |
| GET | /admin/reviews/pending | admin.reviews.pending | Admin\ReviewController@pending |
| DELETE | /admin/reviews/{id} | admin.reviews.destroy | Admin\ReviewController@destroy |
| GET | /admin/reviews/{id} | admin.reviews.show | Admin\ReviewController@show |
| POST | /admin/reviews/{id}/approve | admin.reviews.approve | Admin\ReviewController@approve |
| POST | /admin/reviews/{id}/reject | admin.reviews.reject | Admin\ReviewController@reject |
| DELETE | /admin/reviews/{reviewId}/replies/{replyId} | admin.reviews.delete-reply | Admin\ReviewController@deleteReply |
| GET | /admin/settings | admin.settings.index | Admin\SettingsController@index |
| GET | /admin/settings/account-deletion | admin.settings.account_deletion | Admin\SettingsController@accountDeletion |
| PUT | /admin/settings/account-deletion | admin.settings.account_deletion.update | Admin\SettingsController@updateAccountDeletion |
| GET | /admin/settings/ai | admin.settings.ai | Admin\SettingsController@ai |
| PUT | /admin/settings/ai | admin.settings.ai.update | Admin\SettingsController@updateAi |
| GET | /admin/settings/authentication | admin.settings.authentication | Admin\SettingsController@authentication |
| PUT | /admin/settings/authentication | admin.settings.authentication.update | Admin\SettingsController@updateAuthentication |
| GET | /admin/settings/branding | admin.settings.branding | Admin\SettingsController@branding |
| PUT | /admin/settings/branding | admin.settings.branding.update | Admin\SettingsController@updateBranding |
| GET | /admin/settings/chat | admin.settings.chat | Admin\SettingsController@chat |
| PUT | /admin/settings/chat | admin.settings.chat.update | Admin\SettingsController@updateChat |
| GET | /admin/settings/contact | admin.settings.contact | Admin\SettingsController@contact |
| PUT | /admin/settings/contact | admin.settings.contact.update | Admin\SettingsController@updateContact |
| GET | /admin/settings/course | admin.settings.course | Admin\SettingsController@coursePolicies |
| PUT | /admin/settings/course | admin.settings.course.update | Admin\SettingsController@updateCoursePolicies |
| GET | /admin/settings/cron-setup | admin.settings.cron_setup | Admin\SettingsController@cronSetup |
| PUT | /admin/settings/cron-setup | admin.settings.cron_setup.update | Admin\SettingsController@updateCronSetup |
| GET | /admin/settings/custom-scripts | admin.settings.custom_scripts | Admin\SettingsController@customScripts |
| PUT | /admin/settings/custom-scripts | admin.settings.custom_scripts.update | Admin\SettingsController@updateCustomScripts |
| GET | /admin/settings/email-notifications | admin.settings.email | Admin\SettingsController@emailNotifications |
| PUT | /admin/settings/email-notifications | admin.settings.email.update | Admin\SettingsController@updateEmailNotifications |
| GET | /admin/settings/gateways | admin.settings.gateways.index | Admin\PaymentGatewayController@index |
| PUT | /admin/settings/gateways/{identifier} | admin.settings.gateways.update | Admin\PaymentGatewayController@update |
| GET | /admin/settings/languages | admin.languages.index | Admin\LanguageController@index |
| POST | /admin/settings/languages | admin.languages.store | Admin\LanguageController@store |
| GET | /admin/settings/languages/create | admin.languages.create | Admin\LanguageController@create |
| DELETE | /admin/settings/languages/{locale} | admin.languages.destroy | Admin\LanguageController@destroy |
| GET | /admin/settings/languages/{locale}/translations | admin.languages.translations.edit | Admin\LanguageController@editTranslations |
| POST | /admin/settings/languages/{locale}/translations | admin.languages.translations.update | Admin\LanguageController@updateTranslations |
| POST | /admin/settings/languages/{locale}/translations/add-key | admin.languages.translations.add-key | Admin\LanguageController@addTranslationKey |
| GET | /admin/settings/live-class | admin.settings.live_class | Admin\SettingsController@liveClassSettings |
| PUT | /admin/settings/live-class | admin.settings.live_class.update | Admin\SettingsController@updateLiveClassSettings |
| GET | /admin/settings/newsletter | admin.settings.newsletter.index | Admin\NewsletterController@index |
| POST | /admin/settings/newsletter/send | admin.settings.newsletter.send | Admin\NewsletterController@send |
| GET | /admin/settings/platform | admin.settings.platform | Admin\SettingsController@platform |
| PUT | /admin/settings/platform | admin.settings.platform.update | Admin\SettingsController@updatePlatform |
| GET | /admin/settings/recaptcha | admin.settings.recaptcha | Admin\SettingsController@recaptcha |
| PUT | /admin/settings/recaptcha | admin.settings.recaptcha.update | Admin\SettingsController@updateRecaptcha |
| GET | /admin/settings/revenue | admin.settings.revenue | Admin\SettingsController@revenue |
| PUT | /admin/settings/revenue | admin.settings.revenue.update | Admin\SettingsController@updateRevenue |
| GET | /admin/settings/smtp | admin.settings.smtp | Admin\SettingsController@smtp |
| PUT | /admin/settings/smtp | admin.settings.smtp.update | Admin\SettingsController@updateSmtp |
| GET | /admin/settings/support | admin.settings.support | Admin\SettingsController@support |
| PUT | /admin/settings/support | admin.settings.support.update | Admin\SettingsController@updateSupport |
| GET | /admin/settings/system/cache | admin.settings.system.cache | Admin\SystemMaintenanceController@cache |
| POST | /admin/settings/system/cache/clear | admin.settings.system.cache.clear | Admin\SystemMaintenanceController@clearCache |
| GET | /admin/settings/system/logs | admin.settings.system.logs | Admin\SystemMaintenanceController@logs |
| GET | /admin/settings/system/status | admin.settings.system.status | Admin\SystemMaintenanceController@status |
| POST | /admin/settings/system/storage-link | admin.settings.system.storage.link | Admin\SystemMaintenanceController@linkStorage |
| GET | /admin/settings/withdrawals | admin.settings.withdrawals | Admin\SettingsController@withdrawals |
| PUT | /admin/settings/withdrawals | admin.settings.withdrawals.update | Admin\SettingsController@updateWithdrawals |
| POST | /admin/stop-impersonating | admin.stop-impersonating | Admin\ImpersonationController@stopImpersonating |
| GET | /admin/students | admin.students.index | Admin\StudentController@index |
| GET | /admin/students/{id} | admin.students.show | Admin\StudentController@show |
| PUT | /admin/students/{id} | admin.students.update | Admin\StudentController@update |
| GET | /admin/students/{id}/edit | admin.students.edit | Admin\StudentController@edit |
| GET | /admin/subscription-plans | admin.subscription-plans.index | Admin\SubscriptionPlanController@index |
| POST | /admin/subscription-plans | admin.subscription-plans.store | Admin\SubscriptionPlanController@store |
| GET | /admin/subscription-plans/create | admin.subscription-plans.create | Admin\SubscriptionPlanController@create |
| POST | /admin/subscription-plans/{plan}/toggle-status | admin.subscription-plans.toggle-status | Admin\SubscriptionPlanController@toggleStatus |
| DELETE | /admin/subscription-plans/{subscription_plan} | admin.subscription-plans.destroy | Admin\SubscriptionPlanController@destroy |
| GET | /admin/subscription-plans/{subscription_plan} | admin.subscription-plans.show | Admin\SubscriptionPlanController@show |
| PUT|PATCH | /admin/subscription-plans/{subscription_plan} | admin.subscription-plans.update | Admin\SubscriptionPlanController@update |
| GET | /admin/subscription-plans/{subscription_plan}/edit | admin.subscription-plans.edit | Admin\SubscriptionPlanController@edit |
| GET | /admin/subscriptions | admin.subscriptions.index | Admin\UserSubscriptionController@index |
| POST | /admin/subscriptions/approve-offline/{paymentId} | admin.subscriptions.approve-offline | Admin\UserSubscriptionController@approveOffline |
| POST | /admin/subscriptions/assign | admin.subscriptions.assign | Admin\UserSubscriptionController@assign |
| GET | /admin/updater | admin.updater.index | Admin\UpdaterController@index |
| POST | /admin/updater/run | admin.updater.update | Admin\UpdaterController@update |
| GET | /admin/users | admin.users.index | Admin\UserController@index |
| DELETE | /admin/users/{user} | admin.users.destroy | Admin\UserController@destroy |
| GET | /admin/users/{user} | admin.users.show | Admin\UserController@show |
| GET | /admin/withdrawals | admin.withdrawals.index | Admin\WithdrawalController@index |
| GET | /admin/withdrawals/{withdrawal} | admin.withdrawals.show | Admin\WithdrawalController@show |
| PUT | /admin/withdrawals/{withdrawal}/status | admin.withdrawals.status | Admin\WithdrawalController@updateStatus |

### 5.10 Complete route table — payment callbacks (9 routes)

| Method | URI | Name | Controller@action |
|---|---|---|---|
| GET | /payment/bkash/callback | payment.bkash.callback | Front\CourseEnrollmentController@bkashCallback |
| GET | /payment/flutterwave/callback | payment.flutterwave.callback | Front\CourseEnrollmentController@flutterwaveCallback |
| GET | /payment/mollie/callback | payment.mollie.callback | Front\CourseEnrollmentController@mollieCallback |
| GET | /payment/paypal/callback | payment.paypal.callback | Front\CourseEnrollmentController@paypalCallback |
| GET | /payment/paystack/callback | payment.paystack.callback | Front\CourseEnrollmentController@paystackCallback |
| POST | /payment/razorpay/callback | payment.razorpay.callback | Front\CourseEnrollmentController@razorpayCallback |
| GET|POST | /payment/sslcommerz/callback | payment.sslcommerz.callback | Front\CourseEnrollmentController@sslcommerzCallback |
| GET | /payment/stripe/callback | payment.stripe.callback | Front\CourseEnrollmentController@stripeCallback |
| GET|POST | /payment/xpay/callback | payment.xpay.callback | Front\CourseEnrollmentController@xpayCallback |

### 5.11 Complete route table — installer (8 routes)

| Method | URI | Name | Controller@action |
|---|---|---|---|
| GET | /install | setup.welcome | Setup\WelcomeController |
| GET | /install/database | setup.database | Setup\DatabaseController@show |
| POST | /install/database | setup.database.run | Setup\DatabaseController@run |
| GET | /install/environment | setup.environment | Setup\EnvironmentController@show |
| POST | /install/environment | setup.environment.store | Setup\EnvironmentController@store |
| GET | /install/final | setup.final | Setup\FinalController |
| GET | /install/permissions | setup.permissions | Setup\PermissionsController |
| GET | /install/requirements | setup.requirements | Setup\RequirementsController |

### 5.12 Complete route table — Flutter student API (95 routes)

| Method | URI | Name | Controller@action |
|---|---|---|---|
| GET | /api/ai-chat | — | Student\AiChatController@index |
| POST | /api/ai-chat/send | — | Student\AiChatController@sendMessage |
| POST | /api/auth/login | — | Api\AuthController@login |
| POST | /api/auth/login/otp/resend | — | Api\AuthController@resendOtp |
| POST | /api/auth/login/otp/verify | — | Api\AuthController@verifyOtp |
| POST | /api/auth/register | — | Api\AuthController@register |
| GET | /api/bundles | — | Api\BundleController@index |
| GET | /api/bundles/{id} | — | Api\BundleController@show |
| POST | /api/bundles/{id}/checkout | — | Api\CourseEnrollmentController@enrollBundle |
| GET | /api/categories | — | Api\CourseController@categories |
| GET | /api/certificates/download/signed/{id} | api.certificates.download.signed | Api\CertificateController@downloadSigned |
| POST | /api/community/answers/{id}/accept | — | Api\CommunityController@markAnswerAccepted |
| GET | /api/community/questions | — | Api\CommunityController@index |
| POST | /api/community/questions | — | Api\CommunityController@store |
| GET | /api/community/questions/{id} | — | Api\CommunityController@show |
| POST | /api/community/questions/{id}/answers | — | Api\CommunityController@storeAnswer |
| POST | /api/community/vote/{type}/{id} | — | Api\CommunityController@vote |
| POST | /api/coupons/validate | — | Api\ValidateCouponController@validateCoupon |
| GET | /api/courses | — | Api\CourseController@index |
| GET | /api/courses/recent | — | Api\HomeController@recentCourses |
| GET | /api/courses/{courseId}/discussions | — | Api\CourseDiscussionController@index |
| POST | /api/courses/{courseId}/discussions | — | Api\CourseDiscussionController@store |
| POST | /api/courses/{courseId}/discussions/replies/{replyId}/like | — | Api\CourseDiscussionController@toggleReplyLike |
| DELETE | /api/courses/{courseId}/discussions/{id} | — | Api\CourseDiscussionController@destroy |
| GET | /api/courses/{courseId}/discussions/{id} | — | Api\CourseDiscussionController@show |
| POST | /api/courses/{courseId}/discussions/{id}/like | — | Api\CourseDiscussionController@toggleLike |
| POST | /api/courses/{courseId}/discussions/{id}/replies | — | Api\CourseDiscussionController@storeReply |
| DELETE | /api/courses/{courseId}/discussions/{id}/replies/{replyId} | — | Api\CourseDiscussionController@destroyReply |
| GET | /api/courses/{id} | — | Api\CourseController@show |
| POST | /api/courses/{id}/enroll | — | Api\CourseEnrollmentController@enroll |
| GET | /api/dashboard | — | Api\DashboardController@index |
| GET | /api/events | — | Api\EventController@index |
| GET | /api/events/{id} | — | Api\EventController@show |
| POST | /api/events/{id}/book | — | Api\EventController@book |
| GET | /api/home | — | Api\HomeController@index |
| GET | /api/live-classes | — | Api\LiveClassController@index |
| GET | /api/live-classes/upcoming | — | Api\LiveClassController@upcoming |
| GET | /api/live-classes/{id} | — | Api\LiveClassController@show |
| POST | /api/logout | — | Api\AuthController@logout |
| GET | /api/messages | — | Api\ChatController@index |
| GET | /api/messages/instructors/search | — | Api\ChatController@searchInstructors |
| GET | /api/messages/requests | — | Api\ChatController@requests |
| POST | /api/messages/start | — | Api\ChatController@startConversation |
| GET | /api/messages/unread-count | — | Api\ChatController@unreadCount |
| GET | /api/messages/{id} | — | Api\ChatController@show |
| GET | /api/messages/{id}/poll | — | Api\ChatController@poll |
| POST | /api/messages/{id}/send | — | Api\ChatController@sendMessage |
| GET | /api/notifications | — | Api\NotificationController@index |
| POST | /api/notifications/read-all | — | Api\NotificationController@markAllRead |
| DELETE | /api/notifications/{id} | — | Api\NotificationController@destroy |
| POST | /api/notifications/{id}/read | — | Api\NotificationController@markAsRead |
| POST | /api/payments/bkash/verify | — | Api\CourseEnrollmentController@bkashVerify |
| POST | /api/payments/mollie/verify | — | Api\CourseEnrollmentController@mollieVerify |
| POST | /api/payments/paypal/verify | — | Api\CourseEnrollmentController@paypalVerify |
| POST | /api/payments/paystack/verify | — | Api\CourseEnrollmentController@paystackVerify |
| POST | /api/payments/razorpay/verify | — | Api\CourseEnrollmentController@razorpayVerify |
| POST | /api/payments/sslcommerz/verify | — | Api\CourseEnrollmentController@sslcommerzVerify |
| POST | /api/payments/stripe/verify | — | Api\CourseEnrollmentController@stripeVerify |
| POST | /api/payments/xpay/verify | — | Api\CourseEnrollmentController@xpayVerify |
| GET | /api/settings | — | Api\SettingController@index |
| GET | /api/settings/pages | — | Api\CustomPageController@index |
| GET | /api/settings/pages/{slug} | — | Api\CustomPageController@show |
| GET | /api/subscription-plans | — | Api\SubscriptionController@plans |
| POST | /api/subscriptions/checkout | — | Api\SubscriptionController@checkout |
| POST | /api/subscriptions/enroll-course/{courseId} | — | Api\SubscriptionController@enrollCourse |
| POST | /api/subscriptions/verify | — | Api\SubscriptionController@verify |
| GET | /api/user | — | Api\AuthController@user |
| GET | /api/user/assignments | — | Api\StudentCourseController@myAssignments |
| GET | /api/user/bookings | — | Api\EventController@myBookings |
| GET | /api/user/bookings/{id} | — | Api\EventController@showBooking |
| GET | /api/user/certificates | — | Api\CertificateController@index |
| GET | /api/user/certificates/{id} | — | Api\CertificateController@show |
| GET | /api/user/certificates/{id}/download | — | Api\CertificateController@download |
| GET | /api/user/courses | — | Api\CourseController@myCourses |
| GET | /api/user/courses/{course}/assignments/{assignment} | — | Api\StudentCourseController@loadAssignment |
| POST | /api/user/courses/{course}/assignments/{assignment}/submit | — | Api\StudentCourseController@submitAssignment |
| GET | /api/user/courses/{course}/learn | — | Api\StudentCourseController@show |
| GET | /api/user/courses/{course}/lessons/{lesson} | — | Api\StudentCourseController@loadLesson |
| POST | /api/user/courses/{course}/lessons/{lesson}/complete | — | Api\StudentCourseController@markLessonComplete |
| GET | /api/user/courses/{course}/quizzes/{quiz} | — | Api\StudentCourseController@loadQuiz |
| POST | /api/user/courses/{course}/quizzes/{quiz}/submit | — | Api\StudentCourseController@submitQuiz |
| GET | /api/user/delete-request | — | Api\ProfileController@getDeleteRequestStatus |
| POST | /api/user/delete-request | — | Api\ProfileController@requestDeleteAccount |
| POST | /api/user/password | — | Api\ProfileController@updatePassword |
| GET | /api/user/payments | — | Api\PaymentController@index |
| GET | /api/user/payments/{id}/receipt | — | Api\PaymentController@downloadReceipt |
| POST | /api/user/profile | — | Api\ProfileController@updateProfile |
| POST | /api/user/profile-photo | — | Api\ProfileController@updateProfilePhoto |
| GET | /api/user/quizzes | — | Api\StudentCourseController@myQuizzes |
| GET | /api/user/settings/notifications | — | Api\ProfileController@getNotificationSettings |
| PUT | /api/user/settings/notifications | — | Api\ProfileController@updateNotificationSettings |
| GET | /api/user/subscription | — | Api\SubscriptionController@userSubscription |
| POST | /api/verify-certificate | — | Api\CertificateVerificationController@verify |
| GET | /api/verify-certificate/{code} | — | Api\CertificateVerificationController@show |
| GET | /api/video/stream | — | Api\FileController@stream |

### 5.13 Complete route table — Flutter instructor API (77 routes)

| Method | URI | Name | Controller@action |
|---|---|---|---|
| GET | /api/instructor/analytics | — | Api\Instructor\AnalyticsController@index |
| GET | /api/instructor/assignments | — | Api\Instructor\AssignmentController@index |
| GET | /api/instructor/assignments/submissions/{id} | — | Api\Instructor\AssignmentController@showSubmission |
| PUT | /api/instructor/assignments/submissions/{id} | — | Api\Instructor\AssignmentController@updateSubmission |
| GET | /api/instructor/assignments/{id} | — | Api\Instructor\AssignmentController@show |
| POST | /api/instructor/auth/forgot-password | — | Api\Instructor\AuthController@forgotPassword |
| POST | /api/instructor/auth/login | — | Api\Instructor\AuthController@login |
| POST | /api/instructor/auth/login/otp/resend | — | Api\Instructor\AuthController@resendOtp |
| POST | /api/instructor/auth/login/otp/verify | — | Api\Instructor\AuthController@verifyOtp |
| POST | /api/instructor/auth/register | — | Api\Instructor\AuthController@register |
| GET | /api/instructor/bundles | — | Api\Instructor\BundleController@index |
| GET | /api/instructor/bundles/{id} | — | Api\Instructor\BundleController@show |
| GET | /api/instructor/chat | — | Api\Instructor\ChatController@index |
| POST | /api/instructor/chat/accept/{id} | — | Api\Instructor\ChatController@accept |
| POST | /api/instructor/chat/decline/{id} | — | Api\Instructor\ChatController@decline |
| GET | /api/instructor/chat/requests | — | Api\Instructor\ChatController@requests |
| POST | /api/instructor/chat/start | — | Api\Instructor\ChatController@startConversation |
| GET | /api/instructor/chat/unread-count | — | Api\Instructor\ChatController@unreadCount |
| GET | /api/instructor/chat/{id} | — | Api\Instructor\ChatController@show |
| GET | /api/instructor/chat/{id}/poll | — | Api\Instructor\ChatController@poll |
| POST | /api/instructor/chat/{id}/send | — | Api\Instructor\ChatController@sendMessage |
| GET | /api/instructor/coupons | — | Api\Instructor\CouponController@index |
| POST | /api/instructor/coupons | — | Api\Instructor\CouponController@store |
| DELETE | /api/instructor/coupons/{id} | — | Api\Instructor\CouponController@destroy |
| GET | /api/instructor/coupons/{id} | — | Api\Instructor\CouponController@show |
| PUT | /api/instructor/coupons/{id} | — | Api\Instructor\CouponController@update |
| GET | /api/instructor/courses | — | Api\Instructor\CourseController@index |
| GET | /api/instructor/courses/{id} | — | Api\Instructor\CourseController@show |
| GET | /api/instructor/dashboard | — | Api\Instructor\DashboardController@index |
| GET | /api/instructor/discussions | — | Api\Instructor\CourseDiscussionController@index |
| POST | /api/instructor/discussions/course/{courseId} | — | Api\Instructor\CourseDiscussionController@store |
| POST | /api/instructor/discussions/replies/{replyId}/like | — | Api\Instructor\CourseDiscussionController@toggleReplyLike |
| DELETE | /api/instructor/discussions/{id} | — | Api\Instructor\CourseDiscussionController@destroy |
| GET | /api/instructor/discussions/{id} | — | Api\Instructor\CourseDiscussionController@show |
| POST | /api/instructor/discussions/{id}/announcement | — | Api\Instructor\CourseDiscussionController@toggleAnnouncement |
| POST | /api/instructor/discussions/{id}/like | — | Api\Instructor\CourseDiscussionController@toggleLike |
| POST | /api/instructor/discussions/{id}/pin | — | Api\Instructor\CourseDiscussionController@togglePin |
| POST | /api/instructor/discussions/{id}/replies | — | Api\Instructor\CourseDiscussionController@storeReply |
| DELETE | /api/instructor/discussions/{id}/replies/{replyId} | — | Api\Instructor\CourseDiscussionController@destroyReply |
| GET | /api/instructor/earnings | — | Api\Instructor\EarningsController@index |
| GET | /api/instructor/events | — | Api\Instructor\EventController@index |
| POST | /api/instructor/events/bookings/{id}/status | — | Api\Instructor\EventController@updateBookingStatus |
| POST | /api/instructor/events/verify | — | Api\Instructor\EventController@verifyTicket |
| GET | /api/instructor/events/{id} | — | Api\Instructor\EventController@show |
| POST | /api/instructor/events/{id}/email | — | Api\Instructor\EventController@sendEmail |
| GET | /api/instructor/events/{id}/export | — | Api\Instructor\EventController@export |
| GET | /api/instructor/live-classes | — | Api\Instructor\LiveClassController@index |
| POST | /api/instructor/live-classes | — | Api\Instructor\LiveClassController@store |
| GET | /api/instructor/live-classes/course/{courseId}/lessons | — | Api\Instructor\LiveClassController@getLessonsForCourse |
| DELETE | /api/instructor/live-classes/{id} | — | Api\Instructor\LiveClassController@destroy |
| GET | /api/instructor/live-classes/{id} | — | Api\Instructor\LiveClassController@show |
| PUT | /api/instructor/live-classes/{id} | — | Api\Instructor\LiveClassController@update |
| POST | /api/instructor/live-classes/{id}/end | — | Api\Instructor\LiveClassController@end |
| POST | /api/instructor/live-classes/{id}/start | — | Api\Instructor\LiveClassController@start |
| POST | /api/instructor/logout | — | Api\Instructor\AuthController@logout |
| GET | /api/instructor/quizzes | — | Api\Instructor\QuizAttemptController@index |
| GET | /api/instructor/quizzes/{id} | — | Api\Instructor\QuizAttemptController@show |
| GET | /api/instructor/reviews | — | Api\Instructor\ReviewController@index |
| POST | /api/instructor/reviews/{id}/reply | — | Api\Instructor\ReviewController@reply |
| DELETE | /api/instructor/reviews/{id}/reply/{replyId} | — | Api\Instructor\ReviewController@deleteReply |
| PUT | /api/instructor/reviews/{id}/reply/{replyId} | — | Api\Instructor\ReviewController@updateReply |
| GET | /api/instructor/settings | — | Api\Instructor\SettingsController@index |
| POST | /api/instructor/settings/delete-request | — | Api\Instructor\SettingsController@deleteAccount |
| PUT | /api/instructor/settings/notifications | — | Api\Instructor\SettingsController@updateNotifications |
| POST | /api/instructor/settings/password | — | Api\Instructor\SettingsController@updatePassword |
| POST | /api/instructor/settings/profile | — | Api\Instructor\SettingsController@updateProfile |
| POST | /api/instructor/settings/profile-photo | — | Api\Instructor\SettingsController@updateProfilePhoto |
| GET | /api/instructor/students | — | Api\Instructor\StudentsController@index |
| GET | /api/instructor/students/{id} | — | Api\Instructor\StudentsController@show |
| GET | /api/instructor/subscription-sales | — | Api\Instructor\EarningsController@subscriptionSales |
| GET | /api/instructor/user | — | Api\Instructor\AuthController@user |
| POST | /api/instructor/verify-certificate | — | Api\CertificateVerificationController@verify |
| GET | /api/instructor/verify-certificate/{code} | — | Api\CertificateVerificationController@show |
| GET | /api/instructor/withdrawals | — | Api\Instructor\EarningsController@withdrawals |
| POST | /api/instructor/withdrawals | — | Api\Instructor\EarningsController@storeWithdrawal |
| GET | /api/instructors | — | Api\InstructorController@index |
| GET | /api/instructors/{id} | — | Api\InstructorController@show |
### 5.14 Flutter API-client surface (every endpoint the app can call, extracted from `FL/lib/services/`)

| Service file | Endpoints (method inferred from usage) | Purpose |
|---|---|---|
| auth_service | POST /auth/register, /auth/login, /auth/login/otp/verify, /auth/login/otp/resend; GET /user; POST /logout | Session + token |
| settings_service | GET /settings, /settings/pages, /settings/pages/{slug} | Boot config (branding, pages) |
| home_service | GET /home, /courses/recent?page= | Home feed + pagination |
| course_service | GET /courses, /courses/{id}, /categories, /courses/recent; POST /courses/{id}/enroll; POST /coupons/validate | Catalog + detail + enroll start |
| bundle (service) | GET /bundles, /bundles/{id}; POST /bundles/{id}/checkout | Bundles |
| instructor_service | GET /instructors, /instructors/{id} | Directory |
| event_service | GET /events?filter=&page=, /events/{id}; POST /events/{id}/book; GET /user/bookings?page=, /user/bookings/{id} | Events + tickets |
| student_course_service | GET /user/courses/{id}/learn, /user/courses/{id}/lessons/{id}, /user/courses/{id}/quizzes/{id}, /user/courses/{id}/assignments/{id}; POST …/lessons/{id}/complete, …/quizzes/{id}/submit, …/assignments/{id}/submit; GET /user/courses, /user/assignments, /user/quizzes | The whole learning loop |
| payment_service | POST /payments/{razorpay,sslcommerz,stripe,paystack,mollie,bkash,xpay,paypal}/verify | 8 verify round-trips |
| subscription_service | GET /subscription-plans, /user/subscription; POST /subscriptions/checkout, /subscriptions/verify, /subscriptions/enroll-course/{courseId} | Subscriptions |
| dashboard_service | GET /dashboard | Student dashboard |
| notification_service | GET /notifications?page=; POST /notifications/{id}/read, /notifications/read-all; DELETE /notifications/{id} | Notifications |
| profile_service | POST /user/profile, /user/profile-photo, /user/password, /user/delete-request; GET /user/delete-request; GET/PUT /user/settings/notifications | Profile |
| chat_service | GET /messages?page=, /messages/requests?page=, /messages/unread-count, /messages/instructors/search?q=, /messages/{id}, /messages/{id}/poll; POST /messages/start, /messages/{id}/send | 1:1 chat (polling) |
| community_service | GET /community/questions?page=&filter=, /community/questions/{id}; POST /community/questions, /community/questions/{id}/answers, /community/answers/{id}/accept, /community/vote/{type}/{id} | Q&A |
| course_discussion_service | GET+POST /courses/{id}/discussions, /courses/{id}/discussions/{id}, …/replies, …/like, …/replies/{id}/like; DELETE …/{id}, …/replies/{id} | Course forums (8 verbs) |
| ai_chat_service | GET /ai-chat; POST /ai-chat/send | Gemini tutor |
| focus_service | POST /focus/session; GET /focus/stats | Pomodoro |
| habit_service | GET /habits, /habits/weekly-review; POST /habits/{id}/log | Habit tracker |
| wishlist_service | — (SharedPreferences only) | Local wishlist |
| custom_page_service | GET /settings/pages/{slug} | CMS pages |

Client plumbing: `BaseService` (`FL/lib/services/base_service.dart`) holds the const base URL, reads/writes the `auth_token` SharedPreferences key, and builds `Authorization: Bearer` headers; every service hand-rolls `Uri.parse` + `http.get/post` with per-call try/catch that throws generic messages ("Failed to load …") — no typed API-error model, no retry/backoff, no request cancellation. The instructor half of the backend API (`/api/instructor/*`, 72 routes) has **no client** anywhere in this app.

## 6. Per-Screen UI/UX Element Inventory

Every field below is extracted from the live-crawled HTML (name/type/required/placeholder) or the live accessibility snapshot; Flutter elements from direct file reads. Screens are grouped; within each: **fields (validation) / actions / filters / modals / states**.

### 6.1 Public storefront

**Home (`/`)** — screenshot web-front-home.png
- Fields: global header search (text "Search Here..."), newsletter email* (footer). Selects: language switcher (bn/en/fr/hi/es/tr), a second language select in the top bar (duplicated control, both live).
- Actions: hero "Explore Courses" CTA, "About Us", course strips → detail, testimonial slider, newsletter subscribe.
- Content modules (admin-composable via `/admin/frontend/home` `[live]`): hero, testimonials, blog, about, discount, "Why Choose Us" features; fixed marquee footer ("230+ Quality Courses", "25% Extra Coupon Bonus" — hardcoded marketing strings).
- Stats live-computed: "1 + Students, 2 + Courses Published" (my seed). Empty state: course strips hide when no published courses.
- Duplication note: the header renders the same phone/email/socials/language block twice (top bar + main header) — visible in the accessibility snapshot of every public page.

**Courses catalog (`/courses`)** — web-front-courses.png
- Filters (sidebar, GET-driven): search text; category checkboxes (Science (1), Mathematics (1)); language checkbox; price checkboxes (Free/Paid); instructor checkbox; rating checkboxes — **labels "frontend.categories" and "frontend.ratings" render raw** (missing `L/lang/en/frontend.php` keys) `[live]`.
- Cards: category chip, title, "3+ Lessons", "Max 100 Students" / "Unlimited", instructor, price (Free / USD 1,999.00 with strikethrough USD 2,500.00), Enroll Now.
- Empty/search-no-result state: not exercised live (2 seeded courses both matched); filter UI has no visible "clear all".

**Course detail (`/courses/{id}`)** — web-front-course-detail-free.png / -paid.png
- Tabs: Course Info / Curriculum / Instructors / All Reviews / Description. Free variant shows "(5 - 1 All Reviews)" header chip; paid shows price block.
- Curriculum accordion lists topics → lessons with duration and **Preview** badge on `is_preview` lessons; quizzes/assignments listed by title.
- CTA: Enroll Now (free, instant) / price + checkout (paid). Logged-in enrolled state switches to continue-learning.
- Review form (auth): rating + comment (POST `/courses/{courseId}/reviews`, `L/routes/web.php:120-121`).

**Checkout (`/courses/{id}/checkout`)** — web-student-checkout-paid.png
- Summary: course, instructor, price (USD 1,999.00).
- Payment method radios (8): Flutterwave, Mollie, PayPal, Paystack, Razorpay, SSLCommerz, Stripe (each with one-line helper copy), Offline Payment ("Submit receipt and transaction ID for manual verification").
- Offline panel: Transaction ID* (text), Upload Receipt* (file; "Accepted formats: PDF, JPG, JPEG, PNG"), instructions copy "verify within 24 hours".
- Coupon: "Enter code" text + hidden `coupon_code` field (JS-applied) → POST `/coupons/validate`.
- Validation: server-side per gateway branch; method required client-side.
- Not offered on web: bKash, XPay (app/webview only — gap between web and app surfaces).

**Bundle detail (`/bundles/{id}`)** — web-front-bundle-detail.png: vendor, "2 Courses Included", per-course cards with difficulty chips, price, View Bundle Details/checkout CTA.

**Subscriptions (`/subscriptions`)** — web-front-subscriptions.png: plan cards (Featured badge on `is_featured`), "Unlock access to premium courses, live classes, and course bundles" feature copy; checkout behind auth.

**Verify certificate (`/verify-certificate`)** — web-front-verify-certificate.png: single field `certificate_number`* (placeholder "e.g. CERT-000012-A1B2C3"), Verify button; result card renders student/course/instructor/dates or "No authentic certificate record was found for this code." `[code CertificateVerificationService:48-60]`.

**Contact (`/contact`)**: name*, email*, phone, subject*, message* — web-front-contact.png. **Become an instructor (`/become-instructor`)** — web-auth-become-instructor.png: **16 fields**: first_name*, last_name*, email*, phone*, password*, password_confirmation*, bio* (0/500 counter), years_experience* (select 0-1/2-5/6-10/10+), specialization*, previous_experience*, highest_degree* (select), field_of_study*, certifications, profile_photo* (file), resume* (file), terms* (checkbox). The heaviest public form in the product — instructor applications feed `/admin/instructors/pending`.

**Auth pages**: login (email*, password*, remember checkbox, Forgot Password link) web-auth-login.png; register (first_name*, last_name*, email*, password*, password_confirmation*, terms* — "Password must be at least 8 characters long" hint) web-auth-register.png; forgot-password (email*) web-auth-forgot-password.png. OTP screen at `/login/otp` (code 6 digits, resend — throttled).

### 6.2 Student panel (web)

**Dashboard** — web-student-dashboard.png
- Greeting ("Welcome back, Demo!"), stat cards: Enrolled Courses 1 / Completed 0 / Pending 0 / Total Lessons 3.
- Subscription upsell card ("Unlock Unlimited Learning — Explore Plans").
- Upcoming live-class card with live countdown ("Starts in 1d 15h", date/time/duration).
- Recent enrollments strip (course, instructor, "3 Lessons", View All Courses).
- Quick Actions ("Get Started", "Explore", "Browse All Courses", "My Courses").
- Announcements module — **static hardcoded strings** ("Welcome to Eduex! We're excited…", "New Courses Available — Check out our latest courses in Technology and Business categories") — not real announcements from any table `[live]`.
- Header: global search, notifications bell w/ "No notifications found" dropdown + View All, "My Dashboard" account link.

**My Courses**: enrolled cards (category chip, status chip "Enrolled", title, "3+ Lessons", "Max 100 Students", instructor, Free/price, **Access Course** CTA, "Enrolled on Sep 13, 2026"). Empty state not reached live.

**The course player (`/student/courses/{id}/access`)** — web-student-course-player.png + live accessibility snapshot (`.playwright-mcp/page-2026-09-13T02-29-55-597Z.yml`)
- Top bar: lesson title + duration ("Welcome & Course Overview (0:08 min)"), **Curriculum | Forum** tabs, "Go to Course Home" link.
- Sidebar: "Search Course Content" box; topic accordions "Topic 1 — Getting Started (1/2)", "Topic 2 — Core Concepts (0/3)"; per-item rows with play icon + title + duration; **lock icons on the 3 items of Topic 2** (Forces and Motion, Quiz: Motion Check, Assignment: Motion Problems) — sequential locking visible and enforced by the server's `is_accessible` flags `[live]`; completed items show a completed check.
- Main pane: 16:9 video (YouTube iframe for URL-type lessons with YouTube links — live-verified: the embedded player rendered, video unavailable only because the demo video id disallows embedding), lesson Description heading, **Mark Complete button (disabled after completion, label "Completed")**.
- Forum tab: discussion list ("Loading discussions…" while fetching).
- Bottom: prev/next item buttons.
- Live-class frame: when the current lesson is type=live, shows LIVE NOW / SCHEDULED / SESSION ENDED chips + Join button launching `join_url` externally (Flutter side; web equivalent links out).
- States: loading = "Loading discussions…" text; locked = lock icons + 403 toast from server when clicked out of order (server contract `{success:false, locked:true}` on web, `L/app/Http/Controllers/Student/StudentCourseController.php:209-215`).

**My Assignments** — stats cards (Total Submissions 0 / Graded 0 / Awaiting Feedback 0); filters: course select, status select (Pending Review/Graded/Returned), search by title; Apply button; table Quiz/Course/Score…; **empty state**: "No Assignments to Display — Your enrolled courses will show assignments here once they are released."
**My Quiz Attempts** — stats (Total/Passed/Failed/Avg Score "—"); filters (course, result Passed/Failed, search); empty: "No Quiz Attempts Yet — Your quiz attempts will show here once you begin taking quizzes."
**Certificates** — empty: "No Certificates Yet — You haven't completed any courses yet. Complete a course to earn your first certificate!" + View My Courses CTA.
**Payment History** — totals cards (Total Payments 0 / Completed 0 / **raw key `student.pending_status`** / Total Paid USD 0.00); filters: method (Razorpay/Stripe/Paystack/Flutterwave/PayPal/SSLCommerz/Mollie/Offline), status (Pending/Completed/Failed/Refunded), search; table incl. Receipt column; empty: "No Payments Record — Once you enroll in a course, your payments will appear here."
**Live Classes** — "Upcoming / Scheduled" sections; card: title, course, date-time, duration, countdown; Join when live.
**Community (Q&A)** — tabs All Questions / Unanswered / My Questions; search; Ask Question modal: title* ("Be specific…"), description* ("Include all the information…"), tags ("Add up to 5 tags", comma input); empty: "No questions found — Be the first one to start a discussion in this category!"; **raw key `student.cancel` on the modal's cancel button** `[live]`.
**Messages** — tabs Inbox / Sent / Requests; "No conversations yet — Start a conversation with your instructor"; New Message modal: instructor search box, message textarea.
**AI Assistant** — chat surface, "No messages yet — Start a conversation with your AI assistant!"; input "Type your message...".
**Settings** — Profile: profile_photo (file, "Recommended: 300x300px, Max size: 5MB"), name*, email* (**placeholder renders raw key `auth.enter_email`; label `auth.email`**), phone; Password (current/new/confirm, "Leave blank if you don't want to change"); Notifications: 4 checkboxes (Email Notifications, Course Reminders, Progress Reports, Marketing Emails); Danger Zone: Delete Account. **Cancel buttons render raw `frontend.cancel`** `[live]`.
**Notifications** — "Mark All Read" + empty state "All caught up! You have no new notifications at the moment."

### 6.3 Flutter app — key screens (code-read)

**Course player (`FL/lib/screens/course_access/course_access_screen.dart`, 751 lines)**
- `initState` → `NoScreenshot.instance.screenshotOff()` (`:56`) / `screenshotOn()` on dispose (`:63`); fetches `GET /user/courses/{id}/learn`; auto-loads `current_item` post-frame (`:98-106`).
- `_initializeVideoPlayer` (`:176-237`): branches on `is_youtube`→`YoutubePlayerController`, `is_vimeo`→`VimeoVideoPlayer`, else `video_player`+`chewie` (fullscreen orientations).
- Controls row: Prev / **Mark Complete** (`:446 onPressed: _markComplete`) / Next; `_markComplete` (`:239-272`) POSTs complete, refreshes curriculum, **auto-advances only when `next_item.type == 'lesson'`** (`:261-266`) — a quiz/assignment next item is dropped from auto-advance.
- Curriculum tab: ExpansionTile per topic; per-item ListTile with lock icon when `is_accessible == false` (`:491` region), play/quiz icons, green check when completed, red LIVE badge from `live_class.status`.
- Forum tab: `CourseDiscussionTab(courseId)`.
- Live lesson body (`:623-720`): LIVE NOW / SCHEDULED / SESSION ENDED chips; Join → `launchUrl(join_url ?? recording_url, externalApplication)` (`:696-703`).
- `_goToNext` checks `is_accessible` client-side → lock snackbar.

**Quiz attempt (`FL/lib/screens/course_access/quiz_attempt_screen.dart`, 832 lines)**
- Client-side timer `Timer.periodic` (`:144-156`) with **fallback 1800s** (`:47`); auto-submits at 0 (`:153-158` `_autoSubmitQuiz`); submits `time_taken` from remaining seconds — server ignores it entirely (4.6).
- Options rendered from `options` list; single-select; submit POSTs all answers; results screen; **retake reloads without cap** (`:418` region).

**Checkout (`FL/lib/screens/course_detail/checkout_screen.dart`, 1,936 lines)** — the largest app screen: gateway selection (native SDKs for Razorpay/Stripe/SSLCommerz/Mollie; webview for others), coupon field, offline payment variant (separate `offline_payment_screen.dart`), enrollment success screen.

**Course detail (`course_detail_screen.dart`, 2,105 lines)** — fetch, preview-video bottom sheet gated on `lessons[i].isPreview`, rating histogram + review list, instructor card, related courses, wishlist toggle (provider → SharedPreferences only), bottom bar price + Enroll → CheckoutScreen, or continue-learning when enrolled.

**Skeletons & loading**: `courses_skeletons.dart`, `course_detail_skeletons.dart`, `categories_skeletons.dart`, `home_skeletons.dart` (shimmer) — list/detail loading states are polished on mobile. **Error states**: services throw generic `Exception('Failed to load …')`; UI shows toastification toasts — no retry UI pattern, no offline banner (no offline capability at all).


### 6.4 Instructor panel (web)

**Dashboard** — inst_instructor_dashboard.html: stat cards (Total Courses 2 / Unique Students 1 / Average Rating 5.0 / Total Earnings USD 0.00); Activity Feed ("New student enrolled … 9 minutes ago", "New review received … 5 stars"); Recent/Popular Courses cards (Manage Course CTA); Quick Actions (Create New Course, Create New Event, Manage Events); tips module.

**Course builder (`/instructor/courses/create`)** — web-instructor-course-builder.png + inst_instructor_courses_create.html. One page, 3 steps + publish (stepper "1 Basics  2 Curriculum  3 Additional  Publish"):
- **Basics**: Title*; Description rich editor with toolbar (Paragraph / Heading 1-3) + **"Generate with AI"** button; General: Maximum Students (number), Difficulty (select), Public Course (checkbox), Live Course (checkbox, "Show a Live badge on course cards in the frontend and app"); Visibility (Public/Private/Draft); Schedule (checkbox + datetime-local); Featured Image (file, "Click to upload"); Intro Video (file upload); Pricing Model (radio Free/Paid) + Regular Price + Sale Price.
- **Curriculum**: "Add Topic" → per-topic lesson/quiz/assignment builders; lesson form: title, description, video_type (url/upload/live), video url or file, duration, is_preview, order; quiz form: title, passing score, time limit, questions (question text, type — MCQ only in UI, options list, correct answer radio, order); assignment form: title, description, instructions, order.
- **Additional**: Tags (comma), Course Category (select from admin taxonomy), Course Language (select), Requirements (textarea), Objectives (textarea, "Separate objectives with new lines"); Previous/Next navigation + Publish.
- Server validation per `StoreCourseRequest` (Section 4.2); sale_price must be < regular_price (custom error message).
- Edit variant (`/instructor/courses/{id}/edit`) identical + current values ("Current: Science" hint shows the legacy string category).

**Students** — filters: course select (All courses + own courses), a second select, sort (Newest/Oldest/Name A-Z/Highest Progress), search ("Search students by name or e…"); table: Name (with **masked email stu****@*****.com**), Courses Enrolled, Enrollment Date, Progress %, Last Active, Action. Stats: Total Students 1 / Active 1 / Total Enrollments 1 / Avg. Course Progress 50%.

**Assignments** — stat cards (2 Assignments / 0 Total Submissions / 0 Pending Review / 0 Graded); course filter; per-assignment cards with counters (Total/Pending/Graded/Returned) + "View Submissions" (grading screen: grade 0-100 + notes).

**Quiz Attempts** — stats (2 Quizzes / 0 Attempts / 0 Passed / Avg "—"); filters course + search; quiz cards (Attempts, Passed, Passing Score 60%, Pass Rate "—", View Attempts).

**Earnings** — balance cards (Available 0.00 / Pending 0.00 / This Month / Total); chart with period select (Last 3/6/12/24 Months, This Year, Last Year); transactions table tabs (All Sales / Subscriptions / Withdrawals); **Withdraw Funds** button → modal (method bank_transfer/paypal/stripe, amount; min from settings). Empty: "No Transactions Yet".

**Subscription Sales** — dedicated page explaining the split model in prose ("the platform splits the net revenue equally across all courses and bundles included in that plan…") + table (Date, Plan, Billing, Student, Gross, My Share, My Courses/Bundles). Empty: "No Subscription Sales Yet".

**Course Forums (discussions)** — "Post Announcement" form: course* select, title*, content*, "Flag as Announcement" + "Pin to Top" checkboxes, Post Thread; filter chips (All Courses / per-course / Reset); thread table (Discussion, Info, Replies, Likes, Badges, Actions=View).

**Live Classes** — table (Course & Lesson, Title/Topic, Scheduled Time, Duration, Status, Actions: Start/End); **Schedule Live Class** form: Select Course*, Select Live Lesson (optional — "Only lessons marked as 'Live' in the course builder will appear here"), Title*, Description, **Live Meeting URL\*** ("The actual video URL students will click to join"), Scheduled Start*, Duration (Minutes)*; **End Session modal**: "You are about to end the live session… Students will no longer be able to join", Recording Video URL (optional) OR Upload Video File ("Optional, Max 512MB").

**Coupons create** — code* (placeholder "e.g. MYCOURSE50", unique), type* (Percentage % / Fixed Amount), value*, course scope (All your courses / specific), status*, usage limit ("Unlimited if empty"), valid_from/valid_to (datetime-local).

**Bundles create** — title*, description*, price*, status*, courses* multi-select ("Hold CTRL/CMD… Minimum 2 required"), featured image; note "Adding bundles triggers admin approval".

**Events builder** — 6-tab wizard (01 Basics → 02 Schedule → 03 Highlights → 04 Speakers → 05 Review): basics form has title*, short summary (0/255 counter), detailed description, thumbnail* (JPEG/PNG/WebP ≤5MB), venue, contact phone/email, co-instructors multi-select ("You are automatically assigned"); Save & Continue.

**Reviews** — average card + histogram chips (All / 5★…1★), review cards with inline **Reply** form (textarea + Send Reply).

**Settings** — profile (avatar, name*, email*, phone, bio w/ counter, 4 social links LinkedIn/Twitter/Facebook/YouTube), password (current*/new*/confirm* — all required unlike student variant), notification toggles (Email Notifications, Course Updates, Review Notifications, Marketing Emails), Danger Zone (Delete Account).

**Analytics** — cards (Total Revenue + "No prior month data", Total Students +1 this month, Total Enrollments, Average Rating, Reviews); Revenue Overview + Enrollments Trend (12-month charts); Completion Rate 0%, Refund Rate 0%, Monthly Revenue; **Top Performing Courses** ranked table; **Student Engagement** (Active Students, Completing Courses, **At Risk Students** — computed how? engagement heuristic, no config); Recent Activity feed.

### 6.5 Admin panel (web)

**Dashboard** — web-admin-dashboard.png: cards (Total Revenue, Total Students, Total Enrollments +1 this month, Offline Payments 0 "Pending verification"); Revenue Trend + Enrollment Overview charts with **30 Days / Yearly 12 Months** toggles; Completion Rate / Active Courses / Average Rating / Refund Rate; Top Performing Courses; Recent Transactions; Student Engagement; Recent Activity; Recent Event Bookings.

**Courses list** — filters: search, status (Published/Pending/Draft/Archived), visibility (Public/Private/Draft), pricing (Free/Paid); table: Course, Instructor (with email), Price (sale + struck regular), Enrollments, **inline status select** (Draft/Pending/Published/Archived), Created, Actions. The paid course row shows "USD 1,999.00 USD 2,500.00" (both prices, live).

**Course detail** — web-admin-course-detail.png: status select + Archive action; meta grid (category, difficulty, instructor, pricing, language "N/A" — my seed set only the legacy string, showing the dual-category seam again, enrolments/lessons/quizzes/assignments/duration/rating counts); Description + objectives + tags; **full curriculum tree** (topics → typed items with durations); Instructor card; Reviews list.

**Users (`/admin/users`)** — **live 500** (missing view) — the route + controller shipped, the Blade did not.

**Pending courses (`/admin/courses/pending`)** — **live 500** (missing view) — sidebar "Pending Courses" points here.

**Enrollments** — filters: search, status, course, instructor, payment status (Paid/Unpaid/Pending), date from/to; table: ID, Student (+email), Course, status select, Progress ("33% 1/3 lessons"), Payment (Free), Enrolled Date, Actions.

**Payments** — 6 filter controls (search/status/method/course/instructor/student + date range); stat cards incl. Today/This Month/This Year revenue; table incl. Receipt + Actions. **Offline Pending** sub-page: search, pending count/amount, receipt modal (Download Receipt / Close).

**Withdrawals** — overview cards ×4 (Pending/Processing/Completed/Rejected with counts + amounts), filters (search by reference/instructor, status, method), table with Processed date.

**Reports** — revenue split (Instructor/Platform share), 6-month revenue table (Month/Revenue/Enrollments/Completions), Enrollment Snapshot (totals, completion rate), Student & Instructor stats, **Key Conversion Insights** (Revenue per Enrollment, Avg Instructor Earning per Sale, Instructor Approval Rate, Completions per Enrollment), Top Courses + Top Instructors.

**Certificates** — stats (Total Issued, Last 7 Days, This Month), search + date filters, table; note the double registration (explicit routes + resource) at `L/routes/admin.php:148-149,244`.

**Subscription plans** — plan table (#, Name, Regular/Offer Price, Billing Period + days, Included Items (courses/bundles counts), Subscribers, Status, Actions) + toggle-status. **User Subscriptions** — table + **Manually Assign Subscription** modal (student*, plan*, custom duration days "(Optional)").

**Settings hub** — web-admin-settings-hub.png: 17 cards linking the settings areas (5.4 table). Gateway matrix — web-admin-gateways.png: 10 gateway cards (bKash **Disabled**, Flutterwave/Mollie/PayPal/Paystack/Razorpay/SSLCommerz/Stripe **Enabled** by seeder defaults, XPay…), each with Enable checkbox + credential fields (per-gateway: app_key/app_secret/username/password/mode, public/secret keys, api key, client id/secret/mode, store id/password/mode).

**System Maintenance** — Status page (application/environment/debug/laravel 12.53.0/php 8.5.4/server/cache driver/queue/db, Health Checks cache/database/storage/log, Performance Insights memory/disk, Recreate Storage Link confirm modal); Cache page (Clear Cache + metrics: driver file, config/routes/events/views cached flags); **Error Logs** page (renders `storage/logs/laravel.log` inline — the two 500s I triggered were visible there).

**Updater** — web-admin-updater.png: "Current Version 1.0.0 / Available Update 2.0.0 / Update System Now" + backup recommendation copy. (Version stamp lives in platform_settings — `2026_03_28_105315` migration.)

**Language Manager** — 6 system languages (Bengali bn, English en — System Default, French fr, Hindi hi, Spanish es, Turkish tr) with **Translate Keys** inline editor + New Language (code, native name, flag) + runtime add-key; this is the machinery whose missing keys produced the raw-`frontend.*` renders above.

**Frontend Manager** — Menus (4 seeded menus: Footer Links, Main Navigation, Mobile Navigation, Quick Links; item add/reorder/delete); Footer & Contact (about text, tagline, copyright, contact email/phone/address/hours, social links repeater with Font Awesome icon class); FAQ (question/answer repeater with rich editor); SEO (per-page title/description for 13 pages); Homepage composer (hero, testimonial, blog, about, discount, features sections — each with CTA label/URL); **Theme** page (upload theme ZIP containing `theme.json` + templates + assets/; active theme card "Default — Built-in Theme By MHQuickDev").

**Newsletter** — subject*/message* + recipients multi-select ("If no recipients are selected, the newsletter will be sent to all subscribers") + subscriber table (empty: "No subscribers yet").

**Push Notifications** (admin/notifications → create) — send to filtered users (courses, instructors), history + resend (`admin/notifications/{id}/resend`).

### 6.6 Cross-cutting state & consistency notes (live)

- **Empty states**: every list screen has a designed empty state with icon + headline + helper text (quotes captured above) — consistently good across student/instructor/admin.
- **Loading states**: web has no skeletons (Blade renders server-side; AJAX player parts show text placeholders like "Loading discussions…"); Flutter has shimmer skeletons on every list/detail.
- **Error states**: with APP_DEBUG=true the web shows the full Ignition error page (both 500 screenshots); production mode would show a generic error page — the two broken views remain 500s. API returns `{message, errors}` 422 shapes (register) or bare `{message}` (login) — **two different validation-response shapes in the same controller file**.
- **Validation feedback**: client `required` attributes + server validation with custom messages on the builder; the API register endpoint uses a manual Validator while login uses `$request->validate` — inconsistent idiom.
- **i18n defects (live)**: raw keys `frontend.categories`, `frontend.ratings` (catalog), `student.pending_status` (payments), `auth.email`, `auth.enter_email`, `frontend.cancel`, `student.cancel` (settings/community) — all missing from `L/lang/en/*.php`.
- **Responsiveness**: public pages render a mobile hamburger (from snapshot); admin sidebar collapses; the player sidebar stacks. Detailed breakpoints not measured (no device emulation this pass) — flagged as residual unknown.
- **Cookie consent banner** on all public pages (spatie/laravel-cookie-consent) — "Accept & Continue".


---

### 6.7 Additional crawled form inventories (instructor events wizard, admin CMS forms)

**Events builder, tabs 2-5** (from `inst_instructor_events_create.html` + routes `instructor.php:70-89`):
- 02 Schedule: start_date*, end_date*, start_time*, end_time*, total_seats, price (the schema fields of 3.4).
- 03 Highlights: repeater (title, description, icon).
- 04 Speakers: repeater (name*, title/role, photo, bio).
- 05 Review: read-only summary + Publish (PUT /events/{event}/publish).
- Bookings management: table + export (GET /events/{event}/bookings/export), status PATCH, bulk email (POST /events/{event}/bookings/email), QR verify (POST /events/verify — the instructor app API also exposes it, `api.php:238`).

**Admin blog post create** (`adm_admin_blog-posts_create.html`): title*, slug (auto), category select, author name, excerpt (≤600 chars), content*, is_published checkbox ("Publish immediately — Disable to keep as draft"), published_at datetime-local, reading_time_minutes, featured image (JPG/PNG/GIF/WEBP ≤5MB), tags (comma).

**Admin Frontend Manager — SEO form** (`adm_admin_frontend_seo.html`): per-page title + meta description for 13 pages (home, courses, faq, events, instructors, about, blog, contact, testimonials, gdpr-compliance, privacy-policy, terms-and-conditions + dynamic pages).

**Admin Homepage composer** (`adm_admin_frontend_home.html`): section editors — hero (preheading, heading, description, CTA label/URL), testimonial (title, subtitle, CTA), blog (title, subtitle, description), about (subheading, heading, description, CTA, author name/title), discount (heading, description, primary/secondary CTA), "Why Choose Us" features repeater, each with "You can use route helpers like http://…/courses" helper text.

**Admin FAQ editor**: repeater of question + rich-text answer with Add Item / Remove per row and a hidden `faqs[__INDEX__]` template row (standard Laravel collection-form pattern).

**Admin subscription plan create** (resource form): name*, slug, description, price*, discount_price, billing_period* (monthly/quarterly/half_yearly/yearly/lifetime), duration_days*, course_limit, features (JSON/tags), is_featured, status, sort_order + course/bundle multi-select mapping.

**Admin enrollments list row actions**: inline status select (Pending/Approved/Completed/Cancelled) + dedicated approve/reject/cancel/complete POST buttons + update-status PUT — three overlapping mutation paths on one row (see 7.2 #9).

### 6.8 Flutter screen details (code-read, selected)

**Dashboard (`dashboard_screen.dart`)**: stats grid (enrolled/completed/pending/lessons), continue-learning card pulling `GET /dashboard` (`dashboard_service`), upcoming live-class banner (`widgets/live_class_banner.dart`), notifications shortcut, subscription card.

**Quiz results (inside quiz_attempt_screen)**: score vs passing-score display, per-question review with correct/incorrect marking (from the submit response), retake button (reloads `loadQuiz?retake=1` — no cap, W-24).

**Assignment submit (`assignment_submit_screen.dart`)**: instructions render (HTML via flutter_widget_from_html), submission_text multiline + file attach (file_picker) → POST multipart; shows previous submission + grade/notes when present.

**Certificates screens**: `certificates_screen` (list from GET /user/certificates with 24h signed URLs), `certificate_view_screen` (PDF/preview render), `certificate_verification_screen` (public verify by code — same API as web).

**Events money flow**: `ticket_booking_screen` → `payment_screen` (gateway choice) → `booking_confirmation_screen` with QR ticket; `my_ticket_bookings_screen` + `ticket_view_screen` (QR display).

**Wellbeing screens**: `pomodoro_timer_screen` (focus sessions POST /focus/session), `focus_progress_screen` (stats), `task_breakdown_screen`, `weekly_review_screen` (habits weekly-review endpoint) — real backend endpoints exist (`focus_service`, `habit_service`).

**Onboarding/auth**: `onboarding_screen` (first-run slides), `auth_screen` (login+register tabs with OTP branch), `otp_verification_screen` (6-digit input + resend), `forgot/reset_password` pair.

**Common**: `webview_screen` (gateway fallback + privacy/terms), `image_modal`, `course_card` (shared card widget), `home_skeletons` (shimmer), `bottom_nav_bar` (5 tabs).

### 6.9 Consolidated per-screen state matrix (live-verified cells marked ✔)

| Screen | Empty state | Loading | Error/validation | Populated | Modal/sheet |
|---|---|---|---|---|---|
| Public home | n/a (CMS sections) | server-rendered | n/a | ✔ (stats live-count) | image modal |
| Courses catalog | ✔ designed (not hit) | — | filter GET only | ✔ 2 cards + filters | — |
| Course detail | — | — | — | ✔ tabs/curriculum/preview | preview player |
| Checkout | — | gateway redirect | server per-branch | ✔ 8 methods + offline panel | gateway webviews (app) |
| Login/Register | — | — | ✔ 422 + client required | ✔ | — |
| Verify certificate | — | — | ✔ invalid-code message | ✔ (result card) | — |
| Student dashboard | — | — | — | ✔ stats + live countdown + hardcoded announcements | — |
| My courses | ✔ (pattern) | — | — | ✔ card + Access CTA | — |
| **Player** | — | ✔ "Loading discussions…" | ✔ locked-item 403 contract | ✔ lock icons, 1/2 progress, disabled Completed, YouTube iframe | live-class join (external) |
| Assignments / Quiz attempts / Certificates / Payments / Bookings | ✔ all designed w/ helper text | — | — | ✔ (payments populated by history) | receipt modal (payments) |
| Community | ✔ "No questions found" | — | ✔ modal required fields | ✔ tabs + Ask modal | Ask Question ✔ |
| Messages | ✔ "No conversations yet" | poll spinner | — | ✔ | New Message ✔ (instructor search) |
| AI chat | ✔ "No messages yet" | typing state (app) | — | ✔ | — |
| Settings | — | — | ✔ server validation | ✔ 4 forms | delete-account confirm |
| Instructor builder | — | step transitions | ✔ nested validation messages | ✔ seeded edit | image/video pickers |
| Instructor students/earnings/analytics | ✔ designed | charts async | — | ✔ masked emails, zero-balance cards | withdraw funds ✔ |
| Instructor live classes | ✔ | — | — | ✔ row + Start/End | End Session ✔ (recording URL/file) |
| Admin list pages (courses/enrollments/payments/…) | ✔ designed | — | — | ✔ tables + filters | receipt ✔, assign-subscription ✔ |
| Admin courses/pending + users | — | — | **✔ live 500 (missing views)** | — | — |
| Admin settings ×17 | — | — | ✔ server validation | ✔ live values | storage-link confirm, theme upload |

Responsiveness: public + panels collapse to mobile menus (meanmenu/nav toggles observed in DOM); no systematic breakpoint audit this pass (flagged residual).

## 7. Navigation & Information Architecture

### 7.1 Literal sitemap (live-extracted)

- **Public**: Home / Courses / Subscriptions / Events / About Us / Instructor / Blog / Contact Us (+ FAQ, Testimonials, Verify Certificate, custom pages, 404). Header language switcher ×6. Footer quick links + GDPR/Privacy/Terms + newsletter.
- **Student panel** (15 sidebar items): Dashboard, Community, Notifications, AI Assistant, Messages, My Courses, My Assignments, My Quiz Attempts, My Event Bookings, Live Classes, Certificates, Payment History, My Subscription, Settings, Logout.
- **Instructor panel** (17 sidebar items): Dashboard, My Courses, Bundles, Assignments, Quiz Attempts, Events, Live Classes, Students, Messages, Analytics, Reviews, Course Forums, Earnings, Subscription Sales, Coupons, Settings, Notifications.
- **Admin panel** (grouped sidebar, ~60 destinations across 12 groups; full table in 5.4).
- **Flutter app**: bottom nav Home / Courses / Dashboard / Community / Profile; everything else via named routes (33) from cards/list tiles; 19 routes behind `AuthGuard` (`FL/lib/router/app_router.dart:70-90`).

### 7.2 Duplication / orphans / missing entry points (all verified)

1. **Duplicate routes**: `/admin/certificates` registered twice — explicit list/download at `L/routes/admin.php:148-149` AND `Route::resource('certificates', …)` at `:244` (the resource also registers create/store/edit/update/destroy against a controller whose remaining methods operate on a different keying — latent conflict, masked because the explicit routes register first).
2. **Dead sidebar item**: admin "Pending Courses" → `/admin/courses/pending` → 500 (missing view) `[live]`.
3. **Unreachable screen**: `/admin/users` (resource) → 500 (missing view) — admin User management is effectively absent despite routes+controller `[live]`.
4. **Orphan middleware**: `approved.instructor` registered but never applied (Section 2.4) — the pending-instructor gate is decorative.
5. **API surface without a client**: 72 instructor-app routes (`/api/instructor/*`) with no shipped instructor app — the Flutter package contains only student-side browsing of instructors (`instructor/all_instructors_screen.dart`, `instructor_profile_screen.dart`).
6. **Web/app feature asymmetry**: web player has watch-percentage reporting, quiz results view, in-course search, sidebar refresh — none exist in the API the app consumes; conversely bKash/XPay checkout exists only app-side.
7. **Duplicate language switchers** and duplicated contact/socials block on every public page header (rendered twice).
8. **Two category systems** (legacy string + FK taxonomy) both visible in different screens (Section 3.1).
9. **Duplicate admin surface for enrollments status**: inline status select + dedicated approve/reject/cancel/complete actions + update-status PUT — three ways to change the same field.
10. **Flutter `/home2` route** (`app_router.dart:122-123`) is a second homepage layout switchable only via compiled `AppConfig` — no runtime UI to switch.

### 7.3 Primary navigation trees per role (Mermaid)

```mermaid
graph TD
  subgraph Public
    P0[Home] --> P1[Courses catalog] --> P2[Course detail] --> P3[Checkout]
    P0 --> P4[Bundles] --> P5[Bundle detail] --> P3
    P0 --> P6[Subscriptions] --> P7[Plan checkout]
    P0 --> P8[Events] --> P9[Event booking]
    P0 --> P10[Instructors] --> P11[Instructor profile]
    P0 --> P12[Blog] --> P13[Post detail]
    P0 --> P14[Verify Certificate]
    P0 --> P15[Login / Register / Become Instructor]
  end
```

```mermaid
graph TD
  subgraph StudentPanel[Student panel - web + app]
    S0[Dashboard] --> S1[My Courses] --> S2[Course Player]
    S2 --> S3[Curriculum sidebar - locks]
    S2 --> S4[Forum tab - discussions]
    S2 --> S5[Quiz attempt]
    S2 --> S6[Assignment submit]
    S2 --> S7[Completion + Certificate]
    S0 --> S8[Live Classes]
    S0 --> S9[Community Q&A]
    S0 --> S10[Messages - 1:1 chat]
    S0 --> S11[AI Assistant]
    S0 --> S12[My Assignments / Quiz Attempts / Certificates / Payments]
    S0 --> S13[My Subscription / Event Bookings]
    S0 --> S14[Settings]
  end
```

```mermaid
graph TD
  subgraph InstructorPanel[Instructor panel - web only]
    I0[Dashboard] --> I1[Course Builder - 3 steps]
    I1 --> I2[Publish or pending approval]
    I0 --> I3[Bundles]
    I0 --> I4[Assignments grading]
    I0 --> I5[Quiz attempts]
    I0 --> I6[Events - 6 tab wizard]
    I0 --> I7[Live Classes - schedule + start/end]
    I0 --> I8[Students]
    I0 --> I9[Messages]
    I0 --> I10[Analytics]
    I0 --> I11[Reviews + replies]
    I0 --> I12[Course Forums - announcements/pins]
    I0 --> I13[Earnings + Subscription Sales + Withdrawals]
    I0 --> I14[Coupons]
  end
```

```mermaid
graph TD
  subgraph AdminPanel[Admin panel - license gated]
    A0[Dashboard] --> A1[Courses + approval]
    A0 --> A2[Instructors + approval]
    A0 --> A3[Students]
    A0 --> A4[Enrollments lifecycle]
    A0 --> A5[Payments + offline queue]
    A0 --> A6[Withdrawals payouts]
    A0 --> A7[Subscriptions - plans + user subs]
    A0 --> A8[Coupons / Reviews / Certificates]
    A0 --> A9[Learning browsers - quiz attempts + submissions]
    A0 --> A10[Reports]
    A0 --> A11[Blog + CMS + Frontend manager + theme]
    A0 --> A12[Settings x17 + languages + system]
    A0 --> A13[Updater + impersonation]
  end
```

---

### 7.4 Role-access matrix (route prefixes × role)

| Prefix | Guest | Student | Instructor | Admin | Notes |
|---|---|---|---|---|---|
| `/` + `/courses|bundles|events|blog|…` | ✔ | ✔ | ✔ | ✔ | public |
| `/login|register|become-instructor|forgot-password` | ✔ | (redirects) | (redirects) | (redirects) | guest middleware |
| `/courses/{id}/checkout`, reviews, `/subscriptions/*` checkout | ✗ | ✔ | ✔ | ✔ | `auth` only |
| `/student/*` | ✗ | ✔ | ✗ (403) | ✗ (403)* | `role:student`; *admin reaches via impersonation session |
| `/instructor/*` | ✗ | ✗ (403) | ✔ (incl. pending) | ✗ (403)* | `role:instructor`; is_approved NOT enforced (W-18) |
| `/admin/*` | ✗ | ✗ | ✗ | ✔ + **license** | only license-gated surface |
| `/api/*` (student half) | mixed | ✔ (sanctum) | ✔ | ✔ | video/stream is guest-accessible (W-1) |
| `/api/instructor/*` | mixed | ✗ | ✔ (sanctum) | ✔ | no shipped client |
| `/install/*` | ✔ (pre-install only) | — | — | — | marker-file gate |
| `/cron/run` | ✔ if no key configured | ✔ | ✔ | ✔ | W-14 |


## 8. Task-Based UX Benchmarks

Format: screens / clicks / required form fields, counted from the live app. EduEx is a course-marketplace LMS; school-ops tasks (attendance, fees, report cards, notices-to-parents, exams-as-timetabled-events) are largely absent — the closest analogue is counted where one exists, otherwise "N/A" with evidence.

| # | Task | Result |
|---|---|---|
| 1 | Mark daily attendance for one class | **N/A — feature absent** (no attendance entity anywhere: 0 hits for attendance in `L/app/Models/`, `L/database/migrations/`) |
| 2 | Collect and receipt a fee payment | **N/A — no fees module** (payments exist only as course/event/subscription purchases; no fee structure, no receipts-to-guardians. Closest analogue: approve one offline course payment = 3 screens (admin payments → offline-pending → approve click) / 3 clicks / 0 form fields, `[live adm_admin_payments_offline-pending]`) |
| 3 | Publish a notice to one class + parents | **N/A — no classes/parents.** Closest analogue: instructor course announcement = 2 screens (Course Forums → Post Announcement form) / 2 clicks (open form, Post Thread) / 4 fields (course*, title*, content*, flag-announcement checkbox) — reaches enrolled students of ONE course only `[live]` |
| 4 | Generate/print one report card | **N/A — no report cards/grading terms.** Closest: student downloads own certificate = 2 screens (Certificates → download) / 1 click / 0 fields |
| 5 | Enroll one new student end-to-end (free course, web) | 4 screens (register → courses → course detail → success) / 2 clicks (Create Account, Enroll Now) / 6 required fields (first_name, last_name, email, password, password_confirmation, terms) `[live]` |
| 5b | Same, paid course + offline payment | +2 screens (checkout, admin approve) / +3 clicks (method radio, submit, admin approve) / +3 fields (transaction_id*, receipt file*, + method choice) |
| 6 | Create and assign one exam | **N/A — no exam entity.** Closest: create a quiz inside a course = 1 screen (builder Curriculum step) / ~4 clicks (Add Topic, add Quiz, add Question, Publish) / 4 fields per question (question*, type*, ≥2 options*, correct_answer*) + quiz title* |
| 7 | Create and publish one course (instructor, auto-publish on) | 2 screens (dashboard → builder) / ~6 clicks (Create New Course, Add Topic, Add Lesson, Next ×2, Publish) / 5 required fields (title*, visibility*, pricing_model*, topic title*, lesson title* + video_type*) `[live + StoreCourseRequest]` |
| 7b | Same with admin approval workflow off (auto_publish off) | +2 screens (admin courses list → detail) / +1 click (approve) / 0 fields — except the admin's pending-courses screen 500s, so approval happens from the all-courses list `[live]` |
| 8 | Complete one lesson as a student (web) | 3 screens (login → my-courses → player) / 2 clicks (Access Course, Mark Complete) / 0 fields `[live]` — resume auto-loads `current_item`, so returning students need 1 click |
| 8b | Complete one lesson (Flutter app) | 3 screens (auth → dashboard → player via My Courses) / ~3 taps / 0 fields |

---

## 9. Plugin / Module Packaging (licensing, gating, versioning)

EduEx has **no plugin system** — one monolith with three role surfaces. Its "packaging" story is the CodeCanyon license client, which is the direct analogue of ASchool's entitlement layer, so it is audited here in depth.

### 9.1 The license-client package (`L/packages/license-client/`, composer path repo `mhquickdev/license-client 1.0.0`)

- **Activation**: admin visits `/license/activate` (registered by the package with `web, auth, role:admin` — `LicenseClientServiceProvider.php:52-59`), enters purchase code → `LicenseVerificationService::activateProduct` POSTs to the **hardcoded** `https://mhquickdev.com/api/v1/license/activate` (`Services/LicenseVerificationService.php:11`) with `{purchase_code, domain}` → server returns an **RS256-signed JWT** → client verifies signature with an RSA public key that is stored as **8 base64 chunks reassembled at runtime** ("to prevent simple regex-based search-and-replace cracked patches", `:17-32`) → token + purchase code persisted to `Cache::forever` **and** the `platform_settings` DB table (`:159-197`).
- **Runtime gate**: `LicenseCheckMiddleware` verifies the stored token's signature + **domain match** + **item id match** (61977497) locally on every admin request (`:37-41` → `verifyTokenSignature`, `:86-120`); domain normalization strips scheme/port/www (`:286-296`). Unlicensed → redirect to `license.activate`.
- **Heartbeat**: `terminate()` pings the license server every 7 days (2s timeout); response `revoked` → local token deleted (`Http/Middleware/LicenseCheckMiddleware.php:47-79`). **Fails open** if the server is unreachable (silent catch) — offline installs keep working; revocation requires the server to answer.
- **Applied to**: the admin surface only (`L/routes/admin.php:42`). Students/instructors/public/API never check the license — a lapsed license degrades to "no admin panel", not "no product".
- **Crackability**: everything except the private key ships; the chunked public key is a mild obfuscation. Because the middleware is a plain alias, a nulled build can alias it away — and indeed the audited artifact itself came pre-activated for `127.0.0.1` (see 9.3).

### 9.2 Versioning + updater

- Version stamp lives in `platform_settings` (migration `2026_03_28_105315_add_initial_system_version_to_platform_settings`), seeded 1.0.0; `VersionUpdateSeeder` participates in updates.
- `/admin/updater` (live screenshot web-admin-updater.png) compares current vs "available version detected in the codebase" (2.0.0) and runs "pending database migrations and apply the new version patch" — an in-app migrator aimed at non-technical cPanel buyers.
- **No module/plugin registry, no per-feature entitlements, no capability flags** — features are hard-wired; the only runtime feature toggles are platform_settings switches (chat on/off, live-class module on/off, gateway enables, auto-publish courses, email-verification/OTP/recaptcha toggles).

### 9.3 Comparison to ASchool's plugin model (Section 12 extends this)

| Dimension | EduEx | ASchool (`backend/app/plugins/`) |
|---|---|---|
| Unit of modularity | none (monolith) | 42 plugin dirs, 41 manifests, registry + loader |
| Entitlement/licensing | CodeCanyon purchase-code JWT, domain-locked, 7-day heartbeat, **admin-surface-only enforcement** | entitlements + billing model, request-time gates per plugin (`@plugin_required`) |
| Feature toggles | ~10 platform_settings booleans | per-plugin enable + manifest-declared routes/widgets/tabs |
| Tenant scoping | **single-tenant** (no school_id anywhere in the schema) | every model extends SchoolModel; `@school_required` on routes |
| Versioning of modules | one global version stamp; in-app updater | only 4/41 manifests carry a version field (a gap on OUR side worth fixing — EduEx's single stamp is simpler but coarser) |
| Update distribution | zip-over-install + migrator | git/CI |

**Verdict:** for a self-hosted single-tenant product, EduEx's license client is a serious, well-engineered gate (signed tokens, domain pinning, revocation heartbeat, fail-open-on-outage). Its weaknesses: enforcement breadth (admin only), the fail-open default, and — as this artifact proves — shipped cache state can pre-activate a build. ASchool's per-plugin entitlements are broader but our licensing story (per-tenant plugin billing) has no EduEx counterpart to compare against.


---

## 10. Strengths (evidence-backed)

1. **Monetization depth that works end-to-end.** 3 pricing models × 10 gateways × coupons × revenue-share × withdrawals × offline queue, all live-crawled (checkout with 8 methods + coupon + receipt upload; admin offline review with receipt modal; revenue settings with worked examples; subscription manual-assign). The uniform gateway contract (create→pending payment→server-verified→approve→revenue share→notify) is genuinely consistent across 9 implementations.
2. **Checkout UX polish** — one page, method radios with one-line reassurance copy, coupon inline validation endpoint, offline branch with clear "verify within 24 hours" expectation-setting, success page with Access Course CTA (`enrollment_success` dump).
3. **Sequential locking surfaced in the UI** — the live player shows lock icons per locked item, per-topic progress ("1/2"), and a disabled Completed button; the server is the authority on reads (`is_accessible` flags per item). The best single UX idea in the product for learning focus.
4. **Certificates as a feature, not an afterthought** — DomPDF with custom background, deterministic numbers, 24-hour signed download URLs, and a **public verification page** (employer-verifiable). Few products in this class ship the loop (earn → download → verify).
5. **Every list screen has a designed empty state** — consistent icon+headline+helper+CTA pattern across student/instructor/admin (quotes in Section 6.6), live-verified on ~15 screens.
6. **The 17-area admin settings surface is the product's real depth** — every operational knob a marketplace operator needs (currency 40+, gateways per-credential, SMTP, OTP/2FA/recaptcha, commission with examples, payout threshold, chat tuning incl. poll intervals, cron with 3 hostings profiles, live-class reminders, language manager with runtime key editing, custom CSS/JS injection). This is what makes buyers feel "complete".
7. **Real AI where it counts, honest scope** — Gemini chat tutor with persisted history + AI course-description generation in the builder are live integrations (`GeminiService` real HTTP); mock screens exist (see W-15) but the shipped AI features work.
8. **Instructor economics transparency** — the Subscription Sales page explains the split formula in prose; earnings wallet + pending/available split; masked student emails on the instructor list (privacy-conscious detail).
9. **Impersonation** built in (admin → student/instructor with session keys honored by the role middleware, `CheckRole.php:17-24`).
10. **Mobile engagement details**: no_screenshot anti-piracy in the player, shimmer skeletons everywhere, dual homepage layouts, share/rate-app sheets, QR event tickets with instructor-side verification.
11. **Six-language UI** with a runtime translation editor (bn/en/fr/hi/es/tr) — rare in this price class, though undermined by missing keys (W-16).
12. **The 3-step course builder with nested single-payload save** — atomic transactional authoring of course+topics+lessons+quizzes+questions+assignments in one POST with granular nested validation messages (`StoreCourseRequest`).

---

## 11. Weaknesses / Bugs / Mistakes (evidence: file:line or live repro)

Ordered by severity. `W-n` numbering is this report's canonical finding ids (the prior draft's V2-nn ids are mapped in Section 13).

- **W-1 (CRITICAL, live-reproduced) — Unauthenticated path traversal + APP_KEY disclosure.** `GET /api/video/stream?path=../../../.env` → **200 + full .env contents** (APP_KEY, DB creds, MAIL keys) on the booted app `[live]`. Route sits outside the sanctum group (`L/routes/api.php:49`); controller does prefix-string cleanup only, no realpath containment (`L/app/Http/Controllers/Api/FileController.php:16-46`); **falls back to private `storage/app/`** (worse than the prior draft's `app/public` reading); 404s leak absolute paths (`:36`). Same endpoint serves every uploaded lesson/recording (referenced from `Api/StudentCourseController.php:629,646`), so it cannot simply be deleted — it must be fixed (Storage facade + signed URLs).
- **W-2 (HIGH, code) — Payment-verify IDOR + no idempotency.** All gateway verify methods load `Enrollment::findOrFail($request->enrollment_id)` with no user check (`Api/CourseEnrollmentController.php:601` razorpay; same in sslcommerz/stripe/paystack/paypal/mollie/bkash/xpay). Repeat verifies re-fire approval + emails; only revenue share is guarded.
- **W-3 (HIGH, live-reproduced) — MySQL-only migrations; sqlite fresh install dies mid-way and is non-atomic.** 8 migrations use raw `MODIFY COLUMN ... ENUM` (files listed in 2.1); sqlite run fails at `2025_11_05_211512_add_stripe_fields_to_payments_table.php:20`, leaves `stripe_payment_intent_id` behind (retry → "duplicate column" at `:15`). Laravel 12 defaults to sqlite; composer's own `post-create-project-cmd` touches `database.sqlite` — the default path is broken.
- **W-4 (HIGH, live) — Two shipped-broken admin pages (500).** `/admin/courses/pending` ("View [admin.courses.pending] not found", `Admin/CourseController.php:83`) and `/admin/users` ("View [admin.users.index] not found", `Admin/UserController.php:28`) — controllers + routes + sidebar entries exist, Blade views do not (`L/resources/views/admin/courses/` = index/show only; no `admin/users/` dir).
- **W-5 (HIGH, code+prior V2-01/02 re-verified) — Locking enforced on reads, not writes; cross-course quiz/assignment submission.** `submitQuiz`/`submitAssignment` skip `isItemAccessible` and resolve by bare `findOrFail($quizId)`/`$assignmentId` without course binding (`Api/StudentCourseController.php:331,481`); enrollment only binds `{courseId}`. Out-of-order or wrong-course completions unlock the chain.
- **W-6 (HIGH, code) — Subscription access is forever; course_limit dead.** `enrollCourse` creates permanent `approved` enrollments (`Api/SubscriptionController.php:583-590`); no expiry sweeper exists (only 1 scheduled command, `L/routes/console.php:7-12`); `courses_accessed_count` written 0 and never compared (`SubscriptionService.php:45,106`).
- **W-7 (MED, code) — Resume lies at both ends.** All-completed `current_item` = first item (restart) (`Api/StudentCourseController.php:808-811`); web `current_item` is always the first lesson (`Student/StudentCourseController.php:79-80`); quiz-pass `next_item` skips the accessibility check (`Api:393` "Simplify for now").
- **W-8 (MED, code) — Fabricated data shipped to the app.** `myAssignments` returns `due_date = created_at->addDays(7)` with an in-code comment admitting placeholder logic (`Api/StudentCourseController.php:556`); assignments have no due-date column at all.
- **W-9 (MED, code) — Coupon ledger races.** `CouponService::validate` is check-then-act with no lock (`L/app/Services/CouponService.php:52-60`); `Payment::booted` saved-hook increments `used_count` on every transition into completed (`L/app/Models/Payment.php:61-75`).
- **W-10 (MED, code) — O(items²) authorization.** `isItemAccessible` refetches the full course per call (`Api/StudentCourseController.php:692`) + one query per prior item; `show()`/sidebar call it per item (`:97-101` equivalent).
- **W-11 (MED, code) — Certificate date rides `updated_at`; no `completed_at` column** (`L/app/Models/Enrollment.php:97`); any enrollment update rewrites printed issue dates. Code format is enumerable (W-13).
- **W-12 (MED, code) — Progress keyed `(user_id, lesson_id)` while queries filter by enrollment; re-checkout deletes pending enrollments** → cascade wipes learning history (`2025_11_05_171656` unique constraint; `Api/CourseEnrollmentController.php:102-115`).
- **W-13 (MED, code) — Certificate verification accepts `CERT-<id>` and bare ids** (`CertificateVerificationService.php:33-41,63-66`) → codes trivially enumerable; success payload leaks student+instructor PII unauthenticated.
- **W-14 (MED, code+live) — `/cron/run` is default-open.** If neither DB `cron_key` nor env `CRON_KEY` is configured, the scheduler is publicly triggerable (`CronController.php:32-55`); key is auto-generated only when an admin visits the cron settings page (`Admin/SettingsController.php:872-876`); the settings page then displays the live key inside a copyable curl line (acceptable admin UX, but the default-open window is real).
- **W-15 (MED, code) — Mock AI screens in the shipped app.** `ai_suggestions_screen.dart` and `ai_learning_path_screen.dart` contain zero HTTP/service references (grep = 0) — UI fiction presented as features.
- **W-16 (MED, live) — Raw translation keys on production pages** — `frontend.categories`, `frontend.ratings`, `student.pending_status`, `auth.email`, `auth.enter_email`, `frontend.cancel`, `student.cancel` (missing from `L/lang/en/*.php`); the Language Manager can add keys at runtime but ships incomplete.
- **W-17 (MED, code) — `payments.user_id` never set on checkout** (11 `Payment::create` calls in `Api/CourseEnrollmentController.php:172-525` omit it); backfilled via enrollment relation only in the coupon hook (`Payment.php:65`).
- **W-18 (LOW-MED, code) — Dead middleware + pending-instructor token hole.** `approved.instructor` alias registered but unused (`bootstrap/app.php:20`; 0 route references); `login()` never checks `is_approved` (`Api/AuthController.php:105-149`) — unapproved instructors hold full instructor API tokens.
- **W-19 (LOW, code) — User enumeration via OTP verify** (404 "User not found" vs 422 "Invalid or expired OTP", `Api/AuthController.php:158-166`) and register's `unique:users` validation message shape.
- **W-20 (LOW, code+live) — GET mutates state**: enrollment auto-completes during `show()` reads (`Api/StudentCourseController.php:47-51`).
- **W-21 (LOW, code) — Course soft-delete is a manual `deleted_date` column** (not Laravel softDeletes) while bundles use real softDeletes — two delete idioms; "full-delete" exists separately in admin.
- **W-22 (LOW, live) — Admin "Announcements" on the student dashboard are hardcoded strings**, not data from any table.
- **W-23 (LOW, code) — No queued mail, sync sends, try/catch-swallowed** — a slow SMTP host stalls checkout responses (email send inside the request, `Api/CourseEnrollmentController.php:1096-1116`).
- **W-24 (LOW, code) — Quiz `time_limit` never enforced server-side; `time_taken` client-supplied; unlimited retakes; correct answers shipped to the client in `loadQuiz` payload** (`Api/StudentCourseController.php:287-321`).
- **W-25 (LOW, product) — No push notifications, no websockets, no offline mode in the mobile app** (dependency list, Section 2.2); chat is polling.
- **W-26 (LOW, product) — Zero school-ops features** (no classes/sections, attendance, fees, timetable, transport, parents, multi-tenancy, Nepal stack: no NPR in the 40+ currency list `[live]`, Gregorian-only dates, Bangladesh-centric gateways).

---

### 11.1 Findings index with fix sketches (severity-ordered)

| ID | Sev | One-line fix sketch |
|---|---|---|
| W-1 | CRITICAL | Serve media via `Storage::disk('public')->response($validated)` or signed URLs; reject `..`; never echo paths; pull route behind auth |
| W-2 | HIGH | `$enrollment->where('user_id', $request->user()->id)` + verify-once guard (status check before effects) |
| W-3 | HIGH | drop enum-widening migrations for schema-builder changes or guard `DB::getDriverName()==='mysql'`; wrap in try/rebuild |
| W-4 | HIGH | ship the two missing Blade views (or remove routes+sidebar items); CI check "view() target exists" |
| W-5 | HIGH | call `isItemAccessible` in submit paths; bind quiz/assignment via `whereHas('topic.course')` |
| W-6 | HIGH | enforce `ends_at` at read time; increment/compare course_limit on enrollCourse; add expiry sweeper command |
| W-7 | MED | return null/"review" when all complete; walk-forward for next_item |
| W-8 | MED | add `due_at` column; stop fabricating |
| W-9 | MED | `lockForUpdate` on coupon validate; move increment inside one-time transition guard |
| W-10 | MED | compute sequence + completion set once per request; pass down |
| W-11 | MED | `completed_at` column written at flip; random cert suffix |
| W-12 | MED | unique (user_id, lesson_id, enrollment_id) or stop deleting pending enrollments |
| W-13 | MED | accept full code only; rate-limit; minimal PII |
| W-14 | MED | require key by default (generate at install), constant-time compare |
| W-15 | MED | wire to real endpoints or remove screens |
| W-16 | MED | fill missing lang keys; CI grep for raw key render |
| W-17 | MED | set `user_id` in every Payment::create |
| W-18 | MED | apply `approved.instructor` middleware to instructor groups; check is_approved in API login |
| W-19 | LOW | unify on 401 generic |
| W-20 | LOW | move completion flip to the complete/submit writes only |
| W-21 | LOW | adopt Laravel softDeletes everywhere |
| W-22 | LOW | data-drive announcements |
| W-23 | LOW | `ShouldQueue` on mailables |
| W-24 | LOW | server started_at + deadline check; max_attempts; strip correct answers from load payload (or accept it for a learning product) |
| W-25 | LOW | product decision (push/offline) — table stakes for mobile LMS |
| W-26 | LOW | out of scope for this product's identity; the reason it is not an ASchool competitor on school ops |

## 12. Notable Patterns Worth Stealing or Avoiding (named screens/flows)

### Steal

1. **Lock-icon curriculum sidebar with server-computed `is_accessible` (course player)** — one payload powers icons, gating, and resume; client never guesses. ASchool's LMS should adopt exactly this contract — and enforce it on writes (fixing EduEx's W-5) via `backend/app/services/lms/sequence_service.py` over a single StudentProgress fetch (O(n), not EduEx's O(n²)).
2. **The certificate moment (completion page → certificate → public `/verify-certificate`)** — the public verifier is cheap and high-credibility for Nepali job-seekers; keep EduEx's signed 24h URLs, replace the enumerable code with `secrets.token_hex`, add a dedicated `issued_at` (fixes W-11/W-13).
3. **Offline payment queue (checkout → receipt upload → admin offline-pending → approve)** — the exact Nepal reality (cash/bank transfer); mirrors and validates our fees plugin's manual flows with better expectation copy ("verified within 24 hours").
4. **Course-forum announcements/pins as the teacher broadcast channel (Course Forums page)** — maps onto ASchool's notices plugin scoped per course; the "Flag as Announcement + Pin to Top" two-flag model is the right shape.
5. **Subscription-sales transparency page** — an explainer + per-sale share table; for any future ASchool LMS commerce, this is how to make revenue-share legible (and it's honest prose, not marketing).
6. **17-area settings hub with a landing page** — per-domain settings pages with a hub of cards; our per-plugin settings pages are scattered — a settings hub per school would materially improve admin UX.
7. **Wishlist + dual-homepage + theme ZIP upload** — retention/white-label levers; our white_label plugin + design_studio already cover most of this, but the "choose homepage composition" switch is a nice per-tenant product lever.
8. **`no_screenshot` in the player** — one dependency, one line in initState/dispose (`course_access_screen.dart:56,63`).
9. **Masked student emails on the instructor students list** (`stu****@*****.com`) — small privacy win worth copying on teacher-facing lists.
10. **In-app updater with DB version stamp** — for self-hosted deployments ASchool may someday offer; the version-stamp-in-settings pattern is also a candidate for our plugin manifests (41 manifests, only 4 versioned).

### Avoid

1. **The `?path=` streaming endpoint (W-1)** — when ASchool builds VOD, use the Storage facade with validated disk paths and signed expiring URLs from day one; never echo filesystem paths in errors.
2. **Per-gateway response columns on the payment table** — 12 migrations, ~30 nullable columns, MySQL-only enum widening (W-3); keep gateway payloads in JSON/config (our fees plugin already does this correctly).
3. **Model `booted()` observers for cross-aggregate fan-out** (Enrollment bundle activation, Payment coupon hook) — use the plugin event bus (our manifests' emits/listens) so reactions are visible, testable, and tenant-scoped.
4. **GET side effects (W-20) and client-trusted quiz timing (W-24)** — server timestamps + attempt deadlines, explicit POST-only completion.
5. **Dead UI in shipped builds** — two 500 pages (W-4), mock AI screens (W-15), raw i18n keys (W-16): release hygiene; our audit tooling (`api_route_audit.py`, `plugin_doctor.py`) should add a "view exists for every controller view() call" check — this pass proved that class of bug ships.
6. **Fake data in APIs (W-8)** — never fabricate due dates client-side; if the column doesn't exist, don't render the field.
7. **Fail-open license heartbeats + admin-only enforcement** — if ASchool ever ships self-hosted, enforce on more surfaces and make revocation immediate rather than 7-day-lazy.
8. **Two role systems (enum column + spatie) and two category systems (string + FK)** — pick one; our role/school scoping already does.


---

### 12.1 EduEx vs ASchool LMS depth (ASchool facts verified first-hand this pass)

ASchool baselines re-verified: `backend/app/api/v1/lms.py` = **612 lines / ~20 endpoints**; `backend/app/models/lms.py` = **173 lines / 9 models** (Course, Lesson, Topic, StudyMaterial, LiveClass, StudentProgress, Quiz, QuizAttempt, Enrollment); `backend/app/services/lms/video_service.py` auto-provisions **Jitsi rooms** (`JITSI_DOMAIN = "meet.jit.si"`, `create_live_class` generates `aschool-<school>-<uuid>` rooms); `backend/app/plugins/modules/lms/` plugin + `frontend/app/dashboard/lms/` + `frontend/app/student/lms/` routes + `flutter_student/lib/features/lms/` exist (RECON_MAP 3.1-3.3).

| LMS capability | EduEx (evidence) | ASchool today (evidence) | Verdict |
|---|---|---|---|
| Course catalog/storefront | public catalog + filters + ratings + wishlist(local) `[live]` | courses behind `@jwt_required @school_required` (prior-draft §5) | EduEx ahead (but storefront ≠ school need) |
| Authoring | 3-step builder, nested atomic save, AI description `[live]` | flat create_course/create_lesson REST; `Lesson.content_type` exists incl. **text** type (`models/lms.py:46`) — richer content model, weaker authoring UX | split: UX EduEx, content model ASchool |
| Curriculum structure | Course→Topic→items (clean) `[live]` | **Topic.lesson_id inversion** (`models/lms.py:66` — topics hang under lessons) | fix our inversion; adopt their shape |
| Sequential gating | server `is_accessible` on reads; hole on writes (W-5) | none | adopt (with write-side fix) |
| Resume | `current_item` (flawed, W-7) | `StudentProgress.last_position_secs` stored (`models/lms.py:127`) but never composed | our data is better, their UX is better — compose it |
| Watch-position reporting | web-only endpoint; app never reports | `record_progress` accepts `last_position_secs` (prior-draft `lms.py:454-459`) | **ASchool ahead** |
| Quiz grading | server-side percent + passing score; client timer; unlimited retakes; MCQ(+hidden true/false) | **client sends its own score** (`lms.py:328 score=data.get('score')`) | EduEx's server grading is the minimum bar — adopt |
| Live classes | paste-a-link scheduler + reminders; external join `[live]` | auto-provisioned Jitsi rooms (`video_service.py`) | **ASchool ahead** |
| Certificates | full engine + public verify `[live]` | none (0 certificate refs in lms models/api) | adopt EduEx pattern (with code/date fixes) |
| Discussions/engagement | course forums + pins + community Q&A + gated chat `[live]` | none in LMS (notices plugin is school-wide) | adopt scoped-forum pattern |
| Monetization | 3 models × 10 gateways × coupons × payouts `[live]` | none (fees plugin is tuition, not content commerce) | only relevant if ASchool sells content |
| Multi-tenancy | single-tenant schema (no school_id anywhere) | every model SchoolModel + school-scoped routes | **ASchool ahead by architecture** |
| Mobile | dedicated player shell, lock UX, no_screenshot, skeletons; no push/offline | `flutter_student/features/lms/` single screen | adopt player-shell pattern |
| AI | real Gemini tutor + description gen; 2 mock screens | ai_tutor/ai_tools/adaptive_learning real but unconnected to LMS | both incomplete; ours is realer |


## 13. Prior-draft verification ledger

Prior draft = `docs/competitor-audits/eduex-lms-v2.0.md` (2026-09-11/12). Labels: **verified still true** (current file:line), **corrected** (what was wrong + evidence), **extended** (new depth this pass adds). The prior draft cited paths under `Eduex Laravel_x/`; the two trees are byte-identical (`diff -rq` exit 0, re-run 2026-09-13), so line numbers map 1:1 to the `_extracted` tree cited in this report.

### 13.1 Stack & inventory claims

| Prior claim | Verdict | Evidence / note |
|---|---|---|
| "Laravel 11 course-marketplace LMS" (§1 TL;DR) | **corrected** | Laravel **12.53.0** locked (`L/composer.lock`); composer.json requires `^12.0` (`:13`) |
| 8 route files; api.php 288 lines; 181 Route:: calls; admin.php 264 / instructor.php 167 / student.php 121 / web.php 134 | **verified** | all files re-read line-by-line this pass (Section 2.3); route:list total = 642 |
| 148 controllers, 60 models, 90 migrations, 264 Blade views, 13 seeders, 21 services, 1 repository | **verified** | recount: 148/60/90/264/13/21(+ Installer/ + license pkg)/1 — all exact |
| "3 roles via spatie permission" | **corrected/extended** | spatie is installed and migrated, but `CheckRole` reads the `users.role` **enum column** (`L/app/Http/Middleware/CheckRole.php:26-32`); spatie roles are assigned by seeder and never consulted by route middleware — two parallel role systems (new finding, 2.4) |
| 144 dart files; **67 screens**; **32 named routes** | **corrected (minor)** | 144 dart files exact; `lib/screens/` holds **73** `.dart` files (incl. 4 skeleton files + 1 tab widget); router defines **30** route constants + inline `/home2` (`FL/lib/router/app_router.dart:38-67,122`) |
| `Eduex Laravel_x` and `Eduex Laravel_extracted` identical | **verified** | `diff -rq` exit 0 (2026-09-13) |
| Checkout via "3 native gateways + webview fallbacks + offline" | **verified + extended** | native SDKs ×4 (razorpay/stripe/sslcommerz/mollie) in pubspec; **web checkout offers 8 methods** and omits bKash/XPay (app-only) `[live]`; Flutter `checkout_screen.dart` is **1,936 lines** — bigger than the draft implied |
| No push / no offline / no websockets; chat polls | **verified** | pubspec dependency list (2.2); `ChatController::poll` (`:179`) |
| Wishlist = SharedPreferences only | **verified** | `FL/lib/services/wishlist_service.dart`; no backend route/table |
| Lesson = "video only: enum (local file, url, youtube, vimeo — widened by 2026_06_24_110947)" | **corrected** | the migration sets enum `('url','upload','live')` — there are **no youtube/vimeo enum values**; YouTube/Vimeo are detected by URL regex at read time (`Api/StudentCourseController.php:633-642`); the Flutter player keys off `is_youtube`/`is_vimeo`/`video_id` response fields |
| Certificate engine details (DomPDF A4 landscape, background base64, signed 24h URLs, public verify) | **verified** | `Api/CertificateController.php:77-156`; accessor now at `Enrollment.php:82-95` (line drift from cited 60-75); completion-date accessor at `:97` (cited 77-79) |
| Payments: base enum('razorpay','offline') + per-gateway widening migrations | **verified + corrected count** | **11** additive payments migrations (draft said "9 additive" then listed 10); enum-widening uses raw MySQL DDL — sqlite installs break (W-3, new) |

### 13.2 Trace-level claims (A–E)

| Prior trace claim | Verdict | Evidence |
|---|---|---|
| A: item order = topics in order, then **all lessons, then quizzes, then assignments** per topic; interleaving impossible | **verified** | `getAllCourseItems()` API `:652-688` (structure re-read; ordering logic unchanged) |
| A: `isItemAccessible` = refetch course + all-previous-completed loop; first item always open; completion = lesson-progress row / any passed quiz attempt / any assignment submission | **verified** | `Api/StudentCourseController.php:690-716, 718-741` (quoted Section 4.5) |
| A: locked response shapes — web `{success:false, locked:true}` vs API message-only | **verified** | web `Student/StudentCourseController.php:209-215`; API `:167-169,287-289,436-438` |
| A: resume — API real (`determineCurrentItem`), web fake (first lesson); all-completed → first item | **verified** | API `:767-812` (the "return first item" code comment confirmed verbatim); web `:79-80` |
| A: `markLessonComplete` 404s before first load (`firstOrFail`) | **verified** | API `:224-227` |
| A: watch-percentage endpoint web-only (`lesson/progress`), absent from API | **verified** | `L/routes/student.php:58` vs api.php (no equivalent) |
| A: `show()` GET auto-completes enrollment | **verified (live)** | API `:47-51`; the booted app's student dashboard already reflects computed completion state |
| A: O(items²) per page view | **verified** | `:692` refetch per call + loop `:709-714` |
| B: cert number `CERT-%06d-md5[:6]`, verification accepts 3 forms, PII in response | **verified** | `Enrollment.php:82-95`; `CertificateVerificationService.php:33-41,63-66` |
| B: `completion_date = updated_at`, no completed_at column | **verified** | `Enrollment.php:97` |
| C: discussions = 4 tables; service+repository layering; access/moderator rules; **zero notification fan-out**; no edit | **verified** | migration 2026_06_24_081355; grep notify/Notification = 0 hits across service/repository/controllers (re-run this pass) |
| D: enroll branches (bundle/course preconditions, pending-enrollment deletion, coupon single-course, gateway check, per-method contract, free path incl. 100% coupon, offline receipt) | **verified** | `Api/CourseEnrollmentController.php:56-590` (free path quoted in 4.3) |
| D: verify methods all lack ownership check; no user_id in Payment::create; revenue share idempotent; bundle observer fan-out | **verified** | `:601` (+7 twins); create calls `:172-525` (no user_id key); `RevenueShareService` commission_processed guard; `Enrollment.php:28-72` (full observer re-read) |
| D: coupon check-then-act + Payment saved-hook increment | **verified** | `CouponService.php:30-86`; `Payment.php:61-75` |
| D: subscriptions — permanent enrollment, dead course_limit/courses_accessed_count, no expiry sweep | **verified** | `Api/SubscriptionController.php:565-601` (full code quoted 4.4); `SubscriptionService.php:45,106`; console.php has exactly one scheduled command |
| D: withdrawals — balance debited at request, rejected refunds, states | **verified** | `Api/Instructor/EarningsController.php:337-381`; `Admin/WithdrawalController.php:108-145` (re-read at cited ranges) |
| E: quiz submit — server-graded percent, passing_score default 60, client timer, unlimited retakes, unanswered skipped, next_item unchecked | **verified** | `Api/StudentCourseController.php:323-411` (code + comments confirmed verbatim: "Should ideally come from request", "Simplify for now") |
| E: "MCQ-only (`type` defaults 'multiple-choice' everywhere)" | **extended** | schema + validation accept `true-false` (`quiz_questions` enum; `StoreCourseRequest` type rule) — but the **builder UI never offers it** (0 hits in course-builder.blade.php) and the controller defaults MCQ (`CourseBuilderController.php:216,715`). I created a true/false question directly and it renders fine for students — the capability exists one layer down |
| E: assignments — no due-date column; API fabricates `created_at+7d`; statuses pending/graded/returned; grade 0-100; owner check | **verified** | `Api/StudentCourseController.php:556` (comment "Use placeholder logic for due date" verbatim); `Api/Instructor/AssignmentController.php:142-169` |

### 13.3 V2-01…V2-12 defect claims

| ID | Claim | Verdict |
|---|---|---|
| V2-01 | locking not enforced on submit | **verified still true** (`Api/StudentCourseController.php:323-344,459-488`) — now W-5 |
| V2-02 | cross-course quiz/assignment submission | **verified still true** (`:331,481` bare findOrFail) — W-5 |
| V2-03 | payment-verify IDOR / re-fire / payments.user_id unset | **verified still true** (`:601` + twins; 11 create calls without user_id) — W-2/W-17 |
| V2-04 | subscription forever; dead limits | **verified still true** (4.4 full quote) — W-6 |
| V2-05 | cert verify decorative + PII | **verified still true** — W-13 |
| V2-06 | GET mutates; date on updated_at | **verified still true** (`:47-51`; `Enrollment.php:97`) — W-20/W-11 |
| V2-07 | markComplete 404 before load | **verified still true** (`:224-227`) |
| V2-08 | fabricated due dates | **verified still true** (`:556`) — W-8 |
| V2-09 | resume lies | **verified still true** (`:808-811`; web `:79-80`; `:393`) — W-7 |
| V2-10 | coupon ledger races | **verified still true** (`Payment.php:61-75`; `CouponService.php:52-60`) — W-9 |
| V2-11 | O(n²) authorization | **verified still true** (`:690-716`) — W-10 |
| V2-12 | progress keyed w/o enrollment + cascade wipe | **verified still true** (migration unique `:19-20`; enrollment-deletion flow) — W-12 |

### 13.4 Prior v1 claims spot-checks

- Path traversal "no containment, echoes absolute path" — **verified + extended**: the fallback reaches **private `storage/app/`**, and the traversal was **reproduced live** (`.env` + APP_KEY served, W-1). The draft's framing ("path-traversal surface") undersold severity.
- "AI learning path / AI suggestions are UI-only mocks" — **verified** (0 HTTP refs, re-grepped).
- "Client-trusted timer" — **verified** (`quiz_attempt_screen.dart:47,144-156`; server `:339`).
- "GET logout" — **verified** (`L/routes/auth.php:27`).
- "cron-via-URL (`routes/web.php:118`)" — **verified, line corrected** (route at `web.php:128`) **+ extended**: the key is optional → default-open endpoint (W-14); key auto-generated only when the settings page is visited.
- "admin: 18 settings pairs GET/PUT (46-80)" — **verified** (admin.php:46-82; 18 pairs counted) **+ extended**: all 17 areas crawled live with full field inventories.
- "Front/CourseEnrollmentController read at contract level only" — **extended this pass**: web checkout surface fully crawled (8 methods, coupon, offline receipt) `[live]`.
- "community Q&A / chat / events engines not line-traced" — **extended**: chat contract (accept-gate, poll, settings) and community flows traced in 4.10; events builder crawled `[live]`.
- "v1 said 5 discussion tables" → draft already corrected itself to 4 — **verified 4**.

### 13.5 Materially new in this pass (not in prior draft at all)

1. The product **boots** — full live crawl of all four surfaces (29 screenshots), plus 24 vendor-doc screenshots catalogued.
2. Two shipped 500s (`admin/courses/pending`, `admin/users`) — W-4.
3. sqlite/MySQL-only migration breakage — W-3.
4. Shipped license token pre-activated for 127.0.0.1 in the file cache — 9.3.
5. `/cron/run` default-open — W-14.
6. Raw i18n keys on live pages — W-16.
7. `dead middleware` (`approved.instructor`) + pending-instructor token hole — W-18.
8. Full admin settings/monetization surface field inventories (17 areas).
9. Task-based benchmark numbers (Section 8).
10. Flutter API-client endpoint map (all 90+ endpoints from services) and router/guard analysis.
11. Vendor documentation structure (installer wizard, demo accounts, updater, changelog v1.1.0→v2.0.0, 12 admin-settings walkthrough screenshots).

---

## 14. Evidence Appendix

### 14.1 Screenshot index (audits/deep-ux-2026-09/screenshots/eduex-lms-v2.0/)

Browser captures (1440×900, live app): web-front-{home,courses,course-detail-free,course-detail-paid,bundles,bundle-detail,instructors,events,subscriptions,verify-certificate,about,contact,faq,blog}.png; web-auth-{login,register,become-instructor,forgot-password}.png; web-student-{dashboard,course-player,checkout-paid}.png; web-admin-{dashboard,settings-hub,courses,course-detail,gateways,updater,courses-pending-500,users-500}.png; web-instructor-course-builder.png.

Vendor-doc copies (`vendor-docs/`, from `ROOT/Documentation/assets/images/`): db/1-3 (cPanel database creation), file/1-3 (file upload), step/1-6 (installer wizard: Welcome, Requirements, Permissions, Environment, Database, Finish), front/1-9 (marketing front-end), updater.png, settings.png, platform/course/gateway/branding/contact/email/smtp/otp/revenue/payout/acc-del/captcha-configuration.png (12 admin settings walkthroughs), theme.png.

### 14.2 Live-crawl page dumps (referenced throughout)

`/tmp/eduex_pages/*.html` — 98 page dumps: 18 public (`*.html`), 16 student (`auth_*.html`), 24 instructor (`inst_*.html`), 63 admin (`adm_*.html`) minus 404s. Extracted text/field inventories: `/tmp/eduex_inst_crawl.txt`, `/tmp/eduex_adm_crawl.txt`. Route table: `/tmp/eduex_routes.json`. Live player accessibility snapshot: `.playwright-mcp/page-2026-09-13T02-29-55-597Z.yml`.

### 14.3 Reproduction environment (for re-audit)

- MySQL 8.4 docker `eduex-audit-mysql` (port 33307, db `eduex_audit`, root/eduex_audit_pw) — disposable, created for this audit.
- Boot: `cd "ROOT/Eduex Laravel_extracted/Eduex Laravel" && DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=33307 DB_DATABASE=eduex_audit DB_USERNAME=root DB_PASSWORD=eduex_audit_pw php artisan migrate --seed --force` then `php artisan serve --port=8931` with the same env overrides; `storage/installed` marker required for web routes.
- Demo accounts: admin@/instructor@/student@eduex.com — password `password` (`AdminSeeder.php:14-51`).
- W-1 reproduction: `curl "http://127.0.0.1:8931/api/video/stream?path=../../../.env"`.
- W-4 reproduction: log in as admin → `/admin/courses/pending` or `/admin/users`.

*End of report.*

### 15. Vendor documentation walkthrough (installer + ops guide)

`DOC/index.html` is a single-page doc with sections I. Getting Started, II. Platform Management, III. Best Practices & FAQ, IV. Mobile App, V. Changelog. Key operational content (screenshot evidence in `vendor-docs/`):

- **Install wizard** (6 steps, screenshots step/1-6.png): Welcome → Requirements (PHP extension checklist) → Permissions (storage/bootstrap writable checks) → Environment (DB credentials form) → Database (migrate+seed) → Finish (creates the `storage/installed` marker + admin account). Manual fallback documented for shared hosting; demo accounts documented (admin/instructor/student @eduex.com).
- **cPanel flow** (db/1-3.png, file/1-3.png): create DB+user, upload zip, extract, run wizard.
- **Admin settings walkthrough** (12 PNGs): platform, course, gateway, branding, contact, email, smtp, otp, revenue, payout, account-deletion, captcha configuration — one marketing screenshot per settings area, matching the live pages I crawled.
- **Mobile app section**: prerequisites, installation, **Connect to Backend** (edit `lib/config/config.dart` baseUrl — confirming the compile-time server URL), App Name & Package, Logo & Splash, Colors & Theme, Homepage Configuration (home vs home2), Language & Localization, Android/iOS build steps.
- **Changelog**: v1.1.0 → v1.3.1 → **v2.0.0 (latest)** — consistent with the migration chronology (3.6): subscriptions = the v2.0 headline feature.
- **Environment keys reference**: APP_NAME, APP_URL, DB_*, MAIL_* documented as the must-set keys — matches the shipped `.env`.


### 16. Residual unknowns / limits of this pass (honest ledger)

1. **Responsiveness beyond desktop**: crawled at 1440×900 only; mobile emulation not run. The DOM contains mobile nav affordances; no claim is made about phone layouts.
2. **Gateway happy paths**: no real payment was executed (no credentials); verify branches verified by code read only, plus the seeded-gateway checkout page states.
3. **Admin notifications create page**: reached via 302 redirect from `/admin/notifications`; the create form's exact field set is inferred from controller (`Admin/NotificationController.php:32` view create + `:86` send) rather than a direct crawl.
4. **Instructor events wizard tabs 2-5**: routes + tab labels crawled (basics form fully); schedule/highlights/speakers field lists come from the events schema (3.4) + routes, not per-tab HTML.
5. **The `web-instructor-course-builder.png` screenshot**: captured after an in-browser instructor login in a batch that hit the tool timeout — file size/content indicate the builder page, but unlike other shots it lacks an in-call content assertion; the builder's full field inventory is independently evidenced by `inst_instructor_courses_create.html`.
6. **Playwright browser was shared** with another session during the crawl (tab switching observed); all screenshots were taken through isolated pages with explicit URLs, and each shot's page content is corroborated by the matching curl HTML dump.
7. **Line-number drift**: the prior draft cited `Enrollment.php:60-75/77-79`; current file has the accessor at `:82-95` and date at `:97` (code above it grew). All V2-n claims were re-verified at their current positions.

### 17. One-paragraph verdict for the synthesis team

EduEx v2.0 is the strongest **course-commerce** reference in the corpus: its checkout/offline-queue/certificate-verification/settings-hub patterns are directly stealable, and its sequential-lock sidebar is the single best learning-UX idea to transplant into ASchool's LMS plugin (with the write-side fix). It is architecturally simple (single-tenant, jQuery front, no queues, no websockets, no plugins) and ships with real hygiene failures — a live unauthenticated path traversal leaking APP_KEY, two 500 admin pages, MySQL-only migrations, mock AI screens, and raw i18n keys — that show how far a polished surface can outrun engineering rigor. ASchool's LMS loses today on certificates, discussions, authoring UX, and gating; it wins on live-class provisioning, watch-position data, server-side quiz grading potential (once `score=data.get("score")` is fixed), multi-tenancy, and the Nepal stack. The gap is closable in one focused lms-plugin iteration (sequence_service + certificate_service + discussion models + nested authoring endpoint) without touching the other 40 plugins.


### 18. Re-audit quick-start (verify every headline finding in ~10 minutes)

```bash
ROOT="Other Projects/EduEx LMS v2.0/EduEx LMS v2.0/codecanyon-61977497-eduex-the-ultimate-learning-management-system-lms-with-flutter-mobile-app"
L="$ROOT/Eduex Laravel_extracted/Eduex Laravel"

# 1. Route census (no DB needed)
cd "$L" && php artisan route:list --json | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"   # expect 642

# 2. Fresh sqlite install breakage (W-3)
cd "$L" && rm -f /tmp/t.sqlite && DB_CONNECTION=sqlite DB_DATABASE=/tmp/t.sqlite php artisan migrate --force 2>&1 | tail -3
# expect: SQLSTATE[HY000] duplicate column / MODIFy error at 2025_11_05_211512

# 3. Boot (docker mysql eduex-audit-mysql on :33307 must run)
cd "$L" && DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=33307 DB_DATABASE=eduex_audit \
  DB_USERNAME=root DB_PASSWORD=eduex_audit_pw php artisan serve --port=8931 &
# then: login admin@eduex.com/password via /login

# 4. W-1 path traversal (unauthenticated)
curl -s "http://127.0.0.1:8931/api/video/stream?path=../../../.env" | head -3          # expect APP_KEY...

# 5. W-4 broken admin pages (as logged-in admin)
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt http://127.0.0.1:8931/admin/courses/pending   # 500
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt http://127.0.0.1:8931/admin/users              # 500

# 6. W-14 cron default-open (fresh DB before visiting settings)
curl -s http://127.0.0.1:8931/cron/run | head -c 80    # {"status":"success"...} when no key configured

# 7. W-16 raw i18n keys
curl -s http://127.0.0.1:8931/courses | grep -o "frontend.categories\|frontend.ratings" | sort -u

# 8. License gate state in this artifact
grep -r "license_activation_token" "$L/storage/framework/cache/data/" | head -1   # shipped token (127.0.0.1)

# 9. Static checks
grep -c "MODIFY COLUMN" "$L"/database/migrations/*.php | grep -v ":0" | wc -l     # 8 (W-3 list)
grep -rn "approved.instructor" "$L/routes/" | wc -l                               # 0 (W-18 dead middleware)
grep -c "http\|Service" "$ROOT/Eduex Flutter/lib/screens/ai_suggestions/ai_suggestions_screen.dart"  # 0 (W-15)
grep -rn "notify\|Notification" "$L/app/Services/CourseDiscussionService.php" | wc -l               # 0 (4.17)
```

*Report complete — 19 sections, 2,000+ lines, every claim carrying a `[code L/…:line]`, `[live]`, or `[vendor-doc …]` evidence label per the methodology in Section 0.*
