# Competitor Deep Audit: InstiKit School v5.5.0 (ScriptMint)

**Product:** InstiKit Premium — "Most Comprehensive School/College/Institute/Academy Management Kit", CodeCanyon-style self-hosted ERP, vendor ScriptMint (scriptmint.com, instikit.com). First release 13 July 2018; v5.5 released 16 Dec 2025.
**Audited copy:** `Other Projects/InstiKit School v5.5.0 Nulled/InstiKit School v5.5.0 Nulled/instikit-most-comprehensive-school-college-institute-and-academy-management-kit_x/instikit-most-comprehensive-school-college-institute-and-academy-management-kit/` (referred to below as `INSTIKIT/`)
**Audit date:** 2026-09-11

**STACK CORRECTION (important):** the working brief described InstiKit as "WordPress-based school kit (WP theme + plugins)". **It is not WordPress at all.** v5.5.0 is a **Laravel 12 + Vue 3 SPA + Tailwind CSS 4** application (Laravel 12 confirmed in `INSTIKIT/composer.json` and the v5.3 changelog entry "Laravel 12 upgrade, Tailwind CSS 4 upgrade"; v4.0.0 changelog: "Rewritten from scratch with latest version of Laravel, Vue.js & Tailwind CSS"). There are no CPTs, no shortcodes, no WP themes, no plugin marketplace. This audit therefore treats it as what it is: a monolithic self-hosted school ERP with a built-in public website builder — arguably a closer competitor to ASchool than a WP kit would be. All "WP patterns" questions below are answered as "architecture patterns" against the real code.

**Stack in one line:** PHP 8.2 / Laravel 12, MySQL, Sanctum token auth, spatie/laravel-permission (with team support), Vue 3 SPA (prebuilt, 957 code-split JS chunks in `public/build/assets/`, source not shipped), minimal Livewire (2 components: `app/Livewire/Counter.php`, `app/Livewire/Query.php`), Laravel Folio not meaningfully used, Blade only for the public site + print/report templates (182 blade views), Horizon queues (`.env` ships `QUEUE_CONNECTION=sync`), Pusher broadcasting, mpdf + spatie/browsershot for PDFs, maatwebsite/excel for import/export, Twilio, Razorpay/Stripe SDKs. Distribution model: **one install = one organization** (Envato Regular/Extended license per `INSTIKIT/README.md`; a "nulled" copy with no license-check code found anywhere under `app/`).

**Headline numbers:**

| Metric | Count | Source |
|---|---|---|
| Route statements | 1,410 (1,197 are explicit verbs get/post/patch/put/delete) | `INSTIKIT/routes/` (17 route files + 31 module files) |
| Controllers | 699 | `app/Http/Controllers/` |
| Models | 224 | `app/Models/` |
| Service classes | 696 (the real business logic lives here) | `app/Services/` |
| DB migrations | 236 (~200 tables) | `database/migrations/` |
| Blade views | 182 | `resources/views/` |
| SPA JS chunks | 957 (Vite code-split, ~1 chunk per screen/action) | `public/build/assets/` |
| Export/Import classes | 39 | `app/Exports/`, `app/Imports/` |
| Admin modules in menu | 33 top-level | `resources/var/modules.json` |
| Roles | 17 predefined | `resources/var/permission.json` |
| Payment gateways | 10 + bank transfer + guest/anonymous payment | `app/Services/Finance/PaymentGateway/` |
| Languages | en only (extensible via `lang/`, runtime locale sync endpoint) | `lang/en/` |

**Audit method & scope:** read in full or in large part — `INSTIKIT/routes/app.php` (232 lines, the authenticated API), `routes/guest.php` (76 lines, public funnel), `routes/api.php`, `routes/site.php`, `routes/integration.php`, `routes/report.php`, `routes/web.php`; all 236 migration filenames; `resources/var/modules.json`, `resources/var/permission.json`, `resources/var/config.json` (37 config groups incl. 14 feature flags); `app/Services/SiteService.php` (273 lines, website builder); `app/Enums/Site/BlockType.php`; `app/Models/Team.php`, `app/Models/Device.php`, `app/Models/Exam/OnlineExamQuestion.php`, `app/Models/Exam/*` (14 models); `app/Http/Controllers/SiteController.php` and the `Site/` controllers; print template trees under `resources/views/print/`; gateway services under `app/Services/Finance/PaymentGateway/`; `.env`, `README.md` (full version log v4.0→v5.5). ASchool claims were verified against `backend/app/plugins/modules/` (44 plugin dirs), `backend/app/api/v1/` (60 route files, 706 route decorators), `backend/README.md`, and `docs/competitor-audits/eschool-v3.3.6.md`. `vendor/` was skipped.

---

## Deep re-audit (v2) — implementation-level (2026-09-12)

- **v2 status**: covered route coverage (routes/app.php, guest.php, site.php, report.php, integration.php, api.php, modules/finance.php, modules/exam.php, modules/site.php + RouteServiceProvider/Kernel middleware map), five end-to-end traces (fee engine incl. all nine payment services + allocation/concession actions; admission funnel incl. conversion + enrollment seats; day closure/day book; approval engine + edit requests; site builder internals incl. export controllers), seven comparison tables (fee, admission, day closure, approval, site blocks, exam ops, timetable), 13 v2 findings, adoption designs for A-09/A-22/A-24/A-25/A-15. Remaining: none for the assigned scope (guest.php read line-by-line; remaining 29 route/modules files only pattern-scanned, not line-by-line — same controller→service skeleton throughout; ASchool hr_payroll/inventory/library/visitor compared at endpoint-surface level only).

### v2-R. Route coverage — middleware map and controller→service skeleton

`app/Providers/RouteServiceProvider.php` is the single router; every route file is mounted with an explicit middleware stack:

| File | Mounted as | Middleware (from RouteServiceProvider.php boot()) |
|---|---|---|
| `routes/api.php` | `/api/v1/*` | `api, user.config` (+ per-route `optional.auth:sanctum`) |
| `routes/integration.php` | `/api/v1/*` | **`api, user.config` only — no auth at group level**; device token checked inside services |
| `routes/guest.php` | `/api/v1/*` | `api, guest` (guest = `RedirectIfAuthenticated`, effectively a no-op for token clients; several routes call `withoutMiddleware(['guest'])`, `routes/guest.php:20-28`) |
| `routes/app.php` | `/api/v1/app/*` | `api, auth:sanctum, two.factor.security, screen.lock, under.maintenance, user.config` |
| `routes/chat.php` | `/api/v1/app/chat/*` | same + `permission:chat:access` |
| `routes/modules/*.php` (31) | `/api/v1/app/*` | same; per-route-group `permission:` added inside each file |
| `routes/exports/*.php` + `export.php` | `/api/v1/app/*` | `web, auth:sanctum, …, export` |
| `routes/site.php` | `/` | `web, site.enabled` + runtime check `config('config.site.enable_site') && theme != 'custom'` (`routes/site.php:14`) |
| `routes/report.php` | `/reports/*` | `web, auth:sanctum, user.config, permission:access:reports` |
| `routes/gateway.php` | `/` | `web` only (gateway return pages) |

Rate limiters (`RouteServiceProvider.php::configureRateLimiting`): `api` 60/min per user-or-IP; `auth` 5/min; `otp` 3/min; `biometric` 10/min **global (no `by()` key)**; `timesheet` 3/min per user.

Route-shape convention (uniform across all 31 module files): every resource gets `GET <name>/pre-requisite` (dropdown/option payload) + `apiResource`; state changes are dedicated verbs, e.g. `routes/modules/finance.php:66` `POST day-closure` (invokable `MarkDayClosureController`), `:91-92` `POST fee-structures/{fs}/allocation` + `DELETE fee-structures/{fs}/allocations/{allocation}` (invokable/`FeeStructureActionController`), `routes/modules/exam.php` `POST schedules/{schedule}/unlock-temporarily`, `PATCH schedules/{schedule}/toggle-publish-admit-card`. Controllers are 1-3 line delegators to `app/Services/<Domain>/*Service.php`; validation lives in `app/Http/Requests/*` for writes and inline `$request->validate()` in services for actions.

`routes/app.php` (232 lines) essentials: organizations/teams CRUD (`:47-63`), team config store `GET|POST teams/{team}/config`, permission assignment role-wise/user-wise (`:58-62`), user status/impersonation (`:66-75`), attendance QR fetch+mark (`:97-103`), profile group behind `test.mode.restriction` (`:105-123`), 13 dashboard widget endpoints (`:132-144`), global search (`:147`), config fetch/store + 5 throttled connectivity tests (`:151-193`), options CRUD+import+reorder behind `option.verifier` (`:196-201`), custom fields, comments, todos (kanban verbs `:210-220`), backups, activity logs, media.

### v2-T1. Trace A — Fee engine (16 tables → 9 payment services)

**Schema chain** (all `database/migrations/`): `fee_groups` (2023_05_31_093350; `meta->is_custom` marks custom groups; code/shortcode added 2025_07_23_112145) → `fee_heads` (2023_05_31_093534; `is_tax_applicable`, `tax_percentage`, later `tax_id` FK + `voucher_number_prefix`) → `fee_components` (2025_07_23_112540; sub-components of a head) → `fee_structures` (2023_06_06_045931; period-scoped) → `fee_installments` (2023_06_06_045955; `fee_group_id`, `transport_fee_id`, `due_date`, `late_fee` JSON, `meta->is_custom`) → `fee_installment_records` (2023_06_06_050012; head + amount + `is_optional`) → `fee_structure_components` (2025_07_25_064347; per-installment-record component amounts). Allocation: `fee_allocations` (2023_06_06_050028; `fee_structure_id` + `course_id` OR `batch_id`). Realization: `student_fees` (2023_07_21_155629; one row per student × installment; carries `transport_circle_id`, `fee_concession_id`, `transport_direction`, denormalized `total/paid/additional_charge/additional_discount`, `due_date` override, `meta`) → `student_fee_records` (2023_07_21_155654; per head, `amount/paid/concession`, `default_fee_head` for non-head rows like late fee/transport) → `student_fee_payments` (2023_09_23_101230; per transaction × head with `concession_amount`). Money: `transactions` (2023_05_29_014604; polymorphic `transactionable`, `category_id` option, `is_online`, `processed_at`, `cancelled_at/rejected_at` + remarks, `payment_gateway` JSON, `failed_logs` JSON), `transaction_payments` (2023_05_29_061344; ledger + payment method + `details` JSON incl. instrument/clearing), `transaction_records` (2023_05_29_014621; secondary ledger + model morph + direction). Concessions `fee_concessions`/`fee_concession_records` (2023_06_05_071845/071948; `type` percent/amount, `meta->secondary_type/secondary_value`), refunds `fee_refunds`/`fee_refund_records` (2023_09_24_030008/030846), transport `transport_fees`/`transport_fee_records` (2023_06_05_053550/053616; arrival/departure/roundtrip amounts per circle).

**Allocation math** (`app/Services/Student/FeeAllocationService.php`): `allocate()` `:245-374` — resolve structure: batch-level `FeeAllocation` first, else course-level (`:298-302`); refuses if any selected student already has `fee_structure_id` (`:293-295`); per student derives `is_new_student` (joining_date == start_date, `:328`) and gender flags (v5.0 gender-wise structures), then `AssignFee` → `AssignFeeInstallment` per installment (`app/Actions/Student/AssignFee.php:38-49`), stamps `student.fee_structure_id` + `meta->fee_allocation_batch`. **Concession order** (`app/Actions/Student/CalculateFeeConcession.php`): primary concession from `fee_concession_records.type/value` on head amount → if concession `meta->enable_secondary_concession` (v5.5), secondary concession from record `meta->secondary_type/secondary_value` computed on the **after-primary** remainder (`:30-41`); round-off via `config.finance.enable_round_off_fee_concession` + `concession_round_off_type` (round before/after subtraction — legacy block `:47-66`). Concession re-assignment skips students with payments (`updateConcession`, `FeeAllocationService.php:519-521`), custom concessions (`meta->has_custom_concession`) and installments flagged `has_no_concession` (v4.10 per-installment restriction). Transport fee heads get amount+concession recomputed via `GetTransportFeeAmount`/`GetTransportConcessionFeeAmount` (`:547-569`).

**Payment application** (`app/Actions/Student/PayFeeInstallment.php`): first asserts installment consistency — sum(records.amount − records.concession) == total − additional_charge + additional_discount, else abort (`:18-27`); balance = total − paid (+ `meta->custom_late_fee` amount if a cashier overrode late fee); caps at remaining cash; writes `TransactionRecord` (morph StudentFee, direction 1) including additional charge/discount in the first installment only; fans out per record via `PayFeeHead` (skipping LATE_FEE), then `PayLateFee`, `PayAdditionalCharge/Discount`; finally bumps `student_fees.total/paid/additional_*` and returns leftover cash to the next installment (waterfall across installments). **Due/installment logic** (`app/Actions/Student/GetPayableInstallment.php`): ordering by `COALESCE(student_fees.due_date, fee_installments.due_date)` (`:160-171`); per-installment `calculateLateFeeAmount` (late_fee JSON on installment); late fee can only be lowered, and only with permission `fee:customize-late-fee` (`:45-60`); paying a later installment is blocked while an earlier one is due unless config `student.allow_flexible_installment_payment`/`allow_multiple_installment_payment` + matching permission (`:146-190`); partial payment requires `fee:partial-payment` (`:216-227`); additional charges force full-payment semantics (`:196-215`).

**The nine payment services** (`app/Services/Student/`):
1. `PaymentService.php` (865) — the staff/self engine: `makePayment` `:217-285` runs `CheckPaymentEligibility` → `GetStudentFees::validatePreviousDue` → `GetPayableInstallment` → `CreateTransaction` → `PayFeeInstallment` waterfall → `ValidateFeeTotal` inside one DB transaction, then queues `SendFeePaymentConfirmedNotification`. Also receipt edit with team-scoped duplicate receipt-number check (`:319-334`), and cancel/reject (`:434-591`): `CancelTransaction`, optional **rejection charge posted as a custom fee head** (`CreateCustomFeeHead`, `:483-494`), reverses `student_fees` totals from transaction records (`:496-514`), flips linked `BankTransfer` to rejected (`:516-530`), walks back each `student_fee_records.paid` with LATE_FEE record deletion (`:532-582`), `ValidateFeeTotal` skipped only for `is_default` users with `force_cancel` (`:584-588`). QR payment links: `storeTempPayment` `:174-215` → `TempStorage` row + `config.student.payment_link_qr_code_expiry_duration` (default 10 min) rendered as QR.
2. `OnlinePaymentService.php` (236) — gateway flow: `initiate` `:31-120` validates date/amount/gateway, resolves **per-academic-unit gateway account** `pg_account` cascade feeGroup.meta → division → course → batch (`:59-73`), reference = `strtoupper(date('ymd').Str::random(10))`, `CreateTransaction` with `is_online=true` (no receipt number yet), stores `meta->student_fee_ids`. `makePayment` `:122-137`: begin tx → `gateway->confirmPayment` → already-processed guard → `PayOnlineFee::studentFeePayment` → commit. `PayOnlineFee` (`app/Actions/Student/PayOnlineFee.php`) re-validates: `dualBalanceValidation` (`:78-93`, balance ≥ amount), waterfall, then `dualVerification` (`:96-112`: sum(TransactionRecords)==sum(TransactionPayments)==transaction.amount) before assigning the receipt number and `processed_at`. Status-refresh for statement gateways re-enters via artisan commands (`\Artisan::call($gatewayName.':status')`, `:180-183`/`:232-234`).
3. `HeadWisePaymentService.php` (39) — pay by arbitrary heads (no installment context) via `HeadWisePayment` action.
4. `MultiHeadWisePaymentService.php` (18) — **stub**: throws `feature_under_development` (`:19`).
5. `GuestPaymentService.php` (116) — lookup = team + period + course + (admission code_number **OR exact full name**) + birth_date; multiple matches abort (`getStudent` `:76-115`).
6. `AnonymousPaymentService.php` (250) — QR-link redemption: validates TempStorage type whitelist (`student_fee_payment|registration_fee_payment`, `:26-28`), expiry only enforced in production unless `meta->is_system_generated` (`:24-27`), re-derives balances incl. late fee and refuses if stored amount ≠ computed balance (`:150-160`).
7. `RegistrationPaymentService.php` (233) — offline registration-fee bookkeeping: skip→`NA`, partial→`PARTIALLY_PAID`, cancel→`UNPAID`.
8. `OnlineRegistrationPaymentService.php` (203) — registration fee **must equal `registrations.fee` exactly**; head `registration_fee`; complete → `PayOnlineFee::registrationFeePayment` (needs a batch to exist for the course).
9. `GuestRegistrationPaymentService.php` (14) — **empty stub** (`preRequisite()` returns `[]`).

**Shared gateway contract**: `app/Contracts/Finance/PaymentGateway` (`isEnabled/initiatePayment/confirmPayment/failPayment/getName/getVersion`) with 10 implementations in `app/Services/Finance/PaymentGateway/` and per-gateway refresh actions in `app/Actions/PaymentGateway/`. Receipt rendering math (due/concession/paid columns, amount-in-words) in `PaymentService::getPaymentRows` `:593-864`.

### v2-T2. Trace B — Admission funnel (`routes/guest.php` end-to-end)

- **Online enquiry** (`routes/guest.php:31-38`, flag `feature.enable_online_enquiry`): `OnlineEnquiryController` → `app/Services/Reception/OnlineEnquiryService.php`: cascades teams → programs/periods (only where `config->enable_registration`) → courses → batches (`:77-127`); `create` `:129+` = `CreateContact` + `Enquiry` forceCreate with code number from `config.reception.enquiry_number_*`, plus `enquiry_records` (per-child rows) and `enquiry_follow_ups` (stage option, next follow-up date, user) — tables 2023_08_06_113244/113257, 2024_07_23_071609.
- **Registration wizard** (`routes/guest.php:40-65`, flag `feature.enable_online_registration`) → `app/Services/Student/OnlineRegistrationService.php`: `initiate` `:225-280` = `CreateContact` + `Registration` (table 2023_07_11_054250: `contact_id/period_id/course_id/fee/payment_status/status/is_online`) with status `INITIATED`, meta `{email_otp: 6-digit, contact_number_otp, verification_token: Str::random(32), application_number: Ymd+8random}`; `payment_status = UNPAID` iff registration fee configured. Verification: `confirm` `:328-361` (verification_token + email_otp → sets `meta->auth_token` 32-char valid 60 min); returning applicants: `find` `:363-395` (application_number + email → fresh 10-min OTP), `verify` `:397-430` (otp + expiry → auth_token). All later steps require `auth-token` header matched against `meta->auth_token` + expiry (`findByUuidOrFail` `:432-450`): `updateBasic` (contact fields, per-team options validated, `config->basic_updated`), `updateContact` (address JSON; refuses unless basic done `:511-514`), photo upload/remove (media token), `uploadFile` (documents; `config->file_uploaded`), `updateReview` `:566-590` (assigns registration code number from `config.student.registration_number_*`, status → `PENDING`, submitted notification). `initiateMinimal` `:282-326` skips verification entirely: immediate code number + `PENDING` (v5.5 minimal variant). Registration enum statuses: initiated/verified/pending/approved/rejected (`app/Enums/Student/RegistrationStatus.php`; staff UI filters out initiated/verified, `RegistrationActionService.php:55-59`).
- **Registration fee payment** (`routes/guest.php:61-64`): `OnlineRegistrationPaymentController` → service #8 above; guest-variant endpoints `:26-28` route to the **stub** service #9. Offline paths via service #7.
- **Admission conversion** (staff, `routes/modules/student.php` → `app/Services/Student/RegistrationActionService.php::action` `:188-213`): reject (status+remarks+rejected_at, `:215-221`) / undo-reject / approve `:231-421` — all inside one DB transaction: registration → `APPROVED` (+`meta->admitted_by`); `Admission` forceCreate (table 2023_07_11_054351: `registration_id`, `batch_id`, `joining_date`, `is_provisional` with its **separate provisional number series** `:285-318`); code number validated for duplicates and format-parseable, `%GENDER%` token substituted from contact gender (`:136-139`); `Student` forceCreate with `enrollment_type_id`; optional `assign_fee` (batch-or-course `FeeAllocation` → `AssignFee`), elective subjects (`subject_wise_students`), groups; optional `create_user_account` (User + `assignRole('student')`, **plaintext password passed into the notification job payload** `:412-420`); `UpdateEnrollmentSeat` recount; registration custom fields copied onto contact (`:423-452`); queued approval notification.
- **Seat caps**: `enrollment_seats` (2025_04_07_044606: `course_id`, `enrollment_type_id`, `max_seat`, `booked_seat`). `app/Actions/Academic/UpdateEnrollmentSeat.php` only **recounts** `booked_seat` after admission; grep across `app/` shows `max_seat` is used exclusively in Resources (available_seat display, `app/Http/Resources/Academic/EnrollmentSeatResource.php:25`) and validation of the CRUD form — **capacity is never enforced at conversion time** (see V2-02).

### v2-T3. Trace C — Day closure / day book / vouchers

- `day_closures` (2025_08_28_071958): `date, team_id, user_id, denominations JSON, total, status, approved_at, remarks, meta`.
- **Marking** (`POST finance/day-closure`, `routes/modules/finance.php:66`, permission `transaction:read|fee:payment` → `MarkDayClosureController` → `app/Services/Finance/MarkDayClosureService.php::markDayClosure`): date ≤ today; `denominations` list validated against `config.finance.currency_denominations`; computed cash `Σ(count × denomination)` must equal submitted `total`; **collected amount** = Σ `TransactionPayment` where transaction.date = date AND `transactions.user_id = auth()->id()` AND succeeded AND method name = 'Cash' (`:44-53`); on mismatch a `reason` is mandatory and `meta->is_amount_mismatch` is stored (`:55-61`); one closure per user+date (`firstOrCreate`, duplicate guard `:63-69`); status → `SUBMITTED` (`app/Enums/Finance/DayClosureStatus.php`: submitted|approved; approval stamped by `approved_at` via the manage role).
- **Counter-accountability loop**: after a user closes their day, `app/Actions/Student/CheckPaymentEligibility.php:17-26` blocks that user from recording any further payment for the same date ("could_not_make_payment_after_closure") — closing the till physically locks the cashier until an admin deletes the closure. Deletion guard: cannot delete a closure when a later closure exists for the same user (`app/Services/Finance/DayClosureService.php::deletable`); destroy additionally behind `permission:day-closure:manage` + `test.mode.restriction` (`app/Http/Controllers/Finance/DayClosureController.php::__construct`).
- **Day book**: `reports/day-book` (`routes/modules/finance.php:106-107`, permission `transaction:read`) → `app/Services/Finance/Report/DayBookListService.php` — voucher rows (code number, primary ledger from `transaction_payments.ledger`, secondary counterparty from `transactionable`, course/batch, payment & receipt columns, **user column**, created_at) + `DayClosureController::getDateWiseCollection` (user-wise cash total). `app/Services/Finance/Report/DayBookService.php` is an empty pre-requisite shell.
- **Vouchers/cheque clearing**: `transactions.category_id` (option) + `type` receipt/payment + `head` + `voucher_number_prefix` per fee head (2025_07_23_112145); clearing date update is a dedicated endpoint `POST transactions/{transaction}/clearing-date` (`routes/modules/finance.php:56` → `TransactionActionController::updateClearingDate`); transaction import behind `permission:transaction:create` (`:58`).

### v2-T4. Trace D — Generic approval engine + edit requests

- Tables (2025_05_10_094605/094618/094630): `approval_types` (`name, category, event, team_id, priority_id, department_id, published_at, config`), `approval_levels` (`type_id, designation_id OR employee_id, position, config.actions`), `approval_requests` (code-number series, `title`, polymorphic `model`, `type_id`, priority/group/nature options, vendor ledger, `request_user_id`, `amount, date, due_date, status`, plus payment/contact/vendors/items JSON buckets).
- **Declaring a workflow**: `TypeService` creates type + ordered levels; each level carries `config.actions` = the statuses its assignee may set.
- **Who approves**: `app/Models/Approval/Request.php::getAllowedActions` `:220-241` — resolves the current user's `Employee`, finds their level, returns `config.actions`; no level → no actions. `isActionable()`/`scopeFilterAccessible` (`:172-199`) restrict visibility to requester + level assignees.
- **Transitions** (`app/Services/Approval/RequestActionService.php::updateStatus`): status enum `requested/returned/hold/approved/rejected/cancelled` (`app/Enums/Approval/Status.php`); comment required unless approving; `HOLD` freezes at the current record; `APPROVED` marks the current `RequestRecord` processed and activates the **next** record (`status=requested`, `received_at=now`, `processed_at=null`) — request becomes `APPROVED` only when the last record approves; `RETURNED` rewinds records from a chosen level (or to the requester, resetting all records, `updateReturnTo` `:234-272`); cancel propagates to records (`:32-52`).
- **Domain side effects by event**: on final approval, category `EVENT_BASED` types dispatch on `type->event` — `STUDENT_TRANSFER` executes `TransferStudent` action with meta (transfer certificate number, reason, remarks) (`:152-172`). This is the engine's extension point: one row per workflow, domain action per event name.
- **Edit-request pattern**: `contact_edit_requests` (2024_01_25_131758: `user_id`, polymorphic `model`, `data` JSON, `status, processed_at, comment, meta`) + `app/Services/Student/ProfileEditRequestService.php` / `EditRequestService.php` / `EditRequestActionService.php` (employee equivalents): students/guardians submit field-level change sets as JSON; staff approve → applied; `RequestRecord` model shared with the approval engine for the audit trail.

### v2-T5. Trace E — Website+portal fusion internals (`app/Services/SiteService.php`, 273 lines)

- **Resolution**: `getPage(?slug)` `:19-130` — slug defaults `Home`; menu lookup by slug; `Home` missing → redirect to portal `route('app')`; unknown slug → **404** (not portal redirect — the portal redirect happens when the menu exists but has **no `page_id`**, `:35-37`); breadcrumbs from `site_menus.parent_id` + current (`:43-53`); SEO strings read from page `seo` JSON (`meta_title/description/keywords`, `:55-57`); site address injected from config (`:59-70`).
- **Markdown parsing rules**: content → `MarkdownParser::parse(skip_embedded_links: true)` → layout markers expanded by regex on the rendered HTML: `#CONTAINER#` pairs → `<div style="margin:40px 0"><div class="flex-col flex md:flex-row gap-2">…</div></div>` (`:76`), `#SECTION#` pairs → margin-wrapped `<div>` (`:78`) — markers must survive markdown as `<p>#MARKER#</p>`.
- **Block syntax** (`getParts` `:175-215`): newlines stripped; content split at `<p>##`; a marker paragraph `##name1## ##name2##` becomes part `{type:'array', content:[names]}` (block placeholder); the rest is split into top-level elements via DOMDocument (`getTopElements` `:146-173`); a paragraph that is only a bare URL becomes an embed typed by host — youtube/x.com/twitter/facebook (`getLinkProvider` `:217-230`), YouTube ID extracted from `?v=` or `youtu.be` path (`:261-272`); everything else stays `{type:'html'}`.
- **Hydration**: blocks fetched `whereIn(name, referenced)` excluding `type='slider'`, ordered by `position` (`:84-92`); `menu_id`-linked blocks render as internal links (`target_url=_self`, route to menu slug, `:100-103`); sliders are page-level (`page.meta->has_slider` + `meta->slider` = block uuid; images from block `slider_images` meta with public storage paths, `:108-127`).
- **SPA read API**: `getPageView` `:132-144` (route `GET /api/v1/app/pages/{slug}`, `routes/api.php:28`) returns parsed markdown for pages where `seo->is_public` is true and `seo->slug` matches — per-page SEO JSON doubles as the publication flag/alias.
- **Schemas**: `site_pages` (name/title/sub_title/`content longtext`/assets/seo/analytics/config/meta — 2024_06_26_060104), `site_menus` (position/name/slug/placement/parent_id/page_id/is_default — 2024_06_26_060327), `site_blocks` (position/name/title/sub_title/`menu_id`/`type`/content/assets/config/meta — 2024_06_26_060525). Block types: only `slider, accordion, stat_counter, testimonial` (`app/Enums/Site/BlockType.php`); CTA/announcement/event/gallery/news/blog come from theme blades.
- **Export controllers corrected**: `app/Http/Controllers/Site/BlockExportController.php` and `PageExportController.php` are thin invokables calling `ListService->list()` + `ListGenerator::export()` (`app/Contracts/ListGenerator.php:18-28` → `view()->export(...)` = Excel/PDF print of the admin list). They are **report exports, not portable preset bundles** — v1 §6.13's "pages and blocks export as files and re-import into any install" is wrong; there is no import-side counterpart for site content.

### v2 comparison tables

**Fees**

| Aspect | InstiKit v5.5 (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|---|
| Data model | 16-table chain: structure→installments→realization→payments (`database/migrations/create_fee_*.php`) | `FeeStructure` w/ JSONB `fee_items`, flat `FeeCollection` per item, `FeeReceipt`, `FeeRefund`, `PaymentInitiation`, `StudentScholarship` (`backend/app/models/fee.py:21-208`) | They model installments/due-dates/head-level paid+concession; we model cycles (BS month/year markers) with partial-paid extraction (`backend/app/api/v1/fees.py:2004-2545`) | **adapt**: keep our BS-cycle billing; add a per-collection line-item ledger (their `student_fee_records` shape) for head-level dues |
| Concession | Primary + secondary (v5.5) concession on after-primary remainder, round-off config, skip-if-paid guard (`app/Actions/Student/CalculateFeeConcession.php:18-41`; `FeeAllocationService.php:519-521`) | `StudentScholarship` percent/fixed w/ validity window, auto-applied at generation (`backend/app/models/fee.py:188-208`; `_apply_fee_structure` `backend/app/api/v1/fees.py:2338+`) | They: head-targeted, multi-layer, payment-aware. We: student-level, single-layer | **adopt** secondary layer + "skip if any payment exists" guard |
| Late fee | Per-installment `late_fee` JSON + `calculateLateFeeAmount`, cashier-overridable down with `fee:customize-late-fee` (`GetPayableInstallment.php:45-60`) | `late_fine_amount` column on collection (`backend/app/models/fee.py:71`) | They compute per due date at pay time; ours is manual | **adopt** computed late fee keyed on `_collection_due_date` (`fees.py:2545`) |
| Overpay/underpay guards | balance ≥ amount, partial-payment permission, previous-installment-due block (`GetPayableInstallment.php:216-227, 146-190`) | outstanding ≤ 0 → "already paid"; partial tracked via `_extract_partial_paid` (`fees.py:1424-1428`) | We lack permission-graded partial payment and sequencing rules | **adapt** |
| Double-entry | `transaction_payments` (primary ledger) + `transaction_records` (secondary) with `updatePrimary/SecondaryBalance`, dual-verification sums (`app/Actions/Finance/CreateTransaction.php:86-115`; `PayOnlineFee.php:96-112`) | No ledger concept; receipts + gateway refs only (`backend/app/models/fee.py:94-126`) | They have a real mini double-entry; Nepali accountants expect it | **adopt** (see A-24 design) |
| Payment contexts | 9 services, 1 gateway contract (`app/Services/Student/*Payment*Service.php`) | 1 initiation path + parent variant (`_initiate_online_payment` `fees.py:1792`) | Our `PaymentInitiation` already covers their initiate/complete/fail shape; contexts are missing | **adopt** context column + per-context services (A-22) |
| Gateways | 10 (Razorpay/Stripe/…), artisan status-refresh commands | eSewa/Khalti/FonePay w/ refunds + idempotency (`backend/app/plugins/modules/fees/manifest.yaml`) | We win for Nepal; their per-academic-unit `pg_account` cascade is novel | **adopt** pg_account cascade |
| Counter ops | Day closure blocks cashier payments (`CheckPaymentEligibility.php:17-26`) | None | Missing entirely | **adopt** (A-24) |

**Admission funnel**

| Aspect | InstiKit (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|---|
| Stages | enquiry → registration (wizard: verify → basic → contact → docs → review) → (+fee) → admission, statuses initiated/verified/pending/approved/rejected (`routes/guest.php:31-65`; `OnlineRegistrationService.php:225-590`) | `AdmissionInquiry` → `AdmissionApplication` (submitted→…→enrolled) → manual enrollment (`backend/app/models/admission.py:19-80`; `backend/app/api/v1/admission.py:49-338`) | They have an unauthenticated online wizard with OTP re-entry; ours is staff-side CRM only | **adopt** (A-09) |
| Identity continuation | `application_number` + email → 10-min OTP → `meta->auth_token` (60 min) gates every subsequent PATCH (`OnlineRegistrationService.php:363-450`) | None (no public application API) | Their pattern = stateless, no accounts needed | **adopt** verbatim |
| Seat caps | `enrollment_seats.max_seat` **display-only**, recounted post-admission (`app/Actions/Academic/UpdateEnrollmentSeat.php`) | `AdmissionForm.max_seats/filled_seats` (`backend/app/models/admission.py:29-30`) — check enforcement in `create_application` | Both weak; we can be first to enforce atomically | **adopt** with row locking |
| Registration fee | exact-amount online payment before review; offline partial/skip (`OnlineRegistrationPaymentService.php:81-84`; `RegistrationPaymentService.php:63-233`) | None | Revenue lever at intake | **adopt** (A-22) |
| Conversion | single transaction: registration→Admission+Student+fee allocation+account creation (`RegistrationActionService.php:291-408`) | `status → enrolled` transition (`admission.py:266-318`) | They create the student + fee allocation + portal account atomically | **adopt** transactional convert |

**Day closure**

| Aspect | InstiKit (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|---|
| Cash counting | denomination config + count matrix, Σ=total enforced (`MarkDayClosureService.php:9-40`) | None | — | **adopt** |
| Mismatch handling | reason mandatory + `is_amount_mismatch` meta (`:55-61`) | None | Theirs tolerates honest variance with audit | **adopt** |
| Enforcement | payment blocked for that user+date (`CheckPaymentEligibility.php:17-26`) | None | The actual control | **adopt** |
| Deletion guard | no deleting when a later closure exists (`DayClosureService.php:33-43`) | None | — | **adopt** |
| Day book | user-wise voucher listing + date-wise collection (`routes/modules/finance.php:106-107,70`) | `list_collections` w/ CSV export (`fees.py:1032-1128`) — no per-cashier view | Add user_id facet | **adapt** |

**Approval engine**

| Aspect | InstiKit (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|---|
| Declaration | types → ordered levels (role **or** employee) with per-level `config.actions` (`create_approval_levels_table.php`; `Request.php:220-241`) | Bespoke per-feature states: payroll approve (`backend/app/api/v1/hr_payroll.py:364`), expenses, procurement approve (`inventory.py:233`), visitor appointment approve (`visitor.py:230`) | We re-implement approval per module | **adopt** generic engine (A-25) |
| Transitions | requested→(hold/approve/return/reject), next-record activation, return-to-level/requester (`RequestActionService.php:62-190`) | Single boolean approve endpoints | Multi-level + return + hold missing | **adopt** |
| Side effects | event-driven domain action on final approval (`:152-172` TransferStudent) | Direct state mutation in each endpoint | Wire via our plugin `emit()` bus instead | **adapt** |
| Edit requests | `contact_edit_requests` data-JSON diff with approve (`2024_01_25_131758`) | None (`backend/app/api/v1/users.py` has no request flow) | Self-service correction | **adopt** (fold into A-25) |

**Site builder / blocks**

| Aspect | InstiKit (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|---|
| Page model | markdown content + `#SECTION#/#CONTAINER#` regex + `##block##` placeholders (`SiteService.php:76-215`) | structured sections JSONB w/ per-section CRUD/reorder/draft/history (`backend/app/api/v1/website_builder.py:31-705`) | Ours is richer and safer (no regex-on-HTML); keep ours | **reject** their parsing; **adopt** naming/position model |
| Reusable blocks | named `site_blocks` rows with `menu_id` → deep links, position, assets, 4 types (`site.php` module routes; `BlockType.php`) | per-page sections only; `list_available_sections` catalog (`website_builder.py:691`) | Reusable named blocks = marketplace SKU unit | **adopt** (A-15) |
| SEO | per-page `seo` JSON incl. `is_public`/`slug` as publication switch (`SiteService.php:132-144`) | `get_seo_settings/update_seo_settings` (`website_builder.py:846-925`) | Parity | keep ours |
| Portal hand-off | menu-without-page → redirect to portal (`SiteService.php:35-37`) | `{slug}.aschool.com.np` ↔ `app.aschool.com.np` separate origins | Adopt branded hand-off on our subdomains | **adapt** |
| Presets | export = Excel/PDF list dump (`app/Contracts/ListGenerator.php:18-28`) | none | Build real JSON preset export/import (A-15) | **adopt** (corrected) |

**Exam ops**

| Aspect | InstiKit (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|---|
| Exam forms | `POST schedules/{schedule}/form` + confirm + per-exam form status (`routes/modules/exam.php` Form section) | none | Registration-for-exam workflow absent | **adopt** later |
| Admit cards | `toggle-publish-admit-card` + `print-admit-card` (`routes/modules/exam.php`) | none | — | **adopt** later |
| Mark locking | schedule-level lock + **temporary unlock windows** (`POST schedules/{schedule}/unlock-temporarily`, `routes/modules/exam.php`) | publish → locked; explicit admin-only unlock to `completed` (`backend/app/api/v1/exams.py:1400-1445`) | Their temporary unlock (time-boxed re-entry) is finer-grained than our binary publish/unlock | **adapt** temporary unlock |
| Competency/observation | dedicated fetch/store endpoints (`routes/modules/exam.php` competency-evaluation, observation-mark) | none in `exams.py` | NEP-relevant | **adopt** into nepal_curriculum |
| Marksheet variants | exam-wise/cumulative/credit-based services (`app/Services/Exam/CreditBasedMarksheetService.php`) | per-student marksheet + HTML + designer + bulk PDF (`exams.py:1203-1588`) | Ours stronger on rendering; theirs on aggregation modes | parity; **adapt** credit-based aggregation |

**Timetable engine**

| Aspect | InstiKit (file:line) | ASchool (file:line) | Delta | Verdict |
|---|---|---|---|---|
| Model | `Timetable → TimetableAllocation → TimetableRecord` with teacher+room+session awareness (`app/Models/Academic/Timetable*.php`) | `GET /timetable`, `/teacher/<id>`, `POST /generate`, `/save`, slots CRUD (`backend/app/api/v1/timetable.py:20-249`) | Ours has a generator; theirs is constraint-aware by construction but manual | keep ours; **adopt** their room-as-resource binding |
| Sessions | `ClassTiming → ClassTimingSession` multi-session per day (v4.7) | single slots | Shift-based schools (morning/day) need it | **adopt** later |

### v2 findings (V2-01…)

1. **V2-01 — Integration endpoints are unauthenticated at the middleware layer; device auth is a plaintext, non-unique token.** `routes/integration.php` mounts with only `api, user.config` (`app/Providers/RouteServiceProvider.php`); auth lives inside services as `Device::where('token', $request->token)->first()` (`app/Services/Integration/DeviceTimesheetService.php:24-33`, `TallyTransactionService.php:16-30`) while `devices.token` is `string('token')->nullable()` with no unique index (`database/migrations/2023_08_26_130126_create_devices_table.php`). No hashing, no rotation, nullable tokens (`->first()` on a null token would match the first null-token device if the client omits it — the request never asserts token presence in `import`). ASchool equivalent surface (biometric plugin) should keep device secrets hashed with per-device rate keys — ours already do per-user keys (`RouteServiceProvider` uses none).
2. **V2-02 — `enrollment_seats` are decorative.** Capacity is recounted (`app/Actions/Academic/UpdateEnrollmentSeat.php`) and shown (`app/Http/Resources/Academic/EnrollmentSeatResource.php:25`), but `RegistrationActionService::approve` never checks `booked_seat < max_seat`; no file under `app/` enforces it (grep evidence in v2-T2). Their marquee "seat-wise admission" (v5.5 changelog) does not block over-admission.
3. **V2-03 — Unauthenticated media deletion (IDOR).** `DELETE /api/v1/app/guest/medias/{uuid}` (`routes/api.php:34-37`, no auth, no feature flag) → `app/Services/MediaService.php::delete`: the unauthenticated branch is literally the comment `// delete only of current hash` with **no implementation** — any status-0 media row (any team's uploads) is deleted; status-1 rows get a `delete_hash` meta that is never compared.
4. **V2-04 — TOCTOU race on online payment completion.** `OnlinePaymentService::makePayment` (`app/Services/Student/OnlinePaymentService.php:122-137`) reads `processed_at` inside a transaction with no `lockForUpdate` on the transaction row; two concurrent gateway callbacks can both pass the guard and double-apply `PayFeeInstallment`'s read-modify-write of `student_fees.paid` / `student_fee_records.paid`. Our equivalent (`backend/app/api/v1/fees.py:1369+` + `PaymentInitiation` status flip, `backend/app/models/fee.py:155-185`) is anchored to a server-side initiation row — keep and document the locking.
5. **V2-05 — Two of the nine payment flows are vaporware.** `MultiHeadWisePaymentService` throws "feature under development" (`:19`); `GuestRegistrationPaymentService` is an empty class (`:8-14`) yet `routes/guest.php:26-28` exposes three guest endpoints to it. Marketing surface ≠ implementation.
6. **V2-06 — Tally integration is a stub.** `TallyTransactionService::getTransactions` contains `// here goes logic to get transactions for tally` and returns `{'data': []}` (`app/Services/Integration/TallyTransactionService.php:52-60`); it also reads team config via `Config::where('name','system')->first()` without team scoping (`:39-43`).
7. **V2-07 — Cross-team registration reassignment (tenant scoping bug).** `RegistrationActionService::updateBulkAssignTo` (`:466-473`) and `updateBulkStage` (`:507-513`) fetch `Registration::whereIn('uuid', …)` with **no `byTeam()` scope**, unlike the rest of the file; an admin of team A can reassign/restage team B's registrations by uuid, and notifications dispatch with the wrong `team_id` (`:481-486`).
8. **V2-08 — Weak guest fee-lookup factor + password in queue payloads.** `GuestPaymentService::getStudent` accepts **full name OR admission number + birth date** (`app/Services/Student/GuestPaymentService.php:96-102`) to expose fee balances and initiate payments — name+DOB enumeration against any team (pre-requisite lists all teams, `:26-27`). Separately, admission approval dispatches the account's plaintext password inside the notification job payload (`RegistrationActionService.php:412-420`).
9. **V2-09 — Receipt/registration number generation is racy.** `CreateTransaction::codeNumber` (`app/Actions/Finance/CreateTransaction.php:113-131`) and `OnlineRegistrationService::codeNumber` (`:49-72`) use `max('number')+1` without locks or unique constraints on `code_number` (transactions: unique is on `number_format+number+period_id`); concurrent cashiers can mint duplicate receipt numbers. Our per-school unique receipt index (`backend/app/models/fee.py:117-126`) is already stronger.
10. **V2-10 — Biometric rate limiter is global.** `RateLimiter::for('biometric', fn () => Limit::perMinute(10))` (`app/Providers/RouteServiceProvider.php:84-86`) — one fleet of devices shares 10 pushes/minute; a single noisy device starves all others (and there is no per-device key at all).
11. **V2-11 — Site config is read at route-registration time.** `routes/site.php:14` evaluates `config('config.site.enable_site')` when the route table boots, so toggling the site requires a config-cache aware restart path; DB-backed values feed `config()` at runtime elsewhere via `UserConfig` middleware (`app/Http/Middleware/UserConfig.php:24-46`). Config is the injection surface: `ConfigController::store` persists `$request->all()` (`app/Http/Controllers/Config/ConfigController.php`), and values later flow into regex/number-format expansion (`FormatCodeNumber` tokens) — admin-scoped but unsanitized.
12. **V2-12 — Day-closure cash total is integer-validated.** `MarkDayClosureService` requires `'total' => 'required|integer|min:0'` (`:11-19`); currencies with decimals (or counting coins as fractions) cannot close a day — fine for NPR, breaks the "multi-currency" claim of `resources/var/currencies.json`.
13. **V2-13 — Wizard step gating is client-trust config flags.** `updateContact` refuses unless `config->basic_updated` and `updateReview` unless `config->file_uploaded` (`OnlineRegistrationService.php:511-514, 566-569`) — the flags live in the same mutable row the guest has been writing to; order enforcement depends on those single flags, and `initiateMinimal` bypasses verification entirely by design (`:282-326`). Acceptable, but our adoption must put step gating server-side (immutable status machine).

### v2 adoption design (ASchool conventions: `SchoolModel` base with `school_id` + `for_school()`, `backend/app/models/base.py:46-60`; `@plugin_required`, `@school_required`, blueprints under `backend/app/api/v1/`)

**A-09 — Admission funnel (extend `admission` plugin, `backend/app/plugins/modules/admission/`)**
- New model `AdmissionRegistration` in `backend/app/models/admission.py` (SchoolModel): `application_number` (String(24), unique w/ school in partial index), `class_id`, `academic_year_id`, `contact` JSONB (name/dob/gender/parent/phone/email/address), `form_data` JSONB, `documents` JSONB, `status` Enum(`initiated","verified","submitted","pending","approved","rejected`), `fee_amount` Numeric, `payment_status` Enum(`na","unpaid","partial","paid`), `email_otp` + `otp_expires_at`, `auth_token` + `auth_token_expires_at`, `verification_token`, `is_online`, `converted_application_id` FK→admission_applications, `rejected_remarks`, `rejected_at`.
- Public endpoints (no JWT, school resolved from slug, per-school feature flag in school settings — not a deploy flag): `POST /api/v1/public/<slug>/admission/registrations/initiate|minimal|confirm|find|verify`, `GET /api/v1/public/<slug>/admission/registrations/<number>` (auth-token header), `PATCH …/basic|contact|review`, `POST …/photo|upload`. Staff: `GET/PUT /api/v1/admission/registrations`, `PUT /api/v1/admission/registrations/<id>/action {status, …}` — conversion runs in one `db.session` transaction creating `AdmissionApplication → Student`, copying form_data, and optionally creating the portal account (hash password server-side; never queue plaintext — fixes V2-08 class).
- Seat caps done right: add `SeatAllocation` (school_id, class_id, category, max_seats, booked_seats) and enforce `SELECT … FOR UPDATE` + `booked < max` inside the conversion transaction (fixes V2-02 in ours, beats InstiKit).
- OTP/auth-token rules copied verbatim from `OnlineRegistrationService.php:363-450` (10-min OTP, 60-min token, server-side status machine per V2-13).

**A-22 — Guest/public fee payment (extend `fees` plugin, `backend/app/plugins/modules/fees/manifest.yaml`)**
- Add `PaymentInitiation.context` column (`school_fee | registration_fee | guest_fee | …`) + `initiated_by_id` nullable. Add to fees manifest: `capabilities.public_endpoints: [lookup, initiate, complete, fail]` and a `context`-driven service map (InstiKit's nine-services-one-contract pattern, `app/Contracts/Finance/PaymentGateway`).
- Endpoints: `GET /api/v1/public/<slug>/fees/lookup` (admission number **or** student code + DOB — keep both factors, add rate limit per IP; fixes V2-08), returning balances grouped by fee item; `POST /api/v1/public/<slug>/fees/pay/initiate|complete|fail` reusing `_initiate_online_payment` (`backend/app/api/v1/fees.py:1792`) with `context='guest_fee'`; complete path requires `PaymentInitiation.status='initiated'` → flip to `completed` in the same tx as `FeeCollection.payment_status='paid'` + `FeeReceipt` (idempotency already in place, `fees.py:1391-1421`); add `SELECT … FOR UPDATE` on the collection to close the V2-04 class.
- Adopt exact-amount semantics for fixed fees and `pg_account`-style per-branch gateway account selection (school-level gateway config already exists via `_get_configured_payment_methods`, `fees.py:2124`).

**A-24 — Day closure / day book (new file `backend/app/api/v1/finance_day.py` or extend `fees.py`; model in `backend/app/models/fee.py`)**
- Model `FeeDayClosure` (SchoolModel): `closed_by_id` FK users, `date` Date + `date_bs` String(10) (BS first-class citizen, via existing BS utils), `denominations` JSONB `[{name, count}]`, `counted_total` Numeric, `collected_total` Numeric, `is_amount_mismatch` Boolean, `reason` Text, `status` Enum(`submitted","approved`), `approved_by_id`, `approved_at`.
- Endpoints: `POST /api/v1/fees/day-closure` (accountant; Σ(count×denom)==counted_total; collected = Σ cash `FeeCollection` where `collected_by_id=current user` and BS date = requested; mismatch requires reason), `GET /api/v1/fees/day-closures` (+ date-wise collection facet), `POST /api/v1/fees/day-closures/<id>/approve` (`school_admin` only), `DELETE` blocked if a later closure exists for the same user.
- Enforcement: in `record_payment` (`fees.py:1369`) reject when the collector has an open closure for that payment date (cash only) — InstiKit's `CheckPaymentEligibility.php:17-26` loop. Day book = existing `list_collections` + `collected_by_id` facet + voucher-style receipt/counterparty columns.

**A-25 — Generic approval engine (new plugin `workflow`, `backend/app/plugins/modules/workflow/manifest.yaml`)**
- Models (new `backend/app/models/workflow.py`, all SchoolModel): `ApprovalWorkflow` (name, `event` enum — `leave_request","expense","payroll","concession","student_transfer","content_publish`…, `config` JSONB, `is_active`); `ApprovalStep` (workflow_id, position, `assignee_role` OR `assignee_id`, `actions` JSONB list of allowed statuses); `ApprovalCase` (workflow_id, `model_type/model_id` polymorphic, `title`, `amount`, `requested_by_id`, `status` Enum(`requested","returned","hold","approved","rejected","cancelled`), `meta` JSONB); `ApprovalCaseStep` (case_id, position, `assignee_role/assignee_id`, `status`, `comment`, `received_at`, `processed_at`).
- Endpoints `backend/app/api/v1/workflow.py`: `GET/POST/PUT /api/v1/workflow/definitions` (admin), `GET /api/v1/workflow/cases?pending=1` (cases whose current step matches the caller's role/id), `POST /api/v1/workflow/cases/<id>/status {status, comment, return_to_step?}` implementing the transition machine from `RequestActionService.php:62-190` (HOLD freeze, APPROVE advances until last step, RETURN rewinds). On final approval, `emit(workflow.completed, model=…)` via `backend/app/plugins/events.py` so each plugin registers a listener instead of hardcoding side effects (improves on InstiKit's hardcoded `TransferStudent` switch). Also implement the edit-request flavor on the same tables: `data` JSON diff + approve-apply, replacing the future need for bespoke per-module approve endpoints (`hr_payroll.py:364, 700`, `inventory.py:233`, `visitor.py:230` migrate onto it).

**A-15 — Site blocks & presets (extend `website_builder`, `backend/app/api/v1/website_builder.py`)**
- New model `WebsiteBlock` (SchoolModel): `name` (unique per school), `type` Enum(`slider","accordion","stat_counter","testimonial","cta`), `content` JSONB, `assets` JSONB, `menu_page_slug` (deep link), `position`, `is_public`. Page sections reference blocks by `{"block": "<name>"}` inside the existing sections JSONB — no markdown-marker parsing (we keep our structured model; reject InstiKit's regex-on-HTML, V2 comparison table).
- Presets, done what InstiKit only pretends to do (V2 finding on export controllers): `GET /api/v1/website/pages/<id>/preset/export` → JSON bundle `{page, sections, blocks, menus, seo}`; `POST /api/v1/website/presets/import` (admin) → creates page+blocks in one tx with name-collision suffixing. Ship marketplace presets via `manifest.yaml`: add `website_presets:` key listing bundled JSON files in `website_builder/` and `basic_website/` plugins (admissions-focused, kindergarten, +2 college) — the exact §6.13 primitive, now grounded in what the code actually lacks.
- Portal hand-off: on the public site resolver (`backend/app/api/v1/website.py:254-351`), unknown page slugs under a school return `{"redirect": "https://app.aschool.com.np/login?school=<slug>"}` instead of 404, so the Next.js middleware can render the school-branded login (InstiKit's `SiteService.php:35-37` trick adapted to our separate origins).

---

## 1. Product Inventory

### 1.1 One install, four surfaces

| Surface | Tech | Entry |
|---|---|---|
| Public website (the "kit's" website+portal fusion) | Blade + Tailwind, DB-driven pages/menus/blocks, 2 themes (`default`, `modern`) + `custom` theme mode | `routes/site.php`, `app/Http/Controllers/SiteController.php`, `resources/views/site/` |
| Guest funnel API (no login) | JSON API behind `feature.available` middleware | `routes/guest.php` |
| Authenticated app (all 17 roles use the same SPA) | Vue 3 SPA at `/app/{any}` served by `resources/views/app.blade.php`; API under `/api/app/*` | `routes/web.php` (lines 74-80), `app/Providers/RouteServiceProvider.php` |
| Machine integration | Tally ERP export + biometric device timesheet push | `routes/integration.php` |

### 1.2 Admin module inventory (from `resources/var/modules.json`, with controller/model paths)

| Module | Children (menu items) | Key paths |
|---|---|---|
| **Reception** | enquiry, visitor_log, gate_pass, complaint, call_log, correspondence | `app/Http/Controllers/Reception/` (23 files), `create_gate_passes_table.php`, `create_call_logs_table.php`, `create_correspondences_table.php` |
| **Academic** | department, period (school year, archivable), division, course, batch, subject, class_timing, timetable, book_list, certificate, id_card | `app/Models/Academic/` (22 models: Session, Program, ProgramType, Course, Batch, Subject, Timetable*, CertificateTemplate, IdCardTemplate, EnrollmentSeat…), `app/Http/Controllers/Academic/` (60 files) |
| **Student** | registration, roll_number, health_record, subject(elective), attendance, fee_allocation, promotion, **edit_request**, leave_request, transfer_request, transfer, **alumni**, report | `app/Http/Controllers/Student/` (103 files!), `app/Models/Student/` (13 models), `create_enrollment_seats_table.php` (seat-wise admission), `create_student_diaries_table.php` |
| **Finance** | payment_method, fee_group, fee_head, fee_concession, fee_structure, **ledger_type, ledger**, **transaction** (+categories, vouchers, cheque clearing, day book), receipt, report | `app/Http/Controllers/Finance/` (61 files), fee engine: `create_fee_allocations/installments/components/concessions/refunds_*` migrations (16 fee tables), `create_day_closures_table.php` |
| **Exam** | term, grade, assessment, **observation**, **competency**, schedule, form, report | `app/Models/Exam/` (14), marksheets: cumulative, credit-based, exam-wise (`resources/views/print/exam/`), online exam with attempts (`OnlineExam/Question/Submission.php`), mark auto-lock |
| **Employee** | department, designation, attendance, leave, payroll, edit_request | `app/Http/Controllers/Employee/` (82 files), `create_employee_work_shifts_table.php`, `create_payroll_records_table.php`, salary templates + conditional formulas, payment advice print |
| **Resource (LMS-lite)** | book_list, diary, assignment, lesson_plan, syllabus, online_class, learning_material, download | `app/Http/Controllers/Resource/` (21 files), assignment submissions + teacher evaluation (`create_assignment_submissions_table.php`), online class = external meeting link (`app/Models/Resource/OnlineClass.php` stores `url`; `app/Enums/Resource/OnlineClassPlatform.php`) |
| **Transport** | route, circle, fee, vehicle | `app/Services/Transport/` (14 services), stoppage import (`StoppageImportService.php`), vehicle fuel/expense/service/case records (`create_vehicle_*_records_table.php`), transport fee wired into fee engine (`create_transport_fee_records_table.php`) |
| **Calendar** | holiday, celebration, event | `create_holidays_table.php`, `create_events_table.php` |
| **Discipline** | incident | `app/Enums/Discipline/`, `create_incidents_table.php` |
| **Gallery** | (images w/ watermark option) | `create_galleries_table.php`, v4.6 "Watermark in Gallery Images" |
| **Guardian** | parent records + guardian import + parent ID cards | `app/Models/Guardian.php`, `GuardianController.php` |
| **Contact** | contact book + edit requests + bulk messaging | `app/Models/Contact.php`, `ContactEditRequest.php` |
| **Mess** | menu_item, meal, meal_log | `app/Services/Mess/`, `create_meal_logs_table.php` |
| **Inventory** | stock_category, stock_item, stock_requisition, stock_purchase, stock_transfer, stock_adjustment | `app/Http/Controllers/Inventory/` (33 files), item copies, vendor statements (`app/Services/Inventory/VendorStatementService.php`) |
| **Communication** | announcement, email, sms (+ WhatsApp templates, push) | `app/Services/Config/SMSGateway/` (custom HTTP gateway), `app/Http/Controllers/Config/WhatsAppTemplateController.php`, v5.0 "WhatsApp Integration" |
| **Library** | book, book_addition, transaction | `app/Http/Controllers/Library/` (19 files), book copies + fines (`create_book_copies_table.php`), library reports |
| **Blog / News** | (public site content w/ categories+tags) | `app/Http/Controllers/Blog/`, `News/`, site routes `routes/site.php` |
| **Approval** | type, request, pending_requests, processed_requests | **Generic multi-level approval engine**: `create_approval_types/levels/requests_table.php`, `app/Http/Controllers/Approval/` |
| **Task** | (tasks w/ checklists + members) | `create_tasks/checklists/members_table.php` |
| **Helpdesk** | faq, ticket | `create_tickets/assignees/messages_table.php` |
| **Activity** | trip (w/ participants) | `create_trips/participants_table.php` |
| **Hostel** | hostel (blocks/floors/rooms), room_allocation | `app/Services/Hostel/` (9 services) |
| **Form** | custom form builder (fields + submissions) | `create_forms/form_fields/submissions*_table.php` |
| **Asset** | building (→ floors → rooms) | `app/Http/Controllers/Asset/`, `create_floors/rooms_table.php` |
| **Site** | page, menu, block | `app/Http/Controllers/Site/` (10 controllers), `create_site_pages/menus/blocks_table.php` |
| **Recruitment** | vacancy, application | `create_job_vacancies/records/applications_table.php`, public apply via guest routes |
| **Custom field** | custom fields on Student/Employee/Registration | `app/Enums/CustomFieldForm.php`, `create_custom_fields_table.php` |
| **User / Team** | users, roles, permissions, impersonation, teams | `app/Http/Controllers/Team/`, `UserImpersonationController.php` |
| **Utility** | todo (kanban lists), backup, activity log | `app/Http/Controllers/Utility/` |

Cross-cutting: **Post wall** (Facebook-like feed w/ pinned announcements, `routes/chat.php`, `app/Models/Post.php`), **Chat** (realtime, Pusher, `chat:access` permission), **Dialogue** (structured student/guardian ↔ institute thread, `app/Models/Dialogue.php`), **Service requests** (student/guardian raise requests, `app/Models/Student/ServiceRequest.php`), **Reminder** with notifications, **Tags & groups** (polymorphic `taggables`), **View logs + User access logs** (`create_view_logs/user_access_logs_table.php`).

### 1.3 Roles (all in `resources/var/permission.json`)

`admin, observer, manager, principal, staff, accountant, librarian, exam-incharge, transport-incharge, inventory-incharge, mess-incharge, hostel-incharge, attendance-assistant, receptionist, student, guardian, user`. Every route carries `permission:` middleware; the file ships a full default role→permission matrix that admins can re-assign per team (role-wise or user-wise, `app/Http/Controllers/Team/PermissionController.php`).

**Student and guardian get exactly 29 permissions each** (verified identical lists): view own profile/attendance/fees/marksheet/exam schedule/online exams/announcements/events/gallery/assignments/diary/learning materials/book lists, pay fees online, create complaints, raise leave/service/transfer requests, dialogue with institute, comment+read on the post wall, manage todos. This is a **complete front-end portal with no content-creation surface** — deliberately read-mostly.

### 1.4 Money flows (10 gateways + 3 guest flows)

- Gateways: Razorpay, Stripe, PayPal, Paystack, Billdesk, CCAvenue, Billplz (MY), Hubtel (GH), Amwalpay (OM), Payzone — `app/Services/Finance/PaymentGateway/{Razorpay,Stripe,Paypal,Paystack,Billdesk,Ccavenue,Billplz,Hubtel,Amwalpay,Payzone}.php` + response views `resources/views/gateways/`.
- Bank transfer payment + admin approval (`create_bank_transfers_table.php`), cheque/DD clearing dates, transaction import, day closure for cashiers, payment-link QR codes, guest/anonymous fee payment by looking up a student, registration-fee online payment with due dates, refund records, fee concession logs, head-wise & installment-wise payment.
- **No Nepal gateway anywhere** (no eSewa/Khalti/FonePay/connectIPS; `resources/var/currencies.json` defaults USD).

### 1.5 Where the weight sits (routes & controllers per domain)

API route statements per module file (`routes/modules/*.php`) — the honest feature-complexity ranking:

| Module file | Route stmts | Controllers (files in `app/Http/Controllers/<Domain>/`) |
|---|---|---|
| `student.php` | 183 | Student: 103 |
| `employee.php` | 106 | Employee: 82 |
| `exam.php` | 84 | Exam: 39 |
| `academic.php` | 79 | Academic: 60 |
| `finance.php` | 67 | Finance: 61 |
| `transport.php` | 43 | Transport: 38 |
| `inventory.php` | 42 | Inventory: 33 |
| `reception.php` | 41 | Reception: 23 |
| `resource.php` | 27 | Resource: 21 |
| `library.php` | 27 | Library: 19 |
| `site.php` | 20 | Site: 16 |
| `task.php` | 19 | Task: 8 |

Plus cross-cutting `routes/app.php` (232 lines: teams, users, config, options, custom fields, dashboards, todos, backups, activity logs, media, tags, attendance QR) and `routes/guest.php` (76 lines: the public funnel). The Student domain alone (183 routes / 103 controllers) is bigger than all of eSchool v3.3.6's API surface.

### 1.6 Release cadence (evidence: version log in `INSTIKIT/README.md`)

v4.0.0 (20 Sep 2024) → v5.5 (16 Dec 2025): **17 releases in 15 months**, nearly monthly, each with 5–50 named features:

| Version | Date | Marquee features |
|---|---|---|
| 4.0.0 | 2024-09-20 | Full rewrite (Laravel/Vue/Tailwind); Recruitment, Mess, Activity, Custom Form, Gallery modules |
| 4.1.0 | 2024-09-30 | Alumni, Discipline, keyboard nav, Send Email, Billdesk/CCAvenue status checks |
| 4.2.0 | 2024-10-07 | SMS gateway, custom fields, elective attendance, QR attendance, Paystack |
| 4.3.0 | 2024-10-21 | Realtime chat, assignment submit/evaluate, academic departments |
| 4.4.0 | 2024-11-12 | **Online Exam module**, manual backup, department/program access scoping |
| 4.5–4.8 | 2024-11→2025-01 | Color themes, tags/groups, mobile app support, watermarks, blog, fee installments |
| 4.9–4.10 | 2025-02→03 | Biometric addon, QR attendance, half-day leave, IP filter, bulk payroll |
| 5.0 | 2025-05-05 | **Wall feed, WhatsApp, bank-transfer approval, OTP login, enquiry→registration→admission funnel, guest payments** |
| 5.1 | 2025-06-03 | **Multi-level approval, push notifications, installments, Amwalpay** |
| 5.2 | 2025-06-08 | Tasks/reminders, payment QR, vehicle expense/case records, dedicated doc/account/qualification modules |
| 5.3 | 2025-08-31 | Laravel 12, **website events/announcements/gallery/blocks**, employee tickets, FAQ, **day closure**, day book |
| 5.4 | 2025-11-04 | Custom attendance types, competency evaluation, **online enquiry module**, vehicle fuel records |
| 5.5 | 2025-12-16 | Registration fee payment, secondary concession, user access logs, verification, Hubtel, head-wise fee summary |

This cadence is the product's core marketing engine.

---

## 2. Architecture Patterns Worth Stealing

*(No WP patterns exist — this section maps the Laravel/monolith equivalents and what's genuinely worth copying.)*

### 2.1 Multi-institute in one install: Organization → Team → Period

- `create_organizations_table.php` + `update_teams_table_with_organization_column.php`: an **Organization owns many Teams** (each Team = one institute/branch/campus). Every domain table carries `team_id` (`update_configs_table_with_team_id_column.php`); `app/Models/Team.php` has `HasConfig` concern so **each institute has its own config overlay**; spatie permission runs in teams mode; users span teams via `config('config.teams')` (`scopeAllowedTeams` in `app/Models/Team.php`).
- Route-level tenant context: guest endpoints take `{team}` explicitly (`routes/guest.php`: `app/guest-payments/{team}/periods`), so **one public funnel serves all institutes** — the closest thing to ASchool's multi-tenancy without real tenancy.
- Role/permission import between different installations (`app/Services/...` + "Import Role & Permission between different Installation" in v4.10 changelog) — a migration aid for their own installed base.

### 2.2 Website + portal fusion (the single most instructive pattern)

1. **Menus are the site map**: a `site_menus` row has slug + optional `page_id`; `SiteService::getPage()` (`app/Services/SiteService.php`) resolves menu → page, builds breadcrumbs from parent menus, reads per-page SEO (`meta_title/description/keywords` stored in page `seo` JSON).
2. **Pages are structured markdown with layout markers**: content is parsed (`MarkdownParser` support trait, incl. math via league/commonmark) then `#SECTION#…#SECTION#` and `#CONTAINER#…#CONTAINER#` markers are regex-expanded into Tailwind flex layouts; **named Blocks** referenced inside are hydrated from `site_blocks` (with `position`, assets, `menu_id` links) and rendered by theme partials `resources/views/site/default/{announcement,blog,cta,event,gallery,news,index,page}.blade.php`.
3. **Only 4 block types** (`app/Enums/Site/BlockType.php`): `slider, accordion, stat_counter, testimonial` — plus CTA/event/news/gallery/blog blades. The "builder" is deliberately tiny; the flexibility comes from markers + arbitrary markdown, not a widget zoo.
4. **Same-domain continuity rules**: if a menu has no page (or slug unknown), `SiteService` **redirects to `/app`** (the portal SPA). So the public site and the login-gated app are one brand, one URL space, one install.
5. **The guest funnel is the fusion's engine** (`routes/guest.php`, all behind `feature.available:*` flags + `guest` middleware): online enquiry (wizard) → registration (wizard with document uploads, photo, verification, minimal vs full variants, find/verify endpoints, printable form) → **registration fee payment online** → admission conversion (seat-wise via `enrollment_seats`). Plus: **guest fee payment** (find student → see fee detail → pay, `GuestPaymentController`), **public transfer-certificate verification** (`app/transfer-certificate/verify`), **public job applications**. No login ever required.
6. SPA gets a read API for the same content: `/app/pages/{slug}`, `/app/site/posts` (`routes/api.php`, `SiteController::pageView`, `Site\View\PostController`) — so the mobile/companion surface can render site content too.

### 2.3 Config-as-data everywhere

- One `configs` table, team-scoped, seeded from `resources/var/config.json`: **418 options across 37 groups** — `system(23), feature(14), notification(14), auth(27), assets(7), mail(8), sms(16), whatsapp(22), site(4), student(55), employee(45), finance(76), reception(17), exam(4), resource(15), inventory(16), transport(7), task(6), helpdesk(6), …`
- Each option has an **`is_public` flag**; public ones ride to the SPA in the boot payload (`GET /api/config` with `optional.auth:sanctum`, `routes/api.php`). The SPA never hardcodes formats — date/time format, currency, direction (LTR/RTL), color scheme all arrive as config.
- 14 **feature flags** (`config.json → feature`): enable_todo, enable_backup, enable_activity_log, enable_online_registration (+ instruction text fields), enable_post, enable_guest_payment, enable_job_application, enable_transfer_certificate_verification. The `feature.available` middleware makes guest flows toggleable per install without deploys.
- Master data uses an `options` table with `OptionVerifier` middleware and import/reorder endpoints (`routes/app.php` Option section) — i.e., lists like blood groups, religions, document types are user-editable rows, not enums.
- **Document numbering as config**: every document type has prefix/digit/suffix options, many with date tokens — e.g. `finance.payment_number_prefix = TP%YEAR_SHORT%%MONTH_NUMBER_SHORT%`, `receipt_number_prefix = TR%YEAR_SHORT%%MONTH_NUMBER_SHORT%`, student `registration_number_prefix = SM`, provisional admission `PSM`, announcements `CASM` (`config.json` groups student/finance). 76 finance options alone include custom bank-code fields (bank_code1..3 with labels + required flags) and currency denominations for cash counting.
- **Auth is a config surface** (27 auth options): enable_registration, email verification, **account approval**, 2FA toggle, OAuth per-provider (Google/Facebook/Twitter/GitHub/Microsoft client id/secret stored as options), OTP login, login throttle limits, reset token lifetime (`config.json → auth`; realized in `routes/auth.php` + `app/Http/Controllers/Auth/OAuthController.php`).

### 2.4 The three domain engines worth studying

**Fee engine (16 migrations, `database/migrations/create_fee_*.php`):** `fee_groups → fee_structures → fee_structure_components → fee_components → fee_heads` (heads carry tax, `update_fee_heads_table_with_tax_column.php`); allocation via `fee_allocations` + `student_fees → student_fee_records → student_fee_payments`; installments (`fee_installments` + records) with per-installment concession restrictions (v4.10); concessions with records + logs + round-off (v5.2); refunds (`fee_refunds` + records); gender-wise fee structures (v5.0); sibling fee linkage (v4.9); transport fees ride the same engine (`create_transport_fee_records_table.php`). Payment services split by flow: `app/Services/Student/{PaymentService, OnlinePaymentService, HeadWisePaymentService, MultiHeadWisePaymentService, GuestPaymentService, AnonymousPaymentService, RegistrationPaymentService, OnlineRegistrationPaymentService, GuestRegistrationPaymentService}.php` — **nine distinct payment flows sharing one gateway layer**.

**Timetable engine (`app/Models/Academic/`):** `Timetable → TimetableAllocation → TimetableRecord`, with `ClassTiming → ClassTimingSession` (multiple session allotments, v4.7), `Period` (per session/division/batch, archivable — v5.3), rooms as subjects of allocation (`TimetableAllocation.php` belongsTo Room, Subject, Employee), subject-incharge with multiple batches (v4.1), teacher timetable + batch-wise print (v5.3/v4.1), division/course/batch-wise period update (v4.9). Teacher-conflict-free scheduling by construction: allocation is teacher+room+session aware at the model level.

**Attendance engine:** `student_attendances` + `attendance_types` (custom types per student, v5.5) + `AttendanceSession` enum (morning/day/half-day — v4.10 "Half Day Leave" precedent), elective-subject attendance via `subject_wise_students` (`create_subject_wise_students_table.php`), QR-code marking endpoint (`POST /attendance/qr-code`, `POST /attendance/mark` in `routes/app.php`), student clock in/out (v5.1, `create_student_timesheets_table.php`), attendance migration when course/batch changes (v5.2), biometric timesheet ingestion (`routes/integration.php`), attendance-assistant role, past-day edit limit (`student.attendance_past_day_limit = 7` in config.json), employee attendance + work shifts + timesheets (`create_employee_attendances/records/work_shifts_table.php`).

### 2.5 Workflow patterns worth cloning

- **Edit-request pattern**: students/employees/guardians can't touch core records; they file edit requests (contact/employee/student edit-request tables + `RequestRecord`, `Emergency Contact Detail in Student & Employee Edit Request` in v5.2) which staff approve. Change-control for a school context.
- **Generic approval engine**: `approval_types/levels/requests` — any workflow can define multi-level approvals (v5.1 "Multi-level Approval Module"), consumed by `app/Http/Controllers/Approval/`.
- **Day closure / day book**: cashier accountability — `create_day_closures_table.php`, "Day Book with User-wise Collection" (v5.3), transaction vouchers + print, transaction categories. Financial audit trail at the counter level, not just the ledger.
- **Exam data model**: Terms → Exams → Schedules; marks as Records; Grades; **Assessments** (rubric-ish), **Observations** + `ObservationMarkService`, **Competencies** + records (competency-based evaluation, v5.4 — NEP-flavored), exam forms (registration for exam + admit card print), mark auto-lock, weightage, credit-based marksheet service (`app/Services/Exam/CreditBasedMarksheetService.php`, `CumulativeMarksheetService.php`).
- **Device/integration ingestion**: `devices` table (`app/Models/Device.php`, team-scoped, `meta` JSON), biometric pushes raw timesheets to `POST /attendance/timesheet` + `POST /attendance/import` with `throttle:biometric` (`routes/integration.php`); Tally transactions export endpoint for accountants.
- **Print pipeline**: every list has an mPDF print template under `resources/views/print/{academic,student,finance,exam,employee,transport,inventory,library,reception}/` with shared headers (`exam/header.blade.php`), signatory blocks (`exam/signatory.blade.php`), certificate templates with variable substitution (`resources/var/certificate-template-variables.json`), ID-card templates (`resources/var/id-card-templates.json`), custom certificate numbering (v5.3).
- **Bulk onboarding**: 39 Export/Import classes + `DownloadFormatController` (`routes/web.php`) serving downloadable sample import formats; imports exist for students, guardians, courses, batches, stock items/categories, roles/permissions, transactions, custom fees, transport stoppages.
- **Hardening middleware stack** (`app/Http/Middleware/`): `TwoFactorSecurity`, `ScreenLock` (idle lock), `XssProtection`, `UnderMaintenance`, `RestrictedActionInTestMode` (test-mode guard), `FeatureAvailable`, `OptionVerifier`, per-route throttles (`throttle:otp`, `throttle:biometric`), failed-login-attempt surfacing + IP blacklist/whitelist (v4.10), forced password change (`ForceChangePasswordController.php`), user impersonation with unimpersonate (`routes/app.php`), login via email/SMS OTP (v5.0), user access logs per login (v5.5).

---

## 3. UI/UX Patterns

- **One SPA, all roles.** `/app/{any}` catch-all (`routes/web.php` lines 74–80) boots a single Vue 3 app for admin, teacher, accountant, student, guardian. Role-based menus + permission-filtered routes; "Show/Hide Menus" + "Menu Reorder" (v4.2/v5.1) let each install curate its own nav.
- **Extreme code splitting**: 957 prebuilt chunks (e.g. `Absentee-ClX5ISR1.js`, `ExamReport-D6d7eMXk.js`) — one chunk per screen/action/dialog, gzipped. Navigation is effectively per-view lazy loading; no mega-bundle.
- **Dashboard is endpoint-per-widget** (`routes/app.php` Dashboard section): `dashboard/stat`, `student-chart-data`, `transaction-chart-data`, `employee-attendance-summary`, `schedule`, `timetable`, `transport-route`, `mess-schedule`, `institute-info`, `form-list`, `gallery`, `celebration`. The role sees a widget grid assembled from whatever it has permission for — birthday/celebration widget (v4.8), pinned announcements & events on the wall feed (v5.0), student/employee timetable in the feed (v4.1), fee concession & course-wise fee charts (v5.3).
- **Keyboard-first polish** (v4.1): keyboard navigation for student/employee search and for menus — rare in this market.
- **Report hub as a page, reports as services**: `routes/report.php` + `resources/views/reports/{student,finance,exam}/index.blade.php` render filter UIs outside the SPA on the site layout, each backed by a dedicated `app/Services/**/Report/*Service.php` (e.g. `app/Services/Finance/Report/HeadWiseFeePaymentService.php`, `PaymentMethodWiseFeePaymentDetailListService.php` — note the combinatorial naming: every report has a List + Detail + Export variant).
- **Everything prints.** Receipts, vouchers, marksheets (4 variants), admit cards, exam forms, ID cards (students, employees, **parents/guardians** v5.0), certificates (transfer certificate with **public verification**), payroll salary sheets + payment advice, timetables (batch-wise, teacher-wise v5.3), sibling lists, online registration forms. Templates are Blade + mpdf, header/signatory partials shared.
- **Public site UX**: two maintained themes (`default`, `modern`) + `custom` mode (custom theme edited via CodeMirror — `@codemirror/lang-*` chunks in `public/build/assets/manifest.json`), homepage blocks (slider/stat counter/testimonial/accordion/CTA), news/blog with category+tag archive routes (`routes/site.php` `/b/{slug}/category/{cat}`), event/announcement/gallery detail pages with SEO, FAQ module (v5.3), alumni events, downloadable book lists per course.
- **Mobile approach**: no app ships in this repo. v4.7 added "Mobile Application Support" = the same `/api/app/*` API + `devices` table + push templates + `testAppNotification` config endpoint (`routes/app.php`). Any Flutter/RN app is a separate SKU riding the API. Responsiveness is Tailwind-based (site blades use `md:flex-row` etc.); the SPA is desktop-first with mobile-tolerant layout.
- **Chat & realtime**: Pusher-backed chat for `observer` role (`chat:access`), realtime post comments; `notification.mp3` in `public/` for in-app notification sound.

- **Portal UX for students/guardians (their 29 permissions):** the SPA renders a read-mostly portal: own profile + attendance list + subject-wise attendance, fee allocation/payment history with online payment and downloadable receipts, exam schedule + marksheet access, online exam attempts, announcements/events/gallery, assignments + submissions, diary, learning materials, online class links (join window enforced by `resource.online_class_joining_period` minutes, `app/Models/Resource/OnlineClass.php`), complaints (create/edit own), leave/service/transfer requests, dialogue thread with the institute, wall read + comment, todos. **Every write is mediated**: no direct profile edits (edit requests instead), no content creation. Sibling view (v4.9 "Sibling record in Student Fee Payment") lets one guardian account see/pay across children.
- **Auth UX depth**: login via password, email OTP, or SMS OTP (v5.0); account approval + email verification toggles; OAuth (5 providers); 2FA (`TwoFactorSecurity` middleware); `ScreenLock` (auto-lock UI after idle); forced password change toggle per user (`routes/app.php` `toggle-force-change-password`); impersonation (`UserImpersonationController.php`) for support; login-as-support token route (`LoginAsSupportController.php` in `routes/web.php`).

---

## 4. What ASchool Lacks (InstiKit features we don't have — with evidence)

Verified against `backend/app/plugins/modules/` (44 plugins: academics, admission, ai_*, alumni, assignments, attendance, basic_reports, basic_website, biometric, compliance, conferences, design_studio, dismissal, disaster_management, elibrary, emergency, exams, fees, file_management, gamification, gps_tracking, health_records, hr_payroll, iemis_importer, incident_management, incidents, inventory, library_management, lms, multi_branch, nepal_curriculum, notices, sms_notifications, student_portfolio, timetable, visitor_management, website_builder, wellbeing, whatsapp_bot, white_label) and `backend/app/api/v1/` (60 route files).

**High priority (revenue/completeness gaps):**

1. **Admission funnel depth** — we have `admission` plugin, but InstiKit's chain enquiry → registration → admission is end-to-end online: wizard forms with per-step document upload, registration fee payment, verification codes, printable forms, enquiry-to-registration and registration-to-admission conversion, seat-wise enrollment (`routes/guest.php`, `create_enrollment_seats_table.php`). Our funnel exists but "online registration fee + verification + seat caps + printable forms" are not evidenced anywhere in `backend/app/api/v1/admission.py`.
2. **Guest fee payment without an account** (`routes/guest.php`: `app/guest-payments/{student}/initiate|complete|fail` + anonymous variant) — parents pay by finding the student; no login needed. Our fees flow lives in the parent app (`flutter_parent/lib/features/fees/`). A public "pay fees" page per school website is an easy, high-conversion steal.
3. **Public transfer-certificate verification** (`app/transfer-certificate/verify`) — any school can authenticate a leaving certificate online. Zero cost, big trust win. Nothing similar in `api/v1/students.py` or `exams.py`.
4. **Recruitment/job board** — vacancies + public applications (`create_job_vacancies_table.php`, `Recruitment/Job/VacancyController.php`). Our hr_payroll has no hiring surface.
5. **Day closure / day book / transaction vouchers** (`create_day_closures_table.php`, v5.3) — counter-level cash accountability. Our fees module (eSewa/Khalti/FonePay, refunds, idempotency) is strong on digital but has no cashier day-closure concept.
6. **Front-desk suite**: gate pass, call log, correspondence (`create_gate_passes_table.php`, `create_call_logs_table.php`, `create_correspondences_table.php`). We have visitor_management + dismissal; gate pass and front-desk logs are missing.
7. **Mess/cafeteria module** (`app/Services/Mess/`, meal logs, menu items, mess schedule dashboard widget) — absent from our 44 plugins.
8. **Generic approval workflow engine** (`create_approval_types/levels/requests_table.php`) — we have per-feature approvals at best; a reusable multi-level engine would power leave, expenses, content publishing, multi_branch.
9. **Edit-request pattern** (`ContactEditRequest`, student/employee edit requests) — self-service data correction with staff approval; fits our wellbeing/compliance posture. Not in `api/v1/users.py`/`students.py`.
10. **Asset/building registry** (`app/Http/Controllers/Asset/`, rooms/floors) — we have inventory only.
11. **Helpdesk tickets** (`create_tickets/assignees/messages_table.php`) — internal + parent support desk with assignment. We ship `faqs.py` only.

**Medium priority:**

12. **Certificate + ID-card template engines** with variable substitution and custom numbering (`resources/var/certificate-template-variables.json`, `IdCardTemplate.php`) — our design_studio covers posters/sites; academic certificate/ID generation with verification is a distinct, sellable surface.
13. **Custom form builder** (`create_forms/form_fields/submissions*_table.php`) — generic forms for surveys/club signups; nothing similar in our plugin list.
14. **Employee full-cycle depth**: work shifts, biometric timesheet ingestion endpoints (`routes/integration.php`), payroll with conditional formulas + pay heads + bulk processing + payment advice print. Our hr_payroll + biometric exist but hiring, shifts, and Tally-style export are absent.
15. **Vehicle lifecycle records**: fuel, service, expense, case records per vehicle (`create_vehicle_*_records_table.php`) — our gps_tracking does live tracking (which InstiKit entirely lacks) but fleet maintenance books are missing.
16. **Inventory depth**: requisitions, transfers, returns, adjustments, item copies, vendor statements (`app/Http/Controllers/Inventory/` 33 files, `VendorStatementService.php`).
17. **Competency/observation-based evaluation** (`app/Models/Exam/Competency.php`, `Observation.php`, `CompetencyEvaluationService.php`) — relevant to Nepal's NEP shift; our nepal_curriculum + exams should absorb this.
18. **Alumni events** (v4.1 "Alumni Module, Events for Alumni") — we have alumni; event tie-in unclear.
19. **Library reports + book copies/fines granularity** — elibrary exists; compare fine/copy management depth.
20. **Import/export polish**: downloadable sample formats per import (`DownloadFormatController`), bulk update of student/employee details, import of transactions/guardians/courses/batches/stoppages/roles.
21. **Ops UX**: user impersonation, force password change, screen lock, IP blacklist/whitelist, failed-login surfacing, user access logs (v5.5), activity log viewer UI. We have TOTP MFA + lockout (stronger) but lack the admin *visibility* surfaces (access logs, view logs).

**Lower priority / polish:**

22. **Document numbering series as config** (prefix/digit/suffix with date tokens for receipts, payments, registrations, transfers, expenses, announcements — `config.json`) — we hardcode number formats; schools ask for these constantly.
23. **Engagement layer**: wall feed with pinned posts, realtime chat, dialogue threads, service requests, reminders with notifications, celebration/birthday widgets, gallery watermarking. Our notices + WhatsApp bot cover broadcasting; the *in-portal conversational* layer (dialogue + service request + complaint with logs, `create_complaint_logs_table.php`) is absent.
24. **Examination ops**: exam form (student exam registration) + admit card printing (`resources/views/print/exam/exam-form*.blade.php`), mark locking (v5.4 "Improved Locking of Exam Marks"), weightage records (v5.3), credit-based and cumulative marksheets. Our exams module is strong on authoring (question bank) but the *operations* side (forms, admit cards, locks, board-style marksheet layouts) is thinner.

---

## 5. What ASchool Does Better (honest assessment)

1. **True multi-tenancy.** InstiKit's Organization/Team is an *intra-install* grouping: one DB, one codebase, shared config namespace, and the license forbids reselling (one install per purchase). ASchool is real SaaS: per-school slugs + SSR sites (`{slug}.aschool.com.np`), tenant-scoped everything, onboarding without ops. InstiKit cannot onboard a school without a server.
2. **Scale & delivery.** InstiKit ships `QUEUE_CONNECTION=sync`, `CACHE_DRIVER=file`, `SESSION_DRIVER=file` (`.env`) — i.e., out of the box it doesn't even use its own queues/redis; realistic deployments are single-server MySQL. ASchool: Pg16 + Redis 7 + Celery beat + Socket.IO + Firebase RTDB (`backend/README.md`). 1,410 route statements in one Laravel app with 696 service classes is maintainable, but there's no horizontal story, no read replicas, no per-tenant isolation.
3. **Mobile.** InstiKit has **no app** — API hooks only. ASchool has 5 Flutter apps (admin/teacher/parent/student/user) sharing `aschool_shared` with queued token refresh. For Nepal parent engagement, this is decisive.
4. **API-first & ecosystem.** InstiKit's API is private to its own SPA — no public API docs, no webhooks, no third-party integration story beyond Tally/biometric push endpoints. ASchool has versioned `/api/v1` (60 modules, ~706 route decorators), webhooks (`api/webhooks/`), SSE + Socket.IO realtime.
5. **Nepal localization.** Verified absence in InstiKit: no BS calendar (no Bikram Sambat anywhere under `app/`, `lang/`; date formats are Gregorian templates in `config.json`), no iEMIS, no SEE/NEB grading, no Nepali gateways (no eSewa/Khalti/FonePay), default timezone Asia/Kolkata + USD. ASchool owns all of these (`iemis_importer`, `nepal_curriculum`, BS utils, Sparrow SMS, eSewa ePay v2/Khalti v2+FonePay with refunds and idempotency).
6. **AI.** InstiKit has none (no AI references outside our imagination — verified grep). ASchool: ai_suite, ai_teacher, adaptive learning, ai_tutor, token-hub quota gateway.
7. **Realtime tracking.** InstiKit transport = routes/stoppages/fees/vehicle records; **no GPS, no live tracking, no parent notification on arrival** (verified: no gps refs under `app/Services/Transport/`). ASchool's ESP32→RTDB→Socket.IO live map is a category they don't play in.
8. **Security depth.** InstiKit: 2FA middleware, XSS middleware, purifier, failed-login table — decent, but a nulled distribution circulating publicly with `.env` shipped (APP_KEY included in the package!) is its real security posture. ASchool: TOTP MFA, ClamAV, bleach sanitization, CSRF origin guard, JWT+cookie rotation with revocation, strict CSP, boot-time refusal without configured SMS.
9. **Content/collaboration categories InstiKit lacks entirely**: question bank (verified absent — online exams only have 3 question types: `app/Enums/Exam/OnlineExamQuestionType.php`: mcq, single_line, multi_line; a **file-upload type is commented out**), LMS with courses/progress, video conferencing (online class is just a stored URL — `app/Models/Resource/OnlineClass.php`), gamification, wellbeing, disaster/emergency/dismissal, student portfolio, compliance, white label.
10. **Website architecture.** InstiKit's site builder is one-site-per-install with 4 block types and regex-expanded markdown. ASchool's website_builder/design_studio does per-school SSR/ISR Next.js sites with real multi-tenant theming — better SEO, better perf, better ops. (InstiKit's *fusion* with the portal on one domain is the one thing theirs does more cleanly — see §6.)

**Parity scorecard (category by category):**

| Category | InstiKit v5.5 | ASchool |
|---|---|---|
| Multi-tenancy | Organization/Team in one install (§2.1) | Real SaaS, per-school subdomains + SSR sites — **win** |
| Public website | Built-in, 2 themes, 4 block types, portal on same domain | website_builder + basic_website + design_studio — **win**, minus fusion (§6.2) |
| Admission funnel | Enquiry→Registration(+fee, verification)→Admission, guest flows | admission plugin, funnel depth thinner — **gap** |
| Fees | 16-table engine, 9 payment flows, 10 gateways, day closure | eSewa/Khalti/FonePay, refunds, idempotency — **parity on rails, gap on counter ops** |
| Exams | Marks ops (forms, admit cards, marksheets ×4, locks, competency) | Question bank + authoring — **split** |
| Attendance | Types, sessions, QR, clock-in/out, biometric ingest | attendance + biometric plugins — **parity** |
| Transport | Routes/fees/vehicle records; **no GPS** | GPS live tracking + notifications — **win** |
| LMS / question bank / conferencing | LMS-lite only, no question bank, URL-only classes | lms, elibrary, exams question bank, conferences — **win** |
| HR | Shifts, payroll formulas, recruitment, bulk payroll | hr_payroll + biometric; no hiring — **parity** |
| AI | None | ai_suite/ai_teacher/adaptive — **win** |
| Mobile | None bundled (API hooks) | 5 Flutter apps — **win** |
| Nepal | None (no BS/iEMIS/SEE/NEP gateways) | Core identity — **win** |
| Workflow/approvals | Generic multi-level engine + edit requests | Per-feature only — **gap** |
| Scale story | Single server, sync queues by default | Pg16/Redis/Celery/Socket.IO/RTDB — **win** |

---

## 6. Organization Lessons (for our plugin marketplace & website builder)

1. **Steal the guest funnel wholesale.** A school's website should end in actions, not brochures: `enquiry → registration(+fee) → admission`, `pay fees (no login)`, `verify a certificate`, `apply for a job`, `raise an enquiry` — each as a feature-flagged public endpoint (`feature.available` pattern, `routes/guest.php`). Concretely: add `public_funnel` capabilities to our `admission` and `fees` plugin manifests, exposed through website_builder page blocks. This is the single highest-leverage idea in the whole codebase.
2. **The redirect trick**: when a public page slug doesn't resolve, redirect to the portal login instead of 404 (`app/Services/SiteService.php::getPage`). Website and portal share one domain, one brand, one cookie journey. Our `{slug}.aschool.com.np` sites + `app.aschool.com.np` portal should adopt a branded hand-off (school-branded login screen when coming from a school site).
3. **Blocks should be few and named, not a widget supermarket.** InstiKit ships 4 block types + content blades; pages are markdown with `#SECTION#`/`#CONTAINER#` markers referencing named reusable blocks. For our website_builder: reusable named blocks with position + assets + `menu_id` linkage beats 50 page-builder widgets; it also makes blocks portable across schools (marketplace SKU-able).
4. **Menus are the information architecture.** Model the site as menus→pages (with parent breadcrumbs + per-page SEO JSON), and let non-page menus point to blocks or modules (events, gallery, blog archives at `/b/{slug}/category/{cat}`). Our website_builder should ship this primitive rather than free-form pages only.
5. **Config-as-data with `is_public`.** One settings table + JSON seed + public flag consumed by the SPA boot payload. Our Next.js/Flutter apps currently hardcode more than they should; a `GET /config` boot payload with per-school public settings (currency, BS/AD format, colors) would simplify 5 Flutter apps + 216 web pages.
6. **Build the two reusable workflow engines**: (a) multi-level approval (`approval_types/levels/requests`), (b) edit-request-with-approval. Both are cross-plugin (leave, fees concession, content, multi_branch ops) and would give our marketplace a "workflow" category instead of N bespoke implementations.
7. **Permission matrix as a shipped file.** `resources/var/permission.json` (17 roles × full matrix) doubles as documentation and seed. Our plugin manifests list permissions per plugin; add a shipped role→permission default matrix so new tenants get sensible roles (principal, accountant, exam-incharge, receptionist…) on day one.
8. **Import/export as an onboarding feature.** Downloadable sample formats per import (`DownloadFormatController`), imports for every master data type, delete-imported-students-at-once (v4.3). For school migrations (including from InstiKit installs), our iemis_importer should grow a generic "import anything with a sample file" UX.
9. **Ship a public changelog with monthly cadence.** InstiKit's README version log (17 releases/15 months, each with named features) is half its sales pitch. Our `docs/` should carry a public-facing release log; our marketplace should render per-plugin changelogs from manifests.
10. **Dashboard = widgets = endpoints.** Role dashboards assembled from small permission-gated endpoints (`dashboard/celebration`, `dashboard/timetable`, `dashboard/mess-schedule`) let plugins contribute widgets via manifest — a natural extension of our plugin system (declare dashboard widgets in `manifest.yaml`, render whatever the role can see).
11. **Counter-grade finance controls sell to accountants.** Day closure, day book user-wise collection, transaction vouchers/categories, cheque clearing, payment-link QR. Nepali school front offices run on cash/cheque; our digital-gateway excellence needs these analog complements.
12. **Licensing framing**: Envato Regular (1 instance) vs Extended (multiple instances, commercial) is exactly our marketplace's future (per-school vs white-label agency). Their "Import Role & Permission between different Installation" acknowledges the pain of per-instance ops — our central SaaS is the answer; market it against exactly that pain.
13. **Exportable site presets are a marketplace primitive.** InstiKit ships `app/Http/Controllers/Site/BlockExportController.php` and `PageExportController.php` — pages and blocks export as files and re-import into any install. For our website_builder, sell/distribute school-website presets (admissions-focused, kindergarten, +2 college) as installable page/block bundles; plugin manifests can carry `website_presets` alongside routes and permissions.
14. **Nine payment flows, one gateway layer** (§2.4): separate services for online/guest/anonymous/registration/guest-registration/head-wise/multi-head flows all funnel into the same `PaymentGateway/*` classes with shared initiate/complete/fail callbacks. Our fees plugin should grow payment contexts the same way (admission fee, event fee, guest fee) instead of one monolithic pay endpoint — each new context is then a manifest flag, not a fork.

---

## Appendix: Verification Notes

- **Not WordPress**: `INSTIKIT/composer.json` (`laravel/framework ^12.0`, no WP packages); `artisan` at root; `README.md` v4.0.0 changelog "Rewritten from scratch with latest version of Laravel, Vue.js & Tailwind CSS".
- **Module tree**: `resources/var/modules.json` (33 top modules, printed in full during audit).
- **Roles/permissions**: `resources/var/permission.json`; student/guardian permission sets verified identical (29 each).
- **Guest funnel**: `routes/guest.php` read in full; every route flagged with `feature.available:*`.
- **Gateways**: 10 classes in `app/Services/Finance/PaymentGateway/`; no Nepal gateway (grep for esewa/khalti/fonepay/connectips: no hits).
- **Nepal features**: grep for `nepali|iemis|bikram|bs calendar` across `app/ lang/ config/ resources/var/` → no hits (only `country.json` contains Nepal as a country row).
- **No GPS**: no gps/live-tracking refs under `app/Services/Transport/` or `app/Models/Transport/`.
- **No question bank / no conferencing**: greps for `question_bank`, `zoom|jitsi|agora|webrtc` → only `app/Enums/Resource/OnlineClassPlatform.php` (URL template platform enum); `OnlineClass` stores a `url`.
- **No subscription/billing** (it's a per-license download): grep `subscription|billing_plan` in models → no hits.
- **No license-check code** in the shipped copy (nulled) — licensing terms come from `README.md` only.
- **Multi-institute**: `app/Models/Team.php` (`organization()` belongsTo, `scopeAllowedTeams`), `update_configs_table_with_team_id_column.php`, `{team}` params in `routes/guest.php`.
- **ASchool side**: `backend/app/plugins/modules/` (44 dirs), `backend/app/api/v1/` (60 files, 706 route decorators), `backend/README.md` (5 apps, stack), prior audit format from `docs/competitor-audits/eschool-v3.3.6.md`.
