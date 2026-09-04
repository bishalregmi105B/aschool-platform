# ASCHOOL — CURRENT STATE REPORT
**Compiled:** 2026-09-04 · Sources: `README.md`, `docs/MASTER_PLAN_2026-09.md`, `docs/AI_TEACHING_ECOSYSTEM_PROMPT_2026-09.md`, `docs/plugin-development.md`, `docs/deployment.md`, `audits/AUDIT_INDEX.md`, `audits/IMPLEMENTATION_AUDIT_2026-09-04.md`, `audits/REMAINING_BACKLOG_2026-08-30.md`, `audits/PRODUCTION_SCORECARD_2026-08-30.md`, `backend/audits/ai_redteam/known_failure_modes.md`, `AI_CODING_GUIDE.md`, `.cursorrules`, `git log`.

Purpose: ground-truth for a NEW planning round — do not re-propose what is already built.

---

## 1. WHAT ASCHOOL IS

**Multi-tenant SaaS "school operating system" for Nepal** (codename brighternepal.com / aschool.com.np), plugin-based:

- **Architecture:** Nginx reverse proxy → Next.js 14 (215–222 pages dashboard + per-school SSR/ISR websites at `{slug}` subdomains) and Flask 3 API (~60 route blueprints / 560–680 routes, 146–161 models); PostgreSQL 16 + pgvector, Redis 7, Celery workers/beat, Socket.IO, Firebase RTDB for bus GPS.
- **Mobile:** 5 Flutter apps (admin/teacher/parent/student/user unified-entry) sharing one `aschool_shared` package; ESP32+NEO-6M+SIM800L bus hardware (~Rs 2,500/bus).
- **Tenancy:** request resolves tenant (subdomain slug → `X-School-Slug` header → JWT claim) into `g.school_id`; queries via `BaseModel.for_school()`; cross-tenant probes 403 (regression-tested, S-01). Multi-branch supported via partial unique indexes.
- **Personas:** superadmin (platform), school_admin, teacher, student, parent; plus district/palika tier designed (not built).
- **Plugin/marketplace business model:** filesystem-as-catalog manifests (59; 55 published after dedupe), per-school `SchoolPlugin` rows, 300 s Redis gate cache, 14-day/7-day trials, eSewa/Khalti/FonePay/Stripe with refunds + idempotency. Plugin categories: **core (free), starter Rs 199–399/mo, growth Rs 199–799/mo, premium Rs 999–2,999/mo**. School plans free/starter/growth-pro/enterprise. AI bundle `ai_suite` = NPR 399/mo (decided 2026-09-03); 4 AI workbench tools free teaser (lesson_plan, differentiation, study_guide, flashcards).
- **Deployment:** docker-compose.prod.yml (nginx + flower included), CI/CD `.github/workflows/deploy.yml` (tests → ghcr images → SSH deploy). TLS: `nginx/nginx.tls.conf` (443/HSTS/TLS1.2-1.3/OCSP/421 catch-all/wildcard school vhosts) + Cloudflare Full (strict); certs must be mounted at `./nginx/ssl` **at deploy time by an operator**. Not yet launched to production.
- **Nepal-specific:** Bikram Sambat calendar (`nepali-datetime`), NEB grading (THFM/THPM/PRFM/PRPM, component-fail, GPA), NPR + Devanagari numerals, eSewa/Khalti/FonePay, IRD PAN/VAT receipts, Sparrow SMS + optional WhatsApp Cloud, IEMIS import/export + EMIS fields, bus GPS, Nepali sidebar labels (`label_nepali`), 14 Nepali school templates + BS 2083 calendars in designer.

**Status headline (README + audits):** deep and substantially functional; NOT launched. Prod deploy config exists but needs an operator; GPS hardware loop wired but unproven against live devices; web role portals still "Coming soon" stubs.

---

## 2. MASTER-PLAN ITEM STATUS TABLE

Primary source: `audits/IMPLEMENTATION_AUDIT_2026-09-04.md` (4-agent verdict, commits 097e39c→e3d5589), **updated by the two post-audit waves** recorded in `audits/AUDIT_INDEX.md` and git (`3e55438` final backlog wave; `0475b7b` closing wave: red-team PASS, S-10 TLS, W-02 draft/live, D-03 timestamptz). Migration chain: 44+ revisions, single head; verified from scratch with clean down/up.

### Phase 0 — Security / money / data (S-xx, D-01/02)
| ID | Title | Status |
|---|---|---|
| S-01 | Tenant isolation on X-School-Slug/subdomain/JWT | **done** (403 all 3 paths, 7 tests) |
| S-02 | Anchor CORS/CSRF origin regex | **done** (5 tests) |
| S-03 | Secrets + prod validation | **done** (11 tests; ≥32 chars, rejects .env.example values) |
| S-04 | Cookie Secure + CSRF posture | **done** (ENV-aware Secure flag) |
| S-05 | Token revocation fail-closed | **done** (7 tests) |
| S-06 | OTP hardening | **done** (secrets.choice, attempt lock, constant-time) |
| S-07 | Socket.IO connect auth | **done** (7 tests, Flask-SocketIO 5.5.1) |
| S-08 | Rate limiting + ProxyFix | **done** (4 tests; closing wave added nginx Cloudflare real-IP restore) |
| S-09 | Delete lying domain-verify stub | **done** (delegates to real white-label DNS verify) |
| S-10 | TLS | **done in code** (nginx.tls.conf + CSP headers); **operational remainder: certs at deploy** |
| S-11 | customizations.colors XSS | **done** (9 tests, defense in depth) |
| S-12 | Publish/serve authz on website | **done** (4 tests) |
| S-13 | Payment/refund correctness | **done** (enum, FeeRefund ledger, webhook math, Stripe replay guard) |
| S-14 | Repo hygiene | **done in git**; note: two vendored PHP ERP dirs (`Mighty School Pro v1.6`, `eSchool SaaS v1.8.0 Nulled`) still exist **on disk** (untracked) — plan said delete |
| D-01 | Live data-integrity migrations | **done** (scholarships table, revisions.is_deleted, qr_pay, faq/hostel imports; initial migration repaired) |
| D-02 | Uniqueness constraints + receipt counters | **done** (partial UQs, `school_receipt_counters` FOR UPDATE, 409 on dup marks) |

### Phase 0.5 — Business logic (B-xx)
| ID | Title | Status |
|---|---|---|
| B-01 | Marks-over-full validation | **done** |
| B-02 | Concurrent marks dedupe | **done** (D-02 constraint + 409) |
| B-03 | Broadcast 500-cap | **done** (unbounded) |
| B-04 | Library checkout race | **done** (FOR UPDATE) |
| B-05 | Competition ranks (1,1,3) | **done** |
| B-06 | Payroll tax structure | **open — deferred by plan to N-07** |

### Phase 1 — Data & platform (D-xx, P-xx, F-xx)
| ID | Title | Status |
|---|---|---|
| D-03 | Timestamps → TIMESTAMPTZ | **done** (closing wave: 418 naive columns converted, migration `b2e7c4a9f1d3`; TZ=Asia/Kathmandu in compose) |
| D-04 | Indexes (FK/composite/hot-path) | **done** (215 created + 10 composites) |
| D-05 | academic_year_id rollout | **partial** — expand phase done (4 tables + backfill); NOT-NULL contract phase **deliberately deferred** |
| D-06 | Normalize money JSONBs (`fee_structure_items`, `class_subjects`, money.py) | **done in final wave** (Decimal money.py + ClassSubject/SectionSubjectTeacher/FeeStructureItem models, migration `e5b2d8f4a7c1`); full float()-sweep of old fee/payroll code **unclear** |
| D-07 | Audit trail | **mostly done** (before_flush ledger, nullable school, TOTP sealed both ways); **remaining: `marks_history` + `user_mfa` tables** |
| P-01 | Celery queues/locks/idempotency | **mostly done** (task_routes, 7 locks, reminder dedupe 72h, beat volume-mount, acks_late, time limits); **remaining: reminder_log table, GPS retention task** |
| P-02 | Backups/DR | **partial** — pg_dump in image, honest last_backup_at, superadmin-only trigger; **remaining: dump encryption, uploads R2 sync, restore drill (quarterly operator task)** |
| P-03 | Deploy pipeline ordering | **done** (final wave: migrate before swap, /ready health gate, rollback record, no git reset --hard) |
| P-04 | Observability | **partial** — JSON logs + X-Request-ID middleware done (final wave); **remaining: Prometheus /metrics, Sentry alerts** |
| P-05 | Entitlement & billing repair | **partial** — B1 (self-register enterprise → free) and B3 (subscribe gateway verification) fixed in final wave; **remaining: reconcile_plan_plugins (B5), trial-consumed flag (B9), max_students (B11), SMS credits (B12), gate sweep H1-H7, authz sweep (51 bare endpoints, 204 object-level checks, 83 role lists), plugin-cache dedupe, elibrary→ai_suite gate repoint (verify)** |
| P-06 | Frontend shared layer | **partial** — error boundaries/loading done; **remaining: DataTable/QueryBoundary/hooks factory, dark-mode wiring, a11y sweep, cmdk palette, perf pass, broken nav links** |
| F-01 | Role portals ("Coming soon" wall) | **open** — 15 stub routes, fake student dashboard, fake roles page, dead demo form still to build |
| F-02 | i18n (Nepali-first) | **open** (only the `label_nepali` sidebar win landed, credited as N-01 in the audit) |

### Phase 2 — AI platform (A-xx)
| ID | Title | Status |
|---|---|---|
| A-01 | AITokenHub v2 | **mostly done & LIVE-verified** — timeouts, retries+jitter, circuit breaker, cost columns + price sheet, env models, embed, transcribe, structured output helper, prompt hashes, **atomic Redis cost reservation** (final wave); **remaining: per-user quotas, dedicated usage session** |
| A-02 | Prompt library + evals | **partial** — temperature discipline (0.2/0.4) done, en+ne prompt files, golden-set skeleton + planning/assessment/communication cases; **remaining: frontmatter/versioning, full ~9 category sets, nightly CI eval run** |
| A-03 | Question bank + paper generator v2 | **mostly done, LIVE-verified** (models, bank-first pipeline, CRUD/approve routes, blueprint marks-sum validation); **remaining: designer question_paper PDF + OMR templates, frontend blueprint-builder UI rewrite, delete cheap-gated duplicate endpoint** |
| A-04 | Curriculum model | **done** (frameworks→units→outcomes + SubjectOffering; CDC/NEB platform seed, 50 frameworks) |
| A-05 | RAG (pgvector) | **done** (document_chunks HNSW+tsvector, hybrid RRF, tenant-scoped, embed()); **remaining: drop legacy students.embedding column** |
| A-06 | AI grading v2 + honesty | **partial** — honest fallback labeling done (designer `_default_variation` labeled); **remaining: Rubric/RubricCriterion model, decision persistence, prompt-injection guard on grading, 4 broken UI contracts, delete/wire 9 orphan services, timetable_solver honesty** |
| A-07 | AI transparency + metering | **partial** — enforced Nutrition-Facts schema + page data done; **remaining: metered credits w/ hard stop, superadmin cost dashboard, guardian transcripts** |

### Phase 2b — AI ecosystem (AW-xx)
| ID | Title | Status |
|---|---|---|
| AW-01 | Registry + orchestrator | **done** (generic `POST /ai/generate/<tool_key>`, fixture-test tool proves zero-route extension, 11 tests; live fix: output schema embedded in system prompt) |
| AW-02 | Ecosystem data model (14 tables) | **mostly done**; **remaining: CurriculumTopic table, mastery_records extension, ai_generation_id FKs on feature tables** |
| AW-03 | Seed tools | **done** — 10 tools seeded (4 free teaser + 5 ai_suite + fixture_test), en+ne prompts, Nutrition Facts on ga tools |
| AW-04 | Guardrails + safety | **done** (injection classifier, pseudonymization, guardian consent checked on EVERY tool, moderation escalation to existing wellbeing path; audit-fixed consent bypass) |
| AW-05 | Content library + overrides | **done** (library CRUD with visibility tiers, per-tool kill switch 403); school/district field-overrides/prompt-suffix **admin UI unclear** |
| AW-06 | Tutor engine | **done** — Socratic state machine, exam-mode deflection, reflection, teacher routes; LIVE-verified; **red-team PASS (closing wave: 13 live adversarial cases, all pass — injection, exam-bypass incl. Spanish, persona jailbreaks, extraction, PII, self-harm escalation)**; report: `backend/audits/ai_redteam/known_failure_modes.md`; 3 tutor bugs found+fixed (role mapping, transient id, off-JSON fails safe) |
| AW-07 | IEP drafter | **done** (final wave: drafter + reviewer gate principal/special_ed/can_review_iep, evidence citation, human_review_required hard-true) |
| AW-08 | Capture tools | **partial** — voice two-stage (whisper) done, LIVE-verified; **photo→data is an honest 501 until vision/OCR provider keys** (founder decision: Google/Azure cloud, via AITokenHub new provider kinds) |
| AW-09 | PD coach | **partial** — UNESCO seed + framework/progress routes done (startup-wired); **student AI-literacy micro-lessons missing** |
| AW-10 | Delivery-time tools | **done** (ephemeral live polls, aggregate-only) |
| AW-11 | Standards exports | **mostly done** (QTI 3.0 export + Caliper emission wired into AIGeneration persist); **remaining: LTI 1.3 OIDC-launch stub** |
| AW-12 | Frontend/mobile surfaces | **partial** — `/dashboard/ai-workbench` (catalog, ToolRunner, Nutrition card, CostEstimateChip, provenance) done; **remaining: /student/ai-workbench, /parent/ai-transparency, `<AIQuickAction>` in-workflow embedding, mobile shared feature folder** |

### Phase 3 — Website (W-xx)
| ID | Title | Status |
|---|---|---|
| W-01 | Renderer seams | **done** (CTAs real links, name??title, hero height, navbar from published pages, iframe allowlist) |
| W-02 | Builder capabilities | **partial→mostly done** (closing wave: draft_config autosave, publish-draft, history(10)/revert/restore endpoints, editor Publish button; draft saves no longer purge live cache); **remaining/unclear: undo/redo, mobile preview, menu builder, media library wiring, per-page SEO UI, transactional template apply** |
| W-03 | SEO/analytics/i18n + section types | **partial** — sitemap.ts/robots.ts, JSON-LD real script, canonical+twitter, GA/FB pixel rendered (final wave); **remaining: public-site i18n (title_nepali etc.), Devanagari theme fonts, missing section types (rich-text block, downloads, events, FAQ…), nginx cache purge vs unpublish** |
| W-04 | Contact inbox + school profile fields | **done** (final wave: ContactMessage model + unread-first routes + migration `f9b4e1c6d2a8`, school profile fields, notices payload Nepali + attachments); dashboard inbox **page UI** not explicitly confirmed |

### Phase 4 — Designer/Writer + Flutter (G-xx, M-xx)
| ID | Title | Status |
|---|---|---|
| G-01 | Designer P0s | **unclear/partial** — NOT covered by the 2026-09-04 audit. Much delivered Aug 30–Sep 2 (server PDF pipeline, PPTX/SVG export, canvas overhaul, TipTap writer v2, DOCX ribbon, pagination fixes); specific P0s (toObject(CUSTOM_PROPS), bulk impose, symbol_number column, writer2 PDF routing) **not re-verified** |
| G-02 | Nepal templates | **largely delivered** — 14 Nepali school templates, BS 2083 calendars (monthly/wall/dual-month), hiring poster; exam-paper/OMR/transcript/IRD-series templates remain (tied to A-03/N-03) |
| M-01 | Flutter P0s | **partial/unclear** — not audited 2026-09-04. Done since: release-signing Gradle repair (4 apps), INTERNET permissions, browser queries, signing fix. **Remaining per plan: key.properties from secrets (are APKs still debug-signed?), icons/splash (all 5 default Flutter icons), offline attendance + outbox (drift), 18 endpoint mismatches, push dead end-to-end (NotificationService.init never called), auth logout flows, deep links/assetlinks, web↔mobile parity** — see `audits/research/ASCHOOL_MOBILE_APPS_INVENTORY.md` (fresh 2026-09-04) |
| M-02 | (implied in M-01 milestones) | see M-01 |

### Phase 5 — Nepal moat (N-xx)
Note: the implementation waves used "N-01" for the Nepali sidebar labels (a master-plan F-02 sub-item) and "N-02" for NEB grading dedup. The **plan's** N-01/N-02 below are the full engines.
| ID | Title | Status |
|---|---|---|
| N-01 | IEMIS Readiness Engine | **open** (only `label_nepali` sidebar + EMIS disability/mother-tongue field exposure landed earlier) |
| N-02 | NEB/SEE Assessment Engine | **partial** — nepal_grading math verified; bulk-generator duplicate scale fixed to shared util; **per-school scheme_grades wiring, board registrations, grace marks, re-sits, OCE export w/ sign-off, supplementary exams: open** |
| N-03 | Certificate registry | **open** |
| N-04 | Fee Compliance Guardrail | **partial** — final wave added 14 permitted-heading constants (2072 directive) + Nepali-keyword classifier; **remaining: cap hard-checks, per-grade approval storage, inspection pack, refund register** |
| N-05 | Fee ledger v2 (installments, late-fee rules, concessions, sponsors, refunds/deposits) | **open** (FeeRefund exists from S-13) |
| N-06 | BS-native temporal core (single BS source, Flutter BS pickers) | **open** |
| N-07 | Staff profiles (real staff.py; payroll tax) | **open** |
| N-08 | Messaging channels (Messenger/Viber adapters, SMS fixes) | **open** (WhatsApp exists) |

### Plugin architecture completion (plan §10)
Mostly **open**: registration API simplification partially addressed by the WordPress-style filesystem-catalog work (`ce9996f`); scoped hooks w/ `deactivate`, plugin migrations, capability system, settings enforcement (`config_schema.yaml` never enforced), events graph, marketplace ratings/checkout/dependencies — **open/unclear**.

### Phase 6 — Innovation roadmap
All **open by design** (sequenced M7+): IRT/psychometrics, MCP server, founder multi-school console, palika/district tier, collection-rate intelligence, admissions voice agent, LTI/OneRoster/SSO full builds.

---

## 3. OPEN BACKLOG (everything the docs/audits say is not finished)

**Ranked (IMPLEMENTATION_AUDIT, updated for final waves):**
1. ~~P-03 deploy ordering~~ ✅ done · P-05 remaining: reconcile_plan_plugins, trial-consumed flag, next_billing_date beat, max_students, SMS credits, gate sweep H1-H7, authz sweep (51 bare endpoints, 204 object-level owner checks, 83 missing superadmin roles, analytics routes), plugin-cache single invalidator, verify elibrary(99)→ai_suite(399) repoint.
2. D-06 float-money sweep verification in fees/hr_payroll/webhooks.
3. A-01 per-user quotas + dedicated usage session; A-03 designer PDF/OMR + frontend blueprint UI + duplicate endpoint removal.
4. W-02 residuals (undo/redo, menu builder, media library, per-page SEO UI, transactional template apply); W-03 i18n + missing section types + cache purge; N-03..N-08 (N-04 partial).
5. AW-02 residue (CurriculumTopic, mastery_records extension, ai_generation_id FKs); AW-05 district overrides UI; AW-08 photo OCR (needs provider keys); AW-09 student AI-literacy lessons; AW-11 LTI stub; AW-12 student/parent pages + AIQuickAction + mobile folder.
6. A-02: full golden sets (~9 categories) + nightly CI evals; frontmatter/versioning. ~~AW-06 red-team~~ ✅ PASS.
7. S-10 operational TLS (certs at deploy); D-05 contract phase; D-07 marks_history + user_mfa; P-01 GPS retention + reminder_log; P-02 encryption/uploads sync/restore drill; P-04 /metrics + Sentry; P-06 shared layer + dark mode + a11y + broken nav links; F-01 portals; F-02 i18n; A-06 rubric model + 9 orphan services + 4 UI contracts; A-07 metered credits + cost dashboard + guardian transcripts.

**Operational / launch-blocker items:**
- Operator needed for production deploy: TLS certs (`./nginx/ssl`, Cloudflare Full strict), real secrets ≥32 bytes, SMS prod config.
- **Moderation-review workflow must be staffed before tutor go-live** (founder decision 2 — hard launch blocker, not code).
- Backup restore drill (quarterly); backup retention policy automation; uploads R2 sync; dump encryption.
- Parent-consent/privacy flow for student data before commercial launch (`deployment.md`: Guardian consent, publicity consent, privacy-policy page).
- Student/parent mobile login provisioning (auto login IDs, parent accounts, backfill) — REMAINING_BACKLOG P1 #2.
- Teacher-delete orphan user cleanup; backend file-by-file review slices 1/2/4–7 pending.
- Mobile push dead end-to-end (NotificationService.init never called; notification center unrouted).
- Open product decisions: E22a ai_grading gate (`assignments` vs `ai_grading`), E22b insights dual-gate, E95 landing demo form endpoint, E97 real RBAC editor vs remove fake page, E14 library/library_management double listing, iOS ship-or-remove, A-07 metered-credit pricing.
- GPS hardware loop unproven against live devices; biometric ZKTeco untested with real hardware; R2 prod creds untested.

---

## 4. AI ECOSYSTEM DESIGN (as documented) vs LIVE

**Documented spec** (`AI_TEACHING_ECOSYSTEM_PROMPT_2026-09.md`): one plugin `ai_workbench`, ~65 sub-capabilities; single write path (AITokenHub); generic dispatcher; registry rows not routes.

**Tool catalog (§6, by category — every documented tool):**
- Planning (10): lesson_plan, unit_plan, warmup_hook, discussion_questions, exit_ticket, slide_outline, worksheet, graphic_organizer, field_trip/project_brief, substitute_plan
- Assessment (5): question_bank/paper (A-03), essay grading v2 (A-06), rubric_builder, report_card_remarks, item_analysis/re-teach
- Differentiation (6): reading_level_adapter, EAL/ELL scaffold, iep_draft, dyslexia_reformat, gifted_extension, multi_level_worksheet
- Communication (5): parent_email, newsletter, meeting_notes (conference notetaker), behaviour_note, translation_assistant
- Tutoring/student (12): socratic_tutor, exam_prep_coach, writing_coach, reading_companion, debate_partner, study_guide, flashcards, practice_quiz, concept_explainer, vocabulary_builder, career_coach, ai_literacy_micro_lessons
- Delivery (2): live_poll/quiz, think_pair_share
- Capture (3): voice_entry, photo_to_data, meeting/PD notetaker
- PD (3): pd_coach, content_knowledge_refresher, peer_observation_structurer
- Governance (4): district custom-tool builder, cost dashboard, rollout tracker, kill switch

**Seeded/implemented so far (10 registry tools):** lesson_plan, differentiation, study_guide, flashcards (free teaser) · worksheet, exit_ticket, rubric, parent_email, writing_feedback (ai_suite; schema has NO revised_text) · fixture_test. Plus non-dispatcher surfaces: tutor engine, IEP drafter, voice capture, PD coach, live polls, QTI/Caliper. The other ~55 catalog tools are **not built**.

**Tutor design:** teacher-authored `TutorSessionPlan` container (no plan → no chat); Socratic system prompt; exam-mode deflection; per-turn guardrails; reflection on close; teacher aggregate monitor (poll); no named persona ("AI Study Helper"); sessions persist (audit-fixed).

**Guardrails (AW-04, all live):** input spotlighting + regex injection classifier → AITokenHub → schema validation + 1 repair retry → moderation scan → persist; student-name pseudonymization (server-side map); `GuardianAIConsent` checked on EVERY tool; critical self-harm → ModerationFlag + counselor escalation via existing wellbeing path; narrow `StudentAIProfile` (no behavioural profiling).

**Cost/quota:** per-provider price sheet; cost_usd/cost_npr on usage + AIGeneration; **atomic Redis cost reservation (INCRBY micro-USD, 48h TTL, reconciled post-call)**; `AI_QUOTA_ENFORCEMENT` strict-parsed; CostEstimateChip before generate; fast/quality model tiers; temp 0.2 structured / 0.4 prose. Open: per-user quotas, metered credits/hard stop, cost dashboard.

**Evals/red-team:** golden-set skeleton + offline-safe runner + planning/assessment/communication cases (`backend/tests/ai_evals/`); **red-team DONE: 13 live adversarial cases vs gpt-oss-120b ALL PASS** (injection A1-A3, exam-bypass B1-B3, persona C1-C2, extraction D1-D2, self-harm E1, PII F1-F2), report appended to `backend/audits/ai_redteam/known_failure_modes.md`.

**Moderation/human-review:** ModerationFlag model + queue/resolve routes live; requires_review default true; IEP human_review hard-true. **Staffing the review workflow is an open operational blocker.**

**LIVE-verified (real Groq key, gpt-oss-20b/120b, whisper-large-v3-turbo):** hub fast/smart + JSON, flashcards, lesson plan, differentiation, parent email, paper-v2 generation, designer AI path, homework helper/tutor (deflection + Socratic turns), whisper transcription, red-team suite. Photo capture = honest 501. IEP/library/polls/QTI/Caliper built but not documented as live-verified.

---

## 5. DEFERRED / CUT IDEAS (candidates for next round)

- **Explicitly out of scope v1 (ecosystem §2):** admissions-decision AI; automated proctoring/behavioural exam monitoring; engagement-optimizing gamification of the tutor.
- **B-06 payroll tax** → deferred into N-07.
- **D-05 NOT-NULL contract phase** — deliberately deferred.
- **A-06 follow-ups:** photo/handwritten-work vision ingestion (grading rejects photo-only for now); 9 orphan services deletion decision (attendance_ai, plagiarism, fee_predictor, risk_detector, wellbeing_ai, sentiment, social_ai, translator, content_gen, benchmarking_ai); timetable_solver "make real or rename honestly" decision.
- **AW-08 photo capture** — parked until Google/Azure vision/OCR keys; **AW-11 LTI 1.3** stub only; **MCP server** over school data — sequenced after catalog stable (§12.4); OneRoster export — free after D-06, not built.
- **Phase 6 Tier 3/4:** IRT/psychometrics in exam module; founder/owner multi-school console; collection-rate intelligence; admissions Nepali voice agent; palika/municipality dashboard tier; Google/Microsoft SSO + rostering.
- **W-03 missing section types** (rich-text block, downloads centre, events, video embed, FAQ accordion, image+text, announcement bar, fee table, columns, logo strip, site search); **public-site i18n + Devanagari theme fonts**.
- **F-02 full i18n extraction** (~3,600 strings), Flutter localization; **F-01 portals** (15 stub routes) — deferred, not cut.
- **M-01 iOS** ("ship properly or remove the folder" — undecided); offline outbox pattern for tutor/capture (designed, not built).
- **N-05..N-08** whole Nepal set (fee ledger v2, BS-native core, staff profiles, Messenger/Viber channels).
- **District/palika commercial terms** — founder decision explicitly OPEN (non-blocking).
- **S-14 residual:** two vendored PHP ERP dirs still on disk (untracked).
- **Typst rejected** for PDF pipeline (WeasyPrint stays — Pango shapes Devanagari); batch API for remark runs noted as option.

---

## 6. CONVENTIONS A NEW CONTRIBUTOR MUST FOLLOW

**Process rules (.cursorrules + AI_CODING_GUIDE.md — mandatory):**
1. Read the latest audits (`audits/AUDIT_INDEX.md` + current primary audit) BEFORE modifying backend endpoints, frontend pages, models, or plugin manifests.
2. After every significant change, append a dated entry to `audits/AUDIT_INDEX.md` (Author/Agent, Rationale, Action Taken, Verification, Audit References).
3. Master-plan rule: every work item updates `audits/AUDIT_INDEX.md`; tests are the acceptance criteria.

**Coding rules:**
- Stack: Flask 3/SQLAlchemy 2/Python 3.12; Next.js 14 App Router + TS + Tailwind + TanStack Query + Radix; Flutter 5-app + `aschool_shared`.
- Forest Green theme tokens (Primary `#0e3b2e`, Accent `#c5f4dd`, BG `#f7f5f0`, Ink `#0d1f14`); no default purple/blue.
- Plugin gating: backend `@plugin_required("<slug>")` (+ `@role_required`, `@school_required`); frontend `<PluginGate slug="...">`; always `_invalidate_plugin_cache(school_id)` on plugin state change.
- Response envelope everywhere: `{"success": bool, "data": {}, "error": null, "meta": {}}`.
- Migration rules: single-head Alembic chain; verify `upgrade`/`downgrade` from a scratch DB before merge; TIMESTAMPTZ everywhere; partial unique indexes `WHERE is_deleted = false`; index every FK; `academic_year_id` on year-critical tables; guarded enum creation (`DO $$ CREATE TYPE` + `ENUM(create_type=False)`).
- Verification requirements: every backend fix gets a pytest covering the failure mode (tenant crossers, dup submits, enum, naive/aware datetimes); AI changes assert schema+temperature+fallback and join a golden set; frontend fixes get RTL/jest tests; Celery changes prove queue routing + idempotency (run twice); render one of each artifact (question paper, ID card, report card, Nepali notice) to PDF in CI and `pdffonts`-check Devanagari embedding.
- Do-NOT-rewrite list (plan §12): payment webhook integrity block, biometric ingestion, multi-branch tenancy, `nepal_grading.py` math, `lib/api.ts` refresh, `WhiteLabelService.verify_domain_dns`, honest-fallback pattern, plugin discovery architecture, etc.

**Test invocation (Makefile):**
- Backend: `make test` (pytest; requires live Postgres `aschool_test`; conftest resets schema) · `make test-cov`
- Frontend: `make test-frontend` (jest + RTL incl. security-regression suite)
- Flutter: `make test-flutter` (shared package unit+widget) · All: `make test-all`
- Dev env: `make dev`, `make backend|frontend|worker|beat`, `make upgrade` (alembic), `make seed` / `seed_full.py`
- Infra gotchas: dedicated `TEST_DATABASE_URL` per suite (shared `aschool_test` TRUNCATE-deadlocks under concurrent pytest); `docker restart aschool-celery-worker-1` after task-file edits; `pypdf` must exist in flask container for one receipt test.

**Plugin creation steps (`docs/plugin-development.md`):**
1. `backend/app/plugins/manifests/my_plugin.yaml` (slug, name, name_nepali, category core/starter/growth/premium, price_monthly/yearly, api_blueprint, models_module, depends_on/conflicts_with, frontend sidebar w/ `label_nepali`, flutter feature folders).
2. `backend/app/api/v1/my_plugin.py` — Blueprint with `@jwt_required @plugin_required('my_plugin') @roles_required(...)`.
3. `frontend/app/dashboard/my-plugin/page.tsx` wrapped in `<PluginGate pluginSlug="my_plugin">`.
4. Flutter: `PluginGate(pluginSlug: ..., child: ..., fallback: UpgradePrompt(...))`.
5. Tests: 403 without install, 200 with (`installed_plugin` fixture).
(The WordPress-style filesystem-as-catalog work also allows modules under `app/plugins/modules/`; ai_workbench tools additionally need: one registry row + one prompt file (en+ne) + one handler file, zero routes/pages.)
