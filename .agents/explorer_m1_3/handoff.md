# Handoff Report — Explorer M1-3 (Milestone 1)

## 1. Observation
- **Feature 7 (IEMIS Synthetic Templates)**:
  - `iemis_templates/Student_Namewise_Report20260423.xlsx`: 308 rows × 16 columns. All student names (240 unique), guardian names, guardian phone numbers (11-digit prefixes), and addresses are synthetic Nepali data. School name is `"Sample School"`.
  - `iemis_templates/School_Level_Report_20260423.xlsx`: 1 header row + 1 data row with synthetic data (`Sample School`, `Sample Head Teacher`, `9800000000`).
  - Git working tree is clean. However, historical commit `0ba00ab` still preserves real student PII in the original XLSX binaries.
- **Feature 8a (Conference Slot Booking Locks)**:
  - `backend/app/api/v1/conferences.py:265`: `book_slot` applies `.with_for_update()`.
  - `backend/app/api/v1/conferences.py:324`: `cancel_booking` omits `.with_for_update()`, omits `is_booked` validation, and omits `conference.cancelled` event emission.
- **Feature 8b (Payroll Status Transitions)**:
  - `backend/app/api/v1/hr_payroll.py:323-336`: `update_payroll` checks `_STATUS_TRANSITIONS = {"draft": {"approved"}, "approved": {"paid"}, "paid": set()}`.
  - `backend/app/api/v1/hr_payroll.py:392`: `approve_payroll` unconditionally sets `payroll.status = "approved"` without checking `if payroll.status == "draft"`, allowing regressing `"paid"` records back to `"approved"`.
  - `backend/app/api/v1/hr_payroll.py:337-375`: `update_payroll` permits modifying `basic_salary`, `allowances`, and `deductions` on records already marked `"paid"` if status is not modified in payload.
  - `backend/app/api/v1/hr_payroll.py:551`: `mark_paid` checks `if payroll.status != "approved"` but returns default HTTP 400 rather than standard 422, and lacks row lock.
- **Feature 8c (WhatsApp Phone Validation & Logging)**:
  - `backend/app/api/v1/whatsapp_bot.py:506`: `send_bulk_message` checks regex `^\+?[0-9]{7,15}$`.
  - `backend/app/api/v1/whatsapp_bot.py:452-465`: `send_message` does not validate phone numbers against regex or clean whitespace/dashes.
  - `backend/app/api/v1/whatsapp_bot.py:540`: `send_bulk_message` records `"sent"` status in `WhatsAppMessage` even when sending was skipped.
- **Feature 8e (Elibrary Manifest Blueprint)**:
  - `backend/app/plugins/modules/elibrary/manifest.yaml:13`: Points to `app.api.v1.elibrary`.
  - `backend/app/api/v1/__init__.py:31,101,110`: Statically mounted in `STATICALLY_MOUNTED_MODULES` and registered on `api_v1_bp`.
  - `backend/scripts/plugin_doctor.py`: Passes with 50 manifests · 0 errors · 0 warnings.
- **Verification Scripts**:
  - `api_route_audit.py`: 822 probes, 0 server errors (HTTP 500).
  - `plugin_doctor.py`: 50 manifests, 0 errors, 0 warnings.
  - `check_migration_drift.py`: 0 blocking schema drift items.
  - `pytest backend/tests/test_gps_pipeline.py`: 3/3 passed (100%). Discovered cross-process test deadlock when runners share `aschool_test` database; isolated via `TEST_DATABASE_URL`.

## 2. Logic Chain
1. *IEMIS Templates*: The files on disk are verified synthetic across 308 rows. Importers relying on exact 16-column headers will function properly. However, until a git history rewrite is executed, clone access exposes historical PII.
2. *Conference Booking*: Under Postgres Read Committed isolation, `with_for_update()` serializes concurrent queries. Without `with_for_update()` in `cancel_booking`, concurrent cancellation and booking requests interleave, creating race conditions.
3. *Payroll State Machine*: Financial systems require unidirectional state progression (`draft -> approved -> paid`). `approve_payroll` lacking a state guard allows an unauthorized regression of finalized payrolls. `update_payroll` permitting salary updates on paid records violates accounting immutability.
4. *WhatsApp*: The absence of phone validation on `send_message` allows malformed strings to hit external APIs and database string limits (20 chars). False audit logging in `send_bulk_message` misrepresents delivery metrics.
5. *Verification Scripts*: All baseline scripts are operational. Pytest concurrency requires separate test databases via `TEST_DATABASE_URL` to avoid table truncation deadlocks during fixture teardown.

## 3. Caveats
- **Git History Rewrite**: Purging `iemis_templates/` from history alters git commit hashes (`0ba00ab`). This should be performed on a dedicated branch and coordinated with repository maintainers.
- **Postgres Test Isolation**: When running multiple test suites simultaneously, each process must specify a unique `TEST_DATABASE_URL` (e.g., `postgresql://aschool:aschool@172.21.0.3:5432/aschool_test_<worker_id>`).

## 4. Conclusion
- The investigated subsystems are well-structured and close to production hardening.
- Localized security and correctness fixes are identified and ready for implementation in Milestone 1:
  - Add `.with_for_update()`, status check, and event emission to `conferences.py:cancel_booking`.
  - Enforce `draft` status requirement in `hr_payroll.py:approve_payroll`, freeze financial amounts on `paid` status in `update_payroll`, and add `.with_for_update()`.
  - Add phone regex validation to `whatsapp_bot.py:send_message` and omit audit logging on skipped bulk sends.
- Complete report and code snippets are available in `report.md`.

## 5. Verification Method
1. Verification script commands:
   - `DATABASE_URL="postgresql://aschool:aschool@172.21.0.3:5432/aschool" REDIS_URL="redis://172.21.0.4:6379/0" backend/.venv/bin/python backend/scripts/api_route_audit.py`
   - `backend/.venv/bin/python backend/scripts/plugin_doctor.py`
   - `DATABASE_URL="postgresql://aschool:aschool@172.21.0.3:5432/aschool" backend/.venv/bin/python backend/scripts/check_migration_drift.py`
   - `TEST_DATABASE_URL="postgresql://aschool:aschool@172.21.0.3:5432/aschool_test_run" backend/.venv/bin/pytest backend/tests/test_gps_pipeline.py`
2. IEMIS synthetic inspection:
   - Run python script inspecting `iemis_templates/Student_Namewise_Report20260423.xlsx` rows and columns.
