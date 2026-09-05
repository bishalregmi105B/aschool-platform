# B1 — CLAUDE-SKILLS INVENTORY → ASCHOOL TOOL CATALOG MAPPING
Researched 2026-09-05. Source repo: https://github.com/glebis/claude-skills/ (README + file tree; ~100 top-level skill dirs, MIT, per-skill layout `skill-name/{SKILL.md, CHANGELOG.md, scripts/, assets/, references/}`). Individual SKILL.md files read for 10 skills (fetched via github.com/glebis/claude-skills/blob/main/<skill>/SKILL.md). Prior study in the corpus: D1 §C.16 (commit d0bc206, 104 dirs / 112 SKILL.md, counts per frontmatter key) — `/audits/research/_digest/D1_AITEACHER_AND_TOOLS.md:930-949`. Repo claims cite file:line.

---

## 1. REPO OVERVIEW AND FULL LISTING
README: "~100 skills for Claude Code — meeting pipelines, research, image generation, TDD, publishing, personal analytics, and Claude Code ops." README category sections: Recent additions · Meetings & transcripts · Research & knowledge · Writing, design & publishing · Images, audio & media · Communication · Development & release · Thinking & decisions · Personal analytics · Claude Code ops · Lab, consulting & business.

Top-level dirs (verbatim from the GitHub file tree): agency-docs-updater, agency-meetup-publish, agency-socials, agent-cli, app-release, automation-advisor, balanced, brand-agency, browser-mate, browsing-history, chrome-history, coaching-session-summarizer, codex, cognitive-toolkit, confide, context-builder, cull-release*, daydream, de-ai, decision-toolkit, deep-research, design-tokens, doctorg, ecosystem, elevenlabs-tts, elimination-research, fathom, feature-factory, firecrawl-research, font-features, github-gist, gmail, google-image-search, gpt-image-2, granola, gws, health-data, i18n-studio, init-tauri-app, init-xcode-app, insight-extractor, jtbd, lab-retro, learning-vault, linear, llm-cli, local-models, meeting-prep, meeting-processor, meta, name-audition, nano-banana, nielsen-heuristics, pdf-generation, peer-agent-collaboration, pre-session-portrait, present, presentation-generator, publish-skill, qmd-search, rag-eval, recording, repo-prep, repo-publish, retrospective, rigorous-experiments, session-anonymizer, session-finder, session-search, site-diagnosis, sketch, skill-studio, skills/, sorted, synthetic-session-generator, tdd, telegram*, temple-generator, tg-responder, the-goal, thinking-patterns, timebuzzer-led, trail-checkin, transcript-analyzer, tufte-report, typography, vision-bench, weekly-digest, whitepaper-audit, wispr-analytics (plus zoom, youtube-transcript, wow-digest named in README tables only).

Frontmatter conventions (measured in D1 §C.16.1, still true): `name`+`description` on ~every skill; `description` is the ENTIRE routing signal — capability + "use when" + verbatim trigger phrases in one long string. `allowed-tools` appears 0 times. Canonical `references/` tier in 38/112 skills. Body median well under 1,500 words.

---

## 2. SKILL → WHAT IT DOES → HOW IT BECOMES AN ASCHOOL TOOL

### 2.1 presentation-generator (fetched)
- **Does:** JSON/YAML → interactive HTML deck; 8 typed slide partials (`title, content, two-col, code, stats, grid, ascii, image`); content schema `{title, footer, slides:[{type, bg, title, subtitle, body, bullets, code, language, items:[{value,label}]}]}`; scripts `generate-presentation.js` (render), `export-slides.js` (PNG/PDF via Playwright), `md-to-slides.js` (markdown outline → slides); brand colors pulled from the *external* `brand-agency` skill, never hardcoded. Quality bars: 5-color palette only, h1 ≥4rem, "one idea per slide", "always preview before export". Note: docs list an `--image` type with no `image.html` partial — a docs/impl gap to avoid copying.
- **ASchool tool:** this is `slide_deck` + `deck_from_doc` (D1 §C.3, workbench_seed has no row yet). ASchool analogue is already specced: 10 typed slides → deck→canvas emitter at 1280×720 (D1 §C.17.3, verbatim deck JSON). Copy the *shape*: schema-name the slide types in the prompt file (`app/prompts/doc_sections_en.md` pattern becomes `app/prompts/deck_en.md`), keep the emitter deterministic, and let `brand-agency`-style tokens come from a shared `context_branding` builder (D1 §C.17.4 #10), not per-tool prompt text.
- **Prompt-file plan:** `deck_en.md` restates the 10 slide types + "notes ≠ slide text" + image budget; registry row gets `output_document_type: deck`, `output_schema_name: slide_deck`, `trigger_phrases: ["make slides", "lesson deck", "स्लाइड"]`.

### 2.2 present (fetched)
- **Does:** narrated HTML deck; 10 slide types (title, summary, stat, evidence, comparison, quote, framework, recommendation, case-study, sources); 7-step workflow from content analysis → slide plan → per-slide narration MP3 → images → template → test → deploy. Reference file `references/slide-types.md` holds per-type specs (tier-2 pattern).
- **ASchool tool:** (a) `slide_deck`/`deck_from_doc` discipline — notes ≠ slide text, 15–30 s narration/slide, images on 3–5 of 12 slides; (b) `handout_from_deck` (D1 §C.3): one deck JSON, two render profiles (present mode vs printable notes) — exactly the "dual mode" D1 §C.16 adopts; (c) the "avoid AI-slop" list (colored left-bar cards, big italic pull-quotes, uniform icon grids, gradient metrics) is directly reusable as a `## Known failure modes` section in deck prompts.
- **Prompt-file plan:** add to `slide_deck_en.md`: per-slide plan step ("plan every slide's type, on-screen content, notes, read time, image y/n BEFORE writing JSON"), detail tiers (executive 5–7 / standard 10–14 / detailed 15–20 → class-period presets), anti-slop list.

### 2.3 tufte-report (fetched)
- **Does:** data reports/dashboards as HTML. Key mechanisms: (1) **ReportData** — any input normalized into an intermediate JSON before rendering ("decouples data ingestion from report rendering"); (2) typed **block catalog** (sparkline-row, kpi-card, trend-chart, data-table, correlation-matrix, narrative, heatmap, strip-chart) each with a data contract + composition rules in `references/blocks.md`; (3) **hard limits** — max 8 sections, 2 chart types/section, 3 colors/chart, no pie/donut/3D, caption mandatory; published LOC/time budgets; (4) a verbatim **scope-negotiation script** when users over-ask; (5) **Session Lessons** — 8 recorded failure modes (pin Chart.js @4, never `file://`, never two adjacent charts, wrap tables on mobile, "no uncomputed correlation claims — 'r = 0.10' beats 'strong relationship'").
- **ASchool tool:** `class_performance`, `item_analysis`, `cohort_trend`, `board_report` (D1 §C.8) — all `chart_panel`/`table_grid` tools. The ReportData move is exactly our "tool returns semantic JSON, emitter renders" contract (D1 §C.17.2). Block catalog → our `chart_panel` schema (`chart_type: bar|line|grouped_bar|stacked_bar|scatter` per D3 §E.13). Tufte's chart bans + mandatory caption + "cite computed coefficients" go verbatim into the analytics prompts and the `charts.py` validator.
- **Prompt-file plan:** `chart_panel`/analytics prompts get `## Hard limits` (no pie/donut/3D, 3 colors, caption required, never state a correlation/discrimination number the data didn't produce — the handler computes, the model narrates).

### 2.4 whitepaper-audit (fetched)
- **Does:** two-lane document audit — Lane 1 deterministic script (`scripts/check_doc.py`, stdlib-only: readability, undefined acronyms, structure blocks, broken links); Lane 2 LLM judge run in a **fresh-context subagent** ("never judge a document you wrote in the same context"); merge dedupes by (location, issue type); P0–P2 findings; fix mode only on explicit request; judge calibration rules ("verbatim quotes required; no P0 at low confidence; say 'needs verification', never 'factually wrong'"); evals use **planted defects + clean control**.
- **ASchool tool:** `paper_moderation` (D1 §C.4 — deterministic + judge audit of a drafted paper: marks sum, blueprint coverage, duplicate stems, reading level, ambiguity) and `integrity_check` (evidence-only, no verdict). Lane 1 = our handlers (`paper_moderation` marks-sum/blueprint checks are pure functions, cost 0); Lane 2 = the model judge with fresh context; merge = `checklist` result template. "Needs verification, never 'factually wrong'" is exactly the no-verdict invariant of integrity_check.
- **Prompt-file plan:** new `paper_moderation_en.md` with the two-lane structure, judge calibration sentences verbatim, planted-defect gold set under `backend/tests/ai_gold/paper_moderation/` (D1 §C.16 adoption #5).

### 2.5 pdf-generation (fetched)
- **Does:** markdown → PDF via Pandoc/Eisvogel. Documents the **two page profiles** (A4 print: 2.5 cm margins/11pt vs mobile 6×9: 0.5 in margins/10pt/1.2 line-height) and a **doc-type→theme mapping** (white paper blue `#1e3a8a`, marketing green `#059669`, research purple `#7c3aed`, technical gray `#374151`). Names the "Common Claude Code Pattern" markdown pitfall (list under a colon renders inline) and ships `scripts/fix_markdown.py` to repair it deterministically.
- **ASchool tool:** every `output_document_type: writer` tool. The two-profile idea → print A4 vs phone-readable generation (already adopted in D1 §C.16); doc-type→theme → worksheet/paper/letter/IEP get distinct accent tokens in `pdf_css.py`. The pitfall+fixer pattern → our emitters should *validate and repair* model JSON (e.g., strip stray markdown list syntax from paragraph fields) instead of trusting it.
- **Prompt-file plan:** worksheet/paper prompts state the two profiles; `document_emitters.py` gains a sanitize step for known model-text artifacts.

### 2.6 typography (fetched)
- **Does:** deterministic, multi-locale character-level typography via pinned CLI (`scripts/typo.js` over the `typograf` npm lib): smart quotes per locale, dashes, non-breaking spaces, ranges, `--check` for CI (exit 1 + file list), `--safe` mode, idempotence rule ("second pass that changes output = bug; don't hand-fix"). Explicitly **no Devanagari/Indic support** — locales are en/de/fr/ru/uk/pl.
- **ASchool tool:** `nepali_style_editor` (registry row exists, workbench_seed.py:453) — this skill is the *precedent* for treating Nepali typography as its own deterministic concern, but we must build the Devanagari rules ourselves (Devanagari absent upstream). Punctuation/numeral normalization (०-९, danda, BS date formats) belongs in a handler, not the prompt.
- **Prompt-file plan:** `nepali_style_editor_en.md` keeps the model on register/honorifics only; a `nepali_typography.md` reference pack + CSS work in `pdf_css.py` stays deterministic (D1 §C.17.4 #7).

### 2.7 rag-eval (fetched)
- **Does:** structured RAG evaluation: audit stack → propose 3–8-variant sweep grid (default 2 prompts × 2 models × 1 retrieval) → run with a **hard dollar cap confirmed before any sweep** (default $2, halts mid-run) → rank by cost-aware score "quality × (1 / log(1 + cost))" → history.jsonl + self-improve. Gold set: ≥10 Q&A pairs, LLM-synthesized but human-reviewed if absent.
- **ASchool tool:** `parent_faq` / `school_qa` (policy-grounded RAG over school documents, D1 §C.7/C.13) and future elibrary document chat (D3 §E). The budget-cap-first and gold-set patterns apply to every cost-tier 2–3 tool we evaluate.
- **Prompt-file plan:** not a prompt file — an eval harness pattern: `backend/tests/ai_gold/<tool_key>/` gold sets + per-run budget gate, already adopted (D1 §C.16 #7).

### 2.8 i18n-studio (fetched)
- **Does:** keeps a multi-locale string corpus in sync: `audit` lists missing/untranslated/pending; sidecar `.i18n-status.json` stores acceptance state; editing a value drops it to "pending"; duplicates get "apply to all" propagation; rules: "placeholders are sacred" (`${...}` preserved), verify HTML tags/entities in the same positions, never translate code identifiers/proper nouns, confirm before mass edits.
- **ASchool tool:** not a tool — infrastructure for 130 tool names × 2 languages. Our analogue: `name`/`name_ne`/`description`/`trigger_phrases` in `workbench_seed.py` and the `_{en,ne}.md` prompt pairs with CI gate g (`_ensure_prompt_files`, workbench_seed.py:557-576). Missing piece: a parity check that a prompt edit in EN flags the NE twin (the "pending" state).
- **Prompt-file plan:** extend CI gate g to also diff file mtimes/hashes and mark NE files stale when EN changes; adopt "placeholders are sacred" verbatim for schema keys and `{student_first_name}`-style tokens in prompts.

### 2.9 learning-vault (fetched)
- **Does:** generates an Obsidian study vault for a certification/course: dashboard + MoC notes + YAML frontmatter schema per note type (course/domain/concept/scenario/lesson), wikilink graph, Dataview queries, self-assessment → priority mapping ("higher exam weight × lower confidence = higher study priority"), review tasks per concept, study-plan phases (quick wins → gap-fill → practice → final review).
- **ASchool tool:** `revision_planner` + `see_prep_pack` (D1 §C.11; see_prep_pack is seeded, workbench_seed.py:388). The portable idea is the **priority formula** (weight × low confidence) — for us it becomes "NEB exam weight × this student's weak verified items" via `context_mastery`, and the phase structure (quick wins → gap-fill → practice → final review) is the planner output skeleton.
- **Prompt-file plan:** `see_prep_pack_en.md` already uses `doc_sections`; add the priority formula and phase skeleton to the prompt, keep weighting computation in the handler.

### 2.10 tdd (fetched — the canonical discipline skill, largest in repo per D1)
- **Does:** RED-GREEN-REFACTOR with vertical slicing; context isolation between test-writing and implementation subagents; **hard rules section** ("Anti-Patterns to Avoid": never modify a test to make it pass, never skip RED, never test implementation details…); state file for resume.
- **ASchool tool:** meta-lesson, not a tool: its "hard rules" section is the model for our `## Hard limits` and `## Known failure modes` prompt sections, and its context-isolation (writer never sees the grader) maps to our fresh-context judge rule for moderation/grading evals.

### 2.11 Secondary skills (from listing + D1 §C.16; SKILL.md not fetched)
| skill | one-liner (source: repo listing / D1 §C.16) | ASchool hook |
|---|---|---|
| confide | local PII redaction to a "GREEN" copy with reversible sentinels, corpus audit, rehydration on user machine (D1 §C.16.8) | workbench `pseudonymize`/`de_pseudonymize` is the same idea; missing audit+red-team skills → gold-set tests |
| brand-agency | brand tokens as a referenced skill, not copy-paste | `context_branding` builder (D1 §C.17.4 #10) |
| gpt-image-2 / nano-banana | declarative `platforms.yaml` + `presets.yaml` size/style registry | A4/A5/ID-card/slide/16:9 size registry for emitters |
| sketch | bidirectional agent↔canvas editing | closest analogue to our Fabric canvas + `AIChatPanel` actions |
| transcript-analyzer / meeting-processor / meeting-prep | transcript → decisions/owners/actions pipelines | `meeting_minutes`, `progress_conference`, `lesson_observation` (D1 §C.7–C.9) |
| insight-extractor / weekly-digest | periodic digest of signals | `school_insights`, `daily_brief` (already IMPL) |
| font-features | OpenType feature control as its own skill | Devanagari shaping pack (D1 §C.17.4 #7) |
| deep-research / firecrawl-research | multi-source research with citation discipline | `resource_finder`, `career_explorer` grounding |
| retrospective / lab-retro | structured review formats | `lesson_observation`, `iep_progress` review cadence |

---

## 3. GENERAL LESSONS FOR OUR PROMPT-FILE SYSTEM
(Consolidated; each traceable to a fetched SKILL.md above or D1 §C.16:930-949.)

1. **The description/trigger string is the router, not metadata.** `present` packs capability + "use when" + literal phrases ("make a presentation", "narrated deck") into one description. → Our `trigger_phrases` JSON column (already in workbench_seed.py:49) is the right mechanism; every tool row must carry 3+ phrases incl. one Nepali.
2. **Three-tier progressive disclosure.** Registry row (tier 0) → prompt file (tier 1: role, workflow, output schema, limits) → `app/prompts/refs/<pack>/*.md` (tier 2, loaded only when the handler asks — how `present` defers `references/slide-types.md` and `tufte-report` defers `references/blocks.md`). Never inline a reference pack.
3. **Intermediate data contract beats free-form generation.** tufte-report's ReportData, presentation-generator's slide JSON, present's slide plan. → ASchool's rule is already codified (tool emits semantic JSON; `document_emitters.py` renders; model never emits fabric coords/HTML/PPTX — D1 §C.17.2).
4. **Hard limits + published budgets + a negotiation sentence.** tufte-report caps sections/charts/colors and says exactly what to say when the user over-asks. → Prompt files need `## Hard limits` with the caps *and* the fallback behavior ("offer a 2-tier version instead of 5").
5. **Recorded failure modes travel with the prompt.** tufte-report's Session Lessons, pdf-generation's markdown pitfalls + a deterministic fixer. → `## Known failure modes` section per tool + emitter-side sanitizers; failure modes get updated when evals fail.
6. **Deterministic lane / judge lane, fresh context, calibrated language.** whitepaper-audit's two lanes, "never judge a document you wrote in the same context", "needs verification never 'factually wrong'". → `paper_moderation`, `integrity_check`, and all grading tools; planted-defect gold sets as pass criteria.
7. **Deterministic work goes to scripts/handlers.** presentation-generator renders via JS; typography forbids hand-edits ("run the script"); whitepaper-audit lane 1 is stdlib-only. → D1 adoption #4 verbatim: "the model never computes a number we can compute" (marks sums, NEB grades, BS dates, blueprint coverage, question counts — handlers at workbench_seed `handler_name`).
8. **Eval-first for judgement tools, with a cost cap confirmed up front.** rag-eval's $2 default halt + ≥10-pair gold set; whitepaper-audit's planted defects + clean control. → `backend/tests/ai_gold/<tool_key>/` for every cost-tier ≥2 tool before GA.
9. **Dual output profiles from one artifact.** present (article ⇄ slides), pdf-generation (A4 print ⇄ mobile 6×9). → deck ⇄ handout_from_deck from one deck JSON; print A4 vs phone-readable writer profiles.
10. **Sync state for bilingual assets.** i18n-studio's pending/accepted states + "placeholders are sacred". → CI gate on `_{en,ne}.md` pairs: NE goes stale when EN changes; schema placeholders/keys are never translated.
11. **Anti-slop style bans stated concretely.** present's list of AI-looking patterns to avoid + what to use instead. → put concrete bans (not "be engaging") into deck/writing prompts.
12. **Idempotence and repair over perfection.** typography's idempotence rule, pdf-generation's fix_markdown.py, presentation-generator's "always preview before export". → emitters sanitize; UI shows a live preview (writer2/editor) before export; a second render pass must not change output.
