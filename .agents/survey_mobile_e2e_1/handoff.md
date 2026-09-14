# Handoff Report: Mobile & Acceptance Spec Miner

> **Working Directory**: `/home/bishal-regmi/Desktop/ASchool/.agents/survey_mobile_e2e_1`  
> **Timestamp**: 2026-09-13T14:46:00Z  
> **Type**: Hard (Task Complete)

---

## 1. Observation

1. **Flutter Analysis Baseline**:
   - `flutter analyze` executed across all 6 mobile packages:
     - `aschool_shared`: Exited with code 0 (`No issues found! (ran in 7.3s)`).
     - `flutter_admin`: Exited with code 1 (`8 issues found: 1 warning, 7 infos`). Warning: `pubspec.yaml:27:9` `asset_field_not_list`.
     - `flutter_teacher`: Exited with code 1 (`13 issues found: 4 warnings, 9 infos`). Warnings: `unused_result` on `ref.refresh` in `announcement_screen.dart:76:15`, `lesson_detail_screen.dart:85:13, 114:15`, `topic_detail_screen.dart:58:13`.
     - `flutter_student`: Exited with code 1 (`12 issues found: 1 warning, 11 infos`). Warning: `pubspec.yaml:62:9` `asset_field_not_list`.
     - `flutter_parent`: Exited with code 1 (`8 issues found: 3 warnings, 5 infos`). Warnings: `unused_local_variable` in `child_profile_screen.dart:26:11`, `unused_element` in `pt_conference_screen.dart:82:15`, `unnecessary_null_comparison` in `pt_conference_screen.dart:315:40`.
     - `flutter_user`: Exited with code 1 (`2 issues found: 2 infos`). Infos: `unnecessary_const` in `mode_selection_screen.dart:103:18` and `onboarding_screen.dart:159:18`.

2. **Mobile Infrastructure**:
   - `aschool_shared/lib/services/notification_service.dart`: `NotificationService.setOnTapCallback` defined at line 250, but grep reveals **0 callers** across all 5 apps. `_onNotificationTap` at line 244 only logs. No `OneSignal.Notifications.addClickListener` exists.
   - `aschool_shared/lib/widgets/notification_center_screen.dart:134-136`: Empty block:
     ```dart
     if (notification.actionUrl != null) {
       // Navigate to action URL
     }
     ```
   - `flutter_admin/android/app/src/main/AndroidManifest.xml`: Lines 26-29 define only `android.intent.category.LAUNCHER`. No custom URI scheme (`aschool://`) or https App Links filters exist.
   - `aschool_shared/lib/widgets/eschool_dialog.dart:33-36`: Hardcoded `color: Colors.white` in `ASchoolTheme.elevatedBox(color: Colors.white, borderColor: ASchoolTheme.tertiary)`.
   - `aschool_shared/lib/services/i18n_service.dart`: Defined with `t(en, ne)`. Only 9 calls exist in `flutter_admin`, 0 in the other 4 apps. `flutter_admin/lib/features/settings/settings_screen.dart:378-382` PATCHes `default_language` on school instead of toggling UI language.

3. **Role App Gaps**:
   - `flutter_admin/lib/features/assignments/assignments_screen.dart:8-32`: Uses `ModuleScreenTemplate` with hardcoded numbers (`'24'`, `'6'`). No HTTP calls.
   - `flutter_admin/lib/features/students/promote_screen.dart:28-36`: Calls only `GET /students`. Backend has full `GET /students/promote/preview` and `POST /students/promote` (`backend/app/api/v1/students.py:591, 706`).
   - `flutter_admin/lib/features/hr_payroll/hr_payroll_screen.dart:246-251`: Renders status chip (`leave['status']`). No approve or reject button. Backend has `POST /hr/leave/<id>/approve` (`backend/app/api/v1/hr_payroll.py:716`).
   - `flutter_teacher/lib/features/assignments/assignments_screen.dart:674-690`: `_showGradeDialog` prompts only for numeric marks and text feedback; zero rubric criteria.
   - `flutter_student/lib/features/ai_tutor/ai_tutor_screen.dart:16, 54-60`: Messages stored in ephemeral in-memory list; calls single-shot `/ai-tools/homework-help`. Backend has full stateful `TutorEngine` (`backend/app/api/v1/ai_tutor.py:15-170`: `/tutor/plans`, `/tutor/sessions`, `/tutor/sessions/<id>/turn`).
   - `flutter_student/lib/features/homework/homework_screen.dart:363-370`: `_showAttachmentDialog` asks students to paste an external URL string into a TextField instead of picking a file.
   - `flutter_parent/lib/features/bus_tracker/bus_tracking_screen.dart:35-36`: Uses `Timer.periodic(const Duration(seconds: 15))` instead of `SocketService`. Driver contact is non-clickable text.
   - `flutter_user/lib/features/transport/driver_run_screen.dart`: Zero usage of `MobileScanner` or camera scanning for student pickups; driver must manually tap individual buttons.

4. **Web Acceptance Criteria & UX Benchmarks**:
   - Native dialogs: 15+ calls to `window.alert()` found across `website-builder`, `Desktop.tsx`, `StartMenu.tsx`, `TopMenuBar.tsx`. Native `confirm()` found in `frontend/app/dashboard/students/promote/page.tsx:449`.
   - Font loading CSP defect: `frontend/app/globals.css:112-115`:
     ```css
     @font-face {
       font-family: "Mukta";
       src: url("https://fonts.googleapis.com/css2?family=Mukta:wght@200;300;400;500;600;700;800&display=swap");
     }
     ```
     Points to a CSS stylesheet rather than a woff2 binary, causing browser console errors and font-src violations.
   - Notice class targeting: `frontend/app/dashboard/notices/page.tsx:309` hardcodes `target_roles: ["school_admin", "teacher", "parent", "student"]` with no class/section dropdown selector.

---

## 2. Logic Chain

1. **Automated Verification**: The acceptance criterion "- [ ] Flutter analysis (`flutter analyze`) passes without errors across all apps" currently fails across 5 out of 6 packages (exit code 1). Resolving the specific syntax warnings (empty `assets:`, unused `ref.refresh`, unreferenced elements) will restore all 5 apps to exit code 0.
2. **Push & Deep Linking**: Because `google-services.json` is missing, FCM cannot initialize in production; because `OneSignal.Notifications.addClickListener` is omitted and `setOnTapCallback` has zero callers, tapping push notifications cannot navigate to target screens; because `NotificationCenterScreen` has an empty actionUrl block, in-app notification taps are dead ends.
3. **Dark Mode Integrity**: Because `ESchoolDialog`, `NoDataContainer`, and `ErrorContainer` hardcode `color: Colors.white` in their container box decoration, any dialog or empty/error state opened while the app is in dark mode displays a glaring white box. Because `ExamMathText` defaults to `Colors.black`, equations become unreadable against dark surfaces.
4. **Localization Parity**: Because `I18nService` is only called in 9 spots in `flutter_admin` and 0 spots in teacher, student, parent, and user apps, the mobile suite is effectively English-only. Wrapping `I18nService` in a Riverpod `StateNotifierProvider` or `ChangeNotifierProvider` will enable reactive language switching.
5. **Feature Completeness**: All required backend endpoints already exist in Flask (`/assignments`, `/students/promote`, `/search`, `/hr/leave/<id>/approve`, `/tutor/sessions`, `/files/upload`, `/parent/bus-info`, Socket.IO gateway). The mobile apps simply failed to connect to these existing endpoints, leaving placeholder UIs or partial implementations.
6. **E2E & Acceptance Benchmarks**: The 6 UX benchmarks are feasible, but Benchmarks 3 (class notices), 5 (Nepali font), and 6 (native alert/confirm) are actively blocked by verified code defects in `notices/page.tsx`, `globals.css`, and various dashboard files.

---

## 3. Caveats

1. Physical hardware features (GPS geofencing accuracy in outdoor Kathmandu conditions, camera scanning on physical Android/iOS lenses) were verified via code review and static analysis; live field testing requires physical mobile device deployment.
2. Backend push delivery to Apple Push Notification service (APNs) and OneSignal push delivery require valid developer certificates / credentials not bundled in the open repo checkout.
3. No other caveats.

---

## 4. Conclusion

The mobile applications have a solid structural foundation (~58,000 lines of Dart across 120+ screens) and the backend API surface is fully implemented. The failure to meet the R4 specification and acceptance criteria stems from:
1. Minor syntax and lint debt causing `flutter analyze` exit code 1.
2. Hardcoded light tokens in shared dialog and container components.
3. Unwired notification tap and deep-linking pipelines.
4. Mobile screens using stubbed templates or generic single-shot endpoints instead of binding to already-built backend services (Promote, Assignments, TutorEngine, FileUploadService, SocketService).
5. Specific web defects blocking UX benchmarks (broken font-face CSS URL, native alerts, hardcoded notice roles).

All identified gaps are concrete, localized, and directly actionable.

---

## 5. Verification Method

To independently verify all findings:
1. **Flutter Analysis**:
   ```bash
   cd /home/bishal-regmi/Desktop/ASchool/aschool_shared && flutter analyze
   cd /home/bishal-regmi/Desktop/ASchool/flutter_admin && flutter analyze
   cd /home/bishal-regmi/Desktop/ASchool/flutter_teacher && flutter analyze
   cd /home/bishal-regmi/Desktop/ASchool/flutter_student && flutter analyze
   cd /home/bishal-regmi/Desktop/ASchool/flutter_parent && flutter analyze
   cd /home/bishal-regmi/Desktop/ASchool/flutter_user && flutter analyze
   ```
2. **Inspect Identified Defect Files**:
   - Dialog dark mode: `aschool_shared/lib/widgets/eschool_dialog.dart` (lines 33-36).
   - Notification tap empty block: `aschool_shared/lib/widgets/notification_center_screen.dart` (lines 134-136).
   - Admin fake assignments: `flutter_admin/lib/features/assignments/assignments_screen.dart` (lines 8-32).
   - Student homework URL paste: `flutter_student/lib/features/homework/homework_screen.dart` (lines 358-390).
   - Parent bus polling: `flutter_parent/lib/features/bus_tracker/bus_tracking_screen.dart` (lines 35-36).
   - Broken @font-face: `frontend/app/globals.css` (lines 112-115).
   - Native alert/confirm: `frontend/app/dashboard/students/promote/page.tsx` (line 449).
