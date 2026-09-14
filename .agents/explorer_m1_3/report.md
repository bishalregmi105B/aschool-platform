# Milestone 1: R1 Backend Security Hardening & Bug Fixes — Explorer 3 Report

**Explorer**: Explorer 3 (`explorer_m1_3`)  
**Working Directory**: `/home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_3`  
**Project Root**: `/home/bishal-regmi/Desktop/ASchool`  
**Target Scope**: 
1. IEMIS Template Synthetic Records (Feature 7)
2. Conference Slot Booking Locks (Feature 8a)
3. Payroll Status Transitions (Feature 8b)
4. WhatsApp Message Phone Validation & Audit Logging (Feature 8c)
5. Elibrary Manifest Blueprint Pointer (Feature 8e)
6. Baseline Verification Scripts Health

---

## Executive Summary

A comprehensive, read-only architectural investigation was conducted on the ASchool backend covering Features 7, 8a, 8b, 8c, and 8e, as well as the complete verification script baseline.

Key findings across the audited features:
- **Feature 7 (IEMIS Synthetic Records)**: Working tree is verified safe and clean with 308 synthetic rows in `Student_Namewise_Report20260423.xlsx` across 16 official MoE columns, but the original student PII remains in historical git commit `0ba00ab`.
- **Feature 8a (Conference Slot Booking Locks)**: `book_slot` properly applies `with_for_update()`, but `cancel_booking` omits row locking and unbooked status checks, leaving TOCTOU race windows.
- **Feature 8b (Payroll Status Transitions)**: `_STATUS_TRANSITIONS` graph (`draft -> approved -> paid`) is enforced in `update_payroll`, but `approve_payroll` allows regressing `paid` records back to `approved`, and `update_payroll` fails to freeze financial amounts on paid records.
- **Feature 8c (WhatsApp Phone Validation & Logging)**: Regex validation `^\+?[0-9]{7,15}$` is enforced in `send_bulk_message` but is completely absent in single `send_message`. In addition, `send_bulk_message` erroneously logs false "sent" audit entries when delivery is skipped.
- **Feature 8e (Elibrary Manifest Blueprint)**: Fully compliant and verified with `plugin_doctor` (50/50 manifests passing) and cleanly mounted without duplicate route collisions.
- **Verification Scripts**: All 4 baseline scripts pass with 0 regressions. Discovered and isolated a PostgreSQL cross-process test database deadlock scenario caused by concurrent test runners sharing `aschool_test`.

---

## 1. IEMIS Template Synthetic Records (Feature 7)

### 1.1 Workbook Inspection & Row Count Verification
- **Target Files**:
  1. `/home/bishal-regmi/Desktop/ASchool/iemis_templates/Student_Namewise_Report20260423.xlsx` (37,929 bytes)
  2. `/home/bishal-regmi/Desktop/ASchool/iemis_templates/School_Level_Report_20260423.xlsx` (5,514 bytes)
- **Direct Observation**:
  - `Student_Namewise_Report20260423.xlsx`:
    - Sheet Name: `'Student_Namewise_Report'`
    - Dimensions: 309 rows × 16 columns (Row 1: Header, Rows 2–309: Data = exactly **308 data rows**).
    - Preserved 16 Nepal MoE IEMIS columns:
      `['S.N', 'IEMIS Code', 'Current School', 'Student Id', 'Full Name', 'Gender', 'Class', 'DOB', 'Age', 'Father Name', 'Mother Name', 'Guardian Name', 'Guardian Contact Number', 'Section', 'Permanent Address', 'Temporary Address']`
    - Student Names: 240 unique synthetic Nepali full names (`Aarav Khadka`, `Deepak Khadka`, `Rita Adhikari`, `Muna Khadka`, `Kamala Magar`).
    - Guardian Names: Synthetic Nepali combinations (`Gita Khadka`, `Maya Khadka`, `Nabin Khadka`, `Bikash Khadka`, etc.).
    - Current School: Standardized to `"Sample School"`.
    - Guardian Contact Numbers: Synthetic 11-digit numbers (`98940312276`, `98693466571`, `98990950331`, `98857532771`).
    - Addresses: Synthetic combinations of Nepal wards and districts (`"Nepalgunj - 7, Banke"`, `"Dhangadhi - 9, Kailali"`, `"Tikapur - 4, Kailali"`, `"Lamahi - 3, Dang"`, `"Bhimdatta - 2, Kanchanpur"`).
  - `School_Level_Report_20260423.xlsx`:
    - Sheet Name: `'School_Level_Report'`
    - Dimensions: 2 rows × 22 columns (Row 1: Header, Row 2: Synthetic school data).
    - Values: School Name `"Sample School"`, Head Teacher `"Sample Head Teacher"`, Contact `"9800000000"`, Email `"sample@example.edu.np"`.

### 1.2 Git Commit & Privacy Audit
- **Git Working Tree Status**:
  - `git status iemis_templates/` reports: `nothing to commit, working tree clean`.
  - Current HEAD commit `e76b584`: `fix(security+ux): deep-ux wave 1+2 — all 14 audit P1/P2 fixes, plugin contract, demo seed, UI kit batch-0`.
- **Git History PII Vulnerability**:
  - Running `git log --oneline -- iemis_templates/` shows:
    - `e76b584`: Synthetic files replacement.
    - `0ba00ab`: Initial ASchool platform import.
  - In commit `0ba00ab`, the original `Student_Namewise_Report20260423.xlsx` (35,245 bytes) contains real minors' PII (real names, real guardian mobile numbers, and residential addresses).
  - **Risk**: Anyone with clone access to git history can extract the unredacted real student PII from `0ba00ab`.
- **Recommendation**:
  Prior to public deployment or open-sourcing, coordinate with the repository owner to execute a git history purge using `git-filter-repo`:
  ```bash
  git filter-repo --path iemis_templates/Student_Namewise_Report20260423.xlsx --path iemis_templates/School_Level_Report_20260423.xlsx --invert-paths
  ```
  Followed by committing the sanitized templates cleanly.

---

## 2. Conference Slot Booking Locks (Feature 8a)

### 2.1 Code Analysis
- **File**: `backend/app/api/v1/conferences.py`
- **Endpoints**:
  - `POST /api/v1/conferences/slots/<uuid:slot_id>/book` (Lines 252–317)
  - `POST /api/v1/conferences/slots/<uuid:slot_id>/cancel` (Lines 319–342)

### 2.2 Current Behavior & Gaps
1. **`book_slot` (Lines 261–272)**:
   ```python
   slot = (
       ConferenceSlot.query.filter_by(
           id=slot_id, school_id=g.school_id, is_deleted=False
       )
       .with_for_update()
       .first()
   )
   if not slot:
       return error_response("Slot not found", 404)
   if slot.is_booked:
       return error_response("Slot already booked", 409)
   ```
   - **Correctness**: The row lock `with_for_update()` serializes concurrent booking requests. Under PostgreSQL Read Committed isolation, a concurrent booking transaction blocks on the row lock; once released, it reads `slot.is_booked == True` and returns HTTP 409.

2. **`cancel_booking` (Lines 323–341)**:
   ```python
   def cancel_booking(slot_id):
       slot = ConferenceSlot.query.filter_by(
           id=slot_id, school_id=g.school_id, is_deleted=False
       ).first()
       if not slot:
           return error_response("Slot not found", 404)
       role = getattr(g.current_user, "role", None)
       is_admin = role in ("superadmin", "school_admin")
       is_booking_parent = slot.parent_id is not None and str(slot.parent_id) == str(g.current_user.id)
       is_slot_teacher = slot.teacher_id is not None and str(slot.teacher_id) == str(g.current_user.id)
       if not (is_admin or is_booking_parent or is_slot_teacher):
           return error_response("Not authorized to cancel this booking", 403)
       slot.is_booked = False
       slot.parent_id = None
       slot.student_id = None
       db.session.commit()
       return success_response(_slot_dict(slot))
   ```
   - **Vulnerabilities / Gaps**:
     1. **Missing Row Lock (`with_for_update()`)**: `cancel_booking` queries the slot with a standard `SELECT`. If Parent A issues a cancellation at the exact moment Parent B is attempting to book the slot, or if two cancel requests are in flight, the lack of exclusive row locking can interleave with `book_slot`'s transaction, leading to inconsistent state or cancelling an immediately subsequent booking.
     2. **No Unbooked Validation**: `cancel_booking` does not check `if not slot.is_booked`. If an admin or teacher calls cancel on an already unbooked slot, it executes a redundant database update.
     3. **Missing Cancellation Event**: While `book_slot` emits `conference.booked` (line 309), `cancel_booking` fails to emit `conference.cancelled`.

### 2.3 Proposed Fix
```python
# backend/app/api/v1/conferences.py:319-343
@conferences_bp.route("/slots/<uuid:slot_id>/cancel", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("conferences")
def cancel_booking(slot_id):
    # Acquire exclusive row lock so concurrent book/cancel calls serialize
    slot = (
        ConferenceSlot.query.filter_by(
            id=slot_id, school_id=g.school_id, is_deleted=False
        )
        .with_for_update()
        .first()
    )
    if not slot:
        return error_response("Slot not found", 404)
    if not slot.is_booked:
        return error_response("Slot is not currently booked", 400)

    # E193: only the booking parent, the slot's teacher, or a school admin may cancel
    role = getattr(g.current_user, "role", None)
    is_admin = role in ("superadmin", "school_admin")
    is_booking_parent = slot.parent_id is not None and str(slot.parent_id) == str(g.current_user.id)
    is_slot_teacher = slot.teacher_id is not None and str(slot.teacher_id) == str(g.current_user.id)
    if not (is_admin or is_booking_parent or is_slot_teacher):
        return error_response("Not authorized to cancel this booking", 403)

    slot.is_booked = False
    slot.parent_id = None
    slot.student_id = None
    db.session.commit()

    try:
        from app.plugins.events import emit_for_school
        emit_for_school(
            "conference.cancelled",
            school_id=str(g.school_id),
            slot_id=str(slot.id),
        )
    except Exception:
        pass

    return success_response(_slot_dict(slot))
```

---

## 3. Payroll Status Transitions (Feature 8b)

### 3.1 Code Analysis
- **File**: `backend/app/api/v1/hr_payroll.py`
- **Endpoints**:
  - `PUT /api/v1/hr/payroll/<uuid:payroll_id>` (Lines 314–378)
  - `POST /api/v1/hr/payroll/<uuid:payroll_id>/approve` (Lines 380–396)
  - `POST /api/v1/hr/payroll/<uuid:payroll_id>/pay` (Lines 538–562)
  - `POST /api/v1/hr/payroll/bulk-action` (Lines 565–626)

### 3.2 State Machine Specification
The valid lifecycle graph is strictly linear and unidirectional:
```
  [ draft ] ───(approve)───► [ approved ] ───(mark_paid)───► [ paid ]
```
- Allowed transitions:
  - `draft` → `approved`
  - `approved` → `paid`
  - `paid` → None (terminal state; no transitions permitted)
- Illegal transitions:
  - `draft` → `paid` (skipping approval)
  - `paid` → `approved` (regressing a paid transaction)
  - `paid` → `draft` (regressing to draft)
  - `approved` → `draft` (regressing an approved record)

### 3.3 Current Behavior & Vulnerabilities
1. **`approve_payroll` Regression Hole (Lines 380–396)**:
   ```python
   def approve_payroll(payroll_id):
       payroll = StaffPayroll.query.filter_by(
           id=payroll_id, school_id=g.school_id, is_deleted=False
       ).first()
       if not payroll:
           return error_response("Payroll record not found", 404)
       claims = get_jwt()
       payroll.status = "approved"
       payroll.approved_by_id = claims.get("sub")
       db.session.commit()
       return success_response(_payroll_dict(payroll))
   ```
   - **Vulnerability**: `approve_payroll` performs **zero validation** of the existing `payroll.status`!
   - If a record is already in `status="paid"`, calling `POST /payroll/<id>/approve` silently regresses the status back to `"approved"`, destroying financial audit integrity.
   - It also lacks `.with_for_update()`.

2. **`update_payroll` Financial Modification Hole on Paid Records (Lines 320–348)**:
   - In `update_payroll`, status transition from `"paid"` to anything else is blocked by `_STATUS_TRANSITIONS`.
   - **Vulnerability**: If the client sends a `PUT` request containing `basic_salary`, `allowances`, or `deductions` on a record whose status is **already `"paid"`** without passing a new status, the endpoint **mutates the financial amounts** of an already disbursed payroll record!
   - Once a payroll record is `"paid"`, its monetary components must be immutable.

3. **`mark_paid` Status Code Consistency (Line 551)**:
   - `if payroll.status != "approved": return error_response("Payroll must be approved before marking as paid")`
   - Default HTTP code in `error_response` is 400. In `update_payroll`, status transition violations return HTTP 422. Returning 422 provides API-wide consistency for state machine rejections.

### 3.4 Proposed Fix
```python
# backend/app/api/v1/hr_payroll.py

# 1. Update approve_payroll:
@hr_payroll_bp.route("/payroll/<uuid:payroll_id>/approve", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin")
def approve_payroll(payroll_id):
    payroll = (
        StaffPayroll.query.filter_by(
            id=payroll_id, school_id=g.school_id, is_deleted=False
        )
        .with_for_update()
        .first()
    )
    if not payroll:
        return error_response("Payroll record not found", 404)
    if payroll.status != "draft":
        return error_response(
            f"Only draft payroll records can be approved (current status: {payroll.status!r})",
            422,
        )
    claims = get_jwt()
    payroll.status = "approved"
    payroll.approved_by_id = claims.get("sub")
    db.session.commit()
    return success_response(_payroll_dict(payroll))

# 2. Update update_payroll to freeze financial fields on paid records:
# Insert at line 321:
    if payroll.status == "paid":
        editable_on_paid = {"notes"}
        attempted = set(data.keys()) - editable_on_paid
        if attempted:
            return error_response(
                f"Paid payroll records are financially immutable (cannot edit {sorted(attempted)})",
                422,
            )

# 3. Update mark_paid to use with_for_update and 422:
@hr_payroll_bp.route("/payroll/<uuid:payroll_id>/pay", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("hr_payroll")
@role_required("superadmin", "school_admin", "accountant")
def mark_paid(payroll_id):
    from datetime import datetime

    payroll = (
        StaffPayroll.query.filter_by(
            id=payroll_id, school_id=g.school_id, is_deleted=False
        )
        .with_for_update()
        .first()
    )
    if not payroll:
        return error_response("Payroll record not found", 404)
    if payroll.status != "approved":
        return error_response(
            f"Payroll must be approved before marking as paid (current status: {payroll.status!r})",
            422,
        )
    data = request.get_json(silent=True) or {}
    payroll.status = "paid"
    payroll.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)
    payroll.bank_ref = data.get("bank_ref")
    if data.get("payment_method"):
        payroll.payment_method = data.get("payment_method")
    db.session.commit()
    return success_response(_payroll_dict(payroll))
```

---

## 4. WhatsApp Message Phone Validation & Audit Logging (Feature 8c)

### 4.1 Code Analysis
- **Files**:
  - `backend/app/api/v1/whatsapp_bot.py:452–550`
  - `backend/app/api/webhooks/__init__.py:393–465`
- **Target Table**: `whatsapp_messages` (`WhatsAppMessage` model in `app.models.notification`)
  - Columns: `school_id`, `to_phone` (varchar 20), `from_phone` (varchar 20), `direction` (enum: 'inbound', 'outbound'), `message_type`, `content`, `wa_message_id`, `status` (enum: 'queued', 'sent', 'delivered', 'read', 'failed').

### 4.2 Current Behavior & Gaps
1. **Discrepancy Between `send_message` and `send_bulk_message`**:
   - `send_bulk_message` (lines 506–514) implements phone validation:
     ```python
     _phone_re = re.compile(r"^\+?[0-9]{7,15}$")
     ```
     Cleaning spaces and dashes: `n = str(number).strip().replace(" ", "").replace("-", "")`.
   - **Vulnerability in `send_message` (lines 452–465)**:
     - `send_message` **does not sanitize or validate** `to` against `_phone_re`!
     - Any malformed string (e.g., `"foo_bar"`, `"+977 98-000"`, or an arbitrary 50-character string) is dispatched straight to `WhatsAppCloudService.send_text(to, message)`.
     - When logging to `WhatsAppMessage`, if `to` exceeds 20 characters, it triggers a Postgres `DataError: value too long for type character varying(20)`.

2. **Audit Logging Inconsistency on Skipped Sends**:
   - In `send_message` (line 469):
     ```python
     if not result.get("skipped"):
         db.session.add(WhatsAppMessage(...))
     ```
     Skipped sends (when WhatsApp is unconfigured in development/test) are omitted from the database audit table.
   - In `send_bulk_message` (lines 533–542):
     ```python
     db.session.add(WhatsAppMessage(
         ...
         status="failed" if (isinstance(r, dict) and r.get("error")) else "sent",
     ))
     ```
     When sending is skipped, `r.get("error")` is `None`. Therefore, `send_bulk_message` **inserts false `"sent"` audit records** even though no messages were dispatched!
     Furthermore, because `"skipped"` is not in `wa_status` enum (`"queued", "sent", "delivered", "read", "failed"`), skipped sends must be handled identically to `send_message` by omitting them or flagging them accurately.

3. **Inbound Webhook Phone Robustness (`webhooks/__init__.py:398`)**:
   - Webhook inbound records `to_phone` and `from_phone` from Meta payload. Sanitizing and limiting `from_phone` to 20 characters protects against payload tampering causing DB errors.

### 4.3 Proposed Fix
```python
# backend/app/api/v1/whatsapp_bot.py

PHONE_REGEX = re.compile(r"^\+?[0-9]{7,15}$")

def _sanitize_phone(phone: str) -> str | None:
    if not phone:
        return None
    cleaned = str(phone).strip().replace(" ", "").replace("-", "")
    return cleaned if PHONE_REGEX.match(cleaned) else None

@whatsapp_bot_bp.route("/send", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("whatsapp_bot")
@role_required("superadmin", "school_admin", "teacher")
def send_message():
    """Send a WhatsApp message to a specific number."""
    from app.models.notification import WhatsAppMessage
    from app.services.communications.whatsapp_cloud import WhatsAppCloudService

    data = request.get_json(silent=True) or {}
    raw_to = data.get("to")
    message = data.get("message")

    if not raw_to or not message:
        return error_response("'to' and 'message' are required", 400)

    clean_to = _sanitize_phone(raw_to)
    if not clean_to:
        return error_response("Invalid recipient phone number. Must be 7-15 digits (optional leading +)", 422)

    result = WhatsAppCloudService.send_text(clean_to, message)

    if not result.get("skipped"):
        wa_id = None
        if isinstance(result.get("messages"), list) and result["messages"]:
            wa_id = result["messages"][0].get("id")
        db.session.add(WhatsAppMessage(
            school_id=g.school_id,
            to_phone=clean_to,
            direction="outbound",
            message_type="text",
            content=message,
            wa_message_id=wa_id,
            status="failed" if result.get("error") else "sent",
        ))
        db.session.commit()

    return success_response(result)

# In send_bulk_message:
    for number in valid_numbers:
        if template:
            r = WhatsAppCloudService.send_template(number, template)
        else:
            r = WhatsAppCloudService.send_text(number, message)
        
        # Only persist to audit table if sending was not skipped
        if not (isinstance(r, dict) and r.get("skipped")):
            wa_id = None
            if isinstance(r, dict):
                msgs = r.get("messages")
                if isinstance(msgs, list) and msgs:
                    wa_id = msgs[0].get("id")
            db.session.add(WhatsAppMessage(
                school_id=g.school_id,
                to_phone=number,
                direction="outbound",
                message_type="template" if template else "text",
                content=template or message,
                wa_message_id=wa_id,
                status="failed" if (isinstance(r, dict) and r.get("error")) else "sent",
            ))
        results.append({"to": number, "result": r})
    db.session.commit()
```

---

## 5. Elibrary Manifest Blueprint Pointer (Feature 8e)

### 5.1 Code Analysis
- **Manifest**: `backend/app/plugins/modules/elibrary/manifest.yaml`
- **Blueprint Module**: `backend/app/api/v1/elibrary.py`
- **Models Module**: `backend/app/models/digital_content.py`
- **Loader & Registration**: `backend/app/api/v1/__init__.py:31,101,110` and `backend/app/plugins/loader.py:320-350`

### 5.2 Verification Findings
1. **Manifest Blueprint Pointers**:
   In `backend/app/plugins/modules/elibrary/manifest.yaml`:
   ```yaml
   capabilities:
     api_blueprint: app.api.v1.elibrary
     models_module: app.models.digital_content
   ```
2. **Static vs Dynamic Blueprint Registration**:
   - In `backend/app/api/v1/__init__.py`:
     - Line 31 includes `"app.api.v1.elibrary"` in `STATICALLY_MOUNTED_MODULES`.
     - Lines 101, 110: `from app.api.v1.elibrary import elibrary_bp; api_v1_bp.register_blueprint(elibrary_bp)`.
   - In `backend/app/plugins/loader.py:339`:
     - Manifests declared in `STATICALLY_MOUNTED_MODULES` are intentionally skipped by `PluginLoader._register_manifest_blueprints`.
     - This guarantees that `/api/v1/elibrary` routes are registered exactly once without route conflicts or duplicate registration warnings.
3. **`plugin_doctor.py` Compatibility**:
   - `python backend/scripts/plugin_doctor.py` validates all declared code pointers (`api_blueprint`, `models_module`, etc.) against physical disk locations.
   - Result: `elibrary` resolves cleanly. Manifest verification passes with 0 errors and 0 warnings.

---

## 6. Baseline Verification Scripts Health

Each script was executed and validated directly on the host against the running Docker database and Redis infrastructure.

### 6.1 Summary Scorecard

| Script | Command | Probes / Tests | Errors / Drift | Status |
|---|---|---|---|---|
| `api_route_audit.py` | `python backend/scripts/api_route_audit.py` | 822 probes | 0 server errors (HTTP 500) | **PASS** |
| `plugin_doctor.py` | `python backend/scripts/plugin_doctor.py` | 50 manifests | 0 errors · 0 warnings | **PASS** |
| `check_migration_drift.py` | `python backend/scripts/check_migration_drift.py` | 505 items | 0 blocking schema drift | **PASS** |
| `test_gps_pipeline.py` | `pytest backend/tests/test_gps_pipeline.py` | 3 tests | 0 failures (100% pass) | **PASS** |

### 6.2 Detailed Script Logs

1. **`api_route_audit.py`**:
   ```json
   {
     "total_probes": 822,
     "get_probes": 406,
     "options_probes": 416,
     "login": "admin@demo.aschool.com.np",
     "server_errors": 0,
     "status_counts": {
       "200": 671,
       "400": 24,
       "403": 50,
       "404": 75,
       "429": 2
     }
   }
   ```
   - **Health Assessment**: Excellent. Zero 500 errors across all routes in the system.

2. **`plugin_doctor.py`**:
   ```
   All manifests pass the plugin contract.
   50 manifests · 0 errors · 0 warnings
   ```
   - **Health Assessment**: Exceeds R1 acceptance criteria (42/42) with 50/50 valid plugin manifests.

3. **`check_migration_drift.py`**:
   ```
   scratch db 'aschool_drift_check' migrated to head
   drift scan: 0 blocking / 505 total items (505 in allowlisted debt classes)
   MIGRATION DRIFT CHECK: PASS — no blocking schema drift
   ```
   - **Health Assessment**: Schema migrations match SQLAlchemy models cleanly with zero unmanaged schema drift.

4. **`pytest backend/tests/test_gps_pipeline.py`**:
   ```
   backend/tests/test_gps_pipeline.py::test_process_gps_data_persists_fix PASSED [ 33%]
   backend/tests/test_gps_pipeline.py::test_process_gps_data_accepts_device_id_and_unknown_bus PASSED [ 66%]
   backend/tests/test_gps_pipeline.py::test_poller_skips_when_unconfigured PASSED [100%]
   =================== 3 passed, 1 warning in 99.59s ====================
   ```
   - **Health Assessment**: All 3 GPS pipeline tests pass cleanly.

### 6.3 Critical Operational Finding: Cross-Process Test DB Deadlock
- **Observation**:
  During initial execution, `test_gps_pipeline.py` encountered:
  `psycopg2.errors.DeadlockDetected: Process 12499 waits for AccessExclusiveLock on relation ... blocked by process 12525. CONTEXT: TRUNCATE TABLE public.sections CASCADE`.
- **Root Cause Analysis**:
  A concurrent pytest runner (`test_ai_teacher_plugin.py`) was executing simultaneously on PID 428809 against the same default `aschool_test` database. Because `conftest.py` resets the database between tests by issuing `TRUNCATE TABLE ... CASCADE` on every public table, concurrent test runners attempt to acquire `AccessExclusiveLock` on interrelated tables in different orders, causing immediate PostgreSQL deadlock detection.
- **Architectural Solution**:
  `backend/config.py:228-231` supports `TEST_DATABASE_URL`:
  ```python
  SQLALCHEMY_DATABASE_URI = os.getenv(
      "TEST_DATABASE_URL",
      f"{_base_db_url.rsplit('/', 1)[0]}/aschool_test",
  )
  ```
  Running subagent tests with a dedicated database (e.g., `TEST_DATABASE_URL="postgresql://.../aschool_test_subagent"`) completely isolates table truncation locks and eliminates test flakiness in parallel agent environments.

---

## 7. Recommended Implementation Action Items for Milestone 1 Implementer

1. **Conference Slot Locks (`conferences.py`)**:
   - Add `.with_for_update()` to `cancel_booking()`.
   - Add `if not slot.is_booked: return error_response("Slot is not currently booked", 400)`.
   - Emit `conference.cancelled` event.
2. **Payroll State Transitions (`hr_payroll.py`)**:
   - In `approve_payroll()`, enforce `if payroll.status != "draft": return error_response(..., 422)` and add `.with_for_update()`.
   - In `update_payroll()`, prevent financial mutations if `payroll.status == "paid"`.
   - In `mark_paid()`, add `.with_for_update()` and standardize to HTTP 422.
3. **WhatsApp Phone Validation & Logging (`whatsapp_bot.py`)**:
   - Add `^\+?[0-9]{7,15}$` regex validation and space/dash stripping to `send_message()`.
   - In `send_bulk_message()`, do not record `WhatsAppMessage` entries when `r.get("skipped")` is True.
4. **Git History PII Purge (`iemis_templates/`)**:
   - Schedule repository-wide `git-filter-repo` to permanently erase minored student PII from historical commit `0ba00ab`.
