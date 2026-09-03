# Flutter audit — condensed evidence (5 apps + aschool_shared)

Source: Explore agent, 247 Dart files / ~50.2k LOC. No builds run. HEAD 097e39c.

## Route inventory (verified)
**129 distinct routes / 124 screen files → Full 47, Partial 66, Stub 5 (+2 dead buttons).**

| App | Routes | Screens | LOC | Full | Partial | Stub |
|---|---|---|---|---|---|---|
| admin | 43 | 40 | 10,452 | 15 | 21 | 4 |
| teacher | 29 | 28 | 10,938 | 18 | 9 | 1 |
| parent | 25 | 23 | 6,054 | 5 | 18 | 0 |
| student | 32 | 27 | 8,563 | 9 | 18 | 0 |
| user | 6 | 6 | 1,545 | 6 | 0 | 0 |

22 of 40 admin files contain **no mutation at all**. 17 of 23 parent files have zero mutations — the parent app is a viewer plus a payment button.

## Prior-audit correction: push notifications
The "NotificationService.init() never called" claim is **wrong in code**. All five `main.dart` files call it (`admin/teacher/parent/student:12`, `user:15`). The Dart side is complete: FCM + OneSignal init, `_registerFcmToken` → `/auth/register-fcm`, re-registration after login with OneSignal tags, `NotificationRepository` + provider + `NotificationCenterScreen` + `NotificationBell` all wired, `/notifications` route in all four child routers, bell in every AppBar.

**But push is still dead in production, for four different reasons:**
1. **No `google-services.json` in any app** (find returns nothing). `Firebase.initializeApp()` at `notification_service.dart:70` throws → caught at :106 → `_fcmToken` stays null → `registerFcmTokenWithBackend()` no-ops at :162.
2. **No `com.google.gms.google-services` Gradle plugin** in any `build.gradle`/`settings.gradle.kts`.
3. **`ONESIGNAL_APP_ID` never supplied.** `notification_service.dart:115` reads `String.fromEnvironment(..., defaultValue: '')` → early return at :118. `.github/workflows/flutter-deploy.yml:52` builds with bare `flutter build apk --release` — **zero `--dart-define`**. Same for `API_BASE_URL`, which silently falls back to `https://api.brighternepal.com` (`constants.dart:11`).
4. **Notification taps navigate nowhere.** `setOnTapCallback` is defined (`:235`) and never called by any app. `notification_center_screen.dart:134-136` is an empty `if (notification.actionUrl != null) { // Navigate to action URL }`.

Also: `MobileVersionService` + `ForceUpdateDialog` are fully written and **never called** — no app fetches `/mobile/version`, so there is no kill switch / mandatory-upgrade path.

## Endpoint mismatches (404s in production) — 18 confirmed
Extracted 165 distinct mobile paths and diffed against every `@*_bp.route` + `url_prefix`.

P0: `GET /fees/student/{id}` (`fee_repository.dart:12`), `POST /fees/pay` (`:34` — real route is `/fees/collections/{id}/pay`), `GET /fees/transactions` (`:49`), `GET /student/classmates` (`student_repository.dart:73`), `GET|POST /announcements` (`announcement_screen.dart:10,251`, `notice_repository.dart:24` — no `/announcements` prefix exists anywhere).

P1: `/transport/live/{id}`, `/emergency/evacuation-plans` (real: `/emergency/plans`), `/lms/live-classes`, `/teacher/portfolios` + `/feedback`, `/teacher/wellbeing`, `/health/records` + `/health/vaccinations` (real prefix `/health-records`, and `/immunizations`), `/admission/leads` + `/stats` (real: `/inquiries`, `/dashboard`), `/inventory` (real: `/inventory/assets`), `/wellbeing/dashboard` + `/alerts`, `/dismissal/summary`, `/visitors/badge/{code}`, `/attendance/me`.

The prior audit's named mismatches (`/hr-payroll/*`, `/ai/{tool}/generate`) **are already fixed** — see explicit comments at `hr_repository.dart:8-11` and `ai_repository.dart:6-9`.

## Offline support: effectively nonexistent (the biggest Nepal-specific gap)
- **No local DB in any app.** No sqflite/hive/isar/objectbox/drift in any pubspec or import. `aschool_shared/pubspec.yaml:24` has the comment `# Local Database (Offline-first)` with **nothing under it**.
- `connectivity_plus` is a dependency of shared **and** student and is imported **zero times**. No connectivity awareness at all.
- `constants.dart:18-21` declares `cached_user`, `cached_school`, `cacheExpiry` — never read or written. Dead constants.
- The only working offline path: `plugin_provider.dart:89-117` caches the installed-plugin list + module visibility in secure storage and loads it before the network call. Done well.

**P0 — offline attendance marking.** `flutter_teacher/lib/features/attendance/attendance_screen.dart:62-75` posts `/attendance/submit` and throws on failure. The teacher taps through 40 students, hits Submit, connection drops, **all work is gone** — local state lives in an `autoDispose` provider discarded on navigation. Highest-value single fix in the mobile audit.

**P0 — no queued mutations anywhere.** Marks entry (962 LOC of careful theory/practical validation), homework submission, mood logging, leave application, notice creation — all fire-and-forget. No outbox, no retry. The only idempotency key in the codebase is `FeeRepository.makePayment` (`fee_repository.dart:33`) and it's dead code because `/fees/pay` 404s.

## JSON safety — better than prior audits claimed, with specific remaining holes
`aschool_shared/lib/utils/safe_parse.dart` (255 lines) is well designed: `safeInt/safeDouble/safeBool/safeString/safeMapList/safeDateTime` + envelope helpers, used consistently by all 21 shared models. The prior claim that `attendance.dart` does `json['id'] as String` is **stale** — `:37` is `safeString(...)`.

Remaining holes:
- **P1 `marks_entry_screen.dart:360-361`** — `safeMapList(...)..removeWhere(...)`: `safeMapList` returns `const []` on non-list input (safe_parse.dart:118), and `..removeWhere` on `const []` throws `UnsupportedError: Cannot remove from an unmodifiable list`. Any error envelope or 403 plugin-gate response crashes the whole marks-entry screen.
- **P2** 76 sites across 40 files use `List<Map<String,dynamic>>.from(response.data['data'] ?? [])` — CastError on non-Map entries, TypeError on a paginated Map envelope. Worst: `flutter_student/lib/features/classmates/classmates_screen.dart:32` has **no `?? []`**.
- **P2** `aschool_shared/lib/features/student_attendance_screen.dart:55` — `DateTime.parse(record.date)` where `record.date` is `safeString` with `''` fallback → `FormatException` kills the month view. `safeDateTime` exists at safe_parse.dart:195 and is **used nowhere**.
- P2 `create_lesson_screen.dart:114`, `create_topic_screen.dart:126` — `data['classes'] as List<ClassModel>` type-erased downcast; `child_profile_screen.dart:372` — bare `g as Map<String,dynamic>;`

## Untyped domains (no model, no repository — raw Maps in screens)
~23 backend domains: wellbeing, health-records, gamification, alumni, admission, inventory, compliance, social-hub, design-studio, dismissal, incidents, visitors, LMS courses/live-classes/materials/topics, portfolio, elibrary, library issues, emergency, reports, analytics, parent chat threads, bus tracking.

## Auth / session
Consistent and single-sourced. Tokens in `FlutterSecureStorage` in all five apps; SharedPreferences holds only theme mode + school slug. **Refresh-token queueing is properly implemented** (`api_client.dart:39-123`: `_isRefreshing` guard, `List<Completer<String?>> _refreshQueue`, drain-and-retry) — rare to see done right.

- **P1 `logout()` only clears storage** (`auth_service.dart:185-188`). Does not call `POST /auth/logout` (exists, along with `/logout-all`), does not disconnect `SocketService`, does not unregister the FCM token / OneSignal player, does not invalidate Riverpod providers. On a shared family phone the next user inherits the previous user's push subscription and stale `pluginProvider` state.
- P2 session-expiry is silent: `_tryRestoreSession` (`:56-61`) catches everything → `/login` with no message. A bad connection at app start logs you out with no explanation.
- P2 no biometric login anywhere (`local_auth` absent). The three `Icons.fingerprint` hits are for biometric *staff attendance*, not app unlock.
- P3 no password-reset/OTP screen despite `AuthNotifier.requestOtp`/`loginWithOtp` (`:65-97,172-182`) and `/auth/forgot-password` existing.

## Theming / i18n
- **P1 Forest Green is NOT in the shared theme.** `aschool_shared/lib/theme/app_theme.dart:17-27`: `primary = Color(0xFF22577A)` (steel blue), `accent = Color(0xFF57CC99)`. Web is `--primary: 163 62% 14%` (≈#0E3D2C). **Mobile and web are visually different products.** `app_theme.dart:158` seeds dark from `accent` (mint) so the brand color changes with theme mode.
- P2 21 hardcoded hex colors bypass the theme; `module_screen_template.dart:257,290` + `loading_shimmer.dart:34,46,73` hardcode `Colors.white` → **shimmer and the module template render white-on-dark in dark mode**.
- **P1 localization: zero.** No `flutter_localizations`, no `.arb`, no `AppLocalizations`, no `localizationsDelegates`, no `supportedLocales`. Devanagari appears in exactly one file (`class_model.dart:47`, a doc comment). ~378 hardcoded English strings (admin 145, teacher 97, student 68, parent 40, shared 25, user 3). Meanwhile `settings_screen.dart:115` has a "Nepali Language" switch writing `default_language:'ne'` to the school record — the server is ready and the client cannot render it.
- **P2 BS dates: display only, no picker.** `nepali_date_display.dart` ships a correct hand-rolled 2000–2090 BS table used at 14 display sites. But the **only date input in the entire mobile codebase** is a Gregorian `showDatePicker()` at `flutter_teacher/.../assignments_screen.dart:997`. A Nepali teacher must think in AD to set a due date. `adToBsString` silently falls back to an ISO AD string outside 1943–2033.
- `nepali_date_converter` and `table_calendar` are declared with **`any`** version; `nepali_date_converter` is imported nowhere (the hand-rolled table duplicates it).

## Build/release readiness
- **P0 all five published APKs are debug-signed.** Every `build.gradle` correctly loads `key.properties` with a debug fallback, but `.github/workflows/flutter-deploy.yml` **never writes `key.properties`**. APKs at `app.brighternepal.com/downloads/` cannot go to Play and cannot be upgraded.
- **P0 all five apps ship the identical default Flutter icon** — `md5sum` of `mipmap-hdpi/ic_launcher.png` is `13e9c72ec37fac220397aa819fa1ef2d` for all five. `flutter_launcher_icons` is not a dependency. All `assets/images/` and `assets/lottie/` dirs in all six packages are **empty** while five pubspecs declare them → `Lottie.asset(...)` would throw.
- P1 **no ProGuard/R8 anywhere** — no `proguard-rules.pro`, no `minifyEnabled`, no `shrinkResources`. Unminified APKs on metered Nepali connections.
- P1 **all five apps are `2.0.0+2`**; CI never bumps. Any second Play upload is rejected.
- P1 **no deep links / app links.** Zero `<data android:scheme>` beyond the launcher, no `assetlinks.json`, no `FlutterDeepLinkingEnabled`. Consequences: notification `action_url` cannot open the app; **eSewa/Khalti cannot redirect back into the app after payment** (the WebView at `fee_payment_screen.dart:351-366` is the workaround, but external `launchUrl` at :110 strands the user in the browser).
- P1 **iOS exists only for flutter_user and is not shippable**: `project.pbxproj:375,554,576` still `PRODUCT_BUNDLE_IDENTIFIER = com.example.aschoolUser`; `Info.plist` has **no usage-description keys at all** (no camera/photo/location) → Apple rejects and the app hard-crashes on first camera use; no `UIBackgroundModes: remote-notification`; no `GoogleService-Info.plist`; CI never touches iOS.
- P1 **contradictory `web` overrides**: `flutter_teacher/pubspec.yaml:30-33` pins `web: 0.5.1`; `flutter_user/pubspec.yaml:35-37` overrides `web: ^1.0.0` + `share_plus: ^10.0.2`. flutter_user depends on teacher by path, so one comment is now false. CI builds web from flutter_user.
- P1 **five `any` constraints** in `aschool_shared` (`geolocator`, `intl`, `nepali_date_converter`, `table_calendar`) + `fl_chart: any` in teacher, and **no `pubspec.lock` committed for any app** → builds are not reproducible.
- P2 **no flavors** — dev/staging/prod distinguished only by `--dart-define=API_BASE_URL` which CI never passes, so **every APK points at production**.
- `flutter_user/web/index.html` has no Firebase JS SDK and no OneSignal SDK → web push impossible on the deployed `app.brighternepal.com`.
- P3 admin and teacher lack the Android-11 `<queries>` VIEW/https intent → `canLaunchUrl(https://…)` returns false there.
- P3 `desugar_jdk_libs` 2.1.5 in flutter_user vs 2.0.3 in the other four.
- P2 `flutter_lints` 3 vs 4 split (teacher/parent on 3).

## Duplication that belongs in aschool_shared (~4,000–4,500 LOC ≈ 9% of mobile code)
Quantified clusters: notices ×4 (359 LOC), marksheet ×2 (591), e-library ×2 (345), teachers list ×2 (201), health records ×3 (869), wellbeing ×4 (1,223), portfolio ×3 (895), LMS ×3 (1,229), timetable ×4 (598), library ×3 (861), homework ×2 (750), gamification ×2 (581), plus 76 `List.from` boilerplate sites and ~60 per-screen `_loading/_error/_load` scaffolds.

The precedent already exists and works: `shared_chat_screen.dart` (773 LOC / 4 apps), `emergency_screen.dart` (parameterized by `usePluginGate`/`allowHeadcount`/`emptyTitle`), `gallery_screen.dart`, `holiday_list_screen.dart`, `student_attendance_screen.dart`.

## State management split
360 `setState` calls (admin 125, teacher 79, student 73, parent 40, shared 26, user 17). **flutter_admin has 18 plain `StatefulWidget`s that cannot read Riverpod at all**, each hand-rolling `_loading`/`_error`/`_data` + `initState` + direct `ApiClient.instance` (10 raw calls in `settings_screen.dart` alone). flutter_parent is the reference implementation (12 `ConsumerWidget`, centralized `parent_providers.dart` with `family` providers keyed on child ID — multi-child households work correctly).

## Error/loading/empty states
Primitives are excellent and consistently used: `ErrorContainer`, `NoDataContainer`, `LoadingShimmer`/`ShimmerLoadingList`/`ShimmerLoadingGrid`, `PullToRefresh`, `PaginatedList`, with per-context empty copy.

- **P1 raw Dio exception text shown to users at 41 sites.** `ErrorContainer` renders a friendly heading then prints `errorMessage` verbatim; repositories wrap everything in `ApiException(e.toString())` → users see `DioException [connection error]: The connection errored: Failed host lookup: 'api.brighternepal.com'`. `fee_payment_screen.dart:136-147` already implements the right pattern (`_paymentErrorMessage`) — promote it to shared.
- P2 `flutter_student/.../student_library.dart:30-45` — `setState` after await with no `mounted` guard.
- P2 error state replaces the `RefreshIndicator` subtree in `subjects_screen.dart:52-57`, `notices_screen.dart:116`, `teacher_notices_screen.dart:47` → pull-to-refresh unavailable exactly when needed. `child_subjects_screen.dart:56-64` does it right.
- P3 no global error boundary: no `FlutterError.onError`, no `runZonedGuarded`, no Crashlytics/Sentry in any `main.dart`.
- P3 `debugPrint` is never stripped, so `notification_service.dart:84` `_logger.i('FCM token: $_fcmToken')` **logs the raw FCM token to logcat in release**.

## Web↔mobile parity gaps, ranked
1. **Admin app is read-only for money and roster** — fees collection, defaulters, scholarships, receipts, student create/edit, promote, bulk import all view-only or absent. A principal cannot run the school from the phone.
2. Reports & certificates — the two things a principal prints most; `reports_hub_screen.dart:62` literally dumps a raw map (`subtitle: Text(e.value.toString())`).
3. Timetable authoring — no generate/edit on any app; admin shows a flat `ListTile` list ("Day 3 Period 4").
4. Transport live map — admin has none; parent polls with no marker animation; the shared `/transport/live/{id}` 404s.
5. Homework authoring on admin — `assignments_screen.dart` is a `ModuleScreenTemplate` brochure with hardcoded "24 Open Tasks / 6 Due Today".
6. Global search — `/search` exists on the backend; no app uses it.
7. Fully absent domains: website builder, white-label, multi-branch, biometric, benchmarking, hostel, SMS/WhatsApp, adaptive learning, files/media library, FAQs.

## SocketService is 95% unused
`constants.dart:24-30` defines 7 event names (`bus_location`, `emergency_alert`, `attendance_alert`, `new_payment`, `new_notice`, plugin install/uninstall) and **nothing listens** except `parent_chat_screen.dart:158,170`. `plugin_provider.dart:86` says "Socket listeners removed for now". Real-time is off; bus tracking therefore polls.

## Tests
4 real test files in `aschool_shared` (`models_test.dart` 311, `plugin_gate_test.dart` 155, `nepali_formatter_test.dart` 71, `security_regression_test.dart` 50). All five apps have a 10-line no-op `widget_test.dart` pumping `MaterialApp(home: SizedBox())`. Zero coverage of routers, repositories, or screens. **`aschool_shared` has no `analysis_options.yaml`** — the package all five depend on is the one that isn't linted.

## Dead dependencies
12 unused: `connectivity_plus` (0 imports), `nepali_date_converter` (0), `geolocator` (0), `retrofit` + `retrofit_generator` (0 — no `@RestApi`), `riverpod_annotation`/`riverpod_generator`/`freezed`/`json_serializable`/`build_runner` (no `.g.dart`/`.freezed.dart` exists; all models hand-written).

## TODO/stub complete list (only 4 + 2 empty bodies — clean for this size)
`flutter_admin/.../dismissal_screen.dart:307` "QR scanner requires camera permission. Coming soon."; `.../wellbeing_screen.dart:237` "Survey creation coming soon"; `.../lms_screen.dart:200` `onPressed: null`; `flutter_teacher/.../lms_overview_screen.dart:145` `onTap: () {}`. Empty bodies: `students_screen.dart:120-122`, `notification_center_screen.dart:134-136`. No FIXME/HACK/XXX anywhere.

## Genuinely well-built (do not rewrite)
1. `safe_parse.dart` — 255 lines of tolerant coercion with `OrNull` variants, epoch-vs-ISO heuristics, envelope unwrapping, and non-fatal shape logging. Documented rationale (SQLAlchemy `to_dict()` type drift).
2. Token refresh with proper request queueing — single in-flight refresh, Completer queue, drain-and-retry.
3. Secure-storage discipline consistent across five separately-built apps.
4. The plugin gating system with secure-storage caching so gating survives cold offline starts + "keep cached data on error" fallback. 37 `PluginGate` usages + a test. The one place offline-first was actually delivered.
5. Shared UI primitive set applied with near-total consistency.
6. Role-parameterized shared screens (`shared_chat_screen` 773 LOC / 4 apps; `emergency_screen` with 4 behavior knobs).
7. `marks_entry_screen.dart` (962 LOC) — dual theory/practical with per-component full/pass thresholds, per-exam and per-subject practical detection, full client validation. Domain-correct Nepali grading, not generic CRUD.
8. `fee_payment_screen.dart` — correctly distinguishes eSewa's browser-POST requirement (auto-submitting form in WebView) from URL-redirect gateways, reads enabled methods from `/fees/payment-methods` instead of hardcoding, extracts the backend error string for a human message.
9. flutter_user's composition architecture — embeds student/parent/teacher as path packages, switches on role, graceful `UnsupportedRoleApp` for admin.
10. `parent_providers.dart` — `selectedChildProvider` + 8 `family` providers keyed on child ID. Should be the template for the other three apps.
11. The hand-rolled 91-year BS table with a correct epoch anchor.
12. Repository comments documenting backend reality (`hr_repository.dart:8-11`, `ai_repository.dart:6-9`) — proof prior findings were fixed, not papered over.
