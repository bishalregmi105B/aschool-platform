## 2026-09-13T15:05:00Z
You are Worker 1 for Milestone 1: R1 Backend Security Hardening & Bug Fixes.
Working Directory: /home/bishal-regmi/Desktop/ASchool/.agents/worker_m1
Project Workspace Root: /home/bishal-regmi/Desktop/ASchool

MANDATORY READINGS FIRST:
1. /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md
2. /home/bishal-regmi/Desktop/ASchool/PROJECT.md
3. /home/bishal-regmi/Desktop/ASchool/.agents/sub_orch_m1/implementation_plan.md
4. Explorer reports for full technical context & drop-in snippets:
   - /home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_1/report.md
   - /home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_2/report.md
   - /home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_3/report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You have exclusive write access to modify:
- backend/app/utils/file_upload.py
- backend/app/api/v1/files.py
- backend/app/api/v1/students.py
- backend/app/api/v1/compliance.py
- backend/app/api/v1/benchmarking.py
- backend/app/tasks/gps_processing.py
- backend/app/plugins/modules/ai_teacher/routes.py
- backend/app/api/v1/faqs.py
- backend/app/api/v1/lms.py
- backend/app/api/v1/conferences.py
- backend/app/api/v1/hr_payroll.py
- backend/app/api/v1/whatsapp_bot.py
- backend/tests/test_gps_pipeline.py
- backend/tests/test_upload_seam.py
- backend/tests/test_ai_teacher_plugin.py
- backend/tests/test_tenant_isolation_hostel_faq.py
- backend/tests/test_lms_quiz_scoring.py (or unit test files in backend/tests/)

TASK SPECIFICATION (Implement Features 1 through 8):
1. File Path Traversal Hardening (Feature 1):
   - In backend/app/utils/file_upload.py: In safe_storage_key(), check and reject null bytes (\x00), strip segment whitespace, validate traversal tricks (.., /, \, :).
   - In backend/app/api/v1/files.py:
     - create_folder: add @role_required("school_admin", "teacher"), sanitize name (length 1-120, no traversal sequences), check parent_id belongs to g.school_id.
     - stock_import: wrap upload_file in try...except VirusDetectedError (return 422) and except ValueError (return 400).
   - In backend/app/api/v1/students.py:416: change folder="student-photos" to folder=f"{g.school_id}/student-photos".
   - In backend/app/api/v1/compliance.py:182: call safe_storage_key(key) before os.path.join.
2. Dead Import Cleanup (Feature 2):
   - In backend/app/api/v1/benchmarking.py:87-95: remove unused "from app.models.academic import Class" and redundant "from app.models.exam import Exam".
3. GPS Distance Formula & Role Enums (Feature 3):
   - In backend/app/tasks/gps_processing.py: ensure dlon = math.radians(lon2 - lon1); add "staff" to roles: roles=["superadmin", "school_admin", "staff"].
   - Add unit test in backend/tests/test_gps_pipeline.py for check_geofence_alerts.
4. AI Teacher Webhook Security (Feature 4):
   - In backend/app/plugins/modules/ai_teacher/routes.py:
     - Enforce key binding: verify key belongs to lesson.school_id (reject with 403 if mismatched or unbound).
     - Enforce required event_id (400 if missing).
     - Deduplicate against AITeacherLearningEvent on (lesson_id, event_id), returning {"duplicate": True} if already seen.
   - Add unit tests in backend/tests/test_ai_teacher_plugin.py for replay deduplication, cross-school key 403, and revoked key 401.
5. FAQ Authorization (Feature 5):
   - In backend/app/api/v1/faqs.py:
     - Import and add @school_required to list_faqs, create_faq, update_faq, delete_faq.
     - Ensure @role_required("superadmin", "school_admin") remains on create_faq, update_faq, delete_faq.
   - Update backend/tests/test_tenant_isolation_hostel_faq.py to verify school context and role permissions.
6. LMS Server-Side Quiz Scoring (Feature 6):
   - In backend/app/api/v1/lms.py:
     - In _score_quiz(quiz, answers), strictly evaluate questions server-side, parse marks safely, match string/int question keys and case-insensitive trimmed answers, multi-select. Discard client score.
   - Add unit test in backend/tests/ to verify _score_quiz and attempt submission.
7. IEMIS Template (Feature 7):
   - Verify iemis_templates/Student_Namewise_Report20260423.xlsx is present and intact.
8. Correctness Fixes (Feature 8):
   - 8a. Conferences: In backend/app/api/v1/conferences.py cancel_booking, query slot with .with_for_update(), check if not slot.is_booked (return 400), emit conference.cancelled event.
   - 8b. Payroll: In backend/app/api/v1/hr_payroll.py:
     - approve_payroll: query with .with_for_update(), verify payroll.status == "draft" (return 422 if not draft).
     - update_payroll: if payroll.status == "paid", reject edits to financial fields with 422.
     - mark_paid: query with .with_for_update(), verify payroll.status == "approved" (return 422 if not approved).
   - 8c. WhatsApp: In backend/app/api/v1/whatsapp_bot.py:
     - send_message: sanitize and validate phone with ^\+?[0-9]{7,15}$ (return 422 if invalid).
     - send_bulk_message: do not write false "sent" audit records when skipped.
   - 8d. Unsplash: In backend/app/api/v1/files.py:
     - Separate _STOCK_IMAGE_HOSTS from _UNSPLASH_TRIGGER_HOSTS (only api.unsplash.com, images.unsplash.com).
     - Restrict download trigger strictly to unsplash source and trigger hosts.
     - Send key in header Authorization: Client-ID {key}, never in query param, never send to Pexels.
   - 8e. Elibrary: Verify manifest and loader compatibility.
