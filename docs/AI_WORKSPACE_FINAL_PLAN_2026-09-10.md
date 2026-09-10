# AI Workspace — FINAL Architecture & Execution Plan (2026-09-10)

> Supersedes the *ingestion* portion of Master-Plan P-D (`MASTER_PLAN_2026-09-10_FULL_PLATFORM_V2.md`).
> Storage spine, retrieval, tool-wiring, and sprints remain; the extraction pipeline changes from
> scripted parsing to **human-operated vision-LLM extraction** (founder runs the model with the prompt
> pack; code only validates and stores).
> Evidence base: two dedicated research waves (2026-09-10) — Devanagari OCR-VLM benchmark arXiv 2606.29213,
> Anthropic Contextual Retrieval, title-chain chunking arXiv 2608.00824, Nepali RAG studies arXiv 2606.07523
> / 2603.13320, HippoRAG 2, KAQG, EduGuard, RAGAS/DeepEval, live vendor pricing. Details in chat log;
> sources mirrored inline below where they drive a decision.

---

## 1. Prime directive

Every claim any AI tool makes must be **traceable to a printed page region** — chunk → page image →
bounding box. "No data mismatch" is enforced by *checkable contracts* (schemas, hashes, coverage
manifests, golden-set gates), never by trust.

## 2. What changed vs the old P-D, and why (evidence)

| Decision | Old P-D | Final | Evidence |
|---|---|---|---|
| Extraction | PyMuPDF + Preeti transcoder + heuristics | **Vision-LLM, prompt-operated, page-by-page** | Text layer is Preeti mojibake; Devanagari benchmark shows rendered-glyph reading is the reliable modality; mojibake text layer must not even enter the prompt |
| Extractor model | generic | **Gemini Flash family** (2.5 Flash proven chrF++ 86.3 on real Devanagari scans — best of 10 systems; GPT-5.x collapses to 58.5, olmOCR 40.5) | arXiv 2606.29213 |
| Verification | QA flags | **3-layer**: deterministic guards + model self-reread + cross-model judge (Claude Sonnet 5), Mistral OCR 4 as char-count anchor | Benchmark's verbatim protocol; DeepSeek-OCR repetition-blowup lesson → output-length guard |
| Input format | native PDF | **200 DPI page images only** (never the PDF: its text layer is corrupt and would pollute context) | research §5 |
| Chunking | 400–800 tok | **Structure-first blocks from the extraction JSON** + title-chain prefix + 1–2 sentence contextualizer note (−49% retrieval failures; +23.8% MRR@5) | Anthropic; arXiv 2608.00824 |
| Embeddings | AITokenHub 1024-d | **BGE-M3 1024-d (self-host) dense + sparse**, one bilingual space; BM25 stays a *primary* leg for Nepali (BM25 91% vs mE5 75% P@1 on Nepali legal text; hybrid wins) | arXiv 2606.07523, 2603.13320 |
| Reranking | none | **bge-reranker-v2-m3 top-50→top-12** (largest runtime ROI; −67% failures with rerank) | Anthropic measurement |
| Graph layer | skip | **Human-curated outcome DAG + HippoRAG-lite PPR expansion** (not Microsoft GraphRAG) | HippoRAG 2 +7%; ALEKS knowledge-space |
| Question engine | model sets | **Blueprint-cell binding as DB constraint** + misconception-based distractors + hash/cosine dedup gate + teacher review lifecycle | KAQG; distractor literature |
| Grounding UI | citations column | **NotebookLM-style: every tutor answer cites chunk → highlighted bbox on page image** | EduGuard; product requirement |
| Eval | acceptance list | **Golden set per grade×subject (50 items, NE/EN mix) + CI gates** (recall@20 ≥0.95, groundedness ≥0.90, NE-gap ≤10 pts) | RAGAS/DeepEval practice |

## 3. The extraction pipeline (founder-operated)

```
PDF ──pdftoppm 200dpi──► page images ──► PASS A (structure map, 1 call/book)
                                             │  book manifest JSON = extraction contract
                                             ▼
        PASS B per page (Gemini Flash, image + position context + schema)
             ├──► page JSON (blocks, bbox, verbatim NE/EN, LaTeX, exercises)
             ├──► Mistral OCR 4 anchor (char-count + confidence + block boxes)   [cheap]
             └──► PASS C self-reread (same page + own JSON → corrected JSON + discrepancies)
                        │
                        ▼
        deterministic guards (coverage ratio, length anomaly, exercise-count vs manifest,
                              structural-error regexes, bbox-emptiness, schema validation)
                        │  flag
                        ▼
        PASS D judge = Claude Sonnet 5 (all flagged + 10% sample; chrF++ per page vs extractor)
                        │
                        ▼
        human review queue (bbox-highlighted side-by-side) ──► staging folder
                        │
                        ▼
        THIN LOADER (the only code): schema-validate → idempotent upsert on natural keys
        (source_id, unit_path, ordinal) → draft → embed (BGE-M3) + BM25 index → reviewed
        → manifest gate (≥98% pages, 100% exercise numbers) → published snapshot
```

- **Model assignments**: extraction = Gemini 2.5/3 Flash (A/B on 20 pilot pages; loser becomes consensus voice; ~5% hardest pages escalate to Gemini Pro); self-reread = same model; judge = Claude Sonnet 5 (structured outputs, constrained decoding); anchor = Mistral OCR 4 (Nepali officially supported, $1/1k pages, gives confidence scores + block boxes); optional free third voice = Qwen3-VL-8B self-hosted.
- **Cost (whole 656-file corpus ≈ 195k pages)**: ≈ **$1,700–2,500 one-time** all layers (batch −50%), ~8–12% of pages human-touched. Pilot (2 books) ≈ $5–10.
- **Prompt pack**: `docs/ai_workspace_prompts/EXTRACTION_PROMPT_PACK.md` — runbook + 4 prompts + JSON contracts. The founder runs it model-by-model; outputs land in a staging folder; no parsing code exists anywhere.

## 4. Storage spine (final schema deltas on top of P-D §P-D.1)

- `content_sources` — as planned + `pdf_checksum`, `page_image_dir`.
- `content_units` — as planned + `unit_path` ("ch3/3.2"), `title_chain` (Book › Ch.3 › 3.2 Force), `section_summary_ne/en`, `key_concepts` jsonb.
- `content_chunks` — as planned, plus the decisive split:
  - `text_display` (clean verbatim, shown to users),
  - `text_embed` (title-chain prefix + contextualizer note + text — what embeddings *and* BM25 index),
  - `contextualizer_note` (1–2 sentences, produced free inside the extraction pass),
  - `page_image_id`, `bbox` (0–1000 normalized), `page_no`, `extraction_run_id`, `prompt_version`, `model_id`, `sha256(normalized_text)`, `embedding_model`, `embedding vector(1024)`, `sparsevec`, `language`,
  - `status draft→reviewed→published(immutable snapshot)`, `superseded_by`.
- `extraction_runs` — per book: prompt_version, model, **coverage manifest jsonb** (pages, exercises detected/expected, figures, formulas, failures). Publishing is gated on the manifest — "the book is fully in" becomes a query, not a feeling.
- Curriculum graph: `learning_outcomes` (real CDC), `outcome_prereq` DAG (human-curated, few hundred edges/subject), `unit_outcome`, `mastery_state(student, outcome, p_known)`.
- `question_bank_items` — as P-D + `blueprint_cell_id` (NOT NULL for generated items — mismatch becomes a constraint violation), `evidence_chunk_id` (answer traceable to a published chunk), `stem_hash` + `stem_embedding` (dedup gate: hash + cosine ≥0.90 within grade+subject), `status ai_draft→auto_checks→teacher_review→published`, `distractor_meta` (misconception-based).
- `golden_sets` + `eval_runs` — the regression harness.
- Existing tables that survive unchanged: `document_chunks` (dual-write target for RAGService compat), `paper_blueprints`/`generated_papers` (+set fields from P-D), `teaching_sections` (+`content_unit_id` FK).

Unicode contract: NFC normalization + ZWNJ policy enforced in the loader; identical normalizer runs on queries (double-encoding is the #1 silent mismatch).

## 5. Retrieval (one endpoint, tool-tunable)

`filters first (grade, subject, unit?, kind?, lang, status=published)` → hybrid:
pgvector HNSW (dense) ∥ BM25 (existing tsvector now; ParadeDB `pg_search` when convenient) → RRF k=60
(keep existing `RAGService` fusion) → **rerank top-50→12 (bge-reranker-v2-m3)** → **CRAG evaluator**
(LLM scores retrieved set; low ⇒ bounded retry with NE↔EN query variants / widened filters) →
**token-budgeted assembly** (chunks + parent frame + 1-hop prerequisite recap) → response with
citation refs. Nepali queries get cross-lingual expansion (1 NE + 1 EN variant, fused).

**Per-tool context packs** (the 2026 context-engineering pattern; beats live RAG for closed scopes):
- Tutor (chapter mode): whole chapter + summaries + glossary prompt-cached (a 40–60 page Nepali primary book ≈ 30–60k tokens — fits one cached call); hybrid endpoint as fallback.
- Lesson planner: unit pack = summaries + outcome chain + worked examples + exercise list.
- Paper generator: blueprint-cell pack = unit chunks of relevant kinds + exemplar items.
- Adaptive learning: mastery updates → outer-fringe recommendation → serve by unit links (no vector search in the loop).

## 6. Tool wiring & safety (all tools, one grounding contract)

- Every grounded call persists `AIGeneration.citations` → chunk → bbox; `grounding='required'` returns 422 when a tool's units have no published chunks.
- **Tutor constitution** as versioned cached prefix: never hand out exercise answers (Socratic ladder), age-appropriate refusals, escalation on self-harm signals, "show me where it says that" affordance; adversarially probed with EduGuard-style direct-answer tests.
- Optional: expose retrieval as MCP tools (`search_curriculum`, `get_chunk_provenance`, `get_outcome_prereqs`) so any agent hits the same validated path.

## 7. Evaluation gates (before any tool turns on for a grade)

Per grade×subject golden set (50 queries; NE/EN mix; per chunk-kind incl. "which exercise covers X"):
recall@20 ≥ 0.95 · MRR@5 ≥ 0.75 · groundedness ≥ 0.90 · hallucination ≤ 2% on sampled tutor answers ·
Nepali-subset ≥ 0.9 × English-subset · papers: 100% blueprint-cell coverage, 0 dedup collisions.
Stored in `eval_runs`; any embedding/chunker/prompt change re-runs the matrix (blue/green embedding flip via `embedding_version` column).

## 8. Execution sprints (founder-run extraction; code is loader/wiring only)

| Sprint | Work |
|---|---|
| **S12 — Foundation + pilot** | Build: spine migration (tables above), thin loader CLI/API (validate→upsert→embed→index→manifest gate), staging-folder ingest, review-queue page (bbox-highlighted), golden-set harness scaffold. **Founder runs the prompt pack on 2 pilot books** (Grade 10 Science + Grade 10 Math, EN + NE) using the runbook; we tune prompts on the results |
| **S13 — Wiring + eval** | Retrieval service upgrade (rerank + CRAG + packs + NE/EN expansion); workbench/tutor/paper-v2 grounded through it; citations persisted; grounding-required 422; golden sets authored for pilot grades; CI eval gate live |
| **S14 — Question engine** | Spec-grid → blueprint import (from ingested grids); blueprint-cell-bound generation (KAQG loop: retrieve→generate→verify→calibrate); misconception distractors; dedup gate; model sets (P-D L5); mastery loop + outer-fringe recommendations; then corpus scale-out book-by-book under the same gates |

Each sprint ends with tests (drift gate, pytest, tsc) — extraction itself never blocks code sprints; books flow through the loader as the founder completes them.
