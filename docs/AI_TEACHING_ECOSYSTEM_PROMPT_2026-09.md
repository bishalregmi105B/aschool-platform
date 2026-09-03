# AI TEACHING & LEARNING ECOSYSTEM — STANDALONE BUILD PROMPT
**Codename:** `ai_workbench` · **For:** ASchool (the platform described in `MASTER_PLAN_2026-09.md`) · **Drafted:** 2026-09-03
**Audience:** AI coding agents (Claude Code, Cursor, etc.) implementing this directly against the existing ASchool repo.

---

## 0. HOW TO USE THIS DOCUMENT

This is a **second, standalone prompt** — hand it to the coding agent *together with* `MASTER_PLAN_2026-09.md`. It does not replace that plan; it is the deep spec for one part of it: **"a full ecosystem of AI tools for teachers and students, as a fully dedicated plugin system."**

**Dependency contract with the master plan** — do not re-implement these, build on top of them:
- **A-01 AITokenHub v2** (provider routing, retries, quota, cost accounting, structured outputs, streaming) is the *only* door this ecosystem uses to reach an LLM. Nothing in this document calls a model provider directly.
- **A-02 Prompt library + evals** is where every prompt below lives (`backend/app/prompts/<feature>.md`), versioned the same way.
- **A-04 Curriculum model** (`CurriculumFramework → CurriculumUnit → LearningOutcome`, `SubjectOffering`) is the spine every tool grounds against. This document adds one layer under it: `CurriculumTopic` (chapter/sub-topic granularity — see §5.1).
- **A-05 RAG** (`document_chunks`, hybrid BM25+cosine, HNSW index) is the retrieval engine every content-grounded tool calls into.
- **A-06 Grading v2** and **A-03 Question Bank/Paper Generator** are the *assessment half* of this same ecosystem. They are referenced, not repeated, and slot into the tool registry defined in §7 as two entries among ~65.
- **A-07 Transparency + metering** (AI Nutrition Facts, credits, kill switch, guardian transcripts) is generalized here from "a page" into a **schema every tool is required to populate** (§11.1) — this document is what makes A-07 enforceable rather than aspirational.
- **Section 10 (Plugin Architecture Completion)** — manifest-driven registration, scoped hooks, capability system — is the mechanism this whole ecosystem ships through. It is *one plugin* (`ai_workbench`) with ~65 declared **sub-capabilities**, not 65 plugins.
- **D-06** (`class_subjects`, `section_subject_teachers`) is required before tool-generated content can be scoped to "my Class 8 Section B Science, Chapter 4" — several tools below are blocked on it.

**What this document adds that the master plan doesn't yet have:** the other ~57 tools beyond question papers and grading (lesson planning, differentiation, IEP drafting, rubrics, tutoring, student-facing tools, parent communication, PD coaching, meeting notes, voice/photo capture); the unifying data model that stores every generation, every piece of content, every tutor transcript, every consent record, and every mastery signal in one coherent, queryable schema; the orchestration layer that turns "add a tool" into a registry entry instead of a bespoke blueprint each time; and the safety/compliance layer that makes the whole thing defensible under EU AI Act Annex III, UNESCO's teacher/student AI competency frameworks, and Nepal's forthcoming DPDP-style minor-consent regime.

**Assumptions this document makes** (state these back if any is wrong before implementing):
1. This ships as **one plugin bundle**, sold/gated the way `ai_suite` already is in the master plan's plan-tier model, with sub-capabilities individually toggleable by school admin and by district/palika tier where that exists.
2. Every AI-generated artifact that reaches a student or a report card **requires human approval** before it is authoritative — this is non-negotiable per §11 and mirrors the `ai_adaptive_learning` honest-fallback pattern the master plan already calls "the exemplary pattern... copy everywhere" (§A-06.5).
3. Bilingual (Nepali + English) output is a first-class requirement for every teacher-facing and parent-facing tool, not a stretch goal — this is the actual product differentiator per the master plan's own Phase 5/6 framing.
4. Nothing here overrides `12. DO NOT REWRITE` in the master plan.

---

## 1. RESEARCH DIGEST (what "international best practice" concretely means right now)

### 1.1 The competitive feature landscape (mid-2026)
The market has converged on a recognizable shape. Read this as the checklist your tool catalog (§6) must cover, not as products to copy pixel-for-pixel:

| Product | Shape | What it teaches you to build |
|---|---|---|
| **MagicSchool AI** (5M+ educators, 13,000+ schools/districts, 160+ countries) | Standalone platform, 80+ discrete single-purpose teacher tools + **MagicStudent** (50+ student tools) + Enterprise admin layer | The "**tool catalog**" pattern: each capability is a narrow, named, one-screen tool rather than one big chatbot. Enterprise lets districts **hide tools, pre-fill fields, attach curriculum docs, and build custom tools** on top of the base catalog — this is exactly the "sub-capability + school override" model in §10. In Feb 2026 MagicSchool retired its named student chatbot persona "Raina" for a neutral "AI Learning Assistant," explicitly to prevent students forming parasocial attachment — a direct design constraint, adopted in §11.4. |
| **Khanmigo** (Khan Academy + Google/Gemini) | Socratic tutor for students ("guides, doesn't answer") + teacher assistant, integrated with Khan Academy's own exercise/video library | The **Socratic refusal pattern** — the tutor is deliberately bad at giving direct answers and good at scaffolding. 2026 additions: teacher-controlled interactive diagrams, and a rebuilt "Practice My Knowledge" tool that puts the **teacher back in the loop before content reaches students** (a reaction to giving the model too much autonomy). Both are direct inputs to §9.5 (Tutor Engine) and §9.2 (Practice Generator). |
| **Brisk Teaching** | Chrome/Edge extension living **inside** Google Docs/Slides/Classroom/YouTube — no separate app | The **in-workflow embedding** pattern: teachers do not want a new tab. ASchool's equivalent is embedding tool triggers directly into the writer/gradebook/lesson pages, not only a separate `/ai-workbench` hub (see §6.4, §9.1). |
| **SchoolAI** | Teacher-configured "Spaces" where a student-safe AI ("Dot") operates only inside teacher-set guardrails, with a live teacher dashboard of what students are typing | The **session-plan container** pattern — a teacher defines the sandbox (goal, allowed topics, allowed tools) *before* a student ever talks to the model. This is precisely `tutor_session_plans` in §5.4 and is validated by the Edo State evidence below. |
| **Diffit** | Deep specialist in one job: reading-level differentiation of any text, at scale | Proof that a narrow, excellent tool beats a shallow universal one for a specific pain point — informs the design of §9.3 (Differentiation Engine) as its own first-class tool rather than a mode of "content generator." |
| **Curipod** | Live, interactive AI-generated lesson delivery (polls, prompts, drawing) for real-time classroom engagement | Distinguishes **prep-time tools** (most of the catalog) from **delivery-time tools** (§9.7) — a different UI surface (presentation-mode, low-latency) from the rest. |
| **CoGrader / AssignAI** | Rubric-anchored essay grading at scale, subject-specialized (e.g., IELTS/ESL) | Reinforces A-06's rubric-first, per-criterion-justification design over "one holistic score." |

Sources consulted (paraphrased, no verbatim reproduction; see §16 for links): MagicSchool product/review pages (Educators Technology, Fastio, TechShark, AIToolsBakery, Tooliverse — all mid-2026), Khan Academy/Google.org blog posts on the 2026 Khanmigo–Gemini partnership, Brisk/SchoolAI/Diffit/Curipod comparison round-ups (ForaSoft, CoGrader, SlideSpeak, Kuraplan — 2026).

### 1.2 The pedagogical evidence base — what actually moves outcomes
The strongest causal evidence available is the **World Bank/Stanford randomized controlled trial in Edo State, Nigeria (De Simone et al. 2025)**: 800 first-year secondary students, six weeks, after-school, using GPT-4 (via Microsoft Copilot) in pairs. Design specifics that produced the result (0.31 SD overall, 0.23 SD in English — equivalent to roughly 1.5–2 years of "business as usual" schooling, among the most cost-effective learning interventions measured):
- Teachers acted as **"orchestra conductors"**: every session opened with a **teacher-chosen starter prompt**, not a blank chat box.
- Teachers **actively mentored** during the session (additional prompts, redirection).
- Every session **closed with a short reflection exercise**.
- Gains were **largest for lower-baseline students**, i.e. this is a gap-closing tool, not a top-student accelerator, when structured this way.

This is the single most important design constraint in this document: **the tutor is not a free-standing chatbot.** It is always instantiated from a teacher-authored `tutor_session_plan` (starter prompt + learning goal + allowed scope + reflection prompt) — see §5.4, §9.5. An unstructured "ask anything" tutor is explicitly out of scope for this build; every reviewed comparison of Khanmigo/SchoolAI/MagicStudent converges on the same session-container shape independently.

### 1.3 The standards a serious platform must speak
From 1EdTech (formerly IMS Global) — the K-12/HigherEd interoperability body:
- **LTI 1.3 / LTI Advantage** — the launch/SSO standard for external tools inside an LMS, now paired with the 1EdTech Security Framework specifically because districts distrust ad-hoc PII exchange between platforms.
- **OneRoster 1.2** — rostering (people/courses/enrollments/orgs) *and*, as of 1.2, **Gradebook pass-back** in the same spec (this used to require separate LTI AGS). Ships in both CSV (nightly SIS export — what most districts actually use) and REST (OAuth2 client-credentials, real-time) profiles.
- **QTI 3.0** — the assessment content/results interchange format. The open-source **TAO platform** is QTI-native end-to-end (authoring → item bank → adaptive delivery → results) and is the reference implementation to study for §9.2/§12.2 — it already proves item banking + CAT (computerized adaptive testing) at scale in an AGPL codebase with zero AI layered on, which the master plan (§8, Tier 4) correctly flags as "a build-on-top opportunity."
- **Caliper Analytics** — the learning-activity event standard (xAPI-adjacent). Every tool and tutor session in this ecosystem should emit Caliper-shaped events even before you build a full LTI/OneRoster integration, because it costs nothing extra at generation time and unlocks interoperability later at zero migration cost (§12.3).
- **Common Cartridge** — course/content packaging; lower priority, relevant only if/when ASchool needs to export whole units to an external LMS.

### 1.4 The regulatory and ethical floor
- **EU AI Act, Annex III(3)** classifies AI systems that *evaluate learning outcomes, steer the learning path, determine the level of education a student can access, or monitor/detect prohibited behaviour during tests* as **high-risk**. High-risk obligations for education were deferred by the "Digital Omnibus" (Regulation (EU) 2026/1744, in force 27 July 2026) from Aug 2026 to **2 December 2027** — but the **Article 4 AI-literacy obligation for deployers has applied since Feb 2025 and was not deferred**. Practical read for ASchool: not an immediate blocker for schools outside the EU, but (a) any school with EU-linked accreditation or an EU parent base should be treated as in-scope now, and (b) the high-risk *shape* of the obligations (risk management, human oversight, logging, technical documentation, bias testing) is simply good practice everywhere and is what §11 implements regardless of jurisdiction.
- **UNESCO AI Competency Framework for Teachers (2024)** — 15 competencies across 5 dimensions (human-centred mindset; ethics of AI; AI foundations & applications; AI pedagogy; AI for professional learning), 3 progression levels. Use this as the **rubric for what the PD Coach tool (§9.8) actually teaches**, and as the structure for onboarding content in the tool catalog UI.
- **UNESCO AI Competency Framework for Students (2024)** + **OECD/EC AI Literacy Framework (AILit, final 2026)** — four domains: *Engage with AI, Create with AI, Manage AI, Shape AI*. Feeds directly into PISA 2029. Use this as the taxonomy for student-facing AI-literacy content and the "AI transcript" a guardian sees should be framed against these domains, not just "chat log."
- **India's DPDP Act (2023, Rules 2025)** sets the strictest realistic regional bar and is the right template for Nepal's own forthcoming regime (draft PDP Policy 2082 + IT Bill, already flagged in the master plan): **anyone under 18 is a "child,"** verifiable **guardian consent is mandatory before processing**, and **profiling/behavioural-tracking/targeted-advertising directed at children is banned outright**, with no size-based exemption. Direct implication for this build: **no student-facing tool may build a persuasive/engagement-optimizing profile of a minor.** Mastery tracking for pedagogical adaptation is allowed and is the point of the product; anything that starts to look like ad-tech-style behavioural profiling is not, and `student_ai_profile` (§5.5) is deliberately scoped to exclude it.
- **The "AI Nutrition Facts" pattern**, pioneered by Twilio (2023) as a plain-language, non-technical transparency card and adopted as table-stakes UX in ed-tech since (the master plan already cites Canvas/Kahoot doing this), is formalized here as a *required, enforced database row per tool*, not a marketing page — §11.1.

---

## 2. PRODUCT SCOPE — WHAT SHIPS

Two personas get a home screen; a third and fourth get scoped surfaces.

- **Teacher Suite** (`/dashboard/ai-workbench`): ~42 tools across 7 categories (§6).
- **Student Suite** (`/student/ai-workbench`, always inside a teacher-authored session container per §1.2): ~16 tools across 4 categories.
- **Parent surface**: read-only AI transcript + AI Nutrition Facts + consent management (no generation tools of its own — matches every reviewed competitor).
- **Admin/District surface**: cost + usage dashboards (extends A-07), custom-tool builder (district overrides base prompts/fields — the MagicSchool Enterprise pattern), kill switch, AI-literacy rollout tracker against the UNESCO teacher framework.

**Explicitly out of scope for v1** (do not build, note as future in the registry so the UI can show "coming soon" honestly rather than lying — this is the exact failure mode `12`/`F-01` in the master plan calls out): admissions-decision AI, automated behavioural/proctoring monitoring during exams (both are EU AI Act Annex III high-risk and there is no product reason to build them first), any engagement-optimizing gamification of the student tutor.

---

## 3. ARCHITECTURE OVERVIEW

```
                         ┌─────────────────────────────────────────────┐
                         │   Frontend surfaces (Next.js)                │
                         │   /dashboard/ai-workbench   (teacher)        │
                         │   /student/ai-workbench     (student)        │
                         │   in-context triggers: writer, gradebook,    │
                         │   lesson page, report-card editor            │
                         └───────────────────┬───────────────────────────┘
                                             │ REST (+ SSE for streaming)
                         ┌───────────────────▼───────────────────────────┐
                         │  ai_workbench blueprint (Flask)                │
                         │  ┌───────────────────────────────────────────┐│
                         │  │ Tool Registry  (DB-backed, §5.2)          ││
                         │  │  tool_key → handler, schema, prompt, tier ││
                         │  └───────────────────┬───────────────────────┘│
                         │  ┌───────────────────▼───────────────────────┐│
                         │  │ Orchestrator                              ││
                         │  │  resolve tool → build context → guardrails││
                         │  │  → call AITokenHub → validate → persist   ││
                         │  └───┬─────────────┬─────────────┬──────────┘│
                         │      │             │             │            │
                         │  ┌───▼───┐    ┌────▼────┐   ┌────▼─────┐     │
                         │  │Context│    │Guardrail│   │ Session  │     │
                         │  │Builder│    │Pipeline │   │ State    │     │
                         │  │(§8)   │    │(§11.2)  │   │Machines  │     │
                         │  └───┬───┘    └─────────┘   │(tutor,§9.5)│   │
                         │      │                       └──────────┘     │
                         └──────┼─────────────────────────────────────────┘
                                │
              ┌─────────────────┼──────────────────────┬───────────────────┐
              │                 │                       │                   │
     ┌────────▼────────┐ ┌──────▼───────┐   ┌───────────▼────────┐ ┌───────▼────────┐
     │ A-04 Curriculum  │ │ A-05 RAG     │   │ A-01 AITokenHub    │ │ Existing ASchool│
     │ (units/outcomes/ │ │(document_    │   │ (routing/quota/    │ │ data (D-06      │
     │  topics, §5.1)   │ │ chunks, HNSW)│   │  cost/structured    │ │ class_subjects, │
     │                  │ │              │   │  outputs)           │ │ marks, students)│
     └──────────────────┘ └──────────────┘   └─────────────────────┘ └─────────────────┘
```

Everything an implementer needs to know from this diagram: **there is exactly one write path into an LLM (AITokenHub) and exactly one read path for "what does this class/chapter/student already have" (Context Builder over A-04 + A-05 + existing ASchool tables).** Every one of the ~65 tools is a *registry row* pointing at a handler function, not a new blueprint.

---

## 4. CODEBASE / FOLDER STRUCTURE

### 4.1 Backend (`backend/app/blueprints/ai_workbench/`)
```
ai_workbench/
├── __init__.py                      # blueprint factory; registers routes; loads tool_registry on boot
├── manifest.yaml                    # plugin manifest (per master-plan §10: section/order/labels/capabilities)
├── routes/
│   ├── catalog.py                   # GET /ai/tools, GET /ai/tools/<tool_key>, GET /ai/nutrition-facts/<tool_key>
│   ├── generate.py                  # POST /ai/generate/<tool_key>   (generic dispatcher, see §7.1)
│   ├── generate_stream.py           # SSE variant, reuses A-01 streaming
│   ├── review.py                    # POST /ai/generations/<id>/approve|reject|edit
│   ├── library.py                   # content library CRUD + sharing (school/district/template)
│   ├── tutor.py                     # session-plan CRUD (teacher) + session/message endpoints (student)
│   ├── iep.py                       # IEP draft-review-finalize workflow (extra approval gate)
│   ├── consent.py                   # guardian AI-consent CRUD, transcript export
│   ├── admin.py                     # district custom-tool overrides, kill switch, rollout tracker
│   └── analytics.py                 # usage/cost/edit-distance dashboards (extends A-07)
├── services/
│   ├── orchestrator.py              # AIWorkbenchOrchestrator — the dispatcher in §7.1
│   ├── context_builder.py           # §8 — assembles grounded, pseudonymized prompt context
│   ├── guardrails/
│   │   ├── input_filter.py          # spotlighting untrusted text, injected-instruction stripping
│   │   ├── output_validator.py      # schema validation, clamp, re-ask-once
│   │   ├── moderation.py            # self-harm/violence/academic-integrity classifiers
│   │   └── injection_detector.py    # cheap classifier pass, per A-06.4 pattern
│   ├── tool_handlers/               # ONE FILE PER TOOL, each exports handle(input, ctx) -> output
│   │   ├── lesson_plan.py
│   │   ├── unit_plan.py
│   │   ├── differentiation.py       # §9.3 — leveled text, graphic organizers, EAL/ELL support
│   │   ├── iep_draft.py             # §9.4
│   │   ├── rubric_builder.py        # thin wrapper delegating to A-06 Rubric model
│   │   ├── exit_ticket.py
│   │   ├── warmup_hook.py
│   │   ├── discussion_questions.py
│   │   ├── slide_outline.py
│   │   ├── worksheet.py
│   │   ├── study_guide.py
│   │   ├── flashcards.py
│   │   ├── practice_quiz.py         # thin wrapper delegating to A-03 Question Bank
│   │   ├── report_card_remarks.py   # evidence-grounded, per master-plan Tier 2
│   │   ├── parent_email.py
│   │   ├── newsletter.py
│   │   ├── meeting_notes.py         # parent-conference notetaker
│   │   ├── behaviour_note.py
│   │   ├── pd_coach.py              # §9.8, grounded in UNESCO teacher framework
│   │   ├── tutor_engine.py          # §9.5 — the Socratic state machine, NOT a generic handler
│   │   ├── writing_feedback.py      # §9.6
│   │   ├── essay_grading.py         # thin wrapper delegating to A-06 grading v2
│   │   ├── voice_entry.py           # Nepali voice → structured data
│   │   ├── photo_to_data.py         # photo of paper register/marksheet → validated records
│   │   ├── song_generator.py
│   │   ├── podcast_script.py
│   │   └── ... (remainder per §6 catalog; every row in ai_tools_registry MUST have a matching file)
│   └── standards/
│       ├── caliper_emitter.py       # §12.3
│       ├── qti_export.py            # §12.2 — question bank → QTI 3.0 package
│       └── lti_launch.py            # §12.1 — future: launch ai_workbench as an LTI 1.3 tool
├── models/
│   ├── ai_tools_registry.py
│   ├── ai_generation.py
│   ├── ai_content_library.py
│   ├── curriculum_topic.py
│   ├── tutor_session_plan.py
│   ├── tutor_session.py
│   ├── tutor_message.py
│   ├── iep_plan.py
│   ├── ai_nutrition_facts.py
│   ├── guardian_ai_consent.py
│   ├── moderation_flag.py
│   ├── ai_tool_analytics_daily.py
│   └── school_ai_tool_settings.py
└── schemas/                         # pydantic/marshmallow input+output schemas, one per tool_key
    └── ...
```

`backend/app/prompts/` (per A-02, extended — nothing new here, just volume):
```
prompts/
├── lesson_plan.md
├── differentiation.md
├── iep_draft.md
├── tutor_system.md          # the Socratic system prompt + refusal rules (§9.5)
├── parent_email.md
├── report_card_remarks.md   # already implied by master-plan Tier 2; formalize the file here
├── pd_coach.md
├── writing_feedback.md
└── ... (one .md per tool_key, YAML frontmatter: model tier, temperature, max_tokens, output schema, few-shot examples — exact format defined in master-plan A-02)
```

### 4.2 Frontend (`frontend/app/`)
```
app/
├── dashboard/ai-workbench/
│   ├── page.tsx                     # tool catalog grid, grouped by category, search/filter
│   ├── [toolKey]/page.tsx           # generic schema-driven tool runner (form → generate → review)
│   ├── library/page.tsx             # content library: mine / school / district templates
│   ├── library/[id]/page.tsx
│   ├── tutor-rooms/page.tsx         # teacher: create/manage tutor_session_plans
│   ├── tutor-rooms/[id]/monitor.tsx # live-ish view of active student sessions (poll, not full realtime v1)
│   ├── nutrition-facts/[toolKey]/page.tsx
│   └── analytics/page.tsx           # admin only, gated
├── student/ai-workbench/
│   ├── page.tsx                     # only shows tools the student's active session grants
│   ├── tutor/[sessionId]/page.tsx   # chat UI, session-scoped
│   └── history/page.tsx             # student's own generation history (study guides etc.)
└── parent/ai-transparency/
    ├── page.tsx                     # AI Nutrition Facts index + consent toggles
    └── transcripts/[studentId]/page.tsx
```
```
components/ai-workbench/
├── ToolCard.tsx
├── ToolCatalogGrid.tsx
├── ToolRunner.tsx            # renders a form from a tool's input_schema (JSON-schema-driven, like the F-01 shared layer's FormField)
├── GenerationReview.tsx      # side-by-side diff + edit + approve/reject; writes edit_distance_pct on save
├── TutorChat.tsx
├── SessionPlanBuilder.tsx    # teacher-facing: starter prompt, goal, allowed scope, reflection prompt
├── NutritionFactsBadge.tsx   # small badge shown on every tool card + full card on its own page
└── CostEstimateChip.tsx      # shows estimated AI cost before generate, per master-plan A-03.5
```

### 4.3 Mobile (`aschool_shared/lib/features/ai_workbench/`)
```
ai_workbench/
├── screens/
│   ├── tool_catalog_screen.dart
│   ├── tool_runner_screen.dart
│   ├── tutor_chat_screen.dart        # must degrade gracefully offline (see §13.4 Nepal-specific note)
│   └── library_screen.dart
├── services/ai_workbench_api.dart
├── models/ (ai_generation.dart, tutor_session.dart, ...)
└── widgets/nutrition_facts_badge.dart
```
Role-parameterized per the master-plan's `shared_chat_screen`/`emergency_screen` pattern (§M-01.7) — one screen set, not five per-app forks.

---

## 5. DATA MODEL

All tables `SchoolModel` (tenant-scoped, `school_id` FK, soft-delete) unless noted. Follow D-02/D-03/D-04 conventions already mandated in the master plan (partial unique indexes on `is_deleted=false`, `TIMESTAMPTZ` everywhere, FK indexes). `academic_year_id` required on every table below per D-05.

### 5.1 Curriculum extension (sits directly under A-04)
```
CurriculumTopic(unit_id FK→CurriculumUnit, topic_no, title_en, title_ne, estimated_periods,
                 difficulty_hint enum(foundational|core|extension), created_at)
```
This is the "chapter" granularity the founder asked for by name. `CurriculumUnit` (A-04) = chapter-level; `CurriculumTopic` = the sub-topic inside a chapter that a single lesson plan, worksheet, or tutor session actually targets. Every content-generating tool call takes an optional `curriculum_topic_id` and, when present, the Context Builder (§8) injects the topic's `title`, its parent unit's `learning_outcomes`, and the top-k RAG chunks tagged to that topic — this is what "every chapter... all have" cashes out to structurally: nothing is generated ungrounded when a topic reference is available.

### 5.2 Tool registry — the thing that makes this "a fully dedicated plugin system"
```
AIToolRegistry(tool_key UQ, category enum(planning|assessment|differentiation|feedback|
                communication|tutoring|student_study|delivery|governance),
                name_en, name_ne, description_en, description_ne, icon,
                target_persona enum(teacher|student|parent|admin),
                min_plan_tier, model_tier enum(fast|quality), requires_review bool default true,
                input_schema JSONB, output_schema JSONB, prompt_key,
                status enum(alpha|beta|ga|deprecated), version, created_at)

SchoolAIToolSettings(school_id, tool_key FK, enabled bool default true,
                      visible_to_roles JSONB, field_overrides JSONB,   -- district "hide this field / prefill that one"
                      custom_prompt_suffix TEXT nullable,               -- district curriculum doc injection, per MagicSchool Enterprise pattern
                      UQ(school_id, tool_key))
```
The frontend catalog page (§4.2) and the mobile catalog screen both render **entirely from `GET /ai/tools`**, which joins `AIToolRegistry` with `SchoolAIToolSettings` for the requesting school. Adding tool #66 next year means: one prompt file, one handler file, one registry row, zero new routes, zero new frontend pages. This directly fixes the master-plan's own complaint about the *existing* plugin system (§10.1: "module manifests should carry section/order/labels; loader derives everything") by applying the same discipline one level deeper, inside a single plugin.

### 5.3 The generation ledger — every AI artifact, one place
```
AIGeneration(id, school_id, tool_key FK, actor_type enum(user|system), actor_id,
             class_subject_id nullable FK,          -- after D-06
             curriculum_topic_id nullable FK,
             student_id nullable FK,                 -- for student-scoped artifacts (study guide, IEP)
             input_jsonb, output_jsonb,
             status enum(draft|edited|approved|rejected|archived),
             edit_distance_pct nullable,              -- Levenshtein or token-diff %, computed on save-after-edit
             teacher_rating smallint nullable,        -- 1-5, optional thumbs-style
             model, prompt_version, cost_usd Numeric(10,6),
             created_at, approved_by nullable, approved_at nullable)
```
Feature-specific tables (e.g. `GeneratedPaper` from A-03, `Rubric`/`RubricCriterion` from A-06) get a nullable `ai_generation_id FK` back to this row instead of duplicating provenance columns — one place to answer "show me everything AI touched for this student/class/teacher," one place the audit trail (D-07) and the cost dashboard (A-07) both read from.

### 5.4 Content library (the "district shares its own tool library" pattern)
```
AIContentLibraryItem(id, school_id, generation_id FK,
                      title, type enum(lesson_plan|unit_plan|worksheet|slide_outline|rubric|
                             iep|newsletter|parent_email_template|quiz|study_guide|flashcard_set|
                             discussion_guide|exit_ticket|song|podcast_script),
                      tags JSONB, visibility enum(private|school|district|public_template),
                      folder_path, file_id nullable FK→ManagedFile,
                      created_by, created_at, updated_at)
```

### 5.5 Tutor system — teacher-configured sessions, per §1.2 evidence
```
TutorSessionPlan(id, school_id, teacher_id, class_subject_id FK, curriculum_topic_id nullable FK,
                  title, mode enum(homework_help|exam_prep|concept_review|writing_coach|
                        debate_practice|reading_companion),
                  starter_prompt_en, starter_prompt_ne, learning_goal,
                  allowed_scope_notes,             -- free text the model is instructed never to go beyond
                  exam_mode boolean default false, -- if true: tutor deflects direct answers near an exam window
                  reflection_prompt_en, reflection_prompt_ne,
                  active boolean default true, created_at)

TutorSession(id, school_id, plan_id FK, student_id FK,
             started_at, ended_at nullable,
             message_count int default 0,
             exam_mode_deflection_count int default 0,
             flagged_content_count int default 0,
             reflection_submitted boolean default false,
             guardian_notified boolean default false)

TutorMessage(id, session_id FK, role enum(student|assistant|system),
             content, redacted_pii boolean default false,
             moderation_flags JSONB nullable, created_at)
```
`TutorMessage.content` is retained under the same access-controlled, retention-limited discipline the master plan already mandates for prompt/response bodies (A-01.5) — full transcripts are guardian-visible (§11) but not indexed into any cross-student profile.

### 5.6 Special-education / accommodation drafting (highest-liability tool — extra gate)
```
IEPPlan(id, school_id, student_id FK, disability_category, accommodations JSONB, goals JSONB,
        generated_by_ai boolean default false, ai_generation_id nullable FK,
        status enum(draft|pending_specialist_review|active|archived),
        reviewed_by nullable, reviewed_at nullable, created_at)
```
`status` can never move to `active` through the API without `reviewed_by` set by a user holding a role explicitly flagged `can_review_iep` (new permission, wire through the RBAC editor once P-05/F-01's real RBAC lands — until then, hard-code to `principal|special_ed_coordinator` roles and log a TODO). This is deliberately stricter than every other tool in this catalog.

### 5.7 Safety, consent, transparency
```
AINutritionFacts(tool_key PK FK, model_tier, providers JSONB, data_accessed JSONB,
                  retention_days, trains_on_third_party_data boolean default false,
                  human_review_required boolean, min_recommended_grade nullable,
                  limitations_en, limitations_ne, known_failure_modes,
                  last_reviewed_at, reviewed_by)

GuardianAIConsent(student_id FK, feature_key,           -- 'tutor', 'writing_feedback', etc. — coarser than tool_key
                   consent_status enum(granted|denied|pending),
                   consent_at nullable, consent_by_guardian_id nullable,
                   method enum(digital_form|paper_form_scanned|verbal_logged),
                   UQ(student_id, feature_key))

ModerationFlag(id, source_type enum(tutor_message|generation|content_library_item),
               source_id, flag_type enum(self_harm|violence|academic_integrity|inappropriate|
                     pii_leak|prompt_injection_attempt),
               severity enum(low|medium|high|critical),
               reviewed_by nullable, reviewed_at nullable, action_taken, created_at)

AIToolAnalyticsDaily(school_id, tool_key FK, date,
                      generations_count, unique_users, approval_rate,
                      avg_edit_distance, avg_rating, cost_usd,
                      PK(school_id, tool_key, date))
```
`AINutritionFacts` has exactly one row per `tool_key` (platform-level; a school-level override is out of scope for v1 — the facts about the *model and data flow* don't vary per school, only the *content* does). `AIToolRegistry.status` cannot be `ga` in the seed migration unless a matching `AINutritionFacts` row exists — enforce this with a CI check, not just a code comment (mirrors the master-plan's own `13.5` "run migrations fresh in CI" discipline).

### 5.8 Student mastery — extend, don't duplicate
The master plan's D-05 already lists existing `mastery_records` and `learning_paths` tables getting `academic_year_id`. **Do not create new mastery tables.** Add:
```
ALTER TABLE mastery_records ADD COLUMN curriculum_topic_id UUID NULL REFERENCES curriculum_topics(id);
ALTER TABLE mastery_records ADD COLUMN source VARCHAR NOT NULL DEFAULT 'quiz';  -- enum(quiz|tutor_session|teacher_override)
ALTER TABLE mastery_records ADD COLUMN evidence_ref UUID NULL;  -- points at ai_generations.id or an exam attempt id
```
This is what lets a tutor session, a practice quiz, and a teacher's manual override all write to the same topic-level mastery signal that the differentiation tool (§9.3) and practice generator (§9.2) both read from.

### 5.9 Student AI profile — deliberately narrow (see §1.4 DPDP note)
```
StudentAIProfile(student_id PK FK, preferred_language enum(en|ne|both),
                  reading_level_estimate nullable, accommodation_flags JSONB,
                  guardian_visibility enum(full_transcript|summary_only|alerts_only) default 'full_transcript',
                  created_at, updated_at)
```
No `interests`, no engagement/session-length optimization fields, no cross-tool behavioural score. If a future feature genuinely needs more, it needs a fresh privacy review before a column is added here — do not silently expand this table.

---

## 6. THE TOOL CATALOG (v1 scope, ~65 rows in `ai_tools_registry`)

Every row below becomes exactly one registry entry + one prompt file + one handler file (§4.1). Grouped by category; "Grounds on" = what the Context Builder (§8) pulls in beyond the raw form input.

### 6.1 Planning (teacher)
| Tool | Grounds on | Output |
|---|---|---|
| Lesson plan generator | curriculum_topic, learning_outcomes, prior lesson history for the section | Structured plan: objective, hook, sequence, materials, assessment, differentiation notes |
| Unit plan generator | curriculum_unit, all child topics | Multi-week scope-and-sequence |
| Warm-up / bell-ringer generator | curriculum_topic | 3 short starter activities |
| Discussion question generator | curriculum_topic, Bloom-level target | Question set tagged by Bloom level |
| Exit ticket generator | curriculum_topic, lesson objective | 3-5 quick-check items |
| Slide outline generator | lesson plan (if linked) or topic | Slide-by-slide outline (hands to G-01 designer for actual `.pptx`) |
| Worksheet generator | curriculum_topic, difficulty target | Printable worksheet + answer key |
| Graphic organizer generator | topic + organizer type (Venn, KWL, timeline) | SVG/canvas-ready structure, hands to G-01 designer |
| Field trip / project brief generator | curriculum_unit | Project brief with rubric hook |
| Substitute-teacher plan generator | next 1-3 scheduled lessons from timetable | Self-contained sub plan, no context needed from the sub |

### 6.2 Assessment & feedback (teacher) — reference existing spec, do not duplicate
| Tool | Reference |
|---|---|
| Question bank / paper generator | **A-03** (already fully spec'd) |
| Essay/short-answer grading v2 | **A-06** (already fully spec'd) |
| Rubric builder | thin wrapper over **A-06 Rubric/RubricCriterion** |
| Report-card remarks generator | master-plan Tier 2 — evidence-grounded, every sentence linked to a mark/attendance/behaviour record, en+ne |
| Item analysis / re-teach recommender | reads `discrimination`/`dedup_hash` usage stats from A-03's `QuestionBankItem` |

### 6.3 Differentiation & accessibility (teacher)
| Tool | Grounds on | Output |
|---|---|---|
| Reading-level adapter | any input text | Same content at 2-3 target reading levels (this is Diffit's whole product — build it as one excellent tool, per §1.1) |
| EAL/ELL scaffold generator | text + target proficiency level | Glossary, sentence frames, simplified version |
| IEP/accommodation drafter | student's existing health/behaviour records (read-only, minimal fields) | Draft accommodations + goals — **never auto-finalized**, see §5.6 |
| Dyslexia-friendly reformat | any text | Reformatted with recommended typography notes (Devanagari-aware, per master-plan G-01.5) |
| Gifted/extension task generator | curriculum_topic + above-grade target | Extension activity |
| Multi-level worksheet generator | one worksheet input | 3 parallel versions at different difficulty |

### 6.4 Communication (teacher)
| Tool | Grounds on | Output |
|---|---|---|
| Parent email drafter | student's recent attendance/marks/behaviour (evidence-grounded, like report-card remarks) | Draft email, en/ne, tone selectable (positive/concern/neutral) — reuses `message_compose`-style variant pattern |
| Newsletter generator | recent notices, upcoming events from the school calendar | Class/section newsletter draft |
| Parent-teacher conference notetaker | live or uploaded audio/notes from the conference | Structured summary + action items, written to the student's file |
| Behaviour incident note drafter | selected incident record | Objective, evidence-based note (guards explicitly against speculative language) |
| Translation assistant | any teacher-authored text | Nepali ⇄ English, preserving formatting |

### 6.5 Tutoring & student study tools (student, always session-scoped per §5.5)
| Tool | Notes |
|---|---|
| Socratic tutor (homework help) | §9.5 — full state-machine spec |
| Exam-prep coach | tutor mode with `exam_mode=true`: deflects direct answers, offers practice instead |
| Writing coach | drafts get *feedback*, never a rewritten final version, per academic-integrity norms |
| Reading companion | comprehension scaffolding on an assigned text |
| Debate practice partner | argument/counter-argument practice, teacher sets the topic |
| Study guide generator | student-triggered, grounds on the topic's curriculum + the class's own recent lesson content |
| Flashcard generator | topic → spaced-repetition-ready card set |
| Practice quiz (self-check) | thin wrapper over A-03, low-stakes, immediate explained feedback |
| Concept explainer ("explain it another way") | re-explains a specific stuck point using an alternate analogy/modality |
| Vocabulary builder | subject-specific term list with definitions + example sentences |
| Career/subject-interest coach | age-appropriate, non-profiling (reads nothing from `StudentAIProfile` beyond language pref) |
| AI literacy micro-lessons | short embedded lessons mapped to the OECD/EC AILit four domains (§1.4) — this is the product's answer to "students must also learn *about* AI, not just use it" |

### 6.6 Delivery-time (teacher, live classroom — Curipod-style, different UI surface)
| Tool | Notes |
|---|---|
| Live interactive poll/quiz generator | presentation-mode UI, low-latency, projected |
| Think-pair-share prompt generator | quick, no review gate needed (ephemeral, non-authoritative) |

### 6.7 Capture tools (teacher, mobile-first — Nepal-specific per master-plan §8 Tier 2)
| Tool | Notes |
|---|---|
| Voice-first Nepali data entry | speech → structured attendance/marks entry, confirmation step before commit |
| Photo → structured data | photo of paper register/marksheet → validated records + review queue, per master-plan A-06.3's "handwritten work" caveat: **never auto-commits**, always a review queue |
| Meeting/PD-session notetaker | audio → structured notes (shared handler with §6.4's conference notetaker) |

### 6.8 Professional growth (teacher)
| Tool | Notes |
|---|---|
| PD coach / reflective prompt generator | grounded in the UNESCO teacher framework's 5 dimensions × 3 levels; tracks which competencies a teacher has engaged with (not a score, a checklist) |
| Content-knowledge refresher | "explain this concept back to me at a teaching level" — Khanmigo already ships this |
| Peer-observation note structurer | turns free-text observation notes into a structured, rubric-aligned summary |

### 6.9 Governance / admin (school & district)
| Tool | Notes |
|---|---|
| District custom-tool builder | admin UI over `SchoolAIToolSettings.field_overrides`/`custom_prompt_suffix` |
| AI usage/cost dashboard | extends A-07's cross-tenant view down to per-tool |
| Rollout tracker | shows staff progress against UNESCO framework levels, for compliance reporting |
| Kill switch (per-tool, per-school) | already required by A-07; wire it through `SchoolAIToolSettings.enabled` |

---

## 7. ORCHESTRATION & AGENT ARCHITECTURE

### 7.1 The dispatcher
```python
# services/orchestrator.py (sketch — implement for real against A-01's actual AITokenHub signature)
def generate(tool_key: str, input_data: dict, actor, school_id) -> AIGeneration:
    tool = AIToolRegistry.get(tool_key)
    validate_input(input_data, tool.input_schema)               # 400 on mismatch, before any AI call
    settings = SchoolAIToolSettings.get(school_id, tool_key)
    if not settings.enabled: raise ToolDisabled()

    ctx = context_builder.build(tool, input_data, actor, school_id)   # §8
    ctx = guardrails.input_filter.apply(ctx)                          # §11.2

    prompt = render_prompt(tool.prompt_key, input_data, ctx)          # A-02 prompt library
    raw = AITokenHub.request(prompt, model_tier=tool.model_tier,
                              actor=actor, school_id=school_id,
                              schema=tool.output_schema)               # A-01, structured outputs

    validated = guardrails.output_validator.apply(raw, tool.output_schema)  # clamp/repair-retry once
    flags = guardrails.moderation.scan(validated)
    if flags: moderation_flags.record(flags)

    gen = AIGeneration.create(tool_key=tool_key, input_jsonb=input_data,
                               output_jsonb=validated, status='draft',
                               model=raw.model, prompt_version=prompt.version,
                               cost_usd=raw.cost_usd, actor_id=actor.id, school_id=school_id)
    caliper_emitter.emit('ToolUseEvent', gen)                          # §12.3, fire-and-forget
    return gen
```
Every tool in §6 that is a **single-shot generation** (the large majority) runs through this exact function with a different `tool_key`. Do not write a bespoke route per tool — that is precisely the anti-pattern the master plan's own §10.1 flags in the *existing* plugin loader and this document exists to avoid repeating.

### 7.2 The exceptions — tools that are not single-shot
- **Tutor engine (§9.5)** is a multi-turn state machine over `TutorSession`/`TutorMessage`, not a one-shot `generate()` call — it has its own route file (`routes/tutor.py`) and its own service, but it still calls `AITokenHub` through the same underlying client and still writes moderation flags the same way.
- **IEP drafter (§5.6)** uses `generate()` for the draft but the *approval* path is a separate, stricter state machine (`routes/iep.py`) that a normal `AIGeneration.approve()` cannot satisfy.
- **Photo/voice capture tools (§6.7)** are two-stage: an ingestion call (vision/ASR) followed by a `generate()`-shaped structuring call, both logged as one `AIGeneration` with `input_jsonb.stage` markers.

### 7.3 Model routing
Reuse A-01's fast/quality tiers exactly. Default assignment, override per-tool in the registry seed:
- **Fast tier**: exit tickets, warm-ups, flashcards, translation, discussion questions, live delivery tools (§6.6) — anything ephemeral or low-stakes.
- **Quality tier**: lesson plans, IEP drafts, report-card remarks, essay grading, tutor engine, parent communication — anything that reaches a guardian, a student's permanent record, or requires sustained reasoning.
- **Temperature**: 0.0–0.2 for anything with a validated output schema (per A-02's existing mandate), ≤0.4 for open-ended prose (lesson plans, newsletters).

### 7.4 Guardrail pipeline (detail in §11.2)
Order matters: **input spotlighting → injection detection → generation → output schema validation → content moderation → persist.** This is the "structural prevention + runtime detection + governance" three-layer pattern documented across the 2026 LLM-guardrail literature (NeMo Guardrails' input/retrieval/dialog/execution/output rails; Meta's Prompt Guard 2 as a cheap classifier stage; the dual-LLM pattern where a second, smaller model checks the first model's output before it's shown to a student). A recent domain-specific study on prompt-injection defenses for *educational* LLM tutors is directly relevant here and worth reading before implementing §9.5: it finds that false positives (the tutor wrongly refusing a legitimate homework question) carry a real pedagogical cost, so the injection-detector threshold should be tuned more conservatively than a generic enterprise chatbot's.

---

## 8. CONTEXT & MEMORY SYSTEM

The Context Builder answers one question for every tool call: *what does the model need to know that it doesn't get told directly, and what must it never be told?*

**Grounding path** (best-effort, degrades gracefully if any link is missing — never blocks a generation, per A-06.5's "honest fallback" pattern):
```
tool call with (class_subject_id?, curriculum_topic_id?, student_id?)
   → class_subject_id  → class_subjects/section_subject_teachers (D-06) → confirms teacher scope
   → curriculum_topic_id → CurriculumTopic → parent CurriculumUnit → LearningOutcome[]
                          → A-05 RAG: top-k document_chunks WHERE school_id= AND source_type IN
                            (curriculum|textbook|past_paper) AND metadata.topic_id=
   → student_id        → mastery_records WHERE curriculum_topic_id= (recent signal only, not full history)
                        → StudentAIProfile (language pref, accommodation flags only)
                        → NEVER the student's real name into the prompt — pseudonymize per A-01.5
                          ("Student A" + a school-local id map, exactly as already mandated for grading)
```
**What is explicitly excluded from context, always:** other students' data, disciplinary records beyond the current incident being drafted, health records beyond active accommodation flags, any cross-school data, any data from a school the actor doesn't belong to (this is just S-01 tenant isolation applied to the AI layer — treat a context-builder tenant leak with the same severity as the master plan treats `X-School-Slug` leaks).

**Memory**: this system has *no* standing long-term conversational memory of a student across sessions beyond `mastery_records` (a small, structured, pedagogically-justified signal) and the `TutorMessage` transcript (retained for guardian visibility and audit, not fed back into future sessions as free-text "memory"). This is a deliberate simplification versus some competitors' persistent-persona chat memory, and it is the correct choice given §1.4 — persistent free-text memory of a minor is exactly the kind of profiling surface DPDP-style law is written to prevent.

---

## 9. DEEP SPECS — the tools that need more than a table row

### 9.1 Embedding pattern (Brisk-style in-workflow triggers)
Every tool that operates on "text the teacher already has open" (differentiation, writing feedback, translation, rubric-from-assignment) must be reachable **from inside the writer/gradebook/lesson-page UI** via a selection-triggered action, not only from the `/ai-workbench` hub. Implementation: a shared `<AIQuickAction text={selectedText} toolKey="..." />` component that calls the same `generate()` endpoint. This is not a v2 nice-to-have — every competitor reviewed in §1.1 that lacks this (a standalone-only tool) loses head-to-head comparisons specifically on this point.

### 9.2 Practice generator (student-facing wrapper on A-03)
Reads `mastery_records` for the requesting student's weakest recent topics, calls A-03's bank-first-then-generate pipeline scoped to those topics, returns a short adaptive set. This is the natural home for the master plan's Tier 4 IRT/psychometrics investment (`discrimination`, item difficulty) to pay off on the student side, not just the exam side — a topic where the bank has high-discrimination items available should be preferred over generating fresh ones.

### 9.3 Differentiation engine
Three modes sharing one handler: (a) reading-level adaptation of arbitrary text to 2-3 target levels, (b) EAL/ELL scaffolding, (c) parallel multi-level worksheet generation from one source worksheet. Grounds on the source text plus, when available, the target student(s)' `mastery_records` for the relevant topic. Output always includes the *original* alongside each adapted version so a teacher can spot-check drift before assigning.

### 9.4 IEP/accommodation drafter
Highest-liability tool in the catalog. Hard rules, enforced in code not just policy: (1) drafts only, `status` starts at `draft`, (2) cannot reach `active` without `reviewed_by` set by a role with `can_review_iep` (§5.6), (3) prompt explicitly instructs the model to flag uncertainty rather than invent a diagnosis-sounding accommodation, (4) every generated goal must cite the evidence it's based on (attendance/marks/existing health record field) — same evidence-grounding discipline as report-card remarks, (5) `AINutritionFacts.human_review_required = true` is hard-coded true for this tool and cannot be toggled off by a district override.

### 9.5 Tutor engine — the Socratic state machine
This is the one genuinely agentic, multi-turn tool in the catalog. State machine, not a bare chat loop:

1. **Instantiate**: student opens a `TutorSessionPlan` their teacher published for their section. No plan → no chat (this enforces §1.2's evidence-based design; there is deliberately no "open chat with no plan" entry point in the student UI).
2. **System prompt assembly**: `tutor_system.md` + the plan's `starter_prompt`, `learning_goal`, `allowed_scope_notes`, and (if `exam_mode`) an explicit instruction set: *never provide a final numeric/written answer to a question that matches the shape of an upcoming assessment item; instead offer the next scaffolding question or a worked *similar* example.* This mirrors both Khanmigo's core design and the exact mechanism the master plan's own A-05.5 already names ("this is on your exam — try it yourself first").
3. **Per-turn pipeline**: student message → input guardrail (injection detection, since RAG-retrieved textbook content is itself untrusted-content-adjacent and a known indirect-injection vector) → context build (topic + relevant chunks + last N turns, not full history) → model call → output validation → moderation scan (self-harm/distress detection gets **immediate** escalation per the platform's existing wellbeing-alert philosophy, not queued for later review) → persist `TutorMessage` → increment session counters.
4. **Close**: session end triggers the plan's `reflection_prompt`; `reflection_submitted` becomes a visible signal to the teacher, not a graded artifact.
5. **Teacher monitoring**: `tutor-rooms/[id]/monitor.tsx` polls session summaries (message count, flag count, reflection status) — full transcript access is available but the default view is aggregate, matching SchoolAI's reviewed pattern of giving teachers oversight without requiring them to read every line live.

### 9.6 Writing feedback (student + teacher-facing modes)
Student mode: feedback only, structured by rubric criterion if a rubric is attached, **never returns a rewritten version of the student's own text** — this is a hard product rule, not a prompt suggestion, enforced by the output schema (`{criterion, strength, suggestion}[]`, no `revised_text` field exists in the schema at all). Teacher mode (grading-adjacent): delegates to A-06.

### 9.7 Delivery-time tools
Different latency/UX budget than everything else in the catalog — these render inside a presentation surface, target sub-2s response, and are explicitly **not** persisted to `AIGeneration` as reviewable artifacts (they're ephemeral prompts for classroom use, logged only in `AIToolAnalyticsDaily` aggregate counts for cost tracking).

### 9.8 PD Coach
The only tool whose grounding source is a **framework document, not curriculum content**: seed `document_chunks` with the UNESCO AI Competency Framework for Teachers text (5 dimensions, 15 competencies, 3 levels) tagged `source_type='policy'`, and have this tool's RAG scope pinned to that source set. Tracks which competency areas a teacher has engaged with over time (a checklist, written to a simple `teacher_pd_progress` join table — not a score, not shared outside that teacher's own view and their PD coordinator's aggregate).

---

## 10. PLUGIN & SUB-CAPABILITY SYSTEM

Register as **one** entry in the existing plugin catalog (master-plan §10):
```yaml
# manifest.yaml
slug: ai_workbench
name_en: "AI Teaching & Learning Workbench"
name_ne: "एआई शिक्षण–सिकाइ कार्यशाला"
section: academic
tier: ai_suite            # reuses the existing plan-tier gate, per P-05
capabilities: >-           # derived at boot from AIToolRegistry, NOT hand-maintained here
  loaded dynamically
hooks:
  install: ai_workbench.hooks.install     # seeds AINutritionFacts rows, default SchoolAIToolSettings
  upgrade: ai_workbench.hooks.upgrade     # per master-plan §10.2, versioned
  deactivate: ai_workbench.hooks.deactivate  # actually called, per §10.2's fix
events_emitted:
  - ai_workbench.generation.approved
  - ai_workbench.tutor.flagged            # consumed by the existing wellbeing-alert listener
events_consumed:
  - academic.class_subjects.updated       # re-index context builder scoping when D-06 data changes
```
District/palika-tier admin console (master-plan §8 Tier 4 "Founder/owner multi-school console") gets one additional capability here: cross-school `AIToolAnalyticsDaily` rollups and the ability to push a `custom_prompt_suffix` to every school in the district at once. Build the single-school version first; the multi-school rollup is a `GROUP BY` away once the per-school table exists — do not build a separate district data model.

---

## 11. SAFETY, COMPLIANCE & GOVERNANCE

### 11.1 AI Nutrition Facts — enforced, not aspirational
Every tool card and every full nutrition-facts page renders directly from `AINutritionFacts` (§5.7) — model tier, providers, what data is accessed, retention period, whether any provider trains on the data (must be `false` for every seeded row; if a future provider can't guarantee this, don't ship the tool), whether human review is required, minimum recommended grade, and known limitations in plain language, in both languages. CI blocks marking a tool `status=ga` without a matching row (§5.7).

### 11.2 Guardrail pipeline detail
- **Input layer**: spotlighting (structurally mark retrieved/untrusted content as data, not instruction, in the prompt — the technique Hines et al. document as effective against indirect injection) + a cheap classifier pass (Prompt-Guard-class model, fast tier) before the main call.
- **Output layer**: schema validation with one bounded repair retry (reuses A-01's existing `parse_and_validate` helper — do not build a second one), then a moderation scan for self-harm/violence/academic-integrity/PII-leak categories.
- **Escalation**: `critical` severity flags (self-harm indicators in a `TutorMessage`) bypass the normal review queue and fire the same immediate-alert path the platform already uses for wellbeing concerns elsewhere — do not build a second alerting mechanism.
- **False-positive cost is asymmetric here**: per the education-specific prompt-injection literature cited in §7.4, an over-eager refusal on a legitimate homework question has a real pedagogical cost. Tune thresholds conservatively and route borderline cases to "answer cautiously + log for review" rather than "hard refuse," except for the moderation categories above, which always hard-stop.

### 11.3 Consent & minor data
`GuardianAIConsent` is checked before **any** student-facing tool in §6.5/§6.7 is reachable for a student under the school's configured age threshold (default: all students, since Nepal's forthcoming regime is expected to track India's 18-year bar per the master plan's own note — configurable per school pending final Nepali regulation). No tool in this catalog builds a persuasive/behavioural profile of a minor; `StudentAIProfile` is intentionally narrow (§5.9) and any future addition to it requires a privacy review, not just a migration.

### 11.4 Persona design
No named, anthropomorphized persona for the student tutor (learn from MagicSchool's own Feb 2026 course-correction, §1.1) — call it "AI Study Helper" or the school's own configured neutral name, never a first-person character with a backstory.

### 11.5 Regulatory alignment table
| Requirement | Source | Where enforced |
|---|---|---|
| Human oversight before consequential use | EU AI Act Annex III shape (best-practice even where not yet legally binding) | `requires_review=true` default; hard-true for IEP |
| Risk logging / technical documentation | EU AI Act, NIST AI RMF | `AIGeneration` ledger + `AINutritionFacts` |
| Guardian consent before processing a minor's data | India DPDP (template for Nepal) | `GuardianAIConsent` gate |
| No behavioural profiling of minors | India DPDP | `StudentAIProfile` scope limit (§5.9) |
| Teacher AI-literacy baseline | UNESCO AI CFT; EU AI Act Art. 4 (in force since Feb 2025, not deferred) | PD Coach (§9.8) + rollout tracker (§6.9) |
| Student AI-literacy content | UNESCO AI CFS; OECD/EC AILit | §6.5 AI literacy micro-lessons |

---

## 12. STANDARDS & INTEROPERABILITY

### 12.1 LTI 1.3 (future work, scaffold now)
`services/standards/lti_launch.py` is a stub in v1 — the real payoff is launching `ai_workbench` *as* an LTI tool inside a district's existing LMS if ASchool ever needs to sell into a mixed environment. Scaffold the OIDC launch flow now against the 1EdTech Security Framework so it isn't a rebuild later.

### 12.2 QTI 3.0 export
`services/standards/qti_export.py`: A-03's `QuestionBankItem`/`GeneratedPaper` → QTI 3.0 package. Study TAO's open-source implementation as the reference for correct QTI item-type mapping (mcq/short/numerical/etc. all have defined QTI interaction types). This is what makes the master-plan's Tier 4 psychometrics investment portable rather than trapped in ASchool's own schema.

### 12.3 Caliper event emission
Every `AIGeneration` and every `TutorMessage` fires a lightweight Caliper-shaped event (`ToolUseEvent`, `MessageEvent`) to an internal event log from day one, even before any external analytics consumer exists — cheap now, expensive to retrofit later, and it's the same event log the district cost/usage dashboard (§6.9) should read from rather than querying `ai_generations` directly at scale.

### 12.4 OneRoster / MCP note
`class_subjects`/`section_subject_teachers` (D-06) already give ASchool everything OneRoster's Rostering service needs to export; no new work required here beyond what D-06 already schedules. Separately, the master-plan's own Tier 4 "MCP server over the school's own data" (§8) is the natural long-run interoperability play for this ecosystem specifically — a read-scoped MCP server exposing `curriculum_topics`, `AIContentLibraryItem` (school/district-visibility items only), and a teacher's own `mastery_records` view would let a teacher's personal Claude/ChatGPT query their own class's real curriculum context without ASchool having to build every possible AI feature itself. Sequence this after the in-product catalog above is stable, per the master plan's own phase ordering.

---

## 13. EVALUATION, TESTING & ROLLOUT

### 13.1 Golden-set evals
Extend A-02's eval harness (`backend/tests/ai_evals/`) with one golden set per tool category, not per tool (65 golden sets is not proportionate; ~9 category-level sets covering planning/assessment/differentiation/communication/tutoring/capture/PD/delivery/governance is). LLM-as-judge scoring plus, for evidence-grounded tools (report-card remarks, parent emails, IEP drafts), a **citation-presence check**: every generated claim about a student must trace to a real record ID.

### 13.2 Human-in-the-loop metrics
`AIGeneration.edit_distance_pct` and `teacher_rating` roll up into `AIToolAnalyticsDaily`. A tool with sustained high edit-distance (teachers rewriting most of the output) is a signal to revisit its prompt, not a signal to hide the metric — surface it honestly on the admin dashboard.

### 13.3 Red-teaming
Before any tool touching students goes `ga`, run it against the same adversarial patterns documented in the 2026 prompt-injection literature (indirect injection via retrieved textbook/document content, direct jailbreak attempts, attempts to extract another student's data through the tutor). Log results in the tool's `AINutritionFacts.known_failure_modes`.

### 13.4 Nepal-specific rollout notes
- **Low-connectivity**: capture tools (§6.7) and the tutor must degrade to "queue and sync" on the mobile app, following the master-plan's M-01.3 offline-outbox pattern exactly — do not build a second offline strategy.
- **Bilingual by default**: every prompt file ships both `_en` and `_ne` variants of any user-facing string from day one; do not treat Nepali as a post-launch localization pass for this ecosystem specifically, since it is the actual differentiator.
- **Cost discipline**: NPR-tier schools cannot absorb surprise AI bills (master-plan A-07.2) — every tool in this catalog must show its estimated cost before generating (`CostEstimateChip.tsx`) and respects the hard-stop metering already mandated.

### 13.5 Phased rollout (slots into the master plan's M3, "wk 7-12")
| Sub-phase | Ships | Gate |
|---|---|---|
| **E0** | Registry + orchestrator + 8 highest-value planning tools (lesson plan, worksheet, exit ticket, rubric wrapper, parent email, differentiation, study guide, flashcards) | A-01/A-02/A-04 done |
| **E1** | Content library + district custom-tool overrides + remaining planning/communication tools | E0 stable, D-06 done |
| **E2** | Tutor engine + session plans + guardrail pipeline hardened | A-05 RAG live; red-team pass complete |
| **E3** | IEP drafter + capture tools (voice/photo) + PD coach | E1 stable |
| **E4** | Delivery-time tools + QTI/Caliper export + MCP server scaffold | Everything else `ga` |

---

## 14. ACCEPTANCE CRITERIA CHECKLIST

- [ ] `GET /ai/tools` returns every catalog row with correct `min_plan_tier` gating and no tool with `status=ga` lacking an `AINutritionFacts` row (CI-enforced).
- [ ] Adding a new tool requires touching exactly: one prompt file, one handler file, one registry seed row, zero route files, zero new frontend pages (integration test that asserts a fixture "test tool" is fully functional through the generic runner with no new routes).
- [ ] No `generate()` call ever reaches `AITokenHub` with a real student name in the prompt — pseudonymization test asserting the rendered prompt string never contains a name present in the `students` table for that school.
- [ ] Tenant isolation: context builder for school A can never retrieve `document_chunks`/`mastery_records`/`AIContentLibraryItem` rows for school B (test mirrors S-01's tenant-crosser pattern).
- [ ] Tutor: a student cannot open `tutor/[sessionId]` for a plan not published to their section; `exam_mode=true` sessions never return a schema-validated "final answer" field for a flagged assessment-shaped question (golden-set test with known exam-style prompts).
- [ ] IEP: API rejects any request to set `status=active` from an actor without `can_review_iep`; `reviewed_by` is always set before that transition (integration test with a 403 case and a success case).
- [ ] Writing-feedback output schema has no `revised_text`/`rewritten` field at the type level, not just by prompt instruction (schema test).
- [ ] Every seeded tool has both `_en` and `_ne` prompt/UI strings (lint check over `prompts/` + i18n catalog per F-02).
- [ ] Cost estimate shown before generation matches (within tolerance) the `cost_usd` actually recorded on the resulting `AIGeneration` (reconciliation test).
- [ ] Kill switch: disabling a tool via `SchoolAIToolSettings.enabled=false` returns 403 from `generate()` within one request (no cache lag beyond A-07's existing quota-check latency budget).
- [ ] Caliper-shaped events fire for every `AIGeneration` and `TutorMessage` (event-log row-count test).

---

## 15. WHAT THIS DOCUMENT DELIBERATELY DOES NOT DECIDE

Hand these back to the founder/product owner before an agent starts building, since they're product calls, not architecture calls:
1. Exact plan-tier packaging of the ~65 tools (which ones are free vs. `ai_suite` vs. a new higher tier) — the registry schema supports any split; the split itself is a pricing decision.
2. Whether the tutor ships to all grades at launch or starts restricted to a pilot grade band (recommended, given §1.2's evidence base is strongest for older secondary students, but this is a rollout call).
3. Which specific vision/ASR providers back the photo/voice capture tools — A-01's provider-routing pattern accommodates any choice; pick based on Nepali-language ASR quality benchmarking, which this document has not done.
4. District/palika commercial terms for the Tier 4 multi-school console — architecture is ready (§10), packaging is not this document's job.

---

## 16. RESEARCH SOURCES (for the implementer's own verification — links, not reproduced text)

- MagicSchool AI: educatorstechnology.com/2026/02/magicschool-ai-review.html · fast.io/resources/magic-ai-review-2026 · tooliverse.ai/tools/magicschool · techshark.io/tools/magic-school-ai · theagentalmanac.com/articles/magicschool-ai-review-2026 · aitoolsbakery.com/blog/magicschool-ai-review
- Khanmigo / Khan Academy–Google: blog.khanacademy.org (2026 back-to-school post) · blog.google/products-and-platforms/products/education/khan-academy-back-to-school · edtechinnovationhub.com/news/khan-academy-brings-gemini-powered-visual-tutoring-into-classrooms-for-2026 · khanmigo.ai/teachers
- Brisk / SchoolAI / Diffit / Curipod / Eduaide comparisons: slidespeak.co/blog/brisk-teaching-alternatives · forasoft.com/blog/article/automated-lesson-plan-generation-software · cograder.com/content/brisk-teaching-alternatives · kuraplan.com/blog/brisk-teaching-alternatives · aiforedu.ai/tools/brisk-teaching · aimadefor.com/blog/brisk-teaching-review
- 1EdTech standards: 1edtech.org/standards/oneroster · 1edtech.org/standards/lti/why-adopt-lti-1p3 · notixit.com/blog/edtech-oneroster-edfi-lti-interoperability · en.wikipedia.org/wiki/1EdTech:_IMS_Global_Learning_Consortium
- TAO / QTI open-source: taotesting.com/authoring · accelerate.taotesting.com/revolutionize-standardized-testing-with-open-source-software
- EU AI Act education: artificialintelligenceact.eu/annex/3 · aiadopt.eu/en/insights/eu-ai-act-education · winssolutions.org/eu-ai-act-education-deadline-deferred · planbe.eco/en/blog/eu-ai-act-for-the-education-industry
- UNESCO frameworks: unesco.org/en/articles/ai-competency-framework-teachers · unesco.org/en/articles/ai-competency-framework-students · cedefop.europa.eu (UNESCO AI CFT PDF)
- OECD/EC AI Literacy Framework: ailiteracyframework.org · oecd.org/en/publications/empowering-learners-for-the-age-of-ai_65cd27d4-en.html
- India DPDP (children): ksandk.com/data-protection-and-data-privacy/child-data-protection-under-dpdp-act-parental-consent-rules · consent.in/blog/child-consent
- Edo State RCT: blogs.worldbank.org/en/education/From-chalkboards-to-chatbots-Transforming-learning-in-Nigeria · voxdev.org/topic/education/how-ai-tutors-improved-learning-nigeria · openknowledge.worldbank.org (De Simone et al. 2025 working paper)
- RAG architecture 2026: customgpt.ai/rag-architecture-patterns · atlan.com/know/advanced-rag-techniques · blog.starmorph.com/blog/rag-techniques-compared-best-practices-guide
- LLM guardrails / prompt injection: futureagi.com/blog/llm-prompt-injection-2025 · sysdig.com/learn-cloud-native/prompt-injection · aisecurityandsafety.org/en/guides/llm-guardrails · arxiv.org/pdf/2605.06669 (education-specific prompt-injection defenses)
- MCP / Canvas: blog.modelcontextprotocol.io/posts/2026-07-28 · sitepoint.com/model-context-protocol-mcp
- AI Nutrition Facts / model cards: imd.org/ibyimd/artificial-intelligence/ai-nutrition-labels-a-food-inspired-approach-to-trust · blogs.sas.com (model cards)
