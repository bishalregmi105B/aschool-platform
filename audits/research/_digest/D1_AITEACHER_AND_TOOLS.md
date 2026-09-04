# D1 — AI TEACHER PLUGIN + AI TOOL CATALOG (implementation digest)

Digested in full: `ATEACHER_PLUGIN_INTEGRATION.md` (1767 ln → `AT`) and `AI_TOOL_CATALOG_AND_SKILLS.md`
(1074 ln → `TC`), both in `audits/research/`. Cited `AT §B.3` / `TC §4.4` style; file:line refs are the
reports' own. Section D = where they no longer match the repo (checked 2026-09-05).

# A. AI TEACHER PLUGIN — LOCKED CONTRACT

## A.1 Topology: separate service, NOT an in-process engine (`AT` preamble, `AT §B.1`)
The teaching engine stays its own Flask+SocketIO deployable with **its own DB and Redis**. ASchool adds
an in-process blueprint only as broker/webhook/content-read (`app/plugins/modules/ai_teacher/routes.py`,
mounted at `/api/v1` by `loader.py:246-248`). Why: (1) service tables must never enter ASchool Postgres —
Ashlya leaked 5 `ateacher_*` tables into the host schema (`live_schema_dump_2026_08_05.sql:360-442`) with
nothing reading them, "schema bleed, not an integration path" (`AT §A.1`); (2) the service keeps lesson
state in-process dicts (`events.py:29-32,174-179`) forcing `gunicorn -w 1` (`render.yaml:8`) — vendoring
that would impose single-worker on all of ASchool; (3) prompts, board grammar, personas, TTS/STT are the
service's IP. Review rule (`AT §E.2` risk 11): **any PR adding prompt text or board-grammar parsing to
ASchool has crossed the line.** S2S endpoints reachable only from the ASchool backend network; browsers
reach the service only for socket+media; player on its own origin with CSP `frame-src` pinned. Service is
`-w N` capable or we accept `-w 1` per school-shard and say so in the runbook.
**Hard scope:** no OCR, no vision ingestion, no PDF/scan pipeline anywhere (`AT` preamble, `AT §C.1`);
Ashlya's ML Kit camera path (`ateacher_bridge_screen.dart:239-341`) is deliberately dropped.

## A.2 Endpoints the plugin exposes (`AT §B.3`, `AT §D.4`)
`ai_teacher_bp`, `url_prefix="/ai-teacher"`. User-facing stack: `@jwt_required()` → `@school_required` →
`@plugin_required("ai_teacher")` → `@role_required(...)` → `@ai_rate_limit(...)`.
- `GET /personas` — persona passthrough + per-school allow-list, cached 10 min
- `GET /launcher` — grades/subjects/units/sections with **published** content + student's due-for-review keys
- `POST /lessons` — broker a lesson (A.3); consent+tier+kill-switch+grades+hours+quota+concurrency, `ai_rate_limit(6,86400)`
- `GET /lessons?student_id&status&from&to` — history; student=own, teacher=their classes, admin=school
- `GET /lessons/<id>` — lesson + chapters + cost + grounding refs
- `GET /lessons/<id>/messages` — transcript, retention-aware · `GET /lessons/<id>/summary` — summary + per-outcome mastery
- `POST /lessons/<id>/stop` — end + tell the service · `POST /lessons/<id>/report` — safety report → `ModerationFlag`
- `GET /lessons/<id>/export.pdf` — Celery-rendered board/notes PDF into file storage
- `GET /mastery?student_id&subject_code` — rollup by outcome · `GET /usage` — minutes/lessons/tokens/NPR/headroom (school_admin)
- `POST /service-key/rotate` — rotate S2S secret, 24 h overlap (school_admin/superadmin)
- `GET /health` — reachability, last successful call, breaker state
- content authoring (`content_api.py`, same blueprint, `role_required("school_admin","curriculum_admin","superadmin")`):
  `GET/POST /content/sections`, `GET/PUT/DELETE /content/sections/<id>`; `POST …/sections/<id>/versions`,
  `PUT …/versions/<vid>`; `POST …/versions/<vid>/{submit,approve,reject,publish,archive,revert}` (each writes
  a `teaching_content_reviews` row); `GET/PUT/DELETE …/versions/<vid>/{notes,examples,misconceptions,formulas,
  exam-tips,key-terms,media,outcomes}`; `POST …/sections/<id>/fork`; `GET …/versions/<vid>/preview?language=`
  (exactly what the AI receives)
- S2S, **key+HMAC, no JWT**: `GET /content/section/<id>` (A.9 read API), `GET /content/units/<id>/sections`,
  `POST /webhooks/lesson-event` (+ replay cache). Plus `GET /content/search?grade=&subject=&q=` (launcher, JWT).
Celery `tasks.py`: `reconcile_lessons` 10 min · `purge_transcripts` nightly · `rollup_usage` hourly →
`AIToolAnalyticsDaily` · `compute_due_reviews` nightly per `mastery_key` · `export_lesson_pdf` on demand.

## A.3 Session-brokering sequence, host → service → client (`AT §B.3`)
`POST /api/v1/ai-teacher/lessons` body: `persona_slug?`, `topic?`, `content_ref? {section_id|chapter_id|
outcome_ids[]}` (preferred), `level?`, `language? en|ne|mixed`, `voice?`, `student_id?` (required when a
teacher launches for a student), `max_minutes?` (clamped to `lesson_max_minutes`).
201: `lesson_id` (**ASchool UUID, the only id clients use**), `player_url` (`…/embed?lesson=<jwt>`, jwt in the
**fragment**), `socket_room` (`lesson:<uuid>`), `expires_at`, `content_snapshot_id`,
`persona{slug,name,accent,voice,language}`, `estimated_cost_npr` (shown before start).
Errors: 402 tier · 403 consent/kill-switch/role · 409 concurrency · 422 not published · 429 rate/quota · 503 down.

Ordering is load-bearing — **nothing is spent before the gates pass**:
1. **Gates first** — `SchoolAIToolSettings.enabled` → 403; `_require_plan_tier("ai_suite")` → 402; role;
   `_require_guardian_consent(student_id)` for student subjects (`workbench.py:121-153`, `GuardianAIConsent`
   `models/ai_workbench.py:217-232`); grade allow-list; concurrency per school and per student.
2. **Resolve content, not prose** — read the published section (school override → platform fallback), build a
   **structured** context document in the requested language with EN fallback, record `content_snapshot_id` =
   `teaching_section_versions.id`. Free-topic mode (config `allow_free_topic`) ⇒ empty context, `grounded=false`.
3. **Sanitize** — `detect_injection()` (`workbench.py:71-78`), `pseudonymize()` names (`:30-51`), wrap in
   `<source id="…" trust="curriculum">…</source>` and instruct the service to treat it as data.
4. **Budget** — estimate (chapters × per-chapter tokens), check `config.monthly_cost_ceiling_npr` + `AISchoolQuota`
   (`models/ai_token.py:8-17`), **reserve**.
5. **Create ASchool's row first** — `ai_teacher_lessons` `status=pending`; our UUID is canonical (fixes Ashlya's
   B-06 session-id divergence).
6. **Then call the service S2S** — `POST {svc}/api/auth/token` with `X-ASchool-Key`, `X-ASchool-Signature =
   hmac_sha256(secret, ts+body)`, `X-ASchool-Timestamp`, body `{tenant_id, user_ref, display_name}` where
   `user_ref = hmac(school_secret, user_id)` and **no email**; then `POST {svc}/api/session/create` with
   `Authorization: Bearer <svc token>` and `{external_lesson_id, topic, level, language, voice, persona_slug,
   context_document, callback_url, callback_secret_id, max_minutes}`.
7. **Mint OUR player token** (A.4), store the service `session_id`, flip to `ready`, return.
Client leg: iframe/WebView loads `player_base_url`, token in fragment (or POST-then-httpOnly-cookie on the player
origin), socket connects to ASchool `realtime.py` with JWT, emits `join_lesson {lesson_id}`. Ashlya's equivalent
end-to-end diagram for contrast: `AT §A.11` (and its terminal line "nothing flows back to the host. Ever.").

## A.4 JWT + socket auth with school scoping (`AT §B.5`)
**Player token:** short-lived RS256/HS256 JWT, `aud:"ai-teacher-player"`, `ttl ≤ 15 min`, single-use `jti`,
claims `{sub, school_id, lesson_id, service_session_id, role, scope:["lesson:play"], exp}`. Delivered in the URL
**fragment** (`#t=…`) or POSTed to the player origin which swaps it for an httpOnly cookie there. `?token=` is
**banned** (access logs, history, `Referer`, WebView logs).
**Socket:** no token, no connection. Reuse ASchool's handshake verbatim (`app/realtime.py:40-100`): token from
socket.io `auth`, `Authorization` header, or httpOnly cookie → `decode_token` → live non-deleted active user →
`iat` vs `tokens_invalid_before`. Then `join_lesson`: load `AITeacherLesson` by `(id, school_id=st["school_id"],
is_deleted=False)`; absent → "Unknown lesson" (no leak); `st["role"]=="student"` and
`lesson.student_user_id != st["user_id"]` → "Forbidden"; else `join_room(f"lesson:{lesson.id}")`.
**Every later event re-derives the lesson from `_sessions[sid]`, never from the payload** — killing
"knowing a session_id is authorization" (`events.py:203-254`), the `get_active_session()` cross-user fallback
(`:448-452`) and unauthenticated `restore_session` (`:753-798`). Teachers may join their own class read-only;
parents never join live (summary only). Server→client event names stay the ones the vendor player speaks
(`lesson_status, lesson_plan, lesson_step, chapter_complete, concept_mastery, lesson_summary, board_snapshot,
error`) **plus `seq` on every `lesson_step`** for ack-based backpressure.

## A.5 Provisioning (`AT §B.2`)
Paid plugin, `depends_on: [ai_suite, academics]`. Install → `POST /plugins/install` →
`_run_plugin_hook(slug,"activate")` (`app/api/v1/plugins.py:435`) → `hooks.activate`: tables via
`__table__.create(checkfirst=True)`; mint `key_id = "sch_"+school_id.hex[:12]`, `secret =
secrets.token_urlsafe(48)`, store `key_id + sha256(secret) + created_at + rotated_at` in
`ai_teacher_service_keys`; plaintext secret goes once to the platform secret store or the service's
`POST /admin/tenants` (**the single endpoint we ask the service to add**) then is dropped — never in
`SchoolPlugin.config`, never returned by any API. Deactivate = flip `SchoolPlugin.active`
(`plugins.py:780-810`) **plus** tenant-disable so in-flight lessons stop; uninstall keeps lesson history and
revokes the key. Rotation issues a new secret with a 24 h dual-accept window, then hard-revokes.
Why per-school: Ashlya's single static key (`config.py:39`, plain compare `routes/auth.py:47-55`) lets a leak
mint a token for **any** user of any tenant; per-school caps blast radius to one tenant, makes rotation one
row, and lets the service attribute cost/rate limits per school without trusting the body.

## A.6 Ownership: ASchool vs service (`AT §B.4`)
ASchool owns: lesson existence/who/when/what/duration (`ai_teacher_lessons`); grounding
(`lesson.content_snapshot_id`); chapter outcomes + mastery (`ai_teacher_lesson_chapters`,
`ai_teacher_mastery` keyed **student_id + concept_key** so it survives lessons and feeds report cards);
transcript **mirror** (`ai_teacher_messages`, service is master, retention = `transcript_retention_days`);
cost/tokens/provider (`ai_usage_logs` via token_hub + `lesson.cost_npr`); xAPI events
(`ai_teacher_learning_events`); safety flags (existing `ModerationFlag`, `models/ai_workbench.py:235-249`).
Service owns: persona prompt text (4 columns, prompt IP — ASchool caches display fields only);
board/whiteboard state, slide snapshots, SVG (ASchool stores at most a per-chapter PNG/PDF export);
streaming/LLM orchestration, TTS/STT (ASchool never proxies audio bytes); the 24 h service token (never
leaves the ASchool backend).
Rule of thumb, verbatim: anything a school would put on a report card, an audit, an invoice or a DPDP
subject-access request lives in ASchool; anything about how the lesson was rendered lives in the service.

**Results come home** (`AT §B.6`) via `POST /api/v1/ai-teacher/webhooks/lesson-event`: no JWT,
`X-ASchool-Key` + HMAC over `timestamp + raw body`, ±300 s window, replay cache on `event_id`, idempotent by
`(lesson_id, event_id)`. Types: `lesson.started | chapter.completed | question.asked | mastery.updated |
lesson.summary | lesson.ended | lesson.error | usage.reported`. Handlers: started → status/started_at;
chapter.completed → chapter row + outcome links; question.asked → message mirror + `moderate()` (critical
self-harm → `ModerationFlag` + existing wellbeing escalation, `workbench.py:243-260`); mastery.updated →
upsert `ai_teacher_mastery` (feeds adaptive learning + report cards); summary → text + evidence; ended →
duration/chapters; error → honest failure record; usage.reported → `AIUsageLog` +
`reconcile_quota_reservation` (`token_hub.py:413-426`). **Belt and braces:** Celery
`ai_teacher.reconcile_lessons` every 10 min polls `GET {svc}/api/session/<id>` for lessons stuck in
`teaching`/`ready` past `max_minutes + 5` and closes them `abandoned`. Webhooks are best-effort; the poller
is the source of eventual truth.

## A.7 Guardrails (`AT §B.7`) + rate limits (`AT §B.9`)
- **Plugin gating** `@plugin_required("ai_teacher")` + `depends_on: [ai_suite]`; web `<PluginGate
  slug="ai_teacher">` (`frontend/lib/plugins.tsx:253-352`); Flutter `PluginGate` from `aschool_shared`
- **Tier** `_require_plan_tier("ai_suite")` → 402 (`workbench.py:288-297`)
- **Kill switch** `SchoolAIToolSettings(tool_key="ai_teacher_lesson").enabled=false` → 403 in one request
  (`models/ai_workbench.py:115-127`) + a platform-wide env kill switch for incident response
- **Consent** `GuardianAIConsent(scope="tutor")` before any student-subject lesson; revocation blocks new
  lessons and stops live ones on the next event
- **Moderation** `moderate()` on every student question **and on teacher speech before it reaches the
  student**; `critical` → `ModerationFlag` + wellbeing path; `standard|strict` decides whether medium
  severity pauses the lesson
- **Injection** `detect_injection()` on topic/question; content delimited and labelled `trust="curriculum"`
  (admin content trusted-but-delimited, free text untrusted); also run on **submitted content at publish
  time**, not just student input (`AT §E.2` risk 8)
- **PII** pseudonymized names in prompts; `user_ref` is an HMAC; no email crosses the boundary (Ashlya sends
  real name + email, `route.ts:64-68`)
- **Transparency** `AINutritionFacts` row on the Nutrition Facts page; per-lesson model/provider/cost to admins
- **Retention** `transcript_retention_days` + nightly purge + DPDP subject-access export from ASchool tables
- **Ledger/quota** pre-flight reservation + `AIUsageLog` per reported call + `AIToolAnalyticsDaily` (A.8)
Limits: lesson creates 6/day + 2/hour per student (`ai_rate_limit`, `rate_limiter.py:102-112`); 200/day per
school; concurrent per school `min(config.max_concurrent, plan cap)`, per student 1 → 409; 40 questions/lesson
(also enforced service-side via `max_minutes`/`max_questions`, re-checked on `question.asked`); webhook ingest
600/min per school key (`device_rate_limit` pattern, `rate_limiter.py:115-124`); content read 300/min per key;
`monthly_minutes_per_student` summed from `ai_teacher_lessons` at create.

## A.8 token_hub cost accounting (`AT §B.8`)
Two-sided, because the service burns the tokens:
1. **Pre-flight reservation at create** — `estimate_cost_usd` (`token_hub.py:74-90`) over planned chapters ×
   the measured per-chapter envelope (≈8–15k prompt / 3–6k completion per chapter, measured in
   `ATEACHER_INTEGRATION_BLUEPRINT.md §10.1`), then `_check_quota(school_id, est_cost_usd=…)` and
   `_reserve_cost` (`token_hub.py:343-411`). A school at its ceiling gets a clean 429 **before** the service
   is called.
2. **Post-hoc reconciliation from `usage.reported`** — one `AIUsageLog` row per reported call,
   `feature="ai_teacher:lesson"`, real `prompt_tokens/completion_tokens/model/provider/cost_usd`, then
   `reconcile_quota_reservation(school_id, est, actual)` (`token_hub.py:413-426`). Rollups into
   `AIToolAnalyticsDaily` (`models/ai_workbench.py:252-268`) so the existing `analytics/ai-usage` page shows
   AI Teacher with **no new dashboard**.
If the service refuses to report usage: bill the estimate, flag the lesson `cost_source="estimated"`, visible
in admin UI. "We never pretend a number is measured."

## A.9 Failure / degradation modes (`AT §B.10`)
Kept from Ashlya: missing key → 503, connection error → 503, timeout → 504, upstream non-200 → 502 with the
service's message (`route.ts:23-29`, `ateacher_routes.py:60-131`). Added:
- Key not provisioned / misconfigured → 503 `error_code="ai_teacher_not_configured"` + admin banner
- Service unreachable / 5xx / timeout → 503 or 504; lesson row `status=failed`; **no reservation consumed**; retry-after
- Service healthy but LLM provider down → service reports `lesson.error`; ASchool opens the same chapter as a
  **readable text lesson** from §C content, labelled "Text lesson — AI teacher unavailable"
- Quota/ceiling exhausted → 429 with exact used/limit (`QuotaExceededError`, `token_hub.py:151-161`)
- Consent missing/revoked → 403 + deep link to guardian consent · Kill switch → 403
- Socket drop mid-lesson → reconnect, re-`join_lesson`, service replays board snapshot; if the service lost
  in-process state the lesson closes `interrupted` with partial mastery kept
- Webhook never arrives → reconciler closes it, `cost_source="estimated"`, mastery from last known event,
  history shows "ended (unconfirmed)"
- Content not published → 422 at create; never teach a draft
**Anti-requirement: no silent degradation to a generic chatbot.** If the whiteboard path is unavailable we say
so and hand back content rather than substituting a different product.

## A.10 Package + `manifest.yaml` fields (`AT §D`, `AT §D.1`)
`backend/app/plugins/modules/ai_teacher/`: `__init__.py`, `manifest.yaml`, `config_schema.yaml`, `hooks.py`,
`routes.py`, `service_client.py` (key+HMAC, timeouts, breaker), `content_api.py`, `webhooks.py`, `tasks.py`.
Models at `app/models/ai_teacher.py` + `app/models/teaching_content.py`; manifest pointers are boot-validated
(`loader.py:104-134`, broken pointers log ERROR).

| field | value |
|---|---|
| `slug` | `ai_teacher` |
| `name` / `name_nepali` | "AI Teacher (Live Whiteboard Tutor)" / "एआई शिक्षक (लाइभ ह्वाइटबोर्ड ट्युटर)" |
| `category` | `premium` |
| `price_monthly` / `price_yearly` | **1499 / 14990** NPR |
| `is_free` / `trial_days` | `false` / `14` |
| `emoji` / `icon` / `version` / `author` | `👩‍🏫` / `PenTool` / `1.0.0` / `ASchool` |
| `published` / `coming_soon` | `true` / `false` |
| `description` | long-form: grounded in published curriculum content, interruptible by voice/text, mastery per outcome flows into progress reports, runs on a dedicated service |
| `api_blueprint` | `app.plugins.modules.ai_teacher.routes` |
| `models_module` | `app.models.ai_teacher` |
| `models` | `app.models.ai_teacher`, `app.models.teaching_content` |
| `services` | `…ai_teacher.service_client`, `…ai_teacher.content_api` |
| `tasks` | `app.plugins.modules.ai_teacher.tasks` |
| `depends_on` | `ai_suite` (AI tier the workbench checks) + `academics` (curriculum_units) — **hard deps** |
| `conflicts_with` | `[]` |
| `frontend.route` | `/dashboard/ai-teacher` |
| `frontend.sidebar` | section "Learning", label "AI Teacher"/"एआई शिक्षक", icon PenTool; subitems Start a Lesson · Lesson History · Mastery · Teaching Content · Usage & Cost · Settings (`/dashboard/settings/ai-teacher`); `visible_to: [school_admin, teacher, student]` |
| `flutter.admin_app` | folder `ai_teacher`, tabs Usage / Content / Safety |
| `flutter.teacher_app` | tabs Assign Lesson / Live / Mastery |
| `flutter.student_app` | tabs Learn / My Lessons / Due for Review |
| `flutter.parent_app` | tabs Child's Lessons / Consent |
| `events.emits` | `ai_teacher.lesson_started`, `.lesson_completed`, `.mastery_updated`, `.moderation_flagged`, `.cost_ceiling_reached`, `.service_unavailable` |
| `events.listens` | `curriculum.content_published` (invalidate snapshots/ETags), `student.consent_revoked` (stop live lessons), `plugin.deactivated` (kill in-flight) |

## A.11 `config_schema.yaml` — every field (`AT §D.2`)
Values land in `SchoolPlugin.config` (JSONB), read via `GET /plugins/ai_teacher/config`
(`plugins.py:812-826`), written via `PUT` with merge-or-replace + `flag_modified` (`plugins.py:829-883`).
Report's rule: "a setting with no consumer is a lie."

| key | type | default | consumer |
|---|---|---|---|
| `service_base_url` | string, admin_only | `""` | `service_client.py` |
| `player_base_url` | string, admin_only | `""` | player embed; must be in CSP `frame-src` |
| `service_key_id` | string, readonly | `""` | display only; secret never shown |
| `default_persona_slug` | select `aria,max,sophia,leo,nova` | `aria` | create payload |
| `allow_student_persona_choice` | boolean | `true` | launcher |
| `default_language` | select `en,ne,mixed` | `ne` | create payload (`mixed` = Nepali speech, English subject terms via glossary) |
| `default_voice` | select `ne-NP-HemkalaNeural, ne-NP-SagarNeural, en-US-AriaNeural, en-US-GuyNeural, hi-IN-SwaraNeural` | `ne-NP-HemkalaNeural` | create payload |
| `require_nepali_content` | boolean | `false` | §C.6 publish gate |
| `lesson_max_minutes` | integer 5–90 | `25` | create clamp |
| `lesson_target_chapters` | integer 1–8 | `4` | plan bound / main cost driver |
| `max_questions_per_lesson` | integer | `40` | orchestrator + service payload |
| `attention_reset_minutes` | integer, 0 disables | `10` | lesson shape |
| `allow_free_topic` | boolean | `false` | create gate (off = must be grounded, recommended) |
| `allowed_grades` | multiselect 1–12 | `["6","7","8","9","10"]` | create gate |
| `allowed_subjects` | multiselect (from school subjects at render) | `[]` = all with published content | create gate |
| `allowed_roles` | multiselect `student,teacher,school_admin` | `["student","teacher"]` | create gate |
| `student_hours_window` | string | `"06:00-21:00"` | create gate; teachers/admins exempt |
| `require_guardian_consent` | boolean | `true` | guardrail; **cannot be off for under-13** |
| `moderation_strictness` | select `standard,strict` | `standard` | guardrail |
| `kill_switch` | boolean | `false` | guardrail (blocks new, ends live) |
| `transcript_retention_days` | integer 7–1095 | `180` | `tasks.purge_transcripts` |
| `teacher_can_watch_live` | boolean | `true` | socket mirror gate |
| `monthly_cost_ceiling_npr` | integer, 0 = platform quota only | `3000` | reservation → 429 |
| `monthly_minutes_per_student` | integer | `240` | create gate |
| `max_concurrent_lessons` | integer | `25` | concurrency → 409 |
| `cost_alert_percent` | integer | `80` | `ai_teacher.cost_ceiling_reached` |

## A.12 `hooks.py` responsibilities (`AT §D.3`)
Hooks are **never fatal** — `_run_plugin_hook` logs and swallows failures (`app/api/v1/plugins.py:83-101`), so
every step is idempotent and retryable from the settings screen. `TOOL_KEY = "ai_teacher_lesson"`.
- `_owned_models()` = 6 AI-teacher models (`AITeacherServiceKey, AITeacherLesson, AITeacherLessonChapter,
  AITeacherMessage, AITeacherMastery, AITeacherLearningEvent`) + the 12 teaching-content models.
- `activate(db)`: (1) `__table__.create(db.engine, checkfirst=True)` for all owned models (pattern from
  `ai_adaptive_learning/hooks.py:23-30`); (2) `AITeacherServiceKey.issue(school_id, secret)` storing sha256
  only, then `provision_tenant(...)` in try/except/finally that nulls the secret; (3) register
  `AIToolRegistry(tool_key="ai_teacher_lesson", category="tutor", min_plan_tier="ai_suite",
  roles_allowed=["student","teacher","school_admin"], status="beta")` + `AINutritionFacts`
  (model `external-service`, provider `ai_teacher_service`, `data_accessed=[published curriculum content,
  lesson transcript, mastery per learning outcome]`, `data_not_accessed=[marks, attendance, fees, health
  records, student photos, documents]`, `retention_days=180`, `no_training_guarantee=True`,
  `human_review_required=False`, `supported_language="en+ne"`) — `status="ga"` requires the facts row (CI gate);
  (4) seed defaults into `SchoolPlugin.config` only for unset keys via `{**defaults, **(sp.config or {})}` +
  `flag_modified`.
- `deactivate(db)`: stop every lesson in `ready|teaching|paused` via `stop_lesson`, set `status="ended"`,
  `end_reason="plugin_deactivated"`, then `disable_tenant(school_id)`. **Keep every row.**
- `uninstall(db)`: set `revoked_at` on live service keys; strip `SchoolPlugin.config` to platform-reserved keys
  (`last_payment`). Lessons, mastery, teaching content are DATA and are kept.

## A.13 Plugin-owned widgets (`AT §D.5`)
Web (`frontend/app/dashboard/ai-teacher/`, every page in `<PluginGate slug="ai_teacher">`): `LessonLauncher`
(grade→subject→unit→section picker from `/launcher`, persona gallery, language/voice, estimated minutes +
**estimated NPR before start**, "not available in Nepali yet" badge) · `AITeacherPlayer` (iframe host, token in
fragment, `allow="microphone; autoplay; fullscreen"`, `sandbox="allow-scripts allow-same-origin"`, connection
banner) · `LessonProgressRail` · `AskBar` (mic uses the service's STT through the player, never ASchool) ·
`MasteryHeatmap` (reused on student profile + report-card evidence) · `LessonHistoryTable` ·
`TeachingContentEditor` (version rail, block editors, side-by-side EN|NE panes, publish-gate checklist,
diff-vs-published, fork/re-adopt) · `ContentPreviewDrawer` · `AITeacherUsageCard` (drops into existing
`analytics/ai-usage`) · `AITeacherSettingsForm` (+ Rotate Key + health) · `ServiceDownNotice` · `ConsentBanner`.
Flutter: **student** `AiTeacherHomeTab`, `LessonWebViewPlayer` (with the two proven hacks
`setMediaPlaybackRequiresUserGesture(false)` + landscape/immersive lock, `ateacher_bridge_screen.dart:487-501`),
`MyLessonsList`, `MasteryStrip`, `AskSheet` · **teacher** `AssignLessonSheet`, `LiveLessonsMonitor` (gated by
`teacher_can_watch_live`), `ClassMasteryGrid` · **parent** `ChildLessonsList` (summaries only, never live),
`AiConsentTile` · **admin** `AiTeacherUsageTab`, `ContentCoverageTab`, `SafetyFlagsTab` · **shared** existing
`PluginGate` (`aschool_shared/lib/widgets/plugin_gate.dart`), `ServiceUnavailableCard`, reuse of
`NoDataContainer`/`ErrorContainer` — no new empty/error states.

## A.14 "What NOT to copy", with the evidence (`AT §E.1`)
| Do not copy | Evidence (Ashlya) | Why |
|---|---|---|
| One static platform API key, insecure default, plain string compare | `backend/config.py:39`; `routes/auth.py:47-55` | Leak = mint a token for any user of any tenant |
| Opaque UUID "tokens", no claims | `db_service.py:91`; validation `:116-128` | No tenant/role/audience/signature; needs a DB round trip |
| Token in the query string | `routes/auth.py:70-71`; `LiveTeacherModal.tsx:38`; `ateacher_bridge_service.dart:139-148`; `main.dart:60` | Access logs, history, `Referer`, WebView logs |
| Unauthenticated sockets | `websocket/events.py:188-191`; `api_client.dart:56-80`; `cors_allowed_origins="*"` `app.py:71` | Knowing a session id *is* authorization |
| `get_active_session()` fallback | `events.py:448-452` | A question with an unknown id is answered into someone else's lesson |
| Unauthenticated `restore_session` | `events.py:753-798` | Replays any lesson's board to any connection |
| Unauthenticated content/media routes | `routes/lesson.py:7-42`; `routes/tts.py:43-90` (arbitrary text→speech, 1 h public cache); `routes/stt.py:18` | Free TTS/STT for the internet billed to us + session-creation hole bypassing every gate |
| In-process lesson state | `events.py:29-32`, `:174-179`; board state in `whiteboard_service` | Forces `-w 1` (`render.yaml:8`), loses lessons on restart |
| `create_all()` schema management | `app.py:56-58`; MySQL `LONGTEXT` `models/database.py:292,357` | ASchool is Postgres + Alembic; also the cause of the host-schema leak |
| Service tables in the host DB | `live_schema_dump_2026_08_05.sql:360-442` | Separate service ⇒ separate database |
| Committed provider keys | `backend/render.yaml:9-10` (live `GROQ_API_KEY`), in-tree `.env` | Rotate on adoption; secrets from the platform store |
| OCR / camera ingestion as a content path | `ateacher_bridge_screen.dart:239-341`; in-lesson `setOnShowFileSelector` `:491,523-601` | OCR errors become taught facts; bypasses the review workflow |
| Prose context assembled at click time | `NotesToolbar.tsx:70-80`; `QuizDetailAssistant.tsx:335-357`; merge+truncate `routes/auth.py:96-162` | No provenance/versioning/outcome links/Nepali parity; 150k-char truncation silently drops content |
| Real name + email to the service | `route.ts:64-68`; `ateacher_routes.py:84` | Minimize: pseudonymous `user_ref` + first name only |
| Mastery keyed by LLM-invented chapter titles | `events.py:849-878`; "a question means confusion" `:530-559` | Unusable across lessons and pedagogically wrong |
| The 2500 ms postMessage race | `lesson_screen.dart:78-100` | Starts teaching with empty context if the message is late |
| `sandbox="allow-scripts allow-same-origin"` on a same-site frame | `LiveTeacherModal.tsx:194` | Effectively removes the sandbox |
Also do not port: `session_service.py` session-id logic; the triple-duplicated token loop without
`try/finally` (`events.py:889-1008,1011-1163,1240-1465`); `_log_chapter_mastery`'s truncated stub
(`events.py:880-887` — builds `kg_mastery` then does nothing); dead `image_gen_service.py` /
`board_state_compressor.py`; `ai_teacher/chemistgpt.txt` + `physicsgpt.txt` (third-party MathGPT prompts).
Own-design risks: 12 rows at `AT §E.2`. The two that change sequencing — risk 1 **the content is the product
now** (an empty `teaching_*` schema makes the plugin a shell; track "content coverage %" as a release gate),
risk 9 feed `ai_adaptive_learning`'s `MasteryRecord` from `ai_teacher_mastery` **one direction only**.

# B. TEACHING-CONTENT SCHEMA (admin-entered, NO OCR)

Decision (`AT §C.1`): teaching content is first-class, normalized, multi-tenant, versioned, bilingual data
entered by platform curriculum admins and school admins through ordinary CRUD. Media may be *attached* as a
file reference for the player, never *parsed*. Unauthored chapter ⇒ lesson refused 422, not hallucinated.

## B.1 Composition with existing tables — reused, not rebuilt (`AT §C.2`)
| Existing | File | Role |
|---|---|---|
| `curriculum_frameworks` (board, grade, subject_code, subject_name, `school_id` NULL = platform) | `app/models/curriculum.py:16-44` | **is** framework → subject → grade. No new table |
| `curriculum_units` (unit_no, title_en/ne, periods, weight_pct) | `curriculum.py:47-71` | **is** the chapter/unit level |
| `learning_outcomes` (code, statement_en/ne, bloom) | `curriculum.py:74-94` | **is** the outcome level; new content links to it, never copies text |
| `subject_offerings` (theory/practical full+pass marks) | `curriculum.py:97-130` | exam-weighting context for exam tips; untouched |
| CDC/NEB seed (grades 1-10 core + 11-12 streams) | `app/services/ai/curriculum_seed.py:9-120` | frameworks/units already exist, idempotent |
| `AIGeneration` ledger | `models/ai_workbench.py:20-47` | AI-assisted drafts record `ai_generation_id` |
| `ai_generations.citations` JSONB | `models/ai_workbench.py:45` | lesson generations cite `teaching_section_versions.id` |
| `courses/lessons/topics/study_materials` (LMS) | `models/lms.py:20-110` | stays school course delivery; one nullable `teaching_sections.lms_topic_id` FK aligns them — one column, no fork |
The gap being filled is everything **below `curriculum_units`**: nowhere to store teaching notes, worked
examples, misconceptions, formulas or exam tips; no draft→publish workflow; no version identity to cite; no
school-override chain.

## B.2 Full table list with columns and FKs (`AT §C.3`–`C.5`; verbatim DDL there)
All prefixed `teaching_`, all inherit UUID PK `gen_random_uuid()` + TIMESTAMPTZ `created_at`/`updated_at` +
`is_deleted` (`models/base.py:11-43`). Map: `curriculum_frameworks → curriculum_units → {learning_outcomes,
teaching_sections → teaching_section_versions → 8 block tables}` + 2 side tables.

**`teaching_sections`** (stable identity): `id` · `school_id`→schools(id) NULL = platform · `unit_id`→
curriculum_units(id) CASCADE · `overrides_section_id`→teaching_sections(id) · `lms_topic_id`→topics(id) ·
`section_no` INT · `code` VARCHAR(60) (`"SCI.G10.U2.S3"`, stable+quotable) · `kind` VARCHAR(24) default
`concept`, CHECK (concept|derivation|procedure|experiment|reading|revision) · `title_en` NOT NULL · `title_ne`
· `summary_en/ne` · `estimated_minutes` INT default 12 · `difficulty` CHECK (foundation|core|stretch) default
core · `prerequisite_section_ids UUID[]` · `tags` JSONB · `is_active` · `created_by_id`→users(id).
CHECK: only school rows may override. Partial unique indexes: platform `(unit_id, code) WHERE school_id IS
NULL`; school `(school_id, unit_id, code)`; override `(school_id, overrides_section_id)`. Indexes
`(unit_id, section_no)`, `school_id`.

**`teaching_section_versions`** (publish AND citation unit): `id` · `school_id` (denormalized for fast
scoping) · `section_id`→teaching_sections CASCADE · `version_no` INT · `status` default `draft` CHECK
(draft|in_review|published|archived|rejected) · `supersedes_id`→self · `language_coverage` JSONB default
`{"en":false,"ne":false}` · `content_sha256` CHAR(64) · `change_note` · `ai_generation_id`→ai_generations(id)
· `authored_by_id`→users · `submitted_at` · `reviewed_by_id`→users · `reviewed_at` · `published_by_id`→users ·
`published_at` · `archived_at`. `UNIQUE (section_id, version_no)`; **partial unique `(section_id) WHERE
status='published'`** — the invariant the read API depends on. Indexes: `status`, `(school_id,status)`,
`(section_id, version_no DESC)`.

**`teaching_section_outcomes`** (link table, outcome text never copied): `version_id`→versions CASCADE ·
`outcome_id`→learning_outcomes CASCADE · `emphasis` CHECK (primary|supporting) · `mastery_key` VARCHAR(80)
NOT NULL · `sort_order`. `UNIQUE (version_id, outcome_id)`, index `outcome_id`. `mastery_key` is the join to
`ai_teacher_mastery` (student_id + concept_key) — the column that makes spaced repetition and report-card
evidence possible; Ashlya's LLM-invented labels (`events.py:849-878`) are unusable across lessons (`AT §C.4`).

Content blocks — **every table FKs `version_id` → `teaching_section_versions(id)` ON DELETE CASCADE**, every
field bilingual `*_en`/`*_ne`:
| Table | Columns beyond `version_id` + base |
|---|---|
| `teaching_notes` | `block_no` · `block_type` CHECK (hook\|explanation\|definition\|analogy\|step\|caution\|recap\|activity) default explanation · `heading_en/ne` · `body_en` NOT NULL · `body_ne` · `speaker_note_en/ne` ("say it like this" for the AI voice) · `board_hint` VARCHAR(200) · `media_id`→teaching_media(id) **deferred FK** · `UNIQUE (version_id, block_no)` |
| `teaching_examples` | `example_no` · `kind` CHECK (worked\|guided\|practice\|exam) · `difficulty` CHECK (foundation\|core\|stretch) · `prompt_en` NOT NULL · `prompt_ne` · `given_en/ne` · `steps` JSONB `[{n,en,ne,latex,why_en,why_ne}]` · `answer_en/ne` · `answer_latex` · `unit_label` · `marks` · `source_ref` (typed by admin) · `UNIQUE (version_id, example_no)` |
| `teaching_misconceptions` | `sort_order` · `wrong_belief_en` NOT NULL · `wrong_belief_ne` · `why_students_think_en/ne` · `correction_en` NOT NULL · `correction_ne` · `diagnostic_question_en/ne` (the probe the AI asks) · `severity` CHECK (rare\|common\|pervasive) · `linked_outcome_id`→learning_outcomes(id) |
| `teaching_formulas` | `sort_order` · `name_en` NOT NULL · `name_ne` · `latex` NOT NULL · `spoken_en` NOT NULL · `spoken_ne` (**TTS uses this, never the LaTeX**) · `symbols` JSONB `[{sym,meaning_en,meaning_ne,unit}]` · `conditions_en/ne` · `derivable` BOOL · `must_memorize` BOOL |
| `teaching_exam_tips` | `sort_order` · `tip_type` CHECK (frequent\|trap\|marking_scheme\|time_management\|presentation) · `body_en` NOT NULL · `body_ne` · `exam_board` (`neb\|see\|cdc\|school`) · `question_pattern` VARCHAR(120) · `typical_marks` · `appeared_years` JSONB (typed, not scraped) · `subject_offering_id`→subject_offerings(id) |
| `teaching_key_terms` | `term_en` NOT NULL · `term_ne` · `keep_in_english` BOOL default TRUE · `definition_en/ne` · `sort_order` · `UNIQUE (version_id, term_en)` |
| `teaching_media` | `media_type` CHECK (image\|svg\|audio\|video\|link) · `file_id`→files(id) *(see D-11)* · `external_url` · `svg_inline` (admin-pasted SVG the board can draw) · `alt_text_en` NOT NULL (accessibility **and** what the AI may say) · `alt_text_ne` · `caption_en/ne` · `licence` · `attribution` · `sort_order` · CHECK at least one of file_id/external_url/svg_inline. **REFERENCES ONLY — never parsed, never OCR'd** |
Side tables: **`teaching_content_snapshots`** (`school_id`, `version_id`, `language` en\|ne\|mixed,
`document` JSONB = the exact payload sent, `document_sha256`, `token_estimate`, `built_at`; `UNIQUE
(version_id, language, document_sha256)`) and **`teaching_content_reviews`** (`school_id`, `version_id`
CASCADE, `action` CHECK submit|approve|reject|publish|archive|revert, `from_status`, `to_status`, `actor_id`,
`comment`; index `(version_id, created_at DESC)`).
Migration (`AT §C.8`): one Alembic revision for the tables, the partial unique indexes and the deferred
`teaching_notes.media_id` FK; SQLAlchemy sketch at `backend/app/models/teaching_content.py`. Platform seeding
extends idempotent `seed_curriculum()` (`curriculum_seed.py:52-120`) with a second pass creating
`teaching_sections` + published v1 for CDC units, **starting with Science and Math grades 8-10**.

## B.3 Versioning, draft→publish workflow, override chain (`AT §C.6`)
State machine, enforced in the service layer, audited in `teaching_content_reviews`:
`draft --submit--> in_review --approve/publish--> published --(edit)--> new draft (v+1)`;
`in_review --reject--> draft`; `published --archive--> archived`.
- Only `curriculum_admin`/`superadmin` may publish platform rows (`school_id IS NULL`); `school_admin` and a
  `content_editor` role may publish their own school's rows.
- `uq_tsv_one_published` guarantees exactly one live version per section, so the read API never disambiguates.
  A published version is append-only; "editing" clones it to `v+1` draft.
- **Publish gate refuses when:** no `primary` outcome link; zero `teaching_notes` blocks; `body_en` empty on
  any block; media without `alt_text_en`; a formula without `spoken_en`; or config `require_nepali=true` with
  any `*_ne` primary field missing. Publishing computes `content_sha256` + `language_coverage`. A section may
  ship EN-only with `language_coverage.ne=false`, and the launcher says "Nepali not available for this chapter
  yet" instead of machine-translating at teach time — "honest bilingual state beats fake bilingual state".
- Archived versions are never deleted: lessons cite version ids and a parent must still be able to see what
  their child was taught in Baisakh.
**Resolution order** for `(unit, section_code)` in school S (CTE in `AT §C.6`): `school_row`
(`school_id = :school`) `COALESCE` `platform_row` (`school_id IS NULL`), then the version with
`status='published'`. School row wins, platform is fallback. A school "fork" clones the platform section into a
school row with `overrides_section_id` set (clone copies the published blocks as draft v1). **Clearing the
override re-adopts platform content** — how a curriculum correction reaches 400 schools without 400 edits.

## B.4 The read API the AI Teacher pulls (`AT §C.7`)
```
GET /api/v1/ai-teacher/content/section/{section_id}?language=en|ne|mixed&depth=full|outline
  headers: X-ASchool-Key, X-ASchool-Signature, X-ASchool-Timestamp
  304 If-None-Match · 404 unknown/unpublished · 401 bad signature · 429 rate limited
```
200 keys, verbatim: `snapshot_id`, `version_id`, `version_no`, `sha256`, `language`,
`language_coverage{en,ne}`, `curriculum{board,grade,subject_code,subject_name,unit_no,unit_title{en,ne}}`,
`section{code,kind,estimated_minutes,difficulty,title{},summary{},prerequisites[{code,title{}}]}`,
`outcomes[{code,bloom,emphasis,mastery_key,statement{}}]`,
`notes[{block_no,type,heading{},body{},speaker_note{},board_hint,media_id}]`,
`examples[{no,kind,difficulty,prompt{},given{},steps[{n,text{},latex,why{}}],answer{},answer_latex,marks}]`,
`misconceptions[{wrong_belief{},why_students_think{},correction{},diagnostic_question{},severity,
outcome_code}]`, `formulas[{name{},latex,spoken{},symbols[],conditions{},derivable,must_memorize}]`,
`exam_tips[{type,board,pattern,typical_marks,appeared_years,body{}}]`,
`key_terms[{en,ne,keep_in_english,definition{}}]`, `media[{id,type,svg_inline,alt_text{},caption{},licence}]`,
`trust:"curriculum"`, `generated_at`, `etag: W/"<sha256>"`.
`language=mixed` returns both EN and NE plus `keep_in_english` flags so the service's mixed mode has real data
instead of guessing which nouns to keep. `depth=outline` = section/outcome/heading skeleton for planning calls;
`full` for teaching. Both wrapped by the caller in `<source trust="curriculum">`. Companions:
`GET /content/units/{unit_id}/sections` (ordered outline) and `GET /content/search?grade=&subject=&q=`
(launcher picker, internal-JWT version).

# C. AI TOOL CATALOG (`TC` Part 3)

## C.1 Group structure and counts (`TC §3.14`)
**153 tools, 13 groups (A..M): 24 IMPL · 26 PART · 103 NEW.** Per group `total/IMPL/PART/NEW`:
A Planning 14/4/0/10 · B Delivery 12/0/2/10 · C Assessment authoring 14/5/0/9 · D Grading & feedback 12/2/3/7 ·
E Differentiation & SEN 13/1/1/11 · F Communication 14/1/6/7 · G Reporting & analytics 13/3/5/5 ·
H PD & HR 11/0/1/10 · I Admin & ops 12/4/2/6 · J Student learning 16/3/0/13 · K Wellbeing 8/0/2/6 ·
L Parent-facing 8/0/1/7 · M Nepal-specific 6/1/3/2.
Legend (`TC §3.0`): personas T/S/P/A/C/H; `Curric` Y = must not run without a `CurriculumFramework` match via
`context_curriculum`, y = optional, – = none; `Doc` = renderer (`writer|canvas|report|bulk|deck|xlsx|–`);
`Cost` 0 deterministic → 4 batch/vision/audio; `P` = P0/P1/P2.
Result templates: 10 exist (`plan_card, qa_list, text_block, rubric_grid, tiered_panel, flashcard_deck,
feedback_panel, section_list, insight_cards, board_stream`); **4 are NEW and gate dozens of tools**:
`table_grid`, `slide_deck`, `chart_panel`, `checklist`.
Format below: `slug — purpose — ui_type — built?`

**A Planning (14):** `lesson_plan` NEB plan — plan_card — IMPL · `unit_plan` 2–6wk unit — plan_card+table_grid —
NEW · `annual_scheme` BS-month year pacing — table_grid — NEW · `weekly_planner` per-period from real timetable
— table_grid — NEW · `substitute_plan` cover plan — plan_card — NEW · `differentiation` 3-tier — tiered_panel —
IMPL · `study_guide` — section_list — IMPL · `worksheet` marks-summed — qa_list — IMPL · `lesson_hook` 3 openers
— text_block — NEW · `objective_writer` Bloom→CDC outcomes — section_list — NEW · `resource_finder` NPR-priced
materials — checklist — NEW · `pbl_designer` — plan_card+rubric_grid — NEW · `field_trip_plan` —
plan_card+checklist — NEW · `cocurric_plan` — plan_card — NEW.

**B Delivery (12):** `slide_deck` projector deck — slide_deck — NEW · `deck_from_doc` — slide_deck — NEW ·
`handout_from_deck` — table_grid — NEW · `board_plan` chalk-only layout — section_list — NEW ·
`explainer_script` — text_block — NEW · `misconception_map` + diagnostics — table_grid — NEW ·
`questioning_ladder` DOK — qa_list — NEW · `live_poll` ephemeral, aggregate-only — chart_panel — PART
(`ai/extensions.py LivePoll`, in-memory) · `group_maker` balanced from marks+attendance — table_grid — NEW ·
`seating_plan` — table_grid — NEW · `timer_routine` — checklist — NEW · `ai_teacher_board` ARIA live board —
board_stream — PART (`ai_tutor.py` + `tutor_engine.py`).

**C Assessment authoring (14):** `question_paper` NEB paper — qa_list — IMPL · `question_paper_v2` blueprint from
bank — qa_list — IMPL · `question_bank` tag/dedupe/QTI 3.0 — table_grid — IMPL · `blueprint_builder`
marks×unit×cognitive grid — table_grid — NEW · `answer_key` step-marked scheme — qa_list — NEW · `exit_ticket` —
qa_list — IMPL · `rubric` — rubric_grid — IMPL (beta) · `mcq_generator` misconception distractors — qa_list —
NEW · `practical_exam` 25% internal split — qa_list+table_grid — NEW · `oral_viva` — qa_list — NEW ·
`formative_probe` prerequisite pre-test — qa_list — NEW · `project_brief` — text_block+rubric_grid — NEW ·
`ai_resistant_task` — text_block — NEW · `paper_moderation` deterministic+judge audit — checklist — NEW.

**D Grading & feedback (12):** `auto_grader` objective — table_grid — IMPL (`auto_grader.py` via
`assignments.py`) · `writing_feedback` (schema has **no** `revised_text`) — feedback_panel — IMPL ·
`rubric_grader` quoted justification per criterion — rubric_grid — NEW · `batch_feedback` class-wide + trends —
table_grid+insight_cards — NEW · `answer_grouper` Gradescope-style — table_grid — NEW · `grader_calibration`
learns ~20 marked scripts — insight_cards — NEW · `handwriting_ocr` vision over photographed sheets — qa_list —
NEW · `remark_writer` — text_block — PART (`/remarks` → `QuestionPaperService.generate_remark`;
`report_remarks.py` unmounted) · `remark_sheet` whole-class editable — table_grid — NEW · `feedback_translator` —
text_block — PART (`translator.py`) · `integrity_check` evidence, **no verdict** — insight_cards — PART
(`plagiarism.py`) · `progress_conference` — checklist — NEW.

**E Differentiation & SEN (13):** `text_leveler` ±3 grades — text_block — NEW · `text_scaffolder` — section_list
— NEW · `vocab_support` — flashcard_deck — NEW · `iep_draft` (**human review before finalize**) —
plan_card+table_grid — PART (`ai_workbench.py draft_iep/review_iep/list_ieps` + `_can_review_iep`; no registry
row/schema/prompt) · `iep_progress` — table_grid — NEW · `accommodation_finder` no diagnosis language —
checklist — NEW · `behaviour_plan` ABC analysis — plan_card — NEW · `social_story` — text_block — NEW ·
`remedial_plan` from actual weak items — plan_card+table_grid — NEW · `enrichment_plan` — tiered_panel — NEW ·
`multilingual_support` Maithili/Bhojpuri/Newar/Tamang (**coverage unvalidated**) — table_grid — NEW ·
`udl_choice_board` 3×3 — table_grid — NEW · `adaptive_path` — checklist — IMPL (`adaptive_learning.py` +
`api/v1/adaptive_learning.py` + `ai_adaptive_learning` plugin).

**F Communication (14):** `parent_email` — text_block — IMPL · `parent_sms` 160-char — text_block — NEW ·
`parent_letter` BS+AD letterhead — text_block — PART (`/letter-writer`, no registry row) ·
`difficult_conversation` — feedback_panel — NEW · `email_responder` 3 tones — text_block — NEW ·
`class_newsletter` — section_list — NEW · `school_notice` Nepali register — text_block — PART (writer
notice/circular templates exist; no AI tool) · `event_invite` — text_block — NEW · `meeting_agenda` — checklist
— NEW · `meeting_minutes` — checklist — NEW · `parent_faq` policy-only + citations — text_block — PART
(`rag.py` chunks; `faqs.py` non-AI) · `translation_bridge` preserves structure + mark totals — same as source —
PART (`translator.py`) · `whatsapp_broadcast` — text_block — PART (`whatsapp_bot.py` transport only) ·
`emergency_notice` — text_block — PART (`services/emergency/` exists, no AI drafting).

**G Reporting & analytics (13):** `school_insights` weekly digest — insight_cards — IMPL (`school_insights.py`,
`/insights/weekly`, `tasks/ai_insights_weekly.py`) · `daily_brief` — insight_cards — IMPL · `risk_alerts` —
table_grid — IMPL (`/insights/risk-alerts`; `risk_detector.py` unmounted variant) · `class_performance` 3
actions — insight_cards+chart_panel — NEW · `item_analysis` difficulty+discrimination — table_grid+chart_panel —
NEW · `cohort_trend` — chart_panel — NEW · `attendance_insight` festival/day-of-week — chart_panel — PART
(`attendance_ai.py`) · `fee_forecast` — chart_panel — PART (`fee_predictor.py`) · `benchmark_report` —
insight_cards — PART (`benchmarking_ai.py` + `api/v1/benchmarking.py`, not in AI registry) · `board_report` SMC
governance — section_list+chart_panel — NEW · `iemis_readiness` — checklist — PART (`models/iemis.py`,
`iemis_importer` plugin, `iemis_templates/`) · `donor_report` — section_list — NEW · `sentiment_pulse` —
insight_cards — PART (`sentiment.py`).

**H PD & HR (11):** `pd_coach` UNESCO 6-strand — checklist — PART (`extensions.py seed_pd_framework` +
`teacher_pd_progress` + `register_pd_routes`) · `lesson_observation` — feedback_panel — NEW · `teacher_feedback`
coaching script not verdict — text_block — NEW · `pd_plan` — plan_card — NEW · `workshop_designer` —
plan_card+slide_deck — NEW · `mentoring_notes` — checklist — NEW · `appraisal_draft` (**human sign-off**) —
text_block — NEW · `jd_writer` — text_block — NEW · `interview_kit` — qa_list+rubric_grid — NEW ·
`induction_pack` — checklist — NEW · `policy_drafter` — section_list — NEW.

**I Admin & ops (12):** `timetable_solver` — table_grid — IMPL (`/timetable` + `/timetable/save`) ·
`exam_timetable` + invigilation — table_grid — NEW · `duty_roster` — table_grid — NEW · `voice_capture`
speak-then-**confirm** — table_grid — IMPL (`ai_capture.py /voice` + `/confirm`) · `photo_capture` register
photo → rows — table_grid — IMPL (`/photo`) · `data_cleanup` — checklist — NEW · `admission_bot` — text_block —
PART (referenced only in the `admission` manifest) · `admission_screener` — table_grid — NEW ·
`inventory_forecast` — table_grid — NEW · `transport_optimizer` — table_grid — NEW · `website_content` —
section_list — IMPL (`website_designer.py` + `website_builder.py`) · `social_post` — text_block — PART
(`social_ai.py`).

**J Student learning (16)** — all pass the guardian-consent gate, unbypassable by omitting `student_id`
(`TC §3.10`): `ai_tutor` Socratic — board_stream — IMPL · `homework_helper` hint-first — feedback_panel — IMPL ·
`flashcards` — flashcard_deck — IMPL · `practice_set` weakest verified items — qa_list — NEW ·
`concept_explainer` 3 ways — section_list — NEW · `worked_example` + twin problem — section_list — NEW ·
`revision_planner` — checklist — NEW · `see_prep_pack` — section_list+qa_list — NEW · `self_quiz` — qa_list —
NEW · `note_summarizer` — section_list — NEW · `mindmap_builder` — chart_panel — NEW · `reading_coach`
(**Nepali ASR unvalidated**) — feedback_panel — NEW · `writing_tutor` **never rewrites** — feedback_panel — NEW
· `lab_prep` — section_list — NEW · `career_explorer` Nepali streams — section_list — NEW · `study_skills` —
checklist — NEW.

**K Wellbeing & safeguarding (8)** — all route through `workbench.moderate` → critical self-harm →
`ModerationFlag(severity="critical")` + blocked generation + counselor queue; **no second alerting mechanism**
(`TC §3.11`): `wellbeing_checkin` — feedback_panel — PART (`wellbeing_ai.py` + `api/v1/wellbeing.py`, not a
registry tool) · `counselor_brief` — insight_cards — NEW · `incident_writeup` — text_block — PART
(`incident_management.py`/`incidents.py`, no AI drafting) · `restorative_script` — text_block — NEW ·
`bullying_triage` — checklist — NEW · `safeguarding_check` referral threshold — checklist — NEW ·
`attendance_outreach` — text_block — NEW · `crisis_protocol` **deterministic, no generation** — checklist — NEW.

**L Parent-facing (8):** `report_explainer` — section_list — NEW · `home_support` — checklist — NEW ·
`fee_explainer` — text_block — NEW · `school_qa` policy-only — text_block — NEW · `meeting_prep_parent` —
checklist — NEW · `consent_explainer` cost 0 — section_list — PART (`GuardianAIConsent` + gate exist; no
explainer surface) · `transition_guide` — section_list — NEW · `attendance_digest` BS dates — chart_panel — NEW.

**M Nepal-specific (6):** `curriculum_mapper` CDC PDF → frameworks/units/outcomes — table_grid — PART
(`curriculum_seed.py` + `models/curriculum.py`; no importer UI) · `neb_grade_engine` (A+ 4.0 ≥90 … D 1.6 ≥35,
NG <35; theory pass 35%, practical 40%) — table_grid — IMPL (`app/utils/nepal_grading.py` +
`bulk_generator._neb_grade/_neb_gpa/_neb_grade_from_gpa`) · `nepali_style_editor` register/honorifics —
text_block — NEW · `bs_calendar_planner` — table_grid — PART (`nepali_date.py` + `_nepali_calendar_page` +
`tools_gen_calendar_templates.py`) · `iemis_field_assistant` — table_grid — PART · `see_pattern_analyst` —
table_grid — NEW.

Migration note (`TC §3.14`): only 10 tools have registry row + schema + EN/NE prompt today (`fixture_test,
lesson_plan, worksheet, exit_ticket, rubric, parent_email, differentiation, study_guide, flashcards,
writing_feedback`). Everything else marked IMPL runs through an older bespoke route (`ai_tools.py`,
`ai_tutor.py`, `ai_capture.py`, `assignments.py`, `adaptive_learning.py`, `website_builder.py`) and **should be
migrated into the registry** so it inherits consent, pseudonymization, injection screening, schema repair,
moderation, the `AIGeneration` ledger and Caliper emission for free.








