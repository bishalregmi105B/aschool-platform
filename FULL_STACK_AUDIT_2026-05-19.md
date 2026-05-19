# ASchool Full Stack Audit (Backend + Frontend + Flutter)

Date: 2026-05-19
Scope:
- backend/
- frontend/
- flutter_user/ (including shared runtime dependency in flutter_shared/)

## Executive Summary

Overall risk: **High**

Top risks confirmed:
1. **Tenant boundary weakness in backend school update route** (school admin can target arbitrary school UUID route).
2. **Stored XSS surface in public website rendering** (raw HTML/CSS is rendered without sanitization in multiple frontend views).
3. **Flutter shared package contains active compile errors** that block stable delivery paths.
4. **Web and mobile auth token handling remains JS/runtime accessible** (not httpOnly cookie model; refresh logic has race windows).

Good controls already present:
- Production secret validation and security headers exist in backend app factory.
- Parent blueprint is registered and tenant filtering is broadly implemented in many endpoints.
- Flutter uses secure storage and centralized Dio interceptor architecture.

---

## Severity-Ranked Findings

## Critical

### C1. Cross-tenant authorization gap on school update endpoint
- Why this matters: Endpoint authorization checks role, but not tenant ownership for the route school UUID. This can allow a school admin to update another school if a valid UUID is known.
- Evidence:
  - `backend/app/api/v1/schools.py:103` route `PUT /schools/<uuid:school_id>`
  - `backend/app/api/v1/schools.py:105` uses `@role_required("superadmin", "school_admin")`
  - `backend/app/api/v1/schools.py:106` loads school directly by `school_id`
- Impact: cross-tenant integrity breach (branding, config, plan, metadata overwrite).
- Recommended fix:
  - Restrict `PUT /schools/<id>` to `superadmin` only, OR enforce `school_id == g.school_id` for `school_admin`.
  - Prefer `PUT /schools/current` for school admin updates.

### C2. Stored XSS risk in public website rendering (raw HTML and CSS)
- Why this matters: Public pages render admin-configured HTML and CSS using raw insertion APIs. If content is compromised or insufficiently trusted, arbitrary script injection is possible.
- Evidence:
  - Raw HTML rendering:
    - `frontend/app/school/[slug]/page.tsx:200`
    - `frontend/app/school/[slug]/notices/page.tsx:49`
    - `frontend/app/school/[slug]/news/[articleSlug]/page.tsx:39`
    - `frontend/components/website/SectionRenderer.tsx:146`
    - `frontend/app/dashboard/exams/online/questions/page.tsx:170`
  - Raw CSS injection:
    - `frontend/app/school/[slug]/layout.tsx:120`
  - Backend accepts unsanitized website config fields including `custom_css`:
    - `backend/app/api/v1/website.py:140`
    - `backend/app/api/v1/website.py:152`
- Impact: account/session compromise on public pages, defacement, malicious redirects.
- Recommended fix:
  - Sanitize all HTML with strict allowlist (for example DOMPurify server-safe strategy) before render.
  - For CSS, block `</style>` escapes and dangerous constructs; apply strict sanitization/validation.
  - Add CSP on frontend responses (not only backend API).

## High

### H1. OTP/dev verification leakage path
- Why this matters: OTP values are deliberately exposed in dev/console modes and included in registration response payload when present.
- Evidence:
  - `backend/app/services/auth_service.py:74` returns OTP when `SMS_CONSOLE_MODE` or `DEBUG`
  - `backend/app/api/v1/auth.py:249` returns `dev_otp`
- Impact: accidental exposure in misconfigured environments/log captures.
- Recommended fix:
  - Hard-gate OTP echo behavior behind explicit non-production environment checks.
  - Never include OTP in API responses; use isolated secure dev logging.

### H2. Browser auth token model is script-accessible (cookies/local storage)
- Why this matters: Tokens are set/read by JavaScript (`js-cookie`, `localStorage`), increasing blast radius of any XSS.
- Evidence:
  - `frontend/lib/api.ts:49`
  - `frontend/lib/api.ts:50`
  - `frontend/lib/auth-context.tsx:71`
  - `frontend/lib/auth-context.tsx:72`
  - `frontend/lib/socket.ts:17`
- Impact: token theft, account takeover if XSS lands.
- Recommended fix:
  - Move to backend-issued `HttpOnly` secure cookies for auth.
  - Remove JS token storage and socket token reads from localStorage.

### H3. Flutter shared compile blockers (current diagnostics)
- Why this matters: Current analyzer errors in shared package can break release quality and CI confidence.
- Evidence (from diagnostics):
  - `flutter_shared/lib/features/student_attendance_screen.dart:45`
    - Calls missing `AttendanceRepository.getStudentAttendance`
  - `flutter_shared/lib/widgets/notification_center_screen.dart:109`
    - `NoDataContainer` call missing required `title`
  - `flutter_shared/lib/widgets/notification_center_screen.dart:111`
    - Invalid `message` named argument
- Impact: build failures / broken feature screens.
- Recommended fix:
  - Align `student_attendance_screen` with existing repository API (`getAttendance`).
  - Update `NoDataContainer` callsites to `title`/`subtitle` contract.

### H4. Flutter token refresh flow is not serialized for concurrent 401s
- Why this matters: `_isRefreshing` avoids one path but does not queue waiting requests, causing avoidable failures under burst traffic.
- Evidence:
  - `flutter_shared/lib/services/api_client.dart:39`
  - `flutter_shared/lib/services/api_client.dart:58`
- Impact: intermittent request failures, forced logouts, inconsistent user session behavior.
- Recommended fix:
  - Use a shared `Future`/completer lock to queue pending 401 retries until one refresh completes.

## Medium

### M1. Web middleware only checks token presence, not validity
- Why this matters: UI access gate relies on existence of cookie, not JWT validity at edge middleware.
- Evidence:
  - `frontend/middleware.ts:84`
- Impact: stale/invalid token may still pass route guard until API responses fail.
- Recommended fix:
  - Validate token shape/expiry (or call lightweight auth check endpoint) in middleware for protected routes.

### M2. Backend school-by-id read endpoint is broad for authenticated users
- Why this matters: `GET /schools/<id>` has `jwt_required` but no role/school ownership check.
- Evidence:
  - `backend/app/api/v1/schools.py:41`
  - `backend/app/api/v1/schools.py:43`
- Impact: potential cross-tenant metadata disclosure if UUID discovered.
- Recommended fix:
  - Restrict to superadmin OR enforce `school_id == g.school_id` for non-superadmin users.

### M3. WhatsApp webhook token comparison is not constant-time
- Why this matters: direct string compare leaks timing characteristics.
- Evidence:
  - `backend/app/api/webhooks/__init__.py:260`
  - `backend/app/api/webhooks/__init__.py:264`
- Impact: low-probability verification token probing aid.
- Recommended fix:
  - Replace `==` with `hmac.compare_digest`.

### M4. Flutter offline sync service is not integrated into write-path repositories
- Why this matters: queue exists, but failed mutation calls are not automatically enqueued in normal repository flows.
- Evidence:
  - `flutter_shared/lib/services/offline_sync.dart` (provider defined, no observed usage in write repos)
- Impact: transient network failures cause data-loss-like user experience.
- Recommended fix:
  - Integrate enqueue/retry flow at mutation points or within Dio interceptor strategy.

### M5. Flutter auth helper method uses non-existent backend route
- Why this matters: future OTP UI relying on this path will fail.
- Evidence:
  - `flutter_shared/lib/services/auth_service.dart:170` calls `/auth/request-otp`
  - Backend exposes `/auth/send-otp` and `/auth/verify-otp`:
    - `backend/app/api/v1/auth.py:12`
    - `backend/app/api/v1/auth.py:30`
- Impact: latent functional bug.
- Recommended fix:
  - Change to `/auth/send-otp` and add tests for auth endpoints contract.

---

## Static Health Snapshot

- Frontend diagnostics: no current editor errors reported.
- Flutter diagnostics: compile issues found in shared package (see H3).
- Backend diagnostics in editor include unresolved imports in current host analysis context; runtime correctness should be validated in the project Docker environment.

---

## Test Coverage Notes

- Backend has a non-trivial test suite (`backend/tests/` includes auth, fees, plugins, parent assignments).
- Frontend has focused utility/component tests under `frontend/__tests__/` but limited auth/session and XSS-hardening coverage.
- `flutter_user` has only a shell boot widget test (`flutter_user/test/widget_test.dart`); shared package has a few model/plugin/formatter tests but lacks auth/session/offline integration tests.

---

## Priority Remediation Plan

### 0-3 days
1. Patch backend school route authorization (C1, M2).
2. Remove/lock OTP exposure pathways (H1).
3. Fix Flutter compile blockers (H3).

### 4-10 days
1. Implement robust HTML/CSS sanitization pipeline and CSP strategy for public website rendering (C2).
2. Serialize Flutter token refresh and add retry queue handling (H4, M4).
3. Correct Flutter OTP endpoint mismatch and add contract tests (M5).

### 11-21 days
1. Migrate web token storage toward httpOnly cookie architecture (H2).
2. Improve middleware validity checks and add auth edge tests (M1).
3. Add regression tests for cross-tenant access controls and rich-content sanitization.

---

## Assumptions / Runtime Verification Needed

1. Cross-tenant exploitability for C1/M2 depends on practical school UUID discoverability in deployed environments.
2. XSS exploitability depends on who can author website/notices/news content and current operational trust boundaries.
3. Flutter refresh race impact should be validated with concurrent request simulation.

