# UX_TASK_BENCHMARKS — Six Canonical Tasks × 9 Products

**Date:** 2026-09-13. **Built by:** the orchestrator (Step 2.5c) from Section 8 of the nine product reports under `audits/deep-ux-2026-09/` (8 competitors + ASchool). Cell format: **screens / clicks / required form fields**, exactly as measured/counted in the source report (live-measured where the product was bootable; code-counted otherwise). "N/A" = the feature is absent (evidence in the source report). Best-in-class call under each row.

| Task | EduEx LMS 2.0 | eSchool 3.3.6 | eSchool SaaS 1.8.0 | InfixEdu 9.4.0 | InstiKit 5.5.0 | Mighty School Pro 1.6 | SchoolBusTrack 2.3 | InfixEdu addons | **ASchool** |
|---|---|---|---|---|---|---|---|---|---|
| 1. Mark daily attendance (one class) | N/A — no attendance model | **1 / 3 / 2** | 2 / 4 / 2 (teacher app) | 1 / 3 / 3 | 1 / 4 / 4 | 1 / ~7 / 5 (Late un-enterable; SMS dead) | N/A | N/A | **BLOCKED live** (demo DB has 0 classes → empty-picker dead end); flow code-verified: explicit-unmarked attendance + P/A/L/E keyboard marks + All-Absent confirm dialog |
| 2. Collect + receipt a fee payment | N/A (closest: offline-payment approve 3/3/0) | **1 + 1 modal / ~4 / 4** | 3 / 6 / 4 (web counter) | 2 / 5 / 3 | 2 / 5 / 5 | 2 / 9–13 / 7–9 (DB transaction commented out; no in-app PDF) | N/A | N/A | **BLOCKED live** (0 students in demo DB); POS workspace fully reachable (search → ledger → collect, 6 KPIs, keyboard-operable cards) |
| 3. Publish a notice to one class + parents | N/A (course announcement 2/2/4, enrolled students only) | 1 + 1 modal / ~4 / 3 (students only; parents read same board) | 1 / 4 / 2 | N/A — class targeting absent (role[] only) | **1 / 3 / 4** (the only true class+parents targeting) | 1 / 4–6 / 3–4 (no class targeting, no fanout) | N/A | N/A | **DONE live: 1 screen / 2 clicks / 2 fields, 1,958 ms end-to-end** — but class/section targeting impossible (audience hardcoded to 4 roles, `notices/page.tsx:309`) |
| 4. Generate/print one report card | N/A (certificate download 2/1/0) | **2 / 3 / 0** | 2 / 5 / 0 (PDF) | 2 / 5 / 4 (deepest engine: distributions, dual grades, merit) | 2–3 / 4 / 3 (12 marksheet templates) | 1 + print / 5–6 / 3–4 (grey placeholder boxes in PDF) | N/A | N/A | **BLOCKED live** (no exam data); NEB-grading report-card page reachable, AI-remarks generator present |
| 5. Enroll one new student end-to-end | 4 / 2 / 6 (course enrollment analog) | **1 / 1 / ~15** | 2 / 3 / 14 | 2 / 6 / ~30 (61-input census, dynamic required set) | 2 / 4 / 6 + ~14 in approve modal (online guest funnel: 5 / ≈20) | 1 / 11+ / 17 (default password 12345678 printed in the form) | N/A | N/A | **BLOCKED live** at empty class picker (submit correctly disabled; no "create a class first" guidance); form itself strong: bilingual, BS date picker, auto enrollment no. |
| 6. Create and assign one exam | N/A (create+publish course 2 / ~6 / 5+) | **2 / ~6 / ~8** (online exam runner is its best UX) | 3 / 6 / 2+ | 2 / 6 / ~10 | 3 / 5 / 3 + 5 (schedule) | 2 / 8–10 / 2–4 (100-mark cap; dead serial field) | N/A | N/A | **DONE live: 1 dialog / 2 clicks / 1 field minimum**, ~1.5 s to toast (name-only creation succeeded, DB 0→1); NEB scale reference card on the page |

*N/A rows: EduEx is an LMS (no school-ERP attendance/fees/notices); SchoolBusTrack is transport-only; InfixEdu addons are four add-ons (benchmarked separately below).*

**Best-in-class per task (one line each):**
1. **Attendance — eSchool v3.3.6** (1/3/2; ASchool's interaction design is likely better — explicit-unmarked + keyboard marks — but couldn't be end-to-end measured in the empty demo DB).
2. **Fee receipt — eSchool v3.3.6** (1+modal/4/4 with full pending→webhook→receipt state machine; InfixEdu has the deeper engine at 2/5/3).
3. **Notice to class+parents — InstiKit** (the only product that actually does the task's semantics — true class+parent targeting at 1/3/4; every other product either role-broadcasts or omits targeting, including ASchool).
4. **Report card — eSchool v3.3.6 on efficiency (2/3/0); InfixEdu on capability depth** (configurable distributions, weighted multi-term finals, merit lists).
5. **Enroll student — eSchool on screens (1/1); InstiKit overall** (6 required fields + a real online guest-registration funnel; InfixEdu's ~30-field dynamic form is the heaviest).
6. **Create+assign exam — ASchool on raw efficiency** (1 dialog, 1 required field, 1.5 s live) **with eSchool the best full-exam flow** (2/~6/~8 with the strongest online-exam runner in the corpus).

---

## Supplementary task sets (products whose canonical six are mostly N/A)

**EduEx LMS (LMS tasks):** create + publish one course — 2 screens / ~6 clicks / 5+ fields; complete one lesson as a student — 3 screens / 2 clicks / 0 fields (returning students: 1 click via auto-resume).

**eSchool SaaS (SaaS task):** provision one new tenant school — 2 screens / 3 clicks / 7 required fields (async provisioning with retries; credentials emailed when ready).

**SchoolBusTrack (transport tasks):** create a route with stops + assign vehicle/driver — (per report §8); start a trip as a driver; follow a child's bus as a guardian; review yesterday's trip history — see `schoolbustrack-v2.3.md` §8 for the measured numbers.

**InfixEdu addons (add-on tasks):** schedule one Zoom live class; schedule one Jitsi live class; complete a parent self-registration for one child; pay one fee invoice via Razorpay — see `infixedu-addon-modules.md` §8.

---

## Cross-cutting reads for the synthesis

1. **ASchool's benchmark blocker is its own demo environment**: 4 of 6 canonical tasks could not be completed live because the demo DB has zero classes/students — this is the "empty-setup dead ends" finding (`aschool-frontend.md` top-10 weakness #4), not a capability gap. A seeded demo tenant would flip ASchool from "BLOCKED" to measured on all six, and its two measurable tasks (notice 2 clicks/2 fields/1.9 s; exam 1 dialog/1 field/1.5 s) are already best-in-class on efficiency.
2. **Notice class-targeting is a corpus-wide failure** — only InstiKit does it; ASchool hardcodes 4 roles (`notices/page.tsx:309`), eSchool targets students only, InfixEdu and Mighty have no targeting at all. This is a cheap, differentiating fix for ASchool.
3. **Efficiency leaders cluster in the simpler products** (eSchool single-tenant), while **capability leaders cluster in InfixEdu/InstiKit** — ASchool's play is both: keep the 1-dialog efficiency AND the S-A1/S-A2 depth.
4. **Money-path integrity beats click counts**: Mighty's fee flow (2/9–13/7–9) has its DB transaction commented out; InfixEdu's addons Razorpay has a 100× ledger bug; ASchool's fee engine has idempotency + till-lock. The benchmark table is efficiency only — integrity findings live in the product reports.
