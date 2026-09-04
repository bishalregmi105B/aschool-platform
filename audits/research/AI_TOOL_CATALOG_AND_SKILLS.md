# ASchool AI Tool Catalog & Skills-Repo Study

Research date: 2026-09-04. Scope: (1) reverse-engineer the authoring pattern of the
`glebis/claude-skills` repository, (2) survey what teachers actually need and what the
AI-teaching market ships, (3) design ASchool's definitive AI tool catalog for the new
**AI Teacher** plugin + existing **ai_suite**, (4) specify how AI tools emit into
ASchool's *existing* document engines and what those engines still need.

Method: GitHub API tree walk + raw fetch of all 112 `SKILL.md` files in the skills repo
(parsed locally, `/tmp/gsk`); WebFetch/curl on vendor sites and primary research sources;
direct reads of ASchool backend/frontend source. External claims carry URLs. Anything not
confirmed from a primary source is marked **unverified**.

---

# PART 1 — THE `glebis/claude-skills` PATTERN

Repo: https://github.com/glebis/claude-skills (MIT, author Gleb Kalinin).
Measured from the git tree (`https://api.github.com/repos/glebis/claude-skills/git/trees/main?recursive=1`,
commit `d0bc206`): **104 top-level directories, 112 `SKILL.md` files** (nested sub-skill
packs push the file count above the folder count).

## 1.1 SKILL.md authoring conventions (measured, not assumed)

Frontmatter key frequency across all 112 files:

| Key | Files | Notes |
|---|---|---|
| `name` | 109 | slug, matches directory name |
| `description` | 109 | the *entire* routing signal — capability + "use when" + literal trigger phrases, all in one long string |
| `triggers` (list) | 1 | `skills/library-sync` only |
| `trigger` (string) | 1 | `temple-generator` (`/temple-generate`) |
| `args` | 1 | `temple-generator` (`vault_path [--compare …] [--output …]`) |
| `user_invocable` | 1 | `temple-generator` |
| `allowed-tools` | **0** | not used anywhere in this repo |
| `version` / `license` / `model` | 0 | absent |

Three directories deviate: `cognitive-toolkit` uses lowercase `skill.md`; `de-ai` ships
`skill.yaml` + `skill.sh` + `system.md` and no SKILL.md; `confide` is a *pack* — no root
SKILL.md, but eight sub-skills (`skills/{annotate,anon,audit,red,rehydrate,setup,vault,view}/SKILL.md`)
plus a shared `shared/confide_core.py` and a repo-level `evals/`.

Body size: median well under 1,500 words; smallest are 140–200 words (`jtbd`,
`design-tokens`, `nielsen-heuristics` are 3-line "MOVED" redirect stubs), largest is
`tdd` at 4,873 words. Section headers cluster hard: `## Workflow` (20), `## Usage` (18),
`## Prerequisites` (15), `## When to use` / `## When to Use` (26 combined),
`## Quick Start` (11), `## Output` (10), `## Files` (8), `## Resources` (7),
`## Limitations` (4), `## Privacy invariants (do not violate)` (5).

**Canonical folder layout** (README-documented; matches the tree):

```
skill-name/
├── SKILL.md          # always loaded: routing + workflow + limits
├── CHANGELOG.md      # rare in practice (only deep-research has one)
├── scripts/          # executable orchestration (invoked, not read)
├── assets/           # templates, HTML shells, example JSON
└── references/       # deep docs, loaded on demand
```

38 of 112 SKILL.md files reference `references/` — the load-on-demand tier. Only ~10 give
an explicit "Read `references/X.md` before …" instruction; the rest name the path at the
point of need. `.claude-plugin/plugin.json` appears per-skill for marketplace install, and
`.claude-plugin/marketplace.json` sits at the repo root.

## 1.2 The eight conventions worth copying

1. **Description is the router.** One long string carrying capability + activation
   conditions + verbatim trigger phrases ("make a presentation", "create slides"). No
   separate keyword field. For ASchool this maps to `AIToolRegistry.description` plus a
   new `trigger_phrases` column so the AI Teacher chat can route intent to a tool.
2. **Progressive disclosure in three tiers.** Tier 0 = frontmatter (routing only).
   Tier 1 = SKILL.md body (workflow, decision rules, limits). Tier 2 = `references/*.md`
   + `scripts/*` (never read into context unless the step needs it). ASchool equivalent:
   registry row (tier 0) → prompt file `app/prompts/<schema>_{en,ne}.md` (tier 1) →
   template/reference packs and handlers (tier 2).
3. **Scripts do the deterministic work; the model does the judgement.** `pdf-generation`
   ships `scripts/generate_pdf.py` + `scripts/fix_markdown.py`; `tufte-report` ships
   `scripts/serve.py`; `whitepaper-audit` runs a two-lane audit where lane 1 is a
   stdlib-only Python checker and lane 2 is an LLM judge. Direct analogue: our
   `tool_handlers.py` post-processors and the designer renderers must own all
   arithmetic/layout, never the prompt.
4. **Templates + data contract, not free-form generation.** `presentation-generator`
   defines a slide JSON schema (`{title, footer, slides:[{type, bg, title, bullets,
   items:[{value,label}], code, language}]}`) and eight typed slide partials under
   `templates/slides/`. `tufte-report` normalizes any input into an intermediate
   **ReportData** JSON and then composes from a typed *block catalog* (sparkline-row,
   kpi-card, trend-chart, data-table, correlation-matrix, narrative, heatmap,
   strip-chart), each with its own data contract. This is exactly the shape our
   `writer_json.blocks` already has — and the model we should extend for slides.
5. **Hard limits + a scope-negotiation script.** `tufte-report` caps at 8 sections, 2
   chart types per section, 3 colors per chart, bans pie/donut/3D, allows scroll-reveal
   as the only motion, and publishes LOC/time budgets (200 LOC ≈ 5–10 min → 1,200 LOC ≈
   30–50 min) with a literal negotiation sentence when the user over-asks. Our tools
   should publish equivalent budgets (max questions, max pages, max marks) and refuse
   politely rather than degrade.
6. **Recorded failure modes travel with the skill.** `tufte-report` lists 8 named
   pitfalls (pin Chart.js `@4`, never `file://` because CDN scripts fail, never two
   adjacent charts, wrap tables on mobile, cite computed coefficients rather than
   asserting correlation). `pdf-generation` names the "Common Claude Code Pattern" — a
   list directly under a colon line renders inline — and ships `fix_markdown.py` to
   repair it. Our prompt files should carry a `## Known failure modes` section (e.g.
   Devanagari line-breaking, marks that don't sum, NEB grade boundaries off-by-one).
7. **Evals are first-class for judgement tools.** `agent-cli`, `peer-agent-collaboration`
   ship `evals/evals.json`; `whitepaper-audit` ships planted-defect cases + a clean
   control with pass criteria and a rule that the judge must run in a *fresh context* —
   "never judge a document you wrote in the same context". `rag-eval` runs a cost-aware
   grid over a ≥10-pair gold set with a **hard dollar budget cap confirmed before any
   sweep** (default $2). Directly applicable to our auto-grader and writing-feedback
   tools: gold-set + fresh-context judge + budget cap.
8. **Privacy invariants stated as non-negotiable, with local-first tooling.** The
   `confide` pack redacts PII *locally* to a "GREEN" copy with reversible sentinels, runs
   a corpus-scale stats-only audit, red-teams residual re-identification risk, then
   rehydrates real values only on the user's machine; `session-anonymizer` layers
   Natasha NER + a privacy filter + a local Ollama model; `recording` redacts live
   output for screen-shares; `local-models` exists specifically so cheap/bulk/PII work
   never leaves the machine. Five SKILL.md files carry a literal
   `## Privacy invariants (do not violate)` header. Our `workbench.pseudonymize` /
   `de_pseudonymize` pair is the same idea; the missing pieces are the *audit* and
   *red-team* skills.

## 1.3 Full skill inventory, grouped by what we could reuse

Format: `name` — what it does — ships — reusable idea for ASchool.

### A. Document / PDF / report generation (highest relevance)

| Skill | What it does | Ships | Reusable idea |
|---|---|---|---|
| `pdf-generation` | Markdown → styled PDF via Pandoc + XeLaTeX; 4 canned invocations (EN/RU × desktop-A4/mobile-6×9); theme colors by doc type (white paper `1e3a8a`, marketing `059669`, research `7c3aed`, technical `374151`) | `scripts/generate_pdf.py`, `scripts/fix_markdown.py`, `references/frontmatter_templates.md`, `references/pandoc_reference.md` | **Doc-type → theme mapping** and **two page profiles per document** (print A4 vs mobile). Our PDFs are WeasyPrint, but "one document, two page geometries" is directly portable (worksheet A4 vs phone-readable) |
| `tufte-report` | Standalone HTML data report/dashboard: EB Garamond prose, Monaspace Argon numerals, Chart.js 4, inline SVG sparklines, 2-col narrative+data | `scripts/serve.py` (live-reload on :8042), 6 references (`design-tokens`, `components`, `charts`, `data-adapter`, `blocks`, `preview-server`) | **ReportData intermediate JSON + typed block catalog**; semantic color scheme; 5-question onboarding before any code; sparklines-in-prose. This is the blueprint for our analytics/report-card packs |
| `whitepaper-audit` | Two-lane document audit: deterministic script + LLM judge, merged P0/P1/P2 report | `scripts/check_doc.py`, `scripts/tests/`, `references/checklist.md`, `references/audit-prompt.md`, `evals/cases/` | **Two-lane grading**: deterministic checks (marks sum, rubric coverage, reading level) + LLM judge, with verbatim-quote requirement and "needs verification, never factually wrong" calibration |
| `firecrawl-research` | Research → scientific/academic paper | `scripts/{firecrawl_research,convert_academic,generate_bibliography}.py`, `assets/templates/{myst-scientific-paper,pandoc-scholarly-paper}.md`, `assets/references.bib` | Template-per-output-genre + a bibliography generator; maps to our "cite the curriculum unit" requirement |
| `repo-prep` | Interactive publication prep: LICENSE/NOTICE/README/community docs | `scripts/fetch_license.py`, 4 references, 15 `assets/github/*` boilerplate files | **Asset-bundle scaffolding** — one command emits a whole document set. Our bulk-generator equivalent for a "new academic year pack" |
| `learning-vault` | Builds a full structured study vault for a certification/course: Dashboard, MoCs, Domains, Concepts, Lessons, Scenarios, cheat sheet, dataview queries | ships an Obsidian `dataview-plugin/` | **Self-assessment-driven priority ordering** (ask confidence per domain → drives study order) and the *whole-artifact-set* output. Directly transferable to a student "SEE revision pack" |
| `temple-generator` | Vault → 3D interactive knowledge map (Three.js, one HTML file) | `scripts/extract_entities.py`, `references/{classification-guide,entity-schema,merge-algorithm}.md`, `assets/temple-template.html` | Entity-schema + merge-algorithm as *references*, single-file HTML artifact; a concept-map generator for revision |

### B. Presentation / deck generation (we have no deck engine)

| Skill | What it does | Ships | Reusable idea |
|---|---|---|---|
| `presentation-generator` | JSON/YAML/Markdown → neobrutalist HTML deck; PNG per slide @1920×1080; multi-page PDF via Playwright | `scripts/{generate-presentation,export-slides,md-to-slides}.js`, `templates/base.html`, `templates/styles.css`, `templates/slides/{title,content,code,stats,two-col,grid,ascii}.html` | **Typed slide partials + one content JSON**; `md-to-slides` as an alternate front door; Playwright as the raster/PDF exporter. This is the closest match to what our slide engine should be |
| `present` | HTML deck **and** long-form article from one source, with per-slide ElevenLabs voiceover, scroll-reveal, GPT-Image illustration; 10 slide types (`title, summary, stat, evidence, comparison, quote, framework, recommendation, case-study, sources`); deterministic timing `slide_duration = max(audio, read_time) + 2s`, 1.8 s transition | `scripts/generate_audio.py`, `assets/template.html`, `references/slide-types.md` | **Dual-mode output (deck ⇄ handout) from one JSON** — enormously valuable for teachers: same lesson content becomes projector deck *and* printable notes. Also: narration ≠ slide text ("explain, connect, elaborate"), 15–30 s/slide, illustrate only 3–5 of 12 slides, and an explicit anti-"AI-slop" list (no gradient metric text, no uniform icon-card grids) |
| `brand-agency` | Applies brand palette/typography to decks, SVG, docs, web | `scripts/render-templates.js`, 12 `assets/templates/**` (Instagram/social/YouTube HTML templates) | **Brand tokens as a skill other skills reference** → our school-branding service (logo, colors, letterhead) should be a shared context builder, not copy-pasted per tool |
| `agency-socials` / `agency-meetup-publish` | Event covers, thumbnails, publication pipeline | `references/thumbnail-template.html`, `description-template.md` | Thumbnail-template-as-HTML → our `thumbnails.py` already does this via WeasyPrint + pdftoppm |

### C. Research / web / knowledge

`deep-research` (OpenAI Deep Research API; `scripts/run_deep_research.py` + `assets/deep_research.py` + `references/workflow.md`; auto-enhances prompts with 2–3 clarifying questions when the query is <15 words or starts with "what is"; saves timestamped prompt + report; **explicitly forbids status polling** — ~20k wasted tokens vs ~1k for a single wait) · `firecrawl-research` · `elimination-research` (shortlist selection with explicit criteria and numeric scoring; `scripts/elimination_research_lib/{domain,application,infrastructure}` clean-architecture split; `references/dataset-schema.md`) · `doctorg` (tiered trusted sources + GRADE-inspired evidence ratings) · `qmd-search` (on-device BM25+vector+LLM-rerank over a markdown vault; ships `evals/BASELINE.md`) · `google-image-search` (8 scripts incl. `llm_select.py`, `evaluate.py`) · `weekly-digest` (20+ candidates → verify for AI slop → score on 5 parameters → publish) · `wow-digest` (`scripts/{ingest,enrich,salience_filter,wow_score,feedback}.py` — scores for "epistemic friction") · `browser-mate` (logged-in Chrome automation without disturbing tabs) · `youtube-transcript` (+`deduplicate_transcript.py`).
**Reusable:** the clarifying-question gate before expensive work; tiered *trusted source* lists with evidence grades (for NEB/CDC grounding); the "verify for AI slop" step; a salience/novelty score rather than plain relevance.

### D. Assessment-adjacent evaluation & judging

`rag-eval` (cost-aware eval grid, ≥10-pair gold set, budget cap confirmed up front, learns from past runs, `scripts/session_ingest.py` deterministic transcript ingest) · `vision-bench` (vision-LLM-as-judge over YAML rubric presets: 11 criteria files incl. `document_ocr.yaml`, `chart_analysis.yaml`, `alt_text.yaml`; multi-judge consensus) · `rigorous-experiments` (`scripts/{explorer,perm_stats,triage}.py`, references on cross-validation/data-validation/statistics, `evals/cases/{good,bad}_exp.py`) · `whitepaper-audit` · `agent-cli`/`peer-agent-collaboration` (`evals/evals.json`).
**Reusable:** *rubric-as-YAML-preset* (our rubric tool should emit a reusable preset file, not one-off text); multi-judge consensus for high-stakes marking; permutation stats before claiming an intervention worked.

### E. Memory, planning, decisions, PD

`context-builder` (`references/{frameworks,prompt-template,section-library}.md` — generates structured discovery prompts) · `pre-session-portrait` (7-lens JTBD interview → compressed client portrait; `assets/{cockpit-template.html,intake-form.md,interview-prompt.md}`) · `decision-toolkit` (`references/bias-encyclopedia.md`, `templates/decision-guide-template.html`) · `the-goal` (Theory-of-Constraints five focusing steps; `scripts/{score_constraints,recommend_rung}.py`, `references/autonomy-ladder.md`) · `automation-advisor` (automation ROI matrix; ships a web server + `templates/index.html`) · `balanced` (anti-sycophantic dialogue mode) · `thinking-patterns` (blindspot + extraction + synthesis prompts as separate files) · `daydream` (critic-prompt + synthesizer-prompt split) · `retrospective` (`retro_engine.py` + 7 YAML scenarios) · `lab-retro` (4-part interactive self-assessment using AskUserQuestion) · `skill-studio` (interview-driven skill design with coverage tracking) · `meta`/`ecosystem` (audits skill health + instruction drift) · `cognitive-toolkit` (CBT/DBT interventions: thought records, opposite action, DEAR MAN roleplay, crisis skills, configurable therapeutic pushback).
**Reusable:** the **interview-with-coverage-tracking** pattern (perfect for IEP intake and parent-conference prep); split prompts into `critic` + `synthesizer` files for two-pass quality; scenario YAMLs as regression fixtures; `cognitive-toolkit` is the closest existing model for a *counselor* persona with configurable pushback and crisis routing.

### F. Media, voice, images

`elevenlabs-tts` (`scripts/elevenlabs_tts.py`, `references/api_reference.md`, `.env.example`) · `gpt-image-2` and `nano-banana` (both ship `platforms.yaml` + `presets.yaml` — platform-specific sizing + style presets, cost-aware draft/final workflow ≈$0.006/draft) · `google-image-search` · `sketch` (Fabric.js SVG editor in-browser, agent reads/writes SVG over MCP while the user edits interactively — **the closest existing analogue to our Fabric canvas + AI agent**) · `font-features` (`scripts/otfeat.py` — inspect/apply OpenType ss01–ss20, cvXX) · `typography` (locale-correct smart quotes for RU/EN/DE/FR, `assets/{hang-punctuation.js,optalign.css}`).
**Reusable:** `platforms.yaml`+`presets.yaml` as a **declarative size/style registry** (we need exactly this for A4/A5/ID-card/slide/16:9); `sketch`'s bidirectional agent↔canvas editing model; `typography`/`font-features` are the precedent for treating **Devanagari typography as its own skill** with a reference doc.

### G. Data / analytics / personal telemetry

`health-data` (SQLite → Markdown/JSON/**FHIR R4**; `references/{schema,fhir_mappings}.md`) · `wispr-analytics` (`scripts/{extract_wispr,extract_prosody,wispr_dictionary}.py`, `references/analysis-prompts.md`) · `chrome-history` / `browsing-history` (NL → SQL over local history; `scripts/{init_db,sync_chrome_history}.py`) · `insight-extractor` · `transcript-analyzer` (TypeScript CLI, `data/glossary.json`, extracts decisions/actions/opinions/questions/terminology) · `granola` / `fathom` / `zoom` / `meeting-prep` / `meeting-processor` (auto-detects meeting type then runs a type-specific extractor: `extractors/{coaching,leadgen,partnership}.py`) · `coaching-session-summarizer` (`scripts/{gather_context,summarize_session}.py`) · `synthetic-session-generator` (persona-consistent synthetic transcripts for evals/demos; `references/{personas,realism_guide,modalities}.md`).
**Reusable:** **standardized export format** (FHIR is to health what IEMIS/QTI/Caliper are to us — we already emit Caliper + QTI); *type-detect then dispatch a type-specific extractor* (exactly how a "parent meeting notes → action items" tool should work); **synthetic data generation for evals** so we can test grading without touching real student work.

### H. Engineering / release / ops (lower relevance, two ideas worth stealing)

`tdd` (RED-GREEN-REFACTOR enforcement, vertical slicing, context isolation; `references/{agent_prompts,anti_patterns,framework_configs,layer_guide}.md`; fixture projects in Go+Python) · `feature-factory` (`assets/goal-contract.md` + `references/process-budget.md`) · `cull-release` **six-skill suite** (`cull-release` orchestrator + `check/prepare/publish/verify/recover`, each with an `agents/openai.yaml`, plus `references/phase-contracts.md`) · `app-release` · `repo-publish` · `init-tauri-app` / `init-xcode-app` (44 and 40 asset files respectively) · `i18n-studio` (edit/translate/review a bilingual string corpus; `scripts/i18n.mjs`) · `agent-cli` · `llm-cli` · `local-models` · `codex` · `linear` · `session-{finder,search,anonymizer}` · `skills/disk-cleanup` · `skills/job-babysitter` · `skills/cmux` · `publish-skill` · `skills/release` · `sorted` · `name-audition` · `timebuzzer-led` · `trail-checkin` · `wispr-fix` · `site-diagnosis` · `de-ai` · `confide` pack · `gws`/`gmail`/`telegram*`/`tg-responder`.
**Reusable:** (a) **the six-skill release suite decomposition** — one orchestrator + five phase skills sharing a `phase-contracts.md`, which is precisely how our "publish results / generate the whole report-card run" workflow should be modelled (check → prepare → publish → verify → recover); (b) `i18n-studio` — a skill whose whole job is keeping an EN/NE string corpus in sync, which we need for 130 tool names × 2 languages.

### I. Bundles (`BUNDLES.md`)

Eight curated bundles: Meeting Intelligence · Communication · Research · **Content & Publishing** (nano-banana, gpt-image-2, presentation-generator, pdf-generation, tufte-report, brand-agency, sketch, vision-bench — "Generate → style → publish → evaluate. Full visual pipeline.") · Personal Analytics · Thinking & Strategy · Developer Tools · Lab & Consulting. Skills may appear in two bundles.
**Reusable:** bundles are the *packaging/pricing* unit, independent of the tool registry — mirrors our plugin-bundle model (`ai_suite` gates, individual blueprints stay mounted). Our catalog should ship named bundles ("Marking Week", "Report-Card Season", "Parents' Day", "SEE Sprint") that cut across categories.

## 1.4 What we adopt, concretely

1. `AIToolRegistry` gains `trigger_phrases` (JSON array), `budget` (max output size /
   est. cost tier), `failure_modes` (text), `reference_pack` (folder key), and
   `output_document_type` (which renderer consumes the result) — the last one is what
   makes Part 4 work.
2. Prompt files get mandatory sections: `## When to use`, `## Workflow`,
   `## Output` (schema restated), `## Hard limits`, `## Known failure modes`,
   `## Privacy invariants`.
3. Reference packs (tier 2) live under `app/prompts/refs/<pack>/*.md` and are injected
   *only* when the handler asks for them — the direct analogue of `references/`.
4. Deterministic work moves to handlers: mark totals, NEB grade/GPA, BS dates, blueprint
   coverage checks, page counts. The model never computes a number we can compute.
5. Judgement tools ship gold sets under `backend/tests/ai_gold/<tool_key>/` with a
   fresh-context judge and a per-run cost cap, mirroring `rag-eval` + `whitepaper-audit`.

---

# PART 2 — WHAT TEACHERS NEED, AND WHAT THE MARKET SHIPS

## 2.1 The workload evidence (primary sources)

| Finding | Figure | Source |
|---|---|---|
| Teachers using AI weekly save **5.9 h/week** ≈ **six weeks** across a 37.4-week year | 5.9 h; 60% used AI in 2024-25; 32% weekly+, 28% monthly or less | Gallup / Walton Family Foundation, *Teaching for Tomorrow: Unlocking Six Weeks a Year With AI*, 24 Jun 2025; n=2,232 US public K-12 teachers, fielded 18 Mar–11 Apr 2025 via RAND American Teacher Panel, ±2.5 pts — http://news.gallup.com/poll/691967/teachers-ai-time-savings.aspx |
| Top AI uses (monthly+) | "preparing to teach" 37%, worksheets/activities 33%, adapting materials for student needs 28% | same |
| Perceived quality gain | 57% on **grading and feedback** … 74% on **administrative work**; across 9 tasks 60–84% said AI cut time, ≤7% said it added time | same |
| Regular hours don't cover the work | **84%** say contracted hours don't cover "grading, lesson planning, paperwork and answering work emails"; of those, 81% cite "simply having too much work" | Pew Research Center, *What's It Like To Be a Teacher in America Today?*, 4 Apr 2024; n=2,531, fielded 17 Oct–14 Nov 2023 — https://www.pewresearch.org/social-trends/2024/04/04/whats-it-like-to-be-a-teacher-in-america-today/ |
| Stress / overwhelm / staffing | 77% frequently stressed, 68% overwhelmed, 70% school understaffed, 52% would not recommend teaching | same |
| Behaviour + wellbeing load | 58% handle behavioural issues **daily**; 28% help students with mental-health challenges daily | same |
| Disengagement | 47% call student disengagement a major problem (58% in high schools) | same |
| Vendor-claimed savings | Class Companion "12 hours/week average time saved creating assignments, giving feedback, and providing 1:1 instruction"; MagicSchool "94% of teachers who use MagicSchool report gaining 7+ hours per week"; Nolej "27 days saved per year"; Twee "over 5 hours saved weekly per teacher"; Brisk "2.2M+ hours saved" | vendor marketing — **treat as unverified**; https://www.classcompanion.com/ , https://www.magicschool.ai/magicschool , https://nolej.io/ , https://twee.com/ , https://www.briskteaching.com/ |

Nepal-specific workload data: **not verified.** NEB (https://neb.gov.np/) publishes the
exam/evaluation directives (e.g. *SEE सञ्चालन, व्यवस्थापन तथा उत्तरपुस्तिका परीक्षण निर्देशिका–२०८२*,
https://neb.gov.np/detail/187; *व्यावहारिक अभ्यास कार्यान्वयन निर्देशिका, २०८३*,
https://neb.gov.np/detail/222) but no teacher time-use statistics. UNICEF Nepal's education
page (https://www.unicef.org/nepal/education) carries pupil-side figures only (97% primary
NER; 770,000 out-of-school 5–12s; ~50% of grade 3/5/8 pupils at benchmark in Nepali and
maths) and **no** pupil–teacher ratio, class size, or workload numbers. OECD TALIS and the
RAND teacher surveys returned HTTP 403 to our fetches, so their figures are cited only
where a reachable source restated them. **Any Nepal workload claim in the product should be
sourced from our own tenant telemetry, not from these.**

The pain-point list our catalog must attack, each tied to evidence above: **grading and
written feedback** (lowest quality-gain score at 57%, so the hardest and most valuable),
**lesson prep** (37% top use), **worksheet/activity production** (33%), **differentiation
and adapting materials** (28%), **paperwork/admin** (74% quality gain — the easiest win),
**parent communication** (inside the 84% "regular hours don't cover it" bucket),
**report-card comments**, **question-paper setting** (Nepal-specific: NEB blueprint +
Nepali medium), **remedial planning** for the ~50% below benchmark, **IEP/SEN
documentation**, and **data entry** into IEMIS.

## 2.2 Competitor tool lists, pricing, and the one idea each does best

**MagicSchool** — the tool-count benchmark. Advertises **80+ teacher tools and 50+ student
tools (~130 total)**; the marketing site names only 12 (worksheet, presentation,
multiple-choice quiz, rubric, academic content, lesson plan; students: Quiz me!, Research
assistant, Character chatbot, AI learning assistant, Writing feedback, Custom chatbot) —
https://www.magicschool.ai/magic-tools. A third-party catalog enumerates 60 by name,
including the ones that reveal the real product surface: *5E Model Science Lesson Plan,
AI-Resistant Assignment Suggestions, Accommodation Suggestion Generator, Assignment
Scaffolder, BIP Suggestion Generator, Behavior Intervention Suggestion Generator, Choice
Board (UDL), Class Newsletter, Clear Directions, Common Misconception Generator, DOK
Questions, Data Table Analysis, Decodable Text, E-mail Family, E-mail Responder, Exemplar
& Non-Exemplar, IEP Generator, Informational Text, Letter of Recommendation, Make it
Relevant!, Math Spiral Review, Math Story Word Problems, Multi-Step Assignment, Multiple
Explanations for Complex Concepts, Professional Email, PBL Generator, Reading Quiz, Report
Card Comments, Restorative Reflection, SAT Reading Practice, Science Lab, Social Stories,
Student Work Feedback, Syllabus Generator, Teacher Observation, Team Builder/Ice Breaker,
Text Analysis Assignment, Text Dependent Questions, Text Leveler, Text Proofreader, Text
Rewriter, Text Scaffolder, Text Summarizer, Text Translator, Thank You Note, 3-D Science
Assessment, Unit Plan, Vocab List, Vocabulary Based Text, YouTube Video Question
Generator, YouTube Video Summarizer* —
https://aitoolsexplorer.com/ai-tools/magicschool-ai-tools-for-teachers/ (**third-party,
unverified against the app**). Pricing: Free $0 (80+ teacher tools, Raina chatbot,
FERPA/COPPA/SOC-2/GDPR, Common Sense Privacy Certified); **Plus $8.33/user/mo billed
annually ($99.96/yr) or $12.99/mo** (unlimited generations + history + Studio Mode editing,
50+ student tools, Student Rooms, Labs); Enterprise custom (DPA, Clever/ClassLink/Canvas/
Schoology + SSO, curriculum alignment, custom tools, tool-management controls, dashboards)
— https://www.magicschool.ai/pricing. **Standout UX:** every tool is a *form with built-in
examples and tips*, plus "Collections" so teachers organize saved tools by subject/grade/
task and share them with colleagues. Also: multi-model routing (OpenAI + Anthropic +
Google, routed per task).

**Brisk Teaching** — distribution as the product: a Chrome/Edge **extension** that works
inside Docs, Slides, YouTube and the LMS rather than a destination site. Feature areas with
their own counts: *Create Content* (30+ tools), *Give Feedback* (5+ ways), *Inspect Writing*
(revision-history replay for authenticity), *Change Level* (50+ languages), *Student
Activities* (14). Named tools: Quiz generator/maker, Presentation maker (builds Google
Slides "from any idea, article, website, or video"), Rubric generator, Batch feedback,
Lesson plan generator, Inquiry Worksheet, Glow & Grow Feedback, Targeted feedback
generator, Next steps feedback, Rubric criteria feedback, Feedback insights, Batch feedback
insights, Brisk Boost. Tiers: **Free $0** (20+ tools, "Standard" models), **Premium
custom** (35+ tools, "Turbo" models, unlimited usage, district standards/rubrics/context in
every output, admin dashboard, admin tool manager, rostering, custom DPA), **Intelligence
custom** (curriculum-grounded: adopted curriculum, pacing, scope & sequence, district
resource library) — https://www.briskteaching.com/plans. **Standout UX:** *Inspect Writing*
— replaying a student's revision history to judge authenticity instead of running a
detector; and *Batch feedback* with class-wide trend summarization.

**Diffit** — "print-ready lessons": input a topic *or* your own material, set **MTSS tier,
challenge level, language, scaffolds, standards, DOK**, get differentiated activities,
station rotations, sub plans, intervention materials and slides; exports stay **editable**
into Google Docs/Slides/Forms/Classroom or Microsoft 365; "Zero student data collected".
Free tier keeps only the **last 90 days** of history; premium is *Diffit for Schools*, a
flat-rate annual subscription **tiered on student enrolment** covering all staff, adding
exports, standards/skills/MTSS/DOK alignment, permanent history, a graphic-organizer
library, admin dashboard and PD — no published figures (https://web.diffit.me/,
https://web.diffit.me/pricing). Survey of 2,517 teachers: 96% "saves me time", 93%
"reaches students where they are". **Standout UX:** one generation → a *set* of
differentiated variants at once, and enrolment-based flat-rate school pricing (very
relevant to Nepal price sensitivity).

**Curipod** — repositioned to teacher-led writing instruction aligned to the district's own
core curriculum (**55+ curricula** incl. CKLA Amplify, Wit & Wisdom, StudySync,
Bluebonnet); loop is **Write → immediate AI feedback → reflect & revise** in the same
period; reports surface a "Top misconception" and students "flagged for follow-up"; **no
student accounts, no chatbots**; claims up to 23 pp gains on state reading/writing tests
(https://curipod.com/ — activity-block types and pricing are **not** on the site;
poll/word-cloud/drawing blocks are historical and **unverified** now). **Standout UX:**
in-period revision loop + "top misconception" as the headline teacher insight.

**Kahoot!** — the clearest published AI/pricing ladder. Plans (USD, per teacher, incl. VAT):
**Go free** · **Bronze $3/mo billed annually ($36/yr)** · **Silver $7 ($84/yr)** ·
**Gold $12 ($144/yr)** · **One $19 ($228/yr)**; player caps 40/50/100/200/800. AI content
generation gated by tier: PDF-to-kahoot + PDF question extractor + **handwritten-note scan**
(3 pages Bronze → 150 pages Silver+), URL converter, trusted sources (Wikipedia), topic-based
creation, quiz/true-false/question-extractor/micro-lesson/vocabulary-review formats; adds
**Presentation format** at Silver, **Practice test + step-by-step solver + slide import &
sync** at Gold, **AI image generation** at One — https://kahoot.com/schools/plans/.
**Standout UX:** metering AI by *pages of source material*, not by generations — a quota
model teachers intuitively understand.

**Formative** — Luna AI builds standards-aligned activities, bell ringers, exit tickets and
quizzes "from prompts, PDFs, or docs"; 20+ tech-enhanced item types; auto-grading +
customizable rubrics + direct student feedback; **real-time live response data**;
translation to 50+ languages; district-only *Luna Next Steps* (follow-ups generated from
performance) and *Luna Configuration Studio* (admin AI guardrails). Pricing: **Classroom
$249/yr per teacher (<100 students)**, **Small School $3,125/yr (≤250 students)**, district
custom — https://www.formative.com/pricing. **Standout UX:** watching student thinking live
and pivoting mid-lesson; admin-configurable AI guardrails as a paid feature.

**Gradescope (Turnitin)** — two tiers only: **Basic (free)** = dynamic rubrics,
question-by-question grading, student/instructor-uploaded PDF, assignment statistics,
regrade requests, CSV export, collaborative grading. **Institutional (quote)** adds
**AI-Powered Grading (answer groups)** and **AI-Powered Roster Matching**, anonymous
grading, bubble sheets, programming/online assignments, advanced + lockable rubrics, code
similarity, LMS/SSO/admin dashboard — https://turnitin.gradescope.com/pricing. Workflow
detail from https://www.gradescope.com/get_started: batch scan upload with automatic
splitting and roster matching, manual **Answer Groups** vs **AI-Assisted Answer Groups**
(auto-group similar answers for one-pass review), per-question analytics with **tagging by
concept/objective/chapter**. **Standout UX:** grade *one answer group*, not one student —
the single most important idea for high-volume Nepali marking.

**Khanmigo** — free for teachers (18+, listed countries); Rubric Generator named
explicitly; Writing Coach as a separate product; capabilities described generically
(differentiation, lesson plans, quiz questions, student groupings, hooks, exit tickets,
rubrics, standards-aligned planning, on-demand summary of recent student work); tutoring
that **withholds answers**; parents can enable up to 10 children; district pricing via
sales. Parent price points ($4/mo, $44/yr) **could not be verified** — the page publishes
no figures (https://www.khanmigo.ai/). **Standout UX:** Socratic refusal-to-answer as a
product guarantee, and "summary of recent student work" as a teacher-facing digest.

**Google (Gemini for Education / Gemini in Classroom)** — Gemini 3 access, image generation
(Nano Banana / Pro), **Deep Research capped at 5/month**, **Gems** (custom AI experts),
Gemini Canvas, Guided Learning, interactive quiz creation; in Classroom: teacher-led
student experiences anchored to class materials, content creation "across **30+ use
cases**", **Slides decks generated by grade and topic**, podcast-style audio lessons
(coming soon), suggested feedback for writing (coming soon), rubric generation/conversion
during assignment creation (coming soon), story generation with **Read Along**. Editions:
**Fundamentals no-cost** for qualifying institutions (includes Gemini for Education,
Gemini Notebook, Gemini in Classroom); **Education Plus $6.00/user/yr** as shown, adding
Gemini in Docs/Sheets/Slides/Vids/Forms and higher limits; **Google AI Pro for Education**
as an add-on — https://edu.google.com/intl/en_us/workspace-for-education/editions/compare-editions/.
"Your data is not reviewed by anyone or used to train AI models." **Standout UX:**
**Gems** — user-defined mini-agents grounded in class materials, i.e. teacher-authored
tools; and deck generation keyed to *grade + topic*.

**Microsoft** — the education Copilot page names Microsoft 365 Copilot, **Copilot Studio**
(build agents), **Agent Factory**, Foundry, Microsoft IQ, Fabric, and *Learning
Accelerators* as an umbrella (only **Reading Progress** appears, inside a testimonial); no
licensing or pricing is published there —
https://www.microsoft.com/en-us/education/products/copilot. The specific accelerators
(Reading Coach, Search Coach/Progress, Speaker Coach/Progress, Math Progress) are **not
verified** from that page. **Standout UX:** *Copilot Studio / Agent Factory* — the district
builds its own agents; the vendor ships the factory.

**Twee** — language-teaching specialist: CEFR A1–C2 across 10 languages, "**over 40 tools
for every language skill**", generate from a topic, link, or **word list**. Named tools:
Create a Text on Any Topic with Your Vocabulary; Create a Dialogue; Create Open Questions
for a Text; Find Discussion Questions; Lead-in Activities for a Text; Create a List of Pros
and Cons; Find Interesting Facts; Find Quotes by Famous People; Word-Definition Matching;
Word-Translation Matching; Essential Vocabulary on a Topic; Fill in the Gap. Exports to
PDF/Word, Google Forms/Docs, or interactive assignments by link; **AI grading of MCQ,
gap-fill and written answers**; students can work anonymously. Pricing not published beyond
"Try Pro for $0" — https://twee.com/. **Standout UX:** *generate from the teacher's own
vocabulary list* — the content is pinned to the words the class is actually learning.
Directly portable to Nepali/English word lists.

**Eduaide.ai** — 403/429 on every fetch attempt (https://www.eduaide.ai/,
https://eduaide.ai/); its tool count, tool names and pricing are **unverified**. Known
positioning from the product's own naming conventions elsewhere (Resource Generator /
Teaching Assistant / Feedback Bot / Assessment Builder) is **not confirmed** here.

**Teachology.ai** — Plan Lessons (exportable, pedagogy-aware, quiz generation, enrichment
from external resources) · Build Rich Assessments (with full marking rubric) · Design Units
of Work (outcome-aligned, interdisciplinary, adjustable scope/length) · Give Feedback
(report comments + reflections matched to expectations, personalised per learner) ·
**Standards & Outcomes First** (Common Core, Arizona, California, TEKS, Florida BEST,
Australian Curriculum V9, VIC/NSW/WA syllabi, AU early-years framework) · upload your own
PDF/Word/PPT/text/JSON/CSV so the AI **cites it**, uploads private by default; no pricing
published — https://teachology.ai/. **Standout UX:** standards/outcomes chosen *first*, so
every artifact is generated against a jurisdiction — the exact shape of NEB/CDC grounding.

**LessonUp** — interactive lesson builder: quizzes, polls, word clouds, open questions,
hotspots, spinners, video, mind maps, fill-in-the-blanks, random name picker, live lesson
progress, lesson reports; **PowerPoint import with added interactivity**; shared teacher
lesson library with museum/partner channels; AI assistant ("Maia") for lessons, rubrics,
assignments, quizzes, images plus one-click summarize/translate/glossary; LMS integrations
(Canvas, Google Classroom, Teams, itslearning); 200,000+ teachers / 3,000 schools; pricing
not on the page — https://www.lessonup.com/en/. **Standout UX:** import the deck the
teacher already has, then make it interactive — zero-migration adoption.

**Nolej AI** — upload up to 4+ resources (videos, PDFs, more; multilingual) → set learning
goals, themes, difficulty → **15+ ready-to-use activities**: quizzes, games, interactive
videos, chatbots, courses, lesson plans/modules from templates, plus accessibility variants
(FALC + Dys add-on). Exports **SCORM, PDF, H5P, Excel, AIKEN** and a Moodle plugin;
170K+ users; "27 days saved per year"; no published pricing — https://nolej.io/.
**Standout UX:** one upload → a *bundle* of interoperable activities in standards-based
export formats (our QTI export is the same instinct).

**Class Companion** — student-facing practice with instant AI feedback + optional AI tutor
governed by teacher instructions; content library incl. rubrics and standardized-test prep
(CAASPP, STAAR, AP); insights on strengths/growth/engagement; **accommodations per student**
(reading level, translation, text-to-speech); **response integrity** (copy/paste, tab-leave,
typing anomalies, similar responses); LMS sync (Canvas, Schoology, Google Classroom) on
School/District plans; 25,000+ schools; "12 hours/week saved" (vendor) —
https://www.classcompanion.com/. **Standout UX:** *unlimited retakes* as the pedagogy, and
integrity signals from behaviour rather than an AI-text detector.

**Gamma / Tome (deck generation)** — Gamma returned HTTP 403 on every endpoint we tried
(`gamma.app/pricing`, `/en/pricing`, `/ai-powerpoint`, help centre). Its tiers, credit
allowances and export matrix are therefore **unverified**. Tome's current education
positioning is likewise **unverified**. What is established from adjacent sources: the
market expectation is *prompt → outline → themed deck → PPTX/PDF export*, and Google now
ships "Slides decks generated by grade and topic" inside Classroom (cited above), so
deck generation is table stakes.

**Canva Magic Studio / Canva for Education** — every Canva URL we tried returned 403
(`/magic/`, `/magic-studio/`, `/education/`, `/en_in/education/`, `/help/magic-studio-overview/`).
Feature names (Magic Write, Magic Media, Magic Design, Magic Switch, Magic Grab, Magic
Expand, Magic Eraser, Magic Edit, Magic Animate, Translate, Highlights, Beat Sync) and
free-for-verified-teachers eligibility are **unverified from primary source** in this pass.

**Quizizz / Wayground** — the rebrand broke our fetches (`wayground.com/pricing` 404,
`quizizz.com/pricing` → 301 to the 404). AI feature names and prices **unverified**.

**Edexia** — `edexia.ai` 404, `edexia.app` DNS failure. Its "AI that learns your marking
style" claim is **unverified** in this pass; the concept (calibrate a grader on a teacher's
own past marking, then have it mark in that voice) is nonetheless the single most
differentiating grading idea in the market and is carried into the catalog as
`grader_calibration`.

### Nepal / India players

**Veda (inGrails)** — market leader, 1,300+ institutions, extremely broad admin surface
(process automation, billing/IRD, results with **custom per-school result print design**,
ID cards + certificate generation, SPA/CAS teacher remarks) and **no AI features shipped
publicly**; pricing not published (audited in
`/home/bishal-regmi/Desktop/ASchool/audits/research/COMPETITOR_LANDSCAPE_NEPAL.md`;
https://veda-app.com/features).
**Paathshala** — "100% निशुल्क" software+hardware, monetized on **Smart RFID student ID
cards**; strong on biometric/RFID/GPS/EMIS reporting; **no AI features advertised**
(https://paathshala.com.np/).
**e-School (eZone)** — the only Nepali player with published per-student pricing (Rs 0
lifetime-free → Rs 10 → Rs 20 → Rs 40 per student/month); modules confirm gradebook,
rubrics, course plan, routine, assignments, **no AI advertised anywhere**
(https://eschool.ezone.com.np/).
**Mero School** — consumer learning (Rs 999/30 days), competes for the student wallet, not
the school back office.
**Teachmint (India, serving Nepal)** — the only regional player with a named AI stack:
**EduAI** = *Ask Anything* (mid-class explanations), **AI Whiteboards** ("curriculum-aligned
lessons tailored to your class — no planning required"), **Homework Generator**, **Quiz
Generator**, **Class Recap** (auto summary + follow-up quiz), **Voice Assistant** (hands-free
board control), AI pens / 3D tools / **OCR Solver**, **90+ languages**; delivered on
hardware (Teachmint X interactive panel, 4K AI camera, NPU, EDLA-certified) with LAN-only
"zero cloud dependency" operation; sales-led, no published pricing —
http://www.teachmint.com/en-np. **Standout UX:** *Class Recap* — the lesson that just
happened becomes the homework and the quiz automatically. And offline/LAN operation, which
matters enormously for Nepali connectivity.

### The strategic read

1. Nobody in Nepal ships AI teaching tools. Veda, Paathshala and e-School have zero. Our
   only regional AI competitor is Teachmint, and it is **hardware-gated** and
   **English/Hindi-first**.
2. The Western leaders are **content generators without a school system underneath** —
   MagicSchool, Brisk, Diffit and Curipod have no marks ledger, no attendance, no fee
   records, no report cards. ASchool has all of it. That is our irreducible advantage:
   tools grounded in *this student's actual marks and attendance*, not in pasted text.
3. Deck generation, curriculum grounding, and batch/whole-class grading are the three
   capabilities everyone is racing on. We have curriculum grounding partly built
   (`context_curriculum`), no deck engine, and no batch grading UX.
4. Pricing convention: free tier with usage caps, ~$8–13/teacher/month for individuals,
   enrolment-based flat rate for schools. Our `ai_suite` at **NPR 399/month, NPR 3,990/year
   per school** (from `app/plugins/modules/ai_suite/manifest.yaml`) is an order of
   magnitude below Western per-teacher pricing — the catalog must be priced by cost tier,
   which is why every tool below carries one.

---

# PART 3 — THE ASCHOOL AI TOOL CATALOG

**153 tools across 13 groups.** Bigger than MagicSchool's named surface and, unlike every
competitor, anchored to a live SIS: marks, attendance, fees, timetable, IEMIS, BS calendar.

## 3.0 Reading the catalog

**Persona** — T teacher · S student · P parent/guardian · A admin (school_admin/superadmin)
· C counselor · H HR/head-teacher.

**Result template** (the frontend renderer that draws the JSON; the four marked NEW must be
built once and then serve dozens of tools):

| Template | Shape it renders | Status |
|---|---|---|
| `plan_card` | title + objectives[] + phases[{name,duration,activities[]}] + assessment | exists (lesson_plan) |
| `qa_list` | items[{question, marks, question_type, answer?}] with mark total | exists (worksheet) |
| `text_block` | subject + body prose, copy/insert actions | exists (parent_email) |
| `rubric_grid` | criteria[{name,max_marks,descriptors,levels[]}] as a matrix | exists (rubric) |
| `tiered_panel` | tiers[{tier,strategy,activities[]}] side by side | exists (differentiation) |
| `flashcard_deck` | cards[{front,back}] flip UI | exists (flashcards) |
| `feedback_panel` | strengths[] / improvements[] / next_steps[] / encouragement | exists (writing_feedback) |
| `section_list` | sections[{heading,points[]}] + practice_questions[] | exists (study_guide) |
| `insight_cards` | metric cards + narrative + drill-down links | exists (school_insights) |
| `board_stream` | streamed whiteboard directives + narration (ARIA) | exists (tutor) |
| `table_grid` | **NEW** headers[] + rows[][] + totals, inline-editable, → writer table block | NEW |
| `slide_deck` | **NEW** slides[{type,…}] thumbnail rail + editor + present mode | NEW |
| `chart_panel` | **NEW** series/labels + chart type + caption (Recharts on screen, SVG in PDF) | NEW |
| `checklist` | **NEW** items[{label,done,owner,due_bs}] task list, exportable | NEW |

**Curric.** — Y = needs NEB/CDC curriculum grounding via `context_curriculum`
(`tool_handlers.py`), so the tool must not run without a `CurriculumFramework` match; y =
optional grounding improves output; – = none.

**Doc** — which existing engine renders the printable artifact (see Part 4):
`writer` = `writer_json.blocks` → `TemplateEngineService._render_writer_html` → WeasyPrint
PDF / `writer_docx.py` DOCX · `canvas` = fabric multi-page JSON →
`designer/document_renderer.py` → WeasyPrint · `report` = `app/utils/report_pdf.py`
letterhead+BS-date PDF · `bulk` = `designer/bulk_generator.py` per-student loop ·
`deck` = **new** slide engine · `xlsx` = openpyxl (already a dependency) · `–` = screen only.

**Cost** — 0 deterministic (no model call) · 1 fast model, short · 2 smart model, ≤1.5k out
· 3 smart, long or two-pass · 4 per-item batch, vision or audio.

**Status** — `IMPL` shipped and wired · `PART` partially built (service exists, or route
exists without registry/schema/prompt) · `NEW`.
Evidence for IMPL/PART: `backend/app/services/ai/workbench_seed.py` (10 registry rows),
`tool_schemas.py` (10 schemas), `tool_handlers.py` (3 handlers + 1 context builder),
`app/prompts/*_{en,ne}.md` (20 files), `app/api/v1/ai_tools.py`, `ai_workbench.py`,
`ai_tutor.py`, `ai_capture.py`, `ai_extensions.py`, `design_studio.py`,
`app/services/ai/*.py` (30 modules — note `plagiarism`, `benchmarking_ai`, `fee_predictor`,
`risk_detector`, `wellbeing_ai`, `content_gen`, `attendance_ai`, `sentiment`, `social_ai`,
`translator`, `report_remarks`, `rag`, `curriculum_seed` have **no route referencing them**
— they are written but unmounted, hence `PART`).

## 3.1 Group A — Planning (14)

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `lesson_plan` | Lesson Plan Generator / पाठ योजना | T | NEB-aligned plan: objectives, phased activities, assessment, materials | subject_code, grade, topic, minutes | `plan_card` | Y | writer | 2 | P0 | IMPL |
| `unit_plan` | Unit / Chapter Plan / एकाइ योजना | T | 2–6 week unit: outcome map, lesson sequence, assessment plan, resources | subject, grade, unit, weeks | `plan_card`+`table_grid` | Y | writer | 3 | P0 | NEW |
| `annual_scheme` | Annual Scheme of Work / वार्षिक शिक्षण योजना | T,A | Full-year pacing across BS months, holidays and exam windows | subject, grade, BS year, calendar | `table_grid` | Y | xlsx+writer | 3 | P0 | NEW |
| `weekly_planner` | Weekly Lesson Planner / साप्ताहिक योजना | T | Reads the teacher's real timetable, drafts one plan row per period | teacher_id, week (BS) | `table_grid` | Y | writer | 3 | P1 | NEW |
| `substitute_plan` | Substitute / Cover Plan / प्रतिस्थापन योजना | T,A | Self-contained plan a non-specialist can teach tomorrow | class, subject, topic, date | `plan_card` | y | writer | 2 | P0 | NEW |
| `differentiation` | Differentiation Engine / बहुस्तरीय शिक्षण | T | Three-tier activities for a mixed-ability class | topic, grade, tiers | `tiered_panel` | – | writer | 2 | P0 | IMPL |
| `study_guide` | Study Guide Generator / अध्ययन गाइड | T,S | Exam-prep guide with practice questions | subject, grade, units | `section_list` | Y | writer | 2 | P0 | IMPL |
| `worksheet` | Worksheet Generator / अभ्यास पत्र | T | Practice worksheet with mark allocation (handler sums marks) | topic, grade, count, types | `qa_list` | Y | writer | 2 | P0 | IMPL |
| `lesson_hook` | Lesson Hook / Starter / पाठ आरम्भ | T | 3 attention-grabbing openers tied to Nepali daily life | topic, grade | `text_block` | y | – | 1 | P1 | NEW |
| `objective_writer` | Learning Objectives (Bloom) / सिकाइ उपलब्धि | T | Converts a topic into measurable Bloom-verbed objectives mapped to CDC outcomes | topic, grade, level | `section_list` | Y | – | 1 | P0 | NEW |
| `resource_finder` | Resource & Material List / सामग्री सूची | T | Low-cost/no-cost material list for the activity, priced in NPR | activity, class size | `checklist` | – | writer | 1 | P1 | NEW |
| `pbl_designer` | Project-Based Learning Designer / परियोजना कार्य | T | Multi-week project: driving question, milestones, rubric, community link | subject, grade, theme | `plan_card`+`rubric_grid` | y | writer | 3 | P1 | NEW |
| `field_trip_plan` | Field Trip / Excursion Plan / भ्रमण योजना | T,A | Learning objectives, itinerary, consent letter, risk assessment, costing | destination, grade, date | `plan_card`+`checklist` | – | writer+report | 3 | P2 | NEW |
| `cocurric_plan` | Co-curricular / Club Plan / अतिरिक्त क्रियाकलाप | T,A | Term plan for a club or house activity with sessions and outcomes | club, term, sessions | `plan_card` | – | writer | 2 | P2 | NEW |

## 3.2 Group B — Delivery / in-class teaching (12)

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `slide_deck` | Lesson Slide Deck / पाठ स्लाइड | T | Turns a lesson plan or topic into a projector deck (typed slides, Nepali-safe fonts) | lesson_plan_id or topic, slide count | `slide_deck` | Y | **deck** | 3 | P0 | NEW |
| `deck_from_doc` | Deck from Existing Material / सामग्रीबाट स्लाइड | T | Pasted notes / uploaded PDF / a saved writer doc → deck, preserving the teacher's own words | doc_id or file, style | `slide_deck` | – | **deck** | 3 | P0 | NEW |
| `handout_from_deck` | Handout from Deck / स्लाइडबाट हस्तपुस्तिका | T | Same content, printable notes layout (dual-mode, the `present` skill idea) | deck_id, density | `table_grid` | – | writer | 2 | P1 | NEW |
| `board_plan` | Blackboard Layout Plan / कालोपाटी योजना | T | What to write where, in order, for a chalk-only classroom | topic, board size | `section_list` | – | writer | 1 | P1 | NEW |
| `explainer_script` | Concept Explainer Script / व्याख्या स्क्रिप्ट | T | Teacher-voice script with analogies drawn from Nepali context, 3 difficulty passes | concept, grade | `text_block` | y | writer | 2 | P1 | NEW |
| `misconception_map` | Common Misconceptions / सामान्य भ्रम | T | Likely wrong ideas for the topic + the diagnostic question that exposes each | topic, grade | `table_grid` | Y | writer | 2 | P0 | NEW |
| `questioning_ladder` | Questioning Ladder (DOK) / प्रश्न सिँढी | T | Graduated question set from recall → transfer for cold-calling | topic, grade | `qa_list` | y | writer | 2 | P1 | NEW |
| `live_poll` | Live Poll / Quiz / तत्कालै मतदान | T,S | Ephemeral in-class poll; aggregate-only analytics, deliberately not a stored artifact | question, options | `chart_panel` | – | – | 0 | P1 | PART (`ai/extensions.py LivePoll`, in-memory) |
| `group_maker` | Group / Pair Maker / समूह निर्माण | T | Balanced groups from real marks + attendance + a mixing rule | class_id, group size, strategy | `table_grid` | – | – | 0 | P0 | NEW |
| `seating_plan` | Seating Plan / बसाइ योजना | T | Seat map honouring vision/hearing needs, behaviour pairs and group work | class_id, room shape | `table_grid` | – | canvas | 1 | P2 | NEW |
| `timer_routine` | Lesson Routine & Timing / समय तालिका | T | Minute-by-minute run sheet with transition cues for a 45-min period | plan_id | `checklist` | – | – | 0 | P2 | NEW |
| `ai_teacher_board` | AI Teacher (ARIA) Whiteboard / एआई शिक्षक | S,T | Live persona tutor that speaks while hand-writing and drawing on a canvas, interruptible | topic or notes, persona | `board_stream` | y | – | 4 | P0 | PART (`ai_tutor.py` + `tutor_engine.py`; board grammar specced in `ATEACHER_INTEGRATION_BLUEPRINT.md`) |

## 3.3 Group C — Assessment authoring (14)

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `question_paper` | Question Paper Generator / प्रश्नपत्र | T,A | NEB-format paper: sections, marks distribution, time, instructions | subject, grade, marks, blueprint | `qa_list` | Y | writer | 3 | P0 | IMPL (`ai_tools.py /question-paper`, `question_paper.py`) |
| `question_paper_v2` | Paper from Question Bank / बैंकबाट प्रश्नपत्र | T,A | Blueprint-driven selection from the stored bank + gap-filling generation | blueprint, bank filters | `qa_list` | Y | writer | 3 | P0 | IMPL (`question_paper_v2.py`, `/question-paper/v2`) |
| `question_bank` | Question Bank Curator / प्रश्न बैंक | T,A | Tag, dedupe, difficulty-rate and store items for reuse; QTI 3.0 export | items, tags | `table_grid` | Y | xlsx | 1 | P0 | IMPL (`/question-bank` CRUD + `qti_export`) |
| `blueprint_builder` | Exam Blueprint / परीक्षा ढाँचा | T,A | Builds the marks × unit × cognitive-level grid before any question is written | subject, grade, total marks | `table_grid` | Y | xlsx+writer | 2 | P0 | NEW |
| `answer_key` | Answer Key & Marking Scheme / उत्तर कुञ्जी | T | Step-marked model answers with partial-credit rules for an existing paper | paper_id | `qa_list` | Y | writer | 3 | P0 | NEW |
| `exit_ticket` | Exit Ticket / एक्जिट टिकट | T | 3-question end-of-class comprehension check | topic | `qa_list` | – | writer | 1 | P0 | IMPL |
| `rubric` | Rubric Builder / मूल्यांकन मापदण्ड | T | Criteria + descriptors matrix; exports as a reusable preset | task, criteria count, max marks | `rubric_grid` | – | writer | 2 | P0 | IMPL (status beta) |
| `mcq_generator` | MCQ Set with Distractors / बहुवैकल्पिक प्रश्न | T | MCQs whose wrong options encode real misconceptions, not filler | topic, count, grade | `qa_list` | Y | writer | 2 | P0 | NEW |
| `practical_exam` | Practical / Lab Assessment / प्रयोगात्मक परीक्षा | T | Practical task, apparatus list, observation sheet, 25% internal marks split | subject, grade, experiment | `qa_list`+`table_grid` | Y | writer | 2 | P0 | NEW |
| `oral_viva` | Oral / Viva Question Set / मौखिक परीक्षा | T | Graduated viva questions with expected-answer cues and a score sheet | subject, grade, topic | `qa_list` | y | writer | 2 | P1 | NEW |
| `formative_probe` | Diagnostic Pre-test / निदानात्मक परीक्षण | T | Short pre-test that locates prerequisite gaps before teaching the unit | unit, grade | `qa_list` | Y | writer | 2 | P1 | NEW |
| `project_brief` | Project / Assignment Brief / परियोजना निर्देशन | T | Task brief with deliverables, timeline, rubric link and integrity expectations | subject, grade, topic, weeks | `text_block`+`rubric_grid` | y | writer | 2 | P1 | NEW |
| `ai_resistant_task` | AI-Resistant Task Redesign / एआई-प्रतिरोधी कार्य | T | Rewrites an assignment so an LLM alone cannot complete it (local data, process evidence, in-class defence) | existing task text | `text_block` | – | writer | 2 | P1 | NEW |
| `paper_moderation` | Paper Moderation Check / प्रश्नपत्र जाँच | T,A | Deterministic + judge audit of a drafted paper: marks sum, blueprint coverage, duplicate stems, reading level, ambiguity | paper_id | `checklist` | Y | report | 3 | P1 | NEW |

## 3.4 Group D — Grading & feedback (12)

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `auto_grader` | Auto-Grader (objective) / स्वतः जाँच | T | Grades submitted objective/short answers against the key, flags borderline for review | submission_ids | `table_grid` | – | – | 4 | P0 | IMPL (`auto_grader.py` via `assignments.py`) |
| `writing_feedback` | Writing Feedback Coach / लेखन सुझाव | T | Strengths / improvements / next steps — schema deliberately has **no** `revised_text` | writing sample | `feedback_panel` | – | writer | 2 | P0 | IMPL |
| `rubric_grader` | Rubric-Based Marking / मापदण्ड अनुसार अंक | T | Scores against a saved rubric criterion-by-criterion with a quoted justification per criterion | submission, rubric_id | `rubric_grid` | – | writer | 3 | P0 | NEW |
| `batch_feedback` | Batch Feedback (whole class) / सामूहिक सुझाव | T | One pass over every submission; per-student comment + class-wide trend summary | assignment_id | `table_grid`+`insight_cards` | – | writer | 4 | P0 | NEW |
| `answer_grouper` | Answer Grouping / समान उत्तर समूह | T | Clusters identical/near-identical answers so the teacher marks a group once (the Gradescope idea) | question_id | `table_grid` | – | – | 4 | P0 | NEW |
| `grader_calibration` | Marking-Style Calibration / अंकन शैली मिलान | T | Learns from ~20 of the teacher's own already-marked scripts, then marks in that style; reports drift vs the teacher | past marked pairs | `insight_cards` | – | report | 4 | P1 | NEW |
| `handwriting_ocr` | Handwritten Script Reader / हस्तलिखित उत्तर पठन | T | Vision pass over photographed answer sheets (Devanagari + English) into text for marking | page images | `qa_list` | – | – | 4 | P1 | NEW |
| `remark_writer` | Report Card Remarks / प्रगति टिप्पणी | T | Per-student remark from real marks + attendance, in EN or NE, three tone presets | student_id, term | `text_block` | – | bulk | 1 | P0 | PART (`/remarks` route delegates to `QuestionPaperService.generate_remark`; `report_remarks.py` exists **unmounted**; no registry row/schema) |
| `remark_sheet` | Whole-Class Remark Sheet / कक्षा टिप्पणी पत्र | T | Every student's remark in one editable sheet, then pushed into report cards | class_id, term | `table_grid` | – | bulk+xlsx | 4 | P0 | NEW |
| `feedback_translator` | Feedback in Nepali / सुझाव नेपालीमा | T,P | Re-renders any feedback artifact in Nepali at a parent-readable register | source generation_id | `text_block` | – | writer | 1 | P0 | PART (`translator.py` exists, unmounted) |
| `integrity_check` | Academic Integrity Signals / मौलिकता संकेत | T | Behavioural + textual signals (paste bursts, style shift, near-duplicate peers) with **no verdict**, only evidence | submission_id | `insight_cards` | – | report | 3 | P1 | PART (`plagiarism.py` exists, unmounted) |
| `progress_conference` | Mark-to-Conversation Notes / अभिभावक भेट टिप्पणी | T | Turns a term's marks into 5 talking points + 2 asks for the parent meeting | student_id, term | `checklist` | – | writer | 2 | P1 | NEW |

## 3.5 Group E — Differentiation & SEN/inclusion (13)

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `text_leveler` | Reading-Level Adapter / पठन स्तर मिलान | T | Rewrites a passage up/down 3 grade levels, keeping key vocabulary | text, target grade | `text_block` | – | writer | 2 | P0 | NEW |
| `text_scaffolder` | Text Scaffolder / पाठ सहायता | T | Adds margin glossary, chunk headings, guiding questions to a hard text | text, grade | `section_list` | – | writer | 2 | P0 | NEW |
| `vocab_support` | Vocabulary Support Set / शब्दावली सहायता | T | Word list with NE gloss, picture cue prompt and a sentence frame per term | text or word list | `flashcard_deck` | y | writer | 1 | P0 | NEW |
| `iep_draft` | IEP Draft / व्यक्तिगत शिक्षा योजना | T,C | Draft individualized plan: present level, SMART goals, accommodations, review dates — **requires human review before finalize** | student_id, needs | `plan_card`+`table_grid` | – | writer | 3 | P0 | PART (`ai_workbench.py draft_iep` / `review_iep` / `list_ieps` + `_can_review_iep` exist; **no registry row/schema/prompt**) |
| `iep_progress` | IEP Progress Review / योजना प्रगति समीक्षा | T,C | Goal-by-goal progress statement from evidence collected since the last review | plan_id | `table_grid` | – | writer | 2 | P1 | NEW |
| `accommodation_finder` | Accommodation Suggestions / सहायता उपायहरू | T,C | Concrete classroom accommodations for a named difficulty, no diagnosis language | need description, grade | `checklist` | – | writer | 2 | P0 | NEW |
| `behaviour_plan` | Behaviour Support Plan / व्यवहार सहयोग योजना | T,C | Antecedent–behaviour–consequence analysis with a positive replacement strategy | incidents, student_id | `plan_card` | – | writer | 3 | P1 | NEW |
| `social_story` | Social Story / सामाजिक कथा | T,C | First-person story preparing a child for a specific situation | situation, age | `text_block` | – | writer | 1 | P2 | NEW |
| `remedial_plan` | Remedial / Catch-up Plan / उपचारात्मक योजना | T | 2–4 week plan for students below the benchmark, built from their actual weak items | class_id, threshold | `plan_card`+`table_grid` | Y | writer | 3 | P0 | NEW |
| `enrichment_plan` | Enrichment / Extension Plan / विस्तार योजना | T | Depth tasks for fast finishers instead of more of the same | topic, grade | `tiered_panel` | y | writer | 2 | P1 | NEW |
| `multilingual_support` | Mother-Tongue Bridge / मातृभाषा सहयोग | T | Key-term bridge for Maithili/Bhojpuri/Newar/Tamang-speaking learners (**language coverage to be validated per model**) | text, mother tongue | `table_grid` | – | writer | 2 | P1 | NEW |
| `udl_choice_board` | Choice Board (UDL) / विकल्प तालिका | T | 3×3 board of equivalent-outcome tasks across modalities | topic, grade | `table_grid` | y | writer | 2 | P1 | NEW |
| `adaptive_path` | Adaptive Learning Path / अनुकूल सिकाइ मार्ग | S,T | Next-best-activity sequencing from mastery evidence | student_id, subject | `checklist` | y | – | 2 | P1 | IMPL (`adaptive_learning.py` + `api/v1/adaptive_learning.py` + `ai_adaptive_learning` plugin) |

## 3.6 Group F — Communication: parents, guardians, staff (14)

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `parent_email` | Parent Email Drafter / अभिभावक इमेल | T,A | Warm, professional parent email in EN or NE; names pseudonymized during generation | notes, tone, language | `text_block` | – | – | 1 | P0 | IMPL |
| `parent_sms` | Parent SMS / Push (160 chars) / अभिभावक सन्देश | T,A | Compresses a message to one SMS segment, Nepali transliteration aware | message, language | `text_block` | – | – | 1 | P0 | NEW |
| `parent_letter` | Formal Parent Letter / औपचारिक पत्र | T,A | Letterhead letter (fee reminder, absence concern, invitation) with BS + AD dates | type, student_id, context | `text_block` | – | report+writer | 2 | P0 | PART (`/letter-writer` route exists; no registry row/schema/prompt) |
| `difficult_conversation` | Sensitive Message Coach / संवेदनशील सन्देश | T,C | Rewrites a blunt draft into a de-escalating one and flags what not to say in writing | draft text | `feedback_panel` | – | – | 2 | P0 | NEW |
| `email_responder` | Reply Drafter / जवाफ मस्यौदा | T,A | Drafts a reply to an inbound parent message with 3 tone options | inbound text | `text_block` | – | – | 1 | P0 | NEW |
| `class_newsletter` | Class Newsletter / कक्षा समाचारपत्र | T | Monthly newsletter from real events, achievements and upcoming dates | class_id, month (BS) | `section_list` | – | canvas+writer | 2 | P1 | NEW |
| `school_notice` | Notice / Circular Writer / सूचना तथा परिपत्र | A | Formal notice in the Nepali register, letterhead-ready, with a BS date line | subject, audience, context | `text_block` | – | writer+canvas | 1 | P0 | PART (writer notice/circular templates exist in `template_engine.py`; no AI registry tool) |
| `event_invite` | Event Invitation / निमन्त्रणा | A,T | Invitation copy + a matching canvas design for print and WhatsApp | event, date, audience | `text_block` | – | canvas | 2 | P1 | NEW |
| `meeting_agenda` | Staff Meeting Agenda / बैठक कार्यसूची | A,H | Agenda with time boxes from open action items and the term calendar | topic, attendees, minutes | `checklist` | – | writer | 1 | P1 | NEW |
| `meeting_minutes` | Minutes & Action Items / बैठक निर्णय | A,H | Notes or a transcript → decisions, owners, deadlines (BS dates) | notes/transcript | `checklist` | – | writer | 2 | P1 | NEW |
| `parent_faq` | Parent FAQ Answerer / अभिभावक प्रश्नोत्तर | P,A | Answers a guardian question from school policy documents only, with citations | question | `text_block` | – | – | 2 | P1 | PART (`rag.py` policy chunks exist, unmounted; `faqs.py` is non-AI) |
| `translation_bridge` | EN⇄NE Document Translator / अनुवाद | T,A,P | Translates any generated artifact, preserving structure and mark totals | generation_id, target lang | same as source | – | writer | 2 | P0 | PART (`translator.py`, unmounted) |
| `whatsapp_broadcast` | WhatsApp Broadcast Copy / ह्वाट्सएप सन्देश | A | Segment-aware broadcast copy with an opt-out line and a per-audience variant | audience, message | `text_block` | – | – | 1 | P2 | PART (`whatsapp_bot.py` transport exists; no AI drafting tool) |
| `emergency_notice` | Emergency Notice / आपतकालीन सूचना | A | Fast, calm multi-channel notice (SMS + push + notice board) for closure, disaster, health event | event type, details | `text_block` | – | report | 1 | P0 | PART (`services/emergency/` exists; no AI drafting) |

## 3.7 Group G — Reporting & analytics (13)

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `school_insights` | Weekly School Insights / साप्ताहिक अन्तर्दृष्टि | A,H | Cross-module weekly digest: attendance, marks, fees, incidents | school_id, week | `insight_cards` | – | report | 3 | P0 | IMPL (`school_insights.py`, `/insights/weekly`, `tasks/ai_insights_weekly.py`) |
| `daily_brief` | Head Teacher Daily Brief / दैनिक विवरण | A,H | One-screen morning brief: absences, staff cover, dues, today's events | school_id, date | `insight_cards` | – | report | 2 | P0 | IMPL (`/insights/daily-brief`) |
| `risk_alerts` | At-Risk Student Alerts / जोखिममा विद्यार्थी | A,C,T | Flags dropout/failure risk from attendance + marks + fee trend, with the reason | school_id | `table_grid` | – | report | 2 | P0 | IMPL (`/insights/risk-alerts`; `risk_detector.py` unmounted variant) |
| `class_performance` | Class Performance Narrative / कक्षा विश्लेषण | T,A | Explains a class's result distribution and names the 3 highest-leverage actions | class_id, exam_id | `insight_cards`+`chart_panel` | – | report | 2 | P0 | NEW |
| `item_analysis` | Question-Level Item Analysis / प्रश्न विश्लेषण | T,A | Difficulty + discrimination per question; flags items to retire | exam_id | `table_grid`+`chart_panel` | – | report+xlsx | 1 | P0 | NEW |
| `cohort_trend` | Cohort Trend Report / समूह प्रवृत्ति | A | Multi-term trajectory per grade/subject with a plain-language causal caution | grade, terms | `chart_panel` | – | report | 2 | P1 | NEW |
| `attendance_insight` | Attendance Pattern Insight / उपस्थिति विश्लेषण | A,T,C | Chronic-absence detection, day-of-week and seasonal (festival) patterns | class_id, range | `chart_panel` | – | report | 2 | P0 | PART (`attendance_ai.py`, unmounted) |
| `fee_forecast` | Fee Collection Forecast / शुल्क अनुमान | A | Projects collection and flags likely defaulters with a suggested approach | school_id, month | `chart_panel` | – | report | 2 | P1 | PART (`fee_predictor.py`, unmounted) |
| `benchmark_report` | Peer Benchmark Report / तुलनात्मक प्रतिवेदन | A | Compares this school against anonymized peers on a few honest metrics | school_id, metrics | `insight_cards` | – | report | 2 | P1 | PART (`benchmarking_ai.py` + `api/v1/benchmarking.py`; not in AI registry) |
| `board_report` | Board / SMC Report / व्यवस्थापन समिति प्रतिवेदन | A,H | Termly governance report: enrolment, results, finance, staffing, risks | school_id, term | `section_list`+`chart_panel` | – | report | 3 | P1 | NEW |
| `iemis_readiness` | IEMIS Submission Readiness / IEMIS तयारी | A | Audits records against IEMIS field requirements and lists exactly what to fix | school_id, cycle | `checklist` | – | report+xlsx | 1 | P0 | PART (`models/iemis.py`, `iemis_importer` plugin, `iemis_templates/` exist; no AI audit tool) |
| `donor_report` | Donor / Grant Report / अनुदान प्रतिवेदन | A | Narrative + evidence pack against grant indicators | grant, period | `section_list` | – | report | 3 | P2 | NEW |
| `sentiment_pulse` | Feedback Sentiment Pulse / प्रतिक्रिया विश्लेषण | A,H | Themes and sentiment from parent/student survey free text | survey_id | `insight_cards` | – | report | 2 | P2 | PART (`sentiment.py`, unmounted) |

## 3.8 Group H — Professional development & HR (11)

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `pd_coach` | PD Coach (UNESCO framework) / व्यावसायिक विकास | T,H | Self-assessment against the 6-strand UNESCO ICT-CFT and a next-step plan | teacher_id, self-ratings | `checklist` | – | report | 2 | P1 | PART (`ai/extensions.py seed_pd_framework` + `teacher_pd_progress` + `register_pd_routes`; not a registry tool) |
| `lesson_observation` | Lesson Observation Notes / कक्षा अवलोकन | H,A | Structured observation write-up: evidence, strengths, one growth focus | observation notes | `feedback_panel` | – | writer | 2 | P0 | NEW |
| `teacher_feedback` | Post-Observation Feedback Script / सुझाव वार्ता | H | Coaching script for the conversation, not a verdict | observation_id | `text_block` | – | writer | 2 | P1 | NEW |
| `pd_plan` | Individual PD Plan / व्यक्तिगत विकास योजना | T,H | Term-by-term development plan with free/low-cost Nepali resources | teacher_id, goals | `plan_card` | – | writer | 2 | P1 | NEW |
| `workshop_designer` | Staff Workshop Designer / कर्मचारी कार्यशाला | H,A | 60–180 min session plan with activities, handout and a slide deck | topic, duration, audience | `plan_card`+`slide_deck` | – | deck+writer | 3 | P1 | NEW |
| `mentoring_notes` | Mentoring Log / परामर्श अभिलेख | H | Turns a mentoring chat into a dated log with agreed actions | notes | `checklist` | – | writer | 1 | P2 | NEW |
| `appraisal_draft` | Staff Appraisal Draft / कर्मचारी मूल्यांकन | H,A | Evidence-based appraisal narrative from attendance, results and observations — **human sign-off required** | staff_id, cycle | `text_block` | – | report | 3 | P1 | NEW |
| `jd_writer` | Job Description & Advert / पद विवरण | A,H | JD + advert copy + shortlisting criteria for a vacancy | role, level | `text_block` | – | writer | 1 | P2 | NEW |
| `interview_kit` | Interview Question Kit / अन्तर्वार्ता प्रश्न | A,H | Role-specific questions with what a good answer contains, plus a scoring sheet | role, competencies | `qa_list`+`rubric_grid` | – | writer | 2 | P2 | NEW |
| `induction_pack` | New Teacher Induction Pack / नयाँ शिक्षक परिचय | A,H | First-week checklist, policy summaries, who-to-ask map | role, start date | `checklist` | – | writer | 2 | P2 | NEW |
| `policy_drafter` | School Policy Drafter / विद्यालय नीति | A | Drafts a policy (AI use, phones, safeguarding, exams) grounded in existing school documents | topic, existing policies | `section_list` | – | writer | 3 | P1 | NEW |

## 3.9 Group I — Admin & operations (12)

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `timetable_solver` | Timetable Generator / समय तालिका | A | Constraint-satisfying timetable with teacher-load balancing | classes, teachers, constraints | `table_grid` | – | xlsx+writer | 2 | P0 | IMPL (`timetable_solver.py`, `/timetable` + `/timetable/save`) |
| `exam_timetable` | Exam Schedule Builder / परीक्षा तालिका | A | Exam timetable avoiding subject clashes, with invigilation duty roster | exams, rooms, staff | `table_grid` | – | writer+bulk | 2 | P0 | NEW |
| `duty_roster` | Duty / Invigilation Roster / ड्युटी तालिका | A,H | Fair rotation honouring leave and part-time contracts | staff, dates, slots | `table_grid` | – | xlsx | 1 | P1 | NEW |
| `voice_capture` | Voice Data Capture / बोलीबाट प्रविष्टि | T,A | Speak attendance or marks; transcribed, parsed, then **confirmed** before write | audio | `table_grid` | – | – | 4 | P0 | IMPL (`ai_capture.py /voice` + `/confirm`) |
| `photo_capture` | Photo Data Capture / फोटोबाट प्रविष्टि | T,A | Photograph a paper register or mark sheet → structured rows for confirmation | image | `table_grid` | – | – | 4 | P0 | IMPL (`ai_capture.py /photo`) |
| `data_cleanup` | Data Quality Sweep / डाटा सफाई | A | Finds duplicate students, impossible dates, missing guardians, malformed IDs | school_id | `checklist` | – | xlsx | 1 | P0 | NEW |
| `admission_bot` | Admission Enquiry Assistant / भर्ना सहायक | A,P | Answers admission questions and captures a structured lead | question | `text_block` | – | – | 1 | P1 | PART (`admission_bot.py`; referenced only in `admission` manifest) |
| `admission_screener` | Application Screener / आवेदन छनोट | A | Ranks applications against published criteria with a stated reason per rank | applications | `table_grid` | – | report | 3 | P2 | NEW |
| `inventory_forecast` | Inventory & Reorder Advisor / सामग्री अनुमान | A | Consumption-based reorder points for stationery, lab and library stock | inventory, period | `table_grid` | – | xlsx | 1 | P2 | NEW |
| `transport_optimizer` | Bus Route Optimizer / बस मार्ग | A | Groups stops into routes by geography, capacity and travel time | students, stops, buses | `table_grid` | – | report | 2 | P2 | NEW |
| `website_content` | School Website Content / वेबसाइट सामग्री | A | Generates page copy and section layout for the site builder | page type, school profile | `section_list` | – | – | 2 | P1 | IMPL (`website_designer.py` + `website_builder.py`) |
| `social_post` | Social Media Post / सामाजिक सञ्जाल पोस्ट | A | Post copy + matching canvas graphic for an achievement or event | event, tone | `text_block` | – | canvas | 1 | P2 | PART (`social_ai.py`, unmounted) |

## 3.10 Group J — Student learning (16)

All student-facing tools pass the orchestrator's guardian-consent gate
(`workbench.py` step 2: role `student` → resolve own `Student` row → `_require_guardian_consent`,
which is unbypassable by omitting `student_id`).

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `ai_tutor` | AI Tutor Session / एआई शिक्षक पाठ | S | Socratic tutoring that guides rather than answers; monitored by the teacher | topic, plan_id | `board_stream` | y | – | 4 | P0 | IMPL (`ai_tutor.py` plans/sessions/turn/close/messages/monitor + `tutor_engine.py`) |
| `homework_helper` | Homework Helper / गृहकार्य सहयोग | S | Hint-first help that never hands over the final answer | question | `feedback_panel` | y | – | 2 | P0 | IMPL (`homework_helper.py`, `/homework-help`) |
| `flashcards` | Flashcard Generator / फ्ल्याशकार्ड | S,T | Q&A deck for revision (handler counts cards) | topic, count | `flashcard_deck` | – | writer | 1 | P0 | IMPL |
| `practice_set` | Adaptive Practice Set / अभ्यास सेट | S | Questions targeted at this student's weakest verified items | student_id, subject | `qa_list` | Y | writer | 2 | P0 | NEW |
| `concept_explainer` | Explain It Simpler / सजिलो व्याख्या | S | Re-explains a stuck concept 3 ways (analogy, steps, visual description) | concept, grade | `section_list` | y | – | 1 | P0 | NEW |
| `worked_example` | Worked Example Walkthrough / नमुना समाधान | S | Step-by-step model solution with the reasoning made explicit, then a twin problem | problem | `section_list` | y | writer | 2 | P0 | NEW |
| `revision_planner` | Exam Revision Planner / परीक्षा तयारी योजना | S | Day-by-day revision schedule to the exam date, weighted by weak topics | exam date, subjects | `checklist` | Y | writer | 2 | P0 | NEW |
| `see_prep_pack` | SEE Preparation Pack / एसईई तयारी प्याक | S | Whole revision bundle per subject: summaries, past-pattern questions, self-tests | subject, grade 10 | `section_list`+`qa_list` | Y | writer | 3 | P0 | NEW |
| `self_quiz` | Quiz Me / मलाई सोध्नुहोस् | S | Self-testing loop with immediate explanation of every wrong answer | topic | `qa_list` | y | – | 2 | P0 | NEW |
| `note_summarizer` | Notes Summarizer / टिपोट सारांश | S | Class notes or a chapter → structured summary + 5 recall questions | text or file | `section_list` | – | writer | 2 | P1 | NEW |
| `mindmap_builder` | Concept Map / धारणा नक्सा | S,T | Nodes and links for a topic, rendered on the canvas | topic | `chart_panel` | y | canvas | 2 | P1 | NEW |
| `reading_coach` | Oral Reading Coach / पठन अभ्यास | S | Records reading aloud, reports fluency and mispronunciations (**Nepali ASR accuracy to be validated**) | audio, passage | `feedback_panel` | – | – | 4 | P2 | NEW |
| `writing_tutor` | Writing Tutor (draft coach) / लेखन प्रशिक्षक | S | Coaches the student's own draft; **never rewrites it** (same CI invariant as `writing_feedback`) | draft | `feedback_panel` | – | – | 2 | P1 | NEW |
| `lab_prep` | Practical Prep Guide / प्रयोग तयारी | S | Aim, apparatus, procedure, expected observations, safety for a listed practical | experiment, grade | `section_list` | Y | writer | 2 | P1 | NEW |
| `career_explorer` | Career & Stream Explorer / व्यावसायिक मार्गदर्शन | S,C | Maps interests + marks to realistic Nepali stream and career options with entry requirements | student_id, interests | `section_list` | – | writer | 2 | P1 | NEW |
| `study_skills` | Study Skills Coach / अध्ययन सीप | S | Diagnoses study habits and prescribes 3 concrete techniques | self-report answers | `checklist` | – | writer | 1 | P2 | NEW |

## 3.11 Group K — Student wellbeing & safeguarding (8)

Every tool here routes through the existing moderation path: `workbench.moderate` →
`critical` self-harm → `ModerationFlag(severity="critical")` + blocked generation + counselor
queue (`workbench.py _escalate_self_harm`). No second alerting mechanism is introduced.

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `wellbeing_checkin` | Wellbeing Check-in / सुस्वास्थ्य जाँच | S,C | Short structured check-in; escalates critical signals to a counselor, never self-treats | student responses | `feedback_panel` | – | – | 2 | P0 | PART (`wellbeing_ai.py` + `api/v1/wellbeing.py` exist; not an AI registry tool) |
| `counselor_brief` | Counselor Case Brief / परामर्श विवरण | C | Assembles attendance, marks, incidents and flags into a single confidential brief | student_id | `insight_cards` | – | report | 3 | P0 | NEW |
| `incident_writeup` | Incident Report Writer / घटना प्रतिवेदन | T,A,C | Turns rough notes into a factual, non-judgemental incident record | notes | `text_block` | – | report | 2 | P0 | PART (`incident_management.py`/`incidents.py` exist; no AI drafting) |
| `restorative_script` | Restorative Conversation Script / पुनर्स्थापनात्मक संवाद | T,C | Prepares a repair conversation between students instead of a punishment note | incident_id | `text_block` | – | writer | 2 | P1 | NEW |
| `bullying_triage` | Bullying Report Triage / दुर्व्यवहार छानबिन | C,A | Classifies severity, lists required next steps and the statutory record to create | report text | `checklist` | – | report | 2 | P1 | NEW |
| `safeguarding_check` | Safeguarding Signal Review / बाल संरक्षण संकेत | C | Reviews accumulated soft signals and states whether the threshold for referral is met | student_id | `checklist` | – | report | 3 | P1 | NEW |
| `attendance_outreach` | Absence Outreach Message / अनुपस्थिति सम्पर्क | T,C | Non-accusatory family message for chronic absence with a support offer | student_id | `text_block` | – | – | 1 | P0 | NEW |
| `crisis_protocol` | Crisis Response Prompt / संकट प्रतिक्रिया | C,A | Surfaces the school's own protocol steps + the correct Nepali helpline; **deterministic, no generation** | event type | `checklist` | – | report | 0 | P0 | NEW |

## 3.12 Group L — Parent-facing (8)

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `report_explainer` | "What does this report mean?" / प्रगति पत्र व्याख्या | P | Explains the child's report card in plain Nepali, including what GPA and NEB grades mean | student_id, term | `section_list` | – | – | 1 | P0 | NEW |
| `home_support` | How to Help at Home / घरमा सहयोग | P | 3 concrete, resource-free activities matched to the child's weakest area | student_id | `checklist` | y | writer | 1 | P0 | NEW |
| `fee_explainer` | Fee & Due Explainer / शुल्क विवरण व्याख्या | P | Explains the invoice line by line and states the payment options | invoice_id | `text_block` | – | report | 1 | P1 | NEW |
| `school_qa` | Ask the School / विद्यालयलाई सोध्नुहोस् | P | Answers from published school policy only, cites the document, escalates when unknown | question | `text_block` | – | – | 2 | P1 | NEW |
| `meeting_prep_parent` | Parents' Day Prep / अभिभावक दिवस तयारी | P | 5 questions worth asking about *this* child at the meeting | student_id | `checklist` | – | – | 1 | P1 | NEW |
| `consent_explainer` | AI Consent Explainer / एआई सहमति व्याख्या | P | Explains in Nepali what the AI features do with their child's data before consent is granted | – | `section_list` | – | – | 0 | P0 | PART (`GuardianAIConsent` model + gate exist; no explainer surface) |
| `transition_guide` | Grade Transition Guide / कक्षा परिवर्तन मार्गदर्शन | P | What changes next year (subjects, workload, exams) and how to prepare | grade | `section_list` | y | writer | 1 | P2 | NEW |
| `attendance_digest` | Monthly Attendance Digest / मासिक उपस्थिति सार | P | Plain-language monthly summary with a pattern note, BS dates | student_id, month BS | `chart_panel` | – | report | 1 | P1 | NEW |

## 3.13 Group M — Nepal-specific (NEB/SEE/CDC, Nepali, BS, IEMIS) (6)

These are the tools no competitor can copy quickly, and they are why the catalog wins locally.

| key | Name (EN / नेपाली) | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `curriculum_mapper` | CDC Curriculum Mapper / पाठ्यक्रम नक्सांकन | T,A | Ingests a CDC curriculum PDF into `CurriculumFramework` + units + `LearningOutcome` rows, so every other tool can ground on it | curriculum file, subject, grade | `table_grid` | Y | xlsx | 3 | P0 | PART (`curriculum_seed.py` + `models/curriculum.py` exist; **unmounted**, no importer UI) |
| `neb_grade_engine` | NEB Grade & GPA Explainer / नतिजा गणना | T,A,P | Applies and explains the NEB scale (A+ 4.0 ≥90 … D 1.6 ≥35, NG <35; theory pass 35%, practical 40%) — deterministic, model only writes the prose | marks | `table_grid` | – | bulk | 0 | P0 | IMPL (`app/utils/nepal_grading.py` + `bulk_generator._neb_grade/_neb_gpa/_neb_grade_from_gpa`) |
| `nepali_style_editor` | Nepali Register Editor / नेपाली भाषा सम्पादन | T,A | Fixes register, honorifics and formal-letter conventions in Nepali text (the `typography` skill idea, Devanagari edition) | Nepali text, register | `text_block` | – | writer | 2 | P0 | NEW |
| `bs_calendar_planner` | BS Academic Calendar Planner / शैक्षिक पात्रो | A | Builds the year around BS months, Dashain/Tihar/Chhath, exam windows and public holidays | BS year, term structure | `table_grid` | – | canvas+xlsx | 2 | P0 | PART (`app/utils/nepali_date.py` + `_nepali_calendar_page` template + `tools_gen_calendar_templates.py`; no AI planner) |
| `iemis_field_assistant` | IEMIS Field Assistant / IEMIS सहायक | A | Explains each IEMIS field, infers a defensible value from existing records, flags what a human must confirm | record set, cycle | `table_grid` | – | xlsx | 2 | P0 | PART (`models/iemis.py` + `iemis_templates/` + importer plugin; no AI assistant) |
| `see_pattern_analyst` | SEE/NEB Paper Pattern Analyst / प्रश्न ढाँचा विश्लेषण | T,A | Learns the recurring section/marks pattern from past papers and validates a new paper against it | past papers, subject | `table_grid` | Y | report | 3 | P1 | NEW |

## 3.14 Counts, and what is already built

| Group | Tools | IMPL | PART | NEW |
|---|---|---|---|---|
| A Planning | 14 | 4 | 0 | 10 |
| B Delivery / teaching | 12 | 0 | 2 | 10 |
| C Assessment authoring | 14 | 5 | 0 | 9 |
| D Grading & feedback | 12 | 2 | 3 | 7 |
| E Differentiation & SEN | 13 | 1 | 1 | 11 |
| F Communication | 14 | 1 | 6 | 7 |
| G Reporting & analytics | 13 | 3 | 5 | 5 |
| H PD & HR | 11 | 0 | 1 | 10 |
| I Admin & operations | 12 | 4 | 2 | 6 |
| J Student learning | 16 | 3 | 0 | 13 |
| K Student wellbeing | 8 | 0 | 2 | 6 |
| L Parent-facing | 8 | 0 | 1 | 7 |
| M Nepal-specific | 6 | 1 | 3 | 2 |
| **Total** | **153** | **24** | **26** | **103** |

The 10 tools with a full registry row + schema + EN/NE prompt pair today are
`fixture_test, lesson_plan, worksheet, exit_ticket, rubric, parent_email, differentiation,
study_guide, flashcards, writing_feedback` (`workbench_seed.py`). Everything else marked
IMPL is wired through an older bespoke route (`ai_tools.py`, `ai_tutor.py`, `ai_capture.py`,
`assignments.py`, `adaptive_learning.py`, `website_builder.py`) and should be **migrated
into the registry** so it inherits consent, pseudonymization, injection screening, schema
repair, moderation, the AIGeneration ledger and Caliper emission for free. 13 written-but-
unmounted services (`plagiarism, benchmarking_ai, fee_predictor, risk_detector,
wellbeing_ai, content_gen, attendance_ai, sentiment, social_ai, translator, report_remarks,
rag, curriculum_seed`) are the cheapest wins in the whole plan: the logic exists, only the
registry row + schema + prompt pair is missing — literally the "tool #66 = one row + one
prompt file + one handler" claim in `workbench.py`'s docstring.

## 3.15 The 25 highest-priority NEW tools

Ranked by (evidence of pain × leverage on our SIS data × build cost).

1. `slide_deck` — the biggest missing category; every competitor ships deck generation.
2. `batch_feedback` — attacks the 57%-quality-gain task (grading) at class scale.
3. `answer_grouper` — grade one answer group not one student; the Gradescope multiplier.
4. `remark_sheet` — report-card season, whole class in one editable sheet.
5. `rubric_grader` — criterion-by-criterion marking with quoted justification.
6. `blueprint_builder` — must exist *before* a paper is generated for NEB validity.
7. `answer_key` — a paper without a marking scheme is half a deliverable.
8. `remedial_plan` — targets the ~50%-below-benchmark reality in Nepali schools.
9. `unit_plan` — the unit is the real planning unit; the lesson is the leaf.
10. `annual_scheme` — BS-calendar pacing; nobody else can build this.
11. `text_leveler` — the single most-used differentiation tool in the market.
12. `misconception_map` — Curipod's headline insight, generated up front.
13. `group_maker` — deterministic, zero model cost, uses marks + attendance we already hold.
14. `parent_sms` — SMS is the real parent channel in Nepal, not email.
15. `difficult_conversation` — highest-risk communication, highest value in coaching it.
16. `class_performance` — turns an exam into three actions.
17. `item_analysis` — deterministic, retires bad questions, improves the bank permanently.
18. `nepali_style_editor` — every Nepali artifact reads better; no competitor has it.
19. `substitute_plan` — absence cover is a daily, unglamorous, universal pain.
20. `practice_set` — student side of the same weak-item data.
21. `see_prep_pack` — the highest-stakes moment in a Nepali student's school life.
22. `report_explainer` — makes report cards legible to guardians; drives parent adoption.
23. `data_cleanup` — deterministic; unblocks IEMIS and every analytics tool downstream.
24. `lesson_observation` — the head-teacher persona is entirely unserved today.
25. `counselor_brief` — one confidential view instead of five screens.

Fast followers once the four new result templates exist: `deck_from_doc`,
`handout_from_deck`, `mcq_generator`, `accommodation_finder`, `exam_timetable`,
`attendance_outreach`, `home_support`, `paper_moderation`, `grader_calibration`.

---

# PART 4 — DOCUMENT & PRESENTATION GENERATION VIA OUR ENGINES

## 4.1 What exists today (read from source)

**Five renderers, three document JSON dialects.**

| Engine | File | Input dialect | Output |
|---|---|---|---|
| Template engine | `backend/app/services/designer/template_engine.py` (2,272 LOC, `TemplateEngineService`) | registered template meta: `{type:"canvas", canvas:{objects[]}}`, `{type:"writer", writer_json:{config,blocks[]}}`, or key-value | HTML for WeasyPrint; `render_document`, `render_html` |
| Canvas document renderer | `designer/document_renderer.py` (326 LOC) | saved fabric `canvas_state`, incl. `{version:"multi-page", pages:[{width,height,json}]}` | HTML body fragment → `document_pdf()` PDF, one PDF page per design page at its own px size |
| PDF wrapper | `designer/pdf_css.py` | HTML fragment + page-size string | full HTML doc with `@page` rule; embeds `NotoSansDevanagari-{Regular,Bold}.ttf` from `app/static/fonts` |
| Bulk generator | `designer/bulk_generator.py` (875 LOC, `BulkGeneratorService`) | template + student query | per-student merged renders: `generate_bulk_{id_cards,admit_cards,certificates,marksheets}`, `generate_attendance_ledger`; owns `_neb_grade/_neb_gpa/_neb_grade_from_gpa`, `_qr_data_uri`, `_initials_avatar_uri` |
| Report PDF helper | `app/utils/report_pdf.py` | HTML body + school | A4 letterhead, NPR amounts, **AD + Bikram Sambat** "Issued" line, page counters |
| Writer DOCX | `app/services/writer_docx.py` (495 LOC, `writer_doc_to_bytes`) | **TipTap/ProseMirror** JSON + `WriterSettings` | .docx with page size, columns, line numbers, headers/footers, hyperlinks, images, framed paragraphs, tables |
| Thumbnails | `designer/thumbnails.py` (503 LOC) | template key + `demo_data()` | WeasyPrint → `pdftoppm` → downscaled PNG; `generate_all_thumbnails`, `ensure_thumbnails_async` |
| Template folders | `designer/template_folders.py` | on-disk template folders (YAML/JSON) merged over built-ins | registry entries with `deep_merge` |

**Writer block vocabulary (server-side, the one to extend):** `heading`, `paragraph`,
`divider`, `spacer`, `table`, `columns`, `signature`, `header_band`, `footer_band`,
`subject_rows`, `subject_rows_neb`, `fee_rows` — helpers `_w_*` in `template_engine.py`
(L534–563), rendered by `_render_writer_html` (L1865+). Existing writer templates:
report card, marksheet, grade sheet, notice, circular, letterhead ×2, fee bill.
Canvas templates: ID card ×2, certificates ×4, admit card ×2, report card, marksheet,
notice, circular, letterhead ×2, and a generated 12-month `_nepali_calendar_page`.

**Canvas object coverage in `document_renderer._render_object`:** textbox/text/i-text,
rect, circle, image (with `data.token` placeholder resolution, `{{qr_code}}` re-encoding via
`qrcode`, initials-avatar fallback), line, polygon/path/triangle/group (as inline SVG).
Token syntax `{{key}}` / `{key}` resolves against merged `fields` + `school_config`.

**Frontend editors:** `frontend/app/dashboard/designer/editor/page.tsx` →
`components/designer/CanvasEditor.tsx` (1,171 LOC, fabric v6) with `LayersPanel`,
`PropertiesPanel`, `GraphicsPanel`, `AIChatPanel` (178 LOC) and `lib/designer/{store,elements,
snapping,shortcuts,canvasImages,writer-blocks}.ts`; `designer/writer/page.tsx` (8 LOC
shim) and `designer/writer2/page.tsx` (971 LOC) on TipTap 3 via `lib/writer/{editorKit,
pagination,findReplace,settings,exportDocx}.ts`; `designer/bulk/page.tsx`;
`designer/templates/page.tsx`. Export hook `lib/hooks/useExport.ts` already exposes
`exportPNG, exportPDF, exportPagesZip, exportPPTX, exportSVG`.

**Two findings that change the Part-4 recommendation:**

1. **`pptxgenjs@^4.0.1` is already a frontend dependency** and `useExport.ts` already has
   `exportPPTXImpl`: it iterates `doc.pages`, calls `pptx.defineLayout({width: w/96,
   height: h/96})`, renders each page on an offscreen fabric canvas, and inserts it as a
   **full-bleed PNG** via `slide.addImage`. So PPTX *export* exists — but every slide is a
   flat raster. There is no text, no editable shapes, no speaker notes, and
   `defineLayout` is called inside the loop without ever being applied via
   `pptx.layout`, so slide dimensions are effectively the default. That is the gap, not
   the library.
2. **AI already talks to the editors** through `POST /design-studio/ai/agent`, which
   returns `{reply, content, actions[]}` with a closed action vocabulary
   (`add_text, add_heading, replace_selected_text, insert_text_at_cursor, set_background,
   suggest_layout, replace_document_text, add_bullet_points`) executed client-side, plus
   `POST /design-studio/ai/suggest` for plain content. This is the seam the tool catalog
   should reuse rather than inventing a second path.

## 4.2 The contract: how an AI tool emits a document

**Principle:** a workbench tool returns *only* its schema-validated semantic JSON. A
separate, deterministic **emitter** converts that JSON into an engine dialect. The model
never emits fabric coordinates, HTML, or PPTX. This mirrors the skills-repo split (model
plans, `scripts/` renders) and keeps `tool_schemas.py` renderer-agnostic.

Registry additions per tool: `output_document_type`
(`writer | canvas | deck | report | bulk | xlsx | none`) and `document_emitter`
(function name in a new `app/services/ai/document_emitters.py`).

Pipeline, appended after step 6.5 of `AIWorkbenchOrchestrator.run`:

```
tool result JSON  →  emitter(result, payload, school_config)  →  engine dialect
                     │
   writer  →  {type:"writer", config:{size,orientation,font,fontSize}, blocks:[…]}
              → TemplateEngineService._render_writer_html → wrap_pdf_html → WeasyPrint
              → OR converted to TipTap JSON → writer2 editor → writer_docx.py (.docx)
   canvas  →  {version:"multi-page", pages:[{width,height,background,json:{objects[]}}]}
              → document_to_html → document_pdf  (and loads straight into CanvasEditor)
   deck    →  {type:"deck", theme, slides:[{type, …}]}   ← NEW dialect
              → deck→canvas transform (1280×720 px pages) → existing canvas path
              → PPTX via upgraded exportPPTX; PDF via document_pdf
   report  →  build_report_html(body) → report_pdf.BASE_CSS → WeasyPrint
   bulk    →  BulkGeneratorService.<generator>(template_id, rows)
   xlsx    →  openpyxl workbook (already a backend dependency)
```

**Round trip.** Every generation is persisted as an `AIGeneration` row plus, when the user
saves it, a designer document via `DocumentStoreService` (revisions already exist:
`/documents/<id>/revisions`, `/documents/revisions/<id>/restore`). The UX contract is:
tool result card → **"Open in Writer" / "Open in Designer" / "Open as Deck"** → the teacher
edits in the existing editor → export PDF/DOCX/PPTX through the existing routes. No new
export surface.

## 4.3 Per-artifact specification

**Worksheet** (`worksheet`, `practice_set`, `mcq_generator`, `formative_probe`)
`{title, instructions, items[{question, marks, question_type}], total_marks}` → writer blocks
`header_band(school) · heading(title) · paragraph(instructions) · columns(Name/Class/Date) ·
[per item: paragraph("N. question  [marks]") + spacer(answer space by type)] ·
footer_band`. Answer-space height derives from `question_type` (mcq 0, short 40 px, long
120 px) — deterministic, in the emitter. Needs: a `question_block` writer block so answer
lines/grids render properly (currently a hack with `spacer`).

**Question paper** (`question_paper`, `question_paper_v2`, `answer_key`, `practical_exam`,
`oral_viva`) Same as worksheet plus NEB furniture: the exam header band (school, exam name,
subject, grade, **Time** and **Full Marks**), sectioned groups with per-section instructions,
and mark totals validated by the handler against `blueprint_builder`. Needs: multi-page flow
with **"[P.T.O.]" / "Page n of m"** in the writer footer, and a `section_header` block.
Answer key is the same document with an `answer` field revealed and a watermark.

**Lesson slide deck** (`slide_deck`, `deck_from_doc`, `workshop_designer`) — new dialect:

```json
{ "type": "deck", "theme": "aschool_light", "aspect": "16:9",
  "slides": [
    {"type":"title",     "title":"…", "subtitle":"…", "notes":"…"},
    {"type":"objectives","bullets":["…"]},
    {"type":"content",   "title":"…", "bullets":["…"], "image_prompt":"…"},
    {"type":"two_col",   "left":{…}, "right":{…}},
    {"type":"diagram",   "caption":"…", "svg_spec":{…}},
    {"type":"table",     "headers":["…"], "rows":[["…"]]},
    {"type":"chart",     "chart":"bar", "labels":[…], "series":[…], "caption":"…"},
    {"type":"question",  "question":"…", "answer_hidden":true},
    {"type":"activity",  "title":"…", "steps":["…"], "minutes":10},
    {"type":"exit",      "questions":["…"]}
  ]}
```

Ten slide types, matching `present`'s discipline (typed slides, notes ≠ slide text, image on
3–5 of 12 slides max). The emitter maps each type to a fabric page at **1280×720 px** using
a master-page layout, so the deck immediately renders through
`document_to_html`/`document_pdf` and loads in `CanvasEditor` with no new renderer. The
`notes` field becomes the handout (`handout_from_deck`) and PPTX speaker notes.

**Recommendation on the engine: reuse the designer canvas, and fix the existing PPTX
exporter — do not add python-pptx.** Rationale: (a) the canvas renderer already handles
Devanagari shaping via WeasyPrint + Pango/HarfBuzz, which is the single hardest requirement
and which a server-side pptx writer would not solve for the *PDF*; (b) `pptxgenjs` is
already installed and already wired to multi-page docs; (c) one dialect (`pages[]`) then
serves screen, PDF, PNG, SVG and PPTX. The fix is to make `exportPPTX` emit **native
text boxes, shapes, tables and notes** for objects it can map (textbox → `addText`, rect/
circle → `addShape`, table block → `addTable`, image → `addImage`) and fall back to the
current raster only for paths/groups; and to call `pptx.defineLayout` + `pptx.layout` once
before the slide loop. A server-side `python-pptx` path is worth adding **later, only** for
Celery-generated bulk decks where no browser is present (`app/tasks/`), sharing the same
deck JSON.

**Certificates / ID cards / admit cards** (`event_invite`, merit and participation
certificates, transfer/character certificates) — already fully served: canvas templates +
`generate_bulk_certificates` / `generate_bulk_id_cards` / `generate_bulk_admit_cards` with
QR and photo token resolution. AI's job is only text: recipient wording, citation line,
achievement phrasing → merged as `fields`, no new engine work.

**Marksheets / report cards** (`remark_sheet`, `remark_writer`, `report_explainer`) —
`generate_bulk_marksheets` + writer templates `_writer_report_card`, `_writer_marksheet`,
`_writer_grade_sheet` with `subject_rows_neb` already compute NEB grade/GPA. AI writes the
remark column only. `remark_sheet` returns `{students:[{student_id, remark, tone}]}` →
`table_grid` on screen → merged into the bulk run. Needs: an editable-before-merge review
step (the "confirm before write" pattern already used by `ai_capture`).

**Newsletters / notices / parent letters** (`class_newsletter`, `school_notice`,
`parent_letter`, `emergency_notice`) — writer for text-first (letterhead + `header_band` +
BS date line via `report_pdf`), canvas when it must look designed (newsletter, invitation).
`section_list` → `heading`+`paragraph` blocks is a trivial emitter. Needs: a `two_column`
flowing text block (current `columns` is a fixed 3-cell flex row, not a flowing column
layout) and an `image` block in the writer dialect.

**IEP documents** (`iep_draft`, `iep_progress`, `behaviour_plan`) — writer, because these
must be printable, signable and archivable: `heading · table(present levels) ·
table(goals × baseline × target × review date) · checklist(accommodations) · signature([
"Class Teacher","SEN Coordinator","Guardian","Head Teacher"])`. `signature` already exists.
Needs: a `checkbox_list` block and a **`draft` watermark** until `review_iep` marks it
approved (the route pair already exists in `ai_workbench.py`).

**Report-card comment sheets** (`remark_sheet`) — dual output: `xlsx` via openpyxl for
offline editing (teachers in low-connectivity schools want this) and writer table for print.

## 4.4 Ranked engine upgrades

| # | Upgrade | Why | Where | Effort |
|---|---|---|---|---|
| 1 | **`deck` template type + deck→canvas emitter + master pages** (1280×720, 10 typed slides, theme tokens) | Unlocks group B and `workshop_designer`; the single biggest catalog gap; reuses the whole existing PDF path | `template_engine.py` (new `_deck_*` builders), new `app/services/ai/document_emitters.py`, `document_renderer` unchanged | L |
| 2 | **Fix `exportPPTX` to native objects + notes**; call `defineLayout`/`layout` once | Raster slides can't be edited by the teacher after export — kills adoption; library already installed | `frontend/lib/hooks/useExport.ts` | M |
| 3 | **Writer block library expansion**: `question_block`, `section_header`, `checkbox_list`, `image`, `page_break`, `two_column_flow`, `answer_space` | Every worksheet/paper/IEP artifact needs at least one of these; today emitters would have to abuse `spacer` | `template_engine.py` `_w_*` + `_render_writer_html`; mirror in `writer_docx.py` and `lib/designer/writer-blocks.ts` | M |
| 4 | **Multi-page flow + running headers/footers in the writer renderer** (`Page n of m`, `[P.T.O.]`, repeat table headers across pages) | Question papers and marksheets are multi-page by nature; `report_pdf.BASE_CSS` already proves the `@page` counter pattern | `template_engine._render_writer_html` + `pdf_css` | M |
| 5 | **`chart_block`** — server SVG (deterministic, no JS) + Recharts on screen | 11 analytics/reporting tools need a chart; `tufte-report`'s lesson: no pie/donut/3D, caption mandatory | new `app/services/designer/charts.py`; `chart_panel` template in frontend | M |
| 6 | **`table_block` upgrades**: column widths, alignment, merged cells, zebra rows, totals row, page-break-safe | `table_grid` is the most reused new result template (marks, timetables, rosters, item analysis) | `template_engine` + `writer_docx._render_table` | S |
| 7 | **Nepali typography pack** — Devanagari line-breaking rules, matra-safe font sizing, numeral locale (०-९), font fallback chain, EN/NE mixed-run kerning; as a `references/` doc plus CSS | Everything Nepali currently relies on `-weasy-hyphens:none` + one font stack; the `typography`/`font-features` skills are the precedent for treating this as its own concern | `pdf_css.py`, `app/static/fonts`, new `docs/nepali_typography.md` | M |
| 8 | **Result-template → engine bridge in the frontend**: "Open in Writer / Designer / Deck" on every tool card, powered by `output_document_type` | Without this the catalog produces text the teacher must retype; it is the difference between a demo and a product | `frontend/app/dashboard/ai-tools/**`, reuse `AIChatPanel` action vocabulary | M |
| 9 | **Server-side deck rasterization for Celery** (headless render of deck pages for scheduled/bulk decks, or `python-pptx` sharing the deck JSON) | Only needed for background generation; browser path covers the interactive case | `app/tasks/`, optional new dep | M |
| 10 | **Master pages / school brand tokens as a shared context builder** (logo, colors, letterhead, signature blocks resolved once) | The `brand-agency` pattern; today each template hardcodes `#1e40af`-style values | new `context_branding` in `tool_handlers.py`; `template_folders.deep_merge` already supports overlay | S |
| 11 | **Animation / transition support in decks** | Genuinely useful in class, but PDF ignores it and PPTX support is partial; last because value/effort is worst | deck dialect `transition` field, `exportPPTX` | S |
| 12 | **Thumbnail generation for AI-produced documents** (reuse `thumbnails.py`'s WeasyPrint→pdftoppm→PNG chain for the AI library grid) | Polish; the library list at `/ai/library` currently has no previews | `thumbnails.py`, `ai_workbench.py` library routes | S |

Ordering rationale: 1–4 are prerequisites for the P0 tools in groups A–D (worksheets,
papers, decks, marksheets). 5–8 unblock groups G and the whole "don't retype it" promise.
9–12 are polish or background-only concerns.

## 4.5 Implementation sequence (three slices)

**Slice 1 — registry-first, zero new engines.** Migrate the 13 unmounted services and the
bespoke routes into `AIToolRegistry` (row + schema + EN/NE prompt + handler), add the
registry columns from §1.4, ship the `table_grid` and `checklist` result templates, and add
the `writer` emitter for the artifacts the existing block vocabulary already supports
(lesson plan, study guide, differentiation, remarks, letters, notices). ~40 tools become
real with no renderer work.

**Slice 2 — writer/table/paper depth.** Upgrades 3, 4, 6, 10; then `blueprint_builder`,
`answer_key`, `paper_moderation`, `remark_sheet`, `item_analysis`, `annual_scheme`, plus the
`xlsx` emitter.

**Slice 3 — decks and charts.** Upgrades 1, 2, 5, 8; then `slide_deck`, `deck_from_doc`,
`handout_from_deck`, `workshop_designer`, `class_performance`, `cohort_trend`,
`attendance_insight`.

## 4.6 Open questions for the product owner

1. Does `ai_suite` at NPR 399/month absorb 153 tools, or does the AI Teacher plugin become a
   second paid bundle (and are the cost-tier-4 tools — batch grading, handwriting OCR,
   voice — metered like Kahoot's "pages of source material" rather than per generation)?
2. Do we ship `deck` inside `design_studio` (teachers already know that surface) or as a new
   dashboard route under AI Tools?
3. Which mother tongues do we commit to for `multilingual_support`, and who validates the
   output? Model quality for Maithili/Bhojpuri/Newar/Tamang is **unverified**.
4. Is `grader_calibration` acceptable to schools, given it stores a model of a named
   teacher's marking behaviour? This needs a policy decision alongside `GuardianAIConsent`.





