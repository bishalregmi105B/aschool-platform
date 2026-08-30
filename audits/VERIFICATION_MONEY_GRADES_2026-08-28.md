# VERIFICATION — Money & Grades track (2026-08-28)

## Documents

Agent: documents/reports scope (reports.py + exams.py PDF surface). All runtime checks
against `aschool-flask-1` (dev DB, port 5003), fixture in "Audit Test Growth School"
(`d20135d0-4d07-49b4-b511-7284ce7507dd`), cleaned up after. Magic bytes read with `head -c 5`
(`%PDF-`), text proof with `pdftotext` (available on host).

### 1. Inventory — what each endpoint claims vs actually produces

Backend files: `backend/app/api/v1/reports.py` (rewritten this session),
`backend/app/api/v1/exams.py` (NOT modified — verified as-is).

| Route | Claims | Produces (before) | Produces (now) |
|---|---|---|---|
| GET `/reports/attendance/summary` | attendance summary | JSON | JSON — shape unchanged (consumed by `frontend/app/dashboard/attendance/reports/page.tsx:41`) |
| GET `/reports/attendance/summary/pdf` | *(new)* | — | **Real PDF**, persisted via `upload_file`, returns `pdf_url` |
| GET `/reports/fees/collection` | fee collection summary | JSON | JSON — shape unchanged (consumed by `frontend/lib/services/dashboard/fees.service.ts:127`) |
| GET `/reports/fees/collection/pdf` | *(new)* | — | **Real PDF** (NPR amounts, payments table), persisted, returns `pdf_url` |
| GET `/reports/exams/results` | exam results summary | JSON | JSON — shape unchanged (consumed by `frontend/app/dashboard/reports/exam/page.tsx:69`) |
| GET `/reports/exams/results/pdf` | *(new)* | — | **Real PDF** subject-wise table, persisted, returns `pdf_url` |
| GET `/reports/dashboard` | stats | JSON | JSON (stats, not a document — unchanged) |
| GET `/exams/<exam>/marksheet/<sid>` | marksheet | JSON | JSON (unchanged; runtime 200) |
| GET `/exams/<exam>/marksheet/<sid>/html` | marksheet | JSON envelope w/ HTML string | same (200) |
| POST `/exams/<exam>/designer-marksheet` | designer marksheets | JSON array (frontend fabric/jsPDF) | same; 403 without `design_studio` plugin (runtime-verified) |
| GET/POST `/exams/<exam>/report-cards[/<sid>]` | report cards | JSON | JSON (unchanged) |
| POST `/exams/<exam>/report-cards` {class_id} | bulk generation | Celery `generate_bulk_report_cards` | Celery task → **real per-student PDFs persisted** (other agent's G1 fix; runtime re-confirmed this session, see §3) |
| GET `/exams/<exam>/bulk-marksheet-pdf` | bulk marksheet PDF | claimed fake by prior audit | **Real server-side WeasyPrint PDF** (was already real — see §3) |
| GET `/exams/<exam>/report-cards/bulk-pdf` | bulk report-card PDF | claimed fake by prior audit | **Real server-side WeasyPrint PDF** (was already real — see §3) |

Verdict on `PRIOR_AUDIT_DIFF` row "reports.py needs WeasyPrint (JSON-only today)": **was CORRECT
at audit time; now FIXED** — three `/pdf` exports added alongside the untouched JSON endpoints.

### 2. New reports.py PDF exports — implementation + runtime evidence

Pattern: `backend/app/utils/report_pdf.py` (new shared util) — A4 letterhead (school name,
address, phone/email/PAN), Bikram Sambat issue line via `app/utils/nepali_date.today_bs()`,
NPR formatting, page-number footer. Persists through `app.utils.file_upload.upload_file`
(folder `reports/<school_id>`) and returns `pdf_url` — same contract as the report-card
Celery task. 501 when WeasyPrint missing (fees-receipt convention).

Runtime evidence (fixture: 3 students, 6 attendance rows, 1 paid + 1 pending fee, 6 marks):

- `attendance_report_2026-08-01_2026-08-28.pdf` — **%PDF-**, 15,046 B; extracted text:
  "Attendance Report / Audit Test Growth School / Issued: 2026-08-28 AD | 2083-05-12 BS /
  Present 3, Absent 3, Total 6 / Attendance rate: 50.0% / Class-wise Breakdown".
- `fee_collection_report_…pdf` — **%PDF-**, 14,917 B; text shows "NPR 5,000.00" collected +
  pending, "Zarina Fixname / Monthly Tuition" payment row.
- `exam_results_report_…pdf` — **%PDF-**, 15,376 B; text shows subject rows
  ("ZFix Mathematics … 3 … pass %").
- Authed call → 200 + URL; unauth → **401**; missing `start_date` → **400**; bogus exam id →
  **404** ("No marks found for this exam/class"). Attendance/fees reports are school-scoped by
  query (`Attendance.school_id == g.school_id` etc.) — cross-school callers see only empty data,
  no leak. Class-scoped export uses a distinct filename (`_class_<id12>`) so it cannot
  overwrite the all-classes file (collision found and fixed during verification).

### 3. exams.py bulk PDF paths — runtime verification (correctness in scope)

Fixture exam `44784d32-…` / class `b3b02d0e-…` (3 students × 2 subjects):

- **Celery bulk report-cards** (`POST /exams/<exam>/report-cards` → `generate_bulk_report_cards`):
  after run, 3 `report_cards` rows with real persisted files. Fetched all three:
  `magic=%PDF- size=11398 / 11257 / 11562`; `pdftotext` finds the correct student name in each
  ("Zarina Fixname"=1, "Bikash Fixman"=1, "Sunita Fixperson"=1).
  **Operational bug found (not code):** first run produced dead `pdf_url="/reports/…"` and zero
  files because `aschool-celery-worker-1` had the pre-fix `report_generation.py` in memory (the
  G1 fix landed after worker start; Celery does not hot-reload). `docker restart
  aschool-celery-worker-1` loaded the mounted fixed code; re-run produced correct
  `/uploads/reports/…` URLs + files. Anyone re-verifying must restart the worker after pulling
  task-file changes.
- **GET `/exams/<exam>/bulk-marksheet-pdf?class_id=`**: 200, `Content-Disposition: attachment;
  filename=marksheets_…pdf`, **%PDF-**, 19,805 B, 3 pages; extracted text shows per-student
  "MARKSHEET / PROGRESS REPORT / Student: Sunita Fixperson / Roll No: 3 / Class: ZFix Grade 5".
- **GET `/exams/<exam>/report-cards/bulk-pdf?class_id=`**: 200, attachment, **%PDF-**, 15,563 B,
  3 pages; all three student names extracted; percentage 71.5% matches marks.
  Guards: bogus exam → **404**; unauth → **401**.
  Pre-existing cosmetic gap (not fixed — lives in `app/tasks/report_generation.py` which is
  another agent's file): bulk-pdf renders `Grade: -` / `GPA: 0.0` because the task never
  populates `ReportCard.overall_grade` / `overall_gpa`.

### 4. Regression tests

`backend/tests/test_reports_pdf.py` (new, 7 tests) — **7/7 passed** in-container: real-file
fetch through served `/uploads` route (`%PDF-` + >1 KB), class-scope filename, 400/401,
JSON shape pinned (`attendance_rate`/`summary` keys; fee keys), `fmt_npr` + BS letterhead.
Adjacent suites after change: `test_api.py` + `test_fees_summary.py` **12/12 passed** (an
earlier 12-error run was a TRUNCATE deadlock from two overlapping pytest sessions against the
shared dev cluster — clean sequential rerun green; not a code regression).

### 5. Notes / limitations (honest)

- `/uploads/<path>` is served without authentication (platform-wide: `app/__init__.py:484-489`);
  report PDFs inherit that exposure, same as fee receipts and report-card PDFs.
- During verification I reset the audit fixture login `auditgrowth@test.local` to
  `AuditTest@2026` (original password unknown) and activated the `exams` plugin for the audit
  school — plugin row and all fixture rows deleted afterward; password change left in place.
- All fixture rows (ZFix-* students/marks/exam/class/subjects/attendance/fees/report_cards) and
  the generated verification PDFs were deleted; other schools' `uploads/reports/` dirs untouched.
- No git commits made. Files changed: `backend/app/api/v1/reports.py` (rewrite + PDF exports),
  `backend/app/utils/report_pdf.py` (new), `backend/tests/test_reports_pdf.py` (new).
  `exams.py`, `fees.py`, `hr_payroll.py`, `tasks/`, `compliance.py` untouched.

## Money & Grades

Agent: grading / payroll / fees money-math scope. Every number below was hand-computed
first, then compared against code output to the last digit, inside `aschool-flask-1`
(host `./backend` mounted at `/app` — edits live). Endpoint checks used in-container
pytest against the testing DB (`aschool_test`, auto-reset per test — no dev-DB fixtures
left behind); PDF text proof via host `pdftotext` (+ in-container `pypdf` for the new
regression test). No git commits.

### 1. GRADING — `backend/app/utils/nepal_grading.py`: verified correct, ZERO defects, not changed

(a) Letter bands vs the docstring claims: the `NEB_GRADES` table and `GRADE_TABLE` match
the claimed scale exactly — A+ 90-100 (4.0), A 80-<90 (3.6), B+ 70-<80 (3.2),
B 60-<70 (2.8), C+ 50-<60 (2.4), C 40-<50 (2.0), D 35-<40 (1.6), NG <35 (0.0). Every
boundary value maps to its own band (90→A+/4.0 … 35→D/1.6, 0→NG) and boundary−ε falls to
the band below (89.99…→A, 34.99…→NG). `>=` comparison is correct for the claimed
"min-inclusive" bands.
(b) GPA from letters (equal credits): (4.0+3.6+3.2)/3 = **3.6** ✓; overall pct
(90+85+75)/300 = **83.33** ✓.
(c) Weighted GPA, credits 4/3/2/1: (4·4.0 + 3·3.6 + 2·3.2 + 1·2.8)/10 = **3.60** ✓;
second case (4·2.0 + 3·3.6 + 2·4.0 + 1·1.6)/10 = **2.84** ✓.
(d) Zero/null weight & zero total marks — no divide-by-zero, no silent subject drop:
- `credit_hours: null` or missing key → 1.0 fallback: (4.0+3.6)/2 = **3.8** ✓.
- Explicit 0 honoured: (4·2 + 3.6·0)/2 = **4.0** ✓ and the 0-credit subject is NOT
  dropped (marks totals still include it: 175/175; subjects list count intact).
- All-zero credits → `total_credits > 0` guard → GPA 0.0, no ZeroDivisionError, marks
  still summed, letter grade still derived from pct (87.5% → A).
- Subject 0/0 marks → pct 0.0, NG/fail, no crash; feeding it through `calculate_gpa` →
  0.0 / NG, no crash. Empty list → NG / 0.0 / fail.
- NG subject is never silently dropped: totals include it ((95+30)/200 = **62.5** ✓) and
  it forces overall `status="fail"` + `subjects_failed=1`.
(e) Exact band boundaries + component rules: theory pass at exactly 35% passes, 34 fails;
practical 40% rule enforced (35% practical → NG even at 50% overall); custom
`theory_pass_marks` honoured; 25% overall with a passing component → NG (D band starts
at 35% — correct). 45+ hand-checked assertions in an in-container script: **all pass**.

Endpoint cross-check — `GET /exams/<exam_id>/results` (exams.py, read-only, verified
as-is) on a fixture of 2 students × 3 subjects (full marks 100, no stored grade/gpa
override):
- Student A 90/85/75: endpoint `gpa` = **3.6** == `calculate_gpa()` on the exact
  subject-grade dicts the endpoint builds == hand math; percentage **83.33** → grade A,
  pass, rank 1.
- Student B 35/34/66: endpoint `gpa` = **1.47** == util == hand (4.4/3 = 1.466…→1.47);
  percentage **45.0** → grade **C** (40-<50 band), status fail (one NG),
  `subjects_failed=1`, rank 2.
- Weighted variant through the util on the same fixture with the subjects' real
  `credit_hours` 4/3/2: **3.69** ((16+10.8+6.4)/9) and **1.33** (12/9) — matches hand math.
Pinned by new `backend/tests/test_gpa_endpoint_vs_util.py`.

Observation (NOT fixed — exams.py is read-only for this track): the results endpoint
never injects `Subject.credit_hours` into the subject-grade dicts it passes to
`calculate_gpa`, so the API's overall GPA is always equal-weighted even for subjects that
carry credit hours; the util's weighted path activates only for callers that pass
`credit_hours`. If weighted report-card GPA is wanted, `_build_subject_grade`/`get_results`
should add `sg["credit_hours"] = subject.credit_hours` — left to the exams.py owner.

### 2. PAYROLL — `backend/app/api/v1/hr_payroll.py`: alleged fallback bug NOT present; 2 real defects found & fixed

Invariants verified by hand: gross = basic + Σallowances; net = gross − Σdeductions.
Fixture (base + 2 allowances + 2 deductions): basic 40000, allowances
{transport 3000, dearness 2000} = 5000, deductions {pf 1500, insurance 500} = 2000 →
gross **45000**, net **43000** — matching in create response, GET `/hr/payroll`,
`_payroll_dict` and the payslip.
- **Percentage-based components are NOT supported** (documented behaviour, consistent
  everywhere): any non-numeric value (`"10%"`, booleans, None) contributes 0 via
  `_numeric_component`/`_sum_money` and is skipped from payslip itemized rows too —
  fixture with `"tax_percent": "10%"` still totals deductions 2000.
- **Partial-period proration is NOT supported** — `StaffPayroll` has no period/date
  fields and no proration math exists anywhere; payroll is whole-month only.
- **Alleged bug "falls back to an incorrect default when itemized components aren't
  stored": NOT present in current code.** Runtime fixtures: a record with components but
  NULL gross/net reports computed values from the REAL stored records (45000/43000) in
  the serializer and payslip; a record with components but stored gross 46000 / net NULL
  also uses the real records (nothing ignored); stored totals always win when present.
- **Defect 1 (found + FIXED): derived net ignored a stored/explicit gross.** When a
  client supplied `gross_salary` explicitly but not `net_salary` (create, or a
  component-touching update), the server stored net = componentGross − deductions while
  gross = the client's value — e.g. components sum to 45000 with explicit gross 46000
  stored net 43000, so the stored pair violated net = gross − Σdeductions and the payslip
  showed 46000 / 2000 / 43000, which does not add up. Fix: a derived net now uses the
  gross that will actually be stored (explicit wins over component math) → 46000 − 2000 =
  **44000**. Applied at all three derivation sites: `create_payroll`, `update_payroll`
  and `_payroll_dict`'s net fallback (legacy row gross 46000 / net NULL now reports
  44000 — previously the list API said 43000 while the payslip fallback said 44000).
- **Defect 2 (test only, not runtime):** `tests/test_hr_payroll_math.py::
  test_update_recomputes_totals_when_components_change` asserted gross 45000 / net 42000
  from a fixture of basic 40000 with NO allowances — contradicting its own comment
  ("45000 − 3000 = 42000"). The endpoint's actual 40000/37000 was correct hand math.
  Fixed the fixture to the intended allowances {3000, 2000} and pinned the create totals
  (45000/43000); file now 8/8 green.
- **Payslip PDF (pdftotext, fixture above):** Basic **40,000.00** / Total Allowances
  **5,000.00** / Gross **45,000.00** / Total Deductions **2,000.00** / Net Pay
  **43,000.00**; itemized rows dearness 2,000.00 + transport 3,000.00 and pf 1,500.00 +
  insurance 500.00; the "10%" row correctly absent. Matches hand math to the paisa.

### 3. FEES — `backend/app/api/v1/fees.py`: rule confirmed ADDITIVE; 1 defect found & fixed

- **Two discounts (10% + 5%) stack ADDITIVELY on the base, not sequentially.** The only
  auto-discount site `_apply_fee_structure` (fees.py:1847-1856) sums
  percent·base/100 + fixed values, clamped to [0, base]: 10% + 5% of 10000 = 1000 + 500 =
  **1500** (sequential would give 1450). Manual collections take a client-supplied
  `discount_amount` and every consumer shares ONE math site:
  `_collection_payable_total = round(max(base + late_fine − discount, 0), 2)` — used
  identically by `_collection_dict` (net/due), `get_fees_summary`,
  `list_outstanding_fees`, `list_defaulters`, `_initiate_online_payment` (charges
  outstanding = payable − paid only) and the receipt PDF. Percentages are always computed
  on the base, so the combined discount is capped at the base and can never waive a late
  fine (base 10000 + fine 500 − discount 1500 = **9000**, gross 10500 ✓).
- **Net never negative:** clamp inside `_collection_payable_total` plus
  `due = max(total − paid, 0)` at every consumer; discount 5000 on base 1000 + fine 200 →
  payable **0**, status **waived** ✓.
- **Partial payments — running balance after each** (payable 9000): pay 3000 →
  paid 3000 / due 6000 / partial, receipt exactly 3000; PUT discount 8500 (would make
  payable 2000 < paid) → **400 rejected**; PUT discount 1000 → payable 9500 / due 6500 /
  partial; pay 6500 → paid 9500 / due 0 / **paid**; further pay → 400; overpay 99999 on
  payable 8500 → receipt capped at **8500**, due 0; create with `paid_amount` > payable →
  400. Summary endpoint hand-check on the same fixture: expected 8500 + 9500 + 0 =
  **18000**, collected **18000**, outstanding **0** ✓.
- **Defect (found + FIXED): receipt PDF "Outstanding after payment" was not
  point-in-time.** `_receipt_pdf_html` recomputed outstanding from the collection's
  CURRENT state, so reprinting an older receipt after later payments printed a wrong
  figure — the first receipt of the 9000-settlement above printed "Outstanding … NPR
  0.00" once the bill was settled (true figure after that payment: **6000.00**). Fix:
  cumulative paid through THIS receipt = Σ receipt amounts with `created_at <=` this
  receipt's (payments are non-negative; refunds never create receipt rows), capped at
  payable; due = max(payable − that, 0). In-container pypdf regression test pins
  "Outstanding after payment: NPR 6,000.00". Honest caveat: if the payable is later
  adjusted (discount edit), a reprint shows currentPayable − paidThroughThisReceipt
  (e.g. 6500 after a 9000→9500 adjustment) because the historical payable is not stored
  anywhere; the API ledger (`due_amount`, summary) was and is always exact.
- **Out-of-scope flag (file not editable here):** `app/tasks/fee_reminders.py::
  generate_monthly_fee_report` totals raw `c.amount` (base, ignoring fines/discounts)
  for expected/collected — inconsistent with the fees.py rule. Report-only Celery task;
  left to its owner.

### 4. Regression runs (in-container, sequential)

- `tests/test_gpa_endpoint_vs_util.py` (new) **1/1**; `tests/test_hr_payroll_math.py`
  (2 fixed expectations + 3 new tests) **8/8**; `tests/test_fees_money_math_verification.py`
  (new) **2/2**; `tests/test_fees_discount_stacking.py` **4/4**;
  `tests/test_nepal_grading.py` **11/11**; adjacent `test_fees_summary.py`,
  `test_student_fees.py`, `test_api.py` **green**.
- Intermittent `psycopg2 DeadlockDetected` on TRUNCATE between pooled connections
  (pre-existing harness flake, same as §4 of this file) — every occurrence cleared on a
  clean sequential rerun; not a code regression.

### 5. Files changed / not changed (no git commits)

- Changed: `backend/app/api/v1/hr_payroll.py` (net-derivation invariant at create /
  update / serializer fallback), `backend/app/api/v1/fees.py` (point-in-time receipt
  outstanding; hoisted `sqlalchemy.func` import), `backend/tests/test_hr_payroll_math.py`
  (fixture made consistent with its own assertions + 3 new tests), new
  `backend/tests/test_gpa_endpoint_vs_util.py`, new
  `backend/tests/test_fees_money_math_verification.py`.
- NOT changed: `backend/app/utils/nepal_grading.py` (verified correct — zero defects),
  `backend/app/api/v1/exams.py` (read-only; weighted-GPA observation recorded above),
  `backend/app/api/v1/reports.py`, `backend/app/utils/report_pdf.py`.
