# 📱 Mobile App QA & Integration Audit Report

**Date:** 2026-08-27  
**Focus:** QA and Gap Analysis of `flutter_admin`, `flutter_teacher`, `flutter_parent`, `flutter_student`, and `aschool_shared`.

---

## 1. API Endpoint Alignment Mismatches

The following Flutter API calls need to be strictly verified and matched with the actual Python backend routes to prevent 404/405 errors:

- **POST `/attendance/submit`**: Exists in mobile (`attendance_repository.dart`) but needs verification against the backend mass submission endpoint.
- **POST `/student/assignments/$assignmentId/submit`**: Mobile app calls this, but the backend may use `/assignments/<id>/submissions`. Potential 404 route mismatch.
- **POST `/assignments/submissions/$submissionId/grade`**: Needs alignment with the backend route structure.
- **POST `/hr-payroll/leaves/apply`**: The mobile app calls `/hr-payroll/leaves/apply` (in `hr_repository.dart`), verify against backend route `/hr/leaves` or `/hr_payroll`.
- **POST `/ai/${tool}/generate`**: Ensure the backend structure matches (e.g., `/ai-tools/${tool}/generate`).
- **GET `/academics/subjects?class_id=$classId`**: Used in mobile, verify query parameters against backend.

---

## 2. Data Typing & Parsing Risks in Mobile Models (`aschool_shared/lib/models/`)

- **`attendance.dart`**: `id: json['id'] as String` will throw a TypeError if `id` is an `int` or missing. Using `(json['id'] ?? '').toString()` is much safer.
- **`exam.dart`**: Handled via `.toString()` for IDs (safer). However, `marksObtained` and `totalMarks` could throw cast errors if the backend sends numeric strings instead of `num`s.
- **`assignment.dart`**: `fromJson` factory methods assume key fields like `id` are present and correctly typed. Missing default fallbacks could cause the UI to crash when expecting non-null strings.

---

## 3. Feature Completeness (vs 57-Plugin Ecosystem)

The `flutter_admin` app has 34 feature directories, showing a significant gap against the 57 master plugins in the backend ecosystem. 

**Missing Mobile Features (Screens/Plugins Not Yet Implemented in Mobile):**
- `ai_adaptive_learning`
- `benchmarking`
- `white_label`
- `biometric`
- `disaster_management`
- `multi_branch`
- `gps_tracking`
- `hostel`
- `student_portfolio`
- `social_ads`
- `conferences`
- `iemis_importer`
- `whatsapp_bot`
- `sms_notifications`
- `elibrary`
- `ai_tutor`
- `ai_insights`
- `ai_grading`
- `advanced_analytics`

---

## 4. Recommended Fixes

1. Map all missing endpoint paths in Flutter repositories to the exact Flask Blueprint mount paths.
2. Update Dart `fromJson` methods across `aschool_shared/lib/models/` to safely cast integers and nullable fields.
3. Build placeholder or minimal screens for missing Premium/Growth plugins in `flutter_admin` to match the web dashboard parity.
