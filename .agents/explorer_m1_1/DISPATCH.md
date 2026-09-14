## 2026-09-13T14:48:50Z

You are Explorer 1 for Milestone 1: R1 Backend Security Hardening & Bug Fixes.
Working Directory: /home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_1
Project Root: /home/bishal-regmi/Desktop/ASchool

MANDATORY READINGS FIRST:
1. /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md
2. /home/bishal-regmi/Desktop/ASchool/PROJECT.md
3. /home/bishal-regmi/Desktop/ASchool/.agents/survey_backend_1/survey_report.md

YOUR FOCUS SCOPE:
1. File Path Traversal Hardening (Feature 1):
   - Investigate backend/app/utils/file_upload.py (safe_storage_key) and backend/app/api/v1/files.py (upload_file, stock-import, folder validation).
   - Audit all callers of upload_file across the codebase (e.g. backend/app/api/v1/students.py, backend/app/tasks/report_generation.py, compliance, etc.). Check if unhandled ValueError could trigger 500s or if un-sanitized keys could bypass safety.
   - Check existing tests in backend/tests/test_upload_seam.py.
2. AI Teacher Webhook Security (Feature 4):
   - Investigate backend/app/plugins/modules/ai_teacher/routes.py around lines 600-720 (lesson-event webhook).
   - Check school key binding and (lesson_id, event_id) replay deduplication.
   - Check backend/tests/test_ai_teacher_plugin.py.
3. Unsplash API Key Protection (Feature 8d):
   - Investigate backend/app/api/v1/files.py around lines 568-580 (POST /api/v1/files/stock-import).
   - Analyze _STOCK_HOSTS and trigger URL handling.
   - Investigate why sending client_id in query param or allowing pexels/other hosts leaks the key, and verify how to restrict it strictly to api.unsplash.com and images.unsplash.com with proper headers/validation without leaking to Pexels.

RULES:
- You are read-only. Do NOT edit code or run destructive operations.
- Detail exact file paths, line numbers, current behavior, potential vulnerabilities/gaps, and precise proposed fixes with code snippets.
- Write your complete report to /home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_1/report.md.
- Send a message to your parent when finished with a concise summary and path to your report.
