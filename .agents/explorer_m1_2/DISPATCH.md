## 2026-09-13T14:48:50Z
You are Explorer 2 for Milestone 1: R1 Backend Security Hardening & Bug Fixes.
Working Directory: /home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_2
Project Root: /home/bishal-regmi/Desktop/ASchool

MANDATORY READINGS FIRST:
1. /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md
2. /home/bishal-regmi/Desktop/ASchool/PROJECT.md
3. /home/bishal-regmi/Desktop/ASchool/.agents/survey_backend_1/survey_report.md

YOUR FOCUS SCOPE:
1. Benchmarking Dead Import Cleanup (Feature 2):
   - Investigate backend/app/api/v1/benchmarking.py:87-95.
   - Identify dead imports (Class, redundant Exam), verify _rankings_rows() usage, and ensure clean import hygiene.
2. GPS Haversine Formula & Role Enums (Feature 3):
   - Investigate backend/app/tasks/gps_processing.py:174-210.
   - Verify Haversine delta-lon formula: dlon = math.radians(lon2 - lon1).
   - Check push notification target roles: ensure they map to valid PostgreSQL user_role enum values in backend/app/models/user.py (e.g. superadmin, school_admin, staff).
   - Check backend/tests/test_gps_pipeline.py.
3. FAQ Role & School Authorization (Feature 5):
   - Investigate backend/app/api/v1/faqs.py:51-100.
   - Verify role guards (@role_required("superadmin", "school_admin")) on POST, PUT, DELETE.
   - Verify @school_required decorator presence and tenant isolation (g.school_id).
   - Check backend/tests/test_tenant_isolation_hostel_faq.py.
4. Server-Side LMS Quiz Score Computation (Feature 6):
   - Investigate backend/app/api/v1/lms.py:312-357.
   - Verify server-side quiz scoring logic _score_quiz(quiz, answers) and rejection of client-supplied scores.
   - Identify edge cases (missing questions, key formats str vs int, non-string answers).

RULES:
- You are read-only. Do NOT edit code or run destructive operations.
- Detail exact file paths, line numbers, current behavior, potential vulnerabilities/gaps, and precise proposed fixes with code snippets.
- Write your complete report to /home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_2/report.md.
- Send a message to your parent when finished with a concise summary and path to your report.
