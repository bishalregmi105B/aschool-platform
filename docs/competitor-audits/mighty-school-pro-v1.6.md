# Competitor Audit: Mighty School Pro v1.6 (Codecanyon 57385565, FueDevs LTD)

- **Audited**: 2026-09-11
- **Source**: `Other Projects/Mighty School Pro v1.6/.../codecanyon-57385565-mighty-school-pro-school-management-system-erp-multibranch-saas-all-in-one/` — three deliverables:
  - `install-api-code-v1.6_x/` — Laravel 11 API + web installer (the canonical backend)
  - `updated-api-code-v1.6_x/` — patched shared `app/` kernel (1,470 files: Traits, Jobs, Mail, Helpers, Enums)
  - `web-app-desktop-code-v1.6_x/web-app-desktop-code-v1.6/` — Flutter app ("web + desktop", also Android/iOS)
  - A second local copy exists at `/home/bishal-regmi/Desktop/ASchool/Mighty School Pro v1.6` (identical; skimmed, no extra info). Note: the bundled "Online Documentation (Updated).html" is a redirect page to a nulled-script site — provenance is unofficial, but the code is complete and self-consistent.
- **Purpose**: deep audit against **ASchool** (Nepal-focused multi-tenant school SaaS: Flask ~756 endpoints, pgvector, Celery, 50 plugins, Next.js 216-page manifest-driven dashboard, 5 Flutter apps, iEMIS / BS dates / SEE-NEB / eSewa / Khalti / Sparrow).
- **Headline**: marketing says "Multibranch SaaS All-in-One". The SaaS layer is quota middleware + manual renewals with a broken trial-provisioning bug; a "branch" is a name column on a table; the multi-tenant story is two integer columns and hand-written `where()` clauses with zero global scopes. Meanwhile the accounting + payroll + fees depth is genuinely strong, and the entire UI is a single Flutter codebase — not Next.js, not Blade.

---

## Deep re-audit (v2) — implementation-level (2026-09-12)

- **v2 status**: covered Accounting GL (schema, all 5 voucher types line-by-line, opening balances, all 11 reports), Payroll→GL + advance/due/return lifecycle, Fees engine (heads→map→amount/date config→collections→waivers→3 fine types→quick collection→reports), Exam→result engine (configs, mark input, GPA, grand-final), QuestionBank 15-taxonomy + quiz delivery, route census re-verified (19 modules), Flutter structure (api_client headers, feature layout), security re-verification at line level + 14 new V2 findings, accounting mini-design for plugin A-23; remaining: line-by-line reading of all remaining controller bodies (Academic/Elearning/Frontend/Parent/Hostel CRUD verified only at route+model level), Flutter screen-widget internals, Gateways webhook handlers per gateway.

Path abbreviations used below (all relative to the repo root `/home/bishal-regmi/Desktop/ASchool/`):
- **MSP-API** = `Other Projects/Mighty School Pro v1.6/Mighty School Pro v1.6/codecanyon-57385565-mighty-school-pro-school-management-system-erp-multibranch-saas-all-in-one/install-api-code-v1.6_x`
- **MSP-UPD** = same root `/updated-api-code-v1.6_x`
- **MSP-FL** = same root `/web-app-desktop-code-v1.6_x/web-app-desktop-code-v1.6`

### V2.1 Route coverage — implementation notes beyond the v1 census

Counts re-verified per module (`grep -c "Route::" MSP-API/Modules/*/routes/api.php`): Academic 65, Student 49, Authentication 47, Elearning 39, Frontend 32, Finance 31, Accounting 31, ParentModule 28, QuestionBank 23, Examination 21, Payroll 21, Teacher 17, SystemConfiguration 10, Hostel 10, SMS 9, Gateways 8 (+55 web), Library 7 (+23 web), Transport 6, LayoutCert 2. Validation/side-effect notes per group:

| Route group (module) | Controller@method | Validation | Tables | Side effects / notes |
|---|---|---|---|---|
| `account-transactions` (Accounting) | `APIAccountManagementController::accountTransaction` | FormRequest: only payment_method_id/fund_id/date/type required; **no validation of ledger_ids/amounts arrays** (`MSP-API/Modules/Accounting/app/Http/Requests/AccountTransactionCreateRequest.php:23-33`) | account_transactions + account_transaction_details + ledger/fund balance mutation | 1 journal line per target ledger; cash ledger gets NO journal line (balance mutated only); insufficient-balance check only for `payment` (controller line 60) |
| `account-contra-transfer` | `accountContraTransfer` | none (manual intval/floatval) | 2 detail lines | `category_id` stores a **ledger id** (line 180), `fund_id` hardcoded `1` (line 181), voucher = random 16-digit w/o uniqueness (line 179) |
| `account-journal-transfer` | `accountJournalTransfer` | none | 1 cash line + N lines | debit/credit columns **inverted** vs contra path (lines 290/313 vs 205/223); balance updates both ledger + fund (lines 295-296, 343-344) |
| `account-fund-transfer` | `accountFundTransfer` | none | 2 detail lines | both lines post to **hardcoded `ledger_id = 1`** (lines 414, 431); `category_id = 1` (line 395) |
| `salary-payment-create` (Payroll) | `PayslipSalaryService::processSalaryPayment` | none at route (raw arrays user_id/payable/paid_amount) | payslip_salaries, user_payrolls, payments + GL 1-line voucher | due→advance overflow math lines 65-72; GL via `prepareForAccTransAndDetails` (trait) |
| `advance/due/return-salary-payment` (Payroll) | `PaymentService::processPayment` | `dueSalaryPay` validates; `advanceSalaryPay`/`returnSalaryPay` **do not** (controller `MSP-API/Modules/Payroll/app/Http/Controllers/API/PayrollController.php:281-289, 364-372`) | payments, user_payrolls + GL | user_payroll.current_advance / current_due arithmetic (PaymentService lines 80-107) |
| `quick-collection` (Finance) | `APIQuickCollectionController::store` → `StudentCollectionTrait::createCollectionApi` | `StudentCollectionCreateRequest` (arrays of fee_heads) | student_collections / _details / _details_sub_heads + attendance_fines + GL receipt | **DB transaction commented out** (trait lines 498-499, 713-719); FIFO sub-head split (lines 589-618); TC collection auto-disables the student (lines 694-711); SMS notification inline (controller lines 90-138) |
| `exam-assign-store`, `general-exam-store`, `grand-final-exam-store`, `mark-store-section-wise`, `exam-results` (Examination) | `ExamMarkInputController` (details in V2.5) | validates class/group/subject/exam ids; marks numeric min 0 | class_exams, mark_config_exam_codes, mark_configs, grand_final_class_exams, exam_marks | examResult query **not school-scoped** (V2-09) |
| `quizzes` / `quiz-test` (QuestionBank) | `QuizController`, `QuizTestController`, `QuizAttemptController` (details in V2.6) | quiz_id/attempt_id/answers | quizzes, quiz_attempts, quiz_results, quiz_topics | attemptsAllowed + timer enforcement; `is_passed` write silently dropped (V2-12) |
| `sms-send` (SMS) | `SmsController::send` | basic | sms_logs, phone_books | balance deducted via SmsPurchase rows; 14 gateways in `MSP-UPD/app/Traits/SmsGatewayForMessage.php` |
| `digital-payment` (Gateways API) | `PaymentController::payment` | payment_method/type/amount/currency/phone required | payment_requests | builds redirect URL per gateway (`generatePaymentUrl`, lines 143-164); **`success_hook`/`failure_hook` taken from the request** and later `call_user_func`-ed by web controllers (`MSP-API/Modules/Gateways/app/Http/Controllers/WEB/StripePaymentController.php:100-108`) — see V2-14 |

Flutter-side conventions (verified): `MSP-FL/lib/api_handle/api_client.dart:36-44` sends `Authorization: Bearer`, `X-Domain` (tenant host), `Accept`, `Content-Type: application/json`, `Access-Control-Allow-Origin: *` on every call; token logged in debug mode (line 27). Feature folders at `MSP-FL/lib/feature/` (46 dirs; accounting feature is `account_management`, exam is `exam_management`, payroll is `hrm`+`payroll_management`). Per-sub-feature layout is a triad but **inconsistently named**: `fees_management/fees_head/{controller,domain,presentation}` (uses `controller/`, not `logic/` as v1 stated — mixed convention across features). `route_helper.dart` registers 197 `customPage(...)` routes; menu gating keys = Spatie permission names via `profileController.hasPermission(...)` in `MSP-FL/lib/feature/sidebar/controller/side_menu_bar_controller.dart` (cosmetic only — API enforces separately).

### V2.2 Trace A — Double-entry accounting (deepest gap; blueprint for plugin A-23)

**Schema** (`MSP-API/Modules/Accounting/database/migrations/`):
- `accounting_categories`: id, institute_id, branch_id, name, code, type, nature; unique(institute,branch,name). Seeded 7 categories: Cash & Cash Equivalence / Current Liabilities / Non-Current Liabilities / Owner's Equity / Fees Related Income / Others Income / General Expenses (`database/seeders/AccountingCategoryTableSeeder.php`).
- `accounting_groups`: accounting_category_id nullable + name; 24 seeded groups (Cash, Digital Payment, Accounts Payable, Long Term Loan, Opening Balance Equity, Income From Fees, Income From Fine, … Payroll Expenses).
- `accounting_ledgers`: ledger_name, category_id, group_id, **`balance decimal(10,2)` stored column**, `type enum('payment','default')`; ~50 seeded ledgers incl. per-fee-head collection ledgers ("Tuition Fees Collection" seeded balance 27000, "Admission Fees Collection" 75000) and 11 fine ledgers.
- `accounting_funds`: serial, name, **cash_in, cash_out, balance** stored; 1 seeded "General Fund" (balance 102000).
- `account_transactions`: voucher_id (int, random), category_id, fund_id, fund_to_id, payment_method_id, payment_method_to_id, transaction_date, **type enum('payment','receipt','contra','fund_transfer','journal')**, reference, description, created_by.
- `account_transaction_details`: account_transactions_id, ledger_id, fund_id, fund_to_id, payment_method_id(+_to), transaction_date, **debit, credit** (both decimal, default 0). No CHECK constraints, no balanced-entry enforcement anywhere.

All CoA seeders are hardcoded `institute_id=1, branch_id=1` — **new tenants get no chart of accounts at all** (V2-08).

**Exact posting rules** (`MSP-API/Modules/Accounting/app/Http/Controllers/API/APIAccountManagementController.php`):

| Voucher | Endpoint | Journal lines written | Balance mutations (stored columns) |
|---|---|---|---|
| Payment (`accountTransaction` type=payment) | lines 51-163 | **One** detail line per target ledger: `debit = amount, credit = 0` (lines 88, 97-98). The cash/bank ("payment method") ledger gets **no journal line**. | payment-method ledger.balance **-** amount (105-107); target ledger.balance **-** amount (110-115) — i.e. *debits decrease every ledger balance regardless of nature*; fund.balance **-** amount (117-122). Insufficient-balance check vs payment-method ledger only (line 60). |
| Receipt (type=receipt) | same method | Same single line per ledger but `credit = amount` (line 89). | payment-method ledger.balance **+** (127-131); target ledger.balance **+** (140-145); fund.balance **+** (133-138). |
| Contra (`accountContraTransfer`, lines 165-242) | — | Two lines: from-ledger `debit = amount` (line 205), to-ledger `credit = amount` (line 223). Proper 2-line entry (only voucher type that is). | from.balance **-**, to.balance **+** (193-197, 210-215). Bug: `category_id` = from **ledger** id (line 180), `fund_id = 1` hardcoded (line 181). |
| Journal (`accountJournalTransfer`, lines 244-380) | — | Two modes. Cash-credit mode (cash out): cash line gets `debit = sum(other debits)` (line 290) and each other line gets `credit = its debit amount` (line 313 — variable named `$debit` written into the **credit** column). Cash-debit mode: cash line `credit = sum(credits)` (line 338), others `debit = credit` (line 362). **The debit/credit columns are inverted relative to the contra path.** | cash ledger.balance ∓, fund.balance ∓ (295-296, 343-344); other ledgers.balance ± (304-305, 353-354). Balance check vs cash ledger + fund (268). |
| Fund transfer (`accountFundTransfer`, lines 382-453) | — | Two lines, **both on hardcoded `ledger_id = 1`** (lines 414, 431), one with fund_id=fund_from, one with fund_id=fund_to; `category_id = 1` hardcoded (line 395). | fund_from.balance **-**, fund_to.balance **+** (407-411, 424-429). No ledger balance change. |

Voucher ids: `generateVoucherId()` (`MSP-UPD/app/Traits/AccountingCalculationTrait.php`) retries `mt_rand(1000000000000000, 9999999999999999)` until unique — but contra/journal/fund-transfer/service paths use unchecked `sprintf('%016d', rand(...))` (controller lines 179, 275, 323, 394; `AccountTransactionService.php` line 71). 16-digit ints risk precision loss in JS clients.

**Opening balances**: there is no opening-balance transaction UI. `getAccountingOpeningBalance($date)` (`AccountingCalculationTrait.php`) computes it as `SUM(debit - credit)` over **all details from hardcoded `'2023-01-01'` to $date** — a hardcoded epoch, not a fiscal-year start, and it sums across all natures as one scalar. Meanwhile ledger rows carry seeded balances (75000/27000/102000) that double as de-facto opening balances. **Two competing balance models coexist**: (1) stored `accounting_ledgers.balance` / `accounting_funds.balance` mutated by the voucher controllers, (2) computed SUM over journal lines. They diverge immediately: the trait's `createAccountTransactionDetail` has its balance-mutation code **commented out** (lines ~96-117), so anything posted via `createAccountingTransaction` (fee collections, payroll) updates stored balances via separate ad-hoc `increment()` calls or not at all.

**Fee→GL sync** (`StudentCollectionTrait::syncAccountingTransaction`, `MSP-UPD/app/Traits/StudentCollectionTrait.php:785-866`): per collection detail, creates ONE voucher of type `receipt` with ONE detail line on the fee-head's ledger (`debit: 0, credit: total_paid`, lines 813-824); `voucher_id = invoice_id` (a `YYYYMM####` string forced into the int voucher_id column, line 805); then `increment('balance')` on the receive ledger (or fallback `AccountingLedger::where('ledger_name','Cash')->where('id',1)`, lines 832-842) and on the fund (fallback id 1, lines 844-855). Cash side never gets a journal line. Same single-line pattern for payroll (V2.3).

**The 11 reports** (`MSP-API/Modules/Accounting/app/Http/Controllers/API/AccountReportController.php`):

| Report | Method/lines | Computation |
|---|---|---|
| balance-sheet | `getBalanceSheet` 16-38 | `SELECT ledger_id, ledger_name, SUM(debit), SUM(credit) FROM account_transaction_details JOIN accounting_ledgers WHERE institute/branch + date-between GROUP BY ledger` — no asset/liability classification, no nature sign, no opening equity. **Identical query to trial balance** (50-72). |
| balance-sheet-details / trial-balance-details | 40-48 | `AccountTransactionDetail::where('ledger_id', $request->ledger_id)` — **no institute scoping** (V2-07). |
| income-statement | `getIncomeStatement` 346-390 | Same grouped SUM, then **income = ledgers where credit>0 AND debit==0; expense = debit>0 AND credit==0** (lines 374-380) — any two-sided ledger vanishes from both. |
| income-statement-details | 392-404 | Detail rows per ledger (scoped). |
| trial-balance | 50-72 | Same grouped SUM as balance sheet. |
| cash-flow-statement | 74-139 | Monthly `SUM(debit)`, `SUM(credit)` on all vouchers of the year — no operating/investing/financing split. |
| cash-flow-statement-monthly | 187-247 | Same, per-day for a month. |
| cash-flow-details | 319-344 | Detail rows with fund/fundTo/ledger/paymentMethod relations for a month. |
| cash-book-account | 249-284 | Raw transaction+detail rows joined to payment_methods and ledgers, date-ranged, scoped. |
| ledger-book-account | 286-317 | Same filtered by one `ledger_id` (scoped via account_transactions columns). |
| voucher-wise / journal-wise | 544-569 / 571-592 | Transactions (optionally by type) joined to details+ledgers. |
| user-wise | 443-462 | Same but `created_by = Auth::id()` — "user-wise" means *my own* vouchers only. |
| fund-wise / fund-summary(-monthly) | 484-542 | Transactions joined to funds. |
| cash-summary | 406-441 | Like income-statement but filters on **`created_at`** not `transaction_date` (line 422). |
| get-monthly-fee-collections | 141-185 | Joins `student_collections`+`student_collection_details`, monthly SUM(total_paid)/SUM(total_due) — the only report that bridges fees and accounting (and it bypasses the GL). |

Classification by account nature never happens server-side; the Flutter screens map ledger→category→type client-side.

**Mini-design for ASchool `accounting` plugin (A-23)** — adopt the shape, fix the defects:
1. Tables: `accounting_categories(school_id, branch_id, name, code, type ∈ {asset,liability,equity,income,expense}, nature ∈ {debit,credit})`; `accounting_groups(category_id, name)`; `accounting_ledgers(name, category_id, group_id, is_cash, is_bank)` — **no stored balance column**; `accounting_funds(name, serial)` (fund = analytical tag, not a balance holder); `accounting_vouchers(school_id, branch_id, voucher_no UNIQUE(school_id, voucher_no), voucher_type ∈ {journal,receipt,payment,contra,fund_transfer}, txn_date, fund_id, fund_to_id, payment_method_ledger_id, reference, description, source ∈ {manual,fees,payroll,inventory,sms}, source_ref_id, created_by)`; `accounting_voucher_lines(voucher_id, ledger_id, debit, credit, fund_id, CHECK (debit>=0 AND credit>=0 AND debit*credit=0))`.
2. Posting rules (fix MSP's core flaw — two-sided entries): receipt = Dr cash/bank ledger, Cr fee-head-mapped income ledger (from a `fee_head_map(fee_head_id, ledger_id)` table — MSP's `fee_maps.ledger_id` is the right idea, `MSP-API/Modules/Finance/database/migrations/2023_11_07_133106_create_fee_maps_table.php`); payment = Dr expense ledger, Cr cash/bank; contra = Dr bank, Cr cash (or reverse); journal = arbitrary but must balance; fund_transfer = two lines on the SAME cash ledger differing by fund_id/fund_to_id (never a hardcoded ledger).
3. Enforce `SUM(debit) = SUM(credit)` per voucher in a service layer + DB constraint view; reject unbalanced posts. MSP never checks this.
4. Balances: `balance(ledger, date) = SUM(debit) - SUM(credit)` (signed) × nature direction, computed in SQL; cache in a materialized/summary table keyed (ledger_id, month) if needed. Never mutate a balance column inside CRUD paths (MSP's dual-model divergence is the cautionary tale).
5. Opening balances: one dated journal per ledger against an "Opening Balance Equity" ledger at fiscal-year start (Nepali FY 208x/07/01) — replaces MSP's hardcoded 2023-01-01 sum.
6. Report SQL shape (all 11 reports reduce to variants): `SELECT l.id, l.name, c.type, c.nature, SUM(d.debit) deb, SUM(d.credit) cr FROM accounting_voucher_lines d JOIN accounting_vouchers v ON v.id=d.voucher_id JOIN accounting_ledgers l … JOIN accounting_categories c … WHERE v.school_id=:s AND v.branch_id=:b AND v.txn_date BETWEEN :from AND :to GROUP BY l.id, c.type, c.nature` — then classify server-side: trial balance (net by nature), income statement (income/expense for period), balance sheet (asset/liability/equity + period net income into retained earnings), cash flow (vouchers where either line's ledger is cash/bank), fund summary (group by fund_id). Seed the same 7-category/24-group skeleton (it is genuinely a good school CoA) with fees-ledger auto-provisioning per fee head.
7. Multi-tenant: every query `school_id`-scoped (MSP's report detail endpoints forgot this — V2-07).

### V2.3 Trace B — Payroll → GL posting + advance-salary lifecycle

**Model chain** (`MSP-API/Modules/Payroll/app/Models/`): `SalaryHead{name, type ∈ Addition|Deduction}` → `SalaryHeadUserPayroll{user_payroll_id, salary_head_id, amount}` (per-staff config) → `UserPayroll{user_id, net_salary, current_due, current_advance}` (net = Σ additions − Σ deductions, recomputed on head removal, `PayrollController::removeSalaryHead` lines 151-163) → monthly `PayslipSalary{user_id, year, month, paid_amount, is_paid, payment_date}` + head snapshot `PayslipSalaryHead{user_payroll_id, salary_head_id, amount}` → `Payment{user_id, year, month, amount, type ∈ salary|advanced|due|advanced_return, payment_method_id, paid_by}`. GL bridge: `PayrollAccountingMapping{institute_id, branch_id, ledger_id, fund_id}` — a **single row** (`mappingStore` does `PayrollAccountingMapping::first()` then updates it, `PayrollController.php:384-411` — no institute scoping, V2-06).

**Flow**: `staff-salary-config` (assign heads per staff) → `salary-create-store` (`UserPayrollService::createPayslipSalariesAndHeadsAPI` snapshots heads per user/month) → `salary-payment-process` (preview: `payable = net_salary + current_due − current_advance`, `PayrollController.php:209-214`) → `salary-payment-create` (`PayslipSalaryService::processSalaryPayment`):
- per user: `paid_amount` saved, `is_paid = paid > 0`; `dueAmount = payable − paid`; if >0 → `current_due = dueAmount, current_advance = 0`, else `current_advance = abs(dueAmount)` (lines 65-72).
- GL: salary payment posts `prepareForAccTransAndDetails(data, 'debit')` (type `payment`); shortfall posts `(data, 'credit')` (type receipt). Lines 56, 85, 102.

**GL posting shape** (`AccountTransactionService::prepareForAccTransAndDetails`, `MSP-API/Modules/Accounting/Services/AccountTransactionService.php:63-79`): `PayrollAccountingMapping::first()` (unscoped!) → ONE `account_transactions` row (type payment/receipt, `category_id = 1` hardcoded, **`fund_to_id = user_id`** — a user id stored in a fund column) + ONE detail line on the mapped ledger with the amount in debit OR credit. No cash-side line, no ledger/fund balance update (those lines are commented out in the trait). So "payroll posts into the GL" = a one-sided memo row.

**Advance/due/return** (`PaymentService::processPayment`, lines 56-124; GL at `handlePayment` lines 144-151):
- `advanced` (pay staff in advance): `current_advance += amount`; GL type `payment`/`debit` (cash out).
- `due` (recover advance from pay): if `amount >= current_due` → overflow `current_advance += (amount − current_due)`, `current_due = 0`; else `current_due -= amount`; GL type `receipt`/`credit` (cash in).
- `advanced_return` (staff repays advance): `current_advance -= amount`, overflow adds to `current_due`; GL `receipt`/`credit`.
- **Validation gap**: `advanceSalaryPay` and `returnSalaryPay` pass the raw request to `processPayment` with no FormRequest validation (`PayrollController.php:281-289, 364-372`) — negative amounts are not blocked there (`dueSalaryPay` at least validates `min:1`).

**Payslip structure**: `PayslipInvoice{invoice_id, payslip_salary_id}` + `payslip_invoice/{id}` print route; payslip PDF = invoice_id + per-head PayslipSalaryHead amounts + paid/due/advance summary.

### V2.4 Trace C — Fees engine

**Config chain** (`MSP-API/Modules/Finance/`): `FeeHead{name}` → `FeeSubHead{fee_head_id, name}` (installments/mois) → `FeeMap{fee_head_id, ledger_id, fund, type ∈ fee|fee_fine}` + `fee_map_fee_sub_head` + `fee_map_fund` (attaches heads to classes and GL ledgers) → `fees` (amount config; one row per class×section×session×student_category×fee_head with `fee_amount`, `fine_amount`, `fund_id`) → `fee_date_configs{fee_sub_head_id, payable_date_start, payable_date_end}` (installment window per sub-head, no class scoping).

**Collection math** (`MSP-UPD/app/Traits/StudentCollectionTrait.php::getCollectionAmountsByFeeHeadAndSubHeads`, lines 53-183):
- fee row looked up by (class, section, session, student_category, fee_head) — 5-dimensional pricing incl. student-category differential.
- `feePayable = fee_amount × selected_sub_head_count` (line 123) — each sub-head is priced at the full head amount.
- `waiver = StudentWaiverConfig{student_id, fee_head_id, waiver_id, amount}.amount × subHeadCount` (126-132).
- fine: per selected sub-head, if `now > fee_date_configs.payable_date_end` → `+= fee.fine_amount` (flat once, **not per-day**) (138-144).
- `grossPayable = feePayable + fines`; `previousPaid = Σ sub-head paid_amount`; `netPayable = max(0, grossPayable − previousPaid − waiver)` (147-160). `total_paid` is UI-suggested = netPayable.

**Collections**: `createCollectionApi` (lines 494-720) writes `student_collections` (invoice `YYYYMM####` via **unscoped** LIKE query → global sequence + race, lines 29-51; header totals incl. tc_amount + 3 fine columns; `ledger_id` = first tenant ledger, `receive_ledger_id` from frontend) → `student_collection_details` per fee head (payable/paid/waiver/fine splits, `fee_and_fine_paid = total_paid − waiver`) → `student_collection_details_sub_heads` with **FIFO allocation** of `total_paid` across sub-heads after subtracting previous paid (lines 589-637). Attendance/quiz/lab fine payments persist `attendance_fines{student_id, fine_amount, type ∈ attendance_absent_fine|attendance_quiz_fine|attendance_lab_fine}` (lines 658-687). Paying `tc_amount == settings.tc_amount` **auto-disables the student** (`status='0'`, lines 694-711). Then `syncAccountingTransaction` (V2.2). **The API path's DB transaction is commented out** (lines 498-499, 713-719) — a mid-loop failure leaves orphaned headers.

**Waivers**: `Waiver{name}` (catalog) → `StudentWaiverConfig{student_id, fee_head_id nullable, waiver_id, amount}` (per-student per-head flat amount) + `AttendanceWaiver{student_id, attendance_fine, quiz_fine, lab_fine, total_waiver}` (fine-specific waivers).

**Fines math** (`MSP-API/Modules/Finance/app/Http/Controllers/API/APIQuickCollectionController.php`):
- attendance (267-313): `absent_count(period_id=1, year) × absent_fines.fee_amount(class, period) − Σ already-paid attendance_fines(type) − attendance_waivers.attendance_fine` (line 307). Quiz/lab identical with `period_id=2/3` — "quiz" and "lab" fines are just extra attendance periods, not quiz-app events.
- TC amount from settings (`getTcAmount`, 384-392).

**Quick/bulk collection**: `index` lists a class-section roster (35-80); `search` finds student by roll; `show` (146-222) returns per-head remaining sub-heads (hides fully paid ones, 187-213) + cash ledgers (category_id=1) for the receive ledger picker; `getCollectionAmounts` (232-253) recomputes per head/sub-head server-side; `student-collection-sub-head-wise-calculation`; invoice endpoint for print. `getUnpaidReports` (424-525) loops students in PHP (N+1 per student×head×sub-head) and reports heads with any unpaid sub-head.

**Reports** (`FeeManagementReportController.php`): paid-reports (collections with details), unpaid-summery, monthly-paid-info, class-wise-payment-summary, payment-ratio-info, head-wise-payment, head-wise-due (sub-head-wise), payment-fee-info, paid-invoice. All aggregate over `student_collections(_details)` — fees and the GL are never reconciled except the one-way sync (V2.2).

### V2.5 Trace D — Exam → result engine

**Config chain** (`MSP-API/Modules/Examination/database/migrations/`):
- `exams` (Academic module) → `class_exams{class_id, exam_id, merit_process_type_id}` (`exam-assign-store` bulk-inserts new pairs, `ExamMarkInputController.php:505-553`).
- `short_codes{short_code_title, total_mark, accept_percent, pass_mark}` — reusable mark-scheme codes.
- `mark_config_exam_codes{subject_id, title, total_marks=100, pass_mark=33, acceptance=1.00, unique(title, subject_id)}` — per-subject named components (MCQ/Written/practical); `mark_configs{class_id, group_id, subject_id, exam_id, mark_config_exam_code_id}` — attaches components to class+group+subject+exam (`generalExamStore` triple-loop updateOrCreate, lines 122-199).
- `grades{grade_name, grade_point, grade_range, number_low/high, point_low/high, priority, session_id}`; `exam_grades` = per-class grade-set copy.
- `remark_configs{remark_title, remarks}`; `merit_process_types{type, serial, session_id}`.
- `grand_final_class_exams{class_id, exam_id, percentage, serial_no}` (`grandFinalExamStore` lines 201-233) — declares each exam's weight toward a grand-final result per class.
- `exam_marks{student_id, class_id, group_id, subject_id, exam_id, mark1..mark6 (fixed 6 columns), total_marks, grade_point, grade}`.

**Mark input** (`markStoreSectionWise`, lines 266-377): bulk per section; accepts `mark_1..mark_n` keys mapped onto mark1..mark6 columns; `totalMarks = Σ` then **hardcoded cap `total > 100` throws** (lines 320-324) regardless of the component `total_marks` config; grade assigned by `Grade::where number_low <= total <= number_high ->first()` — **no institute scoping on the Grade lookup** (lines 326-328, V2-10). `ExamMark::updateOrCreate` upserts per student×subject×exam.

**Result computation** (`examResult`, lines 379-503): load `StudentSession` by class (+section/group/search) with exam marks; per student: `gpa = round(Σ grade_point / subject_count, 2)`, final grade from `point_low <= gpa <= point_high`, `status = Fail` if any subject grade == 'F', summary pass/fail counts. **No merit ordering is computed anywhere** — `merit_process_types` only tags class-exam assignments; the Flutter UI sorts client-side. `grandFinalMarkPercentage/{class_id}` returns the weight rows; weighted aggregation happens client-side. The `examResult` query is **not institute/branch-scoped** (lines 390-397, V2-09).

**Result cards / admit cards / seat plans**: `ResultCard.php`, `ExamAttendance.php`, `ExamSchedule.php` (Academic module) + print routes in root `routes/web.php` + Flutter `exam_management` marksheet screens.

### V2.6 Trace E — Question bank 15-dimension taxonomy + quiz delivery

**Taxonomy** (`MSP-API/Modules/QuestionBank/database/migrations/`, `2025_04_20_*`): classes → groups (per class) → subjects (class+group+question_category) → chapters (subject, chapter_no) → topics (chapter); plus independent single-table dims: `question_bank_types{type_name, default_mark}`, `_levels{level_name}`, `_difficulty_levels`, `_sources{source_name}`, `_sub_sources`, `_tags`, `_sessions`, `_years`, `_boards`, `_tests`. Multi-valued dims attach via pivot tables `question_{test,type,level,topic,source,sub_source,tag,session}`; year is a JSON column `questions.question_year`. All taxonomy tables are **global** (no institute_id) — a shared bank across tenants; `questions.institute_id` is nullable. `questions` row: 3 question types only (`enum('true_false','multiple_choice','multiple_true_false')`), options as longText, `correct_answer` JSON, marks + negative_marks (+fixed|percentage), price, `language default 'bn'`, status draft default. Question create derives `question_category_id` from the subject and flattens years (`QuestionController.php:189-234`).

**Quiz** (`quizzes` migration): `question_ids` JSON (explicit selection) OR `quiz_topics{quiz_id, subject/chapter/category, question_limit}` random-pull; timing (`start/end_time`, `has_time_limit`, `time_limit_value` + unit, `on_expiry ∈ auto_submit|prevent_submit|grace_time`); grading (`marks_per_question`, `negative_marks_per_wrong_answer`, `pass_mark`, `enable_negative_marking`); `attempts_allowed` (null = unlimited); `result_visibility ∈ immediate|after_review|never`; layout (pages, shuffle questions/options); security (`access_type none|password|public`, `access_password`); type ∈ practice|mock|quick_test|exam.

**Delivery** (`QuizAttemptController.php`): `startQuiz` (24-86) enforces attempts (count of submitted) and resumes an unexpired `started` attempt; **expiry math ignores `time_limit_unit` — always `addMinutes(time_limit_value)`** (lines 58, 84). `quizDetails` (88-119) hides `correct_answer`/`explanation` unless visibility=after_review. `quizSubmit` (121-291): per question — `multiple_true_false` scored **per-option** (`marks_per_question / optionCount`, negative proportional, lines 189-209); other types sorted-array equality (220-229); result row written with correct/incorrect/skipped counts and **global re-ranking of every submitted attempt O(n) per submit** (257-267). Note: the `is_passed` key passed to `QuizAttempt::update()` is not fillable (`QuizAttempt::$fillable` lacks it) and not a column — silently dropped, dead code. `quizResults` (293-453) returns per-question option-level breakdown, highest score, position; blocks on `never` visibility until `end_time`. The "quiz fine" in Finance is unrelated (attendance period 2 absence, V2.4).

### V2.7 Comparison tables (competitor → ASchool)

**A. Accounting / GL**

| MSP behavior (file:line) | ASchool behavior (file:line) | Delta | Verdict |
|---|---|---|---|
| Full CoA (category→group→ledger) + funds + 5 voucher types (`MSP-API/Modules/Accounting/routes/api.php`) | No accounting plugin at all (`backend/app/plugins/modules/` has no `accounting/`; only fees/hr_payroll/inventory ledgers of record) | ASchool has no GL; fee income and salary expense never meet in one balance sheet | **Adopt** — build A-23 on the schema shape in V2.2 (7 categories / 24 groups seed is a good school CoA) |
| One-sided postings; cash side balance-mutated, never journalled (`APIAccountManagementController.php:88-146`) | n/a | MSP's "double entry" is 1-line for 3 of 5 voucher types | **Reject the mechanism**; enforce two-sided balanced entries in the plugin |
| Stored `ledgers.balance` mutated ad hoc + computed SUMs diverge (`AccountingCalculationTrait.php` commented-out mutations) | n/a | Two sources of truth | **Reject** — compute balances from lines (V2.2 item 4) |
| 11 reports = one GROUP-BY-SUM query re-labelled (`AccountReportController.php:16-72`) | n/a | No nature-aware classification anywhere | **Adapt** — same SQL skeleton, classify by `category.type/nature` server-side |
| Payroll→GL via single mapping row `PayrollAccountingMapping::first()` (`AccountTransactionService.php:64`) | `backend/app/api/v1/hr_payroll.py` posts nothing to any ledger | ASchool has no auto-posting; MSP has a broken one | **Adapt** — per-school mapping table keyed (source domain → ledger), school-scoped |

**B. Payroll**

| MSP | ASchool | Delta | Verdict |
|---|---|---|---|
| SalaryHead Addition/Deduction per staff; monthly payslip snapshot (`Modules/Payroll/Models/SalaryHead*.php, PayslipSalary*.php`) | `StaffPayroll{basic, allowances JSONB, deductions JSONB, net}` per month (`backend/app/models/hr_payroll.py:9-24`); component defaults from settings (`_components_from_settings`, hr_payroll.py:1263) | MSP has a reusable head catalog + per-staff overrides; ASchool's JSONB is simpler but no catalog/reuse | **Adapt** — add salary-head catalog if HR wants structured payslips; JSONB fine otherwise |
| advance/due/return-advance state machine on `user_payrolls.current_due/current_advance` (`PaymentService.php:80-107`) | No advance/due concept (`hr_payroll.py` has draft→approved→paid only) | Nepal salary-advance practice is real; MSP models it (with validation gaps) | **Adopt** (flow) with server-side validation ASchool already does elsewhere |
| GL posting 1-line memos (V2.3) | none | none-vs-broken | **Adapt** when A-23 exists: Dr salary ledger / Cr bank |
| No leave/appraisal/expense modules in Payroll module | `StaffLeave`, `StaffAppraisal`, `Expense{Category}` + 21 endpoints (`hr_payroll.py:637-1209`) | ASchool broader | ASchool wins |
| Payslip PDF invoice + statement report | `download_payslip` (hr_payroll.py:386) | parity | tie |

**C. Fees**

| MSP | ASchool | Delta | Verdict |
|---|---|---|---|
| Head→SubHead→ClassMap(+GL ledger)→amount config (class×section×session×category)→date windows per sub-head (`Modules/Finance/*` + trait) | `FeeType` + `FeeStructure{class, year, fee_items JSONB}` + `FeeCollection` per item (`backend/app/models/fee.py:21-92`) | MSP models installments as first-class sub-heads with due dates + per-sub-head paid tracking; ASchool's fee_items JSONB has no per-installment ledger of paid amounts | **Adopt** the sub-head/installment entity + `fee_date_configs` window + per-sub-head allocation (FIFO) |
| Waiver catalog + per-student per-head waiver + attendance-fine waivers (`StudentWaiverConfig`, `AttendanceWaiver`) | `discount_amount`, `is_scholarship` flags on collection (`fee.py:72-73`); scholarships endpoints (`fees.py:803-935`) | ASchool has scholarships at collection level; no per-head waiver config reusable across months | **Adapt** — add student×fee-head waiver config |
| 3 attendance-period fines w/ paid-offset math (`APIQuickCollectionController.php:267-382`) | `late_fine_amount` per collection only | MSP's absent/quiz/lab fine accrual doesn't exist in ASchool | **Adopt** concept (absent fine per period) — matches Nepali school practice; implement as a fees-plugin submodule |
| Quick collection bulk flow + TC auto-disable + unpaid reports (`APIQuickCollectionController.php`) | `batch-monthly` (`fees.py:751`), defaulters + remind (`fees.py:1126-1218`), refund (`fees.py:1906`) | ASchool has bulk generation + dunning + refunds that MSP lacks; MSP has in-loop collection + unpaid drill-down ASchool lacks | both — keep ours, add unpaid sub-head drill-down |
| BS/AD: AD only, USD | `month_bs`/`year_bs` on collections (`fee.py:51-52`), eSewa/Khalti/FonePay initiation (`PaymentInitiation`, `fee.py:155-182`; `backend/app/services/payments/`) | Nepal-native vs Dhaka/USD | ASchool wins |
| Receipt idempotency: invoice `YYYYMM####` unscoped race (`StudentCollectionTrait.php:29-51`) | `FeeReceipt.idempotency_key UNIQUE` + `verified_hash` (`fee.py:109, 111`) | ASchool strictly safer | ASchool wins |

**D. Exam → result**

| MSP | ASchool | Delta | Verdict |
|---|---|---|---|
| Per-subject mark components (MCQ/Written) w/ total/pass/acceptance + per class-group-exam attach (`mark_config_exam_codes`, `mark_configs`) | Single marks POST per exam+student (`backend/app/api/v1/exams.py:638`); no component model | SEE/NEB grading needs component-level (practical/theory) marks | **Adopt** — component configs are the right model for Nepal; note MSP's hardcoded 100-mark cap is the anti-pattern to avoid (`ExamMarkInputController.php:320-324`) |
| Grade ranges dual-keyed (marks and GPA points) + per-class exam_grades copy (`grades`, `exam_grades`) | `grade-table` endpoint (`exams.py:205`) + grade sheet | ASchool has SEE/NEB tables natively; MSP's is generic | keep ours; borrow per-class override idea if needed |
| Grand-final weighted exams (`grand_final_class_exams.percentage/serial_no`) | No cross-exam weighting (`exams.py` results are per exam) | Needed for annual GPA composition (Nepali schools weight terminals + finals) | **Adopt** |
| Merit process types (tag only, no math) | n/a | MSP's merit is a label | **Adapt** — implement merit ranking server-side properly |
| Result publish state, mark unlock, designer marksheet, bulk PDFs (`exams.py` — ASchool) | MSP: result cards + client-side print | ASchool has publish/unlock workflow + designer; MSP has admit/seat-plan/certificates | both; ASchool wins on workflow, MSP wins on document variety (already in v1 §4.4) |

**E. Question bank + quiz**

| MSP | ASchool | Delta | Verdict |
|---|---|---|---|
| 15 taxonomy dimensions incl. board/source/year/session (exam-paper provenance) (`Modules/QuestionBank/database/migrations/2025_04_20_*`) | `QuestionBankItem{subject, class, topic, difficulty, bloom_level, bilingual, composite stimulus, AI metadata, dedup hash}` (`backend/app/models/question_bank.py:16-58`) + `PaperBlueprint`/`GeneratedPaper` | Orthogonal strengths: MSP = exam-paper provenance taxonomy; ASchool = pedagogy + AI pipeline | **Adopt** board/year/source dims as a lightweight `question_provenance` JSONB or tags on QuestionBankItem for SEE/NEB past-paper mode |
| Quiz runtime: attempts, timer, negative marking per-option, result visibility, access password, shuffle, per-topic random pull (`QuizAttemptController.php`) | Online exam create/submit (`exams.py:291-457`) | MSP's runtime is far richer (attempts, visibility, access control) | **Adopt** attempt-limit + result-visibility + access-password flags into online exams |
| Quiz `startQuiz` timer ignores unit (line 58); global re-rank per submit (257-267) | n/a | bugs to avoid | **Reject** those mechanics |

**F. SMS**

| MSP | ASchool | Delta | Verdict |
|---|---|---|---|
| 9 endpoints: templates w/ short-codes, phone books + categories, prepaid balance purchase, sent report, bulk absent notify (`Modules/SMS/routes/api.php`; balance `Models/SmsBalance.php`, `SmsPurchase.php`) | 5 endpoints: send/history/templates/stats (`backend/app/api/v1/sms.py:15-149`), Sparrow (`sms_notifications` plugin) | No balance/quota accounting, no phone books, no template merge fields in ASchool | **Adopt**: prepaid balance ledger (maps neatly onto Sparrow's own prepaid model), phone books, `{{name}}`-style merge fields, auto-absent bulk send hook from attendance plugin |

**G. Flutter app structure (single app) vs ASchool (5 apps)**

| MSP | ASchool | Delta | Verdict |
|---|---|---|---|
| One codebase, 46 feature dirs, 197 routes; `api_client.dart:36-44` central headers incl. tenant `X-Domain`; menu = 1,000-line hardcoded builder gated by `hasPermission()` (`side_menu_bar_controller.dart`) | `flutter_admin/flutter_teacher/flutter_student/flutter_parent` + `aschool_shared`; manifest-driven Next.js sidebar; role-native shells | MSP proves single-app multi-role is shippable but pays in giant files, commented-out features (absent fine, return advance menus), `ResponsiveHelper` branching; ASchool's split scales better | **Adopt**: central header/interceptor + permission-key constants shared per feature (aschool_shared already does); **Reject**: single-app-for-all-roles |

### V2.8 V2 findings (new; each verified at file:line)

1. **V2-01 (HIGH, functional)**: `system:reset` runs `migrate:fresh --force` + `db:seed` **every minute** — confirmed at `MSP-API/app/Console/Kernel.php` (`$schedule->command('system:reset')->everyMinute();`; the `dailyAt('02:00')` variant is the commented one) and `app/Console/Commands/ResetSystemData.php:24,33` (also writes license marker `storage/mightySchool`, line 77).
2. **V2-02 (HIGH, IDOR→hijack)**: `BranchController::update` does `Branch::find($id)` then **overwrites `institute_id` with the caller's** (`BranchController.php:55-66`) — i.e. a tenant admin doesn't just rename another tenant's branch, they *steal it*; `destroy` (68-77) deletes unscoped.
3. **V2-03 (HIGH)**: `changeBranch` sets the auth user's `branch_id` to any id without ownership check (`UtilityController.php:34-49`); `backupDatabase` string-concats SQL with `addslashes` (line 78) writing `uploads/backup/DB-BACKUP-*.sql` (line 88); `dropDatabase` route exists (line 137).
4. **V2-04 (HIGH)**: trial provisioning hardcodes `'institute_id' => 1, 'plan_id' => 1` (`OnboardingsController.php:133-137`, comment "Create a subscription for institute_id = 1"); `$plan` is undefined there so `?? 30` silently defaults duration.
5. **V2-05 (HIGH, IDOR)**: `AccountReportController::getBalanceSheetDetails` fetches journal lines by bare `ledger_id` with no institute/branch scope (`AccountReportController.php:40-48`) — cross-tenant GL read.
6. **V2-06 (HIGH, cross-tenant write)**: `PayrollAccountingMapping::first()` in `AccountTransactionService::prepareForAccTransAndDetails` (line 64) and in `PayrollController::mappingStore` (line 386) — every tenant's payroll posts through, and every admin can reconfigure, the *first* mapping row in the table regardless of institute.
7. **V2-07 (HIGH)**: `APIAccountManagementController::getLedgerAccountBalance` (lines 23-34) and `cartOfAccounts` (36-49) have no institute/branch scoping — cross-tenant ledger balances and CoA enumeration.
8. **V2-08 (MEDIUM)**: all Accounting seeders hardcode `institute_id=1/branch_id=1` (`AccountingCategoryTableSeeder.php` etc.) — provisioned tenants start with an empty CoA; combined with V2-07 tenant 1's CoA leaks to everyone.
9. **V2-09 (HIGH, IDOR)**: `ExamMarkInputController::examResult` queries `StudentSession` by `class_id` only — no institute/branch filter (lines 390-397) — cross-tenant student results disclosure.
10. **V2-10 (MEDIUM)**: `markStoreSectionWise` grade lookup `Grade::where(number_low..number_high)->first()` unscoped (lines 326-328); and the total-marks cap is hardcoded 100 ignoring `mark_config_exam_codes.total_marks` (320-324).
11. **V2-11 (MEDIUM, integrity)**: `createCollectionApi` runs with `DB::beginTransaction/commit` commented out (`MSP-UPD/app/Traits/StudentCollectionTrait.php:498-499, 713-719`) — collection header/details/sub-heads/GL sync can half-commit; `generateCollectionInvoiceNo` is unscoped + race-prone (lines 29-51).
12. **V2-12 (LOW, dead code)**: `QuizAttempt::update(['is_passed' => …])` — attribute is neither a column (`create_quiz_attempts_table`) nor fillable — silently discarded; pass/fail lives only on `quiz_results`.
13. **V2-13 (LOW)**: `startQuiz` computes expiry as `addMinutes(time_limit_value)` ignoring `time_limit_unit` (`QuizAttemptController.php:58, 84`); `question-bank-tags` apiResource registered twice — first to `QuestionBankYearController` (`Modules/QuestionBank/routes/api.php` lines ~33 vs ~36), shadowing the tag controller.
14. **V2-14 (HIGH, unsafe dynamic call)**: gateway web controllers execute `call_user_func($data->success_hook, $data)` where `success_hook`/`failure_hook` are taken verbatim from the authenticated API request (`PaymentController::payment` line 121; invoked in `StripePaymentController.php:100-108`, same pattern across the 13 gateway controllers). Function-name injection into `call_user_func` behind `function_exists` — unsafe pattern even if one-arg exploitation is constrained.

---

## 0. Verdict in 10 bullets

1. **Architecture surprise**: there is *no* Blade admin panel and no Next.js. The entire UI — public marketing site, admin panel, student/parent portals — is **one Flutter (GetX) app** (1,858 dart files, 197 routes) deployed as web + Windows/macOS/Linux desktop + Android/iOS from a single codebase (`web-app-desktop-code-v1.6_x/.../lib/`). The Laravel side is a pure JSON API (19 nwidart modules, 456 API routes) plus payment-gateway host pages.
2. **The "multibranch SaaS" claim is thin**: a Branch is just `institute_id, name, status` (`Modules/Authentication/app/Models/Branch.php`). No branch settings beyond a branch-scoped `settings` table, no branch admins, no cross-branch consolidated reporting, no branch-scoped pages. "Changing branch" literally **overwrites the logged-in user's `branch_id` column** (`Modules/SystemConfiguration/app/Http/Controllers/API/UtilityController.php::changeBranch`) — one branch at a time.
3. **SaaS billing is manual and partially broken**: `Plan` = `student_limit, branch_limit, price, duration_days` (`Modules/Authentication/app/Models/Plan.php`); renewal = super-admin records a payment by hand (`OnboardingsController::upgrade`); tenant upgrade-request queue exists. The trial created on tenant approval is **hardcoded to `institute_id => 1`** (`OnboardingsController.php` ~line 139), so newly approved tenants get no subscription and `CheckSubscription` would 403 them.
4. **Dangerous leftovers**: `app/Console/Kernel.php` schedules `system:reset` **every minute**, and that command runs `migrate:fresh` + reseed on the production DB (`app/Console/Commands/ResetSystemData.php`). Also: IDOR in `BranchController::update/destroy`, `changeBranch` without ownership validation, a SQL backup endpoint using `addslashes` writing into `uploads/`, `demo.sql` shipped in the web root, and the ChatGPT API key hardcoded in Flutter source.
5. **Where it is genuinely strong**: **double-entry accounting** (chart of accounts, groups, categories, ledgers, journal/receipt/payment/contra/fund-transfer, funds; full statements — `Modules/Accounting/`, 31 API routes), **payroll with accounting integration** (`Modules/Payroll/Models/PayrollAccountingMapping.php`), and a **fees engine** (heads/sub-heads/mapping/amount+date config/waivers/fines/quick-collection/unpaid reports).
6. **Exam & assessment depth**: offline exam engine (mark configs per exam+code, grades, remarks, merit types, grand-final class exams, exam attendance, admit cards + seat plans, result cards) *plus* a question-bank taxonomy of 15 dimensions (`Modules/QuestionBank/Repositories/`) and quiz delivery with per-quiz fines.
7. **Print-first discipline**: ID cards, transfer certificates, testimonials, result cards, payslips, admit cards, seat plans, 9 certificate types — server print routes in `routes/web.php` + client-side `pdf`/`printing`; blade PDF layouts in `resources/views/layouts/pdf`.
8. **Nepal relevance ~zero**: currency `$`/USD, timezone `Asia/Dhaka`, gateways Stripe/PayPal/RazorPay/Paytm/Paystack/Flutterwave/SSLCommerz/MercadoPago/Paymob/Paytabs/LiqPay/SenangPay/PVit/bKash; SMS via Twilio/Nexmo/Msg91/Releans/Hubtel/SignalWire/SmsTo/ViaTech/Paradox/Alphanet/Akandit/GlobalSMS/SMS019/2Factor — no eSewa/Khalti/FonePay, no Sparrow, AD dates only, locales `en`+`bn`.
9. **AI is a marketing veneer**: one Flutter chat screen wired to `chat_gpt_sdk` with a compile-time API key constant (`lib/util/app_constants.dart`). No tools, no tutor context, no prompt engineering.
10. **Most transferable ideas for ASchool**: the per-domain "startup → map → configure → execute → report" wizard pattern; permission-named sidebar keys shared 1:1 between backend permissions and menu gating; per-institute public website CMS + public "apply for institute" onboarding funnel; device-limit control for e-learning content; SMS balance purchasing + template short-codes.

---

## 1. INVENTORY — codebase map and counts

### 1.1 Raw counts (Laravel backend, vendor skipped)

| Artifact | Count | Evidence |
|---|---|---|
| nwidart Laravel modules | 19 | `install-api-code-v1.6_x/Modules/` |
| Route definitions | 534 in modules (456 API + 78 web) + 28 in root `routes/` | `grep -c "Route::" Modules/*/routes/*.php`; root `routes/api.php` (8), `routes/web.php` (20) |
| Module route files | 33 (19 `api.php`; only Gateways (55) and Library (23) use `web.php` meaningfully) | `Modules/*/routes/` |
| Controller classes | 172 | `find Modules app -name "*Controller.php"` |
| Model classes | 185 | `find Modules app -path "*Models*"` |
| Migrations | ~201 module + 4 root | `Modules/*/database/migrations/`, `database/migrations/` |
| Seeders | 58 | `find Modules -name "*Seeder.php"` |
| Automated tests | 5 files | `find Modules tests -name "*Test.php"` — effectively untested |
| Spatie permissions seeded | 166, named `domain.action` | `Modules/Authentication/database/seeders/PermissionSeeder.php` |
| Locales (backend) | 2: `en.json`, `bn.json` | `install-api-code-v1.6_x/lang/` |
| Database | MySQL (`SHOW TABLES` raw usage) | `Modules/SystemConfiguration/app/Http/Controllers/API/UtilityController.php` |
| Queues / websockets / search / vector | none (one `SendSmsJob.php` exists; its scheduler line is commented out) | `updated-api-code-v1.6_x/app/Jobs/SendSmsJob.php`, `app/Console/Kernel.php` |
| Default timezone/currency | `Asia/Dhaka`, `$`/USD | `OnboardingsController.php` default settings rows; `lib/util/app_constants.dart` |

### 1.2 Per-module breakdown (controllers / models / API routes)

| Module | Ctrl | Models | API routes | What it owns |
|---|---|---|---|---|
| Academic | 32 | 45 | 65 | classes, sections, shifts, subjects, routines, attendance, migration, device control, notices, events, custom fields |
| Student | 5 | 2 | 49 | student CRUD/bulk import, student auth (password + OTP), student dashboard, assignments, student quiz |
| Authentication | 16 | 13 | 47 | users, roles, permissions, institute, branch, plans, subscriptions, onboarding, SaaS settings |
| Elearning | 13 | 14 | 39 | courses, lessons, chapters, contents, enrollment, zoom, quizzes |
| Frontend | 10 | 14 | 32 | public website CMS (banners, testimonials, policies, onboarding, themes) |
| Finance | 10 | 14 | 31 | fee heads/sub-heads, mapping, collections, waivers, fines, digital payments |
| Accounting | 6 | 8 | 31 | chart of accounts, journal, contra, funds, 11+ financial reports |
| ParentModule | 2 | 2 | 28 | parent portal over children (11 view domains) |
| QuestionBank | 21 | 21 | 23 | 15-taxonomy question bank + question papers |
| Examination | 3 | 11 | 21 | exams, mark configs, grades, remarks, merit, result cards |
| Payroll | 3 | 9 | 21 | salary heads, payroll mapping, payslips, advance/due salary |
| Teacher | 6 | 5 | 17 | teacher portal, assignments, gamification service |
| SMS | 5 | 5 | 9 | phone books, templates, balance purchase, sent log |
| SystemConfiguration | 2 | 2 | 10 | settings, branch/year switch, backup, domain check |
| Hostel | 9 | 9 | 10 | hostels, rooms, members, meals, bills |
| Gateways | 15 | 1 | 8 (+55 web) | 14 payment gateway integrations |
| Library | 3 | 4 | 7 (+23 web) | books, categories, issue/return, members |
| Transport | 5 | 5 | 6 | buses, routes, stops, drivers, members |
| LayoutCert | 1 | 2 | 2 (+web) | transfer certificate, testimonial, ID-card print routes |

### 1.3 Flutter app counts (`web-app-desktop-code-v1.6_x/web-app-desktop-code-v1.6/`)

| Artifact | Count | Evidence |
|---|---|---|
| Dart files | 1,858 | `find lib -name "*.dart" \| wc -l` |
| Top-level feature folders | 46 | `lib/feature/` |
| Page/screen/view dart files | ~333 | `find lib/feature -name "*page*\|*screen*\|*view*.dart"` |
| Registered routes | 197 `customPage(...)` (+6 commented out); 237 path constants; ~180 route getters | `lib/helper/route_helper.dart` (1,150 lines) |
| State management | GetX everywhere | `pubspec.yaml` (`get: ^4.6.6`), `lib/api_handle/` |
| Deploy targets | web, android, ios, windows, macos, linux | repo folders; `vercel.json`, `firebase.json` |
| Themes | light + dark, OpenSans, purple-family brand (`Color(0xFF081D5F)`…) | `lib/theme/`, `lib/util/styles.dart` |
| Notable deps | syncfusion_flutter_charts/calendar/pdfviewer, pdf+printing, mobile_scanner, vdocipher_flutter, youtube_player, html_editor_enhanced, chat_gpt_sdk | `pubspec.yaml` |

### 1.4 Feature enumeration — what each module contains (paths relative to `install-api-code-v1.6_x/`)

**Academic (largest, 65 routes)**
- Config: academic sessions/years (`Modules/Academic/app/Models/AcademicYear.php`), classes, sections, groups, shifts + assign-shift, subjects + subject configs, departments, periods, class assigns, class routines, picklists, student categories.
- Daily ops: student attendance (single + bulk + monthly report + summary), staff attendance, QR-code attendance (`studentQrCodeAttendance`), device attendance (`studentDeviceAttendance`), leave types.
- Content: syllabus (create/view per class), assignments (teacher create/edit/store, student submit/view), notices + per-user read state (`UserNotice.php`), events, contact messages.
- Transfer machinery: `StudentMigration.php` (session promotion/pushback/migration list), `StudentSession.php`, cross-branch student migration.
- Extensions: `CustomField.php` + `CustomFieldValue.php` (per-institute dynamic student fields), `DeviceControl.php` + `UserDevice.php` (per-user device allow-list/limit for e-learning), principal/teacher `Signature.php`, `AbsentFine.php`, `ResultCard.php`, `ExamAttendance.php`, `ExamSchedule.php`, SmsLog, LibraryMember (misplaced here).

**Student (49 routes)**
- CRUD + `students-bulk-imports` (+ download template), status toggles, search.
- Auth: `StudentAuthController.php` — password login, OTP sent/verify (`v1/student-otp-*`), **tenant resolved by `X-Domain` header** (line ~335).
- Portal: dashboard (with gamification + behavior), my-attendance, my-subjects, my-courses, class lessons, my-syllabus, my-transactions, library history, unpaid fee info, fines reports (attendance/lab/quiz).

**Authentication (47 routes) — SaaS core, see Section 2**
- Institute (`app/Models/Institute.php`: owner_id, assigned_to, domain, platform, theme_id), Branch, Plan, Subscription, SubscriptionItem, SubscriptionUpgradeRequest, SAASSetting, SAASSubscription (email capture only), SAASFaq, InstituteImageSetting(s), Feedback.
- `OnboardingsController.php` — approve public application → institute + "Main Branch" + admin user + ~40 default settings rows + trial subscription (buggy, see 2.3).
- `BranchController.php`, `PlanController.php`, `UserController.php`, `RoleController.php`, `PermissionController.php`, `UtilityController.php` (domain check via WHOIS-ish `DomainHelper`).

**Examination (`Modules/Examination/Models/`)**
- Exam, ClassExam, ExamCode (+MarkConfigExamCode), ExamMark, ExamGrade, Grade, MarkConfig, MeritProcessType, RemarkConfig, ShortCode, GrandFinalClassExam.
- Flows: exam startup → assign exams to classes → mark config per exam+code → mark input (`ExamMarkInputController`) → grades/remarks → results + result cards → exam routines; admit card + seat plan live in routine module (`admit_and_seat_plan`).

**Finance (`Modules/Finance/Models/`)**
- Fee, FeeHead, FeeSubHead, FeeMap (+FeeMapFeeSubHead, FeeMapFund), FeeDateConfig (installments), StudentCollection + StudentCollectionDetails + StudentCollectionDetailsSubHead (per-sub-head splits), Waiver + AttendanceWaiver + StudentWaiverConfig, AttendanceFine; lab/quiz fines via routes (`get-lab-fine-amount/{student_id}`, `student/quiz-fine-report`).
- Smart/quick collection: `APIQuickCollectionController.php` — bulk collection across students/classes.
- Digital payments: `digital-payment/{settingId}` + status endpoint — per-gateway payment settings records that parents/students pay through.
- Reports: unpaid summary/reports, head-wise payment, class-wise payment summary, monthly collections, collection invoice per student.

**Accounting (`Modules/Accounting/app/Models/`) — real double entry**
- AccountingType, AccountingCategory, AccountingGroup, AccountingLedger (chart of accounts), AccountingFund, AccountTransaction + AccountTransactionDetail (journal lines), PaymentHistory.
- Vouchers: journal, receipt, payment, contra, fund transfer (routes `account-journal-transfer`, `account-contra-transfer`, `account-fund-transfer`).
- Reports (11): `report/income-statement(-details)`, `report/balance-sheet(-details)`, `report/trial-balance(-details)`, `report/cash-flow-statement(-monthly)`, `report/cash-book-account`, `report/ledger-book-account`, `report/journal-wise`, `report/ledger-wise`, `report/voucher-wise`, `report/user-wise`, `report/fund-summary(-monthly)`, cash summary.

**Payroll (`Modules/Payroll/Models/`)**
- SalaryHead, SalaryHeadUserPayroll, UserPayroll, PayrollAccountingMapping (**posts salary payments into the GL**), PayslipInvoice, PayslipSalary, PayslipSalaryHead, Payment, PaymentMethod.
- Flows: staff salary config → salary create → payment process; **advance salary → due salary → return advance**; salary statement report; payslip PDFs.

**Elearning (39 routes)**
- Courses + categories + sub-categories, lessons, chapters (+ reorder), contents (video via VdoCipher/YouTube), `ContentVisibilityController` (per-class content visibility toggles), enrollment, course FAQs/features/rooms/days/zooms, Zoom meetings (`zoom_meetings` migration in root `database/migrations/`), quizzes + attempts + results, public store endpoints (`publicStore`, `category-wise-courses`) consumed by the Flutter landing page.

**QuestionBank (23 routes, 21 repos)**
- Taxonomy: boards, classes, subjects, chapters, topics, levels, difficulty levels, groups, sources, sub-sources, tags, types, years, sessions, tests (`Modules/QuestionBank/Repositories/`).
- Question CRUD, question categories, question paper creation (Flutter `lib/feature/question_bank/question/presentation/screens/question_paper_create_screen.dart`).

**SMS (9 routes)**
- PhoneBook, PhoneBookCategory, SmsBalance, SmsPurchase (prepaid balance), SmsTemplate with short-code merge fields (`short-code` route), compose/send, sent-SMS report; bulk absent-notify from attendance (`sendAbsentBulkSms`, `student-absent-attendance-bulk-sms`).
- 14 gateways in `updated-api-code-v1.6_x/app/Traits/SmsGatewayForMessage.php`: twilio, nexmo, msg_91, releans, hubtel, signal_wire, sms_to, viatech, paradox, alphanet, akandit, global_sms, sms_019, two_factor.

**Hostel** — Hostel, HostelCategory, Room, RoomMember, HostelMember, Meal, MealPlan, MealEntry, HostelBill (`Modules/Hostel/app/Models/`).
**Transport** — Bus, BusRoute, BusStop, Driver, TransportMember (`Modules/Transport/app/Models/`). No GPS/tracking anywhere (grep).
**LayoutCert** — TransferCertificate, Testimonial (`Modules/LayoutCert/Models/`); ID-card print lists from root `routes/web.php`; in the UI the certificate builder exposes **9 document types** (see 3.3).
**Frontend (32 routes)** — Banner, AboutUs, WhyChooseUs, Testimonial, FaqQuestion, Policy, Page, AcademicImage, MobileAppSection, ReadyToJoinUs, OurHistory, Contact, Onboarding (public institute application), Theme.
**ParentModule (28 routes)** — my-children, default-child assign/get, parent views of subjects/routine/assignments/attendance/fees/library/notices/events/exams/behavior.
**Teacher (17 routes)** — profile, class schedule, assignment CRUD, events/notices, `Services/Gamification/GamificationService.php` (student points/rewards).

### 1.5 What the root `routes/web.php` (20 routes) reveals

The only server-rendered pages are: the installer wizard (`/install/*`: requirements → permissions → purchase key → database), `/upgrade` (zip upload), `/saas-landing-page`, `/student-vital/{encodedData}` (public QR student page — base64 decode of institute/branch/student ids in `app/Http/Controllers/WebsiteController.php::vital`), and three `*-list-for-card-print/{encodedData}` routes for student/staff ID cards. There is no Blade admin panel — the admin UI is 100% Flutter.

### 1.6 Update package (`updated-api-code-v1.6_x/`, 1,470 files)

Contains the shared `app/` kernel that gets patched between releases: `Traits/` (HasPermissionTrait, HasPermissionWebTrait, Trackable, PaymentProcess, StudentCollectionTrait, AccountingCalculationTrait, SmsGatewayForMessage, HasUuid, RequestSanitizerTrait, SlugAbleTrait, ResponseTrait, Authenticatable), `Jobs/SendSmsJob.php`, `Mail/InstituteOnboardingMail.php`, `Mail/SupportTicketCreatedMail.php`, `Helpers/` (general.php, DomainHelper.php, InstituteHelper.php), `Enums/` (VoucherType, RoleEnum, UserLogAction, LeaveStatusEnum, MonthsEnum). The bundled update note requires running `php artisan migrate` manually after file updates.

---

## 2. MULTIBRANCH / SAAS CLAIM — audited hard

**Marketing**: "School Management System ERP Multibranch SaaS All-in-One".
**Reality**: single MySQL DB, single Laravel app, rows scoped by two integer columns; tenant = an `institutes` row; branch = a label under it.

### 2.1 Tenancy model
- Tenant resolution for staff: `get_institute_id()` = `auth()->user()->institute_id` and `get_branch_id()` = `auth()->user()->branch_id` (`install-api-code-v1.6_x/app/Helpers/general.php:20,28`). Every domain row carries `institute_id`; 126 of ~197 module migrations also carry `branch_id`.
- **Zero Eloquent global scopes** (grep `addGlobalScope` = 0 hits). Scoping is hand-written `->where('institute_id', get_institute_id())` in every controller/repository — the source of every isolation bug below.
- Public/student surfaces resolve tenant via an **`X-Domain` header** (browser host → `institutes.domain`): `updated-api-code-v1.6_x/app/Helpers/InstituteHelper.php::getInstituteIdByDomain`, consumed at `Modules/Student/.../StudentAuthController.php:335` and `Modules/Frontend/.../FrontendController.php:727` (`lib/api_handle/api_client.dart:41` sends `'X-Domain'`). There is **no server-side host-based tenancy middleware** — the domain column exists mainly so one Flutter web build (Vercel-hosted) can serve any institute's public site and student login.
- Institute extras: `owner_id`, `assigned_to` (support/user assignment), `domain`, `platform`, `theme_id` (`Modules/Authentication/app/Models/Institute.php`).

### 2.2 Branches: what they actually are
- `Branch = ['institute_id', 'name', 'status']` (`Modules/Authentication/app/Models/Branch.php`) — no address, no code, no per-branch config UI, no branch admins.
- CRUD: `Modules/Authentication/app/Http/Controllers/API/BranchController.php`. **`update()` and `destroy()` fetch by id with no `institute_id` check — IDOR: any tenant admin can rename or delete another tenant's branch.**
- Switching branch: `UtilityController::changeBranch` (`Modules/SystemConfiguration/.../UtilityController.php:34`) **overwrites the current user's `users.branch_id`** without validating the target branch belongs to the caller's institute. You see one branch at a time; there is no consolidated cross-branch dashboard, no consolidated finance, no branch-scoped portals. The only cross-branch surface is `all-students-get` / `all_student_view_list` and plan-limit counting.
- Per-branch state: branch-scoped rows in the `settings` table (e.g. `academic_year` is set per institute+branch via `academicYearChange`), plus branch_id on all domain tables. Student cross-branch transfer exists (`student-branch-migration`, Flutter `lib/feature/students_information/student_migration/`).

### 2.3 SaaS packages & billing
- `Plan`: `name, description, student_limit, branch_limit, price, duration_days, is_custom, is_free` (`Modules/Authentication/app/Models/Plan.php`) — **pure quota plan; no per-feature/module gating** (all 19 modules always on for every plan; no seat types, no add-ons).
- Enforcement: `install-api-code-v1.6_x/app/Http/Middleware/CheckSubscription.php` — 403s **every request** (reads included) when: no active subscription, expired, `students().count() >= student_limit`, or `branches().count() >= branch_limit`. Two COUNT queries per request; expiry is date-based only (`Subscription::isActive()`: `status === 'active' && now()->lte($this->end_date)`).
- **Trial-provisioning bug**: `OnboardingsController::approve()` creates the trial with hardcoded `'institute_id' => 1` and dereferences an undefined `$plan` variable ("Create a subscription for institute_id = 1" comment, ~line 139). Newly approved tenants get no usable subscription; the demo institute's row is the one updated. Unless an operator manually runs `upgrade()` for each tenant, `CheckSubscription` will 403 them.
- Renewals: **no webhooks, no auto-renew, no invoice table** — the invoice is a JSON blob on the subscription row (`invoice_details`). Super admin records a manual payment via `OnboardingsController::upgrade` (validates `payment_method`, `amount_paid`, `extra_days`); tenants can file a `requestUpgrade` (pending `SubscriptionUpgradeRequest`) which the super admin approves via `approveRequest`. Payment method on tenant-initiated requests is hardcoded `'online'` but nothing online actually happens.
- Public SaaS funnel: `/saas-landing-page`, `get-packages` (public), `saas-subscriptions-email-store` (email capture — the entire `SAASSubscription` model is `['email']`), `apply-institute` (public form → `Onboarding` row with `collected_data` JSON + logo) → super-admin `approve-request`. `SAASFaq` powers a SaaS marketing FAQ.
- Super-admin ops: `saas-dashboard-data`, `saas-subscriptions` CRUD, `saas-settings-update/upload-logo/updateMailConfig/getMailConfig` (per-tenant mail config!), `institute-image-saas-settings`, `request-upgrade-list`, plus `administration-backup-database` and `system/clear-cache` utilities.
- License enforcement = installer purchase-key step (`InstallController::keyWorld` in root `routes/web.php` flow) + a `storage/mightySchool` marker file written by `ResetSystemData` — trivially bypassable; demo `demo.sql` ships in the web root.

### 2.4 Tenant lifecycle walkthrough (as implemented)

1. **Discovery**: prospect hits `/saas-landing-page` (Laravel) or the Flutter landing page; browses `get-packages`, `saas-faqs`, `ready-to-join-us` CMS rows; submits `saas-subscriptions-email-store` (just an email) or the full `apply-institute` form (institute name/type/email/phone/domain + logo + admin user name/email/phone/password) → stored as a pending `Onboarding` row.
2. **Approval**: super admin lists pending onboardings (`OnboardingsController::index` — no pagination guard on visibility, any super admin), clicks approve → transaction creates Institute, "Main Branch", admin User (role 2, `'System Admin'`), ~40 `settings` rows (school_name "Demo Collage", timezone `Asia/Dhaka`, currency `$`, sms_gateway `twilio`, zoom keys empty, `app_version`, `app_url`, social links, `eiin_code`, `exam_result_phone`, `tuition_fee_phone`, …), and the (buggy) trial Subscription + SubscriptionItem. Sends `InstituteOnboardingMail`.
3. **Operation**: tenant admin logs into the Flutter app; `CheckSubscription` validates the (broken) subscription; user configures academic structure; every query is filtered by the user's institute_id/branch_id.
4. **Expiry**: when `end_date` passes, `CheckSubscription` 403s every request — the tenant is locked out of **reads too** until the super admin records a renewal (`upgrade()`) or approves their `requestUpgrade`.
5. **Limits**: adding students/branches 403s at plan limits — enforced at request time by counting, not at provisioning.

### 2.5 Verdict on the claim, and comparison with ASchool
- **"Multibranch"**: nominally true (rows carry branch_id; students can migrate between branches) but there is no branch as an administrative unit — no branch settings, no branch-scoped reports, no branch admin role concept, no consolidated analytics. Switching = mutating the user row.
- **"SaaS"**: quota middleware + manual renewals + a broken trial. No feature gating, no payment automation, no tenant self-service beyond an upgrade *request* form.
- ASchool's `multi_branch` + `white_label` already exceed this on isolation, branding, and admin UX.
- **Worth adopting from MSP's SaaS layer**: the public marketing funnel (packages page + email capture + FAQ + apply-for-institute approval queue); tenant-initiated upgrade-request workflow with super-admin payment recording (fits Nepal's manual-banking reality); per-tenant mail config; per-plan hard quotas (student/branch) if we want simple plans; the `X-Domain` public-site pattern (our website_builder could serve tenant sites off one deployment the same way).

---

## 3. UI/UX PATTERNS

### 3.1 One Flutter app for everything
- The same codebase renders the public marketing/landing site (`lib/feature/landing_page/presentation/screens/web_landing_page.dart`), the admin panel, teacher/student/parent portals, auth, and splash. Desktop width gets `WebHomScreen`; narrow widths get a bottom nav (`lib/feature/dashboard/presentation/dashboard_screen.dart`, `ResponsiveHelper.isDesktop(context)` branching).
- Role shell: `DashboardController` swaps navigation sets by role — `parentsItem`, `studentsItem`, admin default (dashboard_screen.dart:51-60). Parent and student each get ~11 dedicated screens (route constants `parentSubject…parentBehaviour`, `studentSubject…studentBehaviour` in `lib/helper/route_helper.dart`).

### 3.2 Menu organization (from `lib/feature/sidebar/controller/side_menu_bar_controller.dart`, ~1,000 lines)
- Hardcoded builder `_buildSideMenuItems()` wrapped in per-item permission checks: `if(profileController.hasPermission("dashboard"))`, `hasPermission("master_configuration.roles")` (lines 109, 768). The keys match the backend's 166 Spatie permission names exactly — one naming scheme end-to-end.
- Client-side menu search (`filterMenu`) filters nested items by title.
- Top-level sections: Dashboard; Branch; Student Information (student list, migration, migration pushback, migration list, student branch migration, all-student view); Student Attendance (attendance, reports, monthly report; *absent fine commented out*); Academic Configuration (session, shift, class, section, group, period, subjects, student categories, department, picklist, signature; *subject_config commented out*); Staff Information (staff attendance + report, teacher list, staff list); Payroll Management (start-up, mapping, assign, salary slip, salary, due, advance; *return advance/statement/payment info commented out*); Fees Management (start-up, mapping, amount config, date config, waiver, waiver config, smart collection, paid/unpaid info); Accounting (ledger, fund, category, group, payment, receipt, contra, journal, fund transfer, chart of accounts + 6 report screens); Routine (syllabus, assignments, class routine, exam routine, admit & seat plan); Library (categories, books, members, issue, issue search/report); Exam (exam, start-up, mark config, remark config, mark input, marksheet, results); **Certificates & Layouts (9 types)**: general recommendation letter, testimonial, attendance certificate, HSC recommendation letter, abroad letter, transfer certificate, character certificate, study certificate, bonafide certificate, migration certificate, ID card; SMS (config, template, phone book category, phone book, sent, absent SMS, purchase, report); Notice; Event; User Activities; Question Bank (category, add question, question, class, group, subject, chapter, types, level, topics, sources, sub-sources, year, board, tag, question paper); Courses (category, course, add course); Fees Reports (monthly, head-wise, unpaid, payment ratio); Administrator (system settings, payment gateway, role, employee, database backup, zoom config/meeting); Subscription; ChatGPT.

### 3.3 Design system
- Light + dark Material themes, `OpenSans` (`lib/theme/light_theme.dart:3`), brand purples/navy (`lib/util/styles.dart:53-55`).
- Syncfusion for charts, calendar, PDF viewer (`pubspec.yaml`); `pdf` + `printing` for client-side document generation; `flutter_inappwebview`/`html_editor_enhanced` for rich content; `mobile_scanner` for QR attendance; shimmer skeletons; custom master layout + breadcrumb (`lib/common/global_widget/global_master_layout_widget.dart`, `lib/common/coutom_royte_path/custom_route_path_widget.dart` — sic).
- Per-feature folder convention: `logic/` (GetX controller), `domain/` (model + repository), `presentation/screens|widgets/` — e.g. `lib/feature/fees_management/fees_head/`. Tables are custom paginated lists with search bars, not server-driven DataTables.
- Theming/branding: `institutes.theme_id` + CMS theme picker (`lib/feature/cms_management/cms_settings/presentation/widgets/select_theme_widget.dart`); logo via settings upload; the whole public site is CMS rows (banners, testimonials, why-choose-us, mobile-app section with QR codes, ready-to-join, policies).
- i18n: backend `_lang()` JSON lookup with 2 locales (`app/Helpers/general.php:34`, `lang/{en,bn}.json`); Flutter GetX `.tr` + language feature (`lib/feature/language/`, `lib/localization/`).

### 3.4 Worked examples of the screen flow patterns

- **Fees (most complete domain)**: `FeesStartupScreen` (create fee) → `FeesMappingScreen` (attach heads to classes/sections) → `FeesAmountConfigScreen` + `FeeDateConfigScreen` (amounts and due dates per class) → `SmartCollectionScreen` + `QuickCollectionDetailsScreen` (bulk collection with per-sub-head splits) → `PaidReportScreen` / `UnPaidReportScreen` / fees reports hub (`fee_monthly_report`, `head_wise_info`, `payment_ratio_info`). Fines and waivers sit alongside (`FineWaiverScreen`, `WaiverConfigScreen`).
- **Accounting**: config screens (chart of accounts, groups, categories, funds, ledgers) → voucher screens (journal, receipt, payment, contra, fund transfer) → a reports hub with six statement screens (balance sheet, trial balance, cash flow, income statement, fund-wise, ledger/voucher/user-wise) rendered with Syncfusion charts.
- **Exam**: `ExamStartupScreen` → `ExamScreen` (assign exams to classes) → `MarkConfigScreen` → `MarkInputScreen` → `ReMarkConfigScreen` (remarks) → `ExamResultScreen` + marksheet config → print via result cards/admit/seat-plan.
- **Certificates**: `LayoutAndCertificateManagementScreen` configures layouts; `CertificateScreen` takes a `CertificateTypeEnum` (9 types, `lib/feature/layout_and_certificate/enum/certificate_type_enum.dart`) and renders the fillable document; printing is client-side `pdf`/`printing`.
- **Content (e-learning)**: course → chapters (reorderable) → contents with video provider choice; `ContentVisibilityController` toggles what each class sees; device allow-list gates playback (`DeviceControl`).
- **Everything is a list + form + report triangle**: every feature folder has the same three screens — this uniformity is why one developer can ship here, and it is the pattern ASchool plugin UIs already follow via manifests.

---

## 4. WHAT ASCHOOL LACKS (evidence-backed gaps)

1. **General-ledger / double-entry accounting — biggest gap.** Chart of accounts, accounting groups/categories, ledgers, journal/receipt/payment/contra/fund-transfer, funds, and 11 financial reports (`Modules/Accounting/routes/api.php`: `report/income-statement`, `report/balance-sheet`, `report/trial-balance`, `report/cash-flow-statement(-monthly)`, `report/cash-book-account`, `report/ledger-book-account`, `report/journal-wise`, `report/voucher-wise`, `report/user-wise`, `report/fund-summary`). ASchool has fees + hr_payroll + inventory but no GL; fee income and salary expense never reconcile into one balance sheet. A `ledger`/`accounting` plugin with fee/salary/inventory auto-posting would close this.
2. **Payroll→accounting posting + advance-salary lifecycle.** `Modules/Payroll/Models/PayrollAccountingMapping.php` maps salary payments into GL accounts; advance/due/return-advance flows (`Modules/Payroll/routes/api.php`: `advanceSalaryPayment`, `dueSalaryPayment`, `returnSalaryPayment`), payslip invoices (`PayslipInvoice.php`), salary statement. Audit ASchool `hr_payroll` against this list.
3. **Fees sub-features.** Quick/smart bulk collection (`APIQuickCollectionController.php`); date config (installment scheduling) + amount config; three fine types (attendance, lab, quiz) each with fine report + waiver; per-sub-head collection splits (`StudentCollectionDetailsSubHead.php`); class-wise payment summary + head-wise + monthly + payment-ratio reports; per-gateway "digital payment" settings students actually pay through (`digital-payment/{settingId}`).
4. **School-document generators (print pipeline).** 9 certificate types + ID cards (sidebar list in 3.2; `Modules/LayoutCert/Models/TransferCertificate.php`, `Testimonial.php`), bulk card print lists (`routes/web.php`: `student-list-for-card-print/{encodedData}` etc.), principal/teacher signature uploads used on documents (`Modules/Academic/app/Models/Signature.php`, `TeacherSignature.php`), admit cards + seat plans (`admit_and_seat_plan`), result-card layouts (`Modules/Academic/app/Models/ResultCard.php`). ASchool's design_studio (canvas + writer + bulk PDFs) is the right engine — it lacks the structured document templates and per-student merge pipeline.
5. **Student migration engine.** Session-wise promotion with pushback, migration lists, and cross-branch migration (`Modules/Academic/app/Models/StudentMigration.php`, `StudentSession.php`). If ASchool's admission plugin lacks promote/pushback, this is the reference flow.
6. **Public SaaS funnel + onboarding approval queue.** Packages page, email capture, apply-for-institute form with logo, super-admin approval that creates institute + main branch + admin user + ~40 default settings rows in one transaction (`OnboardingsController::approve`). ASchool's white_label could adopt this as a self-serve onboarding wizard (minus the bugs).
7. **SMS operations depth.** Prepaid SMS balance purchasing (`Modules/SMS/Models/SmsBalance.php`, `SmsPurchase.php`), phone books + categories, templates with short-code merge fields, sent-SMS reports, bulk absent-notify hooks. ASchool `sms_notifications` (Sparrow) should verify quota/balance, merge templates, and phone books.
8. **Device control for e-learning.** Per-student device allow-list/limit so paid course content opens only on registered devices (`Modules/Academic/app/Models/DeviceControl.php`, routes `elearning-student-device-delete/{deviceId}`, `studentDeviceStatus`). Nothing like it in ASchool's lms/elibrary.
9. **Hostel meal management.** Meal plans, daily meal entries, meal-based billing (`Modules/Hostel/app/Models/Meal.php`, `MealEntry.php`, `MealPlan.php`, `HostelBill.php`) — richer than room+member tracking.
10. **QR student "vital" pages.** Base64-encoded QR → public student profile/result page (`app/Http/Controllers/WebsiteController.php::vital`, route `/student-vital/{encodedData}`) + QR self-attendance (`studentQrCodeAttendance`).
11. **Custom fields framework.** Per-institute dynamic fields with values (`Modules/Academic/app/Models/CustomField.php`, `CustomFieldValue.php`) — cheap extensibility for iEMIS extra fields without migrations.
12. **Tenant public-website CMS content types.** Banners, testimonials, why-choose-us, FAQs, policy pages, academic images, events, mobile-app promo, themes (`Modules/Frontend/Models/`). Check ASchool `website_builder`/`basic_website` covers these as tenant-scoped content types rather than freeform pages only.

### 4.1 Gap → ASchool plugin mapping

| MSP capability | Evidence | Nearest ASchool plugin | Gap severity |
|---|---|---|---|
| Double-entry GL + 11 statements | `Modules/Accounting/` | fees, hr_payroll (partial) | **High** — no ledger plugin |
| Payroll posts to GL + advance/due/return | `Modules/Payroll/Models/PayrollAccountingMapping.php`, routes | hr_payroll | **High** if unverified |
| Smart bulk fee collection + fines + waivers | `APIQuickCollectionController.php`, `AttendanceFine.php`, `Waiver.php` | fees | Medium — verify sub-features |
| 9 certificate/ID document types + bulk print | Sidebar 3.2, `Modules/LayoutCert/`, root `routes/web.php` | design_studio | **High** — engine exists, templates missing |
| Session promotion/pushback/branch migration | `Modules/Academic/app/Models/StudentMigration.php` | admission | Medium — verify |
| Public SaaS funnel + approval queue | `Modules/Frontend/app/Models/Onboarding.php`, `OnboardingsController` | white_label | Medium |
| SMS balance purchase + templates + phone books | `Modules/SMS/Models/SmsBalance.php`, `SmsTemplate.php` | sms_notifications | Medium |
| Device allow-list for e-learning content | `Modules/Academic/app/Models/DeviceControl.php` | lms | Medium |
| Hostel meals + meal billing | `Modules/Hostel/app/Models/Meal*.php`, `HostelBill.php` | hostel | Low-Medium |
| QR public student page + QR attendance | `WebsiteController.php::vital`, `studentQrCodeAttendance` | (none) | Low |
| Custom fields framework | `Modules/Academic/app/Models/CustomField.php` | (none generic) | Low-Medium |
| Tenant CMS content types | `Modules/Frontend/Models/` | website_builder, basic_website | Low |
| Zoom live classes | `Modules/Elearning/.../ZoomController.php`, `zoom_meetings` table | lms / conferences | Low (conferences exists) |
| Gamification (points/rewards for students) | `Modules/Teacher/Services/Gamification/` | gamification | None (already have) |

---

## 5. WHAT ASCHOOL DOES BETTER

1. **True multi-tenancy & white-label** vs shared-table institute_id + user-row branch flips. MSP's own core CRUD proves the risk: `BranchController::update/destroy` are cross-tenant writable.
2. **Nepal stack** — BS dates, iEMIS export/import (`iemis_importer`, `compliance`), SEE/NEB grading (`nepal_curriculum`), Sparrow SMS, eSewa/Khalti/FonePay — vs Bangladesh/India/Africa-centric rails (bKash, Paytm, RazorPay, SSLCommerz, Paystack), `bn`/`en` locales, `Asia/Dhaka` defaults.
3. **AI platform** — 24-tool ai_suite + tutor + workbench + ai_teacher vs one hardcoded ChatGPT chat screen with a compile-time API key (`web-app-desktop-code-v1.6_x/.../lib/util/app_constants.dart`: `chatGptApiKey = 'your ApiKey'`).
4. **Scale & async architecture** — ~756 Flask endpoints, Celery workers, pgvector, realtime vs 456 synchronous Laravel routes, no queues, no search index, no vector store.
5. **Frontend separation** — Next.js 216 pages with manifest-driven sidebar vs a 1,000-line hardcoded Flutter menu builder where every new menu item edits one giant file, and disabled features are commented-out lines (absent fine, return advance, `studentFees` route).
6. **Safety engineering** — ASchool has no `migrate:fresh` on a scheduler (MSP: `system:reset` **every minute** in `app/Console/Kernel.php` → `app/Console/Commands/ResetSystemData.php`), no raw-SQL backup endpoint (MSP: `UtilityController::backupDatabase` string-concatenates dumps with `addslashes` and writes `uploads/backup/DB-BACKUP-*.sql`), no client-side secrets, no `demo.sql` in web root.
7. **Domain breadth** — biometric attendance, GPS transport tracking (MSP transport has zero tracking), visitor management, health records, wellbeing, disaster/emergency, dismissal, conferences, alumni, incidents, gamification as a first-class plugin (MSP buries it in Teacher module), online exams + question bank as standalone plugins (MSP quizzes are e-learning-coupled only).
8. **Role-native mobile** — 5 dedicated Flutter apps vs one web-first build where mobile is a bottom-nav shell over desktop screens and student/parent portals share the admin codebase.
9. **Testability & CI surface** — ASchool's plugin kernel (manifests, registry, entitlements, events) vs 5 test files in a 19-module backend.
10. **Documentation** — MSP ships no real documentation in-package (the "Online Documentation" HTML is a redirect stub); ASchool maintains in-repo plugin-development guides and audit docs, which is a real adoption advantage for self-hosted buyers.

---

## 6. ORGANIZATION LESSONS for ASchool

1. **Module boundary honesty.** nwidart layout (`Modules/<Name>/{app,Models,Repositories,Services,routes,database}`) is a good skeleton, but MSP leaks: LibraryMember and DeviceControl live in Academic, Gamification in Teacher, StudentAuth in Student, Branch in Authentication — with cross-module FKs everywhere. ASchool's kernel should keep a shared-kernel model layer and forbid plugins defining other plugins' domain objects.
2. **Permission names as menu keys.** `academic_configuration.classes`, `master_configuration.roles` (`PermissionSeeder.php`) are used verbatim by the Flutter `hasPermission(...)` menu gating — one naming scheme across backend, storage, and nav. Adopt the 1:1 mapping in the manifest sidebar so menu hiding is automatically enforced server-side too (in MSP the Flutter gating is cosmetic; the API enforces separately — two sources of truth).
3. **The "startup → map → configure → execute → report" wizard pattern.** Fees = `fees_start_up → fees_mapping → amount_config/date_config → smart_collection → paid/unpaid reports`; Payroll = `payroll_start_up → payroll_mapping → payroll_assign → salary → salary_statement`; Exams = `exam_start_up → assign → mark_config → mark_input → results`. Every complex domain guides setup before transactions — a standard wizard scaffold worth copying into fees/hostel/library/exam plugins.
4. **Settings scoping.** `Setting {institute_id, branch_id, type, name, value}` gives branch-level overrides of institute defaults in one table (`academicYearChange` flips `academic_year` per branch). ASchool's config_store could add an institute-default → branch-override lookup chain cheaply.
5. **Single source of role truth.** MSP duplicates `role_id` + free-text `user_type` on users and hardcodes `role_id => 2` / `'System Admin'` during provisioning (`OnboardingsController::approve`) — a bug farm. Keep one authoritative role binding per user.
6. **Content visibility as data.** Elearning's `ContentVisibilityController` + `content-visibility-bulk-toggle` + chapter reorder are generic publish-control patterns reusable by elibrary/lms/portfolio.
7. **Print artifact registry.** MSP treats "everything prints" as first-class (dedicated print routes, blade PDF layouts in `resources/views/layouts/pdf/`, client-side pdf/printing). Keep a registry of printable document types per plugin routed through design_studio templates (ID, TC, testimonial, payslip, admit card, character/bonafide/migration/study/abroad letters).
8. **Anti-patterns to avoid (observed here).** Quota middleware that counts rows per request and blocks reads (`CheckSubscription.php`); hardcoded IDs in provisioning (`institute_id => 1`); demo/dev commands on production schedulers; DB dumps via string concatenation; feature flags by commenting code; demo SQL in web root; license checks as file markers.
9. **One UI codebase, many targets — cautionary.** MSP proves one Flutter app can cover admin + teacher + student + parent + public site + desktop, at the cost of giant files, `ResponsiveHelper` branching everywhere, and role spaghetti in the dashboard shell. ASchool's 5-app split is more maintainable; the transferable bit is centralizing design tokens (`lib/util/styles.dart`) and shared widgets (`lib/common/global_widget/`).
10. **Public-store/landing integration.** The e-learning store endpoints (`publicStore`, `category-wise-courses`, course details by slug) are consumed directly by the public landing page — i.e., the marketing site and the catalog are one surface. ASchool's basic_website + lms could share catalog widgets the same way.

---

### Appendix A — Security / quality findings (file:line evidence)

| # | Finding | Location |
|---|---|---|
| 1 | `system:reset` scheduled `everyMinute()`; runs `migrate:fresh` + reseed on the live DB | `install-api-code-v1.6_x/app/Console/Kernel.php`; `app/Console/Commands/ResetSystemData.php` |
| 2 | IDOR: branch update/destroy unscoped by institute | `Modules/Authentication/app/Http/Controllers/API/BranchController.php:46-70` |
| 3 | `changeBranch` doesn't validate target branch ownership | `Modules/SystemConfiguration/app/Http/Controllers/API/UtilityController.php:34-51` |
| 4 | Trial subscription hardcoded to `institute_id => 1`; undefined `$plan` dereferenced | `Modules/Authentication/app/Http/Controllers/API/OnboardingsController.php` (~line 139) |
| 5 | SQL backup via string concatenation + `addslashes`, written into `uploads/backup/` | `UtilityController.php::backupDatabase` |
| 6 | ChatGPT API key as a compile-time constant in client source | `web-app-desktop-code-v1.6_x/.../lib/util/app_constants.dart` |
| 7 | `demo.sql` shipped in web root | `install-api-code-v1.6_x/demo.sql` |
| 8 | License = purchase key in installer + `storage/mightySchool` marker file | `app/Http/Controllers/WEB/InstallController.php`; `ResetSystemData.php` |
| 9 | `create_option()` helper interpolates table/column names into raw SQL | `app/Helpers/general.php:85-120` |
| 10 | Expired-subscription handling blocks reads for the whole tenant (middleware on everything) | `app/Http/Middleware/CheckSubscription.php` |
| 11 | 5 test files for 19 modules; UI logic untested | `find Modules tests -name "*Test.php"` |

### Appendix B — quick path glossary (for follow-up digging)

- Backend root: `.../install-api-code-v1.6_x/` (Laravel 11; `composer.json`; `modules_statuses.json`; `demo.sql`)
- Shared kernel patch: `.../updated-api-code-v1.6_x/app/` (Traits/Jobs/Mail/Helpers/Enums — the files that change between releases)
- Flutter app: `.../web-app-desktop-code-v1.6_x/web-app-desktop-code-v1.6/lib/` — `helper/route_helper.dart` (all routes), `feature/sidebar/controller/side_menu_bar_controller.dart` (menu tree), `api_handle/api_client.dart` (`X-Domain`), `util/app_constants.dart` (base URL, version, GPT key)
- SaaS core: `Modules/Authentication/` (Institute/Branch/Plan/Subscription/Onboarding/SAAS*), `app/Http/Middleware/CheckSubscription.php`
- Accounting core: `Modules/Accounting/`, `Modules/Payroll/`, `Modules/Finance/`
- Exam core: `Modules/Examination/`, `Modules/QuestionBank/`, `Modules/Elearning/`
- Print core: `Modules/LayoutCert/`, root `routes/web.php`, `resources/views/layouts/pdf/`
- Installer/licensing: `app/Http/Controllers/WEB/InstallController.php`, `resources/views/install/`

### Appendix C — representative API surface by module (route URIs extracted from `Modules/*/routes/api.php`)

The route count per module (Section 1.2) maps to these URIs — useful for mapping MSP screens to ASchool endpoints 1:1.

**Academic (65)**: `academicYearChange`, class/section/shift/subject/period/department/picklist CRUD, `class-routine(s)`, `check-teacher-availability`, `assign-shifts`, `assign-subjects`, `assign-classes`, `syllabus`, `view_syllabus/{id}`, `assignment(s)`, `store_assignment`, `update_assignment`, `assignment-submit`, `student-attendance`, `student-attendance-status`, `student-attendance-delete`, `studentAttendanceReport`, `student-attendance-monthly-report-view`, `studentAttendanceSummary`, `staffs-attendance`, `staffAttendanceReport`, `reports-student-attendance`, `reports-staffs-attendance`, `get-attendance-fine-amount/{student_id}`, `student-qr-code-attendance`, `studentDeviceAttendance`, `student-migration`, `students-get-students-migration`, `studentBranchMigration`, `notice(s)`, `event(s)`, `custom-fields`, `custom-field-values`, `signature(s)`, `teacher-signatures`, `backupDatabase`, `clearAllCache`, `dateConfig`.

**Student (49)**: `student(s)` CRUD, `students-bulk-imports(-download-file)`, `students-status`, `student-search`, `student-profile`, `student-profile-update`, `v1/student-login`, `v1/student-otp-sent|verify|login`, `dashboardData`, `studentDashboard*`, `student/my-*` (attendance, subjects, courses, syllabus, transactions), `student/unpaid-info`, `student/payment-fee-info`, `student/library-history`, `student/{attendance,lab,quiz}-fine-report`, `student/gamifications`, `student/behaviors`, `student-account-delete`.

**Authentication (47)**: `register`, `user(s)` CRUD, `user-logs`, `role(s)`, `permission(s)`, `branch(es)` apiResource, `get-packages`, `saas-subscriptions` apiResource, `saas-subscriptions-email-store`, `saas-dashboard-data`, `saas-settings-update|upload-logo|mail-update|mail-config`, `saas-faqs`, `institute-image-saas-settings`, `administration/general_settings`, `administration-change-branch|year`, `administration-upload-logo`, `subscription/upgrade`, `request-upgrade`, `request-upgrade-list`, `approve-request/{id}`, `apply-institute` (public onboarding), `feedbacks`.

**Elearning (39)**: `courses`, `course-details/{slug}`, `course-categories|subcategories`, `enrollment-course`, `enrollments/list`, `chapter(s)`, `chapter-reorder`, `chapters-reorder-contents`, `contents`, `contentDelete`, `content-visibility-bulk-toggle`, `course-rooms|days|zooms|faqs|features`, `quiz(zes)`, `quiz-start|submit|finish|results|details`, `zoom-meetings` CRUD, `publicStore`, `category-wise-courses`.

**Frontend (32)**: `frontend/banners|about-us|why-choose-us|testimonials|faq|academicImages|gallery-images|policies|pages|events|contact-us|ready-to-join-us|mobile-app-section|themes|onboarding` — all tenant-resolved by `X-Domain`.

**Finance (31)**: `fee-head(s)`, `fee-sub-head(s)` + deletes, `fees-mapping`, `fee-date-config(|-search)`, `amount-config`, `waiver(s)`, `waiver-config`, `attendance-fine(s)`, `quick-collection`, `quick-collection-student`, `student-collection-invoice/{id}`, `student-collection-sub-head-wise-calculation`, `digital-payment(|/{settingId}|/status/{settingId})`, `unpaid-summery|unpaid-reports|unpaid-info`, `getHeadWisePayment`, `class-wise-payment-summary`, `report/get-monthly-fee-collections`.

**Accounting (31)**: `accounting-categories|groups|ledgers|funds`, `chart-of-accounts`, `cartOfAccounts`, `account-journal-transfer`, `account-contra-transfer`, `account-fund-transfer`, `accountTransaction(s)`, `fundSummary(|Monthly)`, plus the 11 `report/*` statement endpoints listed in 1.4.

**ParentModule (28)**: `parent/my-children`, `default-child-assign|get`, `parent/{subjects,class-routine,exams,attendance,fees,library,notices,events,assignments,behaviour}`.

**QuestionBank (23)**: `question-bank-{boards,classes,subjects,chapters,topics,levels,difficulty-levels,groups,sources,sub-sources,tags,types,years,sessions,tests}`, `question-categories`, `questions`, `updateQuestions`, `question-categories-wise-subjects`.

**Examination (21)**: `exams`, `exam-list`, `class-exam`, `exam-assign-store`, `exam-code|exam-code-store|exam-code-update`, `exam-essentials`, `exam-grade|exam-grade-store|exam-grade-update`, `examMarkInput` (ExamMarkInputController), `exam-routine(s)`, `exam-results`, `result-cards`, `remarks-config`, `semester-exam-settings-mark-config`, `general-exam-store`.

**Payroll (21)**: `staff-salary-config(|Create)`, `user-salary-assign`, `salary-create(-store)`, `salary-payment-create|process`, `advance-salary-payment`, `due-salary-payment`, `return-salary-payment`, `salary-statement`, `salary-heads`, `payslip` endpoints.

**Teacher (17)**: `teacher/assignments` CRUD (`create-assignment`, `store-assignment`, `edit-assignment/{id}`, `update-assignment/{id}`, `destroy-assignment/{id}`, `view-assignment`), `teacher/class-schedule`, `teacher/my-profile`, `teacher/notices|events`, `checkTeacherAvailability`.

**Hostel (10)**: hostel/category/room/room-member/member/meal/meal-plan/meal-entry/bill CRUD.
**SMS (9)**: `sms-compose`, `sms-send`, `sms-template`, `short-code`, `phone-book(|-category)`, `sms-purchase`, `sentSMSReport`, `sendAbsentBulkSms`.
**Gateways (8 API + 55 web)**: `digital-payment`, `payment-request` API; web callback/host pages for 14 gateways.
**Library (7 API + 23 web)**: `books`, `book-categories`, `books-issue|return`, `bookReturn`, `books-issue-reports`, `get-library-members`.
**Transport (6)**: `buses`, `bus-routes`, `bus-stops`, `drivers`, `transport-members`.
**LayoutCert (2)**: layout/certificate generation endpoints (heavy lifting is client-side + print web routes).
**SystemConfiguration (10)**: `administration/*`, `system/clear-cache|link-storage|unlink-storage`, `drop-database` (!), `domainCheck`, `settings`, `dateConfig`.
