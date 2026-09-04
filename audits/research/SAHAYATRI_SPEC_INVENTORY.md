# Sahayatri — Definitive Product & Feature Inventory (for porting into ASchool)

> Source documents (all read in full):
> - `/home/bishal-regmi/Desktop/Sahayatri/sahayatri_v5_1_final.md` — master spec, v5.1 Final, May 2026 (~206 KB, 4,365 lines)
> - `/home/bishal-regmi/Desktop/Sahayatri/AUDIT.md` — full codebase audit, 2026-05-26 (~121 KB)
> - `/home/bishal-regmi/Desktop/Sahayatri/finalprompt.md` — architecture overhaul prompt (per-tool routes, video/PPT/doc generators, research agent)
> - `/home/bishal-regmi/Desktop/Sahayatri/implementation_plan.md` — audit → 7-phase implementation plan
> - `/home/bishal-regmi/Desktop/Sahayatri/PROGRESS.md` — build progress tracker (June 2025 sessions)
> - `/home/bishal-regmi/Desktop/Sahayatri/README.md`
>
> Purpose: durable inventory to decide which Sahayatri capabilities port into ASchool (multi-tenant school-management SaaS for Nepal: Flask+Postgres, Next.js 14, several Flutter apps, plugin architecture at `backend/app/plugins/modules/`).
> Legend: **PORT: high value** = genuinely novel/differentiating and directly reusable in ASchool. Completion % comes from AUDIT.md scorecards (~81% total system; Web ~94%, Backend ~78%, Whiteboard ~82%, Mobile ~65%, Infra ~85%).
> Companion docs already in this folder: `SAHAYATRI_CLIENTS_UX.md`, `ASHLYA_AI_DEEPDIVE.md`.

---

## 1. Product Identity

**What it is:** "Sahayatri" (सहयात्री — "Fellow Traveller on the Learning Journey"), built by **Ashlya**, is Nepal's first end-to-end AI-powered education platform: 120+ AI tools (60+ teacher, 60+ student), voice tutoring, image doubt solving, an offline-capable AI whiteboard for Interactive Flat Panels (IFPs), 3D visualizations, adaptive learning, full Nepali (Devanagari) support, NEB/SEE/HSEB curriculum alignment, and a Vision-AI pipeline that ingests Nepal Government (CDC) textbook PDFs into chapter Markdown + exercise banks + AI knowledge bases. Market: Nepal primary → South Asia expansion. v5.1, May 2026.

**Problems it solves (spec's own framing):**
1. CDC textbook PDFs use Preeti-style legacy Devanagari font encoding — standard text extraction yields garbage (`"फलन (Function)"` → `"P]lR5s ul0ft"`). Fix: rasterize pages → Groq Vision → clean Markdown.
2. Generic AI tutors are not curriculum-grounded — fixed via the Chapter AI Context knowledge base injected into every prompt.
3. Nepal exercises are NOT MCQs — a single अभ्यास section mixes MCQ/short/long/proof/construction/numerical/fill-blank/match/comprehension; forcing an MCQ schema destroys data. Fix: Markdown exercise blocks.
4. Only ~30% of schools have reliable internet, yet IFP adoption is rising — whiteboard must work fully offline with no login/socket, AI degrades gracefully.
5. No Nepali-language tooling exists in MagicSchool-class competitors.

**Personas / roles:** `super_admin` (platform: content, ingestion, plans), `institution` (school admin: classes, enrollment, paper uploads, API keys), `teacher`, `student`, `parent`. Multi-tenant by institution.

**Market sizing cited:** ~35,000 schools + 7,500 colleges (MoEST 2023); ~500,000 SEE candidates/yr; average school 300–800 students, 15–40 teachers; government digital-school IFP initiative.

**Business model / monetization (spec §18):** token-based subscription in NPR. Plans: Free 0 (500 tokens) · Student Plus NPR 199/mo (5,000) · Teacher Pro 299 (8,000) · Institution Basic 2,999 (50k, ≤100 students) · Standard 5,999 (120k, ≤300) · Premium 9,999 (300k, unlimited). Per-tool token costs (voice tutor 15–40, question paper 150–300, video generator 200; TTS 5). Platform absorbs ingestion costs (~21k tokens per 298-page textbook). **No payment gateway implemented** (eSewa/Khalti/IME Pay named as future work); subscriptions activate without payment verification.

**Languages:** UI i18n `en` / `ne` (Devanagari, default) / `hi` (added later). AI prompt-level language branching in every tool. TTS voices `ne-NP-SagarNeural`, `ne-NP-HemkalaNeural`, `en-US-AriaNeural/GuyNeural`.

**Offline needs:** explicit design pillar — "Whiteboard works everywhere, with or without internet"; offline-first; low-bandwidth graceful degradation everywhere.

---

## 2. Architecture & Surfaces

| Surface | Stack | Role |
|---|---|---|
| `backend/` | Flask 3 + SQLAlchemy 2 + Alembic + Celery 5 + Flask-SocketIO + Redis | REST API (12 core blueprints + 19 AI tool blueprints, 100+ endpoints), task queue, websockets |
| `web/` | Next.js 14 App Router + next-intl + react-markdown/KaTeX | Primary app: admin, institution, teacher, student route groups; 130+ AI tool pages |
| `mobile/` | Flutter 3 (Android/iOS) | Student app: voice tutor, doubt solver, chapter reader, practice, quiz, gamification, 3D viewer |
| `whiteboard/` | Flutter 3 (web + Android, served via nginx :8090) | Teacher whiteboard/IFP app: offline drawing, AI tools, 3D embed, QR live sessions |
| Infra | Docker Compose: postgres:16, redis:7, celery-worker, minio (S3), whiteboard-web, nginx, MailHog, Flower | |

External: Groq (LLM/vision/Whisper), edge-tts, Sketchfab Viewer/Data API, Together AI/Replicate (image gen), Brave/SerpAPI/DuckDuckGo (research agent), SendGrid/SMTP (email), Sparrow SMS (Nepal).

---

## 3. Complete Feature Inventory

### 3.1 Identity, Tenancy & Institution Management
| Feature | What it does | Persona | Where |
|---|---|---|---|
| JWT auth + Redis blacklist | Access 30 min / refresh 30 d, single-use refresh rotation, self-expiring logout blacklist, bcrypt, Google OAuth (full ID-token verification) | All | backend `/api/auth/`, web |
| Institution registration | `register-institution` creates Institution + admin User + trial subscription | Institution | backend+web |
| Institution CRUD & activation | Platform management, activate/deactivate, detail tabs (Overview/Classes/Students/Teachers) | Super admin | web `/admin/institutions/[id]` |
| Class grades / subjects / topics managers | System-wide curriculum scaffolding, Nepali titles, curriculum type NEB | Super admin | web `/admin/content/*` |
| Institution classes + enrollment | `institution_classes`, enroll students (roll numbers), assign teachers+subjects | Institution admin | web `/institution/classes` |
| **SMS Integration API** `/api/sms/v1/` | Dedicated namespace letting external school-management systems pull/push attendance, results, fees, notices, parents, student sync; auth via institution-scoped `X-API-Key` with scopes (`sms:read/write`); API key management UI (create/revoke/reveal) | Institution / external SMS systems | backend + web `/institution/api-keys/` **PORT: high value** |
| Parent portal | Child dashboard/profile (working); attendance/results stubs; demo notices | Parent | backend `/api/parent/` |
| User management | Role-filtered list, create/edit | Super admin | web `/admin/users` |

### 3.2 Content Pipeline (the flagship)
| Feature | What it does | Persona | Where |
|---|---|---|---|
| **Govt Textbook Ingestion (7-stage Vision-AI pipeline)** | PDF upload → pypdfium2 rasterize 150 DPI → Groq Vision page classification (cover/publisher/foreword/toc/chapter_start/content/exercise/activity/blank/answer_key) → TOC extraction → per-chapter content→Markdown (LaTeX, `[FIGURE_PLACEHOLDER]` images) → exercise-block extraction (19 Nepal types) → AI chapter context → human review → publish | Super admin | Celery `process_textbook_pdf`; web Import Hub **PORT: high value** |
| **Institution Paper Upload** | Same pipeline scoped to institution: past exam papers → private exercise banks; SSE live progress; bulk approve; publish to institution bank or question paper | Institution admin | web `/institution/paper-upload` **PORT: high value** |
| Smart Import Hub UI | Upload modal (auto-detect class/subject), live SSE progress w/ per-chapter detections + token counter, structure review with rendered MD + inline editing, exercise review with filters + bulk approve/reject + smart confidence recommendations, publish confirmation | Super admin | web `/admin/import-hub/*` **PORT: high value** |
| **Chapter AI Context system** | Per-chapter structured knowledge base (summaries ne/en, key_definitions, theorems & rules, formulas w/ LaTeX, worked/step-by-step examples, common mistakes, exam tips, topic connections) — draft → admin edit/approve → published; injected into *every* AI tool prompt; query-relevance ranking by token overlap | Super admin maintains; all AI tools consume | `chapter_ai_context` table, `/admin/chapter-context` **PORT: high value** |
| Confidence scoring + auto-approve | ConfidenceEngine: ≥0.90 chapter / ≥0.85 exercise auto-approve suggestions, <0.30 reject; heuristics penalize short/unknown-type/math-without-LaTeX blocks | Automated | backend **PORT: high value** |
| Bloom's auto-tagger | Keyword-based Bloom detection (Nepali + English verbs: परिभाषा→remember, रचना/प्रमाणित→create, हल गर→apply…) auto-applied on bulk approve | Automated | `bloom_tagger.py` **PORT: high value** |
| Duplicate detection | Jaccard similarity @ 0.72 threshold over exercise markdown | Automated | `duplicate_detection_service.py` **PORT: high value** |
| Exercise Block Bank | Filter by class/subject/topic/type/Bloom/difficulty/source; bulk tag/delete; KaTeX inline preview; source badges (CDC Govt Textbook / Institution Upload / Manual / AI Generated) | Admin, teacher | `ExerciseBankClient.tsx` (721 lines) |
| Chapter Reader | Renders `content_markdown` with react-markdown + remark-math + KaTeX + S3 images | Student/teacher | web `/student/chapters/[topicId]`, mobile |
| Question papers | Build from exercise_block_ids; sections/marks/duration; WeasyPrint PDF; Nepal marks distribution | Teacher | backend+web **PORT: high value** |
| Study materials | PDF/video/link/note uploads per class/subject | Teacher | backend+web |

### 3.3 AI Whiteboard (Flutter web + Android, IFP-first)
| Feature | What it does | Persona | Where |
|---|---|---|---|
| **Offline/standalone mode** | Full drawing (pen/highlighter/shapes/text/eraser/selection/undo-redo 50-step/multi-page) with zero login/session/socket; local save/load (SharedPreferences); connectivity chip (online/limited/offline); AI degrades gracefully, board never blocked **PORT: high value** | Teacher | whiteboard app |
| Cloud boards | Board CRUD API (`board_data` JSONB, thumbnails), board library screen | Teacher | backend+whiteboard |
| Live session mode | Session codes, QR join, Socket.IO stroke/element/cursor sync, participants; remote strokes bypass local undo stack | Teacher+students | sockets + SessionProvider |
| **Circle-to-Search** | Draw circle around anything → AI identifies/explains (Vision) **PORT: high value** | Teacher | whiteboard AI drawer |
| Whiteboard Math / Chemistry solver | Step-by-step LaTeX solutions on board (flutter_math_fork) | Teacher | whiteboard |
| Shape explainer | Describes drawn diagram in curriculum context | Teacher | whiteboard |
| AI PPT panel on board | Topic → slide outline + PPTX download | Teacher | whiteboard (partial) |
| Sketchfab 3D embed on board | JS↔Dart bridge (`SketchfabBridgeService`), node highlight (dim others to 0.2 opacity), screenshot capture stream | Teacher | whiteboard **PORT: high value** |
| PNG/PDF export | RepaintBoundary capture via share_plus (mobile only; web export broken) | Teacher | whiteboard |
| IFP compatibility layer | Flutter web canvaskit build in IFP browser; stylus vs finger via PointerDeviceKind (stylus draws, palm rejection, finger pans); optional local-APK deployment for offline schools; IFP UX rules (touch-scaled toolbar, on-screen keyboard, 1-tap clear, per-board-name switching) | Teacher | spec §8 **PORT: high value** |

### 3.4 3D Visualization
| Feature | What it does | Persona | Where |
|---|---|---|---|
| **Branded Sketchfab wrapper** | Viewer API 1.12 inside Sahayatri shell — hide Sketchfab's controls/info/annotations, keep required watermark, own toolbar/info/quiz panels; node map, camera look-at/recenter, highlight, show/hide nodes, screenshot **PORT: high value** | Student/teacher | web `SketchfabViewer` + `lib/sketchfab.ts`; Flutter WebView bridge |
| Curated model library | 103 seeded Sketchfab UIDs across Bio/Chem/Physics/Math/CS/Social/English, class-level tagged | Admin curates | seed script |
| **AI auto-annotation** | Groq generates 5 annotations per model (`{node_name, label_ne/en, description_ne/en}`); clickable overlay highlights scene nodes **PORT: high value** | Admin generates; students consume | `/admin/simulations/<id>/generate-annotations/` |
| Model quiz mode | Linked exercise blocks rendered as scored quiz sidebar | Student | `ModelQuizPanel` |
| oEmbed metadata enrichment | Fetch title/author/license/thumbnail from Sketchfab Data API, Redis-cached 24 h | Admin | `sketchfab_service.py` |
| Usage analytics | View counts, top models, class-level breakdown | Admin | web analytics page |

### 3.5 Quiz & Assessment
| Feature | What it does | Persona | Where |
|---|---|---|---|
| Practice quiz generator | AI MCQs from topic, JSON `{question, options, answer, explanation}`, server-side scoring, token-gated (cost 60) | Student | backend+web **PORT: high value** |
| **Live quiz (Kahoot-style)** | Host creates quiz → 6-char join code → participants answer → leaderboard; Socket.IO events (`lq_join/start/answer/next/end`); server-side answer verification + Redis state (post-fix) | Teacher hosts | backend+sockets **PORT: high value** |
| Mock test / exam prep | SEE/NEB/HSEB paper types, timed countdown mode, localStorage autosave | Student | spec + web tools |
| Question paper generator | Nepal marks distribution, sections + answer key | Teacher | AI tool |

### 3.6 Learning Science
| Feature | What it does | Persona | Where |
|---|---|---|---|
| **Spaced repetition (SM-2)** | Full SuperMemo-2 on exercise blocks: ease factor min 1.3, intervals 1→6→interval×EF, quality 0–5, statuses learning/review/graduated; auto-creates cards from unreviewed blocks; card-flip UI with 6 quality buttons **PORT: high value** | Student | `spaced_rep_service.py`, mobile practice screen |
| **Adaptive learning path** | Per-topic stats from SM-2 cards → categorize weak (avg ease <2.1) / new / in_progress with human-readable reasons; `mastery_scores` JSONB; context-driven adaptive exercise generation (chapter context + ease factor pick Bloom level) **PORT: high value** | Student | `adaptive_service.py`, web adaptive-path |
| **Gamification** | XP events (login 5, spaced_rep 10, exercise 10, quiz_correct 15, streak_bonus 20, lesson 25, quiz_perfect 30), 11 levels (0–4000 XP), 6 badges (first_login 👣, streak_7 🔥, streak_30 🏆, xp_500 ⭐, xp_2000 🎓, quiz_10 🏅), daily streaks with longest-streak, institution leaderboard **PORT: high value** | Student | `gamification_service.py`, mobile+web |
| Emotion check / coach | Text-based emotion detection (8 emotions, intensity, `is_concerning` flag → prominent "Talk to your teacher" CTA, empathy response, typed suggestions); privacy-safe (text only; camera-based opt-in only in spec) | Student | `/ai/emotion/detect/` **PORT: high value** |

### 3.7 Teacher AI Tools (61 web pages)
- **Planning (15):** lesson planner (structured JSON: objectives, timed 5-phase flow, materials, homework, differentiation for struggling/advanced, NEB curriculum reference), differentiated lesson, unit planner, PPT creator (python-pptx file output, 5 theme presets), worksheet creator (student version + teacher answer key), reading-level adapter, vocabulary builder (with Nepali equivalents), analogy generator (Nepal-local), story-based lesson, real-world connector, bilingual content creator, subject crossover, project designer, simulation activity designer, field trip planner.
- **Assessment (15):** quiz generator, question paper generator, Bloom's optimizer, rubric generator (criteria × performance-level table), feedback writer, class report, essay evaluator, peer assessment designer, exit tickets, progress report (Nepali/English), formative assessment designer, error analysis, grade distribution analyzer, SEE/NEB marks predictor, IEP goal writer.
- **Communication (10):** parent email/letter drafter, meeting agenda, **SMS notification drafter**, student referral, recommendation letter, class newsletter, policy simplifier, incident report, award citation, training reflection.
- **Whiteboard (10):** live concept map, math step solver, diagram explainer, chemistry equation balancer, timeline builder, comparison table, AI annotator, language bridge (ne↔en), code visualizer (flowchart), Venn diagram.
- **Professional development (10):** reflection prompter, action research designer, classroom management advisor, motivation strategies, co-teaching planner, substitute lesson planner, technology integration advisor, mindfulness, student grouping strategist, self-assessment.
- **Teacher community:** posts (discussion/lesson_plan/worksheet/resource) + likes; originally Redis-only (90-day TTL), later write-through to `community_posts` DB.

### 3.8 Student AI Tools (60 web pages)
- **Core learning (20):** Voice Tutor (multi-turn, STT → chat → Nepali TTS), Image Doubt Solver (camera/gallery), Concept Explainer, Socratic Tutor, Math Step Solver, Chemistry Solver, Physics Solver, Essay Helper, Grammar Corrector, Translation (ne↔en), Summary, Key Points, Flashcards, Mind Map, Definition Finder, Example Generator, Counter-Example Generator, Analogy Finder, History Storyteller, Geography Explorer.
- **Exam prep (15):** SEE prep, NEB prep, Mock Test, Weak Topic Identifier, Revision Planner, Past Exercise Analyzer, Marks Distribution Analyzer, Short Answer Practice, Long Answer Structurer, MCQ Strategy Coach, Last-Day Revision, Formula Sheet, Exam Vocabulary, Spelling Checker, Time Management Coach.
- **Adaptive (10):** Daily Review Cards, Mastery Checker, Learning Path Advisor, Adaptive Practice, Mistake Analyzer, Prerequisite Checker, Progress Visualizer, Streak Tracker, Knowledge Gap Finder, Bloom's Level Progressor.
- **Creative/research (10):** Research Starter, Project Ideas, Presentation Script, Debate Builder, Poetry Helper, Creative Writing Coach, Science Experiment Designer, Career Explorer, Current Events Connector, Interview Practice.
- **Wellbeing (5):** Motivation Coach, Stress Management, Focus Timer (Pomodoro), Goal Setter, Gratitude Journal.

### 3.9 Generative file tools (finalprompt.md architecture; partially built)
- **PPT generator** — AI JSON (7 slide types, speaker notes, table slides, 5 themes incl. "nepal_blue") → python-pptx → MinIO download + web slide navigator preview.
- **Video generator** — async 5-stage Celery pipeline: LLM script/scenes (JSON) → FLUX.1-schnell images (Together/Replicate, Unsplash fallback) → edge-tts narration → ffmpeg concat with drawtext overlays → MinIO MP4; Redis job state + polling progress UI with stage labels.
- **Document generator** — AI JSON → python-docx → WeasyPrint PDF (lesson plans, reports, letters, policies, certificates).
- **Agentic research** — plan queries (LLM JSON) → Brave/SerpAPI/DuckDuckGo search → fetch + readability-extract top 3 URLs/query → synthesize cited report (quick 300w / standard 800w / deep 1500w) with citations sidebar and further reading.

### 3.10 Admin & Dashboards
- **Super-admin dashboard:** institutions/users/exercises/subscriptions counts, 30-day DAU chart, token usage by model, import job summaries, system alerts.
- **Subscription manager:** plan CRUD (NPR price, tokens, max students/teachers/AI calls/3D models), assign plan to institution, billing export.
- **Institution dashboard:** students/teachers/classes, exercise bank size, AI sessions this month, token usage gauge, pending actions, top AI tools ranking.
- **Teacher dashboard:** today's classes with "Start Whiteboard" buttons, quick tools, class performance + "Generate Remedial Worksheet" action.
- **Student dashboard:** Nepali greeting, streak/XP header, "Today's adaptive plan" (Review due → Practice weak → Learn new), quick tool tiles, per-subject progress bars.

---

## 4. AI Capabilities — Detail

### 4.1 Models (Groq-first, speed/cost tiering)
| Use case | Model |
|---|---|
| Voice tutor / fast classification / flashcards | `llama-3.1-8b-instant` |
| Default chat, all text tools, context generation, quiz gen | `llama-3.3-70b-versatile` |
| Vision: page classification, chapter MD extraction, exercise extraction, image doubt solver, circle-to-search | `llama-3.2-90b-vision` (spec) / `meta-llama/llama-4-scout-17b-16e-instruct` (built code) |
| STT | `whisper-large-v3-turbo` (Groq Audio API, multipart) |
| TTS | edge-tts (ne-NP-SagarNeural / ne-NP-HemkalaNeural), gTTS fallback; deliberately swappable service |
| Image gen | Together `FLUX.1-schnell-Free` / Replicate `flux-schnell` / Unsplash fallback |
| Embeddings / vector DB | **None** — deliberately absent. "RAG" = structured `chapter_ai_context` + token-overlap ranking + raw `content_markdown` excerpts (6,000 chars for voice tutor). |

### 4.2 Prompt architecture
- `NEPAL_FIRST_SYSTEM` base system prompt: Nepali-first response rule (Devanagari, English terms parenthesized), NEB/SEE/CDC curriculum grounding per class band, Nepal-context examples (NPR, geography, festivals), "never give exam answers directly — guide the student", formatting rules, CDC math notation.
- Per-tool instruction dicts (`prompts/student/tools.py`, `prompts/teacher/tools.py`) composed as: base system + chapter context block + tool instruction + explicit language branch (`ne`/`hi`/`en`).
- Strict JSON-output contracts everywhere: `response_format={"type":"json_object"}` or embedded JSON schema with "Return ONLY this JSON" rules; fence-stripping `chat_json()`.
- Full prompt library for ingestion: page_classifier, toc_extractor, chapter_md_extractor, image_describer, exercise_md_extractor (with explicit anti-MCQ rules: "Never assume MCQ if no (क)(ख)(ग)(घ) options; numerical sub-parts are not MCQ options; extract text EXACTLY, do not translate"), context_builder.
- Follow-up suggestion chips returned with every AI result.

### 4.3 Context / RAG design (novel pattern)
1. Ingest textbook → chapter Markdown stored on `subject_topics`.
2. LLM distills each chapter into structured `chapter_ai_context` (definitions/theorems/formulas/mistakes/exam tips) — human-approved before publishing.
3. Every AI tool injects the published context block + content excerpt into its system prompt (no vector DB; deterministic, auditable, cheap).
4. Query-relevance by token overlap selects the right context.
This "curated knowledge-base-as-RAG with human approval" is **PORT: high value**.

### 4.4 Agents & orchestration
- Research agent: plan → search → fetch → synthesize loop (max 5 iterations, 3 sources/query, truncation per source).
- Video generator: 5-stage Celery pipeline with Redis job state, polling, retries, temp-dir cleanup.
- Ingestion: 7-stage Celery pipeline, page batches of 10, max 3 retries, graceful no-API-key degradation, admin SSE progress + Socket.IO completion events.
- Two-phase-commit token gating wraps every AI call (check → execute → deduct).

### 4.5 Guardrails, moderation, evaluation, cost control
- **Guardrails:** system-prompt level (curriculum grounding, no-direct-answers, encouraging tone); `is_concerning` flag on emotion tool with human-escalation CTA; safe search (moderate) on Brave; per-role content isolation (students see only enrolled-class content).
- **Moderation:** none beyond the above (explicit gap).
- **Evaluation:** confidence scores on extraction (0–1, auto-approve thresholds 0.90/0.85, reject <0.30), context quality score (0–100), per-page/block extraction confidence; no automated answer-quality eval suite.
- **Cost control:** `@require_tokens` decorator — cost from `ai_tools.token_cost_estimate` with default fallback; HTTP **402** `{insufficient_tokens, tokens_remaining, tokens_needed}`; `token_usage_log` per call (user, institution, tool, model, subject, topic); tool-cost seed table; institution plan quotas (`max_ai_calls_per_month`, `max_students`, `max_3d_models`); platform-level ingestion accounting.

### 4.6 Voice pipeline
Mobile/web mic (m4a via `record`) → `POST /ai/voice-tutor/transcribe/` (Whisper, language hint) → auto-send transcript → multi-turn chat (8b-instant; upgrades to 70b + 6,000-char chapter context when topic set) → `POST /ai/voice-tutor/speak/` (edge-tts MP3, gender choice) → `audioplayers`. Voice listing endpoint. Whiteboard TTS was stubbed.

### 4.7 OCR / Vision
Entirely Groq Vision (no tesseract): page classification, TOC extraction, full-page Markdown extraction with LaTeX preservation, figure placeholder → Pillow crop → S3 → Vision bilingual alt-text, exercise block extraction. Works because pages are rasterized images — sidesteps Preeti font-encoding garbage entirely.

---

## 5. Data Model (30+ tables)

**Core identity/tenancy:** `institutions` (name_nepali, district, province, type school/college/coaching, subscription_plan_id) · `users` (role, full_name_nepali, preferred_language default 'ne', google_id) · `institution_api_keys` (key, scopes[], last_used_at).

**Academic structure:** `class_grades` (level, curriculum_type NEB) → `subjects` (title_nepali) → `subject_topics` (chapter_number, **content_markdown**, **content_markdown_ne**, learning_objectives[], bloom_levels[], content_word/image_count) · `institution_classes` (section, academic_year, room_number) · `teacher_class_assignments` (UNIQUE teacher+class+subject) · `student_enrollments` (roll_number, UNIQUE student+class).

**Content:** `exercise_blocks` (**exercise_markdown** + detected_type from 19-type enum, detected_marks, has_math / has_image_reference / has_sub_parts / sub_part_count, bloom_level, difficulty, source govt_textbook|institution_upload|manual|ai_generated, source_reference e.g. "CDC Class 10 Opt Math 2082", source_exercise_label "अभ्यास 1.2", tags[]) · `question_papers` (exercise_block_ids UUID[], instructions_nepali, exam_type, academic_year) · `study_materials` (pdf|video|link|note|ppt) · `pdf_documents`.

**Ingestion:** `content_import_jobs` (job_type govt_textbook|institution_paper, detected_class/subject/language/book_title/publisher/edition, 9-stage status enum, pages_processed, error_log JSONB, review tracking, published_at) → `import_job_pages` (raster_url, page_type, has_math/diagrams/images/exercises flags, extracted_markdown, extracted_images JSONB, vision_raw_output, processing_ms) → `draft_chapters` (title_ne/en, content_markdown, sub_sections JSONB, key_concepts, detected_formulas[], confidence_score, published_topic_id, admin_edits) → `draft_exercise_blocks` (exercise_markdown, detected metadata, admin_edited_markdown, confidence_score, published_exercise_id) · `institution_paper_uploads` (exam_type/year/month, links import job + published paper).

**AI/learning:** `chapter_ai_context` (UNIQUE per topic; summary_ne/en, key_definitions / theorems_and_rules / key_formulas / worked_examples / common_mistakes JSONB, exam_tips_ne, connections[], generated_by_model, generation_prompt_version, status draft|published) · `ai_sessions` (tool, conversation_history JSONB, tokens_used) · `ai_tools` (slug, token_cost_estimate) · `learning_paths` (current_topic, completed/weak topic UUID[], mastery_scores JSONB) · `spaced_rep_cards` (ease_factor, interval, repetitions, due_at, status; UNIQUE student+block) · `student_gamification` (xp, level, streak_days, longest_streak, badges JSONB) + `xp_events` · `token_usage_log`.

**Subscriptions:** `subscription_plans` (price_npr, monthly_tokens, ai_tools_access[], max_students, features JSONB) · `user_subscriptions` (tokens_remaining, tokens_used_this_cycle, status trial|active|expired|cancelled, is_trial, auto_renew, payment_reference).

**Whiteboard/live:** `whiteboard_sessions` (session_code, board_snapshot_url) · `whiteboard_boards` (board_data JSONB, thumbnail_url, is_public) · `live_class_participants` (joined_via qr) · `live_polls` (options/responses JSONB).

**3D:** `simulation_models` / `sketchfab_models` (sketchfab_uid, bilingual titles/descriptions, annotations_json `[{node_name, label_ne, label_en, description_ne, description_en}]`, quiz_questions JSONB, sketchfab_author, sketchfab_license, view_count) · `simulation_panels` (info|quiz|annotation).

**Community:** `community_posts` (post_type, like_count, soft delete).

**Relationships summary:** Institution 1—* Users; Institution → InstitutionClasses (via ClassGrade) → StudentEnrollments/TeacherClassAssignments; ClassGrade → Subjects → SubjectTopics → (content_markdown, ChapterAiContext 1:1, ExerciseBlocks *:1); ingestion chain Job→Pages→DraftChapters→DraftExerciseBlocks publishing into SubjectTopics/ExerciseBlocks; ExerciseBlocks feed SpacedRepCards, QuestionPapers (UUID[]), SimulationModel quizzes; every AI call logs to TokenUsageLog against UserSubscription quotas.

---

## 6. Integrations
- **Payments:** none implemented; eSewa/Khalti/IME Pay named as Nepal rails; `payment_reference` field exists.
- **SMS:** inbound-data API layer done (`/api/sms/v1/` + scoped API keys); outbound Sparrow SMS (Nepal) gateway wrapper (PROGRESS.md SVC-3).
- **Email:** SendGrid primary + SMTP/MailHog fallback; forgot/reset-password flows.
- **Storage:** MinIO/S3 via boto3 (`S3Service`: upload_bytes, presigned URLs, ensure_bucket); keys like `imports/textbooks/{job}/pages/page-{N}.jpg`, `imports/textbooks/{job}/images/page_{N}_fig_{M}.jpg`, `ai-ppts/...`, `ai-videos/...`.
- **3D:** Sketchfab Viewer API 1.12 (free embed w/ required attribution) + Data API / oEmbed (metadata, license) — Redis-cached 24 h.
- **Search:** Brave Search API (moderate safesearch) / SerpAPI / DuckDuckGo HTML fallback.
- **Image gen:** Together AI / Replicate / Unsplash fallback.
- **Realtime:** Flask-SocketIO with Redis message queue (multi-process pub-sub); rooms `wb:<CODE>`, `lq:<code>`.
- **Hardware:** IFPs (Android-based native; Windows smart boards via Chrome), stylus vs touch handling, QR display for session join, optional local-APK offline deployment.
- **Maps/hardware APIs:** none external (map_work is textbook content only).

---

## 7. UX / Interaction Patterns Worth Stealing
- **Three-mode whiteboard onboarding** (Start Drawing offline / Open My Board / Start Live Class) — zero-account start, deferred login, upgrade-in-place to a live session.
- **Connectivity chip** (green/amber/black) and "AI needs internet; board drawing still works" — honest offline degradation.
- **Confidence-tiered review queues**: "Auto-approve 247 high-confidence blocks; manually review 100" — massive admin time saver.
- **Token cost badges** on every AI tool + token balance widget in AppBar.
- **Live SSE ingestion progress**: per-stage status table, per-chapter live detections, token counter, ETA.
- **Gamification**: streaks with longest-streak memory, XP event table, badge set, institution-scoped leaderboard, "Today's adaptive plan" (Review → Practice weak → Learn new) dashboard pattern.
- **Shared AI workspace scaffolding**: 8 reusable page archetypes (Chat / Solver / Flashcards / Analysis / Exam / Writing / Planner / Wellbeing), each with subject/topic scope selector, language toggle, follow-up chips, TTS playback — 130+ tool pages from ~10 components. (finalprompt.md argues to flip this to per-tool dedicated pages with strict JSON contracts; both patterns are documented.)
- **Bilingual everything**: parallel `_nepali` columns, per-entity Nepali titles, mid-conversation language toggle.
- **KaTeX/Markdown rendering everywhere**, including admin review screens ("review exactly what students will see").
- **QR-join live sessions** for classrooms without student accounts/devices.
- **"Talk to your teacher" CTA** on concerning emotion detection; deliberately non-clinical soft-palette wellbeing UI.
- **Accessibility:** Vision-generated bilingual alt-text for every textbook figure; otherwise weak (no service worker, missing error boundaries initially, minimal a11y).
- **Low-bandwidth:** offline whiteboard, offline AI cache concept (last 20 AI results keyed by prompt hash — stub), Groq chosen for lowest latency (critical for voice UX).

---

## 8. Nepal-Specific Design
- **Curriculum:** NEB (11–12), SEE (9–10, CDC), basic education (1–8); `curriculum_type` field; Nepal marks distribution in papers; SEE/NEB prep modes.
- **Devanagari:** Preeti encoding problem → rasterize+Vision solution; Devanagari detection in image solver auto-selects `ne`; Nepali sub-part letters (क ख ग घ ङ); academic Nepali with English terms in parentheses; nepaliNumerals/timeAgo web utils.
- **Exercise typology:** 19 Nepal patterns with Nepali trigger verbs (सही उत्तर छान्नुहोस्, हल गर्नुहोस्, प्रमाणित गर्नुहोस्, रचना गर्नुहोस्, मिलाउनुहोस्, रिक्त स्थान भर्नुहोस्, क्रियाकलाप, नक्सामा…, अनुच्छेद पढ्नुहोस्…) — stored as Markdown blocks, never forced MCQ. **Core differentiating insight.**
- **Bikram Sambat:** academic years "2081-82", exam-year pickers in BS, source references "CDC … 2082 BS"; no BS↔AD conversion utility found (gap).
- **Payments:** NPR pricing; eSewa/Khalti/IME Pay planned but absent.
- **SMS:** Sparrow SMS; dedicated integration API for the school-management ecosystem.
- **Government:** CDC textbook ingestion, NEB textbook portal links; **no IEMIS/EMIS reporting integration** anywhere (gap).
- **Prompts:** NPR currency, Nepali geography/festivals examples, "Nepal NEB" injected into research queries.
- **Voices:** ne-NP Sagar/Hemkala neural voices.

---

## 9. Known Gaps / TODOs / Failures (AUDIT.md, PROGRESS.md, implementation_plan.md)

**Never finished / absent:**
- Nepal payment gateway (eSewa/Khalti) — subscriptions activate without payment verification.
- Full NEB Class 9–12 textbook corpus processing (blocked on real PDFs).
- iOS build pending; mobile quiz/gamification/adaptive-path screens were 0% at audit (PROGRESS.md later adds them, plus TokenBalanceWidget and dart-define API URL).
- Whiteboard stubs at audit time: TTS, offline AI cache, AI PPT panel, circle-search overlay UI, board library wiring (several completed in PROGRESS.md).
- Chapter context versioning; higher-confidence MD extraction.
- Video/PPT/document/research-agent tools were architecture-only in finalprompt.md (per-tool routes/schema/service/prompt pattern; not confirmed built).
- IEMIS/government reporting; push notifications (no FCM/OneSignal); web offline/service-worker; BS date conversion.
- Input validation: 7 empty marshmallow schema files (schemas later added per PROGRESS.md); test coverage ~25% → improved (39 test cases listed).

**Bugs found in audit (several fixed per PROGRESS.md):**
- Live quiz socket trusted client-sent `is_correct`; HTTP vs socket dual score state (fixed: Redis-backed, server-side verification — SEC-2).
- Live quiz + whiteboard room state in-memory (fixed: Redis, 12-h TTL — SEC-2/PROD-1).
- Voice tutor chat un-token-gated (revenue leak) — flagged Priority 1 in both audits.
- Community posts Redis-only data-loss risk (fixed: write-through DB — SVC-5).
- Hardcoded `http://10.0.2.2:5000` Flutter base URL (fixed: `--dart-define` — MOB-6).
- Default `SECRET_KEY="sahayatri-dev-secret"`, CORS `*` (ProductionConfig asserts override); Redis no AOF; MinIO creds in compose; no auth rate limiting (Flask-Limiter added — SEC-4); no CSRF on subscription routes.
- `learning_paths.mastery_scores` written but recommendation engine reads SpacedRepCard (redundancy); mobile 3D node-highlight JS never loads on raw embed; Flutter-web PNG export broken (`share_plus`); `Subject.name` vs `.title` crash; email service and outbound SMS initially absent (both added per PROGRESS.md).

**Structural critique (finalprompt.md):** shared `run_text_tool()` antipattern + monolithic `TeacherAiWorkspace.tsx` (773 lines) — replaced by per-tool route/schema/service/prompt modules with strict JSON contracts; prompts directory spec vs inline-prompt reality.

**Scorecard (AUDIT.md §10):** Backend ~78%, Web ~94%, Mobile ~65%, Whiteboard ~82%, Infra ~85–88% → **total ~81%**. Strongest: Groq service, ingestion pipeline, whiteboard sync, admin/import-hub UI, AI tool coverage (120+ endpoints, 98% web). Weakest: validation schemas (5%→fixed), tests, email/SMS (0%→added), mobile coverage.

---

## 10. Prioritized "PORT into ASchool" List

### Tier 1 — High value, high fit (multi-tenant school SaaS + plugins)
| # | Item | Why port | Suggested ASchool plugin |
|---|---|---|---|
| 1 | **Vision-AI textbook/paper ingestion pipeline + Smart Import Hub** (7-stage Celery, confidence auto-approve, Bloom tagging, duplicate detection, admin review/publish, SSE progress) | The crown jewel; turns CDC PDFs and school past papers into structured content; schools can self-serve their own papers | `content-ingestion` |
| 2 | **Chapter AI Context knowledge base** (structured per-chapter JSON, draft→approve→publish workflow, injected into all AI prompts; no vector DB) | Auditable, cheap, human-approved RAG substitute; composes with every future AI feature | `ai-context` |
| 3 | **Exercise Blocks as Markdown** (19 Nepal types, detected metadata, exercise bank UI w/ KaTeX, source badges) | Preserves real question diversity; feeds quizzes, papers, spaced repetition | core data model |
| 4 | **Token gating + usage ledger** (`@require_tokens` two-phase commit, 402 semantics, `token_usage_log`, per-tool cost table, plan quotas) | Ready-made AI monetization for ASchool subscriptions | billing |
| 5 | **SMS integration API layer + institution API keys + Sparrow outbound** | ASchool is a school-management SaaS — native fit for parent notifications and third-party SMS systems | `sms-gateway` |
| 6 | **Question paper generator + WeasyPrint PDF** (from exercise_block_ids, Nepal marks distribution) | Teacher painkiller; reuses exercise bank | `assessment` |
| 7 | **SM-2 spaced repetition + adaptive path engine** (weak/new/in_progress categorization with reasons; adaptive exercise generation from context + ease factor) | Differentiated student feature; deterministic and cheap | `learning` |
| 8 | **Gamification service** (XP events, 11 levels, streaks, badges, institution leaderboard) | Engagement layer, small backend, big retention payoff | `learning` |

### Tier 2 — High value, more integration work
| # | Item | Why port |
|---|---|---|
| 9 | **Offline-first whiteboard for IFPs** (Flutter web, no-auth start, three modes, QR live sessions, socket sync, board cloud save, IFP UX layer) | ASchool has Flutter apps; IFP classroom story is a differentiator no LMS has |
| 10 | **Branded Sketchfab 3D viewer + AI auto-annotations + model quiz mode** (103 curated models seeded, license/attribution handled) | Free 3D science library with AI overlay; classroom wow-factor |
| 11 | **Voice Tutor loop** (Whisper STT → context-injected chat → edge-tts ne-NP voices) | Nepali voice tutoring for ASchool student app |
| 12 | **Image Doubt Solver + Circle-to-Search** (Groq Vision on textbook photos) | Highest perceived-value student AI tool |
| 13 | **Practice quiz + live Kahoot-style quiz** (server-verified answers, Redis state, join codes, leaderboard) | Classroom engagement; audit fixes already documented |
| 14 | **AI PPT/Document generators** (AI JSON → python-pptx / python-docx / WeasyPrint, theme presets, S3 download + preview) | Teacher productivity; pattern generalizes to any file output |
| 15 | **Bilingual AI foundation** (NEPAL_FIRST_SYSTEM prompt base, ne/en/hi branches, Nepali Bloom keyword tagger, exercise-type taxonomy) | Reusable prompt/eval foundation for all ASchool AI in Nepal |

### Tier 3 — Selective
- Emotion check/coach with escalation CTA (cheap wellbeing differentiator).
- Agentic research (Brave → cited report) for teachers/students.
- Teacher community (posts/likes, lesson-plan sharing) — build DB-first, never Redis-only.
- Video generator (ffmpeg pipeline) — expensive, lowest priority.
- Confidence/auto-approve + duplicate-detection engines as standalone services (already inside #1).
- Parent portal, per-role dashboards — ASchool likely has equivalents.

### Do NOT port
- Sahayatri auth (ASchool has its own tenancy); subscription plan CRUD (map to ASchool billing); Groq-specific wrapper (keep behind an ASchool AI abstraction); hardcoded emulator URLs; Redis-only persistence for durable data (the single biggest Sahayatri architectural mistake — use DB-first with Redis cache); shared `run_text_tool()` catch-all antipattern (use finalprompt.md's per-tool contract pattern instead).

---

## Appendix A — Token Cost Reference (spec §18)
Voice Tutor 15–40 · Concept Explainer 30–80 · Math Solver 40–100 · Doubt text 30–80 · Doubt image 60–150 · Lesson Plan 100–200 · Quiz 80–150 · Question Paper 150–300 · Essay 80–200 · Flashcards 50–100 · TTS 5 · Whiteboard Math 50–100 · Circle-to-Search 60–120 · 3D annotations 100–200. Ingestion (platform-paid): classify 8/page, TOC 15, chapter MD 35/page, image 20, exercises 40/page, context 500/chapter → ~21k tokens per 298-page textbook, 30–40 min end-to-end.

## Appendix B — Competitor positioning (spec §20)
Sahayatri vs MagicSchool AI / AI-Whiteboard.app / SmatoroAI: only Sahayatri combines IFP-native offline whiteboard, voice tutor, image doubt solver, adaptive paths, class-based content isolation, branded 3D with AI overlay, Nepali language, NEB/SEE/HSEB curriculum, govt textbook auto-ingestion, Markdown-fidelity content, admin review workflow, SMS API, NPR token pricing, gamification, SM-2, and emotion AI.

---

*Inventory compiled 2026-09-04 from Sahayatri planning documents only (no source code modified; report is the sole file written).*
