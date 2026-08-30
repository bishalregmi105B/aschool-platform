# PRIOR AUDIT DIFF LOG — Phase 0d (2026-08-28)

> Compares every MATERIAL claim in the 7 prior audit docs (2026-08-27, Gemini/"Antigravity") against
> `DISCOVERED_SYSTEM_INVENTORY.md` (new, source of truth) and CURRENT source (working tree has uncommitted
> fixes; all verdicts are against the tree as of 2026-08-28). Evidence = file:line in this repo.
> `audits/ASCHOOL FULL STACK PRODUCTION.md` is the new audit MANDATE, not a prior audit — handled in §3.
> `audits/old/` contains 18 historical docs (2026-03→2026-08-23; titles-only skim: superseded plans,
> walk-throughs, FIX_TRACKER, tier audits) — out of scope for per-claim diffing.

## Verdict legend
CORRECT = matches current source/runtime · WRONG = contradicts current source/runtime ·
STALE = was true when written, no longer (or vice versa) · UNVERIFIABLE = could not confirm either way.

---

## 1. AUDIT_INDEX.md

| Prior claim | Prior status | Reality | Verdict | Evidence |
|---|---|---|---|---|
| Change log: "Fixed ImportError bugs in AI Services, weighted GPA in nepal_grading.py, fixed hr_payroll payslip" | done 2026-08-27 | All three fixes are present in current source | CORRECT | `backend/app/services/ai/risk_detector.py:41`, `app/services/ai/adaptive_learning.py:34-38`, `app/utils/nepal_grading.py:97-112`, `app/api/v1/hr_payroll.py:255-257` |
| Change log: "removed mandatory OTP blocking on registration" | done | Register returns tokens directly, no OTP sent; but docstring still says "then sends OTP" and `phone_verified=True` unconditional (= inventory E9) | CORRECT (fix real; E9 residue) | `backend/app/api/v1/auth.py:221,286,301-319` |
| "57-plugin exhaustive deep-dive… Full Stack, All 57 Plugins" | indexed as authoritative | 57 unique slugs real, but deep-dive's per-plugin "100% Working" statuses are largely overclaims (see §6) | CORRECT count / STALE status | inventory §2; `backend/app/plugins/loader.py:34-128` |
| old/ index lists 12 historical docs | — | `audits/old/` actually holds 18 files (3 undindexed: ASchool_Copilot_Audit_Prompt, IMPLEMENTATION_PLAN, previous.md, simulate.md, task.md, walkthrough.md — 6 extra) | STALE (index incomplete) | `ls audits/old/` |

## 2. BACKEND_QA_AUDIT.md — every specific claim verified in source

| Prior claim | Prior status | Reality | Verdict | Evidence |
|---|---|---|---|---|
| `nepal_grading.py` GPA now credit-hour weighted | fixed | Weighted calc present | CORRECT | `app/utils/nepal_grading.py:104-112` |
| `hr_payroll.py` payslip gross=basic+allowances, net=gross−deductions | fixed | Exactly that logic (with stored-value fallbacks) | CORRECT | `app/api/v1/hr_payroll.py:239-257` |
| `risk_detector.py` uses `Attendance` (was `AttendanceRecord`) | fixed | `from app.models.attendance import Attendance` | CORRECT | `app/services/ai/risk_detector.py:41` |
| `adaptive_learning.py` uses `Marks`/`obtained_marks` | fixed | Present | CORRECT | `app/services/ai/adaptive_learning.py:34-38` |
| `benchmarking_ai.py` uses `Marks` | fixed | Present | CORRECT | `app/services/ai/benchmarking_ai.py:50-56` |
| `admission_followup.py` `plugin_slug="admission"` | fixed | Line 74 reads `plugin_slug="admission"` | CORRECT | `app/tasks/admission_followup.py:74` |
| fees/exams/hr_payroll lack try/except+rollback (data-corruption risk) | open | Still largely open; inventory additionally found silent `except: pass` in payment callbacks | CORRECT | `app/api/v1/fees.py:1829`, `app/api/webhooks/__init__.py:85,154,245` (inventory §4) |
| `reports.py` needs WeasyPrint (JSON-only today) | open | 239 lines, **zero** WeasyPrint references — still JSON-only | CORRECT | `app/api/v1/reports.py` (grep count 0) |
| `design_studio.py` needs reportlab/Pillow for bulk server-side PDFs | open | Server-side bulk still not PDF: bulk endpoints return JSON arrays; client renders via fabric+jsPDF+JSZip. Claim accurately describes architecture | CORRECT (superseded design: client-side render instead) | inventory §7; `app/services/designer/bulk_generator.py:69,249,305,361`; `frontend/lib/hooks/useExport.ts` |

## 3. FRONTEND_QA_AUDIT.md

| Prior claim | Prior status | Reality | Verdict | Evidence |
|---|---|---|---|---|
| White-label pages fetch `/schools/white-label/{domain,theme,branding}` which don't exist → 404 | bug | Still true: pages call those exact paths; no such routes anywhere in backend (white_label module is a manifest + empty `__init__.py` only) | CORRECT | `frontend/app/dashboard/white-label/domain/page.tsx:26,31`, `theme/page.tsx:24,41`, `branding/page.tsx:23,41`, `white-label/page.tsx:20`; backend grep `white-label` in `app/api` = 0 hits; `app/plugins/modules/white_label/__init__.py:1` |
| `<PluginGate slug="hr">` mismatched (no `hr.yaml`) → lockout | bug | Gate slug normalizes client-side via alias map mirroring backend; `hr→hr_payroll` both sides — gate works despite no manifest | WRONG (stale understanding) | `frontend/lib/plugins.tsx:55-63,92-94`; `backend/app/plugins/decorators.py:13-22` |
| No `iemis_importer.yaml` / `file_management.yaml` → lockout | bug | No legacy manifests, but both exist as **modules** (`modules/iemis_importer/`, `modules/file_management/`) discovered by loader — plugins real, gates resolve | WRONG (premise outdated post module-discovery) | `backend/app/plugins/modules/{iemis_importer,file_management}/manifest.yaml`; `app/plugins/loader.py:34-128` |
| `<PluginGate slug="communications">` has no manifest | bug | Same as above: alias `communications→sms_notifications` both sides; used 3× in frontend, resolves | WRONG | `frontend/lib/plugins.tsx:56`; `decorators.py:14` |
| sms + exams/results tables clipped (no `overflow-x-auto`) | bug | Still 0 occurrences in both files | CORRECT (still unfixed) | `frontend/app/dashboard/sms/page.tsx`, `frontend/app/dashboard/exams/results/page.tsx` (grep 0) |
| Landing footer dummy `href="#"` links (Privacy/Terms/Support) | bug | Still 6 `href="#"` links on landing page | CORRECT (still unfixed) | `frontend/app/page.tsx` (grep count 6) |

## 4. MOBILE_APP_QA_AUDIT.md

| Prior claim | Prior status | Reality | Verdict | Evidence |
|---|---|---|---|---|
| Scope covers `flutter_admin/teacher/parent/student` + shared | — | Misses **flutter_user** (5th app, 5-stage onboarding host). All prior docs say "4 apps"; reality is 5 | WRONG (incomplete scope) | repo tree; inventory §1 "5 Flutter apps" |
| `flutter_admin` has 34 feature directories | — | Exactly 34 | CORRECT | `ls flutter_admin/lib/features/` |
| `/attendance/submit` "needs verification" | open | Route exists, mass submission endpoint real | CORRECT (resolved) | `app/api/v1/attendance.py:109`; `aschool_shared/lib/repositories/attendance_repository.dart:41` |
| Mobile `/student/assignments/$id/submit` may mismatch backend | open | Confirmed broken: backend has `/assignments/<id>/submit`; no `/student/assignments` route → 404 | CORRECT (real 404) | `aschool_shared/lib/repositories/assignment_repository.dart:59` vs `app/api/v1/assignments.py:135` |
| `/assignments/submissions/$submissionId/grade` alignment | open | Mobile path matches backend flat grade route | CORRECT | `assignment_repository.dart:73` vs `app/api/v1/assignments.py:185` |
| Mobile `/hr-payroll/leaves/apply` vs backend | open | Confirmed broken: backend prefix is `/hr` (no `/hr-payroll` string anywhere in `app/api`); shared `hr_repository` calls `/hr-payroll/payslips|leaves|leaves/apply` → all 404. Split-brain: teacher/admin screens use `/hr/leave`, `/hr/payroll` (work) and `/hr/payroll/slips` (404 — only `/payroll/<id>/payslip` exists) | CORRECT (flagged real bug = inventory M3) | `app/api/v1/hr_payroll.py:21,78,402`; `aschool_shared/lib/repositories/hr_repository.dart:8,22,36`; `flutter_teacher/lib/features/leave/leave_screen.dart:26,167`; `flutter_admin/lib/features/hr_payroll/hr_payroll_screen.dart:33` |
| `/ai/${tool}/generate` vs `/ai-tools/${tool}/generate` | open | Backend prefix is `/ai-tools` — mobile admin/teacher path 404s (= inventory M5) | CORRECT | `app/api/v1/ai_tools.py:10` |
| ~19 missing mobile features list | gap list | 34 dirs confirmed; list matches reality at dir level (hostel, conferences, sms_notifications, whatsapp_bot, elibrary, ai_tutor, white_label, biometric, multi_branch… all absent; gps Tracking lives under `transport`, AI tools under `ai_tools`) | CORRECT (with 2 covered-by-other-dirs caveats) | `ls flutter_admin/lib/features/` |
| Dart `fromJson` cast risks (`attendance.dart` id as String etc.) | risk | Inventory found ~35 unsafe parse sites + 137 silent catches — broader than prior doc claimed | CORRECT | inventory M9/M10 |
| MISSING from prior: student assignment submit 404 above is NOT in inventory's M-list | — | — | (new-inventory gap, see §8) | — |

## 5. MARKET_COMPETITOR_ANALYSIS.md

| Prior claim | Prior status | Reality | Verdict | Evidence |
|---|---|---|---|---|
| ASchool strength: "Deep eSewa/Khalti/Fonepay integration" | claim | Gateway code + per-school fee_config real, but no money ever moves via plugin subscribe (E5) and Stripe webhook secret never defined → 500 | PARTIALLY CORRECT (code exists; end-to-end money path broken) | `app/services/payments/esewa_gateway.py` etc.; inventory E5 |
| Strength: "WhatsApp Cloud API, OneSignal" | claim | WhatsApp incoming webhook is a log+ack stub; OneSignal push dead end-to-end (init never called → tokens null) | WRONG (as strengths) | `app/api/webhooks/__init__.py:269-276`; inventory M1 |
| Strength: "Jitsi Meet" | claim | Real, but hardcoded public `meet.jit.si`, no auth | CORRECT (with caveat) | `app/services/lms/video_service.py:11` |
| Strength: "MoEST IEMIS integration (critical advantage)" | claim | Excel import genuinely implemented (validate/import/history) | CORRECT | `app/api/v1/iemis_importer.py:34,125,763-963` |
| Recommendation: "expand Claude/Groq to AI grading & lesson planning" | rec | Contradicts deep-dive doc claiming ai_grading/ai_tutor "100% Working"; lesson_plan/auto_grader exist but bypass quota hub | Self-contradictory across priors (see §7) | inventory E7 |
| Competitor table (Veda/Teachmint/PowerSchool/ManageBac/Toddle features+pricing) | research | External market data, not codebase claims | UNVERIFIABLE (out of audit scope) | — |

## 6. ALL_57_PLUGINS_DEEP_DIVE_AUDIT_2026-08-27.md — highest-impact verdicts

| Prior claim | Prior status | Reality | Verdict | Evidence |
|---|---|---|---|---|
| "57 plugins: 12 Core, 12 Starter, 24 Growth, 8 Premium, 1 Add-on" | matrix | 57 slugs real, but live DB categories: core 13, starter 11, growth 21, premium 8, add_on 1, plus 6 free-tiered oddballs (library, timetable, hostel, portfolio, digital_content, ai_insights) | WRONG (category counts; total right) | inventory §2 (runtime marketplace dump) |
| "Core/Starter/IEMIS: 🟢 100% Fully Working" (plugins 1–24) | status | Overclaim. Counterexamples: basic_reports has no PDF gen; whatsapp_bot incoming is a stub; push/SMS chains dead (M1); everything is ALSO locked for new signups (E1) | WRONG (as end-to-end status) | §2 of this file; inventory E1, M1; `webhooks/__init__.py:269-276` |
| `biometric` + `multi_branch` "⚪ Delisted (`is_published: False`), unimplemented" | status | "Unimplemented" half-correct (modules contain only manifest + empty `__init__.py`), but **delisted is wrong**: no is_published flag in manifests; live marketplace lists both as published premium (1999/2999) | WRONG (published), CORRECT (unimplemented) | `app/plugins/modules/biometric/{__init__.py,manifest.yaml}`, `modules/multi_branch/`; inventory §2 premium list |
| `white_label` "🟢 100% Working" via `/website-builder/domain` + DNS CNAME | status | No white-label backend routes; the 4 frontend white-label pages 404 (see §3). Only `/website-builder` domain mgmt exists | WRONG | `app/api/v1/website_builder.py:14`; frontend evidence in §3 |
| `whatsapp_bot` "🟢 100% Fully Working" | status | Incoming webhook = stub (log+ack, "Phase 3" comment) | WRONG (inbound half) | `app/api/webhooks/__init__.py:269-276` |
| `basic_reports` "PDF/Excel via WeasyPrint, 100% Working" | status | reports.py has 0 WeasyPrint — contradicts BACKEND_QA which was right | WRONG | `app/api/v1/reports.py` |
| `attendance` "→ listeners.py dispatches parent **SMS** (Sparrow)" | status | Listener dispatches **push** via `send_push_to_school` Celery task (not SMS), and push is dead end-to-end (M1) | WRONG (mechanism + delivery) | `app/plugins/listeners.py:26-45`; `app/tasks/push_notifications.py:44`; inventory M1 |
| `disaster_management` "🟡 Working (Aliased to `emergency`)" | status | No such alias exists (`PLUGIN_SLUG_ALIASES` has no disaster_management entry); doc's own §8.6 then recommends ADDING it — self-contradiction | WRONG | `app/plugins/decorators.py:13-22`; doc §8.6 |
| `portfolio` "Re-routes cleanly to `student_portfolio`" | status | No `portfolio` alias in backend or frontend alias maps | WRONG | `decorators.py:13-22`; `frontend/lib/plugins.tsx:55-63` |
| `digital_content` alias of `elibrary` | status | True — and worse: `design_studio→digital_content` chain creates the E3 privilege leak | CORRECT | `decorators.py:19-21`; inventory E3 |
| "Needs import fix" in risk_detector / adaptive_learning / benchmarking_ai (#49/50/52) | open | Already fixed before this doc shipped (or fixed after; current source has no import errors) | STALE | §2 of this file |
| Matrix prices (admission 699, ai_tutor 499, gps 599, website_builder 499, fees 399, lms 799, ai_tools 1499…) | matrix | Match the **live DB** (seed_full.py hardcoded list), NOT the manifests (admission 599, ai_tutor 1499, gps 1999, website_builder 1499) — the 4-way price inconsistency is inventory E6 | CORRECT vs DB / STALE vs manifests | `manifests/{admission,ai_tutor,gps_tracking,website_builder,fees}.yaml:5`; `backend/seed_full.py:18-22`; inventory E6 |
| fees.py "2,100+ lines", exams.py "1,800+", iemis "988 lines, prefix /iemis" | detail | 2190 / 1871 / 987 / `/iemis` | CORRECT | `wc -l` on the three files; `iemis_importer.py:34` |
| External APIs table: 13 services all "🟢 Live Ready" | status | Configuration surfaces exist, but no round-trip evidence; Stripe webhook secret undefined (500s); OneSignal dead; WhatsApp stub; E5 money path broken | UNVERIFIABLE / WRONG (for OneSignal, WhatsApp, Stripe) | inventory E5, M1; `app/api/webhooks/__init__.py:269-276,286` |
| `lms` Jitsi integration "100% Working" | status | Code real; hardcoded public meet.jit.si no auth — works only as unpinned public rooms | CORRECT (with security caveat) | `app/services/lms/video_service.py:11` |

## 7. PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md

| Prior claim | Prior status | Reality | Verdict | Evidence |
|---|---|---|---|---|
| Marketing prices: Free / Starter NPR 2,999 / Pro NPR 7,999 | research | Landing page shows exactly those two paid prices | CORRECT | `frontend/app/page.tsx:107,126` |
| Register hardcodes 6 plugins for ALL plans; purchased plan grants nothing | critical | Exactly the 6 slugs in one try/except-pass (inventory E1, runtime-confirmed) | CORRECT | `backend/app/api/v1/auth.py:301-308` |
| Plan mapping pro→growth; School(status="trial"); `phone_verified=True`; `max_students` left at default | flow | All present; `max_students` default 100 never overridden on signup | CORRECT | `auth.py:254-266,281-288`; `app/models/school.py:47` |
| Student limit zero enforcement in students.py / iemis_importer | gap | Confirmed: `max_students` appears only in the model; no check in either file | CORRECT | grep `max_students` → only `app/models/school.py:47` |
| AISchoolQuota not provisioned on signup | gap | Confirmed — no token-hub call in register | CORRECT | `auth.py:221-319` (whole function) |
| 6 AI services bypass AITokenHub | gap | Confirmed; inventory found a 7th (timetable_solver) | CORRECT | inventory E7 |
| 57-plugin matrix prices (fees 399, admission 699, ai_tutor 499, gps 599, website_builder 499, lms 799, ai_tools 1499) | matrix | All match live DB (seed_full.py), not manifests → E6 | CORRECT vs DB | `backend/seed_full.py`; `manifests/*.yaml:5` |
| Matrix row 16: frontend gate slug = `library_management` | matrix | Frontend actually uses `<PluginGate slug="library">` (5×), normalized via alias — cell text wrong, behavior works | WRONG (cell), benign | `frontend/app/**` grep: 5× `slug="library"`, 0× `library_management`; `plugins.tsxx:60` |
| Rows 23/32/42: `library`/`digital_content`/`portfolio` "Normalized, None" aliases | matrix | library & digital_content aliased; **portfolio is not aliased** anywhere | PARTLY WRONG | `decorators.py:13-22` |
| Discrepancy 4: `/dashboard/website-builder/*` and `/dashboard/conferences` ungated | gap | Still ungated (no PluginGate in either tree); `/dashboard/bulk-uploads/iemis` claim STALE — an `iemis_importer` PluginGate now exists | CORRECT (2 of 3), STALE (iemis) | frontend grep: 0× `slug="conferences"`/website-builder gates; 1× `slug="iemis_importer"` |
| Proposed PLAN_BUNDLES["enterprise"] includes biometric + multi_branch | recommendation | Both are unimplemented modules that are nonetheless published in the live marketplace — implementing the proposal as-written would auto-install dead plugins (mandate's "Enterprise-bundle trap") | CORRECT as finding / DANGEROUS as prescription | `modules/{biometric,multi_branch}/__init__.py` (empty); inventory §2 |
| Correction the prior missed: proposed Free bundle omits `fees` though current code trials it; plan write-only problem (E2) not identified | — | New inventory's E2 goes further: plan is decorative entirely | (see inventory E2) | inventory E2 |

## 8. Things prior docs caught that the new inventory missed (verified in source)

1. **White-label 404 pages** (FRONTEND_QA): pages `frontend/app/dashboard/white-label/{domain,theme,branding}` fetch nonexistent `/schools/white-label/*`; no such backend routes. Not an inventory E/M finding — should be. Evidence in §3 row 1.
2. **Mobile `/student/assignments/$id/submit` 404** (MOBILE_QA): real route is `/assignments/<id>/submit`; inventory M-list covers hr/ai/plugins/fees splits but not this one. `assignment_repository.dart:59` vs `assignments.py:135`.
3. **`/hr/payroll/slips` 404** (MOBILE_QA adjacent): admin/teacher screens call a payslip *list* endpoint that doesn't exist (only per-id `/payroll/<id>/payslip`). `flutter_admin/lib/features/hr_payroll/hr_payroll_screen.dart:33`.
4. **Landing footer stubs + table overflow-x** (FRONTEND_QA): still unfixed (6× `href="#"` in `page.tsx`; 0× `overflow-x-auto` in sms & exams/results pages) — cosmetic, but absent from inventory.
5. **`max_students` never enforced** (PACKAGE audit): inventory E2 says plan is write-only, but doesn't state the student-limit enforcement gap explicitly. Verified: only occurrence is the model default (`school.py:47`).

## 9. Contradictions between the prior docs themselves (resolved)

1. **"100% Working" (deep-dive) vs "locked for every new signup" (package audit)** → package audit right (E1: auth.py:301-308 hardcodes 6 plugins for all plans).
2. **reports.py**: BACKEND_QA "JSON-only, needs WeasyPrint" vs deep-dive "PDF via WeasyPrint, 100% Working" → BACKEND_QA right (0 WeasyPrint hits in reports.py).
3. **biometric/multi_branch**: deep-dive "⚪ Delisted, is_published False" vs its own External-API enthusiasm and package-audit enterprise bundle → they ARE published in the live DB (inventory §2) but unimplemented in code; delisting claim false.
4. **disaster_management**: deep-dive §5.54 says "Working (aliased to emergency)" while its own §8.6 asks to add that alias → no alias exists; both can't be true, neither is.
5. **white_label**: deep-dive "100% working" vs FRONTEND_QA "404s" → FRONTEND_QA right about the pages; deep-dive right that `/website-builder/domain` exists — they are different routes and the pages point at the dead ones.
6. **Mobile app count**: all prior docs say 4 apps; repo has 5 (flutter_user omitted everywhere).
7. **AI capability**: MARKET doc recommends building AI grading/lesson planning; deep-dive marks ai_grading/ai_tutor/ai_tools 100% working → reality: services exist but bypass quota hub (E7) and locked by default (E1).
8. **Category counts**: deep-dive (12/12/24/8/1) vs package matrix vs live DB (13/11/21/8/1 + 6 free-tiered oddballs) — nobody's taxonomy matches the runtime.

## 10. ASCHOOL FULL STACK PRODUCTION.md (mandate, not prior audit)

Its 7 pre-flagged contradictions all resolve as above: (1)→E1, (2)→BACKEND_QA right, (3)→both partly (single-item canvas export client-side works; server-side bulk PDF absent), (4)→PluginGate "mismatches" mostly benign due to mirrored alias maps; manifests-vs-modules discovery was the missing context, (5)→trap confirmed, (6)→no alias exists, (7)→"Live Ready" table rejected. One mandate error: it repeats the "four Flutter apps" figure (should be 5).

---
*Generated 2026-08-28, Phase 0d. Spot-checks: ~30 claims resolved against source; evidence inline.*
