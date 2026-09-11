# Cross-Audit Synthesis — 7 Competitor Codebases → ASchool Plan (2026-09-11)

> Every finding below is drawn from the seven deep audit reports in `docs/competitor-audits/`
> (each written by its own agent with file-path evidence). This document deduplicates their
> "what ASchool lacks" lists, prioritizes what to adopt, and maps everything onto the existing
> execution waves (S13+ of `docs/FINAL_AI_PLATFORM_PLAN_2026-09-11.md` and the FA items of
> `MASTER_PLAN_2026-09-10_FULL_PLATFORM_V2.md`). Items already planned carry their existing ID.

## 0. The audit set

| Report | Product | Scale | One-line verdict |
|---|---|---|---|
| `infixedu-v9.4.0.md` | InfixEdu (Laravel, 2,733 routes, 981 views) | decade of accretion | fees lifecycle + custom result engine + print discipline; zero Nepal |
| `eschool-v3.3.6.md` | eSchool (Laravel + 2 Flutter apps) | 314+141 routes | online-exam runner + mobile nav + server-driven ops; live classes are fake |
| `mighty-school-pro-v1.6.md` | Mighty School Pro (Laravel API + GetX app) | 19 modules, 534 routes | genuine double-entry accounting + deep fees; "multibranch SaaS" is thin |
| `eduex-lms-v2.0.md` | EduEx LMS (Laravel + Flutter) | LMS-first | monetization machine; sequential locking + certificates + discussions steal |
| `instikit-school-v5.5.0.md` | InstiKit (Laravel+Vue SPA, not WP) | 1,410 routes, 699 controllers | website+portal fusion + guest admission funnel + counter-grade finance |
| `schoolbustrack-v2.3.md` | SchoolBusTrack (Laravel + 2 Flutter apps) | transport-only | trip/ride-status model + driver app + per-student notification toggles |
| `infixedu-addon-modules.md` | 4 InfixEdu add-ons | small | addon-engineering lessons + live-class conflict detection + self-registration |

**Consistent "we win" theme across all seven** (don't over-copy): real plugin architecture, multi-tenant SaaS, 5 Flutter apps, AI suite (all their AI is veneer or absent), Nepal stack (BS dates, iEMIS, SEE/NEB, eSewa/Khalti/FonePay, Sparrow), telemetry history (GPSLog), and honest engineering (every product had shipping defects — `migrate:fresh` cron in prod, IDORs, demo credentials, path traversal). We adopt **features and patterns**, not architecture.

## 1. Consolidated adoption list (deduplicated, prioritized)

### P0 — direct money/user-value, adopt into S13–S15

| # | Adoption | Source | Maps to |
|---|---|---|---|
| A-01 | **Fees: installments + carry-forward + AR aging + fines/waivers reports** (InfixEdu fees-forward, Mighty's 3 fine types + waivers) | infixedu §5, mighty §9 | FA-04 BE-1/BE-2 (already planned) — extend with carry-forward + fine waiver reports |
| A-02 | **Per-event notification matrix** (event × channel × role toggles, admin UI) replacing scattered per-feature toggles | infixedu §11 | FA-18 BE-2 (template engine) — add matrix as its admin surface |
| A-03 | **Custom result-card engine** (school-defined report-card layouts w/o code — maps to our design_studio data-fill) | infixedu §6 | FA-05 + design_studio: expose exam_result data source fields + layout presets |
| A-04 | **Print-twin discipline**: every list/report route gets a print/PDF twin | infixedu §6 | reports plugin + each FA; rides T-05 (WeasyPrint in prod) |
| A-05 | **Online-exam runner polish**: question palette, wakelock, auto-submit, retake cooldown, per-exam T&C gate, LaTeX questions (flutter_tex) | eschool §5 | FA-06 WE/MB — student app online-exam hardening |
| A-06 | **Mobile nav pattern: 4-tab + "More" bottom-sheet grid (data-driven)** — fixes our student drawer bug properly | eschool §6 | M-C1 (rewrite), adopt shared DynamicBottomNav upgrade |
| A-07 | **Server-driven ops flags**: force-update (endpoint exists, unused), maintenance mode, gateway toggles, theme switch read at app launch | eschool §6 | M-F4 + settings; wire force_update_dialog at last |
| A-08 | **Native fee-pay UX**: payment-state machine, receipt PDF in-app, "ask parents to pay" nudge | eschool §8 | FA-04 MB-1/M-D1 |
| A-09 | **Admission funnel depth**: seat-wise enrollment caps, registration fee at application, printable application form, **public self-registration → staging → admin approval → auto provisioning** (ParentReg pattern) | instikit §4, modules §6 | FA-01 BE/WE + W-01; replaces orphan AdmissionForm decision |
| A-10 | **Trip model for transport**: definition (route/stop) → schedule (recurring trips) → daily trip instances → **ride_status (boarded/alighted/missed)** + driver trip flow + QR board/alight geofence-validated | schoolbustrack §2/§4 | FA-10 — new `trips` + `trip_instances` + ride status; driver-side in admin/teacher app |
| A-11 | **Per-student transport notification toggles + approach-radius alerts + stop timelines in parent app** | schoolbustrack §5 | FA-10 MB-1; wire the never-emitted `transport.bus_*` events (E-02) |

### P1 — strong differentiators, S16–S18

| # | Adoption | Source | Maps to |
|---|---|---|---|
| A-12 | **LMS sequential locking + resume** (`is_accessible` per item, `current_item`, server-enforced) — cheapest big LMS UX win | eduex §3 | FA-08 WE-2 |
| A-13 | **Course certificates with public verification page** (deterministic code + `/verify-certificate`) — pairs with design_studio + QR verification fabric | eduex §2, instikit §4 (TC verification) | FA-08 + FA-27; public route on school site |
| A-14 | **Course discussions**: threads, likes, instructor pin/announcement, accepted answers | eduex §9 | FA-08 — new discussion model; student+teacher apps |
| A-15 | **Website+portal fusion**: named content blocks with markers (instikit SiteService), unknown slugs → portal, exportable site presets as marketplace items | instikit §2/§12 | P-C website simplification — presets become sellable templates |
| A-16 | **Live-class hardening**: Jitsi JWT tokens (moderation + identity), meeting-conflict detection per teacher, early-join window, recording link round-trip (Zoom-style manual attach v1) | modules §6/§3 | FA-08 + I.6; video_service upgrade |
| A-17 | **Marketplace addon engineering**: manifest gains `migrations:` map + `data_retention:`, signed zip sideload later, "Configure" CTA with connection test per gateway/integration | modules §7 | N-12 validator + plugins page |
| A-18 | **Question-bank taxonomy**: add board/ chapter/ topic/ difficulty/ source/ year dimensions to QuestionBankItem (we have unit/outcome FKs post-S13; add the free-text dimensions + filters) | mighty §12 | FA-06 WE-1 |
| A-19 | **Permission-keyed sidebar 1:1** (`domain.action` permission names = menu keys) — closes our RBAC page (O-04) with real granularity | mighty §7 | O-04 |
| A-20 | **Wizard pattern per domain** ("startup → map → configure → execute → report" — bulk flows, imports, year-close) | mighty §15 | rides S1 file flows + FA-23 iEMIS |
| A-21 | **SMS balance purchase + merge templates** in the comms hub (prepaid credits ledger per school) | mighty §15 | FA-18 WE |
| A-22 | **Guest payments without login** (admission fee, event tickets) via tokenized links on the public site | instikit §4 | FA-01 + public site |

### P2 — adopt selectively (S19+ / backlog)

| # | Adoption | Source | Note |
|---|---|---|---|
| A-23 | **Double-entry accounting module** (chart of accounts, journals, 11 statements, payroll→GL posting) | mighty §8 | The deepest gap any auditor found; build `accounting` plugin for the finance-serious segment — recommend before FY-end for Nepal schools |
| A-24 | **Day-closure/day-book/voucher flows** (counter operations) | instikit §5 | Pairs with A-23 |
| A-25 | **Generic multi-level approval engine** + edit-request-with-approval pattern | instikit §5 | Reusable across fees waivers, leave, TC issuance |
| A-26 | **Helpdesk tickets + gate pass + correspondence log + mess module + asset registry** | instikit §5 | Marketplace candidates; keep as separate plugins |
| A-27 | **Recruitment/job board + public job applications** | instikit §4 | Low priority for K-12 Nepal |
| A-28 | **Enrollment forecasting + 3-step import UX** (template → preview temp table → commit) | infixedu §15 | Improves iEMIS/bulk-uploads UX (S1/S11) |
| A-29 | **Chat product upgrade**: retention policy + admin monitoring (we have 1:1 chat; add policy) | eschool §6 | FA-18 |
| A-30 | **Onboarding coach marks + Crashlytics/Sentry in Flutter apps** | eschool §5 | S9/S10 mobile waves |

## 2. Where each audit changes our existing plan

- **FA-04 (Fees)** grows: carry-forward (A-01) — new BE item, expands S5.
- **FA-10 (Transport)** is re-scoped by SchoolBusTrack: the 4-layer trip model (A-10, A-11) replaces the thin "geofence push" item; `gps_tracking` + `dismissal` stay separate plugins bridged by events; orphaned allocation/pickup-points pages fold into gps_tracking (N-01).
- **FA-08 (LMS)** gets its biggest upgrade from EduEx: locking/resume (A-12), certificates (A-13), discussions (A-14) — lms plugin split into courses/progress/assessments/discussions/certificates sub-surfaces.
- **FA-01 (Admissions)** adopts the full funnel (A-09, A-22): public self-registration → staging → approval → auto-provision (also retires the orphaned AdmissionForm model question from T-02).
- **FA-06 (Question bank)** gains taxonomy dimensions (A-18) on top of the S13/S14 spine work.
- **O-04 (RBAC)** adopts permission-keyed menu (A-19).
- **P-C (Website)** adopts named-blocks + exportable presets (A-15) — strengthens the "few pages, synced" model rather than fighting it.
- **Marketplace** (A-17) adopts the addon-engineering lessons: manifest `migrations:` map now (S13), connection-test CTA.
- **New plugin candidate: `accounting`** (A-23/A-24) — double-entry GL with payroll posting; recommend after S15, before Nepali FY-end (Shrawan 1).
- **Mobile waves (S9/S10)** adopt: More-menu bottom sheet (A-06), ops flags (A-07), native pay UX (A-08), coach marks + crash reporting (A-30).

## 3. Explicit rejections (audited and declined)

- InfixEdu/InstiKit monolith organization (blade/jQuery), addon zip-upload without signatures (RCE-by-design), coins-wallet transport economy (we gate on fees plugin), Mighty's branch model (branch_id column flip — our chain architecture is sound), EduEx device-local wishlist and client-trusted quiz timers, any reimplementcation of their per-install licensing.
- "More modules on the sidebar": all seven prove menu sprawl; our 12-section manifest sidebar + N-06 command palette stays.

## 4. Sequencing (merged with FINAL_AI_PLATFORM_PLAN waves)

| Wave | Additions from this synthesis |
|---|---|
| S13–S14 (AI grounding + question engine) | A-18 (question-bank taxonomy rides the S13 spine ALTER) |
| S15 (designer D1/D2) | A-03 custom result-card engine, A-04 print-twin sweep |
| S5-split (Fees depth, insert before S16) | A-01 installments/carry-forward/aging/fine-waivers, A-02 notification matrix, A-08 native pay UX |
| S16–S18 (mobile waves) | A-05 exam runner, A-06 More-menu, A-07 ops flags, A-12/13/14 LMS trio, A-16 live-class hardening, A-30 coach marks + crash reporting |
| S11-scope (transport re-scope) | A-10/A-11 trip model + ride_status + driver flow + notification toggles |
| S17–S18 (web) | A-09/A-22 admission funnel + guest payments, A-15 site presets, A-19 permission-keyed sidebar, A-20 wizards, A-21 SMS credits, A-17 addon manifest map |
| S19+ / new plugin | A-23/A-24 `accounting` plugin, A-25 approval engine, A-26 helpdesk/gate-pass/mess/assets, A-28 import UX, A-29 chat retention |

**Founder decisions this raises:** (1) approve the transport re-scope (trip model is a schema addition, not a patch); (2) approve `accounting` as a new plugin candidate with a target before Nepali FY start; (3) LMS trio (A-12/13/14) ahead of or alongside mobile wave 2; (4) zip-sideload for marketplace: keep manifest-only until there are third-party add-on authors (recommended).
