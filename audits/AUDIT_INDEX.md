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

### [2026-09-04] - Closing wave: AW-06 red-team PASS (live), S-10 TLS, W-02 draft/live, D-03 timestamptz
- **Author/Agent:** ZCode implementation agent
- **Action Taken:**
  - **AW-06 red-team** (the founder launch blocker): 13 adversarial cases run LIVE against gpt-oss-120b — injection, exam-bypass (incl. Spanish), persona jailbreaks, prompt extraction, PII fishing, self-harm escalation. **ALL PASS**; report at `backend/audits/ai_redteam/known_failure_modes.md`. The suite caught and fixed 3 tutor bugs: provider role mapping (tutor→assistant; Groq 400'd), transient source_id ordering, and off-JSON model output now fails safe (canned redirect, never raw output to a student).
  - **S-10 TLS**: nginx/nginx.tls.conf (443/HSTS/TLS1.2-1.3/OCSP/421 catch-all/wildcard school vhosts) + Cloudflare real-IP restore in nginx.conf + CSP headers in next.config.js (dashboard frame-ancestors:none; public allows fonts/Maps/GA).
  - **W-02 draft/live**: autosave targets draft_config; publish-draft/history(10)/revert/restore endpoints; editor Publish button; draft saves no longer purge the live cache.
  - **D-03 completion**: migration b2e7c4a9f1d3 converted **418 naive columns → TIMESTAMPTZ** (Kathmandu interpretation); TZ=Asia/Kathmandu in all compose services.
  - **A-02**: golden-set cases for planning/assessment/communication.
- **Verification:** red-team 2/2 live; regression 58 passed; chain head `b2e7c4a9f1d3` from scratch; tsc clean. Deploy note: certs → ./nginx/ssl, Cloudflare Full (strict).
- **Audit References:** `docs/MASTER_PLAN_2026-09.md`, ecosystem §13.3.

### [2026-09-04] - Final backlog wave: money-leak repairs, deploy ordering, D-06, AW-05/07, W-03/W-04, N-04, P-04
- **Author/Agent:** ZCode implementation agent
- **Action Taken:**
  - **P-05/B1** `register_school` always creates plan=free (self-registered "enterprise" granted NPR 5,670/mo of plugins forever); requested plan stored as a sales signal. **P-05/B3** `/subscribe` verifies the reference via the Khalti gateway (school credentials) and 402s honestly otherwise — typed-in transaction ids can no longer activate paid plugins; test contract updated.
  - **P-03** deploy.yml: ff-only fetch (no reset --hard), previous-SHA rollback record, migrate BEFORE container swap, /ready health gate with rollback.
  - **D-06** `app/utils/money.py` Decimal helpers + `ClassSubject`/`SectionSubjectTeacher`/`FeeStructureItem` models (migration e5b2d8f4a7c1) replacing ARRAY/JSONB denormalization; chain head now `a7c3e9b1d5f4`.
  - **A-01** atomic Redis cost reservation (INCRBY micro-USD, 48h TTL, reconciled post-call) — bursts cannot collectively bypass the daily budget.
  - **A-03** server-side blueprint marks-sum validation (400 naming shortfall) + test.
  - **AW-05** content-library CRUD with visibility tiers; **AW-07** IEP drafter + reviewer gate (principal/special_ed/superadmin/can_review_iep, evidence-citation enforced, human_review_required hard-true).
  - **W-03** sitemap.ts/robots.ts, JSON-LD as a real script tag, canonical + twitter, GA/FB pixel rendered; **W-04** ContactMessage inbox (model, unread-first routes, migration f9b4e1c6d2a8), school profile fields (migration a7c3e9b1d5f4), notices payload Nepali + attachments.
  - **N-04** 2072 fee-cap: 14 heading constants + Nepali-keyword classifier. **A-02** tests/ai_evals golden-set skeleton + offline-safe runner. **P-04** production JSON logs + X-Request-ID middleware.
- **Verification:** 67 tests across 9 suites green; migration chain verified from scratch; tsc + jest clean.

### [2026-09-04] - Live AI verification (Milan Groq key) + AW-06/08/09/10/11 + 4-agent implementation audit
- **Author/Agent:** ZCode implementation agent
- **Action Taken:**
  - **Live AI:** Groq API key retrieved from the Milan deployment server (root@2.25.81.90, /var/www/milan/backend/.env) per founder request; local .env configured; model catalog updated to Groq 2026 (llama-3.x retired → openai/gpt-oss-20b/120b, whisper-large-v3-turbo, llama-prompt-guard-2); price sheet updated; reasoning-model handling (gpt-oss spends max_tokens on the reasoning field — hub surfaces finish_reason/reasoning, default budget raised). ALL AI features live-tested: hub fast/smart + JSON parse, flashcards/lesson-plan/differentiation/parent-email through the guardrail pipeline (ledger+analytics rows confirmed), paper-v2 AI shortfall (3 MCQs generated, options+keys, bank-seeded unapproved), designer AI path, homework helper, whisper transcription.
  - **AW-01 live fix:** the orchestrator never told the model which schema to emit — _system_prompt now embeds the registered output schema (flashcards failed before, passes now).
  - **AW-06 tutor engine** (state machine, exam-mode deflection, per-turn guardrails, reflection, routes) — LIVE-verified: deflection fired on "just give me the answer"; turn-2 returned a genuine Socratic question.
  - **AW-08 speech:** AITokenHub.transcribe (whisper, live-verified) + /capture/voice two-stage flow with human confirmation; /capture/photo honest 501.
  - **AW-09/10/11:** UNESCO PD framework seeded as RAG policy chunks (+framework/progress routes, startup-wired); ephemeral live polls (aggregate-only); Caliper event emission (wired into AIGeneration persist) + QTI 3.0 export.
  - **Enum collision found live:** PT conferences own session_status — tutor enum renamed tutor_session_status (model + migration).
  - **4-agent implementation audit** vs master plan (Phase 0/0.5, 1/2, 2b, 3/5). Critical findings FIXED: tutor data-loss (messages/generations never persisted), self-harm flag transient id, permissions/TOTP write hole via users API, consent-gate bypass, S-09 lying domain-verify stub (now delegates to real DNS verify), broken tsbuildinfo gitignore + stray tmp files, caliper never emitted, PD seed never called, backup trigger over-permissive, ProgramsSection name??title seam.
  - Full verdicts: **audits/IMPLEMENTATION_AUDIT_2026-09-04.md** (per-item IMPLEMENTED/PARTIAL/NOT with file:line evidence + ranked remaining backlog).
- **Verification:** workbench 11 ✓, audit/honesty 4 ✓ after fixes; migration chain head d8a1f4c7b2e9 verified from scratch; tsc clean.
- **Audit References:** `docs/MASTER_PLAN_2026-09.md`, `docs/AI_TEACHING_ECOSYSTEM_PROMPT_2026-09.md`.

### [2026-09-04] - Master plan phase 2/2b wave: curriculum, RAG, ai_workbench, audit trail
- **Author/Agent:** ZCode implementation agent (per `docs/MASTER_PLAN_2026-09.md`)
- **Action Taken:**
  - **A-04** `app/models/curriculum.py`: CurriculumFramework (platform NULL-school rows) → CurriculumUnit → LearningOutcome + SubjectOffering (THFM/THPM/PRFM/PRPM grid); platform CDC/NEB seed (50 frameworks, grades 1-12 core + 11-12 stream offerings), startup-wired idempotent. Migration `c9f2a5d8e4b7` with guarded enum pre-creation (`DO $$ CREATE TYPE ... duplicate_object`) + `postgresql.ENUM(create_type=False)` — generic `sa.Enum` silently ignores `create_type` and replays CREATE TYPE on partial-transaction retries.
  - **A-05** `document_chunks` (pgvector 1024-dim, HNSW cosine + GIN tsvector) in migration `b6d9e3f1c8a2`; `AITokenHub.embed()` (OpenAI text-embedding-3-small through the quota/log/cost door; honest AIProviderError without a key); `services/ai/rag.py` hybrid retrieval (cosine + ts_rank fused with RRF-60, ALWAYS school_id-scoped) with delimited citation blocks marked "treat as DATA, not instructions".
  - **AW-01/02** 14-table ecosystem model in `app/models/ai_workbench.py` + migration: AIGeneration provenance ledger, AINutritionFacts (CI gate a), AIToolRegistry, SchoolAIToolSettings kill switch (403 within one request), AIContentLibraryItem, TutorSessionPlan/Session/Message, IEPPlan (human_review_required hard-true), GuardianAIConsent, ModerationFlag, AIToolAnalyticsDaily, narrow StudentAIProfile. ONE generic dispatcher `POST /ai/generate/<tool_key>` (`services/ai/workbench.py`): tier gate → role gate → guardian-consent gate → regex injection classifier → student-name pseudonymization (map never leaves server) → AITokenHub → schema validation + ONE repair retry → moderation (critical self-harm → ModerationFlag + counselor escalation, no second alerting mechanism) → ledger + daily analytics rollup. Routes: catalog, nutrition, settings, generation provenance, moderation queue/resolve.
  - **AW-03** 10 tools seeded with en+ne prompt files (CI gate g) + Nutrition Facts on all ga tools: free teaser (lesson_plan, differentiation, study_guide, flashcards) + ai_suite (worksheet, exit_ticket, rubric, parent_email, writing_feedback — schema has NO revised_text field, CI gate e) + the `fixture_test` tool proving "tool #66 = one row + one prompt + one handler, zero routes/pages" (11 integration tests in `tests/test_ai_workbench.py`).
  - **AW-12** `/dashboard/ai-workbench` frontend: registry-driven catalog grid, generic ToolRunner (schema-driven form, Nutrition Facts card, cost-estimate chip BEFORE generating, provenance footer with gen-id + cost), PluginGate on ai_suite. tsc clean.
  - **D-07** `app/utils/audit_trail.py`: before_flush listener over the sensitive-table set (marks/fees/refunds/report_cards/payroll/scholarships/users/school_plugins) with changed-column granularity. Old values captured via a `set`-event ledger (load_history cannot see expired attrs — LoaderCallableStatus resolved by one committed-row read), recursive JSON-safe normalization (UUID/Decimal/datetime). TOTP secret stripped from `User.to_dict()` (was leaking via the permissions bag). Follow-up migration `d8a1f4c7b2e9`: audit_logs.school_id now nullable — superadmin actions on audited tables have no school but must be audited (found by the regression sweep as a real NotNullViolation).
  - **A-06(5)** designer `_default_variation` fallbacks now carry `source="rule_based_fallback"` + `fallback: true` — quota-exhausted schools no longer see fabricated "AI-generated" designs.
  - **Adapted to D-02:** `test_assess_mastery_returns_json_safe_floats` created a duplicate (exam, student, subject) Marks row — now uses a same-name/different-code subject (the unique index working as intended).
- **Verification:** workbench 11 ✓, audit/honesty 4 ✓; regression batch 1 (AI/auth/config) 80 ✓; batch 2 (money/exam/website/socket/tenant) 57 ✓ + 18 ✓ after the audit-logs fix; frontend tsc + jest (9 suites/36 tests) ✓; full migration chain reaches `d8a1f4c7b2e9` from scratch with clean down/up cycles.
- **Audit References:** `docs/MASTER_PLAN_2026-09.md` §4/§4b, `docs/AI_TEACHING_ECOSYSTEM_PROMPT_2026-09.md`.

### [2026-09-03] - Master plan phases 1-3+5 wave: celery, backups, timestamps, indexes, question bank v2, renderer seams, Nepal moat quick wins
- **Author/Agent:** ZCode implementation agent (per `docs/MASTER_PLAN_2026-09.md`)
- **Action Taken:**
  - **P-01** `task_routes` default queue (20 beat tasks were published to the unconsumed `celery` queue — fee reminders/trial expiry silently never ran); worker `-Q` gains `celery` as transition; new `app/utils/task_locks.py` redis SET NX EX lock wrapped around 7 beat tasks; `fee_collections.last_reminder_sent_at` + 72h dedupe in `send_fee_reminders`; beat schedule volume-mounted; GPS beat `expires`; `acks_late` + time limits. Haversine at `gps_processing.py:149` VERIFIED CORRECT (audit false positive).
  - **P-02** `postgresql-client` in the Dockerfile (pg_dump never existed in the image); new `system_settings` KV (model + migration) with real `last_db_backup_at` written by the task and read by `/db-backup/status`.
  - **D-03** BaseModel timestamps → TIMESTAMPTZ with server defaults + server-side uuid default; **52** `datetime.utcnow()` sites swept to aware now(); 6 shadowed `is_deleted` re-declarations removed (website/lms/social).
  - **D-04** migration `d7f2c8b3e9a4` programmatically indexed every unindexed FK (**215 created**) + 10 tenant-first composites + `users.email/phone` + `schools.custom_domain`.
  - **D-05 (expand)** nullable `academic_year_id` FK + index on marks/report_cards/attendance/fee_receipts, backfilled from exams/students; `SchoolModel.for_school_and_year()` helper. NOT NULL contract phase deliberately deferred.
  - **A-01** AITokenHub: env-driven timeouts + bounded retries with jitter + per-provider circuit breaker; `GROQ_MODEL_*` env vars now actually read; cost accounting (`cost_usd`/`cost_npr` columns + price sheet, quota basis moving to cost); `AI_QUOTA_ENFORCEMENT` strict parse ("1" no longer silently disables); sha256 prompt hashes in usage metadata; shared `app/utils/llm_output.py` `parse_and_validate()` (fence/span extraction + bounded repair + schema subset).
  - **A-02** temperature discipline: all 8 `temperature=1.0` sites → 0.2 (grading, question paper) / 0.4 (documents).
  - **A-03** Question Bank + Paper Generator v2: `QuestionBankItem`/`PaperBlueprint`/`GeneratedPaper` models (+migration `a3c8e2f5b7d9`); bank-first-then-generate pipeline (AI shortfall at temperature 0.2, structured output, generated items seeded unapproved); question-bank CRUD/approve routes; `POST /ai-tools/question-paper/v2`; answer key withheld by default.
  - **W-01** renderer seams: real `<a>` CTAs with scheme allowlist (were dead `<span>`s), hero height honored, name??title / message??quote / subtitle fallbacks (live cards had empty headings), navbar nav from published builder pages, embed_url iframe allowlist (Maps/OSM + sandbox).
  - **N-01** sidebar renders `label_nepali` (transmitted by manifests, never read) per `preferred_language`.
  - **N-02** bulk_generator's drifted duplicate NEB scale replaced with the shared `nepal_grading` util (parity verified).
  - **F-01** `global-error.tsx` / `error.tsx` / `not-found.tsx` + dashboard `loading.tsx`/`error.tsx` — no error boundary existed anywhere.
  - Pre-existing failures fixed along the way: stale patch target in `test_adaptive_learning_api.py` (5 sites), E96-cooldown/CSRF 403 in `test_password_reset.py`.
- **Verification (batched sweeps):** batch A (15 new/changed suites) **106 passed**; batch B (money/exam) **42 passed**; batch C (plugins/billing/auth) **184 passed, 2 skipped**, 2 failures in `test_plugin_registry.py` verified PRE-EXISTING on unmodified HEAD; batch D (25 remaining suites) run separately. `tsc --noEmit` clean; jest 9 suites / 36 tests passing.
- **Audit References:** `docs/MASTER_PLAN_2026-09.md` §3-§8.

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

### [2026-09-04] - Sahayatri→ASchool integration research, plugin dedup audit, platform UX & competitor deep-dives (9 reports)
- **Author/Agent:** ZCode multi-agent research team (9 sequential agents)
- **Rationale:** Owner asked to fold the standalone Sahayatri AI product into ASchool as a plugin, audit all ~51 plugins for duplication, compare against Nepal's dominant platforms (veda-app.com, paathshala.com.np), mine the Ashlya Academy AI codebase, and inventory every web/app surface for missing international-standard UX.
- **Deliverables (all under `audits/research/`):** `SAHAYATRI_SPEC_INVENTORY.md` (120+ AI tools, 7-stage CDC textbook vision-ingestion pipeline, offline whiteboard, token economy), `SAHAYATRI_BACKEND_CODE.md` (323 routes / 38 tables; port patterns: token gate, ingestion state machine, JSON-safe parse, deterministic fallback, live-quiz scoring, whiteboard Redis sync), `SAHAYATRI_CLIENTS_UX.md` (121 tool pages from 20 templates; 12 UX patterns to steal), `ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md` (41/51 plugin folders are empty shells; AI gate split-brain P0; social_ads/social_hub dead; digital_content duplicate; benchmarking N+1 + cross-tenant dump; coming_soon install bypass), `ASCHOOL_CURRENT_STATE.md` (item-id status table, open backlog), `ASCHOOL_WEB_UI_INVENTORY.md` (165 real / 6 partial / 19 stub routes; 15 portal sections "Coming soon"; top-20 UX gaps), `ASCHOOL_MOBILE_APPS_INVENTORY.md` (push silently dead; zero Nepali localization; consolidate to flutter_user + flutter_admin), `ASHLYA_AI_DEEPDIVE.md` (task-class router, credit ledger, reusable extraction/teaching prompts), `COMPETITOR_LANDSCAPE_NEPAL.md` (Veda 1,300+ schools no AI/pricing hidden; Paathshala free-software+RFID model; 25 gaps, 20 wins, NPR pricing rec), and **`UNIFIED_ROADMAP_2026-09.md`** — the phased synthesis: R0 dedup/registry repair → R1 Sahayatri-as-ai_suite surface (catalog factory, chapter-context KB, textbook ingestion, learning-science engines, multimodal tutor, credit layer, offline whiteboard) → R2 portals+mobile → R3 web UX program → R4 Nepal competitive modules → R5 pricing/GTM.

### [2026-09-04] - Research wave 2: ATeacher blueprint, widget-level UI audits, backend completeness sweep → UNIFIED ROADMAP v2 (FINAL)
- **Author/Agent:** ZCode multi-agent research team (4 more sequential agents; 13 reports total in `audits/research/`)
- **Rationale:** Owner decisions after reading wave 1: DROP the Sahayatri whiteboard; INTEGRATE Ashlya Academy's AI Teacher (ATeacher) instead ("far better effective"); verify app/plugins/web/backend completeness; widget-level UI audit of every frontend screen; then generate the final plan and start implementation with end-to-end tests.
- **New reports:** `ATEACHER_INTEGRATION_BLUEPRINT.md` (1,540 lines — every ATeacher file read: board grammar spec, teaching flow, verbatim prompts incl. 5 personas + analyzer + cognitive-load planner, voice pipeline; key finding: ~600 lines of pedagogy are dead code in source and must be wired properly in the port), `ASCHOOL_WEB_WIDGET_AUDIT.md` (21 behavior-free primitives; per-plugin feature→UI mapping; 12 Tier-1 widget roadmap; 25 ranked upgrades), `ASCHOOL_FLUTTER_WIDGET_AUDIT.md` (zero domain widgets in aschool_shared; FileUploadService picks images only; homework = paste-URL; no .arb/Semantics/deep links; 12 shared widgets + 25 upgrades), `ASCHOOL_BACKEND_COMPLETENESS_AUDIT.md` (680 routes ≈92% complete; absent-alert listener has NO consumer; leave approval doesn't write attendance; no transcripts/TDS/refunds-except-Khalti-full/bank-rec; timetable solver is a greedy stub; 15 implemented endpoints with zero UI).
- **Plan:** `UNIFIED_ROADMAP_2026-09.md` **rewritten as v2 (FINAL)** — decision record (AI Teacher replaces whiteboard; flutter_user consolidation; ai_suite single gate; delete dead plugins), 13-report findings digest, per-plugin completeness matrix, and phases W0 repair → W1 web design system → W2 portals/mobile → W3 AI Teacher P1–P5 → W4 ai_suite surface → W5 Nepal modules → W6 pricing, each with an end-to-end gate. Implementation starts at W0.
