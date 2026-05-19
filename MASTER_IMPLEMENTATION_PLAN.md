# ASchool Master Implementation Plan
**Generated**: 2026-05-18 | **Based on**: Audit Parts 1–4 + Live Codebase Verification

---

## AUDIT CORRECTIONS (Codebase vs. Audit Claims)

The following audit findings were **INCORRECT** after live codebase inspection:

| Audit Claim | Reality | Evidence |
|-------------|---------|----------|
| "FonePay: NO FILE EXISTS" | ✅ Fully implemented | `services/payments/fonepay_gateway.py` + wired in `fees.py:1173-1187` |
| "Zero @on() listener decorators" | ✅ Full listeners module | `plugins/listeners.py` with 6+ registered listeners, imported at `__init__.py:246` |
| "`default_password_hint` exposed in every API response" | ✅ Guarded behind `include_sensitive=True` (never called) | `models/user.py:88-112` — only shows if explicitly requested |
| "SMS bulk send is synchronous loop" | ✅ Uses Celery task per number | `sms_gateway.py:56-77` — `send_single_sms.delay()` per number |
| "No security headers" | ✅ Full set: HSTS, CSP, X-Frame, nosniff, referrer | `app/__init__.py:305-323` |
| "Sentry not initialized" | ✅ Initialized when `SENTRY_DSN` env set | `app/__init__.py:28-52` |
| "Frontend: ~97 pages" | 211 `page.tsx` files found | `find frontend/app -name page.tsx` |
| "Events emitted from zero API endpoints" | ✅ attendance, notices, fees, exams, gamification all emit | grep confirmed 15+ emit() calls |

---

## CONFIRMED REAL ISSUES (Verified Against Codebase)

### 🔴 P0 — Critical / Data Loss Risk

| # | Issue | File(s) | Fix Complexity |
|---|-------|---------|----------------|
| P0-1 | **No automated DB backups** — no pg_dump scripts or Celery beat schedule for backups | `docker-compose.prod.yml`, missing `scripts/backup_db.sh` | 4h |
| P0-2 | **No file virus scanning** — `file_upload.py` validates type/size but no malware scan | `app/utils/file_upload.py` | 8h |
| P0-3 | **CSP has `unsafe-inline` + `unsafe-eval`** — weakens XSS protection significantly | `app/__init__.py:315-321` | 2h |
| P0-4 | **`flutter_user` is empty** — only `main.dart` exists, no screens | `flutter_user/lib/` | 40h |

### 🟠 P1 — High Priority / Security or Core Feature

| # | Issue | File(s) | Fix Complexity |
|---|-------|---------|----------------|
| P1-1 | **No MFA/TOTP** for admin/superadmin — OTP-only login insufficient for admin panels | `app/api/v1/auth.py`, `app/models/user.py` | 16h |
| P1-2 | **No brute-force account lockout** — rate limiter is global (60/min), no per-user lockout | `app/utils/rate_limiter.py` | 4h |
| P1-3 | **No mobile JWT invalidation** — remote logout from web doesn't revoke mobile tokens | `app/api/v1/auth.py` | 8h |
| P1-4 | **No password policy enforcement** — no minimum length/complexity rules | `app/utils/password.py`, auth.py | 3h |
| P1-5 | **No cross-tenant isolation tests** — no automated test that school A can't see school B data | `tests/` | 8h |
| P1-6 | **No idempotency key on fee payment** — double-charge possible if request retried | `app/api/v1/fees.py:~1000` | 4h |
| P1-7 | **No FonePay endpoint in webhooks** — gateway class exists + fees.py wired, but callback route missing | `app/api/webhooks/__init__.py` | 4h |
| P1-8 | **IRD-compliant receipts missing PAN/VAT fields** | `app/models/fee.py`, report_generation.py | 4h |
| P1-9 | **No Khalti refund API** | `app/services/payments/khalti_gateway.py` | 4h |
| P1-10 | **Local uploads not tenant-isolated** — flat `/uploads/` dir allows path traversal guessing | `app/utils/file_upload.py` | 3h |

### 🟡 P2 — Sprint / Missing Plugin Features

| # | Issue | File(s) | Fix Complexity |
|---|-------|---------|----------------|
| P2-1 | **Multi-Branch plugin zero implementation** — manifest exists, no API, no DB | `app/api/v1/` (missing), `app/models/` | 80h |
| P2-2 | **Biometric plugin zero implementation** — manifest exists, hardware/ empty | `hardware/`, `app/api/v1/` (missing) | 60h |
| P2-3 | **Disaster Management incomplete** — shares emergency models only, no dedicated features | `app/api/v1/emergency.py`, missing endpoints | 30h |
| P2-4 | **AI Adaptive Learning is LLM stub** — no learning path model, no mastery tracking | `app/services/ai/adaptive_learning.py` | 50h |
| P2-5 | **White-Label incomplete** — domain works, no branded mobile builds, no custom login | `app/plugins/manifests/white_label.yaml` | 40h |
| P2-6 | **No GPS WebSocket streaming** — GPS logs stored but no real-time channel | `app/api/v1/transport.py`, SocketIO | 16h |
| P2-7 | **No driver mobile app** — GPS data has no input source | `flutter_teacher/` or new `flutter_driver/` | 40h |
| P2-8 | **Emergency alerts missing from all mobile apps** | flutter_teacher, flutter_parent, flutter_student | 16h |
| P2-9 | **Teacher has no LMS content management screen** | `flutter_teacher/lib/` | 8h |
| P2-10 | **Library missing fine calculation + QR scanning** | `app/api/v1/library.py`, flutter_student | 8h |
| P2-11 | **Admission → Student auto-creation not wired** | `app/api/v1/admission.py`, listeners.py | 4h |
| P2-12 | **Attendance → WhatsApp not wired** | `plugins/listeners.py` | 2h |
| P2-13 | **No notification mark-all-read API** | `app/api/v1/notifications.py` | 2h |
| P2-14 | **Portfolio → Exams auto-populate not wired** | `plugins/listeners.py` | 2h |
| P2-15 | **AI Auto-Grading has no UI or routing** | `app/api/v1/ai_tools.py`, frontend | 8h |

### 🔵 P3 — Next Quarter / Quality & Standards

| # | Issue | File(s) | Fix Complexity |
|---|-------|---------|----------------|
| P3-1 | **Test coverage ~5%** — 15 test files for 650+ endpoints | `tests/` | 200h |
| P3-2 | **No E2E/integration tests** | `tests/integration/` (missing) | 40h |
| P3-3 | **No Swagger/OpenAPI docs** | `app/__init__.py`, flask-smorest/flasgger | 24h |
| P3-4 | **No offline mode in mobile apps** | `flutter_shared/lib/services/offline_sync.dart` (stub) | 60h |
| P3-5 | **SQL ILIKE for search** — no Elasticsearch/Meilisearch | `app/api/v1/search.py` | 40h |
| P3-6 | **No WCAG 2.1 AA compliance** | frontend/ across all pages | 60h |
| P3-7 | **Full Nepali translation** — `full_name_nepali` field exists but UI inconsistent | frontend/, flutter apps | 40h |
| P3-8 | **No webhook delivery system** — `webhooks.py` exists for inbound only | `app/api/v1/webhooks.py` | 20h |
| P3-9 | **No CDN cache headers** on R2 responses | `app/utils/file_upload.py`, nginx | 4h |
| P3-10 | **No storage quota per school** | `app/models/school.py`, file_upload.py | 8h |

---

## IMPLEMENTATION PHASES

---

### PHASE 1: Security Hardening (Week 1–2)
**Estimated**: 42h | **Risk**: 🔴 Must-do before any public launch

#### 1.1 Automated Database Backups
**Target files**: `scripts/backup_db.sh` (new), `docker-compose.prod.yml`, `backend/app/celery_app.py`

```bash
# Create scripts/backup_db.sh
# pg_dump → compress → upload to R2 bucket
# Add to Celery beat: daily at 02:30 Asia/Kathmandu
# Retain 30 days, alert on failure via SMS
```

**Steps**:
1. Create `scripts/backup_db.sh` — pg_dump + boto3 upload to `{R2_BACKUP_BUCKET}/backups/{date}/`
2. Add Celery beat schedule `db_backup_daily` in `celery_app.py`
3. Create `app/tasks/db_backup.py` task that shells out to pg_dump
4. Add `R2_BACKUP_BUCKET` to `config.py` and `.env.example`
5. Test restore procedure, document in `docs/backup_restore.md`

#### 1.2 File Upload Virus Scanning
**Target files**: `app/utils/file_upload.py`, `docker-compose.yml`, `requirements.txt`

```python
# Add ClamAV scan step before saving file
# docker-compose: add clamav service
# fall back to signature-based check if ClamAV unavailable
```

**Steps**:
1. Add `clamd` (Python) to `requirements.txt`
2. Add `clamav` service to `docker-compose.yml` with shared socket volume
3. In `file_upload.py`: add `scan_file_with_clamav(file_bytes)` function
4. Call scan before file is saved; return 422 if infected
5. Add `VIRUS_SCAN_ENABLED=true` config flag (graceful fallback)

#### 1.3 Fix CSP Headers
**Target file**: `app/__init__.py:315-321`

Replace `unsafe-inline` + `unsafe-eval` with nonce-based CSP for scripts. This requires Next.js middleware cooperation:
1. Generate per-request nonce in Flask (for API-served HTML contexts)
2. Remove `unsafe-eval` — audit code that depends on `eval()`
3. For script-src: use `'nonce-{random}'` pattern

**Note**: `unsafe-inline` in style-src is acceptable for CSS-in-JS frameworks. Focus on script-src first.

#### 1.4 Per-Account Brute Force Lockout
**Target files**: `app/utils/rate_limiter.py`, `app/api/v1/auth.py`, `app/models/user.py`

```python
# Track failed login attempts per user in Redis
# Lock account for 15 minutes after 5 consecutive failures
# Reset counter on successful login
# Add `failed_login_attempts` + `locked_until` to User model
```

#### 1.5 Mobile JWT Token Revocation
**Target files**: `app/api/v1/auth.py`, `app/models/user.py`, Redis

```python
# Redis blocklist: SET jwt:{jti} 1 EX {remaining_seconds}
# Add check in jwt_blocklist_loader callback
# Expose POST /auth/logout-all endpoint
```

---

### PHASE 2: Core Feature Gaps (Week 3–4)
**Estimated**: 55h

#### 2.1 FonePay Webhook Callback Route
**Target file**: `app/api/webhooks/__init__.py`

The `FonePayGateway` class is fully implemented and wired in `fees.py`. The only missing piece is the callback route handler.

```python
@webhooks_bp.route("/fonepay/callback", methods=["GET"])
def fonepay_callback():
    # Extract PRN from query params
    # Look up FeeCollection by PRN  
    # Call FonePayGateway.verify_payment()
    # Update FeeCollection status
    # emit("fee.paid", ...)
```

**Steps**:
1. Add `/fonepay/callback` GET handler in `webhooks/__init__.py`
2. Extract `PRN`, `BID`, `DV`, `PS`, `RC` from `request.args`
3. Retrieve school's `merchant_code` + `secret_key` from school fee config
4. Call `FonePayGateway.verify_payment(prn, data, merchant_code, secret_key)`
5. Update `FeeCollection` record, emit `fee.paid` event
6. Redirect to frontend success/failure URL

#### 2.2 Idempotency Key on Fee Payment
**Target file**: `app/api/v1/fees.py:~970-1010`

```python
# Add idempotency_key field to FeeCollection model (nullable unique)
# If same key arrives, return existing record (HTTP 200 with existing data)
```

#### 2.3 MFA / TOTP for Admin
**Target files**: `app/api/v1/auth.py`, `app/models/user.py`, `requirements.txt`

```python
# Add pyotp to requirements.txt
# User model: totp_secret (encrypted), totp_enabled boolean
# POST /auth/totp/setup → generate secret, return QR URL
# POST /auth/totp/verify → verify 6-digit code, mark enabled
# Modify login flow: if totp_enabled and role in [school_admin, superadmin] → require TOTP after password/OTP
```

**Steps**:
1. Add `pyotp` + `qrcode[pil]` to `requirements.txt`
2. Add `totp_secret` (encrypted text) + `totp_enabled` bool to `User` model → migration
3. Add `/auth/totp/setup`, `/auth/totp/verify`, `/auth/totp/disable` endpoints
4. Modify `/auth/login` response: add `requires_totp: true` field + `totp_token` (short-lived) when admin logs in
5. Add `/auth/totp/authenticate` endpoint that trades `totp_token` + code for real JWT
6. Frontend: add TOTP setup screen in `/dashboard/settings/security`

#### 2.4 IRD-Compliant Fee Receipts
**Target files**: `app/models/fee.py`, `app/models/school.py`, `app/tasks/report_generation.py`

```python
# School model: add pan_number, irb_number fields
# FeeReceipt: add receipt_no (sequential per school per year), pan_number (from school)
# PDF template: add "PAN: XXX-XXX-XXX" header line
```

#### 2.5 Khalti Refund API
**Target file**: `app/services/payments/khalti_gateway.py`

```python
# POST /api/v1/fees/refund with provider=khalti
# Khalti v2 refund: POST https://khalti.com/api/v2/payment/refund/
```

#### 2.6 Password Policy Enforcement
**Target files**: `app/utils/password.py`, `app/api/v1/auth.py`, `app/api/v1/users.py`

```python
# Minimum 8 chars, 1 uppercase, 1 digit, 1 special char
# Raise ValidationError on password change/reset endpoints
# Add PASSWORD_MIN_LENGTH, PASSWORD_REQUIRE_COMPLEXITY to config
```

---

### PHASE 3: Event Integration Wiring (Week 5–6)
**Estimated**: 30h

The event bus infrastructure is **fully built** (`events.py` + `listeners.py` properly imported). These are emission-side gaps — events that should be emitted from API endpoints but aren't:

#### 3.1 Wire Missing Event Emissions

| Event | Source API | Listener in listeners.py | File |
|-------|-----------|--------------------------|------|
| `admission.accepted` | `admission.py` - approve action | Auto-create student account | `listeners.py` (add) |
| `assignment.submitted` | `assignments.py` - submit | Notify teacher + award XP | `listeners.py` (add) |
| `attendance.absent` | `attendance.py` - mark absent | WhatsApp + SMS to parent | `listeners.py` (add) |
| `transport.arrived` | `transport.py` or GPS | Dismiss alert + parent notify | `listeners.py` (add) |
| `wellbeing.risk_flagged` | `wellbeing.py` - mood analysis | Counselor alert | `listeners.py` (add) |
| `exam.result_pass` | `exams.py` - publish results | Portfolio item + certificate | `listeners.py` (add) |
| `lms.lesson_completed` | `lms.py` - progress update | Gamification XP | `listeners.py` (add) |
| `incident.created` | `incidents.py` | Parent + admin notification | `listeners.py` (add) |
| `emergency.alert_broadcast` | `emergency.py` | SMS/push to all school users | `listeners.py` (add) |

**Implementation pattern** (same as existing):
```python
# In API endpoint (e.g. admission.py):
from app.plugins.events import emit
emit("admission.accepted", school_id=str(g.school_id), application_id=str(app.id))

# In listeners.py:
@on("admission.accepted")
def on_admission_accepted(school_id: str, application_id: str, **kwargs):
    # 1. Create student User + Student records
    # 2. Assign default fee structure
    # 3. Send welcome SMS/push
```

#### 3.2 Admission → Student Auto-Creation
**Target files**: `app/api/v1/admission.py`, `plugins/listeners.py`

```python
@on("admission.accepted")
def on_admission_accepted(school_id, application_id, **kwargs):
    """Auto-create student user and student profile from admission application."""
    from app.models.admission import AdmissionApplication
    from app.models.user import User
    from app.models.student import Student
    
    app = AdmissionApplication.query.get(application_id)
    if not app:
        return
    
    # Create User with role=student
    user = User(school_id=school_id, role="student", ...)
    # Create Student profile from application data
    student = Student(user_id=user.id, school_id=school_id, ...)
    db.session.add_all([user, student])
    db.session.commit()
```

---

### PHASE 4: Missing Mobile Screens (Week 7–10)
**Estimated**: 120h

#### 4.1 flutter_user App (Currently Empty)
**Target**: `flutter_user/lib/` — only `main.dart` exists

The `flutter_user` app appears to be a **public-facing portal** (parent/guardian self-service before enrollment). It needs:
- School discovery / subdomain entry screen
- Public school website viewer
- Admission application form
- Application status tracking
- Contact / inquiry form

**Steps**:
1. Copy auth scaffold from `flutter_shared/lib/widgets/login_screen.dart`
2. Implement school search screen (calls `/api/v1/schools/search`)
3. Implement admission form screen (calls `/api/v1/admission/public/apply`)
4. Implement application status screen

#### 4.2 Emergency Screens (All Apps)
Missing from: flutter_teacher, flutter_parent, flutter_student, flutter_admin

```dart
// emergency_alert_screen.dart — shared widget in flutter_shared
// Shows active emergency alerts with broadcast message
// Admin: can CREATE/broadcast emergency
// Teacher: headcount submission screen
// Parent/Student: view alert + safe status check-in
```

#### 4.3 Student Attendance View (flutter_student)
**Target**: `flutter_student/lib/` — audit confirms no attendance screen

```dart
// student_attendance_screen.dart (already in flutter_shared/lib/features/)
// Just needs to be wired into student app navigation
```

#### 4.4 Teacher LMS Screen
**Target**: `flutter_teacher/lib/`

```dart
// teacher_lms_screen.dart
// List courses, create lesson, upload study material
// Calls: GET/POST /api/v1/lms/courses, /lessons, /materials
```

#### 4.5 Parent/Student Health Records
**Target**: flutter_parent, flutter_student

```dart
// child_health_screen.dart
// View health profile, visit history, immunizations
```

#### 4.6 Admin Dismissal Screen
**Target**: `flutter_admin/lib/`

```dart
// admin_dismissal_screen.dart
// Lists students checked out today
// Scans parent QR codes (using camera)
```

---

### PHASE 5: Stub Plugin Implementation (Month 3)
**Estimated**: 200h

#### 5.1 Multi-Branch Chain Management
**Files to create**:
- `app/models/chain.py` — `SchoolChain`, `ChainMembership`, `ChainTransfer` models
- `app/api/v1/chain_admin.py` — chain management endpoints
- `app/utils/permissions.py` — add `chain_admin` role
- `frontend/app/dashboard/chain/` — chain admin pages
- `flutter_admin/lib/screens/chain_screen.dart`

**Key features**:
- Aggregate reports across all branches
- Staff/student transfer between branches
- Chain-level settings override per-school defaults
- Chain admin sees all branches but cannot access individual school data

#### 5.2 Biometric Integration
**Files to create**:
- `app/models/biometric.py` — `BiometricDevice`, `BiometricLog`, `FingerprintTemplate`
- `app/api/v1/biometric.py` — device registration, log ingestion, attendance sync
- `hardware/` — SDK integration docs + sample TCP listener

**Key features**:
- ZKTeco / Suprema device support via TCP/UDP push
- Real-time log ingestion → attendance auto-mark
- Face/fingerprint template storage (encrypted)
- Fallback to manual attendance if device offline

#### 5.3 Disaster Management (Extends Emergency)
**Files to add to**: `app/api/v1/emergency.py`, `app/models/emergency.py`
- Drill scheduling + reminder notifications
- Post-incident report templates
- Weather API integration (OpenMeteo for Nepal)
- Evacuation map upload per campus
- Mobile app emergency screens (see Phase 4)

---

### PHASE 6: Testing & Quality (Ongoing, Month 2–4)
**Estimated**: 200h

#### 6.1 Backend Test Coverage Target: 60%

Priority test files to create:

```
tests/
  test_auth_security.py        # Brute force, JWT revocation, TOTP
  test_multi_tenancy.py        # Cross-school data isolation
  test_payments_esewa.py       # eSewa signature verification
  test_payments_khalti.py      # Khalti payment flow
  test_payments_fonepay.py     # FonePay initiation + callback
  test_attendance_events.py    # Event emission on mark
  test_fee_events.py           # Event on payment recorded
  test_admission_flow.py       # Admission → student creation
  test_file_upload_security.py # MIME check, size limit, virus scan mock
  test_api_pagination.py       # All list endpoints return paginated data
  test_rbac_permissions.py     # Role access matrix
  test_cross_plugin_events.py  # Event listeners fire correctly
```

#### 6.2 Cross-Tenant Isolation Tests
```python
# tests/test_multi_tenancy.py
def test_school_a_cannot_access_school_b_students():
    """School A's JWT should not return School B's students."""
    token_a = login_as_school_admin(school_a)
    response = client.get("/api/v1/students", headers={"Authorization": f"Bearer {token_a}"})
    student_ids = [s["id"] for s in response.json["students"]]
    assert school_b_student_id not in student_ids
```

#### 6.3 eSchool SaaS Reference Code
The `eSchool SaaS v1.8.0 Nulled/` directory contains PHP reference implementation. Use this for feature parity analysis only — do **NOT** copy code.

Key screens to cross-reference:
- `eSchool SaaS v1.8.0 Nulled/App code/` — Flutter app screens for parent/student
- Feature checklist matching

---

### PHASE 7: Nepal Compliance Completions (Month 3)
**Estimated**: 60h

| # | Item | Target File | Steps |
|---|------|-------------|-------|
| 1 | FonePay webhook (see Phase 2.1) | `webhooks/__init__.py` | Done in P2 |
| 2 | IRD receipts PAN fields | `models/fee.py`, `models/school.py` | Done in P2 |
| 3 | Ward/municipality structured fields | `models/student.py`, `models/user.py` | Add `ward_no`, `municipality`, `district`, `province` fields |
| 4 | EMIS: disability status field | `models/student.py` | Add `disability_type` enum field + migration |
| 5 | EMIS: mother tongue field | `models/student.py` | Add `mother_tongue` text field + migration |
| 6 | EMIS: caste/ethnicity field | `models/student.py` | Verify existing field in schema |
| 7 | DEO report templates | `app/tasks/report_generation.py` | Add DEO-format export function |
| 8 | MoE Flash Report auto-population | `app/services/compliance/moe_reports.py` | Wire attendance + exam + fee data |
| 9 | BS date in frontend UI | `frontend/lib/nepali_date.ts` + components | Standardize BS display across all date fields |

---

### PHASE 8: Performance & Infrastructure (Month 4)
**Estimated**: 80h

#### 8.1 Search Engine Upgrade
Replace SQL `ILIKE` in `app/api/v1/search.py` with Meilisearch:
- Add `meilisearch` Docker service to `docker-compose.yml`
- Add index sync tasks for students, staff, notices
- Sub-50ms search response target

#### 8.2 Database Backup Automation (Phase 1 revisited)
- Nightly backup at 02:30 to R2
- Weekly backup to separate R2 region (geo-redundancy)
- Backup restoration tested in CI

#### 8.3 CDN Cache Headers for R2 Media
- Add `Cache-Control: public, max-age=31536000, immutable` for static assets
- Add `Cache-Control: private, max-age=86400` for user-uploaded content
- Implement signed URL generation for sensitive documents (report cards, payslips)

#### 8.4 Storage Quotas
- Add `storage_quota_mb` to School model (default: 2048)
- Track usage in `SchoolStorageUsage` table (updated on upload/delete)
- Return 413 when quota exceeded

#### 8.5 Readiness Probe
- Add `/ready` endpoint checking DB + Redis connectivity
- Docker Compose `healthcheck` updated to use `/ready`

---

## SUMMARY SCORECARD (Corrected)

| Component | Audit Score | Corrected Score | After All Phases |
|-----------|------------|-----------------|-----------------|
| Backend (Flask) | 65/100 | **75/100** | 88/100 |
| Frontend (Next.js) | 55/100 | **65/100** | 82/100 |
| Mobile (Flutter) | 50/100 | **55/100** | 80/100 |
| Infrastructure | 40/100 | **48/100** | 78/100 |
| Security | 35/100 | **55/100** | 82/100 |
| Testing | 15/100 | **15/100** | 65/100 |
| **Overall** | **52/100** | **62/100** | **82/100** |

**Corrected total engineering hours (realistic)**:

| Phase | Hours |
|-------|-------|
| Phase 1: Security Hardening | 42h |
| Phase 2: Core Feature Gaps | 55h |
| Phase 3: Event Integration Wiring | 30h |
| Phase 4: Missing Mobile Screens | 120h |
| Phase 5: Stub Plugin Implementation | 200h |
| Phase 6: Testing & Quality | 200h |
| Phase 7: Nepal Compliance | 60h |
| Phase 8: Performance & Infrastructure | 80h |
| **TOTAL** | **~787 hours** |

> Note: This is roughly half the audit's 1,480h estimate because many issues the audit flagged (FonePay, SMS Celery, event bus, security headers, Sentry) are **already implemented**.

---

## QUICK WINS (Can be done today, <4h each)

1. **P1-9**: Add Khalti refund endpoint — `khalti_gateway.py` already has the pattern from eSewa
2. **P1-7**: Add FonePay webhook callback route — gateway fully done, just wire the route
3. **P2-11**: Wire `admission.accepted` → student auto-creation in `listeners.py`
4. **P2-13**: Add `/notifications/mark-all-read` endpoint in `notifications.py`
5. **P2-14**: Wire `results.published` → portfolio item creation in `listeners.py`
6. **P3-9**: Add CDN cache headers to R2 upload responses
7. **P1-8**: Add PAN/IRD field to school model (just a migration + schema change)
8. **P1-6**: Add `idempotency_key` column to FeeCollection model

---

## FILE-LEVEL PRIORITY MAP

### Backend — Files Needing Work This Sprint

```
backend/
  app/
    api/v1/
      auth.py              → MFA/TOTP endpoints, per-user lockout
      fees.py              → idempotency key, FonePay wired (check initiate_fee_payment exists)
      admission.py         → emit("admission.accepted", ...) after approval
      notifications.py     → mark-all-read endpoint
      incidents.py         → emit("incident.created", ...)
      emergency.py         → emit("emergency.alert_broadcast", ...)
    api/webhooks/
      __init__.py          → /fonepay/callback route
    models/
      user.py              → totp_secret, totp_enabled, failed_login_attempts, locked_until
      fee.py               → idempotency_key on FeeCollection
      student.py           → disability_type, mother_tongue, ward_no, municipality, province
      school.py            → pan_number, irb_number, storage_quota_mb
    plugins/
      listeners.py         → on_admission_accepted, on_assignment_submitted,
                             on_attendance_absent, on_incident_created, on_emergency_broadcast
    tasks/
      db_backup.py         → (NEW) daily pg_dump → R2
    utils/
      file_upload.py       → ClamAV scan integration
      password.py          → policy enforcement
    scripts/
      backup_db.sh         → (NEW) pg_dump + R2 upload script
  requirements.txt         → pyotp, qrcode[pil], clamd
  config.py                → R2_BACKUP_BUCKET, VIRUS_SCAN_ENABLED, PASSWORD_MIN_LENGTH
```

### Frontend — Files Needing Work This Sprint

```
frontend/
  app/
    dashboard/
      settings/security/   → (NEW) TOTP setup page
      fees/                → FonePay payment UI, receipt PAN display
  lib/
    api.ts                 → FonePay initiation + callback handling
```

### Flutter — Files Needing Work This Sprint

```
flutter_shared/lib/
  features/
    student_attendance_screen.dart  → wire into student app
  widgets/
    emergency_alert_banner.dart     → (NEW) shared emergency widget

flutter_student/lib/
  screens/
    student_attendance_screen.dart  → import from shared

flutter_teacher/lib/
  screens/
    teacher_lms_screen.dart         → (NEW)
    teacher_emergency_screen.dart   → (NEW)

flutter_parent/lib/
  screens/
    child_health_screen.dart        → (NEW)
    parent_emergency_screen.dart    → (NEW)

flutter_admin/lib/
  screens/
    admin_dismissal_screen.dart     → (NEW)
    admin_emergency_screen.dart     → (NEW)

flutter_user/lib/
  main.dart                         → expand with full app screens
  screens/
    school_search_screen.dart       → (NEW)
    admission_form_screen.dart      → (NEW)
    application_status_screen.dart  → (NEW)
```

---

*Plan generated from audit documents (Parts 1–4) + live codebase verification on 2026-05-18.*
*Always implement in Docker — do not run npm/python commands on host.*
