# Extraction Prompt Pack — AI-Workspace Content Ingestion (v1.0)

> Companion to `docs/AI_WORKSPACE_FINAL_PLAN_2026-09-10.md`. You (the operator) run these prompts
> model-by-model against page images. The codebase only *validates and stores* what passes — all
> intelligence lives here.
>
> - **Extractor**: Gemini 2.5 Flash / Gemini 3 Flash (`temperature: 0–0.2`, `media_resolution: high`,
>   `responseSchema` = the JSON contract below, Batch API for bulk at −50%).
> - **Judge**: Claude Sonnet 5 (structured outputs ON).
> - **Anchor** (optional but recommended): Mistral OCR 4 — Nepali supported; gives per-page char counts
>   + block boxes used by the coverage guard.
> - **Never send the PDF itself** — its embedded text layer is Preeti-legacy mojibake and will poison
>   output. Send rendered page images only.
> - Every artifact is keyed by `schema_version` + `prompt_version` + `model_id` + `sha256(page_image)`.
>   Re-runs are always safe; never reuse outputs across prompt versions.

---

## 0. Operator runbook

1. **Render** (per book, once):
   ```bash
   mkdir -p staging/<book_slug>/{pages,extract,verified,flagged}
   pdftoppm -png -r 200 "book.pdf" staging/<book_slug>/pages/p
   # 200 DPI is the sweet spot (A4 → ~1654×2339 px). Use 300 DPI only for
   # spec-grid / dense-annotation pages, cropped.
   sha256sum book.pdf > staging/<book_slug>/pdf.sha256
   ```
   `<book_slug>` = `g10-science-ne-2082` (grade-subject-language-edition).
2. **Pass A — structure map** (1 call for the whole book): attach cover + TOC images + up to 8 spread
   pages → `PROMPT A` → save response to `staging/<book_slug>/manifest.json`.
   Read it. Fix anything obviously wrong (grade, subject, chapter titles) **in the file, not by
   re-prompting** — this manifest is the contract for every later pass.
3. **Pass B — page extraction**: for each page, one call with the page image + a one-line position
   header you paste from the manifest (`PROMPT B` + `POSITION CONTEXT`). Save each response to
   `extract/page_<NNN>.json` (3-digit, 1-based physical page). Batch API: build requests with the
   same messages; keys = `page_<NNN>`.
4. **Pass C — self-verification**: for each page, call the same model again with the page image +
   its Pass-B JSON (`PROMPT C`). Save to `verified/page_<NNN>.json` (this file, not Pass B, goes to
   staging for the loader).
5. **Guards (mechanical)**: run the loader's `validate` mode (or the quick checks below). Pages that
   fail → move their `verified/` JSON to `flagged/`.
   - coverage ratio = Devanagari+ASCII char count of `text` blocks ÷ Mistral-OCR char count for the
     page; flag outside 0.75–1.35.
   - output-length anomaly: page JSON > 2.5× the book median → flag (repetition-loop guard).
   - exercise numbers in the page must be contiguous and inside the chapter's expected range from the
     manifest.
   - every block must have a non-degenerate `bbox` (area > 0, inside 0–1000).
6. **Pass D — judge** (Claude Sonnet 5): all `flagged/` pages + a 10% random sample of the rest →
   `PROMPT D`. Judge `verdict: "fix"` pages go back through Pass B/C once at 300 DPI; still failing →
   human review queue.
7. **Human review**: the loader's review page shows page image + blocks with bbox highlighting.
   Approve per page. 100% review for your first 2–3 books; ~10% after prompts stabilize.
8. **Store**: run the loader `ingest` on the book folder. It validates schema → upserts idempotently →
   embeds → BM25-indexes → writes the coverage manifest → publishes when gates pass.

**Cost rule of thumb** (Gemini Flash, 200 DPI image @1120 tok + ~350 prompt + ~1,200 output):
≈ $0.006/page standard, ≈ $0.003 batch; a 300-page book ≈ $1.7 standard / $0.85 batch, per pass.
Pass C doubles extraction cost; judge adds ~$0.008/page on sampled pages.

---

## 1. Universal preamble — paste at the top of EVERY extraction/verification call

```
You are a professional educational-content transcription and structuring engine working for a
Nepal school platform. You will be shown scanned page images of official CDC/NEB (Nepal)
school textbooks or teacher guides. The printed pages may be in Nepali (Devanagari script),
English, or both.

ABSOLUTE RULES — violating any of these makes your output unusable:

1. TRANSCRIBE VERBATIM. Copy text EXACTLY as printed. Do NOT correct spelling, do NOT normalize
   spelling variants (e.g., अंग्रेजी / अङ्ग्रेजी), do NOT reorder items, do NOT add or remove
   punctuation, do NOT convert between Devanagari and Arabic numerals.
2. NEVER GUESS. If a word/number is illegible or cut off at the page edge, write [illegible] in
   its place. If a figure contains text you cannot read, transcribe what you can and mark the
   rest [illegible]. An honest [illegible] is acceptable; an invented word is not.
3. Devanagari numerals (०१२३४५६७८९) stay Devanagari in the transcribed text. Where the page
   prints a number that matters structurally (exercise numbers, question numbers, page numbers,
   marks), ALSO provide it as ASCII digits in the dedicated *_ascii field.
4. Mathematics: wrap every mathematical expression, equation, or formula in $...$ using LaTeX.
   Transcribe symbols and units EXACTLY as printed (e.g., $9.8 \text{ m/s}^2$). Keep the
   printed equal signs. Do not simplify, solve, or re-derive anything.
5. Output ONLY the JSON object matching the provided schema. No markdown fences, no commentary,
   no keys outside the schema. Every string field: actual content, never placeholders like
   "same as above".
6. Ground every block: bbox = [ymin, xmin, ymax, xmax], integers 0–1000, normalized to the full
   page image, tight around the block's printed extent. Every block must carry the bbox of the
   region it transcribes.
7. Do not describe, summarize, interpret, or answer any content you transcribe. Your job is
   faithful structural transcription, not comprehension.
8. The page may contain headers/footers/page numbers printed by the publisher — put them in the
   `page_furniture` field, never inside content blocks.
9. Text direction and reading order: transcribe in printed reading order. For two-column layouts,
   finish column 1 before column 2, and say so via `column` (1|2).
10. If the page is a continuation of an exercise set or table from the previous page, set
   `continues_previous: true` and transcribe only what this page prints.
```

---

## 2. PROMPT A — Structure discovery (1 call per book; input: cover + TOC + ≤8 spread pages)

```
[PASTE UNIVERSAL PREAMBLE]

TASK: Build the STRUCTURE MAP of this book from the attached cover page, table of contents page(s),
and sample content pages. This map becomes the extraction contract for every page of the book, so
completeness and correct page ranges matter more than prose detail.

From the images, determine:
- book: title (exactly as printed, both languages if present), subject, grade/level, medium
  language(s), edition/year ( Bikram Sambat वि.सं. and/or A.D.) as printed, publisher.
- board/format: CDC basic (1–8), CDC secondary (9–10), NEB (11–12), teacher guide, specification
  grid, model questions — whatever the cover states.
- units: every chapter/unit printed in the table of contents, IN ORDER, with: printed chapter
  number (keep Devanagari if printed so, plus ASCII), exact title(s) as printed (ne and/or en),
  starting page (ASCII), ending page = (next chapter's start − 1) or last content page.
- front/back matter: pages that are NOT chapters (cover, preamble, cover image pages, glossary,
  answers/answer-key sections, abbreviation lists) — list them with page ranges and kind.
- expected_exercises: for each unit, the number of exercise sets the TOC/sample pages reveal
  (best effort; write null when unknown — never guess a number).
- figures_or_tables_density: per unit, one of none|low|high (from the sample pages only).
- language_pages: whether the book is single-language or the languages alternate by unit/page.

Rules:
- Transcribe titles and numbers verbatim (Universal Rules 1–3 apply).
- Page numbers: use the PDF's PHYSICAL page numbering (1 = first image you were given is page 1;
  the operator tells you the total page count). If the book prints its own page numbers that
  differ from physical numbering, ALSO record printed_page_start per unit.
- If the TOC lists a unit whose start page contradicts the sample pages, record the contradiction
  in `notes` — do not silently fix it.

OUTPUT: exactly this JSON:
{
  "schema_version": "aw-book-manifest@1",
  "book": {
    "slug": "<leave empty — operator fills>",
    "title_ne": "... or null",
    "title_en": "... or null",
    "subject_ne": "...", "subject_en": "...",
    "grade": "<as printed, e.g. '10' or ' nursery'>",
    "medium": "ne|en|bilingual",
    "edition_bs": "<वि.सं. year as printed or null>",
    "edition_ad": "<A.D. year as printed or null>",
    "publisher": "<as printed or null>",
    "board": "cdc-basic|cdc-secondary|neb|teacher-guide|spec-grid|model-questions",
    "total_physical_pages": <operator-provided number, echo it back>
  },
  "units": [
    {
      "ordinal": 1,
      "unit_no_printed": "<e.g. '१' or '3'>",
      "unit_no_ascii": 3,
      "title_ne": "... or null", "title_en": "... or null",
      "page_start": 12, "page_end": 24,
      "printed_page_start": "१२ or 12 or null",
      "expected_exercise_sets": 2,
      "figures_or_tables_density": "low"
    }
  ],
  "front_matter": [ { "kind": "cover|preamble|toc|other", "page_start": 1, "page_end": 11 } ],
  "back_matter":   [ { "kind": "glossary|answer-key|other", "page_start": 210, "page_end": 224 } ],
  "language_pages": "single|alternating",
  "notes": ["contradictions or oddities, else empty"]
}
```

---

## 3. POSITION CONTEXT — one line you paste above each page image in Pass B/C

Build it from the manifest (this anchors the model and kills cross-chapter bleed):

```
BOOK: <title as printed> (Grade <g>, <subject>) · PHYSICAL PAGE <NNN> of <TOTAL>
(printed page <printed no> if known) · UNIT <ordinal>: "<unit title>" (pages <start>–<end>)
· <this page is inside: [prose | worked example | exercise set <k> | figure-heavy | table | answer key]>
· <previous page ended with: [mid-exercise item <no> | mid-sentence | section end | table row N]>
```

---

## 4. PROMPT B — Page extraction (1 call per page; input: 1 page image + position context)

```
[PASTE UNIVERSAL PREAMBLE]

You are given ONE page image preceded by POSITION CONTEXT describing where this page sits in the
book and what the previous page ended with.

TASK: Transcribe and structure EVERYTHING printed on this page into blocks.

Block kinds — classify each printed region into exactly one:
- "heading"        : unit/section/subsection headings as printed
- "prose"          : explanatory paragraphs (split at printed paragraph boundaries; merge a
                     paragraph that clearly continues mid-sentence onto the next ONLY if it ends
                     this page — else mark continues_next)
- "definition"     : boxed or explicitly marked definitions / "याद राख्नुहोस्" / "Remember" boxes
- "worked_example" : solved examples — transcribe the problem statement, the given steps in order
                     (each step its own item), and the final answer, exactly as printed
- "exercise_set"   : the exercise heading + instruction line; each numbered item is one
                     exercise_item block (see below)
- "exercise_item"  : ONE numbered question/sub-question exactly as printed, with its marks if
                     printed; group letters (क), (ख), (a), (b) go in `sub_label`
- "formula_block"  : a displayed (set-off) equation or formula, LaTeX per Universal Rule 4
- "figure"         : a diagram/image/graph/map — bbox of the printed artwork + the printed caption
                     verbatim in `caption`; DO NOT describe what the figure depicts
- "table"          : printed tables as cell JSON: rows of cells, verbatim cell text, merged cells
                     repeated where printed; never convert to prose
- "activity"       : boxed activities/projects/practicals
- "note"           : margin notes, footnotes, "नोट" boxes
- "answer"         : answers to exercises (in answer-key books/pages)

Every block carries:
  block_id (b1, b2, … in reading order), kind, bbox, column (1|2|null),
  text_ne (exact Devanagari transcription or null),
  text_en (exact English transcription or null),
  continues_next (bool), continues_previous (bool),
  formula_latex (array of $...$ strings, only for worked_example/formula_block/exercise_item
  when the item contains math),
  numbers_ascii (all numerals appearing in this block as ASCII digits, array).

Exercise discipline:
- Copy exercise numbers EXACTLY as printed in `item_no_printed`; also give `item_no_ascii`.
- Preserve sub-question structure: an item with parts (क)/(ख) stays ONE exercise_item with
  `sub_items[]`, each carrying its own sub_label, text, and marks.
- If an exercise item is cut off at the bottom of the page: transcribe the visible portion,
  set continues_next=true. Never invent the missing part.

Also extract, from the WHOLE page (these are additive, not blocks):
- "contextualizer_note": one sentence (≤ 30 words) in English situating this page — used to
  prefix retrieval chunks, e.g. "Worked examples on Newton's second law within the Force
  chapter, Grade 10 Science." Pure description; no interpretation.
- "section_heading_path": the chain of headings visible on this page, e.g. ["बल", "३.२ न्युटनको
  दोस्रो नियम"].
- "key_concepts": up to 8 technical terms printed on this page, verbatim, with English gloss
  when the page itself provides one.
- "page_furniture": running header/footer/page-number text as printed (or empty strings).
- "exercises_seen": [{item_no_ascii, has_sub_items, marks_ascii_or_null}] — every exercise item
  visible, even if cut off.
- "figures_seen": [{caption_verbatim_or_null, bbox}] — every printed artwork region.

OUTPUT: exactly this JSON:
{
  "schema_version": "aw-page@1",
  "page_no_physical": <echo from context>,
  "continues_previous": <bool>,
  "blocks": [ ... as specified above ... ],
  "contextualizer_note": "...",
  "section_heading_path": ["...", "..."],
  "key_concepts": [{"term_ne": "...", "term_en": "... or null"}],
  "page_furniture": {"header": "...", "footer": "...", "printed_page_no": "..."},
  "exercises_seen": [...],
  "figures_seen": [...]
}
```

**Spec-grid / model-question pages** (board books): use the same prompt but add:

```
SPECIAL: this page contains a specification grid or model-question table. Transcribe it as
"table" blocks with EVERY cell verbatim (row × column), including marks and Bloom-level
columns exactly as printed. Do not compute totals; if a printed total looks wrong, transcribe
it as printed and add a note in `notes` at top level.
```

---

## 5. PROMPT C — Self-verification (same model, 2nd call per page)

```
[PASTE UNIVERSAL PREAMBLE]

You previously transcribed the attached page into the JSON below. Now VERIFY it against the
image like a hostile proofreader, then output the corrected JSON.

Check, in this order:
1. OMISSIONS: any printed line, item, sub-item, row, label, caption, or numeral missing from the
   JSON (the most common failure).
2. CHARACTER FIDELITY: wrong matras, broken conjuncts (हलन्त errors), wrong or normalized
   spellings, Devanagari numerals converted to ASCII inside transcribed text, "helpfully"
   corrected words.
3. STRUCTURE: blocks misclassified (e.g., a worked example labeled prose), exercise items split
   or merged incorrectly, sub_items flattened, table cells lost, blocks in wrong reading order.
4. MATH: LaTeX that does not match the printed expression (dropped minus signs, changed units,
   re-flowed fractions), unbalanced $.
5. FABRICATION: anything in the JSON that is NOT printed on the page — delete it. Including
   "smart" completions of cut-off text.
6. BBOXES: each bbox tightly covers the printed region it claims; fix grossly wrong ones.

OUTPUT: exactly this JSON:
{
  "schema_version": "aw-verify@1",
  "page_no_physical": <echo>,
  "discrepancies": [
    {"type": "omission|character|structure|math|fabrication|bbox",
     "where": "block_id or region description",
     "was": "...", "now": "..."}
  ],
  "corrected": { ...the full aw-page@1 JSON, corrected... },
  "self_confidence": "high|medium|low",
  "low_confidence_reason": "required when medium|low"
}

Rules: `corrected` must always be the COMPLETE page JSON (not a diff). If you find no issues,
`discrepancies` is empty and `corrected` equals the input (minus nothing). Never improve,
translate, or complete the content itself — fidelity to print is the only goal.
```

---

## 6. PROMPT D — Cross-model judge (Claude Sonnet 5; input: page image + verified JSON)

```
You are an independent extraction auditor. You will see ONE scanned textbook page image and a
JSON transcription of it produced by another AI system. The page may be in Nepali (Devanagari),
English, or both. Audit the JSON against the image.

Score and report — do NOT trust the JSON; re-derive from the image:

1. verbatim_fidelity (1–5): 5 = every printed character accounted for; 1 = substantial
   fabrication or loss. Judge Devanagari carefully (matras, conjuncts, numerals).
2. missing: list of every printed line/item/cell absent or truncated in the JSON (quote the
   printed text verbatim).
3. invented: list of every JSON string with no printed counterpart (quote it).
4. structure_errors: misclassified blocks, broken exercise numbering, table cell loss,
   reading-order mistakes.
5. math_errors: LaTeX vs print mismatches.
6. coverage_ratio_estimate: printed-character volume vs transcribed-character volume, as a
   rough percentage.

OUTPUT (strict JSON):
{
  "schema_version": "aw-judge@1",
  "page_no_physical": <echo if visible, else null>,
  "verbatim_fidelity": 1-5,
  "coverage_ratio_estimate": 0.0-1.5,
  "missing": ["..."],
  "invented": ["..."],
  "structure_errors": ["..."],
  "math_errors": ["..."],
  "verdict": "accept | fix | escalate",
  "reason": "one sentence"
}

verdict rules: accept ⇒ fidelity 5 and no missing/invented; escalate ⇒ you cannot read the
region well enough to judge; otherwise fix. Never fix the JSON yourself — audit only.
```

---

## 7. Storage contract (what the loader enforces — no surprises)

- Natural keys: units `(source_id, unit_path)`; chunks `(source_id, unit_path, ordinal)`;
  exercises `(source_id, unit_path, item_no_ascii, sub_label)`. Upserts are idempotent — re-running
  a book overwrites only where `sha256(normalized_text)` changed.
- Every chunk stores: `text_display` (verbatim), `text_embed` (`title_chain ▸ contextualizer_note
  ▸ text`), `page_no`, `bbox`, `prompt_version`, `model_id`, `extraction_run_id`,
  `sha256`, `kind`, `language`, `status`.
- Publish gate (automatic): ≥98% of the book's physical pages present; every `exercises_seen`
  number from the manifest's expected ranges accounted for; 0 unresolved `flagged` pages;
  manifest coverage ≥ thresholds. Otherwise the book stays `reviewed`, never `published`.
- Page images are content-addressed (`pdf_sha256/page_<NNN>.png`) and kept — citations render
  bbox highlights from them.
- Unicode: NFC normalize + fixed ZWNJ policy on store and on query (same normalizer both sides).

## 8. Prompt-version discipline

This file is `prompt_version = "v1.0"`. Any change to a prompt's wording ⇒ bump to v1.x and
re-extract affected pages (idempotent keys make re-runs safe). Never mix outputs from different
prompt versions inside one book's staging folder.
