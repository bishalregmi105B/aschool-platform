# ASchool SMS — Full Simulation & End-to-End Test Prompt
# For AI Copilot / Cursor / Windsurf
# Generated: 2026-05-19

---

## CONTEXT

You are a senior QA engineer and security tester working on **ASchool**, a multi-tenant School Management System
with the following stack:

- **Backend**: Python/Flask (`backend/`) — REST API, JWT auth, multi-tenant by `school_id`
- **Frontend**: Next.js (`frontend/`) — web dashboard + public school website
- **Mobile**: Flutter (`flutter_user/`, `flutter_shared/`) — student/parent app

The current audit (2026-05-19) flagged: cross-tenant authorization gaps (C1), stored XSS (C2),
OTP leakage (H1), JS-accessible tokens (H2), Flutter compile blockers (H3), refresh race (H4),
and several medium issues (M1–M5).

Your job is to **simulate every real-world action a school performs**, generate realistic fixture data,
run or write automated tests for each, and surface any failure, error, or security gap encountered.

---

## GLOBAL SIMULATION RULES

1. **Use realistic fixture data** — Nepali school names, real-looking student names, Nepali academic calendar (Shrawan–Ashad), NRS currency for billing.
2. **Cover the full user role matrix** for every entity: `superadmin`, `school_admin`, `teacher`, `student`, `parent`.
3. **Always attempt cross-tenant probes** after any write test — verify that User A's data cannot be read or mutated by User B in a different school.
4. **For every API call, assert**: correct HTTP status, correct response schema, tenant isolation, permission enforcement.
5. **Report every error** with: file + line, reproduction steps, severity (Critical / High / Medium / Low), and a concrete fix.
6. **Do not stop on first failure** — collect all failures, then summarize at the end.

---

## SIMULATION MODULES

Run each module completely before moving to the next. Within each module, follow the
CREATE → READ → UPDATE → DELETE → PERMISSION CHECK → CROSS-TENANT PROBE sequence.

---

### MODULE 1 — Tenant & School Setup

#### 1.1 School Registration
- Create 3 schools: `school_alpha`, `school_beta`, `school_gamma` with unique slugs.
- Set branding: logo, primary color, custom CSS, custom HTML for homepage.
- **Security probe (C2)**: Inject `<script>alert('xss')</script>` in `custom_css` and all HTML fields.
  Assert backend rejects or sanitizes before storage. Assert frontend does NOT execute injected script.
- Update school metadata as `school_admin` using `PUT /schools/<school_beta_uuid>` while authenticated
  as `school_alpha` admin. **Assert 403** (C1 fix verification).
- Attempt `GET /schools/<school_beta_uuid>` as `school_alpha` authenticated user. **Assert 403** (M2 fix).

#### 1.2 Academic Year & Terms
- Create academic year 2082-2083 (BS), two terms: Term 1 (Shrawan–Poush), Term 2 (Magh–Ashad).
- Test overlapping year creation — assert validation error.
- Test term creation outside academic year range — assert validation error.

---

### MODULE 2 — User Management

#### 2.1 Staff & Admin Creation
- Create: 1 school admin, 5 teachers (different subjects), 1 accountant, 1 librarian.
- Assign roles, assert `jwt_required` + role enforcement on each role-specific endpoint.
- Attempt teacher accessing admin-only endpoint — assert 403.

#### 2.2 OTP / Auth Flow (H1 fix verification)
- Trigger registration flow. In **production-mode config** (DEBUG=False, SMS_CONSOLE_MODE=False):
  Assert OTP is NOT present in API response body (`dev_otp` field must be absent).
- Trigger same in **dev config**: assert OTP logs only to isolated dev log, not HTTP response.
- Brute-force OTP with 10 wrong attempts — assert rate-limit or lockout fires.

#### 2.3 Token Security (H2 / M1 fix verification)
- After login, assert `access_token` is stored in HttpOnly cookie (not `localStorage`, not `js-cookie`).
- Open browser console, attempt `document.cookie` — assert token is not readable.
- Call `frontend/middleware.ts` protected route with an expired JWT — assert redirect to login (M1).
- Call same route with a malformed token string — assert redirect to login.

#### 2.4 Student Enrollment
- Bulk-import 50 students per school using CSV fixture (include: name, DOB, gender, guardian name,
  guardian phone, class, roll number, address).
- Assert: duplicate roll numbers within same class are rejected.
- Assert: student from `school_alpha` is not visible in `school_beta` API responses.
- Test edge cases: missing required fields, invalid phone format, DOB in future.

#### 2.5 Parent Account Linking
- Create parent accounts, link to students (one parent → multiple students, multiple parents → one student).
- Assert parent can only view their own linked students' data.
- Attempt parent accessing another student's data by ID — assert 403.

---

### MODULE 3 — Academic Structure

#### 3.1 Classes & Sections
- Create classes: Nursery, LKG, UKG, Class 1 through Class 10.
- Add sections A, B, C to Class 5, Class 9, Class 10.
- Assign class teacher to each section.
- Test: delete class that has enrolled students — assert soft-delete or rejection with message.

#### 3.2 Subjects & Curriculum
- Create subjects per class: Math, Science, English, Nepali, Social Studies, Optional Math, Computer.
- Assign subject teachers.
- Test: assigning a teacher to a subject in a different school's class — assert 403.

#### 3.3 Timetable Generation
- Generate weekly timetable for Class 10A: 6 periods/day, 5 days.
- Test: period collision (same teacher, same time, different classes) — assert conflict error.
- Test: view timetable as student — assert student sees only their own class schedule.

---

### MODULE 4 — Attendance

#### 4.1 Daily Attendance (Teacher)
- Mark attendance for Class 5A (30 students): present, absent, late, excused.
- Submit for today — assert success.
- Attempt re-submission for same date — assert idempotent update or rejection.
- Test attendance as teacher for a class not assigned to them — assert 403.

#### 4.2 Student Attendance Report
- Generate monthly attendance summary for one student.
- Assert percentage calculation is correct (manual verify: 20 present / 22 school days = 90.9%).
- **Flutter compile probe (H3)**: Call `AttendanceRepository.getStudentAttendance` — if it fails,
  surface the exact error and assert the fix to `getAttendance` resolves it.

#### 4.3 Staff Attendance
- Mark staff attendance (in/out time).
- Generate staff attendance report for the month.

---

### MODULE 5 — Examinations & Results

#### 5.1 Exam Schedule
- Create First Terminal Exam: start date, end date, per-subject schedule.
- Publish exam notice to public school website.
- **XSS probe (C2)**: Inject `<img src=x onerror=alert(1)>` in notice body — assert sanitization.

#### 5.2 Mark Entry
- Enter marks for 50 students across 7 subjects (Math: 100, Science: 75, English: 80, etc.).
- Test: enter mark > full marks — assert validation error.
- Test: negative marks — assert validation error.
- Test: teacher entering marks for a subject not assigned to them — assert 403.

#### 5.3 Marksheet Generation
- Generate individual marksheet PDF for one student.
- Generate bulk marksheet PDF for entire Class 10.
- Assert each marksheet contains: student name, roll number, subject marks, total, percentage, grade, rank.
- Assert school branding (logo, school name) appears on marksheet.
- Verify GPA/grade calculation against known input (e.g., 90% → A+, 35% → D / fail logic).

#### 5.4 Report Card Generation
- Generate report cards for entire Class 5 (all sections).
- Assert teacher remarks field is included.
- Assert principal signature placeholder exists.
- Download as ZIP — assert all 30 PDFs are present and non-corrupt.

#### 5.5 Rank & Division Calculation
- From 50 students' marks, assert:
  - Rank 1 goes to highest total.
  - Division: Distinction ≥ 80%, First ≥ 60%, Second ≥ 45%, Third ≥ 32%, Fail < 32%.
- Test tie-breaking in rank (two students with identical total).

---

### MODULE 6 — Fees & Billing

#### 6.1 Fee Structure Setup
- Create fee heads: Tuition Fee, Exam Fee, Sports Fee, Library Fee, Computer Lab Fee.
- Assign amounts per class (Class 10: Tuition = NRS 2500/month).
- Create discount categories: Scholarship (50%), Sibling (10%), Staff Child (25%).

#### 6.2 Fee Assignment & Invoice Generation
- Assign fee structure to all students of Class 10.
- Apply sibling discount to 5 students.
- Generate monthly invoices for Shrawan 2082 — assert all 50 students have invoices.
- Assert discounted students show correct net payable amount.

#### 6.3 Fee Payment & Receipt
- Process payment for 20 students (full payment, partial payment, advance payment).
- Assert receipt is generated with: receipt number, date, student name, amount paid, balance due.
- Assert duplicate receipt number is not generated.
- Test: payment amount > total due — assert overpayment handling (advance credit).

#### 6.4 Fee Defaulter Report
- Generate list of students with outstanding dues as of today.
- Assert: paid students do not appear in defaulter list.
- Assert: partial payers appear with correct remaining balance.

#### 6.5 Income & Expense Ledger
- Add school expenses: salary (5 staff), utility bills, maintenance.
- Generate monthly income vs expense report.
- Assert totals balance correctly.

#### 6.6 Cross-Tenant Billing Probe
- Attempt to access `school_beta`'s fee records while authenticated as `school_alpha` admin.
- Assert 403 on all billing endpoints.

---

### MODULE 7 — Communication

#### 7.1 Notices & Announcements
- Create: school-wide notice, class-specific notice, staff-only notice.
- **XSS probe (C2)**: Submit notice with `<script>` tag in body — assert backend sanitizes,
  frontend `dangerouslySetInnerHTML` equivalent is not triggered raw.
- Assert student can only see notices addressed to their class or school-wide.
- Assert parent sees notices for their child's class only.

#### 7.2 News / Articles
- Publish news article with rich HTML content on public website.
- **XSS probe**: Inject `javascript:` protocol in anchor href — assert stripped.
- Assert article appears on `frontend/app/school/[slug]/news/[articleSlug]/page.tsx`.

#### 7.3 SMS / WhatsApp Notifications
- Trigger SMS notification to parent (attendance alert, fee reminder).
- In dev mode, assert SMS goes to console, not real provider.
- **WhatsApp webhook probe (M3)**: Send verification request — assert token comparison uses
  `hmac.compare_digest`, not `==`. Write a timing-based test if possible.

#### 7.4 Push Notifications (Flutter)
- Trigger push for new notice — assert Flutter `notification_center_screen.dart` renders correctly.
- **Flutter compile probe (H3)**: Confirm `NoDataContainer` is called with correct `title` + `subtitle`
  arguments (not missing `title`, no invalid `message` arg).

---

### MODULE 8 — Library Management

#### 8.1 Book Catalog
- Add 20 books: title, author, ISBN, category, quantity.
- Test: duplicate ISBN — assert error or merge.
- Search books by title, author, category — assert correct results.

#### 8.2 Issue & Return
- Issue books to 5 students.
- Return 3 books.
- Test: issue book with 0 available copies — assert rejection.
- Test: student returning a book not issued to them — assert rejection.

#### 8.3 Overdue & Fine
- Simulate overdue return (backdated issue date).
- Assert fine calculation: NRS 2/day after due date.
- Generate overdue report.

---

### MODULE 9 — Transport Management

#### 9.1 Routes & Vehicles
- Create 3 routes with stops.
- Assign vehicles (bus, van) to routes.
- Assign students to routes.

#### 9.2 Transport Fee
- Add transport fee to students' billing.
- Assert transport fee appears in invoice.

---

### MODULE 10 — Hostel Management

#### 10.1 Rooms & Allocation
- Create hostels, floors, rooms (bed capacity).
- Allocate students to rooms.
- Test: over-allocate beyond room capacity — assert error.

#### 10.2 Hostel Fee
- Generate hostel fee invoices.
- Assert separate from tuition fee.

---

### MODULE 11 — Online Examination

#### 11.1 Question Bank
- Create question bank: MCQ, short answer, long answer.
- **XSS probe (C2)**: Inject script in question body — assert
  `frontend/app/dashboard/exams/online/questions/page.tsx:170` does not render raw HTML unsanitized.

#### 11.2 Exam Scheduling & Conduction
- Create online exam: title, duration 60 min, 20 MCQ questions, passing marks 40%.
- Student takes exam: answers 15 questions, skips 5.
- Assert auto-submit on timer expiry.
- Assert score = 15/20 = 75% calculated correctly.
- Test: student attempting exam outside scheduled window — assert rejection.

#### 11.3 Result & Analysis
- Generate per-student result and class-wide performance analytics.

---

### MODULE 12 — Data Import / Export

#### 12.1 Student Bulk Import
- Import CSV with 100 students (valid).
- Import CSV with 10 invalid rows (missing fields, bad format) — assert partial success report
  shows exactly which rows failed and why.
- Import duplicate students — assert conflict detection.

#### 12.2 Marks Bulk Import
- Import marks via Excel/CSV for one exam, one class.
- Test: value exceeding max marks in import — assert row-level rejection.

#### 12.3 Data Export
- Export student list as CSV, PDF.
- Export fee ledger as Excel.
- Export attendance summary as PDF.
- Assert exported files are non-empty and field-complete.

---

### MODULE 13 — Public School Website

#### 13.1 Page Rendering
- Visit `frontend/app/school/[slug]/page.tsx` — assert page loads with correct school data.
- Visit notices page — assert notices render.
- Visit news article — assert article renders.
- **XSS audit for all pages**: Confirm `dangerouslySetInnerHTML` is wrapped in DOMPurify or equivalent
  at: `page.tsx:200`, `notices/page.tsx:49`, `news/[articleSlug]/page.tsx:39`, `SectionRenderer.tsx:146`.

#### 13.2 Custom CSS Injection
- Submit `custom_css` with `</style><script>alert(1)</script>` via API.
- Assert `backend/app/api/v1/website.py:140` and `:152` reject or strip this payload.
- Assert `frontend/app/school/[slug]/layout.tsx:120` does not render unsanitized CSS.

#### 13.3 SEO & Meta
- Assert each public page has title, meta description, og:image from school config.

---

### MODULE 14 — Flutter Mobile App

#### 14.1 Login & Token Refresh (H4 fix verification)
- Login as student. Expire access token (simulate).
- Fire 5 concurrent API requests simultaneously.
- Assert only ONE refresh call is made (not 5).
- Assert all 5 queued requests complete successfully after refresh.
- Assert no forced logout occurs.

#### 14.2 Student Dashboard
- View: timetable, attendance summary, exam results, fee status, library issued books.
- Assert all data matches backend API.

#### 14.3 Parent Dashboard
- View children list, each child's attendance, fee dues, results, notices.
- Assert parent cannot navigate to another child's data by modifying IDs.

#### 14.4 OTP Endpoint Fix (M5 fix verification)
- Trigger OTP request from `flutter_shared/lib/services/auth_service.dart:170`.
- Assert it calls `/auth/send-otp` (not `/auth/request-otp`).
- Assert 200 response from backend.

#### 14.5 Offline Sync (M4)
- Disable network, submit attendance from teacher app.
- Re-enable network.
- Assert queued mutation is replayed and data appears in backend.

---

### MODULE 15 — Security Regression Suite

Run these after all modules above:

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| SEC-01 | `PUT /schools/<school_beta_id>` as `school_alpha` admin | 403 |
| SEC-02 | `GET /schools/<school_beta_id>` as authenticated `school_alpha` user | 403 |
| SEC-03 | `<script>` in notice body via API | Stripped / 400 |
| SEC-04 | `</style><script>` in custom_css via API | Stripped / 400 |
| SEC-05 | `dev_otp` in register response (production config) | Field absent |
| SEC-06 | `access_token` readable via `document.cookie` in browser | Not readable |
| SEC-07 | Expired JWT passes `frontend/middleware.ts` | Redirect to login |
| SEC-08 | WhatsApp webhook token uses `hmac.compare_digest` | Confirmed in code |
| SEC-09 | 5 concurrent 401s → only 1 refresh call in Flutter | Confirmed via log |
| SEC-10 | Flutter OTP calls `/auth/send-otp` | Confirmed |
| SEC-11 | `NoDataContainer` called with `title` arg | Compiles without error |
| SEC-12 | `AttendanceRepository.getStudentAttendance` → `getAttendance` | Compiles without error |

---

## OUTPUT FORMAT

After running all modules, produce a final report in this exact structure:

```
## ASchool Simulation Report — [DATE]

### Summary
- Total tests run: N
- Passed: N
- Failed: N
- Errors: N

### Critical Failures
[List each with: Module, Test, File:Line, Reproduction Steps, Fix]

### High Failures
[Same format]

### Medium Failures
[Same format]

### Security Findings
[List each SEC-XX result]

### Audit Issue Status
| Issue | Status | Evidence |
|-------|--------|----------|
| C1    | Fixed / Not Fixed / Partial | ... |
| C2    | Fixed / Not Fixed / Partial | ... |
| H1    | ...                         | ... |
| H2    | ...                         | ... |
| H3    | ...                         | ... |
| H4    | ...                         | ... |
| M1–M5 | ...                         | ... |

### Recommended Next Actions (Priority Order)
1. ...
2. ...
```

---

## NOTES FOR COPILOT

- Read actual source files before writing assertions — do not assume implementation.
- For Flutter: run `flutter analyze flutter_shared/` first and fix H3 blockers before simulating mobile modules.
- For backend: run tests inside the Docker environment (`docker-compose exec backend pytest`).
- For frontend: run `next build` and assert zero build errors before XSS probes.
- Use `factory_boy` or equivalent for Python fixture generation.
- Use `pytest-xdist` for parallel backend test execution.
- Use `flutter_test` + `mockito` for Flutter unit and widget tests.
- Create a `tests/simulation/` directory and commit all generated test files.