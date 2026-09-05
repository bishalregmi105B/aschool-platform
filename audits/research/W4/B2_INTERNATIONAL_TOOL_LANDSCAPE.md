# B2 — INTERNATIONAL TEACHER-AI PLATFORM LANDSCAPE
Researched 2026-09-05. Method: live site fetches via WebFetch (one question per fetch). Where a site 403'd, that is stated and any figures come from the prior corpus (D1 §C.17.7) and are marked unverified. Companion corpus: D1 §C.2–C.14 (the 153-tool catalog), D1 §C.17.7 (pricing context).

Platforms covered: MagicSchool, Diffit, Twee, Curipod, Wayground (Quizizz), Brisk Teaching, Gamma (partial — help center only), Eduaide (failed — all routes 403).

---

## 1. PER-PLATFORM INVENTORY

### 1.1 MagicSchool (https://www.magicschool.ai/)
- Claim: **"80+ teacher tools"** and **"50+ student tools"** (homepage, fetched 2026-09-05).
- Tools named on the homepage footer: **Lesson Plan Generator, Rubric Generator, Presentation Generator, Multiple Choice Quiz Maker, Worksheet Generator**, plus an "AI instructional coach" feature. The full catalog is gated behind signup — only 5 named publicly.
- Free-vs-paid signals: "Free for teachers" CTAs; "Get Pricing" / district enterprise motion (security, district-customized tools, structured rollout). No Plus tier named on page. (Prior corpus D1 §C.17.7: Free $0 / Plus $8.33/user/mo annual ($99.96/yr) or $12.99/mo / Enterprise custom — unverified this round.)
- ASchool read: MagicSchool is the named benchmark the 153-catalog already exceeds (D1 §C.1); its 5 public names match our `lesson_plan`, `rubric`, `slide_deck`, `mcq_generator`, `worksheet` keys — note our gaps are exactly deck + MCQ-with-distractors, both in the next wave (D1 §C.15 items 1, and C.4 `mcq_generator`).

### 1.2 Diffit (https://web.diffit.me/)
- Pitch: "Create print-ready lessons your students will love"; claims **"Zero student data collected."**
- Named surface: three-step workflow — (1) resource generation from a topic or existing content with parameters **"MTSS tier, challenge level, language, scaffolds, standards"**; (2) shaping into "differentiated activities, station rotations, sub plans, intervention materials, slides"; (3) export — print-ready layouts, Google Docs/Slides/Forms/Classroom, Microsoft 365, "All exports stay editable."
- Dedicated product pages: Diffit for Differentiation · Literacy · Critical Thinking · ELL & MLL · Math.
- Free-vs-paid: freemium (Try free + See Pricing); tier details not on page. (D1 §C.17.7: free tier keeps 90 days of history; premium enrolment-tiered flat rate — unverified this round.)
- ASchool read: Diffit's *parameter set* is the best-in-class model for `text_leveler`/`text_scaffolder` inputs (D1 §C.6) — MTSS tier ≈ our `tiered_panel` tiers, language ≈ our translation_bridge; its "exports stay editable" promise is our "Open in Writer/Designer" contract (D1 §C.17.2). Its positioning overlaps our Group E almost one-to-one.

### 1.3 Twee (https://twee.com/)
- Pitch: AI for **language teachers**, CEFR A1–C2, 10 languages; PDF/Word export, AI-graded responses, class management. Claim: "Over 40 tools for every language skill"; 6M exercises created in the past year; 500K+ teachers; "5+ hours saved weekly" (vendor claim, unverified).
- Tools named on the homepage (12): **Create a Text on Any Topic with Your Vocabulary · Create Open Questions for a Text · Find Discussion Questions · Create a Dialogue on Any Topic · Lead-in Activities for a Text · Create a List of Pros and Cons · Find Interesting Facts · Word-Definition Matching · Essential Vocabulary on a Topic · Word-Translation Matching · Fill in the Gap · Find Quotes by Famous People.**
- Free-vs-paid: free tier + "Try Pro for $0" trial; Pro pricing behind page.
- ASchool read: Twee's named tools map to `worksheet` (gap-fill is a `question_type` in our enum, question_bank.py:25-32), `flashcards`/`vocab_support` (matching exercises = `flashcard_deck` or `table_grid`), `lesson_hook` (lead-ins, discussion questions), `explainer_script` (dialogue). **Word-Translation Matching is effectively our `vocab_support` + `translation_bridge`** — bilingual EN⇄NE matching decks would be a Nepal-specific first.

### 1.4 Curipod (https://curipod.com/)
- Pitch: teacher-led whole-class ELA/writing lessons — students "read, write and discuss" together; alignment with "55+ top-rated curricula" (HMH Into Reading, CKLA, Wonders, Bluebonnet, Wit & Wisdom, SpringBoard).
- Named features: **AI feedback** ("feedback the moment they submit", revise-and-resubmit within one period); **Reports and insights from every lesson** (learning gaps + differentiation evidence); **Moderation Tool**; **STAAR & TELPAS test prep**; rubric alignment to Danielson/Marzano/T-TESS/CSTP; SSO (ClassLink/Clever/Google); PD; research library. Privacy line: "Students do not have accounts. No AI Chatbots. 100% teacher controlled." FERPA/COPPA/GDPR.
- Free-vs-paid: free signup; district demos; no prices on page.
- ASchool read: Curipod's headline insight per D1 §C.15 item 12 is the **misconception map** (already seeded, workbench_seed.py:319). Its instant-feedback-on-submit + revise-resubmit loop is the missing UX around our `writing_feedback`/`rubric_grader`. Its "no student accounts, no chatbots, teacher-controlled" privacy framing matches our pseudonymization + nutrition-facts posture (AINutritionFacts, workbench_seed.py:533-546).

### 1.5 Wayground / Quizizz (https://wayground.com/ — quizizz.com 301-redirects here)
- Pitch: "AI-powered assessments, presentations, video, flashcards"; "teachers in 90% of U.S. schools, 150+ countries."
- Named AI tools in nav: **Wayground AI · AI Presentation Maker · AI Question Generator (multiple-choice) · AI Rubric Generator · AI Lesson Plan Generator · AI Math Problem Generator · AI Worksheets Generator · Unit Plan Generator · Weekly Lesson Plan Generator.**
- Capability lines: generate "from a topic, doc, standard, or upload"; **25+ accommodations** (read-aloud, dyslexia-friendly fonts, focus mode, leveled text, live translation); state-test question formats; assessments as game or exam; integrity (lockdown mode, tab-switch alerts, integrity reports); Common Assessments rollups; **AI pause-point video questions**; flashcards auto-generated from any activity; AI data analysis reports; VoyageMath product.
- Free-vs-paid: teacher free signup; admin "get a quote"; Plans page exists without public figures. (D1 §C.17.7 prior-cycle pricing: Kahoot ladder Go free…One $19/teacher/mo, AI metered by pages of source material — that is Kahoot, not Quizizz; Quizizz figures unverified both cycles.)
- ASchool read: Wayground is the closest shape-match to our Group C+J: our `question_paper`/`question_bank` vs their question generator; our `unit_plan` (seeded) vs their Unit Plan Generator; `practice_set` vs adaptive practice. Their **accommodation layer applied at activity runtime** (not authoring time) is a UX idea our `accommodation_finder` (D1 §C.6) could adopt: attach read-aloud/leveled-text to an OnlineExam attempt rather than a document.

### 1.6 Brisk Teaching (https://www.briskteaching.com/)
- Pitch: "AI layer for every tool, website, and resource" — browser extension + web app; components: extension, Brisk on the Web, **Brisk Intelligence** (curriculum-aware AI), Brisk Boost for Students, Connected Tools (Google/Microsoft).
- Named surface: **Create Content ("30+ tools inside")** — Lesson Plan Generator, Presentation Maker (Google Slides from an idea/article/website/video), quiz generator, rubric generator, Inquiry Worksheet, creative-writing prompts; **Give Feedback ("5+ ways")** — Batch feedback ("in your voice, at your standard"), Glow & Grow Feedback; **Inspect Writing** (depth of thought, structure, originality, revision history); **Change Level** (50+ languages); **Student Activities ("14 activities")** via Boost.
- Free-vs-paid: "Free AI Tools" branding; schools/demo path is the paid route. (D1 §C.17.7: Free 20+ tools / Premium 35+ / Intelligence curriculum-grounded — consistent with what the page now shows; 2.2M hours saved claim unverified.)
- ASchool read: Brisk's **Inspect Writing** (revision-history-aware originality) is a non-punitive version of our `integrity_check` (D1 §C.5, plagiarism.py PART); Glow-Grow ≈ our `feedback_panel` schema (strengths/improvements/next_steps — writing_feedback, workbench_seed.py:243-263). "In your voice, at your standard" = our `grader_calibration` idea.

### 1.7 Gamma (partial — https://gamma.app/ and /pricing 403; help center https://help.gamma.app/en/ reachable)
- Help-center structure confirms product lines: **presentations, documents, and webpages** ("How do I create a new presentation, document, or webpage in Gamma?"), AI Content & Image Generation collection (12 articles), Websites & Publishing, Sharing/Collaboration/Analytics, editing/design collections, Subscription & Billing (13 articles — paid plans exist), Connectors/Imports/Embeds. No prices/credits visible.
- D1 §C.17.7 marks Gamma figures unverified (403 both cycles). What is safe to claim: card-based deck+doc+site from one content model; AI image generation built in; publishing/analytics. Pricing/credits: **DEFERRED — unverified.**
- ASchool read: Gamma is the quality bar for the `slide_deck` engine (D1 §C.17.4 #1): one semantic JSON → multiple polished outputs with themes — exactly our deck dialect → canvas/PDF/PPTX plan.

### 1.8 Eduaide.ai — FAILED
- https://www.eduaide.ai/, /app, /pricing, /eduaide-features all returned **403 Forbidden** this cycle; web.archive.org timed out; no help subdomain resolves. Prior corpus (D1 §C.17.7) also lists Eduaide as 403. **No tool names recorded — nothing invented here; DEFERRED.**

---

## 2. MERGED "TOP 60 TOOLS TEACHERS ACTUALLY USE"
Composition rule: every row is a tool with a source — either a named ASchool catalog tool (D1 §C.2–C.14, the 153 spec) or a competitor-named tool from §1 above (rows marked ⚑ use the competitor's name; they map to a catalog key or become catalog additions). Engine column per D1 §C.17.2: prompt = prompt-file tool; writer = writer blocks → PDF/DOCX; canvas = designer canvas; deck = new slide engine; qp-engine = question_paper_v2/bank; report = report_pdf; bulk = bulk_generator; xlsx = openpyxl; elibrary-RAG = policy/curriculum document grounding.

| # | Tool | Purpose | Key inputs | Output | ASchool engine | Source |
|---|---|---|---|---|---|---|
| 1 | lesson_plan | NEB-aligned phased plan | subject, grade, topic, minutes | plan_card → doc | prompt + writer | D1 §C.2 |
| 2 | unit_plan | 2–6 week unit map | subject, unit, weeks | plan_card+table | prompt + writer | D1 §C.2 (seeded) |
| 3 | annual_scheme | BS-calendar pacing year plan | subject, BS year | table_grid | prompt + xlsx | D1 §C.2 |
| 4 | weekly_planner | timetable-driven week plan | teacher, week | table_grid | prompt + writer | D1 §C.2 |
| 5 | substitute_plan | cover plan for non-specialist | topic, date | plan_card | prompt + writer | D1 §C.2 (seeded) |
| 6 | lesson_hook / lead-in activities ⚑ | 3 attention-grabbing openers | topic, grade | text_block | prompt | D1 §C.2; Twee §1.3 |
| 7 | objective_writer | Bloom-measurable objectives | topic, grade | section_list | prompt | D1 §C.2 (seeded) |
| 8 | discussion questions ⚑ | graded discussion set | topic | qa_list | prompt | Twee §1.3 |
| 9 | slide_deck / AI Presentation Maker ⚑ | lesson → projector deck | plan_id/topic, count | slide_deck | deck engine | D1 §C.3; Wayground §1.5; MagicSchool §1.1; Brisk §1.6 |
| 10 | deck_from_doc | pasted notes/PDF → deck | doc_id, style | slide_deck | deck engine | D1 §C.3 |
| 11 | handout_from_deck | deck → printable notes | deck_id, density | table_grid | prompt + writer | D1 §C.3 |
| 12 | explainer_script | teacher-voice concept script | concept, grade | text_block | prompt + writer | D1 §C.3 |
| 13 | misconception_map | wrong ideas + diagnostic Qs | topic, grade | table_grid | prompt | D1 §C.3 (seeded); Curipod §1.4 |
| 14 | questioning_ladder | DOK-graded question set | topic, grade | qa_list | prompt | D1 §C.3 |
| 15 | group_maker / seating_plan | balanced groups, seat map | class_id, rules | table_grid | deterministic | D1 §C.3 |
| 16 | live_poll / live quiz ⚑ | in-class interactive quiz | questions | chart_panel | realtime/sockets | D1 §C.3; D3 §F (Sahayatri) |
| 17 | question_paper | NEB-format paper | blueprint | qa_list | qp-engine + writer | D1 §C.4 |
| 18 | question_paper_v2 | bank-first paper assembly | blueprint, filters | qa_list | qp-engine + writer | D1 §C.4 |
| 19 | question_bank | tagged, deduped item pool | items, tags | table_grid | qp-engine + xlsx | D1 §C.4 |
| 20 | blueprint_builder | marks×unit×level grid pre-generation | subject, marks | table_grid | deterministic + writer | D1 §C.4 |
| 21 | mcq_generator / MCQ maker ⚑ | MCQs with real distractors | topic, count | qa_list | prompt + qp-engine | D1 §C.4; MagicSchool §1.1; Wayground §1.5 |
| 22 | answer_key | step-marked marking scheme | paper_id | qa_list | prompt + writer | D1 §C.4 (seeded) |
| 23 | exit_ticket | 3-question end check | topic | qa_list | prompt + writer | D1 §C.4 (seeded) |
| 24 | rubric / AI Rubric Generator ⚑ | criteria × levels matrix | task, criteria | rubric_grid | prompt + writer | D1 §C.4 (seeded); Wayground §1.5; MagicSchool §1.1; Brisk §1.6 |
| 25 | practical_exam / oral_viva | lab + viva sets | experiment, topic | qa_list | prompt + writer | D1 §C.4 |
| 26 | paper_moderation | deterministic + judge paper audit | paper_id | checklist | handler + judge | D1 §C.4; pattern B1 §2.4 |
| 27 | auto_grader | objective grading vs key | submission_ids | table_grid | marks pipeline | D1 §C.5 |
| 28 | rubric_grader | criterion-wise marking + quotes | submission, rubric | rubric_grid | marks pipeline | D1 §C.5 |
| 29 | batch_feedback / Batch feedback ⚑ | whole-class feedback pass | assignment_id | table+insights | marks pipeline | D1 §C.5; Brisk §1.6; Curipod instant feedback §1.4 |
| 30 | answer_grouper | cluster similar answers | question_id | table_grid | marks pipeline | D1 §C.5 |
| 31 | writing_feedback / Glow & Grow ⚑ | strengths/improvements/next steps | writing sample | feedback_panel | prompt | D1 §C.5 (seeded); Brisk §1.6 |
| 32 | inspect writing / originality signals ⚑ | depth + revision-based signals | submission_id | insight_cards | marks pipeline | Brisk §1.6; D1 `integrity_check` |
| 33 | remark_writer / remark_sheet | report-card remarks, class sheet | student/class, term | text/table | bulk + writer | D1 §C.5 |
| 34 | feedback_translator | feedback into parent Nepali | generation_id | text_block | prompt | D1 §C.5 |
| 35 | text_leveler / Change Level ⚑ | rewrite up/down 3 levels | text, target grade | text_block | prompt | D1 §C.6; Brisk §1.6; Diffit params §1.2 |
| 36 | text_scaffolder | glossary, chunks, guiding Qs | text, grade | section_list | prompt | D1 §C.6 |
| 37 | vocab_support / Word-Translation Matching ⚑ | gloss + sentence frames, bilingual match | word list | flashcard_deck | prompt + writer | D1 §C.6; Twee §1.3 |
| 38 | iep_draft / accommodations ⚑ | IEP draft, accommodation ideas | student, needs | plan+table | prompt + writer | D1 §C.6; Wayground runtime accommodations §1.5 |
| 39 | remedial_plan / intervention ⚑ | catch-up plan from weak items | class, threshold | plan+table | prompt + SIS data | D1 §C.6 (seeded); Diffit intervention §1.2 |
| 40 | enrichment_plan | depth tasks for fast finishers | topic, grade | tiered_panel | prompt | D1 §C.6 |
| 41 | udl_choice_board | 3×3 choice board | topic, grade | table_grid | prompt | D1 §C.6 |
| 42 | parent_email | warm EN/NE parent email | notes, tone | text_block | prompt | D1 §C.7 (seeded) |
| 43 | parent_sms | 160-char SMS, transliteration-aware | message, lang | text_block | prompt | D1 §C.7 (seeded) |
| 44 | parent_letter / school_notice | formal letter, BS date, letterhead | type, context | text_block | prompt + report | D1 §C.7 |
| 45 | difficult_conversation | de-escalation coach | draft text | feedback_panel | prompt | D1 §C.7 (seeded) |
| 46 | email_responder | 3-tone reply drafts | inbound text | text_block | prompt | D1 §C.7 |
| 47 | class_newsletter / event_invite | newsletter, invitation + design | class, month | section_list | prompt + canvas | D1 §C.7 |
| 48 | meeting_minutes | notes → decisions, owners, BS dates | notes | checklist | prompt + writer | D1 §C.7; pattern B1 §2.11 |
| 49 | parent_faq / school_qa | policy-grounded answers + citations | question | text_block | elibrary-RAG | D1 §C.7/C.13 |
| 50 | class_performance | results → 3 actions | exam_id | insights+chart | marks pipeline | D1 §C.8 (seeded) |
| 51 | item_analysis | difficulty/discrimination per item | exam_id | table+chart | marks pipeline | D1 §C.8 (seeded) |
| 52 | risk_alerts / attendance_insight | dropout/absence patterns | school/class | table/chart | marks pipeline | D1 §C.8 |
| 53 | flashcards | revision deck | topic, count | flashcard_deck | prompt | D1 §C.11 (seeded); Wayground flashcards §1.5 |
| 54 | practice_set / adaptive quiz ⚑ | weak-item targeted practice | student, subject | qa_list | qp-engine | D1 §C.11 (seeded); Wayground §1.5 |
| 55 | worked_example / concept_explainer | step model + twin problem; 3-way explain | problem/concept | section_list | prompt | D1 §C.11 |
| 56 | revision_planner / see_prep_pack | weighted day-by-day prep | exam date, subjects | checklist/sections | prompt + SIS data | D1 §C.11 (seeded); pattern B1 §2.9 |
| 57 | self_quiz | self-testing loop with explanations | topic | qa_list | prompt | D1 §C.11 |
| 58 | homework_helper | hint-first, never the answer | question | feedback_panel | prompt | D1 §C.11 |
| 59 | ai_tutor | Socratic monitored tutoring | topic, plan | board_stream | tutor engine | D1 §C.11 |
| 60 | text→quiz from any source ⚑ (Brisk Boost Student Activities; Wayground "from topic, doc, upload"; Diffit) | turn any passage/doc into activities + checks | text/doc/url | qa_list/sections | elibrary-RAG + qp-engine | Brisk §1.6; Wayground §1.5; Diffit §1.2 |
| 61 | study_guide | exam-prep guide + practice | subject, units | section_list | prompt + writer | D1 §C.2 (seeded) |
| 62 | worksheet / AI Worksheets Generator ⚑ | practice sheet with marks | topic, count, types | qa_list | prompt + writer | D1 §C.2 (seeded); Wayground §1.5; MagicSchool §1.1 |

(62 rows listed to keep every sourced named tool; the "top 60" brief is satisfied by rows 1–60 with 61–62 as seeded staples.)

Patterns worth stating explicitly:
- **Every competitor leads with the same 6**: lesson plan, quiz/MCQ, worksheet, rubric, slides, differentiation/leveling (rows 1, 21, 62, 24, 9, 35). Our catalog covers all six; the two not yet engine-backed are slides (deck) and MCQ-with-distractors — both next-wave P0 (D1 §C.15).
- **Tiering**: all reachable sites show a free teacher tier + institutional quote path; only MagicSchool exposes per-seat prices (D1 §C.17.7). Kahoot meters AI by pages-of-source (D1 §C.17.7) — the model to copy for our cost-tier-4 tools.
- **Differentiation is a runtime layer, not just a document** (Wayground accommodations, Curipod revise-resubmit): design implication for `practice_set`/`OnlineExam` UX beyond generating a tiered PDF.
- **Source-to-activity is the current frontier** (Brisk from video/URL, Wayground "topic, doc, standard, upload", Diffit from content): for ASchool this is elibrary RAG + admin-typed content (NO OCR/vision — D1 §B; D3 §1 SKIP).
