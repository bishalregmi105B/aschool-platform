# IMPLEMENTATION CHANGELOG — 2026-08-30 (Phase-9)

What changed during the production-readiness effort, grouped by area. Every item carries its verification evidence from the inputs (all statuses are against the uncommitted working tree unless noted FIXED-COMMITTED). Source of record: `audits/FIX_STATUS_2026-08-28.md` §1–§16; this file is the digest. No git commits were made.

## 1. Entitlements

- **E1/E1b plan-driven plugin grants** — `backend/app/plugins/entitlements.py` `PLAN_PLUGIN_TIERS` (free→core+add_on … enterprise→+premium); registration calls `grant_plan_plugins()`, no hardcoded list, failures logged; zero trial rows at signup. Evidence: fresh registrations = 13/22/43/57 installs by plan, runtime ✅.
- **E2 plan enforcement** — `max_students` cap enforced at `students.py:126-129`, `iemis_importer.py:421` (bulk), `plugins/listeners.py` (E11 admission auto-enroll); cap=2 → 201,201,403 "Student limit reached"; NULL/0 unlimited. Pinned by `tests/test_provisioning_and_caps.py`.
- **E3 alias-leak closure** — `decorators.py:13-20` single-hop alias resolution; `design_studio` mapping removed; mirrored in `frontend/lib/plugins.tsx`; elibrary install → 403 on design-studio (was 200 via chain). Pinned `tests/test_plugin_aliases.py`.
- **E4 trial expiry** — new `backend/app/tasks/trial_expiry.py` + hourly beat `plugin-trial-expiry-hourly` + request-path exclusion of expired trials in `_set_school_context`. Runtime: backdated trial → 403, `expire_trials.run()` → `{'expired': 1}`.
- **E5 honest subscribe** — 402 without `{"payment": {...}}` proof; proof stored in `SchoolPlugin.config["last_payment"]`; `STRIPE_WEBHOOK_SECRET` defined in `config.py`; unconfigured Stripe webhook → 400 (was 500). `test_marketplace_billing.py` pins 402-then-activate.
- **E6 pricing reconciliation** — `seed.py` reads real flat manifest keys and self-heals existing rows (run: 57 plugins, 19 synced; second run 0). DB now matches manifests (fees 399 starter, gps 1999 premium, …).
- **E12 AI-quota provisioning at signup** — `auth.py` calls `AITokenHub.ensure_quota_exists()` (env defaults 10k/100k); missing row = blocked-by-default documented. Runtime: register 201 → quota row exists. Pinned.
- **E10/E13 IEMIS provisioning** — deterministic `9800000xxxx` placeholder phones (`permissions.placeholder_phone`), staff metadata moved off the nonexistent `User.settings` into `User.permissions`; Staff-alias IntegrityError guarded. Runtime: 2-row import → imported:2, errors:0; re-import idempotent.
- **E14 duplicate-plugin dedup** — `digital_content` and `portfolio` unpublished+deprecated in manifests, seed-synced to `is_published=False`; canonical `elibrary` (299) and `student_portfolio` (299) kept with legacy aliases; marketplace now lists 55. Runtime: install of deprecated slug refused; legacy install passes canonical gate (19/19 plugin tests).
- **E160–E166 plugin architecture** — config-driven install policy (free=install, paid=14-day trial; trial-clock exploits closed: reinstall preserves window, expired reinstall refused, subscribe converts in place); POST `/plugins/<slug>/activate|/deactivate`; config GET/PUT with 16 KB cap + JSONB in-place-edit fix (fresh dict + `flag_modified`); marketplace copy driven by live response (no fake "Cancel Subscription", no 29/99/299 literals); new `/dashboard/plugins` manager + `/dashboard/plugins/[slug]/settings`. Evidence: `tmp_plugin_arch_verify.py` 39/39; suites 28 passed.

## 2. Security

- **E160 priv-esc** — `users.update_user` no longer mass-assigns `role` (superadmin/arbitrary → 400); `POST /staff` dup-phone 409 + password policy. Runtime: role=superadmin 400.
- **E161 superadmin claim** — role-based check replaces the never-set `is_superadmin` claim (platform admin 403→200); protected routing/billing fields stripped for tenant admins.
- **E162/E163/E168 numeric-param 500s** — presign expires clamp [60 s, 7 d], stock-search/search page+limit clamps, batch roll-number per-item int 400.
- **E164/E96 password recovery** — `POST /auth/forgot-password` (SHA-256 token, 30-min TTL, dedicated redis namespace, honest delivery states) + `POST /auth/reset-password` (single-use, clears lockout, bumps `tokens_invalid_before` → all old JWTs rejected); new `/reset-password` page + login link. Runtime loop 12/12; `test_password_reset.py` 15 tests.
- **E165 SSRF & upload hardening** — stock-import https + Unsplash/Pexels allowlist; upload extension allowlist (svg excluded, 415); E169 tenant isolation proven cross-school (404s).
- **E190 chat role matrix** — `chat_service.can_message` enforced on every send/read (student→parent 403, parent→student 403; teacher→parent by design); E191 chat now writes the in-app notification in the same commit and clears it on read.
- **E192/E193 conferences** — BS-range 400 before write (2055 conference no longer poisons the school list), http(s)-only meeting links, booking attributed to caller, participant-only notes.
- **E194–E196 social hub** — moderation hide/unhide (`is_hidden`/`hidden_by_id`, migration `e5b7c1d9a3f8`), real `GroupMember` join/leave with group-scoped visibility, UUID/empty-content guards.
- **E198 webhook hardening** — WhatsApp GET verify fails CLOSED (403) when unconfigured; malformed JSON → 400; Meta redelivery dedupe by `wa_message_id`.
- **E42 incidents cross-tenant leak** — `involved_student_ids` school-scoped + serializer no longer leaks foreign student names; `tests/test_campus_ops_guards.py` pins cross-tenant + rollback.
- **E182 cross-tenant idempotency** — receipt lookup scoped to `g.school_id` with `<school_id>:<key>` namespacing (school B replaying school A's key can no longer receive A's receipt).
- **E11 rollback proofs** — forced commit failures → zero partial rows for exams marks, assignments, library issue/return, IEMIS import, LMS progress, incidents, social ads (monkeypatched-commit tests).
- **E200 CORS** — Flutter web origins 8090/8091 built-in, `CORS_ALLOW_ORIGINS` env honored, preflight normalized 200→204 with echoed headers. Live: OPTIONS → 204 + Allow-Credentials; unknown origin still excluded.

## 3. Payments

- **E60** initiate routes now build registered `/webhooks/{gateway}/callback` URLs (money previously 404ed after real payment). Pinned `test_initiate_esewa_uses_registered_webhook_path_and_persists`.
- **E61** new `PaymentInitiation` model + migration `b7e2c9d4a5f3` persisted before redirect (eSewa=uuid, Khalti=pidx, FonePay=PRN); FonePay resolves only via the PRN anchor; unknown PRN → honest 404 "payment NOT recorded".
- **E62** idempotent finalize: shared `_finalize_fee_payment` gate, `idempotency_key = webhook:{gateway}:{collection}:{txn}`, duplicate → 200 `{duplicate:true}`, partial re-application eliminated, `fee.paid` emits recorded amount.
- **E63** Khalti pidx-swap rejected (gateway-echoed `purchase_order_id` must match, else 400 + loud log).
- **E64** amount mismatches vs initiation → 409 nothing recorded; overpay-without-anchor → 409; underpay legacy → honest partial.
- **E65** Stripe handler NameError fixed + `stripe>=5.0,<6.0` in requirements; valid signed `checkout.session.completed` → activation `is_trial=False`, replay idempotent, bad signature 400.
- **E66** Khalti lookup outage → 502 nothing recorded; webhooks CSRF-exempted (signature-authenticated).
- **E183/E180/E184** discount-aware money everywhere: webhook finalize and fee reminders use `_collection_payable_total`; auto_generate_monthly_fees no longer crashes on a nonexistent column (`is_active`→`status`) and applies scholarships; receipt PDF outstanding is point-in-time (pypdf-pinned "NPR 6,000.00").
- Evidence: probe 60/60 twice + slice-3 money probes (98/98); `tests/test_payment_webhooks.py` 16/16; gateway verdicts eSewa/Khalti/FonePay/Stripe all ✅.

## 4. Plugins & themes architecture

- **E70/E71** single PluginGate (`lib/plugin-gate.tsx` deleted); 24 labels added; all 43 gating slugs verified against the live catalog — zero lockouts.
- **E72** 240-frontend-path diff vs url_map = 0 unmatched (portfolio rewired to real contract; new `POST /ai-tools/letter-writer`).
- **E125/E118** gate corrections (gallery→`file_management`; AI question generator→`elibrary`).
- **E170–E174 theme port** — 20 invented themes replaced by 10 token-level ports of real GPL WordPress education themes (credits in `frontend/themes/THEMES_CREDITS.md`); theme switching actually changes public colors (E171 `synced_colors`); idempotent `scripts/migrate_theme_slugs.py`; AI designer prompt on the 10 real ids. Evidence: picker 10 ids, apply round-trips (`#002b46`/`#004a8d`), 14 public pages 200, pytest theme/website 33 passed.
- **E201/E202 publish honesty** — request-time unpublish guard (coming-soon within seconds) + fire-and-forget ISR revalidation via `NEXTJS_INTERNAL_URL`/`ISR_REVALIDATE_SECRET`; foreign `school_slug` → 403.
- **E152/E159/E177** on-demand revalidation wired to every builder mutation; unpublished → 404 + honest "Website Coming Soon" (vs "School Not Found").

## 5. Implemented-from-empty plugins (were sold but had no backend)

- **multi_branch (E-batch)** — `school_chains`/`school_chain_members` + migration; overview/dashboard/analytics/branch-tenant management under `/schools/*`. Evidence: 2-branch fixture aggregates == SQL (11 students / Rs 10,000 / 81.8%); `test_multi_branch.py` 10/10.
- **biometric (E-batch)** — devices/punches/sync_logs + per-device key (SHA-256-at-rest), atomic idempotent ingest, heartbeat, NPT attendance upsert. Evidence: replay → duplicates only; malformed batch → 400 zero rows; `test_biometric.py` 11/11.
- **ai_adaptive_learning (E23)** — `/lms/learning-paths*`, `/lms/mastery*`, `/lms/adaptive-progress`; `LearningPath`/`MasteryRecord` + migration `e8a3d5f7c2b4`; honest `rule_based_fallback` when LLM unavailable. Evidence: 7/7 tests + live probe; no-plugin 403; quota 429.
- **disaster_management (E40)** — drills CRUD/participations/overview (hand-computed readiness 70)/honest USGS seismic feed. `test_disaster_management_api.py` 6/6; probe 111/111.
- **incident_management (E41)** — assign/forward-only status/escalate+notify/conference/resolve/audit/reports over shared Incident rows, zero base-route duplication; migration `d4e5f6a7b8c9`. 8/8 tests; reports math exact.
- **social_ads (E30)** — `/social/campaigns*` (8 routes), class/section targeting validated against school data, bleach-sanitized content, honest audience estimates; delivery counters stay real zeros (no Meta API).

## 6. WhatsApp / LMS / white-label / comms

- **E32/E121** WhatsApp auto-replies persist (JSONB fresh-list assignment) and exact-match no longer falls through to contains; inbound webhook honesty verified (store/skip/unhandled/signature/rollback). **E210–E213** four real sub-pages: conversations+thread+manual reply, templates CRUD (PUT/DELETE by index), AI settings in plugin config, SQL-only analytics (handled % derived). Evidence: 4 conversations / 7-message thread / rule CRUD / analytics == SQL.
- **E31/E197/E122** SMS outcomes real (queued→sent/failed, console mode loud); template validation; broadcast channels deliver honestly (push rows, email sent/failed, WhatsApp skipped).
- **E34** `g.current_user` resolved for header-auth requests (mobile) — 20+ endpoints un-500ed.
- **E214** LMS Create Course action → `POST /lms/courses` 201 live.
- **E142** white-label theme/branding JSONB writes actually persist (`flag_modified`); branding write-through to `SchoolWebsite.customizations` + `School.logo_url` re-verified.

## 7. Frontend deep-dive fixes (E70–E219 digest)

- **Slice 1 (E90–E98):** settings JSON editor wired to the real `settings` column; fake CSV importer replaced with a real backend-backed one; history crash fixed; SMS history crash fixed; OTP phone-format variants (E94); error states added.
- **Slice 2 (E100–E102):** student-edit 500 on blank phone; initial section actually created; class-wide timetable clash detection.
- **Slice 3 (E110–E119):** report cards now compute grade/GPA/rank identical to /results; grades page read-only NEB table; remarks/timetable/letter pages rewritten to real contracts; `credit_hours` honored (E111); teacher records 500 fixed (E119).
- **Slice 4 (E120–E127):** discount-blind collection report fixed; payroll component editor + leave-apply UI; broadcast honesty; gallery gate; announcements enum 500; staff phone 400.
- **Slice 5 (E130–E134):** health-profile search; badge dedup 409; moderation delete affordance; campaign draft→active lifecycle; portfolio FK guards.
- **Slice 6 (E140–E143):** transport PluginGate + phantom driver field; biometric one-time key dialog; white-label JSONB; GPS ISO-Z timestamps.
- **Slice 7 (E150–E159):** five public-site endpoints built (teachers/events/gallery/alumni/results with symbol-no+DOB checker); certificate templates restored with real `{tokens}` + bulk NameError fix; ISR revalidation; AI-builder palette; live contact form; IEMIS template download; favicon; debug leftovers removed.
- **Sweep (E73–E75):** 33 pages gained error states (fees overview no longer renders Rs. 0 on failure); 4 table overflow fixes; 16 hex→token replacements.
- **UX batches (E200–E219):** CORS, publish guard, foreign-slug 403, guardian-name label, "Class Class 10", exact NPR formatting, nested-button hydration, live theme count, WhatsApp pages, LMS create, middleware refresh recovery (E215), timetable P8 backfill, BS long-form exam dates, Class 10 grade, academic-year dates required.
- Verification: `tsc --noEmit` = 0 new errors throughout (4 documented pre-existing); every touched page 200 through the live container.

## 8. Mobile M-fixes (aschool_shared + 5 apps)

- **M3** HR repo repointed to real `/hr/payroll|/hr/leaves|/hr/leave` + serializer field alignment; teacher payslip screen renders 403 honestly. **M4** marketplace install/uninstall against real body-contract + price parse fix. **M5** AI screens rewritten to `/ai-tools/*` with per-tool forms; auto_grader/study_tips honestly disabled. **M6** parent fee checkout completable (FIXED-COMMITTED `3920609`). **M7** plugin config real on mobile. **M8** dead `offline_sync.dart` deleted. **M9** safe-parse helpers; bare casts 250→4 (provably safe); **M10** 134 silent `catch (_)` → 0 (62 error-UI, 12 honest actions, 30 log-only by design, 11 already-covered, 2 new catches); **M12** pubspec SDK constraint. **E165** parent child-health/portfolio/elibrary endpoints + envelope unwrap. **E215-era** flutter_admin principal dashboard rewired to real `/analytics/overview` + `/fees/recent`; flutter_teacher web build fixed (web 0.5.1 pin).
- Evidence: `dart analyze` clean in all touched files (0 issues shared; app baselines unchanged); teacher login live on :8092; admin login+refresh live on :8091.

## 9. Data hygiene (2026-08-30)

- 32 junk probe tenants + 1,350+ rows deleted in one transaction (`audits/coverage/DATA_HYGIENE_2026-08-30.md`); demo school cleaned (21 test students, 40 users, probe fees/notices/uploads); classes normalized to Class 5–10 with sections; orphan sweep across 158 tables = 0 rows. Post-verification: `GET /students` → exactly 3; superadmin sees exactly 2 schools.
- UX-test data backfills: E216 timetable P8, E218 Class 10 numeric_grade, E219 academic-year 2082 BS/AD dates.

## 10. Money & grades verification (no code change where correct)

- `nepal_grading.py` verified correct with zero defects (45+ boundary/weighting assertions); endpoint GPA == util == hand math; payroll invariant fixed where violated (derived net uses stored gross); fees additive discounts + point-in-time receipt outstanding fixed; report-card math aligned to /results (E110). Pinned by `test_gpa_endpoint_vs_util.py`, `test_fees_money_math_verification.py`, `test_hr_payroll_math.py` (8/8).

## 11. Docs/PDF pipeline

- **G1** report-card PDF bytes persisted via `upload_file` and served (9,767 B %PDF runtime proof); **G2** EMIS CSV uploaded + streamed by `compliance.py download_emis_export`; three new `/reports/*/pdf` exports with BS letterhead (pdftotext-verified); bulk report-cards/marksheets are real WeasyPrint PDFs; certificate correctness restored by E151 (template registry + `{tokens}` merge + bulk NameError fix) and E155 (valid CSS borders).
