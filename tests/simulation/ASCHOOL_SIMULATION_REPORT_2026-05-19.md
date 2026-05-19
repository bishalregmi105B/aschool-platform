## ASchool Simulation Report — 2026-05-19

### Summary
- Total tests run: 28
- Passed: 12
- Failed: 16
- Errors: 0

### Critical Failures
- Module: Module 1 / SEC-02
  - Test: Cross-tenant school read must be blocked
  - File:Line: backend/app/api/v1/schools.py:41
  - Reproduction Steps:
    1. Authenticate as `school_alpha` admin.
    2. Request `GET /api/v1/schools/<school_beta_id>`.
    3. Observe HTTP 200 with beta school data.
  - Fix: Enforce tenant check (`g.school_id == school_id`) for non-superadmin access and return 403 on mismatch.

- Module: Module 1 / SEC-04
  - Test: `custom_css` script payload must be rejected/sanitized
  - File:Line: backend/app/api/v1/website.py:135
  - Reproduction Steps:
    1. Authenticate as school admin.
    2. Submit `PUT /api/v1/website/config` with `custom_css="</style><script>alert(1)</script>"`.
    3. Read config and observe `<script>` preserved.
  - Fix: Reject dangerous patterns server-side and sanitize CSS/HTML before persistence.

- Module: Module 7 / SEC-03
  - Test: Notice body XSS payload must be stripped
  - File:Line: backend/app/api/v1/notices.py:178
  - Reproduction Steps:
    1. Create notice with content `<img src=x onerror=alert(1)>`.
    2. Fetch notice.
    3. Observe `onerror` attribute stored and returned.
  - Fix: Sanitize rich text with allowlist sanitizer (Bleach/DOMPurify-equivalent pipeline) before save and before render.

- Module: Module 2 / SEC-06
  - Test: Tokens must not be JS-readable
  - File:Line: frontend/lib/api.ts:49, frontend/lib/auth-context.tsx:71, frontend/lib/socket.ts:17
  - Reproduction Steps:
    1. Login on frontend.
    2. Inspect token persistence calls.
    3. Observe `Cookies.set("access_token", ...)` and `localStorage.getItem("token")`.
  - Fix: Move access token to HttpOnly secure cookie via server-side session/token exchange; remove client JS token storage.

### High Failures
- Module: Module 1 / SEC-01
  - Test: Cross-tenant school update must return 403
  - File:Line: backend/app/api/v1/schools.py:103
  - Reproduction Steps:
    1. Authenticate as `school_alpha` admin.
    2. Call `PUT /api/v1/schools/<school_beta_id>`.
    3. Transaction enters failed state during update flow, not a clean 403 deny.
  - Fix: Add explicit tenant authorization guard before mutation and return 403 deterministically.

- Module: Module 2 / SEC-05 (H1)
  - Test: `dev_otp` should be absent in non-dev security validation
  - File:Line: backend/app/api/v1/auth.py:249
  - Reproduction Steps:
    1. Call `POST /api/v1/auth/register`.
    2. Observe `dev_otp` included in response payload.
  - Fix: Never return OTP in HTTP payload; expose OTP only through isolated development log sink guarded by explicit environment gate.

- Module: Module 15 / SEC-08 (M3)
  - Test: WhatsApp verify token should use constant-time compare
  - File:Line: backend/app/api/webhooks/__init__.py:264
  - Reproduction Steps:
    1. Inspect webhook verification branch.
    2. Observe `token == verify_token`.
  - Fix: Replace with `hmac.compare_digest(token or "", verify_token or "")`.

- Module: Module 15 / SEC-09 (H4)
  - Test: Concurrent 401s should trigger single refresh flow
  - File:Line: flutter_shared/lib/services/api_client.dart:39
  - Reproduction Steps:
    1. Trigger concurrent 401 responses.
    2. Observe interceptor uses `_isRefreshing` flag only and no queue/completer.
    3. Non-refreshing requests can fail instead of waiting.
  - Fix: Implement single-flight refresh with shared `Future`/`Completer` and replay queued requests.

- Module: Module 10
  - Test: Hostel allocation response crashes
  - File:Line: backend/app/api/v1/hostel.py:52
  - Reproduction Steps:
    1. Create hostel room and allocate student.
    2. API raises `AttributeError: 'Student' object has no attribute 'full_name'`.
  - Fix: Build student name from `first_name` + `last_name` or use serializer helper.

- Module: Module 11
  - Test: Online exam question body XSS not sanitized
  - File:Line: backend/app/api/v1/exams.py:306
  - Reproduction Steps:
    1. Create online exam with question `<script>alert(1)</script>`.
    2. Retrieve exam payload.
    3. Observe script content retained.
  - Fix: Sanitize/validate question content on create/update; escape on render.

- Module: Module 15 / SEC-07 (M1)
  - Test: Middleware should validate token expiry
  - File:Line: frontend/middleware.ts:84
  - Reproduction Steps:
    1. Inspect dashboard guard.
    2. Observe only cookie existence check (`access_token` presence), no expiry/claim validation.
  - Fix: Validate JWT expiry/signature server-side (or use session introspection) before route allow.

### Medium Failures
- Module: Module 2.4
  - Test: Duplicate roll numbers in same class should be rejected
  - File:Line: backend/app/api/v1/students.py:112
  - Reproduction Steps:
    1. Create two students with same `class_id` and `roll_number`.
    2. Both requests return 201.
  - Fix: Add DB unique constraint + API validation for `(school_id, class_id, roll_number)`.

- Module: Module 3.2
  - Test: Cross-tenant subject assignment should return explicit deny
  - File:Line: backend/app/api/v1/academics.py:597
  - Reproduction Steps:
    1. Use `school_alpha` admin to assign `school_beta` subject.
    2. Observe 404 (resource hiding) instead of explicit 403 policy fail.
  - Fix: Standardize cross-tenant policy response for forbidden access paths.

- Module: Module 4
  - Test: Attendance re-submit idempotency interrupted by plugin listener JSON error
  - File:Line: backend/app/plugins/listeners.py:512
  - Reproduction Steps:
    1. Mark attendance twice for same student/date.
    2. Listener tries serializing Python `date` in notification `data` JSON.
    3. Transaction state breaks; second call returns 400.
  - Fix: Serialize dates to ISO strings before JSONB write and isolate listener failures from core transaction.

- Module: Module 6
  - Test: Cross-tenant fee action returns 404, not explicit 403
  - File:Line: backend/app/api/v1/fees.py:988
  - Reproduction Steps:
    1. Attempt payment on another tenant's collection id.
    2. Observe 404.
  - Fix: Align authorization behavior with explicit forbidden semantics where policy requires.

### Security Findings
- SEC-01: Failed (cross-tenant school update did not cleanly enforce 403)
- SEC-02: Failed (cross-tenant school read returned 200)
- SEC-03: Failed (notice XSS payload persisted)
- SEC-04: Failed (custom_css script payload persisted)
- SEC-05: Failed (`dev_otp` present in register response)
- SEC-06: Failed (access token stored in JS-readable cookie/localStorage path)
- SEC-07: Failed (middleware lacks JWT expiry validation)
- SEC-08: Failed (`==` used instead of `hmac.compare_digest`)
- SEC-09: Failed (no single-flight queue for concurrent refresh)
- SEC-10: Passed (Flutter OTP endpoint uses `/auth/send-otp`)
- SEC-11: Passed (NoDataContainer call includes required `title` + `subtitle`)
- SEC-12: Passed (attendance screen uses `getAttendance`)

### Audit Issue Status
| Issue | Status | Evidence |
|-------|--------|----------|
| C1    | Not Fixed | `GET/PUT /schools/<id>` cross-tenant behavior (tests SEC-01, SEC-02) |
| C2    | Not Fixed | Notice/custom_css/online-exam content accepts script payloads |
| H1    | Partial | OTP leak path still possible (`payload["dev_otp"]` under current config) |
| H2    | Not Fixed | JS-readable token storage in frontend client libs |
| H3    | Fixed | Flutter compile blockers resolved; analyze clean; SEC-11/12 passed |
| H4    | Not Fixed | Refresh logic lacks queue/single-flight synchronization |
| M1    | Not Fixed | Middleware checks token presence only |
| M2    | Not Fixed | Cross-tenant school read not blocked |
| M3    | Not Fixed | Webhook verify uses non-constant-time compare |
| M4    | Partial | Offline sync replay path not end-to-end validated in this run |
| M5    | Fixed | Flutter OTP endpoint aligned to `/auth/send-otp` |

### Recommended Next Actions (Priority Order)
1. Enforce strict tenant checks in `schools` and fee-sensitive routes and return deterministic 403 on cross-tenant access.
2. Add server-side sanitization for website/notice/exam rich text and switch frontend renderers to sanitized HTML only.
3. Remove all JS token storage paths; move auth to HttpOnly cookies plus robust middleware/token introspection.
4. Replace webhook token `==` with `hmac.compare_digest` and add regression test.
5. Implement single-flight refresh queue in Flutter `api_client` and verify with concurrent 401 integration tests.
6. Fix hostel allocation serializer (`Student.full_name`), attendance listener JSON serialization, and duplicate roll constraints.
