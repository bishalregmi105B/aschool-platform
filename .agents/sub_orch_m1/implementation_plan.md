# Milestone 1: Synthesized Implementation Plan

This plan synthesizes the reports from Explorer 1 (`explorer_m1_1`), Explorer 2 (`explorer_m1_2`), and Explorer 3 (`explorer_m1_3`).

---

## 1. Feature 1: File Path Traversal Hardening & Storage Key Safety
- **File**: `backend/app/utils/file_upload.py`
  - In `safe_storage_key(*parts)`:
    - Check for embedded null bytes `\0` and reject with `ValueError`.
    - Strip leading/trailing whitespace on each part.
    - Check `part.startswith("/")` and `"\\"` in part.
    - Split on `/`, strip whitespace on each segment, reject `..`, `:`, or empty segment after stripping.
- **File**: `backend/app/api/v1/files.py`
  - In `create_folder()` (lines 106-126):
    - Add `@role_required("school_admin", "teacher")`.
    - Sanitize `name`: validate length 1-120, reject `..`, `/`, `\`, `:`.
    - If `parent_id` is provided, verify `FileFolder.query.filter_by(id=parent_id, school_id=g.school_id, is_deleted=False).first()` exists (reject cross-school parent linkage).
  - In `stock_import()` (lines 600-610):
    - Wrap `upload_file()` in `try...except VirusDetectedError: return error_response("Malicious file detected", 422)` and `except ValueError as e: return error_response(f"Invalid file key: {e}", 400)`.
- **File**: `backend/app/api/v1/students.py`
  - Line 416: Change `folder = "student-photos"` to `folder = f"{g.school_id}/student-photos"` to prevent cross-school photo collision.
- **File**: `backend/app/api/v1/compliance.py`
  - Line 182: Ensure `safe_storage_key(key)` is invoked before `os.path.join`.

---

## 2. Feature 2: Benchmarking Dead Import Cleanup
- **File**: `backend/app/api/v1/benchmarking.py`
  - Lines 87-95 in `_rankings_rows()`:
    - Remove `from app.models.academic import Class`.
    - Remove redundant `from app.models.exam import Exam`.
    - Keep `Attendance`, `ReportCard`, `Student`, `User`, `date`, `timedelta`.

---

## 3. Feature 3: GPS Haversine Formula & Push Role Enums
- **File**: `backend/app/tasks/gps_processing.py`
  - Lines 177-178: Ensure `dlon = math.radians(lon2 - lon1)` (already in place).
  - Lines 201-206: Update `roles` argument in `send_push_to_school.delay()`:
    `roles=["superadmin", "school_admin", "staff"]` (adding `"staff"` so school transport operators/drivers are alerted).
- **File**: `backend/tests/test_gps_pipeline.py`
  - Add a unit test verifying `check_geofence_alerts` calculates correct distance and fires push notification with valid roles.

---

## 4. Feature 4: AI Teacher Webhook Security
- **File**: `backend/app/plugins/modules/ai_teacher/routes.py`
  - In `lesson_event_webhook` (lines 650-715):
    - Verify school binding: If key cannot be verified to belong to `lesson.school_id` (or `key_school_id != str(lesson.school_id)`), return `error_response("Service key does not belong to this lesson's school", 403)`.
    - Enforce required `event_id`: If `not event_id`: return `error_response("event_id is required", 400)`.
    - Replay deduplication: query `AITeacherLearningEvent.query.filter_by(lesson_id=lesson.id, object_id=str(event_id)[:80]).first()`. If found, return `{"duplicate": True}`.

---

## 5. Feature 5: FAQ Role & School Authorization
- **File**: `backend/app/api/v1/faqs.py`
  - Import `school_required` from `app.utils.decorators`.
  - Add `@school_required` to `list_faqs`, `create_faq`, `update_faq`, and `delete_faq`.
  - Retain `@role_required("superadmin", "school_admin")` on `create_faq`, `update_faq`, `delete_faq`.

---

## 6. Feature 6: Server-Side LMS Quiz Scoring
- **File**: `backend/app/api/v1/lms.py`
  - In `_score_quiz(quiz, answers: dict)` (lines 312-328):
    - Compute total points and earned points strictly server-side based on `quiz.questions`.
    - Discard any client-submitted `score` field.
    - Safely parse float `marks` (defaulting to 1.0, handling non-numeric gracefully).
    - Match answers robustly: try `answers.get(str(i))` or `answers.get(i)` or by question `id`. Support case-insensitive trimmed string comparison for text answers, and list comparison for multi-select.
  - In `submit_quiz_attempt` (lines 346-355):
    - Use `score, total = _score_quiz(quiz, answers)`.

---

## 7. Feature 7: IEMIS Template Synthetic Records
- **File**: `iemis_templates/Student_Namewise_Report20260423.xlsx`
  - Verified: 308 synthetic rows across 16 columns.
  - Document git-filter-repo recommendation for purging historic commit `0ba00ab` in handoff.

---

## 8. Feature 8: Backend Correctness Fixes
- **8a. Conference Slot Booking Locks**:
  - **File**: `backend/app/api/v1/conferences.py`
    - In `cancel_booking` (lines 319-342):
      - Query slot using `.with_for_update()`.
      - Check `if not slot.is_booked: return error_response("Slot is not currently booked", 400)`.
      - Emit `conference.cancelled` event.
- **8b. Payroll Status Transitions**:
  - **File**: `backend/app/api/v1/hr_payroll.py`
    - In `approve_payroll` (lines 380-396):
      - Query payroll with `.with_for_update()`.
      - Enforce `if payroll.status != "draft": return error_response("Only draft payroll records can be approved", 422)`.
    - In `update_payroll` (lines 320-348):
      - If `payroll.status == "paid"`, financial fields (`basic_salary`, `allowances`, `deductions`, etc.) must be immutable (return 422 if modified).
    - In `mark_paid` (lines 538-562):
      - Query payroll with `.with_for_update()`.
      - If `payroll.status != "approved"`, return 422.
- **8c. WhatsApp Phone Validation & Audit Logging**:
  - **File**: `backend/app/api/v1/whatsapp_bot.py`
    - In `send_message` (lines 452-475):
      - Validate `to` phone number using `^\+?[0-9]{7,15}$` after stripping spaces and dashes. If invalid, return 422.
    - In `send_bulk_message` (lines 500-550):
      - Do not persist `WhatsAppMessage` audit rows when `r.get("skipped")` is true.
- **8d. Unsplash API Key Protection**:
  - **File**: `backend/app/api/v1/files.py`
    - Separate `_STOCK_IMAGE_HOSTS` (`images.unsplash.com`, `plus.unsplash.com`, `images.pexels.com`, `videos.pexels.com`) from `_UNSPLASH_TRIGGER_HOSTS` (`api.unsplash.com`, `images.unsplash.com`).
    - In `stock_import()` trigger URL handling:
      - Only fire trigger if `source == "unsplash"` AND `tp.hostname in _UNSPLASH_TRIGGER_HOSTS`.
      - Send API key via `headers={"Authorization": f"Client-ID {key}"}` instead of appending to URL query string `?client_id=...`.
- **8e. Elibrary Manifest**:
  - Confirmed `api_blueprint: app.api.v1.elibrary` in `backend/app/plugins/modules/elibrary/manifest.yaml` and `backend/app/api/v1/__init__.py`. Keep clean.

---

## 9. Verification Commands
The Worker MUST execute the following verification commands and ensure 0 errors / regressions:
```bash
export DATABASE_URL=postgresql://aschool:aschool@172.21.0.3:5432/aschool REDIS_URL=redis://172.21.0.4:6379/0 PYTHONPATH=backend
backend/.venv/bin/python backend/scripts/api_route_audit.py
backend/.venv/bin/python backend/scripts/plugin_doctor.py
backend/.venv/bin/python backend/scripts/check_migration_drift.py
backend/.venv/bin/pytest backend/tests/test_gps_pipeline.py
backend/.venv/bin/pytest backend/tests/test_upload_seam.py
backend/.venv/bin/pytest backend/tests/test_ai_teacher_plugin.py
backend/.venv/bin/pytest backend/tests/test_tenant_isolation_hostel_faq.py
```
