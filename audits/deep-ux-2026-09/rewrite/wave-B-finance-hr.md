# Wave B — Fees & HR rewrite (finance + people money)

Agent: wave-B (fees 14 pp + hr 8 pp). Date: 2026-09-14.
Scope discipline honored: only `app/dashboard/fees/**` and `app/dashboard/hr/**` touched; endpoints, payloads and react-query keys unchanged; `tsc --noEmit` filtered to `dashboard/(fees|hr)` = **zero errors** at every 3-page checkpoint and final.

**Research method note:** the session exposes no WebSearch tool. I substituted (a) live WebFetch of NN/g (10 heuristics; empty-state design) and corpus sources the plan itself cites (InstiKit denominations/day-book, InfixEdu per-line ledger, Mighty's advance→pay lifecycle, eSchool billing), and (b) the audit's own research tables (16.3, 34-8/31). Each page's 2-line note below states the applied principle. Where a claim needs more evidence I flagged it.

---

## FEES (13 route files / 14 pages)

### fees/page.tsx — hub (A5)
- Research: A5 hub = launcher + top task, not a duplicate dashboard (plan 32-A5); NN/g empty-state: every blank panel gets a CTA, never a shrug.
- Changes: KPI band (4 exact-NPR cards + skeleton states), `QuickLinks` (Money section) for all 11 subpages, ONE embeddable Recent Payments panel (by-class table removed — belongs to reports), overdue callout as `win11-infobar error` with single Follow-up action, collection-rate progressbar w/ aria, ErrorState on fail, full `t(en,ne)`.
- Flags: KPI cards lack MoM trend data — `/fees/summary` has no `last_month_collected`; recommend adding it so hub KPIs become `MetricCard` deltas.

### fees/collect/page.tsx — POS workspace (A6, kept + upgraded)
- Research: POS cash desks need tender shortcuts + change awareness (NN/g error-prevention + InstiKit counter controls, plan 16.3). Keyboard-operable cards kept (E206 div+role pattern preserved verbatim).
- Changes: filters moved to **URL** (`useUrlFilters` search/class/section/status + `useDebounced`); ledger cards now show per-line fine/waiver breakdown (`base + fine − waiver = net`) and a partial-payment progress bar; Quick Collection gets a **DenominationDialog** (win11-datagrid count matrix → applied total + over/short line) for cash; StatusChip for statuses; skeletons replace spinners; payment-state copy (`Ready to collect`, partial warning, settled infobar) bilingual; till-lock/day-closure flow untouched as mandated.
- Flags: none new; print-twin receipt already via `/fees/receipts/:id/pdf`.

### fees/types/page.tsx (A1)
- Research: ≤2-field registry + undo over confirm (plan 31.2-G8).
- Changes: `undoableDelete` (optimistic hide + rollback) replacing silent delete; SkeletonTable; EmptyState-in-table with CTA; bilingual.

### fees/structure/page.tsx (A8+A3)
- Research: new structures auto-bill → that behavior must be visible at point of action (info callout, NN/g #1).
- Changes: undoable delete; info-bar explaining auto-apply vs Apply Now; `tabular-nums` money; InstallmentsDialog kept (it is a legit >4-field editor) with bilingual labels; toasts state outcomes not success-verbs.

### fees/defaulters/page.tsx (A1 + aging chips)
- Research: AR dunning lists sort by age and show bucket not raw date (plan 34-8 "aging chips").
- Changes: per-row `StatusChip` aging bucket computed client-side (0–30/31–60/61–90/90+) beside the BS overdue date; bilingual; ErrorState; CSV via DataTable.
- Flags: true aging needs invoice-level `oldest_due` from `/fees/defaulters`; derived from `overdue_since` — backend already supplies it per student.

### fees/scholarships/page.tsx (A1)
- Research: discount registry = CRUD dialog ≤7 fields (A3-in-dialog, 31.3).
- Changes: undoable delete; DataTable loading prop + CTA empty state; all labels bilingual; validity/fee-type advanced fields already ≤7 visible.

### fees/reports/page.tsx (A7 tabs)
- Research: filter-like switching belongs in URL (plan 33-2: tabs are URL state).
- Changes: Collection/Fines/Waivers tab now deep-linkable (`?tab=` via useUrlFilters); ErrorState with retry; bilingual headers/labels/toasts; fixed the Nepali "छेन"→"छैन" typos surfaced by this pass in existing copy.

### fees/invoices/page.tsx (A1 + DetailSheet)
- Research: AR ledger screens: one row per document, drill via click (InfixEdu fee-detail pattern).
- Changes: status chips + per-line base/fine/waiver breakdown already present → kept; URL state (`?status`, `?page`), bilingual columns (CSV headers follow), tabular money.

### fees/approvals/page.tsx (A1 + inline approve)
- Research: offline-slip queues = two-click verdict with note, FIFO semantics explained (plan 16.3 ledger).
- Changes: `?status` URL filter; bilingual columns; review dialog copy bilingual; approve/reject gated to pending rows (legal transition).

### fees/aging/page.tsx (A7)
- Research: AR aging = bucket band + class roll-up + worst-student drill (accounts-receivable standard).
- Changes: student `oldest_overdue_days` badge → `StatusChip` tone buckets; URL filters (`?as_of`, `?class`); ErrorState; skeletons; bilingual.
- Flags: MetricCard trends impossible — `/fees/receivables/aging` has no as-of history series; recommend `?series=1` or a second call (view-only change ready).

### fees/carry-forward/page.tsx (A1 tabs)
- Research: year-end rollover must preview before commit (wizard discipline, plan 32-A4/33).
- Changes: `?tab=` URL state (wizard|log); bilingual step labels + confirm dialog with money split (due vs credit) kept; `Apply` button disabled when from=to already present — retained.

### fees/day-closure/page.tsx (A4 count→denoms→variance→lock)
- Research: InstiKit day-closure = denominations matrix + variance callout before lock; cashier lockout semantics (kept server-side).
- Changes: denomination entry rebuilt as compact **`win11-datagrid`** table (Note / Count / Subtotal / remove) with tabular money; live **variance infobar** (matches / over by / short by vs day book); `Close Day` disabled until counted>0; **Reopen now behind `useConfirm`** (danger tone); URL `?date=`; ErrorState + skeletons; bilingual.

---

## HR (8 pages)

### hr/page.tsx — hub (A5)
- Research: hub launches + alerts (32-A5); pending-work chips on cards beat generic grid.
- Changes: KPI band with SkeletonStat; `Monthly Payroll` no longer `Rs. 210K` — exact `formatNepaliCurrency` (E205 rule); pending-approval infobars with Review/Process CTAs; bilingual incl. card badges.

### hr/payroll/page.tsx — run workspace (A1-variant)
- Research: payroll UI best practice = one status per run with the next legal action only; approval→payment is irreversible so confirm in-context (Mighty lifecycle; NN/g #5).
- Changes: **StatusTimeline per run** (Generated → Draft → Approved → Paid with counts); hand-rolled table → `DataTable` with `selectable` + `bulkActions` (approve drafts / mark paid — each filtered to legal statuses); **bulk confirm moved to `useConfirm`** (replacing custom staging dialog); row actions show only backend-legal transitions (`_STATUS_TRANSITIONS`: draft→approved, approved→paid — verified against `backend/app/api/v1/hr_payroll.py:323`); month now in URL; skeletons + ErrorState; bilingual; payslip PDF kept.

### hr/payroll/settings/page.tsx (A8)
- Research: settings save must be dirty-gated with effect described per field (A8 rule).
- Changes: Save disabled until changed (server-JSON diff); helper text states each field's effect; bilingual.

### hr/leaves/page.tsx (A1 + inline approve/reject)
- Research: leave approval = one glance, two buttons; rejection needs reason + confirm (leave-UX standard).
- Changes: **`useConfirm` on reject** with staff/days named; `?status` URL filter; DataTable loading + CTA empty state; apply-leave dialog (6 fields ≤7) bilingual; days auto-computed kept.

### hr/leaves/report/page.tsx (A7 + approvals)
- Research: report pages mirror the action list — pending rows still actionable (approval-workflow pattern).
- Changes: inline Approve/Reject (confirm on reject) wired into the report table's new actions column; `?status` URL; CSV export kept; bilingual; "Filter by Status" select labels.

### hr/appraisal/page.tsx (A1 + dialog)
- Changes: 6-field dialog unchanged; Cancel added; full bilingual; DataTable loading replaces full-page spinner; star-score columns bilingual.

### hr/expenses/page.tsx (A1)
- Research: expense registries need dependency-aware emptiness (no categories → can't record).
- Changes: **`undoableDelete`**; **`DependencyMissingEmptyState`** → deep-links `/hr/expense-categories` when no categories; KPI band (total spent + count); bilingual; tabular money.
- Flags: **approval/StatusChip impossible** — `/hr/expenses` payload has no `status` field (backend model gap). Recommend adding `status: pending|approved|rejected` to hr_expense so the wave can render inline approve; UI pattern is already wired here for invoices.

### hr/expense-categories/page.tsx (A1)
- Changes: undoable delete (replacing confirm-then-delete), SkeletonTable, bilingual, empty CTA.

### hr/staff-attendance/page.tsx (A1-variant roster grid)
- Research: staff registers mirror the student roster's quick-mark pattern (plan 34-5: keep keyboard flow).
- Changes: **all-absent now behind `useConfirm` (danger)** matching the student register precedent; `half_day` + `excused` quick buttons added (enum existed in payload type but was unreachable from the UI — pre-filled records of those statuses now editable/visible); unsaved-changes counter in subtitle, reset on save; skeletons; bilingual.
- Flags: keyboard row-nav (P/A/L/E) not present here — recommend porting the student-attendance handler (structural, not view-only).

---

## Global compliance passes (both modules)
- Bilingual `t(en, ne)` via `lib/i18n` on all headers, labels, columns (CSV headers follow), buttons, toasts, empty states.
- Zero `window.confirm/alert` remain in fees|hr (verified by grep).
- Money: `formatNepaliCurrency`/`tabular-nums` everywhere; no "K" abbreviations; exact backend SUMs only, never recomputed.
- Skeletons replace every first-paint spinner; `ErrorState` + Retry on all error branches; `DataTable` `loading`/`error`/`empty` props used instead of early returns where feasible.
- URL-addressability: POS, invoices, approvals, aging, carry-forward, reports tabs, leaves, leaves-report, payroll month, day-closure date all live in query strings via `useUrlFilters` (fixes §14-1 for these screens without touching the shell).

## Needs flagged to the coordinator (no backend touched)
1. `/fees/summary`: add `last_month_collected` (MetricCard trends on the hub + POS band).
2. `/fees/receivables/aging`: time-series or `?series=` (trend sparklines on aging/ defaulters).
3. `hr_expense.status` (pending/approved/rejected) — expenses approval UX is ready and blocked only by the data model.
4. Payroll run-level status endpoint (`/hr/payroll/summary?month=`) — current timeline derives from row statuses client-side; correct today but a server field would be authoritative.
5. Staff-attendance keyboard marking (port of attendance handler) — recommended as a follow-up ticket.
6. PrintButton component (plan 9.5) is still absent from `components/ui` — hub/invoice print twins remain at "statement PDF" level.
