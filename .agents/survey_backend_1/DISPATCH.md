## 2026-09-13T14:34:42Z
You are the Backend & Security Survey Explorer for the ASchool project.
Working directory: /home/bishal-regmi/Desktop/ASchool/.agents/survey_backend_1
Project root: /home/bishal-regmi/Desktop/ASchool
Original Request: /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md

You MUST read /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md before starting work.

Your objective is to conduct a thorough technical survey and mapping of:
1. R1: Backend Security Hardening & Bug Fixes (Phase 0):
   - Path traversal in app/api/v1/files.py and app/utils/file_upload.py (inspect actual traversal vectors, sanitize logic).
   - Dead import causing GET /benchmarking/rankings 500 in app/api/v1/benchmarking.py.
   - Child-safety geofence distance calculation coordinate formula typo in app/tasks/gps_processing.py.
   - Secure ai_teacher webhook by binding API key to lesson school and adding (lesson_id, event_id) replay protection (app/plugins/modules/ai_teacher/routes.py).
   - Restrict FAQ write operations (POST, PUT, DELETE) to authorized school administrators in app/api/v1/faqs.py.
   - Compute LMS quiz scores server-side rather than trusting client submissions in app/api/v1/lms.py.
   - 308-row student PII XLSX files in iemis_templates/ and replacement with sanitized synthetic templates.
   - Remaining correctness fixes: conference slot race locks, payroll transitions, WhatsApp audit logging, GPS push role enums, Unsplash key protection, and elibrary manifest blueprint pointer.
2. R2: Comprehensive Demo Data Seeding & First-Run Setup:
   - Current state of backend/seed.py / seed_test_data.py.
   - Requirements for Nepali demo school (Class 1-10, sections A/B/C, synthetic Nepali profiles, teachers/staff timetables, fee structures/invoices, exams/NEB grading, bus routes/geofences, library catalog).
   - Demo logins for school_admin, teacher, student, parent, superadmin.
   - First-run setup wizard trigger logic and backend endpoints.
3. Automated Verification scripts:
   - pytest backend/tests/
   - python backend/scripts/api_route_audit.py
   - python backend/scripts/plugin_doctor.py
   - python backend/scripts/check_migration_drift.py

You must explore the codebase, check existing implementations, verify test commands and scripts, identify file paths, exact code contexts, and enumerate every backend feature, bug, dependency, and recommended fix strategy.

Output requirements:
Write your complete, structured survey report to `/home/bishal-regmi/Desktop/ASchool/.agents/survey_backend_1/survey_report.md` and write a standard `handoff.md`.
When done, notify your orchestrator via `send_message` with the report path and summary.
