# 📋 ASCHOOL AUDIT & CHANGELOG INDEX
**Centralized Directory of System Audits, Historical Logs, and Real-Time Codebase Changes**  
**Maintained by:** Development Team & AI Engineering Assistants  
**Last Updated:** August 27, 2026  

---

## 🗂️ Active Audits (Root `audits/`)

| Date | Audit Document | Description | Scope |
| :--- | :--- | :--- | :--- |
| **2026-08-27** | [**`MARKET_COMPETITOR_ANALYSIS.md`**](MARKET_COMPETITOR_ANALYSIS.md) | Exhaustive competitive analysis against Veda, Teachmint, PowerSchool, ManageBac, and Toddle. | Market Analysis, Features, Competitors, Pricing |
| **2026-08-27** | [**`FRONTEND_QA_AUDIT.md`**](FRONTEND_QA_AUDIT.md) | Next.js QA Audit detailing broken 404 links, PluginGate mismatches, and UI contrast flaws. | Next.js Frontend, Tailwind, Authentication |
| **2026-08-27** | [**`BACKEND_QA_AUDIT.md`**](BACKEND_QA_AUDIT.md) | Python Backend QA detailing mathematical fixes for GPA/Payroll and solved ImportError bugs. | Python Backend, Math Logic, PDFs, Exceptions |
| **2026-08-27** | [**`MOBILE_APP_QA_AUDIT.md`**](MOBILE_APP_QA_AUDIT.md) | Flutter Mobile QA detailing API mismatches, parsing risks, and missing screens. | Flutter Apps, Models, API Routes |
| **2026-08-27** | [**`ALL_57_PLUGINS_DEEP_DIVE_AUDIT_2026-08-27.md`**](ALL_57_PLUGINS_DEEP_DIVE_AUDIT_2026-08-27.md) | **Exhaustive Deep-Dive of all 57 Plugins** across Backend, Frontend, Flutter Mobile Apps & External APIs | Full Stack, All 57 Plugins, Hardware, External APIs |
| **2026-08-27** | [**`PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md`**](PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md) | Comprehensive audit of Signup Package Selection, Plugin Entitlements, Gating & Quotas | End-to-End Auth, Plan Tiers, Plugins, Quotas, DB limits |

---

## 🗃️ Historical / Archived Audits (`audits/old/`)

All previous audit logs, simulation reports, and implementation plans have been safely moved to [`audits/old/`](old/):

- [`audits/old/AUDIT_REPORT_2026-08-22.md`](old/AUDIT_REPORT_2026-08-22.md) — Previous security, auth & UI audit.
- [`audits/old/FULL_STACK_AUDIT_2026-05-19.md`](old/FULL_STACK_AUDIT_2026-05-19.md) — Multi-service full-stack audit.
- [`audits/old/ASCHOOL_SIMULATION_REPORT_2026-05-19.md`](old/ASCHOOL_SIMULATION_REPORT_2026-05-19.md) — Automated simulation test run.
- [`audits/old/aschool_audit_part1_executive.md`](old/aschool_audit_part1_executive.md) — Executive summary audit.
- [`audits/old/aschool_audit_part2_tier1_tier2.md`](old/aschool_audit_part2_tier1_tier2.md) — Tier 1 & Tier 2 modules audit.
- [`audits/old/aschool_audit_part3_tier3_tier4.md`](old/aschool_audit_part3_tier3_tier4.md) — Tier 3 & Tier 4 modules audit.
- [`audits/old/aschool_audit_part4_final_deliverables.md`](old/aschool_audit_part4_final_deliverables.md) — Deliverables & launch checklist.
- [`audits/old/PLAN_AUDIT_2026-04-25.md`](old/PLAN_AUDIT_2026-04-25.md) — Initial plan & pricing audit.
- [`audits/old/ASchool_ULTIMATE_v1.md`](old/ASchool_ULTIMATE_v1.md) — Comprehensive technical architecture v1.
- [`audits/old/FIX_TRACKER.md`](old/FIX_TRACKER.md) — Historical issue tracker and resolved defects.
- [`audits/old/MASTER_IMPLEMENTATION_PLAN.md`](old/MASTER_IMPLEMENTATION_PLAN.md) — Historical master plan.
- [`audits/old/ASchool_Copilot_Audit_Prompt.md`](old/ASchool_Copilot_Audit_Prompt.md) — Historical copilot prompt reference.

---

## 📝 Real-Time Codebase Change Log

### [2026-09-03] - Master plan M0 wave 2: prod validation, OTP, rate limits, XSS, website authz, payments, uniqueness, hygiene
- **Author/Agent:** ZCode implementation agent (per `docs/MASTER_PLAN_2026-09.md`)
- **Action Taken:**
  - **S-03** `config.py`: `_env()` secret resolver (no literal fallbacks outside dev/test; per-process random + loud warning when empty in prod), `ENV` attr on every config class, hardened `ProductionConfig.validate()` — secrets ≥32 chars and never equal to any `.env.example` value, `ISR_REVALIDATE_SECRET` required, Stripe/R2/WhatsApp conditional requirements, POSTGRES/FLOWER warnings. New `tests/test_config_validation.py`.
  - **S-04** `_cookie_params` now reads `config["ENV"]` (Flask 3 has no FLASK_ENV key — Secure was always False); `JWT_COOKIE_SECURE` mirrored in `create_app`; CSRF posture documented (SameSite=Lax + the existing Origin/Referer guard; host-only cookies by default).
  - **S-06** OTP: `secrets.choice` generation, verify-side attempt counter (lock at 5 → OTP invalidated everywhere), `hmac.compare_digest`, fresh send resets the budget. New `tests/test_otp_hardening.py`. Also fixed two PRE-EXISTING test breakages in `test_password_reset.py` (E96 cooldown 429 + CSRF-guard 403 — verified failing on unmodified HEAD via git stash).
  - **S-08** ProxyFix on the WSGI stack; `@limiter.limit("5/minute")` on login/send-otp/verify-otp/student-login/forgot-password; `@ai_rate_limit(20/3600, keyed school+user)` on all 10 `/ai-tools` routes + adaptive-learning generate-ai; `5/hour;20/day` (slug+IP key) on public contact/admission-inquiry/results. Autouse `limiter.reset()` in conftest (limiter counters live outside the cache flush). New `tests/test_rate_limiting.py`.
  - **S-11** `sanitize_colors()` allowlist (keys the product reads; hex/color-word values only) on the `PUT /website/config` path; `ThemeEngineService.synced_colors` filters every override source through `_is_safe_color`; frontend `sanitizeColorOverrides()` + `layout.tsx` uses it (defense in depth; tsc clean). New `tests/test_website_colors_xss.py`.
  - **S-12** draft website pages 404 publicly (`is_published` filter on page renderer + home lookup); public gallery only serves `is_public='public'` files; `/uploads/<path>` resolves `ManagedFile` and enforces visibility (school_only/private need the owning school's token; Cache-Control private). New `tests/test_website_public_authz.py`.
  - **S-13** `refunded` added to the payment_status enum (migration `f8c2a9d4e1b7`); new `FeeRefund` ledger model written in the same commit as the status change (gateway-first ordering preserved); webhook outstanding math now uses `_collection_payable` (base+fine−discount); Stripe webhook replay guard (`processed_webhook_events` UQ table, inserted with the effect) + school/plugin metadata validation. New `tests/test_payment_refund_correctness.py`; migration verified up/down/up ×2 on a scratch DB.
  - **D-02** migration `a9b3e7c1d5f8`: partial unique indexes on marks / receipt numbers / students identity / staff_payroll / report_cards / buses / houses / student_badges / enrollments / student_progress / payment_initiations / timetable_slots (each guarded by column-existence + pre-existing-dupe checks); `school_receipt_counters` table; receipt numbering replaced with `{SLUG}/{FY-BS}/{seq:05d}` drawn under `SELECT … FOR UPDATE` in BOTH the fees API and webhook receipt generators. Model-side indexes added to `Marks` + `FeeReceipt` for create_all parity.
  - **B-02** duplicate marks race → clear 409 (IntegrityError handler at commit, zero partial rows). **B-03** broadcast audience cap removed (default unbounded; 800-parent schools deliver to all of them). **B-04** library issue/return take the Book row `with_for_update` (no more negative stock). Regression: comms/ops suites 40 passed.
  - **S-14** committed (d230f8d): tmp/probe/debug scripts, tsbuildinfo, and the 70MB `frontend/templates_demo` removed; `.dockerignore` for both services; Nulled vendor dir confirmed untracked.
- **Audit References:** `docs/MASTER_PLAN_2026-09.md` §2/§2b, `audits/deep2026/00–08`.

### [2026-09-03] - Master plan M0 wave 1: tenant isolation, CORS anchor, revocation, socket auth, D-01 migrations, B-01/B-05
- **Author/Agent:** ZCode implementation agent (per `docs/MASTER_PLAN_2026-09.md`)
- **Rationale:** Begin executing the 2026-09-03 master plan in milestone order — M0 security/money/data P0s first.
- **Action Taken:**
  - **S-01** `app/__init__.py resolve_school` — `_cross_tenant_response()`: an authenticated non-superadmin resolving a school they don't belong to (via `X-School-Slug`, subdomain, or JWT fallback) now gets 403 before any endpoint logic. New `tests/test_tenant_isolation.py` (7 tests).
  - **S-02** anchored the `*.base` CORS/CSRF origin regex (`^https://[^./]+\.base$`) — `demo.base.attacker.example` no longer receives credentialed CORS or CSRF acceptance. New `tests/test_cors_csrf_origin.py` (5 tests).
  - **S-05** `RevokedToken` naive-UTC normalization (aware/naive/int-seconds all safe); removed the fail-open `except: return False` around the blocklist loader; same-family fixes in `auth_service.verify_otp` (naive-UTC expiry compare), `assignments._assignment_dict` and `plugins/billing.py` (guarded tz attach). New `tests/test_token_revocation.py` (7 tests).
  - **S-07** `app/realtime.py` rewritten: authenticated connect (socket.io `auth` payload / Authorization header / access cookie), `join_school` ignores client-supplied school_id (superadmin may target explicitly with an existence check), per-connection state in a sid-keyed registry. Required `Flask-SocketIO 5.4.1 → 5.5.1` (Flask 3.1 read-only `RequestContext.session`), `manage_session=False`, and no message-queue in testing. New `tests/test_socket_auth.py` (7 tests incl. room isolation).
  - **D-01** new migration `f3a8c2e6d9b4`: creates `student_scholarships` (school_id + student_id indexed) and adds `designer_document_revisions.is_deleted`; model gains `qr_pay` in the payment_method enum (DB had it since e4f5a6b7c8d9); `models/__init__.py` now imports faq/hostel (autogenerate safety); removed the silent `except: pass` around scholarship auto-apply in fee generation. Also repaired the un-runnable initial migration `c1f55f2f9905` (topological create order, two FK cycles deferred via `create_foreign_key`, missing `pgvector` import, missing `CREATE EXTENSION vector`) — fresh `flask db upgrade` now reaches head; upgrade AND downgrade of the new migration verified on a scratch DB. `scripts/repair_initial_migration.py` kept for provenance.
  - **B-01** `exams.submit_marks`: full marks resolved in the pre-validation pass; over-full or negative marks fail the batch with 400 naming `records[idx]` before any write (grade result now computed once and reused). `test_exam_marks_entry_mid_batch_failure_leaves_no_partial_rows` updated to the stronger 400 contract; zero-partial-rows guarantee unchanged. New `tests/test_marks_validation_and_ranks.py`.
  - **B-05** competition ranking (1, 1, 3) at all three rank sites: exam results, grade sheet, and bulk report-card `rank_in_class`/`rank`.
- **Verification:** 51+ test executions green across `test_tenant_isolation`, `test_cors_csrf_origin`, `test_token_revocation`, `test_socket_auth`, `test_marks_validation_and_ranks`, `test_exam_attendance_timetable_assignment`, `test_auth`, `test_comms_plugins`, `test_api`, `test_fees_*`, `test_models`, `test_nepal_grading`, `test_gpa_endpoint_vs_util` (env: dockerized Postgres 5433 / Redis 6381, `TEST_DATABASE_URL`).
- **Audit References:** `audits/deep2026/00–08`, `docs/MASTER_PLAN_2026-09.md` §2/§2b.

### [2026-08-27] - System-Wide QA, Market Research & Bug Fixes
- **Author/Agent:** Autonomous Agent Team
- **Rationale:** Deep-dived into frontend UX, mobile parsing, backend calculations, and competitor analysis.
- **Action Taken:** Fixed `ImportError` bugs in AI Services, updated `nepal_grading.py` for weighted GPA logic, and fixed `hr_payroll.py` payslip calculations.
- **Audit References:** `BACKEND_QA_AUDIT.md`, `FRONTEND_QA_AUDIT.md`, `MOBILE_APP_QA_AUDIT.md`, `MARKET_COMPETITOR_ANALYSIS.md`.

### [2026-08-27] - 57-Plugin Exhaustive Deep-Dive Audit
- **Author/Agent:** Multi-Agent Audit Group
- **Rationale:** Explored and documented every single plugin across backend REST APIs, DB models, Next.js frontend pages, Flutter mobile screens, and external APIs.
- **Affected Subsystems:** All 57 Plugins, Architecture, Mobile App Matrix, External APIs.
- **Audit Reference:** [`audits/ALL_57_PLUGINS_DEEP_DIVE_AUDIT_2026-08-27.md`](ALL_57_PLUGINS_DEEP_DIVE_AUDIT_2026-08-27.md)

### [2026-08-27] - System Theme Overhaul, Auth Loop Fix & Direct Registration
- **Author/Agent:** Antigravity AI Agent
- **Rationale:** Resolved 401 loop on `/login`, converted entire system to landing page Forest Green aesthetic, removed mandatory OTP blocking on registration, and organized audits.
- **Audit Reference:** [`audits/PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md`](PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md)

### [2026-08-30] - Live-stack fixes: files-manager network path, unpublished-site UX, favicon (E175-E179)
- **Author/Agent:** ZCode live-bugfix agent
- **Rationale:** /dashboard/files listed nothing (trailing-slash 308 chain leaked Docker-internal `flask:5000` into the browser); unpublished school sites showed dishonest "School Not Found"; favicon 404 on every page.
- **Action Taken:** `files.py list_files` strict_slashes=False + files.service calls `/files` (no slash); upload XHR and 6 client raw-fetch forms unified on the shared axios client (relative /api + withCredentials); `_public_site_guard` 404 now carries school_name; new `lib/public-site.ts` + honest "Website Coming Soon" vs "School Not Found" states in school/[slug] layout/page; `app/icon.svg` added. Runtime-verified: upload→list via :3003 returns the file, redirect chain stays same-origin, unpublished/fake slug states and favicon 200 checked live; tsc clean on touched files.
- **Audit Reference:** [`audits/FIX_STATUS_2026-08-28.md`](FIX_STATUS_2026-08-28.md) (section 12, E175-E179)
