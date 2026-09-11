# FINAL PLAN — AI-First Platform (2026-09-11)

> The single detailed execution plan for: **AI workspace** (all 41 tools, tutor, question engine,
> adaptive, safety), **AI Designer + AI Writer**, **AI in every mobile app**, and **AI-augmented
> features across every plugin**. Supersedes the feature-depth sections of
> `MASTER_PLAN_2026-09-10_FULL_PLATFORM_V2.md` (its Sprint-0/defect and plugin-gap sections remain
> valid and are referenced, not repeated).
>
> Evidence base: 6 research waves (2026-09-10/11) — Devanagari OCR-VLM benchmark (arXiv 2606.29213),
> Nepali RAG studies (2606.07523, 2603.13320), Anthropic contextual retrieval, title-chain chunking
> (2608.00824), HippoRAG 2, KAQG, EduGuard; AI-design landscape (Canva Magic Studio/Bulk Create,
> Adobe Express text-to-template, Beautiful.ai rules engine, Figma AI object model, Portant/
> DocsAutomator variable-data, PosterLLaVA/VASCAR layout research, Devanagari CTL/canvas + print
> pipeline); AI-in-education mobile (Doubtnut/QANDA/Photomath/Brainly UX contracts, Khanmigo safety
> model, Duolingo voice, Gemini Nano/AICore on-device, MagicSchool/Brisk/Eklavvya, WhatsApp-first
> patterns, Nepal DPDP/Privacy Act context); plus 4 internal deep-dives (backend, frontend, Flutter,
> AI/designer internals with file-level findings).

---

# PART I — AI WORKSPACE

## I.1 Governance & pipeline repairs (P0 — do first, small, unglamorous, prevents real harm)

Internal audit found the safety plumbing is **declared but not enforced**. Fix before any feature work:

| # | Defect | Fix |
|---|---|---|
| G-01 | Seeded bilingual prompt files (`app/prompts/*.md`) are **never read** — the orchestrator sends a raw schema dump as system prompt | `_system_prompt()` loads the prompt file; schema attached separately |
| G-02 | `grounding='required'` never enforced — 7 "required" tools run on empty context | Orchestrator: resolve units → zero published chunks ⇒ **422** (already specced in AI_FINAL_PLAN §6) |
| G-03 | `context_attendance` builder missing — `attendance_outreach` runs with zero data despite "required" | Build `context_attendance` (absentees this week, streaks, guardian contact state) |
| G-04 | `GuardianAIConsent.scope` (tutor\|tools\|all) never checked — only `granted=True` | Enforce scope at every student-scoped surface (workbench, tutor, ai_teacher) |
| G-05 | `AIGeneration.citations` + `output_tokens` never written | Persist citations (chunk ids) once retrieval lands; meter output tokens |
| G-06 | Moderation regex can never emit `violence`/`pii` categories that downstream code checks | Expand moderation: topic classifier (cheap model) for self-harm/violence/PII; keep regexes as fast path |
| G-07 | Legacy `/ai-tools/*` stack bypasses consent, moderation, schema validation, provenance — and **mobile is pinned to it** | Migrate mobile + legacy routes onto the workbench pipeline; retire duplicate lesson-plan/question-paper legacy paths after parity |
| G-08 | `/ai-tools/remarks` sends real student names+marks in prompts (no pseudonymize/consent) | Route through orchestrator pseudonymization |
| G-09 | `field_overrides` read but never applied; `StudentAIProfile` never written; `mastery_signal` discarded | Wire or delete — no dead knobs |
| G-10 | Tutor exam-mode deflection only fires on turn 0 | Deflect whenever the pattern matches a live assignment (school calendar join — the anti-cheat signal no consumer app has) |
| G-11 | `stream_request` has no Anthropic fallback; gpt-oss reasoning exhaustion returns empty text silently | Fallback + empty-output auto-retry at higher budget |
| G-12 | Pseudonymizer: exact-substring on 300 rows, alias collisions past 26 | Token-map approach keyed on matched student ids |

## I.2 Content spine & ingestion (already planned — status recap)

- Corpus → DB by **agent-operated vision extraction**: brief at
  `docs/ai_workspace_prompts/AGENT_INGESTION_BRIEF.md` (founder runs Claude Code / Gemini Code);
  printed question-paper archive (`question_papers` + `paper_questions`) and spec-grid blueprints
  are first-class contracts. Full verbatim text stored; page images = provenance only.
- Loader (S12 build) is the only DB writer: schema-validate → idempotent natural-key upsert →
  embed (BGE-M3 dense+sparse) → BM25 index → coverage-manifest gate → published snapshots.
- Retrieval upgrade (S13): filter-first → hybrid (HNSW ∥ BM25) → RRF → **bge-reranker-v2-m3** →
  CRAG evaluator → token-budgeted assembly → citations. Nepali queries get NE↔EN expansion; BM25
  is a first-class leg (91% vs 75% P@1 evidence).

## I.3 Tool fleet upgrade (41 registered tools → grounded in 3 waves)

Current state: 17 tools get curriculum context (units + ≤30 outcomes, unfiltered); 1 tool's context
builder is missing; `grounding` unenforced; **no tool sees a student's own data**; 2 context builders
exist total. Target state: every tool declares and *receives* a context pack; student-scoped tools
are consent-gated and pseudonymized.

**Wave T1 — grounding plumbing (rides S13 retrieval):** `context_curriculum_rag` (units → published
chunks via RAGService, title-chain + outcomes), `context_attendance`, `context_marks_student`
(own results, consent-gated), `context_class_results` (aggregate, staff-only). Enforce G-02.
Deliverable: the 17 curriculum tools start citing the actual textbook (chunk ids → citations UI).

**Wave T2 — data-connected tools (the ones schools feel):**
- `attendance_outreach` — real absentees + guardian language preference → draft messages (SMS/WhatsApp-ready).
- `remedial_plan`, `class_performance`, `item_analysis` — server-computed aggregates from Marks/Results (no pasted stats), pseudonymized per-student lines.
- `annual_scheme` — Nepali academic calendar (Baisakh-start) injected; BS month labels.
- `see_prep_pack`, `practice_set` — pull from published chunks + question bank (post-S14) with difficulty ladder.
- `exam_timetable` — hand conflict detection to the existing deterministic solver; LLM only drafts, solver validates.
- `progress_conference` — real per-student pack (marks trend + attendance + wellbeing flags, staff-only).
- `rubric`, `answer_key` — bind to assignments/question-bank items.
- `parent_email` — citations field finally populated (record-level links).

**Wave T3 — student-facing set (13+ gate, consent, tutor-grade safety):** `study_guide`, `see_prep_pack`,
`nepali_style_editor`, `flashcards`, `writing_feedback` (coach-only by design — keep), `exit_ticket`.
Each: grounded chunks + "ask your teacher" affordance + report-error button + cached answers per
(question-hash, language) — the Doubtnut hit-rate economics.

## I.4 Tutor (deep spec)

Current: excellent safety state machine (no plan → no chat, turn limits, injection guard, crisis
escalation) with **zero subject grounding and zero memory**. Target:

1. **Grounded turns**: per plan → resolve subject/grade → unit → pack (chapter summary + key chunks
   via retrieval + outcome prerequisites 1-hop); persist citations per turn.
2. **Mastery loop**: `mastery_signal` persisted to outcome-keyed `MasteryRecord` (not subject-name
   strings); tutor opens with "recap" from 1-hop prerequisite graph (HippoRAG-lite).
3. **Consent & scoping**: G-04 enforcement; cost attributed per student within school quota.
4. **Streaming** (hub already supports) → mobile chat UX.
5. **Mobile client** (Student app): real plans/sessions/turns, transcript, hint ladder, math answers
   through a symbolic-check layer (Khanmigo arithmetic-failure lesson), "ask your teacher" + report-error.
6. **Voice v2**: English voice first; Nepali voice behind a measured ASR-quality gate (Google ne-NP /
   IndicWhisper pilot), Duolingo pattern — persona memory, transcript review, post-call feedback.
7. **Photo→solve** (the South-Asia contract): camera crop → one question → step-reveal (hint ladder);
   **Socratic lock when the item is a live assignment** (school calendar join — unique to a school SaaS);
   answer cache keyed by question-hash; Devanagari handwriting OCR with "type it instead" fallback;
   cite the textbook chunk when the question comes from an ingested book.

## I.5 Question engine (end-to-end)

```
printed archive (question_papers/paper_questions — verbatim, agent-ingested)
   → curation UI → question_bank_items (outcome-linked, dedup: sha256 + cosine ≥0.90,
     difficulty prior, distractor_meta from misconception model, evidence_chunk_id)
spec grids → paper_blueprints (unit × type × marks × count × Bloom)
generation (KAQG loop): blueprint cell → select published bank items → shortfall generates
   grounded-by-chunks items (content_chunk_id provenance) → verify (answer-key solvability,
   Bloom re-tag, difficulty check) → teacher review → publish
model sets: one run → N papers sharing parent_paper_id, cross-run exclusion, shuffle seed
   reproducible; QTI export upgraded beyond MCQ-only
adaptive loop: mastery_state → outer-fringe recommendation → practice from bank → marks →
   mastery update (half-life decay); steps auto-progress from real activity
```
Mismatch is structurally impossible: generated items carry `blueprint_cell_id` NOT NULL — an item
that doesn't map to the grid cannot exist.

## I.6 AI Teacher plugin

Most mature AI surface (published-content-only teaching, measured cost, reconciled quota). Complete:
1. **Flutter client** (manifest promises it; zero exists): admin assign-lesson, student live player
   (player_url), parent transcript+report view, teacher monitoring.
2. **SM-2 scheduling** on `AITeacherMastery` (fields exist, never updated) → due-for-review lessons.
3. Security: service token out of URL query (short-lived POST-handoff), `disable_tenant` real,
   document the external service dependency honestly in ops runbook.
4. When the content spine lands: teaching context switches from authored `TeachingSection`-only to
   authored + ingested chunks (`content_unit_id` join), unlocking AI-Teacher lessons for every
   subject without manual authoring.

## I.7 Adaptive learning

Replace subject-name-string mastery with outcome-keyed mastery; adopt SM-2 (reuse ai_teacher's
fields); wire orphaned `generate_practice_questions` to the bank; auto-complete path steps from
activity (assignment submissions, quiz attempts, attendance); kill `learning_style` hard-coding;
class paths by real class FK not `class_name` string.

## I.8 Voice, capture & cost routing

- **Voice capture → mobile**: shared recorder widget → `/capture/voice` (already 2-stage
  human-confirm); fix name matching (class/section scoped, transliteration aware).
- **Photo capture**: add a vision provider slot to the hub (Gemini Flash for OCR + layout; the
  Devanagari benchmark winner) → un-501 `/capture/photo` (attendance sheet photo → structured roll
  call), feeds photo→solve above.
- **Cost routing**: small-model-first classifier (fast tier handles ~80%), per-(question,language)
  answer cache, batch API for non-interactive bulk, per-tool budget tiers already in registry —
  enforce them in the pipeline; credit-metered AI actions in designer (Figma/Notion pattern).

## I.9 Safety spine (all AI surfaces)

Consent-by-design (Khanmigo model — entitlement via school+parent, no anonymous minors), 13+ gate
for open-ended chat (UNESCO), crisis-keyword → static resources + counselor notification (never LLM
improvised), 90-day chat retention + parent/teacher transcript reviewability, no training on student
data, Nepal data-residency note for PII (Privacy Act 2075), "may contain errors" labeling on AI
digests, report-error button everywhere.

---

# PART II — AI DESIGNER & AI WRITER

Current state is strong (40 seeded templates incl. Nepali ID/certificates, WeasyPrint with real
Devanagari shaping, bulk generators with QR, N-up imposition, TipTap writer with track-changes) —
the gaps are precise (internal audit G1–G20 with file paths). Plan in 4 waves:

## II.1 Wave D1 — Nepali print correctness (small, immediate)
- Designer font picker: add Devanagari set (Noto Sans/Serif Devanagari, Mukta, Hind) with previews
  (G2); render `charSpacing` server-side + **disable letter-spacing on Devanagari runs** (conjunct
  safety) (G4); writer server-PDF: render ProseMirror→HTML→WeasyPrint (blank-page bug today) (G12);
  named versions + diff view (G16); margin guides on canvas (G17); default line-height ≥1.4 rule
  for Devanagari textboxes.

## II.2 Wave D2 — Print-shop completeness
- QR verification: every printed QR → school-hosted public verify page (anti-forgery) (G5);
  per-student photo variables with passport-crop + upload-in-bulk flow (G6); **CSV/XLSX data
  source** alongside DB entities (G7); **bulk jobs**: queue + saved runs + per-student naming +
  ZIP split + WhatsApp/email delivery + print-run history (G8); **preflight**: 3 mm bleed, safe-zone
  guides, trim marks, low-DPI/RGB/missing-glyph report, print presets (G9); **brand kit**: school
  logo/colors/fonts lockable, applied to all templates (G10); document approval states
  (draft→review→approved) with audit trail (G11).

## II.3 Wave D3 — AI leaps (the "AI Designer" identity)
- **Text-to-design** (G1, the flagship): prompt → structured layout JSON against template slot
  schemas (PosterLLaVA/VASCAR pattern) → rendered as **editable canvas elements** constrained by
  brand tokens → self-correction loop (render thumbnail → VLM critique → refine, 2 iterations) →
  3 variants. Agent context upgraded to see full document JSON (today it sees ≤200 chars).
- **Writer AI actions** (G14): rewrite/shorten/expand/translate EN↔NE on selection, tone chips,
  whole-doc summarize, generate-into-template (notice/letter flows), all through the governance
  pipeline.
- **Research panel → curriculum RAG** (G15): replace Wikipedia-only with school content spine +
  web fallback; citations into documents.
- **Paper → writer render** (G18): GeneratedPaper JSON → `section_header/question/answer_space`
  writer template = "AI generates the exam paper, Designer prints it" — the loop no competitor
  closes.
- **Image tools** (G19): background removal (student photos), 4× upscale, prompt-to-background/
  mascot with C2PA provenance labels.
- **Template DSL via API/MCP** (G13): `create_design()`, `generate_batch()` for agents (DocsAutomator
  pattern) — deterministic bulk from templates.

## II.4 Writer & designer feature tiers (from research)

- **Basic (parity)**: tiers above + template gallery filters + bilingual side-by-side certificate
  text + print PDF with embedded Devanagari subsets.
- **Differentiator**: ERP-native data binding (variables straight from SIS — students/exams/fees —
  not CSV), marks-driven grading-table auto-generation validated against SEE/NEB scale, scheduled
  batch runs with approval (Portant's "2.5 weeks → 3 days" district pattern), yearbook/class-photo
  compositor (face-aware grid), one-click resize/translate (Magic Switch analog).
- **Innovator**: agentic recurring design jobs ("every Sunday: next week's notice posters, brand,
  bilingual, queued for approval"), legacy letterhead photo → structured template (OCR→template),
  Preeti→Unicode converter inside the editor, constraints-based auto-layout engine (Beautiful.ai
  Smart-Slides pattern), collaborative canvas (Yjs — defer to last).

---

# PART III — AI IN THE MOBILE APPS (per role)

Cross-cutting mobile foundations first: small-model-first routing, answer caching, image compression
before cloud calls, offline queueing, every AI feature degrades to non-AI, push-digest "may contain
errors" labels, crisis escalation, consent captured at enrollment.

**Student app**
- Basic: photo→solve (crop → step-reveal hint ladder), Socratic lock on live assignments, symbolic
  math checks, citations + "ask your teacher" + report-error, 13+ consent gate.
- Differentiator: **Nepali-medium doubt solving + bilingual toggle** (verified white space — QANDA/
  Brainly/Doubtnut all ship zero Nepali), similar-practice generator, offline chapter packs.
- Innovator: voice tutor (EN first, NE quality-gated), on-device flashcard generation (Gemini Nano/
  Gemma 3n class).

**Parent app** (currently zero AI; backend consent/transcript endpoints already exist unused)
- Basic: excellent non-AI push + WhatsApp fee/attendance alerts (bot transport first).
- Differentiator: **AI weekly child digest** (NE/EN, citations to records), **"how is my child
  doing?" NL Q&A over own child's records** (refuses other children — verified open space),
  improvement suggestions linked to practice, WhatsApp FAQ bot with human escalation.
- Innovator: AI-timed fee nudges; conversational fee flow in bot.

**Teacher app**
- Basic: lesson-plan/worksheet generator (phone-first, shareable to parent chat), **report-card
  comment generator per student from real grades/attendance** (editable, NE/EN), parent-message
  drafting + auto-translate, voice remarks → transcript → edit → send.
- Differentiator: photo→rubric grading of handwritten work (Eklavvya pattern — assistive, human
  decides), morning brief (attendance risk/incomplete homework), grading lives in the artifact.
- Innovator: voice attendance feeding the digest pipeline.

**Admin app**
- Basic: NL query over SIS ("which classes have >40% fee defaulters?" → table+chart), anomaly alerts
  (attendance drop, fee lag, grade-shift), thresholded.
- Differentiator: one-tap WhatsApp reminder blasts from any query result, narrative board-report
  generator (NE+EN, every sentence drill-down-linked), enrollment forecasting.
- Innovator: timetable copilot (solver + NL adjustments), agentic weekly leadership brief.

**Unified launcher**: role-scoped AI persona (student=Socratic, parent=digest, teacher=workflows,
admin=analytics) on one core; widget digests generated on-device.

---

# PART IV — EVERY PLUGIN, AI-AUGMENTED (delta on V2's FA-01..FA-28)

The base feature plans stay in V2 Part 4. These are the **AI additions** per area (each rides the
I.3 context builders + I.9 safety):

| Plugin area | AI delta |
|---|---|
| Admissions | enquiry triage bot (WhatsApp), application completeness checker, merit narrative drafts |
| Students | "student 360" narrative for teacher meetings (timeline → 5-sentence brief) |
| Attendance | chronic-absence EWS (BE-3 in V2) feeding attendance_outreach + parent digests |
| Fees | defaulter message drafting with tone/language by guardian preference; collection anomaly alerts |
| Exams | paper generation pipeline (I.5) is the exam suite's AI; marks-verification assistive transcription |
| Timetable | copilot (solver-owned, NL feedback) |
| Assignments/LMS | AI grading assist (already partly live), rubric-bound feedback, lesson material grounding |
| Library | due reminders in guardian language; "what should I read next" from curriculum |
| Transport | delay-notice drafting; route-anomaly alerts |
| HR | letter generator (V2 FA-11) + appraisal narrative drafts |
| Inventory | reorder-point narrative ("why this is low"), PO draft generation |
| Health | compliance reminder drafting (missing immunizations) |
| Wellbeing | mood-trend narratives for counselors; **EWS composite risk → intervention suggestions** (human decides; RiskAlert persistence from V2 FA-14) |
| Visitor/Dismissal/Emergency | post-incident report drafting; drill-readiness narrative |
| Communications | broadcast hub message drafting per audience/channel; WhatsApp bot grounding (I.3) |
| Conferences | conference-prep pack (exists as tool) auto-attached to bookings + portfolio evidence |
| Alumni | fundraising letter drafts, event-narrative generation |
| Gamification | celebration-feed copy, award citation drafts |
| Portfolio | competency narrative generation from evidence items (grounded to outcomes) |
| Compliance/iEMIS | iEMIS export anomaly explanations ("why does this sheet mismatch") |
| Multi-branch | chain-level weekly brief per school |
| Website builder | AI copy generation per section (endpoint exists — ground it to school data), SEO text drafts |
| eLibrary | reading-level leveling (text_leveler) on any uploaded resource |

---

# PART V — EXECUTION WAVES

| Wave | Scope | Depends on |
|---|---|---|
| **S12 — AI foundation** | I.1 governance fixes (G-01..G-12), spine + `question_papers/paper_questions` migration, `content_loader` CLI, review queue, golden-set scaffold | — |
| **S13 — Grounding + retrieval** | BGE-M3 + reranker + CRAG + packs (I.2), tool waves T1 (+T2 start), tutor grounding+mastery (I.4.1-4), citations UI | S12; corpus pilot books ingested |
| **S14 — Question engine** | Bank curation UI, blueprint materialization from grids, KAQG generation, model sets, QTI v2 (I.5) | S13 |
| **S15 — AI Designer D1+D2** | Nepali print correctness + print-shop completeness (II.1, II.2) | — (parallel with S12/13) |
| **S16 — Mobile AI wave 1** | Student: grounded tutor client + photo→solve; Teacher: comments/parent-message/morning brief; foundations (routing/cache/offline) | S13 |
| **S17 — AI Designer D3 + Writer** | Text-to-design + VASCAR loop, writer AI actions, RAG research panel, paper→print loop (II.3) | S13 (RAG), S14 (paper loop) |
| **S18 — Mobile AI wave 2 + parent** | Parent digest/NL-QA/WhatsApp bot, admin NL-over-SIS + board report, AI-teacher Flutter client (I.6), voice capture mobile | S13, S16 |
| **S19 — Adaptive + tutor voice** | Outcome-keyed mastery + SM-2 + practice loop (I.7), photo capture via vision provider, voice tutor EN→NE gate (I.8) | S14, S16 |
| **S20 — Innovator tier** | Agentic design jobs, widget digests, MCP surfaces, collaboration canvas (defer/optional) | S17, S18 |

**Standing gates (every wave):** drift gate 0-blocking; contract tests; golden-set eval (recall@20
≥0.95, groundedness ≥0.90, NE-gap ≤10 pts) before enabling any grounded tool per grade; tsc; flutter
analyze 0 errors (warning sweep already owed to CI); audits ledger updated.

**Cost envelope:** ingestion ≈ $1.7–2.5k one-time (per AI_FINAL_PLAN); runtime AI ≈ $60–150/school/
month at current Groq rates with small-model routing + caching absorbing ~80% of calls; designer AI
credit-metered per school.

## Founder decisions (none block S12)
1. Photo→solve: allow full solutions at home vs hint-ladder always? (Recommend: ladder + unlockable
   full solution after attempt, Socratic-locked on live assignments.)
2. WhatsApp bot provider: stay Meta Cloud API direct (already integrated) vs BSP? (Recommend direct.)
3. On-device AI investment (Gemma 3n packs) now or after cloud tier proves usage? (Recommend after.)
4. Designer collaboration (Yjs) in-scope for S17 or deferred? (Recommend deferred.)
5. NE voice tutor: gate criteria sign-off (ASR WER threshold on our own test set).
