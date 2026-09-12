# ASCHOOL AUDIT INDEX

Running ledger of change waves (per `.cursorrules` rule 1). Historical audits
live in `audits_old/`.

## 2026-09-09 — FC Wave 1: Theme A platform hygiene (branch `feat/fc-theme-a-hygiene`)

Plan: `docs/MASTER_PLAN_2026-09-09_FULL_COVERAGE.md` (Theme A).

| ID | What landed | Files |
|---|---|---|
| A-05 | N+1 removal: joinedload on `/library/issues` + `/teacher/library`; joinedload on `/fees/recent` receipts and `/fees/outstanding` collections(+class). Delta-based query-count regression tests | `backend/app/api/v1/library.py`, `backend/app/api/v1/fees.py`, `backend/tests/test_fc_a05_n_plus_one.py` |
| A-06 | Hot-path indexes: `ix_book_issues_school_book`, `ix_book_issues_school_status_due`, `ix_books_school_deleted_title` (migration `fc_a06_idx` + model mirror) | `backend/migrations/versions/fc_a06_library_indexes.py`, `backend/app/models/library.py` |
| A-04 | Library web pages fixed: issues + books tabs now server-paginated (previously only page 1 ever rendered); overdue page uses live `status=overdue` filter instead of fetching all issued issues | `frontend/app/dashboard/library/page.tsx`, `frontend/app/dashboard/library/overdue/page.tsx` |
| A-03 | 11 broken mobile API calls fixed: repoints (health→`/health-records/profiles|immunizations` with field adaptation, admission leads→`inquiries` + `dashboard`, teacher announcements→`/notices` incl. content field, shared notice repo, teacher live-classes `mine=1`); new backend endpoints `GET /visitors/badge/<code>`, `GET /wellbeing/dashboard`, `GET /wellbeing/alerts`, `GET /teacher/wellbeing`, `GET /lms/live-classes`; admin inventory screen rewritten to the real asset model; dead `TransportRepository.getLiveLocation` fails honestly; social-hub screen/route removed (no backend ever existed) | flutter_admin/teacher/shared files, `backend/app/api/v1/{visitor,wellbeing,teacher,lms}.py`, `backend/tests/test_fc_mob_endpoints.py` |
| A-07 | Manifest nav reconciliation: removed subitems pointing at nonexistent pages (ai_teacher history/mastery/content, conferences slots/history); repointed nepal_curriculum nav; surfaced orphan pages (AI Workbench, Certificates, Online Question Bank, Expense Categories, Communications hub pages under SMS). plugin_doctor 49/0/0 | `backend/app/plugins/modules/*/{ai_teacher,conferences,nepal_curriculum,ai_suite,design_studio,exams,hr_payroll,sms_notifications}/manifest.yaml` |
| A-02 | Migration drift gate: `scripts/check_migration_drift.py` (scratch DB → `flask db upgrade` → `compare_metadata` vs models → exit 1 on diff) wired into CI backend job | `backend/scripts/check_migration_drift.py`, `.github/workflows/deploy.yml` |

Deferred in this wave (was A-08/A-09 partially): dropping vestigial columns
(`books.is_available`, `website_themes`, `book_transactions`) and merging the
two incident plugins — both need an expand-then-contract migration cycle and
are scheduled with the Theme B/F waves.

**Verification:** pytest `test_fc_a05_n_plus_one.py` (3), `test_fc_mob_endpoints.py` (4), campus-ops library tests — all green; `flutter analyze` clean on admin/teacher/shared; `tsc --noEmit` clean; drift gate PASS; plugin_doctor 0 errors.

## 2026-09-09 — FC Wave 2: Theme B library rebuild + Theme C consolidation + Theme H widgets (same branch)

Plan: `docs/MASTER_PLAN_2026-09-09_FULL_COVERAGE.md`. **AI workspace (Theme D/E) intentionally excluded from this run per founder instruction.**

| ID | What landed | Files |
|---|---|---|
| B-migration | Library v2 schema: `book_copies` (accession+barcode, per-school unique accession), `book_racks`, `book_reservations` (queue), `book_fines` + `book_fine_payments` ledger, `stocktake_sessions/items`, `book_vendors`/`book_purchase_orders`/`book_po_items`; `book_issues.copy_id+renewal_count`; `books.price/language/min_stock_alert`. Migration `fc_b_lib` matches models exactly (drift gate PASS) | `backend/migrations/versions/fc_b_library_v2.py`, `backend/app/models/library.py`, `backend/app/models/__init__.py` |
| B-api | 25+ endpoints under `/library/*`: copies CRUD + `GET /copies/scan/<code>` (one scan-resolution endpoint for web+mobile), renewal (hold-aware, renewal_limit), mark-lost → replacement fine from `books.price`, holds lifecycle (request→ready→collect/cancel, auto-promotion + auto-serve on return), fines pay/waive, stock-take (open/scan/close/missing-report/auto-fines), vendors + POs + receive-creates-copies, reports (popular/overdue_by_class/fines_collected/dead_stock/collection_stats), public OPAC search+detail (`school_slug` resolved, no auth) | `backend/app/api/v1/library.py` |
| B-fixes | `return_book` now writes ledger fines (fine_paid was unreachable) + hands returned copies to waiting holds; issue flow draws from physical copies; **`/student/library/request` persists a real reservation** (was a fake `{"requested":true}` — student_app.py:455); `/student/library` returns holds + outstanding fines + search | `backend/app/api/v1/student_app.py` |
| B-web | Library hub: KPI cards + quick links; NEW pages: reservations queue, fines ledger (pay/waive dialog), stock-take wizard (scan/close/auto-fine), reports (5 reports); checkout desk: barcode-first ScanPanel + Renew action; student portal OPAC: search, holds w/ queue position, fines notice | `frontend/app/dashboard/library/*`, `frontend/app/student/library/page.tsx` |
| B-widgets | `library_management/widgets.yaml`: library_circulation_stats (dashboard.main) + library_overdue (dashboard.wide) | backend/widgets.yaml |
| C-01 | `settings/website-design` → redirect to `/dashboard/website-builder` (3rd overlapping surface removed); settings link repointed | `frontend/app/dashboard/settings/website-design/page.tsx` |
| C-03 | Editor draft controls: **Revert draft** + **History panel (restore)** wired to existing W-02 endpoints (`revert-draft`, `/history`, `/history/<i>/restore`) — previously backend-only | `frontend/app/dashboard/website-builder/editor/page.tsx` |
| H-1 | YAML-only dashboard widgets: notices (`recent_notices`, `upcoming_events`), ai_suite (`at_risk_students` via `/ai-tools/insights/risk-alerts`) — closes the "notices/events/at-risk missing from admin home" gap with zero frontend deploy | `backend/app/plugins/modules/{notices,ai_suite}/widgets.yaml` |

**Deferred (honest):** C-02 renderer merge (`SectionRenderer` 1019L vs `EditorSectionRenderer` 875L — the editor one is the superset; needs a dedicated session + visual regression), C-04 dynamic-first auto pages (`/notices/<slug>` etc.), C-06 bilingual page variants, A-08 column drops (expand-then-contract), incident-plugin merge (A-09).

**Verification:** `test_fc_b_library_v2.py` 13/13 green (incl. fake-request regression + hold queue lifecycle + availability math); plugin_doctor 49/0/0; widget YAMLs parse; drift gate PASS; `tsc --noEmit` clean; jest 47/47.

## 2026-09-10 — Full-platform exploration + Master Plan v2 (planning only, no code changes)

Deliverable: `docs/MASTER_PLAN_2026-09-10_FULL_PLATFORM_V2.md` — new platform-wide plan built from
7 exploration waves (competitive web research; backend census ~756 endpoints; web frontend census
216 dashboard pages + 9 file-URL anti-patterns; Flutter 5-app census; plugin manifest↔frontend
cross-check of 50 plugins; AI content architecture + `nepal_textbooks` corpus map (656 files/2.2 GB,
Nepali sidecars Preeti-mojibake); website-builder + onboarding deep dive).

Key findings logged as the Sprint-0 defect backlog (plan Part 2, B-01..B-28), notably:
widget spec contract bugs in fc-h widgets (bare keys render literal field names — B-01/B-02),
`fees.mobile_fee_card` → nonexistent `/parent-app/fees/summary` (B-04; corroborated by
`test_plugin_widgets.py::test_every_api_widget_points_at_its_own_plugin_domain` failing in the
2026-09-10 full-suite run), teacher `/teacher/portfolios` 404 (B-05), stale shared FeeRepository
endpoints (B-06), missing `/student/classmates` (B-07), wrong `elibrary` gates on design-studio AI
routes (B-10), missing public `/website/.../news` route (B-11), `coming_soon` hiding 3 built
plugins (B-16), events-manifest vocabulary mostly fictional vs runtime bus (P-F), ~15 orphan pages,
RAG service complete but with zero retrieval call sites, curriculum seed synthetic w/ zero outcomes.

**AI workspace (P-D content spine: content_sources/units/chunks, 8-stage ingestion with Preeti→Unicode,
question-bank extensions, paper model sets) is DESIGNED in the plan but GATED — founder approval
required before any implementation (S12–S14).**

Test-suite note (same date, background full run, not waited on per founder instruction):
9 failed / 655 passed / 2 skipped in 1h58m. 1 failure = fc-h widget contract (B-04, fixed in S0).
8 failures (`test_socket_auth` ×7, `test_password_reset` ×1) untouched by recent waves — queued for
S0 triage (smells environmental: socket test client/redis in CI env).

## 2026-09-10 — FC Sprint 0: defect sweep from Master Plan v2 (branch `feat/fc-theme-a-hygiene`)

Plan: `docs/MASTER_PLAN_2026-09-10_FULL_PLATFORM_V2.md` (Part 2 backlog, Sprint 0). No AI-workspace
(P-D/S12-14) work — still gated on founder approval.

| ID | What landed | Files |
|---|---|---|
| B-01/B-02 | Widget specs fixed to the `$`-token dialect (ai_suite at-risk list, notices lists, library stat-group reshaped stats→items); ListWidget now honors `spec.limit`; empty states moved to `states.empty` | `modules/{ai_suite,notices,library_management}/widgets.yaml`, `frontend/components/plugin-widgets/renderers.tsx`, `frontend/lib/plugin-widgets/types.ts` |
| Contract | Two new contract guards: every widget endpoint must match a real Flask route (B-04 regression class) and list/stat spec values must be `$`-tokens (B-01 class); domain allowlist extended with role-scoped `/parent|student|teacher` prefixes and ai_suite's owned `ai-tools` surface | `backend/tests/test_plugin_widgets.py` |
| B-03 | Exam detail page `/dashboard/exams/[id]` (marks window, subjects, client-side result summary, top performers) — fixes `exams.upcoming_exams` widget row 404s | `frontend/app/dashboard/exams/[id]/page.tsx` |
| B-04 | `GET /parent/fees/summary` added (ward-scoped due/paid totals); `fees.mobile_fee_card` repointed off the dead `/parent-app/fees/summary` | `backend/app/api/v1/parent_app.py`, `modules/fees/widgets.yaml` |
| B-05 | `GET /teacher/portfolios` aggregate (class-scoped for teachers, whole school for admins) — teacher-app screen no longer 404s | `backend/app/api/v1/teacher.py` |
| B-07 | `GET /student/classmates` (own class+section only) — replaces the roster-leaking `/students?per_page=100` workaround (app switch lands in S9) | `backend/app/api/v1/student_app.py` |
| B-06 | Shared FeeRepository repointed to real contracts: `/student/fees`, `/fees/collections/<id>/pay` (idempotent), `/fees/collections?student_id=`, flat `/fees/initiate-payment` with `fee_ids` | `aschool_shared/lib/repositories/fee_repository.dart` |
| B-09 | `GET /dismissal/summary` added (enrolled/dismissed-today/pending/class breakdown); admin emergency screen repointed `/emergency/evacuation-plans` → `/emergency/plans` | `backend/app/api/v1/dismissal.py`, `flutter_admin/.../emergency_screen.dart` |
| B-10 | Design-studio AI routes gated `ai_suite` (were `elibrary`) | `backend/app/api/v1/design_studio.py` |
| B-11 | Public news feed: `GET /website/public/<slug>/news` + `/news/<id>` (published notices as articles; drafts/garbage 404) — public news pages were fetching a dead route | `backend/app/api/v1/website.py` |
| B-12 | `seed_pd_framework` no longer double-writes document chunks; missing rows are embedded in place via UPDATE | `backend/app/services/ai/extensions.py` |
| B-13 | Runtime listener renamed `iemis.imported` → `iemis.import_completed` (matches the actual emit) | `backend/app/plugins/listeners.py` |
| B-15 | nepal_curriculum: own nav route `/dashboard/teaching-content` (new compact section/versions manager page); cross-plugin subitems removed | `modules/nepal_curriculum/manifest.yaml`, `frontend/app/dashboard/teaching-content/page.tsx` |
| B-16 | conferences / gps_tracking / whatsapp_bot unhidden (`coming_soon: false`) — all three are built end-to-end | 3 manifests |
| N-02 | 18 self-duplicating nav subitems removed (parent route listed as its own first child) | 18 manifest files |
| B-18 | ai-tools catalog `meeting-minutes` deduped | `frontend/app/dashboard/ai-tools/page.tsx` |
| B-27 | Push sends now log `PushNotification` rows (best-effort, never breaks delivery) — OneSignal path wrote nothing before | `backend/app/tasks/push_notifications.py` |
| B-28 | 12 `withOpacity` → `withValues` in admin/parent; admin router errorBuilder added | 4 flutter screens + `flutter_admin/lib/router.dart` |
| Triage | socket_auth ×7 pass standalone (full-run failures were environmental — aschool-postgres container exited mid-suite). password_reset full-flow fixed: fresh `create_app()` defaulted to dev config/DB 5432 → now `create_app("testing")` | `backend/tests/test_password_reset.py` |
| Tests | `tests/test_fc_s0_defects.py`: 6 regression tests (classmates scoping, portfolio scoping+counts, fees summary math, dismissal rollup, public news feed+article+draft-404, admin portfolios) | new file |

Deferred from S0: B-20 (`/website-builder/sections/available` dead vocabulary — removal belongs to the P-C W-07 sweep), B-08 (gallery repo verified clean; album upload UX is F-14), student-app classmates switch (S9 M-C2).

**Verification:** targeted backend suites 56/56 (plugin widgets 20, plugin contract 10, S0 6, fc_mob 4, fc_b 13, fc_a05 3); drift gate PASS 0/455 allowlisted (scratch on 5435 — note: script's local default port 5433 now collides with aacademy-postgres); `tsc --noEmit` clean; jest 47/47; `flutter analyze` 0 errors (admin 12 warnings → 8 after sweep, parent 13 → 8, shared 0, student 12 pre-existing); aschool_shared tests 49/49.

## 2026-09-10 — AI Workspace: final architecture re-research + extraction prompt pack (planning only)

Founder redirect: NO scripted ingestion — extraction intelligence moves into a human-operated
vision-LLM flow; code only validates and stores. Two fresh research waves (Devanagari OCR-VLM
benchmark arXiv 2606.29213; Nepali RAG studies 2606.07523/2603.13320; Anthropic contextual retrieval;
title-chain chunking 2608.00824; HippoRAG 2; KAQG; EduGuard; live vendor pricing) drove the final
architecture. Deliverables:

- `docs/AI_WORKSPACE_FINAL_PLAN_2026-09-10.md` — supersedes P-D's ingestion portion: Gemini Flash
  extraction (GPT/olmOCR ruled out on Devanagari evidence), 3-layer verification (deterministic guards
  + self-reread + Claude judge, Mistral OCR 4 anchor), 200-DPI page images only (never the mojibake
  PDF), structure-first chunking with title-chain + contextualizer, BGE-M3 dense+sparse with BM25 as
  first-class Nepali leg, bge-reranker-v2-m3, outcome DAG + HippoRAG-lite (no GraphRAG),
  blueprint-cell-bound question engine, golden-set eval gates, per-tool context packs,
  ~$1.7–2.5k one-time corpus cost, S12–S14 execution.
- `docs/ai_workspace_prompts/EXTRACTION_PROMPT_PACK.md` (prompt_version v1.0) — operator runbook +
  universal preamble + PROMPT A (structure map), B (per-page extraction, verbatim discipline,
  bbox grounding, exercise continuity), C (self-verification), D (cross-model judge), JSON contracts,
  storage contract, prompt-version policy.

No code changes. S12 (spine migration + thin loader + review queue + golden-set scaffold) awaits
founder go; founder starts extracting pilot books (Grade 10 Science + Math) with the prompt pack meanwhile.

## 2026-09-10 — AI Workspace v2: agent-operated ingestion + question-paper archive (planning only)

Founder redirect v2: operator = **Claude Code / Gemini Code** (agentic CLI), DB stores **full
verbatim text** (not image URLs), printed question papers/model sets must be **fully organized**
(question numbers, groups, marks, sub-parts, answers, spec grids). Deliverables:

- `docs/ai_workspace_prompts/AGENT_INGESTION_BRIEF.md` (v2.0) — the master task brief for the agent:
  per-book workflow (register→render→extract→self-verify→guards→audit→ingest→ledger), book-kind
  routing, `aw-question-paper@1` + `aw-spec-grid@1` contracts reprinting papers 1:1, teacher-guide
  conventions, verification protocol, Devanagari sample self-check, scale order, definition of done.
- `docs/AI_WORKSPACE_FINAL_PLAN_2026-09-10.md` updated: pipeline v2 (agent-operated), new
  `question_papers` + `paper_questions` archive schema (immutable verbatim layer feeding
  `question_bank_items`; spec grids materialize `paper_blueprints`), S12 now builds `content_loader`
  CLI + paper tables; agent pilot on Grade 10 Science + Math.

No code changes. S12 build (loader + tables + review queue + eval scaffold) awaits founder go.

## 2026-09-11 — FINAL AI-first platform plan (deepest research round; planning only)

4 more research waves (AI design/writer landscape: Canva Magic Studio/Bulk Create, Express
text-to-template, Beautiful.ai rules engine, Figma object model, Portant/DocsAutomator variable-data,
PosterLLaVA/VASCAR, Devanagari CTL+print; AI-in-education mobile: Doubtnut/QANDA/Photomath/Brainly,
Khanmigo safety model, Duolingo voice gating, Gemini Nano/AICore, MagicSchool/Brisk/Eklavvya,
WhatsApp-first, Nepal DPDP/Privacy-Act context) + 2 internal deep-dives (designer/writer internals
G1-G20 with file paths; AI workspace internals: 41-tool registry audit — grounding unenforced,
prompt files dead, attendance context builder missing, consent scope ignored, citations never
written, legacy/mobile stack bypassing safety).

Deliverable: `docs/FINAL_AI_PLATFORM_PLAN_2026-09-11.md` — Part I AI workspace (governance fixes
G-01..G-12, tool-fleet 3 waves, tutor deep spec incl. photo→solve + Socratic assignment lock,
question engine end-to-end, AI-Teacher completion, adaptive, voice/capture, safety spine);
Part II AI Designer/Writer (D1 Nepali print correctness → D2 print-shop completeness → D3 AI leaps:
text-to-design with VASCAR self-correction, paper→print loop, curriculum-RAG research panel);
Part III AI per mobile role (Nepali-medium doubt solving = verified white space; parent NL-over-own-
child; admin NL-over-SIS); Part IV AI delta per plugin; Part V waves S12–S20 + gates + costs.
No code changes.

## 2026-09-11 — S12: AI foundation (branch `feat/s12-ai-foundation`)

Plan: `docs/FINAL_AI_PLATFORM_PLAN_2026-09-11.md` Part I.1 + I.2 (S12 row).

| ID | What landed | Files |
|---|---|---|
| G-01 | Workbench `_system_prompt` loads the seeded bilingual prompt files (`app/prompts/<schema>_<lang>.md`) — registry `prompt_file` was written and never read | `app/services/ai/workbench.py` |
| G-02 | `grounding="required"` enforced: empty context pack ⇒ 422 (the 7 "required" tools could run ungrounded) | `workbench.py` |
| G-03 | `context_attendance` builder added — attendance_outreach previously ran on zero data despite "required" (declared context_builder="attendance" with no implementation) | `app/services/ai/tool_handlers.py` |
| G-04 | GuardianAIConsent **scope** enforced (tutor\|tools\|all) at workbench + tutor gates; legacy NULL scope honored | `workbench.py`, `api/v1/ai_tutor.py` |
| G-05 | `AIGeneration.output_tokens` + `citations` persisted (context builders may attach `_citations`; hub returns `output_tokens`) | `workbench.py`, `services/ai/token_hub.py` |
| G-06 | Moderation emits `violence` (high) + `pii` (medium) categories — previously unreachable, downstream checks were dead code; non-critical flags persist without blocking | `workbench.py` |
| G-08 | `/ai-tools/remarks` pseudonymizes student name before the prompt, de-pseudonymizes in response | `api/v1/ai_tools.py` |
| G-09 | `SchoolAIToolSettings.field_overrides` applied as payload defaults; **request parameters (subject/grade/topic…) now actually reach the model** — only free-text `input` did before | `workbench.py` |
| G-10 | Tutor exam-mode deflection fires on EVERY direct-answer turn (was turn 0 only — answer extractable on turn 2) | `services/ai/tutor_engine.py` |
| G-11 | Token hub: empty-output retry at 2× budget (gpt-oss reasoning exhaustion); streaming Anthropic fallback (stream path was Groq-or-nothing); `output_tokens` in request() result | `services/ai/token_hub.py` |
| G-12 | Pseudonymizer: longest-first word-boundary replacement (exact-substring pass corrupted names like Ram→Ramkrishna) | `workbench.py` |
| Spine | Content-spine migration `s12_spine_01`: `content_sources` / `content_units` / `content_chunks` (pgvector 1024 + HNSW + tsvector, natural-key unique constraints) / `extraction_runs` (coverage manifests) / `question_papers` + `paper_questions` (printed-paper archive, 1:1 reprint contract) / `golden_set_items` + `eval_runs`; models `app/models/content_spine.py` (BaseModel + nullable school_id — NULL = platform corpus, document_chunks pattern) | `migrations/versions/s12_content_spine.py`, `app/models/content_spine.py`, `app/models/__init__.py` |
| Loader | `app/content_loader.py` CLI (validate / ingest / status): contract checks, idempotent natural-key upserts (chunk ordinal = page×100+block deterministic; paper delete-then-reinsert), coverage publish gate (≥98% pages, zero flagged), spec-grid → PaperBlueprint (subject-gated, honest manifest deferral), best-effort embed + dual-write into document_chunks (source_type="content_chunk"); env-aware app bootstrap (TEST_DATABASE_URL ⇒ testing config — same bug class as the password_reset fix) | `app/content_loader.py` |
| Review | `/content/*` review API (sources list/detail/chunks, chunk pass/flag/correct with audit-trail corrections, publish gate honoring flagged chunks) + `/dashboard/content-review` web page (source → units → chunks with page/bbox provenance) + settings_core nav subitem | `app/api/v1/content_admin.py`, `frontend/app/dashboard/content-review/page.tsx`, `app/plugins/manifests/settings_core.yaml` |
| Tests | `tests/test_s12_ai_foundation.py` 10/10: loader validation+ingest round-trip+idempotency, coverage gate, grounding 422, context_attendance real data, prompt-file loading, moderation categories, pseudonymizer boundaries, tutor consent scope, review API flow | new |

Deferred to S13 (per plan): G-07 full legacy `/ai-tools` migration onto the workbench pipeline.

**Verification:** drift gate PASS (0 blocking / 469 allowlisted); AI-affected suites 62/62 (s12 10, workbench, token hub, quota, ai_teacher, plugin widgets); `tsc --noEmit` clean.

## 2026-09-11 — Competitor deep-audit round: 7 codebases, 7 agent reports + cross-audit synthesis (planning only)

Extracted 7 competitor products from `Other Projects/*.rar` (InfixEdu v9.4.0, eSchool v3.3.6,
Mighty School Pro v1.6, EduEx LMS v2.0, InstiKit v5.5.0, SchoolBusTrack v2.3, InfixEdu addon modules)
— ~250k files. One dedicated audit agent per product; each wrote its own report with file-path
evidence to `docs/competitor-audits/`:

- `infixedu-v9.4.0.md` — fees lifecycle (installments/carry-forward/due-block), custom result-card
  engine, print-twin discipline, DB-driven per-tenant menus, per-event notification matrix, 3-step
  import UX; zero Nepal features.
- `eschool-v3.3.6.md` — online-exam runner (palette/wakelock/auto-submit/retake cooldown/LaTeX),
  mobile More-menu bottom-sheet nav, server-driven ops flags, native pay UX; live classes fake.
- `mighty-school-pro-v1.6.md` — real double-entry accounting (GL, 11 statements, payroll posting),
  fees fine-types+waivers, 15-dimension question taxonomy, permission-keyed sidebar, SMS credits;
  "multibranch SaaS" claim thin, prod `migrate:fresh` cron bug.
- `eduex-lms-v2.0.md` — sequential locking+resume, certificates with public verification, course
  discussions, monetization engine; LMS learning core shallow, AI screens are mocks.
- `instikit-school-v5.5.0.md` — Laravel+Vue (not WP); website+portal fusion with named blocks,
  guest admission funnel with payments, TC verification, day-closure/vouchers, approval engine,
  helpdesk/mess/assets; exportable site presets.
- `schoolbustrack-v2.3.md` — 4-layer trip model (definition→schedule→instances→ride_status),
  driver app, QR board/alight geofence, per-student notification toggles; no GPS history at all.
- `infixedu-addon-modules.md` — addon-engineering lessons (migration maps, connection-test CTA),
  Jitsi JWT/conflict-detection gaps, parent self-registration→approval flow.

Synthesis: `docs/COMPETITOR_CROSS_AUDIT_PLAN_2026-09-11.md` — 30 deduplicated adoptions (A-01..A-30)
prioritized P0/P1/P2, mapped onto existing waves (S13+), with explicit rejections and 4 founder
decisions (transport trip-model re-scope, accounting plugin candidate, LMS trio priority, zip
sideload). No code changes.

## 2026-09-12 — Competitor deep RE-audit v2 (implementation-level) + Master Execution Plan (planning only)

Seven parallel one-agent-per-product line-level re-audits (routes → controllers → migrations →
views/screens → 5 end-to-end feature traces each → field-to-field comparison vs ASchool →
adopt/adapt/reject). Each report in `docs/competitor-audits/*.md` gained a top section
`## Deep re-audit (v2) — implementation-level (2026-09-12)` (originals intact below):

- `infixedu-v9.4.0.md` (587 L) — fees v2 exact math (invoice→chield→transaction approve path,
  carry-forward signed balances, wallet, due-block cache), exam engine (components, dual
  GPA/percent axes, custom-result weighting), student multi-year records + promote snapshot,
  attendance P/L/A/F/H + subject-wise + absent-SMS cron; V2-01..V2-14 (wallet division bug,
  default password, stale due cache, any-intersection MCQ scoring).
- `eschool-v3.3.6.md` (479 L) — online-exam state machine exhaustive (2-state attempt created
  pre-questions, answer key shipped to device, away>5 s auto-submit, client-only timer,
  read-time scoring), fees/payment state machine, live classes confirmed fake, ops-flag wiring;
  found OUR opposite bug: `submit_online_exam` lacks duplicate-attempt check → A-05 P0.
- `mighty-school-pro-v1.6.md` (586 L) — GL is mostly single-entry w/ inverted journal columns +
  two competing balance models; 7-point A-23 accounting mini-design (two-sided vouchers, no
  stored balances, FY-start equity, one report SQL shape); fees 5-dim pricing + FIFO allocation;
  V2-01..V2-14 incl. `call_user_func` success_hook RCE in all 13 gateways.
- `eduex-lms-v2.0.md` (543 L) — locking is read-only theater (submit unchecked), certificates
  derivable + PII leak, 7 unscoped payment verify endpoints, discussions w/ zero fan-out;
  §V2.8 concrete adoption design for A-12/A-13/A-14 in ASchool conventions.
- `instikit-school-v5.5.0.md` (507 L) — 16-table fee engine (waterfall installments, secondary
  concession, dual verification), day closure till-lock, approval engine level machine, website
  blocks (v1 correction: exports are Excel dumps); adoption designs for A-09/A-22/A-24/A-25/A-15;
  V2-01..13 (unauthenticated integration surface, display-only seat caps, no lockForUpdate).
- `schoolbustrack-v2.3.md` (521 L) — trip lifecycle crons + ride_status 0/1/2/3, geofence engine
  w/ 5 radii + per-passenger triggers, coins double-spend; §V2.7 six-table transport schema
  design (TIMESTAMPTZ, per-instance rooms, dual ingest) + §V2.9 driver MVP for A-10/A-11.
- `infixedu-addon-modules.md` (479 L) — all 4 modules line-level: RazorPay 100x money-math bug +
  secret leak; Zoom dead join guards + seeded vendor keys; Jitsi cross-tenant leak; ParentReg
  login-gated as shipped. **V2-24 (our tree, P0): `VideoService` broken vs `LiveClass` (kwargs
  mismatch, invalid status, zero route callers)** → folded into A-16.

New plan: `docs/MASTER_EXECUTION_PLAN_2026-09-12.md` — per-project work-item tables (A-01..A-30
refined ↻ + new A-31..A-37, A-38/A-39/A-41/A-42), ONE sequenced sprint list (S-A1..S-A5 P0
adoption sprints → S13..S20 AI waves → S21+), extended do-not-adopt list, 10 founder decisions
(none blocking). Execution priority per founder: P0 adoptions (A-01..A-11) first, then S13.

No product code changed in this wave (docs only; the S12 red-team log append in
`backend/audits/ai_redteam/known_failure_modes.md` rides along).

## 2026-09-12 — S-A1: Fees depth (branch `feat/sa1-fees-depth`)

Plan: `docs/MASTER_EXECUTION_PLAN_2026-09-12.md` S-A1 (A-01 fees installments/carry-forward/
aging/fines-waivers/offline slips/receipt config + A-08 native-pay UX pieces + A-24 day closure).

| ID | What landed | Files |
|---|---|---|
| A-01 | **Invoices**: `fee_invoices` (per student × period grouping document; totals always computed from lines) + `_group_collections_into_invoices` wired into the manual apply, installments apply, carry-forward AND the monthly cron; status recompute (pending→partial→paid/waived) on every line mutation (pay/update/refund) | `backend/app/models/fee.py`, `backend/app/api/v1/fees.py`, `backend/app/tasks/fee_reminders.py` |
| A-01 | **Installments**: `fee_installments` schedule per structure (validated sum == structure total), apply endpoint generating one bill per installment with explicit `due_date_bs` — and RETIRES the structure's unpaid full bills (conversion, not double-billing) | `fees.py` (`/structures/<id>/installments` GET/PUT + `/apply`) |
| A-01 | **Carry-forward**: `fee_carry_forwards` + log table; signed-balance preview (due/credit) and apply (due → pending bill in new year; credit → self-settled waived line; per-year idempotent) | `fees.py` (`/carry-forward/preview|apply|log`) |
| A-01 | **AR aging**: `/receivables/aging` — 30/60/90 buckets by BS due date (converted for arithmetic), by class + top by-student | `fees.py` |
| A-01 | **Fines + waivers**: `fees_fine_policy` in School.settings (none/fixed_once/daily_percent + grace + cap); idempotent accrual via `fine_accrued_on_bs` (daily_percent RECOMPUTES — never compounds); fines/waivers reports by class/month; fines settings endpoint | `fees.py`, beat task `accrue_fee_fines_daily` |
| A-01 | **Offline bank-slip/cheque queue**: `fee_offline_submissions` (parent/student submit w/ slip file + referenced bills; tenant+own-child scoped) → admin approve (records payments through the same core: receipts, invoice status, fee.paid event, in-app notification) / reject (notifies) | `models/fee.py`, `fees.py` (`/offline-submissions*`) |
| A-01 | **Receipt numbering config**: per-school prefix + pad via School.settings `fee_receipt_numbering` (sequence stays in the FOR UPDATE counter) | `fees.py` (`/receipt-numbering` GET/PUT) |
| A-08 | **Pending sweeper**: stale gateway PaymentInitiations (initiated >1h) → failed; hourly beat + manual endpoint. **Nudge**: student "ask parents to pay" → in-app notification to linked guardian accounts. Receipt download/verification screen shipped on mobile (below) | `backend/app/tasks/fees_depth.py` (new), `fees.py`, beat entries in `app/__init__.py` |
| A-24 | **Day closure / day book**: `fee_day_closures` (BS-first, denomination matrix, expected vs counted vs difference); till lock — `record_payment` refuses cash/cheque/bank for a closed collector+date (423) until admin reopen (audited); `/day-book` grouped by method + collector. Also fixed: `record_payment` never stamped `collected_by_id` before (day book showed "unknown") | `models/fee.py`, `fees.py` |
| A-01 web | 7 pages: invoices (+detail sheet), slip approvals, AR aging, carry-forward wizard+log, day closure (+denomination dialog, reopen), reports (Collection/Fines/Waivers tabs + policy dialog), installment editor on structures; hub quick-actions + manifest nav subitems | `frontend/app/dashboard/fees/**`, `modules/fees/manifest.yaml` |
| A-08 mobile | Parent: bank-deposit submission flow (FileUploadService slip), submissions list, invoices list+detail w/ receipt download, payment-verification screen (3-state) after gateway return; Student: "ask parents to pay" nudge; shared FeeRepository methods + models | `aschool_shared/lib/{models/fee,repositories/fee_repository}.dart`, `flutter_parent/lib/features/fees/**` (5 new screens + router), `flutter_student/.../student_fees_screen.dart` |

**Verification:** `tests/test_sa1_fees_depth.py` 13/13 (installments+conversion, invoice status
recompute, carry-forward due+credit, aging buckets, fine idempotency fixed_once + daily_percent,
reports, offline approve/reject, till lock + day book + reopen, receipt config, sweeper, nudge);
existing fees suites 9/9; plugin widgets + contract + S0 suites 36/36; drift gate PASS (0 blocking,
477 allowlisted — new tables match BaseModel exactly); `tsc --noEmit` clean; plugin_doctor 49/0/0;
`flutter analyze` 0 errors (shared/parent/student/teacher). Full-suite run per founder instruction:
NOT run for this sprint (targeted suites only).

