# ASchool Master Audit — Part 1: Executive Summary & Global System

**Audit Date**: 2026-05-16 | **Auditor**: ASchool Sentinel | **Codebase Snapshot**: Latest main branch

---

## 1. EXECUTIVE SUMMARY

### Overall System Health Score: **52/100**

| Metric | Value |
|--------|-------|
| Plugins fully production-ready | **4/43** (9%) |
| Plugins with critical issues | **12** |
| Plugins PARTIAL (functional, gaps) | **27** |
| Plugins FAIL (stub/incomplete) | **8** |
| Total backend API route files | **56** |
| Total API endpoints (approx) | **~650+** |
| Total DB models | **~100+** across 50 model files |
| Celery scheduled tasks | **9** beat schedules, **21** task modules |
| Frontend dashboard pages | **~97** page.tsx files |
| Flutter mobile screens | **102** (Teacher: 23, Parent: 18, Student: 23, Admin: 38) |
| Backend test files | **15** (critically low) |

### Top 10 Critical Issues

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **No MFA/2FA** — Only OTP login exists, no authenticator app, no MFA on admin | 🔴 CRITICAL | Account takeover risk |
| 2 | **`default_password_hint` exposed in User.to_dict()** — Default password returned in API response | 🔴 CRITICAL | Password exposure |
| 3 | **No CSRF protection** — Flask app has no CSRF middleware for state-changing endpoints | 🔴 CRITICAL | CSRF attacks on admin |
| 4 | **FonePay gateway missing** — Only eSewa + Khalti implemented, no FonePay | ❌ FAIL | Missing payment channel |
| 5 | **No file virus scanning** — `file_upload.py` validates types but no malware scan | 🔴 CRITICAL | Malware upload risk |
| 6 | **Test coverage ~5%** — Only 15 test files, most plugins have zero tests | ❌ FAIL | Regression risk |
| 7 | **No database backup automation** — No backup scripts or scheduled dumps | 🔴 CRITICAL | Data loss risk |
| 8 | **SMS bulk send is synchronous loop** — `send_bulk()` iterates serially, no Celery | ⚠️ HIGH | Timeout on large batches |
| 9 | **No Sentry/APM integration active** — Config exists but no init code | ⚠️ HIGH | Blind to production errors |
| 10 | **Cross-plugin event bus has no registered listeners** — `events.py` framework exists but zero `@on()` decorators found | ⚠️ HIGH | Integrations are theoretical |

### Estimated Engineering Hours to International Standard

| Category | Hours |
|----------|-------|
| Security hardening (MFA, CSRF, virus scan, secrets) | 120 |
| Missing plugin features (stubs → functional) | 400 |
| Test coverage (target 60%) | 300 |
| Mobile app parity (missing screens) | 250 |
| Cross-plugin integration wiring | 150 |
| Monitoring, backup, DR setup | 80 |
| Nepal compliance (EMIS, DEO, BS calendar gaps) | 100 |
| Performance (N+1, caching, CDN) | 80 |
| **TOTAL** | **~1,480 hours** |

---

## 2. GLOBAL SYSTEM AUDIT

---

### 2.1 AUTHENTICATION & AUTHORIZATION

| Check | Status | Detail |
|-------|--------|--------|
| JWT Bearer auth | ✅ PASS | `flask_jwt_extended` with access + refresh tokens |
| JWT expiry | ✅ PASS | Access: 1h (configurable), Refresh: 30d |
| Refresh token rotation | ⚠️ PARTIAL | Refresh endpoint exists but no token rotation/blacklisting |
| MFA (OTP via SMS) | ⚠️ PARTIAL | OTP login via Sparrow SMS exists, but no TOTP authenticator |
| MFA on admin panel | ❌ FAIL | No 2FA gate for school_admin or superadmin |
| OAuth2/SSO (Google) | ❌ FAIL | Not implemented |
| Password policies | ❌ FAIL | No min length, complexity, or expiry enforcement |
| Brute-force protection | ⚠️ PARTIAL | Flask-Limiter at 60/min global, but no account lockout or CAPTCHA |
| Session invalidation to mobile | ❌ FAIL | No mechanism to invalidate mobile JWT tokens remotely |
| Role-based auth (RBAC) | ✅ PASS | `permissions.py` defines 7 roles × module × action matrix |
| `default_password_hint` leak | 🔴 CRITICAL | `User.to_dict()` line 106 returns the default password hint in every API response |

**Specific File References**:
- Auth routes: [auth.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/auth.py) — 267 lines, 10 endpoints
- Permissions: [permissions.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/utils/permissions.py) — RBAC matrix
- User model: [user.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/user.py) — Line 106: `"default_password_hint": default_pw`

---

### 2.2 MULTI-TENANCY & SCHOOL ISOLATION

| Check | Status | Detail |
|-------|--------|--------|
| `school_id` on all tables | ✅ PASS | `SchoolModel` base class enforces `school_id` FK + index |
| `for_school()` query scoping | ✅ PASS | `SchoolModel.for_school(school_id)` raises `SchoolIsolationError` if None |
| Subdomain routing | ✅ PASS | `{slug}.aschool.com.np` → middleware resolves school context |
| Cross-tenant data leakage test | ❌ FAIL | No automated tests for cross-tenant isolation |
| File uploads tenant-isolated | ⚠️ PARTIAL | Local uploads use flat `/uploads/` dir, R2 uses `school_id` prefix |
| Plugin cache isolation | ✅ PASS | Cache key `school:{id}:plugins` with 5-min TTL |

**Architecture**:
- `before_request` hook in [__init__.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/__init__.py#L119-L168) resolves school from subdomain or JWT
- [base.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/models/base.py) — `SchoolModel` abstract class with `for_school()` + `SchoolIsolationError`

> [!WARNING]
> The `User` model does NOT extend `SchoolModel` — it has `school_id` but uses its own `for_school()`. Superadmin users have `school_id=None`. This is by design but requires careful auditing of every User query.

---

### 2.3 PAYMENT GATEWAY COMPLIANCE (Nepal-specific)

| Check | Status | Detail |
|-------|--------|--------|
| eSewa integration | ✅ PASS | ePay v2 with HMAC SHA256 signatures, sandbox + production |
| eSewa payment verification | ✅ PASS | Base64 decode + signature verification + status check API |
| Khalti integration | ⚠️ PARTIAL | Payment initiation + verification exists, but no refund API |
| FonePay integration | ❌ FAIL | **Completely missing** — no QR generation, no payment polling |
| Server-side amount validation | ⚠️ PARTIAL | eSewa validates signature, but fee amount not cross-checked against DB record before gateway call |
| PCI-DSS scope | ✅ PASS | No card data stored — redirect to gateway |
| IRD-compliant receipts | ❌ FAIL | Fee receipts exist but no PAN/IRD fields |
| Double-charge prevention | ⚠️ PARTIAL | Transaction UUID prevents duplicate eSewa, but no idempotency key on fee collection endpoint |

**File References**:
- [esewa_gateway.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/services/payments/esewa_gateway.py) — 126 lines, well-structured
- [khalti_gateway.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/services/payments/khalti_gateway.py) — 94 lines, missing refund
- FonePay: **NO FILE EXISTS**

---

### 2.4 NOTIFICATION INFRASTRUCTURE

| Check | Status | Detail |
|-------|--------|--------|
| Push (FCM Android) | ⚠️ PARTIAL | `push_notifications.py` task exists, Firebase config in env |
| Push (APNs iOS) | ❌ FAIL | No APNs configuration — FCM only |
| SMS (Sparrow SMS) | ✅ PASS | Full integration with OTP, attendance, fee reminders |
| SMS console mode | ✅ PASS | `SMS_CONSOLE_MODE` for dev without burning credits |
| SMS bulk optimization | ❌ FAIL | `send_bulk()` is a synchronous loop — should use Celery |
| WhatsApp (Meta API) | ✅ PASS | Cloud API integration with template support |
| WhatsApp webhook verify | ✅ PASS | HMAC signature verification on inbound webhooks |
| WhatsApp rate limits | ⚠️ PARTIAL | No explicit rate limiting on outbound messages |
| Email (SPF/DKIM) | ❌ FAIL | `email_service.py` exists but no SPF/DKIM/DMARC config visible |
| In-app notification center | ⚠️ PARTIAL | `PushNotification` model exists, but no read/unread/mark-all-read API |
| Notification batching/digest | ❌ FAIL | No digest mode — each event fires individually |

**File References**:
- [sms_gateway.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/services/communications/sms_gateway.py)
- [whatsapp_cloud.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/services/communications/whatsapp_cloud.py)
- [email_service.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/services/communications/email_service.py)
- Tasks: [sms_sender.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/tasks/sms_sender.py), [whatsapp_sender.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/tasks/whatsapp_sender.py), [push_notifications.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/tasks/push_notifications.py)

---

### 2.5 FILE STORAGE & MEDIA

| Check | Status | Detail |
|-------|--------|--------|
| Cloud storage (R2) | ✅ PASS | Cloudflare R2 integration with S3-compatible API |
| Local fallback | ✅ PASS | `FILE_STORAGE_BACKEND=local` for dev |
| File size validation | ⚠️ PARTIAL | In `file_upload.py` but not consistently applied across all upload endpoints |
| MIME type validation | ⚠️ PARTIAL | Extension + MIME check exists, but no magic byte validation |
| Virus scanning | ❌ FAIL | No ClamAV or similar integration |
| CDN serving | ⚠️ PARTIAL | `R2_PUBLIC_URL` config exists, but no CDN cache headers |
| Signed/expiring URLs | ❌ FAIL | No pre-signed URL generation for sensitive documents |
| Storage quota per school | ❌ FAIL | No quota enforcement |

---

### 2.6 SEARCH & PERFORMANCE

| Check | Status | Detail |
|-------|--------|--------|
| Global search | ✅ PASS | [search.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/search.py) — unified search across students, staff, notices |
| Elasticsearch | ❌ FAIL | Using SQL ILIKE — no dedicated search engine |
| API response times | ⚠️ UNKNOWN | No APM to measure |
| Redis caching | ✅ PASS | Flask-Caching with Redis backend, 300s default TTL |
| CDN for static assets | ⚠️ PARTIAL | Next.js serves static, but no explicit CDN config |
| DB connection pooling | ✅ PASS | SQLAlchemy pool_size=20, pool_recycle=300, pool_pre_ping=True |
| N+1 query detection | ⚠️ UNKNOWN | No tooling to detect; large API files like `exams.py` (1690 lines) likely have N+1 issues |

---

### 2.7 MONITORING & OBSERVABILITY

| Check | Status | Detail |
|-------|--------|--------|
| APM (Sentry) | ⚠️ PARTIAL | `SENTRY_DSN` config exists but no `sentry_sdk.init()` call found |
| 5xx alerting | ❌ FAIL | No Slack/PagerDuty integration |
| Structured logging | ⚠️ PARTIAL | Python `logging` used but not JSON-structured |
| Slow query logging | ❌ FAIL | No slow query alerts |
| Uptime monitoring | ❌ FAIL | No Pingdom/UptimeRobot |
| Health check endpoint | ✅ PASS | `/health` returns `{"status": "ok"}` |
| Readiness probe | ❌ FAIL | No `/ready` endpoint (checks DB + Redis connectivity) |
| Distributed tracing | ❌ FAIL | No trace correlation across Flask → Celery → external APIs |

---

### 2.8 SECURITY HARDENING

| Check | Status | Detail |
|-------|--------|--------|
| HTTPS (TLS 1.2+) | ✅ PASS | Nginx config in `/nginx/` directory |
| Security headers (CSP, HSTS) | ❌ FAIL | No security headers middleware in Flask or Next.js |
| SQL injection prevention | ✅ PASS | SQLAlchemy ORM — parameterized queries |
| XSS prevention | ⚠️ PARTIAL | React auto-escapes, but no CSP header |
| CSRF protection | ❌ FAIL | No CSRF tokens on any endpoints — API-only (JWT) but admin web forms are vulnerable |
| Dependency vulnerability scan | ❌ FAIL | No `npm audit` or `pip audit` in CI |
| Secrets management | ⚠️ PARTIAL | `.env` file with secrets, no Vault/KMS |
| Admin IP restriction | ❌ FAIL | No IP allowlist for superadmin endpoints |
| API keys in code | ⚠️ PARTIAL | Config reads from env vars, but `SECRET_KEY = "change-me"` default is dangerous |

> [!CAUTION]
> `SECRET_KEY = "change-me"` and `JWT_SECRET_KEY = "change-me-jwt"` defaults in [config.py](file:///home/bishal-regmi/Desktop/ASchool/backend/config.py#L29-L39) — if production doesn't override these, all JWTs are forged trivially.

---

### 2.9 NEPAL GOVERNMENT COMPLIANCE

| Check | Status | Detail |
|-------|--------|--------|
| MoE Flash Report | ⚠️ PARTIAL | [compliance.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/compliance.py) API exists (7278 lines), but auto-population from live data is incomplete |
| EMIS Export | ✅ PASS | [iemis_importer.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/api/v1/iemis_importer.py) — 987 lines, import + export support |
| DEO Format reports | ⚠️ PARTIAL | Report generation task exists but DEO-specific templates not verified |
| Nepali calendar (BS) | ✅ PASS | [nepali_date.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/utils/nepali_date.py) + `dob_bs` fields on models |
| Nepali number formatting | ✅ PASS | [nepali_numbers.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/utils/nepali_numbers.py) — lakh/crore notation |
| Nepal grading system | ✅ PASS | [nepal_grading.py](file:///home/bishal-regmi/Desktop/ASchool/backend/app/utils/nepal_grading.py) — NEB/SEE grade calculation |
| Nepali font support | ⚠️ PARTIAL | `full_name_nepali` field exists but not all UI renders it |

---

### 2.10 DISASTER RECOVERY & BACKUP

| Check | Status | Detail |
|-------|--------|--------|
| Automated DB backups | ❌ FAIL | No backup scripts or cron jobs found |
| Backup restoration testing | ❌ FAIL | No procedure documented |
| Documented RTO/RPO | ❌ FAIL | None |
| Geo-redundant backups | ❌ FAIL | Single-region |
| Rollback process | ⚠️ PARTIAL | Docker-based, but no staged rollback procedure |

---

## 3. ARCHITECTURE SCORECARD

| Component | Score | Notes |
|-----------|-------|-------|
| **Backend (Flask/Python)** | 65/100 | Solid architecture, plugin system, good model abstractions. Gaps in security hardening + testing. |
| **Frontend (Next.js)** | 55/100 | ~97 dashboard pages, subdomain routing works. Missing error boundaries, WCAG, print CSS. |
| **Mobile (Flutter)** | 50/100 | 4 separate apps (admin/teacher/parent/student) + shared lib. Good screen count but many plugins unrepresented. |
| **Infrastructure** | 40/100 | Docker Compose with proper health checks. Missing backup, monitoring, CDN, CI/CD. |
| **Security** | 35/100 | JWT + RBAC + tenant isolation strong. Missing MFA, CSRF, security headers, virus scan, secrets mgmt. |
| **Testing** | 15/100 | 15 test files total. No frontend tests. No mobile tests. No integration tests. |

---

## 4. TECH STACK CONFIRMED

| Layer | Technology |
|-------|-----------|
| Backend Framework | Flask (Python) with Blueprints |
| ORM | SQLAlchemy + Flask-Migrate (Alembic) |
| Database | PostgreSQL 16 (pgvector image) |
| Cache | Redis 7 + Flask-Caching |
| Task Queue | Celery with Redis broker |
| Real-time | Flask-SocketIO (eventlet) |
| Auth | Flask-JWT-Extended |
| Rate Limiting | Flask-Limiter + custom Redis token-bucket |
| Frontend | Next.js (React) with Tailwind CSS |
| Mobile | Flutter (Dart) — 6 packages: user, teacher, parent, student, admin, shared |
| File Storage | Cloudflare R2 (S3-compatible) + local fallback |
| SMS | Sparrow SMS (Nepal) |
| WhatsApp | Meta Cloud API |
| Payments | eSewa ePay v2, Khalti |
| AI | Anthropic Claude (primary), Groq (fallback) |
| Container | Docker Compose (dev), docker-compose.prod.yml (prod) |

---

> **Continue to Part 2** for per-plugin audits (Tier 1 Core + Tier 2 Starter).
