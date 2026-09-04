# ASchool Flutter Widget-Level UI Audit

Date: 2026-09-04 · Scope: widget-level UI audit of `flutter_admin`, `flutter_teacher`, `flutter_student`, `flutter_parent`, `flutter_user`, `aschool_shared` (read-only; the only file written is this report).
Method: read of every shared widget, all six pubspecs, all routers/shells, and the key feature screens of each app; cross-app greps for ~30 widget primitives; verification that l10n/accessibility/deep-link infra is truly absent.
Companion doc (screen-level inventory, do not duplicate): `audits/research/ASCHOOL_MOBILE_APPS_INVENTORY.md`.

---

## 1. Shared widget inventory

### 1.1 aschool_shared/lib/widgets/ — the real design system (30 widgets, all read)

| Widget (file) | Purpose / notes |
|---|---|
| `AppTheme` (theme/app_theme.dart) | `light`/`dark` ThemeData, 12 color tokens + 6 dark tokens, radiusSm/Md/Lg (10/14/20), `elevatedBox()` helper, Poppins via google_fonts. |
| `AnimatedToggle` (animated_toggle.dart) | Sliding pill toggle (used by student homework Pending/Submitted). |
| `AppDrawer` + `DrawerSection/ItemData` | Drawer with header, sections, theme-cycle tile, logout. |
| `AttachmentViewerWidget`, `AttachmentCountChip`, `UploadButton` (attachment_viewer.dart) | Image grid + file chips opening via `launchUrl` (external browser, no in-app viewer); UploadButton = fake-progress spinner (no progress bar). |
| `BannerCarousel` | Image banner pager. |
| `CalendarWidget` (calendar_widget.dart) | `table_calendar` wrapper, AD-only, event markers, no BS locale. |
| `CustomAppBar` | Primary-colored app bar w/ circular action buttons. |
| `CustomBottomSheet` | Grab-handle + title + close modal sheet, `show()` helper — the app's main pattern for detail views. |
| `DynamicBottomNav` + `BottomNavItem`/`PluginBottomNavItem` | Pill-style bottom nav; caps tabs at 5, plugin-aware tabs. |
| `ErrorContainer` | "Something went wrong" card with Retry button — the standard error state. |
| `NoDataContainer` | Icon + title + subtitle empty state — the standard empty state. |
| `ESchoolCard`, `ESchoolSectionTitle`, `ESchoolInfoPill`, `ESchoolAnimatedEntry` (eschool_components.dart) | Card/section/pill/staggered-entry primitives. |
| `ESchoolDialog`, `ESchoolTextEditor`, `ESchoolPrimaryButton`, `ESchoolSecondaryButton` (eschool_dialog.dart) | Confirmation/prompt dialog system (used by attendance + marks submit). |
| `FeatureLockedScreen` | Plugin-locked fallback page. |
| `FilterChipRow` | Horizontal ChoiceChip filter row. |
| `ForceUpdateDialog` | Version gate. |
| `LoadingShimmer` + `.cards()` | Shimmer list header skeleton. |
| `ShimmerLoadingGrid`, `ShimmerLoadingList` | Grid/list skeletons (some screens pass `hasAvatar`/`count` args not defined on the class — see 1.4). |
| `LoginScreen` (`SharedLoginScreen`) | LoginType student/staff/parent, identifier label/keyboard switch, Form validators. |
| `ModuleScreenTemplate` | Hero card + insight grid + quick-action grid — used only by admin screens; **the fake admin Assignments screen is a static instance of this**. |
| `NepaliDateDisplay` + `adToBsString()` | BS date display with inline 2000–2090 BS lookup table; display-only (no BS picker). |
| `NotificationCenterScreen` + `_NotificationTile` | Category chips, mark-all-read, swipe-delete, unread dots; **tap deep-link is a commented no-op** (`notification_center_screen.dart:133-137`). |
| `NotificationBell` | Badge + push to /notifications. |
| `PaginatedList<T>` | Scroll-threshold infinite list — **exists but is used by zero screens** (admin students screen re-rolls its own scroll listener). |
| `PluginGate` | Watch `pluginProvider`, fallback card "Feature Not Available / contact your admin". |
| `PullToRefresh` | RefreshIndicator wrapper. |
| `ResponsiveActionGrid` | Icon tile grid used across dashboards. |
| `SearchBarWidget` | Rounded search field + optional filter button — **no debounce, no clear button, not used by screens that implement their own TextField**. |
| `SectionHeader` | Title + "See all" TextButton. |
| `SharedChatScreen` | 2-pane (≥720px) contact list + message pane, bubbles, image inline, attach via FileUploadService, Socket.IO via chatProvider; no read receipts, no grouping, no pagination. |
| `StatCard` | Icon + value + label KPI tile. |

Also shared features (screens): `StudentAttendanceScreen` (table_calendar month view + _MiniStat rows), `HolidayListScreen`, `GalleryScreen`, `EmergencyScreen` (`features/`).

### 1.2 In-app widgets/ folders

- flutter_user: `role_app_host.dart` (embeds student/parent/teacher `MaterialApp`s by role), `glow_orb.dart` (decor).
- No `widgets/` folder in admin/teacher/student/parent — every screen defines private `_Widget`s inline (e.g. `_KpiCard`, `_QuickAction` in `flutter_admin/lib/features/dashboard/principal_dashboard.dart`; `_HomeworkCard`, `_AssignmentDetailView` in `flutter_student/lib/features/homework/homework_screen.dart`). ~120 private widgets are one-screen clones of each other (status pills, count badges, dropdown selectors, cards).

### 1.3 Flutter/Material primitives used vs missing (cross-app grep result)

Present: RefreshIndicator, shimmer, `table_calendar` (shared), `fl_chart` (admin only: `principal_dashboard.dart` BarChart, `analytics_screen.dart`), `flutter_map`+OSM (parent bus only), `webview_flutter` (parent eSewa), `qr_flutter` (parent pickup QR only — generate), `image_picker` (shared FileUploadService), ChoiceChips/FilterChips, TabBar/TabBarView, ExpansionTile (student results), DropdownButton, Dismissible (notification center), `showDatePicker` (teacher assignments only), Haptics (`HapticFeedback` in teacher attendance), google_fonts, `form` validation in login screens.

Absent (verified by grep across all 6 packages):
- `DataTable`/`DataRow` — 0 uses (marks entry & admin lists are hand-rolled Rows).
- Any chart in teacher/student/parent (`fl_chart` declared in student/teacher pubspecs but **never imported** — dead deps).
- `showTimePicker`, `Stepper`, `SearchAnchor`/`Autocomplete`, `Badge` (M3), `Hero`, `Semantics`/`semanticLabel` — 0 uses.
- debounce/`Timer`-based search — 0 (admin students search fires a GET on every keystroke, `students_screen.dart:107-110`).
- video_player, audio record/play, signature pad, rich text editor, markdown renderer (`flutter_markdown` is a declared student dep but never imported), PDF viewer (PDFs open in external browser via launchUrl), QR/barcode scan (`mobile_scanner` declared in shared, never imported; admin dismissal screen says "QR scanner … Coming soon" at `dismissal_screen.dart:307`), file_picker (`pickAndUploadFile` actually calls `pickImage` — non-image files cannot be picked, `file_upload_service.dart:82-94`).
- Pull-to-progress uploads (service supports `onProgress`, no widget renders it).
- Offline banner / connectivity UI — `connectivity_plus` declared in student+shared but 0 imports anywhere.
- Infinite scroll in-app: `PaginatedList` exists but unused; ~10 screens cap at `per_page:100`.
- L10n: **no `.arb` files anywhere, no `flutter_localizations` in any pubspec, zero Nepali strings**. Nepali presence = `NepaliDateDisplay`/`NepaliFormatter` (display only) and a `_nepaliLanguage` bool in admin settings that toggles nothing.
- A11y: zero `Semantics`, no dynamic-type QA, icon-only buttons lack tooltips in many screens.
- Dark mode: theme exists, but screens hardcode `Colors.white` surfaces (41 in teacher, 19 in parent, 18 in student, 8 in admin, 9 in user) and raw `Colors.grey.shade*` text → broken contrast in dark mode.

### 1.4 Shared-kit verdict

aschool_shared is a genuine core (models/repos/services/theme/gating), but the widget layer is ~60% of what's needed: it has state wrappers (loading/empty/error/refresh) and cards, and lacks every domain widget (timetable grid, marks grid, attendance grid, payment sheet, map card, chat thread, QR, charts). Each app re-implements these privately, which is the root cause of divergence.

---

## 2. Per-app, per-feature widget gap analysis

### 2.1 flutter_admin

| Flow | Current widget composition (file) | Missing / crude | Better pattern |
|---|---|---|---|
| Dashboard | `RefreshIndicator > ListView > gradient AI-brief card + 2×2 `_KpiCard` grid + fl_chart `BarChart` (titles/labels all hidden!) + 4 `_QuickAction` + recent payments ListTiles (`principal_dashboard.dart`) | Chart has `FlTitlesData(show:false)` — unreadable; KPIs not tappable; activity rows not tappable; no dark-mode-aware gradient. | KPI chips → drill-down routes; BarChart with axis labels + tooltip + class legend; sticky header with school name/BS date; "Pending fees" card → one-tap reminder broadcast sheet. |
| Students | Plain TextField (fires GET per keystroke) + `ListView` of `ListTile`s; `onTap` is an empty comment (`students_screen.dart:116-117`); class filter param supported but no filter UI | No detail screen, no filter chips (the shared `FilterChipRow` unused here), no avatars, no pagination UI (own scroll listener duplicates `PaginatedList`). | Use shared `SearchBarWidget`+debounce provider + `FilterChipRow` (class/section/status); rich student row (avatar, roll chip, due-fee badge); push `/students/:id` detail (profile, fees, attendance summary, actions). |
| Promote | GET-only screen — grep shows **no POST anywhere** (`promote_screen.dart`) | Cannot promote at all. | Wizard (Stepper): select class → select students (multi-select w/ "select all") → target class/year → confirm; offline-tolerant POST. |
| HR/Payroll | `DefaultTabController` 3 tabs of card `ListTile`s w/ status `Chip`s (`hr_payroll_screen.dart`); leave rows have **no approve/reject actions** | Read-only; no payroll-run action; no pay-slip viewer; raw text empty states. | Leave rows with Approve/Reject inline buttons + undo snackbar; payroll tab with month picker + "Run payroll" flow + per-staff pay-slip bottom sheet w/ share; TabBar + segmented filter chips. |
| Marketplace | Filter chips + 2-col grid of `_pluginCard` + `showModalBottomSheet` detail w/ install/uninstall (`marketplace_screen.dart`) | No screenshots/description, no ratings, no "what's included", hard-coded `_iconFor` switch, install = fire-and-forget snackbar. | Store-quality sheet: icon, gallery, feature list, tier compare, install-progress + success state, config entry point after install; use shared `CustomBottomSheet` for consistency. |
| Settings | ~22 KB of sections: profile fields, branding, password, force-update version form (`settings_screen.dart`) | `_nepaliLanguage` toggle exists in data model but no language switcher effect; no theme picker here (only drawer cycle). | Grouped list w/ section headers; language picker (en/ne) wired to l10n; branding editor with live preview card; danger zone separated. |
| Timetable | Read-only "Day X Period Y" raw list (`timetable/timetable_screen.dart`) | No grid. | Shared `TimetableGrid` (day columns × period rows, subject color coding, tap → detail). |

### 2.2 flutter_teacher

| Flow | Current composition (file) | Missing / crude | Better pattern |
|---|---|---|---|
| Attendance | Class picker list ("Done" badge) → per-student rows with P/A/L `AnimatedContainer` buttons + haptics + All-Present/All-Absent + count pills + ESchoolDialog confirm + retry snackbar (`attendance_screen.dart`) — best screen in the portfolio | **Fails outright offline** (comment at line 193: "there is no offline queue"); no long-press bulk marking; no search; not persisted if app dies; summary sheet lacks absentees list. | Same UI + local outbox (queue submit, banner "1 pending — will sync"), long-press row → bulk mark, undo snackbar after submit, date/backfill picker. |
| Marks entry | Exam/Class dropdowns + subject dropdown → header row + per-student rows of `TextFormField`s (58px) with T/P columns, live total pill + NEB grade pill, central validation before save, confirm dialog (`marks_entry_screen.dart`) | Dropdowns instead of bottom-sheet pickers; validation only at save-time (no per-cell error); keyboard covers rows (no `viewInsets` handling); no offline queue; no save-state indicator per row. | Spreadsheet grid: per-cell validation (max/pass) with red border inline, auto-advance on done, sticky totals bar, autosave draft locally + outbox, bottom-sheet pickers with search (class lists get long). |
| Assignments | Header create button + Active/Past TabBar + `_AssignmentCard` w/ progress; create = `_CreateAssignmentSheet` bottom sheet w/ class/subject/desc/due (BS via adToBsString) + FileUploadService image attach (`assignments_screen.dart`) | Attachment = image only (service can't pick docs); no rubric; no per-student grading UI beyond a submissions list; grading not visible in sheet. | Create wizard (details → attach → assign → review); grading: roster with status chips → per-student sheet with attachment preview (in-app image viewer), marks + feedback, bulk "grade later" queue. |
| Lessons | Class → subject picker cards + lesson list + add sheet; topic detail shows `AttachmentViewerWidget` (`create_lesson_screen.dart`, `topic_detail_screen.dart`) | No rich text; no reorder/drag; no inline media. | Lesson editor w/ section blocks (text/image/file/video link), reordering, markdown+KaTeX render for math content. |
| Diary | List of `ESchoolCard` entries + add `ESchoolDialog` with 2 text fields (`diary_write_screen.dart`) | Dialog-based authoring (cramped), no class/section targeting UI visible, no attachments. | Full-screen composer: class chips, subject, homework checklist items, attach photo, schedule publish, offline outbox. |
| Leave | Tab "Apply" (a card + button → dialog) / "Report" list (`leave_screen.dart`) | Apply form hidden in dialog; no balance display; no attachment (sick note). | Leave wizard bottom sheet: type chips, BS date range picker, balance card, attachment, status timeline in report rows. |

### 2.3 flutter_student

| Flow | Current composition (file) | Missing / crude | Better pattern |
|---|---|---|---|
| Homework | `AnimatedToggle` Pending/Submitted + `_HomeworkCard` list + `CustomBottomSheet` detail; **submission attachment is a paste-URL dialog** (`_showAttachmentDialog`, `homework_screen.dart:358-390`) — a student cannot actually attach their notebook photo | No camera/gallery, no crop/compress, no offline submission, no due reminders, attachments open externally. | Submit sheet: camera/gallery buttons → image preview + crop → compress via FileUploadService with progress bar; note field; offline outbox; due-date local notification; teacher feedback w/ inline images. |
| Results | `_ExamResultCard` ExpansionTile per exam w/ grade-colored leading tile + marksheet route (`student_results.dart`, `student_marksheet_screen.dart`) | No charts (fl_chart unused), no subject trend, no PDF/share. | Grade trend LineChart across exams; subject bars vs class average; share/export marksheet (pdf+share_plus already present). |
| Library | TabBar E-Books/Past Papers/Resources + local-filter TextField (`elibrary_screen.dart`, `student_library.dart`) | No download/offline reading, PDFs exit to browser, no cover art grid. | Cover-art grid, download manager w/ progress, in-app PDF viewer, "continue reading". |
| AI Tutor | ChoiceChip subject row + `_MessageBubble` chat + typing indicator + quick prompts → `/ai-tools/homework-help` (`ai_tutor_screen.dart`) | No session history, no image input (photo of homework), no markdown rendering of replies, no voice, memory-less. | Markdown/KaTeX bubble renderer, photo-of-homework input, session drawer w/ history, voice mode (mic → waveform), copy/step-explain actions. |
| Gamification | Points gradient header + 3 tabs (badges grid, leaderboard, houses) from `/student/achievements` (`gamification_screen.dart`) | No streak widget, no recent history feed on home. | Streak flame widget + daily goals on dashboard; badge unlock celebration (confetti/lottie already declared); leaderboard segmented (class/school). |

### 2.4 flutter_parent

| Flow | Current composition (file) | Missing / crude | Better pattern |
|---|---|---|---|
| Fee payment | Fee list of `CheckboxListTile`s (single-select enforced by clearing `_selected`) + bottom bar w/ total + gateway Wrap of `FilledButton`s; eSewa via in-app WebView `_GatewayWebViewScreen`, others via external browser (`fee_payment_screen.dart`) | **No receipt after payment** (no PDF/share/history); no payment history screen; single-select despite checkbox UI; no due-date urgency; method "cards" are plain buttons. | Payment sheet: method cards (eSewa/Khalti/Fonepay logos), due summary, confirm; on return → success screen w/ receipt (amount, txn, BS date) + PDF share; fees tab gets "History" tab + due banner on dashboard with one-tap pay. |
| Bus tracking | `FlutterMap` (OSM) with school/home/bus markers + info cards (driver, status, ETA pill, speed, boarded) + 15 s `Timer.periodic` polling (`bus_tracking_screen.dart`) | Polling not Socket.IO (`eventBusLocation` constant unused); no route polyline; no notifications on approach; driver row not tappable; `_infoPill` hardcodes white bg. | Socket stream + polyline + animated marker; ETA card pinned top with progress ring; driver info bottom sheet (call button); "bus arriving in 5 min" push; stop-arrival history. |
| Chat | Own thread list → shared `SharedChatScreen` (contact list + bubbles + image attach + socket) (`parent_chat_screen.dart`, shared_chat_screen.dart) | No read receipts, no typing indicator here (AI tutor has one), no attachments besides image, no teacher-directory entry point into chat, no push-to-route on new message. | Thread UI: delivery/read ticks, typing, doc+camera attach, per-thread unread, "message teacher" deep-links from homework/notice rows. |
| PT conference | Conference cards w/ booking state via `parentConferencesProvider` (`pt_conference_screen.dart`) | No calendar/slot grid visible; no add-to-calendar. | Slot-picker calendar (shared CalendarWidget + time slots), booked badge, .ics add, video-call link button when remote. |
| Multi-child | `_ChildCard` list; tap selects + pushes `/child-profile` (`parent_dashboard.dart:35-45`) | Switching requires returning Home; no avatar switcher in app bar. | App-bar child avatar stack (tap → sheet switcher) — active child drives all providers via `selectedChildIdProvider`. |

### 2.5 flutter_user (entry app)

| Flow | Current composition (file) | Missing / crude | Better pattern |
|---|---|---|---|
| Splash/Onboarding | PageView 3 slides (icon+text, per-slide colors incl. off-brand `0xFF2563EB` blue) + PageIndicator + skip (`onboarding_screen.dart`) | Static icons, no illustrations, colors diverge from theme tokens. | Brand illustrations, use token accents, "choose school first" variant for returning users. |
| Mode select | Animated `_ModeCard` list (student/parent/teacher) w/ per-mode accent (`mode_selection_screen.dart`, accents in `auth_flow_controller.dart`) | Admin roles unsupported w/ dead-end screen (`role_app_host.dart` UnsupportedRoleApp). | Remember last mode, reorder by frequency, "Admin" card → hint to install admin app + link. |
| School lookup | Debounce-less search (min 2 chars, fires per keystroke) + result cards w/ logo (`school_lookup_screen.dart`) | No recents, no "nearby" (geolocator dep unused), no QR-invite-code entry. | Debounced search w/ recent schools (shared prefs), location sort, QR/slug invite paste. |
| Unified login | Form + per-flow identifier semantics, own implementation duplicating `SharedLoginScreen` (`unified_login_screen.dart`) | No OTP/phone login, no biometric, no forgot-password, no show-password memory. | Merge into one shared login: phone+OTP for parents, biometric unlock (local_auth) after first login, forgot-password link, error microcopy per failure. |

---

## 3. Navigation & IA audit

- All four role apps: go_router 13 `StatefulShellRoute.indexedStack` + `DynamicBottomNav` + `AppDrawer`; auth redirect to `/login` on null user. flutter_user has **no go_router at all** — it is a stage machine (`EntryStage` enum) hosting the role app's own `MaterialApp` afterwards (`role_app_host.dart:19-44`).
- Tab structures: admin 5 (Home/People/Attendance/Fees/More); teacher 5 (Dashboard/Attendance/Marks/AI Tools/More); student 4 (Home/Timetable/Homework/Results); parent 4 (Home/Attendance/Fees/Results).
- **IA is drawer-cramped**: admin drawer holds ~30 destinations (21 in a single "More" branch of `router.dart` — plugin screens all flat, no grouping beyond one section list); student drawer ~20 items; parent ~15. IA depth is 2 everywhere (tab → flat drawer list); there is no per-domain hub (e.g. "Academics" hub page) and no search to jump.
- Deep-link readiness: none. No route name/`extra` contract, no intent-filter VIEW host/scheme in any AndroidManifest (only default launcher filters; the `<data android:scheme="https">` blocks present are inert `<intent>` (autofill) tags). Notification taps are dead ends (`notification_center_screen.dart:133-137` no-op; `setOnTapCallback` never registered by any app).
- flutter_user's nested-MaterialApp approach breaks the entry app's `context` for the role apps' routers (two Navigators) and blocks deep links into role routes — after consolidation this should become one MaterialApp.router with per-role shell route sets.
- Proposed restructure: (1) flatten drawer into grouped hub screens per domain (Academics / People / Finance / Communication / Plugins), (2) keep 4 tabs: Home, [role core tab], [role second core], More(hub w/ search), (3) add named deep-link routes `/notifications/:id` → payload routing, `/homework/:id`, `/fees`, `/bus` for push, (4) single router in flutter_user after consolidation.

## 4. Theme / design consistency

- Shared theme: `ASchoolTheme.light/dark` — primary `#22577A` (steel blue), accent `#57CC99`, Poppins, radius 10/14/20, M3. This is the **eSchool blue**, not the web brand Forest Green `#0e3b2e` (see `ASCHOOL_WEB_UI_INVENTORY.md`).
- Divergence in practice (all read from code): per-screen hardcoded accents — admin AI-brief amber gradient `0xFFF59E0B→0xFFD97706`, mode-select/student accents `0xFF2563EB` blue (`auth_flow_controller.dart`), module template accent default `0xFF2563EB`, marketplace premium purple `0xFF8B5CF6`, gateway brand colors; ~95 `Colors.white` hardcoded card surfaces across apps (41 teacher, 19 parent, 18 student) that don't flip in dark mode; `Colors.grey.shade*` text everywhere instead of `onSurfaceVariant`; snackbar colors ad-hoc (raw `Colors.red`/`Colors.green` vs `ASchoolTheme.danger/success`); three role names for the same shape (`ESchoolCard` vs raw `Card` vs `ASchoolTheme.elevatedBox`); date formats mixed (BS via adToBsString in teacher/homework, raw ISO in others).
- Typography: Poppins everywhere but **no Devanagari strategy** — Poppins' Devanagari subset exists in google_fonts but Nepali strings would need `FontFeature`/locale-aware fallback; no `ne` locale infra at all.
- Proposed single token system for `aschool_shared/lib/theme/`:
  1. `tokens.dart` — brand: `forest #0e3b2e` (primary), `forestDark #0a2b21`, accent `#57CC99`, semantic success/warn/danger/info, surface ramp (page/surface/elevated), text ramp, border; dark mirrors.
  2. Spacing scale 4/8/12/16/24/32; radius 10/14/20/28; elevation 0/1/3 shadow presets; touch target ≥48.
  3. Typography: single `AppText` factory — Poppins for Latin + `NotoSansDevanagari` merged fallback, min body 14, dynamic-type via `MediaQuery.textScalerOf` clamp 0.85–1.4.
  4. Component defaults (already partly in ThemeData): snackbar w/ action + colored icon, dialog/sheet factory, chip/badge presets, list tile heights, form field validator microcopy helper.
  5. `ThemeMode` persisted (exists) + per-school white-label accent override (feeds white_label plugin).
  6. Remove all raw `Colors.*` from screens (lint rule) — replace with `context.tokens` extension.

---

## 5. Ideation — 25 ranked mobile UX upgrades (impact, effort S/M/L, tied to screens)

| # | Upgrade | Screen(s) | Impact | Effort |
|---|---|---|---|---|
| 1 | Camera homework submission (pick→crop→compress→progress upload) replacing URL paste | student homework_screen | Very high | M |
| 2 | Offline-first attendance with outbox + sync banner | teacher attendance | Very high | M |
| 3 | Push deep links per notification type (register tap callback + go_router paths + intent-filters) | NotificationCenter, all | Very high | M |
| 4 | Payment success + PDF receipt share + history tab | parent fee_payment | Very high | M |
| 5 | Live bus ETA card via Socket.IO `bus_location` + polyline + arrival push | parent bus | High | M |
| 6 | Biometric unlock (local_auth) after first login | flutter_user login | High | S |
| 7 | Marks entry: per-cell validation, sticky totals, local draft autosave + outbox | teacher marks | High | M |
| 8 | Nepali locale (arb + Noto Devanagari) + language toggle in settings | all | High | L |
| 9 | Due-fee dashboard banner + one-tap pay sheet | parent/student dashboard, fees | High | S |
| 10 | BS/AD dual date picker widget (shared) everywhere `showDatePicker`/date text appears | all | High | M |
| 11 | Chat upgrade: read receipts, typing, doc attach, deep-link threads | shared chat, parent chat | High | M |
| 12 | PT conference slot-booking calendar + .ics add | parent pt_conference | High | S |
| 13 | Results trend charts + marksheet PDF export | student/parent results | High | S |
| 14 | AI tutor: markdown+KaTeX bubbles, photo-of-homework input, session history | student ai_tutor | High | M |
| 15 | Timetable grid widget (week view) + home-screen widget + .ics | all timetables | Medium-high | M |
| 16 | Assignments rebuild (admin fake screen) + rubric grading UI | admin assignments, teacher grading | Medium-high | M |
| 17 | Multi-child avatar switcher in app bar | parent all screens | Medium | S |
| 18 | Search-everywhere (SearchAnchor: students, notices, homework) | admin/teacher/student | Medium | M |
| 19 | Bottom-sheet pickers (class/section/subject) replacing DropdownButton | teacher marks/lessons, admin | Medium | S |
| 20 | Leave request wizard + leave balance card | teacher leave | Medium | S |
| 21 | Gamification streaks + badge-unlock celebration on dashboard | student | Medium | S |
| 22 | Notice rich-media cards (images, attachments, actions) + category inbox prefs | all notices | Medium | S |
| 23 | Haptics + undo snackbars standard (extend attendance pattern to all destructive/bulk actions) | all | Medium | S |
| 24 | App shortcuts (long-press icon: Pay fees, Take attendance, Ask AI) + quick actions | manifests | Low-medium | S |
| 25 | Error microcopy + retry-kit (map Dio errors to human text; connectivity banner) | all | Medium | S |

(Deliberately ranked after the four "platform" fixes already identified in the inventory: FCM config, dead push, fake admin assignments screen, promote no-POST.)

## 6. Widget roadmap — shared widgets to add to aschool_shared first

| Widget | Purpose | Used by | Effort |
|---|---|---|---|
| `AschoolSearchField` (debounced provider-backed, clear btn) | replace per-screen TextFields | admin students, library, school lookup | S |
| `BsAdDatePicker` + `BsCalendarSheet` | dual-calendar picking | teacher assignments/leave, admin, fees | M |
| `TimetableGrid` | period×day colored grid, tap slot | teacher, student, parent, admin | M |
| `AttendanceGrid` (P/A/L cells, bulk long-press, undo) | extract teacher screen's best parts | teacher, admin overview | M |
| `MarksGrid` (validated cells, sticky totals, outbox hook) | marks entry refactor | teacher | M |
| `PaymentMethodSheet` + `PaymentReceiptView` | method cards, success, receipt share | parent (eSewa/Khalti), student fees | M |
| `MapCard` (flutter_map + polyline + ETA chip) | bus + transport screens | parent, student transport | M |
| `ChatThread` v2 (ticks, typing, doc attach) | upgrade SharedChatScreen | parent, teacher, student, admin | M |
| `RichTextView` (markdown + KaTeX + attachments inline) | notices, AI tutor, lessons, diary | student, teacher, all | S |
| `AppImageViewer` (in-app gallery + PDF route w/ pdf viewer) | replace launchUrl exits | homework, chat, portfolio, library | S |
| `FilePickUploadButton` (progress bar, doc+image, compress) | fix FileUploadService file gap + UI | teacher, student, chat | S |
| `OfflineBanner` + `OutboxScaffold` (queue + sync status) | offline-first base | attendance, marks, homework, diary first | M |
| `EmptyState`/`ErrorState` v2 (action button, connectivity hint, per-screen art) | unify NoData/ErrorContainer | all | S |
| `GradeBadge` + `TrendChart` (fl_chart wrappers w/ labels) | results everywhere | student, parent, teacher report cards | S |
| `RoleSwitcherSheet` (multi-child) | parent app bar | parent | S |

Sequencing note: widgets 1–4 + 11 + 13 unblock the top-5 UX upgrades; PaymentMethodSheet and OfflineBanner are prerequisites for upgrades #2/#4; all new widgets must ship with the token system in §4 so the five apps converge on one look.
