## 2026-09-13T14:47:28Z
You are the Sub-Orchestrator for Milestone 1: R1 Backend Security Hardening & Bug Fixes (Phase 0).

Working Directory: /home/bishal-regmi/Desktop/ASchool/.agents/sub_orch_m1
Project Workspace Root: /home/bishal-regmi/Desktop/ASchool
Original Request: /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md
Scope Document: /home/bishal-regmi/Desktop/ASchool/PROJECT.md
Survey Findings: /home/bishal-regmi/Desktop/ASchool/.agents/survey_backend_1/survey_report.md

You MUST read /home/bishal-regmi/Desktop/ASchool/.agents/ORIGINAL_REQUEST.md and /home/bishal-regmi/Desktop/ASchool/PROJECT.md before starting work.

Your scope is Milestone 1 (Features 1 through 8 in PROJECT.md):
1. File Path Traversal Hardening: Enforce safe_storage_key() strictly in app/api/v1/files.py and app/utils/file_upload.py, and ensure callers handle/prevent traversal cleanly.
2. Clean up residual dead import in backend/app/api/v1/benchmarking.py:89 (from app.models.academic import Class).
3. GPS distance formula: Haversine delta-lon formula in app/tasks/gps_processing.py:178 and valid user_role enums in notification query.
4. AI Teacher webhook security: bind API key to lesson school and add (lesson_id, event_id) replay protection in app/plugins/modules/ai_teacher/routes.py.
5. FAQ authorization: enforce @role_required("superadmin", "school_admin") AND @school_required on FAQ create/update/delete in app/api/v1/faqs.py.
6. LMS quiz scores: strictly computed server-side in app/api/v1/lms.py:312-346.
7. IEMIS XLSX: 308 synthetic records in iemis_templates/Student_Namewise_Report20260423.xlsx.
8. Correctness fixes:
   - Conference slot booking locks (Slot.query.with_for_update()) in app/api/v1/conferences.py.
   - Payroll status transitions (draft -> approved -> paid) in app/api/v1/hr_payroll.py.
   - WhatsApp message phone validation and audit logging in app/api/v1/whatsapp_bot.py.
   - Unsplash API key protection: restrict key attachment strictly to api.unsplash.com in app/api/v1/files.py:575 (prevent leaking key to Pexels).
   - Elibrary manifest blueprint pointer in app/plugins/modules/elibrary/manifest.yaml.

Follow the Orchestrator procedure (Assess -> 2B Iteration Loop):
You are a dispatch-only orchestrator. Delegate execution to subagents:
1. Spawn 3 Explorers (teamwork_preview_explorer) to verify existing mitigations, spot residual gaps, and formulate exact fix plans.
2. Spawn a Worker (teamwork_preview_worker) with the explorer findings to implement changes and run verification commands.
   MANDATORY INTEGRITY WARNING for Worker:
   "DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected."
3. Spawn 2 Reviewers (teamwork_preview_reviewer) independently.
4. Spawn 2 Challengers (teamwork_preview_challenger) to empirically stress-test.
5. Spawn a Forensic Auditor (teamwork_preview_auditor) to perform integrity verification. If auditor reports INTEGRITY VIOLATION, fail immediately.
6. Gate: Record verdicts in GATE_STATUS.md. All must pass (tests pass, reviewers approve, challengers approve, auditor clean).

Required verification commands:
- export DATABASE_URL=postgresql://aschool:aschool@172.21.0.3:5432/aschool REDIS_URL=redis://172.21.0.4:6379/0 PYTHONPATH=backend
- backend/.venv/bin/python backend/scripts/api_route_audit.py (822 probes, 0 5xx)
- backend/.venv/bin/python backend/scripts/plugin_doctor.py (50 manifests, 0 errors)
- backend/.venv/bin/python backend/scripts/check_migration_drift.py (0 blocking drift)
- backend/.venv/bin/pytest backend/tests/test_gps_pipeline.py

When the gate passes, write your handoff.md and notify parent orchestrator via send_message.
