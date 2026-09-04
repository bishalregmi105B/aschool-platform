# Sahayatri Backend — Code Audit (as-implemented)

Audited: 2026-09-04. Source root: `/home/bishal-regmi/Desktop/Sahayatri` (backend at `backend/`).
Purpose: feed the port of Sahayatri's capabilities into ASchool (multi-tenant Flask + SQLAlchemy 2 + Postgres 16 + pgvector + Redis + Celery + plugin system at `backend/app/plugins/modules/`, AI layer at `backend/app/services/ai/`).

> Verdict in one line: Sahayatri is a **single-tenant Flask 3 monolith with ~323 REST endpoints, 36 SQLAlchemy 2 tables, a Groq-only LLM layer, no vector RAG (chapter-context "RAG-lite" instead), a solid 7-stage vision ingestion pipeline, Redis-backed realtime, and a good token-metering design — but with a broken `GroqService.chat()` signature that breaks every JSON-mode tool call, thin tests (794 lines, several testing stale routes), and heavy local-fallback stubbing of AI outputs.**

---

## 1. Stack & Runtime Map

| Aspect | Implementation | Anchor |
|---|---|---|
| Framework | Flask 3.x, app-factory pattern (`create_app`) | `backend/app/__init__.py:11-20` |
| Python | 3.13-slim Docker image | `backend/Dockerfile:1` |
| ORM | Flask-SQLAlchemy 3.1 + SQLAlchemy 2.0 (Mapped/mapped_column style) | `backend/app/extensions.py:12` |
| DB | Postgres 16 (`postgresql+psycopg`), `pool_pre_ping=True` | `backend/app/config.py:21-26`, `compose.yaml:48-61` |
| Tests DB | SQLite in-memory (`TestingConfig`) | `backend/app/config.py:53-58` |
| Cache/queue | Redis 7 (appendonly), db0 Celery broker, db1 Socket.IO message queue | `compose.yaml:63-73`, `compose.yaml:10-13` |
| Realtime | Flask-SocketIO, `async_mode="threading"`, optional Redis message_queue | `backend/app/extensions.py:29-34` |
| Rate limiting | Flask-Limiter[redis], key = remote address, `default_limits=[]` (i.e. **no default limits actually set**) | `backend/app/extensions.py:14,37-38` |
| Celery | Celery 5.4 worker, FlaskTask wrapper pushing `app.app_context()` per task | `backend/app/tasks/celery_app.py:5-26`, `backend/celery_worker.py` |
| Object storage | MinIO via boto3 S3-compatible `S3Service`; `MinioService` is a thin alias | `backend/app/services/s3_service.py:24-102`, `backend/app/services/minio_service.py` |
| Mail | SendGrid-primary/SMTP-fallback + Mailhog in dev | `backend/app/services/email_service.py`, `compose.yaml:133-138` |
| SMS | Sparrow SMS (Nepal) gateway | `backend/app/services/sms_gateway_service.py:1-107` |
| Reverse proxy | nginx 1.27: `/api/` + `/socket.io/` → backend (WS upgrade, 3600s read timeout for sockets), `/whiteboard/` → whiteboard container, `/` → Next.js web | `nginx/nginx.conf` |
| Entry | `run.py` → `socketio.run(app, port 5000)`; worker: `celery -A celery_worker.celery_app worker --concurrency=2` | `backend/run.py`, `compose.yaml:75-104` |
| Migrations | Alembic, 15 revisions (`20260508_0001` … `20260523_0001`) | `backend/migrations/versions/` |
| Config classes | Base/Development/Testing/Production; Production asserts SECRET_KEY, JWT key, non-`*` CORS at import time | `backend/app/config.py:61-72` (good fail-fast pattern) |
| AI providers | Groq (chat/vision/STT), Together AI (image gen FLUX.1-schnell), Replicate fallback, OpenAI TTS-1 (video), Brave/DuckDuckGo search, edge-tts/gTTS | `backend/app/services/groq_service.py`, `image_generation_service.py`, `tasks/video_tasks.py`, `tts_service.py` |
| Extensions wiring | CORS on `/api/*`, `redis_client` global, RATELIMIT_STORAGE_URI = Redis | `backend/app/extensions.py:18-38` |
| Blueprint registry | One `/api` parent blueprint with 13 domain blueprints + 19 AI-tool blueprints | `backend/app/api/__init__.py:40-71` |

**Security note:** `.env.example` contains a real-looking Groq API key committed to the repo (`backend/.env.example:17`), and compose mounts `.env.example` as the live `env_file` (`compose.yaml:6-7`). Do not copy this pattern.

---

## 2. API Endpoint Map (~323 route decorators, grouped)

Auth model: manual JWT bearer (PyJWT HS256, `access`/`refresh` typed tokens, Redis JTI blacklist). Helpers: `require_role(*roles)` (super_admin always allowed), `require_any_auth()` — `backend/app/utils/auth_helpers.py:19-52`. AI routes use `@require_tokens(tool, default_cost)` → HTTP 402 on shortage — `backend/app/utils/token_gate.py:41-83`. There is **no decorator-based registration; each view calls the helper inline.**

### Auth `/api/auth` (9 routes) — `app/api/auth/routes.py`, `oauth_routes.py`
| Method/Path | Purpose | Auth |
|---|---|---|
| POST `/register/` | register user (role from body) | public |
| POST `/login/` | password login → access+refresh pair | public |
| POST `/logout/` | blacklist access+refresh JTIs in Redis | any auth |
| POST `/refresh/` | rotate refresh (old blacklisted) | refresh token |
| POST `/forgot-password/`, `/reset-password/` | email reset flow (SMTP/SendGrid) | public |
| GET `/me/` | current profile | any auth |
| POST `/register-institution/` | institution + admin user signup | public |
| POST `/google/` | Google OAuth code exchange | public |

### Super-admin `/api/admin` (~45 routes) — `routes.py`, `content_routes.py`, `import_routes.py`, `chapter_context_routes.py`, `simulation_routes.py`, `simulation_analytics.py`, `sketchfab_routes.py` — all require_role("admin","super_admin")
- CRUD `/dashboard/`, `/dashboard/stats/`, `/institutions/…`, `/users/…`
- Curriculum CRUD: `/classes/` (ClassGrade), `/subjects/`, `/topics/` (+ `/topics/<id>/content/`), `/exercises/` (+bloom-detect)
- **Textbook ingestion hub**: POST `/import/textbook/upload` → Celery job; GET `/import/jobs/<id>/`, `/progress/`, `/exercises/`, `/structure/`, `/structure/<chapter>/markdown`; PUT chapter/exercise review edits; POST `/structure/approve-all`, `/exercises/bulk-review`, `/exercises/smart-filter`, `/exercises/check-duplicates/`, `/import/jobs/<id>/publish` (promotes approved DraftChapters→SubjectTopics, DraftExerciseBlocks→ExerciseBlocks), `/retry`, DELETE job.
- **Chapter AI context workflow**: GET/PUT/DELETE `/chapter-context/<topic_id>`, POST `.../generate`, `/generate-batch`, `/approve` (draft→published state machine).
- Sketchfab 3D model CRUD + view counter; simulation analytics track/list; AI annotation generation.

### Institution admin `/api/institution` (~25 routes) — `routes.py`, `class_assignment.py`, `student_enrollment.py`, `paper_upload.py` — role institution_admin/super_admin
- GET/PUT `/profile/`, GET `/dashboard/`; CRUD `/classes/` (sections of a ClassGrade); GET `/teachers/`, POST `/teachers/invite/`; POST/GET `/students/`, POST `/students/bulk-enroll/`; POST `/classes/<id>/assign-teacher/`; POST/DELETE enroll/remove student.
- **Own paper upload pipeline** (institution-scoped clone of ingestion): GET/POST `/paper-upload/`, GET `/progress`, GET exercises, PUT exercise edit, POST `exercises/bulk-approve`, POST `/publish`.

### Teacher `/api/teacher` (~15 routes) — role teacher
- GET `/dashboard/`, `/classes/`, `/classes/<id>/` (roster), `/subjects/`, `/topics/`, `/exercises/`
- Study materials CRUD `/materials/` (metadata only — `file_url` supplied by client; no actual upload endpoint)
- Question papers: POST `/question-paper/`, GET list/detail/`/preview/` (markdown render — `app/services/question_paper_service.py`)
- Community: POST/GET `/community/posts/`, detail, `/like/`

### Student `/api/student` (~14 routes) — role student
- GET `/dashboard/`, `/subjects/`, `/topics/`, `/topics/<id>/`, `/topics/<id>/content/`, `/topics/<id>/exercises/`, `/exercises/practice/`
- Spaced repetition: GET `/spaced-rep/due/`, `/stats/`; POST `/cards/`, `/cards/<id>/review/` (SM-2)
- Adaptive: GET `/adaptive/recommendations/`, `/adaptive/subject-progress/`
- Gamification: GET `/gamification/profile/`, POST `/award/` (internal XP event), GET `/leaderboard/`, `/history/`

### AI `/api/ai` (~200 routes across files)
- **Student tool dispatcher**: `student_tools.py` — ~55 POST routes under `/student/<tool-slug>/` mapping onto `StudentAIService` / `generic_tool` / `prompt`-only stubs.
- **Teacher tool dispatcher**: `teacher_tools_extended.py` — ~50 POST routes under `/teacher/<tool-slug>/`.
- **Generic runner**: POST `/tools/run/<slug>/` with 95 inline tool configs (system prompt + token cost per slug) — `app/api/ai/generic_tool.py:19-836,841-882`.
- **Modular tools** (19 blueprints under `/ai/tools/<tool>/…`): quiz-generator, lesson-plan, question-paper, rubric-builder, feedback-writer, concept-explainer, chemistry-solver, essay-helper, revision-planner, socratic-tutor, math-solver, flashcard-generator, worksheet-creator, emotion-coach, mock-test, ppt-generator, document-generator, research-agent, video-generator. Pattern: `routes.py` (marshmallow input schema + `@require_tokens`) + `schema.py` (input/output Schemas) + `prompt.py` + `service.py`. Example: `tools/research_agent/routes.py:8-21`.
- Registry: GET `/tools/`, `/tools/<slug>/`, POST `/tools/seed/` (120 tool seed catalog) — `app/api/ai/tools_registry.py`.
- Doubt solver: POST `/doubt-solver/text/`, `/doubt-solver/image/` (Groq vision, llama-4-scout) — `image_solver.py`.
- PDF chat: POST `/pdf-chat/` — `pdf_chat.py:69`.
- Voice: POST `/voice-tutor/chat/` (token-gated), `/voice-tutor/transcribe/` (Whisper), `/voice-tutor/speak/`; POST `/tts/`, GET `/tts/voices/`.
- Emotion: POST `/emotion-detect/`.
- Adaptive engine: POST `/adaptive/update-mastery/`, GET `/adaptive/next-topic/` — `adaptive_engine.py:15,68`.
- Chapter context reads: GET `/chapter-context/<topic_id>/`, POST `/chapter-context/relevant/`.
- Whiteboard AI: POST `/whiteboard/math-solver/`, `/chemistry-solver/`, `/circle-search/`, `/shape-explainer/`.

### Quiz `/api/quiz` (7) — POST `/practice/generate/` (Groq), `/practice/submit/`, GET `/practice/history/`; live quiz POST `/live/create/` (Redis-backed), GET `/live/<code>/` (answers stripped), POST `/live/<code>/answer/` (server-side scoring), `/live/<code>/end/`.

### Simulation `/api/simulation` (4) — GET `/models/`, `/models/<id>/`, POST `/models/` (Sketchfab import), PUT `/models/<id>/annotations/`.

### Subscription `/api/subscription` (9) — GET `/plans/`, `/plans/<id>/` (public); POST/PUT/DELETE `/plans/…` (admin); GET `/usage/`; POST `/subscribe/`; POST `/tokens/purchase/` (mock payment).

### Parent `/api/parent` (5) — `dashboard/`, `child-profile/`, `child-attendance/`, `child-results/`, `notices/` — mostly stubs returning enrollment-derived data; `before_request` blocks student/teacher roles (`app/api/parent/__init__.py:27-40`).

### SMS v1 `/api/sms/v1` (7) — external SIS integration, **API-key auth** (`X-API-Key` header or `?api_key=`), resolved against `institution_api_keys` table: GET `/students/`, `/students/<id>/`, `/classes/`, `/attendance/`, `/fees/`, `/results/`, `/notices/`, `/ping/` — `app/api/sms/schemas.py:12-36`.

### Health — GET `/health` (`app/__init__.py:23-29`).

---

## 3. Database Models (36 classes / 38 tables)

All models: UUID PKs (`UUIDPrimaryKeyMixin`), naive-UTC `created_at`/`updated_at` mixins (`app/models/base.py`). JSONB/ARRAY Postgres types used freely. **No pgvector anywhere; no multi-tenant tenant column pattern — tenancy is only via nullable `institution_id` FKs.**

| Table (model) | Key columns | Relationships / notes |
|---|---|---|
| `users` (User) | institution_id FK, role str30, full_name(_nepali), email unique, phone, password_hash, google_id, preferred_language default "ne", is_active, is_email_verified, last_login_at | → institution, teacher_assignments, student_enrollments (`models/user.py`) |
| `institutions` (Institution) | name, type, address, district, province, logo_url, subscription_plan_id (unFK'd) | → api_keys, users, classes (`models/institution.py:14`) |
| `institution_api_keys` | api_key unique, scopes ARRAY (default ["sms:read","sms:write"]), is_active, last_used_at | external SIS access (`models/institution.py:40`) |
| `class_grades` (ClassGrade) | level int, label, curriculum_type default "NEB" | global curriculum ladder (`models/class_grade.py`) |
| `subjects` | class_grade_id FK, title(_nepali), code, subject_type | (`models/subject.py`) |
| `subject_topics` (SubjectTopic) | subject_id FK, chapter_number, title(_nepali), learning_objectives ARRAY, bloom_levels ARRAY, estimated_hours, **content_markdown / content_markdown_ne** (published chapter text), content_word_count/image_count, display_order | the published content store (`models/subject_topic.py`) |
| `exercise_blocks` (ExerciseBlock) | institution/subject/topic/class_grade FKs, exercise_markdown, detected_type, detected_marks, has_math, bloom_level, difficulty, source_exercise_label, source_page, source, tags ARRAY, created_by | question bank (`models/exercise_block.py`) |
| `institution_classes` | institution_id, class_grade_id, section, academic_year, room_number | (`models/institution_class.py`) |
| `student_enrollments` | student_id, institution_class_id, roll_number; **unique(student,class)** | (`models/student_enrollment.py`) |
| `teacher_class_assignments` | teacher_id, institution_class_id, subject_id; **unique triple** | (`models/teacher_assignment.py`) |
| `study_materials` | uploaded_by, institution/subject/class_grade, file_url, material_type PDF/DOC/PPT/IMG, is_published | metadata-only (`models/study_material.py`) |
| `question_papers` | institution_id, title, exam_type, total_marks, duration, instructions(_ne), **exercise_block_ids ARRAY(Uuid)** (no join table), paper_url, is_published | (`models/question_paper.py`) |
| `pdf_documents` | uploaded_by, title, file_url, total_pages, is_processed, text_extracted | chat-with-pdf registry (`models/pdf_document.py`) |
| `ai_tools` (AITool) | slug unique, name(_ne), role teacher/student, category, ui_type panel/chat, endpoint, frontend_path, is_premium, sort_order, **token_cost_estimate**, badge | dynamic tool catalog driving token pricing (`models/ai_tool.py`) |
| `ai_sessions` (AISession) | user_id, tool_name, subject/topic, **conversation_history JSON**, tokens_used, started/last_active/ended | persistent chat memory (`models/ai_session.py`) |
| `token_usage_log` (TokenUsageLog) | user_id, institution_id, tool_name, tokens_used, model_used, subject/topic, metadata JSON | per-call audit (`models/token_usage_log.py`) |
| `subscription_plans` | name(_ne), **price_npr**, billing_period, max_students/ai_calls_per_month/3d_models/teachers | (`models/subscription_plan.py`) |
| `user_subscriptions` | user_id, plan_id, status active/trial, **tokens_remaining**, tokens_used_this_cycle, expires_at, is_trial, auto_renew, payment_reference | token wallet lives here (`models/user_subscription.py`) |
| `chapter_ai_context` (ChapterAIContext) | topic_id unique FK, chapter_summary(_ne), **key_definitions/theorems_and_rules/key_formulas/worked_examples/common_mistakes JSONB**, connections ARRAY, exam_tips_ne, generated_by_model, generation_prompt_version, source_job_id, token_cost, **status draft/published**, approved_by/at | the "RAG-lite" knowledge base; human-approved (`models/chapter_ai_context.py`) |
| `content_import_jobs` | job_type, source, original_filename, file_url, detected_class_grade/subject/curriculum/language/book_title/publisher/edition, status (queued→rasterizing→classifying→extracting_toc→extracting_chapter_markdown→extracting_exercises→awaiting_review→published/failed), pages_processed, chapters/exercises detected/approved, error_log JSONB, retry_count | ingestion pipeline state (`models/content_import_job.py:13`) |
| `import_job_pages` | job_id, page_number (unique w/ job), raster_url, page_type, has_math/diagrams/images/exercises, extracted_markdown, extracted_images JSONB, vision_raw_output JSONB, status, processing_ms | per-page stage results (`models/content_import_job.py:81`) |
| `draft_chapters` | job_id, chapter_number, title_ne/en, page_start/end, content_markdown(_ne), extracted_image_urls JSONB, key_concepts, review_status, admin_edits JSONB, published_topic_id, confidence_score | review-before-publish (`models/content_import_job.py:112`) |
| `draft_exercise_blocks` | job_id, draft_chapter_id, exercise_markdown, detected_type/marks, bloom_level, difficulty, review_status, admin_edited_markdown, published_exercise_id, confidence_score | (`models/content_import_job.py:160`) |
| `institution_paper_uploads` + `_exercises` | same draft pattern scoped to institution | (`models/institution_paper_upload.py`) |
| `spaced_rep_cards` | student_id, exercise_block_id, ease_factor 2.5, interval, repetitions, due_at, last_reviewed_at, status new/learning/review/graduated | SM-2 state (`models/spaced_rep_card.py`) |
| `student_gamification` + `xp_events` | xp, level, streak_days, longest_streak, badges JSON, leaderboard_score; xp event log | (`models/student_gamification.py`) |
| `learning_paths` | student_id, subject_id, current_topic_id, **completed_topic_ids ARRAY, weak_topic_ids ARRAY, mastery_scores JSON** | (`models/learning_path.py`) |
| `whiteboard_sessions` / `whiteboard_boards` | session_code unique, board_snapshot_url / title, board_data JSON canvas, thumbnail_url, is_public | (`models/whiteboard_*.py`) |
| `live_class_participants` / `live_polls` | session_id, joined_via, joined/left_at / question, options JSON, responses JSON | live-class persistence (`models/live_*.py`) |
| `simulation_panels` | model_id, panel_type, content JSON, display_order | 3D quiz/info panels |
| `sketchfab_models` | uid unique, title(_ne), subject, topic, class_level, tags ARRAY, thumbnail, model_url (self-hosted GLTF), view_count | (`models/sketchfab_model.py`) |
| `community_posts` | author_id, title, content, subject, post_type, like_count, is_deleted | teacher community (`models/community.py`) |

---

## 4. Services — actual AI implementation

### 4.1 LLM client: `GroqService` — `app/services/groq_service.py`
- Single provider: **Groq** OpenAI-compatible endpoint `https://api.groq.com/openai/v1/chat/completions`, via `requests` (sync), timeout 60s.
- Default model **`llama-3.3-70b-versatile`**, temp 0.7 default; returns `(content_str, total_tokens)`.
- `transcribe()`: Groq Whisper `whisper-large-v3-turbo`, language default `ne` (`groq_service.py:76-104`).
- `vision_chat()`: base64 data-URL image + text; model **`meta-llama/llama-4-scout-17b-16e-instruct`**, temp 0.3 (`groq_service.py:107-165`).
- **CRITICAL BUG:** `chat()` signature is `(messages, *, model, max_tokens, temperature)` — it does **not** accept `system=` or `response_format=`. Yet 8+ call sites pass those kwargs: `app/api/ai/generic_tool.py:866-873`, `app/api/ai/tools/base_service.py:34-40`, `app/api/ai/tools/quiz_generator/service.py:54-60`, `app/tasks/video_tasks.py:57-63`. All JSON-mode tool calls will raise `TypeError` at runtime (this path is evidently untested). Only call sites that pass an in-band system message (e.g. `student_ai_service.py:114`, `pdf_chat.py:107`, `emotion_service.py:44`, `bloom_detection_service.py`) actually work.
- No retries, no backoff, no streaming, no function/tool calling, no moderation, no cost accounting in tokens (only Groq-reported total_tokens).

### 4.2 Prompt construction
- `app/prompts/base.py`: `NEPAL_FIRST_SYSTEM` — persona, bilingual rules (Nepali default), NEB/SEE curriculum alignment, "never give exam answers directly", formatting rules. Worth porting as a template.
- `app/prompts/student/tools.py`: ~55 per-tool instruction strings; `build_student_tool_prompt()` composes system=NEPAL_FIRST + tool instruction + chapter context block + language instruction; `build_voice_tutor_prompt()` (`prompts/student/voice_tutor.py`) keeps last 6 history turns.
- `app/prompts/teacher/tools.py`: equivalent for teacher tools.
- `app/prompts/ingestion/*.py`: PAGE_CLASSIFIER, TOC_EXTRACTOR, CHAPTER_MD_EXTRACTOR (+IMAGE_DESCRIBER), EXERCISE_MD_EXTRACTOR system/user prompts for the vision pipeline.
- Language resolution heuristic: Devanagari regex detection of the user prompt (`student_ai_service.py:15,262-268`).

### 4.3 "RAG" — actually chapter-context injection, no vectors
- `ChapterContextService` (`app/services/chapter_context_service.py`): loads `SubjectTopic` + published `ChapterAIContext`, builds a **text "CHAPTER KNOWLEDGE BASE" block** (summary, JSON-serialized definitions/formulas/examples/mistakes, exam tips, + content excerpt truncated to ~1400 chars, 6000 for voice tutor). No embeddings, no chunking, no hybrid search, no reranking, no vector store. Keyword-overlap ranking for picking relevant items (`student_ai_service.py:270-287`).
- `ContextGeneratorService` (`app/services/context_generator_service.py`): **not LLM-based** — heuristic markdown mining (regex for `$...$` formulas, headings, bold terms) produces the ChapterAIContext payload, `generated_by_model="heuristic-markdown-v1"`, status=draft, awaiting human approval via admin API.
- PDF chat (`app/api/ai/pdf_chat.py`): fetch URL (HTML parser or pdfplumber fallback), truncate to 8000 chars, single grounded call, refuse-if-not-in-document system prompt. Stateless; no chunk store.

### 4.4 Agent/tool orchestration
- No agent loop, no function-calling, no multi-step planner. "Orchestration" = per-tool service classes with one LLM call + deterministic fallback.
- `BaseAIToolService` (`app/api/ai/tools/base_service.py`): shared `model=llama-3.3-70b`, `max_tokens=3000`, temp 0.4, `_chat_json()` (JSON mode + fence stripping) — but broken due to the kwargs bug above.
- Research agent (`tools/research_agent/service.py`): Brave Search → DuckDuckGo fallback → LLM synthesis with numbered sources. This is the only multi-source tool.
- Video generator pipeline is the most "agentic": Groq script (JSON) → per-scene image gen (Together FLUX.1-schnell / Replicate / Unsplash fallback) → OpenAI TTS-1 narration → ffmpeg concat → MinIO upload → Redis progress keys (`app/tasks/video_tasks.py`).
- Generic runner: 95 tools defined as `{cost, system}` dicts; body flattened into "Label: value" lines + language note (`generic_tool.py:885-895`).

### 4.5 Output validation
- Input validation: marshmallow schemas per modular tool (`tools/quiz_generator/schema.py`: count 1-50, difficulty OneOf, bloom OneOf, language OneOf).
- Output: mostly `json.loads` + field defaults; fence-stripping helper `_parse_json_safe` (`vision_ingestion_service.py:295-312`); emotion route falls back to `{"emotion":"neutral"}` on parse failure. **No schema validation of LLM output, no retry-on-invalid.**

### 4.6 Fallback/deterministic mode (signature design choice)
- `StudentAIService.run_text_tool` (`student_ai_service.py:69-152`): if Groq unconfigured or errors → `_build_local_payload()` assembles a bilingual answer from the published ChapterAIContext (definitions, formulas, guiding questions, study plan, follow-up chips), with `provider="local"`, `model="deterministic-context-v1"`. Same pattern in `TeacherAIService` (1237 lines) for lesson plans etc. The whole product works offline-from-LLM with degraded quality — useful for ASchool demos/CI.
- Flashcards are fully deterministic (definitions+formulas→cards, `student_ai_service.py:420-450`).

### 4.7 Token metering / cost accounting — `app/utils/token_gate.py`, `app/services/token_service.py`
- DB-driven pricing: `ai_tools.token_cost_estimate`; `@require_tokens(slug, default_cost=50)` checks `user_subscriptions.tokens_remaining`, returns 402 with `tokens_remaining/tokens_needed` body; view calls `finalize_deduction(response, user_id, cost, slug)` **after success** → `deduct_tokens` decrements wallet + writes `TokenUsageLog` (model_used, subject/topic, metadata) in same commit; race guard rolls back on `InsufficientTokensError` (`token_gate.py:86-120`). Check-then-deduct is not row-locked (SELECT then UPDATE without `with_for_update`), so concurrent spend can race — note for port.

### 4.8 STT / TTS / OCR / vision / image gen
- STT: Groq Whisper (above). TTS: `TTSService` — edge-tts primary (ne-NP-SagarNeural, ne-NP-HemkalaNeural, en-US voices) with gTTS fallback, returns mp3 bytes as `Response` inline (`tts_service.py`, `tts_routes.py`).
- OCR/vision: page images → Groq vision (classifier / TOC / markdown / exercises) — see 4.9.
- Image gen: Together `black-forest-labs/FLUX.1-schnell-Free`, Replicate flux-schnell, Unsplash keyword fallback (`image_generation_service.py:34-76`).

### 4.9 Ingestion pipeline (best-engineered subsystem) — `app/tasks/ingestion_tasks.py` + `app/services/vision_ingestion_service.py`
7 stages, Celery `@shared_task(bind=True, max_retries=3)` with exponential-ish retry `countdown=60*retry_count`, error_log JSONB appended, status machine persisted per transition:
1. **Rasterize**: pypdfium2 @150 DPI → JPEG q85 → per-page S3 upload (`imports/textbooks/{job}/pages/page-NNN.jpg`).
2. **Classify** each page via vision → `{page_type: toc|content|chapter_start|activity|exercise, has_math, has_images, exercise_count, chapter_number, confidence}`; page rows updated; commit every 10 pages.
3. **TOC** extraction → DraftChapter rows + book metadata; fallback stubs from detected chapter numbers.
4. **Chapter markdown** per page; figure placeholders `![FIGURE_N](PLACEHOLDER)` resolved by naive vertical-band cropping + per-figure alt-text vision call, images uploaded to S3.
5. **Exercise blocks** extraction (JSON with bloom/confidence) → DraftExerciseBlock rows.
6. → `awaiting_review` (human-in-the-loop admin UI edits/approves).
7. **Publish** (`admin/import_routes.py:286+`): only approved drafts; create/update SubjectTopics + ExerciseBlocks with source tagging, idempotent via `published_topic_id`/`published_exercise_id` back-references; duplicate check via Jaccard ≥0.72 token similarity (`duplicate_detection_service.py:14`).
- Bloom classification: keyword heuristic first, Groq tie-break, batch mode disables LLM (`bloom_detection_service.py:20-131`).

### 4.10 Other services
- `auth_service.py`: PyJWT HS256 pair (30 min / 30 d), `jti` + `type` claims, Redis blacklist with TTL = remaining validity, role in claims. Werkzeug password hash. Google OAuth route.
- `gamification_service.py`: XP table per event, cumulative LEVEL_XP ladder, badge rules, streak update.
- `spaced_rep_service.py`: full SM-2 (`sm2_update`, `spaced_rep_service.py:24-48`), auto-seeds new cards from exercise bank when none due.
- `adaptive_service.py`: SQL aggregation per topic (avg ease-factor < 2.1 → weak), completion %, ranked recommendations.
- `adaptive_engine.py`: mastery JSON update with weak<0.6 / completed≥0.7 thresholds.
- `sms_gateway_service.py`: Sparrow SMS + Nepali templated helpers (attendance/fee/result/OTP).
- `email_service.py`: branded bilingual HTML template; SendGrid→SMTP fallback; reset/verify emails.
- `s3_service.py` / `minio_service.py`: ensure_bucket, upload/download bytes, public URL, key_from_url.
- `sketchfab_service.py`: oEmbed + model API wrapper.

---

## 5. Background jobs, realtime, storage, notifications

- **Celery tasks** (`app/tasks/`): `process_textbook_pdf` (ingestion, above); `context_tasks.generate_chapter_context` + fan-out `generate_all_missing_contexts` (subquery: topics with content and no approved context → `.delay()` per topic); `video_tasks.generate_video_task` (5 stages, progress in Redis `video_job:<id>` with 86400s TTL). FlaskTask context wrapper is clean. Flower dashboard on :5555.
- **Socket.IO** (`app/sockets/`): threading async mode; rooms:
  - `whiteboard_socket.py`: `wb:<code>` — strokes/elements/cursor; **Redis-persisted room state (12h TTL)** with `board_state_request` full-snapshot sync for late joiners.
  - `live_quiz_socket.py`: `lq:<code>` — **authoritative server-side scoring**: client `is_correct` ignored, answers verified against Redis quiz state, +10 per correct, leaderboard at end (`live_quiz_socket.py:96-116`).
  - `live_class_socket.py`: `lc:<code>` — join/leave/chat/reactions (in-memory dict only).
  - `admin_events.py`: server→admin-room broadcasts (institution events, import progress).
- **Storage**: MinIO S3 bucket `sahayatri`; uploads from ingestion, PPTX generator (`pptx/{user}/{uuid}.pptx`), videos (`videos/{user}/{job}.mp4`).
- **Notifications**: email (SendGrid/SMTP), SMS (Sparrow), Socket.IO admin events. No push notifications, no notification center model.

---

## 6. Tests — `backend/tests` (794 lines, 7 files)

- `conftest.py`: sets FLASK_ENV=testing, **patches `redis.Redis` and `celery.Celery` with MagicMocks globally** (infra-free tests), in-memory SQLite, seeded student/teacher/admin fixtures + real login to get bearer tokens. Good pattern, but means none of the Redis blacklist/quiz-state logic is really tested.
- `test_auth.py` (122): register/login/me/refresh happy paths + wrong password.
- `test_token_gating.py` (134): best tests — unit tests for check/deduct/insufficient + 402 endpoint behavior with mocked subscription.
- `test_quiz.py` (160): practice generate/submit/history with mocked Groq; live quiz create/answer/end HTTP flow.
- `test_ai.py` (65): auth-required and validation assertions with `assert resp.status_code in (200,402)`-style loose ranges; **mocks `GroqService.generate` / routes `app.api.ai.doubt_routes` / `quiz_routes` that no longer exist → stale mocks, those tests pass only via the loose status-range assertions**.
- `test_ingestion.py` (53), `test_markdown_extraction.py` (56): parsing utilities only, not the Celery pipeline.
- `test_whiteboard.py` (61): board CRUD.
- No tests at all for: sockets, ingestion task, video task, context generator, vision service, research agent, institution/paper-upload/publish flow, SMS API keys, subscription purchase.

---

## 7. Quality assessment — real vs stub

**Production-grade, worth copying nearly verbatim:**
1. `token_gate.py` + `token_service.py` — 402-with-metrics pattern, DB-priced tools, post-success deduction + audit log (fix row-locking).
2. `vision_ingestion_service.py` + `ingestion_tasks.py` — the whole 7-stage draft→review→publish pipeline incl. `_parse_json_safe`, figure placeholder resolution, incremental commits, error_log + retry.
3. `spaced_rep_service.py` SM-2 + auto-seeding; `adaptive_service.py` SQL stats.
4. `auth_service.py` JWT pair + Redis JTI blacklist; `auth_helpers.require_role`.
5. `live_quiz_socket.py` server-authoritative scoring + Redis state; `whiteboard_socket.py` snapshot sync.
6. `groq_service.py` as a *template* (not as-is — add retries + fix signature); `vision_chat` shape.
7. `duplicate_detection_service.py` Jaccard dedupe; `bloom_detection_service.py` heuristic-first classification.
8. `celery_app.py` FlaskTask wrapper; `s3_service.py`.
9. Admin draft/approval state machines (ChapterAIContext status, DraftChapter.review_status → publish back-refs).
10. `ProductionConfig` fail-fast secret assertions (`config.py:61-72`).

**Stub / mock / incomplete / broken:**
- **Broken**: JSON-mode tool calls (groq kwargs bug, §4.1) — every modular tool + generic runner + video script stage; `question_paper_service._fetch_blocks` orders by a nonexistent `ExerciseBlock.block_number` column.
- **Stubs**: parent portal (returns enrollment data; attendance/fees/results hardcoded empty), `sms/v1` attendance/fees/results (return empty lists), subscription `tokens/purchase` (no payment gateway), study-material upload (no file handling), institution teacher invite (creates user, no email token flow in some paths).
- **Mock-grade AI**: 95 generic tools are one-shot prompt→JSON with no validation; student/teacher tool fleets largely return deterministic template text when Groq is off and freeform text when on; `context_generator_service` is regex heuristics posing as AI generation; emotion endpoints duplicated (3 implementations: `emotion_service.py`, `emotion_detection.py`, `tools/emotion_coach`).
- **Missing entirely**: vector/embeddings RAG, streaming responses, function calling, moderation/safety layer, prompt-injection defenses on pdf-chat URL fetch (SSRF: server fetches arbitrary `document_url`), per-user rate limits (Limiter installed but no limits), WebRTC/live video, payments, file-upload scanning, pagination standards (some list routes unbounded), audit trail of admin edits, request ID/logging middleware.

---

## 8. Patterns better than typical Flask CRUD — top candidates to adopt

1. **AI metering decorator pair** (`@require_tokens` → business logic → `finalize_deduction`): cost from a DB catalog, 402 semantics, usage log row per call. Maps directly onto ASchool's `token_hub`.
2. **Human-in-the-loop ingestion state machine**: upload → per-page stage records (`import_job_pages`) with status/processing_ms/vision_raw_output → draft tables with `review_status`, `admin_edits`, `confidence_score` → publish with back-reference idempotency (`published_topic_id`). This is the strongest architecture in the repo.
3. **Bilingual context-first prompting**: `NEPAL_FIRST_SYSTEM` + per-tool instruction + structured knowledge-base block + auto language detection (Devanagari regex). Portable to any locale-first tutor.
4. **Deterministic AI fallback**: every AI route degrades to a local, content-grounded template (`provider:"local"`) instead of 503 — keeps product usable and tests infra-free.
5. **Server-authoritative realtime scoring** (live quiz) and **Redis room snapshots with TTL + snapshot-request sync** (whiteboard) — late-joiner state recovery.
6. **JWT refresh rotation with Redis JTI blacklist TTL'd to token expiry.**
7. **Heuristic-first AI classification with LLM tie-break** (Bloom detector) — cost-conscious.
8. **Fence-safe JSON parsing with default payloads** (`_parse_json_safe` + defaults everywhere).
9. **Fail-fast production config assertions**; institution API keys with scope arrays for external SIS.
10. **Jaccard duplicate detection before publishing** AI/imported content.
11. **Progress broadcasting**: long jobs write stage+progress to Redis (`video_job:<id>`) and/or push Socket.IO `admin_import_progress` — cheap job observability.
12. **Tool catalog as data** (`ai_tools` table + `/ai/tools/` discovery API + seed script) driving both frontend menus and backend pricing — one source of truth.

---

## 9. Port plan — Sahayatri capability → ASchool destination

ASchool reference points: plugins in `backend/app/plugins/modules/*` (e.g. `ai_suite`, `ai_tools`, `ai_tutor`, `ai_adaptive_learning`, `ai_grading`, `ai_insights`, `elibrary`, `digital_content`, `lms`, `exams`, `gamification`, `notices`, `sms_notifications`, `whiteboard`-equivalents), AI layer in `backend/app/services/ai/*` (`token_hub.py`, `workbench.py`, `tutor_engine.py`, `rag.py`, `tool_handlers.py`, `tool_schemas.py`, `adaptive_learning.py`, `content_gen.py`, `question_paper_v2.py`, `plagiarism.py`, `sentiment.py`, `wellbeing_ai.py`).

| Sahayatri capability | Port into ASchool as |
|---|---|
| Token gate + deduction + usage log | Extend `services/ai/token_hub.py` with the `require_tokens`/`finalize_deduction` pair + `token_usage_log`-style per-call audit table (add `SELECT … FOR UPDATE` on wallet) |
| AITool catalog (slug, role, category, ui_type, endpoint, cost, badge) | `ai_tools` table feeding `ai_suite`/`ai_tools` plugin menus + `services/ai/workbench.py` tool registry; seed via `tools_registry.py`-style script (use ASchool's `workbench_seed.py`) |
| 7-stage textbook/paper ingestion + draft review + publish | New plugin `digital_content` (or extend `elibrary`/`lms`): port `vision_ingestion_service.py`, `ingestion_tasks.py`, `content_import_job*` models, admin review routes; swap Groq vision for ASchool's provider via `token_hub`; keep `_parse_json_safe`, stage statuses, Jaccard dedupe (`duplicate_detection_service.py`) |
| ChapterAIContext knowledge base | Replace with `services/ai/rag.py` pgvector store; keep the structured section schema (summary/definitions/formulas/mistakes/exam_tips + draft→approved status) as retrieval metadata columns |
| StudentAI/TeacherAI tools (fleet of single-call tools) | Map onto `ai_tools` plugin + `tool_handlers.py`/`tool_schemas.py`; port prompt templates from `app/prompts/*` (rename persona); implement JSON-mode calls correctly against ASchool's LLM client (do NOT copy the broken kwargs usage) |
| Voice tutor (chat + Whisper STT + edge-tts) | `ai_tutor` plugin + new `tts_service`/`stt` adapter in `services/ai/`; keep conversation-history trimming (last 6 turns) and `ai_sessions` persistence |
| Doubt solver image (vision) | `ai_tutor` plugin vision handler; reuse image→base64 data-URL pattern from `groq_service.vision_chat` |
| PDF chat | Extend `services/ai/rag.py` (proper chunking + pgvector) — port only the refuse-if-not-in-document system prompt and 8k truncation guard; **fix the SSRF** by allow-listing `document_url` |
| Live quiz (HTTP + sockets, server-side scoring) | `exams` plugin + ASchool's realtime layer; port Redis state schema + authoritative scoring from `live_quiz_socket.py` |
| Spaced repetition SM-2 + adaptive recommendations | `ai_adaptive_learning` plugin; port `spaced_rep_service.py` and `adaptive_service.py` SQL stats nearly verbatim (tables: `spaced_rep_cards`, `learning_paths`) |
| Gamification (XP, levels, streaks, badges, leaderboard) | `gamification` plugin; port `gamification_service.py` constants + streak logic |
| Emotion detection / wellbeing coach | `wellbeing` plugin + `services/ai/sentiment.py`; consolidate to one implementation with schema-validated output |
| Whiteboard boards/sessions + AI helpers | `design_studio`/whiteboard plugin; port Redis room snapshot protocol |
| Research agent (Brave→DDG→LLM) | `ai_tools` plugin; keep provider-fallback chain, add SSRF/source allow-listing |
| Question paper builder + markdown renderer | `exams` plugin + `services/ai/question_paper_v2.py`; port `question_paper_service.generate_markdown` (fix `block_number` ordering) |
| SMS API-key integration endpoints | `sms_notifications` plugin; port `InstitutionApiKey` model + `resolve_sms_institution` |
| Parent portal | `notices`/`multi_branch` plugins; only the role-blocking `before_request` pattern is worth copying — the endpoints themselves are stubs |
| Subscription plans (NPR pricing, quota columns) | Fold into ASchool's existing tenancy/billing; port `max_ai_calls_per_month`-style quota columns concept |
| Institution paper-upload (tenant-scoped ingestion) | Same ingestion plugin with `institution_id` scoping — note ASchool is fully multi-tenant so all draft tables need the tenant column (Sahayatri's nullable-FK scoping is inconsistent) |

**Do NOT port**: `.env.example` committed secrets, compose-as-env pattern, `GroqService.chat` signature, stale test mocks, in-memory live-class rooms, Unsplash fallback (dead service), the 95-entry generic tool dump as-is (consolidate into ASchool's workbench schemas).
