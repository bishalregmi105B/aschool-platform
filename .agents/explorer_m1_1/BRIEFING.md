# BRIEFING — 2026-09-13T15:03:00Z

## Mission
Investigate and produce a comprehensive, structured security report on File Path Traversal Hardening (Feature 1), AI Teacher Webhook Security (Feature 4), and Unsplash API Key Protection (Feature 8d) for Milestone 1.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_1
- Original parent: df2d9bfa-2996-4d4a-aafe-9480a23f43cb
- Milestone: Milestone 1 (R1 Backend Security Hardening & Bug Fixes)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Scope: File Path Traversal Hardening (Feature 1), AI Teacher Webhook Security (Feature 4), Unsplash API Key Protection (Feature 8d)
- Detail exact file paths, line numbers, current behavior, potential vulnerabilities/gaps, and precise proposed fixes with code snippets.
- Write complete report to /home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_1/report.md.
- Send message to parent when finished.

## Current Parent
- Conversation ID: df2d9bfa-2996-4d4a-aafe-9480a23f43cb
- Updated: 2026-09-13T14:48:50Z

## Investigation State
- **Explored paths**:
  - `backend/app/utils/file_upload.py` (safe_storage_key, upload_file, delete_file, generate_presigned_url)
  - `backend/app/api/v1/files.py` (create_folder, rename_folder, upload, stock_import, _STOCK_HOSTS)
  - `backend/app/api/v1/students.py` (bulk_profile_images)
  - `backend/app/api/v1/fees.py` (upload_payment_qr)
  - `backend/app/api/v1/compliance.py` (download_emis_export)
  - `backend/app/tasks/report_generation.py`
  - `backend/app/plugins/modules/ai_teacher/routes.py` (webhook_lesson_event, apply_event)
  - `backend/app/plugins/modules/ai_teacher/hooks.py` (_provision_school)
  - `backend/app/models/ai_teacher.py` (AITeacherServiceKey, AITeacherLearningEvent)
  - `backend/tests/test_upload_seam.py`
  - `backend/tests/test_ai_teacher_plugin.py`
- **Key findings**:
  - `students.py:416`: Student bulk photos use un-prefixed folder `"student-photos"` causing cross-tenant file collisions.
  - `files.py:551-576`: `_STOCK_HOSTS` includes Pexels CDNs (leaking Unsplash API key to Pexels if passed in trigger_url) and omits `api.unsplash.com` (preventing legitimate download triggers). Sending `?client_id=` exposes secrets in logs.
  - `files.py:106-126`: `create_folder` lacks role authorization, name length/traversal validation, and cross-tenant parent validation.
  - `files.py:600`: `stock_import` lacks exception handling around `upload_file`, causing 500s on virus detection or path errors.
  - `ai_teacher/routes.py:669-685`: `key_school_id` being None bypasses school binding check. Optional `event_id` bypasses replay deduplication.
- **Unexplored areas**: None within assigned scope (all items investigated and tested).

## Key Decisions Made
- Confirmed test runner mechanics and verified tests against live PostgreSQL test database.
- Generated full line-by-line remediation patches and test specifications in `report.md` and `handoff.md`.

## Artifact Index
- `/home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_1/report.md` — Full investigation report
- `/home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_1/handoff.md` — 5-component handoff report
- `/home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_1/progress.md` — Liveness and progress tracking
- `/home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_1/DISPATCH.md` — Initial dispatch log
