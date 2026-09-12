# Competitor Audit: InfixEdu v9.4.0 (Codecanyon, Infixedu/Spondonit)

- **Audited**: 2026-09-11
- **Source**: `Other Projects/InfixEdu v9.4.0/.../InfixEdu v9.4.0 Main Application/upload_extracted` (Laravel monolith, ~88k files incl. vendor; vendor/node_modules skipped), plus `InfixEdu School Modules/` (addon zips) and `Documentation/` (an HTML page linking to online docs only — no offline documentation).
- **Purpose**: deep audit against **ASchool** (Nepal-focused multi-tenant school SaaS: Flask, 756 endpoints, 50 plugins, Next.js dashboard 216 pages, 5 Flutter apps, iEMIS/BS dates/eSewa/Khalti/Sparrow).

---

## Deep re-audit (v2) — implementation-level (2026-09-12)

- **v2 status**: covered route-by-route read of `admin_tenant.php` (2,369 lines), `api.php`/`v2api.php`/`tenant.php`/`student.php`/`parent.php`/`teacher.php`/`alumni.php`/`graduate.php`/`pagebuilder.php`, Modules/Fees + Wallet route files; five full traces (Fees v2 lifecycle, Exam→result engine, Online exam, Student lifecycle, Attendance) with controller→migration→side-effect detail; principal-blade view coverage; field-level comparison tables vs ASchool; findings V2-01…V2-14. Remaining: `routes/api.php` per-endpoint request-rule audit (739 defs sampled, not exhaustive), `routes/v2api.php` controller internals, HR/payroll and inventory traces (out of assigned scope).

> Note: the competitor root is `InfixEdu v9.4.0 Main Application/upload_extracted/` — all citations below are relative to that root (the "upload" folder exists only as a zip).

### V2.0 Route-coverage notes (file-by-file)

**`routes/admin_tenant.php`** — one global group `['middleware' => ['XSS','subscriptionAccessUrl']]` (:23) wrapping a `CheckDashboardMiddleware` group (:26). Major sub-groups with exact anchors:

- **Dashboard/to-do**: `add-toDo`→`HomeController@addToDo` (:109) … `get-to-do-list` (:116); display-setting widgets (:54-55).
- **Role/module/user perms**: `role` CRUD (:121-126), `module-permission` + `assign-module-permission/{id}` + `module-permission-store` (:134-137), `due_fees_login_permission` GET/POST/store (:2211-2213) → `Admin\FeesCollection\DueFeesLoginPermissionController`.
- **Academics**: class (:160-164), section (:209-214), subject (:217-221), optional-subject setup (:203-207, :1298-1301), class-routine-new grid editor `add-new-routine/{class_time_id}/{day}/{class_id}/{section_id}` (:240) + `add-new-class-routine-store` (:242) + `delete-class-routine` (:245-249), `print-teacher-routine/{teacher_id}` (:252), assign-subject (:256-268 + import), assign-class-teacher REST (:272-276), class-room (:279-283), shifts (:2348-2361 incl. `shift-setting`), `global-*` super-admin content twins (:2124-2188).
- **Students**: `student-admission` (:1090), pic upload (:1093), ajax fan-out `/academic-year-get-class` (:1096), `/shift-get-class` (:1099), `/branch-get-shifts|classes` (:1101-1102), `/ajaxVehicleInfo` (:1105), `/ajax-get-roll-id` + `/ajax-get-roll-id-check` (:1108-1111), `/ajaxSectionStudent` (:1114), `ajaxSubjectFromClass`/`ajaxSubjectFromExamType` (:1117-1119), `student-store` (:1127), documents delete/upload/download (:1131-1139), `student-timeline-store` (:1142), `delete-timeline/{id}` (:1153), import template/store (:1156-1158), sibling ajax `ajaxSectionSibling`/`ajaxSiblingInfo( Detail)` (:1161-1167), datatables (:1170, :1185-1187), list/settings/field-visibility (:1173-1178), view/edit/update/delete (:1192-1200), promote `student-promote` + `student-current-search` + `ajaxStudentRollCheck` + `student-promote-store` + exam-variant (:1218-1227), exports (:1230-1232), `promote-year/{id?}` (:1242), reports student/guardian/history/login (:1258-1273), `reset-student-password` (:1276), disabled/enable (:1279-1283), multi-record surface (:2095-2111), `student/{id}/assign-class` + record CRUD (:2054-2062), unassigned/sorting (:2091-2093).
- **Attendance**: subject-wise group (:167-191: index/search/store/store-second/subjectHolidayStore/import/bulk-store/report/average + `subject-attendance/print/{class_id}/{section_id}/{month}/{year}/{shift_id?}/{branch_id??}`), daily report + `student-attendance/print/{class_id}/{section_id}/{month}/{year}/{shift?}/{branch_id?}` (:195-198), `un-student-attendance/print` (:201), daily register (:1245-1255: search, `ajax-student-attendance-search/{class_id}/{section}/{date}` → `DatatableQueryController@AjaxStudentSearch`, store, `student-attendance-holiday`, import template/bulk), staff (:1387-1402 incl. `staff-attendance/print/{role_id}/{month}/{year}/{branch_id?}` and biometric `POST attendance` :1398).
- **Fees (v1 + v2-bridge)**: groups/types/discounts (:329-351 incl. `directfees/fees-discount-assign-store`), v1 `fees-generate-modal/{amount}/{student_id}/{type}/{master}/{assign_id}/{record_id}` (:353), `fees-payment-delete` (:356), **v2 installment surface** `direct-fees-generate-modal/{amount}/{installment_id}/{record_id}` (:358), `directFeesInstallmentUpdate` (:359), `direct-fees-total-payment( GET/POST)` (:361-362), `directFees/editSubPaymentModal/{payment_id}/{paid_amount}` (:364), `directFees/deleteSubPayment|updateSubPaymentModal|viewPaymentReceipt|setting|feesInvoiceUpdate|paymentReminder` (:365-370), carry-forward v1 `fees-forward*` (:373-378), `fees-payment-store` (:381), bank-slip file view (:383-389), collect-fees (:392-395), prints (:398-404), search/edit payment (:407-411), due search + `send-dues-fees-email` (:413-417), bank slips `bank-payment-slip` + `approve-fees-payment` + `reject-fees-payment` + `bank-payment-slip-ajax` (:420-424), statement (:427-428), balance/transaction/fine reports (:431-442).
- **Exams**: exam CRUD + `exam-reset` (:587-594), `exam-marks-setup/{id}` (:596), custom/percent marksheet (:601-602), exam-type (:706-710), `exam-setup/{id}` + `exam-setup-store` (:712-713), schedule/routine (:727-743), marks register (:749-761 incl. import), exam-format settings (:763-768), position reports (:770-774), seat plan (:777-789 incl. `assign-exam-room-get-by-ajax`, `get-room-capacity`), exam attendance (:792-798), marks-by-SMS (:800-801), question group/bank/level (:681-693), marks-grade REST (:697-701), online exam (:805-837: CRUD, view question, `manage-online-exam-question/{id}`, `online-exam-publish/{id}`, `online-exam-publish-cancel/{id}`, question assign, `online-exam-marks-register/{id}`, `online-exam-result/{id}`, `online-exam-marking/{exam_id}/{s_id}`, `online-exam-marks-store`, datatable).
- **Reports**: merit list (:449-451 incl. `merit-list/print/{exam_id}/{class_id}/{section_id}/{shift_id?}`), tabulation (:454-455, :1294-1296 incl. `tabulation-sheet/print`), results archive (:458-460), previous record/class results (:463-473), progress card (:1304-1309), subject/final mark sheet (:2068-2078), custom merit list/progress card (:1796-1802), `exam_step_skip` (:1804), `exam-signature-settings` (:2220-2222).
- **System**: notification settings group (:1511-1515), weekend (:1518-1522), holiday (:1503-1508), sms/email/payment settings (:1663-1766), custom fields student/staff/donor (:1735-1751), backup (:1705-1712), updater (:1715-1722 + `versionUpdateInstall` :1831 + `moduleFileUpload` :1833), custom-result-setting CRUD (:1788-1793), login access control (:1807-1810), addons (:1814-1820), language/translation (:1674-1686, :2118-2122), currency (:1689-1702), themes (:2291-2296), header-menu manager (:1861-1865), front-CMS objects (:1875-2048), forum/news/pdf (:2305-2346), events (:2262-2277), teacher evaluation (:2239-2260), carry-forward v2 (:2225-2236), user-custom-menu (:2363).

**Other route files**: `teacher.php` is 3 lines of comments (teacher power = staff panel). `student.php` (134 lines) includes `student_online_exam_submit` + `ajax_student_online_exam_submit` (autosave) and PayPal/Stripe fees payment. `parent.php` (56) adds child bank-slip store. `alumni.php` = 4 panel routes; `graduate.php` = 7 routes incl. `view/print-transcript/{id}` and `revert-as-student` (graduate→student reversal). `Modules/Fees/Routes/web.php:12-76` (`fees/` prefix): group/type CRUD, invoice list/store/edit/view/delete, `fees-payment-store`, `single-payment-view/{id}/{type}`, `delete-single-fees-transcation/{id}`, `bank-payment` + `approve-bank-payment`/`reject-bank-payment`, `fees-invoice-settings(+update)`, reports `due-fees|fine-report|payment-report|balance-report|waiver-report`, student list/payment, ajax `select-student|select-fees-type|ajax-get-all-section|ajax-section-all-student|ajax-get-all-student|change-method`, `gateway-service-charge`. `Modules/Wallet/Routes/web.php:6-27` (`wallet/` prefix): `add-wallet-amount`, `pending-diposit`, `approve-diposit|reject-diposit`, `approve-payment|reject-payment`, `wallet-transaction(+ajax)`, `wallet-refund-request(+ajax|store)`, `approve-refund|reject-refund`, `wallet-report(+search)`, `my-wallet`.

### V2.1 Trace A — Fees v2 lifecycle (exact rules)

**Schema** (`Modules/Fees/Database/Migrations/`): `fm_fees_invoices` (2021_07_29: `invoice_id` string, student_id FK sm_students, class_id, create_date, due_date, `payment_status` string, payment_method, bank_id, `type` 'fees'|'lms', record_id + school/academic) → `fm_fees_invoice_chields` (2021_07_31, one row per fee type = the "installment line": `fees_type, amount, weaver, fine, sub_total, paid_amount, service_charge, due_amount, note`) → `fm_fees_transactions` (2021_08_03: `invoice_number`, student_id, user_id, payment_method, bank_id, `add_wallet_money`, payment_note, `file` (slip upload), **`paid_status`** string, fees_invoice_id FK, service_charge, `total_paid_amount`, record_id) → `fm_fees_transaction_chields` (2021_11_02: fees_type, paid_amount, service_charge, fine, weaver, note). Plus `fm_fees_weavers` (waiver ledger: fees_invoice_id, fees_type, student_id, weaver, note) and `fm_fees_invoice_settings` (2021_07_26: `invoice_positions` JSON, `uniq_id_start`, `prefix`, class_limit, section_limit, admission_limit, weaver) — the invoice-number configurator, consumed by `feesInvoiceNumber()` at `app/Helpers/FeesHelper.php:267` (position ids joined by `-`, prefixed; invoice is saved once as `invoice_id='TEMP'` then re-saved with the real number — `FeesExtendedController::invStore` lines 48-51).

**Status enums**: invoice `payment_status` ∈ {`not`, `partial`, `paid`} (values used at `FeesExtendedController.php:219/223` and `app/Http/Middleware/FeesDueCheckMiddleware.php:71`); transaction `paid_status` ∈ {`pending`, `approve`, `reject`}.

**Flow**:
1. **Invoice create** — `FeesController@feesInvoiceStore` → `FeesExtendedController::invStore()` (`Modules/Fees/Http/Controllers/FeesExtendedController.php:25-145`): one invoice row + one chield per fee type with `due_amount = sub_total − paid_amount` (bcsub, :82); if any paid at creation, an immediate `FmFeesTransaction(paid_status='approve')` + chields + `addIncome('Fees Collect', ...)` + bank statement/`SmBankAccount.current_balance` update (:102-132); a `FmFeesWeaver` row is written for **every** chield even when weaver=0 (:135-143).
2. **Admin collects** — `FeesController@feesPaymentStore` (`Modules/Fees/Http/Controllers/FeesController.php:1022-1179`): validation `payment_method required; bank required_if:payment_method,Bank; file mimes:jpg,jpeg,png,pdf`; per type: `chield.paid_amount += paid − extraAmount`, `chield.fine += fine`, `chield.due_amount = due`; new FmFeesWeaver row; income row linked `fees_collection_id = transaction.id`; Bank → `SmBankStatement` + balance update (:1116-1159). Any overpay becomes a wallet deposit (`add_wallet` → `User.wallet_balance += add_wallet` + WalletTransaction type `diposit` note 'Fees Extra Payment Add' + `fees_extra_amount_add` email, :1043-1070).
3. **Student/parent self-pay** — `StudentFeesController@studentFeesPaymentStore` (`Modules/Fees/Http/Controllers/StudentFeesController.php:133-`): `Wallet` → balance check `wallet_balance >= total_paid_amount` else warn, deduct, WalletTransaction type `expense`; `Cheque|Bank|MercadoPago` → transaction with **`paid_status='pending'`** + slip file upload (the bank-slip queue); gateway chields get `service_charge = chargeAmount(method, amount)` where `chargeAmount()` (`app/Helpers/FeesHelper.php:31-43`) = percent (`charge_type 'P'`) or fixed (`'F'`) from per-school `SmPaymentGatewaySetting`.
4. **Approve/reject slips** — `FeesController@approveBankPayment` (:1306-1341) → `FeesExtendedController::addFeesAmount()` (:147-258): per transaction-chield `chield.due_amount -= paid; chield.paid_amount += paid; chield.service_charge = chargeAmount(...)`; income + bank statement; transaction → `approve`; then invoice-level close: `balance = (Tamount + Tfine) − (Tpaidamount + Tweaver)` (accessors sum the chields, `Modules/Fees/Entities/FmFeesInvoice.php:44-63`) → `payment_status='paid'` if 0 else `'partial'`, and on `paid` **`Cache::forget('have_due_fees_{user_id}')`** (:216-226). Wallet top-up if `add_wallet_money > 0` (:228-257). Reject (`:1343-1375`) just sets `paid_status='reject'` + `Approve_Deposit`/`Reject_Deposit` notifications (student+parent). Delete payment (`deleteSingleFeesTranscation` :1377-1441) reverses chield amounts, refunds wallet if method was Wallet, deletes the income rows, and **`Cache::rememberForever('have_due_fees_{user_id}', true)`** to force the due-block on next request.
5. **Wallet module** — `Modules/Wallet/Http/Controllers/WalletController.php`: deposit request `addWalletAmount` (:33+, file upload for Bank/Cheque with size check vs `SmGeneralSettings.file_size`; gateways embed service charge and redirect through provider controllers); admin approve sets `User.wallet_balance = current + amount` + `WalletTransaction.status='approve'` (:209-246), reject sets `status='reject'` (:248+); refund request creates WalletTransaction `type='refund'` (:455-508); approve refund re-checks `wallet_balance >= amount` before deducting (:510-550). WalletTransaction fields: amount, payment_method, bank_id, note, file, type (`diposit|expense|refund|fees_refund`), status (`approve|pending|reject`), user_id, school/academic.
6. **Carry-forward** — `app/Http/Controllers/Admin/FeesCollection/SmFeesCarryForwardController.php`: `feesForwardSearch` (:97-215) takes current-year StudentRecords with `is_promote=0`, sums **previous-year** invoices' chield `due_amount` (`previous_academic = SmAcademicYear::where('id','!=',current)->orderByDesc('id')->first()`, :148) and `SmFeesCarryForward::updateOrCreate(student_id+school_id)` with `balance_type='due'`, `due_date = today + generalSetting()->carry_forword_due_day days`, notes 'Previous year due' (:168-183). `feesForwardStore` (:217-282) accepts **signed** balances in a `DB::transaction` — negative → `balance_type='due'`, else `'add'`, stored as `abs()`. The v2 path `feesCarryForwardStore` (:437-506) parses a `+/-` prefix from the submitted balance, deletes the old row, re-inserts, and writes an audit row to `FeesCarryForwardLog` (`amount_type`, `type` = `fees`|`installment` picked from `generalSetting()->fees_status`, created_by). Settings are a single `FeesCarryForwardSettings` row (title, fees_due_days, payment_gateway) (:330-364); log viewer (:508-558).
7. **Due-login block** — `app/Http/Middleware/FeesDueCheckMiddleware.php` runs on the web stack: skip if `generalSetting()->due_fees_login` off or `user->loginRestricted`; computes per student: Fees-v2 → newest `FmFeesInvoice(payment_status='not')` due_date (`:70-75`); direct-fees → `DirectFeesInstallmentAssign(active_status != 1)` (`:78-83`); classic → per `SmFeesAssign` `balance = master.amount − (applied_discount + paid) + fine > 0` (`getClassicFeesDueDate`, :152-171); caches `have_due_fees_{user_id}` 900s (students: bool; parents: array of child student ids, :100-112). The actual gate is **`app/Http/Middleware/UserRolePermission.php:30-40`**: a parent whose cached dues array contains the URL's trailing parameter is `abort(403)` **unless** the route is `parent_fees` or `fees.student-fees-list-parent` — i.e., parents are walled into the fees pages; students are redirected at login via blade checks on the same cache key.

#### Comparison — Fees

| InfixEdu (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|
| Invoice = header + chield installment rows with per-line due/paid/fine/waiver (`Modules/Fees/Database/Migrations/2021_07_31_072347…`) | `FeeCollection` is one row per fee item (`backend/app/models/fee.py:42-92`); no installment split | No per-installment due tracking → can't answer "how much left on term 2?" | **Adopt**: add `fee_installments` (amount, due_date_bs, paid, fine, waiver) under a `fee_invoices` parent; FeeCollection becomes the payment line |
| Invoice-number configurator: positions JSON + prefix + start (`fm_fees_invoice_settings`, `app/Helpers/FeesHelper.php:267`) | Receipt number auto-series with per-school unique index (`fee.py:117-126`) | ASchool receipts are unique but format is not school-configurable | **Adapt**: expose prefix/sequence settings; keep the unique index |
| Fine accrues per chield + fine report (`FeesController.php:1093`, `fees/fine-report` route `Modules/Fees/Routes/web.php:52`) | `late_fine_amount` column exists (`fee.py:71`) but no late-fine computation/report found in `backend/app/api/v1/fees.py` | Fine math not implemented | **Adopt**: percent-or-fixed daily/once fine like `chargeAmount()` (`FeesHelper.php:31-43`) |
| Bank/Cheque slip → `paid_status='pending'` → admin approve/reject with file evidence (`StudentFeesController.php:281-300`, `FeesController.php:1306-1375`) | Payments are gateway-or-cash only; no offline-slip approval queue (`backend/app/api/v1/fees.py` has no pending-approval state; `payment_status` has `pending` but no review flow) | Nepali schools collect mostly via bank deposit — biggest UX gap | **Adopt (high priority)**: `payment_initiations.status` already models pending; add admin approve/reject endpoints + receipt-from-slip |
| Wallet deposits/refunds/pay-fees (`Modules/Wallet/*`) | None (refunds exist as `FeeRefund` ledger, `fee.py:129-153`, but no prepaid balance) | Prepaid wallet unused in Nepal market where eSewa/Khalti dominate | **Reject for now** (adapt later if schools ask for canteen/bus wallets) |
| Carry-forward table + signed-balance import + log + due-day setting (`SmFeesCarryForwardController.php:97-506`) | `batch_monthly_billing` and defaulters exist (`fees.py:751-756, 1126-1131`) but no cross-year balance roll | Overdue balances vanish at year rollover | **Adopt**: `fee_carry_forwards` (student, balance, balance_type, due_date) filled by the yearly rollover task |
| Due-fees login block via cache + route wall (`FeesDueCheckMiddleware.php:28-95`, `UserRolePermission.php:30-40`) | `send_fee_reminders` beat with 72h dedupe (`backend/app/tasks/fee_reminders.py:173`, `fee.py:88`) — remind, never block | Soft reminder vs hard gate | **Adapt**: opt-in per-school flag blocking result/portal access (not login) when overdue > N days; ASchool's JWT API must implement it as endpoint gating, not middleware |
| Waiver rows written even when zero, per payment (`FeesExtendedController.php:135-143`) | `StudentScholarship` percent/fixed with validity (`fee.py:188-208`) | ASchool's scholarship model is cleaner (definition vs application); InfixEdu conflates them | **ASchool ahead** — keep ours; add a waiver *application* history table only if audit requires |
| Idempotency: none (double-submit double-counts; `payment_status` recomputed from sums) | `FeeReceipt.idempotency_key` unique + `PaymentInitiation` gateway anchor (`fee.py:109, 155-184`) | ASchool strictly ahead on money safety | **ASchool ahead** |

### V2.2 Trace B — Exam → result engine (exact rules)

1. **Mark distribution** — `exam-setup/{id}`/`exam-setup-store` (`app/Http/Controllers/Admin/Examination/SmExamController.php`): store requires `total_exam_mark == totalMark` else rejects; inserts one `sm_exam_setups` row per component (exam_title, exam_mark) keyed by exam_term_id+class+section+subject (migration 2019_04_13). This is what the marks grid renders as columns.
2. **Marks entry** — `SmExamMarkRegisterController@store` (`app/Http/Controllers/Admin/Examination/SmExamMarkRegisterController.php:354-`): per student per component: non-university path **deletes then re-inserts** `SmMarkStore` rows keyed (class, section, exam_term_id, student_record_id, exam_setup_id, student_id) (:552-573); null component mark stored as 0; absent flag + teacher_remarks. Import exists (`marks-register-import-store` :761). Exam lookup quirk: exam resolved by `SmExam::where(exam_type_id, request->exam_id, subject_id, class_id)->first()` (:514-519) — the request's "exam" is actually the exam *type*.
3. **Grade calc** — per subject: `percent = subjectPercentageMark(obtained, full_mark)`; grade row = `SmMarksGrade::where percent_from <= pct AND percent_upto >= pct` (`:441-446`); `SmResultStore` upsert (migration 2019_04_17: total_marks, `total_gpa_point` = grade.gpa, `total_gpa_grade` = grade.grade_name, is_absent 1/0, teacher_remarks, student_record_id). `sm_marks_grades` (2014_12_01) carries **two** axes: GPA range (`from`/`up`) and percent range (`percent_from`/`percent_upto`) + gpa + grade_name + description.
4. **Merit list** — `SmExaminationController@make_merit_list` (`app/Http/Controllers/Admin/Examination/SmExaminationController.php:2000-2150`): aborts if any student lacks `SmResultStore` rows; per student: `total_marks = sum`, `average_mark = floor(total/subject_count)`, `gpa_point = round(sum(total_gpa_point)/count, 2)`, `result = grade where from <= gpa <= up`, **any absent subject → result 'F'** (:2087, :2110-2114); rows upserted into `SmTemporaryMeritlist` (migration 2019_04_10: iid batch token, subjects_string/marks_string comma-joined, merit_order) with `merit_order` = 1..N sorted `gpa_point desc` within `iid` (:2134-2140). The "all exams" cumulative variant (:2163-2635) reuses the same table with `exam_id` = weighted/composite context and `merit-list-settings` (`CustomResultSettingController@merit_list_settings`, :115-174) choosing ranking by `merit_list_setting` (default `'total_mark'`).
5. **Custom result settings engine** — `custom_result_settings` table (2020_02_05_105739: exam_type_id, **`exam_percentage`** float, merit_list_setting, print_status, profile_image, header_background, body_background). `CustomResultSettingController@store/update` (:76-233) writes one row per exam type with its weight and **syncs `SmExamType.percentage`**. The runtime engine `app/CustomResultSetting.php`: `getGpa/getDrade` by percent range (:11-31), `gpaToGrade` by GPA range (:33-42), `termResult` = mean of per-subject GPAs (:44-68), `getFinalResult` = `(exam_percentage/100) × term_gpa` summed across exam types (:90-114). Final results materialize into `sm_custom_temporary_results` (2020_02_05_131307 — the exact layout shape: student_id, admission_no, full_name, `term1`/`gpa1`/`term2`/`gpa2`/`term3`/`gpa3`, `final_result`, `final_grade` — a fixed 3-term weighted report card). Note the engine swallows every exception and returns `[]`.
6. **Tabulation sheet** — `Admin\Report\SmReportController@tabulationSheetReportSearch` (`app/Http/Controllers/Admin/Report/SmReportController.php:61+`): reads `SmMarkStore` by exam_term+class+section(+shift), builds `grade_chart` (grade_name, gpa, percent_from→start, percent_upto→end ordered gpa desc) for the legend, prints via `tabulation-sheet/print` (POST). Per-student variant via `request->student`.
7. **Marksheet prints** — `mark-sheet-report/print/{exam_id}/{class_id}/{section_id}/{student_id}` (`admin_tenant.php:495`) → `SmExaminationController@markSheetReportStudentPrint`; plus percent variant (`percent-marksheet-print` :602), subject/final mark sheets (`Admin\Report\SubjectMarkSheetReportController`, routes :2068-2078), custom progress card print (:1800-1802), results archive + previous-class results (:458-473).

#### Comparison — Exams/results

| InfixEdu (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|
| Per-subject mark distribution components (`sm_exam_setups`, `SmExamController@examSetupStore`) | `Marks.theory_marks/practical_marks` split only (`backend/app/models/exam.py:103-105`); exam-level totals on `Exam` (:49-51) | No N-component distribution (CQ/MCQ/practical/oral) per subject | **Adopt**: `mark_components` table (exam_id, subject_id, name, max_mark, order); marks grid renders columns from it |
| Grade = percent-range lookup, dual GPA/percent axes (`sm_marks_grades`, `SmExamMarkRegisterController.php:441-446`) | NEB letter grading auto-calc on Marks.grade/gpa (`exam.py:110-112`) + `_build_subject_grade` (`backend/app/api/v1/exams.py:145`) | ASchool hard-codes NEB; InfixEdu school-configurable ranges | **Adapt (already Nepal-first)**: keep NEB default but move boundaries into a per-school `grade_scales` table (SEE 65/60/50/40/35 + GPA bands) |
| Merit list engine with tie-free ordering + absent→F (`SmExaminationController.php:2000-2150`) | `_assign_competition_ranks` by percentage (`exams.py:133`) + rank columns on Marks/ReportCard | ASchool has ranking, no merit *list artifact* (print, subjects/marks strings) | **Adapt**: add merit-list report over existing ranks; do not copy the temp-table pattern |
| Weighted final across exam types (`custom_result_settings.exam_percentage` → `SmExamType.percentage`; `CustomResultSetting::getFinalResult` :90-114) | No multi-exam weighting — ReportCard is per exam (`exam.py:134-166`) | Nepali schools need terminal-weighted finals (e.g., 25/25/50) | **Adopt**: `exam_type_weights` per school+class+year; compose into ReportCard |
| `sm_custom_temporary_results` fixed 3-term snapshot | ReportCard snapshot with AI remarks + signatures (`exam.py:134-166`) | InfixEdu's is schema-frozen at 3 terms; ASchool's is per-exam PDF | **ASchool ahead** on model; adopt only the *weighting input* |
| Tabulation sheet + grade-chart legend + print (`SmReportController.php:61+`) | `/grade-sheet` endpoint exists (`exams.py:1037`) but no print artifact/legend | Missing classroom staple | **Adopt**: class×subject tabulation view + print in frontend/app/dashboard/exams/grades |
| Seat-plan generator + rooms + capacity (`admin_tenant.php:777-789`) | None | Whole feature missing | **Adopt later** (low value for Nepali internal exams) |
| Marks-by-SMS after publish (`admin_tenant.php:800-801`, `sm_marks_send_sms`) | SMS plugin exists (`backend/app/plugins/modules/sms_notifications/manifest.yaml`) but not wired to results | Cheap win via Sparrow | **Adopt** as a report-published notification event |

### V2.3 Trace C — Online exam (exact rules)

1. **Bank** — `sm_question_banks` (migration: `type` comment "'M' for multi ans, 'T' for trueFalse, 'F' for fill in the blanks", question, marks, trueFalse T/F, `suitable_words` (comma-separated acceptable words), number_of_option, q_group_id, class/section). Code also supports `'MI'` (image MCQ) via `answer_type radio|checkbox` (`Student/SmOnlineExamController.php:126-137`).
2. **Exam + assign** — `sm_online_exams` (title, date, start_time, end_time, **`end_date_time`**, percentage, instruction, `status` 0 pending/1 published, is_taken/is_closed/is_waiting/is_running, `auto_mark` flag, class/section/subject). `manageOnlineExamQuestionStore` copies bank questions into `sm_online_exam_questions` (per-exam `mark` override, type, title, trueFalse, suitable_words) (`Admin/OnlineExam/SmOnlineExamController.php:423-`); bulk assign via `online-exam-question-assign` (:843).
3. **Publish** — `onlineExamPublish` (:502-569): refuses if `now > end_date_time`; sets status=1; **writes an SmNotification row per student (role 2, 'New online exam published', url student-online-exam) and per parent (role 3)** in a loop — no queue.
4. **Attempt** — `take_online_exam.blade.php` (studentPanel): each answer is autosaved via ajax `ajax_student_online_exam_submit` → `questionAnswer()` upserts `online_exam_student_answer_markings` (user_answer saved even before submit; checkbox answers stored as one row per option, unchecking deletes the row, `Student/SmOnlineExamController.php:238-278`); with `auto_mark=1`, `autoMarking()` (:120-236) scores live: M = full marks if **any** chosen option is correct (no partial, no negative), MI radio = exact single match, MI multi = sorted arrays must equal correct set, T = string equality. Timer = server end_date_time; blade shows "exam has to be submitted within" countdown; submit guards `student_done===1` → "You are already participated".
5. **Submit** — `studentOnlineExamSubmit` (:384+): sums `obtain_marks` → `SmStudentTakeOnlineExam.total_marks`, `status=2`, `student_done=1` (idempotency by existing row check, not a constraint).
6. **Manual marking** — admin `online-exam-marking/{exam_id}/{s_id}` → `online_answer_marking.blade.php`; `onlineExamMarkingStore` (`Admin/OnlineExam/SmOnlineExamController.php:949-1087`): trueFalse graded by comparing posted `trueOrFalse_{question_id}`; fill-blanks graded by **checkbox inclusion** — correct iff `in_array(question_id, request->marks)` (:1044-1046); totals recalculated into SmStudentTakeOnlineExam. Results then appear in `online-exam-marks-register/{id}` (:724) and `online-exam-result/{id}` (:807); report per exam/subject in `online-exam-report` (:1088+).

#### Comparison — Online exam

| InfixEdu (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|
| Question bank M/T/F(/MI) with suitable_words, groups, levels (`sm_question_banks` migration; `SmQuestionBankController`) | `question_bank.py` models + `OnlineExam.questions` JSONB (`exam.py:181`) | ASchool embeds questions in the exam JSON; no shared bank/groups/levels | **Adopt**: promote question_bank to first-class (bank → reuse across exams); add fill-blank type with synonym words |
| Per-answer autosave during attempt (`ajax_student_online_exam_submit`, blade :238-274) | Attempt saved once at submit (`OnlineExamAttempt.answers` JSONB, `submit_online_exam` `exams.py:388-456`); no autosave | Refresh = lost answers for ASchool students | **Adopt**: autosave PATCH of attempt.answers (or per-question rows) — Flutter + web |
| Live auto-marking incl. exact-match multi-option (`autoMarking` :120-236) | Server-side scoring at submit (`submit_online_exam`) | ASchool scores safely server-side (better); no partial credit though | **ASchool ahead** on integrity; add partial credit for multi-select |
| Manual marking queue for fill-blanks (`onlineExamMarkingStore` :949-1087) | None (auto-only) | Manual marking needed once bank gains subjective types | **Adapt** when subjective questions arrive |
| Publish → per-student SmNotification rows + parent rows (`onlineExamPublish` :529-557) | `start_at/end_at` + status only; no targeted publish notifications (`exam.py:177-183`) | Students don't get told | **Adopt** via notifications plugin (single push, not per-row writes) |
| Idempotency by row existence check only (`:283-287`) | Attempt row per (exam, student) with unique backref; `status submitted` | ASchool ahead | **ASchool ahead** |

### V2.4 Trace D — Student lifecycle (exact rules)

1. **Admission** — the "wizard" is one page with tabs `#personal_info`, `#parents_and_guardian_info`, `#previous_school_info`, `#document_info`, `#custom_field` (`backEnd/studentInformation/student_admission.blade.php`:55,127); photo is a separate ajax `student-admission-pic` (`admin_tenant.php:1093`). Validation = `SmStudentAdmissionRequest` (`app/Http/Requests/Admin/StudentInfo/SmStudentAdmissionRequest.php`): **required fields are dynamic** from `SmStudentRegistrationField` (is_required / student_edit / parent_edit per role) + fixed rules `date_of_birth before_or_equal:today & after:1900-01-01`, `admission_date before_or_equal:today`. `store()` (`SmStudentAdmissionController.php:145-560`): (a) if phone/email matches an existing role-2 user → just `insertStudentRecord` (re-enrollment into class/section/session) or "Already Enroll" (:165-217); (b) new User role 2 with `username = phone || email || admission_number` and **`password = Hash::make(123456)`** (:260); (c) parent auto-created (role 3, same default password) or staff-as-parent linkage (:270-343); (d) SmStudent with transport (route/vehicle→driver_id), dormitory/room, custom fields JSON under `custom_field_form_name='student_registration'` (:401-413); (e) side effects: `generateQRCode('student-{id}')`, SmLeaveDefine rows cloned from role defaults (:439-466), notifications `Assign_Vehicle`/`Assign_Dormitory`/`Student_Admission` (to class teacher) (:468-493), Lead addon conversion (:195-200).
2. **Roll/sibling ajax** — `/ajax-get-roll-id` (next roll), `/ajax-get-roll-id-check` (duplicate check) (`SmStudentAjaxController`, routes :1108-1111); `ajaxSectionSibling`/`ajaxSiblingInfo(Detail)` to prefill guardian data from a sibling (:1161-1167).
3. **Multi-year records** — `student_records` (2018_01_04: class_id, section_id, `roll_no`, `is_promote`, `is_default`, session_id, academic_id, student_id). Admission/promote insert one row per year; management routes :2095-2111 (multi-class-student, record store/update/delete, `student-record-restore/{record_id}` soft-restore, permanent delete). `assign-class` (:2054) adds a record in another class for the same student.
4. **Promote** — `SmStudentPromoteController@promote` (`app/Http/Controllers/SmStudentPromoteController.php:172-360`): per selected student: target record must not already exist in promote_session (duplicate → "Already Enroll" semantics); **if roll provided and a record with that roll exists in target class/section/session → ValidationException 'Roll no already exist'**; **auto roll = `max(roll_no)+1` within target class/section/shift/session** (:210-217); `SmStudentPromotion` snapshot row (migration: previous/current class/section/session/shift + shift ids, `admission_number`, `previous_roll_number`, `current_roll_number`, `student_info` full JSON, `merit_student_info`, `result_status` default 'F'); new `StudentRecord` via `insertStudentRecord`; **old record flagged `is_promote=1`** (kept for history); Chat-module group membership removal (:286-302); notifications `Student_Promote` to teachers/student/parent + `send_sms(student_promote)` (:259-308). **Graduation**: when section is null the student is marked `is_graduate=1, is_promote=1` and a `Graduate` row is created (:311-351) — later reversible via `graduates/revert-as-student` (`routes/graduate.php:11-12`). `ajaxStudentRollCheck` (:159-170) duplicates the roll-exists check client-side. There is **no undopromote** in v9.4.0 (the v1 report's §2.3 wording implied one; it does not exist).
5. **Timeline** — `student-timeline-store` (:1142) → `SmStudentAdmissionController@studentTimelineStore` (attachment + title/date), `delete-timeline/{id}` (:1153), parent/teacher download routes (:28-49, :1144).
6. **Login reports & password reset** — `student-login-report` + `student-login-search` (:1271-1273) render `login_info` (per-student user last-login data); `POST reset-student-password` (:1276) → `SmResetPasswordController@resetStudentPassword` sets `Hash::make(new_password)` for `User::find(id)` with **no role check beyond route middleware**.

#### Comparison — Students

| InfixEdu (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|
| Multi-year rows: one `student_records` row per year; current record = `is_promote=0` (`2018_01_04` migration; promote logic :192-229) | Single `students` row mutated in place; year context via `academic_year_id` + promote endpoint (`backend/app/api/v1/students.py:420-540`) | InfixEdu keeps immutable yearly history incl. per-year roll; ASchool's history must come from audit logs | **Adopt (structural)**: add `student_enrollments` (student_id, class_id, section_id, academic_year_id, roll_number, is_promoted, is_default) and re-point marks/attendance/fees to it — this is InfixEdu's single most copyable schema idea |
| Promotion snapshot table (`sm_student_promotions`: JSON student_info, previous/current rolls) | Promote renumbers rolls 1..N with documented ordering + PROMOTABLE_STATUSES guard (`students.py:423-540`) | ASchool's renumbering is cleaner; no snapshot/history artifact | **Adopt the snapshot** for audit; keep ASchool's renumber rules |
| Roll duplicate check ajax + server-side (`rollCheck :159-170`) | Server 409 on duplicate roll + auto-assign free roll in a transaction (`students.py:134-153`) | ASchool ahead (atomic) | **ASchool ahead** |
| Default password `123456` for student+parent (`SmStudentAdmissionController.php:260,286`) | — | Credential hygiene problem; also admin can read/reset any password (`SmResetPasswordController`) | **Reject** (V2-02) |
| Dynamic registration fields per role (`SmStudentRegistrationField` in FormRequest) | EMIS fields hard-coded on Student model (`student.py:26-80` incl. caste/mother_tongue/disability) | ASchool covers iEMIS; but schools differ | **Adapt**: keep EMIS fields; add optional custom-field definitions only if schools ask |
| Timeline with attachments on profile (`student-timeline-store`) | portfolio plugin exists (`student_portfolio`) | Different lens (portfolio vs chronology) | **Adapt**: feed admission/promote/incident events into portfolio automatically |
| Graduate module + revert-as-student (`routes/graduate.php:11-12`) | Status enum includes graduated; transfer endpoints | No transcript print/revert path | **Adopt**: transcript print + revert on alumni plugin |

### V2.5 Trace E — Attendance (exact rules)

1. **Daily register** — `SmStudentAttendanceController@studentAttendanceStore` (`app/Http/Controllers/Admin/StudentInfo/SmStudentAttendanceController.php:169-277`): for each StudentRecord: delete existing row for (student, date, class, section[, shift, branch]) then stage insert with `attendance_type` ∈ **P/L/A/F(Half day)/H(Holiday)** + notes; actual write happens in the queued job `app/Jobs/TakeStudentAttendance.php` (`DB::table('sm_student_attendances')->insert(...)`) which then fans out `sent_notifications('Student_Attendance')` to Student+Parent with the human type label.
2. **Holiday marking** — `studentAttendanceHoliday` (:279-419, route `student-attendance-holiday` :1251): purpose=mark → per record row type 'H' notes 'Holiday' + SMS `holiday` template to student mobile **and** guardian + `SmNotification` rows + Flutter push via `flutterNotificationApi` — all inline in the request.
3. **3-step Excel import** — (1) template `download-student-attendance-file` (:1254) → columns `admission_no, class_id, section_id, attendance_date, in_time, out_time` (:454); (2) upload `student-attendance-bulk-store` (:1255) validates `attendance_date, file mimes:xlsx,csv, class, section` then `Excel::import(new StudentAttendanceImport(class, section))` into temp table **`StudentAttendanceBulk`** (`student_attendance_bulks`, migration 2020_06_22: attendance_date, attendance_type, note, student_id, student_record_id, class_id, section_id, school_id); (3) same endpoint commits: rows matching the submitted date are grouped by class-section, conflicting temp rows purged, existing `SmStudentAttendance` for that date deleted, then inserted fresh (:471-601). Legacy temp tables `sm_student_attendance_imports` / `sm_staff_attendance_imports` (2019_11_27) carry the same P/L/A/H/F comment; staff import mirrors this (`staff-attendance-bulk-store` :1402).
4. **Subject-wise** — separate controller `SmSubjectAttendanceController` with own store/store-second, holiday store, import, average report and prints (`subject-attendance/print/{class}/{section}/{month}/{year}/{shift?}/{branch_id??}` :191; average print :185). The **absent-SMS module reads subject attendance, not daily**: `app/Console/Kernel.php:57` schedules `absent_notification:sms` every minute; `app/Console/Commands/SendAbsentNotification.php` fires only when `AbsentNotificationTimeSetup.time_from == date('H:i')` and at least one 'P' exists in `sm_subject_attendances` today, then SMSes guardians of every student with 'A' rows using `SmsTemplate.student_absent_notification_sms` with placeholders `[fathers_name] [student_name] [number_of_subject] [subject_list] [date]`.
5. **Prints** — monthly registers: `student-attendance/print/{class_id}/{section_id}/{month}/{year}/{shift?}/{branch_id?}` (:198) → `SmStudentAttendanceReportController@print`; subject average print (:185); staff print by role/month/year (:1395).
6. **Weekends** — a `sm_weekends` table + `weekend` CRUD (:1518-1522) feeds the attendance blade's day-disable; the "holiday store" button covers ad-hoc days; no automatic weekend seeding into the attendance table.

#### Comparison — Attendance

| InfixEdu (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|
| Types P/L/A/F(Half)/H (job `TakeStudentAttendance.php:24-33`) | Enum `present|absent|late|half_day|leave` — **no holiday type** (`backend/app/models/attendance.py:26`) | Holiday days must be recorded as rows or skipped | **Adopt**: add `holiday` to the enum + per-day holiday marking endpoint (bulk) |
| Subject-wise attendance register + average report + prints (`SmSubjectAttendanceController`, routes :167-191) | Daily-only `Attendance` (+ `TeacherAttendance`) (`attendance.py:9-59`) | No subject/period dimension | **Adopt**: `subject_attendance` (student, timetable_period, date, status) fed from timetable; powers the absent-SMS too |
| 3-step import: template → temp table (`student_attendance_bulks`) → commit | `POST /mark` batch only (`attendance.py:22-166`) | No bulk-file entry path | **Adopt**: reuse the template→temp→commit UX (biometric/iEMIS imports can share it) |
| Cron absent-SMS with time windows + templated placeholders (`SendAbsentNotification.php`) | `sms_notifications` plugin exists but no attendance-triggered digest | Strong parent-engagement feature | **Adopt**: Celery beat job, per-school send windows, Sparrow template with same placeholders |
| Monthly print register route params incl. shift/branch (`:198`, `:1395`) | Summary endpoints only (`attendance.py:232-358`) | Print artifact missing | **Adopt**: month-grid register print in frontend + Flutter |
| Insert via queue job + notification fan-out (`TakeStudentAttendance.php`) | Synchronous bulk insert with unique constraint (`attendance.py:22-166`) | InfixEdu decouples notifications; ASchool is transactional | **ASchool ahead** on consistency; adopt queue only for the notification fan-out |

### V2.6 Principal blade views (sections + ajax they call)

- **Admission form** `backEnd/studentInformation/student_admission.blade.php` — tabbed single page (personal / parents+guardian / previous school / documents / custom field); ajax: `student_admission_pic`, `student_store`, plus shared roll/sibling/section endpoints (`ajax-get-roll-id`, `ajax-get-roll-id-check`, `ajaxSectionSibling`, `ajaxSiblingInfo`, `ajaxSiblingInfoDetail`); partials `date_picker_css_js` (:2430), `_custom_field` include (:2307).
- **Collect fees (v2)** `Modules/Fees/Resources/views/_addFeesPayment.blade.php` — invoice header + per-chield rows exposing `due_amount` readonly, inputs `paid_amount[]`, `weaver[]` (fixed/percent toggle via hidden `weaverType`), `fine[]`, `note[]`, hidden `total_paid_amount`; posts to `fees.fees-payment-store` (admin) or `fees.student-fees-payment-store` (student); live `gateway-service-charge` ajax when a gateway method is chosen.
- **Custom result settings** `backEnd/systemSettings/custom_result_setting_add.blade.php` — per-exam-type percentage weighting editor + print toggles; ajax `merit-list-settings` (stores merit_list_setting + profile/header/body/vertical_border flags) and `custom-result-setting/store|update`; consumed by custom merit list/progress card views.
- **Tabulation sheet** `backEnd/reports/report_tabulation_sheet.blade.php` — criteria (exam/class/section/shift) posting `reports_tabulation_sheets`; print twin `tabulation-sheet/print` (POST form).
- **Seat plan** `backEnd/examination/seat_plan_create.blade.php` — exam→class→section→room cascade with `assign-exam-room-get-by-ajax` + `get-room-capacity` capacity validation; posts `seat_plan_store_create`.
- **Online exam marking** `backEnd/examination/online_answer_marking.blade.php` — per-question answer script with per-question mark inputs; posts `online_exam_marks_store`; back link `online-exam`.
- **Menu manager** — `Modules/MenuManage` (drag order via `arrange-table-row-position` :2288, per-section settings, reset) + per-user menus (`user-custom-menu/{slug?}` :2363) on top of `sm_menus` seeded by `SmSchool::insertMenu()`.
- **Notification settings** `backEnd/notification_setting/notification_setting.blade.php` + `_modal.blade.php` — event matrix; row edit opens `notification_event_modal/{id}/{key}` (route :1513) and saves via `notification-settings-update` (:1514) — per event × destination (recipient) × channel.

### V2.7 General implementation delta

| Dimension | InfixEdu | ASchool | Verdict |
|---|---|---|---|
| Permission enforcement | Per-route alias middleware `userRolePermission:<name>` on ~60% of routes; aliases are strings often unrelated to route names (e.g., `:437`, `:147`) (`admin_tenant.php:1792`, `:522`) | `@require_*` decorators per endpoint | ASchool ahead (grep-able, testable); adopt InfixEdu's habit of *naming* permissions per route |
| Write patterns | Delete-then-insert for marks/attendance; updateOrCreate for carry-forward; several un-transactioned multi-table writes (`FeesExtendedController.php:102-133`) | Session-scoped transactions + unique constraints | ASchool ahead; copy only where noted above |
| Notification fan-out | `sendNotification(event, x, user_id, role)` + `sent_notifications(event, ids, data, [roles])` helpers everywhere; per-event matrix table | notifications plugin + SSE | Adopt the *event-catalog* concept (V2-09) |
| Caching | `have_due_fees_{id}` (900s / forever on delete), menus 600s | none for equivalent paths | Adopt careful invalidation-on-payment (ASchool: skip, reminders are beat-driven) |
| Debug leftovers | `Route::get('file_make', fn() => file_get_contents('my.txt'))` (`admin_tenant.php:2214-2216`), `mm` route (:2064), `store-data-test` seeding route (:2289) | — | Reject; keep ASchool's hygiene |
| Duplicate/dead routes | `class-routine-new` defined twice (:237, :1066), `print-teacher-routine` twice (:252, :1069), GET aliases of POST stores everywhere (`fees-forward-store` GET→index :378) | — | Caution when porting UX: GETs that mutate are an anti-pattern |

### V2.8 New v2 findings (beyond the v1 report)

1. **V2-01 — Wallet "extra amount" division bug**: `StudentFeesController.php:238` executes `$user->wallet_balance /= +$request->add_wallet;` (divide, not add) when a student pays fees from wallet with an extra top-up — corrupts the balance. Evidence path above; any wallet-like feature in ASchool must have unit tests on balance arithmetic.
2. **V2-02 — Hard-coded default password**: student and parent users are created with `Hash::make(123456)` (`SmStudentAdmissionController.php:260`, `:286`); combined with username = phone number, accounts are trivially compromiseable at scale.
3. **V2-03 — Admin password reset lacks role/constraint checks**: `reset-student-password` accepts any user id and sets a new hash with no confirmation or audit (`SmResetPasswordController.php`).
4. **V2-04 — Due-block is cache-trust based**: `FeesDueCheckMiddleware.php:44-47` returns immediately when the cache key exists — including a *stale "no dues"* result for up to 15 min after new overdue invoices; only the fees-delete path sets it forever-true. Payments clear it (`FeesExtendedController.php:221`) but new dues don't.
5. **V2-05 — Student gate is parameter-sniffing**: the parent 403 wall parses the trailing URL segment and compares it against child ids (`UserRolePermission.php:31-36`) — any route whose last param happens to equal a due child's id is blocked, and craftable URLs can bypass by putting the id elsewhere.
6. **V2-06 — Multi-select MCQ scoring is all-or-nothing on *any* intersection**: `autoMarking` awards full marks if any selected option is correct (`Student/SmOnlineExamController.php:154`), so selecting every option always scores 100% on type M. Only the `MI` (image) variant requires exact set equality (:209).
7. **V2-07 — Carry-forward "previous year" is `max(id) != current`**, not a configured from-year (`SmFeesCarryForwardController.php:148`) — back-dated academic years break the math; and the v2 store overwrites the row after deleting it, so history lives only in `FeesCarryForwardLog` (:449-488).
8. **V2-08 — Payment-approval math recomputes per-chield from posted arrays**, so a tampered form can apply arbitrary paid/fine/waiver values (`FeesController.php:1087-1115`); no server-side cap against `due_amount`.
9. **V2-09 — Notification catalog pattern**: every event is a string key ('Fees_Payment', 'Student_Promote', 'Approve_Deposit', 'Student_Attendance'…) routed through `sendNotification`/`sent_notifications` and mappable in the per-event settings matrix — this is the cleanest full-stack reference for ASchool's notification matrix design.
10. **V2-10 — 3-step import is committed in one request with no preview**: `studentAttendanceBulkStore` validates, imports to temp table *and* commits in the same POST (`SmStudentAttendanceController.php:471-601`) — the "preview" step exists only for students (`StudentBulkTemporary`); attendance import has no human review even though the report names a temp-table pattern.
11. **V2-11 — Merit-list `iid` is `time()`** (`SmExaminationController.php:2002`): two reports generated within the same second share a batch token; ordering is then computed across mixed batches.
12. **V2-12 — Custom-result engine returns `[]` on any exception** (`CustomResultSetting.php:17,29,41,66,87,112`), so a missing grade row silently blanks GPAs on report cards instead of failing loudly.
13. **V2-13 — Graduate path is promote-with-null-section**: graduating = `is_graduate=1` + `Graduate` row (`SmStudentPromoteController.php:311-351`) — a neat way to unify graduation with the records model that ASchool's alumni plugin should mirror.
14. **V2-14 — Online-exam publish writes notification rows in a loop with no queue** (`SmOnlineExamController.php:529-557`); a 500-student publish inserts ~1,000 rows synchronously — adopt the *event*, reject the *mechanics*.

---

## 0. Verdict in 10 bullets

1. InfixEdu is an extremely feature-dense Laravel monolith: **18 route files, ~2,733 route definitions, 357 controllers, ~368 model classes, 343 migrations, 981 blade views**.
2. Depth is in the "boring" school domains InfixEdu has had 9+ years to polish: **fees lifecycle** (carry-forward, installments, fines, waivers, bank-slip approval, due-blocking), **exam/result engine** (custom report-card builder, seat plans, merit lists, tabulation, results archive), and **print artifacts** (certificates, ID cards, payslips, bulk printing).
3. Multi-tenancy is a **single-database, `school_id` + global-scope** design (`app/Scopes/SchoolScope.php`), resolved per-request by `SubdomainMiddleware` into `app('school')`. The "Saas" module itself (superadmin, packages, subscriptions) is a separately sold addon and is **not included** in the base package.
4. The addon system is Laravel-Module style: zip upload → extracted into `Modules/`, `module.json` + `<Name>.json` manifest, `moduleStatusCheck()` gating everywhere, Envato purchase verification (`app/Http/Controllers/VerifyController.php`).
5. Sidebar/menu is **database-driven per school** (`sm_menus`, seeded from `default_menus` on school creation in `app/SmSchool.php::insertMenu()`), cached 600s, editable at runtime by the bundled `MenuManage` module — even per-user menus (`user-custom-menu`).
6. UI is legacy jQuery + Bootstrap + AdminBSB-era templates with ~60 server-rendered blade view folders; DataTables via a shared server-side partial + `DatatableQueryController`; almost no frontend framework.
7. Mobile is served by two API layers: legacy `routes/api.php` (739 endpoints, token-per-user) and `routes/v2api.php` (223 endpoints, resource-style controllers under `app/Http/Controllers/api/v2/`).
8. Nepal relevance is zero: AD/Gregorian only (`dateConvert()` in `app/Helpers/Helper.php`), no iEMIS, no SEE/NEB grading, no eSewa/Khalti in base (Khalti is an addon); gateways are PayPal/Stripe/PayUMoney/RazorPay (+Xendit/PhonePay/MercadoPago/CCAvenue/ToyyibPay/Khalti as addons).
9. Code quality is mixed: heavy blade+jQuery, duplicated controllers (`SmStudentAdmissionController_old.php`, `XSmClassRoutineNewController.php`, `.blade - Copy.php`, `old`/`backup` files), commented-out blocks, broad exception swallowing (`catch (Exception) return back()`).
10. The most transferable ideas for ASchool: DB-driven menu manager, **custom result/report-card settings engine**, **fees carry-forward + due-login-block**, per-event notification settings, dynamic registration fields, and the "everything prints" discipline (certificates/ID/bulk-print modules).

---

## 1. INVENTORY — codebase map and counts

### 1.1 Raw counts

| Artifact | Count | Evidence |
|---|---|---|
| Route definition statements | ~2,733 | `grep -chE "Route::(get|post|resource|match|put|delete)" routes/*.php` |
| Controller classes | 357 | `app/Http/Controllers/**` (159 under `Admin/*`) |
| Model classes (root, legacy `App\` namespace) | 177 | `app/Sm*.php` |
| Model classes (modern `App\Models\`) | 191 | `app/Models/` |
| Migrations | 343 | `database/migrations/` |
| Blade views | 981 | `resources/views/**` |
| Bundled modules (`Modules/`) | 16 | see 1.5 |
| Addon slots in `modules_statuses.json` | 48 | many are separately-sold addons, absent from this package |
| Locales shipped | 9 | `resources/lang/{ar,be,bn,ca,en,es,fr,hi,indo}` |
| Theme packages (frontend) | 1 bundled | `resources/views/themes/edulia` |

### 1.2 Route files (`routes/`)

| File | Lines | Role |
|---|---|---|
| `admin_tenant.php` | 2,369 (1,355 route defs) | The whole staff/admin back office — despite the name, this is the main application (shared admin + tenant middleware stack) |
| `api.php` | 1,141 (739 defs) | Legacy mobile API (per-user token) |
| `v2api.php` | 322 (223 defs) | v2 mobile API (role-scoped controllers) |
| `tenant.php` | 374 | Public frontend (school website), auth, shared panel routes |
| `parent.php`, `student.php`, `teacher.php` | 56/134/3 | Role panels |
| `alumni.php`, `graduate.php` | 14/13 | Alumni panel, graduate list |
| `pagebuilder.php`, `optionbuilder.php` | 62/21 | Frontend page builder + generic settings builder |
| `admin.php`, `infix_api.php`, `api-list.php`, `configuration.php`, `channels.php`, `console.php`, `web.php` | misc | glue (web.php is 19 lines and includes the others) |

### 1.3 Controller layout (`app/Http/Controllers/Admin/*` — 159 classes in 22 folders)

`Academics` (16) · `SystemSettings` (17) · `FrontSettings` (30, the website CMS) · `FeesCollection` (12) · `StudentInfo` (11) · `AdminSection` (9) · `Examination` (9) · `Accounts` (7) · `Hr` (7) · `Inventory` (6) · `Communicate` (5) · `Dormitory` (4) · `Leave` (4) · `OnlineExam` (4) · `Transport` (4) · `Library` (3) · `Report` (3) · `RolePermission` (3) · `Style` (2) · plus root-level controllers (`SmAcademicCalendarController`, `ShiftController`, `TeacherEvaluationController`, `SmCustomFieldController`, `GatewayPaymentController`, `ImportController`, `DatatableQueryController`, etc.).

Panels outside Admin: `Student/`, `Parent/`, `Alumni/AlumniPanelController`, `Customer/` (shop purchases), `api/` + `api/v2/` (mobile), `Theme/Edulia/` (frontend).

### 1.4 Schema = feature truth (`database/migrations/`)

Core academics: `sm_academic_years`, `sm_sessions`, `sm_classes`, `sm_sections`, `sm_class_sections`, `sm_subjects`, `sm_assign_subjects`, `sm_class_times`, `sm_class_rooms`, `sm_class_routines`, `sm_optional_subjects`, `sm_academic_calendars`.

Students/staff: `sm_students`, `student_records` (multi-year class records — a student row per academic year/class, `2018_01_04_105604_create_student_records_table.php`), `sm_parents`, `sm_staffs`, `sm_student_categories/groups`, `sm_student_promotions`, `sm_student_timelines`, `sm_student_documents`, `sm_custom_fields`.

Fees (old module): `sm_fees_groups/types/masters/assigns/discounts/payments`, `sm_fees_carry_forwards`, `sm_bank_payment_slips`; Fees v2 module: `fm_fees_invoices`, `fm_fees_invoice_chields` (installment rows), `fm_fees_transactions`, `fm_fees_weavers` (waivers) under `Modules/Fees/Database/Migrations/`.

Exams: `sm_exams`, `sm_exam_types/setups/schedules`, `sm_marks_grades`, `sm_marks_registers(+child)`, `sm_exam_marks_registers`, `sm_temporary_meritlists`, `sm_result_stores`, `sm_custom_temporary_results`, `sm_seat_plans(+child)`, `sm_online_exams` + `sm_online_exam_questions` (`type` = M/T/F + suitable_words for fill-blanks), `sm_question_banks` (`type` M/T/F), `sm_question_groups/levels`.

Ops domains: `sm_book*`/`sm_book_issues`, `sm_library_members`, `sm_items*` (category/store/receive/sell/issue), `sm_suppliers`, `sm_vehicles`/`sm_routes`/`sm_assign_vehicles`, `sm_dormitory_lists`/`sm_room_types`/`sm_room_lists`, `sm_visitors`, `sm_complaints`, `sm_postal_dispatches/receives`, `sm_phone_call_logs`, `sm_events`, `sm_holidays`, `sm_weekends`, `sm_notices`, `sm_notifications`, `sm_email_sms_logs`, `sm_leave_*`, `sm_hr_salary_templates`, `sm_hr_payroll_generates`, `sm_hourly_rates`, `sm_bank_accounts`, `sm_chart_of_accounts`, `sm_add_incomes/expenses`, `sm_amount_transfers`.

Platform tables: `sm_schools`, `sm_general_settings`, `sm_modules`, `infix_module_managers` (addon registry), `sm_menus` + `default_menus` (sidebar), `sm_role_permissions`, `sm_module_permissions`, `sm_languages` + `sm_language_phrases` (DB-backed i18n), `sm_background_settings`, `sm_styles`, `sm_smtp/email/sms/payment_gateway_settings`, `sm_header_menu_managers` (frontend menu), `sm_home_page_settings`, `sm_dashboard_settings`.

### 1.5 Bundled modules (`Modules/`) — enabled state from `modules_statuses.json`

| Module | What it adds (from `Modules/<m>/Routes/web.php`) | Default |
|---|---|---|
| `Fees` | Fees v2: invoices (auto/manual), installments (`directFees/*` routes in admin_tenant.php), waivers, bank-payment approval, due/fine/payment/balance/waiver reports, gateway service charge | ON |
| `Lesson` | Lesson plans + topics per class/section/subject, incl. university-semester variant | ON |
| `ExamPlan` | Admit-card designer + generation, seat-plan generator | ON |
| `DownloadCenter` | Content types + download/upload content sharing | ON |
| `Chat` | Pusher-based 1:1 chat (frontend in `api/v2/Admin/Chat/*`) | ON |
| `Wallet` | Student wallet: deposit approval, refunds, transactions, pay fees from wallet | ON |
| `BulkPrint` | Bulk print: student/staff ID cards, fees receipts, payslips, certificates, LMS certificates | ON |
| `RolePermission` | Granular role→route permission UI | ON |
| `MenuManage` | Drag-order backend menu, per-section settings, reset defaults | ON |
| `TemplateSettings` | Email/SMS template editor | ON |
| `TwoFactorAuth` | 2FA settings + verify/resend flow | ON |
| `StudentAbsentNotification` | Auto absent-SMS config | ON |
| `BehaviourRecords` | Incidents catalog, assign incidents to students, points, rank reports | ON |
| `StudyMaterialSupport`, `VideoWatch` | content support + watch-log tracing | ON |
| `Lead` | Admission lead CRM (present but no routes extracted; `lead_fields` in `resources/var/defaults.json`) | off |

Referenced-but-not-bundled addons (48 slots): `Saas`, `SaasSubscription`, `SaasRolePermission`, `SaasHr`, `Branch`, `University`, `Lms`, `Zoom`, `BBB`, `Gmeet`, `InAppLiveClass`, `OnlineExam`, `Certificate`, `AiContent`, `WhatsappSupport`, `InfixBiometrics`, `QRCodeAttendance`, `ParentRegistration`, `Alumni`, `KhaltiPayment`, `RazorPay`, `XenditPayment`, `PhonePay`, `MercadoPago`, `CcAveune`, `ToyyibPay`, `HimalayaSms`, `AWSS3`, `News`, `PDF`, `Forum`, `CustomMenu`, `AppSlider`, … — full list in `resources/views/backEnd/menu/staff.blade.php` (`$paid_modules`) and `modules_statuses.json`.

### 1.6 Feature enumeration (from `routes/admin_tenant.php`, grouped)

- **Dashboard/To-do**: `/dashboard`, `admin-dashboard`, `dashboard/display-setting` (widget show/hide), to-do CRUD (`add-toDo` … `get-to-do-list`).
- **Academics**: classes, sections, subjects, optional subjects, class rooms, class times/periods, class routines (day-wise grid editor `class-routine-new`, print per teacher), assign subjects, assign class teachers, shifts (`/shifts`, `shift-setting`, per-shift classes), academic calendar, holidays, weekends.
- **Students**: admission wizard (`student-admission`, ajax roll/section/sibling checks), bulk import (`import-student`, Excel format download), student list/grid with search + field visibility settings, profiles with documents + **timeline** (`student-timeline-store`), **assign class across years** (`student/{id}/assign-class`, `student-record-*`), promote (`student-promote*` with roll regeneration), disabled students, login reports + admin password reset, export PDF/Excel.
- **Attendance**: student daily (per class/section), subject-wise attendance, staff attendance, Excel bulk import for each, holiday marking, monthly print registers (`student-attendance/print/...`), subject attendance average report.
- **Exams**: exam types, exam setup (per-subject mark distribution), exam schedule + print, marks register + import, marks grades, exam attendance, **seat plans**, position reports (per exam / all exams), tabulation sheet, merit list (+ custom merit list), mark sheet report (normal/student/percent/custom), **final vs subject mark sheets** (`final_mark_sheet`, `subject_mark_sheet`), results archive + previous class results, marks-by-SMS, exam signature settings, **custom result settings** (`custom-result-setting` — user-defined report-card layout/columns), progress cards (grade + percent variants), online exams (publish, question assign, auto-marking + manual marking views `online_answer_marking.blade.php`, marks register), question bank (groups, levels, M/T/F types), exam reset.
- **Fees**: fee groups/types/discounts (with assign-by-class search), masters (single + group), assign to students, collect fees (student-wise), payment receipts/invoices print, due search + due email, bank payment slips with approve/reject, carry-forward (`fees-forward`, settings + log views), Fees-v2 direct fees (installments `directFees/editSubPaymentModal`, invoice settings, payment reminders), fine report, balance report, transaction report, **due-fees login permission** (block login when dues, `due_fees_login_permission` + middleware `app/Http/Middleware/FeesDueCheckMiddleware.php`).
- **Accounts**: income/expense heads, add income/expense w/ documents, chart of accounts, bank accounts + statements, fund transfer, search account, transaction report, profit-by-date, payroll report.
- **HR**: departments, designations, staff directory/grid, staff admission w/ custom fields + documents + timeline, staff disable/enable, staff attendance + import, leave types/defines/apply/approve (+ pending/approved ajax tables), payroll: hourly rate, salary template (earnings/deductions), generate payroll, pay payroll, payslip print, payroll report.
- **Homework/Study material**: homework list/evaluation/evaluation report; upload content (assignment/study material/syllabus/other downloads) with per-class assignment; teacher content download views.
- **Communicate**: notice board (audience-targeted, email+SMS send), send email/SMS + logs, notification settings **per event** (`notification_settings`, `notification_event_modal/{id}/{key}`), SMS templates, custom SMS gateway settings + test send, events, news with comments moderation, forum (topics, comments, votes) — via `UserForumController`/`UserNewsController`, user PDF library, **phone call log / postal receive / postal dispatch / complaint (+types)** front-desk set.
- **Library**: books, categories, members (incl. parents), issue/return, all-issued search, library subjects.
- **Inventory**: categories, items, stores, suppliers, receive (+payments, cancel), sell (+payments, print, cancel), issue/return.
- **Transport**: routes, vehicles, assign vehicle (student), transport report.
- **Dormitory**: dormitory list, room types, rooms, student assign + report.
- **Frontend CMS (FrontSettings, 30 controllers)**: page builder (`frontend-page-builder`, `routes/pagebuilder.php`), home page widget manager (`admin-home-page`), header menu drag-drop manager (`header-menu-manager`), news + categories, courses + categories, testimonials, home slider, expert teachers, photo/video galleries, speech slider, donors, downloadable forms, contact page, about page, custom links, social media icons, custom pages, **public exam result page / class routine page / exam routine page / academic calendar** (`front_result`, `front-class-routine`, `front-exam-routine`, `front-academic-calendar`), Tawk + Facebook Messenger plugin settings.
- **System settings**: general settings, background settings (login screen), color style + **theme upload/install/remove** (`theme/upload|install|remove`, make-default), currency manager (multi-currency), language settings + **phrase-level translation editor** (`get-translation-terms`, `translation-term-update`) + language file export/import, date formats, timezones, SMS settings (Clickatell/Twilio/Msg91/Textlocal/AfricasTalking), email settings + test mail, payment gateways (PayPal/Stripe/PayUMoney + bank), API permission, **module permission** per role, **login access control**, login-password-reset policy, **button disable/enable** (UI-level permission), user logs, cron job page, backup (DB + files, download/restore — `app/Helpers/Dumper/Shuttle_Dumper.php`), **system update from vendor server** (`update-system`, `versionUpdateInstall`), maintenance mode, about-system, addons manager (`manage-adons`), **view-as role/parent/superadmin**, custom fields builder (student/staff/donor registration fields), exam signature settings, display settings.
- **Frontend/portal**: student panel (`resources/views/backEnd/studentPanel/*`), parent panel with per-child tabs, alumni panel (`routes/alumni.php`), graduate list, customer panel (shop), public school website via `routes/tenant.php` + Edulia theme.

### 1.7 Blade view-folder map (`resources/views/backEnd/<folder>/`, file counts)

| Folder | Files | Contents |
|---|---|---|
| `studentInformation` | 65 | admission wizard, student list/grid/profile, promote, custom fields, disabled students, login report |
| `examination` | 57 | exams, schedules, marks register, online exams, seat plans, marksheets, question bank |
| `systemSettings` | 47 | general/email/sms/payment settings, languages, currency, addons, backup, custom result settings, utilities |
| `frontSettings` | 53 | website CMS objects (news, courses, galleries, sliders, pages, routines public pages) |
| `studentPanel` | 44 | student portal pages (profile, fees, online exam, homework, attendance, transport, dormitory) |
| `feesCollection` | 44 | fee types/groups/discounts/masters, collect fees, bank slips, reports |
| `parentPanel` | 31 | parent portal incl. per-child tab includes (`inc/_dashboard_*`) |
| `admin` | 38 | roles, users, permissions, module mgmt, section settings |
| `humanResource` | 36 | staff directory, documents, timelines, leave, payroll/payslips |
| `reports` | 39 | tabulation, merit lists, progress cards, marksheet reports + prints, archives |
| `inventory` | 27 | items, stores, suppliers, receive/sell/issue flows |
| `accounts` | 15 | incomes, expenses, banks, transactions |
| `communicate` | 13 | notices, email/sms logs, events, notification settings |
| `library` | 11 | books, members, issue/return |
| `academics` | 20 | classes, sections, subjects, routines, optional subjects |
| `global` | 16 | super-admin "global *" shared-content screens |
| `customField` | 5 | registration custom-field builder |
| `graduate`, `alumniPanel`, `shift`, `transport`, `dormitory`, `events`, `homework`, `teacherEvaluation`, `notification_setting` | 2–7 each | smaller domains |
| `themeManager` | 1 | theme install surface |

Other top-level view roots: `auth/` (login), `frontEnd/` + `themes/edulia` (website), `lms/` (when Lms addon active), `pagebuilder/`, `plugins/`, `install/`, `errors/`, `components/` (sidebar components), `layouts/` (app/builder/pb-site).

### 1.8 Role panels (`routes/`)

- **Student panel** (`routes/student.php`, 70 route defs): dashboard, profile + document upload/download, fees payment via PayPal/Stripe (`studentPayByPaypal`, `fees-payment-stripe`), online exams (take, submit, answer-script view `student-answer-script/{exam_id}/{s_id}`), class routine + routine print, own attendance + monthly print, results, exam schedule, homework download, teacher directory, book list/issue, transport/dormitory views, syllabus, timeline doc download, university-semester variants (`university/student/*`).
- **Parent panel** (`routes/parent.php`, 36): children switching (`backEnd/menu/parent_children_menu.blade.php`), per-child fees/attendance/homework/exam, child bank-slip store, child info/list.
- **Teacher** (`routes/teacher.php` is a stub — teacher powers ride the staff panel + `app/Http/Controllers/teacher/*` for API: homework, content, leave, search).
- **Alumni** (`routes/alumni.php`): alumni dashboard + directory; **Graduate** (`routes/graduate.php`): graduate list ajax (`GraduateListController.php`).
- **Customer** (shop buyer): `customer-dashboard`, `customer-purchases` (`routes/tenant.php`).

### 1.9 Mobile API surface

- `routes/api.php` (739 endpoints): legacy flat endpoints for login, students, fees, exams, attendance, library, inventory, transport, dormitory, leave, notices, plus SaaS-aware (`banks/{school_id}`).
- `routes/v2api.php` (223 endpoints): versioned controllers in `app/Http/Controllers/api/v2/` grouped per persona (`Student/`, `Teacher/`, `Parent/`, `Admin/`), including live-class adapters per provider (`Student/Class/{Zoom,GMeet,BBB,Jitsi}Controller.php`) and payments (`Student/Payment/{Wallet,PaymentHandler}Controller.php`).
- FCM push: `PushNotificationController`, `set-fcm_key` routes.

---

### 1.10 Settings surface enumeration (`resources/views/backEnd/systemSettings/`, 47 pages)

System/tenant config pages, each a route group in `routes/admin_tenant.php` under `Admin\SystemSettings\*`:

- Identity: `generalSettingsView` / `updateGeneralSettings` (name, logo, email, phone, address, currency, date format, timezone), `updateSettings` (frontend flags), `backgroundSetting` (login-screen gallery via `SmBackgroundSetting`), `preloader`.
- Academic scaffolding: `academic_year`, `session`, `baseSetup/` (base group + base setup dropdowns), `weekend`, `optional_subject_setup`.
- Fees/exams configuration: `feesCarryForward*` (settings/view/log), `custom_result_settings` + `custom_result_setting_add`, `fees_settings`/`exam_settings` groups (limits.json section ids).
- Communication: `emailSettingsView` (SMTP + test mail), `smsSettings` (5 gateway tabs + custom gateway + templates), `notification_setting/` (per-event matrix).
- Payments: `paymentMethodSettings` (PayPal/Stripe/PayUMoney/bank + active toggles), gateway callback controller `PaymentGatewayCallbackController.php`.
- People/permissions: `role/` (roles + permission matrix), `modulePermission` + `assignModulePermission`, `apiPermission`, `login_access_control`, `login-password-reset`, `buttonDisableEnable`, `user/` (user list).
- i18n & money: `languageSettings`/`languageSetup`/`language_export`/`language_import` (phrase editor), `manageCurrency` + `create_update_currency`.
- Platform ops: `backupSettings`, `cron_job`, `utilityView` (`utilities/{action}`: clear cache etc.), `aboutSystem`, `displaySetting` (dashboard widgets), `ManageAddOns`, `plugin_setting` (Tawk/Messenger), `customLinks`, `system_reactivated`, `tableEmpty` (empty-table diagnostics).

This is the most complete settings taxonomy in the codebase — 47 distinct admin pages vs ASchool needing one per plugin.

---

## 2. UI/UX PATTERNS

### 2.1 Layout system
- Backend master: `resources/views/backEnd/master.blade.php` = `@include(header)` + `@yield('mainContent')` + `@include(footer)`; `resources/views/layouts/app.blade.php` and `builder.blade.php` for other surfaces.
- Header partial `backEnd/partials/header.blade.php` carries: academic-year switcher (`change-academic-year`), language switcher, notifications, view-as dropdown, RTL toggle route (`theme-style-rtl`), user menu.
- Partials library in `backEnd/partials/`: `data_table_css/js`, `date_picker_css_js`, `date_range_picker_css_js`, `multi_select_js`, `server_side_datatable`, import dialogs (`student-import`, `register-import`, `subject-import`), `alertMessage` (Toastr), role sidebars (`staff/student/parents`).
- Search/CRUD convention: nearly every list page is a "criteria row + table + modal add/edit" blade; ajax helpers under `routes/admin_tenant.php` `ajax*` (~40 endpoints) feed dependent dropdowns (class→section→subject→shift/branch).

### 2.2 Sidebar & menu organization (the interesting part)
- Fully **database-driven**: `SmMenu` rows per school (3 levels: section-separators → groups → items), seeded per school on creation from `default_menus` in `app/SmSchool.php::insertMenu()`; rendered by `resources/views/components/sidebar-component.blade.php` → `backEnd/menu/{staff,student,parent}.blade.php` + `*_sub_menu.blade.php`.
- Rendering is gated 4 ways per item: `userPermission(route)` (role-route perms), `moduleStatusCheck(module)` (addon active), `isModuleForSchool()` + `isMenuAllowToShow()` (SaaS package assignment), plus fees-status switch choosing between the two fees modules (`generalSetting()->fees_status`).
- Sections are rendered as `menu_seperator` labels; a small script hides empty separators (`sidebar-component.blade.php` lines 69–84).
- The bundled `MenuManage` module gives runtime reordering (`arrange-table-row-position`, `reordering`), per-section config, and reset-to-default — i.e., **each school can reorganize its own sidebar**.
- Per-user menus exist too: `user-custom-menu/{slug}` + `StoreMenuController` — individual users can pin a personal menu subset.
- Distinct menus per persona: staff (largest), student, parent (children-submenu), SaaS superadmin (`saas::menu.Saas`), and `without_saas_school_admin_menu.blade.php`.

### 2.3 Forms & tables
- Server-side DataTables: `backEnd/partials/server_side_datatable.blade.php` + `DatatableQueryController.php` exposes ~30 `*-datatable` ajax endpoints (see routes: `student-list-datatable`, `income-list-datatable`, …). Client-side variant via `data_table_js.blade.php`.
- Excel import pattern everywhere: template download (`download_student_file`, `download-staff-attendance-file`) → upload → temp-table preview (`StudentBulkTemporary`, `StudentAttendanceBulk`, `SmStaffAttendanceImport`) → commit (`*-bulk-store`).
- Print pattern: every report has a paired print route (`mark-sheet-report/print/...`, `student-attendance/print/...`, `print-payslip`, certificate/ID generation print views) — printing is first-class.

### 2.4 Dashboards
- One main admin dashboard (`backEnd/dashboard.blade.php`) with **user-configurable widget visibility**: `dashboard/display-setting` + `systemSettings/displaySetting.blade.php` backed by `SmDashboardSetting`.
- Separate dashboards per persona: `backEnd/parentPanel/parent_dashboard.blade.php`, `backEnd/alumniPanel/alumni_dashboard.blade.php`, `backEnd/customerPanel/customer_dashboard.blade.php`, student panel dashboard views; SaaS superadmin dashboard comes from the Saas addon (`superadmin-dashboard` route).
- The academic-year selector in the header re-scopes the whole dashboard (data scopes filter by `academic_id` + `school_id`).

### 2.5 Report card / marksheet UI
- Deepest UX area. Views under `backEnd/reports/` and `backEnd/examination/`: mark sheet (normal/student/percent/old), **final marksheet** vs **subject marksheet**, merit list + print, custom merit list, tabulation sheet + print (incl. localized print variant `tabulation_sheet_report_print_lang.blade.php`), progress cards (grade-based and percent-based, whole-class variant), position reports, results archive.
- **Custom result engine** (differentiator): `custom-result-setting` CRUD (`systemSettings/custom_result_setting_add.blade.php`) lets a school define which columns/sections/rubrics appear on its report card; results are then rendered from `SmCustomTemporaryResult` + `CustomResultSetting.php` root model. This is how InfixEdu satisfies wildly different report-card formats without code changes.
- Exam signature settings (stamp/signature per exam print) — `ExamSignatureSettingsController.php`.

### 2.6 Multi-language
- Shipped locales: `resources/lang/{ar,be,bn,ca,en,es,fr,hi,indo}`.
- Runtime language manager: add language rows (`sm_languages`), edit **phrase-level translations in DB** (`sm_language_phrases`, `language-setup/{id}`, `get-translation-terms`, `translation-term-update`), export/import lang files (`lang-file-export/{lang}`, `file-export`), per-user locale switch (`locale/{locale}` in `routes/tenant.php`), cached menu/lang names (`$menu->lang_name`).
- **RTL**: toggle route `theme-style-rtl` + `backEnd/partials/rtl` partial injected by `css.blade.php` (class-based, CSS-only; shipped Arabic locale is the target).

### 2.7 Themes & skins
- Backend skin = `SmStyle` color themes: `color-style`, `make-default-theme/{id}` (`Admin/Style` controllers) — palette swap only.
- Frontend themes are full packages: theme upload/install/remove routes (`theme/upload|install|remove`) + bundled `themes/edulia` (Edulia has its own controllers `app/Http/Controllers/Theme/Edulia/*`, pagebuilder views and demo content); `activeTheme()` helper switches frontend rendering in `routes/tenant.php` (`if (activeTheme() !== 'edulia')`).
- Background settings control login-screen imagery; preloader partial; **page builder** for the public website (`routes/pagebuilder.php`, `PageBuilderController.php`, `views/pagebuilder`).

### 2.8 Onboarding / installer
- `resources/views/install/`: welcome → environment check (`checkEnvironmentPage.blade.php`) → DB setup (`installPage2`) → purchase verification (`check_purchase_page`, `pro_verification_page`) → system setup (`systemSetupPage`) → confirmation.
- Purchase code verified against **Envato API** in `app/Http/Controllers/VerifyController.php` (`Envato::verifyPurchase`, item id `23876323`); stored in `sm_general_settings` (`system_purchase_code`, `envato_user`); re-check middleware `Http/Middleware/CheckVerify.php` + `PurchaseVerification.php`.
- In-app updater: `database-upgrade`, `update-system`, `versionUpdateInstall` + root `config.json` (version 9.4.0, release 20/08/2026, migration manifest) — the vendor server (spondonit.com) ships update zips and migration lists.

### 2.9 UX observations worth copying (and avoiding)
- **Good**: dependent-dropdown ajax fan-out (`/academic-year-get-class`, `/branch-get-shifts`, `/ajax-get-roll-id`, `/ajaxSubjectFromExamType` … ~40 endpoints) keeps long forms workable; every destructive action has a confirm modal view (`delete-*-view` routes); settings pages group by domain with left-tab sub-nav (`systemSettings/*`).
- **Good**: academic-year awareness is visible everywhere (header switcher + scoped lists), and "view as role/parent" (`view-as-role`, `view-as-parent`, `view-as-superadmin`) lets admins verify each persona quickly.
- **Bad**: page-level consistency relies on copy-paste — duplicated ajax endpoints exist for the same dropdowns across years of patches; legacy v1 views remain (`mark_sheet_report_old.blade.php`, `addToDo_old.blade.php`, `.blade - Copy.php`, `.blade copy.php` files in `backEnd/reports/`).
- **Bad**: navigation depth — the staff sidebar holds well over 100 leaf items; sections (separators) are the only grouping, there is no command palette, favorites, or search-over-menu (there is global content search: `SmSearchController.php`).
- **Bad**: form validation UX is server-round-trip Toastr toasts; there is no client-side validation framework beyond browser defaults.

---

## 3. MULTI-BRANCH / SAAS ARCHITECTURE

- **Data model**: one database. Every domain table has `school_id` FK (`database/migrations/2014_11_01_000001_create_sm_schools_table.php` and beyond). `sm_schools` holds domain, school_code, package_id, plan_type (`yearly|monthly|once`), starting/ending dates, `is_enabled` login flag, active_status.
- **Tenancy resolution**: `app/Http/Middleware/SubdomainMiddleware.php` resolves the school from the subdomain via `SaasSchool()` (helper in `app/Helpers/saas.php`), binds `app()->instance('school', $school)`, and loads a per-school chat/settings valuestore. Root domain shows the landing page (`LandingController@index` when `config('app.app_sync')`).
- **Scoping**: global Eloquent scopes in `app/Scopes/` (`SchoolScope`, `AcademicSchoolScope`, `StatusAcademicSchoolScope`, `ActiveStatusSchoolScope`, `GlobalAcademicScope`) automatically add `where school_id` (and academic year) to queries — controllers rarely filter manually.
- **Academic session layer**: separate from tenancy — `sm_academic_years` + `YearCheck` (`app/Support/YearCheck.php`); header switcher `change-academic-year` re-scopes all data; "Global *" routes (`global-section`, `global-class`, `global-exam`...) let super admins create content shared across schools/years.
- **SaaS module (sold separately, not in this package)**: superadmin menu (`saas::menu.Saas`), packages, per-school module assignment (`isModuleForSchool()` in `app/Helpers/saas.php`), subscription payments (`Modules\Saas\Entities\SmSubscriptionPayment` referenced from `app/SmSchool.php::subscription()`), school admin "view as school" (`view-as-superadmin`), school secret login (`school-secret-login`). Related addons: `SaasSubscription`, `SaasRolePermission`, `SaasHr`.
- **Intra-school branches**: handled by a `Branch` addon + a built-in **shift** system. Evidence: `branch_id` params threaded through attendance/routine print routes (`student-attendance/print/{class_id}/{section_id}/{month}/{year}/{shift?}/{branch_id?}`), `BranchDataController.php`, `ShiftModuleDataGetController.php`, `/shifts` CRUD + `shift-setting`, and ajax endpoints `/branch-get-shifts`, `/shift-get-class`.
- **Middleware inventory** (`app/Http/Middleware/`, 31 classes) — the feature-policy layer: `SubdomainMiddleware` (tenancy), `UserRolePermission` (route perms), `ModulePermissionMiddleware` (addon gating), `SubscriptionAccessUrl` (plan gating of routes), `ThemeCheckMiddleware` (frontend theme), `StudentMiddleware`/`ParentMiddleware`/`CustomerMiddleware`/`AlumniMiddleware` (persona panels), `FeesDueCheckMiddleware` (dues block), `TwoFactorMiddleware`, `CheckVerify`/`PurchaseVerification` (license), `XSS` (input sanitize), `Localization`, `CheckMaintenanceMode`, `RouteServe` (auto route cache), `HttpsProtocol`, `ForceJsonResponse` (API), `SAMiddleware` (super-admin), `CheckDashboardMiddleware` (dashboard route gate), `CheckUserMiddleware`.
- **Implication for ASchool**: InfixEdu's tenancy is transparent to feature code because of the global scopes; the cost is that every table carries `school_id` + `academic_id` and migrations are 343-files-deep of duplicated column additions.

---

## 4. MODULE / ADDON SYSTEM

- **Bundled core modules** live in `Modules/<Name>/` (Laravel-Modules layout): `module.json` (name/alias/providers), `Entities/`, `Http/Controllers`, `Http/Requests`, `Routes/web.php` + `Routes/api.php`, `Providers/{Name}ServiceProvider.php` + `RouteServiceProvider.php`, `Database/Migrations`, `Resources/views`, `Resources/var/limits.json` (module limits). Example: `Modules/Fees/` (full listing in 1.5).
- **Route registration**: each module's `RouteServiceProvider` maps its routes; blade hooks call `moduleStatusCheck('Alias')` (→ `app/Support/ModuleRegistry::isActive()` via `app/Helpers/Helper.php`) before showing entries; `modules_statuses.json` at repo root stores on/off state; `generalSetting()->fees_status` even picks *which* fees module renders (v1 `fees_collection` vs v2 `Fees`).
- **Addon installation** (`moduleFileUpload` in `app/Http/Controllers/Admin/SystemSettings/SmSystemSettingController.php:3479`): admin uploads a zip → stored to `storage/app/module_file` → extracted to `storage/app/tempUpdate` → copied into `base_path('Modules/')` → `moduleVerify(zipname)` if defined → module migration run → enable/disable via `manage-adons-enable|disable` (`app/Http/Controllers/Admin/SystemSettings/SmAddOnsController`). There is no signature check or dependency resolution beyond `module.json`'s `requires` field (empty in practice).
- **Addon manifests** (from `InfixEdu School Modules/` samples): `RazorPay.zip` → `RazorPay/module.json` (providers list) + `RazorPay/RazorPay.json` containing `{"RazorPay": {"item_id": "27721206", "migration": {...}, "versions": ["2.0"], "url": "https://spondonit.com/contact"}}` — the `<Name>.json` file is the license/registration artifact checked against the Envato item id. Jitsi addon (`Jitsi_v1.4.zip`) adds `Entities/JitsiMeeting`, settings view, live-class routes under the same conventions.
- **Licensing**: Envato purchase-code verification at install (2.8) + per-module verification hooks (`Moduleverify.blade.php`, `ProModuleverify.blade.php` in `views/install/`); "Download Center" style upsell pages (`Download More Addons.html` in the modules folder).
- **Packaging economics**: the base purchase excludes most differentiating modules. The staff menu hard-codes the paid list `$paid_modules = ['Branch','CbseExam','Zoom','University','Gmeet','QRCodeAttendance','BBB','ParentRegistration','InfixBiometrics','AiContent','Lms','Certificate','Jitsi','WhatsappSupport','InAppLiveClass','OnlineExam']` (`resources/views/backEnd/menu/staff.blade.php:3`) — i.e., online exams, LMS, certificates, live classes, biometrics, and the entire SaaS layer are extra purchases, each with its own Envato item id (RazorPay addon: `item_id 27721206` in `RazorPay/RazorPay.json`).
- **Module refresh**: `ModuleRefresh` route re-scans installed modules; `versionUpdateInstall` and `post('moduleFileUpload')` are the only install paths; module state toggles rewrite `modules_statuses.json` from the UI.
- **Weaknesses to note**: module enable/disable writes a JSON file (file-writable state in prod), the addon upload path extracts arbitrary PHP into the app (RCE-by-design if an admin account is compromised), and there's no per-module service contract — cross-module calls go through `moduleStatusCheck()` conditionals scattered in blade and controllers (`routes/tenant.php` lines with `if (moduleStatusCheck('Lms'))`).

---

## 5. WHAT ASCHOOL LACKS — concrete gap list (InfixEdu has, ASchool does not)

### 5.0 Domain coverage matrix

| Domain | InfixEdu v9.4.0 | ASchool today | Gap? |
|---|---|---|---|
| Admission CRM | `admission-query` + follow-ups + `Lead` addon | admission plugin | Follow-up pipeline + lead stages |
| Students records | multi-year records, timeline, custom fields | student_portfolio | Timeline + custom registration fields |
| Attendance | daily + subject-wise + staff + Excel import + print registers | attendance | Subject-wise + print register + bulk import UX |
| Timetable | day-wise routine editor + per-shift + print | timetable | Shift dimension |
| Exams core | types, setup, schedule, seat plans, marks register | exams | Seat plans, mark distribution setup |
| Report cards | custom-result engine, merit list, tabulation, archive | basic_reports | Entire custom-result engine |
| Online exams | publish, auto+manual marking, script view | online exams + question bank | Marking workflow parity check |
| Fees | carry-forward, installments, fines, waivers, bank slips, wallet, due-block | fees (eSewa/Khalti/FonePay) | §5.1–8 lifecycle features |
| Accounting | incomes/expenses, chart of accounts, banks, fund transfer | — (basic_reports only) | Full accounts ledger |
| HR/Payroll | templates, generate/pay payroll, payslips, leave engine | hr_payroll | Leave engine depth (types→define→approve) |
| Library | books, members, issue/return | library (copies/holds/fines/stocktake) | ASchool ahead on copies/holds/stocktake; issue-flow parity fine |
| Inventory | suppliers, receive/sell/issue w/ payments | inventory | ASell/receive payments flow |
| Transport | routes/vehicles/assign + reports | — | Whole domain |
| Hostel/Dormitory | dormitory, room types, rooms, assign | hostel | ASchool likely ahead (modern); parity check |
| Communicate | notices, email/SMS logs, per-event settings, forum, news comments | notices, sms_notifications | Notification matrix, forum, comment moderation |
| Front-desk | complaints, postal, phone-call logs | incident_management (different) | Postal/phone-call log set |
| Website CMS | page builder, theme, menus, galleries, public results/routines | website_builder, basic_website | Public result/routine pages, header-menu manager |
| Live classes | Zoom/BBB/Gmeet/Jitsi/InApp (all addons) | conferences | Verify provider coverage |
| Behaviour | incidents + points + rank reports | incidents, incident_management | Points/rank reporting |
| Multi-branch | Branch addon + shifts | multi_branch | ASchool ahead (native) |
| Nepal | none (Khalti/HimalayaSms addon slots) | iEMIS, BS dates, SEE/NEB, Sparrow | ASchool ahead |
| AI | `AiContent` addon slot only | ai_suite, ai_teacher | ASchool far ahead |

### 5.1 Itemized gaps

Ordered by likely user value. Evidence paths are InfixEdu's.

**Fees**
1. **Fees carry-forward across academic years** — outstanding balances roll into the new year: `fees-forward`, `fees-carry-forward-settings-view`, `fees-carry-forward-log-view` (routes/admin_tenant.php) + `app/SmFeesCarryForward.php` + `systemSettings/feesCarryForward*.blade.php`.
2. **Installment-based invoicing** — an invoice is split into installment child rows with per-installment payments: `fm_fees_invoice_chields` (Modules/Fees/Database/Migrations/2021_07_31_072347...), `directFees/editSubPaymentModal`, `directFees/deleteSubPayment`, `direct-fees-total-payment`.
3. **Due-fees login blocking** — a student/parent cannot log in (or selected features) while dues exist, toggleable: `due_fees_login_permission` + `app/Http/Middleware/FeesDueCheckMiddleware.php`.
4. **Bank payment slip workflow** — offline bank transfer with slip upload → admin approve/reject: `bank-payment-slip`, `approve-fees-payment`, `reject-fees-payment`, `app/SmBankPaymentSlip.php`.
5. **Fines & waiver accounting as reports**: `fine-report`, `student-fine-report`, `waiver-report` (Modules/Fees/Routes/web.php), `fm_fees_weavers`.
6. **Wallet with deposits/refunds & approvals** (Modules/Wallet): deposit approval queue, refund request queue, wallet transactions, pay fees from wallet.
7. **Gateway service charge** per method: `gateway-service-charge` (Modules/Fees/Routes/web.php).
8. **Due reminders**: `directFees/paymentReminder`, `direct_fees_reminders` (resources/var/defaults.json).

**Exams & results**
9. **Custom report-card settings engine** — school-defined report-card layouts/columns without code: `custom-result-setting` + `app/CustomResultSetting.php` + `SmCustomTemporaryResult`.
10. **Seat-plan generator + admit-card designer** with layout switcher: `seat-plan*` routes, `Modules/ExamPlan` (`admitcard/setting`, `changeAdmitCardLayout`, `seatplan/generate`), `sm_seat_plans`.
11. **Exam signature settings** (printed signature/stamp per exam): `exam-signature-settings` + `ExamSignatureSettingsController.php`.
12. **Merit list & position engine** (temporary merit lists, per-exam and cumulative positions, custom merit lists): `merit-list-report`, `all-exam-report-position`, `custom-merit-list`, `app/SmTemporaryMeritlist.php`.
13. **Tabulation sheet + localized print**: `reports-tabulation-sheet`, `tabulation_sheet_report_print_lang.blade.php`.
14. **Results archive / previous-class results viewer** for alumni-style lookups: `results-archive`, `previous-record`, `previousClassResults.blade.php`.
15. **Marks distribution / grade setup per exam** (subject-level mark distribution before marks entry): `exam-setup/{id}`, `app/SmExamSetup.php`, `SmExamSetting`.
16. **Marks by SMS** push after result publication: `send-marks-by-sms`, `app/SmMarksSendSms.php`.
17. **Online-exam manual marking with answer-script view**: `online-exam-marking`, `online_answer_marking.blade.php`, `online_answer_auto_marking.blade.php`.
18. **Exam attendance** as its own register: `exam-attendance*`, `app/SmExamAttendance.php`.

**Student information**
19. **Dynamic registration custom fields** (per role: student/staff/donor) configurable at runtime: `student-registration-custom-field*`, `staff-reg-custom-field*`, `donor-reg-custom-field*` + `SmCustomFieldController.php`.
20. **Student timeline** (chronological activity log on profile with attachments): `student-timeline-store`, `app/SmStudentTimeline.php`.
21. **Certificate builder + bulk ID-card/print factory** (layout designers, default templates, bulk by class): `student-certificate` CRUD, `generate-certificate-print`, `student-id-card` + `Modules/BulkPrint` (staff ID, fees receipts, payslips, certificates bulk).
22. **Sibling linkage during admission**: `ajaxSiblingInfo`, `ajaxSectionSibling` (routes/admin_tenant.php).
23. **Multi-year student records** (one row per class/year with restore/soft-delete): `student/{id}/assign-class`, `student-record-restore/{record_id}`, `student_records` migration.
24. **Student login reports + admin password reset**: `student-login-report`, `reset-student-password`.

**Communication / front desk**
25. **Per-event notification settings matrix** (choose email/SMS/push per system event): `notification_settings`, `notification_event_modal/{id}/{key}`, `notification-settings-update`.
26. **Front-desk module set**: phone call log, postal receive, postal dispatch, complaints + types (`phone-call`, `postal-receive`, `postal-dispatch`, `complaint` resource routes).
27. **Admission query CRM with follow-ups** (+ Lead addon): `admission-query`, `query-followup-store`, `app/SmAdmissionQueryFollowup.php`, `Modules/Lead`.
28. **School forum & moderated news comments** for the community: `user-forum-*` (topics, votes), news comment moderation (`news-comment-status`), `UserForumController.php`, `UserNewsController.php`.
29. **SMS/email template editor** (Modules/TemplateSettings: `email-template`, `sms-template`).
30. **Custom SMS gateway + test SMS** (any provider via URL template): `save-custom-sms-setting`, `send-test-sms`.

**Frontend website / CMS**
31. **Drag-and-drop page builder for the public site**: `routes/pagebuilder.php`, `PageBuilderController.php`, `views/pagebuilder`, theme `themes/edulia` with demo content.
32. **Public result / routine / calendar pages** (parents check results and routines without login): `front_result`, `front-class-routine`, `front-exam-routine`, `front-academic-calendar`.
33. **Header menu manager + homepage widget manager**: `header-menu-manager`, `add-element`, `reordering`, `admin-home-page` (`app/SmHeaderMenuManager.php`, `SmHomePageSetting.php`).
34. **Rich school-site content objects**: home slider, expert teachers, testimonials, photo/video galleries, donors, downloadable forms, speech slider, courses (public), events (`/home-slider`, `/expert-teacher`, `/donor`, `form-download`, `speech-slider`, `course-list` routes).
35. **Third-party site plugins**: Tawk.to + Facebook Messenger settings (`plugin/tawk-setting`, `plugin/facebook-messenger-setting`).

**System / platform**
36. **Phrase-level translation editor + language file export/import** (non-devs can complete a translation): `language-setup/{id}`, `get-translation-terms`, `lang-file-export/{lang}`.
37. **Multi-currency manager with conversion endpoint**: `manage-currency`, `currency-converter` (api.php), `app/SmCurrency.php`.
38. **Built-in DB+files backup with restore** (no server shell needed): `backup-store`, `get-backup-db`, `restore-database/{id}` + `app/Helpers/Dumper/Shuttle_Dumper.php`.
39. **Self-updater** from vendor server (version + migration manifest in `config.json`): `update-system`, `post('admin/update-system')`, `versionUpdateInstall`.
40. **Base-setup option manager** (school-defined dropdowns reused across the app): `base-group`, `base-setup` + `SmBaseGroup/SmBaseSetup`.
41. **Role/route permission matrix + module-permission assignment + UI-button disable** (granular, DB-stored): `assign-permission/{id}`, `module-permission`, `button-disable-enable`, `app/SmRolePermission.php`, `Modules/RolePermission`.
42. **Login access control** (per-role login windows/rules): `login-access-control`, `SmLoginAccessControlController.php`.
43. **Shift system** (morning/day/evening school shifts with per-shift classes, routines, attendance, and print routing): `/shifts`, `shift-setting`, `shift` params in print routes, `ShiftController.php`.
44. **Teacher evaluation by students with approval workflow**: `teacher-evaluation-setting`, `teacher-approved/pending/wise-evaluation-report` + `TeacherEvaluationController.php` + migrations `2023_07_21_081453_add_teacher_evaluation_sidebarmenu.php`.
45. **Weekend/holiday-aware attendance** (weekend table + "holiday store" during attendance): `weekend` resource, `student-attendance-holiday`, `app/SmWeekend.php`.
46. **2FA addon behavior** (Modules/TwoFactorAuth: verify/resend/settings), **user activity log viewer** (`user-log`), **maintenance mode toggle** (`maintenance_mode`), **cron job settings page** (`cron-job`).

**Nepal-relevant echoes**
47. InfixEdu has no Nepal specifics, but its **Khalti addon slot** (`modules_statuses.json` "KhaltiPayment") shows the same gateway ASchool ships — the gap is not the gateway but the surrounding fee-engine features (1–8) that Nepali schools bill with.

---

## 6. WHERE ASCHOOL IS AHEAD

1. **Architecture**: InfixEdu is a single Laravel monolith with blade + jQuery (~981 blades, no SPA), where ASchool is Flask (756 JSON endpoints) + Next.js (216 pages, manifest-driven sidebar) + 5 Flutter apps. InfixEdu's mobile support is bolted on via two parallel API generations (`routes/api.php` + `routes/v2api.php`) with duplicated logic; ASchool's Flutter apps consume one API surface.
2. **True plugin architecture**: ASchool's 50 plugins vs InfixEdu's 16 bundled modules + 48 addon *slots* where most addons are absent, sold separately, and installed as raw zip drops (§4). InfixEdu's "plugin boundary" is blade conditionals, not an API contract.
3. **Multi-tenancy model**: InfixEdu's SaaS layer is an addon you must buy and self-assemble; per-school module assignment exists but package/subscription management is in a separate module. ASchool has tenancy + billing as platform primitives.
4. **AI**: InfixEdu's only AI surface is the `AiContent` addon slot (not bundled). ASchool ships ai_suite (24 tools + tutor + workbench) and ai_teacher — an entire category InfixEdu cannot answer.
5. **Nepal localization**: BS calendar (ASchool native) vs InfixEdu AD-only (`dateConvert()` in `app/Helpers/Helper.php`); iEMIS compliance + iemis_importer, SEE/NEB grading, Sparrow SMS, eSewa/Khalti/FonePay native — none exist in InfixEdu base (Khalti/HimalayaSms are unbundled addon slots only).
6. **Safety & wellbeing stack**: disaster_management, emergency, dismissal, wellbeing, health_records, gps_tracking, conferences, visitor_management (full), biometric — InfixEdu has only visitor logs (`sm_visitors`) and an unbundled `InfixBiometrics` addon; no dismissal, emergency, GPS, or health domains at all.
7. **Modern content**: website_builder + design_studio (canvas/writer/bulk PDFs) vs a legacy pagebuilder tied to the Edulia PHP theme; elibrary/student_portfolio/gamification have no InfixEdu equivalents (nearest: DownloadCenter + BehaviourRecords points).
8. **Ops observability**: Celery + pgvector vs InfixEdu's cron page + Shuttle DB dump; ASchool's background jobs are real queues.
9. **Code hygiene**: InfixEdu carries `_old`, `- Copy`, `backup`, `XSmClassRoutineNewController`, duplicated `SmStudentAdmissionController_old.php` files and commented-out route blocks (`routes/tenant.php` news/course blocks) — ASchool's manifest-driven structure avoids this drift.
10. **White-label & branding**: ASchool white_label plugin; InfixEdu hard-codes its own branding in installer/about pages (`about-system`, `views/install/welcome_to_infix.blade.php`).

---

## 7. ORGANIZATION LESSONS FOR ASCHOOL (50-plugin sidebar & backend)

1. **DB-driven, school-copyable menu** (§2.2): ship a default menu seed per role (like `default_menus` → `sm_menus` via `SmSchool::insertMenu()`), then let each school reorder/hide via UI (MenuManage equivalent). ASchool's manifest-driven sidebar is a good spine; adding a per-tenant overrides table + reset-defaults gives InfixEdu's flexibility without its runtime fragility.
2. **Menu gating should compose four checks** exactly like InfixEdu's blade guards: (a) role permission on route, (b) plugin enabled, (c) tenant plan/module assignment, (d) feature flag — implement once in the sidebar manifest pipeline instead of scattering.
3. **Separator-based grouping with auto-hide**: InfixEdu renders section separators and hides any empty group client-side (`sidebar-component.blade.php` lines 69–84) — with 50 plugins ASchool should define ~10–12 stable separator groups (mirror of its controller split): Academics (timetable, curriculum, lms, elibrary), Assessment (exams, online exams, question bank, report cards), People (admission, students, staff/hr, alumni), Money (fees, wallet), Operations (library, inventory, hostel, transport, biometric, visitor, dismissal), Safety (emergency, disaster, wellbeing, health, incidents), Communication (notices, SMS, whatsapp, conferences), Site (website builder, basic website), Compliance (iEMIS), System.
4. **One settings spine with per-domain sections**: InfixEdu funnels every config through `Admin/SystemSettings` + a `general_settings` row + domain settings tables (`sm_email_settings`, `sm_sms_gateway`, `sm_payment_gateway_settings`...), each with a settings page. ASchool should ensure each plugin registers exactly one settings section into a unified settings tree (like `optionbuilder.php`), not ad-hoc pages.
5. **Report-card configurability as a feature, not code** (§2.5): adopt a "custom result setting" model — per-school report-card layout definitions rendered by one engine — before Nepali schools each ask for their own format (SEE/NEB makes this even more valuable).
6. **Fees engine completeness**: pick up gaps §5.1–8 in priority order: carry-forward → installments → due-login-block → bank-slip approval → fines/waivers reporting. These are the features every Nepali billing office asks for first.
7. **Per-event notification matrix** (§5.25): a single notification-settings table keyed by system event × channel (push/SMS/email/WhatsApp) replaces per-plugin notification toggles — InfixEdu's `notification_event_modal` pattern is the reference.
8. **Dynamic registration fields per role** (§5.19): needed for iEMIS variance between school types; store as custom-field definitions rather than new migrations.
9. **"Everything prints" discipline**: every list ASchool ships should have a print/export twin route from day one (InfixEdu pairs every report with `/print/...`); bulk-print as a shared capability (IDs, certificates, receipts, payslips) not per-plugin code.
10. **Import pipeline pattern**: template download → temp table preview → commit (`StudentBulkTemporary` → `student-bulk-store`); adopt this three-step UX in ASchool's importers (iemis_importer already has the data; copy the UX).
11. **Global-scope tenancy**: InfixEdu proves that centralizing tenant + academic-year scoping in ORM layers (or Flask equivalents: session-scoped query helpers) keeps 750 endpoints consistent; make `school_id` + `academic_year_id` mandatory indexes at schema review.
12. **Addon hygiene**: InfixEdu's module.json + manifest json (Envato item id) is a simple license/install contract; ASchool's plugin system should formalize: manifest → migrations → routes → menu entries → permissions → settings, so third-party plugins (and internal ones) install identically — and add the dependency/signature checks InfixEdu lacks (§4 weaknesses).
13. **License/entitlement UX without Envato**: InfixEdu couples feature access to Envato purchase codes and per-module manifests; ASchool can do the same job with plan-tier flags on its own billing — but copy the *installation* part (upload zip → migrate → enable → menu appears) as the acceptance test for the plugin SDK.
14. **Print-artifact templates are data, not code**: certificates, ID cards, admit cards, payslips, and invoices in InfixEdu are template rows with layout switchers (`changeAdmitCardLayout`, `set-default-certificate/{id}/{type}`, `invoice-settings` in Modules/BulkPrint) — ASchool's design_studio should absorb these as template objects (canvas-rendered) rather than hard-coded print views.
15. **Academic-year as a first-class axis**: every InfixEdu list/report answers "which year?" via the header switcher + scopes. ASchool must decide explicitly whether its BS-year + AD-year duality replaces this axis, and make every plugin query it from one helper (like `YearCheck::getAcademicId()`), never from raw `date()`.
16. **Search parity**: InfixEdu ships a global content search (`SmSearchController.php`) across students/staff/pages; with 50 plugins, ASchool's sidebar needs this more than InfixEdu does — consider command-palette search over the sidebar manifest (cheap because the manifest already exists).

---

## Appendix A — Key evidence paths (absolute, short-form relative to `upload_extracted/`)

- Route layer: `routes/admin_tenant.php` (main back office), `routes/api.php` (739 legacy mobile), `routes/v2api.php` (223 v2 mobile), `routes/tenant.php` (public site), `routes/pagebuilder.php`.
- Tenancy: `app/Http/Middleware/SubdomainMiddleware.php`, `app/Scopes/SchoolScope.php`, `app/Scopes/AcademicSchoolScope.php`, `app/SmSchool.php`, `app/Helpers/saas.php`.
- Menus: `resources/views/components/sidebar-component.blade.php`, `resources/views/backEnd/menu/staff.blade.php`, `Modules/MenuManage/`, `app/SmSchool.php::insertMenu()`.
- Addons: `app/Http/Controllers/Admin/SystemSettings/SmSystemSettingController.php:3479` (`moduleFileUpload`), `modules_statuses.json`, `Modules/Fees/module.json`, `/tmp`-inspected `RazorPay/{module.json,RazorPay.json}` from `InfixEdu School Modules/`.
- Licensing/install: `app/Http/Controllers/VerifyController.php`, `app/Envato/Envato.php`, `resources/views/install/*`, `config.json`.
- Results engine: `resources/views/backEnd/reports/`, `resources/views/backEnd/examination/`, `app/CustomResultSetting.php`, `app/SmCustomTemporaryResult.php`, `systemSettings/custom_result_setting_add.blade.php`.
- Fees engine: `Modules/Fees/`, `app/SmFeesCarryForward.php`, `systemSettings/feesCarryForward*.blade.php`, `app/Http/Middleware/FeesDueCheckMiddleware.php`.
- Helpers: `app/Helpers/{Helper,Basic,FeesHelper,SmsHelper,EmailHelper,saas}.php`, `app/Support/YearCheck.php`, `app/Support/ModuleRegistry.php`.

## Appendix B — Code quality, security and maintainability notes

- **Dead code shipped**: `app/Http/Controllers/SmStudentAdmissionController_old.php`, `XSmClassRoutineNewController.php`, `app/AbcTest.php`, `resources/views/backEnd/reports/mark_sheet_report_old.blade.php`, `merit_list_report_print.blade copy.php`, `systemSettings/color_theme.blade - Copy.php`, `backEnd/dashboard/addToDo_old.blade.php`; large commented route blocks in `routes/tenant.php` (news/course v1 blocks).
- **Exception handling**: pervasive `try { … } catch (Exception) { Toastr::error('Operation Failed'); return back(); }` (see `VerifyController.php`, `app/Helpers/Helper.php::dateConvert`) — errors are swallowed rather than logged/re-thrown; makes debugging and data-integrity auditing hard.
- **Security surface**:
  - Addon upload (`moduleFileUpload`) extracts an admin-supplied zip straight into `Modules/` and runs its migrations — intended feature, but a compromised admin account gains arbitrary PHP execution; no signature verification.
  - `moduleFileUpload` has its outer `try` block commented out (`/* try { */ … /* } catch */`) — exceptions escape raw.
  - CSRF/CORS/HTTPS middlewares exist (`VerifyCsrfToken`, `Cors`, `HttpsProtocol`), and an `XSS` input-filter middleware; OAuth/Laravel Passport tables are migrated for API tokens.
  - License data stored in plain settings rows (`system_purchase_code`, `envato_user`) — trivially copyable between installs.
- **Schema churn**: migrations show heavy incremental patching (e.g., `2025_04_29_130721_add_default_sm_menus_data.php`, `2026_01_20_113910_shift_menu_fix_on_sm_menus_table.php`, repeated mark-sheet-menu dedupe migrations `2026_06_22_000002`, `2026_07_23_112206`, `2026_07_26_000001`) — menu data integrity is maintained by ever-more migration patches rather than idempotent seeds.
- **Naming inconsistency**: legacy `App\Sm*` root models vs `App\Models\*` (191 files) both active; `SmPaymentMethhod` (sic), `SmStaffAttendence` (sic) — two generations of conventions coexist.
- **i18n depth**: translations are largely DB phrase rows (`sm_language_phrases`) keyed by English strings, with per-menu `lang_name` keys; blip risk: phrase table must exist per school (`resources/var/defaults.json` lists seeded tables).
- **Performance posture**: menu cached per user/school 600s (`getMenus` in `app/Helpers/Basic.php`), per-school chat settings valuestore; no queue usage in core (jobs folder exists but thin); DB dumps via PHP (`Shuttle_Dumper`) instead of native tooling — fine on small schools, risky at scale.
