# D1 — AI TEACHER PLUGIN + AI TOOL CATALOG (implementation digest)

Sources read in full: `ATEACHER_PLUGIN_INTEGRATION.md` (1767 ln → **AT**), `AI_TOOL_CATALOG_AND_SKILLS.md` (1074 ln → **TC**), both in `audits/research/`. Cited `AT §B.3` / `TC §4.4`; file:line refs are the reports' own. Section D = where they no longer match the repo (checked 2026-09-05).

# A. AI TEACHER PLUGIN — LOCKED CONTRACT

**Contents.** A.1 topology · A.2 endpoints · A.3 brokering sequence · A.4 JWT/socket auth · A.5 provisioning · A.6 ownership + callbacks · A.7 guardrails/rate limits · A.8 token_hub · A.9 failure modes · A.10 manifest · A.11 config_schema · A.12 hooks · A.13 widgets · A.14 what-not-to-copy + risks. **B** teaching-content schema (B.4 = verbatim DDL, B.5 workflow, B.6 read API). **C** tool catalog (C.2–C.14 = all 153 rows by group, C.15 top-25, C.16 skills conventions, C.17 document/deck contract + engine upgrades + slices + open questions). **D** staleness vs repo (D-1…D-14).

## A.1 Topology: separate service, NOT an in-process engine (`AT` preamble, `AT §B.1`)
Teaching engine stays its own Flask+SocketIO deployable with **its own DB and its own Redis**. ASchool adds an in-process blueprint only as broker/webhook/content-read (`app/plugins/modules/ai_teacher/routes.py`, mounted at `/api/v1` by `loader.py:246-248`).
Why: (1) service tables must never enter ASchool Postgres — Ashlya leaked 5 `ateacher_*` tables into the host schema (`live_schema_dump_2026_08_05.sql:360-442`) with nothing reading them, "schema bleed, not an integration path" (`AT §A.1`); a shared schema turns a vendor upgrade into a host migration. (2) The service holds lesson state in in-process dicts (`events.py:29-32,174-179`) forcing `gunicorn -w 1` (`render.yaml:8`) — vendoring that imposes single-worker on all of ASchool; as a vendored service it is a documented runbook capacity number instead. (3) Prompts, board grammar, personas, TTS/STT are the service's IP.
Non-negotiables (`AT §B.1`): service gets its own database; S2S endpoints reachable **only** from the ASchool backend network, browsers only for socket+media; player on its own origin (`teacher.<aschool-domain>`) with CSP `frame-src` pinned; service is `-w N` capable or we accept `-w 1` per school-shard and say so in the runbook.
Review rule (`AT §E.2` risk 11): **any PR that adds prompt text or board-grammar parsing to ASchool has crossed the line.**
Hard scope: **no OCR, no vision ingestion, no PDF/scan pipeline anywhere** (`AT` preamble, `AT §C.1`); Ashlya's ML Kit camera path (`ateacher_bridge_screen.dart:239-341`) is deliberately dropped.

## A.2 Endpoints the plugin must expose (`AT §B.3`, `AT §D.4`)
`ai_teacher_bp`, `url_prefix="/ai-teacher"`. User-facing stack: `@jwt_required()` → `@school_required` → `@plugin_required("ai_teacher")` → `@role_required(...)` → `@ai_rate_limit(...)`.
- `GET /personas` — persona passthrough + per-school allow-list, cached 10 min
- `GET /launcher` — grades/subjects/units/sections with **published** content + this student's due-for-review keys
- `POST /lessons` — broker a lesson (A.3). Gates: consent, tier, kill switch, grades, hours, quota, concurrency, `ai_rate_limit(6,86400)`
- `GET /lessons?student_id&status&from&to` — history (student=own, teacher=their classes, admin=school)
- `GET /lessons/<id>` — lesson + chapters + cost + grounding refs · `GET /lessons/<id>/messages` — transcript, retention-aware · `GET /lessons/<id>/summary` — summary + per-outcome mastery
- `POST /lessons/<id>/stop` — end + tell the service · `POST /lessons/<id>/report` — safety report → `ModerationFlag` · `GET /lessons/<id>/export.pdf` — Celery-rendered board/notes PDF into file storage
- `GET /mastery?student_id&subject_code` — rollup by outcome · `GET /usage` — minutes/lessons/tokens/NPR/headroom (school_admin) · `POST /service-key/rotate` (school_admin/superadmin) · `GET /health` — reachability, last successful call, breaker state
- Content authoring (`content_api.py`, same blueprint, `role_required("school_admin","curriculum_admin","superadmin")`): `GET/POST /content/sections`, `GET/PUT/DELETE /content/sections/<id>`; `POST …/sections/<id>/versions`, `PUT …/versions/<vid>`; `POST …/versions/<vid>/{submit,approve,reject,publish,archive,revert}` (each writes a `teaching_content_reviews` row); `GET/PUT/DELETE …/versions/<vid>/{notes,examples,misconceptions,formulas,exam-tips,key-terms,media,outcomes}`; `POST …/sections/<id>/fork`; `GET …/versions/<vid>/preview?language=` (exactly what the AI receives)
- S2S, **key+HMAC, no JWT**: `GET /content/section/<id>` (B.4 read API) · `GET /content/units/<id>/sections` · `POST /webhooks/lesson-event` (+ replay cache). Plus `GET /content/search?grade=&subject=&q=` for the launcher picker (internal JWT version).
Celery `tasks.py`: `reconcile_lessons` 10 min · `purge_transcripts` nightly (honours `transcript_retention_days`) · `rollup_usage` hourly → `AIToolAnalyticsDaily` · `compute_due_reviews` nightly per `mastery_key` · `export_lesson_pdf` on demand.

## A.3 Session-brokering sequence, host → service → client (`AT §B.3`)
`POST /api/v1/ai-teacher/lessons` body: `persona_slug?`, `topic?`, `content_ref? {section_id|chapter_id|outcome_ids[]}` (preferred), `level?`, `language? en|ne|mixed`, `voice?`, `student_id?` (required when a teacher launches for a student), `max_minutes?` (clamped to `lesson_max_minutes`).
201: `lesson_id` (**ASchool UUID — the only id clients use**), `player_url` (`…/embed?lesson=<jwt>`, jwt in the **fragment**), `socket_room` (`lesson:<uuid>`), `expires_at`, `content_snapshot_id`, `persona{slug,name,accent,voice,language}`, `estimated_cost_npr` (shown before start). Errors: 402 tier · 403 consent/kill-switch/role · 409 concurrency · 422 not published · 429 rate/quota · 503 down.
Ordering is load-bearing — **nothing is spent before the gates pass**:
1. **Gates first** — `SchoolAIToolSettings.enabled` → 403; `_require_plan_tier("ai_suite")` → 402; role; `_require_guardian_consent(student_id)` for student subjects (`workbench.py:121-153`, `GuardianAIConsent` `models/ai_workbench.py:217-232`); grade allow-list from config; concurrency per school + per student.
2. **Resolve content, not prose** — read the published section (school override → platform fallback), build a **structured** context document in the requested language with EN fallback, record `content_snapshot_id` = `teaching_section_versions.id`. Free-topic mode (config `allow_free_topic`) ⇒ empty context, `grounded=false`.
3. **Sanitize** — `detect_injection()` (`workbench.py:71-78`), `pseudonymize()` names (`:30-51`), wrap in `<source id="…" trust="curriculum">…</source>` and instruct the service to treat it as data.
4. **Budget** — estimate (chapters × per-chapter tokens), check `config.monthly_cost_ceiling_npr` + `AISchoolQuota` (`models/ai_token.py:8-17`), **reserve**.
5. **Create ASchool's row first** — `ai_teacher_lessons` `status=pending`; our UUID is canonical (structural fix for Ashlya's B-06 session-id divergence).
6. **Then call the service S2S** — `POST {svc}/api/auth/token` with `X-ASchool-Key`, `X-ASchool-Signature = hmac_sha256(secret, ts+body)`, `X-ASchool-Timestamp`, body `{tenant_id, user_ref, display_name}` where `user_ref = hmac(school_secret, user_id)` and **no email**; then `POST {svc}/api/session/create` with `Authorization: Bearer <svc token>` and `{external_lesson_id, topic, level, language, voice, persona_slug, context_document, callback_url, callback_secret_id, max_minutes}`.
7. **Mint OUR player token** (A.4), store the service `session_id`, flip to `ready`, return.
Client leg: iframe/WebView loads `player_base_url`, token in the fragment (or POST-then-httpOnly-cookie on the player origin), socket connects to ASchool `realtime.py` with JWT, emits `join_lesson {lesson_id}`. Ashlya's contrasting end-to-end diagram: `AT §A.11`, terminating in "nothing flows back to the host. Ever."

## A.4 JWT + socket auth with school scoping (`AT §B.5`)
**Player token:** short-lived RS256/HS256 JWT, `aud:"ai-teacher-player"`, `ttl ≤ 15 min`, single-use `jti`, claims `{sub, school_id, lesson_id, service_session_id, role, scope:["lesson:play"], exp}`. Delivered in the URL **fragment** (`#t=…`) or POSTed to the player origin which immediately swaps it for an httpOnly cookie on its own origin. `?token=` is **banned** (access logs, history, `Referer`, Android WebView logs).
**Socket — no token, no connection.** Reuse ASchool's handshake verbatim (`app/realtime.py:40-100`): token from socket.io `auth` payload, `Authorization` header, or httpOnly cookie → `decode_token` → live non-deleted active user → `iat` vs `tokens_invalid_before`. Then `join_lesson`: load `AITeacherLesson` by `(id, school_id=st["school_id"], is_deleted=False)`; absent → "Unknown lesson" (404-equivalent, no leak); `st["role"]=="student"` and `lesson.student_user_id != st["user_id"]` → "Forbidden"; else `join_room(f"lesson:{lesson.id}")` — school-scoped by construction.
**Every later event re-derives the lesson from `_sessions[sid]`, never from the payload** — killing "knowing a session_id is authorization" (`events.py:203-254`), the `get_active_session()` cross-user fallback (`:448-452`) and unauthenticated `restore_session` (`:753-798`). Teachers may join their own class's `lesson:*` read-only; parents never join live (summary only). Server→client event names stay the ones the vendor player already speaks (`lesson_status, lesson_plan, lesson_step, chapter_complete, concept_mastery, lesson_summary, board_snapshot, error`) **plus `seq` on every `lesson_step`** for ack-based backpressure.

## A.5 Provisioning: install → credential (`AT §B.2`)
Paid plugin, `depends_on: [ai_suite, academics]`. Install → `POST /plugins/install` → `_run_plugin_hook(slug,"activate")` (`app/api/v1/plugins.py:435`) → `hooks.activate`: create tables `checkfirst=True`; mint `key_id = "sch_"+school_id.hex[:12]`, `secret = secrets.token_urlsafe(48)`; store `key_id + sha256(secret) + created_at + rotated_at` in `ai_teacher_service_keys` (school-scoped). Plaintext secret goes **once** to the platform secret store (where `GROQ_API_KEY` lives, `backend/config.py:109`) if self-hosted, or to the service's `POST /admin/tenants` — **the one endpoint we ask the service to add** — then is dropped. Never in `SchoolPlugin.config`, never returned by any API.
Deactivate = flip `SchoolPlugin.active` (`plugins.py:780-810`) **plus** call tenant-disable so in-flight lessons stop. Uninstall keeps lesson history, revokes the key. Rotation: `POST /api/v1/ai-teacher/service-key/rotate` issues a new secret with a **24 h dual-accept overlap**, then hard-revokes the old one.
Why per-school and not one platform key: Ashlya's single static key (`config.py:39`, plain string compare `routes/auth.py:47-55`) lets a leak mint a token for **any** `user_id` in any tenant. Per-school keys cap blast radius to one tenant, make rotation a single row, and let the service attribute cost and rate limits per school without trusting the request body. Personas stay **service-side rows** (prompt IP); ASchool reads them via `GET /personas` and caches.

## A.6 Ownership: what ASchool persists vs what the runtime owns (`AT §B.4`)
ASchool owns: lesson existence/who/when/what/duration (`ai_teacher_lessons`) · grounding (`lesson.content_snapshot_id` → §C versions) · chapter outcomes + mastery (`ai_teacher_lesson_chapters`, `ai_teacher_mastery` keyed **student_id + concept_key**, so it survives lessons and feeds report cards) · transcript **mirror** (`ai_teacher_messages`, written by the callback, service is master, retention = `transcript_retention_days`) · cost/tokens/provider (`ai_usage_logs` via token_hub + `lesson.cost_npr`) · xAPI learning events (`ai_teacher_learning_events`) · safety flags (existing `ModerationFlag`, `models/ai_workbench.py:235-249`).
Service owns: persona prompt text (4 columns — ASchool caches display fields only) · board/whiteboard state, slide snapshots, SVG (ASchool stores at most a per-chapter PNG/PDF export in file storage) · streaming/LLM orchestration, TTS/STT (**ASchool never proxies audio bytes**) · the 24 h service token (never leaves the ASchool backend).
Rule of thumb, verbatim: anything a school would put on a report card, an audit, an invoice or a DPDP subject-access request lives in ASchool; anything about how the lesson was rendered lives in the service.
**Results come home** (`AT §B.6`) via `POST /api/v1/ai-teacher/webhooks/lesson-event`: no JWT, `X-ASchool-Key` + HMAC over `timestamp + raw body`, ±300 s window, replay cache on `event_id`, idempotent by `(lesson_id, event_id)`. Payload `{event_id, lesson_id, service_session_id, ts, type, payload}`; types `lesson.started | chapter.completed | question.asked | mastery.updated | lesson.summary | lesson.ended | lesson.error | usage.reported`. Handlers: started → status/started_at · chapter.completed → chapter row + outcome links · question.asked → message mirror + `moderate()` (critical self-harm → `ModerationFlag` + existing wellbeing escalation, `workbench.py:243-260`) · mastery.updated → upsert `ai_teacher_mastery` (feeds adaptive learning + report cards) · summary → text + evidence · ended → duration/chapters · error → honest failure record · usage.reported → `AIUsageLog` + `reconcile_quota_reservation` (`token_hub.py:413-426`).
**Belt and braces:** Celery `ai_teacher.reconcile_lessons` every 10 min polls `GET {svc}/api/session/<id>` for lessons stuck in `teaching`/`ready` past `max_minutes + 5` and closes them `abandoned`. Webhooks are best-effort; **the poller is the source of eventual truth.** Ashlya has neither (`AT §A.9`: results never flow back at all).

## A.7 Guardrails (`AT §B.7`) + rate limits (`AT §B.9`)
| Guardrail | Mechanism (existing ASchool code) |
|---|---|
| Plugin gating | `@plugin_required("ai_teacher")` + `depends_on: [ai_suite]`; web `<PluginGate slug="ai_teacher">` (`frontend/lib/plugins.tsx:253-352`); Flutter `PluginGate` from `aschool_shared` |
| Tier | `_require_plan_tier("ai_suite")` → 402 (`workbench.py:288-297`) |
| Kill switch | `SchoolAIToolSettings(tool_key="ai_teacher_lesson").enabled=false` → 403 in one request (`models/ai_workbench.py:115-127`) + a platform-wide env kill switch for incident response |
| Consent (minors) | `GuardianAIConsent(scope="tutor")` before any student-subject lesson; revocation blocks new lessons and stops live ones on the next event |
| Moderation | `moderate()` on every student question **and on teacher speech before it reaches the student**; `critical` → `ModerationFlag` + wellbeing path; `standard\|strict` from config decides whether medium severity pauses the lesson |
| Injection | `detect_injection()` on topic/question; content documents delimited and labelled `trust="curriculum"` (admin content trusted-but-delimited, free text untrusted); also run on **submitted content at publish time**, not just student input (`AT §E.2` risk 8) |
| PII | pseudonymized names in prompts; `user_ref` is an HMAC, not the user UUID; **no email crosses the boundary** (Ashlya sends real name + email, `route.ts:64-68`) |
| Transparency | `AINutritionFacts` row on the AI Nutrition Facts page; per-lesson model/provider/cost visible to admins |
| Retention | `transcript_retention_days` + nightly purge + DPDP subject-access export from ASchool's own tables |
| Cost ledger | pre-flight reservation + `AIUsageLog` per reported call + `AIToolAnalyticsDaily` rollups (A.8) |
Limits: lesson creates **6/day + 2/hour per student** (`ai_rate_limit` keyed school+user, `rate_limiter.py:102-112`) · **200/day per school** · concurrent lessons per school `min(config.max_concurrent, plan cap)`, per student 1 → 409 (DB count at create) · **40 questions/lesson** (config, also enforced service-side via `max_minutes`/`max_questions` in the create payload and re-checked on `question.asked`) · webhook ingest **600/min per school key** (`device_rate_limit` pattern, `rate_limiter.py:115-124`) · content read API **300/min per key** · `monthly_minutes_per_student` summed from `ai_teacher_lessons` at create.

## A.8 token_hub cost accounting (`AT §B.8`)
Two-sided, because the service burns the tokens and ASchool cannot log them at call time:
1. **Pre-flight reservation at create** — `estimate_cost_usd` (`token_hub.py:74-90`) over planned chapters × the measured per-chapter envelope (≈8–15k prompt / 3–6k completion per chapter, measured in `ATEACHER_INTEGRATION_BLUEPRINT.md §10.1`), then `_check_quota(school_id, est_cost_usd=…)` and `_reserve_cost` (`token_hub.py:343-411`). A school at its ceiling gets a clean 429 **before** the service is called.
2. **Post-hoc reconciliation from `usage.reported`** — one `AIUsageLog` row per reported call with `feature="ai_teacher:lesson"` and real `prompt_tokens/completion_tokens/model/provider/cost_usd`, then `reconcile_quota_reservation(school_id, est, actual)` (`token_hub.py:413-426`). Rollups land in `AIToolAnalyticsDaily` (`models/ai_workbench.py:252-268`) so the existing `analytics/ai-usage` page shows AI Teacher next to every other tool with **no new dashboard**.
If the service refuses to report usage: bill the estimate and flag the lesson `cost_source="estimated"`, visible in the admin UI. "We never pretend a number is measured."

## A.9 Failure / degradation modes (`AT §B.10`)
Kept from Ashlya (its honesty baseline is decent here): missing key → 503, connection error → 503, timeout → 504, upstream non-200 → 502 with the service's message (`route.ts:23-29`, `ateacher_routes.py:60-131`). Added:
| Failure | Behaviour |
|---|---|
| Key not provisioned / misconfigured | 503 `error_code="ai_teacher_not_configured"` + admin banner in settings |
| Service unreachable / 5xx / timeout | 503 or 504; lesson row `status=failed`; **no reservation consumed**; retry-after hint |
| Service healthy but LLM provider down | service reports `lesson.error`; ASchool offers the **honest fallback** — the same chapter as a readable text lesson from §C content, labelled "Text lesson — AI teacher unavailable" |
| Quota / ceiling exhausted | 429 with exact used/limit (`QuotaExceededError`, `token_hub.py:151-161`) |
| Consent missing/revoked | 403 + deep link to the guardian consent screen · Kill switch on → 403 |
| Socket drops mid-lesson | reconnect → re-`join_lesson` → service replays board snapshot; if the service lost in-process state the lesson closes `interrupted` with partial mastery kept |
| Webhook never arrives | reconciler closes the lesson, `cost_source="estimated"`, mastery from last known event; history shows "ended (unconfirmed)" |
| Content not published | 422 at create — never teach a draft |
**Anti-requirement: no silent degradation to a generic chatbot.** If the whiteboard teaching path is unavailable we say so and hand back content rather than substituting a different product.

## A.10 Package + `manifest.yaml` fields (`AT §D`, `AT §D.1`)
`backend/app/plugins/modules/ai_teacher/`: `__init__.py` · `manifest.yaml` · `config_schema.yaml` · `hooks.py` · `routes.py` · `service_client.py` (key+HMAC, timeouts, circuit breaker) · `content_api.py` · `webhooks.py` · `tasks.py`. Models at `app/models/ai_teacher.py` + `app/models/teaching_content.py`; manifest pointers are boot-validated (`loader.py:104-134`, broken pointers log ERROR).

| field | value |
|---|---|
| `slug` | `ai_teacher` |
| `name` / `name_nepali` | "AI Teacher (Live Whiteboard Tutor)" / "एआई शिक्षक (लाइभ ह्वाइटबोर्ड ट्युटर)" |
| `category` | `premium` |
| `price_monthly` / `price_yearly` | **1499 / 14990** NPR |
| `is_free` / `trial_days` | `false` / `14` |
| `emoji` / `icon` / `version` / `author` | `👩‍🏫` / `PenTool` / `1.0.0` / `ASchool` |
| `published` / `coming_soon` | `true` / `false` |
| `description` | long-form: speaks and hand-writes on an animated whiteboard chapter by chapter, grounded in published curriculum content, interruptible by voice or text, mastery per outcome flows into progress reports, runs on a dedicated service |
| `api_blueprint` | `app.plugins.modules.ai_teacher.routes` |
| `models_module` | `app.models.ai_teacher` |
| `models` | `app.models.ai_teacher`, `app.models.teaching_content` |
| `services` | `…ai_teacher.service_client`, `…ai_teacher.content_api` |
| `tasks` | `app.plugins.modules.ai_teacher.tasks` |
| `depends_on` | `ai_suite` (AI tier the workbench checks) + `academics` (curriculum_units) — **hard deps, not soft hints** |
| `conflicts_with` | `[]` |
| `frontend.route` | `/dashboard/ai-teacher` |
| `frontend.sidebar` | section "Learning", label "AI Teacher"/"एआई शिक्षक", icon `PenTool`; subitems Start a Lesson · Lesson History · Mastery · Teaching Content · Usage & Cost · Settings (`/dashboard/settings/ai-teacher`); `visible_to: [school_admin, teacher, student]` |
| `flutter.admin_app` | folder `ai_teacher`, tabs Usage / Content / Safety |
| `flutter.teacher_app` | tabs Assign Lesson / Live / Mastery |
| `flutter.student_app` | tabs Learn / My Lessons / Due for Review |
| `flutter.parent_app` | tabs Child's Lessons / Consent |
| `events.emits` | `ai_teacher.lesson_started`, `.lesson_completed`, `.mastery_updated`, `.moderation_flagged`, `.cost_ceiling_reached`, `.service_unavailable` |
| `events.listens` | `curriculum.content_published` (invalidate content snapshots/ETags), `student.consent_revoked` (stop live lessons for that student), `plugin.deactivated` (kill in-flight lessons) |

## A.11 `config_schema.yaml` — every field, type, default, consumer (`AT §D.2`)
Values land in `SchoolPlugin.config` (JSONB), read via `GET /plugins/ai_teacher/config` (`plugins.py:812-826`), written via `PUT` with merge-or-replace semantics — `sp.config` reassigned + `flag_modified`, never mutated in place (`plugins.py:829-883`). Report's rule: "a setting with no consumer is a lie."

| key | type | default | consumer |
|---|---|---|---|
| `service_base_url` | string, admin_only | `""` | `service_client.py` |
| `player_base_url` | string, admin_only | `""` | player embed; must be allowed by CSP `frame-src` |
| `service_key_id` | string, readonly | `""` | display only; secret never shown, replaced via Rotate Key |
| `default_persona_slug` | select `aria,max,sophia,leo,nova` | `aria` | create-lesson payload |
| `allow_student_persona_choice` | boolean | `true` | launcher |
| `default_language` | select `en,ne,mixed` | `ne` | create payload (`mixed` = Nepali speech, English subject terms via the content glossary) |
| `default_voice` | select `ne-NP-HemkalaNeural, ne-NP-SagarNeural, en-US-AriaNeural, en-US-GuyNeural, hi-IN-SwaraNeural` | `ne-NP-HemkalaNeural` | create payload |
| `require_nepali_content` | boolean | `false` | §C.6 publish gate |
| `lesson_max_minutes` | integer 5–90 | `25` | create clamp |
| `lesson_target_chapters` | integer 1–8 | `4` | plan bound / **main cost driver** |
| `max_questions_per_lesson` | integer | `40` | orchestrator + service payload |
| `attention_reset_minutes` | integer, 0 disables | `10` | lesson shape (break cue) |
| `allow_free_topic` | boolean | `false` | create gate (off = must be grounded, recommended) |
| `allowed_grades` | multiselect 1–12 | `["6","7","8","9","10"]` | create gate |
| `allowed_subjects` | multiselect, options populated from the school's subjects at render | `[]` = all with published content | create gate |
| `allowed_roles` | multiselect `student,teacher,school_admin` | `["student","teacher"]` | create gate |
| `student_hours_window` | string | `"06:00-21:00"` | create gate; teachers/admins exempt |
| `require_guardian_consent` | boolean | `true` | guardrail; **cannot be turned off for under-13 — platform enforces regardless** |
| `moderation_strictness` | select `standard,strict` | `standard` | guardrail (strict = medium pauses + notifies a teacher) |
| `kill_switch` | boolean | `false` | guardrail (blocks new lessons, ends live ones) |
| `transcript_retention_days` | integer 7–1095 | `180` | `tasks.purge_transcripts` |
| `teacher_can_watch_live` | boolean | `true` | socket read-only mirror gate |
| `monthly_cost_ceiling_npr` | integer, 0 = platform quota only | `3000` | reservation check → 429 |
| `monthly_minutes_per_student` | integer | `240` | create gate |
| `max_concurrent_lessons` | integer | `25` | concurrency check → 409 |
| `cost_alert_percent` | integer | `80` | `ai_teacher.cost_ceiling_reached` event |

Consumer mapping restated by the report (`AT §D.2` closing note): `service_*`/`player_base_url` → `service_client.py`; persona/language/voice/lesson-shape → the create-lesson payload in `routes.py`; `allowed_*`/`student_hours_window` → the create gate; `require_guardian_consent`/`moderation_strictness`/`kill_switch` → the guardrail block (`AT §B.7`); `transcript_retention_days` → `tasks.purge_transcripts`; cost keys → the reservation check (`AT §B.8`) and the `ai_teacher.cost_ceiling_reached` event.

## A.12 `hooks.py` responsibilities (`AT §D.3`)
Contract note carried in the module docstring: hooks are **never fatal** — `plugins.py::_run_plugin_hook` logs and swallows failures (`app/api/v1/plugins.py:83-101`), so every step must be **idempotent and independently retryable** from the settings screen. `TOOL_KEY = "ai_teacher_lesson"`.

`_owned_models()` returns 18 models — 6 AI-teacher (`AITeacherServiceKey, AITeacherLesson, AITeacherLessonChapter, AITeacherMessage, AITeacherMastery, AITeacherLearningEvent`) and 12 teaching-content (`TeachingSection, TeachingSectionVersion, TeachingSectionOutcome, TeachingNote, TeachingExample, TeachingMisconception, TeachingFormula, TeachingExamTip, TeachingKeyTerm, TeachingMedia, TeachingContentSnapshot, TeachingContentReview`).

`activate(db)` — four steps, in order:
1. **Tables (idempotent)** — `for model in _owned_models(): model.__table__.create(db.engine, checkfirst=True)`, the same pattern as `ai_adaptive_learning/hooks.py:23-30`.
2. **Per-school service credential** — only if no live key exists for the school: `secret = secrets.token_urlsafe(48)`, `key = AITeacherServiceKey.issue(school_id=school_id, secret=secret)` (**stores sha256 only**), commit, then `provision_tenant(school_id, key.key_id, secret)` inside `try/except Exception → logger.warning("tenant provisioning deferred … admin can retry from Settings")`, with `finally: secret = None`. The plaintext is **not persisted anywhere in ASchool**.
3. **Workbench tool registration** so the kill switch / tier / consent gates apply — `AIToolRegistry(tool_key="ai_teacher_lesson", name="AI Teacher lesson", name_ne="एआई शिक्षक पाठ", category="tutor", min_plan_tier="ai_suite", roles_allowed=["student","teacher","school_admin"], status="beta")` plus `AINutritionFacts(tool_key="ai_teacher_lesson", model_name="external-service", provider="ai_teacher_service", data_accessed=["published curriculum content","lesson transcript","mastery per learning outcome"], data_not_accessed=["marks","attendance","fees","health records","student photos","documents"], retention_days=180, no_training_guarantee=True, human_review_required=False, limitations="Teaches only from published curriculum content; may make mistakes; not a substitute for a teacher. Voice and whiteboard rendering are produced by an external service.", supported_language="en+ne")`. `status="ga"` requires the facts row — the CI gate.
4. **Default config for unset keys only** — `sp.config = {**defaults, **(sp.config or {})}` + `flag_modified(sp, "config")`, where defaults are `default_language="ne"`, `lesson_max_minutes=25`, `lesson_target_chapters=4`, `allow_free_topic=False`, `require_guardian_consent=True`, `moderation_strictness="standard"`, `monthly_cost_ceiling_npr=3000`, `transcript_retention_days=180`.

`deactivate(db)` — "stop teaching, keep everything. Live lessons must not survive a deactivate." Query lessons with `status in ("ready","teaching","paused")` and `is_deleted is False` for the school; for each call `stop_lesson(lesson)` (warn-and-continue on failure), set `status="ended"` and `end_reason="plugin_deactivated"`; commit; then `disable_tenant(school_id)` in try/except.

`uninstall(db)` — revoke the credential and drop only module-owned config. Set `revoked_at = now(utc)` on every `AITeacherServiceKey` with `revoked_at=None`; reduce `SchoolPlugin.config` to platform-reserved keys only (`{k: v for k, v in sp.config.items() if k == "last_payment"}`) + `flag_modified`. **Lessons, mastery and teaching content are DATA and are kept** (WordPress semantics, and lesson history is a school record a parent can request).

## A.13 Plugin-owned widget list (`AT §D.5`)
Web — `frontend/app/dashboard/ai-teacher/`, every page wrapped in `<PluginGate slug="ai_teacher">` (`frontend/lib/plugins.tsx:253-352`):
| Widget | What it does |
|---|---|
| `LessonLauncher` | grade → subject → unit → **section** picker fed by `/launcher` (published content only), persona gallery, language/voice, estimated minutes + **estimated NPR cost before you start**, "not available in Nepali yet" honesty badge |
| `AITeacherPlayer` | the iframe host: creates the lesson, mounts the player at `player_base_url` with the token in the fragment, `allow="microphone; autoplay; fullscreen"`, `sandbox="allow-scripts allow-same-origin"`, fullscreen + close controls, connection-state banner |
| `LessonProgressRail` | chapter list with live status from `lesson_step`/`chapter_complete`, jump-to-chapter |
| `AskBar` | text + mic question composer (mic uses the service's STT **through the player, never ASchool**) |
| `MasteryHeatmap` | outcome × mastery grid from `/mastery`; reused on the student profile and the report-card evidence panel |
| `LessonHistoryTable` | date, chapter, minutes, questions, mastery delta, cost, transcript link, PDF export |
| `TeachingContentEditor` | the §C authoring surface: version rail (draft/in_review/published/archived), block editors for notes/examples/misconceptions/formulas/exam-tips/key-terms/media, **side-by-side EN \| NE panes**, publish-gate checklist, diff-vs-published, fork/re-adopt platform content |
| `ContentPreviewDrawer` | renders `versions/<vid>/preview` — exactly what the AI receives |
| `AITeacherUsageCard` | minutes/cost/ceiling with the 80 % alert state; drops into the existing `analytics/ai-usage` page |
| `AITeacherSettingsForm` | the `config_schema.yaml` screen + Rotate Key + service health |
| `ServiceDownNotice` | the honest degradation panel (`AT §B.10`) with the "read the chapter instead" fallback |
| `ConsentBanner` | guardian-consent prompt / deep link when consent is missing |

Flutter — feature folder `ai_teacher` in each app, shared bits in `aschool_shared`:
| App | Widgets |
|---|---|
| student | `AiTeacherHomeTab` (launcher + due-for-review chips), `LessonWebViewPlayer` (WebView with the two platform hacks Ashlya proved necessary — `setMediaPlaybackRequiresUserGesture(false)` and landscape/immersive lock, `ateacher_bridge_screen.dart:487-501`), `MyLessonsList`, `MasteryStrip`, `AskSheet` |
| teacher | `AssignLessonSheet` (pick section + students → creates lessons for a class), `LiveLessonsMonitor` (read-only mirror, gated by `teacher_can_watch_live`), `ClassMasteryGrid` |
| parent | `ChildLessonsList` (summaries only, **never live**), `AiConsentTile` (grant/revoke `GuardianAIConsent`) |
| admin | `AiTeacherUsageTab`, `ContentCoverageTab` (which grades/subjects have published + Nepali content), `SafetyFlagsTab` (moderation flags + kill switch) |
| shared | existing `PluginGate` (`aschool_shared/lib/widgets/plugin_gate.dart`), `ServiceUnavailableCard`, reuse of `NoDataContainer`/`ErrorContainer` — **no new empty/error states** |

## A.14 "What NOT to copy" from ATeacher, with the evidence (`AT §E.1`)
| Do not copy | Evidence (Ashlya paths) | Why it must not cross the boundary |
|---|---|---|
| One static platform API key with an insecure default and a plain string compare | `backend/config.py:39` (`"ateacher-server-key-change-me"`); `routes/auth.py:47-55` | Leak = mint a token for *any* user of *any* tenant. Replace with per-school key id + secret hash + HMAC-signed requests + rotation (`AT §B.2`) |
| Opaque UUID "tokens" with no claims | `services/db_service.py:91`; validation `db_service.py:116-128` | No tenant, no role, no audience, no signature; cannot be verified without a DB round trip. Use ASchool JWTs, ≤15 min, single-use `jti` (`AT §B.5`) |
| Token in the query string | `routes/auth.py:70-71`; `LiveTeacherModal.tsx:38`; `ateacher_bridge_service.dart:139-148`; `main.dart:60` | Lands in access logs, browser history, `Referer`, Android WebView logs. Fragment or POST-then-cookie only |
| Unauthenticated sockets | `websocket/events.py:188-191`; `api_client.dart:56-80`; `cors_allowed_origins="*"` at `app.py:71` | Knowing a session id *is* the authorization. ASchool authenticates at handshake and re-derives the lesson from the socket session on every event |
| `get_active_session()` fallback | `websocket/events.py:448-452` | A question with an unknown session id gets answered into *someone else's* lesson. Never ship a "whatever session is active" path |
| Unauthenticated `restore_session` | `websocket/events.py:753-798` | Replays any lesson's board to any connection |
| Unauthenticated content/media routes | `routes/lesson.py:7-42` (session create with attacker-supplied context), `routes/tts.py:43-90` (arbitrary text→speech, no auth, 1 h public cache), `routes/stt.py:18`, `routes/auth.py:328-339` (`GET /api/teachers/` public by design) | Free TTS/STT for the internet billed to us; a session-creation hole that bypasses every gate. Everything S2S or JWT-gated |
| In-process lesson state | `_session_plans`/`_session_blueprints` `events.py:29-32`; `_sid_to_session`/`_active_streams` `events.py:174-179`; board state in `whiteboard_service` | Forces `-w 1` (`render.yaml:8`) and loses lessons on restart. If we ever own the code path: Redis with TTLs. As a vendored service it is a runbook capacity constraint we must state, not hide |
| `create_all()` schema management | `app.py:56-58`; MySQL `LONGTEXT` variants `models/database.py:292,357` | ASchool is Postgres + Alembic. Also the reason `ateacher_*` tables leaked into the host schema |
| Service tables inside the host database | `skilldarbar_api/migrations/live_schema_dump_2026_08_05.sql:360-442` | Separate service ⇒ separate database. A shared schema turns a vendor upgrade into a host migration |
| Committed provider keys | `backend/render.yaml:9-10` (live `GROQ_API_KEY`), `backend/.env` present in-tree | Rotate on adoption; never copy the file. Secrets come from the platform secret store |
| OCR / camera ingestion as a content path | `lib/screens/ateacher_bridge_screen.dart:239-341` (ML Kit), plus the in-lesson `setOnShowFileSelector` image path `:491,523-601` | Out of scope by decision (`AT §C.1`). OCR errors become taught facts, and it bypasses the review workflow entirely |
| Prose context assembled at click time | `NotesToolbar.tsx:70-80`; `QuizDetailAssistant.tsx:335-357`; merged + truncated at `routes/auth.py:96-162` (150 000-char cap, `MAX_CONTEXT_STORE_CHARS` `:42`) | No provenance, no versioning, no outcome links, no Nepali parity; truncation silently drops content. Replaced by §C's structured document + `content_snapshot_id` |
| Sending real name + email to the service | `route.ts:64-68`; `ateacher_routes.py:84` | Minimize: pseudonymous `user_ref` + display first name only |
| Mastery keyed by LLM-invented chapter titles | `events.py:849-878`; "a question means the student is confused" heuristic `events.py:530-559` | Unusable across lessons and pedagogically wrong. Key mastery on curriculum outcomes (`mastery_key`, §C.4) and treat questions as engagement, not failure |
| The 2500 ms postMessage race | `frontend/lib/features/lesson/lesson_screen.dart:78-100` | Starts teaching with empty context if the message is late. Our context lives in the pre-created session, so the client needs no handshake |
| `sandbox="… allow-same-origin"` **plus** a trusted parent origin | `LiveTeacherModal.tsx:194` | `allow-scripts` + `allow-same-origin` on a same-site frame effectively removes the sandbox. Serve the player from a distinct origin, pin `frame-src`, drop `allow-popups`/`allow-modals` |

Also flagged, "still true from the earlier blueprint": do not port `session_service.py`'s session-id logic; the triple-duplicated token loop without `try/finally` (`events.py:889-1008,1011-1163,1240-1465`); `_log_chapter_mastery`'s truncated stub (`events.py:880-887` — builds `kg_mastery` then does nothing with it); the dead `image_gen_service.py` / `board_state_compressor.py`; and `ai_teacher/chemistgpt.txt` + `physicsgpt.txt`, which are third-party MathGPT prompts — **do not ship them**.

### A.14.1 Our own risks and the accepted positions (`AT §E.2`, all 12)
1. **The content is the product now.** An empty `teaching_*` schema means the plugin is a beautiful shell; authoring Science + Math 8-10 to a publishable standard is weeks of curriculum work, not engineering. → Ship the platform seed for CDC Science/Math 8-10 first; the launcher only offers sections with published content; `allow_free_topic=false` by default; budget authoring explicitly and track **content coverage %** as a release gate.
2. **Vendor coupling** to a single-worker Flask service with in-process state. → Version the contract (`/api/v1` on the service side too), keep `service_base_url` per school so a school can be pinned to a shard, health endpoint + circuit breaker in `service_client.py`, honest text-lesson fallback. Capacity is a documented runbook number.
3. **Webhooks are best-effort**; a lost callback means a lesson with no mastery and no cost. → Idempotent ingest + the 10-minute reconciler + `cost_source="estimated"` marking. Never show an estimate as measured.
4. **Cost blowout** — a 5-chapter lesson is ~$0.05–0.15; 40 students daily is real money. → Pre-flight reservation against `AISchoolQuota` **and** the per-school NPR ceiling, per-student monthly minutes, concurrency cap, 80 % alert, cost shown before start.
5. **Nepali quality** — Edge-TTS Nepali voices and Nepali LaTeX reading are uneven; `spoken_ne` on formulas is hand-authored for a reason. → `require_nepali_content` publish gate, `keep_in_english` glossary for mixed mode, honest "Nepali not available yet" UI rather than machine translation at teach time.
6. **Consent + minors** — a live voice tutor for a 10-year-old is a DPDP-grade exposure. → `GuardianAIConsent(scope="tutor")` enforced at create (cannot be disabled for under-13), revocation stops live lessons, transcripts purged per config, parent can read every transcript.
7. **Moderation asymmetry** — ASchool's `moderate()` is regex-tier and English-first; the service generates the speech. → Moderate on both sides of the callback, escalate `critical` through the existing wellbeing path, `strict` pauses on medium, plus a student/teacher "report this lesson" button. **Nepali pattern coverage is a known gap — record it, don't paper over it.**
8. **Prompt injection through *content*** — an authored misconception field could contain "ignore your instructions". → Content is `trust="curriculum"` but still delimited in `<source>`; authoring roles are privileged; every change attributed in `teaching_content_reviews`; `detect_injection()` runs at publish time, not just on student input.
9. **Two mastery systems** — `ai_teacher_mastery` vs `MasteryRecord` in `ai_adaptive_learning` (`app/models/adaptive_learning.py`). → Keep AI Teacher's per-outcome rows as fine-grained evidence and **feed** the adaptive-learning rollup, one direction only, documented in the model docstring.
10. **Iframe/WebView fragility** — mic permission, autoplay policy, fullscreen, Android file chooser, landscape lock; Ashlya needed four platform hacks (`ateacher_bridge_screen.dart:413-501`). → Treat the embed as a supported surface with its own device matrix test (Android WebView, iOS WKWebView, Chrome, Safari); permissions-policy and CSP `frame-src` pinned per environment.
11. **Scope creep back into "let's just rebuild it inside ASchool."** → This document is the boundary: ASchool owns brokering, records, content, guardrails; the service owns teaching, board, voice.
12. **Content authoring UX debt** — the editor is the biggest new frontend surface (bilingual panes, version diffs, publish gates). → Build on existing widget primitives, ship notes+examples first, accept misconceptions/formulas/exam-tips in a second pass; **the read API tolerates empty arrays**.

`AT §E.3` one-paragraph verdict, condensed: Ashlya's shape (two-call broker + URL-param iframe) is worth keeping; everything about *trust* in it is wrong for multi-tenant SaaS. ASchool keeps the shape and replaces the trust model — per-school HMAC credentials, short-lived scoped JWTs, handshake-authenticated sockets with lesson-ownership checks, HMAC-signed callbacks so mastery and cost come home, existing consent/moderation/quota on the front door. "The substantive product upgrade is not the plumbing though — it is refusing the OCR shortcut and building a real, versioned, bilingual, per-school-overridable teaching-content schema underneath the curriculum tables ASchool already has."

---

# B. TEACHING-CONTENT SCHEMA (admin-entered, NO OCR)

## B.1 The decision (`AT §C.1`)
Ashlya feeds the AI teacher **prose scraped together at click time** — a notes preview (`NotesToolbar.tsx:70-80`), a quiz digest (`QuizDetailAssistant.tsx:335-357`), or OCR text from a phone camera (`ateacher_bridge_screen.dart:239-341`) — markdown-stripped and truncated to 150 000 chars (`routes/auth.py:96-136`). The service has no notion of unit, outcome or grade; no provenance, no review, no reuse, no Nepali parity, and **OCR errors become taught facts**.
ASchool takes the opposite bet: teaching content is **first-class, normalized, multi-tenant, versioned and bilingual data, entered by platform curriculum admins and school admins through ordinary CRUD screens.** No OCR, no vision model, no PDF-scan ingestion, no "attach a photo of your book" path anywhere. Media can be *attached* as a file reference for the player to display, but is **never parsed for meaning**. The AI teacher pulls a structured document over a read API (§B.5) and teaches from it; if a chapter is not authored and published, the lesson is **refused (422)** rather than hallucinated.

## B.2 Composition with what already exists — reused, not rebuilt (`AT §C.2`)
| Existing | File | Role in this design |
|---|---|---|
| `curriculum_frameworks` (board, grade, subject_code, subject_name, `school_id` NULL = platform) | `backend/app/models/curriculum.py:16-44` | **is** the framework → subject → grade level. No new table |
| `curriculum_units` (unit_no, title_en, title_ne, periods, weight_pct) | `curriculum.py:47-71` | **is** the chapter/unit level. No new table |
| `learning_outcomes` (code, statement_en, statement_ne, bloom) | `curriculum.py:74-94` | **is** the outcome level. New content links *to* these rows; outcome text is never copied |
| `subject_offerings` (theory/practical full+pass marks) | `curriculum.py:97-130` | exam-weighting context for "exam tips"; untouched |
| CDC/NEB seed (grades 1-10 core + 11-12 streams) | `backend/app/services/ai/curriculum_seed.py:9-120` | the frameworks/units our sections hang off already exist and are idempotent |
| `AIGeneration` provenance ledger | `models/ai_workbench.py:20-47` | any AI-*assisted* draft of a note records its `ai_generation_id` — "human or LLM?" is answerable |
| `ai_generations.citations` JSONB | `models/ai_workbench.py:45` | lesson generations cite `teaching_section_versions.id`, closing the grounding loop |
| `courses/lessons/topics/study_materials` (LMS) | `models/lms.py:20-110` | **stays school course delivery.** Per-school, not curriculum-anchored, not versioned, not bilingual-paired. A nullable `teaching_sections.lms_topic_id` FK links the two when a school wants alignment — one column, no fork |

The gap being filled is everything **below `curriculum_units`**: nowhere today to store a section's teaching notes, worked examples, misconceptions, formulas or exam tips; no draft→published workflow; no version identity to cite; no school-override chain.

## B.3 Entity map and the two structural choices (`AT §C.3`)
```
curriculum_frameworks (board, grade, subject_code)        [EXISTS]
   └─ curriculum_units (unit_no)  = CHAPTER               [EXISTS]
        ├─ learning_outcomes (code, bloom)                [EXISTS]
        └─ teaching_sections (section_no, code, kind)     [NEW] ← stable identity
             └─ teaching_section_versions (v, status)     [NEW] ← the publish + citation unit
                  ├─ teaching_section_outcomes   → learning_outcomes   [NEW link]
                  ├─ teaching_notes              (bilingual blocks)    [NEW]
                  ├─ teaching_examples           (worked, stepped)     [NEW]
                  ├─ teaching_misconceptions     (wrong→right)         [NEW]
                  ├─ teaching_formulas           (latex + plain)       [NEW]
                  ├─ teaching_exam_tips          (NEB/SEE weighting)   [NEW]
                  ├─ teaching_key_terms          (EN/NE glossary)      [NEW]
                  └─ teaching_media              (file refs only)      [NEW]
teaching_content_snapshots  (immutable doc handed to the AI service)   [NEW]
teaching_content_reviews    (workflow audit trail)                     [NEW]
```
- **The version, not the section, owns the content.** Blocks FK `teaching_section_versions.id`, so editing a draft can never mutate what is live, and a lesson can cite an immutable id forever. A published version is append-only; "editing" clones it to `v+1` draft.
- **Overrides are rows, not JSON patches.** A school row carries `school_id` + `overrides_section_id` pointing at the platform section it replaces. Resolution is one COALESCE-style query, diffs are inspectable, and a platform content fix can be re-adopted by clearing the override.
All new tables inherit the ASchool base contract (UUID PK `gen_random_uuid()`, TIMESTAMPTZ `created_at`/`updated_at`, `is_deleted` soft delete — `models/base.py:11-43`).

## B.4 DDL — verbatim from `AT §C.4`–`§C.5`

### B.4.1 Identity, versions, outcomes (`AT §C.4`)
```sql
-- ── Section: stable identity of a teachable slice of a chapter ─────────────
CREATE TABLE teaching_sections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NULL REFERENCES schools(id),     -- NULL = platform-seeded
  unit_id             UUID NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
  overrides_section_id UUID NULL REFERENCES teaching_sections(id),  -- school override of a platform row
  lms_topic_id        UUID NULL REFERENCES topics(id),      -- optional alignment with LMS delivery
  section_no          INTEGER NOT NULL,                     -- order inside the chapter
  code                VARCHAR(60)  NOT NULL,                -- "SCI.G10.U2.S3" — stable, quotable
  kind                VARCHAR(24)  NOT NULL DEFAULT 'concept',
                        -- concept | derivation | procedure | experiment | reading | revision
  title_en            VARCHAR(300) NOT NULL,
  title_ne            VARCHAR(300),
  summary_en          TEXT,                                 -- 1-3 sentence "what this teaches"
  summary_ne          TEXT,
  estimated_minutes   INTEGER      NOT NULL DEFAULT 12,     -- drives lesson length planning
  difficulty          VARCHAR(16)  NOT NULL DEFAULT 'core',  -- foundation | core | stretch
  prerequisite_section_ids UUID[]  NOT NULL DEFAULT '{}',   -- intra-subject prereq graph
  tags                JSONB        NOT NULL DEFAULT '[]',   -- ["optics","numericals"]
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by_id       UUID NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  is_deleted          BOOLEAN      NOT NULL DEFAULT FALSE,
  CONSTRAINT ck_teaching_sections_kind
    CHECK (kind IN ('concept','derivation','procedure','experiment','reading','revision')),
  CONSTRAINT ck_teaching_sections_difficulty
    CHECK (difficulty IN ('foundation','core','stretch')),
  CONSTRAINT ck_teaching_sections_override_scope          -- only school rows may override
    CHECK (overrides_section_id IS NULL OR school_id IS NOT NULL)
);
CREATE UNIQUE INDEX uq_teaching_sections_platform_code
  ON teaching_sections (unit_id, code) WHERE school_id IS NULL AND is_deleted = FALSE;
CREATE UNIQUE INDEX uq_teaching_sections_school_code
  ON teaching_sections (school_id, unit_id, code) WHERE school_id IS NOT NULL AND is_deleted = FALSE;
CREATE UNIQUE INDEX uq_teaching_sections_override
  ON teaching_sections (school_id, overrides_section_id)
  WHERE overrides_section_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX ix_teaching_sections_unit_order ON teaching_sections (unit_id, section_no);
CREATE INDEX ix_teaching_sections_school     ON teaching_sections (school_id);
```

```sql
-- ── Version: the publish unit AND the citation unit ───────────────────────
CREATE TABLE teaching_section_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NULL REFERENCES schools(id),        -- denormalized from section for fast scoping
  section_id        UUID NOT NULL REFERENCES teaching_sections(id) ON DELETE CASCADE,
  version_no        INTEGER      NOT NULL,                   -- 1,2,3…
  status            VARCHAR(16)  NOT NULL DEFAULT 'draft',    -- draft|in_review|published|archived|rejected
  supersedes_id     UUID NULL REFERENCES teaching_section_versions(id),
  language_coverage JSONB        NOT NULL DEFAULT '{"en":false,"ne":false}',
  content_sha256    CHAR(64),                                -- hash of the rendered document
  change_note       TEXT,
  ai_generation_id  UUID NULL REFERENCES ai_generations(id),  -- set when AI-assisted drafting was used
  authored_by_id    UUID NULL REFERENCES users(id),
  submitted_at      TIMESTAMPTZ,
  reviewed_by_id    UUID NULL REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  published_by_id   UUID NULL REFERENCES users(id),
  published_at      TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  is_deleted        BOOLEAN      NOT NULL DEFAULT FALSE,
  CONSTRAINT ck_tsv_status
    CHECK (status IN ('draft','in_review','published','archived','rejected')),
  CONSTRAINT uq_tsv_section_version UNIQUE (section_id, version_no)
);
-- exactly ONE live version per section — the invariant the read API depends on
CREATE UNIQUE INDEX uq_tsv_one_published
  ON teaching_section_versions (section_id)
  WHERE status = 'published' AND is_deleted = FALSE;
CREATE INDEX ix_tsv_status      ON teaching_section_versions (status);
CREATE INDEX ix_tsv_school      ON teaching_section_versions (school_id, status);
CREATE INDEX ix_tsv_section_ver ON teaching_section_versions (section_id, version_no DESC);

-- ── Outcome links: point at learning_outcomes, never copy their text ──────
CREATE TABLE teaching_section_outcomes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id   UUID NOT NULL REFERENCES teaching_section_versions(id) ON DELETE CASCADE,
  outcome_id   UUID NOT NULL REFERENCES learning_outcomes(id) ON DELETE CASCADE,
  emphasis     VARCHAR(12) NOT NULL DEFAULT 'primary',   -- primary | supporting
  mastery_key  VARCHAR(80) NOT NULL,                     -- concept_key used by ai_teacher_mastery
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted   BOOLEAN     NOT NULL DEFAULT FALSE,
  CONSTRAINT ck_tso_emphasis CHECK (emphasis IN ('primary','supporting')),
  CONSTRAINT uq_tso UNIQUE (version_id, outcome_id)
);
CREATE INDEX ix_tso_outcome ON teaching_section_outcomes (outcome_id);
```
`mastery_key` is the join to `ai_teacher_mastery` (keyed `student_id + concept_key`): mastery is recorded against **curriculum outcomes**, not ad-hoc chapter titles. That column is what makes spaced repetition and report-card evidence possible; Ashlya's keys are LLM-invented chapter labels (`events.py:849-878`), unusable across lessons (`AT §C.4`).

### B.4.2 Content blocks — all FK the version, all bilingual (`AT §C.5`)
```sql
-- ── Teaching notes: the ordered narrative the AI teaches from ─────────────
CREATE TABLE teaching_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id    UUID NOT NULL REFERENCES teaching_section_versions(id) ON DELETE CASCADE,
  block_no      INTEGER      NOT NULL,
  block_type    VARCHAR(24)  NOT NULL DEFAULT 'explanation',
                  -- hook | explanation | definition | analogy | step | caution | recap | activity
  heading_en    VARCHAR(300),
  heading_ne    VARCHAR(300),
  body_en       TEXT NOT NULL,
  body_ne       TEXT,
  speaker_note_en TEXT,          -- "say it like this" guidance for the AI voice
  speaker_note_ne TEXT,
  board_hint    VARCHAR(200),    -- optional layout hint, e.g. "write left column, then diagram"
  media_id      UUID NULL,       -- FK added after teaching_media (deferred)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted    BOOLEAN     NOT NULL DEFAULT FALSE,
  CONSTRAINT ck_tn_block_type CHECK (block_type IN
    ('hook','explanation','definition','analogy','step','caution','recap','activity')),
  CONSTRAINT uq_tn_version_block UNIQUE (version_id, block_no)
);
CREATE INDEX ix_tn_version ON teaching_notes (version_id, block_no);

-- ── Worked examples: stepped, so the teacher can scaffold or hide steps ───
CREATE TABLE teaching_examples (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id     UUID NOT NULL REFERENCES teaching_section_versions(id) ON DELETE CASCADE,
  example_no     INTEGER     NOT NULL,
  kind           VARCHAR(20) NOT NULL DEFAULT 'worked',  -- worked | guided | practice | exam
  difficulty     VARCHAR(16) NOT NULL DEFAULT 'core',    -- foundation | core | stretch
  prompt_en      TEXT NOT NULL,
  prompt_ne      TEXT,
  given_en       TEXT,                                   -- "Given: u = 10 cm, f = 15 cm"
  given_ne       TEXT,
  steps          JSONB NOT NULL DEFAULT '[]',
     -- [{"n":1,"en":"Apply the mirror formula","ne":"…","latex":"\\frac1v+\\frac1u=\\frac1f",
     --   "why_en":"because …","why_ne":"…"}]
  answer_en      TEXT,
  answer_ne      TEXT,
  answer_latex   TEXT,
  unit_label     VARCHAR(40),                            -- "cm", "m/s²"
  marks          INTEGER,                                -- exam-style mark allocation
  source_ref     VARCHAR(200),                           -- "CDC Sci G10 Ex 2.3 Q4" (typed by admin)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted     BOOLEAN     NOT NULL DEFAULT FALSE,
  CONSTRAINT ck_te_kind CHECK (kind IN ('worked','guided','practice','exam')),
  CONSTRAINT uq_te_version_no UNIQUE (version_id, example_no)
);
CREATE INDEX ix_te_version ON teaching_examples (version_id, example_no);
```

```sql
-- ── Common misconceptions: the highest-value teaching asset ───────────────
CREATE TABLE teaching_misconceptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id       UUID NOT NULL REFERENCES teaching_section_versions(id) ON DELETE CASCADE,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  wrong_belief_en  TEXT NOT NULL,      -- "Heavier objects fall faster"
  wrong_belief_ne  TEXT,
  why_students_think_en TEXT,          -- the intuition behind the error
  why_students_think_ne TEXT,
  correction_en    TEXT NOT NULL,
  correction_ne    TEXT,
  diagnostic_question_en TEXT,         -- the probe the AI asks to detect it
  diagnostic_question_ne TEXT,
  severity         VARCHAR(12) NOT NULL DEFAULT 'common',   -- rare | common | pervasive
  linked_outcome_id UUID NULL REFERENCES learning_outcomes(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted       BOOLEAN     NOT NULL DEFAULT FALSE,
  CONSTRAINT ck_tm_severity CHECK (severity IN ('rare','common','pervasive'))
);
CREATE INDEX ix_tm_version ON teaching_misconceptions (version_id, sort_order);

-- ── Formulas: LaTeX for the board, plain text for the voice ───────────────
CREATE TABLE teaching_formulas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id     UUID NOT NULL REFERENCES teaching_section_versions(id) ON DELETE CASCADE,
  sort_order     INTEGER      NOT NULL DEFAULT 0,
  name_en        VARCHAR(200) NOT NULL,          -- "Mirror formula"
  name_ne        VARCHAR(200),
  latex          TEXT NOT NULL,                  -- "\frac{1}{v}+\frac{1}{u}=\frac{1}{f}"
  spoken_en      TEXT NOT NULL,                  -- "one over v plus one over u equals one over f"
  spoken_ne      TEXT,                           -- Nepali reading; TTS uses this, never the LaTeX
  symbols        JSONB NOT NULL DEFAULT '[]',
     -- [{"sym":"v","meaning_en":"image distance","meaning_ne":"…","unit":"cm"}]
  conditions_en  TEXT,                           -- validity conditions / sign convention
  conditions_ne  TEXT,
  derivable      BOOLEAN NOT NULL DEFAULT FALSE, -- true → teacher may derive it live
  must_memorize  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted     BOOLEAN     NOT NULL DEFAULT FALSE
);
CREATE INDEX ix_tf_version ON teaching_formulas (version_id, sort_order);
```

```sql
-- ── Exam tips: NEB/SEE reality, anchored to the marks grid ────────────────
CREATE TABLE teaching_exam_tips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id          UUID NOT NULL REFERENCES teaching_section_versions(id) ON DELETE CASCADE,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  tip_type            VARCHAR(24) NOT NULL DEFAULT 'frequent',
                        -- frequent | trap | marking_scheme | time_management | presentation
  body_en             TEXT NOT NULL,
  body_ne             TEXT,
  exam_board          VARCHAR(16),                -- 'neb' | 'see' | 'cdc' | 'school'
  question_pattern    VARCHAR(120),               -- "2-mark short answer", "4-mark numerical"
  typical_marks       INTEGER,
  appeared_years      JSONB NOT NULL DEFAULT '[]',-- [2078,2080] — typed by admins, not scraped
  subject_offering_id UUID NULL REFERENCES subject_offerings(id),  -- ties to THFM/THPM grid
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted          BOOLEAN     NOT NULL DEFAULT FALSE,
  CONSTRAINT ck_tet_type CHECK (tip_type IN
    ('frequent','trap','marking_scheme','time_management','presentation'))
);
CREATE INDEX ix_tet_version ON teaching_exam_tips (version_id, sort_order);

-- ── Key terms: the EN/NE glossary the mixed-language mode needs ───────────
CREATE TABLE teaching_key_terms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id    UUID NOT NULL REFERENCES teaching_section_versions(id) ON DELETE CASCADE,
  term_en       VARCHAR(200) NOT NULL,
  term_ne       VARCHAR(200),
  keep_in_english BOOLEAN NOT NULL DEFAULT TRUE,  -- "triangle","force" stay English in mixed mode
  definition_en TEXT,
  definition_ne TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_tkt_version_term UNIQUE (version_id, term_en)
);

-- ── Media: REFERENCES ONLY. Never parsed, never OCR'd. ────────────────────
CREATE TABLE teaching_media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id    UUID NOT NULL REFERENCES teaching_section_versions(id) ON DELETE CASCADE,
  media_type    VARCHAR(16) NOT NULL,            -- image | svg | audio | video | link
  file_id       UUID NULL REFERENCES files(id),  -- ASchool file storage  ← see D-4
  external_url  TEXT,
  svg_inline    TEXT,                            -- admin-pasted SVG the board can draw directly
  alt_text_en   VARCHAR(400) NOT NULL,           -- accessibility + what the AI is allowed to SAY
  alt_text_ne   VARCHAR(400),
  caption_en    VARCHAR(400),
  caption_ne    VARCHAR(400),
  licence       VARCHAR(120),                    -- "CC-BY-4.0", "school-owned"
  attribution   VARCHAR(200),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT ck_tmedia_type CHECK (media_type IN ('image','svg','audio','video','link')),
  CONSTRAINT ck_tmedia_target CHECK (
    file_id IS NOT NULL OR external_url IS NOT NULL OR svg_inline IS NOT NULL)
);
CREATE INDEX ix_tmedia_version ON teaching_media (version_id, sort_order);
ALTER TABLE teaching_notes
  ADD CONSTRAINT fk_tn_media FOREIGN KEY (media_id) REFERENCES teaching_media(id);
```

### B.4.3 Side tables — snapshot + review trail (`AT §C.5`)
```sql
-- ── Snapshot: the immutable document handed to the AI service ─────────────
CREATE TABLE teaching_content_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NULL REFERENCES schools(id),
  version_id     UUID NOT NULL REFERENCES teaching_section_versions(id),
  language       VARCHAR(8)  NOT NULL,           -- en | ne | mixed
  document       JSONB       NOT NULL,           -- the exact payload sent (§B.5)
  document_sha256 CHAR(64)   NOT NULL,
  token_estimate INTEGER     NOT NULL DEFAULT 0,
  built_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted     BOOLEAN     NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_tcs UNIQUE (version_id, language, document_sha256)
);
CREATE INDEX ix_tcs_version_lang ON teaching_content_snapshots (version_id, language);

-- ── Review trail: who moved what, when, why ───────────────────────────────
CREATE TABLE teaching_content_reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NULL REFERENCES schools(id),
  version_id   UUID NOT NULL REFERENCES teaching_section_versions(id) ON DELETE CASCADE,
  action       VARCHAR(16) NOT NULL,            -- submit|approve|reject|publish|archive|revert
  from_status  VARCHAR(16),
  to_status    VARCHAR(16),
  actor_id     UUID NULL REFERENCES users(id),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT ck_tcr_action CHECK (action IN
    ('submit','approve','reject','publish','archive','revert'))
);
CREATE INDEX ix_tcr_version ON teaching_content_reviews (version_id, created_at DESC);
```
Table count: **12 new tables** — sections, section_versions, section_outcomes, notes, examples, misconceptions, formulas, exam_tips, key_terms, media, content_snapshots, content_reviews. `AT §C.8` says "the eleven tables" in its migration note; see **D-12**. The enumerated DDL is authoritative.

### B.4.4 SQLAlchemy sketch + migration plan (`AT §C.8`)
Models at `backend/app/models/teaching_content.py`; docstring: "Admin-entered teaching content (no OCR): sections → versions → blocks. Extends the EXISTING curriculum chain … with the layer that was missing: what to actually teach, versioned, bilingual, publishable, and overridable per school. Nothing here duplicates curriculum.py or lms.py." All classes extend `BaseModel` from `app.models.base`.
- `TeachingSection` — DDL columns; `unit = relationship("CurriculumUnit", backref="teaching_sections")`; `versions = relationship("TeachingSectionVersion", backref="section", cascade="all, delete-orphan", order_by="TeachingSectionVersion.version_no")`; `__table_args__` = the three CheckConstraints + two partial-unique `Index(..., postgresql_where=text("school_id IS NULL AND is_deleted = false"))` forms + `ix_teaching_sections_unit_order`; `@property published_version` returns the first version with `status == "published" and not is_deleted`.
- `TeachingSectionVersion` — docstring "The publish unit AND the citation unit. Published rows are immutable; editing clones to version_no + 1 as a draft."; eight `relationship(...)` collections (`notes` ordered by `block_no`, `examples`, `misconceptions`, `formulas`, `exam_tips`, `key_terms`, `media`, `outcome_links`), all `cascade="all, delete-orphan"`; `__table_args__` = `ck_tsv_status`, `uq_tsv_section_version`, partial-unique `uq_tsv_one_published`, `ix_tsv_school`.
- The other 10 classes appear as a commented column manifest matching the DDL field-for-field.
- **Migration:** one Alembic revision creating the tables, the partial unique indexes and the deferred `teaching_notes.media_id` FK. Platform seeding extends idempotent `seed_curriculum()` (`backend/app/services/ai/curriculum_seed.py:52-120`) with a second pass creating `teaching_sections` + a published v1 for the CDC units it already writes — **starting with Science and Math grades 8-10, "which is where the AI teacher earns its keep."**

## B.5 Versioning, publish workflow, override chain (`AT §C.6`)
State machine, enforced in the service layer, audited in `teaching_content_reviews`:
```
draft ──submit──► in_review ──approve/publish──► published ──(edit)──► new draft (v+1)
  ▲                   │                              │
  └────reject─────────┘                              └──archive──► archived
```
- Only `curriculum_admin`/`superadmin` may publish platform rows (`school_id IS NULL`); `school_admin` and a `content_editor` role may publish their own school's rows.
- `uq_tsv_one_published` guarantees exactly one live version per section, **so the read API never has to disambiguate**.
- Publishing computes `content_sha256` + `language_coverage`.
- **Publish gate refuses when:** no `primary` outcome link · zero `teaching_notes` blocks · `body_en` empty on any block · media without `alt_text_en` · a formula without `spoken_en` · or (config-gated) `require_nepali=true` and any `*_ne` primary field missing.
- "Honest bilingual state beats fake bilingual state" — a section may ship EN-only with `language_coverage.ne=false`, and the launcher then tells the student "Nepali not available for this chapter yet" **instead of machine-translating silently at teach time**.
- Archived versions are never deleted: lessons cite version ids and a parent must still be able to see what their child was taught in Baisakh.

**Resolution order** for a `(unit, section_code)` in school S — verbatim CTE (`AT §C.6`):
```sql
WITH school_row AS (
  SELECT s.id FROM teaching_sections s
  WHERE s.school_id = :school AND s.unit_id = :unit AND s.code = :code AND s.is_deleted = FALSE
), platform_row AS (
  SELECT s.id FROM teaching_sections s
  WHERE s.school_id IS NULL AND s.unit_id = :unit AND s.code = :code AND s.is_deleted = FALSE
)
SELECT v.* FROM teaching_section_versions v
WHERE v.section_id = COALESCE((SELECT id FROM school_row), (SELECT id FROM platform_row))
  AND v.status = 'published' AND v.is_deleted = FALSE;
```
School row wins; platform row is the fallback. A school "fork" clones the platform section into a school row with `overrides_section_id` set (the clone copies the published version's blocks as a `draft` v1). **Clearing the override re-adopts platform content — "which is how a curriculum correction reaches 400 schools without 400 edits."**

## B.6 The read API the AI Teacher pulls (`AT §C.7`)
One S2S endpoint, key+HMAC authenticated (same credential as `AT §B.2`), read-only, cacheable:
```
GET /api/v1/ai-teacher/content/section/{section_id}?language=en|ne|mixed&depth=full|outline
  headers: X-ASchool-Key, X-ASchool-Signature, X-ASchool-Timestamp
  200 → {
    "snapshot_id": "…", "version_id": "…", "version_no": 3, "sha256": "…",
    "language": "ne", "language_coverage": {"en": true, "ne": true},
    "curriculum": { "board":"cdc","grade":"10","subject_code":"SCI.G10",
                    "subject_name":"Science","unit_no":2,
                    "unit_title":{"en":"Energy in Daily Life","ne":"…"} },
    "section":  { "code":"SCI.G10.U2.S3","kind":"concept","estimated_minutes":12,
                  "difficulty":"core","title":{"en":"…","ne":"…"},
                  "summary":{"en":"…","ne":"…"},
                  "prerequisites":[{"code":"…","title":{…}}] },
    "outcomes": [ {"code":"SCI.101.U2.LO3","bloom":"apply","emphasis":"primary",
                   "mastery_key":"outcome:SCI.101.U2.LO3","statement":{"en":"…","ne":"…"}} ],
    "notes":    [ {"block_no":1,"type":"hook","heading":{…},"body":{…},
                   "speaker_note":{…},"board_hint":"…","media_id":"…"} ],
    "examples": [ {"no":1,"kind":"worked","difficulty":"core","prompt":{…},"given":{…},
                   "steps":[{"n":1,"text":{…},"latex":"…","why":{…}}],
                   "answer":{…},"answer_latex":"…","marks":4} ],
    "misconceptions":[ {"wrong_belief":{…},"why_students_think":{…},"correction":{…},
                        "diagnostic_question":{…},"severity":"common","outcome_code":"…"} ],
    "formulas": [ {"name":{…},"latex":"…","spoken":{…},"symbols":[…],
                   "conditions":{…},"derivable":true,"must_memorize":false} ],
    "exam_tips":[ {"type":"trap","board":"see","pattern":"4-mark numerical",
                   "typical_marks":4,"appeared_years":[2078,2080],"body":{…}} ],
    "key_terms":[ {"en":"refraction","ne":"अपवर्तन","keep_in_english":true,"definition":{…}} ],
    "media":    [ {"id":"…","type":"svg","svg_inline":"<svg …>","alt_text":{…},
                   "caption":{…},"licence":"CC-BY-4.0"} ],
    "trust": "curriculum", "generated_at":"…", "etag":"W/\"<sha256>\""
  }
  304 on If-None-Match · 404 unknown/unpublished · 401 bad signature · 429 rate limited
```
`language=mixed` returns both `en` and `ne` fields **and the `keep_in_english` flags** — the service's mixed Nepali+English mode (a UI chip in Ashlya, `ateacher_bridge_screen.dart:1258-1305`) then has real data instead of guessing which nouns to keep. `depth=outline` returns the section/outcome/heading skeleton only, for planning calls; `full` for teaching. Both are wrapped by the caller in `<source trust="curriculum">` (`AT §B.7`). Companions, same auth: `GET /content/units/{unit_id}/sections` (ordered outline for multi-section lessons) and `GET /content/search?grade=&subject=&q=` (launcher picker; ASchool-internal JWT version for the UI).

---

# C. AI TOOL CATALOG (`TC` Parts 1, 3, 4)

## C.1 Reading the catalog (`TC §3.0`)
**153 tools across 13 groups (A..M).** Framing claim: bigger than MagicSchool's named surface and, unlike every competitor, anchored to a live SIS — marks, attendance, fees, timetable, IEMIS, BS calendar.
- **Persona** — T teacher · S student · P parent/guardian · A admin (school_admin/superadmin) · C counselor · H HR/head-teacher.
- **Result template** — the frontend renderer that draws the JSON. Existing 10: `plan_card` (title + objectives[] + phases[{name,duration,activities[]}] + assessment) · `qa_list` (items[{question, marks, question_type, answer?}] with mark total) · `text_block` (subject + body prose, copy/insert) · `rubric_grid` (criteria[{name,max_marks,descriptors,levels[]}] matrix) · `tiered_panel` (tiers[{tier,strategy,activities[]}] side by side) · `flashcard_deck` (cards[{front,back}] flip UI) · `feedback_panel` (strengths[]/improvements[]/next_steps[]/encouragement) · `section_list` (sections[{heading,points[]}] + practice_questions[]) · `insight_cards` (metric cards + narrative + drill-down) · `board_stream` (streamed whiteboard directives + narration, ARIA). **Four NEW templates that must be built once and then serve dozens of tools:** `table_grid` (headers[] + rows[][] + totals, inline-editable, → writer table block) · `slide_deck` (slides[{type,…}] thumbnail rail + editor + present mode) · `chart_panel` (series/labels + chart type + caption; Recharts on screen, SVG in PDF) · `checklist` (items[{label,done,owner,due_bs}], exportable).
- **Curric.** — `Y` = needs NEB/CDC grounding via `context_curriculum` (`tool_handlers.py`) and **must not run without a `CurriculumFramework` match**; `y` = optional grounding improves output; `–` = none.
- **Doc** — which existing engine renders the printable artifact: `writer` = `writer_json.blocks` → `TemplateEngineService._render_writer_html` → WeasyPrint PDF / `writer_docx.py` DOCX · `canvas` = fabric multi-page JSON → `designer/document_renderer.py` → WeasyPrint · `report` = `app/utils/report_pdf.py` letterhead + BS-date PDF · `bulk` = `designer/bulk_generator.py` per-student loop · `deck` = **new** slide engine · `xlsx` = openpyxl (already a dependency) · `–` = screen only.
- **Cost** — 0 deterministic (no model call) · 1 fast model, short · 2 smart model ≤1.5k out · 3 smart, long or two-pass · 4 per-item batch, vision or audio.
- **Status** — `IMPL` shipped and wired · `PART` partially built (service exists, or route exists without registry/schema/prompt) · `NEW`. Evidence for IMPL/PART cited by the report: `workbench_seed.py` (10 registry rows), `tool_schemas.py` (10 schemas), `tool_handlers.py` (3 handlers + 1 context builder), `app/prompts/*_{en,ne}.md` (20 files), `app/api/v1/ai_tools.py`, `ai_workbench.py`, `ai_tutor.py`, `ai_capture.py`, `ai_extensions.py`, `design_studio.py`, `app/services/ai/*.py`.

### C.1.1 Counts per group (`TC §3.14`)
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

The 10 tools with a full registry row + schema + EN/NE prompt today: `fixture_test, lesson_plan, worksheet, exit_ticket, rubric, parent_email, differentiation, study_guide, flashcards, writing_feedback` (`workbench_seed.py`). Everything else marked IMPL is wired through an older bespoke route (`ai_tools.py`, `ai_tutor.py`, `ai_capture.py`, `assignments.py`, `adaptive_learning.py`, `website_builder.py`) and **should be migrated into the registry** so it inherits consent, pseudonymization, injection screening, schema repair, moderation, the `AIGeneration` ledger and Caliper emission for free. The written-but-unmounted services are "the cheapest wins in the whole plan: the logic exists, only the registry row + schema + prompt pair is missing — literally the 'tool #66 = one row + one prompt file + one handler' claim in `workbench.py`'s docstring." (Report lists 13; the real number is **11** — see D-2.)

## C.2 Group A — Planning (14) (`TC §3.1`)
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `lesson_plan` | Lesson Plan Generator / पाठ योजना | T | NEB-aligned plan: objectives, phased activities, assessment, materials | subject_code, grade, topic, minutes | `plan_card` | Y | writer | 2 | P0 | IMPL |
| `unit_plan` | Unit / Chapter Plan / एकाइ योजना | T | 2–6 week unit: outcome map, lesson sequence, assessment plan, resources | subject, grade, unit, weeks | `plan_card`+`table_grid` | Y | writer | 3 | P0 | NEW |
| `annual_scheme` | Annual Scheme of Work / वार्षिक शिक्षण योजना | T,A | Full-year pacing across BS months, holidays, exam windows | subject, grade, BS year, calendar | `table_grid` | Y | xlsx+writer | 3 | P0 | NEW |
| `weekly_planner` | Weekly Lesson Planner / साप्ताहिक योजना | T | Reads the teacher's real timetable, drafts one plan row per period | teacher_id, week (BS) | `table_grid` | Y | writer | 3 | P1 | NEW |
| `substitute_plan` | Substitute / Cover Plan / प्रतिस्थापन योजना | T,A | Self-contained plan a non-specialist can teach tomorrow | class, subject, topic, date | `plan_card` | y | writer | 2 | P0 | NEW |
| `differentiation` | Differentiation Engine / बहुस्तरीय शिक्षण | T | Three-tier activities for a mixed-ability class | topic, grade, tiers | `tiered_panel` | – | writer | 2 | P0 | IMPL |
| `study_guide` | Study Guide Generator / अध्ययन गाइड | T,S | Exam-prep guide with practice questions | subject, grade, units | `section_list` | Y | writer | 2 | P0 | IMPL |
| `worksheet` | Worksheet Generator / अभ्यास पत्र | T | Practice worksheet with mark allocation (handler sums marks) | topic, grade, count, types | `qa_list` | Y | writer | 2 | P0 | IMPL |
| `lesson_hook` | Lesson Hook / Starter / पाठ आरम्भ | T | 3 attention-grabbing openers tied to Nepali daily life | topic, grade | `text_block` | y | – | 1 | P1 | NEW |
| `objective_writer` | Learning Objectives (Bloom) / सिकाइ उपलब्धि | T | Topic → measurable Bloom-verbed objectives mapped to CDC outcomes | topic, grade, level | `section_list` | Y | – | 1 | P0 | NEW |
| `resource_finder` | Resource & Material List / सामग्री सूची | T | Low-cost/no-cost material list for the activity, priced in NPR | activity, class size | `checklist` | – | writer | 1 | P1 | NEW |
| `pbl_designer` | Project-Based Learning Designer / परियोजना कार्य | T | Multi-week project: driving question, milestones, rubric, community link | subject, grade, theme | `plan_card`+`rubric_grid` | y | writer | 3 | P1 | NEW |
| `field_trip_plan` | Field Trip / Excursion Plan / भ्रमण योजना | T,A | Objectives, itinerary, consent letter, risk assessment, costing | destination, grade, date | `plan_card`+`checklist` | – | writer+report | 3 | P2 | NEW |
| `cocurric_plan` | Co-curricular / Club Plan / अतिरिक्त क्रियाकलाप | T,A | Term plan for a club or house activity with sessions and outcomes | club, term, sessions | `plan_card` | – | writer | 2 | P2 | NEW |

## C.3 Group B — Delivery / in-class teaching (12) (`TC §3.2`)
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `slide_deck` | Lesson Slide Deck / पाठ स्लाइड | T | Lesson plan or topic → projector deck (typed slides, Nepali-safe fonts) | lesson_plan_id or topic, slide count | `slide_deck` | Y | **deck** | 3 | P0 | NEW |
| `deck_from_doc` | Deck from Existing Material / सामग्रीबाट स्लाइड | T | Pasted notes / uploaded PDF / saved writer doc → deck, preserving the teacher's own words | doc_id or file, style | `slide_deck` | – | **deck** | 3 | P0 | NEW |
| `handout_from_deck` | Handout from Deck / स्लाइडबाट हस्तपुस्तिका | T | Same content, printable notes layout (dual-mode, the `present` skill idea) | deck_id, density | `table_grid` | – | writer | 2 | P1 | NEW |
| `board_plan` | Blackboard Layout Plan / कालोपाटी योजना | T | What to write where, in order, for a chalk-only classroom | topic, board size | `section_list` | – | writer | 1 | P1 | NEW |
| `explainer_script` | Concept Explainer Script / व्याख्या स्क्रिप्ट | T | Teacher-voice script with Nepali-context analogies, 3 difficulty passes | concept, grade | `text_block` | y | writer | 2 | P1 | NEW |
| `misconception_map` | Common Misconceptions / सामान्य भ्रम | T | Likely wrong ideas + the diagnostic question that exposes each | topic, grade | `table_grid` | Y | writer | 2 | P0 | NEW |
| `questioning_ladder` | Questioning Ladder (DOK) / प्रश्न सिँढी | T | Graduated recall → transfer question set for cold-calling | topic, grade | `qa_list` | y | writer | 2 | P1 | NEW |
| `live_poll` | Live Poll / Quiz / तत्कालै मतदान | T,S | Ephemeral in-class poll; aggregate-only analytics, deliberately not a stored artifact | question, options | `chart_panel` | – | – | 0 | P1 | PART (`ai/extensions.py LivePoll`, in-memory) |
| `group_maker` | Group / Pair Maker / समूह निर्माण | T | Balanced groups from real marks + attendance + a mixing rule | class_id, group size, strategy | `table_grid` | – | – | 0 | P0 | NEW |
| `seating_plan` | Seating Plan / बसाइ योजना | T | Seat map honouring vision/hearing needs, behaviour pairs, group work | class_id, room shape | `table_grid` | – | canvas | 1 | P2 | NEW |
| `timer_routine` | Lesson Routine & Timing / समय तालिका | T | Minute-by-minute run sheet with transition cues for a 45-min period | plan_id | `checklist` | – | – | 0 | P2 | NEW |
| `ai_teacher_board` | AI Teacher (ARIA) Whiteboard / एआई शिक्षक | S,T | Live persona tutor that speaks while hand-writing and drawing on a canvas, interruptible | topic or notes, persona | `board_stream` | y | – | 4 | P0 | PART (`ai_tutor.py` + `tutor_engine.py`; board grammar specced in `ATEACHER_INTEGRATION_BLUEPRINT.md`) |

## C.4 Group C — Assessment authoring (14) (`TC §3.3`)
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `question_paper` | Question Paper Generator / प्रश्नपत्र | T,A | NEB-format paper: sections, marks distribution, time, instructions | subject, grade, marks, blueprint | `qa_list` | Y | writer | 3 | P0 | IMPL (`ai_tools.py /question-paper`, `question_paper.py`) |
| `question_paper_v2` | Paper from Question Bank / बैंकबाट प्रश्नपत्र | T,A | Blueprint-driven selection from the stored bank + gap-filling generation | blueprint, bank filters | `qa_list` | Y | writer | 3 | P0 | IMPL (`question_paper_v2.py`, `/question-paper/v2`) |
| `question_bank` | Question Bank Curator / प्रश्न बैंक | T,A | Tag, dedupe, difficulty-rate and store items for reuse; QTI 3.0 export | items, tags | `table_grid` | Y | xlsx | 1 | P0 | IMPL (`/question-bank` CRUD + `qti_export`) |
| `blueprint_builder` | Exam Blueprint / परीक्षा ढाँचा | T,A | Builds the marks × unit × cognitive-level grid **before any question is written** | subject, grade, total marks | `table_grid` | Y | xlsx+writer | 2 | P0 | NEW |
| `answer_key` | Answer Key & Marking Scheme / उत्तर कुञ्जी | T | Step-marked model answers with partial-credit rules for an existing paper | paper_id | `qa_list` | Y | writer | 3 | P0 | NEW |
| `exit_ticket` | Exit Ticket / एक्जिट टिकट | T | 3-question end-of-class comprehension check | topic | `qa_list` | – | writer | 1 | P0 | IMPL |
| `rubric` | Rubric Builder / मूल्यांकन मापदण्ड | T | Criteria + descriptors matrix; exports as a reusable preset | task, criteria count, max marks | `rubric_grid` | – | writer | 2 | P0 | IMPL (status beta) |
| `mcq_generator` | MCQ Set with Distractors / बहुवैकल्पिक प्रश्न | T | MCQs whose wrong options encode real misconceptions, not filler | topic, count, grade | `qa_list` | Y | writer | 2 | P0 | NEW |
| `practical_exam` | Practical / Lab Assessment / प्रयोगात्मक परीक्षा | T | Practical task, apparatus list, observation sheet, 25% internal marks split | subject, grade, experiment | `qa_list`+`table_grid` | Y | writer | 2 | P0 | NEW |
| `oral_viva` | Oral / Viva Question Set / मौखिक परीक्षा | T | Graduated viva questions with expected-answer cues and a score sheet | subject, grade, topic | `qa_list` | y | writer | 2 | P1 | NEW |
| `formative_probe` | Diagnostic Pre-test / निदानात्मक परीक्षण | T | Short pre-test that locates prerequisite gaps before teaching the unit | unit, grade | `qa_list` | Y | writer | 2 | P1 | NEW |
| `project_brief` | Project / Assignment Brief / परियोजना निर्देशन | T | Task brief with deliverables, timeline, rubric link, integrity expectations | subject, grade, topic, weeks | `text_block`+`rubric_grid` | y | writer | 2 | P1 | NEW |
| `ai_resistant_task` | AI-Resistant Task Redesign / एआई-प्रतिरोधी कार्य | T | Rewrites an assignment so an LLM alone cannot complete it (local data, process evidence, in-class defence) | existing task text | `text_block` | – | writer | 2 | P1 | NEW |
| `paper_moderation` | Paper Moderation Check / प्रश्नपत्र जाँच | T,A | Deterministic + judge audit of a drafted paper: marks sum, blueprint coverage, duplicate stems, reading level, ambiguity | paper_id | `checklist` | Y | report | 3 | P1 | NEW |

## C.5 Group D — Grading & feedback (12) (`TC §3.4`)
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `auto_grader` | Auto-Grader (objective) / स्वतः जाँच | T | Grades submitted objective/short answers against the key, flags borderline for review | submission_ids | `table_grid` | – | – | 4 | P0 | IMPL (`auto_grader.py` via `assignments.py`) |
| `writing_feedback` | Writing Feedback Coach / लेखन सुझाव | T | Strengths / improvements / next steps — schema deliberately has **no `revised_text`** | writing sample | `feedback_panel` | – | writer | 2 | P0 | IMPL |
| `rubric_grader` | Rubric-Based Marking / मापदण्ड अनुसार अंक | T | Scores against a saved rubric criterion-by-criterion with a **quoted justification per criterion** | submission, rubric_id | `rubric_grid` | – | writer | 3 | P0 | NEW |
| `batch_feedback` | Batch Feedback (whole class) / सामूहिक सुझाव | T | One pass over every submission; per-student comment + class-wide trend summary | assignment_id | `table_grid`+`insight_cards` | – | writer | 4 | P0 | NEW |
| `answer_grouper` | Answer Grouping / समान उत्तर समूह | T | Clusters identical/near-identical answers so the teacher marks a group once (the Gradescope idea) | question_id | `table_grid` | – | – | 4 | P0 | NEW |
| `grader_calibration` | Marking-Style Calibration / अंकन शैली मिलान | T | Learns from ~20 of the teacher's own marked scripts, then marks in that style; reports drift vs the teacher | past marked pairs | `insight_cards` | – | report | 4 | P1 | NEW |
| `handwriting_ocr` | Handwritten Script Reader / हस्तलिखित उत्तर पठन | T | Vision pass over photographed answer sheets (Devanagari + English) into text for marking | page images | `qa_list` | – | – | 4 | P1 | NEW |
| `remark_writer` | Report Card Remarks / प्रगति टिप्पणी | T | Per-student remark from real marks + attendance, EN or NE, three tone presets | student_id, term | `text_block` | – | bulk | 1 | P0 | PART (`/remarks` → `QuestionPaperService.generate_remark`; `report_remarks.py` unmounted; no registry row/schema) |
| `remark_sheet` | Whole-Class Remark Sheet / कक्षा टिप्पणी पत्र | T | Every student's remark in one editable sheet, then pushed into report cards | class_id, term | `table_grid` | – | bulk+xlsx | 4 | P0 | NEW |
| `feedback_translator` | Feedback in Nepali / सुझाव नेपालीमा | T,P | Re-renders any feedback artifact in Nepali at a parent-readable register | source generation_id | `text_block` | – | writer | 1 | P0 | PART (`translator.py` unmounted) |
| `integrity_check` | Academic Integrity Signals / मौलिकता संकेत | T | Behavioural + textual signals (paste bursts, style shift, near-duplicate peers) with **no verdict, only evidence** | submission_id | `insight_cards` | – | report | 3 | P1 | PART (`plagiarism.py` unmounted) |
| `progress_conference` | Mark-to-Conversation Notes / अभिभावक भेट टिप्पणी | T | Turns a term's marks into 5 talking points + 2 asks for the parent meeting | student_id, term | `checklist` | – | writer | 2 | P1 | NEW |

## C.6 Group E — Differentiation & SEN/inclusion (13) (`TC §3.5`)
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `text_leveler` | Reading-Level Adapter / पठन स्तर मिलान | T | Rewrites a passage up/down 3 grade levels, keeping key vocabulary | text, target grade | `text_block` | – | writer | 2 | P0 | NEW |
| `text_scaffolder` | Text Scaffolder / पाठ सहायता | T | Adds margin glossary, chunk headings, guiding questions to a hard text | text, grade | `section_list` | – | writer | 2 | P0 | NEW |
| `vocab_support` | Vocabulary Support Set / शब्दावली सहायता | T | Word list with NE gloss, picture-cue prompt and a sentence frame per term | text or word list | `flashcard_deck` | y | writer | 1 | P0 | NEW |
| `iep_draft` | IEP Draft / व्यक्तिगत शिक्षा योजना | T,C | Draft individualized plan: present level, SMART goals, accommodations, review dates — **requires human review before finalize** | student_id, needs | `plan_card`+`table_grid` | – | writer | 3 | P0 | PART (`ai_workbench.py draft_iep`/`review_iep`/`list_ieps` + `_can_review_iep`; **no registry row/schema/prompt**) |
| `iep_progress` | IEP Progress Review / योजना प्रगति समीक्षा | T,C | Goal-by-goal progress statement from evidence since the last review | plan_id | `table_grid` | – | writer | 2 | P1 | NEW |
| `accommodation_finder` | Accommodation Suggestions / सहायता उपायहरू | T,C | Concrete classroom accommodations for a named difficulty, **no diagnosis language** | need description, grade | `checklist` | – | writer | 2 | P0 | NEW |
| `behaviour_plan` | Behaviour Support Plan / व्यवहार सहयोग योजना | T,C | Antecedent–behaviour–consequence analysis with a positive replacement strategy | incidents, student_id | `plan_card` | – | writer | 3 | P1 | NEW |
| `social_story` | Social Story / सामाजिक कथा | T,C | First-person story preparing a child for a specific situation | situation, age | `text_block` | – | writer | 1 | P2 | NEW |
| `remedial_plan` | Remedial / Catch-up Plan / उपचारात्मक योजना | T | 2–4 week plan for students below the benchmark, built from their actual weak items | class_id, threshold | `plan_card`+`table_grid` | Y | writer | 3 | P0 | NEW |
| `enrichment_plan` | Enrichment / Extension Plan / विस्तार योजना | T | Depth tasks for fast finishers instead of more of the same | topic, grade | `tiered_panel` | y | writer | 2 | P1 | NEW |
| `multilingual_support` | Mother-Tongue Bridge / मातृभाषा सहयोग | T | Key-term bridge for Maithili/Bhojpuri/Newar/Tamang learners (**language coverage to be validated per model**) | text, mother tongue | `table_grid` | – | writer | 2 | P1 | NEW |
| `udl_choice_board` | Choice Board (UDL) / विकल्प तालिका | T | 3×3 board of equivalent-outcome tasks across modalities | topic, grade | `table_grid` | y | writer | 2 | P1 | NEW |
| `adaptive_path` | Adaptive Learning Path / अनुकूल सिकाइ मार्ग | S,T | Next-best-activity sequencing from mastery evidence | student_id, subject | `checklist` | y | – | 2 | P1 | IMPL (`adaptive_learning.py` + `api/v1/adaptive_learning.py` + `ai_adaptive_learning` plugin) |

## C.7 Group F — Communication: parents, guardians, staff (14) (`TC §3.6`)
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `parent_email` | Parent Email Drafter / अभिभावक इमेल | T,A | Warm, professional parent email EN/NE; names pseudonymized during generation | notes, tone, language | `text_block` | – | – | 1 | P0 | IMPL |
| `parent_sms` | Parent SMS / Push (160 chars) / अभिभावक सन्देश | T,A | Compresses a message to one SMS segment, Nepali-transliteration aware | message, language | `text_block` | – | – | 1 | P0 | NEW |
| `parent_letter` | Formal Parent Letter / औपचारिक पत्र | T,A | Letterhead letter (fee reminder, absence concern, invitation) with BS + AD dates | type, student_id, context | `text_block` | – | report+writer | 2 | P0 | PART (`/letter-writer` route exists; no registry row/schema/prompt) |
| `difficult_conversation` | Sensitive Message Coach / संवेदनशील सन्देश | T,C | Rewrites a blunt draft into a de-escalating one and flags what not to say in writing | draft text | `feedback_panel` | – | – | 2 | P0 | NEW |
| `email_responder` | Reply Drafter / जवाफ मस्यौदा | T,A | Drafts a reply to an inbound parent message with 3 tone options | inbound text | `text_block` | – | – | 1 | P0 | NEW |
| `class_newsletter` | Class Newsletter / कक्षा समाचारपत्र | T | Monthly newsletter from real events, achievements and upcoming dates | class_id, month (BS) | `section_list` | – | canvas+writer | 2 | P1 | NEW |
| `school_notice` | Notice / Circular Writer / सूचना तथा परिपत्र | A | Formal notice in the Nepali register, letterhead-ready, with a BS date line | subject, audience, context | `text_block` | – | writer+canvas | 1 | P0 | PART (writer notice/circular templates exist in `template_engine.py`; no AI registry tool) |
| `event_invite` | Event Invitation / निमन्त्रणा | A,T | Invitation copy + a matching canvas design for print and WhatsApp | event, date, audience | `text_block` | – | canvas | 2 | P1 | NEW |
| `meeting_agenda` | Staff Meeting Agenda / बैठक कार्यसूची | A,H | Agenda with time boxes from open action items and the term calendar | topic, attendees, minutes | `checklist` | – | writer | 1 | P1 | NEW |
| `meeting_minutes` | Minutes & Action Items / बैठक निर्णय | A,H | Notes or transcript → decisions, owners, deadlines (BS dates) | notes/transcript | `checklist` | – | writer | 2 | P1 | NEW |
| `parent_faq` | Parent FAQ Answerer / अभिभावक प्रश्नोत्तर | P,A | Answers a guardian question from school policy documents **only**, with citations | question | `text_block` | – | – | 2 | P1 | PART (`rag.py` policy chunks; `faqs.py` is non-AI) |
| `translation_bridge` | EN⇄NE Document Translator / अनुवाद | T,A,P | Translates any generated artifact, preserving structure and mark totals | generation_id, target lang | same as source | – | writer | 2 | P0 | PART (`translator.py` unmounted) |
| `whatsapp_broadcast` | WhatsApp Broadcast Copy / ह्वाट्सएप सन्देश | A | Segment-aware broadcast copy with an opt-out line and a per-audience variant | audience, message | `text_block` | – | – | 1 | P2 | PART (`whatsapp_bot.py` transport exists; no AI drafting tool) |
| `emergency_notice` | Emergency Notice / आपतकालीन सूचना | A | Fast, calm multi-channel notice (SMS + push + notice board) for closure, disaster, health event | event type, details | `text_block` | – | report | 1 | P0 | PART (`services/emergency/` exists; no AI drafting) |

## C.8 Group G — Reporting & analytics (13) (`TC §3.7`)
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `school_insights` | Weekly School Insights / साप्ताहिक अन्तर्दृष्टि | A,H | Cross-module weekly digest: attendance, marks, fees, incidents | school_id, week | `insight_cards` | – | report | 3 | P0 | IMPL (`school_insights.py`, `/insights/weekly`, `tasks/ai_insights_weekly.py`) |
| `daily_brief` | Head Teacher Daily Brief / दैनिक विवरण | A,H | One-screen morning brief: absences, staff cover, dues, today's events | school_id, date | `insight_cards` | – | report | 2 | P0 | IMPL (`/insights/daily-brief`) |
| `risk_alerts` | At-Risk Student Alerts / जोखिममा विद्यार्थी | A,C,T | Flags dropout/failure risk from attendance + marks + fee trend, with the reason | school_id | `table_grid` | – | report | 2 | P0 | IMPL (`/insights/risk-alerts`; `risk_detector.py` unmounted variant) |
| `class_performance` | Class Performance Narrative / कक्षा विश्लेषण | T,A | Explains a class's result distribution and names the 3 highest-leverage actions | class_id, exam_id | `insight_cards`+`chart_panel` | – | report | 2 | P0 | NEW |
| `item_analysis` | Question-Level Item Analysis / प्रश्न विश्लेषण | T,A | Difficulty + discrimination per question; flags items to retire | exam_id | `table_grid`+`chart_panel` | – | report+xlsx | 1 | P0 | NEW |
| `cohort_trend` | Cohort Trend Report / समूह प्रवृत्ति | A | Multi-term trajectory per grade/subject with a plain-language causal caution | grade, terms | `chart_panel` | – | report | 2 | P1 | NEW |
| `attendance_insight` | Attendance Pattern Insight / उपस्थिति विश्लेषण | A,T,C | Chronic-absence detection, day-of-week and seasonal (festival) patterns | class_id, range | `chart_panel` | – | report | 2 | P0 | PART (`attendance_ai.py` unmounted) |
| `fee_forecast` | Fee Collection Forecast / शुल्क अनुमान | A | Projects collection and flags likely defaulters with a suggested approach | school_id, month | `chart_panel` | – | report | 2 | P1 | PART (`fee_predictor.py` unmounted) |
| `benchmark_report` | Peer Benchmark Report / तुलनात्मक प्रतिवेदन | A | Compares this school against anonymized peers on a few honest metrics | school_id, metrics | `insight_cards` | – | report | 2 | P1 | PART (`benchmarking_ai.py` + `api/v1/benchmarking.py`; not in AI registry) |
| `board_report` | Board / SMC Report / व्यवस्थापन समिति प्रतिवेदन | A,H | Termly governance report: enrolment, results, finance, staffing, risks | school_id, term | `section_list`+`chart_panel` | – | report | 3 | P1 | NEW |
| `iemis_readiness` | IEMIS Submission Readiness / IEMIS तयारी | A | Audits records against IEMIS field requirements and lists exactly what to fix | school_id, cycle | `checklist` | – | report+xlsx | 1 | P0 | PART (`models/iemis.py`, `iemis_importer` plugin, `iemis_templates/` exist; no AI audit tool) |
| `donor_report` | Donor / Grant Report / अनुदान प्रतिवेदन | A | Narrative + evidence pack against grant indicators | grant, period | `section_list` | – | report | 3 | P2 | NEW |
| `sentiment_pulse` | Feedback Sentiment Pulse / प्रतिक्रिया विश्लेषण | A,H | Themes and sentiment from parent/student survey free text | survey_id | `insight_cards` | – | report | 2 | P2 | PART (`sentiment.py` unmounted) |

## C.9 Group H — Professional development & HR (11) (`TC §3.8`)
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `pd_coach` | PD Coach (UNESCO framework) / व्यावसायिक विकास | T,H | Self-assessment against the 6-strand UNESCO ICT-CFT and a next-step plan | teacher_id, self-ratings | `checklist` | – | report | 2 | P1 | PART (`ai/extensions.py seed_pd_framework` + `teacher_pd_progress` + `register_pd_routes`; not a registry tool) |
| `lesson_observation` | Lesson Observation Notes / कक्षा अवलोकन | H,A | Structured observation write-up: evidence, strengths, one growth focus | observation notes | `feedback_panel` | – | writer | 2 | P0 | NEW |
| `teacher_feedback` | Post-Observation Feedback Script / सुझाव वार्ता | H | Coaching script for the conversation, **not a verdict** | observation_id | `text_block` | – | writer | 2 | P1 | NEW |
| `pd_plan` | Individual PD Plan / व्यक्तिगत विकास योजना | T,H | Term-by-term development plan with free/low-cost Nepali resources | teacher_id, goals | `plan_card` | – | writer | 2 | P1 | NEW |
| `workshop_designer` | Staff Workshop Designer / कर्मचारी कार्यशाला | H,A | 60–180 min session plan with activities, handout and a slide deck | topic, duration, audience | `plan_card`+`slide_deck` | – | deck+writer | 3 | P1 | NEW |
| `mentoring_notes` | Mentoring Log / परामर्श अभिलेख | H | Turns a mentoring chat into a dated log with agreed actions | notes | `checklist` | – | writer | 1 | P2 | NEW |
| `appraisal_draft` | Staff Appraisal Draft / कर्मचारी मूल्यांकन | H,A | Evidence-based appraisal narrative from attendance, results and observations — **human sign-off required** | staff_id, cycle | `text_block` | – | report | 3 | P1 | NEW |
| `jd_writer` | Job Description & Advert / पद विवरण | A,H | JD + advert copy + shortlisting criteria for a vacancy | role, level | `text_block` | – | writer | 1 | P2 | NEW |
| `interview_kit` | Interview Question Kit / अन्तर्वार्ता प्रश्न | A,H | Role-specific questions with what a good answer contains, plus a scoring sheet | role, competencies | `qa_list`+`rubric_grid` | – | writer | 2 | P2 | NEW |
| `induction_pack` | New Teacher Induction Pack / नयाँ शिक्षक परिचय | A,H | First-week checklist, policy summaries, who-to-ask map | role, start date | `checklist` | – | writer | 2 | P2 | NEW |
| `policy_drafter` | School Policy Drafter / विद्यालय नीति | A | Drafts a policy (AI use, phones, safeguarding, exams) grounded in existing school documents | topic, existing policies | `section_list` | – | writer | 3 | P1 | NEW |

## C.10 Group I — Admin & operations (12) (`TC §3.9`)
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `timetable_solver` | Timetable Generator / समय तालिका | A | Constraint-satisfying timetable with teacher-load balancing | classes, teachers, constraints | `table_grid` | – | xlsx+writer | 2 | P0 | IMPL (`timetable_solver.py`, `/timetable` + `/timetable/save`) |
| `exam_timetable` | Exam Schedule Builder / परीक्षा तालिका | A | Exam timetable avoiding subject clashes, with invigilation duty roster | exams, rooms, staff | `table_grid` | – | writer+bulk | 2 | P0 | NEW |
| `duty_roster` | Duty / Invigilation Roster / ड्युटी तालिका | A,H | Fair rotation honouring leave and part-time contracts | staff, dates, slots | `table_grid` | – | xlsx | 1 | P1 | NEW |
| `voice_capture` | Voice Data Capture / बोलीबाट प्रविष्टि | T,A | Speak attendance or marks; transcribed, parsed, then **confirmed** before write | audio | `table_grid` | – | – | 4 | P0 | IMPL (`ai_capture.py /voice` + `/confirm`) |
| `photo_capture` | Photo Data Capture / फोटोबाट प्रविष्टि | T,A | Photograph a paper register or mark sheet → structured rows for confirmation | image | `table_grid` | – | – | 4 | P0 | IMPL (`ai_capture.py /photo`) |
| `data_cleanup` | Data Quality Sweep / डाटा सफाई | A | Finds duplicate students, impossible dates, missing guardians, malformed IDs | school_id | `checklist` | – | xlsx | 1 | P0 | NEW |
| `admission_bot` | Admission Enquiry Assistant / भर्ना सहायक | A,P | Answers admission questions and captures a structured lead | question | `text_block` | – | – | 1 | P1 | PART (`admission_bot.py`; referenced only in the `admission` manifest) |
| `admission_screener` | Application Screener / आवेदन छनोट | A | Ranks applications against published criteria with a stated reason per rank | applications | `table_grid` | – | report | 3 | P2 | NEW |
| `inventory_forecast` | Inventory & Reorder Advisor / सामग्री अनुमान | A | Consumption-based reorder points for stationery, lab and library stock | inventory, period | `table_grid` | – | xlsx | 1 | P2 | NEW |
| `transport_optimizer` | Bus Route Optimizer / बस मार्ग | A | Groups stops into routes by geography, capacity and travel time | students, stops, buses | `table_grid` | – | report | 2 | P2 | NEW |
| `website_content` | School Website Content / वेबसाइट सामग्री | A | Generates page copy and section layout for the site builder | page type, school profile | `section_list` | – | – | 2 | P1 | IMPL (`website_designer.py` + `website_builder.py`) |
| `social_post` | Social Media Post / सामाजिक सञ्जाल पोस्ट | A | Post copy + matching canvas graphic for an achievement or event | event, tone | `text_block` | – | canvas | 1 | P2 | PART (`social_ai.py` unmounted) |

## C.11 Group J — Student learning (16) (`TC §3.10`)
All student-facing tools pass the orchestrator's guardian-consent gate: role `student` → resolve own `Student` row → `_require_guardian_consent`, **which is unbypassable by omitting `student_id`** (`workbench.py` step 2).
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `ai_tutor` | AI Tutor Session / एआई शिक्षक पाठ | S | Socratic tutoring that guides rather than answers; monitored by the teacher | topic, plan_id | `board_stream` | y | – | 4 | P0 | IMPL (`ai_tutor.py` plans/sessions/turn/close/messages/monitor + `tutor_engine.py`) |
| `homework_helper` | Homework Helper / गृहकार्य सहयोग | S | Hint-first help that never hands over the final answer | question | `feedback_panel` | y | – | 2 | P0 | IMPL (`homework_helper.py`, `/homework-help`) |
| `flashcards` | Flashcard Generator / फ्ल्याशकार्ड | S,T | Q&A deck for revision (handler counts cards) | topic, count | `flashcard_deck` | – | writer | 1 | P0 | IMPL |
| `practice_set` | Adaptive Practice Set / अभ्यास सेट | S | Questions targeted at this student's weakest verified items | student_id, subject | `qa_list` | Y | writer | 2 | P0 | NEW |
| `concept_explainer` | Explain It Simpler / सजिलो व्याख्या | S | Re-explains a stuck concept 3 ways (analogy, steps, visual description) | concept, grade | `section_list` | y | – | 1 | P0 | NEW |
| `worked_example` | Worked Example Walkthrough / नमुना समाधान | S | Step-by-step model solution with reasoning made explicit, then a twin problem | problem | `section_list` | y | writer | 2 | P0 | NEW |
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

## C.12 Group K — Student wellbeing & safeguarding (8) (`TC §3.11`)
Every tool here routes through the existing moderation path: `workbench.moderate` → `critical` self-harm → `ModerationFlag(severity="critical")` + blocked generation + counselor queue (`workbench.py _escalate_self_harm`). **No second alerting mechanism is introduced.**
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `wellbeing_checkin` | Wellbeing Check-in / सुस्वास्थ्य जाँच | S,C | Short structured check-in; escalates critical signals to a counselor, **never self-treats** | student responses | `feedback_panel` | – | – | 2 | P0 | PART (`wellbeing_ai.py` + `api/v1/wellbeing.py` exist; not an AI registry tool) |
| `counselor_brief` | Counselor Case Brief / परामर्श विवरण | C | Assembles attendance, marks, incidents and flags into a single confidential brief | student_id | `insight_cards` | – | report | 3 | P0 | NEW |
| `incident_writeup` | Incident Report Writer / घटना प्रतिवेदन | T,A,C | Turns rough notes into a factual, non-judgemental incident record | notes | `text_block` | – | report | 2 | P0 | PART (`incident_management.py`/`incidents.py` exist; no AI drafting) |
| `restorative_script` | Restorative Conversation Script / पुनर्स्थापनात्मक संवाद | T,C | Prepares a repair conversation between students instead of a punishment note | incident_id | `text_block` | – | writer | 2 | P1 | NEW |
| `bullying_triage` | Bullying Report Triage / दुर्व्यवहार छानबिन | C,A | Classifies severity, lists required next steps and the statutory record to create | report text | `checklist` | – | report | 2 | P1 | NEW |
| `safeguarding_check` | Safeguarding Signal Review / बाल संरक्षण संकेत | C | Reviews accumulated soft signals and states whether the referral threshold is met | student_id | `checklist` | – | report | 3 | P1 | NEW |
| `attendance_outreach` | Absence Outreach Message / अनुपस्थिति सम्पर्क | T,C | Non-accusatory family message for chronic absence with a support offer | student_id | `text_block` | – | – | 1 | P0 | NEW |
| `crisis_protocol` | Crisis Response Prompt / संकट प्रतिक्रिया | C,A | Surfaces the school's own protocol steps + the correct Nepali helpline; **deterministic, no generation** | event type | `checklist` | – | report | 0 | P0 | NEW |

## C.13 Group L — Parent-facing (8) (`TC §3.12`)
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `report_explainer` | "What does this report mean?" / प्रगति पत्र व्याख्या | P | Explains the child's report card in plain Nepali, including what GPA and NEB grades mean | student_id, term | `section_list` | – | – | 1 | P0 | NEW |
| `home_support` | How to Help at Home / घरमा सहयोग | P | 3 concrete, resource-free activities matched to the child's weakest area | student_id | `checklist` | y | writer | 1 | P0 | NEW |
| `fee_explainer` | Fee & Due Explainer / शुल्क विवरण व्याख्या | P | Explains the invoice line by line and states the payment options | invoice_id | `text_block` | – | report | 1 | P1 | NEW |
| `school_qa` | Ask the School / विद्यालयलाई सोध्नुहोस् | P | Answers from published school policy only, cites the document, escalates when unknown | question | `text_block` | – | – | 2 | P1 | NEW |
| `meeting_prep_parent` | Parents' Day Prep / अभिभावक दिवस तयारी | P | 5 questions worth asking about *this* child at the meeting | student_id | `checklist` | – | – | 1 | P1 | NEW |
| `consent_explainer` | AI Consent Explainer / एआई सहमति व्याख्या | P | Explains in Nepali what the AI features do with their child's data **before** consent is granted | – | `section_list` | – | – | 0 | P0 | PART (`GuardianAIConsent` model + gate exist; no explainer surface) |
| `transition_guide` | Grade Transition Guide / कक्षा परिवर्तन मार्गदर्शन | P | What changes next year (subjects, workload, exams) and how to prepare | grade | `section_list` | y | writer | 1 | P2 | NEW |
| `attendance_digest` | Monthly Attendance Digest / मासिक उपस्थिति सार | P | Plain-language monthly summary with a pattern note, BS dates | student_id, month BS | `chart_panel` | – | report | 1 | P1 | NEW |

## C.14 Group M — Nepal-specific: NEB/SEE/CDC, Nepali, BS, IEMIS (6) (`TC §3.13`)
"These are the tools no competitor can copy quickly, and they are why the catalog wins locally."
| key | Name EN / नेपाली | Persona | What it does | Inputs | Result | Curr | Doc | Cost | P | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `curriculum_mapper` | CDC Curriculum Mapper / पाठ्यक्रम नक्सांकन | T,A | Ingests a CDC curriculum PDF into `CurriculumFramework` + units + `LearningOutcome` rows, so every other tool can ground on it | curriculum file, subject, grade | `table_grid` | Y | xlsx | 3 | P0 | PART (`curriculum_seed.py` + `models/curriculum.py` exist; report says "unmounted" — **see D-2**; no importer UI) |
| `neb_grade_engine` | NEB Grade & GPA Explainer / नतिजा गणना | T,A,P | Applies and explains the NEB scale (A+ 4.0 ≥90 … D 1.6 ≥35, NG <35; theory pass 35%, practical 40%) — deterministic, model only writes the prose | marks | `table_grid` | – | bulk | 0 | P0 | IMPL (`app/utils/nepal_grading.py` + `bulk_generator._neb_grade/_neb_gpa/_neb_grade_from_gpa`) |
| `nepali_style_editor` | Nepali Register Editor / नेपाली भाषा सम्पादन | T,A | Fixes register, honorifics and formal-letter conventions in Nepali text (the `typography` skill idea, Devanagari edition) | Nepali text, register | `text_block` | – | writer | 2 | P0 | NEW |
| `bs_calendar_planner` | BS Academic Calendar Planner / शैक्षिक पात्रो | A | Builds the year around BS months, Dashain/Tihar/Chhath, exam windows and public holidays | BS year, term structure | `table_grid` | – | canvas+xlsx | 2 | P0 | PART (`app/utils/nepali_date.py` + `_nepali_calendar_page` template + `tools_gen_calendar_templates.py`; no AI planner) |
| `iemis_field_assistant` | IEMIS Field Assistant / IEMIS सहायक | A | Explains each IEMIS field, infers a defensible value from existing records, flags what a human must confirm | record set, cycle | `table_grid` | – | xlsx | 2 | P0 | PART (`models/iemis.py` + `iemis_templates/` + importer plugin; no AI assistant) |
| `see_pattern_analyst` | SEE/NEB Paper Pattern Analyst / प्रश्न ढाँचा विश्लेषण | T,A | Learns the recurring section/marks pattern from past papers and validates a new paper against it | past papers, subject | `table_grid` | Y | report | 3 | P1 | NEW |

## C.15 The 25 highest-priority NEW tools, verbatim ranked (`TC §3.15`)
Ranked by **(evidence of pain × leverage on our SIS data × build cost)**:
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

Fast followers once the four new result templates exist: `deck_from_doc`, `handout_from_deck`, `mcq_generator`, `accommodation_finder`, `exam_timetable`, `attendance_outreach`, `home_support`, `paper_moderation`, `grader_calibration`.

## C.16 claude-skills conventions chosen for adoption (`TC §1.1`–`§1.4`)
Measured baseline from the repo study (`TC §1.1`, commit `d0bc206`): 104 top-level directories, 112 `SKILL.md` files. Frontmatter key frequency: `name` 109 · `description` 109 (**the entire routing signal** — capability + "use when" + literal trigger phrases in one long string) · `triggers` 1 · `trigger` 1 · `args` 1 · `user_invocable` 1 · `allowed-tools` **0** · `version`/`license`/`model` 0. Body size median well under 1,500 words; largest `tdd` at 4,873. Canonical layout `skill-name/{SKILL.md, CHANGELOG.md, scripts/, assets/, references/}`; 38 of 112 reference `references/` (the load-on-demand tier), only ~10 give an explicit "read `references/X.md` before …" instruction.

### The eight conventions identified (`TC §1.2`)
1. **Description is the router** — one long string carrying capability + activation conditions + verbatim trigger phrases ("make a presentation", "create slides"); no separate keyword field.
2. **Progressive disclosure in three tiers** — Tier 0 frontmatter (routing only), Tier 1 SKILL.md body (workflow, decision rules, limits), Tier 2 `references/*.md` + `scripts/*` never read unless the step needs it.
3. **Scripts do the deterministic work; the model does the judgement** — e.g. `pdf-generation` ships `scripts/generate_pdf.py` + `fix_markdown.py`; `whitepaper-audit` runs lane 1 as a stdlib-only Python checker and lane 2 as an LLM judge.
4. **Templates + data contract, not free-form generation** — `presentation-generator` defines a slide JSON schema `{title, footer, slides:[{type, bg, title, bullets, items:[{value,label}], code, language}]}` with eight typed slide partials; `tufte-report` normalizes any input into an intermediate **ReportData** JSON then composes from a typed *block catalog* (sparkline-row, kpi-card, trend-chart, data-table, correlation-matrix, narrative, heatmap, strip-chart).
5. **Hard limits + a scope-negotiation script** — `tufte-report` caps 8 sections, 2 chart types per section, 3 colors per chart, bans pie/donut/3D, publishes LOC/time budgets and a literal negotiation sentence when the user over-asks.
6. **Recorded failure modes travel with the skill** — `tufte-report` lists 8 named pitfalls (pin Chart.js `@4`, never `file://`, never two adjacent charts, wrap tables on mobile, cite computed coefficients); `pdf-generation` names the "Common Claude Code Pattern" (a list directly under a colon line renders inline) and ships `fix_markdown.py` to repair it.
7. **Evals are first-class for judgement tools** — `whitepaper-audit` ships planted-defect cases + a clean control and the rule that the judge must run in a *fresh context* ("never judge a document you wrote in the same context"); `rag-eval` runs a cost-aware grid over a ≥10-pair gold set with a **hard dollar budget cap confirmed before any sweep** (default $2).
8. **Privacy invariants stated as non-negotiable, with local-first tooling** — the `confide` pack redacts PII locally to a "GREEN" copy with reversible sentinels, runs a stats-only corpus audit, red-teams residual re-identification, then rehydrates only on the user's machine; five SKILL.md files carry a literal `## Privacy invariants (do not violate)` header. ASchool's `workbench.pseudonymize`/`de_pseudonymize` pair is the same idea; **the missing pieces are the audit and red-team skills.**

### What we adopt, concretely (`TC §1.4`) — the registry mapping
1. **`AIToolRegistry` gains five columns:** `trigger_phrases` (JSON array — so the AI Teacher chat can route intent to a tool; the analogue of the repo's single long `description`), `budget` (max output size / est. cost tier), `failure_modes` (text), `reference_pack` (folder key), and `output_document_type` (which renderer consumes the result) — **"the last one is what makes Part 4 work."**
2. **Prompt files get mandatory sections:** `## When to use`, `## Workflow`, `## Output` (schema restated), `## Hard limits`, `## Known failure modes`, `## Privacy invariants`.
3. **Reference packs (tier 2)** live under `app/prompts/refs/<pack>/*.md` and are injected *only* when the handler asks — the direct analogue of `references/`. Full tier map: registry row (tier 0) → prompt file `app/prompts/<schema>_{en,ne}.md` (tier 1) → template/reference packs and handlers (tier 2).
4. **Deterministic work moves to handlers:** mark totals, NEB grade/GPA, BS dates, blueprint coverage checks, page counts. "The model never computes a number we can compute."
5. **Judgement tools ship gold sets** under `backend/tests/ai_gold/<tool_key>/` with a fresh-context judge and a per-run cost cap, mirroring `rag-eval` + `whitepaper-audit`.
Additional named ideas carried into the design: doc-type → theme mapping and **two page profiles per document** (print A4 vs phone-readable) from `pdf-generation`; ReportData + block catalog from `tufte-report`; **dual-mode deck ⇄ handout from one JSON** from `present` (plus narration ≠ slide text, 15–30 s/slide, illustrate only 3–5 of 12 slides, explicit anti-"AI-slop" list); brand tokens as a shared context builder rather than copy-paste per tool from `brand-agency`; declarative `platforms.yaml` + `presets.yaml` size/style registry from `gpt-image-2`/`nano-banana` ("we need exactly this for A4/A5/ID-card/slide/16:9"); bidirectional agent↔canvas editing from `sketch` (closest analogue to our Fabric canvas + AI agent); **Devanagari typography as its own skill with a reference doc**, precedent `typography`/`font-features`; standardized export formats (FHIR is to health what IEMIS/QTI/Caliper are to us); type-detect-then-dispatch extractors; synthetic data generation for evals so grading can be tested without touching real student work; the **six-skill release-suite decomposition** (orchestrator + check/prepare/publish/verify/recover sharing a `phase-contracts.md`) as the model for "generate the whole report-card run"; `i18n-studio` as the precedent for keeping 130 tool names × 2 languages in sync; and **bundles as the packaging/pricing unit independent of the tool registry** → ship named bundles "Marking Week", "Report-Card Season", "Parents' Day", "SEE Sprint".

## C.17 Document & presentation generation via our engines (`TC §4`)

### C.17.1 What exists today (`TC §4.1`) — five renderers, three document JSON dialects
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

**Writer block vocabulary (server-side, the one to extend):** `heading`, `paragraph`, `divider`, `spacer`, `table`, `columns`, `signature`, `header_band`, `footer_band`, `subject_rows`, `subject_rows_neb`, `fee_rows` — helpers `_w_*` in `template_engine.py` (L534–563), rendered by `_render_writer_html` (L1865+). Existing writer templates: report card, marksheet, grade sheet, notice, circular, letterhead ×2, fee bill. Canvas templates: ID card ×2, certificates ×4, admit card ×2, report card, marksheet, notice, circular, letterhead ×2, and a generated 12-month `_nepali_calendar_page`.
**Canvas object coverage in `document_renderer._render_object`:** textbox/text/i-text, rect, circle, image (with `data.token` placeholder resolution, `{{qr_code}}` re-encoding via `qrcode`, initials-avatar fallback), line, polygon/path/triangle/group (as inline SVG). Token syntax `{{key}}` / `{key}` resolves against merged `fields` + `school_config`.
**Frontend editors:** `frontend/app/dashboard/designer/editor/page.tsx` → `components/designer/CanvasEditor.tsx` (1,171 LOC, fabric v6) with `LayersPanel`, `PropertiesPanel`, `GraphicsPanel`, `AIChatPanel` (178 LOC) and `lib/designer/{store,elements,snapping,shortcuts,canvasImages,writer-blocks}.ts`; `designer/writer/page.tsx` (8 LOC shim) and `designer/writer2/page.tsx` (971 LOC) on TipTap 3 via `lib/writer/{editorKit,pagination,findReplace,settings,exportDocx}.ts`; `designer/bulk/page.tsx`; `designer/templates/page.tsx`. Export hook `lib/hooks/useExport.ts` already exposes `exportPNG, exportPDF, exportPagesZip, exportPPTX, exportSVG`.
**Two findings that change the recommendation:** (1) `pptxgenjs@^4.0.1` is already a frontend dependency and `useExport.ts` already has `exportPPTXImpl` — it iterates `doc.pages`, calls `pptx.defineLayout({width: w/96, height: h/96})`, renders each page on an offscreen fabric canvas and inserts it as a **full-bleed PNG** via `slide.addImage`. So PPTX *export* exists but every slide is a flat raster: no text, no editable shapes, no speaker notes, and `defineLayout` is called inside the loop without ever being applied via `pptx.layout`. **That is the gap, not the library.** (2) AI already talks to the editors through `POST /design-studio/ai/agent`, returning `{reply, content, actions[]}` with a closed action vocabulary (`add_text, add_heading, replace_selected_text, insert_text_at_cursor, set_background, suggest_layout, replace_document_text, add_bullet_points`) executed client-side, plus `POST /design-studio/ai/suggest`. **This is the seam the tool catalog should reuse rather than inventing a second path.**

### C.17.2 The contract: how an AI tool emits a document (`TC §4.2`)
**Principle:** a workbench tool returns *only* its schema-validated semantic JSON. A separate, deterministic **emitter** converts that JSON into an engine dialect. The model never emits fabric coordinates, HTML or PPTX. "This mirrors the skills-repo split (model plans, `scripts/` renders) and keeps `tool_schemas.py` renderer-agnostic."
Registry additions per tool: `output_document_type` (`writer | canvas | deck | report | bulk | xlsx | none`) and `document_emitter` (function name in a new `app/services/ai/document_emitters.py`).
Pipeline, **appended after step 6.5 of `AIWorkbenchOrchestrator.run`**:
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
**Round trip.** Every generation is persisted as an `AIGeneration` row plus, when the user saves it, a designer document via `DocumentStoreService` (revisions already exist: `/documents/<id>/revisions`, `/documents/revisions/<id>/restore`). The UX contract is: tool result card → **"Open in Writer" / "Open in Designer" / "Open as Deck"** → the teacher edits in the existing editor → export PDF/DOCX/PPTX through the existing routes. **No new export surface.**

### C.17.3 Per-artifact specification (`TC §4.3`)
**Worksheet** (`worksheet`, `practice_set`, `mcq_generator`, `formative_probe`) — `{title, instructions, items[{question, marks, question_type}], total_marks}` → writer blocks `header_band(school) · heading(title) · paragraph(instructions) · columns(Name/Class/Date) · [per item: paragraph("N. question  [marks]") + spacer(answer space by type)] · footer_band`. Answer-space height derives from `question_type` (mcq 0, short 40 px, long 120 px) — deterministic, in the emitter. **Needs:** a `question_block` writer block so answer lines/grids render properly (currently a hack with `spacer`).

**Question paper** (`question_paper`, `question_paper_v2`, `answer_key`, `practical_exam`, `oral_viva`) — same as worksheet plus NEB furniture: the exam header band (school, exam name, subject, grade, **Time** and **Full Marks**), sectioned groups with per-section instructions, and mark totals validated by the handler against `blueprint_builder`. **Needs:** multi-page flow with **"[P.T.O.]" / "Page n of m"** in the writer footer, and a `section_header` block. Answer key is the same document with an `answer` field revealed and a watermark.

**Lesson slide deck** (`slide_deck`, `deck_from_doc`, `workshop_designer`) — new dialect, verbatim:
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
Ten slide types, matching `present`'s discipline (typed slides, notes ≠ slide text, image on 3–5 of 12 slides max). The emitter maps each type to a fabric page at **1280×720 px** using a master-page layout, so the deck immediately renders through `document_to_html`/`document_pdf` and loads in `CanvasEditor` **with no new renderer**. The `notes` field becomes the handout (`handout_from_deck`) and PPTX speaker notes.
**Recommendation on the engine: reuse the designer canvas, and fix the existing PPTX exporter — do not add python-pptx.** Rationale: (a) the canvas renderer already handles Devanagari shaping via WeasyPrint + Pango/HarfBuzz, which is the single hardest requirement and which a server-side pptx writer would not solve for the *PDF*; (b) `pptxgenjs` is already installed and already wired to multi-page docs; (c) one dialect (`pages[]`) then serves screen, PDF, PNG, SVG and PPTX. The fix is to make `exportPPTX` emit **native text boxes, shapes, tables and notes** for objects it can map (textbox → `addText`, rect/circle → `addShape`, table block → `addTable`, image → `addImage`) and fall back to the current raster only for paths/groups; and to call `pptx.defineLayout` + `pptx.layout` **once before the slide loop**. A server-side `python-pptx` path is worth adding **later, only** for Celery-generated bulk decks where no browser is present (`app/tasks/`), sharing the same deck JSON.

**Certificates / ID cards / admit cards** (`event_invite`, merit and participation certificates, transfer/character certificates) — already fully served: canvas templates + `generate_bulk_certificates` / `generate_bulk_id_cards` / `generate_bulk_admit_cards` with QR and photo token resolution. AI's job is only text: recipient wording, citation line, achievement phrasing → merged as `fields`, **no new engine work**.

**Marksheets / report cards** (`remark_sheet`, `remark_writer`, `report_explainer`) — `generate_bulk_marksheets` + writer templates `_writer_report_card`, `_writer_marksheet`, `_writer_grade_sheet` with `subject_rows_neb` already compute NEB grade/GPA. AI writes the remark column only. `remark_sheet` returns `{students:[{student_id, remark, tone}]}` → `table_grid` on screen → merged into the bulk run. **Needs:** an editable-before-merge review step (the "confirm before write" pattern already used by `ai_capture`).

**Newsletters / notices / parent letters** (`class_newsletter`, `school_notice`, `parent_letter`, `emergency_notice`) — writer for text-first (letterhead + `header_band` + BS date line via `report_pdf`), canvas when it must look designed (newsletter, invitation). `section_list` → `heading`+`paragraph` blocks is a trivial emitter. **Needs:** a `two_column` **flowing** text block (current `columns` is a fixed 3-cell flex row, not a flowing column layout) and an `image` block in the writer dialect.

**IEP documents** (`iep_draft`, `iep_progress`, `behaviour_plan`) — writer, because these must be printable, signable and archivable: `heading · table(present levels) · table(goals × baseline × target × review date) · checklist(accommodations) · signature(["Class Teacher","SEN Coordinator","Guardian","Head Teacher"])`. `signature` already exists. **Needs:** a `checkbox_list` block and a **`draft` watermark** until `review_iep` marks it approved (the route pair already exists in `ai_workbench.py`).

**Report-card comment sheets** (`remark_sheet`) — dual output: `xlsx` via openpyxl for offline editing (teachers in low-connectivity schools want this) and a writer table for print.

### C.17.4 Ranked engine upgrades (`TC §4.4`, all 12, effort as given)
| # | Upgrade | Why | Where | Effort |
|---|---|---|---|---|
| 1 | **`deck` template type + deck→canvas emitter + master pages** (1280×720, 10 typed slides, theme tokens) | Unlocks group B and `workshop_designer`; the single biggest catalog gap; reuses the whole existing PDF path | `template_engine.py` (new `_deck_*` builders), new `app/services/ai/document_emitters.py`, `document_renderer` unchanged | L |
| 2 | **Fix `exportPPTX` to native objects + notes**; call `defineLayout`/`layout` once | Raster slides can't be edited by the teacher after export — kills adoption; library already installed | `frontend/lib/hooks/useExport.ts` | M |
| 3 | **Writer block library expansion**: `question_block`, `section_header`, `checkbox_list`, `image`, `page_break`, `two_column_flow`, `answer_space` | Every worksheet/paper/IEP artifact needs at least one of these; today emitters would have to abuse `spacer` | `template_engine.py` `_w_*` + `_render_writer_html`; mirror in `writer_docx.py` and `lib/designer/writer-blocks.ts` | M |
| 4 | **Multi-page flow + running headers/footers in the writer renderer** (`Page n of m`, `[P.T.O.]`, repeat table headers across pages) | Question papers and marksheets are multi-page by nature; `report_pdf.BASE_CSS` already proves the `@page` counter pattern | `template_engine._render_writer_html` + `pdf_css` | M |
| 5 | **`chart_block`** — server SVG (deterministic, no JS) + Recharts on screen | 11 analytics/reporting tools need a chart; `tufte-report`'s lesson: no pie/donut/3D, caption mandatory | new `app/services/designer/charts.py`; `chart_panel` template in frontend | M |
| 6 | **`table_block` upgrades**: column widths, alignment, merged cells, zebra rows, totals row, page-break-safe | `table_grid` is the most reused new result template (marks, timetables, rosters, item analysis) | `template_engine` + `writer_docx._render_table` | S |
| 7 | **Nepali typography pack** — Devanagari line-breaking rules, matra-safe font sizing, numeral locale (०-९), font fallback chain, EN/NE mixed-run kerning; as a `references/` doc plus CSS | Everything Nepali currently relies on `-weasy-hyphens:none` + one font stack; `typography`/`font-features` are the precedent for treating this as its own concern | `pdf_css.py`, `app/static/fonts`, new `docs/nepali_typography.md` | M |
| 8 | **Result-template → engine bridge in the frontend**: "Open in Writer / Designer / Deck" on every tool card, powered by `output_document_type` | Without this the catalog produces text the teacher must retype; **it is the difference between a demo and a product** | `frontend/app/dashboard/ai-tools/**`, reuse `AIChatPanel` action vocabulary | M |
| 9 | **Server-side deck rasterization for Celery** (headless render of deck pages for scheduled/bulk decks, or `python-pptx` sharing the deck JSON) | Only needed for background generation; browser path covers the interactive case | `app/tasks/`, optional new dep | M |
| 10 | **Master pages / school brand tokens as a shared context builder** (logo, colors, letterhead, signature blocks resolved once) | The `brand-agency` pattern; today each template hardcodes `#1e40af`-style values | new `context_branding` in `tool_handlers.py`; `template_folders.deep_merge` already supports overlay | S |
| 11 | **Animation / transition support in decks** | Genuinely useful in class, but PDF ignores it and PPTX support is partial; last because value/effort is worst | deck dialect `transition` field, `exportPPTX` | S |
| 12 | **Thumbnail generation for AI-produced documents** (reuse `thumbnails.py`'s WeasyPrint→pdftoppm→PNG chain for the AI library grid) | Polish; the library list at `/ai/library` currently has no previews | `thumbnails.py`, `ai_workbench.py` library routes | S |

Ordering rationale (verbatim): 1–4 are prerequisites for the P0 tools in groups A–D (worksheets, papers, decks, marksheets). 5–8 unblock groups G and the whole "don't retype it" promise. 9–12 are polish or background-only concerns.

### C.17.5 Implementation sequence — three slices (`TC §4.5`)
- **Slice 1 — registry-first, zero new engines.** Migrate the unmounted services and the bespoke routes into `AIToolRegistry` (row + schema + EN/NE prompt + handler), add the registry columns from `TC §1.4`, ship the `table_grid` and `checklist` result templates, and add the `writer` emitter for the artifacts the existing block vocabulary already supports (lesson plan, study guide, differentiation, remarks, letters, notices). **"~40 tools become real with no renderer work."**
- **Slice 2 — writer/table/paper depth.** Upgrades 3, 4, 6, 10; then `blueprint_builder`, `answer_key`, `paper_moderation`, `remark_sheet`, `item_analysis`, `annual_scheme`, plus the `xlsx` emitter.
- **Slice 3 — decks and charts.** Upgrades 1, 2, 5, 8; then `slide_deck`, `deck_from_doc`, `handout_from_deck`, `workshop_designer`, `class_performance`, `cohort_trend`, `attendance_insight`.

### C.17.6 Open questions flagged for the product owner (`TC §4.6`)
1. Does `ai_suite` at NPR 399/month absorb 153 tools, or does the AI Teacher plugin become a **second paid bundle** — and are the cost-tier-4 tools (batch grading, handwriting OCR, voice) metered like Kahoot's "pages of source material" rather than per generation?
2. Do we ship `deck` inside `design_studio` (teachers already know that surface) or as a new dashboard route under AI Tools?
3. Which mother tongues do we commit to for `multilingual_support`, and who validates the output? Model quality for Maithili/Bhojpuri/Newar/Tamang is **unverified**.
4. Is `grader_calibration` acceptable to schools, given it stores a model of a named teacher's marking behaviour? This needs a policy decision alongside `GuardianAIConsent`.
**Cross-report conflict:** `AT §D.1` already prices `ai_teacher` at NPR 1499/14990 as a separate premium plugin depending on `ai_suite` — i.e. it answers Q1 one way while `TC §4.6` still asks it. **Not settled between the two reports.**

### C.17.7 Market/pricing context the catalog was built against (`TC §2`, condensed — all external figures per the report)
Workload evidence (primary sources): Gallup / Walton Family Foundation, 24 Jun 2025, n=2,232 US K-12 teachers — teachers using AI weekly save **5.9 h/week ≈ six weeks/year**; top uses "preparing to teach" 37%, worksheets/activities 33%, adapting materials 28%; perceived quality gain **57% on grading and feedback** vs **74% on administrative work**. Pew, 4 Apr 2024, n=2,531 — **84%** say contracted hours don't cover grading/planning/paperwork/email; 77% frequently stressed; 58% handle behavioural issues daily; 47% call disengagement a major problem. Vendor-claimed savings (Class Companion 12 h/wk, MagicSchool 7+ h/wk, Nolej 27 days/yr, Twee 5 h/wk, Brisk 2.2M hours) are marked **unverified**. **Nepal-specific workload data: not verified** — NEB publishes exam directives but no time-use statistics; UNICEF Nepal carries pupil-side figures only (97% primary NER; 770,000 out-of-school 5–12s; ~50% of grade 3/5/8 pupils at benchmark in Nepali and maths); OECD TALIS and RAND returned 403. **"Any Nepal workload claim in the product should be sourced from our own tenant telemetry."**
Competitor tool-count benchmark: MagicSchool advertises 80+ teacher and 50+ student tools (~130); pricing Free $0 / **Plus $8.33/user/mo annual ($99.96/yr) or $12.99/mo** / Enterprise custom. Brisk is a Chrome/Edge extension (Create Content 30+, Give Feedback 5+, Change Level 50+ languages, Student Activities 14); Free 20+ tools / Premium 35+ / Intelligence (curriculum-grounded). Diffit sets MTSS tier, challenge level, language, scaffolds, standards, DOK and keeps exports editable; free tier keeps 90 days of history; premium is enrolment-tiered flat rate. Kahoot's ladder (Go free / Bronze $3 / Silver $7 / Gold $12 / One $19 per teacher per month annual) **meters AI by pages of source material**. Formative: Classroom $249/yr per teacher, Small School $3,125/yr. Gradescope: Basic free; Institutional adds AI-Powered Grading (answer groups) + roster matching. Google Workspace for Education: Fundamentals no-cost, **Education Plus $6.00/user/yr**; Deep Research capped 5/month; Gems as teacher-authored mini-agents. Teachmint (the only regional AI competitor) ships EduAI on hardware, LAN-only, English/Hindi-first. Gamma, Canva, Quizizz/Wayground, Eduaide, Edexia all returned 403/404 — **their figures are unverified**.
Strategic read (verbatim points): (1) nobody in Nepal ships AI teaching tools — Veda, Paathshala and e-School have zero; (2) the Western leaders are **content generators without a school system underneath** — no marks ledger, no attendance, no fee records, no report cards, whereas ASchool has all of it, "tools grounded in *this student's actual marks and attendance*, not in pasted text"; (3) deck generation, curriculum grounding and batch/whole-class grading are the three capabilities everyone is racing on — we have partial grounding (`context_curriculum`), **no deck engine**, and **no batch grading UX**; (4) `ai_suite` at NPR 399/mo, 3,990/yr per school is an order of magnitude below Western per-teacher pricing, "which is why every tool below carries a cost tier."

---

# D. CONTRADICTIONS / STALENESS vs the actual repo

Verified 2026-09-05 against `/home/bishal-regmi/Desktop/ASchool/backend` and `frontend`. Method: targeted `Read`/grep on the files the reports cite. Citations into ASchool held up in every case I checked — `workbench.py`, `token_hub.py`, `realtime.py`, `rate_limiter.py`, `loader.py`, `plugins.py`, `models/{base,curriculum,lms,ai_workbench,ai_token,adaptive_learning,plugin,school,user,file}.py`, `template_engine.py`, `document_renderer.py`, `bulk_generator.py`, `writer_docx.py`, `thumbnails.py`, `report_pdf.py`, `nepal_grading.py`, `useExport.ts`, `plugins.tsx`, `plugin_gate.dart`, `design_studio.py`, `ai_tools.py`, `ai_capture.py`, `ai_tutor.py`, `ai_extensions.py`. What follows is only what does **not** hold.

## D-1. "10 registry rows in `workbench_seed.py`" is imprecise (`TC §3.14`)
The 10 tools are correct, but they are a `TOOLS = [...]` list of dicts at `backend/app/services/ai/workbench_seed.py:16-205`, materialised at runtime by `seed_workbench_tools()` (`:206-259`); the file contains only 4 literal `tool_key=` constructor occurrences (the rest are dict keys). `tool_schemas.py` does hold exactly those 10 schema keys (`lesson_plan, worksheet, exit_ticket, rubric, parent_email, differentiation, study_guide, flashcards, writing_feedback, fixture_test`) and `app/prompts/` holds exactly the 20 EN/NE files. **Impact:** none functionally; an implementer grepping for `tool_key=` will undercount.

## D-2. "13 written-but-unmounted services" is now **11** (`TC §3.14`, and the `curriculum_mapper` PART note in `TC §3.13`)
Grep across `backend/app` for importers outside each module itself:
- **`curriculum_seed` is mounted.** `app/__init__.py:558` does `from app.services.ai.curriculum_seed import seed_curriculum` and calls it at boot. The report lists it as unmounted, and `TC §3.13` repeats this in `curriculum_mapper`'s status ("`curriculum_seed.py` + `models/curriculum.py` exist; **unmounted**, no importer UI"). Seeding runs; what is actually missing is the importer route/UI.
- **`rag` is reachable.** `app/services/ai/extensions.py:45` imports `RAGService` inside `seed_pd_framework`, and `extensions.py` is itself mounted: `app/api/v1/ai_extensions.py:6` imports it and `:13` calls `ext.register_pd_routes(extensions_bp)` on blueprint `/ai/ext`; `app/__init__.py:565` also imports `seed_pd_framework`. `workbench.py:382` additionally imports `caliper_event` from it.
- **Confirmed unmounted (11):** `plagiarism, benchmarking_ai, fee_predictor, risk_detector, wellbeing_ai, content_gen, attendance_ai, sentiment, social_ai, translator, report_remarks` — zero importers anywhere outside their own files. (The only greps that matched for `sentiment` and `social_ai` were unrelated: `content_gen.py:60` has its own `analyze_sentiment` method, and `social_ai_config` is a `School` column at `models/school.py:117`.)
**Impact:** Slice 1's "cheapest wins" list should be 11 services, and the `curriculum_mapper` work item is UI-only, not service-mounting.

## D-3. No `ai_teacher` plugin, no models — everything in `AT §B`–`§D` is greenfield
`backend/app/plugins/modules/` contains 41 modules (`academics, admission, ai_adaptive_learning, ai_suite, alumni, assignments, attendance, basic_reports, basic_website, biometric, compliance, conferences, design_studio, disaster_management, dismissal, elibrary, emergency, exams, fees, file_management, gamification, gps_tracking, health_records, hr_payroll, iemis_importer, incident_management, incidents, inventory, library_management, lms, multi_branch, notices, sms_notifications, social_ads, student_portfolio, timetable, visitor_management, website_builder, wellbeing, whatsapp_bot, white_label`) — **`ai_teacher` is not among them**, and neither `app/models/ai_teacher.py` nor `app/models/teaching_content.py` exists. The `ai_adaptive_learning` hooks pattern the report copies is real and matches its citation (`app/plugins/modules/ai_adaptive_learning/hooks.py:23-30` — `_owned_models()` → `LearningPath, MasteryRecord`, `__table__.create(db.engine, checkfirst=True)`, deactivate is a documented no-op).

## D-4. `teaching_media.file_id REFERENCES files(id)` will fail — there is no `files` table
`backend/app/models/file.py` defines `file_folders` (`:12`) and **`managed_files`** (`:46`). Both the DDL (`AT §C.5`) and the SQLAlchemy sketch (`AT §C.8`, `ForeignKey("files.id")`) must be retargeted to `managed_files.id`. Every other table name the reports cite **is** correct and verified: `topics` (`models/lms.py:64`), `schools` (`models/school.py:24`), `users` (`models/user.py:23`), `ai_generations` (`models/ai_workbench.py:28`), `curriculum_units` (`models/curriculum.py:48`), `learning_outcomes` (`:75`), `subject_offerings` (`:100`), `plugins` (`models/plugin.py:26`), `school_plugins` (`:82`). `gen_random_uuid()` as a server default is the established pattern (`models/base.py:21`, and several migrations).

## D-5. The six new registry columns the whole design depends on do not exist
`AIToolRegistry` (`backend/app/models/ai_workbench.py:82-113`) has exactly: `tool_key, name, name_ne, category, description, description_ne, min_plan_tier, roles_allowed, output_schema_name, prompt_file, handler_name, context_builder, status, is_fixture`. Grep found **zero** occurrences of `trigger_phrases`, `budget`, `failure_modes`, `reference_pack`, `output_document_type` or `document_emitter` anywhere in `backend/app`. **Impact:** `TC §1.4` items 1 and the entire `TC §4.2` emitter contract are blocked until a migration adds these; `output_document_type` is the specific prerequisite for the "Open in Writer/Designer/Deck" bridge (upgrade #8).

## D-6. `min_plan_tier` is not a tier comparison, and `ai_suite` is a pure licensing gate
`_require_plan_tier` (`backend/app/services/ai/workbench.py:277-286`) only checks that the literal string `"ai_suite"` is present in `g.installed_plugins` when `tier != "free"`; it never compares the registry's `min_plan_tier` value to anything. Any non-free tier string resolves to the same check. Separately, `app/plugins/modules/ai_suite/manifest.yaml` documents itself as a **BUNDLE PLUGIN / licensing gate with no `api_blueprint`**: seven plugins (`ai_grading, ai_tutor, ai_tools, ai_adaptive_learning, ai_insights, benchmarking, advanced_analytics`) alias to it via `PLUGIN_SLUG_ALIASES` (`app/plugins/decorators.py:36-43`), and `_acceptable_plugin_slugs` (`:56-79`) is deliberately **single-hop, non-transitive** so an alias can never unlock a third plugin. `academics/manifest.yaml` is `price_monthly: 0, is_free: true`. **Impact:** `AT §B.2`'s `min_plan_tier="ai_suite"` works but gives no tier granularity; `depends_on: [ai_suite, academics]` adds no second charge beyond ai_suite; and if `ai_teacher` is meant to be gated *separately* from ai_suite, that must be enforced by `@plugin_required("ai_teacher")` alone (which it is) — **do not** add an `ai_teacher → ai_suite` alias, or an ai_suite install would unlock AI Teacher routes.

## D-7. The consent gate is narrower than `AT §B.3` step 1 implies
`workbench.py:131-153`: when `g.role == "student"` consent is required for **any** tool and is genuinely unbypassable (it resolves the student's own row, overwrites `payload["student_id"]`, then calls `_require_guardian_consent`) — the comment even records that "the old category-based check was bypassable by omitting student_id". But when a **teacher/admin** passes `student_id`, the gate is `elif student_id and tool.category in ("tutor", "student")`. The AI Teacher tool row is registered `category="tutor"` (`AT §B.2` step 3 / `AT §D.3`), so teacher-launched lessons do hit the gate — **but only by virtue of that string**. Recommendation for the implementer: assert consent explicitly in the plugin's own create gate rather than relying on the registry category.

## D-8. `realtime.py` has no lesson layer at all
`backend/app/realtime.py` is **159 lines total**. `_extract_token` (`:40-50`) and the `connect` handler (`:53+`) match the report's citation, `_sessions` is at `:33`, and the only room helper is `_room(school_id) -> f"school-{school_id}"` (`:36-37`). There is no `join_lesson`, no per-entity room, no ack/`seq` mechanism. **Impact:** `AT §B.5`'s lesson layer is new code, not an extension of an existing lesson room; the `seq`-based backpressure is also entirely new.

## D-9. A third AI route surface exists that neither report inventories
Besides `app/api/v1/ai_tools.py` and `ai_workbench.py`, `backend/app/api/v1/design_studio.py` already hosts `/ai/question-paper` (`:585`), `/ai/lesson-plan` (`:607`), `/ai/insights` (`:627`), `/ai/risk-students` (`:640`), `/ai/homework-help` (`:653`), `/ai/suggest` (`:753`) and `/ai/agent` (`:848`). Several of these duplicate `ai_tools.py` routes (`/question-paper` `:16`, `/lesson-plan` `:52`, `/homework-help` `:158`, `/insights/*` `:180-208`). **Impact:** the Slice-1 migration inventory must include `design_studio.py`, or the same tool will exist in the registry and in two bespoke blueprints. (`TC §4.1` finding 2's action vocabulary is exact — the 8 actions are at `design_studio.py:828-835`.)

## D-10. `TC §4.1` finding 1 on `exportPPTX` is confirmed, still true
`frontend/lib/hooks/useExport.ts` — `exportPPTXImpl` at `:290`; inside the `for (const page of pages)` loop it calls `pptx.addSlide()` then `pptx.defineLayout({ name: "PAGE", width: w/96, height: h/96 })` at `:314` and **never calls `pptx.layout`**; `:340` inserts one full-bleed PNG via `slide.addImage({ data: dataUrl, x:0, y:0, w: w/96, h: h/96 })`. The hook returns `{ exportPNG, exportPDF, exportPagesZip, exportPPTX, exportSVG }`. `pptxgenjs` is `"^4.0.1"` at `frontend/package.json:62`. **Upgrade #2 is correctly scoped and unblocked.**

## D-11. Two cited paths are at the repo root, not under `backend/`
`TC §3.9` (`iemis_readiness`) and `TC §3.13` (`iemis_field_assistant`, `bs_calendar_planner`) cite `iemis_templates/` and `tools_gen_calendar_templates.py` in a way that reads as backend-relative; both live at `/home/bishal-regmi/Desktop/ASchool/iemis_templates` and `/home/bishal-regmi/Desktop/ASchool/tools_gen_calendar_templates.py`. `app/models/iemis.py` exists as claimed, and `_nepali_calendar_page` is real at `backend/app/services/designer/template_engine.py:866` (used for the 12 month pages at `:924-925`).

## D-12. Internal count inconsistency in the schema section
`AT §C.8` says the Alembic revision creates "the eleven tables"; the enumerated DDL in `AT §C.4`–`§C.5` defines **twelve** (`teaching_sections, teaching_section_versions, teaching_section_outcomes, teaching_notes, teaching_examples, teaching_misconceptions, teaching_formulas, teaching_exam_tips, teaching_key_terms, teaching_media, teaching_content_snapshots, teaching_content_reviews`), and `hooks.py`'s `_owned_models()` in `AT §D.3` also lists twelve teaching-content models. The DDL/hook list is authoritative.

## D-13. `services/ai` module count
`TC §3.14` says "`app/services/ai/*.py` (30 modules)"; the directory holds **31** `.py` files, i.e. 30 excluding `__init__.py`. Harmless; recorded for precision.

## D-14. Confirmed-accurate claims worth recording (they anchor the plan)
- `/remarks` (`app/api/v1/ai_tools.py:133-156`) does delegate to `QuestionPaperService.generate_remark` (`app/services/ai/question_paper.py:116`), requires `student_name/marks/total/percentage` in the body, is gated `@plugin_required("ai_tools")` (aliased to `ai_suite`), and has **no registry row** — exactly as `TC §3.4` states.
- `auto_grader` is reached only from `app/api/v1/assignments.py:323`; `admission_bot` is referenced only by `app/plugins/modules/admission/manifest.yaml:14`; `qti_export` is at `app/api/v1/ai_extensions.py:18-38`.
- `wellbeing_ai.py` really is unused by `app/api/v1/wellbeing.py` (which imports `models/wellbeing.py` directly), and `benchmarking_ai.py` really is unused by `app/api/v1/benchmarking.py` (which imports `api/v1/analytics` helpers) — both PART notes are correct.
- `app/api/v1/adaptive_learning.py` is a one-line re-export of `app.plugins.modules.ai_adaptive_learning.routes` — the plugin, not the api module, owns the blueprint.
- The `writing_feedback` "no `revised_text`" invariant is a real CI gate documented in `app/services/ai/tool_schemas.py:4` and `:147`.
- The `status="ga"` requires-nutrition-facts rule is a **test assertion**, not a DB constraint: `backend/tests/test_ai_workbench.py:214` (`assert facts is not None, f"{row.tool_key} is ga without nutrition facts"`). `AINutritionFacts` columns match what `AT §D.3` writes (`models/ai_workbench.py:50-81`).
- `SchoolAIToolSettings` is table `ai_tool_settings` with `enabled` as the kill switch plus `field_overrides` and `custom_prompt_suffix` (`models/ai_workbench.py:115-127`).
- `workbench.py`'s pipeline docstring matches the report's step numbering, including "Adding tool #66 = one prompt file + one handler + one registry row — no new routes", and step 6.5 handler post-processing is at `:235-241` with moderation at `:243-252` — so `TC §4.2`'s "appended after step 6.5" hook point is real.
- `tool_handlers.py` contains `context_curriculum` (`:13`), `CurriculumUnitActive` (`:56`), three handlers (`handle_lesson_plan` `:65`, `handle_worksheet` `:73`, `handle_flashcards` `:79`), `handle_fixture_test` (`:85`) and `context_none` (`:92`) — i.e. "3 handlers + 1 context builder" undercounts slightly (4 handlers incl. the fixture).
- `GROQ_API_KEY` on our side is env-read with an **empty** default (`backend/config.py:109`); there is no committed key. `AT §B.2`'s reference to `config.py:109` as the secret-store location is accurate.
- Engine LOC claims verified: `template_engine.py` 2,272 · `document_renderer.py` 326 · `bulk_generator.py` 875 · `writer_docx.py` 495 · `thumbnails.py` 503 · `CanvasEditor.tsx` 1,171 · `AIChatPanel.tsx` 178 · `designer/writer/page.tsx` 8 · `designer/writer2/page.tsx` 971 · `plugins.tsx` 353 with `PluginGate` exported at `:253`. `_render_writer_html` is at `template_engine.py:1865`; the `_w_*` helpers at `:534-560`; `_render_object` at `document_renderer.py:75`; `_neb_grade/_neb_gpa/_neb_grade_from_gpa` at `bulk_generator.py:851/859/867` with the four `generate_bulk_*` methods at `:87/305/361/417` and `generate_attendance_ledger` at `:641`.

















