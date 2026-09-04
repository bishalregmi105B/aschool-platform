# D4 — Competitor Refresh (verification pass, 2026-09-05)

Method: live WebFetch of vendor sites + a re-read of the existing
`audits/research/COMPETITOR_LANDSCAPE_NEPAL.md` (2026-09-04). The existing report
is current and its claims re-verified; this file records today's deltas and the
scenario-review implications. It does NOT repeat the full report.

---

## A. Veda (veda-app.com) — re-verified 2026-09-05

Confirmed unchanged: no AI anywhere on the marketing site, pricing still hidden
behind demo/"Explore Plans" (plans page still gated), no Nepali UI claim, no
offline claim, no API surface. IRD/UGC/ISO badges still the trust story.
Product suite unchanged (Veda Academics/Finance/Billing/Attendance/Inventory β/
Founder's App/Veda Student/Veda Guru/Veda CMS; Zoom integration named).

**New finding — internal inconsistency (marketing credibility gap we can exploit):**
the homepage simultaneously claims "Over 1300 schools all across Nepal are
powered by Veda" (hero logo wall) and "Trusted by more than 900 schools and
colleges" (trust section), and support "15+ members, available 24 hours"
contradicts the footer's "( 8 A.M - 5 P.M ) ( SUN - FRI )". The 2026-09-04
report already flagged the support-hours gap; the 1300-vs-900 school-count gap
is newly confirmed today. Implication for ASchool GTM: never mirror their
claimed numbers; our transparent-pricing + published-API story stands on its own.

App-store ratings from the 2026-09-04 report (iOS 2.9★ parent app, Play 3.9★;
Veda Guru 4.1★ Play / 3.4★ iOS) were not re-scraped today; treat as unchanged
until the next refresh.

## B. Paathshala (paathshala.com.np) — re-verified 2026-09-05

The root page is a JS SPA (one fetch returned only the title); the /features
page fetched cleanly today and confirms the module list:

- Profile Management (general/financial/academic/library details split)
- Accounting — "trial balance to balance sheet automatically … journal vouchers"
- Billing — invoices, payments, fee structures; parents view all children's invoices
- Result Management — "both percentage & grading result system"
- Library — branded "Paathshala – LIMAS", barcode integrated
- Inventory — "by hand or with a barcode scanner"
- Attendance — "Finger-print based system" and "Card based system involves the
  swiping of cards"
- Online Payment — gateways named: "IME Pay, Khalti, Esewa" (FonePay/ConnectIPS
  still absent — eZone remains the only player naming bank rails)
- Free Mobile App + Free Website — both asterisked: "On purchase of full module
  of Paathshala" (the "free" model is bundle-conditional, worth saying out loud
  in sales conversations)
- SMS Services integrated; Vehicle Tracking (bus routing/allocation/optimization)
- "ISO Certified", "more than 11 years of experience", visitor counter 178,549

Still absent: pricing anywhere, AI, Nepali-UI-as-product claim (Nepali marketing
copy only), offline, IEMIS naming, API. The 2026-09-04 report's "1,200+ schools"
and RFID-card-monetization findings stand (from the JS bundle; not re-extracted
today).

## C. Deltas vs the gap matrix (what changed on OUR side since 2026-09-04)

Re-verified against the working tree today:

1. Benchmarking `/rankings` — rewritten: set-based aggregate SQL, 10-min cache,
   no school names in output (privacy), gated `ai_suite`
   (backend/app/api/v1/benchmarking.py). Cross-tenant data-mining smell closed.
2. Absent-alert listener — `attendance.student_absent` now consumed
   (backend/app/plugins/listeners.py:69) → push + SMS + in-app to guardians.
   (Veda's "Smart SMS"/care features: we now have the honest equivalent.)
3. Leave→attendance write-through + persisted rejection reason
   (backend/app/api/v1/attendance.py, migration d5c8f2a7b4e1).
4. Social plugins deleted; AI catalog consolidated under `ai_suite` aliasing;
   plugin-contract validator landed (backend/app/plugins/validator.py — 0 errors
   over 48 manifests).
5. Curriculum/NEB read API landed (backend/app/api/v1/academics.py:983+) —
   prerequisite for AI-teacher grounding.

Still-missing vs competitors (unchanged from report §3, re-confirmed): IRD-verified
billing polish, transcripts, per-school grading scales, payroll TDS/SSF,
non-Khalti refunds, marksheet print designer (Veda's moat), ZKTeco/RFID story,
feature-barring on arrears, canteen/hostel POS, Excel-import everywhere,
admissions CRM kanban, white-label app pipeline, FonePay/ConnectIPS.

## D. Net position statement

Veda: scale leader, zero AI, hidden pricing, inconsistent claims, weak iOS app.
Paathshala: hardware-subsidized card model, strong EMIS/badge marketing, thin
pedagogy, no AI, bundle-conditional "free". eZone: only published pricing
(Rs.0/10/20/40 per student/mo). International AI-for-teachers (MagicSchool,
Khanmigo, Diffit, Gamma, Curipod, Eduaide, Twee, Quizizz AI) remain the feature
north star for the ai_suite tool catalog — the D1 digest's 153-tool catalog and
document/deck emitter contract cover this; no new international fetch was spent
on the failed agent's plan beyond what D1/TC §2 already documents.

ASchool wins by shipping the AI layer for real (D1 + D3 specs), Nepali-first +
BS calendar, transparent pricing, one-click IEMIS, and the migration kit —
exactly as roadmap v2 §1 concluded. The competitor refresh does not change the
roadmap; it confirms it.
