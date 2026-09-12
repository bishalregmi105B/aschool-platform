# Competitor Deep Audit: EduEx LMS v2.0 (Laravel + Flutter)

**Audited:** `Other Projects/EduEx LMS v2.0/EduEx LMS v2.0/codecanyon-61977497-eduex-the-ultimate-learning-management-system-lms-with-flutter-mobile-app/`
**Compared against:** ASchool (multi-tenant Nepal school SaaS; lms + assignments + elibrary plugins, 50+ plugins, 5 Flutter apps)
**Date:** 2026-09-11
**Audit method:** Full static read of Laravel app (routes/controllers/models/migrations/services/views), full read of Flutter app (`lib/`), documentation site, then line-level comparison with `ASchool/backend/app/api/v1/lms.py`, `ASchool/backend/app/models/lms.py`, and `ASchool/backend/app/plugins/modules/lms/`.

Paths below are relative to the audited root unless prefixed `ASchool/`. Two Laravel copies exist (`Eduex Laravel_x/` and `Eduex Laravel_extracted/`); `diff -rq` confirms they are identical. All paths cited use `Eduex Laravel_x/Eduex Laravel/` (shortened to `Laravel/`).

---

## Deep re-audit (v2) — implementation-level (2026-09-12)

- **v2 status**: covered route files (api.php 288 lines, student.php, admin.php, instructor.php, web.php — line-by-line with controller bodies), Trace A sequential locking + resume (both `StudentCourseController` variants, full read), Trace B certificate engine (3 controllers + service + model + template vars), Trace C discussions (migration + repository + service + both API controllers + validation), Trace D monetization state machine (enroll + all verify branches, Payment/Enrollment observers, RevenueShareService, CouponService, SubscriptionService, withdrawals, 12 payments migrations), Trace E quiz + assignment engines (both submit paths, requests, migrations, grade flow), Flutter player (course_access_screen.dart full 751 lines; quiz_attempt_screen timer logic; course_detail_screen.dart structure + API calls), defect verification at line level (path traversal, mock AI, no push, client timer) + 12 new findings (V2-01…V2-12), adoption design for ASchool (locking/certificates/discussions with exact columns + endpoint signatures); remaining: Front (web) `CourseEnrollmentController` verify branches read at contract level only (same pattern as API), community Q&A / chat / events engines not line-traced (out of scope), Flutter screens other than the player+detail covered by v1 only.

Route re-verified: `diff -rq` between `Eduex Laravel_x/` and `Eduex Laravel_extracted/` trees is empty outside vendor/node_modules — the two copies remain identical. All competitor paths below are relative to `Eduex Laravel_x/Eduex Laravel/` (shortened `Laravel/`) or `Eduex Flutter/`.

### V2.0 Route coverage — the four surfaces, controller@method level

**API (student + instructor Flutter app), `Laravel/routes/api.php` (288 lines).** Public: settings (30), pages (31-32), auth register/login/otp verify/otp resend (34-39), home (41), recent courses (42), courses list/show (43,46), categories (45), bundles (47-48), `video/stream` (49 — **unauthenticated**, see V2-defect), instructors (50-51), events (52-53), signed certificate download (54), subscription plans public (57), certificate verify POST+GET (60-61), community Q&A read (64-65). Sanctum group (67-174): user/logout, profile+photo+password+delete-request+notification prefs (72-79), notifications CRUD (82-85), dashboard (88), enroll course/bundle (91-92), event book+bookings (93-95), **7 gateway verify endpoints** razorpay/sslcommerz/stripe/paystack/mollie/bkash/xpay (96-102) + paypal (131), my courses/certificates/certificate download (103-106), payments + receipt (109-110), subscription checkout/verify/enroll-course (113-116), learn/loadLesson/markComplete (119-122), myAssignments/myQuizzes/loadQuiz/submitQuiz/loadAssignment/submitAssignment (125-130), community write (134-137), ai-chat (140-141), messages 8 verbs incl. `/poll` (144-153), coupons/validate (156), discussions 8 verbs (159-168), live-classes 3 reads (171-173). Instructor prefix (177-287): its own auth + verify-certificate (178-186), dashboard/analytics, settings, courses read-only (205-206), bundles read, chat 9 verbs incl accept/decline (212-220), assignments grade (223-226), quiz attempts read (229-230), events manage + ticket verify (233-238), students, reviews + replies, earnings/subscription-sales/withdrawals (251-254), coupons CRUD (257-261), discussions incl pin/announcement (264-275), live-classes CRUD + start/end (278-285).

**Student web, `Laravel/routes/student.php` (121 lines).** All behind `auth, role:student`. The player loop (55-70): access show, lesson load/complete/progress, quiz load/submit + attempt results, assignment load/submit + submission view, `item/next`, `item/previous`, `search`, `sidebar/refresh`, `completion`, `certificate/download`. Plus discussions 8 verbs (73-82), live-classes index, events bookings, notifications, community 6 verbs, ai-chat 2, messages 8 (110-119). Key delta vs API: web has `lesson/progress` (percentage, line 58) and `quiz/attempt/{id}/results` (61) and `sidebar/refresh` (68) — **the API has none of these three** (Flutter cannot send watch-percentage; see A-trace).

**Admin web, `Laravel/routes/admin.php` (264 lines).** `auth, role:admin, license` (42). 18 settings pairs GET/PUT platform→live-class (46-80), gateway matrix (81-82), language manager with runtime key add (85-91), custom-pages, system maintenance (94-100), newsletter send, events toggle-publish, instructor approve/reject (110-116), students, enrollment lifecycle approve/reject/cancel/complete + update-status (125-133), payment approve/reject + offline-pending queue (136-142), reports, certificates list/download (147-149,244), withdrawals status (152-154), account-deletion queue, reviews moderation (161-168), impersonation student+instructor (171-172), users, course approve/reject/update-status/soft-delete/full-delete (178-185), bundles + approve, taxonomies, frontend manager 12 groups + theme upload (196-225), learning browsers quiz-attempts/assignment-submissions (231-235), blog, notifications + resend, coupons, subscription-plans + assign + approve-offline (253-258), updater (261-262).

**Instructor web, `Laravel/routes/instructor.php` (167 lines).** `auth, role:instructor`. Pending gate (36), dashboard, courses list, students, assignments grade (47-50), quiz attempts, 6-tab event builder (basic/schedule/highlights/speakers/review/publish, 70-89), analytics, reviews reply, earnings + withdrawals (100-103), settings, notifications, course builder create/edit/update (118-132) + AI generate-description (126), bundles, coupons, discussions + pin/announcement (151-160), live-classes CRUD + start/end (163-166).

### V2.1 Trace A — Sequential locking + resume (exact rules)

**Item order.** `getAllCourseItems()` (web `Laravel/app/Http/Controllers/Student/StudentCourseController.php:985-1022`; API `Laravel/app/Http/Controllers/Api/StudentCourseController.php:652-688`) flattens topics in `order`, and within each topic pushes **all lessons, then all quizzes, then all assignments**, each subgroup sorted by its own `order`; final sort `[topic_order asc, order asc]`. Consequence: a quiz can never sit between two lessons of the same topic — interleaving is structurally impossible.

**`isItemAccessible()` exact logic** (web :957-980; API :690-716): ① refetch the full course with topics; ② find `currentIndex` in the flattened list; ③ `currentIndex === 0 || currentIndex === false` → accessible iff the item exists at all (first item always open); ④ else loop every previous item and require `isItemCompleted()` (:1167-1194 / :718-741): lesson → any `LessonProgress.is_completed`; quiz → any `QuizAttempt.passed` (any attempt ever); assignment → any submission row (grade not required).

**Locked response shapes.** Web: 403 `{success:false, error:"Please complete the previous lessons before accessing this one.", locked:true}` (`Student/StudentCourseController.php:209-215`; quiz variant :274-280, assignment :338-344). API: 403 `{message:"This lesson is locked. Complete previous items first."}` — **no `locked` flag**, no structured code (`Api/StudentCourseController.php:167-169, 287-289, 436-438`). The Flutter client therefore decides lock UX from the sidebar's `is_accessible` field, not from the error payload.

**Resume / `current_item`.** API `show()` (:26-147): computes `accessibleItems` map for every item, then `determineCurrentItem()` (:767-812) = first item that is accessible **and not completed**; when everything is complete it returns the **first** item (:808-811) — "continue learning" restarts the course. Web `show()` (:42-190) does something different and worse: `$currentItem = $firstLesson ?? $firstQuiz ?? $firstAssignment` (:79-80) — always the first lesson, i.e. web "resume" is fake.

**Progress writes.** `loadLesson` upserts `LessonProgress` via `firstOrCreate` + `last_accessed_at=now()` (API :172-184). `markLessonComplete` requires the row to already exist — `firstOrFail` (API :224-227) — so POSTing complete before a load 404s (V2-07). Watch percentage exists **only on web**: `updateProgress` (`student.php:58` → controller :440-475) writes `progress_percentage` and auto-completes at ≥100; the API surface has no equivalent, so the Flutter player never reports position despite the column existing.

**Completion computation.** `isCourseCompleted()` loops all items through `isItemCompleted` (web :1135-1150; API :743-755); `checkAndUpdateCourseCompletion()` flips `enrollment.status → completed` (web :1155-1165; API :757-765). Topic rollup `CourseTopic::getProgressStats()` (`Laravel/app/Models/CourseTopic.php:60-91`) counts completed items only (`{total_items, completed_items}`) — note it reads the `keyBy('quiz_id')` attempt map, so a quiz passed earlier and failed later on retake reads as incomplete (last-row-wins ambiguity).

**GET side effect.** Both `show()` handlers mutate on read: web :58-62 and API :47-51 auto-flip the enrollment to `completed` during a GET (V2-06).

**Cost.** `isItemAccessible` refetches the whole course and issues one query per prior item; `show()` and `refreshSidebar()` call it for every item (web :97-101, :1058-1062) → O(items²) queries per page view (V2-11).

| Aspect | EduEx (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|---|
| Server-enforced gating | `isItemAccessible` web :957-980 / API :690-716 | none — `record_progress` accepts any lesson (`backend/app/api/v1/lms.py:390-459`) | gating concept absent | **Adopt** (design §V2.7) |
| Resume composition | `current_item` API :767-812 (real); web :79-80 (fake) | `StudentProgress.last_position_secs` stored but unused (`backend/app/models/lms.py:127`) | we store better data, compose nothing | **Adapt** — compose from `last_position_secs` first, fallback first-uncompleted |
| Locked error contract | web `{locked:true}` 403 :209-215; API message-only | generic 404/400s | adopt `locked:true` + `locked_reason` shape | **Adopt** |
| Completion trigger | GET side effect (API :47-51) + POST check :757-765 | explicit POST only (`lms.py:390-495`), no auto-complete | ours is the correct pattern; add transition + event | **Keep ours**, add auto-complete on POST |
| Watch-position sync | API lacks endpoint; web-only :440-475 | POST accepts `last_position_secs`/`watch_time_mins` (`lms.py:454-459`) | ours already ahead | **Keep ours** |
| Perf model | O(n²) refetch-per-item | single-pass aggregate recompute (`lms.py:461-477`) | ours scales better | **Keep ours** |

### V2.2 Trace B — Certificate engine (exact rules)

**Deterministic code.** `Enrollment::getCertificateNumberAttribute` (`Laravel/app/Models/Enrollment.php:60-75`): `sprintf('CERT-%06d-%s', $this->id, strtoupper(substr(md5($this->user_id . $this->course_id), 0, 6)))` — derived from two sequential DB ids, no secret component. The web download path re-implements the same string inline (`Student/StudentCourseController.php:1267`).

**Generation.** `Api/CertificateController::download` (:77-107) and `downloadSigned` (:113-141): `Pdf::loadView('student.certificate', $certificateData)` → A4 landscape, all margins 0, `enable-local-file-access` + `isRemoteEnabled` options (:96-105). Template variables: `student_name`, `course_title`, `instructor_name`, `completion_date`, `certificate_number`, `background_base64` (PNG at `public/assets/front/img/certificate.png` read via `certificateBackgroundBase64()` :148-156, base64-embedded into the Blade). `completion_date` = `enrollment.updated_at` accessor (`Enrollment.php:77-79`) — **there is no `completed_at` column**, so any later enrollment row-update silently changes the printed issue date.

**Signed URLs.** `index`/`show` mint `URL::temporarySignedRoute('api.certificates.download.signed', now()->addDays(1), ['id' => …])` (:43-49, :69-74); the route carries `->middleware('signed')` (`Laravel/routes/api.php:54`) and `downloadSigned` deliberately skips the user check (:113-116) — the signature is the only auth, 24 h validity.

**Public verification.** `Front/CertificateVerificationController::verify` (`Laravel/app/Http/Controllers/Front/CertificateVerificationController.php:24-38`) renders `pages.verify-certificate`; API twins at `routes/api.php:60-61`. Lookup logic in `CertificateVerificationService::verify` (`Laravel/app/Services/CertificateVerificationService.php:22-96`): parses `CERT-<id>-<hash>`, **or `CERT-<id>` alone, or a bare numeric enrollment id** (:33-41); finds enrollment by id with `status=completed` (:47-51); checksum comparison then accepts all three forms (:63-66) — the md5 suffix is decorative, codes are trivially enumerable. Success payload returns `student_name`, `course_title`, `instructor_name`, completion/issue dates, `verification_url` — unauthenticated PII disclosure (V2-05).

| Aspect | EduEx | ASchool | Verdict |
|---|---|---|---|
| Certificate existence | full engine above | zero `certificate` hits in `backend/app/models/lms.py` / `api/v1/lms.py` | **Adopt** (design §V2.7) |
| Code entropy | `md5(user_id.course_id)` + enumerable prefix (Enrollment.php:60-75, Service :33-66) | n/a | **Adapt** — random `secrets.token_hex(4)` suffix, reject bare-id lookups |
| Issue-date source | `enrollment.updated_at` (Enrollment.php:77-79) | n/a | **Adapt** — dedicated `issued_at` column |
| Signed download | 24 h `temporarySignedRoute`, api.php:54 | n/a (our files go through authenticated routes) | **Adopt** pattern (itsdangerous timed serializer) |
| Public verify page | web.php:28 + api.php:60-61 | none | **Adopt** — Nepal job-market credibility |
| PDF stack | DomPDF + base64 background (Api/CertificateController.php:96-105) | none; `backend/app/api/v1/design_studio.py` renders documents separately | **Adapt** — weasyprint service reading template |

### V2.3 Trace C — Course discussions (exact rules)

**Tables.** `Laravel/database/migrations/2026_06_24_081355_create_course_discussions_tables.php` creates **4 tables** (v1's "5 tables" overcounted): `course_discussions` (course_id FK, user_id FK, title, content, `is_pinned`, `is_announcement`), `course_discussion_replies` (discussion_id FK, user_id, content), `course_discussion_likes` (unique `[user_id, discussion_id]`), `course_discussion_reply_likes` (unique `[user_id, reply_id]`). No body/edited columns, no soft deletes.

**Layering.** Controller (`Laravel/app/Http/Controllers/Api/CourseDiscussionController.php`) → `CourseDiscussionService` (`Laravel/app/Services/CourseDiscussionService.php`) → `CourseDiscussionRepository` (`Laravel/app/Repositories/CourseDiscussionRepository.php`) — the only repository in the codebase.

**Permissions.** `hasCourseAccess` (Service :44-62): `isAdmin()` OR instructor owning `Course.instructor_id` OR student with `approved|completed` enrollment. `isCourseModerator` (:70-82): admin or owning instructor. Creation strips `is_pinned`/`is_announcement` from non-moderator payloads (:139-146); toggles are moderator-only (:205-238); deletes are author-or-moderator for both threads (:251-268) and replies (:280-296). Validation: title `required|max:255`, content `required` (`Laravel/app/Http/Requests/StoreCourseDiscussionRequest.php:31-36`); replies content-only (`StoreCourseDiscussionReplyRequest.php:31-33`).

**Listing.** Repository `getDiscussionsForCourse` (:37-79): search title/content, filters `pinned|announcements|my_questions`, order `is_pinned desc → is_announcement desc → created_at desc`, `withCount(replies, likes)` + `withExists(likes as is_liked)` per viewer, 15/page.

**Notification fan-out: none.** `grep -rn "notify|Notification"` across the service, repository, and both discussion controllers returns **zero** hits — replies, likes, and pins trigger no notification, in-app or email. The pin/announcement flags are pure sort signals. There are also no edit endpoints (create+delete only).

| Aspect | EduEx | ASchool | Verdict |
|---|---|---|---|
| Discussion storage | 4 tables above | nothing (only school-wide `notices` plugin) | **Adopt** (design §V2.7) |
| Role model | admin / owning-instructor / enrolled-student (Service :44-82) | teacher owns course via `Course.teacher_id` + `@school_required` scoping | **Adapt** — moderator = course teacher or school_admin |
| Pin/announcement | moderator toggles, sort-first (:205-238) | n/a | **Adopt** — maps to per-course teacher broadcast |
| Notifications on reply | **absent** (verified zero refs) | notifications plugin + event bus exist | **Adopt-and-beat** — emit `lms.discussion_reply` |
| Tenant scoping | none (single tenant; only `course_id` chain) | every row needs `school_id` via `SchoolModel` | **Adapt** (mandatory) |
| Editing | none | n/a | **Adapt** — add PUT within edit window |

### V2.4 Trace D — Monetization state machine (exact rules)

**Payment row lifecycle.** Base `payments` table (`Laravel/database/migrations/2025_11_05_154252_create_payments_table.php`): `enrollment_id`, `payment_method enum('razorpay','offline')`, `amount`, `status enum('pending','completed','failed','refunded')`, `razorpay_order_id/payment_id/signature`, `receipt_file`, `transaction_id`, `notes`. Then **9 additive migrations** widen it: stripe fields (2025_11_05_211512), paystack+flutterwave (2025_11_06_082652), paypal (2025_11_06_084513), sslcommerz tran/session/val (2025_11_06_085557), mollie (2025_11_06_093811), `platform_commission/instructor_earning/commission_processed` (2025_11_10_130100), bundle_id (2026_04_20_000003), bkash (2026_04_23_080000), xpay (2026_06_25_100000), coupon `coupon_id/discount_amount` (2026_06_24_000003), subscription `subscription_plan_id/user_subscription_id` (2026_08_05_080314), `user_id` (2026_08_05_090000) — 10 gateways × ~3 nullable columns each on one row (cast list: `Laravel/app/Models/Payment.php:41-48`).

**Checkout (`Api/CourseEnrollmentController::enroll`, :56-590).** Bundle vs course branch (:61-92): bundle requires `status=active` + `approval_status=approved`, warns on owned overlap with a `confirm_duplicate` opt-in (:75-84), charges full price for remaining courses. Course branch requires `status=published` + `visibility=public` (:95) and **deletes any existing pending enrollment** before re-checkout unless an offline request is open (:102-115). Coupon applies only to single courses (:122-133) via `CouponService::validate` (below). Gateway-enabled check (:135-140). Then one branch per method, each following the same contract: create gateway order/session → `Enrollment::firstOrCreate(user, course, status=pending)` → `Payment::create(status=pending, gateway refs, coupon_id, discount_amount)` → link `enrollment.payment_id` → return SDK params. Free path (price 0, including 100%-discount coupon) approves immediately, writes `CouponUsage` + increments `used_count`, sends emails (:547-577). Offline path stores `receipt_file` + `transaction_id` for admin queue (:512-546).

**Verify → activation (all 7 online verify methods).** razorpay :592-666 (server HMAC `hash_hmac('sha256', orderId|paymentId, secret)` :989-998), sslcommerz :667-768 (server-side val_id validation call), stripe :770-848 (`PaymentIntent::retrieve`, status `succeeded`), paystack :850-942 (`GET transaction/verify/{ref}`); paypal/mollie/bkash/xpay same shape (cc :1320, :1249, :1667, :1780). Common sequence: match gateway ref on the payment row → `payment.status=completed` → `enrollment.status=approved, enrolled_at=now` → `processRevenueShare` (:1118-1131) → commit → `sendEnrollmentNotifications` (pref-checked emails :1096-1116) → bundle data. **No ownership check on `enrollment_id`** in any of them (e.g. :601, :676, :777, :857) — V2-03.

**Bundle fan-out.** `Enrollment::booted()` updated-listener (`Laravel/app/Models/Enrollment.php:26-64`): when `status` changes to `approved` and `payment.bundle_id` is set, it approves **all** of that user's pending enrollments for the bundle's courses inside `static::withoutEvents` (recursion guard), attaching the same `payment_id`, and upserts `BundleEnrollment` to approved. The Flutter-visible fan-out result rides back via `buildBundleCoursesData` (:1138-1167).

**Revenue share.** `Laravel/app/Services/RevenueShareService.php`: settings `revenue.distribution` `{mode: fixed|percentage, value}`; `calculate` (:30-57) fixed = `min(value, amount)`, percentage clamped 0-100; `process` (:59-190) is idempotent via `payment.commission_processed` (:47-49) inside a DB transaction, with 3 paths: (1) **subscription payment** — splits `instructor_earning` equally over plan courses + plan bundles, admin-owned bundles sub-split pro-rata by course count, per-instructor `users.balance` increments; (2) **bundle purchase** — vendor balance, or pro-rata for admin bundles; (3) **single course** — course instructor. Audit trail = JSON wrapped in an HTML comment appended to `payments.notes` (:154-171, `parseBreakdown` :195-201).

**Coupons.** `Laravel/app/Services/CouponService.php::validate` (:25-86): active status, `valid_from/valid_to` window, `usage_limit` vs `used_count`, one redemption per user via `CouponUsage` lookup, `course_id` and `instructor_id` scoping; `calculateDiscount` (:93-108) percentage or fixed, capped at price. Ledger: free path inline (:559-566); **paid path via `Payment::booted()` saved-hook** (`Laravel/app/Models/Payment.php:48-73`) — `CouponUsage::firstOrCreate` + `used_count` increment whenever status transitions into `completed` (increment re-fires if a payment re-enters completed — V2-10). Check-then-act validation has no lock (race under concurrency).

**Subscriptions.** Schema (`Laravel/database/migrations/2026_08_05_080314_create_subscription_system_tables.php`): `subscription_plans` (billing_period `monthly|quarterly|half_yearly|yearly|lifetime`, duration_days, `course_limit`, features JSON), `subscription_plan_courses`, `subscription_plan_bundles`, `user_subscriptions` (starts_at, ends_at NULL=lifetime, status `active|expired|cancelled|pending_approval`, `courses_accessed_count`). `SubscriptionService::activateSubscription` (`Laravel/app/Services/SubscriptionService.php:19-63`) cancels prior active subs, creates the row, links the payment, runs revenue share, fires `SubscriptionPurchased`. Access check `User::hasAccessToCourseViaSubscription` (`Laravel/app/Models/User.php:278-286`) → `UserSubscription::includesCourse` (`UserSubscription.php:94-101`). **`enrollCourse`** (`Laravel/app/Http/Controllers/Api/SubscriptionController.php:565-601`) then creates a plain `Enrollment(status=approved)` — never checks `course_limit`, never increments `courses_accessed_count` (only ever set to 0, Service :45,:106), and the enrollment survives subscription expiry because nothing ever sweeps expired subs (no scheduler reference to `STATUS_EXPIRED` anywhere in `app/Console`, `routes/console.php`, or services) — V2-04.

**Withdrawals.** `InstructorWithdrawal` states `pending|processing|completed|rejected` (`Laravel/app/Models/InstructorWithdrawal.php:34-38`). Request (`Laravel/app/Http/Controllers/Api/Instructor/EarningsController.php:337-381`): approved account, min amount from settings, `method in:bank_transfer,paypal,stripe`, balance check then **balance decremented immediately** at request time, reference `WD-YYYYMMDD-XXXXX`. Admin `updateStatus` (`Laravel/app/Http/Controllers/Admin/WithdrawalController.php:108-145`): only pending/processing mutable; **rejected refunds the balance** (:125-129); completed stamps `processed_at`.

| Aspect | EduEx | ASchool | Verdict |
|---|---|---|---|
| Gateway schema | 12 migrations, ~30 nullable per-gateway columns on `payments` | `fees` plugin keeps gateway config in settings rows + 3 Nepal gateway services (`backend/app/services/payments/esewa_gateway.py:16`, `khalti_gateway.py:11`, `fonepay_gateway.py:22`) | **Reject columns, keep our JSON/config approach** |
| Verify contract | create → pending payment → verify w/ server-side check → approve → revenue share → notify | esewa/khalti/fonepay all have `verify_payment` server-side today (`esewa_gateway.py:98`, `khalti_gateway.py:75`, `fonepay_gateway.py:105`) | **Adopt the uniform contract shape** if LMS commerce lands (phase 3) |
| Bundle/plan fan-out | `Enrollment::booted()` observer (Enrollment.php:26-64) | event bus in manifests (`backend/app/plugins/modules/lms/manifest.yaml` emits/listens) | **Adopt via events, not model hooks** (v1 §7 already says this — confirmed the exact observer to imitate) |
| Coupon ledger | `coupon_usages` + `used_count` + Payment saved-hook | none for LMS | **Adopt** (with row-lock on validate) |
| Subscription→enrollment | permanent approved enrollment, no expiry sweep, `course_limit` dead | n/a | **Reject as-is** — if ever built, enforce `ends_at` at read time |
| Offline queue | instructions + receipt + admin approve (admin.php:138-142) | fees plugin already has manual flows | **Adopt screen pattern only** |

### V2.5 Trace E — Quiz + assignment engines (exact rules)

**Quiz submit.** API `submitQuiz` (`Laravel/app/Http/Controllers/Api/StudentCourseController.php:323-411`); web :477-585. Transaction; `QuizAttempt::create` with `started_at = now(), completed_at = now()` (API :335-343 — the code itself comments "Should ideally come from request"), `time_taken = $request->input('time_taken')` — **client-supplied, server-ignored timer** (`SubmitQuizRequest.php:34` makes it `nullable|integer|min:0`; `quizzes.time_limit` is never checked server-side). Per answer: `(int) selected_answer === $question->correct_answer` (int index into `options` JSON, `Laravel/database/migrations/2025_11_04_214858_create_quiz_questions_table.php`) → `is_correct`; unclaimed questions silently skipped (`continue`, :353-354). `score = round(correct/total*100)`, `passed = score >= quiz->passing_score` (default 60, `2025_11_04_214857_create_quizzes_table.php:17`). **No attempt limit** — `loadQuiz(retake=true)` bypasses the passed short-circuit (API :299-308) and unlimited retakes are possible; retakes never reset anything.

**Authz gaps in submit.** Neither API `submitQuiz` nor API `submitAssignment` calls `isItemAccessible` (the web versions check only on load), and both resolve the quiz/assignment by bare `findOrFail($quizId)` / raw `$assignmentId` **without verifying it belongs to `{courseId}`** (API :331, :481; the web versions do scope via `whereHas` :482-487, :592-597; the API submit has only a comment "Check availability logic again if strict" :477) — V2-01/V2-02.

**Next-item on quiz pass.** API returns `next_item = $allItems[$currentIndex + 1]` with no accessibility check ("Simplify for now", :393) — can point the client at a locked item; the web version walks forward until accessible (:550-561).

**Assignment flow.** Submit (API :459-525): `submission_text` nullable, single `file` max 10 MB stored under `assignments/` (web uses `FileUploadService` multi-file, :610-616); row = user + assignment + enrollment + `submitted_at=now` + `status=pending`. Grade (`Laravel/app/Http/Controllers/Api/Instructor/AssignmentController.php:142-169`): owning-instructor only (:149-152), `status in:pending,graded,returned`, `grade` int 0-100, `instructor_notes` max 2000. Statuses (`Laravel/app/Models/AssignmentSubmission.php:27-30` + migration enum): `pending → graded | returned`; `returned` sets `can_resubmit` in web UI (`Student/StudentCourseController.php:371`). Completion counts **any** submission, graded or not (:1184-1191). Assignments have **no due-date column** (`2025_11_04_214859_create_assignments_table.php`), and the API's `myAssignments` fabricates `due_date = created_at + 7 days` (:556) — placeholder data shipped to production (V2-08).

| Aspect | EduEx | ASchool | Verdict |
|---|---|---|---|
| Scoring | server-side percent + passing score (API :371-372) | **client sends its own `score`** (`backend/app/api/v1/lms.py:323-332` — no grading at all) | **Adopt server-side grading** — ours is strictly worse here |
| Timer | client-rendered only; `started_at=completed_at=now` | `time_limit_minutes` column exists (`backend/app/models/lms.py:140`), unenforced | **Adapt** — server `started_at` + deadline check |
| Attempt policy | unlimited; no max_attempts | none | **Adopt** max_attempts + passing_score columns |
| Question model | single-correct int index, JSON options | `Quiz.questions` JSONB blob (`models/lms.py:138`) | **Adapt** — delegate to exams question-bank plugin (v1 §7.1) |
| Assignment grade flow | pending/graded/returned + owner check | `backend/app/api/v1/assignments.py:262-289` grade endpoint + `ai-grade` :291+ | **Keep ours** (richer: due dates + AI grade); borrow `returned→resubmit` state |

### V2.6 Flutter player — course_access_screen.dart widget-by-widget (751 lines, full read)

`initState` → `NoScreenshot.instance.screenshotOff()` (:56) + `getCourseCurriculum` → `GET /user/courses/{id}/learn` (:85-87); `current_item.type == 'lesson'` auto-loads via post-frame callback (:98-106). `_loadLesson` (:134-174) → `POST …/lessons/{id}` (loadLesson service) → `_initializeVideoPlayer` (:176-237) picks YouTube (`YoutubePlayerController` :177-184), Vimeo (`_vimeoVideoId` :185-189), or network file via `video_player`+`chewie` with fullscreen orientations (:190-231). Controls row prev/next + `Mark Complete` button (:415-457); `_markComplete` (:239-272) → `POST …/complete`, then refresh curriculum and auto-advance **lessons only** (`next_item.type=='lesson'`, :261-266 — a quiz/assignment next_item is silently dropped). `_goToNext` checks `is_accessible` client-side and shows a lock snackbar (:321-341). Body = 16:9 player + `TabBar` Curriculum/Forums (:464-473); curriculum = `ExpansionTile` per topic with per-item `ListTile` (lock icon when `is_accessible==false`, play/quiz icon, green check when completed, red LIVE badge from `live_class.status`, :486-543); tab 2 embeds `CourseDiscussionTab(courseId)` (:606). Live-class state lives inside the player frame (:623-720): LIVE NOW / SCHEDULED / SESSION ENDED chips, Join button `launchUrl(join_url ?? recording_url, externalApplication)` (:696-703). `quiz_attempt_screen.dart` runs the timer client-side only (`Timer.periodic` :145-156, fallback 1800 s :47, auto-submit at 0, `time_taken` from remaining seconds :223-226, retake reload :418). `course_detail_screen.dart` (2,105 lines): `fetchCourseDetail` (:53-60), preview-video sheet gated on `lessons[i].isPreview` (:117-130, :220-233), rating histogram + review list (:332-481), instructor card (:494), related courses (:656), wishlist via provider toggle (:793-807 — SharedPreferences only), bottom bar price + Enroll → pushes `CheckoutScreen` (:1305-1321 region) or continue-learning when enrolled.

| Aspect | EduEx | ASchool | Verdict |
|---|---|---|---|
| Player shell | one scaffold: video/quiz/assignment + sidebar + forums tab | `flutter_student/lib/features/lms/student_lms.dart` (single screen, no player shell) | **Adopt** the shell pattern |
| Lock UX | lock icons + snackbar driven by server `is_accessible` | n/a | **Adopt** |
| Anti-screenshot | `no_screenshot` on enter/dispose (:56,:63) | absent | **Adopt** (one dependency) |
| Resume | `current_item` auto-load (:98-106) | manual navigation | **Adopt** with our `last_position_secs` |
| Watch-position reporting | never sent (no API endpoint) | endpoint exists (`lms.py:454-459`) | **Keep ours** |
| Live join | external launch :696-703 | Jitsi room auto-provisioned (`backend/app/services/lms/video_service.py:19-22`) | **Keep ours** |

### V2.7 New v2 findings (V2-01…)

- **V2-01 — Locking enforced on reads, not writes (API).** `submitQuiz`/`submitAssignment` never call `isItemAccessible` (Api/StudentCourseController.php:323-344, :459-488); a student can complete/submit items out of order and unlock the whole chain prematurely.
- **V2-02 — Cross-course quiz submission.** API `submitQuiz` resolves `$quiz = Quiz::findOrFail($quizId)` (:331) without checking `quiz.topic.course_id == courseId`; the enrollment only binds to `{courseId}`. Attempts can be recorded against the wrong course's enrollment. Same missing binding in API `submitAssignment` (:481).
- **V2-03 — Payment-verify IDOR + no ownership/idempotency.** All 7 verify methods load `Enrollment::findOrFail($request->enrollment_id)` with no `user_id` check (Api/CourseEnrollmentController.php:601, :676, :777, :857, and paypal/mollie/bkash/xpay twins). Repeat verify calls re-fire enrollment approve, emails, and the coupon saved-hook (revenue share alone is guarded by `commission_processed`, RevenueShareService.php:47-49). Also `payments.user_id` is never set on the API checkout path (no `user_id` key in any `Payment::create` :172-535; only the enrollment fallback in Payment.php:55).
- **V2-04 — Subscription access is forever; `course_limit` is dead code.** `enrollCourse` creates a permanent `approved` Enrollment (Api/SubscriptionController.php:583-590); no job ever expires `user_subscriptions` (zero `STATUS_EXPIRED` writers outside the model; `routes/console.php` is 12 lines); `courses_accessed_count` is initialized to 0 and never incremented or compared (SubscriptionService.php:45,:106; UserSubscription.php:94-101).
- **V2-05 — Certificate verification is decorative and leaks PII.** Accepts `CERT-<id>` or bare numeric id (CertificateVerificationService.php:33-41, :63-66) → enumerable; unauthenticated success payload includes student/instructor names and dates (:79-92).
- **V2-06 — GET mutates state; certificate date rides `updated_at`.** Enrollment auto-completes on read (web :58-62; API :47-51); `completion_date` = `enrollment.updated_at` (Enrollment.php:77-79) with no `completed_at` column, so later row updates rewrite the printed issue date.
- **V2-07 — `markLessonComplete` 404s before first load.** Requires an existing `LessonProgress` row via `firstOrFail` (API :224-227) while the row is only created in `loadLesson` (:172-184) — a client that calls complete first gets an unhandled 404.
- **V2-08 — Fabricated due dates shipped to the app.** `myAssignments` returns `due_date = created_at->addDays(7)` (API :556); assignments have no due-date column at all.
- **V2-09 — Resume lies at both ends.** All-completed `current_item` = first item (API :808-811) restarts the course; web `current_item` is always the first lesson (:79-80); API quiz pass returns a possibly-locked `next_item` (:393).
- **V2-10 — Coupon ledger races.** `Payment::booted()` increments `used_count` on every transition into completed (Payment.php:48-73) — a completed→failed→completed flip double-counts; `CouponService::validate` is check-then-act with no lock (CouponService.php:52-56) so concurrent checkouts can exceed `usage_limit`.
- **V2-11 — O(n²) authorization.** `isItemAccessible` refetches the course + one query per prior item on every call (:957-980 / :690-716), and `show()`/`refreshSidebar()` invoke it per item (web :97-101, :1058-1062).
- **V2-12 — Progress keyed inconsistently.** `lesson_progress` unique constraint is `(user_id, lesson_id)` without `enrollment_id` (2025_11_05_171656 migration, lines 19-20) while every query filters by enrollment; the enroll flow deletes pending enrollments (Api/CourseEnrollmentController.php:114) and `enrollments` cascades progress on delete (2025_11_05_154253) — a re-purchase silently wipes learning history.

**Defect verification (v1 claims, line-level).** Path traversal + no-auth streaming confirmed: `/api/video/stream` sits **outside** the sanctum group (`routes/api.php:49`) and `FileController::stream` builds `storage_path('app/public/'.$cleanPath)` from `?path=` with no containment check and echoes the absolute path in its 404 (`Laravel/app/Http/Controllers/Api/FileController.php:14-46`); the player hits it for every uploaded lesson (`Api/StudentCourseController.php:629,:646`). Mock AI screens confirmed: zero `http|Service` references in `Eduex Flutter/lib/screens/ai_suggestions/ai_suggestions_screen.dart` and `ai_learning_path/ai_learning_path_screen.dart`. No push confirmed: no `firebase|fcm|push` in `Eduex Flutter/pubspec.yaml`. Client-trusted timer confirmed: `quiz_attempt_screen.dart:144-156` + `started_at=completed_at=now` (`Api/StudentCourseController.php:339-340`).

### V2.8 Concrete adoption design for ASchool

Conventions: every model extends `SchoolModel` (`backend/app/models/base.py`), every route carries `@jwt_required() @school_required @plugin_required("lms")` (as in `backend/app/api/v1/lms.py:29-32`), teachers via `@role_required("superadmin", "school_admin", "teacher")` where mutating. Schema changes land in `backend/app/models/lms.py` (+ migration); the manifest already emits `lms.course_completed` (`backend/app/plugins/modules/lms/manifest.yaml` events.emits) — certificates hook it.

**(1) Sequential locking + resume (Phase 1a).**
- Columns: `Course.require_sequential = Column(Boolean, default=False)` (EduEx hard-codes always-on; make it a per-tenant/course choice). Nothing else — order already exists (`Lesson.sort_order`, `models/lms.py:51`); the sequence is `(sort_order, id)` over non-deleted lessons of the course. Fix the Topic inversion later (v1 §7.1).
- New service `backend/app/services/lms/sequence_service.py`: `course_sequence(course) -> [lesson_ids]`, `first_uncompleted(completed_set)`, `is_accessible(index, completed_set)` — computed from **one** `StudentProgress` fetch (O(n), fixing EduEx's O(n²)).
- Endpoints in `backend/app/api/v1/lms.py`:
  - `GET /lms/courses/<course_id>/learn` → `{course, is_completed, current_item: {id, type:"lesson"}, topics: [{items: [{id, title, is_completed, is_accessible, locked_reason}]}]}`. `current_item` = last-position lesson (from `StudentProgress.last_position_secs`) if incomplete, else first uncompleted, else null.
  - `POST /lms/courses/<course_id>/lessons/<lesson_id>/complete` (replace/augment `record_progress` at `lms.py:390`) → **check `is_accessible` before writing** (the check EduEx forgot — V2-01), upsert `StudentProgress`, re-derive `Enrollment.completed_lessons/progress_percentage` (existing logic :461-486), flip `Enrollment.status="completed"` **only here** (never on GET), emit `lms.course_completed`. Response `{completed, course_completed, next_item}` where `next_item` = first accessible-and-uncompleted item after this lesson.
  - Error shape for locked access: `error_response({"message": "...", "locked": True, "locked_reason": "complete_previous"}, 403)` — adopt EduEx's web payload shape (`Student/StudentCourseController.php:209-215`).

**(2) Certificates (Phase 1b).**
- New models in `backend/app/models/lms.py`:
  - `CertificateTemplate(SchoolModel)`: `name`, `background_image_url`, `title_text`, `body_template JSONB`, `signatory_name`, `is_default Boolean`.
  - `IssuedCertificate(SchoolModel)`: `student_id FK users`, `course_id FK courses`, `enrollment_id FK enrollments (unique)`, `template_id`, `certificate_code String(40) unique` — format `CERT-<school_id[:4]>-<secrets.token_hex(4).upper()>` (**random, not derivable** — fixes V2-05), `issued_at DateTime` (**dedicated column** — fixes V2-06), `revoked_at/revoked_reason nullable`.
- Service `backend/app/services/lms/certificate_service.py`: issue on `lms.course_completed` (or explicit POST); render A4-landscape PDF with base64 background via weasyprint (mirroring `Api/CertificateController.php:96-105`).
- Endpoints: `GET /lms/certificates` (mine, w/ `download_url` from a timed `itsdangerous` serializer — adopt the 24 h signed-URL idea, `api.php:54`); `GET /lms/certificates/<id>/download` (jwt or valid signature); **public** `GET /public/verify-certificate/<code>` (new blueprint, no auth): lookup by exact `certificate_code` only (no id-prefix matches), return `{student_name, course_title, school_name, issued_at, revoked}` — minimal PII.

**(3) Discussions (Phase 1c).**
- New models in `backend/app/models/lms.py` (all `SchoolModel` = tenant-scoped, the thing EduEx cannot do):
  - `CourseDiscussion`: `course_id`, `user_id`, `title String(300)`, `content Text`, `is_pinned Boolean`, `is_announcement Boolean` (+ unique index `(school_id, course_id, created_at)` not needed; index on course_id).
  - `CourseDiscussionReply`: `discussion_id`, `user_id`, `content Text`.
  - `CourseDiscussionLike`: `discussion_id`, `user_id` — `UniqueConstraint(user_id, discussion_id)`; `CourseDiscussionReplyLike`: `reply_id`, `user_id` — `UniqueConstraint(user_id, reply_id)` (copy EduEx's unique-guard, migration lines 40, 50).
- Endpoints in `lms.py` (mirror `routes/api.php:159-168` + instructor pin/announcement `:271-272`):
  - `GET/POST /lms/courses/<course_id>/discussions` (query `filter=pinned|announcements|mine`, `search`, paginate; GET requires enrollment/teacher/admin — port `hasCourseAccess` logic from `CourseDiscussionService.php:44-62` mapped to `Course.teacher_id`/`school_admin`)
  - `GET /lms/discussions/<id>`, `POST /lms/discussions/<id>/replies`, `POST /lms/discussions/<id>/like`, `POST /lms/discussions/replies/<reply_id>/like` (toggle via the unique constraint)
  - `POST /lms/discussions/<id>/pin`, `POST /lms/discussions/<id>/announcement` — `@role_required("school_admin","teacher")` + teacher must own the course (moderator rule)
  - `DELETE /lms/discussions/<id>`, `DELETE /lms/discussions/<id>/replies/<reply_id>` — author-or-moderator
- Two upgrades over EduEx: (a) emit `lms.discussion_reply` / `lms.discussion_created` on the event bus so the notifications plugin fans out (EduEx has zero fan-out — §V2.3); (b) `PUT /lms/discussions/<id>` edit within a 15-minute window.

**Sequence:** 1a (learn + locking) → 1b (certificates) → 1c (discussions), matching v1 §7.2; each is additive to `models/lms.py` + `api/v1/lms.py` without touching the other 20 endpoints.

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
