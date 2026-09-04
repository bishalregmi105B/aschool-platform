# D3 — SAHAYATRI → ASCHOOL PLUGIN: IMPLEMENTATION SPEC

Date: 2026-09-05 · Status: implementation spec. Nothing here is built yet unless a `file:line` anchor is
given, in which case that code exists today and the spec must integrate with it as written.

## Sources and citation shorthand

| Shorthand | File | Read |
|---|---|---|
| `SI §n` | `audits/research/SAHAYATRI_SPEC_INVENTORY.md` (342 ln) | full |
| `BC §n` | `audits/research/SAHAYATRI_BACKEND_CODE.md` (307 ln) | full |
| `UX §n` | `audits/research/SAHAYATRI_CLIENTS_UX.md` (462 ln) | full |
| `D1 §x` | `audits/research/_digest/D1_AITEACHER_AND_TOOLS.md` | §B (teaching-content schema), §C (tool catalog) |
| `D2 §x` | `audits/research/_digest/D2_ARCHITECTURE_AND_ENGINE.md` | §A (plugin package v2 contract) |
| `S:<path>` | source under `/home/bishal-regmi/Desktop/Sahayatri/` | read directly |
| bare paths | `/home/bishal-regmi/Desktop/ASchool/` | read directly |

Prior reports are treated as settled. This spec does **not** re-derive Sahayatri's inventory (`SI`), its
backend behaviour (`BC`), or its client surfaces (`UX`). Two earlier digests already locked decisions this
spec must not contradict:

- **`D1 §B`** locked the admin-entered, no-OCR teaching-content schema (`teaching_sections` →
  `teaching_section_versions` → 8 block tables + 2 side tables) composed onto the existing
  `curriculum_frameworks → curriculum_units → learning_outcomes` chain (`backend/app/models/curriculum.py:16-94`).
- **`D1 §C.3`** locked five new `AIToolRegistry` columns (`trigger_phrases`, `budget`, `failure_modes`,
  `reference_pack`, `output_document_type`) and `D1 §C.4` locked the document-emitter contract.

Where Sahayatri would introduce a second store for the same information, this spec kills the Sahayatri table
and maps its fields onto the D1 schema. That mapping is section C and is the load-bearing part of this
document.

## Owner constraints (verbatim, binding)

1. Sahayatri becomes an ASchool **plugin**, not a separate project — fully wired: admin panel, web, mobile,
   editable plugin config, working UI on all three surfaces.
2. **No AI whiteboard.** Cancelled. Any Sahayatri capability that depends on it is dropped and a
   non-whiteboard equivalent named.
3. **No OCR / vision ingestion.** All class/subject teaching content is entered manually by platform
   admins. The DB schema must still be correct for that data model; the ingestion path is out of scope.
   (The 7-stage vision pipeline of `BC §4.9` is OUT; the exercise-block and chapter-context *data model* it
   produced is IN, fed by admin data entry.)
4. All AI routes through the existing `AITokenHub` + `AIWorkbenchOrchestrator` guardrails — consent,
   injection, moderation, quota, ledger (`backend/app/services/ai/workbench.py:109-266`). No un-gated AI.

---

# A. SCOPE DECISION

Verdicts: **PORT** = build essentially as Sahayatri has it (adapted to ASchool conventions: `SchoolModel`,
`school_id` scoping, `AITokenHub`). **PORT-MODIFIED** = the capability ships but its mechanism, storage or
UI changes materially. **SKIP** = not built.

Landing plugins named in this table (section B defines them): **`nepal_curriculum`** (content + exercise
bank + chapter context + admin entry), **`ai_suite`** (existing bundle — the tool catalog, all AI tools,
result templates), **`ai_adaptive_learning`** (SM-2 + adaptive path, existing deprecated-but-installed
slug), **`gamification`** (existing), **`exams`** (existing — live quiz), **`wellbeing`** (existing),
**`elibrary`** (existing), **`sms_notifications`** (existing).

## A.1 Content pipeline and curriculum data

| # | Sahayatri capability | Verdict | Reason | Lands in |
|---|---|---|---|---|
| 1 | 7-stage Vision-AI textbook ingestion (rasterize → classify → TOC → chapter MD → exercise blocks → review → publish) `SI §3.2`, `BC §4.9` | **SKIP** | Owner constraint 3: no OCR/vision ingestion. This is the single largest deletion — `BC §7` calls it the best-engineered subsystem, and it goes. | — |
| 2 | `content_import_jobs` / `import_job_pages` / `draft_chapters` / `draft_exercise_blocks` tables `BC §3` | **SKIP** | They only exist to hold vision-pipeline state. With #1 gone the draft→publish workflow moves onto `teaching_section_versions.status` (`D1 §B.3`), which already has draft/in_review/published/archived/rejected + `teaching_content_reviews` audit. | — |
| 3 | Institution paper upload (tenant-scoped clone of the pipeline) `SI §3.2`, `S:backend/app/api/institution/paper_upload.py` | **PORT-MODIFIED** | The PDF→AI extraction half dies with #1. What survives is: a school uploads a past paper **file** (already `past_papers` at `backend/app/models/digital_content.py:35-48`) and **types** its questions into the question bank. Keep the heuristics that are pure functions of typed markdown: `_detect_exercise_type`, `_guess_has_math`, `_guess_sub_part_count`, `_suggest_bloom_level` (`S:…/paper_upload.py:403-611`) as admin-UI autofill. | `nepal_curriculum` + `elibrary` |
| 4 | Chapter markdown store (`subject_topics.content_markdown` / `_ne`) `S:backend/app/models/subject_topic.py:32-36` | **PORT-MODIFIED** | Do not add a markdown blob column. `D1 §B.2` already models chapter body as ordered `teaching_notes` blocks with `body_en`/`body_ne` + `block_type`. One blob cannot express block types, speaker notes or per-block media, and it cannot be reviewed field-by-field. | `nepal_curriculum` |
| 5 | **Exercise blocks as Markdown** — 19 Nepal types, never forced MCQ `SI §3.2`, `S:backend/app/models/exercise_block.py` | **PORT-MODIFIED** | The insight is essential and ASchool's `question_bank_items.question_type` enum (7 values, `backend/app/models/question_bank.py:25-32`) destroys it. Fix by **extending the existing enum + adding columns** to `question_bank_items`, not by adding an `exercise_blocks` table. See §C.1. | `nepal_curriculum` extends `ai_suite`'s bank |
| 6 | **Chapter AI Context** knowledge base (summary, definitions, theorems, formulas, worked examples, mistakes, exam tips, connections; draft→approve→published) `SI §4.3`, `S:backend/app/models/chapter_ai_context.py` | **PORT-MODIFIED** | The concept is the most defensible idea in Sahayatri (`UX §4.2`). But every one of its JSONB sections maps 1:1 onto a D1 block table already specified. Adding `chapter_ai_context` would be a second, unversioned copy. See §C.2 for the field-by-field mapping. | `nepal_curriculum` |
| 7 | Confidence scoring + auto-approve tiers (≥0.90 chapter, ≥0.85 exercise, <0.30 reject) `SI §3.2` | **SKIP** | Confidence is an extraction-quality score. With no extraction there is nothing to score — a human typed it. Keep only the *UI pattern* (`UX §4` "confidence-tiered review queues") as a **completeness** check: the publish gate of `D1 §B.3`. | — |
| 8 | Bloom's auto-tagger (Nepali + English verb keywords) `SI §3.2` | **PORT** | Pure deterministic function over typed text; useful as admin-form autofill and for `learning_outcomes.bloom`. Heuristic-first with no LLM call = zero token cost (`BC §4.9`). | `nepal_curriculum` service |
| 9 | Duplicate detection (Jaccard ≥ 0.72 over exercise markdown) `SI §3.2`, `S:backend/app/services/duplicate_detection_service.py:14` | **PORT** | Still needed: admins typing questions will re-enter near-duplicates, and the question bank has no dedupe today. | `nepal_curriculum` service |
| 10 | Exercise Bank browser UI (filter by class/subject/topic/type/Bloom/difficulty/source, bulk tag, KaTeX preview, source badges) `SI §3.2`, `UX §1.5` | **PORT** | ASchool has `GET/POST/PUT/DELETE /ai-tools/question-bank` (`backend/app/api/v1/ai_tools.py:250-386`) but no browser UI with these filters. | `ai_suite` web + `nepal_curriculum` admin |
| 11 | Chapter Reader (react-markdown + remark-math + KaTeX, EN/NE dual, `<details>` Nepali toggle) `UX §1.5` | **PORT** | Net-new student surface; ASchool has no chapter reader. Renders `teaching_notes` blocks instead of one markdown blob. | `nepal_curriculum` web + `flutter_student` |
| 12 | Question paper builder from `exercise_block_ids[]` + WeasyPrint PDF `SI §3.2` | **SKIP (already exists)** | `PaperBlueprint` + `GeneratedPaper` + `POST /ai-tools/question-paper/v2` (`backend/app/models/question_bank.py:71-141`, `backend/app/api/v1/ai_tools.py:386-452`) already do this, with a better model (`questions` JSONB carrying `bank_item_id` beats Sahayatri's bare UUID array with no join table, `BC §3`). | — |
| 13 | Study materials CRUD | **SKIP (already exists)** | `study_materials` at `backend/app/models/lms.py:76-90`, with a real `file_url` upload path. Sahayatri's is metadata-only with no upload (`BC §2`). | — |

## A.2 AI whiteboard and everything downstream of it

| # | Sahayatri capability | Verdict | Reason | Lands in |
|---|---|---|---|---|
| 14 | AI Whiteboard app (Flutter web + Android, `perfect_freehand` canvas, pages, undo/redo 50-deep, local persistence, PNG export) `SI §3.3`, `UX §3` | **SKIP** | Owner constraint 2. **Non-whiteboard equivalent:** none needed — this is a delivery surface, not a capability. Teachers already have `design_studio` (canvas editor) for prepared visuals and `lms` LiveClass/Jitsi for live delivery. | — |
| 15 | `whiteboard_sessions` / `whiteboard_boards` tables `BC §3` | **SKIP** | No whiteboard ⇒ no board storage. | — |
| 16 | Whiteboard live-session Socket.IO protocol (`wb:<code>` rooms, stroke/element/cursor sync, Redis 12h snapshots, `board_state_request` late-join) `BC §5` | **SKIP** | Depends on #14. Note `UX §3.3`: in Sahayatri this protocol was **never actually wired** — `BoardProvider` never calls `SocketService`, so no working feature is lost. The *late-joiner snapshot pattern* is still worth reusing and is reused by the live quiz in §F.3. | — |
| 17 | **Circle-to-Search** (draw a circle → vision explains what is inside) `SI §3.3` | **SKIP** | Doubly blocked: needs the whiteboard (constraint 2) *and* a vision call on a rasterized canvas (constraint 3 spirit — vision on captured pixels). **Non-whiteboard equivalent:** the text-mode Doubt Solver (#33) covers "explain this thing" for typed/pasted questions. | — |
| 18 | Whiteboard math solver / chemistry solver / shape explainer (on-board LaTeX steps) `SI §3.3` | **PORT-MODIFIED** | The *solvers* survive as ordinary workbench tools with the `solver_steps` result template (§E.4). Only the "on the board" rendering dies. `shape_explainer` dies outright (it explains a drawing). | `ai_suite` |
| 19 | AI PPT panel on the board `SI §3.3` | **SKIP as a panel** | The deck generator itself is already locked in `D1 §C.4` as the `deck` dialect tool `slide_deck`, rendering through the designer canvas. Only the in-board panel dies. | `ai_suite` (via `D1 §C.4`) |
| 20 | Sketchfab 3D embed on the board + JS↔Dart `SketchfabBridgeService` node highlighting `SI §3.3` | **SKIP** | Depends on #14. | — |
| 21 | IFP (interactive flat panel) compatibility layer — stylus vs finger via `PointerDeviceKind`, touch-scaled toolbar, local-APK offline deployment `SI §3.3` | **SKIP** | Only meaningful for the canvas. | — |
| 22 | Offline-first local board persistence (`wb_board_v1` in SharedPreferences) + two-tier AI cache (memory L1 + prefs L2, 24 h TTL) `UX §3.2` | **SKIP the board half, PORT the cache pattern** | The AI-result cache keyed by prompt hash is independent of the canvas and directly useful for low-bandwidth Nepali schools. Applies to `flutter_student` tool results. | `ai_suite` Flutter |
| 23 | Three-mode whiteboard onboarding (Start Drawing / Open My Board / Start Live Class), QR-join, connectivity chip `UX §4.1` | **SKIP** | Whiteboard-specific. The *QR-join* idea survives for the live quiz (§F.2), and the *connectivity chip* survives as an offline banner on the Flutter tool screens. | `exams` / `ai_suite` Flutter |

## A.3 3D visualization

| # | Sahayatri capability | Verdict | Reason | Lands in |
|---|---|---|---|---|
| 24 | Branded Sketchfab viewer wrapper (Viewer API 1.12, hide vendor chrome, own toolbar/info/quiz panels, node map, camera control, highlight, screenshot) `SI §3.4` | **PORT-MODIFIED** | Net-new for ASchool (grep for `sketchfab`/`model-viewer` across `backend/ frontend/ flutter_student/` returns nothing). But ship it as a **curated external-resource viewer** on top of the existing `oer_resources` table (`backend/app/models/digital_content.py:51-63`, already has `resource_type` including `simulation`, `url`, `subject_id`, `class_id`, `tags`, `is_approved`) — not a new `sketchfab_models` table. See §C.6. | `elibrary` |
| 25 | Curated 103-model Sketchfab library seed `SI §3.4` | **PORT-MODIFIED** | Seed as `oer_resources` rows with `resource_type='simulation'`. Licence/attribution must be stored — that is a new column, not a new table. | `elibrary` seed |
| 26 | AI auto-annotation of 3D models (5 annotations/model: `{node_name, label_ne/en, description_ne/en}`) `SI §3.4` | **PORT-MODIFIED** | Becomes a workbench tool `model_annotator` with output schema `model_annotations` and the `annotation_list` result template, writing into a JSONB column on the resource. Runs through the orchestrator like everything else (constraint 4). | `ai_suite` + `elibrary` |
| 27 | Model quiz mode (linked exercise blocks as a scored sidebar quiz) `SI §3.4` | **PORT-MODIFIED** | Link `question_bank_items` to the resource via a join column rather than a `simulation_panels` table. | `elibrary` |
| 28 | oEmbed metadata enrichment (title/author/licence/thumbnail, Redis-cached 24 h) `SI §3.4` | **PORT** | Small, and it is how attribution stays legally correct. | `elibrary` service |
| 29 | 3D usage analytics (view counts, top models, class-level breakdown) `SI §3.4` | **PORT-MODIFIED** | A `view_count` column plus the existing analytics rollup pattern (`AIToolAnalyticsDaily`, `backend/app/models/ai_workbench.py:252-268`) rather than a bespoke analytics table. | `elibrary` |

## A.4 AI tool catalog and the tools themselves

| # | Sahayatri capability | Verdict | Reason | Lands in |
|---|---|---|---|---|
| 30 | **Tool catalog as data** — `ai_tools` table (slug, name/name_ne, role, category, ui_type, icon, endpoint, frontend_path, is_premium, sort_order, token_cost_estimate, badge) + `GET /ai/tools/` + seed script `S:backend/app/models/ai_tool.py`, `S:backend/app/api/ai/tools_registry.py:475-521` | **PORT-MODIFIED** | ASchool already has `AIToolRegistry` (`backend/app/models/ai_workbench.py:82-112`) and `GET /ai/tools` (`backend/app/api/v1/ai_workbench.py:49-79`). Add the missing columns to it — §D names them exactly. Do **not** create `ai_tools`. | `ai_suite` |
| 31 | ~55 student + ~50 teacher per-role dispatcher routes (`/ai/student/<slug>/`, `/ai/teacher/<slug>/`) `BC §2` | **SKIP** | Directly contradicts ASchool's one-dispatcher design: `POST /ai/generate/<tool_key>` (`backend/app/api/v1/ai_workbench.py:31-46`), whose whole point is "adding tool #66 = one prompt file + one handler + one registry row — no new routes" (`workbench.py:11-13`). 105 new routes would also bypass the pipeline. | — |
| 32 | Generic runner with 95 inline `{cost, system}` tool configs `S:backend/app/api/ai/generic_tool.py:19-836` | **SKIP as-is, PORT the content** | The *dispatcher* is superseded by `/ai/generate/<tool_key>`. The 95 system prompts are real intellectual content and become registry rows + `app/prompts/<schema>_{en,ne}.md` files (`D1 §C.3` tier 1). `BC §9` says the same: "consolidate into ASchool's workbench schemas". | `ai_suite` prompts |
| 33 | Doubt Solver — **text mode** `SI §3.8` | **PORT** | Highest perceived-value student tool. Text/typed question in, stepwise explanation out. | `ai_suite` |
| 33b | Doubt Solver — **image mode** (photo of textbook page → Groq vision) `SI §3.8` | **SKIP** | Constraint 3: no vision ingestion of content. Also the single biggest consent/PII surface (a photo can contain other students' work). **Equivalent:** type or paste the question; the Nepali keyboard path is the substitute, plus voice input (#35) for students who find typing Devanagari slow. | — |
| 34 | Voice Tutor loop (mic → Whisper STT → context-injected chat → edge-tts ne-NP playback) `SI §4.6` | **PORT-MODIFIED** | Chat half maps onto the existing `tutor_engine` state machine (`backend/app/services/ai/tutor_engine.py`, AW-06 "no plan → no chat"). STT uses `AITokenHub`'s existing `speech` model slot (`whisper-large-v3-turbo`, `token_hub.py:49`). TTS is new and needs its own metered feature key. **Sahayatri's un-gated voice-tutor chat was flagged as a revenue leak in both its audits (`SI §9`) — must not be reproduced.** | `ai_suite` (tutor) |
| 35 | TTS service (edge-tts `ne-NP-SagarNeural` / `ne-NP-HemkalaNeural`, gTTS fallback, mp3 bytes) `BC §4.8` | **PORT** | Nepali voice output is a genuine differentiator and there is no ASchool equivalent. Must be metered (`feature="tts:speak"`) even though it is not an LLM call. | `ai_suite` service |
| 36 | STT (Groq Whisper, `language=ne` hint) `BC §4.1` | **PORT** | Already possible through `AITokenHub` — needs a `transcribe()` entry-point, not a new provider. | `ai_suite` service |
| 37 | PDF chat (fetch URL → truncate 8 k → grounded single call, refuse-if-not-in-document) `BC §4.3` | **PORT-MODIFIED** | ASchool has real hybrid RAG (`backend/app/services/ai/rag.py`, pgvector + BM25 + RRF over `document_chunks`). Route "chat with this document" through RAG over `elibrary` items. **Sahayatri's version fetches an arbitrary client-supplied `document_url` server-side — an SSRF (`BC §7`). Must not be copied.** | `elibrary` + `ai_suite` |
| 38 | Research agent (Brave → SerpAPI → DuckDuckGo → cited synthesis, quick/standard/deep) `SI §3.9` | **PORT-MODIFIED** | Keep the provider-fallback chain and citation discipline; add domain allow-listing (same SSRF class as #37). Cost tier 3 — gate to teacher/school_admin first. | `ai_suite` |
| 39 | Video generator (5-stage Celery: script → FLUX images → TTS → ffmpeg → MinIO) `SI §3.9` | **SKIP** | `SI §10` Tier-3 already ranks it "expensive, lowest priority"; ffmpeg + image-gen + TTS per video is the most expensive thing in the catalog, and `BC §7` notes the script stage is broken anyway. **Equivalent:** the `deck` slide generator (#19/`D1 §C.4`) plus TTS narration per slide covers the teaching use case at ~1 % of the cost. | — |
| 40 | PPT generator via python-pptx `SI §3.9` | **SKIP as python-pptx, PORT as `deck`** | `D1 §C.4` explicitly rules: "reuse the designer canvas and fix the existing PPTX exporter — do not add python-pptx", because the canvas path already handles Devanagari shaping through WeasyPrint+HarfBuzz. | `ai_suite` (`D1 §C.4`) |
| 41 | Document generator (AI JSON → python-docx / WeasyPrint) `SI §3.9` | **SKIP as new engine** | Already covered by `D1 §C.4`'s `writer` dialect + `writer_docx.py`. | — |
| 42 | Emotion detection / wellbeing coach (8 emotions, intensity, `is_concerning` → "Talk to your teacher" CTA) `SI §3.6` | **PORT-MODIFIED** | Three duplicate implementations exist in Sahayatri (`BC §7`); consolidate to one. The `is_concerning` escalation must route into ASchool's **existing** path: `ModerationFlag(severity='critical')` → counselor queue (`workbench.py:424-447`), never a second alerting mechanism. | `wellbeing` + `ai_suite` |
| 43 | Follow-up suggestion chips on every AI result `UX §4.3` | **PORT** | Near-zero cost, large effect on session depth. Requires one optional array in every output schema (§E.1). | `ai_suite` schemas + web + Flutter |
| 44 | "✓ Based on your chapter" provenance badge + `used_chapter_context` flag `UX §4.2` | **PORT** | Converts an invisible grounding detail into student-legible trust, and it is the honest signal when grounding is *absent*. Maps onto `ai_generations.citations` (`backend/app/models/ai_workbench.py:45`). | `ai_suite` |
| 45 | `NEPAL_FIRST_SYSTEM` base prompt (Nepali-first, NEB/SEE/CDC banding, Nepal-context examples, never-give-exam-answers, CDC math notation) `S:backend/app/prompts/base.py:4-30` | **PORT** | Directly reusable; persona name must change (no named persona — AW-04, `tutor_engine.py:17`). Becomes the shared prefix in `_system_prompt` (`workbench.py:329-343`). | `ai_suite` prompts |
| 46 | Devanagari-detection language heuristic (regex on user input → `ne`) `BC §4.2` | **PORT** | 10 lines, removes a language selector from every form. | `ai_suite` util |
| 47 | Deterministic local fallback for every AI route (`provider:"local"`, `model:"deterministic-context-v1"`) `BC §4.6` | **PORT-MODIFIED** | Genuinely good for demos/CI/no-key environments, but it must be **labelled**, never silent: reuse the existing honest-provenance convention `source="rule_based_fallback"` + `source_note` (`backend/app/models/adaptive_learning.py:54-57`) and `fallback_used` on the ledger row (`ai_workbench.py:46`). | `ai_suite` |

## A.5 Learning science

| # | Sahayatri capability | Verdict | Reason | Lands in |
|---|---|---|---|---|
| 48 | **SM-2 spaced repetition** (ease ≥1.3, intervals 1→6→i×EF, quality 0–5, statuses new/learning/review/graduated, auto-seed cards from the bank) `S:backend/app/services/spaced_rep_service.py:30-53` | **PORT** | Complete, correct, deterministic, zero token cost, and ASchool has nothing like it (grep for `ease_factor`/`sm2` across `backend/app` returns nothing). Port `sm2_update` nearly verbatim; fix the tenancy (Sahayatri FKs `users.id`, ASchool must FK `students.id` + `school_id`). | `ai_adaptive_learning` |
| 49 | SM-2 review UI (6 labelled quality buttons red→green, Show-Answer gate, stats strip total/due/learning/graduated, 🎉 terminal state) `UX §4.6` | **PORT** | The interaction design is the feature. | `ai_adaptive_learning` web + `flutter_student` |
| 50 | Adaptive path (per-topic SQL stats from SM-2 cards → weak `avg_ease<2.1` / new / in_progress, with human-readable `reason`) `S:backend/app/services/adaptive_service.py` | **PORT-MODIFIED** | ASchool already has `LearningPath` + `MasteryRecord` (`backend/app/models/adaptive_learning.py:31-144`) driven off `Marks`. Sahayatri's contribution is a **second, finer signal** (per-topic ease factor) and the `reason` string. Feed it into the existing tables; do not add `learning_paths` again. Note `SI §9`: Sahayatri wrote `mastery_scores` but the recommender read the cards — the redundancy is a known bug, do not reproduce it. | `ai_adaptive_learning` |
| 51 | Adaptive-path row UI (chapter pill, completion bar, ease badge Strong/Moderate/Needs-work, card count, the AI's `reason` inline, "✨ Practice" modal) `UX §4.7` | **PORT** | "Recommendation with a stated justification, not a black box." | `ai_adaptive_learning` web + Flutter |
| 52 | **Gamification** — XP table, 11 cumulative levels, 6 badges, daily streak + longest streak, institution leaderboard `S:backend/app/services/gamification_service.py:13-193` | **PORT-MODIFIED** | ASchool's `gamification` plugin has `Badge`/`StudentBadge`/`PointsLog`/`House`/`Reward` (`backend/app/models/gamification.py`) — points and badges exist, but **XP levels and streaks do not** (`api/v1/gamification.py` has no streak/level code). Add the missing state to a new small table; reuse `PointsLog` as the XP event log. See §C.5. | `gamification` |
| 53 | Gamification UI (XP/level hero, streak 🔥 pill, XP-to-next bar, badge grid, leaderboard with "(you)" highlight, XP history tab) `UX §1.5` | **PORT** | `frontend/app/dashboard/gamification` exists but has no student-facing XP/streak surface. | `gamification` web + `flutter_student` |
| 54 | Practice quiz generator (AI MCQs from a topic, server-side scoring, token-gated cost 60) `SI §3.5` | **PORT-MODIFIED** | Generation is a workbench tool; the *attempt/score* half already exists as `OnlineExam` + `OnlineExamAttempt` (`backend/app/models/exam.py:168-205`) with `questions` JSONB and server-side `score`. Generate → persist as an `OnlineExam` → reuse the attempt flow. No new quiz tables. | `exams` + `ai_suite` |
| 55 | **Live quiz (Kahoot-style)**: 6-char join code, participants, server-authoritative scoring, leaderboard `S:backend/app/sockets/live_quiz_socket.py`, `S:backend/app/api/quiz/live_quiz_routes.py` | **PORT** | Net-new classroom-engagement surface; ASchool's `realtime.py` has only school rooms. Port the Redis state schema and the "client `is_correct` is ALWAYS ignored" rule verbatim (`live_quiz_socket.py:95`). Full event list in §F. | `exams` |
| 56 | Mock test with timed countdown + localStorage autosave `SI §3.5` | **PORT-MODIFIED** | Generation = workbench tool; timing/autosave = `OnlineExam.duration_minutes` + `OnlineExamAttempt`. | `exams` |

## A.6 Identity, tenancy, commerce, comms — mostly already-solved ground

| # | Sahayatri capability | Verdict | Reason | Lands in |
|---|---|---|---|---|
| 57 | JWT auth + Redis JTI blacklist + refresh rotation + Google OAuth `SI §3.1` | **SKIP** | ASchool has its own auth with `tokens_invalid_before` invalidation (`backend/app/realtime.py:81-88`) and a `revoked_token` model. `SI §10` "Do NOT port" says the same. | — |
| 58 | Institution registration / institution CRUD / class-grade & subject managers / enrollment `SI §3.1` | **SKIP** | ASchool is a school ERP: `schools`, `classes`, `sections`, `subjects`, `students`, `academic_years` (`backend/app/models/academic.py`, `student.py`). Sahayatri's institution portal is "a content-delivery roster, not an ERP" (`UX §6`). | — |
| 59 | Token-based subscription plans in NPR (`subscription_plans`, `user_subscriptions.tokens_remaining`) `SI §1` | **SKIP** | ASchool meters by **USD cost against a per-school quota** (`AISchoolQuota.monthly_limit`/`daily_limit`, `AIUsageLog.cost_usd/cost_npr`, `backend/app/models/ai_token.py`) and sells plugins monthly (`price_monthly` in every manifest). Two competing wallets would be a billing disaster. See #60 for what survives. | — |
| 60 | `@require_tokens` / `finalize_deduction` two-phase gate with HTTP 402 `{tokens_remaining, tokens_needed}` `S:backend/app/utils/token_gate.py:41-120` | **PORT-MODIFIED** | The *semantics* are better than what ASchool surfaces today: a pre-flight cost estimate and a 402 that tells you the shortfall. `AITokenHub.request` already reserves estimated cost before the call (`token_hub.py:551-560`). What to add: a **per-tool `budget` / cost-tier column** (`D1 §C.3` already specifies `budget`) so the UI can show a cost badge, and a 402 body carrying remaining headroom. **Do not** copy Sahayatri's check-then-deduct without row locking — `BC §4.7` documents that race explicitly. | `ai_suite` |
| 61 | Per-call usage log (`token_usage_log`: user, institution, tool, model, subject, topic, metadata) `BC §3` | **SKIP (already exists, twice)** | `AIUsageLog` (`models/ai_token.py:31-52`) + `AIGeneration` (`models/ai_workbench.py:20-47`). | — |
| 62 | Token cost badge (`tokenCostBadge()` green ≤10 / amber ≤50 / red) + token-balance AppBar chip (compacts to `1.2k`, red under 100) `UX §4`, `UX §2.3` | **PORT-MODIFIED** | Keep the UX; change the unit from "tokens remaining" to "school AI headroom %" + per-tool cost tier, since ASchool has no per-user wallet. | `ai_suite` web + Flutter |
| 63 | SMS integration API (`/api/sms/v1/`, `X-API-Key`, scoped `institution_api_keys`) `SI §3.1` | **SKIP for this port** | Real value (`SI §10` Tier-1 #5) but it is a school-ERP integration surface with nothing to do with Sahayatri's learning product; it belongs to a `sms_notifications` work item, not this plugin. Recorded here so it is not silently lost. | (`sms_notifications`, out of scope) |
| 64 | Outbound Sparrow SMS gateway `BC §4.10` | **SKIP** | `sms_notifications` + `SMSLog` already exist (`backend/app/models/notification.py`). | — |
| 65 | Parent portal (child dashboard/profile; attendance/results stubs) `SI §3.1` | **SKIP** | ASchool has `flutter_parent`, `api/v1/parent_app.py`, real attendance/marks/fees. Sahayatri's is stubs (`UX §5`). | — |
| 66 | Teacher community feed (posts, types, tags, likes) `SI §3.7` | **SKIP for this port** | Genuinely absent from ASchool, but it is a social feature with moderation/abuse obligations, unrelated to curriculum-grounded AI. Defer as its own plugin. | (deferred) |
| 67 | Nepali i18n infrastructure (full en/ne catalogue with ICU interpolation, `formatNPR()` → `रू १२,५००`, `nepaliNumerals()`, ne-NP dates, Devanagari font stack) `UX §1.8` | **PORT-MODIFIED** | ASchool already has `frontend/lib/nepali-utils.ts` + `nepali_date.ts` and `name_nepali` columns throughout. Port the **message keys** (they are reusable verbatim) and the per-plugin `i18n/{en,ne}.json` contract from `D2 §A.1`. Sahayatri's mistake — a complete catalogue that exactly one component reads (`UX §1.8`) — is the thing to avoid. | `nepal_curriculum` + `ai_suite` i18n |
| 68 | Bikram Sambat academic years ("2081-82"), BS exam-year pickers | **SKIP (already exists)** | `Student.dob_bs`, `admission_date_bs` (`models/student.py:45,60`), `frontend/lib/nepali_date.ts`. Sahayatri had no BS↔AD converter at all (`SI §8`). | — |

## A.7 The two constraints, tallied

**Dead because there is no whiteboard** (constraint 2): #14 whiteboard app, #15 board tables, #16 board
socket protocol, #17 Circle-to-Search, #20 in-board Sketchfab bridge, #21 IFP layer, #23 three-mode board
onboarding — **7 whole capabilities** — plus **3 partials**: #19 (the PPT *panel* dies, the deck generator
lives), #22 (the board's local persistence dies, its AI cache lives), #18 (the "on the board" rendering dies,
the solvers live). That is the entire `whiteboard/` deployable (45 Dart files, 3,653 lines, `UX §3`) and the
`wb:` socket namespace. Mitigating fact: `UX §3.3` establishes that stroke sync was never wired and six of its
AI panels were never mounted, so the *working* loss is the canvas, undo/redo, local save and PNG export — none
of which is an AI capability.

**Dead because there is no OCR/vision ingestion** (constraint 3): #1 the 7-stage pipeline, #2 its four
tables, #7 extraction confidence scoring, #33b image doubt solver — **4 whole capabilities** — plus **2
partials**: #3 (the PDF-extraction half of institution paper upload; typed entry survives) and #6 (the
LLM-distillation half of chapter context; the data model survives, typed). This includes what `BC §7` ranks
as the best-engineered subsystem in the repo.

**Net across 69 catalogued rows (68 capabilities + #33b):** **17 PORT**, **23 PORT-MODIFIED**,
**29 SKIP-family**. The 29 break down as: **18** not built anywhere (7 whiteboard-dependent, 4
OCR-dependent, 7 superseded by ASchool architecture — per-role routes, Sahayatri auth, its ERP, its token
wallet, outbound SMS, parent portal, video generator); **4** already exist in ASchool in a better form
(#12 question papers, #13 study materials, #61 usage logs, #68 Bikram Sambat); **2** deferred as their own
future work (#63 SMS API keys, #66 teacher community); **5** where the *mechanism* is skipped but the
capability lands elsewhere (#19 → deck tool, #22 → Flutter result cache, #32 → registry rows + prompt files,
#40 → `deck` dialect not python-pptx, #41 → `writer` dialect not python-docx).

---

# B. PLUGIN PACKAGING

## B.1 Recommendation: ONE new plugin (`nepal_curriculum`) + extend `ai_suite`. Do not create a "sahayatri" plugin.

**One new plugin**, slug **`nepal_curriculum`**, name "Nepal Curriculum & Chapter Content". Everything else
lands in plugins that already exist.

Justification, in the order the reasons actually bind:

1. **`ai_suite` is a licensing gate, not a feature module.** Its manifest says so explicitly: "BUNDLE
   PLUGIN … this manifest is a LICENSING GATE, not a new feature" and "No api_blueprint of its own"
   (`backend/app/plugins/modules/ai_suite/manifest.yaml:16-28`). Seven AI plugins alias into it
   (`backend/app/plugins/decorators.py:36-38`). A new `sahayatri` plugin holding AI tools would have to
   either be a *second* AI licensing gate (two ways to buy AI — a pricing mess) or alias into `ai_suite`
   anyway, in which case it is a folder with no gate of its own. Adding the tool fleet to `ai_suite` costs
   **zero new gates and zero new pricing rows**, because the registry already carries per-tool
   `min_plan_tier` (`ai_workbench.py:94`) and per-school kill switches (`ai_tool_settings`, `ai_workbench.py:115-127`).
2. **The tool catalog needs no plugin at all — it needs registry rows.** `AIWorkbenchOrchestrator`'s
   contract is "adding tool #66 = one prompt file + one handler + one registry row — no new routes"
   (`workbench.py:11-13`) and it is enforced by a CI fixture tool (`is_fixture`, `ai_workbench.py:101`).
   ~100 Sahayatri tools are therefore ~100 rows + ~100 prompt files, inside `ai_suite`. Creating a plugin to
   hold data rows would be cargo-culting.
3. **The content model genuinely is a new sellable module.** Curriculum chapter content, the Nepal exercise
   typology, the chapter-context knowledge base and the admin authoring workflow are (a) a distinct
   deliverable a school pays for independently of AI, (b) usable *without* AI (chapter reader, exercise
   bank, question papers), and (c) the thing every AI tool grounds against. It owns tables, needs a
   `config_schema`, needs admin nav, and has its own `depends_on` (`academics`). That is exactly what a
   plugin is for.
4. **Grounding must not require the AI licence.** If chapter content lived inside `ai_suite`, a school that
   has not bought AI could not read its own textbook chapters. Splitting content (`nepal_curriculum`,
   starter-priced) from generation (`ai_suite`, premium) is the correct commercial seam and matches the
   existing `elibrary` (starter, NPR 99) vs `ai_suite` (premium, NPR 399) split.
5. **`D1 §B` already put the tables under `curriculum_units`, not under an AI plugin.** The teaching-content
   schema composes onto `curriculum_frameworks` (`models/curriculum.py`), whose owner is the curriculum
   domain. `nepal_curriculum` is the module that finally owns those tables — `curriculum.py` today is
   owned by no manifest (`grep models_module` shows no plugin claims it).
6. **Counter-argument considered and rejected:** "put the content tables in `academics`". Rejected because
   `academics` is a core/starter dependency of most plugins (`depends_on: [academics]` appears throughout);
   loading a large, optional, curriculum-authoring surface into it would make an optional feature
   effectively core, and `D2 §A.2` requires exactly one owner per table with `owns_tables[]` declared.

## B.2 Where every ported capability lands

| Plugin slug | New? | Gets from Sahayatri |
|---|---|---|
| `nepal_curriculum` | **NEW** | Chapter content tables (`D1 §B` schema), exercise typology extension, chapter-context blocks, admin authoring UI (§G), chapter reader, exercise bank browser, Bloom tagger, Jaccard dedupe, EN/NE content i18n |
| `ai_suite` | extend | ~100 registry rows + prompts + handlers + schemas, 20 result templates (§E), TTS/STT services, follow-up chips, provenance badge, cost badges, deterministic fallback, `NEPAL_FIRST_SYSTEM` prefix, Devanagari language detection, Flutter AI-result cache |
| `ai_adaptive_learning` | extend | SM-2 cards + service + review UI, per-topic ease stats feeding `LearningPath`/`MasteryRecord`, adaptive-path row UI |
| `gamification` | extend | XP/level/streak state, level ladder + XP table, badge definitions, student-facing XP/streak/leaderboard UI |
| `exams` | extend | Live quiz (HTTP + socket + Redis state), practice-quiz generation → `OnlineExam`, mock-test timing |
| `elibrary` | extend | 3D/simulation resource viewer, curated model seed with licence/attribution, AI annotations, model-linked quizzes, view analytics, RAG document chat |
| `wellbeing` | extend | Emotion check-in tool consolidated to one implementation, `is_concerning` → existing `ModerationFlag` critical path |

## B.3 `nepal_curriculum` folder layout

Follows the v2 package contract (`D2 §A.1`) — filenames are fixed, absence means "no such surface".

```
backend/app/plugins/modules/nepal_curriculum/
├── manifest.yaml                  # v2, schema_version: 2
├── __init__.py                    # required: makes it a real package
├── config_schema.yaml             # settings screen (B.5)
├── permissions.yaml               # curriculum_admin / content_editor keys
├── events.yaml                    # emits chapter.published etc.
├── widgets.yaml                   # 3 dashboard widgets
├── mobile.yaml                    # student Chapters tab, teacher Content tab
├── routes.py                      # exposes `nepal_curriculum_bp`
├── models.py                      # re-exports app.models.teaching_content (single owner)
├── hooks.py                       # activate/deactivate/uninstall/upgrade
├── listeners.py                   # consumes exams.result_published (weak-topic hints)
├── services/
│   ├── __init__.py
│   ├── content_resolver.py        # school-override → platform fallback CTE (D1 §B.3)
│   ├── snapshot_builder.py        # teaching_content_snapshots + context block text
│   ├── bloom_tagger.py            # ported heuristic (A.1 #8)
│   ├── dedupe.py                  # Jaccard ≥ 0.72 (A.1 #9)
│   ├── exercise_heuristics.py     # detect_type / has_math / sub_parts / marks
│   └── csv_import.py              # bulk paths (§G.6)
├── seeds/
│   └── __init__.py                # idempotent seed(db, school_id)
├── migrations/
│   └── versions/                  # plugin-owned alembic revisions
├── i18n/{en.json,ne.json}
├── ui/
│   ├── index.web.json             # widget_key → frontend registry token
│   └── widgets/*.yaml
├── tests/
│   ├── test_nepal_curriculum_publish_gate.py
│   ├── test_nepal_curriculum_override_chain.py
│   └── test_nepal_curriculum_dedupe.py
├── docs/
└── README.md
```

## B.4 `nepal_curriculum/manifest.yaml` — literal

```yaml
schema_version: 2
slug: nepal_curriculum
name: "Nepal Curriculum & Chapter Content"
name_nepali: "नेपाली पाठ्यक्रम र अध्याय सामग्री"
version: "1.0.0"
author: "ASchool"
category: starter
price_monthly: 199
price_yearly: 1990
is_free: false
published: true
trial_days: null
emoji: "📚"
icon: "BookOpen"
tags: ["curriculum", "content", "neb", "cdc", "nepali"]
description: >-
  Author NEB/CDC chapter content by hand: teaching notes, worked examples,
  misconceptions, formulas, key terms and exam tips per chapter, with a
  draft → review → publish workflow, school-level overrides of platform
  content, and a Nepal-typology exercise bank (MCQ, short, long, numerical,
  proof, construction, fill-in, match, comprehension, activity, map work).
  Every AI tool in AI Suite grounds against the published version of this
  content; the chapter reader and exercise bank work without AI Suite.
description_nepali: >-
  NEB/CDC अध्यायको सामग्री हातैले प्रविष्ट गर्नुहोस् — शिक्षण टिप्पणी,
  हल गरिएका उदाहरण, सामान्य गल्ती, सूत्र, मुख्य शब्द र परीक्षा सुझाव।

# Content is readable without AI; generation needs ai_suite. No alias into
# ai_suite — that would make the content module unbuyable on its own.
aliases: []
supersedes: []
depends_on:
  - academics
soft_depends_on:
  - ai_suite        # grounding + tools light up when present
  - elibrary        # attach OER/3D resources to a section
  - exams           # exercise bank → question papers
conflicts_with: []
min_platform_version: "1.0.0"

capabilities:
  api_blueprint: "app.plugins.modules.nepal_curriculum.routes"
  models_module: "app.models.teaching_content"
  services:
    - "app.plugins.modules.nepal_curriculum.services.content_resolver"
    - "app.plugins.modules.nepal_curriculum.services.snapshot_builder"
    - "app.plugins.modules.nepal_curriculum.services.bloom_tagger"
    - "app.plugins.modules.nepal_curriculum.services.dedupe"
    - "app.plugins.modules.nepal_curriculum.services.exercise_heuristics"
    - "app.plugins.modules.nepal_curriculum.services.csv_import"
  tasks:
    - "app.plugins.modules.nepal_curriculum.tasks.snapshot_tasks"
  beat_schedule:
    - { task: "nepal_curriculum.rebuild_stale_snapshots", cron: "17 2 * * *" }
  socket_namespaces: []
  public_routes: false

owns_tables:
  - teaching_sections
  - teaching_section_versions
  - teaching_section_outcomes
  - teaching_notes
  - teaching_examples
  - teaching_misconceptions
  - teaching_formulas
  - teaching_exam_tips
  - teaching_key_terms
  - teaching_media
  - teaching_content_snapshots
  - teaching_content_reviews
reads_tables:
  - curriculum_frameworks
  - curriculum_units
  - learning_outcomes
  - subject_offerings
  - question_bank_items
  - topics
  - files

config_schema: config_schema.yaml
config_version: 1
permissions_ref: permissions.yaml
events_ref: events.yaml
mobile_ref: mobile.yaml
migrations: migrations
uninstall_policy: keep_data
i18n: i18n
health_check: "app.plugins.modules.nepal_curriculum.hooks:health_check"
roles_visible_to: ["superadmin", "school_admin", "teacher", "student"]
```

Manifest, continued — UI surfaces:

```yaml
ui:
  nav:
    route: "/dashboard/curriculum"
    section: "Learning"
    label: "Curriculum Content"
    label_nepali: "पाठ्यक्रम सामग्री"
    icon: "BookOpen"
    order: 30
    visible_to: ["superadmin", "school_admin", "teacher"]
    requires_permissions: []
    subitems:
      - { label: "Chapters",        label_nepali: "अध्यायहरू",     route: "/dashboard/curriculum/sections" }
      - { label: "Authoring Queue", label_nepali: "लेखन सूची",      route: "/dashboard/curriculum/queue",
          requires_permissions: ["curriculum.review"] }
      - { label: "Exercise Bank",   label_nepali: "अभ्यास बैंक",    route: "/dashboard/curriculum/exercises" }
      - { label: "Bulk Import",     label_nepali: "बल्क आयात",      route: "/dashboard/curriculum/import",
          requires_permissions: ["curriculum.publish"] }
      - { label: "Coverage",        label_nepali: "कभरेज",          route: "/dashboard/curriculum/coverage" }
  settings_sections: ["authoring", "language", "grounding", "exercises"]

mobile:
  student:
    module: "chapters"
    tabs: ["My Chapters", "Exercise Practice"]
  teacher:
    module: "chapters"
    tabs: ["Chapters", "Exercise Bank"]
  admin:
    module: "curriculum"
    tabs: ["Authoring Queue", "Coverage"]

template_packs: []
theme_contributions: []

events:
  emits:
    - "curriculum.section_published"
    - "curriculum.section_archived"
    - "curriculum.exercise_added"
  consumes:
    - "exams.result_published"
```

`events.yaml` (typed form required by `D2 §A.1`):

```yaml
emits:
  - name: "curriculum.section_published"
    payload: { section_id: uuid, version_id: uuid, unit_id: uuid, school_id: uuid|null, language_coverage: object }
    scope: school
    async: true
  - name: "curriculum.section_archived"
    payload: { section_id: uuid, version_id: uuid, school_id: uuid|null }
    scope: school
    async: true
  - name: "curriculum.exercise_added"
    payload: { question_bank_item_id: uuid, school_id: uuid, section_id: uuid|null, source: string }
    scope: school
    async: true
consumes:
  - name: "exams.result_published"
    handler: "on_result_published"     # marks weak units → surfaces "needs a revision section"
    order: 50
```

`permissions.yaml`:

```yaml
permissions:
  - key: curriculum.author
    label: "Author chapter content"
    label_ne: "अध्याय सामग्री लेख्न"
    description: "Create and edit draft sections, notes, examples, formulas, exercises."
    default_roles: ["teacher", "school_admin", "superadmin"]
    implies: []
  - key: curriculum.review
    label: "Review submitted content"
    label_ne: "पेश गरिएको सामग्री समीक्षा"
    description: "Approve or reject sections in in_review."
    default_roles: ["school_admin", "superadmin"]
    implies: ["curriculum.author"]
  - key: curriculum.publish
    label: "Publish chapter content"
    label_ne: "सामग्री प्रकाशित गर्न"
    description: "Publish a reviewed version; publishing platform rows needs superadmin."
    default_roles: ["school_admin", "superadmin"]
    implies: ["curriculum.review"]
  - key: curriculum.publish_platform
    label: "Publish PLATFORM content (all schools)"
    label_ne: "प्लेटफर्म सामग्री प्रकाशित"
    description: "Publish rows with school_id NULL — visible to every school."
    default_roles: ["superadmin"]
    implies: ["curriculum.publish"]
```

## B.5 `nepal_curriculum/config_schema.yaml` — literal, every field

Dialect matches the live examples (`backend/app/plugins/modules/library_management/config_schema.yaml`) plus
the v2 `{schema_version, groups[], fields[]}` shape of `D2 §A.1`. Every field names its real consumer —
the discipline the library_management schema comments demand ("the fallback defaults there MUST mirror the
defaults below"). Values live in `SchoolPlugin.config` JSONB, read via
`app.plugins.config_store.plugin_config_value` (`backend/app/plugins/config_store.py:49-55`).

```yaml
schema_version: 2
groups:
  - { key: authoring,  label: "Authoring & review",     label_ne: "लेखन र समीक्षा" }
  - { key: language,   label: "Language policy",         label_ne: "भाषा नीति" }
  - { key: grounding,  label: "AI grounding",            label_ne: "एआई ग्राउन्डिङ" }
  - { key: exercises,  label: "Exercise bank",           label_ne: "अभ्यास बैंक" }

fields:
  # ── authoring ────────────────────────────────────────────────────────────
  - key: authoring.require_review
    group: authoring
    label: "Require a second person to review before publish"
    type: boolean
    default: true
    help: "When on, draft → in_review → published. When off, an author with curriculum.publish may publish their own draft. Consumer: services/content_resolver.publish_gate."
  - key: authoring.allow_school_overrides
    group: authoring
    label: "Allow this school to override platform chapters"
    type: boolean
    default: true
    help: "Off = the school always reads platform content and cannot fork a section. Consumer: routes.fork_section (403 when off)."
  - key: authoring.default_estimated_minutes
    group: authoring
    label: "Default teaching minutes per section"
    type: number
    default: 12
    min: 1
    max: 240
    help: "Prefills teaching_sections.estimated_minutes on the create form."
  - key: authoring.default_difficulty
    group: authoring
    label: "Default section difficulty"
    type: select
    options: ["foundation", "core", "stretch"]
    default: "core"
    help: "Prefills teaching_sections.difficulty."
  - key: authoring.autosave_seconds
    group: authoring
    label: "Editor autosave interval (seconds)"
    type: number
    default: 20
    min: 0
    max: 300
    help: "0 disables autosave in the block editor. Client-side only."

  # ── language ─────────────────────────────────────────────────────────────
  - key: language.require_nepali
    group: language
    label: "Require Nepali for every primary field before publish"
    type: boolean
    default: false
    help: "The publish gate of D1 §B.3: when true, any missing *_ne primary field blocks publish. When false a section may ship EN-only and language_coverage.ne stays false — the launcher then says Nepali is unavailable rather than machine-translating."
  - key: language.primary
    group: language
    label: "Primary content language"
    type: select
    options: ["ne", "en"]
    default: "ne"
    help: "Which column the reader shows first; the other goes behind the 'View in Nepali/English' disclosure."
  - key: language.keep_terms_in_english_default
    group: language
    label: "Default keep_in_english for new key terms"
    type: boolean
    default: true
    help: "Prefills teaching_key_terms.keep_in_english — Nepali academic register keeps most technical nouns in English."
  - key: language.devanagari_numerals
    group: language
    label: "Render numbers in Devanagari numerals (०-९)"
    type: boolean
    default: false
    help: "Reader/print only; stored values stay ASCII. Consumer: frontend nepali-utils.nepaliNumerals."

  # ── grounding ────────────────────────────────────────────────────────────
  - key: grounding.enabled
    group: grounding
    label: "Ground AI tools in published chapter content"
    type: boolean
    default: true
    help: "Off = AI tools ignore this school's chapter content entirely (no context block). Consumer: tool_handlers.context_chapter."
  - key: grounding.excerpt_chars
    group: grounding
    label: "Max characters of chapter body injected"
    type: number
    default: 1500
    min: 200
    max: 8000
    help: "Sahayatri used 1400 for tools and 6000 for the voice tutor (BC §4.3). Raising this raises token cost per call linearly."
  - key: grounding.tutor_excerpt_chars
    group: grounding
    label: "Max characters injected for tutor sessions"
    type: number
    default: 4000
    min: 200
    max: 12000
    help: "Separate, larger budget for multi-turn tutoring."
  - key: grounding.include_exam_tips
    group: grounding
    label: "Include exam tips in the grounding block"
    type: boolean
    default: true
    help: "Some schools object to teaching to the exam; this removes teaching_exam_tips from the injected context."
  - key: grounding.include_misconceptions
    group: grounding
    label: "Include common misconceptions in the grounding block"
    type: boolean
    default: true
    help: "Feeds teaching_misconceptions so the tutor can probe with the authored diagnostic question."
  - key: grounding.unauthored_behaviour
    group: grounding
    label: "When a chapter has no published content"
    type: select
    options: ["refuse", "warn_and_continue"]
    default: "refuse"
    help: "'refuse' returns 422 'this chapter has not been authored yet' (D1 §B: unauthored chapter ⇒ refused, not hallucinated). 'warn_and_continue' answers from general knowledge with used_chapter_context=false and a visible warning."

  # ── exercises ────────────────────────────────────────────────────────────
  - key: exercises.duplicate_threshold
    group: exercises
    label: "Duplicate-question similarity threshold"
    type: number
    default: 0.72
    min: 0.5
    max: 1.0
    step: 0.01
    help: "Jaccard token similarity above which the editor warns 'this looks like an existing question'. Sahayatri's tuned value was 0.72 (SI §3.2)."
  - key: exercises.autotag_bloom
    group: exercises
    label: "Auto-suggest Bloom level from question wording"
    type: boolean
    default: true
    help: "Runs the deterministic Nepali+English verb tagger (no AI call, no cost). Suggestion only — the author confirms."
  - key: exercises.require_marks
    group: exercises
    label: "Require marks on every exercise"
    type: boolean
    default: false
    help: "On = the exercise form will not save without marks; needed if the school builds papers straight from the bank."
  - key: exercises.default_source_label
    group: exercises
    label: "Default source reference text"
    type: string
    default: "CDC textbook"
    help: "Prefills the typed source_reference, e.g. 'CDC Class 10 Opt. Math 2082'."
  - key: exercises.allow_teacher_publish
    group: exercises
    label: "Teachers may add exercises directly to the school bank"
    type: boolean
    default: true
    help: "Off = teacher submissions land as is_approved=false and need curriculum.review. Consumer: routes.create_exercise."
```

## B.6 `ai_suite` manifest and config changes

`ai_suite` needs **no new gate and no version bump of its pricing**. Two additive changes:

**(a) `manifest.yaml`** — the sidebar gains the tool-catalog entry (the catalog page exists at
`frontend/app/dashboard/ai-workbench/page.tsx` but is not in the manifest's `subitems`, which today list AI
Tools / Analytics / Benchmarking / Reports, `ai_suite/manifest.yaml:41-44`), and the Flutter surfaces gain
the student tool tabs:

```yaml
frontend:
  route: "/dashboard/ai-tools"
  sidebar:
    section: "Insights"
    label: "AI Suite"
    label_nepali: "एआई सुइट"
    icon: "Sparkles"
    subitems:
      - { label: "AI Tools",       route: "/dashboard/ai-tools" }
      - { label: "Tool Catalog",   route: "/dashboard/ai-workbench" }      # NEW
      - { label: "Tutor",          route: "/dashboard/ai-workbench/tutor" } # NEW
      - { label: "Analytics",      route: "/dashboard/analytics" }
      - { label: "Benchmarking",   route: "/dashboard/benchmarking" }
      - { label: "Reports",        route: "/dashboard/reports" }
    visible_to: ["school_admin", "teacher"]

flutter:
  teacher_app: { feature_folder: "ai_suite", tabs: ["Tools", "Grading", "Insights"] }
  student_app: { feature_folder: "ai_suite", tabs: ["Tutor", "Tools", "Practice"] }  # "Tools" is NEW
```

**(b) `ai_suite/config_schema.yaml`** — today it has exactly two fields, `default_language` and
`default_teaching_method` (`ai_suite/config_schema.yaml:6-16`). Append the fields the ported capabilities
need. Existing two are kept verbatim so no stored config migrates.

```yaml
schema_version: 2
groups:
  - { key: generation, label: "Generation defaults",  label_ne: "उत्पादन पूर्वनिर्धारित" }
  - { key: voice,      label: "Voice (TTS / STT)",    label_ne: "आवाज" }
  - { key: student,    label: "Student tools",        label_ne: "विद्यार्थी उपकरण" }
  - { key: cost,       label: "Cost visibility",      label_ne: "लागत" }

fields:
  # ── existing, unchanged ──────────────────────────────────────────────────
  - key: default_language
    group: generation
    label: "Default generation language"
    type: string
    default: "english"
    help: "Used for lesson plans etc. when the request doesn't pick one (english|nepali)."
  - key: default_teaching_method
    group: generation
    label: "Default teaching method"
    type: string
    default: "interactive"
    help: "Used for lesson plans when the request doesn't specify one."

  # ── new: generation ──────────────────────────────────────────────────────
  - key: generation.autodetect_language
    group: generation
    label: "Detect Nepali input and reply in Nepali"
    type: boolean
    default: true
    help: "Devanagari regex on the user's input overrides default_language for that call (ported from BC §4.2)."
  - key: generation.nepal_first_prompt
    group: generation
    label: "Apply the Nepal-first system prefix to every tool"
    type: boolean
    default: true
    help: "Prepends the NEB/SEE/CDC grounding + 'never give exam answers directly' rules to every system prompt. Consumer: services/ai/workbench._system_prompt."
  - key: generation.allow_deterministic_fallback
    group: generation
    label: "Answer from authored content when no AI provider is reachable"
    type: boolean
    default: true
    help: "Returns a labelled fallback assembled from published chapter blocks (fallback_used=true, source_note set) instead of a 502. Never silent."

  # ── new: voice ───────────────────────────────────────────────────────────
  - key: voice.tts_enabled
    group: voice
    label: "Enable text-to-speech playback"
    type: boolean
    default: true
    help: "Metered as feature 'tts:speak' on ai_usage_logs."
  - key: voice.tts_voice_ne
    group: voice
    label: "Nepali voice"
    type: select
    options: ["ne-NP-SagarNeural", "ne-NP-HemkalaNeural"]
    default: "ne-NP-HemkalaNeural"
    help: "edge-tts voice id used for Nepali playback."
  - key: voice.tts_voice_en
    group: voice
    label: "English voice"
    type: select
    options: ["en-US-AriaNeural", "en-US-GuyNeural"]
    default: "en-US-AriaNeural"
    help: "edge-tts voice id used for English playback."
  - key: voice.stt_enabled
    group: voice
    label: "Enable voice input (speech to text)"
    type: boolean
    default: true
    help: "Whisper via AITokenHub; metered as 'stt:transcribe'. Audio is transcribed and discarded — never stored."
  - key: voice.stt_language_hint
    group: voice
    label: "Speech language hint"
    type: select
    options: ["ne", "en", "auto"]
    default: "ne"
    help: "Passed to Whisper; 'auto' lets the model decide (lower accuracy for Nepali)."

  # ── new: student ─────────────────────────────────────────────────────────
  - key: student.tools_enabled
    group: student
    label: "Let students use AI tools directly"
    type: boolean
    default: true
    help: "Off = only staff roles see the catalog. Independent of guardian consent, which is always required (AW-04)."
  - key: student.max_daily_generations
    group: student
    label: "Max AI generations per student per day"
    type: number
    default: 30
    min: 0
    max: 500
    help: "0 = unlimited (still bounded by the school AI quota). Enforced from ai_tool_analytics_daily + a per-student counter."
  - key: student.show_followups
    group: student
    label: "Show 'Try next' follow-up chips"
    type: boolean
    default: true
  - key: student.offline_cache_hours
    group: student
    label: "Cache AI results on the student app (hours)"
    type: number
    default: 24
    min: 0
    max: 168
    help: "0 disables the on-device result cache. Ported from the whiteboard's two-tier cache (UX §3.2)."

  # ── new: cost ────────────────────────────────────────────────────────────
  - key: cost.show_cost_badges
    group: cost
    label: "Show per-tool cost tier badges"
    type: boolean
    default: true
    help: "Renders the tool's `budget` tier as green/amber/red before the user spends (ported UX pattern, A.6 #62)."
  - key: cost.show_school_headroom
    group: cost
    label: "Show remaining school AI headroom to staff"
    type: boolean
    default: true
    help: "Header chip reading remaining % of AISchoolQuota; hidden from students."
```

---

# C. DATA MODEL

Every candidate Sahayatri table was checked against `app/models/question_bank.py`, `curriculum.py`,
`lms.py`, `adaptive_learning.py`, `gamification.py`, `ai_workbench.py`, `digital_content.py`, and
additionally `exam.py`, `academic.py`, `ai_token.py`, `student.py`, `document_chunk.py`, `file.py`.

## C.0 De-duplication verdicts — summary

| Sahayatri table | Verdict | Target |
|---|---|---|
| `subject_topics` (chapter body) | **DO NOT ADD** | `curriculum_units` + `teaching_sections`/`teaching_section_versions`/`teaching_notes` (`D1 §B.2`) |
| `exercise_blocks` | **DO NOT ADD — EXTEND** | `question_bank_items` (+7 columns, enum widened) |
| `chapter_ai_context` | **DO NOT ADD** | the 5 D1 block tables (examples/misconceptions/formulas/exam_tips/key_terms) + `teaching_section_versions.summary_*` |
| `content_import_jobs`, `import_job_pages`, `draft_chapters`, `draft_exercise_blocks` | **DO NOT ADD** | dead with OCR; workflow = `teaching_section_versions.status` + `teaching_content_reviews` |
| `spaced_rep_cards` | **ADD (new, no overlap)** | `spaced_rep_cards` scoped to `school_id` + `students.id` |
| `student_gamification` + `xp_events` | **PARTIAL — ADD 1, REUSE 1** | new `student_xp_state`; XP events reuse `points_logs` |
| `learning_paths` | **DO NOT ADD** | `learning_paths` already exists (`adaptive_learning.py:31`) — add 3 columns |
| `ai_tools` | **DO NOT ADD — EXTEND** | `ai_tool_registry` (+9 columns, 5 already specified by `D1 §C.3`) |
| `ai_sessions` | **DO NOT ADD** | `tutor_sessions` + `tutor_messages` (`ai_workbench.py:166-196`) |
| `token_usage_log` | **DO NOT ADD** | `ai_usage_logs` + `ai_generations` |
| `subscription_plans`, `user_subscriptions` | **DO NOT ADD** | `plugins`/`school_plugins` + `ai_school_quotas` |
| `sketchfab_models`, `simulation_panels` | **DO NOT ADD — EXTEND** | `oer_resources` (+6 columns) |
| `whiteboard_boards`, `whiteboard_sessions`, `live_class_participants`, `live_polls` | **DO NOT ADD** | cancelled (constraint 2); `live_classes` covers scheduled delivery |
| `question_papers` | **DO NOT ADD** | `paper_blueprints` + `generated_papers` |
| `study_materials` | **DO NOT ADD** | `study_materials` already exists (`lms.py:76`) |
| `pdf_documents` | **DO NOT ADD** | `managed_files` + `digital_books` + `document_chunks` |
| `community_posts` | **DEFERRED** | out of scope (A.6 #66) |
| `institution_api_keys` | **DEFERRED** | out of scope (A.6 #63) |
| — | **ADD (new, no overlap)** | `live_quiz_sessions` (durable record behind the Redis room) |
| — | **ADD (new, no overlap)** | `exercise_section_links` (join: question ↔ chapter section) |

Net new tables introduced by this spec beyond the 12 already locked by `D1 §B.2`: **4** —
`spaced_rep_cards`, `student_xp_state`, `live_quiz_sessions`, `exercise_section_links`. Everything else is a
column addition to a table that already exists.

## C.1 Exercise blocks → EXTEND `question_bank_items` (the most important de-dup call)

**Overlap analysis.** Sahayatri `exercise_blocks` (`S:backend/app/models/exercise_block.py`) vs ASchool
`question_bank_items` (`backend/app/models/question_bank.py:16-68`):

| Sahayatri column | ASchool equivalent | Gap |
|---|---|---|
| `exercise_markdown` | `question_text` (Text) | none — store markdown in `question_text`; the reader already needs a math-capable renderer |
| — | `question_text_nepali` | ASchool is **better**: Sahayatri had one text column and separate `_ne` only on topics |
| `detected_type` (String(50), 14-value vocabulary) | `question_type` **Enum, 7 values** | **THE GAP.** `mcq, short_answer, long_answer, true_false, fill_blank, match, numerical` — missing `proof`, `construction`, `comprehension`, `diagram_based`, `activity`, `map_work`, `mixed`, `definition`. This is precisely the failure `SI §1` problem 3 describes: "forcing an MCQ schema destroys data" |
| `detected_marks` (int) | `marks` (Numeric(5,2)) | ASchool better (half marks exist in NEB) |
| `bloom_level` | `bloom_level` (String(50)) | identical |
| `difficulty` | `difficulty` Enum(easy/medium/hard) | identical |
| `subject_id`, `class_grade_id`, `topic_id` | `subject_id`, `class_id`, `topic` (String!) | `topic` is a free-text string; needs a real FK to the authored section |
| `institution_id` | `school_id` (NOT NULL, `SchoolModel`) | ASchool better — real tenancy |
| `source` (govt_textbook/institution_upload/manual/ai_generated) | `source` Enum(manual/ai) | needs 2 more values |
| `source_reference`, `source_exercise_label`, `source_page` | — | **missing**: "CDC Class 10 Opt Math 2082", "अभ्यास १.२", page 47 |
| `has_math`, `has_image_reference`, `has_sub_parts`, `sub_part_count` | — | **missing**; drive answer-space height in the paper emitter (`D1 §C.4`) and the KaTeX preview |
| `tags` ARRAY(Text) | — | **missing** (`options`/`ai_metadata` are JSONB but semantically different) |
| `is_active` | `is_deleted` (BaseModel) | covered |
| `created_by` | `created_by_id` | identical |
| — | `options`, `correct_answer`, `explanation`, `times_used`, `is_approved` | ASchool better — Sahayatri had **no answer storage at all** |

**Verdict: EXTEND. A separate `exercise_blocks` table would fork the question pool** — papers, blueprints,
`times_used` analytics and `is_approved` review would all only see half the questions, and
`GeneratedPaper.questions[].bank_item_id` (`question_bank.py:118-120`) would dangle. Migration:

```sql
-- 1. Widen the type vocabulary (Nepal typology, SI §8). Postgres enums are
--    append-only, so ALTER TYPE ... ADD VALUE, one statement each, no rewrite.
ALTER TYPE question_bank_type ADD VALUE IF NOT EXISTS 'proof';
ALTER TYPE question_bank_type ADD VALUE IF NOT EXISTS 'construction';
ALTER TYPE question_bank_type ADD VALUE IF NOT EXISTS 'comprehension';
ALTER TYPE question_bank_type ADD VALUE IF NOT EXISTS 'diagram_based';
ALTER TYPE question_bank_type ADD VALUE IF NOT EXISTS 'activity';
ALTER TYPE question_bank_type ADD VALUE IF NOT EXISTS 'map_work';
ALTER TYPE question_bank_type ADD VALUE IF NOT EXISTS 'definition';
ALTER TYPE question_bank_type ADD VALUE IF NOT EXISTS 'mixed';

ALTER TYPE question_source ADD VALUE IF NOT EXISTS 'textbook';       -- typed from a CDC book
ALTER TYPE question_source ADD VALUE IF NOT EXISTS 'past_paper';     -- typed from a school past paper

-- 2. Nepal provenance + rendering flags.
ALTER TABLE question_bank_items
  ADD COLUMN section_id            UUID        NULL REFERENCES teaching_sections(id) ON DELETE SET NULL,
  ADD COLUMN source_reference      TEXT        NULL,
  ADD COLUMN source_exercise_label VARCHAR(100) NULL,
  ADD COLUMN source_page           INTEGER     NULL,
  ADD COLUMN has_math              BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN has_image_reference   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN has_sub_parts         BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN sub_part_count        INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN tags                  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN answer_markdown_ne    TEXT        NULL,
  ADD COLUMN content_sha256        CHAR(64)    NULL;   -- dedupe key, see C.1b

CREATE INDEX ix_qbi_school_section  ON question_bank_items (school_id, section_id);
CREATE INDEX ix_qbi_school_type     ON question_bank_items (school_id, question_type);
CREATE INDEX ix_qbi_school_bloom    ON question_bank_items (school_id, bloom_level);
CREATE INDEX ix_qbi_tags_gin        ON question_bank_items USING gin (tags jsonb_path_ops);
CREATE UNIQUE INDEX uq_qbi_school_sha
  ON question_bank_items (school_id, content_sha256) WHERE is_deleted = false;
```

`content_sha256` = SHA-256 of `lower(regexp_replace(question_text,'\s+',' ','g'))`, computed in the service
layer. It makes **exact** re-entry impossible; near-duplicates are the Jaccard check (C.1b), which warns
rather than blocks because two chapters legitimately share a question.

### C.1b Duplicate detection service (ported)

`services/dedupe.py`, ported from `S:backend/app/services/duplicate_detection_service.py:14`:

```
normalize(t)  = lowercase, strip LaTeX delimiters, collapse whitespace, drop
                Devanagari + ASCII punctuation, drop leading numbering
                ("१.", "2.", "(क)", "(a)")
tokens(t)     = set(normalize(t).split())
jaccard(a,b)  = |A ∩ B| / |A ∪ B|
candidates    = question_bank_items WHERE school_id = :s AND is_deleted = false
                AND (section_id = :sec OR subject_id = :subj)
                AND char_length(question_text) BETWEEN len*0.6 AND len*1.6
duplicate?    = max(jaccard) >= config exercises.duplicate_threshold  (default 0.72)
```

Returns `[{item_id, similarity, question_text_excerpt}]` sorted desc, top 5. The length pre-filter keeps the
scan bounded without a trigram index; add `pg_trgm` on `question_text` only if a school's bank exceeds ~20 k
rows.

### C.1c Exercise ↔ section links: `exercise_section_links` (NEW)

`question_bank_items.section_id` covers "this question belongs to this chapter" (the common case). A join
table is still needed because revision/mock papers legitimately draw one question across several chapters,
and the SM-2 seeder must know every chapter a card can be surfaced under.

```sql
CREATE TABLE exercise_section_links (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id             UUID NOT NULL REFERENCES schools(id),
    question_bank_item_id UUID NOT NULL REFERENCES question_bank_items(id) ON DELETE CASCADE,
    section_id            UUID NOT NULL REFERENCES teaching_sections(id)  ON DELETE CASCADE,
    relation              VARCHAR(20) NOT NULL DEFAULT 'practice',
        -- CHECK (relation IN ('practice','example','assessment','revision'))
    sort_order            INTEGER NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted            BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT ck_esl_relation CHECK (relation IN ('practice','example','assessment','revision')),
    CONSTRAINT uq_esl UNIQUE (question_bank_item_id, section_id, relation)
);
CREATE INDEX ix_esl_section ON exercise_section_links (school_id, section_id, sort_order);
CREATE INDEX ix_esl_item    ON exercise_section_links (question_bank_item_id);
```

## C.2 Chapter AI Context → the D1 block tables (field-by-field kill)

`chapter_ai_context` (`S:backend/app/models/chapter_ai_context.py`) is one row per topic holding five JSONB
arrays. `D1 §B.2` already specified relational tables for the same five things, each versioned and citable.
Mapping:

| `chapter_ai_context` field | Type there | Goes to | Why the D1 form is better |
|---|---|---|---|
| `chapter_summary` | Text | `teaching_section_versions.summary_en` | versioned; one published version guaranteed by `uq_tsv_one_published` |
| `chapter_summary_ne` | Text | `teaching_section_versions.summary_ne` | same |
| `key_definitions` | JSONB array | **`teaching_key_terms`** rows (`term_en`, `term_ne`, `keep_in_english`, `definition_en/ne`) | `keep_in_english` is a real editorial decision per term; unrepresentable in a blob. Unique `(version_id, term_en)` stops the same term being typed twice |
| `theorems_and_rules` | JSONB array | **`teaching_formulas`** rows with `derivable=true` | adds `spoken_en/ne` (**TTS reads this, never the LaTeX** — `D1 §B.2`), `symbols[]`, `conditions`, `must_memorize` |
| `key_formulas` | JSONB array | **`teaching_formulas`** rows | same |
| `worked_examples` | JSONB array | **`teaching_examples`** rows (`kind='worked'`, `steps` JSONB `[{n,en,ne,latex,why_en,why_ne}]`, `answer_latex`, `marks`) | per-step bilingual + a `why` per step is what makes the solver template (§E.4) and the tutor's hint ladder possible |
| `common_mistakes` | JSONB array | **`teaching_misconceptions`** rows | adds `why_students_think_*`, `diagnostic_question_*` (the probe the tutor asks), `severity`, `linked_outcome_id` |
| `exam_tips_ne` | Text (Nepali only!) | **`teaching_exam_tips`** rows | bilingual, typed (`frequent`/`trap`/`marking_scheme`/`time_management`/`presentation`), linked to `subject_offerings` for real mark weights |
| `real_world_applications_ne` | Text | `teaching_notes` block, `block_type='explanation'` | becomes ordered, bilingual, media-attachable content |
| `connections_to_other_topics` | ARRAY(Text) | `teaching_sections.prerequisite_section_ids UUID[]` | real FKs instead of free text, so the prerequisite checker can actually navigate |
| `generated_by_model`, `generation_prompt_version`, `token_cost` | provenance | `teaching_section_versions.ai_generation_id` → `ai_generations` (provider, model, `prompt_sha256`, `cost_usd`) | the platform's single provenance ledger (`ai_workbench.py:20-47`) |
| `status` draft/published | String(20) | `teaching_section_versions.status` (5 states) + `teaching_content_reviews` audit | full state machine with an audit trail; Sahayatri had 2 states and no audit |
| `approved_by`, `approved_at` | FK + ts | `reviewed_by_id`/`reviewed_at`/`published_by_id`/`published_at` | separates review from publish |
| `source_job_id` | FK to import job | **dropped** | no import jobs (constraint 3) |
| `topic_id` UNIQUE | FK | `teaching_sections.unit_id` + `section_no` | one *unit* now has many *sections*; Sahayatri's 1:1 topic↔context forced whole-chapter granularity |

**Verdict: DO NOT ADD `chapter_ai_context`.** Adding it would create a second, unversioned, non-citable copy
of five tables, and `ai_generations.citations` could not point at it (it cites `teaching_section_versions.id`
per `D1 §B.1`).

**What is genuinely lost and must be re-added:** the *assembled context block string* that Sahayatri
injected into prompts (`S:backend/app/services/chapter_context_service.py:41-70` builds "CHAPTER KNOWLEDGE
BASE (NEB CDC Textbook): …"). In this design that string is **derived**, not stored — built by
`services/snapshot_builder.py` and cached in `teaching_content_snapshots` (`document` JSONB,
`document_sha256`, `token_estimate`, `UNIQUE (version_id, language, document_sha256)` — `D1 §B.2`). That is
strictly better: the injected payload is content-addressed, so `ai_generations.citations` can name the exact
bytes the model saw.

## C.3 Chapter body → the D1 section/version/notes chain (no new table)

`subject_topics` (`S:backend/app/models/subject_topic.py`) vs ASchool: `curriculum_units`
(`curriculum.py:47-71`) already **is** the chapter level — `unit_no`, `title_en`, `title_ne`, `periods`,
`weight_pct`, unique `(framework_id, unit_no)`. Sahayatri's additions over that are:

| `subject_topics` field | Where it goes |
|---|---|
| `chapter_number`, `title`, `title_nepali` | `curriculum_units.unit_no`, `title_en`, `title_ne` — **already exist** |
| `learning_objectives` ARRAY(Text) | `learning_outcomes` rows (`code`, `statement_en/ne`, `bloom`) — **already exist**, and linked per-version through `teaching_section_outcomes` with `emphasis` + `mastery_key` |
| `bloom_levels` ARRAY(Text) | derived from `learning_outcomes.bloom` — do not denormalize |
| `estimated_hours` | `curriculum_units.periods` (already) + `teaching_sections.estimated_minutes` per section |
| `content_markdown`, `content_markdown_ne` | ordered `teaching_notes` rows (`block_no`, `block_type`, `heading_en/ne`, `body_en`, `body_ne`, `speaker_note_en/ne`, `board_hint`, `media_id`) |
| `content_word_count`, `content_image_count` | computed on publish into `teaching_section_versions.language_coverage` sibling stats; not stored per-topic |
| `content_extracted_at` | **dropped** — nothing is extracted; `published_at` is the real timestamp |
| `display_order`, `is_active` | `teaching_sections.section_no`, `is_active` |

One clarification that `D1 §B.2` leaves implicit and this spec fixes: **`teaching_notes.body_en` is Markdown
with LaTeX**, rendered by the same KaTeX-capable renderer the exercise bank uses. Sahayatri's core content
insight (`SI §1` problem 1) was "clean Markdown with LaTeX preserved, never a lossy structured schema"; that
survives at block granularity instead of chapter granularity.

**Verdict: DO NOT ADD `subject_topics`.** `curriculum_units` + the D1 chain covers it, and adding a parallel
chapter table would fork every FK in the design (exercises, spaced-rep cards, snapshots, citations).

## C.4 Spaced repetition → `spaced_rep_cards` (NEW — no ASchool overlap)

Checked: `adaptive_learning.py` has `LearningPath` (JSONB `steps`) and `MasteryRecord` (per subject, from
`Marks`). Neither models a per-item review schedule; there is no `ease_factor`, `interval`, `due_at` or SM-2
code anywhere in `backend/app`. This is a real gap.

```sql
CREATE TABLE spaced_rep_cards (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id             UUID NOT NULL REFERENCES schools(id),
    student_id            UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    question_bank_item_id UUID NOT NULL REFERENCES question_bank_items(id) ON DELETE CASCADE,
    section_id            UUID     NULL REFERENCES teaching_sections(id) ON DELETE SET NULL,
    -- SM-2 state (S:backend/app/services/spaced_rep_service.py:30-53)
    ease_factor           DOUBLE PRECISION NOT NULL DEFAULT 2.5,   -- floor 1.3
    interval_days         INTEGER  NOT NULL DEFAULT 0,
    repetitions           INTEGER  NOT NULL DEFAULT 0,
    lapses                INTEGER  NOT NULL DEFAULT 0,             -- new: quality<3 count
    due_at                TIMESTAMPTZ NULL,
    last_reviewed_at      TIMESTAMPTZ NULL,
    last_quality          SMALLINT NULL,                           -- 0..5, new: for stats
    status                VARCHAR(20) NOT NULL DEFAULT 'new',
        -- CHECK (status IN ('new','learning','review','graduated','suspended'))
    suspended_reason      VARCHAR(120) NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted            BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT ck_src_status  CHECK (status IN ('new','learning','review','graduated','suspended')),
    CONSTRAINT ck_src_ease    CHECK (ease_factor >= 1.3),
    CONSTRAINT ck_src_quality CHECK (last_quality IS NULL OR last_quality BETWEEN 0 AND 5)
);
CREATE UNIQUE INDEX uq_src_student_item
    ON spaced_rep_cards (student_id, question_bank_item_id) WHERE is_deleted = false;
CREATE INDEX ix_src_due      ON spaced_rep_cards (school_id, student_id, due_at)
    WHERE is_deleted = false AND status <> 'suspended';
CREATE INDEX ix_src_section  ON spaced_rep_cards (school_id, section_id);
```

Differences from Sahayatri, each deliberate: FK is `students.id` not `users.id` (Sahayatri conflated them —
`S:backend/app/models/spaced_rep_card.py:24-27`); `school_id` present so `SchoolModel.for_school` works;
`interval` renamed `interval_days` (`interval` is a Postgres type name); `lapses`, `last_quality`,
`suspended` added because the review UI shows lapse counts and teachers need to retire a bad question
without deleting the card history.

**Card auto-seeding.** Sahayatri seeded new cards from *any* active exercise when nothing was due
(`spaced_rep_service.py:96-118`). That is wrong under tenancy: seed only from
`question_bank_items WHERE school_id = :s AND is_approved = true` joined through `exercise_section_links` to
sections the student's class actually has published, ordered by `section_no`, capped at
`limit` per request.

## C.5 Gamification → 1 new table, 1 reused (partial overlap)

Checked `gamification.py`: `Badge` (name, name_nepali, `criteria` JSONB, `points_value`), `StudentBadge`
(student_id, badge_id, awarded_at, awarded_by_id), `PointsLog` (student_id, points, reason, category,
awarded_by_id, awarded_at), `House`, `Reward`. And `api/v1/gamification.py:114-198` computes leaderboards by
`SUM(points_logs.points)`.

| Sahayatri | ASchool today | Verdict |
|---|---|---|
| `student_gamification.badges` JSON array of ids | `StudentBadge` rows + `Badge` catalog | **REUSE ASchool** — a real catalog with bilingual names and criteria beats a string array. Sahayatri's 6 `BADGE_DEFS` (`S:…/gamification_service.py:27-34`) become 6 seeded `Badge` rows with `criteria` = `{"type":"streak_days","value":7}` etc. |
| `xp_events` (event_type, xp_earned, metadata) | `PointsLog` (points, reason, category) | **REUSE ASchool** — same shape. Map `event_type`→`reason`, `xp_earned`→`points`, and set `category='academic_ai'` for AI/learning events so existing behaviour/attendance points stay separable |
| `student_gamification.xp / level / streak_days / longest_streak / last_active_date / leaderboard_score` | **nothing** | **ADD.** `xp` is derivable from `SUM(points_logs)` but streaks are not: a streak needs the last-active date, and recomputing it from the log every request is an O(events) scan |

```sql
CREATE TABLE student_xp_state (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        UUID NOT NULL REFERENCES schools(id),
    student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    xp               INTEGER NOT NULL DEFAULT 0,        -- denormalized SUM(points_logs)
    level            INTEGER NOT NULL DEFAULT 1,        -- from the LEVEL_XP ladder
    streak_days      INTEGER NOT NULL DEFAULT 0,
    longest_streak   INTEGER NOT NULL DEFAULT 0,
    last_active_date DATE    NULL,
    last_level_up_at TIMESTAMPTZ NULL,                  -- new: drives the "level up!" toast
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted       BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_sxs_student UNIQUE (school_id, student_id)
);
CREATE INDEX ix_sxs_leaderboard ON student_xp_state (school_id, xp DESC) WHERE is_deleted = false;
```

`leaderboard_score` is dropped: in Sahayatri it was set to exactly `xp` on every award
(`gamification_service.py:120`), i.e. a duplicate column. The partial index on `xp DESC` serves the
leaderboard.

Constants to port verbatim (`S:…/gamification_service.py:13-34`), as module constants not DB rows, because
they are game-balance decisions the platform owns:

```python
LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000]   # 11 levels
XP_TABLE = {"login": 5, "spaced_rep_review": 10, "quiz_correct": 15,
            "quiz_perfect": 30, "streak_bonus": 20, "lesson_complete": 25,
            "exercise_submit": 10}
```

Streak logic (`gamification_service.py:80-91`) ports unchanged: same day = no change, +1 day = increment,
gap > 1 = reset to 1, `longest_streak = max(...)`; every 7th day awards `streak_bonus`.

## C.6 3D / simulations → EXTEND `oer_resources` (no new table)

`oer_resources` (`digital_content.py:51-63`) already has `title`, `description`, `resource_type`
(comment lists `video, article, simulation`), `url`, `subject_id`, `class_id`, `tags ARRAY(String)`,
`is_approved`, `school_id`. Sahayatri's `sketchfab_models` adds bilingual titles, provider identity,
licence/attribution, annotations, quiz links and a view counter.

```sql
ALTER TABLE oer_resources
  ADD COLUMN title_nepali        VARCHAR(500) NULL,
  ADD COLUMN description_nepali  TEXT         NULL,
  ADD COLUMN provider            VARCHAR(40)  NULL,   -- sketchfab | gltf | youtube | phet | other
  ADD COLUMN provider_uid        VARCHAR(120) NULL,   -- e.g. the Sketchfab model uid
  ADD COLUMN thumbnail_url       TEXT         NULL,
  ADD COLUMN licence             VARCHAR(80)  NULL,   -- CC-BY-4.0 etc. — legally required
  ADD COLUMN attribution         TEXT         NULL,   -- "Model by X, CC-BY" — must be displayed
  ADD COLUMN annotations         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN section_id          UUID         NULL REFERENCES teaching_sections(id) ON DELETE SET NULL,
  ADD COLUMN view_count          INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN metadata_cached_at  TIMESTAMPTZ  NULL;   -- oEmbed refresh marker (24 h)

CREATE UNIQUE INDEX uq_oer_provider_uid
  ON oer_resources (school_id, provider, provider_uid)
  WHERE provider_uid IS NOT NULL AND is_deleted = false;
CREATE INDEX ix_oer_section ON oer_resources (school_id, section_id);
```

`annotations` JSONB shape (produced by the `model_annotator` tool, §E.14):

```json
[{"node_name": "left_ventricle",
  "label_en": "Left ventricle", "label_ne": "बायाँ निलय",
  "description_en": "Pumps oxygenated blood into the aorta.",
  "description_ne": "अक्सिजनयुक्त रगत महाधमनीमा पम्प गर्छ।",
  "sort_order": 1}]
```

Model-linked quizzes reuse `exercise_section_links` with `relation='assessment'` when the resource has a
`section_id`; for resources with no section, the quiz is `question_bank_items.tags` containing
`resource:<uuid>`. No `simulation_panels` table — a panel is a UI arrangement, not data.

## C.7 Adaptive path → EXTEND `learning_paths` / `mastery_records` (no new table)

`LearningPath` (`adaptive_learning.py:31-96`) already stores `steps` JSONB with per-step `status`, a
`completion_rate` property, `source` (`ai|rule_based_fallback|manual`) and `source_note`. `MasteryRecord` is
per `(student, subject)` from `Marks`. Sahayatri's contribution is a **per-topic** signal derived from SM-2
ease factors plus a human-readable `reason`. Both fit as columns:

```sql
ALTER TABLE learning_paths
  ADD COLUMN section_id      UUID  NULL REFERENCES teaching_sections(id) ON DELETE SET NULL,
  ADD COLUMN evidence        JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN generated_at    TIMESTAMPTZ NULL;

ALTER TABLE mastery_records
  ADD COLUMN section_id      UUID   NULL REFERENCES teaching_sections(id) ON DELETE SET NULL,
  ADD COLUMN avg_ease_factor DOUBLE PRECISION NULL,
  ADD COLUMN cards_total     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN cards_due       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN reason          TEXT   NULL;
```

`mastery_records` currently has `UNIQUE (school_id, student_id, subject)`; per-section rows need that relaxed
to allow one row per section:

```sql
ALTER TABLE mastery_records DROP CONSTRAINT uq_mastery_school_student_subject;
CREATE UNIQUE INDEX uq_mastery_student_subject_nosection
  ON mastery_records (school_id, student_id, subject) WHERE section_id IS NULL;
CREATE UNIQUE INDEX uq_mastery_student_section
  ON mastery_records (school_id, student_id, section_id) WHERE section_id IS NOT NULL;
```

Existing subject-level rows keep `section_id IS NULL` and their uniqueness; nothing migrates.

`learning_paths.evidence` carries the numbers behind the recommendation so the row can explain itself
(`UX §4.7`) without a second query:

```json
{"avg_ease_factor": 1.94, "cards_total": 12, "cards_due": 5,
 "last_reviewed_at": "2026-08-30T04:12:00Z", "band": "needs_work",
 "signal": "sm2", "subject_avg_score": 41.5}
```

Banding, ported from Sahayatri's UI thresholds (`UX §1.5`, `S:…/adaptive_service.py`): `avg_ease ≥ 2.5`
Strong · `≥ 2.1` Moderate · `< 2.1` Needs work; `< 2.1` is also the "weak topic" trigger.
`reason` is a **template-filled string, not an LLM output** — e.g. `"5 of 12 cards are overdue and your
average recall is weak (ease 1.94)"` — so it costs nothing and can never hallucinate. When an LLM *does*
write a path, `source='ai'` and the generation is on the ledger, exactly as the existing column intends.

## C.8 Live quiz → `live_quiz_sessions` (NEW) + Redis room state

Sahayatri kept live quizzes **only** in Redis (`S:backend/app/api/quiz/live_quiz_routes.py:20-34`, 4 h TTL).
`SI §9` names Redis-only persistence "the single biggest Sahayatri architectural mistake" and `SI §10` says
"use DB-first with Redis cache". `OnlineExam`/`OnlineExamAttempt` (`exam.py:168-205`) hold the *questions* and
*attempts*, but nothing models a live room, join code, or host.

```sql
CREATE TABLE live_quiz_sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         UUID NOT NULL REFERENCES schools(id),
    online_exam_id    UUID NULL REFERENCES online_exams(id) ON DELETE SET NULL,
    host_user_id      UUID NOT NULL REFERENCES users(id),
    class_id          UUID NULL REFERENCES classes(id),
    section_id        UUID NULL REFERENCES sections(id),
    subject_id        UUID NULL REFERENCES subjects(id),
    join_code         VARCHAR(8)  NOT NULL,           -- 6 chars, A-Z2-9 (no O/0/I/1)
    title             VARCHAR(300) NOT NULL,
    question_count    INTEGER NOT NULL DEFAULT 0,
    current_index     INTEGER NOT NULL DEFAULT -1,    -- -1 = lobby
    status            VARCHAR(20) NOT NULL DEFAULT 'lobby',
        -- lobby | running | paused | ended | abandoned
    points_per_correct INTEGER NOT NULL DEFAULT 10,
    speed_bonus       BOOLEAN NOT NULL DEFAULT false,
    started_at        TIMESTAMPTZ NULL,
    ended_at          TIMESTAMPTZ NULL,
    leaderboard       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- final, written on end
    participant_count INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted        BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT ck_lqs_status CHECK (status IN ('lobby','running','paused','ended','abandoned'))
);
-- A join code must be unique among LIVE rooms only, so codes can be recycled.
CREATE UNIQUE INDEX uq_lqs_active_code ON live_quiz_sessions (join_code)
    WHERE status IN ('lobby','running','paused');
CREATE INDEX ix_lqs_school_status ON live_quiz_sessions (school_id, status, created_at DESC);
CREATE INDEX ix_lqs_host          ON live_quiz_sessions (school_id, host_user_id);
```

Per-participant answers persist as ordinary `OnlineExamAttempt` rows on end (one per student, `answers`
JSONB, server-computed `score`) — no second attempt table. Redis holds only the hot room state (§F.4).

## C.9 Tables NOT added, with the one-line reason

| Sahayatri table | Reason it is not added |
|---|---|
| `ai_tools` | `ai_tool_registry` exists (`ai_workbench.py:82`); §D extends it |
| `ai_sessions` (conversation_history JSON) | `tutor_sessions` + `tutor_messages` (`ai_workbench.py:166-196`) — normalized turns, per-message `generation_id`, per-message `flagged`/`flag_severity`. A JSON blob cannot be moderated per turn |
| `token_usage_log` | `ai_usage_logs` (`ai_token.py:31`) has provider/model/prompt+completion tokens/latency/cost_usd/cost_npr; `ai_generations` adds prompt_sha256 + schema_name |
| `subscription_plans`, `user_subscriptions` | `plugins` + `school_plugins` (per-school install/billing) + `ai_school_quotas` (cost budget). Per-user token wallets contradict per-school cost quotas |
| `institutions`, `institution_classes`, `student_enrollments`, `teacher_class_assignments` | `schools`, `classes`, `sections`, `students`, `staff` (`academic.py`, `student.py`) |
| `question_papers` | `paper_blueprints` + `generated_papers` (`question_bank.py:71-141`) |
| `study_materials` | `study_materials` (`lms.py:76`) |
| `pdf_documents` | `managed_files` (`file.py:39`) + `digital_books` + `document_chunks` for RAG |
| `whiteboard_boards`, `whiteboard_sessions` | cancelled (constraint 2) |
| `live_class_participants`, `live_polls` | `live_classes` (`lms.py:93-112`) covers scheduling; polls become live-quiz questions |
| `simulation_panels`, `sketchfab_models` | `oer_resources` extended (§C.6) |
| `content_import_jobs`, `import_job_pages`, `draft_chapters`, `draft_exercise_blocks`, `institution_paper_uploads(_exercises)` | ingestion cancelled (constraint 3); versions + reviews carry the workflow |
| `community_posts` | deferred (A.6 #66) |
| `institution_api_keys` | deferred (A.6 #63) |
| `class_grades`, `subjects`, `subject_topics` | `classes`, `subjects`, `curriculum_units` |
| `spaced_rep_cards` (as-is) | added but re-keyed to `students.id` + `school_id` (§C.4) |
| `student_gamification` | split: state → `student_xp_state`, events → `points_logs` (§C.5) |
| `learning_paths` (as-is) | `learning_paths` exists; 3 columns added (§C.7) |
| `chapter_ai_context` | 5 D1 block tables + version summary (§C.2) |
| `exercise_blocks` | `question_bank_items` + 11 columns + widened enums (§C.1) |

## C.10 Migration ordering

One Alembic revision per slice (§H), each `depends_on` the platform head at authoring time, files under
`backend/app/plugins/modules/nepal_curriculum/migrations/versions/` added to `version_locations` in
`backend/migrations/alembic.ini` (`D2 §A.3`).

1. `nc_0001_teaching_content` — the 12 D1 tables, their partial unique indexes
   (`uq_tsv_one_published` is the load-bearing one), and the deferred `teaching_notes.media_id` FK.
2. `nc_0002_question_bank_nepal` — enum `ADD VALUE` statements first in their own transaction (Postgres
   forbids using a new enum value in the same transaction that adds it), then the `question_bank_items`
   columns + indexes, then `exercise_section_links`.
3. `nc_0003_registry_columns` — the 9 `ai_tool_registry` columns (§D.1).
4. `nc_0004_learning` — `spaced_rep_cards`, `student_xp_state`, `learning_paths`/`mastery_records` columns
   and the uniqueness swap.
5. `nc_0005_live_quiz` — `live_quiz_sessions`.
6. `nc_0006_oer_3d` — `oer_resources` columns.

Every table inherits the platform base contract: UUID PK `gen_random_uuid()`, TIMESTAMPTZ
`created_at`/`updated_at` with server defaults, `is_deleted BOOLEAN NOT NULL DEFAULT false`
(`backend/app/models/base.py:11-43`); every school-scoped table carries
`school_id UUID NOT NULL REFERENCES schools(id)` and is indexed on it (`base.py:44-52`). Platform-level
content rows are the documented exception: `teaching_sections.school_id` and
`curriculum_frameworks.school_id` are **nullable**, NULL meaning "platform, visible to all schools"
(`curriculum.py:21`, `D1 §B.2`).

---

# D. TOOL CATALOG MECHANISM

## D.1 Columns to add to `ai_tool_registry` — exact list

Existing columns (`backend/app/models/ai_workbench.py:82-112`): `tool_key` (unique), `name`, `name_ne`,
`category`, `description`, `description_ne`, `min_plan_tier`, `roles_allowed` JSONB, `output_schema_name`,
`prompt_file`, `handler_name`, `context_builder`, `status`, `is_fixture`, plus `BaseModel` id/timestamps/
`is_deleted`. Five additions are already mandated by `D1 §C.3`; four more are needed by this port.

```sql
ALTER TABLE ai_tool_registry
  -- from D1 §C.3 (already locked)
  ADD COLUMN trigger_phrases      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN budget               VARCHAR(10) NOT NULL DEFAULT 'tier1',
  ADD COLUMN failure_modes        TEXT        NULL,
  ADD COLUMN reference_pack       VARCHAR(80) NULL,
  ADD COLUMN output_document_type VARCHAR(20) NOT NULL DEFAULT 'none',
  -- new here, required by the Sahayatri port
  ADD COLUMN ui_type              VARCHAR(30) NOT NULL DEFAULT 'form',
  ADD COLUMN icon                 VARCHAR(16) NULL,
  ADD COLUMN sort_order           INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN badge                VARCHAR(20) NULL,
  ADD COLUMN input_schema_name    VARCHAR(100) NULL,
  ADD COLUMN grounding            VARCHAR(12) NOT NULL DEFAULT 'optional';

CREATE INDEX ix_atr_category_sort ON ai_tool_registry (category, sort_order);
CREATE INDEX ix_atr_ui_type       ON ai_tool_registry (ui_type);
```

| Column | Values | Purpose | Replaces (Sahayatri) |
|---|---|---|---|
| `ui_type` | `form`, `chat`, `solver`, `flashcards`, `exam`, `planner`, `wellbeing`, `writing`, `analysis`, `table`, `deck`, `checklist`, `chart`, `rubric`, `tiered`, `feedback`, `annotations`, `paper`, `doc`, `board` | **The column that decides which result component renders.** §D.3 | `ai_tools.ui_type` (only `panel`\|`chat`) |
| `icon` | one emoji | catalog card glyph | `ai_tools.icon` |
| `sort_order` | int | catalog ordering within a category | `ai_tools.sort_order` |
| `badge` | `popular`, `new`, `smart`, `beta`, `free`, null | catalog card ribbon | `ai_tools.badge` |
| `input_schema_name` | key in a new `INPUT_SCHEMAS` dict | drives the **generated form** (fields, types, validation) so the catalog does not need a hand-written page per tool | Sahayatri's marshmallow per-tool schemas + the `props` blob in `gen-ai-pages.mjs` |
| `grounding` | `required`, `optional`, `none` | `required` = refuse with 422 when the chapter has no published content (config `grounding.unauthored_behaviour`); `none` = never inject a context block | Sahayatri had no such flag — every tool silently degraded |
| `budget` | `tier0`..`tier4` | cost tier: 0 deterministic, 1 short text, 2 long text, 3 multi-call/search, 4 audio/batch. Drives the cost badge and per-role caps | `ai_tools.token_cost_estimate` (an absolute token count, which goes stale whenever a model changes) |
| `output_document_type` | `none`, `writer`, `canvas`, `deck`, `report`, `bulk`, `xlsx` | routes the result to a document emitter (`D1 §C.4`) | — |

Two Sahayatri columns are **deliberately not carried over**: `endpoint` (there is exactly one endpoint,
`POST /ai/generate/<tool_key>` — a per-tool endpoint column would re-legitimize the 105 routes killed in
A.4 #31) and `frontend_path` (routes are derived: `/dashboard/ai-workbench/<tool_key>`, so the catalog and
the router cannot drift — `UX §1.6` notes Sahayatri kept them in sync "by convention", which is how the 19
orphaned legacy pages happened).

`is_premium` is not carried over either: `min_plan_tier` already expresses it (`free`\|`ai_suite`) and is
enforced in `_require_plan_tier` (`workbench.py:277-287`).

## D.2 `to_dict()` and the catalog response

`AIToolRegistry.to_dict` (`ai_workbench.py:103-112`) returns 6 keys today. It must return the new ones so
`GET /ai/tools` (`api/v1/ai_workbench.py:49-79`) can drive the grid:

```json
{
  "tool_key": "concept_explainer",
  "name": "Concept Explainer", "name_ne": "अवधारणा व्याख्याकर्ता",
  "category": "student_core",
  "description": "Any concept explained simply with Nepal examples.",
  "description_ne": "कुनै पनि अवधारणा सरल भाषामा…",
  "min_plan_tier": "ai_suite", "status": "ga",
  "ui_type": "chat", "icon": "💡", "sort_order": 3, "badge": "popular",
  "input_schema_name": "concept_explainer_in",
  "output_schema_name": "concept_explanation",
  "grounding": "optional", "budget": "tier1",
  "output_document_type": "none",
  "roles_allowed": ["student", "teacher"],
  "enabled": true, "field_overrides": {},
  "route": "/dashboard/ai-workbench/concept_explainer"
}
```

`enabled` + `field_overrides` already come from `SchoolAIToolSettings` via `_serialize_tool`
(`api/v1/ai_workbench.py:24-28`) — the per-school kill switch works on every ported tool for free. `route` is
computed server-side so one place owns the convention.

`GET /ai/tools` also needs three query params the catalog page requires and it does not have today:
`?role=` (it currently filters by `g.role` only), `?category=`, `?q=` (name/description substring). Sahayatri
had all three (`S:backend/app/api/ai/tools_registry.py:526-544`).

## D.3 How `ui_type` drives rendering — one component map per surface

The whole point of `ui_type` is that **no tool ships a page**. Sahayatri proved the pattern: 121 tool pages
were 11-line prop-config files over ~15 templates, machine-generated by `gen-ai-pages.mjs` (`UX §1.6`). This
port keeps the template idea and drops the generator: routes are dynamic, so there are zero generated files.

**Web** — one dynamic route `frontend/app/dashboard/ai-workbench/[toolKey]/page.tsx`:

```tsx
// 1. fetch the registry row      GET /ai/tools/<toolKey>
// 2. render the input form       INPUT_SCHEMAS[input_schema_name]  → <GeneratedToolForm/>
// 3. POST /ai/generate/<toolKey> with the form payload
// 4. render the result           RESULT_TEMPLATES[ui_type]         → the §E component
const RESULT_TEMPLATES: Record<string, ResultTemplate> = {
  form:        TextBlockResult,      chat:        ChatResult,
  solver:      SolverStepsResult,    flashcards:  FlashcardDeckResult,
  exam:        QaListResult,         planner:     PlanCardResult,
  wellbeing:   WellbeingResult,      writing:     WritingFeedbackResult,
  analysis:    InsightCardsResult,   table:       TableGridResult,
  deck:        SlideDeckResult,      checklist:   ChecklistResult,
  chart:       ChartPanelResult,     rubric:      RubricGridResult,
  tiered:      TieredPanelResult,    feedback:    FeedbackPanelResult,
  annotations: AnnotationListResult, paper:       QuestionPaperResult,
  doc:         SectionListResult,    board:       BoardStreamResult,
};
```

An unknown `ui_type` falls back to `TextBlockResult` with the raw JSON in a `<pre>` — the same defensive
default the current workbench page already uses (`frontend/app/dashboard/ai-workbench/page.tsx:203-206`), so
a registry row can never render a blank screen.

**Flutter** (`flutter_student` and `flutter_teacher`) — one `ToolRunnerScreen` with a
`Map<String, ResultBuilder>` of the same 20 keys, in `aschool_shared` so both apps use one copy.

**Ownership rule.** A tool may add a *result template* (a new `ui_type`) only when a genuinely new visual
shape is needed, and adding one is a deliberate, reviewed change to §E's list. A tool may **never** add a
route or a page. That is the invariant `workbench.py:11-13` already asserts and the CI fixture tool
(`is_fixture`, `handle_fixture_test`, `tool_handlers.py:85-89`) already guards.

## D.4 Seed strategy

Extend the existing idempotent seeder `backend/app/services/ai/workbench_seed.py` (whose `TOOLS` list already
carries `nutrition` per tool, satisfying CI gate a). Do **not** add a `POST /ai/tools/seed/` endpoint —
Sahayatri's version was reachable with any admin token (`S:…/tools_registry.py:560-578`), and ASchool seeds at
deploy/CLI.

Order and gating:

1. **Wave 0 — schema.** `nc_0003_registry_columns`, plus `INPUT_SCHEMAS` and the 10 new output schemas of §E.
   Existing 10 tools get sensible defaults (`ui_type='form'`, `budget='tier1'`, `grounding='none'`) so nothing
   changes visually.
2. **Wave 1 — 12 tools, `status='ga'`.** The ones with an existing schema or an obvious one, and no new
   template: `concept_explainer`, `math_solver`, `chemistry_solver`, `physics_solver`, `summary`,
   `key_points`, `definition_finder`, `example_generator`, `translation`, `grammar_corrector`,
   `formula_sheet`, `revision_planner`. Proves the dynamic route end to end.
3. **Wave 2 — ~35 tools, `status='beta'`.** Everything that renders as `text_block`, `section_list`,
   `qa_list` or `checklist`, i.e. the bulk of Sahayatri's 95 generic-runner prompts. No renderer work
   (mirrors `D1 §C.6` slice 1: "~40 tools become real with no renderer work").
4. **Wave 3 — the shape-differentiated ones.** `flashcards`, `exam`/mock-test, `wellbeing`, `analysis`,
   `table`, `rubric`, `tiered`, `feedback`, `annotations` — each needs its §E component first.
5. **Wave 4 — document/deck tools.** Gated behind the `D1 §C.5` engine upgrades (deck dialect, writer block
   library). Rows may exist with `status='disabled'` until the emitter lands, so the catalog never advertises
   a tool that 502s.

Every seeded row must carry: EN **and** NE prompt files (`app/prompts/<schema>_{en,ne}.md`, CI gate g), an
`AINutritionFacts` row (CI gate a — enforced for `status='ga'`), `failure_modes` prose, and a `budget` tier.
A row missing any of these fails the seeder, loudly.

Idempotency: match on `tool_key`, update in place, never delete. Retiring a tool = `status='disabled'`, so
historical `ai_generations.tool_key` rows keep resolving.

## D.5 Grounding: the `context_chapter` builder

The orchestrator resolves `tool.context_builder` by name to `context_<name>` in `tool_handlers.py`
(`workbench.py:323-326`). Sahayatri's chapter grounding becomes one new builder:

```python
def context_chapter(payload: dict) -> dict:
    """Grounding block from the PUBLISHED version of a teaching section.

    payload: {section_id?, unit_id?, subject_code?, grade?, language?}
    Resolution: school row → platform row (D1 §B.3 CTE), then the version
    with status='published'. Cached bytes come from teaching_content_snapshots
    so ai_generations.citations can name the exact document_sha256.
    """
```

Returned dict (merged into the prompt as `"Context data (JSON)"` at `workbench.py:187-190`):

```json
{"chapter": {
   "snapshot_id": "…", "version_id": "…", "version_no": 3, "sha256": "…",
   "curriculum": {"board": "cdc", "grade": "10", "subject_code": "MATH.101",
                  "unit_no": 2, "unit_title": {"en": "Sets", "ne": "समूह"}},
   "section": {"code": "MATH.G10.U2.S1", "kind": "concept",
               "title": {"en": "…", "ne": "…"}, "summary": {"en": "…", "ne": "…"}},
   "outcomes":       [{"code": "…", "bloom": "understand", "mastery_key": "…", "statement": {}}],
   "key_terms":      [{"en": "…", "ne": "…", "keep_in_english": true, "definition": {}}],
   "formulas":       [{"name": {}, "latex": "…", "spoken": {}, "must_memorize": true}],
   "worked_examples":[{"prompt": {}, "steps": [{"n":1,"text":{},"latex":"…"}], "answer": {}}],
   "misconceptions": [{"wrong_belief": {}, "correction": {}, "diagnostic_question": {}}],
   "exam_tips":      [{"type": "trap", "board": "see", "body": {}}],
   "excerpt":        "first N chars of concatenated teaching_notes bodies",
   "language_coverage": {"en": true, "ne": false},
   "trust": "curriculum"
}}
```

Rules the builder enforces, all from config (§B.5 `grounding.*`): `grounding.enabled=false` returns `{}`;
`excerpt_chars` / `tutor_excerpt_chars` bound the excerpt; `include_exam_tips` / `include_misconceptions`
drop those keys; when nothing is published and `tool.grounding == 'required'`, raise
`ToolPipelineError("This chapter has not been authored yet.", 422)` — the D1 rule "unauthored chapter ⇒
lesson refused 422, not hallucinated".

The response contract adds `used_chapter_context: bool` + `context_ref: {version_id, sha256}` alongside the
existing `result`/`generation_id`/`provider`/`model`/`cost_usd`/`fallback_used` (`workbench.py:259-266`).
That is what the "✓ Based on your chapter" badge reads (A.4 #44) and what the orchestrator writes into
`ai_generations.citations` as `[{"source_type":"teaching_section_version","source_id":"…","chunk":"<sha>"}]`.

## D.5b Pipeline touch-points — the only changes to `AIWorkbenchOrchestrator.run`

Everything ported must flow through the existing 8-step pipeline (`workbench.py:113-266`) with the smallest
possible diff:

| Step | Existing | Change needed |
|---|---|---|
| 1 registry + settings | `_registry_lookup`, kill switch, `_require_plan_tier`, `_require_role` | none |
| 2 consent gate | student ⇒ resolve own `Student` + `_require_guardian_consent` | none. Note this already closes the hole Sahayatri had — its voice tutor was un-gated (`SI §9`) |
| 3 context build | `_resolve_context_builder(tool.context_builder)` | register `context_chapter`; honour `tool.grounding` |
| 4 input guardrails | injection scan + `pseudonymize` | none |
| 5 model call | `AITokenHub.request(model="smart", temperature=0.2\|0.4)` | temperature from `budget`/category instead of the current 2-branch literal; `max_tokens` capped by `budget` tier |
| 6 schema validation | `parse_and_validate` + ONE repair retry | none — this is what makes Sahayatri's "no output validation" gap (`BC §4.5`) a non-issue |
| 6.5 handler | `_resolve_handler(tool.handler_name)` | new handlers per tool; deterministic maths stays here (`D1 §C.3` rule 4) |
| — | — | **NEW 6.6**: document emitter when `output_document_type != 'none'` (`D1 §C.4` puts it exactly here) |
| 7 moderation | `moderate()` → critical ⇒ `ModerationFlag` + 422 | none. This is where the emotion tool's `is_concerning` lands (A.4 #42) |
| 8 persist | `AIGeneration` + `_bump_analytics` + de-pseudonymize | add `citations` from `context_ref`; add `follow_up_suggestions` passthrough |

Non-LLM ported services (TTS, STT) do not go through `run()` — they have no schema to validate. They call
`AITokenHub` directly with their own `feature` key (`tts:speak`, `stt:transcribe`) so they still land on
`ai_usage_logs` with cost, which is what constraint 4 requires.

---

# E. THE ~20 RESULT TEMPLATES

Derivation: Sahayatri shipped 15 templates (10 student in `S:web/components/student/ai/`, 5 teacher
workspaces + 5 lighter teacher pages, `UX §1.6`), whose actual component distribution across 121 tools is
`AiContentPage` 16 · `AiWritingPage` 9 · `AiExamPage` 9 · `TeacherLessonSupport` 8 · `TeacherContentAdapt` 8 ·
`AiAnalysisPage` 7 · `TeacherAssessment` 6 · `TeacherClassroom` 5 · `AiPlannerPage` 5 · `AiChatPage` 4 ·
`TeacherProfDev` 3 · `AiWellbeingPage` 3 · `AiSolverPage` 3 · `AiFlashcardsPage` 1 · `AiDoubtPage` 1.
`D1 §C.1` independently arrived at 10 existing + 4 new (`table_grid`, `slide_deck`, `chart_panel`,
`checklist`). The 20 below are the union, de-duplicated: five of Sahayatri's teacher "templates" were
prose-parsing variants of one text panel and collapse into `text_block`.

**Universal envelope.** Every result carries these regardless of template, so the shared chrome
(`ContextBadge`, `FollowUpChips`, `ResultText` copy button, `ErrorBanner`) is written once:

```json
{
  "result": { "...template-specific...":  "...",
              "follow_up_suggestions": ["…", "…", "…"] },
  "generation_id": "uuid", "provider": "groq", "model": "openai/gpt-oss-120b",
  "cost_usd": 0.0012, "fallback_used": false,
  "used_chapter_context": true,
  "context_ref": { "version_id": "uuid", "sha256": "…" }
}
```

`follow_up_suggestions` is an optional `array<string>` (max 4) in **every** output schema in
`tool_schemas.py` — the single schema change that delivers A.4 #43.

## E.1 `text_block`

The default. Prose or lightly-structured markdown with KaTeX.

```json
{"title": "string", "body_md": "string (markdown + $latex$)",
 "language": "ne|en", "follow_up_suggestions": ["…"]}
```

- **Tools (≈40):** summary, key_points, definition_finder, example_generator, counter_example,
  analogy_finder, history_storyteller, geography_explorer, concept_explainer (non-chat mode), translation,
  poetry_helper, creative_writing, presentation_script, motivation_strategies, classroom_management,
  mindfulness, policy_simplifier, reflection_prompter, lesson_hook, real_world_connector, subject_crossover,
  bilingual_content, language_bridge, and the remainder of the 95-prompt generic fleet.
- **Web:** `TextBlockResult` — `<Markdown remarkMath rehypeKatex>` in a scrollable panel, floating Copy,
  "Open in Writer" when `output_document_type='writer'`.
- **Flutter:** `TextBlockResultCard` — `flutter_markdown` + `flutter_math_fork` inline builder with
  `onErrorFallback` to plain text (the pattern from `UX §4.4`).

## E.2 `chat`

Multi-turn. The only template with persistent state; backed by `tutor_sessions`/`tutor_messages`, not by a
per-tool session table.

```json
{"reply_md": "string", "turn_index": 3,
 "session_id": "uuid", "session_status": "open|closed",
 "turns_remaining": 17,
 "suggested_next_questions": ["…"], "follow_up_suggestions": ["…"]}
```

- **Tools (4):** tutor (voice_tutor), socratic_tutor, interview_practice, concept_explainer (chat mode).
- **Web:** `ChatResult` — bubble list with asymmetric radii, 3-dot typing indicator, mic button
  (record → `POST /ai/stt` → auto-send), 🔊 speak-latest (`POST /ai/tts` → inline `<audio autoPlay controls>`,
  `revokeObjectURL` on unmount), Clear chat, per-message `ContextBadge`.
- **Flutter:** `ChatResultScreen` — same loop with `record` + `audioplayers`, optimistic message removal and
  text restore on failure (`UX §2.2`), provider/model/cost meta chips.
- Turn cap and reflection-on-close come from `TutorSessionPlan.max_turns` (`ai_workbench.py:164`) — no new
  mechanism.

## E.3 `plan_card`

Timed, phased plan. Exists today as the `lesson_plan` schema (`tool_schemas.py:9-31`).

```json
{"title": "string",
 "objectives": ["string"],
 "phases": [{"name": "Warm-up", "duration_minutes": 5,
             "activities": ["string"], "materials": ["string"]}],
 "assessment": "string", "differentiation": "string",
 "materials": ["string"], "total_minutes": 45,
 "follow_up_suggestions": ["…"]}
```

- **Tools (9):** lesson_plan, unit_plan, substitute_plan, revision_planner, goal_setter, focus_timer,
  time_management_coach, field_trip_plan, cocurric_plan.
- `total_minutes` is computed by `handle_lesson_plan` (`tool_handlers.py:65-70`), never by the model.
- **Web:** `PlanCardResult` — phase timeline with duration chips summing to a header total, objectives as a
  checklist, materials as pills, "Open in Writer" for print.
- **Flutter:** `PlanCardResultCard` — `ExpansionTile` per phase with a leading minute badge.

## E.4 `solver_steps`

Numbered working with a boxed final answer. Sahayatri faked this by regexing `Step N` / `∴` out of prose
(`UX §1.6`); here it is a schema, so the render is exact.

```json
{"problem_restated": "string",
 "steps": [{"n": 1, "text_md": "string", "latex": "string|null",
            "why_md": "string|null"}],
 "final_answer_md": "string", "final_answer_latex": "string|null",
 "units": "string|null", "check_md": "string|null",
 "follow_up_suggestions": ["…"]}
```

- **Tools (6):** math_solver, chemistry_solver, physics_solver, doubt_solver (text), numerical_practice,
  proof_helper.
- **Web:** `SolverStepsResult` — circular numbered badges, per-step KaTeX, collapsible "why", answer in a
  bordered highlight box, `Ctrl+Enter` submit hint.
- **Flutter:** `SolverStepsResultCard` — `Math.tex` per step with plain-text fallback.
- Guardrail: `NEPAL_FIRST_SYSTEM`'s "never give exam answers directly" is relaxed for solver tools only when
  the student supplies their own problem; when `exam_mode` is on for the student's tutor plan
  (`TutorSessionPlan.exam_mode`, `ai_workbench.py:161`) the tutor deflects instead — the existing mechanism.

## E.5 `flashcard_deck`

Exists as the `flashcards` schema (`tool_schemas.py:130-146`); extend with `hint` and deck metadata.

```json
{"deck_title": "string", "count": 12,
 "cards": [{"front": "string", "back": "string", "hint": "string|null",
            "latex_front": "string|null", "latex_back": "string|null"}],
 "follow_up_suggestions": ["…"]}
```

- **Tools (2):** flashcards, exam_vocab.
- **Web:** `FlashcardDeckResult` — 3D flip (`perspective:1000px` + `rotateY(180deg)` +
  `backface-visibility:hidden`), Prev/Next, reviewed-dot strip, `n/N reviewed`, Restart, and **"Add deck to
  spaced repetition"** which POSTs each card as a `question_bank_items` row + `spaced_rep_cards` seed. That
  button is the join Sahayatri never made between its flashcards and its SM-2 deck.
- **Flutter:** `FlashcardDeckResultCard` — `AnimatedBuilder` rotation, swipe left/right.
- `count` computed by `handle_flashcards` (`tool_handlers.py:79-83`).

## E.6 `qa_list`

Questions with marks; optional answer key behind a toggle. Exists as `worksheet` (`tool_schemas.py:32-51`).

```json
{"title": "string", "instructions": "string",
 "items": [{"n": 1, "question": "string", "marks": 2,
            "question_type": "mcq|short_answer|long_answer|numerical|proof|…",
            "options": ["string (mcq only, else omitted)"],
            "answer": "string|null",
            "explanation": "string|null", "bloom_level": "string|null"}],
 "total_marks": 40, "follow_up_suggestions": ["…"]}
```

- **Tools (11):** worksheet, quiz_generator, mock_test, exam_prep, neb_prep, short_answer_practice,
  formative_probe, exit_ticket, mcq_generator, practice_set, last_day_revision.
- `total_marks` computed by `handle_worksheet` (`tool_handlers.py:73-77`).
- **Web:** `QaListResult` — numbered list, marks pill right-aligned, per-item "Reveal answer", bulk
  **"Add all to Exercise Bank"** (creates `question_bank_items` with `source='ai'`, `is_approved=false` —
  the confirm-before-write pattern), **"Build a paper"** (hands off to `paper_blueprints`), "Open in Writer".
- **Flutter:** `QaListResultCard` — one card per item, progress bar when used as a timed test.
- `question_type` must accept the widened enum of §C.1 so a generated proof/construction question survives
  the round trip into the bank.

## E.7 `question_paper`

Sectioned exam paper with NEB furniture. Distinct from `qa_list` because of sections, per-section
instructions, header band and a separate answer key.

```json
{"title": "string", "school_name": "string|null",
 "exam_name": "string", "subject": "string", "grade": "string",
 "duration_minutes": 180, "total_marks": 75,
 "instructions": ["string"],
 "sections": [{"name": "Group A", "instructions": "Very short answer questions.",
               "marks_each": 1, "questions": [{"n": 1, "question": "string",
                 "marks": 1, "question_type": "mcq", "options": ["…"],
                 "bank_item_id": "uuid|null"}]}],
 "answer_key": [{"n": 1, "answer": "string", "explanation": "string|null"}],
 "follow_up_suggestions": ["…"]}
```

- **Tools (5):** question_paper, question_paper_v2, answer_key, practical_exam, oral_viva.
- Totals are validated by the handler against `PaperBlueprint.sections`, never trusted from the model
  (`D1 §C.4`).
- **Web:** `QuestionPaperResult` — paper preview with section headers, `[P.T.O.]` page breaks, answer-key
  tab, "Open in Writer" → PDF via the existing route. This template already has a backend
  (`POST /ai-tools/question-paper/v2`, `api/v1/ai_tools.py:386-452`) and `GeneratedPaper` storage; only the
  render is new.
- **Flutter:** read-only preview + share PDF; teachers author on web.

## E.8 `rubric_grid`

Criteria × performance levels. Exists as `rubric` (`tool_schemas.py:67-84`) but with only
`descriptors` as a string; the grid needs levels.

```json
{"title": "string",
 "levels": ["Excellent", "Proficient", "Developing", "Beginning"],
 "criteria": [{"name": "string", "max_marks": 5,
               "descriptors": {"Excellent": "string", "Proficient": "string",
                               "Developing": "string", "Beginning": "string"}}],
 "total_marks": 20, "scoring_notes": ["string"],
 "follow_up_suggestions": ["…"]}
```

- **Tools (4):** rubric, peer_assessment, pbl_designer (with `plan_card`), project_designer.
- Backwards compatible: `descriptors` as a plain string still validates (the current schema), so existing
  `rubric` generations keep rendering.
- **Web:** `RubricGridResult` — sticky-header table, marks column, "Open in Writer" for print.
- **Flutter:** horizontal-scroll `DataTable`.

## E.9 `tiered_panel`

Three ability tiers side by side. Exists as `differentiation` (`tool_schemas.py:94-111`).

```json
{"tiers": [{"tier": "below_grade|at_grade|above_grade",
            "label": "string", "strategy": "string",
            "activities": ["string"], "language_support": "string|null"}],
 "follow_up_suggestions": ["…"]}
```

- **Tools (3):** differentiation, differentiated_lesson, reading_level_adapter.
- **Web:** `TieredPanelResult` — 3 colour-coded columns, collapsing to an accordion under 768 px.
- **Flutter:** `TabBar` with 3 tabs.

## E.10 `section_list`

Headed sections with bullet points. Exists as `study_guide` (`tool_schemas.py:112-129`).

```json
{"title": "string",
 "sections": [{"heading": "string", "points": ["string"],
               "body_md": "string|null"}],
 "practice_questions": ["string"], "follow_up_suggestions": ["…"]}
```

- **Tools (14):** study_guide, formula_sheet, mind_map (as an indented outline — no graph renderer),
  vocabulary_builder, objective_writer, board_plan, unit_overview, long_answer_structurer, debate_builder,
  research_starter, project_ideas, science_experiment, career_explorer, current_events.
- **Web:** `SectionListResult` — `<h3>` + bullets, sticky in-page nav when > 4 sections, "Open in Writer".
- **Flutter:** `ExpansionPanelList`.
- Deliberate non-goal: no node-graph mind-map renderer. `mind_map` returns an outline; adding a graph library
  for one tool is not justified, and `UX §1.6` shows Sahayatri's mind_map was plain text anyway.

## E.11 `table_grid` (NEW per `D1 §C.1`)

The single highest-demand new template — 26 tools in `D1 §C.1` route to it.

```json
{"title": "string",
 "columns": [{"key": "chapter", "label": "Chapter", "align": "left",
              "width_pct": 30, "type": "text|number|marks|date_bs|percent"}],
 "rows": [{"chapter": "Sets", "marks": 8, "weight_pct": 10.5}],
 "totals": {"marks": 75}, "caption": "string|null",
 "follow_up_suggestions": ["…"]}
```

- **Tools (26):** marks_distribution, comparison_table, annual_scheme, weekly_planner,
  handout_from_deck, grade_distribution, item_analysis, remark_sheet, blueprint_builder, coverage_report,
  resource_finder (with `checklist`), past_exercise analyzer, exam_vocab table mode, class_report,
  progress_report, error_analysis, marks_predictor, student_grouping, co_teaching, timeline_builder,
  venn_diagram (as a 3-column set table), code_visualizer (as a step table), prerequisite_checker,
  knowledge_gap, blooms_optimizer, subject_crossover matrix.
- `totals` is computed by the handler, never the model.
- **Web:** `TableGridResult` — sortable, `type`-aware cell formatting (`marks` → 1 dp, `percent` → `%`,
  `date_bs` → Bikram Sambat via `frontend/lib/nepali_date.ts`), CSV download, "Open in Writer"/"Export XLSX"
  when `output_document_type` says so.
- **Flutter:** horizontally scrollable `DataTable` with frozen first column.

## E.12 `checklist` (NEW per `D1 §C.1`)

```json
{"title": "string",
 "groups": [{"label": "Before class",
             "items": [{"text": "string", "required": true,
                        "note": "string|null", "quantity": "string|null",
                        "cost_npr": 250}]}],
 "total_cost_npr": 250, "follow_up_suggestions": ["…"]}
```

- **Tools (16):** resource_finder, field_trip_plan, lab_safety, exam_day_prep, substitute_handover,
  onboarding_checklist, accessibility_audit, event_plan, sen_accommodations, parents_day_prep,
  disaster_drill, inventory_request, self_assessment, tech_integration, formative_assessment,
  peer_observation.
- `cost_npr` is formatted `रू १२,५००` via `formatNPR` (`frontend/lib/nepali-utils.ts`) — the Nepal-native
  primitive worth keeping from `UX §4.11`. `total_cost_npr` computed by the handler.
- **Web:** `ChecklistResult` — grouped checkboxes with local (unsaved) tick state, print view, "Copy as
  markdown task list".
- **Flutter:** `CheckboxListTile` groups persisted in `shared_preferences` per generation id.

## E.13 `chart_panel` (NEW per `D1 §C.1`)

Server-rendered SVG for print + Recharts on screen; `tufte-report` rules from `D1 §C.5`: no pie, no donut,
no 3D, caption mandatory.

```json
{"title": "string",
 "chart_type": "bar|line|grouped_bar|stacked_bar|scatter",
 "x_label": "string", "y_label": "string",
 "labels": ["Ch 1", "Ch 2"],
 "series": [{"name": "Class avg", "values": [62.5, 48.0]}],
 "caption": "string",
 "annotations": [{"label": "Pass mark", "y": 40}],
 "follow_up_suggestions": ["…"]}
```

- **Tools (6):** class_performance, cohort_trend, attendance_insight, progress_visualizer,
  grade_distribution (paired with `table_grid`), marks_distribution chart mode.
- **Web:** `ChartPanelResult` — Recharts, caption below, "Download SVG/PNG".
- **Flutter:** render the server SVG (`flutter_svg`) — no second charting library.
- Numbers come from real ASchool data via a context builder (`Marks`, `Attendance`), never invented by the
  model; the model writes only `caption` and `annotations`.

## E.14 `annotation_list`

```json
{"resource_id": "uuid",
 "annotations": [{"node_name": "string", "label_en": "string", "label_ne": "string",
                  "description_en": "string", "description_ne": "string",
                  "sort_order": 1}],
 "follow_up_suggestions": ["…"]}
```

- **Tools (2):** model_annotator (3D/simulation resources), diagram_labeller (labels an admin-pasted SVG in
  `teaching_media.svg_inline`).
- **Web:** `AnnotationListResult` — list beside the viewer; clicking an entry highlights the node through the
  viewer bridge; **"Save to resource"** writes `oer_resources.annotations` after the admin edits — the
  confirm-before-write pattern again.
- **Flutter:** list + WebView `postMessage` highlight.
- Explicitly **not** vision: the model is given the node/element **names** the viewer reports plus the chapter
  context; it never sees an image. That is what keeps this inside constraint 3.

## E.15 `wellbeing_card`

```json
{"reflection_md": "string",
 "affirmation": "string",
 "suggestions": [{"type": "breathing|study|talk|movement|sleep",
                  "text": "string"}],
 "detected_emotion": "anxious|sad|angry|tired|happy|overwhelmed|neutral|null",
 "intensity": 3,
 "is_concerning": false,
 "escalation_message": "string|null",
 "follow_up_suggestions": ["…"]}
```

- **Tools (5):** emotion_check, motivation_coach, stress_management, gratitude_journal, exam_anxiety_coach.
- **`is_concerning=true` is not a UI decision.** The orchestrator's step-7 moderation already flags critical
  content and writes `ModerationFlag(severity='critical', category='self_harm')` + returns 422
  (`workbench.py:243-252`). This template's `is_concerning` covers the *sub-critical* band: the UI shows a
  prominent "Talk to a teacher or counsellor" CTA with the school's counsellor contact from the `wellbeing`
  plugin, and a `ModerationFlag(severity='medium')` is written for the counsellor queue.
- **Web:** `WellbeingResult` — calm gradient surface distinct from the rest of the app, emoji-first feeling
  picker on input (2-col 😔😰😡😴😊😭), 💙 affirmation panel, and the literal privacy footer from `UX §4.10`:
  "🔒 Your responses are never stored or shared. This is a safe, private space." **That sentence must be
  true or must not be shown.** Under ASchool it is *not* true — every generation writes an `AIGeneration`
  ledger row (`workbench.py:255`) and flagged content reaches a counsellor. So the honest copy is: "Only you
  and, if you are at risk, your school counsellor can see this. It is never shared with classmates." Shipping
  Sahayatri's sentence verbatim would be a false privacy claim.
- **Flutter:** same, with the counsellor CTA as a persistent bottom banner.

## E.16 `writing_feedback`

Exists as `writing_feedback` (`tool_schemas.py:149-158`) and is protected by **CI gate (e): the schema
deliberately has NO `revised_text` field — the tool must coach, not rewrite**. That gate binds every ported
writing tool.

```json
{"strengths": ["string"], "improvements": ["string"], "next_steps": ["string"],
 "encouragement": "string",
 "annotations": [{"quote": "string", "comment": "string",
                  "category": "grammar|structure|evidence|clarity|spelling"}],
 "follow_up_suggestions": ["…"]}
```

- **Tools (9):** essay_helper, grammar_corrector, spelling_checker, essay_evaluator, feedback_writer,
  short_answer_practice (feedback mode), peer_feedback, presentation_feedback, poetry_feedback.
- The Sahayatri equivalents (`AiWritingPage`, `writingMode="improve"`, `outputLabel="Corrected text"`,
  `UX §1.6`) **returned rewritten text**, i.e. they were ghost-writers. Porting them as-is would break CI
  gate (e). Ported form: quote-and-comment annotations against the student's own words, no rewritten copy.
  This is a deliberate, named behaviour change.
- **Web:** `WritingFeedbackResult` — student's text on the left with highlighted quotes, comments on the
  right, three collapsible lists (strengths / improvements / next steps).
- **Flutter:** stacked sections with the quote as a `blockquote`.

## E.17 `feedback_panel`

Per-student feedback for staff (distinct from E.16, which addresses the student).

```json
{"students": [{"student_id": "uuid", "student_name": "string",
               "feedback": "string", "tone": "encouraging|neutral|direct",
               "evidence": ["string"], "suggested_grade": "string|null"}],
 "class_summary": "string", "follow_up_suggestions": ["…"]}
```

- **Tools (7):** feedback_writer (bulk), remark_writer, remark_sheet, progress_report,
  parent_conference_notes, referral_letter, recommendation_letter.
- `student_name` is de-pseudonymized on the way out by `_de_pseudonymize_payload`
  (`workbench.py:450-461`) — names were replaced with "Student A/B" before the prompt
  (`workbench.py:30-51`, CI gate c). Any ported staff tool that takes student names **must** rely on this and
  must not receive raw names.
- **Web:** `FeedbackPanelResult` — one editable card per student, tone selector, **"Apply to report cards"**
  which routes into the existing bulk-marksheet merge (`D1 §C.4`) after review.
- **Flutter:** list with inline edit.

## E.18 `insight_cards`

```json
{"headline": "string",
 "cards": [{"title": "string", "value": "62.5%", "delta": "-4.1",
            "trend": "up|down|flat", "detail_md": "string",
            "severity": "info|watch|act"}],
 "recommended_actions": ["string"], "follow_up_suggestions": ["…"]}
```

- **Tools (7):** weak_topics, mistake_analyzer, knowledge_gap, daily_brief, weekly_insights, risk_alerts,
  attendance_insight.
- Sahayatri's `TeacherAnalyticsWorkspace` regexed Average/Median/Highest/Lowest/Pass-rate out of the model's
  **prose** (`UX §1.6`) — a fragile hack. Here the numbers come from a data context builder and the model
  writes only `detail_md` and `recommended_actions`; `value`/`delta` are handler-computed. `D1 §C.3` rule 4:
  "the model never computes a number we can compute."
- **Web:** `InsightCardsResult` — metric strip with severity colouring, actions as a checklist.
- **Flutter:** `Card` grid, 2-up.

## E.19 `slide_deck` (NEW per `D1 §C.1`/`§C.4`)

The 10 typed slides are fixed by `D1 §C.4` and are not re-litigated here.

```json
{"theme": "aschool_light", "aspect": "16:9",
 "slides": [{"type": "title", "title": "string", "subtitle": "string", "notes": "string"},
            {"type": "objectives", "bullets": ["string"], "notes": "string"},
            {"type": "content", "title": "string", "bullets": ["string"],
             "image_prompt": "string|null", "notes": "string"},
            {"type": "two_col", "left": ["string"], "right": ["string"], "notes": "string"},
            {"type": "diagram", "caption": "string", "svg_spec": "string", "notes": "string"},
            {"type": "table", "headers": ["string"], "rows": [["string"]], "notes": "string"},
            {"type": "chart", "chart": "bar", "labels": ["string"],
             "series": [{"name": "string", "values": [1]}], "caption": "string", "notes": "string"},
            {"type": "question", "question": "string", "answer_hidden": "string", "notes": "string"},
            {"type": "activity", "title": "string", "steps": ["string"], "minutes": 10, "notes": "string"},
            {"type": "exit", "questions": ["string"], "notes": "string"}],
 "follow_up_suggestions": ["…"]}
```

- **Tools (3):** slide_deck, deck_from_doc, workshop_designer.
- `notes` ≠ slide text; image on at most 3–5 of 12 slides (`D1 §C.4`).
- **Web:** `SlideDeckResult` — slide navigator with speaker-notes pane, "Open as Deck" → designer canvas at
  1280×720, export PPTX/PDF through existing routes. **No python-pptx** (`D1 §C.4` ruling).
- **Flutter:** read-only carousel + notes; authoring is web-only.
- **Blocked until** the `deck` dialect + emitter land (`D1 §C.5` items 1–2). Registry rows stay
  `status='disabled'` until then.

## E.20 `board_stream`

Streamed teaching turns (heading + line + optional latex/svg) for a projector or a "teach me this chapter"
reader view. Listed in `D1 §C.1` as an existing template name.

```json
{"turns": [{"kind": "say|write|ask|pause",
            "text_md": "string|null", "latex": "string|null",
            "svg_ref": "media_id|null", "seconds": 8}],
 "total_seconds": 240, "follow_up_suggestions": ["…"]}
```

- **Tools (1 in this port):** `chapter_walkthrough` — reads a published section aloud turn by turn, using
  `teaching_notes.speaker_note_*` for what to say and `teaching_formulas.spoken_*` for formulas (never the
  LaTeX — `D1 §B.2`).
- **This is the non-whiteboard equivalent of the cancelled board experience.** `kind:"write"` turns render
  into a static reader pane, not a canvas; there is no drawing, no strokes, no realtime.
- **Web:** `BoardStreamResult` — auto-advancing reader with a play/pause bar and per-turn TTS.
- **Flutter:** same, with `audioplayers` queueing.

## E.21 Template → tool count summary

| # | Template | `ui_type` | Tools | Status |
|---|---|---|---|---|
| 1 | `text_block` | `form` | ≈40 | schema new (trivial), component new |
| 2 | `chat` | `chat` | 4 | backed by existing `tutor_sessions` |
| 3 | `plan_card` | `planner` | 9 | schema **exists** (`lesson_plan`) |
| 4 | `solver_steps` | `solver` | 6 | new |
| 5 | `flashcard_deck` | `flashcards` | 2 | schema **exists**, extend |
| 6 | `qa_list` | `exam` | 11 | schema **exists** (`worksheet`) |
| 7 | `question_paper` | `paper` | 5 | backend **exists** (`generated_papers`) |
| 8 | `rubric_grid` | `rubric` | 4 | schema **exists**, extend |
| 9 | `tiered_panel` | `tiered` | 3 | schema **exists** (`differentiation`) |
| 10 | `section_list` | `doc` | 14 | schema **exists** (`study_guide`) |
| 11 | `table_grid` | `table` | 26 | **NEW** (`D1 §C.1`) |
| 12 | `checklist` | `checklist` | 16 | **NEW** (`D1 §C.1`) |
| 13 | `chart_panel` | `chart` | 6 | **NEW** (`D1 §C.1`) |
| 14 | `annotation_list` | `annotations` | 2 | new |
| 15 | `wellbeing_card` | `wellbeing` | 5 | new |
| 16 | `writing_feedback` | `writing` | 9 | schema **exists**, CI gate (e) applies |
| 17 | `feedback_panel` | `feedback` | 7 | new |
| 18 | `insight_cards` | `analysis` | 7 | new |
| 19 | `slide_deck` | `deck` | 3 | **NEW**, blocked on `D1 §C.5` 1–2 |
| 20 | `board_stream` | `board` | 1 | new; replaces the whiteboard |

20 templates cover ~180 tool slots. Six schemas already exist in `tool_schemas.py` and are reused as-is or
extended; 10 output schemas are new; `follow_up_suggestions` is added to all of them.

---

# F. SOCKET / REALTIME

## F.1 What is realtime, and what is not

Only **one** ported capability needs sockets: the live quiz. Everything else is request/response.

- Whiteboard stroke sync: cancelled (A.2 #16).
- Ingestion progress (Sahayatri's SSE + `admin_import_progress` socket events): no ingestion (A.1 #1). The
  one long job left is snapshot rebuild, a nightly Celery beat task with no user waiting on it.
- AI generation: no token streaming. Sahayatri had none either — the "streaming" feel was a CSS 3-dot
  indicator (`UX §1.7`). Keep that. Streaming would have to bypass `parse_and_validate` (step 6) plus the
  repair retry, which is the mechanism that makes schema-shaped results reliable; that trade is not worth
  making for the ported tools.
- Live class video: `LiveClass` + Jitsi already exists (`lms.py:93-112`); untouched.

## F.2 Fit with the existing `app/realtime.py`

`backend/app/realtime.py` (159 lines) has: an authenticating `connect` handler that rejects unauthenticated
sockets and caches `{school_id, role, user_id}` per `sid` in an in-process `_sessions` dict
(`realtime.py:33,92-96`), `join_school`/`leave_school` that **ignore client-supplied `school_id`** except for
superadmin (`realtime.py:103-131`), and `disconnect` cleanup.

Additions, all in a new module `backend/app/plugins/modules/exams/sockets/live_quiz.py`, registered from the
plugin — `realtime.py` itself gains only one import line:

1. **Reuse `connect` verbatim.** No second handshake. This closes Sahayatri's biggest socket hole: its
   `lq_join` took a `user_name` string with no authentication at all
   (`S:backend/app/sockets/live_quiz_socket.py:61-63`), so anyone with a 6-char code could join under any
   name — including a teacher's.
2. **Reuse the `_sessions` map** for `school_id`/`role`/`user_id`. Two accessor helpers are needed since it is
   module-private today: `realtime.socket_state(sid)` and `realtime.require_socket_state(sid)`.
3. **Keep `school-<uuid>` rooms** untouched; quiz rooms are additive and namespaced.

## F.3 Room naming and the auth model

| Room | Members | Purpose |
|---|---|---|
| `school-<school_id>` | everyone in the school (existing) | existing platform events; quiz **lifecycle** notices (`lq:opened`, `lq:ended`) broadcast here so a class dashboard can show "a quiz is live" without knowing the code |
| `lq:<school_id>:<quiz_session_id>` | host + joined participants | all per-quiz traffic |
| `lq:<school_id>:<quiz_session_id>:host` | host only | answer distributions and per-student detail that participants must not see |

**Room names are keyed by the session UUID, not the join code.** The join code is a short, guessable,
recycled human token; using it as a room name means a stale client (or a guesser) can land in a later quiz's
room. The code is used exactly once — to *resolve* a session id in `lq_join` — and never again.

`school_id` is embedded in every room name so a cross-tenant `join_room` is impossible even if a handler
forgets to check: the server builds the name from `_sessions[sid]["school_id"]`, never from the payload.

Auth rules per event:

| Rule | Enforcement |
|---|---|
| Connection is authenticated | existing `connect` (`realtime.py:53-100`); no token ⇒ `return False` |
| Participant must be a student of this school | `Student.query.filter_by(user_id=state["user_id"], school_id=state["school_id"])`; display name comes from the **`students` row**, never from the payload |
| Only the host may control | `live_quiz_sessions.host_user_id == state["user_id"]`, or role in (`school_admin`,`superadmin`) |
| Answers are scored server-side | verified against Redis state; **any client-supplied `is_correct`, `score` or `correct_answer` field is discarded before use** (ported rule, `live_quiz_socket.py:95`) |
| One answer per (participant, question) | Redis `HSETNX`; a second answer for the same index is ignored, not overwritten |
| Rate limit | max 1 `lq_answer` per participant per question, max 20 socket events/participant/10 s; exceed ⇒ `lq_error` + disconnect |
| Guardian consent | **not** required — a live quiz is not an AI generation. The *generation* of the questions was consent-gated at `/ai/generate/quiz_generator`; answering is ordinary assessment |

## F.4 Redis state schema

Key: `lq:<school_id>:<quiz_session_id>` · TTL 4 h, refreshed on every write (Sahayatri used 4 h,
`S:…/live_quiz_routes.py:_LQ_TTL`), plus a hard `ended_at` write-through to Postgres so nothing durable
depends on Redis (fixing `SI §9`'s "Redis-only persistence" mistake).

```json
{
  "session_id": "uuid", "school_id": "uuid", "host_user_id": "uuid",
  "status": "lobby|running|paused|ended",
  "current_index": -1,
  "points_per_correct": 10, "speed_bonus": false,
  "question_opened_at": 1757040000.0,
  "questions": [{"n": 1, "question": "…", "options": ["…","…","…","…"],
                 "answer": "…", "explanation": "…", "seconds": 20}],
  "participants": {"<student_id>": {"name": "Asha R.", "joined_at": 1757039990.0}},
  "answers":  {"<student_id>": {"0": {"answer": "…", "correct": true, "ms": 4120}}},
  "scores":   {"<student_id>": 30}
}
```

Two derived keys keep the hot path cheap: `lq:<school>:<id>:scores` (a Redis **sorted set** so the leaderboard
is `ZREVRANGE`, not a JSON re-sort) and `lq:code:<JOINCODE>` → `<school_id>:<session_id>` with the same TTL,
which is how a code resolves to a room in O(1) without a DB hit.

`answer.correct` is written by the server after comparing against `questions[i].answer`; the client's payload
carries only `{quiz_code|session_id, q_index, answer}`.

## F.5 Event list — literal payloads

Namespace: default (`/`), same as the existing handlers. Prefix `lq_` retained from Sahayatri so the Flutter
client's vocabulary ports directly.

**Client → server**

```
lq_join            {"join_code": "7KDQ2M", "display_name": "optional, IGNORED"}
lq_leave           {"session_id": "uuid"}
lq_start           {"session_id": "uuid"}                      host only
lq_next            {"session_id": "uuid", "q_index": 3}         host only
lq_pause           {"session_id": "uuid"}                       host only
lq_resume          {"session_id": "uuid"}                       host only
lq_answer          {"session_id": "uuid", "q_index": 3, "answer": "B"}
lq_end             {"session_id": "uuid"}                       host only
lq_state_request   {"session_id": "uuid"}                       late-joiner resync
```

**Server → client** (room = `lq:<school>:<session>` unless noted)

```jsonc
// on successful join, to the joiner only (ack return value)
lq_joined {
  "session_id": "uuid", "title": "Sets — quick check",
  "question_count": 8, "status": "lobby", "current_index": -1,
  "you": {"student_id": "uuid", "display_name": "Asha R.", "score": 0},
  "is_host": false
}

// to the room whenever the roster changes
lq_roster {
  "count": 23,
  "participants": [{"student_id": "uuid", "display_name": "Asha R."}]
}

lq_started { "session_id": "uuid", "started_at": "2026-09-05T09:14:02Z", "question_count": 8 }

// question push — answers are STRIPPED for participants
lq_question {
  "q_index": 0, "n": 1, "question": "Which of these is a null set?",
  "options": ["A. …", "B. …", "C. …", "D. …"],
  "question_type": "mcq", "seconds": 20,
  "opened_at": "2026-09-05T09:14:05Z"
}

// host room additionally receives the key
lq_question_host { "q_index": 0, "answer": "B", "explanation": "…" }   // room :host

// ack to the answering participant only
lq_answer_ack { "q_index": 0, "accepted": true, "correct": true,
                "points_awarded": 10, "your_score": 10 }

// to the room: counts only, never who answered what
lq_answer_tally { "q_index": 0, "answered": 17, "of": 23 }

// to the host room: the distribution that drives the teaching moment
lq_answer_distribution { "q_index": 0,
  "counts": {"A": 2, "B": 12, "C": 3, "D": 0}, "no_answer": 6,
  "correct_option": "B" }                                             // room :host

// after the host advances, everyone sees the reveal for the PREVIOUS question
lq_reveal { "q_index": 0, "correct_option": "B", "explanation": "…",
            "correct_count": 12, "of": 23 }

lq_paused  { "session_id": "uuid" }
lq_resumed { "session_id": "uuid" }

lq_leaderboard { "top": [{"rank": 1, "student_id": "uuid",
                          "display_name": "Asha R.", "score": 70}],
                 "you": {"rank": 5, "score": 40} }

lq_ended { "session_id": "uuid", "ended_at": "2026-09-05T09:22:41Z",
           "leaderboard": [{"rank": 1, "student_id": "uuid",
                            "display_name": "Asha R.", "score": 70,
                            "correct": 7, "of": 8}],
           "you": {"rank": 5, "score": 40, "correct": 4, "of": 8},
           "attempt_id": "uuid" }

// full snapshot for a late joiner or a reconnect
lq_state { "session_id": "uuid", "status": "running", "current_index": 3,
           "question": { /* same shape as lq_question, answer stripped */ },
           "your_answers": {"0": "B", "1": "A"}, "your_score": 20,
           "roster_count": 23 }

lq_error { "code": "not_found|forbidden|closed|rate_limited|already_answered",
           "message": "Quiz not found or already finished." }
```

**Broadcast to `school-<school_id>`** (so dashboards react without joining):

```
lq_opened { "session_id": "uuid", "join_code": "7KDQ2M", "title": "…",
            "class_id": "uuid|null", "section_id": "uuid|null", "host_name": "…" }
lq_closed { "session_id": "uuid", "participant_count": 23 }
```

## F.6 Late-joiner resync

`lq_state_request` → `lq_state` is the ported `board_state_request` pattern from the whiteboard
(`BC §5`), which is the one genuinely valuable piece of that cancelled subsystem: a client that reconnects
mid-quiz gets the current question, its own submitted answers and its score in one round trip, instead of
sitting blank until the next `lq_next`. Sahayatri's live quiz had no such event — only the whiteboard did.

## F.7 Multi-worker correctness

`extensions.socketio` must run with a Redis `message_queue` for `emit(..., to=room)` to reach clients held by
another gunicorn worker. Sahayatri had this (`BC §1`: Redis db1 as the Socket.IO message queue). Without it,
a two-worker deployment silently drops half the quiz traffic — that is a deployment prerequisite for this
slice, not an optional optimisation. In-process `_sessions` (`realtime.py:33`) stays correct because a
socket's events always arrive on the worker owning the connection (documented at `realtime.py:29-33`).

## F.8 HTTP companions (the non-socket half)

The socket layer never creates or reads durable state directly; these routes do. All under
`exams_bp`, gated `@jwt_required() @school_required @plugin_required("exams")`.

| Method + path | Role | Purpose |
|---|---|---|
| `POST /exams/live-quiz` | teacher, school_admin | create from an `online_exam_id` **or** an inline question list; generates a unique `join_code`, writes `live_quiz_sessions` + Redis, returns `{session_id, join_code}` |
| `GET /exams/live-quiz/<id>` | host, participants | metadata; **answers stripped unless caller is host** |
| `GET /exams/live-quiz/by-code/<code>` | student | resolve a code to `{session_id, title, status}` before connecting |
| `POST /exams/live-quiz/<id>/end` | host | idempotent end: freeze Redis, write `leaderboard` + `ended_at`, create one `OnlineExamAttempt` per participant |
| `GET /exams/live-quiz/<id>/results` | host | per-question distributions + per-student rows for the review screen |
| `GET /exams/live-quiz/history` | teacher, school_admin | past sessions for this school |

`POST /exams/live-quiz` accepting an inline question list is what lets the `quiz_generator` tool result
(`qa_list`, §E.6) become a live quiz in one click — the "generate → play" path.

---

# G. ADMIN CONTENT ENTRY UI

There is no OCR, so the authoring UI *is* the content pipeline. This is the section that must be complete or
the plugin is unusable: an admin who cannot type a chapter has nothing to ground against.

Route root: `/dashboard/curriculum`. All screens gated `@plugin_required("nepal_curriculum")` plus the
`permissions.yaml` keys of §B.4.

## G.1 Screen map

| # | Route | Screen | Permission | Primary job |
|---|---|---|---|---|
| 1 | `/dashboard/curriculum` | Curriculum browser | any visible role | framework → grade → subject → unit → section tree with coverage state |
| 2 | `/dashboard/curriculum/sections/new` | Create section | `curriculum.author` | identity fields only, then straight into the editor |
| 3 | `/dashboard/curriculum/sections/[id]` | **Section editor** (7 block tabs) | `curriculum.author` | the main data-entry surface |
| 4 | `/dashboard/curriculum/sections/[id]/preview` | Student preview | `curriculum.author` | "review exactly what students will see" |
| 5 | `/dashboard/curriculum/sections/[id]/versions` | Version history | `curriculum.author` | diff, revert, see what was taught in Baisakh |
| 6 | `/dashboard/curriculum/queue` | Review & publish queue | `curriculum.review` | in_review list, approve/reject/publish |
| 7 | `/dashboard/curriculum/exercises` | Exercise bank browser | `curriculum.author` | filter/bulk-tag/dedupe the question pool |
| 8 | `/dashboard/curriculum/exercises/new` | Exercise entry | `curriculum.author` | one question, with autofill |
| 9 | `/dashboard/curriculum/import` | Bulk / CSV import | `curriculum.publish` | 6 CSV templates, dry-run then commit |
| 10 | `/dashboard/curriculum/coverage` | Coverage dashboard | school_admin, superadmin | what is authored, what is missing, per grade × subject |
| 11 | `/dashboard/plugins/nepal_curriculum/settings` | Plugin settings | school_admin | the §B.5 config form (existing generic renderer) |

## G.2 Screen 1 — Curriculum browser

Four-pane cascade, each pane driven by the pane to its left:

- **Pane A — Framework:** rows from `curriculum_frameworks` (`board`, `grade`, `subject_code`,
  `subject_name`), with a **PLATFORM / SCHOOL** chip from `school_id IS NULL`. Filters: board
  (`neb|cdc|cbse|ib|custom`), grade, `is_active`.
- **Pane B — Units:** `curriculum_units` ordered by `unit_no`; each row shows `title_en` / `title_ne`,
  `periods`, `weight_pct`, and a **section count + published count** badge (e.g. `4 sections · 3 published`).
- **Pane C — Sections:** `teaching_sections` ordered by `section_no`; row shows `code`, `title_en`,
  `kind` chip, `difficulty` chip, `estimated_minutes`, a status pill from the newest version
  (`draft|in_review|published|archived|rejected`), and language chips **EN** / **NE** greyed when
  `language_coverage` says false. Rows sourced from the platform show a **PLATFORM** chip and a **Fork for my
  school** action (disabled when `authoring.allow_school_overrides=false`).
- **Pane D — Section summary:** counts per block type (notes 7 · examples 3 · misconceptions 2 · formulas 5 ·
  exam tips 4 · key terms 11 · media 2 · exercises 18), outcome links, and the publish-gate checklist (§G.5)
  with each unmet condition as a clickable jump into the offending tab.

Empty states carry the next action, per `UX §4.8`: "No sections yet for Unit 2 — **Create the first
section**"; "This subject has no curriculum framework — **ask a platform admin to seed CDC Class 10 Maths**".

## G.3 Screen 3 — Section editor: every field

Header (always visible, sticky): section `code` · `title_en` · status pill · version `v3 (draft)` ·
autosave indicator · **Preview** · **Submit for review** / **Publish** · language toggle **EN | NE | Both**.

The language toggle switches which of the paired `*_en` / `*_ne` inputs is focused; **Both** shows them
side by side. This is how a bilingual chapter gets typed without two passes.

### Tab 0 — Identity (`teaching_sections`)

| Field | Input | Required | Validation / source |
|---|---|---|---|
| `unit_id` | read-only breadcrumb | yes | set on create |
| `section_no` | number | yes | unique within unit; drag-reorder in Pane C also writes it |
| `code` | text | yes | pattern `^[A-Z0-9.]{3,60}$`; autofilled `SCI.G10.U2.S3` from framework+unit+section_no; editable, then locked once a version is published (it is quoted in citations) |
| `kind` | select | yes | `concept · derivation · procedure · experiment · reading · revision` |
| `title_en` | text | yes | ≤300 |
| `title_ne` | text | required when `language.require_nepali` | ≤300, Devanagari keyboard hint |
| `summary_en` | textarea | no (yes to publish) | 2–4 sentences; goes on the version row |
| `summary_ne` | textarea | per config | same |
| `estimated_minutes` | number | yes | default from `authoring.default_estimated_minutes` |
| `difficulty` | select | yes | `foundation · core · stretch`, default from config |
| `prerequisite_section_ids` | multi-select | no | searchable picker over sections in the same subject; renders as removable chips; replaces Sahayatri's free-text `connections_to_other_topics` |
| `lms_topic_id` | select | no | optional link to an LMS `topics` row so course delivery and curriculum align (`D1 §B.1`) |
| `tags` | tag input | no | JSONB array |
| `is_active` | toggle | yes | default on |

### Tab 1 — Outcomes (`teaching_section_outcomes`)

Two-column picker: available `learning_outcomes` for this unit on the left (code + `statement_en`, Bloom
chip), linked on the right. Per linked row: `emphasis` (`primary` | `supporting`) radio, `mastery_key` text
(autofilled `slug(subject_code)_u{unit_no}_{outcome_code}`, editable, ≤80 — **this is the join to spaced
repetition and report-card evidence**, `D1 §B.2`), `sort_order` by drag.
Publish gate: **at least one `primary`**. Outcome *text* is never copied — the link is the record.

### Tab 2 — Teaching notes (`teaching_notes`) — the chapter body

Ordered block list; each block is a card, drag to reorder (writes `block_no`), duplicate, delete.

| Field | Input | Required | Notes |
|---|---|---|---|
| `block_type` | select | yes | `hook · explanation · definition · analogy · step · caution · recap · activity`, default `explanation`; colour-coded left border per type |
| `heading_en` / `heading_ne` | text | no | ≤200 |
| `body_en` | markdown editor | **yes** | KaTeX live preview, `$…$`/`$$…$$` toolbar, Devanagari-safe font; the publish gate rejects an empty `body_en` on any block |
| `body_ne` | markdown editor | per config | side-by-side in **Both** mode |
| `speaker_note_en` / `speaker_note_ne` | textarea | no | "say it like this" — what TTS and the tutor read aloud |
| `board_hint` | text | no | ≤200; a plain instruction ("draw two overlapping circles"), rendered as text in the reader — **not** a canvas command, since there is no whiteboard |
| `media_id` | media picker | no | opens Tab 6; deferred FK so a note can be typed before its image exists |

### Tab 3 — Worked examples (`teaching_examples`)

| Field | Input | Required | Notes |
|---|---|---|---|
| `example_no` | auto | yes | unique per version |
| `kind` | select | yes | `worked · guided · practice · exam` |
| `difficulty` | select | yes | `foundation · core · stretch` |
| `prompt_en` | markdown | **yes** | the question |
| `prompt_ne` | markdown | per config | |
| `given_en` / `given_ne` | markdown | no | "Given: r = 7 cm" |
| `steps` | **repeatable step editor** | no (yes for `worked`) | per step: `n` (auto), `en`, `ne`, `latex`, `why_en`, `why_ne`. Rendered by `solver_steps` (§E.4). Drag to reorder |
| `answer_en` / `answer_ne` | markdown | yes | |
| `answer_latex` | latex + preview | no | |
| `unit_label` | text | no | "cm²" |
| `marks` | number | no | |
| `source_ref` | text | no | typed by the admin, e.g. "CDC Class 10 Maths 2082, Example 2.4"; **typed, never scraped** |

### Tab 4 — Misconceptions (`teaching_misconceptions`)

| Field | Input | Required |
|---|---|---|
| `wrong_belief_en` | textarea | **yes** |
| `wrong_belief_ne` | textarea | per config |
| `why_students_think_en` / `_ne` | textarea | no |
| `correction_en` | textarea | **yes** |
| `correction_ne` | textarea | per config |
| `diagnostic_question_en` / `_ne` | textarea | no — but strongly prompted: this is the probe the tutor asks |
| `severity` | select `rare · common · pervasive` | yes |
| `linked_outcome_id` | select from this unit's outcomes | no |
| `sort_order` | drag | yes |

### Tab 5 — Formulas (`teaching_formulas`)

| Field | Input | Required | Notes |
|---|---|---|---|
| `name_en` | text | **yes** | "Area of a circle" |
| `name_ne` | text | per config | |
| `latex` | latex editor + live KaTeX | **yes** | |
| `spoken_en` | text | **yes** | "area equals pi r squared" — **the publish gate rejects a formula without `spoken_en`** (`D1 §B.3`). TTS reads this, never the LaTeX |
| `spoken_ne` | text | per config | |
| `symbols` | repeatable rows | no | `{sym, meaning_en, meaning_ne, unit}` — a 4-column mini table |
| `conditions_en` / `_ne` | text | no | "for r > 0" |
| `derivable` | toggle | yes | true ⇒ the tutor may derive rather than state |
| `must_memorize` | toggle | yes | drives the formula-sheet tool |
| `sort_order` | drag | yes | |

### Tab 6 — Exam tips (`teaching_exam_tips`)

| Field | Input | Required | Notes |
|---|---|---|---|
| `tip_type` | select | yes | `frequent · trap · marking_scheme · time_management · presentation` |
| `body_en` | textarea | **yes** | |
| `body_ne` | textarea | per config | Sahayatri had `exam_tips_ne` **only** — Nepali-only tips were unusable in English-medium schools |
| `exam_board` | select | yes | `neb · see · cdc · school` |
| `question_pattern` | text | no | ≤120, e.g. "2-mark proof in Group B" |
| `typical_marks` | number | no | |
| `appeared_years` | tag input (BS years) | no | JSONB; **typed by the admin, not scraped** |
| `subject_offering_id` | select | no | links real full/pass marks from `subject_offerings` |
| `sort_order` | drag | yes | |

### Tab 7 — Key terms (`teaching_key_terms`) and Media (`teaching_media`)

Key terms — a fast inline grid, because a chapter has 10–30 of them:

| Field | Input | Required | Notes |
|---|---|---|---|
| `term_en` | text | **yes** | unique per version (server rejects a duplicate with a jump-to-existing link) |
| `term_ne` | text | no | |
| `keep_in_english` | toggle | yes | default from `language.keep_terms_in_english_default`; when true the tutor keeps the English noun mid-Nepali-sentence |
| `definition_en` / `definition_ne` | textarea | no (EN required to publish if the term is linked from a note) | |
| `sort_order` | drag | yes | |

Media — **references only, never parsed, never OCR'd** (`D1 §B.2`, and the direct expression of constraint 3):

| Field | Input | Required | Notes |
|---|---|---|---|
| `media_type` | select | yes | `image · svg · audio · video · link` |
| `file_id` | `FilePicker` (existing `components/files/FilePicker`) | one of three | resolves to `managed_files` |
| `external_url` | url | one of three | |
| `svg_inline` | code editor | one of three | admin-pasted SVG; sanitized server-side (strip `<script>`, `on*`, external `href`) before storage |
| `alt_text_en` | text | **yes** | accessibility **and** the only thing the AI may say about the image. A media row without it blocks publish |
| `alt_text_ne` | text | per config | |
| `caption_en` / `caption_ne` | text | no | |
| `licence` | text | no | required when `external_url` is set (UI enforces) |
| `attribution` | text | no | same |
| `sort_order` | drag | yes | |

A visible banner on this tab: **"Images are shown to students and described to the AI using your alt text.
Nothing in an image is read automatically."** That sentence is the constraint made legible to the person
entering data, which is what stops an admin from uploading a photo of a page and expecting it to work.

## G.4 Screen 4 — Student preview

Renders the current draft exactly as the student chapter reader will (`E.1`/`E.20` components, same
markdown+KaTeX pipeline), with a `EN | NE | Both` switch and a "what the AI will see" toggle that shows the
assembled grounding block (§D.5) with its `token_estimate`. Sahayatri's admin screens rendered KaTeX
"so you review exactly what students will see" (`UX §4`); the AI-view toggle is the addition — the author can
see the cost and completeness of what they are about to publish.

## G.5 Screen 6 — Review queue and the draft → review → publish workflow

State machine (`D1 §B.3`, unchanged here):

```
draft --submit--> in_review --approve--> in_review(approved) --publish--> published
   ^                  |                                                      |
   |                  +--reject--> draft                                     |
   +--- edit a published version: clones to v+1 draft <---------------------- +
published --archive--> archived      (never deleted — a parent may ask what was taught in Baisakh)
```

Queue UI: three tabs **Needs review** (`in_review`) · **My drafts** (`draft`, mine) · **Recently published**
(last 30 days). Each row: section code + title, unit, author avatar + name, `submitted_at` relative time,
language chips, block counts, and the publish-gate result as a green tick or a red count of unmet conditions.
Bulk actions on the Needs-review tab: **Approve selected**, **Publish selected**, **Reject selected** (reject
requires a comment). Every action writes a `teaching_content_reviews` row (`action`, `from_status`,
`to_status`, `actor_id`, `comment`) — that is the audit trail Sahayatri did not have (`BC §7`: "no audit trail
of admin edits").

Publish-gate conditions, all evaluated server-side in `services/content_resolver.publish_gate` and mirrored
in the UI checklist so nothing is a surprise:

| # | Condition | Source |
|---|---|---|
| 1 | at least one outcome link with `emphasis='primary'` | `D1 §B.3` |
| 2 | at least one `teaching_notes` block | `D1 §B.3` |
| 3 | no `teaching_notes` row with empty `body_en` | `D1 §B.3` |
| 4 | every `teaching_media` row has `alt_text_en` | `D1 §B.3` |
| 5 | every `teaching_formulas` row has `spoken_en` | `D1 §B.3` |
| 6 | when `language.require_nepali=true`, no `*_ne` primary field is empty | config §B.5 |
| 7 | `summary_en` present | this spec (the reader and the grounding block both need it) |
| 8 | when `authoring.require_review=true`, the version has an `approve` review row by someone other than the author | config §B.5 |
| 9 | publishing a row with `school_id IS NULL` requires `curriculum.publish_platform` | `permissions.yaml` |

On publish: compute `content_sha256` over the canonical block payload; set `language_coverage` from actual
field presence; set `published_by_id` / `published_at`; archive the previously published version of the same
section (the partial unique index `uq_tsv_one_published` makes any violation a hard DB error rather than a
silent double-publish); build and store a `teaching_content_snapshots` row per language; emit
`curriculum.section_published`.

Fork / override (screen 1 action, `D1 §B.3`): clones the platform section into a school row with
`overrides_section_id` set and copies the published blocks as draft v1. **Clearing the override re-adopts
platform content** — the mechanism that lets one curriculum correction reach every school. The UI states
this explicitly on the fork dialog: "Your school will stop receiving platform updates for this chapter until
you remove the override."

## G.6 Screen 9 — Bulk / CSV import

There is no OCR, so bulk entry is the only defence against the labour of typing a whole curriculum. Six CSV
templates, each downloadable pre-filled with the target unit's identifiers, following the existing import UX
(`frontend/app/dashboard/bulk-uploads/csv/page.tsx`, whose `ImportResult` shape —
`total_rows / imported_rows / skipped_rows / error_rows / errors[]` — is reused verbatim) and the
`IemisImportLog` audit pattern (`backend/app/models/iemis.py:8-27`).

| Template | Target table | Columns (header row, exact) |
|---|---|---|
| `sections.csv` | `teaching_sections` | `unit_code, section_no, code, kind, title_en, title_ne, summary_en, summary_ne, estimated_minutes, difficulty, prerequisite_codes, tags` |
| `notes.csv` | `teaching_notes` | `section_code, block_no, block_type, heading_en, heading_ne, body_en, body_ne, speaker_note_en, speaker_note_ne, board_hint` |
| `examples.csv` | `teaching_examples` | `section_code, example_no, kind, difficulty, prompt_en, prompt_ne, given_en, given_ne, steps_json, answer_en, answer_ne, answer_latex, unit_label, marks, source_ref` |
| `formulas.csv` | `teaching_formulas` | `section_code, sort_order, name_en, name_ne, latex, spoken_en, spoken_ne, symbols_json, conditions_en, conditions_ne, derivable, must_memorize` |
| `misconceptions.csv` | `teaching_misconceptions` | `section_code, sort_order, wrong_belief_en, wrong_belief_ne, why_students_think_en, why_students_think_ne, correction_en, correction_ne, diagnostic_question_en, diagnostic_question_ne, severity, outcome_code` |
| `key_terms.csv` | `teaching_key_terms` | `section_code, sort_order, term_en, term_ne, keep_in_english, definition_en, definition_ne` |
| `exam_tips.csv` | `teaching_exam_tips` | `section_code, sort_order, tip_type, body_en, body_ne, exam_board, question_pattern, typical_marks, appeared_years` |
| `exercises.csv` | `question_bank_items` | `section_code, question_text, question_text_nepali, question_type, marks, bloom_level, difficulty, options_json, correct_answer, explanation, source_reference, source_exercise_label, source_page, tags, has_math, has_sub_parts, sub_part_count` |

Rules that make CSV safe for content with LaTeX and Devanagari:

- **UTF-8 with BOM accepted**, comma-delimited, RFC-4180 quoting; `\n` inside a quoted cell is preserved so a
  multi-paragraph `body_en` survives one cell.
- `steps_json`, `symbols_json`, `options_json` are JSON strings in a single cell; a parse failure is a row
  error, never a partial write.
- Rows key on **`section_code`**, not UUID, so a curriculum author can prepare a whole subject in a
  spreadsheet before anything exists. Unknown `section_code` = row error listing the nearest matches.
- **Dry-run first, always.** Upload → server validates every row → the UI shows the `ImportResult` table with
  per-row errors → an explicit **Commit** button performs the write in one transaction per file.
- Imported rows land as **draft** on a **new version** of each touched section, never onto a published
  version. Import can therefore never change what students currently see.
- Bloom autofill runs on import when `exercises.autotag_bloom=true` and `bloom_level` is blank; the dedupe
  check runs on every `exercises.csv` row and reports near-duplicates as *warnings* (importable) while exact
  `content_sha256` matches are *skips*.
- Every import writes an audit row (`format_code`, `filename`, counts, `errors` JSONB) using the existing
  import-log pattern, and the queue shows "imported by X, 214 rows, 3 errors" against the resulting drafts.

A **paste-a-table** path complements CSV for small edits: the notes, formulas, key-terms and exercises tabs
accept a pasted TSV block (straight from Excel or Google Sheets) into the grid, mapped by column order, which
is how a teacher adds 15 key terms in 30 seconds without leaving the editor.

## G.7 Screens 7–8 — Exercise bank browser and entry

**Browser** (`/dashboard/curriculum/exercises`) — ports `ExerciseBankClient.tsx` (721 lines, `UX §1.5`):

- Filter bar: class, subject, unit, section, `question_type` (the widened 15-value enum), `bloom_level`,
  `difficulty`, `source` (`manual|ai|textbook|past_paper`), `is_approved`, `has_math`, tag contains, free text.
- Table columns: rendered question (markdown+KaTeX, 2-line clamp with expand), type chip, marks, Bloom chip,
  difficulty chip, **source badge** (`CDC textbook` / `Past paper` / `Manual` / `AI generated` — the colour
  coding from `UX §1.5`), `times_used`, approved tick, section link, updated-at.
- Row actions: edit, duplicate, **find duplicates** (runs §C.1b and shows the similarity list), approve,
  soft-delete, add to a paper blueprint, seed as a spaced-rep card for a class.
- Bulk: approve, tag, set difficulty, set Bloom, move to section, delete, **export CSV**.
- Pagination server-side (Sahayatri's list routes were unbounded — `BC §7`).

**Entry form** (`/dashboard/curriculum/exercises/new`), field by field:

| Field | Input | Required | Autofill / validation |
|---|---|---|---|
| `section_id` | section picker | no | prefilled when opened from a section |
| `subject_id`, `class_id` | selects | yes | inferred from the section |
| `question_text` | markdown editor + KaTeX preview | **yes** | on blur: run dedupe (§C.1b) and show "similar to Q#412 (0.81) — view" |
| `question_text_nepali` | markdown editor | per config | |
| `question_type` | select (15 values) | yes | **autofilled by `exercise_heuristics.detect_type`** from the wording — `सही उत्तर छान्नुहोस्` → mcq, `प्रमाणित गर्नुहोस्` → proof, `रचना गर्नुहोस्` → construction, `मिलाउनुहोस्` → match, `रिक्त स्थान भर्नुहोस्` → fill_blank, `नक्सामा` → map_work, `क्रियाकलाप` → activity, `अनुच्छेद पढ्नुहोस्` → comprehension. Suggestion only; the author confirms |
| `marks` | number (0.5 steps) | per `exercises.require_marks` | |
| `bloom_level` | select | no | autofilled by the ported Bloom tagger when `exercises.autotag_bloom=true` |
| `difficulty` | select | yes | default `medium` |
| `options` | repeatable rows | required when type=`mcq` | Nepali sub-part letters क ख ग घ ङ offered alongside A B C D |
| `correct_answer` | markdown | no | required to use the question in an auto-scored quiz; the form warns |
| `explanation` | markdown | no | |
| `answer_markdown_ne` | markdown | no | |
| `has_math` | toggle | auto | detected from `$`/`\(` presence, editable |
| `has_image_reference` | toggle | auto | detected from `![` or "figure" |
| `has_sub_parts` / `sub_part_count` | toggle + number | auto | detected from `(क)`/`(a)`/`(i)` patterns |
| `source` | select | yes | default `manual` |
| `source_reference` | text | no | default from `exercises.default_source_label` |
| `source_exercise_label` | text | no | "अभ्यास १.२" |
| `source_page` | number | no | |
| `tags` | tag input | no | |
| `is_approved` | toggle | — | forced false for teachers when `exercises.allow_teacher_publish=false` |

"Save and add another" keeps the section/type/marks/source fields, which is what makes typing an अभ्यास of
20 questions tolerable.

## G.8 Screen 10 — Coverage dashboard

Matrix, grade × subject, each cell showing `published sections / total units` with a heat colour, and drill-in
listing units with no published section. Secondary panels: **Missing Nepali** (published sections with
`language_coverage.ne = false`), **Stale** (published > 12 months ago), **Unauthored but taught** (units that
appear in `timetables`/`courses` but have no published section), **Exercise thin** (sections with < 5
approved questions, so spaced repetition has nothing to schedule).

This screen is what replaces Sahayatri's Import Hub summary strip (`UX §1.5`): the same at-a-glance
"what state is my content in" answer, for typed content instead of extracted content.

## G.9 Mobile admin surface

`flutter_admin` gets a **read + approve** subset only (`mobile.yaml` declares `admin: {module: curriculum,
tabs: [Authoring Queue, Coverage]}`): review a submitted section, read its blocks, approve/reject with a
comment, see coverage. **Authoring is web-only** — long bilingual markdown with LaTeX on a phone keyboard is
not a workflow worth building, and pretending otherwise would produce the half-built screens `UX §5`
catalogues. Teacher and student apps get the reader and the exercise practice flow, not the editor.

---

# H. IMPLEMENTATION SLICES

Five slices, dependency-ordered. Each is independently shippable and has one testable exit criterion.

## Slice 1 — Content spine (`nepal_curriculum` plugin + schema + authoring)

**Build:** the plugin package of §B.3 with manifest/config_schema/permissions/events; migrations
`nc_0001_teaching_content` + `nc_0002_question_bank_nepal`; `models/teaching_content.py`;
`services/content_resolver.py` (override CTE + publish gate), `bloom_tagger.py`, `dedupe.py`,
`exercise_heuristics.py`; `routes.py` CRUD for sections/versions/blocks/reviews and the exercise endpoints;
admin screens 1–8 on web; the student/teacher chapter reader; `flutter_admin` review subset.
**No AI in this slice at all.**

**Exit criterion:** an admin creates a section under CDC Class 10 Maths Unit 2, types 3 notes / 2 examples /
1 formula / 2 misconceptions / 8 key terms / 3 exam tips / 12 exercises in both EN and NE, submits, a second
user approves and publishes; a student in that class opens the chapter reader and sees exactly that content;
`GET /curriculum/sections/<id>?depth=full` returns the §D.5 payload with
`language_coverage {en:true, ne:true}`; attempting to publish a copy with an empty `body_en` and a media row
lacking `alt_text_en` fails with both conditions listed; and a second `teaching_section_versions` row with
`status='published'` for the same section is rejected by the database.

## Slice 2 — Bulk entry + coverage

**Build:** `services/csv_import.py` with the 8 templates of §G.6, dry-run then commit, per-row errors, import
audit rows; the paste-a-TSV grid path; screen 9 and screen 10; the nightly
`nepal_curriculum.rebuild_stale_snapshots` beat task.

**Rationale for placing it second:** without bulk entry, slice 3's grounding has almost nothing to ground
against. One chapter typed by hand proves the schema; a subject's worth of content is what makes the AI
useful, and only CSV gets there.

**Exit criterion:** a 200-row `notes.csv` + `exercises.csv` pair for one subject imports as drafts with a
dry-run report that catches an unknown `section_code`, a malformed `steps_json` and a duplicate
`question_text` (skipped, not written); published content is unchanged throughout; the coverage matrix moves
from 1/12 to 11/12 published for that subject; and the exercise browser filters to
`question_type='construction'` and returns only construction questions.

## Slice 3 — Grounded tool catalog (registry + 12 tools + 6 templates)

**Build:** migration `nc_0003_registry_columns` (§D.1); `INPUT_SCHEMAS` + the new output schemas;
`follow_up_suggestions` added to every schema in `tool_schemas.py`; `context_chapter` builder (§D.5);
`tool.grounding` enforcement; the `NEPAL_FIRST_SYSTEM` prefix behind `generation.nepal_first_prompt`;
Devanagari language detection; `GET /ai/tools` gains `role`/`category`/`q`; the dynamic web route
`/dashboard/ai-workbench/[toolKey]` with `GeneratedToolForm` + the `RESULT_TEMPLATES` map; templates
`text_block`, `section_list`, `qa_list`, `solver_steps`, `plan_card`, `flashcard_deck`; seed waves 0–1
(12 tools) with EN+NE prompts and nutrition rows; the Flutter `ToolRunnerScreen` in `aschool_shared` with the
same six result builders and the 24 h on-device cache.

**Exit criterion:** a student opens the catalog, filters to "Core learning", runs `concept_explainer` scoped
to the section published in slice 1, and gets a result carrying `used_chapter_context: true` plus a
`context_ref.sha256` that matches the stored snapshot; the result renders with a "✓ Based on your chapter"
badge and three working follow-up chips; a school admin flips the tool's kill switch and the very next request
returns 403; a student with no guardian consent gets 403 before any provider call; a tool with
`grounding='required'` pointed at an unauthored unit returns 422; `ai_generations` has one row per attempt
with `cost_usd` and `citations` populated; and **zero new Flask routes were added for the 12 tools**.

## Slice 4 — Learning loop (SM-2 + adaptive + gamification)

**Build:** migration `nc_0004_learning`; ported `sm2_update` + card seeding scoped to school/class/approved
questions; `GET /adaptive/due`, `POST /adaptive/cards/<id>/review`, `GET /adaptive/stats`; per-section ease
aggregation writing `mastery_records` (`avg_ease_factor`, `cards_total`, `cards_due`, `reason`) and
`learning_paths.evidence`; `student_xp_state` + XP awards through `points_logs` + 6 seeded `Badge` rows +
streak logic; web review page, adaptive-path page, gamification page; the same three screens in
`flutter_student`.

**Exit criterion:** a student with 12 seeded cards reviews one at quality 5 and one at quality 2; the first
card's `ease_factor` rises and `due_at` moves out by the SM-2 interval, the second resets to
`repetitions=0, interval_days=1, status='learning'` and increments `lapses`; the adaptive path row for that
section shows band `needs_work` with the ease number inside its `reason` string; XP increases by exactly
`XP_TABLE['spaced_rep_review']` per review with one `points_logs` row each; a 7-day streak awards the
`streak_7` badge and the bonus once, not twice; and the leaderboard query for a 1,000-student school returns
in under 100 ms using `ix_sxs_leaderboard`.

## Slice 5 — Live quiz realtime

**Build:** migration `nc_0005_live_quiz`; the 6 HTTP routes of §F.8; the socket module of §F.5 reusing
`realtime.connect` plus the two `_sessions` accessors; Redis room + code + sorted-set keys; the host console
and participant view on web; the participant view in `flutter_student`; the `qa_list` → "Start live quiz"
handoff; Socket.IO Redis `message_queue` confirmed in the deployment.

**Exit criterion:** a teacher generates 8 questions with `quiz_generator`, starts a live quiz, and 3 students
join by code from two different gunicorn workers; a forged `lq_answer` carrying
`{"is_correct": true, "score": 999}` scores exactly according to the server's own comparison and the injected
fields are absent from every emitted payload; a second answer to the same question index is ignored; a student
who reloads mid-quiz receives `lq_state` with the current question, their own answers and their score; only
the host room ever receives `lq_question_host`/`lq_answer_distribution`; ending writes
`live_quiz_sessions.leaderboard` + one `OnlineExamAttempt` per participant; and a student from another school
who guesses the join code is rejected with `lq_error{code:"not_found"}`.

## Slice 6 (optional, gated) — 3D/OER viewer + remaining templates

**Build:** migration `nc_0006_oer_3d`; the branded external-resource viewer with licence/attribution always
visible; oEmbed metadata refresh (24 h); `model_annotator` tool + `annotation_list` template; model-linked
quizzes; view analytics; then the remaining templates `table_grid`, `checklist`, `chart_panel`,
`wellbeing_card`, `writing_feedback`, `feedback_panel`, `insight_cards`, `rubric_grid`, `tiered_panel`,
`question_paper`, `board_stream`, and seed waves 2–3 (~35 + shape-differentiated tools).
`slide_deck` stays `status='disabled'` until the `D1 §C.5` deck engine lands.

**Exit criterion:** a curated simulation resource renders with its licence line and attribution visible
without scrolling; `model_annotator` produces 5 bilingual annotations from node names and chapter context
**with no image sent to any provider**; an admin edits and saves them to `oer_resources.annotations`; and each
newly seeded tool renders through its declared `ui_type` with no tool-specific page file in the repo (verified
by a test asserting `frontend/app/dashboard/ai-workbench/` contains exactly two route files).

---

# I. RISKS + WHAT NOT TO PORT

## I.1 Risks, with evidence and mitigation

**R1 — Content entry is the real cost, and it is a people problem, not a code problem.**
Evidence: `BC §4.9` prices Sahayatri's automated path at ~21 k tokens and 30–40 minutes per 298-page
textbook. Typing the same book by hand is tens of hours of skilled bilingual labour. `SI §9` records that
"full NEB Class 9–12 textbook corpus processing" never finished even *with* the automation. Mitigation: CSV
+ paste-TSV in slice 2 (deliberately placed before the AI slice), platform-level seeding so one authored
chapter serves all schools (`school_id IS NULL`), the fork/override chain so schools customise instead of
retyping, and the coverage dashboard making the gap visible and assignable. Do not let slice 3 ship as the
demo of the product before slice 2 exists — an AI grounded in one chapter looks like a toy.

**R2 — Enum widening on `question_bank_items.question_type` is a one-way door.**
Evidence: `question_bank.py:25-32` defines a Postgres enum; Postgres enums are append-only and
`ALTER TYPE ... ADD VALUE` cannot run in the same transaction that uses the new value. Mitigation: enum
changes get their own migration step (§C.10 step 2), and every consumer that switches on `question_type`
must be audited first — `api/v1/ai_tools.py` question-bank routes, `question_paper_v2`, the exam-mark config
in `frontend/lib/exam-mark-config.ts`, and any UI select. A missed consumer shows as a question that cannot
be edited, not as a crash, which is the dangerous failure mode.

**R3 — Cost blow-up from grounding.** Injecting a chapter block into every call multiplies prompt tokens.
Evidence: Sahayatri used a 1,400-char excerpt for tools and **6,000** for the voice tutor
(`BC §4.3`), and its per-tool costs ran 15–300 tokens *before* context (`SI` Appendix A). ASchool enforces on
**cost**, not tokens (`token_hub.py` price sheet + `_check_quota`), so a careless excerpt budget silently eats
a school's monthly quota. Mitigation: `grounding.excerpt_chars` / `tutor_excerpt_chars` config caps,
`token_estimate` stored on every snapshot and shown in the admin preview, per-tool `budget` tiers bounding
`max_tokens`, `student.max_daily_generations`, and the existing `AIToolAnalyticsDaily` rollup to watch it.

**R4 — Guardian consent blocks the entire student surface, and that will look like a bug.**
Evidence: `workbench.py:136-151` resolves the student's own row and requires a granted `GuardianAIConsent`
for **any** tool when `g.role == 'student'` — deliberately, because the old category check was bypassable.
So on day one every student sees 403 until guardians consent. Mitigation: the catalog must render tools as
locked with an explanatory state and a "ask your guardian" flow, not as an error; school admins need a consent
coverage report. This is a product requirement, not a workaround.

**R5 — Live quiz correctness under multiple workers.** Evidence: `realtime.py:29-33` keeps per-socket state
in-process precisely because a socket's events arrive on its owning worker; but `emit(to=room)` across workers
requires a Redis `message_queue`, which Sahayatri had (`BC §1`, Redis db1). Without it, participants on other
workers never receive `lq_question`. Mitigation: make the message queue a slice-5 deployment gate and test with
two workers (the exit criterion says so explicitly).

**R6 — Two "learning path" signals disagreeing.** Evidence: Sahayatri wrote `learning_paths.mastery_scores`
but its recommender read `SpacedRepCard` — `SI §9` lists this redundancy as a known bug. ASchool now has
`MasteryRecord` from `Marks` *and* per-section ease from cards. Mitigation: `mastery_records.section_id IS
NULL` rows stay marks-derived and subject-level; section rows stay card-derived; `evidence.signal` names which
produced a recommendation; the UI labels them differently ("exam performance" vs "recall practice"). Never
average the two into one opaque number.

**R7 — False privacy copy on the wellbeing surface.** Evidence: `UX §4.10` quotes Sahayatri's literal footer
"🔒 Your responses are never stored or shared", while under ASchool every generation writes an `AIGeneration`
row (`workbench.py:255`) and critical content reaches a counsellor (`workbench.py:424-447`). Mitigation: the
replacement copy in §E.15. Shipping the original sentence would be a material misstatement to a minor.

**R8 — `mastery_records` uniqueness change touches live data.** Evidence: the existing constraint
`uq_mastery_school_student_subject` (`adaptive_learning.py:104-108`) must become two partial indexes (§C.7).
Mitigation: additive migration — create the partial indexes, verify no duplicate `(school, student, subject)`
rows exist with `section_id IS NULL`, then drop the old constraint in the same revision; the pre-check makes
the failure loud and reversible.

**R9 — Snapshot staleness.** The grounding block is cached (`teaching_content_snapshots`). If a school edits
and republishes, tools must not keep citing the old bytes. Mitigation: snapshots are keyed
`(version_id, language, document_sha256)` and publishing creates a **new version**, so a stale snapshot can
never be selected for a newly published version; the nightly beat task only backfills missing snapshots.

**R10 — Plugin package validator failures on `ai_suite`.** Evidence: `D2 §A.2` records that `ai_suite`
violates the "`__init__.py` mandatory" rule and that the v2 validator fails on it; `ls` confirms the folder
holds only `__init__.py`, `manifest.yaml`, `config_schema.yaml`. Since this spec adds fields to
`ai_suite/config_schema.yaml`, it should not simultaneously try to promote that manifest to v2. Mitigation:
keep the `ai_suite` changes v1-shaped (additive `fields:`) and let the `D2 §A.3` wave plan promote it.

**R11 — 20 result templates is a large frontend surface, and the tempting shortcut is a page per tool.**
Evidence: Sahayatri ended with 19 orphaned legacy tool pages plus two parallel 3D-manager pages
(`UX §5`), precisely because pages proliferated. Mitigation: the ownership rule in §D.3 plus the slice-6 exit
test that counts route files under `ai-workbench/`.

**R12 — Devanagari rendering in generated documents.** Evidence: `D1 §C.4` chose the canvas/WeasyPrint path
specifically because it handles Devanagari shaping via Pango/HarfBuzz and a server-side pptx writer would not.
Mitigation: no new PDF/PPTX engine (constraint already locked); the Nepali typography pack is `D1 §C.5` item 7
and any deck/paper work waits for it.

## I.2 What NOT to port — with the evidence

**Code-level anti-patterns:**

| Do not port | Evidence |
|---|---|
| `GroqService.chat()` as written — its signature accepts no `system=` or `response_format=`, yet 8+ call sites pass them, so **every JSON-mode tool call raises `TypeError` at runtime** | `BC §4.1`, confirmed live at `S:backend/app/api/ai/tools/quiz_generator/service.py:54-60` passing `system=` and `response_format=` into a 4-parameter method. Use `AITokenHub` only |
| Check-then-deduct without row locking (`SELECT` then `UPDATE`, no `FOR UPDATE`) | `BC §4.7`: "concurrent spend can race" |
| `token_usage_log` / per-user token wallets | duplicates `ai_usage_logs` + contradicts per-school cost quotas (§C.9) |
| `pdf_chat` fetching a client-supplied `document_url` server-side | `BC §7` names it SSRF explicitly |
| Redis-only durable state (live quiz, whiteboard rooms, community posts) | `SI §9`: "the single biggest Sahayatri architectural mistake"; `SI §10`: "use DB-first with Redis cache" |
| Un-gated AI routes (voice-tutor chat) | `SI §9`: "Voice tutor chat un-token-gated (revenue leak) — flagged Priority 1 in both audits" |
| `POST /ai/tools/seed/` as an HTTP endpoint | `S:…/tools_registry.py:560-578` — any token with `role == "admin"` could reseed the whole catalog |
| Shared `run_text_tool()` catch-all | `SI §9` structural critique; ASchool's per-tool schema + handler is the fix already in place |
| The 95-entry inline `_TOOL_CONFIGS` dict | `S:…/generic_tool.py:19-836` — a 800-line literal in a route module; becomes registry rows + prompt files |
| Per-tool endpoints and `frontend_path` columns | §D.1; they are how Sahayatri's routes and catalog drifted |
| `.env.example` with a live-looking Groq key, mounted as the compose `env_file` | `BC §1` security note |
| `usesCleartextTraffic="true"`, hardcoded `http://10.0.2.2:5000` in six files | `UX §2.1`, `UX §3.3` |
| Visible demo credentials on the login screen, `DEMO_STUDENT_ID` constants | `UX §2.2`, `UX §5` |
| Admin-impersonation scope selectors (teacher tools starting from `GET /admin/institutions/`) | `UX §1.6`: "teacher tools are wired as an admin-impersonation demo, not as 'me, the logged-in teacher'" |
| Client-trusted scoring of any kind | `live_quiz_socket.py:95` is the *fixed* version; the pre-fix bug is in `SI §9` |
| Prose-regex result parsing (`TeacherAnalyticsWorkspace` extracting Average/Median out of sentences) | `UX §1.6`; replaced by schemas + handler-computed numbers |
| Writing tools that return rewritten student text | CI gate (e) at `tool_schemas.py:147-149` forbids a `revised_text` field |
| A full i18n catalogue that one component reads | `UX §1.8`: `useTranslations` was called in exactly one place |
| Tailwind class names in a project without Tailwind (Sahayatri's `error.tsx`/`loading.tsx`/`not-found.tsx` render unstyled) | `UX §5` |
| Duplicate class declarations (`mobile/lib/screens/quiz_screen.dart` declares every class twice, 1,004 lines, will not compile) | `UX §5` |
| Mock dashboards shipped as real screens (`dashboard_screen.dart`: hardcoded "7-day streak", "1,240 XP", three fake bars) | `UX §5` |
| Feature panels implemented but mounted nowhere (`CircleSearchOverlay`, `AiPptPanel`, `TtsService`, `OfflineAiCache`, `ModelAiOverlay`, `SketchfabBridgeService`) | `UX §3.3` |
| Two parallel managers for one thing (`/admin/sketchfab` vs `/admin/simulations`) | `UX §5` |
| Unbounded list endpoints | `BC §7`: "no pagination standards (some list routes unbounded)" |

**Whole subsystems not ported** (already justified in A.7): the whiteboard deployable, the vision ingestion
pipeline and its four draft tables, image doubt solving, Circle-to-Search, the video generator, python-pptx
and python-docx engines, Sahayatri auth, its institution/enrollment ERP, its subscription/token wallet, the
SMS API-key layer (deferred), the teacher community (deferred), and the parent portal.

## I.3 What Sahayatri got right that this spec must not lose

Recorded so a later reviewer can check the port kept them:

1. Nepal exercise typology as first-class data — never force MCQ (`SI §1` problem 3) → §C.1 enum widening.
2. Curated, human-approved chapter knowledge as the grounding source, not a vector guess (`SI §4.3`) →
   §C.2 + §D.5, with human approval enforced by the publish gate.
3. Bilingual at the **data** layer, with an in-page disclosure rather than a hard language switch
   (`UX §4.11`) → paired `*_en`/`*_ne` on every field, `language_coverage`, EN|NE|Both editor toggle.
4. Honest degradation: say "AI needs internet, the rest still works" instead of failing blank (`UX §4.1`) →
   labelled deterministic fallback + `fallback_used`, offline banner, on-device result cache.
5. Grounding as a **visible** trust signal, and equally visible when absent (`UX §4.2`) →
   `used_chapter_context` + `context_ref`.
6. Follow-up chips on every result (`UX §4.3`) → `follow_up_suggestions` in every schema.
7. Cost shown before you spend (`UX §4`) → `budget` tiers + cost badges + headroom chip.
8. Empty states that name the fix (`UX §4.8`) → required on every screen in §G.
9. Confidence-tiered bulk review to save admin time (`UX §4`) → reinterpreted as the publish-gate checklist
   and the CSV dry-run report.
10. Recommendations that explain themselves (`UX §4.7`) → `learning_paths.evidence` + template-filled
    `reason`.
11. Server-authoritative scoring and late-joiner state recovery (`BC §7` items 5) → §F.3, §F.6.
12. One catalog row as the single source of truth for menus, gating and pricing (`BC §8` item 12) → §D.1,
    with routes derived rather than stored.

---

# J. OPEN QUESTIONS FOR THE OWNER

These change what gets built and cannot be resolved from the code or the reports.

1. **Who authors platform content?** The whole design assumes a platform curriculum team writes
   `school_id IS NULL` sections for CDC Science/Maths grades 8–10 first (`D1 §B.2` says start there). If no
   such team exists, every school authors its own and the fork/override chain is dead weight — say so and it
   can be dropped from slice 1.
2. **`nepal_curriculum` pricing.** §B.4 proposes NPR 199/month, starter. Alternative: make it free/`is_free`
   and bundle it into `ai_suite`, on the argument that content without AI is a weak sell. That choice changes
   the manifest and the commercial seam of B.1 reason 4.
3. **Does the exercise bank belong to the school or the platform?** `question_bank_items` is
   `SchoolModel` (NOT NULL `school_id`), so platform-authored questions cannot exist today. If platform
   exercises are wanted (they probably are, for CDC textbook अभ्यास), `school_id` must become nullable there
   too — a schema decision with a tenancy-audit consequence (CI gate d) that should be made before slice 1,
   not retrofitted.
4. **Guardian consent default.** R4: students see 403 until a guardian consents. Options: (a) keep it strict,
   (b) allow school-admin bulk consent on the school's legal basis, (c) allow a
   "no-student-data" tool subset without consent. This is a legal/product call.
5. **Voice: is TTS/STT in scope for v1?** They are the only ported capabilities needing new provider
   integrations (edge-tts, Whisper audio upload) and new metered feature keys. Cutting them removes A.4
   #34–36 and simplifies slice 3 considerably; keeping them is the difference for students who cannot type
   Devanagari quickly.
6. **Live quiz before or after the tool catalog?** §H orders it last (slice 5) because it depends on generated
   questions. If classroom engagement is the demo that sells the product, it can move to slice 3.5 using
   manually entered questions from slice 1.

---

# K. TRACEABILITY

| Section | Answers | Key anchors |
|---|---|---|
| A | scope decision, 68 capabilities × verdict × reason × plugin | `SI §3`, `BC §2-5`, `UX §1-3` |
| B | one new plugin + extend `ai_suite`; layout, manifest, config schema | `ai_suite/manifest.yaml:16-28`, `D2 §A.1-A.2`, `config_store.py:49` |
| C | data model + de-duplication verdicts | `question_bank.py:16-141`, `curriculum.py:16-130`, `lms.py:20-173`, `adaptive_learning.py:31-144`, `gamification.py:18-83`, `ai_workbench.py:20-284`, `digital_content.py:17-63`, `exam.py:168-205`, `D1 §B.2` |
| D | registry columns, `ui_type` → component, seed strategy, pipeline touch-points | `ai_workbench.py:82-112`, `api/v1/ai_workbench.py:24-79`, `workbench.py:113-266`, `workbench_seed.py`, `D1 §C.3` |
| E | 20 result templates with literal JSON | `tool_schemas.py:8-165`, `tool_handlers.py:65-89`, `UX §1.6`, `D1 §C.1/C.4` |
| F | socket events, rooms, auth, Redis state | `realtime.py:29-159`, `S:…/live_quiz_socket.py`, `S:…/live_quiz_routes.py`, `SI §9` |
| G | admin authoring UI, field by field, CSV, draft→publish | `D1 §B.2-B.3`, `UX §1.5`, `frontend/app/dashboard/bulk-uploads/csv/page.tsx`, `models/iemis.py:8-27` |
| H | 5 + 1 slices with exit criteria | this spec |
| I | risks, do-not-port list, keep-list | `BC §4.1/4.7/7`, `SI §9-10`, `UX §1.8/3.3/5`, `tool_schemas.py:147-149` |

**Numbers that should be checked against reality before slice 1 starts** (each is a claim this spec makes
from a read of today's tree, and each will drift): `ai_tool_registry` declares 14 columns of its own (plus
`BaseModel`'s 4); `tool_schemas.py` defines 10 schemas; `tool_handlers.py` defines 4 handlers + 2 context
builders; `realtime.py` is 159 lines with 4 socket handlers; `frontend/app/dashboard/ai-workbench/` contains
exactly 1 route file (`page.tsx`); `backend/migrations/versions/` contains 52 revisions; `question_bank_type`
has 7 values; `question_source` has 2 values; `backend/app/models/teaching_content.py` does not exist yet;
`grep -ri sketchfab` over `backend/ frontend/ flutter_student/` returns nothing; `grep -ri "ease_factor\|sm2"`
over `backend/app` returns nothing.

*End of D3. Written 2026-09-05. Sources: `SAHAYATRI_SPEC_INVENTORY.md`, `SAHAYATRI_BACKEND_CODE.md`,
`SAHAYATRI_CLIENTS_UX.md` (all read in full), the Sahayatri backend and web source, the ASchool AI/plugin/
model surfaces named above, and the `D1`/`D2` digests. No source file was modified; this report is the only
file written.*






































