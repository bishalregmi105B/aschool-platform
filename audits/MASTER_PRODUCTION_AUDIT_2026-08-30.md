# MASTER PRODUCTION AUDIT — 2026-08-30 (Phase-9 final)

Sources (only these; nothing re-derived): `audits/DISCOVERED_SYSTEM_INVENTORY.md`,
`audits/FIX_STATUS_2026-08-28.md` (§1–§16), `audits/PRIOR_AUDIT_DIFF_2026-08-28.md`,
`audits/VERIFICATION_MONEY_GRADES_2026-08-28.md`, `audits/coverage/FRONTEND_PAGE_VERIFICATION.md`,
`audits/coverage/BACKEND_FILE_VERIFICATION.md`, `audits/coverage/LIVE_BROWSER_UX_TEST.md`,
`audits/coverage/DATA_HYGIENE_2026-08-30.md`, `audits/discovery/FRONTEND_INVENTORY.md`,
`frontend/themes/THEMES_CREDITS.md`. Companion docs: `PRODUCTION_SCORECARD_2026-08-30.md`,
`CHANGELOG_2026-08-30.md`, `REMAINING_BACKLOG_2026-08-30.md`.

## 1. Executive summary

- **What the platform is.** ASchool is a multi-tenant school-management SaaS: Flask 3 + SQLAlchemy 2 (Postgres 16) + Celery + Socket.IO backend (`backend/app/__init__.py`), 550 route decorators / 59 files under `/api/v1` + 6 webhook routes; 143 model classes with `SchoolModel.for_school()` tenancy; a Next.js 14 App Router dashboard + public school sites (215 `page.tsx`); 5 Flutter apps (admin/teacher/parent/student/user) + `aschool_shared`; a WP-style plugin system (live catalog = **55 published plugins** after `digital_content` and `portfolio` were unpublished as duplicates; `plugins_nav` is published:false). Tenancy: subdomain → `X-School-Slug` → JWT `school_id` → `g.school_id`/`g.installed_plugins`.
- **What was found.** An independent Phase-0 audit (E1–E9, G1–G2, M1–M12) then slice-wise deep dives raised **~173 numbered findings** (E1–E219 with gaps + G1–G2 + M1–M12). Worst-of-class: every new signup got the same 6 hardcoded plugins regardless of plan (E1); trials never expired and plugin "subscribe" collected no money (E4/E5); all four payment-gateway callbacks were structurally broken — money could be paid and never recorded (E60–E63); a superadmin privilege-escalation via mass role assignment (E160); CORS blocked the Flutter apps entirely (E200); mobile push dead end-to-end (M1).
- **What was fixed.** **167 findings are resolved** (fixed-uncommitted on the working tree, or fixed-committed e.g. E8/M6/M12, or verified-needing-no-change e.g. E169/E174/E179), each with runtime evidence: live-HTTP probes (54/54, 60/60, 98/98, 108/108, 111/111, 145/145, 152/152 check runs), pinned regression suites (`tests/test_payment_webhooks.py` 16/16, `test_comms_plugins.py` 21–24, `test_campus_ops_plugins.py` 13/13, `test_biometric.py` 11/11, `test_multi_branch.py` 10/10, `test_disaster_management_api.py` 6/6, `test_incident_management_api.py` 8/8, `test_adaptive_learning_api.py` 7, `test_social_ads.py` 7, `test_password_reset.py` 15, `test_slice3_ops_fixes.py` 16, `test_comms_social_slice4.py` 19, etc.), and a full live-browser walkthrough of the Next.js app + Flutter-admin/teacher web builds.
- **Current state.** Dev-stack production-ready-in-function: 54 of the 55 published plugins verified working end-to-end (backend gate + frontend page + data persisted; `ai_grading` ⚠️ pending an entitlement decision, E22a). Demo database hygiene-restored (2 tenants, 3 students, ~1,350 junk rows removed). Not yet done: production deployment hardening (TLS, prod secrets, gunicorn/Socket.IO config), a file-by-file backend review of slices 1/2/4–7, mobile push (M1), student/parent mobile login provisioning, the login-lockout 500, and the contact-submission inbox — see §6 and `REMAINING_BACKLOG_2026-08-30.md`.

## 2. Architecture & entitlement model (as shipped)

- **Chain:** `Plugin` catalog (from `modules/{slug}/manifest.yaml` + legacy `manifests/*.yaml`, loader `backend/app/plugins/loader.py:34-128`) → `SchoolPlugin` per-school install row → `g.installed_plugins` (request-scoped, cache 300 s, `app/__init__.py:293-331`) → `@plugin_required(slug)` (`app/plugins/decorators.py:28-46`, single-hop alias expansion) → 403 with install URL.
- **Plans drive entitlements** (E1/E2 fix): `backend/app/plugins/entitlements.py` `PLAN_PLUGIN_TIERS` (free→core+add_on; starter→+starter; growth→+growth; enterprise→+premium) is the single source of truth; registration calls `grant_plan_plugins()`; runtime-verified fresh registrations get 13/22/43/57 cumulative installs by plan.
- **Install policy** (E160-plugin-arch): `PLUGIN_TRIAL_DAYS` (default 14) + `PLUGIN_FREE_TIERS`; free install → active paid-never row; paid install → trial; trial-clock exploits closed (reinstall preserves the original window; expired-trial reinstall refused; subscribe converts in place, 402 without payment proof E5).
- **Lifecycle:** install / activate / deactivate / uninstall / config GET-PUT (`?replace=1`, 16 KB cap, reserved `last_payment` key) / subscribe-with-proof; marketplace response carries `install_state/is_trial/trial_days_left/can_subscribe`.
- **Caps & quota:** `School.max_students` enforced at all 3 creation sites (`students.py:145`, `iemis_importer.py:421`, `plugins/listeners.py` E11); `AITokenHub` per-school daily/monthly quota provisioned eagerly at signup (E12), missing row = blocked-by-default; quota exhaustion → global 429 (E18), provider failure → global 502 (E113).
- **Payments:** per-school `fee_config` merchant credentials; eSewa/Khalti/FonePay callbacks at `/webhooks/{gw}/callback` (no `/api/v1` prefix — E60); `PaymentInitiation` anchors every charge (E61, migration `b7e2c9d4a5f3`); idempotent finalize via `FeeReceipt.idempotency_key` (E62); Stripe verified against the installed SDK (E65, `stripe>=5.0,<6.0` in requirements).
- **Deprecated slugs kept as aliases:** `digital_content`→`elibrary`, `portfolio`→`student_portfolio` (E14, manifests `published:false/deprecated:true`, seed-synced to `Plugin.is_published`); `incidents` vs `incident_management` confirmed a legit base+extension pair, both published.
- **Themes:** 10 token-level ports of real GPL WordPress education themes (E170–E174; credits in `frontend/themes/THEMES_CREDITS.md`), `DEFAULT_THEME_ID="global-elearning"`, idempotent DB migration `backend/scripts/migrate_theme_slugs.py`.

## 3. Finding ledger digest (grouped by severity; status per `FIX_STATUS_2026-08-28.md`)

### P0 — all resolved
| ID | One-line | Status |
|---|---|---|
| E1 | Registration hardcoded 6 plugins for every plan, failures swallowed | FIXED (`entitlements.py` + runtime tier-grant proof) |
| E2 | `School.plan` write-only decoration | FIXED (plan→entitlements; `max_students` enforced at 3 sites) |
| E3 | Alias leak elibrary→design_studio (paid-for-unlock) | FIXED (single-hop aliases; 403 pinned by test) |
| E4 | Trials never expire | FIXED (`tasks/trial_expiry.py` + hourly beat + request-path gate) |
| E5 | `/subscribe` collects no money; Stripe secret undefined | FIXED (402 without proof; config key; honest 400s) |
| E60 | Initiate routes handed gateways DEAD `/api/v1/webhooks/*` URLs — paid money 404ed | FIXED (`/webhooks/...`; pinned) |
| E61 | No server-side initiation record; FonePay success could never resolve | FIXED (`PaymentInitiation` + migration; PRN anchor) |
| E62 | Duplicate callbacks double-counted money / duplicate receipts | FIXED (idempotency-key gate; probe + 16/16 tests) |
| E63 | Khalti pidx-swap attack credited any collection | FIXED (gateway-echo cross-check → 400) |
| E65 | Stripe webhook NameError on every valid event; `stripe` pkg missing | FIXED (import + dependency; signature-verified) |
| E100 | Editing a student 500ed whenever phone blank (normal case) | FIXED (stores `""`) |
| E113 | Invalid LLM creds = opaque 500 on every AI endpoint | FIXED (`AIProviderError` → global 502) |
| E116 | AI Report Remarks page 100% broken (garbage ints + wrong contract) | FIXED (rewritten per-student loop) |
| E117 | AI Timetable page 100% broken (`academic_year` string + wrong shape) | FIXED (rewritten; real solver shape) |
| E122 | Broadcast push/email/WhatsApp were fake-success no-ops | FIXED (real InAppNotification write / honest failures) |
| E200 | CORS blocked Flutter apps (no preflight headers on 8090/8091) | FIXED (204 + echoed headers, env-honored) |

### P1 — product-integrity findings (all resolved unless noted)
- **Entitlement/tenancy:** E1b (free-tier trial leak), E6 (4-way pricing inconsistency; seed self-heals), E8 (Hostel/FAQ tenancy, FIXED-COMMITTED `0339893`), E10–E14 (placeholder phones, admission cap, AI-quota provisioning, staff-import crash, duplicate-plugin dedup). *Resolved.*
- **Ops/academics:** E15–E17, E24-exams, E25–E28 (fee-types schema drift, QR contract, input guards, marks class_id, timetable conflicts, assignments is_late, uniform late rule, rollback proofs). *Resolved.*
- **Comms:** E30–E34, E190–E199 (social_ads implemented, SMS outcomes real, WhatsApp JSONB append, guards, `g.current_user` for header auth, chat role matrix, notifications, BS-range, booking spoofing, moderation, groups, webhook fail-closed). *Resolved.*
- **Campus ops:** E40–E44, E50, E51 (disaster_management + incident_management implemented; incidents cross-tenant leak; counselor-note contract; error states). *Resolved.*
- **Payments P1:** E64 (amount mismatches), E66 (lookup-out 500; webhook CSRF exemption). *Resolved.*
- **Docs:** G1, G2 (report-card PDF + EMIS CSV discarded → persisted, served; runtime %PDF proof). *Resolved.*
- **Frontend deep dives:** E70–E75, E90–E98, E100–E102, E110–E119, E120–E127, E130–E134, E140–E143, E150–E159 (two-component PluginGate dedup, fake CSV importer, sms history crash, OTP phone variants, report-card math, grades page, remarks/timetable rewrites, discount-blind reports, payroll component editor, leave-apply UI, gallery gate, announcements enum 500, health search, badge dedup, campaign lifecycle, transport gate, biometric one-time key, white-label JSONB `flag_modified`, GPS ISO-Z, public-site endpoints, certificate registry/NameError, ISR revalidation, dead contact form, favicon). *Resolved.*
- **Backend deep dives:** E160–E168 (priv-esc, dead superadmin claim, numeric-param 500s, password reset E164/E96, parent-app 404 screens E165, SSRF, upload type allowlist, search clamp), E169 verified-no-change; E175–E178 (files 308 ping-pong, client URL builders, coming-soon honesty, favicon), E179 verified; E180–E189 (fee reminders raw-base, fees/hR/admission/inventory/visitor/transport update-side guards + cross-tenant fixes + audit trail), E184 (monthly billing crashed every run). *Resolved.*
- **Implementations:** E23 (ai_adaptive_learning), E30 (social_ads), E40 (disaster_management), E41 (incident_management), multi_branch + biometric plugins implemented from empty modules. *Resolved.*
- **Plugin architecture:** E160–E166 band (§14) — install policy, activate/deactivate, config persistence bug, honest marketplace copy, plugins manager, per-plugin settings. *Resolved.*
- **Live-stack/UX batches:** E170–E173 (themes), E175–E178, E200–E207, E210–E219 (WhatsApp pages E210–E213, LMS create E214, middleware refresh E215, data backfills E216–E219). *Resolved.*
- **Mobile:** M3 (HR split-brain), M4 (marketplace 404s), M5 (AI paths), M6 (parent fees, FIXED-COMMITTED `3920609`), M7 (plugin config), M8 (dead offline_sync deleted), M9 (unsafe casts 250→4 provably-safe), M10 (134 silent catches → 0), M12 (pubspec). *Resolved.*
- **OPEN (P1):** **E22** (ai_grading gated by `assignments`; insights dual-gated `ai_tools`+`ai_insights`; stale manifest metadata — needs a product/entitlement decision), **M1** (push notifications dead end-to-end; `NotificationService.init()` never called; FCM/OneSignal tokens null), **M2** (notification center built but unrouted on mobile). *Open.*

### P2 — resolved: E9 (honest phone_verified=False, direct login), E19 (risk-alerts AttributeError), E20 (oldest-7-days chart), E66, E74, E75, E91–E93, E111, E115, E125, E126, E130–E134, E141–E143, E155–E158, E162/E163/E166–E168, E176/E177/E178, E197, E203–E207, E216–E219.
### OPEN (P2): **E95** (landing "Book a Free Demo" form is a no-op — needs a demo-request endpoint decision), **E97** (settings/roles page entirely fake — real RBAC editor needs backend work; marketplace NPR relabel done).

### Un-numbered findings logged during Phase-9 (open)
- Login lockout 500: `auth_service.py:166` compares naive `locked_until` with aware `now()` — 5 wrong passwords → 500-loop instead of a lockout message (LIVE_BROWSER_UX_TEST, FIX_STATUS §16 note).
- Teacher delete leaves an orphan active User row (deleted "Ram Bahadur Test" kept phone 9811111111 alive).
- Website contact/admission submissions land in `audit_logs` with no admin inbox.
- Student/parent app login provisioning gap (see §6).

## 4. Prior-AI-audit contradictions resolved (per `PRIOR_AUDIT_DIFF_2026-08-28.md`)

1. "100% Working" deep-dive vs "locked for every new signup" → package audit right (E1); the 57-plugin "100% Working" matrix was largely overclaim (whatsapp_bot inbound stub, push dead, basic_reports had no PDF).
2. reports.py "JSON-only" (BACKEND_QA) vs "WeasyPrint 100%" (deep-dive) → BACKEND_QA right at audit time; since fixed with 3 real `/pdf` exports (`VERIFICATION_MONEY_GRADES_2026-08-28.md` §1–2).
3. biometric/multi_branch "delisted, is_published False" → wrong; they were **published** premium plugins and empty; now implemented + runtime-verified.
4. disaster_management "aliased to emergency" → no such alias ever existed; plugin since implemented for real (E40).
5. white_label "100% working" vs FRONTEND_QA "404s" → pages pointed at dead `/schools/white-label/*`; the real surface is `/website-builder/*` + `white_label.py` (now built out and verified, E142/slice-6).
6. Mobile app count: all prior docs said 4; reality is 5 (flutter_user omitted everywhere).
7. Category counts (12/12/24/8/1) matched neither the DB nor manifests; E6 reconciled seeds/manifests/DB.
8. PluginGate "lockout" claims (hr/communications/iemis) → benign: mirrored alias maps + module discovery; E71 verified **zero lockout slugs** against the live catalog.
9. "max_students never enforced" (PACKAGE audit) → confirmed (E2) and fixed.
10. Mandate "four Flutter apps" → five.

## 5. Verified vs claimed — the honest narrative

- **Runtime proofs, not source reading.** Every FIXED row in §3 carries runtime evidence: live-HTTP probes against `aschool-flask-1` :5003 with fixture schools (deleted afterwards), forced-commit-failure rollback probes, url_map cross-checks, pdftotext/pypdf PDF verification, and in-container pytest. The 215-page frontend ledger (`FRONTEND_PAGE_VERIFICATION.md`) verifies pages only when the core action persisted to the DB.
- **Money & grades hand-verified** (`VERIFICATION_MONEY_GRADES_2026-08-28.md`): nepal_grading bands/boundaries/weighted GPA — 45+ assertions, zero defects; discounts additive; partial balances exact; receipt outstanding point-in-time; payroll net = gross − Σdeductions invariant; payslip PDFs match to the paisa.
- **Claimed-but-still-true gaps (not fixed):** AI generation returns honest 502/429 until a real LLM key is configured (dev key is a placeholder — no page fabricates content); Meta Ads delivery does not exist (counters stay 0, labeled on-page); Jitsi rooms are public meet.jit.si (no access control); mobile push is dead (M1); student/parent mobile logins untestable until provisioning exists (⚪ scope-out, LIVE_BROWSER_UX_TEST); no news/article model (public news pages show honest empty states); no transport→fee auto-billing, leave accruals, salary versioning, or proration (logged absent, not broken).
- **Verified as correct without changes:** files tenant isolation (E169), theme port sweep (E174), flask:5000 fallbacks are server-only (E179).
- **What "215 pages verified" means:** every dashboard/public route returns 200 through the live Next container with an authenticated session, and its core action was exercised; fixes were applied inline where the action failed (E90–E219 batches).

## 6. Known remaining issues (all inputs)

1. **Backend file-by-file review incomplete.** `BACKEND_FILE_VERIFICATION.md` documents slice 3 fully (fees/tasks, hr, admission, inventory, visitor, dismissal, transport) and carries slice-1 and slice-4 sections; the effort marks **slices 1/2/4–7 pending/incomplete** — their files are covered only where other evidence exists (FIX_STATUS batch logs, frontend ledger, route probes). Not a known-broken claim; a coverage claim.
2. **WhatsApp provisioning gap for student/parent app logins.** Student users have empty phone/email and no Student-ID login identifier; demo has no parent account; student/parent app logins are ⚪ untestable until enrollment auto-generates login IDs and parent accounts are wired to logins (admission funnel already creates guardians).
3. **Website contact inbox missing.** `/website/public/<slug>/contact` + admission-inquiry persist (201, audit_logs) but there is no admin surface to read submissions.
4. **Login-500 lockout bug** at `backend/app/services/auth_service.py:166` (naive vs aware datetime) — flagged during live UX testing, explicitly out of the batch's scope, not fixed.
5. **Orphan teacher user rows on delete** — teacher profile delete does not remove/disable the User row.
6. **Mobile push (M1/M2)** — `NotificationService.init()` never called in any app; notification center unrouted; `register-fcm` no-ops.
7. **Open entitlement/product decisions** — E22 (ai_grading gate, insights dual-gate), E95 (demo-request form), E97 (RBAC editor), M11 coverage gaps (no live-bus/teacher-conference/parent-library-LMS screens; accountant/superadmin have no mobile app; admin QR + wellbeing survey creation stubs).
8. **Production deployment hardening (nothing in the inputs shows it done):** TLS termination, prod secrets (e.g. `STRIPE_WEBHOOK_SECRET`, `WHATSAPP_APP_SECRET`, `ISR_REVALIDATE_SECRET`, JWT secret — ≥32 bytes), `.env.example`, gunicorn/Socket.IO production config, Celery **worker restart on deploy** (proven load-bearing: stale worker left SMS rows queued forever, E93, and produced dead report-card URLs), backup restore drill (backups exist: pg_dump→gzip→R2, retain 30, superadmin API — restore untested), `NEXT_PUBLIC_*`/`API_URL` env discipline (E179 rule: never import API_URL into client modules).
9. **Scope-outs with reasons (⚪):** Meta Ads delivery (no credentials/provider; honest zeros), ZKTeco hardware testing (only HTTP ingest proven), teacher punches on biometric (out of scope), learning-path step-completion tracking (no endpoint yet), unset-custom-domain API/UI, `next_billing_date` never checked by expiry logic (E4/E5 territory), superadmin-created schools rely on lazy AI-quota init (E12 note), `/uploads/*` served without authentication (platform-wide, `app/__init__.py:484-489`), conference slot booking check-then-set race, ZIP-profile-image memory cap + folder_id school validation (E169 notes), benchmarking N+1 rankings, analytics 300 s server cache (self-heals), admin-flutter `/dismissal/summary` 404 (E16 note), `regenerate-key` FE-unwired (E141).
10. **Test-infra notes (not code):** shared `aschool_test` TRUNCATE deadlocks when suites run concurrently (use dedicated `TEST_DATABASE_URL`); restart `aschool-celery-worker-1` after task-file changes; `pypdf` optional dep missing in container.

## 7. Provenance

Everything above is sourced from the listed audit docs; no new probes were run for this synthesis. Fix status is against the uncommitted working tree (HEAD `df584be`) as of 2026-08-30; no git commits were made during the effort.
