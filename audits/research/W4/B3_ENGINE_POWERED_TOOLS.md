# B3 — ENGINE-POWERED TOOLS: SPECS + CATALOG WAVE ORDER (+ §4 SAHAYATRI CROSS-CHECK)
Researched 2026-09-05. Every repo claim carries file:line; catalog/engine design claims cite D1 `/audits/research/_digest/D1_AITEACHER_AND_TOOLS.md`; Sahayatri cites D3 `/audits/research/_digest/D3_SAHAYATRI_PLUGIN_SPEC.md`. Web-sourced patterns cite B1/B2 digests in this folder.

## 0. ENGINE INVENTORY TODAY (verified in repo)
| Engine | File | State | Key lines |
|---|---|---|---|
| Designer canvas (fabric v6) | `frontend/app/dashboard/designer/editor/page.tsx` → `frontend/components/designer/CanvasEditor.tsx` + panels | shipped; NO present mode, NO object animations (grep: only CSS transition classes and a static shadow toggle, PropertiesPanel.tsx:264-271) | — |
| Canvas → HTML/PDF (server) | `backend/app/services/designer/document_renderer.py` (326 LOC) | multi-page `{version:"multi-page", pages:[{width,height,json}]}`; object types: textbox/text/i-text (:98), rect (:120), circle (:132), image (:140), line (:185), polygon/path/triangle/group as inline SVG (:196); `{{token}}` resolution | — |
| PDF css wrapper | `backend/app/services/designer/pdf_css.py` | `@page` + embedded `NotoSansDevanagari` fonts | D1 §C.17.1 |
| Writer DOCX | `backend/app/services/writer_docx.py` (495 LOC) | TipTap JSON → .docx: page sizes A4/A5/Letter/Legal (:23-28), margins/columns (:83-98), PAGE/NUMPAGES fields (:108-122), images with size clamp (:150-177), tables (:410-437), pageBreak (:322-323), floating text frames (:180-214) | — |
| Writer HTML/PDF | `backend/app/services/designer/template_engine.py` | writer block vocab `heading, paragraph, divider, spacer, table, columns, signature, header_band, footer_band, subject_rows, subject_rows_neb, fee_rows` (D1 §C.17.1) | — |
| Question paper v2 | `backend/app/services/ai/question_paper_v2.py` | bank-first per blueprint section: `sample_for_section` (:224-250, approved-only, random), shortfall → ONE LLM call/section at temperature 0.2 (:159-170), seeds bank `source="ai", is_approved=False` (:179-199), persists `GeneratedPaper` (:100-112) | — |
| PPTX export | `frontend/lib/hooks/useExport.ts:290-352` | FIXED layout bug: `pptx.defineLayout` + `pptx.layout = "PAGE"` now called once before the slide loop (:309-317). Each page still rendered offscreen and inserted as **full-bleed PNG raster** (:344-348) — no native text/shapes/notes | — |
| Other exports | `frontend/lib/hooks/useExport.ts` | exportPNG (:119), exportPagesZip (:187), exportPDF jsPDF (:215-266), exportSVG vector (:274-421) | — |
| Design-studio AI seam | `backend/app/api/v1/design_studio.py:827-840, 854-938` | `POST /design-studio/ai/agent` returns `{reply, actions[]}`; closed action vocab `add_text, add_heading, replace_selected_text, insert_text_at_cursor, set_background, suggest_layout, replace_document_text, add_bullet_points` | — |
| DOCX export route | `backend/app/api/v1/design_studio.py:1274-1300` | `POST /design-studio/writer/export-docx` → `writer_doc_to_bytes` | — |
| Question-paper routes | `backend/app/api/v1/ai_tools.py:21 (v1), 391 (v2), 458 (generated-papers get)`, question-bank CRUD :255-378 | **no render/export endpoint for GeneratedPaper yet** | — |
| Emitter layer | `backend/app/services/ai/document_emitters.py` | **does not exist** (proposed D1 §C.17.2) | — |
| Registry | `backend/app/services/ai/workbench_seed.py:16-500` | 24 rows seeded (fixture + 9 E0 + 14 wave-1); `output_document_type`, `trigger_phrases`, `nutrition` already columns | — |
| OMR | nowhere in backend/frontend (grep omr/bubble = 0 hits) | **new build** | — |

---

## 1. (a) PRESENTATION GENERATOR — lesson → designer deck
**Contract (locked, D1 §C.17.3):** tool returns deck JSON `{type:"deck", theme, aspect:"16:9", slides:[10 typed slides: title|objectives|content|two_col|diagram|table|chart|question|activity|exit, each may carry notes]}`. Emitter (`document_emitters.py`, NEW) maps each slide type to a fabric page 1280×720 px with master-page layouts → `{version:"multi-page", pages:[…]}` → renders through `document_renderer.py` today, loads in CanvasEditor with no new renderer (D1 §C.17.3).

**Block mapping (deck type → fabric objects the renderer supports):**
- title → rect (master bg accent, renderer :120) + textbox ×2 (:98); objectives/content/question/activity → textbox bullets + line divider (:185); two_col → two textboxes + rect column guides; table → NOT renderable natively — emit as textbox grid inside a group, or add a minimal server table→SVG path via the existing polygon/path handler (:196); chart → emit `chart_panel` SVG (new `designer/charts.py`, D1 §C.17.4 #5) placed as image; diagram → svg_spec → inline SVG (renderer :196 already supports path/group).

**What the canvas supports today:** multi-page docs, Devanagari-safe server PDF via WeasyPrint+Pango (pdf_css.py), images incl. `{{token}}` + QR, shapes, SVG groups, shadows client-side only (PropertiesPanel.tsx:264-271). **No animations** — D1 §C.17.4 #11 defers transitions to a deck-dialect `transition` field + PPTX export, ranked last; PDF ignores them.

**Small engine upgrades for Gamma-quality output (file:line):**
1. **Native-object PPTX export** — in `useExport.ts:319-350`, before `slide.addImage`, walk `page.json.objects` and map textbox→`slide.addText`, rect/circle→`addShape`, image→`addImage`, else raster-fallback the page; pass `slide.addNotes(page.json.__deck_notes__)`. Keeps the :316-317 layout fix. (D1 §C.17.4 #2.)
2. **Master pages + theme tokens** — emitter resolves `theme` once from school brand tokens (D1 §C.17.4 #10) so all slides share fonts/colors; Gamma-equivalent polish with zero per-slide work (pattern: brand-agency as shared context, B1 §2.11).
3. **Typed-slide validator in the emitter** — reject unknown slide types and >20 slides; enforce "notes ≠ slide text" instruction in the prompt file, not the code (present skill rules, B1 §2.2: 15–30 s/slide, images on 3–5 of 12).
4. **Anti-slop style bars** in `slide_deck_en.md`: one idea per slide, min title size, 5-color palette cap (presentation-generator rules, B1 §2.1/2.2) — Gamma's real quality comes from constraints, not freedom.
5. **Present mode** (client-only, deferred): full-screen route over existing pages[]; no engine change.

## 2. (b) WORKSHEET / PAPER GENERATOR — question-paper v2 → docx/pdf (+ OMR)
**Today:** v2 assembles bank-first questions and persists `GeneratedPaper` (question_paper_v2.py:100-112) but has **no renderer**: `/generated-papers/<id>` (ai_tools.py:458) returns JSON only. The writer DOCX path exists (`writer_docx.py:440-495`, route design_studio.py:1274) and page-number fields already work (:108-122).

**Spec:**
1. **Emitter `paper_to_writer_doc`** (new `document_emitters.py`): `GeneratedPaper.questions` → writer blocks: `header_band(school, exam, subject, grade, Time, Full Marks)` + `section_header` per blueprint section + `question_block` per item (numbered stem, marks right-aligned, answer space by question_type: mcq 0 px, short 40 px, long 120 px — deterministic, D1 §C.17.3). Multi-page flow: `[P.T.O.]` + "Page n of m" footer (writer_docx already emits PAGE/NUMPAGES, :108-122; needs the same in the HTML writer + `section_header`/`question_block` blocks — D1 §C.17.4 #3-4).
2. **DOCX + PDF outputs:** DOCX via existing `writer_doc_to_bytes`; PDF via `_render_writer_html` → WeasyPrint (Devanagari-safe). **Needs first:** the writer block library expansion (question_block, section_header, checkbox_list, image, page_break, two_column_flow, answer_space) mirrored in `template_engine.py _w_*`, `writer_docx.py`, and `lib/designer/writer-blocks.ts` (D1 §C.17.4 #3).
3. **Answer key** = same document, `answer` fields revealed + DRAFT/KEY watermark; totals validated by handler against blueprint, never trusted from the model (question_paper_v2.py:98 sums from questions; D3 §E.7).
4. **OMR (new build — nothing exists today):** for mcq sections, emit a bubble sheet as a **canvas** document: 4 circles per question via the renderer's `circle` object (document_renderer.py:132) at fixed pitch + school/exam header textbox; deterministic emitter, zero model cost. Scanning/scoring is OUT of scope for this wave (no vision ingestion, D1 §B; D3 #1 SKIP) — the sheet is print-only until a later decision. Add `question_paper_v2` result field `omr_sheet: bool`.
5. **Bank loop stays closed:** every generated item already seeds `QuestionBankItem(source="ai", is_approved=False)` (question_paper_v2.py:179-199) — the paper tool is also the bank-growth engine; dedupe on typed entry comes from the Jaccard port (D3 §9/§C.1).

## 3. (c) RUBRIC + FEEDBACK TOOLS (marks pipeline)
- **Rubric Builder** is seeded (`rubric`, workbench_seed.py:119-141, `ui_type: rubric`, delegates grading to A-06) — but `rubric_grader` (D1 §C.5) is NEW. Spec: input `submission + rubric_id`; output `rubric_grid` with per-criterion marks + **quoted justification**; model returns only judgments, the handler sums marks (adoption #4, D1 §C.16). Store as an `AIToolRegistry` row + `rubric_grader_en/ne.md` prompts; the schema needs D3 §E.8's levels-as-map upgrade (current schema stores descriptors as string, D3 §E.8 note).
- **Batch feedback** (`batch_feedback`, D1 §C.5): one pass per assignment_id → per-student comment + class trend; cost tier 4 (per-item) — meter like Kahoot's pages-of-source model (D1 §C.17.7). Reuse `auto_grader.py`'s submission plumbing (`backend/app/services/ai/auto_grader.py`, route via assignments).
- **remark_sheet** (D1 §C.5): class-wide remarks from real marks+attendance → `table_grid` → editable review (confirm-before-write, pattern already used by ai_capture) → merge into `generate_bulk_marksheets` (bulk_generator.py owns `_neb_grade/_neb_gpa`, D1 §C.17.1). AI writes only the remark column.
- **writing_feedback invariant:** schema has no `revised_text` — the tool never rewrites student work (workbench_seed.py:252-263); apply the same invariant to rubric_grader outputs ("needs verification, never factually wrong" calibration, B1 §2.4).

## 4. (d) NOTES→CONTENT ASSIST TOOLS (ADMIN-ENTERED ONLY — no OCR/vision)
Locked decision: no OCR/vision ingestion of textbooks or paper scans (D1 §B.1; D3 §1 SKIP with rationale). AI only assists **typed/admin-entered** text.
1. **Typed paper upload heuristics** — port only the pure functions from Sahayatri's paper upload: `_detect_exercise_type`, `_guess_has_math`, `_guess_sub_part_count`, `_suggest_bloom_level` (D3 §3) as admin-UI autofill over typed markdown; confidence tiers/review queues survive only as the publish gate (D3 §7 SKIP note).
2. **note_summarizer / study_guide grounding** — class notes or chapter typed/pasted → structured summary + recall questions (`note_summarizer`, D1 §C.11; `study_guide` seeded, workbench_seed.py:191-215).
3. **curriculum_mapper typed ingest** — CDC curriculum rows typed/pasted into `CurriculumFramework`+units+outcomes so every grounded tool works (D1 §C.14, PART; no importer UI yet). Model assists structuring, not extraction from images.
4. **translation_bridge / nepali_style_editor** — re-render any artifact EN⇄NE preserving structure and mark totals (D1 §C.7; nepali_style_editor seeded, workbench_seed.py:453-467).
5. **designer token fill** — `DataFillPanel.tsx` already resolves `{{tokens}}` against typed fields (renderer :140 token path); AI's role is drafting the text the admin pastes (social_post, event_invite — D1 §C.7/C.10).

---

## 5. CATALOG WAVE ORDER — next ~40 tools beyond the 24 seeded
Wave-1 (24) already covers: fixture, lesson_plan, worksheet, exit_ticket, rubric, parent_email, differentiation, study_guide, flashcards, writing_feedback, unit_plan, substitute_plan, objective_writer, misconception_map, remedial_plan, answer_key, class_performance, see_prep_pack, practice_set, parent_sms, difficult_conversation, nepali_style_editor, item_analysis, home_support (workbench_seed.py:16-500).

**Wave 2 — "no new engine" registry rows (~18, Slice-1 continuation, mostly doc_sections/table_grid):** blueprint_builder · text_leveler · text_scaffolder · vocab_support · accommodation_finder · email_responder · meeting_agenda · meeting_minutes · lesson_hook · enrichment_plan · udl_choice_board · exam_timetable · attendance_outreach · lesson_observation · progress_conference · transition_guide · annual_scheme(xlsx emitter) · practical_exam. (Sources: D1 §C.15 fast-followers + P0/P1 items in C.2/C.6/C.7/C.8; every one is prompt+writer/xlsx on today's block vocabulary.)

**Wave 3 — "assessment depth" (needs writer block expansion, D1 §C.17.4 #3-4-6):** mcq_generator · formative_probe · oral_viva · paper_moderation · remark_sheet · grader_calibration · batch_feedback · answer_grouper · rubric_grader · group_maker(deterministic) · data_cleanup · iemis_readiness · monthly/fee explorers deferred. Priority driver: grading/assessment is the 57%-quality-gain task and the #1 pain (Gallup via D1 §C.17.7).

**Wave 4 — "decks & charts" (needs deck engine + chart_block, D1 §C.17.4 #1-2-5-8):** slide_deck · deck_from_doc · handout_from_deck · workshop_designer · cohort_trend · attendance_insight · board_report · mindmap_builder(canvas) · seating_plan(canvas). Priority driver: deck generation is the biggest missing category — every international competitor ships it (B2 §1.1/1.5/1.6/1.7).

**Wave 5 — long tail (P2s, wellbeing, HR, parent-facing, ~remaining of 153):** social_story, mentoring_notes, jd_writer, induction_pack, donor_report, sentiment_pulse, reading_coach, career_explorer, study_skills, report_explainer, home_support variants, counselor_brief, incident_writeup, crisis_protocol, etc. (D1 §C.9/C.11/C.12/C.13.)

Ordering principle (from D1 §C.17.5 + B2 evidence): Wave 2 makes ~40 tools real with zero renderer work; Wave 3 attacks the highest-pain workflow (marking) and completes the paper product; Wave 4 closes the only capability category where all competitors lead (decks). Engine prerequisite gates: Wave 3 gated on writer blocks; Wave 4 gated on deck emitter + native-PPTX fix.

---

## 6. §4 SAHAYATRI CROSS-CHECK — what the 153 catalog covers vs what Sahayatri adds
**D3's port list (its §A table) vs the 153 catalog:**
- **Already covered by the catalog (D3 says SKIP for this reason):** question-paper builder from bank items (#12 — `PaperBlueprint`+`GeneratedPaper`+`/question-paper/v2` beat Sahayatri's bare UUID array, D3 §12), AI PPT panel (#19 — dies as a panel; the `slide_deck` deck-dialect tool covers it), study materials/paper furniture (#13, #68).
- **What Sahayatri genuinely adds (PORT):**
  1. **Nepal 19-type exercise typology** — ASchool's `question_bank_items.question_type` enum is 7 values (mcq, short_answer, long_answer, true_false, fill_blank, match, numerical — `backend/app/models/question_bank.py:25-32`); Sahayatri's 14-value detected vocabulary adds `proof, construction, comprehension, diagram_based, activity, map_work, mixed, definition` (D3 §835 table; fix = widen the enum + columns, NOT a new `exercise_blocks` table — D3 §C.1). **Never forced MCQ** is the core insight. Consequence for us: D3 §E.6 requires `qa_list.question_type` to accept the widened enum so generated proof/construction questions survive the bank round trip.
  2. **Live quiz (Kahoot-style)** — 6-char join code, participants, Redis room state, **server-authoritative scoring ("client is_correct is ALWAYS ignored")**, leaderboard (D3 #55, §F) — ASchool's `realtime.py` has no lesson layer (D1 §D-8). Port target: `exams` plugin; our `live_poll` PART (D1 §C.3) is only an in-memory poll. Late-joiner snapshot pattern also ports (D3 #16 note).
  3. **Duplicate detection** — Jaccard ≥0.72 over exercise markdown (D3 #9) — needed once admins type questions into the bank.
  4. **Practice-quiz generation → OnlineExam** — generate → persist as `OnlineExam`/`OnlineExamAttempt` (backend/app/models/exam.py:168-205) instead of new quiz tables (D3 #54).
  5. **Paper-upload heuristics** (typed entry only) — §4 item 1 above.
  6. **3D/Sketchfab viewer** — DEFERRED by instruction: D3 #24 ports it as a curated external-resource viewer on the existing `oer_resources` table (backend/app/models/digital_content.py:51-63), #27 model-quiz links via a join column — both flagged DEFERRED here, not in any wave.
- **What the 153 catalog has that Sahayatri never shipped:** the whole SIS-grounded half — marks/attendance/fee-grounded tools (groups D/G), report cards + NEB grade engine, IEMIS/BS-calendar tools (group M), communication drafting (group F), wellbeing routing (group K). Sahayatri's chapter-context knowledge base (chapter RAG) is the one grounding idea worth absorbing into `elibrary`/`nepal_curriculum` once typed content exists (D3 §B.2/C.5).
- **Net read:** the 153 catalog + engines cover Sahayatri's content surface except (i) the exercise typology widening, (ii) live quiz, (iii) dedupe, (iv) typed-upload heuristics; all four are small, non-AI-surface ports that make catalog tools C-group tools stronger (bank depth, classroom engagement, paper validity).
