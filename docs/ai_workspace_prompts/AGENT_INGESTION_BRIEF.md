# AGENT INGESTION BRIEF — CDC/NEB Corpus → AI-Workspace DB (v2.0)

> **This file is the task brief.** Paste it (or point the agent at it) as the working instruction for
> **Claude Code** or **Gemini Code**. The agent reads every PDF in the corpus, structures the content,
> self-verifies, and inserts into the database through the loader CLI. The DB must end up containing
> the **full verbatim text content** of every book — page images are provenance metadata, not the
> content. Printed question papers must be reproduced as organized structured data (question numbers,
> groups, marks, sub-parts, answers) exactly enough to reprint the original paper.
>
> Companion references (read-only, follow them):
> - `docs/ai_workspace_prompts/EXTRACTION_PROMPT_PACK.md` — the per-page extraction discipline
>   (Universal Preamble, PROMPT A/B/C/D, JSON contracts). Its rules are binding.
> - `docs/AI_WORKSPACE_FINAL_PLAN_2026-09-10.md` — architecture and storage spine.

---

## 0. MISSION

Ingest the CDC/NEB Nepal textbook corpus at `/home/bishal-regmi/Desktop/ASchool/nepal_textbooks/`
into the platform database so that every AI tool (tutor, question-paper generator, lesson planner,
adaptive learning) is grounded in the **complete printed text** of the books, with zero fabricated
content and zero silent omissions.

Three kinds of sources, three structured outcomes:

| Source kind | Outcome in DB |
|---|---|
| Student textbook | `content_sources` → `content_units` (chapters/sections) → `content_chunks` (every printed block, verbatim) |
| Teacher guide | Same spine, plus blocks with `audience: "teacher"` (notes, answers, pedagogy, misconceptions) |
| Question resource — specification grid (विशिष्टीकरण तालिका) | `content_sources` + `paper_blueprints` rows (unit × question-type × marks × count × Bloom, as printed) |
| Question resource — model questions / SEE / NEB / board / past papers | `content_sources` + `question_papers` + `paper_questions` (the organized verbatim archive) |

## 1. ENVIRONMENT (verify before the first book)

- Repo root: `/home/bishal-regmi/Desktop/ASchool`; backend venv: `backend/.venv/bin/python`.
- Database: read `DATABASE_URL` from `backend/.env` (or the environment). Never connect to any other
  database. Never run destructive SQL (`DROP`, `TRUNCATE`, `DELETE` outside the loader).
- Loader CLI (built in S12): `cd backend && .venv/bin/python -m app.content_loader --help`
  Subcommands: `validate <book_dir>` (contract checks only), `ingest <book_dir>` (schema-validate →
  idempotent upsert → embed → BM25 index → manifest), `status [book_slug]` (ledger).
  If the loader is not yet built, STOP after staging and report — never hand-write SQL inserts.
- Rendering: `pdftoppm -png -r 200 <pdf> <dir>/p` (300 DPI only for spec-grid/dense pages, cropped).
- Page reading: use your vision on the rendered PNG for **any** page whose extracted text layer is
  Preeti-mojibake (test with `backend/app/utils/preeti_transcoder.py::is_preeti_encoded`) or that is
  scanned. Use the text layer directly ONLY when it is clean Unicode (many English books) — and even
  then verify structure visually on heading/exercise pages.

## 2. GOLDEN RULES (violating any one invalidates the run)

1. **Verbatim fidelity is the product.** Transcribe exactly what is printed. Never correct spelling,
   normalize variants (अंग्रेजी/अङ्ग्रेजी), reorder, punctuate, translate, summarize, or complete.
   Devanagari numerals stay Devanagari in `*_printed` fields; ASCII mirrors go in `*_ascii` fields.
2. **Never guess.** Illegible → `[illegible]`. Cut off at page edge → transcribe the visible part and
   set `continues_next: true`. An honest `[illegible]` passes review; an invented word fails the book.
3. **Math is LaTeX**, wrapped `$...$`, exactly as printed (units, equal signs, no simplification).
4. **Provenance on everything**: every block and every question carries `page_no` (physical),
   `bbox` ([ymin,xmin,ymax,xmax] 0–1000), and the artifact is keyed by
   `sha256(page_image) + prompt_version + model_id`. Re-runs must be safe (idempotent natural keys,
   upsert semantics) — never duplicate by re-running.
5. **One book at a time**, staged under `staging/<book_slug>/` (`g10-science-ne-2082` naming),
   subfolders `pages/ extract/ verified/ flagged/`. A book is either COMPLETE (manifest gates pass →
   `ingest`) or clearly marked INCOMPLETE in the ledger. Never leave half-staged books unrecorded.
6. **Contracts over vibes**: every JSON you stage must match the schemas in the prompt pack
   (`aw-book-manifest@1`, `aw-page@1`, `aw-verify@1`, and `aw-question-paper@1` below). The loader
   rejects schema violations — treat a rejection as a bug in your output, and fix the output, never
   the schema.
7. **The prompt pack's Universal Preamble rules apply to every page you read**, whether you read via
   vision or text layer.
8. **No scope drift**: do not "improve" content, add study tips, reorder chapters, or resolve
   contradictions between print and the TOC — record contradictions in `notes`.

## 3. PER-BOOK WORKFLOW (textbook or teacher guide)

```
1. REGISTER   compute pdf sha256; if the slug already shows published/complete in `loader status`,
              skip. Classify kind: textbook | teacher_guide | spec_grid | model_question | past_paper
              (from directory + cover page).
2. RENDER     pages → staging/<slug>/pages/ (200 DPI PNG).
3. PASS A     structure map: read cover + TOC + ≤8 spread pages → aw-book-manifest@1 JSON.
              Human-readable sanity check: chapter count and page ranges must be consistent
              (monotonic, covering all content pages). Fix operator-level facts (slug, edition)
              in the manifest file, never by re-prompting around contradictions.
4. PASS B+C   for EVERY content page: extract (aw-page@1) then self-verify (aw-verify@1 →
              `verified/page_<NNN>.json`). Respect the position-context discipline from the pack
              (previous page's ending state, exercise continuity).
5. GUARDS     run `loader validate <book_dir>`; move failures to flagged/ and re-do those pages
              (at 300 DPI for dense failures). Guard list: coverage ratio vs text-layer/vision
              char count (0.75–1.35), output-length anomaly (>2.5× book median), exercise-number
              continuity vs manifest, bbox sanity, schema conformance.
6. AUDIT      run the judge discipline (PROMPT D) — with the OTHER model family if available — on
              flagged pages + 10% random sample. `fix` verdicts re-run B+C once; `escalate`
              verdicts go to the human queue with your note.
7. INGEST     `loader ingest <book_dir>` → manifest written, book → reviewed; publishes
              automatically only when gates pass (≥98% pages, 100% exercise numbers, 0 flagged).
8. LEDGER     `loader status` — record book completion in your progress notes with: pages, blocks,
              exercises, figures, flags, remaining [illegible] count.
```

**Chapter-level assembly**: after all pages of a unit pass, assemble the unit tree
(`unit_path = ch<ordinal>/<section ordinal>`), title chains (`Book › च.३ बल › ३.२ न्युटनको दोस्रो
नियम`), per-section summaries (2–3 sentences, ne+en) and key-concept lists — all **from the
extracted blocks themselves**, so retrieval chunks later carry real context.

## 4. QUESTION RESOURCES — full organization (this is a first-class deliverable)

### 4.1 Specification grids (विशिष्टीकरण तालिका)

Read every grid page at 300 DPI. Emit `paper_blueprints` staging JSON:

```json
{
  "schema_version": "aw-spec-grid@1",
  "source_slug": "g6-8-math-spec-grid-2080",
  "paper": { "title_ne": "...", "grade_range": "6-8", "subject_en": "Mathematics",
             "exam_year_bs": "2080", "total_full_marks": 100, "duration_minutes": 180 },
  "cells": [
    { "group_name": "समूह 'क'", "question_type": "long_answer",
      "unit_no_ascii": 3, "unit_title_as_printed": "बल",
      "bloom_level": "application", "question_count": 2, "marks_each": 8,
      "notes_as_printed": "..." }
  ],
  "page_provenance": [{ "page_no": 4, "bbox": [80,60,940,700] }]
}
```

Every cell is **as printed** — never compute totals or infer missing cells; record gaps in `notes`.

### 4.2 Model questions / SEE / NEB / past papers

Emit `aw-question-paper@1` — the archive must be able to **reprint the paper**:

```json
{
  "schema_version": "aw-question-paper@1",
  "source_slug": "see-2081-model-math",
  "paper": { "paper_kind": "model_question|see|neb|board|school_exam",
             "title_ne": "...", "title_en": "...",
             "exam_year_bs": "२०८१", "exam_year_ad": 2025,
             "grade": "10", "subject_en": "Compulsory Mathematics",
             "total_full_marks": 75, "duration_minutes": 180,
             "instructions_verbatim": ["...every instruction line printed on the paper..."] },
  "groups": [
    { "group_name": "समूह 'क'", "group_marks": 16,
      "questions": [
        { "question_no_printed": "१", "question_no_ascii": 1,
          "question_type": "mcq", "marks": 1, "marks_printed": "१",
          "stem_ne": "सही उत्तर छान्नुहोस् … (verbatim)",
          "options": [{"label": "(क)", "text_ne": "..."}, ...],
          "answer_ne": null, "answer_source": "none",
          "unit_hint": "अन्तर पत्ता लगाउने विधि (as printed, else null)",
          "sub_parts": [] },
        { "question_no_printed": "९", "question_no_ascii": 9,
          "question_type": "long_answer", "marks": 4, "marks_printed": "४",
          "stem_ne": "... (verbatim)",
          "sub_parts": [
            { "sub_label": "(क)", "marks": 1, "stem_ne": "... (verbatim)" },
            { "sub_label": "(ख)", "marks": 3, "stem_ne": "... (verbatim)" }
          ],
          "answer_ne": "...(only if printed on the page or in an answer-key section)",
          "answer_source": "printed|answer_key|none" }
      ] }
  ],
  "page_provenance": [{ "page_no": 1, "bbox": [...] }]
}
```

**Organization rules (enforced by the loader):**
- Hierarchy: paper → groups (as printed, e.g. समूह क/ख/ग) → questions → sub_parts. Question numbers
  are **as printed** in both numeral systems; within a group they must be contiguous — a jump is a
  guard failure (re-read the page before accepting).
- Marks are **as printed only**. If a sub-question carries its own printed marks, use them; if the
  parent shows one total, put it on the parent and null on parts.
- MCQ options verbatim with their printed labels; answers ONLY when actually printed (paper, model
  answer section, or companion answer-key book — in which case `answer_source: "answer_key"` and the
  key's own page goes in provenance). NEVER derive or solve an answer.
- Every question keeps `unit_hint` when the paper prints a chapter/unit reference; when the paper is
  a model set for a spec grid, set `blueprint_cell_id` candidates in `notes` (the loader links them
  after blueprints are stored).
- Figures inside questions: `has_figure: true` + `figure_bbox` + verbatim caption; never describe.

### 4.3 Answer-key companions

If a book/section is an answer key (e.g., teacher guides with solutions), ingest it the same way and
link by `question_no_ascii` + paper title match; store each solution verbatim with
`answer_source: "answer_key"` and its own page provenance. Never merge answers into questions you
are not certain are the same item — an unmatched answer stays in `notes`.

## 5. TEACHER-GUIDE specifics

Same spine as textbooks, with these block conventions: teaching notes → `kind: "note"`,
`audience: "teacher"`; period plans → `kind: "activity"`; answers to textbook exercises →
`kind: "answer"` with `ref_textbook_unit` + `ref_exercise_no` when the guide states them;
misconception warnings → `kind: "note"` + `misconception: true`. Teacher guides never overwrite
textbook chunks — separate `content_sources` row.

## 6. VERIFICATION PROTOCOL (per page, non-negotiable)

1. **Self-reread** (PROMPT C): re-read the page image against your own JSON; fix omissions,
   matra/conjunct errors, structural mistakes, fabrications; output `aw-verify@1`.
2. **Guards** (mechanical, via `loader validate`): coverage ratio, output-length anomaly, exercise
   continuity, bbox sanity, schema conformance. Failures → flagged → redo at 300 DPI.
3. **Cross-audit** (PROMPT D): other model family if available, else a second independent pass of
   the same agent with fresh eyes on flagged + 10% sample. Verdict `accept|fix|escalate`.
4. **Sample self-check for Devanagari fidelity**: for each book, personally re-read 5 random page
   images character-by-character against the staged JSON (matras and conjuncts included) and log
   the result in the ledger. If you find >2 character errors on 5 pages, re-verify the whole book
   before ingesting.

## 7. SCALE & ORDER

1. Pilot: `Grade_10` Science + Math (one NE, one EN-medium if available) — the founder reviews these
   end-to-end before you continue.
2. Then grade-by-grade: 10 → 9 → 8 → … → 1 → 11 → 12, textbooks before teacher guides before
   question resources within each grade, so tools light up grade-by-grade.
3. Process books strictly one at a time; after each book, the ledger must show its state. If a
   session is interrupted, `loader status` + the staging folder is the source of truth — resume where
   it says, never from memory.
4. Catalog duplicates (same book, multiple editions): ingest the newest; mark older editions
   `replaces_source_id` at registration, not after.

## 8. DEFINITION OF DONE (per book)

- `loader status` shows: `published` (or `reviewed` with explicit human-queue items listed),
  pages_extracted/total ≥ 98%, exercise-number reconciliation 100%, figures detected listed,
  `[illegible]` count reported, zero unresolved flags.
- For question resources: the archive JSON prints back the paper 1:1 (numbers, groups, marks,
  options, instructions all as printed), loader-validated.
- Ledger entry appended with the book slug, prompt_version, model_id, and statistics.

**You are the extractor and the first reviewer — the schema, the loader, and the human are the
safety net. When in doubt, re-read the page. Never invent.**
