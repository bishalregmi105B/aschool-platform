# IMPLEMENTATION AUDIT REPORT — 2026-09-04
## Master plan `docs/MASTER_PLAN_2026-09.md` vs codebase, verified by 4 parallel audit agents

Commits covered: `097e39c` → `e3d5589` (7 implementation commits). Migration chain: **44 revisions, single head `d8a1f4c7b2e9`, verified from scratch with clean down/up cycles.** Live AI verified with a real Groq key retrieved from the Milan deployment server.

---

## PHASE 0 — STOP THE BLEEDING: 12/14 IMPLEMENTED, 2 not (both need infra)

| Item | Status |
|---|---|
| S-01 tenant isolation | ✅ 403 on all 3 resolution paths, 7 tests |
| S-02 CORS anchor | ✅ 5 tests |
| S-03/S-04 secrets + ENV/cookies | ✅ 11 tests |
| S-05 revocation fail-closed | ✅ 7 tests |
| S-06 OTP hardening | ✅ 5 tests |
| S-07 Socket.IO auth | ✅ 7 tests (Flask-SocketIO 5.5.1) |
| S-08 rate limiting + ProxyFix | ✅ 4 tests — **remaining: nginx Cloudflare real-IP config** |
| S-09 domain-verify stub | ✅ (fixed in audit wave) delegates to real white-label DNS verify |
| S-10 TLS | ❌ needs certbot/Origin-CA at deploy time (infra task, no code change possible here) |
| S-11 colors XSS | ✅ 9 tests, backend + frontend defense-in-depth |
| S-12 publish/serve authz | ✅ 4 tests |
| S-13 refund correctness | ✅ 5 tests (enum, FeeRefund ledger, webhook math, Stripe replay guard) |
| S-14 repo hygiene | ✅ (audit wave cleaned the stragglers) |
| D-01/D-02 data migrations | ✅ both, verified up/down |

## PHASE 0.5 — BUSINESS LOGIC: 5/6 IMPLEMENTED
B-01..B-05 ✅ (marks-over-full, 409 on duplicates, no broadcast cap, library row locks, competition ranks). B-06 payroll tax: deferred by the plan itself to N-07.

## PHASE 1 — DATA & PLATFORM: core done, large-scale conversions deferred

| Item | Status |
|---|---|
| D-03 timestamps | ✅ model defaults + 52-site utcnow sweep — **remaining: one TIMESTAMPTZ conversion migration for existing columns + TZ in compose** |
| D-04 indexes | ✅ 215 FK/composite/hot-path indexes — partial `is_deleted` indexes folded into D-02's set |
| D-05 academic_year | ✅ expand phase (4 tables + backfill); contract phase intentionally deferred |
| D-06 money JSONB | ❌ NOT STARTED (fee_structure_items / class_subjects / money.py) |
| D-07 audit trail | ✅ before_flush + set-event ledger + nullable school + TOTP read AND write sealed — remaining: marks_history + user_mfa tables |
| P-01 celery | ✅ queues, locks, dedupe, volume, time limits — remaining: reminder_log table, GPS retention task |
| P-02 backups | ✅ pg_dump + honest last_backup_at — remaining: encryption, /trigger superadmin-only ✅ (fixed), uploads sync, restore drill |
| P-03 deploy pipeline | ❌ ordering still wrong in deploy.yml (migrate AFTER up -d, git reset --hard) |
| P-04 observability | ❌ not started (JSON logs, request-ID, /metrics) |
| P-05 entitlement repair | ❌ not started (B1 self-register enterprise, reconcile_plan_plugins) |
| P-06 frontend shared layer | ❌ error boundaries ✅; DataTable/QueryBoundary/hooks factory not started |
| F-01/F-02 | ❌ portals/i18n not started (F-02's `label_nepali` sidebar win ✅) |

## PHASE 2 — AI PLATFORM: core complete and LIVE-verified

| Item | Status |
|---|---|
| A-01 hub v2 | ✅ timeouts, retries+jitter, circuit breaker, cost columns + price sheet, prompt hashes, env models, embed, transcribe, structured-output helper — **remaining: atomic quota reservation on COST (still tokens), per-user quotas, dedicated usage session** |
| A-02 temps | ✅ zero temperature=1.0 left; en+ne prompt files — remaining: frontmatter/versioning, golden-set evals |
| A-03 question bank v2 | ✅ models+pipeline+routes+tests, LIVE-verified (3 AI MCQs generated with keys, seeded back unapproved) — **remaining: blueprint marks-sum validation, designer PDF/OMR, frontend UI rewrite, kill the cheap-gated duplicate endpoint** |
| A-04 curriculum | ✅ complete + seeded |
| A-05 RAG | ✅ pgvector HNSW+tsvector, hybrid RRF, tenant-scoped — remaining: drop students.embedding legacy column |
| A-06 honesty | ✅ fallback labeling + tests — broader items (rubric model, orphan-service deletion) not started |
| A-07 nutrition | ✅ enforced schema + page data — remaining: metered credits, cost dashboard |

**Live verification (real Groq key from Milan server):** fast reply "pong" (374ms, $0.000005); smart JSON parsed; flashcards/lesson-plan/differentiation/parent-email all through the guardrail pipeline with ledger+analytics rows; paper-v2 AI shortfall; designer AI path; homework helper; whisper transcription. Model catalog updated to Groq 2026 (`gpt-oss-20b/120b`, whisper; llama-3.x retired).

## PHASE 2b — ECOSYSTEM: engine complete, surface partially built

| Item | Status |
|---|---|
| AW-01 orchestrator | ✅ full pipeline order, one dispatcher, fixture tool proves "one row + one prompt + one handler, zero routes" (11 tests) |
| AW-02 data model | ✅ 14 tables — remaining: CurriculumTopic, mastery_records extension, ai_generation_id FKs on feature tables |
| AW-03 seed | ✅ 10 tools, 4 free teaser per founder decision, en+ne prompts, nutrition on ga |
| AW-04 guardrails | ✅ injection, pseudonymization, consent (audit-fixed: students checked on EVERY tool), moderation escalation |
| AW-05 library | ⚠️ settings/kill-switch ✅; content-library CRUD missing |
| AW-06 tutor | ✅ state machine + routes, LIVE-verified (deflection + Socratic turn) — red-team pass still owed before ga (founder blocker) |
| AW-07 IEP | ⚠️ model exists; routes/gate not built |
| AW-08 capture | ✅ voice two-stage (whisper live-verified); photo honest 501 until OCR keys |
| AW-09 PD | ✅ UNESCO seed + routes (startup-wired in audit wave) — AI-literacy lessons missing |
| AW-10 polls | ✅ ephemeral live polls (aggregate-only) |
| AW-11 standards | ✅ QTI export + Caliper emission (audit wave wired it) — LTI stub missing |
| AW-12 frontend | ⚠️ /dashboard/ai-workbench ✅; /student + /parent pages missing |

## PHASE 3/5 — WEBSITE + NEPAL: W-01 done, W-02..W-04 and most of Nepal not started
W-01 renderer seams ✅ (audit wave closed the last `prog.name ?? title` seam). W-02 (draft/live, undo, version history), W-03 (sitemap, JSON-LD script, canonical, i18n), W-04 (contact inbox, school profile fields) ❌. Nepal: N-01 sidebar ✅, N-02 grading ✅; N-03..N-08 ❌.

## CRITICAL BUGS FOUND BY THE AUDIT (all fixed in `e3d5589`)
1. Tutor engine data loss — messages/generations never persisted
2. Self-harm flag referenced unflushed transient id
3. `permissions` (TOTP bag) writable via users API
4. Consent gate bypassable by omitting student_id
5. S-09 lying stub still live (now delegates to real DNS verify)
6. Broken tsbuildinfo gitignore; stray tmp files
7. Caliper never emitted; PD seed never called; backup trigger over-permissive

## REMAINING BACKLOG (ranked)
1. P-03 deploy ordering + P-05 entitlement repair (B1 leak) — money/deploy risk
2. D-06 money normalization — prerequisite for several later items
3. A-01 cost-based atomic quota; A-03 blueprint validation + UI
4. W-02/W-03/W-04 website builds; Nepal N-03..N-08
5. AW-05 library CRUD, AW-07 IEP routes, student/parent pages, LTI stub
6. AW-06 red-team pass (founder launch blocker), tests/ai_evals golden sets
7. S-10 TLS at deploy; nginx real-IP config; TIMESTAMPTZ conversion migration
