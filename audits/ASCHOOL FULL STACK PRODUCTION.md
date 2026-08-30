# ASCHOOL — FULL-STACK PRODUCTION READINESS: AUTONOMOUS AUDIT & IMPLEMENTATION MANDATE

You are acting as a senior autonomous full-stack engineering agent with direct read/write access to the **ASchool** codebase: a Next.js frontend, a Python/Flask backend, four Flutter apps (`flutter_admin`, `flutter_teacher`, `flutter_parent`, `flutter_student`) plus a shared `aschool_shared` Dart package, and a 57-plugin marketplace architecture built for the Nepali K-12 school-ERP market (eSewa/Khalti/Fonepay payments, IEMIS/MoEST compliance, Bikram Sambat calendar, Sparrow/Aakash SMS, WhatsApp Cloud API, biometric/GPS hardware, Claude/Groq AI tools). ASchool competes with Veda ERP, Teachmint, PowerSchool, ManageBac, and Toddle.

## YOUR MISSION

Make **every feature on this platform actually work, end-to-end, in production, with real data, real calculations, and real generated documents** — not "should work," not stubbed, not partially wired. A customer on any plan should be able to sign up, get exactly the features they paid for, and use every one of them without a 404, a silent failure, a wrong number, or a broken PDF. Zero tolerance for placeholder logic, mismatched API contracts across backend/frontend/mobile, dead links, or unenforced business rules.

This is a long, multi-session engineering effort, not a quick pass. Take as much time and as many tool calls / iterations as required — hours if needed. Do not summarize prematurely, do not mark anything "done" without verifying it yourself by running it, and do not stop after a shallow, file-existence-only pass.

---

## 0. GROUND RULE: THE PRIOR AUDITS ARE LEADS, NOT TRUTH — VERIFY EVERYTHING YOURSELF

You've been given 7 prior audit documents produced by a different AI model (Gemini, via "Antigravity AI" multi-agent audit) on 2026-08-27:

1. `AUDIT_INDEX.md`
2. `BACKEND_QA_AUDIT.md`
3. `FRONTEND_QA_AUDIT.md`
4. `MOBILE_APP_QA_AUDIT.md`
5. `MARKET_COMPETITOR_ANALYSIS.md`
6. `ALL_57_PLUGINS_DEEP_DIVE_AUDIT_2026-08-27.md`
7. `PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md`

**Do not trust these at face value.** They are useful as a starting checklist of places to look, and nothing more. I already cross-read all 7 in full and found that they **directly contradict each other** and, in places, contradict themselves — proof that "the file exists and looks wired up" was sometimes treated as "100% working" without anyone actually running the flow. Your first job is to independently re-derive ground truth from the live codebase (grep the actual routes, run the actual queries, hit the actual endpoints, render the actual PDFs) — then use the prior audits only to make sure you don't miss a spot they happened to notice.

### Documented contradictions you must resolve first (do not skip these — they indicate the audits were not internally consistent):

1. **"100% Working" vs "Locked for every new signup."** `ALL_57_PLUGINS_DEEP_DIVE_AUDIT` marks nearly all 57 plugins 🟢 "100% Fully Working." But `PACKAGE_SELECTION_AND_FEATURE_AUDIT` shows that `backend/app/api/v1/auth.py` (lines ~302–308) hardcodes installation of only **6 plugins** (`attendance, notices, academics, basic_reports, basic_website, fees`) for **every plan** on registration — meaning a Starter or Pro customer who paid for `exams`, `sms_notifications`, `lms`, `hr_payroll`, etc. gets none of them and sees 🔴 Locked / 403 everywhere. "The code for the feature exists" and "a paying customer can actually reach the feature" are two different claims — audit both, separately, for all 57 plugins.
2. **`reports.py` PDF generation.** `BACKEND_QA_AUDIT` says `reports.py` "Needs full `weasyprint` HTML-to-PDF conversion logic... rather than JSON data" (i.e., PDFs don't actually generate). `ALL_57_PLUGINS_DEEP_DIVE_AUDIT` says `basic_reports` is "🟢 100% Fully Working" via WeasyPrint. Actually open `reports.py`, actually call the endpoint, actually try to open the resulting file as a PDF. Resolve which claim is true.
3. **`design_studio.py` document generation.** `BACKEND_QA_AUDIT` says it "Needs `reportlab` and `Pillow` integration for generating bulk ID cards and Certificates server-side." `ALL_57_PLUGINS_DEEP_DIVE_AUDIT` calls `design_studio` "🟢 100% Working" (frontend Fabric.js canvas editor). Both can be true at once — single-item canvas export may work while bulk server-side generation (e.g., "print ID cards for all 340 students in Grade 8") does not. Verify bulk generation specifically; don't assume single-item export coverage implies bulk works.
4. **PluginGate slug mismatches — some may be stale.** `FRONTEND_QA_AUDIT` claims there is no `iemis_importer.yaml` manifest and no `file_management.yaml` manifest, causing lockouts. But `PACKAGE_SELECTION_AND_FEATURE_AUDIT`'s full 57-plugin matrix lists `iemis_importer` as plugin #57 with a working `@plugin_required` decorator, and `ALL_57_PLUGINS_DEEP_DIVE_AUDIT` lists `file_management` as plugin #6, a working Core plugin. These frontend-audit claims may simply be wrong or stale — actually diff the manifest filenames in `backend/app/plugins/manifests/` against every `<PluginGate slug="...">` in the frontend, one by one, and produce a definitive mismatch list. Do the same for the claimed `hr` vs `hr_payroll` and `communications` slugs (note: "communications" doesn't appear to be a real plugin in the 57-plugin registry at all — determine whether it's a stray nav grouping or a genuine missing manifest).
5. **The Enterprise-bundle trap.** `PACKAGE_SELECTION_AND_FEATURE_AUDIT`'s own proposed remediation (`PLAN_BUNDLES["enterprise"]`) includes `biometric` and `multi_branch`. But `ALL_57_PLUGINS_DEEP_DIVE_AUDIT` explicitly marks both as **⚪ Delisted, `is_published: False`, with unimplemented backend drivers/models.** If you naively implement the suggested auto-install-by-plan-bundle fix, you will auto-install two plugins into every Enterprise customer's account that literally do not work, the moment they sign up. You must either (a) actually implement working backend logic for `biometric` (hardware driver integration) and `multi_branch` (cross-tenant aggregation models) before bundling them, or (b) exclude them from the auto-install bundle and keep them explicitly unpublished/"coming soon" in the marketplace UI until they're real. Decide and document which, and make the bundle definitions match reality.
6. **`disaster_management` aliasing.** Confirm whether `disaster_management` truly aliases cleanly to `emergency` end-to-end (frontend route, plugin manifest, gating, mobile) or whether this is a backend-only alias that the frontend/mobile don't know about.
7. **"Live Ready" external API claims.** The External APIs table in `ALL_57_PLUGINS_DEEP_DIVE_AUDIT` marks eSewa, Khalti, Fonepay, Sparrow/Aakash SMS, WhatsApp Cloud API, OneSignal, Claude, Groq, Jitsi, ESP32 GPS, ClamAV, and IEMIS all as 🟢 "Live Ready." Treat this as unverified. "Live Ready" should mean: valid production credentials are configurable, the integration has been round-tripped against the real (or real-sandbox) API at least once, and failure modes (bad credentials, API downtime, webhook signature mismatch) are handled gracefully rather than crashing the request. Re-verify each one individually — don't accept the table.

Wherever you find a genuine contradiction like the above, resolve it by reading and running the actual code, then explicitly note in your audit output which prior claim was correct, which was wrong, and why — this matters for trusting future automated audits.

---

## 1. OPERATING PRINCIPLES (apply to everything you do below)

1. **Evidence over assumption.** Every finding you report must cite an actual file path + line reference you looked at. "Fixed" must be backed by a test you ran or a request/response you actually executed — not by code inspection alone where runtime behavior is what matters (calculations, PDF/document output, payment gateway calls, DB migrations).
2. **No hallucinated structure.** Don't guess route names, model fields, manifest filenames, or plugin slugs — grep for them and quote what you found.
3. **Full coverage, not sampling.** All 57 plugins get individually audited and individually verified across all four layers (backend, frontend, mobile, external integration) they touch. Don't extrapolate "plugin A was broken this way, plugin B in the same category probably is too" — check each one on its own.
4. **Real implementations only.** No mocked return values, no `TODO`/`FIXME` left in a code path you touch, no hardcoded fixture data standing in for live data, no `except Exception: pass` swallowing real errors, anywhere you ship.
5. **Cross-stack consistency is mandatory.** For every plugin/feature: backend route ↔ DB model/migration ↔ plugin YAML manifest ↔ `@plugin_required` slug ↔ frontend fetch call ↔ `<PluginGate slug>` ↔ Flutter repository call ↔ Flutter model `fromJson` parsing must all agree, end to end. A mismatch anywhere on that chain is a bug you log and fix.
6. **Money and grades are sacred.** Anything touching fee amounts, payroll, GPA/grades, or payment gateway callbacks gets extra scrutiny: hand-computed worked examples, edge cases (zero credit hours, missing allowances, partial payments, refunds, failed webhook signatures), and an actual re-run against a test fixture before you call it correct.
7. **Honest reporting over appearing complete.** If something can't be fully fixed in this pass (e.g., it needs real hardware, real production credentials, or a genuine third-party account you don't have), say so explicitly with the specific blocker — do not mark it "done" or quietly go silent on it. A shorter, accurate report is worth more than a long one with hidden gaps.

---

## 2. METHODOLOGY

### Phase 0 — Baseline & Ground-Truth Mapping
- Get the backend running locally with a real (or seeded test) database and the frontend build passing. Attempt to build at least one Flutter app to confirm the toolchain works.
- Enumerate, by grepping/reading source (not by trusting any audit doc):
  - Every Flask blueprint, its URL prefix, and every route inside it.
  - Every SQLAlchemy model and its fields (esp. anything the audits flagged: `Attendance` vs `AttendanceRecord`, `Marks` vs `ExamResult`, `obtained_marks` vs `marks_obtained`).
  - Every plugin YAML manifest filename in `backend/app/plugins/manifests/`.
  - Every `<PluginGate slug="...">` usage across `frontend/app/`.
  - Every Flutter repository method and the endpoint path it calls, per app.
- Build one canonical mapping table: **Plugin → backend routes → DB models → manifest slug → frontend pages/PluginGate slug → Flutter screens/endpoints → external API dependency.** Keep this as a living working file you update through the whole project (e.g., `audits/PLUGIN_TRUTH_MAP.md`) — with 57 plugins across 4+ layers this is too much to hold in context; externalize it.

### Phase 1 — Fix the Business-Critical Entitlement Bug First (P0, do this before anything else)
This is the highest-severity issue found: **customers are not receiving the features they pay for.**
- Confirm the exact current behavior of `backend/app/api/v1/auth.py`'s registration flow (hardcoded 6-plugin install, no `max_students` set per plan, no AI quota provisioned).
- Design and implement a single source of truth for plan → plugin entitlements (e.g., `PLAN_BUNDLES` + `PLAN_STUDENT_LIMITS` constants, or a DB-backed plan table if that's a better long-term fit given the existing marketplace/a-la-carte architecture) and wire registration to actually use it.
- **Before finalizing any bundle**, resolve the delisted-plugin trap from §0.5 above — do not auto-install `biometric` or `multi_branch` (or any other plugin you find is unimplemented/`is_published: False`) into a paying customer's account unless you've made it actually functional in this same pass.
- Enforce `school.max_students` at every student-creation path (`students.py` create + bulk import, `iemis_importer.py` bulk import) with a clean, upgrade-prompting error response — not a silent cap or a crash.
- Ensure `AISchoolQuota` (or equivalent) is provisioned at signup for every plan, and audit whether AI service files bypass the token hub (`AITokenHub`) by instantiating `Anthropic()`/Groq clients directly — if so, route them through the hub so usage is actually tracked and quota-enforced.
- Fix the a-la-carte marketplace UI/flow so it's coherent with whatever plan model you land on (don't leave the "advertised 3-tier plans" and "actual 57 individually-priced plugins" stories in permanent conflict — decide the real product model, implement it consistently, and make the pricing page, signup flow, marketplace page, and billing all agree).
- Test this by actually registering three fresh test accounts (Free, Starter, Growth/Pro) and confirming from the dashboard sidebar and API that each receives exactly its entitled plugin set, correct student limit, and correct AI quota — not by reading the code and assuming it works.

### Phase 2 — Plugin-by-Plugin Exhaustive Verification (all 57, see Appendix B for the full list)
For **every** plugin, produce and verify against this checklist — don't skip any, don't batch-approve a category because one member of it checked out:
- [ ] Backend blueprint routes exist, are mounted, and return correct data for real (non-empty) DB state — not just 200 OK with an empty/stub payload.
- [ ] Every calculation the plugin performs is verified by hand against a worked example (see Phase 3 for specifics on GPA/payroll/attendance/fees).
- [ ] Every document/PDF/certificate/report the plugin can generate actually generates a valid, openable file with correct data in it — for both single-item and bulk generation where applicable.
- [ ] Mutating endpoints handle failure safely (`try/except` + `db.session.rollback()`, no partial writes).
- [ ] Plugin YAML manifest slug, `@plugin_required` decorator slug, and frontend `<PluginGate slug>` are byte-identical (including alias handling for `library`/`library_management`, `digital_content`/`elibrary`, `portfolio`/`student_portfolio`, `disaster_management`/`emergency`).
- [ ] Frontend page fetches the correct, currently-existing backend endpoint (not a renamed/legacy path), and has both `isLoading` and `isError` UI states, not just loading.
- [ ] If the plugin has mobile coverage (per Appendix B / the mobile audit's gap list), the Flutter screen exists, calls the correct endpoint, and the model's `fromJson` handles type mismatches safely (int-vs-string IDs, numeric-vs-string marks, missing/null fields) rather than throwing.
- [ ] If the plugin has no mobile coverage and genuinely should for parity with the web dashboard (weigh this against actual user need — a superadmin-only tool may not need a phone screen), log it as a scoped follow-up rather than silently ignoring it; if it's in scope for this pass, build a real (not placeholder) screen.
- [ ] External API/hardware dependency (if any) is genuinely wired with real credentials-config, has graceful failure handling, and — where feasible without physical hardware/production accounts you don't have — has actually been exercised against a sandbox/test credential.
- [ ] Marketplace/pricing metadata (price, category, plan bundle membership) is consistent everywhere it's displayed (landing page, pricing page, signup flow, in-app marketplace, billing).

### Phase 3 — Cross-Cutting Backend Correctness
- **GPA/Grading (`nepal_grading.py`, `exams.py`):** Confirm the weighted-average-by-`credit_hours` GPA logic actually matches Nepal CDC/NEB letter-grading rules (A+, A, B+, B, C+, C, D, NG, 4.0 scale) with at least 3 hand-worked examples (equal credit hours, unequal credit hours, a subject with zero/null credit hours — make sure that doesn't divide-by-zero or silently drop the subject).
- **Payroll (`hr_payroll.py`):** Confirm `gross = basic + total_allowances` and `net = gross - total_deductions` is correct against real allowance/deduction records (not the basic-salary-only fallback bug described in the prior audit), and verify monthly auto-generation (`payroll_monthly.py` task) actually produces correct payslips for a multi-employee test fixture, including partial-month joiners/leavers if the system supports them.
- **Fees:** Verify discount stacking, partial payments, and gateway callback reconciliation (eSewa/Khalti/Fonepay) produce a correct `FeeReceipt` and correct outstanding balance — including the failure path (payment initiated but callback never arrives, or signature verification fails).
- **Import errors:** Confirm and fix (or confirm already fixed) the `Attendance`/`AttendanceRecord`, `Marks`/`ExamResult`, and `obtained_marks`/`marks_obtained` mismatches in `risk_detector.py`, `adaptive_learning.py`, and `benchmarking_ai.py` by actually importing and running each module, not just reading the diff.
- **Transactional integrity:** Add proper `try/except` + `db.session.rollback()` to every mutating route in `fees.py`, `exams.py`, `hr_payroll.py`, and any other high-write plugin missing it — verify by forcing an exception mid-transaction in a test and confirming no partial row survives.
- **PDF/document generation:** Stand up (or confirm working) a shared `PdfGenerator`-style utility wrapping WeasyPrint for `reports.py`, and `reportlab`/`Pillow` for bulk ID-card/certificate generation in `design_studio.py`. Actually generate a sample of each document type and visually/structurally confirm correctness (right data in right fields, correct page size, no broken template variables like `{{student.name}}` leaking into the output).
- **Typos/aliases:** Confirm the `admission_followup.py` Celery task plugin_slug typo (`"admissions"` → `"admission"`) and the `disaster_management` → `emergency` alias registration in `decorators.py`'s `PLUGIN_SLUG_ALIASES` are both actually correct and exercised by a real Celery task run, not just present in source.

### Phase 4 — Frontend Correctness & UX
- Resolve every 404/broken-fetch flow, including the white-label pages (`/dashboard/white-label/domain|theme|branding`) calling non-existent `/schools/white-label/*` endpoints instead of the working `/website-builder/domain` endpoint — decide the correct canonical route and fix every caller, don't just patch the symptom.
- Add `isError` boundaries wherever a `useQuery`/fetch-hook checks `isLoading` but not error state.
- Fix every `<PluginGate slug>` to exactly match its manifest (see Phase 2 checklist) — don't do a global find/replace blindly, verify each one individually since some prior "mismatch" claims may be stale (§0.4).
- Enforce the design system: eliminate hardcoded colors (`text-purple-600` etc.) in favor of the defined Forest Green tokens (`ocean`, `mint`, `ink`), consistently, across all dashboard pages — not just the ones the prior audit happened to sample.
- Add `overflow-x-auto` (or equivalent responsive handling) to every table wrapper missing it, not just the two pages the prior audit flagged (`sms/page.tsx`, `exams/results/page.tsx`) — grep for the anti-pattern across the whole `app/dashboard/` tree.
- Fix landing-page footer stub links (Privacy, Terms, Support) — build real pages or route to real, current content, not `href="#"`.
- Wrap any currently-ungated routes that should require a plugin entitlement (`/dashboard/website-builder/*`, `/dashboard/conferences`, `/dashboard/bulk-uploads/iemis`, and any others you find via the audit) in `<PluginGate>` so users see a clean upgrade prompt instead of a working-looking UI backed by a 403.

### Phase 5 — Mobile Correctness & Parity
- Verify every Flutter → backend endpoint call against the real, current Flask route (method, path, query params, request/response shape) for all 4 apps — not just the ones flagged in the prior audit. Pay special attention to the specific mismatches called out: `/student/assignments/$id/submit` vs `/assignments/<id>/submissions`, `/hr-payroll/leaves/apply` vs the actual `hr_payroll` route, `/ai/${tool}/generate` vs `/ai-tools/${tool}/generate`.
- Harden `fromJson` parsing in `aschool_shared/lib/models/` — replace unsafe casts like `json['id'] as String` with null/type-safe coercion (`(json['id'] ?? '').toString()`), and audit `exam.dart` (`marksObtained`/`totalMarks`) and `assignment.dart` for the same class of risk. Do this platform-wide across the shared models directory, not only the three files named in the prior audit.
- For the plugin-parity gap list (`ai_adaptive_learning`, `benchmarking`, `white_label`, `biometric`, `disaster_management`, `multi_branch`, `gps_tracking`, `hostel`, `student_portfolio`, `social_ads`, `conferences`, `iemis_importer`, `whatsapp_bot`, `sms_notifications`, `elibrary`, `ai_tutor`, `ai_insights`, `ai_grading`, `advanced_analytics`): for each, decide (and state your reasoning) whether it genuinely needs a mobile screen for its actual user role (e.g., a parent almost certainly needs `sms_notifications`/`whatsapp_bot` visibility; `multi_branch` chain administration probably doesn't need a phone screen), then either build a real, functional screen or explicitly scope it out with a reason.

### Phase 6 — External Integrations & Hardware — Verify "Live Ready" For Real
For each of eSewa, Khalti, Fonepay, Sparrow SMS, Aakash SMS, WhatsApp Cloud API, OneSignal, Anthropic Claude, Groq, Jitsi Meet, ESP32 GPS tracker, ClamAV, and Nepal MoEST IEMIS:
- Confirm the credential/config source (env var or `School.fee_config`) is actually read and validated at startup or first use, with a clear error if missing — not a silent no-op.
- Where you have sandbox/test credentials available, actually exercise the integration (a test SMS, a test webhook payload, a test AI completion) and confirm the response is parsed and handled correctly, including the failure/timeout path.
- Where you cannot exercise it for real (e.g., physical ESP32 hardware, ClamAV daemon, production payment credentials), state that explicitly as a documented limitation rather than claiming it's verified.

### Phase 7 — Competitive/Market Research Refresh (use live web search)
- Re-verify the `MARKET_COMPETITOR_ANALYSIS.md` claims about Veda ERP, Teachmint, PowerSchool, ManageBac, and Toddle with **current** web research — pricing, feature sets, and AI capabilities in EdTech move fast; don't rely on stale training data or the prior audit's summary alone.
- Specifically re-check: Toddle's and ManageBac's current AI grading/feedback tooling, PowerSchool's PowerBuddy AI capabilities, Teachmint's current hardware+EduAI bundle, and Veda's current mobile app feature set — cite what you actually find, with dates.
- Turn any genuinely new, buildable gap into a scoped backlog item (not vague inspiration) with an effort estimate, ranked by competitive impact vs. build cost.

### Phase 8 — Testing & Verification Standards
- Write and run automated tests for every calculation path touched (GPA weighted average, payroll gross/net, attendance percentage, fee balance/discount stacking) with edge cases, not just the happy path.
- Write and run integration tests for every endpoint you fix (correct 200 payload shape, correct 403 when unentitled, correct 404 vs 400 semantics).
- Do a manual click-through per user role (superadmin, school_admin, teacher, student, parent, staff, accountant) on web, and per app on mobile, for every plugin that role can access.
- Regression-test everything the prior audits claimed was "already fixed" — confirm it's actually fixed in the current source, don't just trust the changelog entry.

### Phase 9 — Documentation & Reporting Deliverables
Follow the existing conventions in `audits/AUDIT_INDEX.md` (root `audits/`, historical logs moved to `audits/old/`):
- A new, dated, **independently-verified** master audit (e.g., `audits/PRODUCTION_READINESS_AUDIT_[date].md`) that supersedes the Gemini-generated ones — for every finding, state what the prior audit claimed, what you actually found, and what you did about it.
- A running implementation changelog of every file touched and why.
- A **57-row production-readiness scorecard** (Plugin | Backend | Frontend | Mobile | External API | Status: ✅ Verified Working / ⚠️ Partial / ❌ Broken / ⚪ Out of scope this pass, with one-line evidence per cell) — use Appendix B below as your starting row list, corrected as you go.
- An honest "known remaining issues" backlog for anything not completed in this pass, with reasons (needs real hardware, needs a third-party account you don't have, needs a product decision from the team, etc.) — do not omit items to make the report look cleaner.

---

## 3. DEFINITION OF "PRODUCTION READY" (apply this bar to every single fix)

A feature is production-ready only when **all** of the following are true:
- No placeholder, mock, or hardcoded return value stands in for real computed/fetched data.
- No `TODO`/`FIXME`/`pass  # stub` remains in the code path.
- The backend route, DB model, plugin manifest slug, frontend fetch + `<PluginGate>` slug, and (where applicable) Flutter repository + model all agree with each other — verified, not assumed.
- Every calculation has been checked against at least one hand-worked example and at least one edge case.
- Every generated document/PDF has actually been generated and opened/inspected, not just "the generation function exists."
- Every mutating write path handles failure without leaving partial/corrupt data.
- Every error state is surfaced to the user (frontend `isError` UI, mobile try/catch with user-facing message) — nothing fails silently.
- The feature has been exercised by an entitled test account of the correct plan/role and confirmed to actually appear and work, not just theoretically reachable.

---

## 4. APPENDIX A — Seed Issue List From Prior Audits (verify each; do not add to shipped code until confirmed against live source)

**P0 — Business-critical / revenue-impacting**
- [VERIFY] Registration hardcodes only 6 plugins for all plans; Starter/Pro/Enterprise customers don't receive paid entitlements (`auth.py` ~L302–308).
- [VERIFY] `school.max_students` never enforced (student create, bulk import, IEMIS bulk import) and never updated per plan on signup.
- [VERIFY] `AISchoolQuota` never provisioned at signup; several AI service files instantiate `Anthropic()`/Groq directly, bypassing `AITokenHub` usage tracking.
- [VERIFY] `biometric` and `multi_branch` are delisted/unimplemented but appear in a proposed Enterprise auto-install bundle — resolve before wiring bundles.
- [VERIFY] `fees` is installed "on trial" for the Free plan per the package audit's status table — confirm this trial behavior is intentional and correctly time-boxed, not an accidental permanent-trial state.

**P1 — Correctness (money, grades, documents)**
- [VERIFY] `nepal_grading.py` weighted-GPA-by-credit-hours logic, incl. zero/null credit-hour edge case.
- [VERIFY] `hr_payroll.py` gross/net calculation uses real allowances/deductions, not basic-salary fallback.
- [VERIFY] `reports.py` produces real WeasyPrint PDFs (resolve contradiction in §0.2).
- [VERIFY] `design_studio.py` bulk ID-card/certificate server-side generation (resolve contradiction in §0.3).
- [VERIFY] `risk_detector.py` (`Attendance` vs `AttendanceRecord`), `adaptive_learning.py` / `benchmarking_ai.py` (`Marks` vs `ExamResult`, `obtained_marks` vs `marks_obtained`) import fixes actually run without error.
- [VERIFY] `admission_followup.py` Celery task `plugin_slug` typo fix actually dispatches correctly.
- [VERIFY] Missing `try/except` + `db.session.rollback()` in `fees.py`, `exams.py`, `hr_payroll.py`.

**P2 — Frontend integration**
- [VERIFY] White-label pages fetch non-existent `/schools/white-label/*` instead of working `/website-builder/domain`.
- [VERIFY] Missing `isError` states across pages that check `isLoading` only.
- [VERIFY] `<PluginGate>` slug mismatches: `hr` vs `hr_payroll`, `iemis_importer`, `file_management`, `communications` — confirm each individually, several prior claims may be stale (§0.4).
- [VERIFY] Hardcoded colors vs Forest Green design tokens across dashboard pages.
- [VERIFY] Missing `overflow-x-auto` on dashboard tables (`sms/page.tsx`, `exams/results/page.tsx`, and grep for others).
- [VERIFY] Landing page footer dead links (Privacy, Terms, Support).
- [VERIFY] Ungated routes: `/dashboard/website-builder/*`, `/dashboard/conferences`, `/dashboard/bulk-uploads/iemis`.

**P3 — Mobile**
- [VERIFY] Endpoint mismatches: attendance submit, assignment submit/grade routes, `hr-payroll/leaves/apply`, `ai/${tool}/generate`, academics subjects query params.
- [VERIFY] Unsafe `fromJson` casts in `attendance.dart`, `exam.dart`, `assignment.dart`, and audit the rest of `aschool_shared/lib/models/` for the same pattern.
- [VERIFY] ~19-plugin mobile parity gap (list in Phase 5 above) against actual current user need per role.

**P4 — Competitive/product**
- [VERIFY & REFRESH] Curriculum-first planning tools, AI-assisted grading/lesson-planning depth, interactive-classroom parity, role-specific mobile app polish, portfolio/curriculum modules, and marketing leverage of the IEMIS integration — re-researched live, not copied from the prior report.

---

## 5. APPENDIX B — Full 57-Plugin Registry (starting scorecard rows — correct as you verify)

| # | Slug | Category | Price (NPR/mo) | Notes to verify |
|--:|---|---|---|---|
| 1 | `academics` | Core | Free | BS calendar, class/section/subject hierarchy |
| 2 | `attendance` | Core | Free | SMS-on-absence event listener |
| 3 | `basic_reports` | Core | Free | WeasyPrint PDF — resolve §0.2 |
| 4 | `basic_website` | Core | Free | Public tenant subdomain site |
| 5 | `dashboard` | Core | Free | KPI aggregation |
| 6 | `file_management` | Core | Free | ClamAV-scanned uploads; manifest existence disputed §0.4 |
| 7 | `marketplace_nav` | Core | Free | Plugin catalog/subscriptions |
| 8 | `notices` | Core | Free | Broadcast to all 4 mobile apps |
| 9 | `settings_core` | Core | Free | School profile/config |
| 10 | `students` | Core | Free | SIS — max_students enforcement lives here |
| 11 | `teachers` | Core | Free | Faculty management |
| 12 | `users` | Core | Free | RBAC, 7 roles |
| 13 | `fees` | Starter | 399 | eSewa/Khalti/Fonepay; "on trial" status disputed |
| 14 | `exams` | Starter | 399 | GPA/grading — high scrutiny |
| 15 | `assignments` | Starter | 299 | Mobile submit/grade endpoint mismatch |
| 16 | `library_management` (alias `library`) | Starter | 199 | Overdue Celery task |
| 17 | `sms_notifications` | Starter | 199 | Sparrow SMS; missing mobile screen |
| 18 | `whatsapp_bot` | Starter | 399 | Meta Cloud API webhooks; missing mobile screen |
| 19 | `conferences` | Starter | 199 | Ungated frontend route |
| 20 | `dismissal` | Starter | 299 | SSE live gate queue |
| 21 | `elibrary` (alias `digital_content`) | Starter | 299 | Missing mobile screen |
| 22 | `incidents` | Starter | 199 | |
| 23 | `timetable` | Starter | Free | AI schedule solver |
| 24 | `iemis_importer` | Add-on | Free | Ungated UI but gated API — mismatch to fix |
| 25 | `admission` | Growth | 699 | `admission_followup.py` typo |
| 26 | `ai_grading` | Growth | 599 | Claude-based; token-hub bypass risk |
| 27 | `ai_insights` | Growth | Free | Weekly Celery task |
| 28 | `ai_tutor` | Growth | 499 | Missing mobile screen despite student-facing use case |
| 29 | `alumni` | Growth | 299 | |
| 30 | `compliance` | Growth | 499 | |
| 31 | `design_studio` | Growth | 499 | Bulk server-side gen disputed §0.3 |
| 32 | `emergency` (aliases `disaster_management`) | Growth | 399 | Verify alias fully wired |
| 33 | `gamification` | Growth | 299 | |
| 34 | `gps_tracking` | Growth | 599 | ESP32 hardware; missing mobile screen |
| 35 | `health_records` | Growth | 299 | |
| 36 | `hostel` | Growth | Free | Missing mobile screen |
| 37 | `hr_payroll` | Growth | 699 | Gross/net calc — high scrutiny |
| 38 | `incident_management` | Growth | 399 | |
| 39 | `inventory` | Growth | 299 | |
| 40 | `lms` | Growth | 799 | Jitsi WebRTC |
| 41 | `student_portfolio` (alias `portfolio`) | Growth | 299 | Missing mobile screen |
| 42 | `social_ads` | Growth | 499 | Meta/Google Ads; missing mobile screen |
| 43 | `social_hub` | Growth | 699 | Meta Graph API |
| 44 | `visitor_management` | Growth | 199 | |
| 45 | `website_builder` | Growth | 499 | Ungated frontend route |
| 46 | `wellbeing` | Growth | 499 | AI sentiment/distress detection — sensitive data, extra care |
| 47 | `advanced_analytics` | Premium | 999 | `risk_detector.py` import fix |
| 48 | `ai_adaptive_learning` | Premium | 1499 | `adaptive_learning.py` import fix; missing mobile screen |
| 49 | `ai_tools` | Premium | 1499 | Master AI suite, Claude/Groq |
| 50 | `benchmarking` | Premium | 1499 | `benchmarking_ai.py` import fix; missing mobile screen |
| 51 | `biometric` | Premium | 1999 | **Unimplemented/delisted — do not bundle until real** |
| 52 | `disaster_management` | Premium | 999 | Duplicate registry entry vs `emergency` alias — reconcile |
| 53 | `multi_branch` | Premium | 2999 | **Unimplemented/delisted — do not bundle until real** |
| 54 | `white_label` | Premium | 2999 | Frontend fetch mismatch §0.1/P2 |
| 55 | `digital_content` | Alias | Free | → `elibrary` |
| 56 | `portfolio` | Alias | Free | → `student_portfolio` |
| 57 | `library` | Alias | Free | → `library_management` |

*(Note: the prior audits' numbering of aliases vs. real entries is itself inconsistent between documents — reconcile to a single canonical count of 57 as part of Phase 0, and correct this table accordingly in your own output.)*

---

## 6. FINAL INSTRUCTION

Work through this systematically, phase by phase and plugin by plugin. Externalize your tracking (don't try to hold 57 plugins × 4 layers in working memory) into the living map/scorecard files described above, and update them as you go so progress survives across sessions. When you believe the platform is production-ready, do one final full regression pass against this entire prompt — including re-reading your own audit output — before declaring it done. Be exhaustive. Be honest about anything you couldn't fully verify or fix, and say exactly why. Take the time this actually requires.
