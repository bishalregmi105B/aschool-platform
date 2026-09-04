# AI TEACHER AS AN ASCHOOL PLUGIN — INTEGRATION CONTRACT

**Date:** 2026-09-04
**Framing:** ATeacher stays a **separate service**. ASchool does not absorb its code. ASchool ships a
plugin (`ai_teacher`) that (a) provisions credentials, (b) brokers lesson sessions, (c) embeds the
player, (d) owns the durable school-side records, and (e) serves the teaching content the service
consumes. This mirrors, then hardens, the way the Ashlya Academy monorepo already integrates it.
**Sources:** `/home/bishal-regmi/Desktop/Ashlya Academy Latest/ashlya_academy/ATeacher` (the service)
and the consumer side in the same repo (`skilldarbar_api/`, `next_app/`, `lib/`); ASchool plugin +
AI infrastructure under `/home/bishal-regmi/Desktop/ASchool/backend`.
**Prior art (read, not repeated):** `audits/research/ATEACHER_INTEGRATION_BLUEPRINT.md` (engine,
prompts, board grammar, personas — §1-§9 there are the internals of the service we are *not*
rebuilding) and `audits/research/ASHLYA_AI_DEEPDIVE.md` (provider routing, cost, anti-patterns).

**Hard design constraint, stated up front: there is NO OCR, NO vision-based ingestion and NO
PDF/scan pipeline anywhere in this design.** Ashlya's mobile bridge does run ML Kit OCR on a
camera image to build lesson context
(`lib/screens/ateacher_bridge_screen.dart:239-341`, `google_mlkit_text_recognition`) — we
deliberately drop that. ASchool's teaching content is **entered by platform/school admins through
normal CRUD** and stored in a properly normalized, multi-tenant, versioned, bilingual schema
(section C). The AI teacher reads that schema through a read API; it never reads pixels.

---

## TABLE OF CONTENTS

- **A.** Ashlya's integration contract, reverse-engineered with file:line evidence
- **B.** The same contract redrawn for ASchool (multi-tenant hardened)
- **C.** Content schema — admin-entered teaching content (no OCR), full DDL
- **D.** The ASchool plugin package (`backend/app/plugins/modules/ai_teacher/`)
- **E.** Risks + what NOT to copy from ATeacher

---

# A. ASHLYA'S INTEGRATION CONTRACT

## A.1 Service topology

ATeacher is **two deployables plus its own database**, wholly outside the host app:

| Piece | Evidence | Notes |
|---|---|---|
| ATeacher API (Flask + Flask-SocketIO) | `ATeacher/ai_teacher/backend/app.py:34-117` | Port **6001** (`backend/config.py:25`, `ateacher_api.env:BACKEND_PORT=6001`). Prod domain `https://ateacherapi.ashlyaacademy.com` (`next_app.env:ATEACHER_API_URL`). |
| ATeacher web client (Flutter Web build) | `ATeacher/ai_teacher/frontend/` | Served as its own origin `https://ateacher.ashlyaacademy.com` (`next_app.env:NEXT_PUBLIC_ATEACHER_URL`; `frontend/lib/core/constants.dart:5-8` hardcodes the API default). |
| ATeacher DB | `backend/config.py:32-36` | `DB_NAME=ateacher_db`, MySQL, **separate schema** from the host's `skilldarbar`. `models/database.py` `init_db()` runs `create_all` (`app.py:56-58`) — no Alembic. |
| Redis (optional) | `app.py:73-79` | Only as the Socket.IO `message_queue`; `ateacher_api.env:REDIS_URL=redis://localhost:6379/0`. |
| Process model | `backend/render.yaml:8` | `gunicorn --worker-class eventlet -w 1` — **single worker**, because all lesson state is in-process (§A.8). |

The host `docker-compose.yml` (db/api/student-app/admin-app) contains **no ATeacher service** — it is
deployed and scaled independently and reached only over HTTP/WS.

One wrinkle worth recording: the host's own schema dump contains five `ateacher_*` tables
(`skilldarbar_api/migrations/live_schema_dump_2026_08_05.sql:360,377,392,418,434` →
`ateacher_messages`, `ateacher_session_context`, `ateacher_sessions`, `ateacher_user_tokens`,
`ateacher_users`). So at some point in the live deployment the service's tables were created inside
the host database even though config points at `ateacher_db`. Nothing in `skilldarbar_api/` ever
reads them (verified: the only host references to `ateacher_` are the proxy blueprint,
`skilldarbar_api/routes/ateacher_routes.py`, and its registration at
`skilldarbar_api/config/app_config.py:484-485`). It is schema bleed, not an integration path — and
exactly the thing our design must forbid.

## A.2 API-key issuance (host → service)

There is exactly **one shared secret, platform-wide, static, out-of-band**:

- Service side: `SERVER_API_KEY` read from env with an insecure default
  (`backend/config.py:39` → `"ateacher-server-key-change-me"`), enforced by a decorator that does a
  plain string compare of the `X-API-Key` header (`backend/routes/auth.py:47-55`).
- Host side: the same value is pasted into two different env files —
  `next_app.env:ATEACHER_SERVER_API_KEY` (used by the Next.js route handler) and
  `skilldarbar_api.env`/`ATEACHER_SERVER_API_KEY` (used by the Flask proxy,
  `skilldarbar_api/routes/ateacher_routes.py:28`).

There is **no per-tenant key, no key rotation, no key issuance API, no scoping, no expiry**. The key
guards exactly one endpoint (`POST /api/auth/token`); every other route is either user-token gated
or fully open (§A.9).

## A.3 Session pre-creation + context attachment (the two-call broker)

Both host clients implement the identical 2-step broker, server-side, so the API key never reaches a
browser (stated intent at `next_app/src/app/api/ateacher/session/route.ts:1-11`):

**Step 1 — mint a user token.**
`POST {ATEACHER_API_URL}/api/auth/token`, header `X-API-Key: <SERVER_API_KEY>`,
body `{user_id, name, email}` (`route.ts:58-69`; Flask twin at `ateacher_routes.py:81-86`).
Service handler `routes/auth.py:167-189` → `services/db_service.py:87-113`:
upserts `ateacher_users` by `platform_user_id` (`db_service.py:47-72`), inserts an
`ateacher_user_tokens` row whose token is a bare **`uuid.uuid4()` string** with
`expires_at = now + 24h` (`db_service.py:31,91-92`). Response: `{token, user_id, platform_user_id, expires_at}`.

**Step 2 — pre-create the lesson session with its context.**
`POST {ATEACHER_API_URL}/api/session/create`, header `Authorization: Bearer <token>`, body
`{topic, level, language, voice, context, source_type, source_id, context_payload?}`
(`route.ts:91-114`; Flask twin sends only the first five, `ateacher_routes.py:106-121`).
Service handler `routes/auth.py:218-292`:

- `topic` required (400 otherwise).
- Free-text `context` and any of six aliases for a structured payload
  (`context_payload|contextPayload|context_metadata|contextMetadata|extra_context|extraContext`,
  `routes/auth.py:241-248`) are merged into ONE text blob by `_build_context_text`
  (`routes/auth.py:139-162`), after markdown-stripping (`_strip_markdown_noise`,
  `routes/auth.py:96-128`) and truncation to **150 000 chars** (`MAX_CONTEXT_STORE_CHARS`,
  `routes/auth.py:42,131-136`).
- `teacher_slug` (default `"aria"`) resolves a persona row; the persona's `default_voice` /
  `default_language` win when the caller did not pass them (`routes/auth.py:266-276`).
- Row written to `ateacher_sessions` + the blob to `ateacher_session_context`
  (`models/database.py:194-212`, `281-295`). Response includes `session_id`.

The broker returns `{token, session_id, expires_at}` to its own client
(`route.ts:127-131`; `ateacher_routes.py:138-142`).

**What the context actually is:** prose assembled by the *host page*, per surface. Notes toolbar
builds "Student is reviewing notes for topic … Notes content preview: …"
(`next_app/src/components/notes/NotesToolbar.tsx:70-80`); the quiz-review adapter builds a weak-topic
+ incorrect-question digest (`next_app/src/components/ai/adapters/QuizDetailAssistant.tsx:335-357`).
Other call sites: `DashboardAssistant.tsx:92`, `CourseQA_Assistant.tsx:110`, `AIChatbot.tsx:457`,
`hooks/useNotes.ts:418`. It is opaque text — **the service has no idea what a chapter, unit or
learning outcome is.** That gap is precisely what section C fixes for ASchool.

## A.4 The token the client receives

An **opaque random UUID**, not a JWT: no signature, no claims, no audience, no tenant, no role
(`db_service.py:91`). Validation is a DB lookup plus `is_valid` (not revoked, not expired)
(`routes/auth.py:58-80` → `db_service.py:116-128`). It is accepted from the `Authorization` header
**or from the `?token=` query string** (`routes/auth.py:70-71`) — which is how the embed works, and
why the token ends up in browser history, WebView logs and any referrer.
`POST /api/auth/verify` is public (`routes/auth.py:192-205`); `POST /api/auth/revoke` requires the
token itself (`routes/auth.py:208-213`). Nothing in either host app ever calls verify or revoke.

## A.5 How the client is embedded

**Web = same-page iframe of the Flutter Web app, opened as a global modal.**
`LiveTeacherProvider` + `LiveTeacherModal` are mounted once in the root layout
(`next_app/src/app/layout.tsx:11-12,76-86`), so any page can call `openLiveTeacher(params)`
(`next_app/src/context/LiveTeacherContext.tsx:56-120`). That context POSTs to its own
`/api/ateacher/session` and stores `{token, sessionId, expiresAt}` in React state; the iframe is
rendered **only after** the session exists (`LiveTeacherModal.tsx:188`), with:

```
src   = `${NEXT_PUBLIC_ATEACHER_URL}?${params}`   // LiveTeacherModal.tsx:19-42
allow = "microphone; autoplay; fullscreen"        // LiveTeacherModal.tsx:193
sandbox = "allow-scripts allow-same-origin allow-popups allow-forms allow-modals"  // :194
```

**Mobile = in-app WebView of the same Flutter Web build** (not the native Flutter code — the phone
app loads the web player). `ATeacherBridgeScreen` collects topic/level/language/voice/persona,
calls the host proxy, builds the URL, then loads it in `webview_flutter`
(`lib/screens/ateacher_bridge_screen.dart:355-507`), with three platform hacks that are part of the
contract: `setMediaPlaybackRequiresUserGesture(false)` so TTS audio is not blocked
(`:487-490`), `setOnShowFileSelector` so the in-lesson image-attach button can reach the native
picker (`:491`, handler `:523-601`), and forced landscape + immersive mode (`:497-501`).
On Flutter Web it falls back to `launchUrl` in a new tab (`:399-407`).

## A.6 URL params and postMessage

**URL query params are the entire launch protocol.** Producers:
`LiveTeacherModal.buildIframeUrl` (`:19-42`) and
`ATeacherBridgeService.buildLaunchUri` (`lib/services/ateacher_bridge_service.dart:129-150`).
Consumer: `_parseUrlParams` in the Flutter client (`frontend/lib/main.dart:36-69`).

| Param | Meaning | Notes |
|---|---|---|
| `topic` | lesson title | required for autostart |
| `level` | beginner/intermediate/advanced | |
| `language`, `voice` | Edge-TTS voice id + lesson language | `config.py:62-99` maps voice→STT lang |
| `user_id` | host user id (string) | display/isolation only |
| `session_id` | **pre-created** session | makes the DB the source of truth |
| `token` | the opaque 24 h token | **in the query string** |
| `autostart` | `true` → skip setup UI | web modal sets it only when there is *no* session (`LiveTeacherModal.tsx:28-29`); mobile always sets `true` (`ateacher_bridge_screen.dart:396`) |
| `context` | URI-encoded raw context | legacy path, still parsed (`main.dart:42-50`) |
| `listen_for_context` | wait for a postMessage instead | `main.dart:62-63` |

`autostart && topic` routes straight to `LessonScreen`, else the client shows its own home screen
(`frontend/lib/app.dart:15-38`).

**postMessage exists but is dormant.** When `listen_for_context=1`, the lesson screen subscribes to
`window.onMessage` and starts the lesson on `{type: "ATEACHER_CONTEXT", context: "…"}`, with a
**2500 ms fallback** that starts anyway (`frontend/lib/features/lesson/lesson_screen.dart:78-100`).
No host surface sets `listen_for_context` and no host code calls `iframe.contentWindow.postMessage`
(greps over `next_app/src`, `lib/`) — so in the live contract **context travels only through the DB
row created in step 2**, and there is **zero child→parent messaging**: the host learns nothing from
the iframe, not even "lesson finished".

## A.7 Socket handshake and auth

There is **no socket authentication at all.**

- Client: `socket_io_client` pointed at `AppConstants.wsUrl` (= the API origin), transports forced to
  `polling`, auto-connect + 50 reconnect attempts, and **no `auth` payload, no token, no headers**
  (`frontend/lib/core/api_client.dart:56-80`).
- Server: `@socketio.on("connect")` just logs the sid and returns
  (`backend/websocket/events.py:188-191`); `SocketIO(..., cors_allowed_origins="*")`
  (`app.py:69-76`).
- Authorization is by **knowing a session_id**. `start_lesson` loads the row and, if it exists,
  overrides topic/level/language/voice/context from the DB, then `join_room(session_id)`
  (`events.py:203-254,313-320`). Unknown ids are rejected (`events.py:247-254`) — that is the only
  check. No user match, no token check, no tenancy.
- Worse, `student_question` falls back to `SessionService.get_active_session()` when the id is
  missing/unknown (`events.py:448-452`) — a cross-user leak by construction. `restore_session`
  joins a room and replays the board snapshot for **any** id with no checks at all
  (`events.py:753-798`).

Server→client events: `lesson_status`, `teacher_info`, `lesson_blueprint`, `lesson_plan`,
`lesson_step {speech, commands[]}`, `chapter_complete`, `concept_mastery`, `lesson_mastery`,
`lesson_summary`, `board_snapshot`, `error`. Client→server: `start_lesson`, `student_question`,
`pause_lesson`, `resume_lesson`, `continue_after_question`, `next_chapter`, `stop_lesson`,
`clear_board`, `attention_reset`, `restore_session`. For DB-backed launches the client sends
`context: ''` and lets the server read the blob (`lesson_controller.dart:536-546`).

## A.8 Where state lives, and who owns what

**ATeacher owns everything durable about the lesson.** Its eight tables
(`backend/models/database.py`, docstring at `:1-14`): `ateacher_teachers` (personas as rows, four
editable prompt columns, `:49-108`), `ateacher_users` (`:137-144`), `ateacher_user_tokens`
(`:161-169`), `ateacher_sessions` (`:194-212`), `ateacher_messages` (`:246-260`),
`ateacher_session_context` (`:281-295`), `ateacher_mastery_events` (`:310-325`),
`ateacher_board_snapshots` (`:344-359`), `ateacher_learning_events` (xAPI-shaped, `:375-404`).
Hot lesson state is **in-process dicts**: `_session_plans`, `_session_blueprints`
(`events.py:29-32`), `_sid_to_session`, `_active_streams` (`events.py:174-179`), plus board state
per session in `whiteboard_service`. Hence `-w 1`.

**The host app stores nothing.** No `ateacher_*` reads, no lesson mirror table, no cost row, no
mastery row, no analytics link. The host keeps only ephemeral React state
(`LiveTeacherContext.tsx:51-53`) or Flutter widget state.

## A.9 How results flow back to the host

**They don't.** There is no webhook, no callback URL, no polling loop, no shared-DB read, no
postMessage-back. The service exposes read endpoints that would allow polling —
`GET /api/session/<id>`, `GET /api/session/history`, `GET /api/session/<id>/messages`
(`routes/auth.py:295-320`) — and **no host code calls any of them** (verified by grep for
`api/session/` across `lib/`, `next_app/src/`, `skilldarbar_api/`: the only hits are the two broker
files). Lesson summaries, per-concept mastery (`events.py:801-887`), the xAPI learning-event stream
(`events.py:144-171`) and board snapshots all terminate inside ATeacher. From the school's
point of view, a lesson happened and left no trace in the LMS.

## A.10 Unauthenticated surface (inherited attack surface)

For completeness, because our design must not repeat it: `POST /api/lesson/start` creates a full
session with attacker-supplied context and **no auth** (`backend/routes/lesson.py:7-42`);
`GET /api/tts/stream?text=…&voice=…` synthesizes arbitrary text with no auth and a 1 h public cache
(`backend/routes/tts.py:43-90`); `POST /api/stt/transcribe` accepts audio with no auth
(`backend/routes/stt.py:18`); `GET /api/teachers/` is public by design (`routes/auth.py:328-339`).
And `backend/render.yaml:9-10` commits a live `GROQ_API_KEY` into the repo.

## A.11 The contract in one sequence

```
student clicks "Live Teach" (any host page)
  → host client  : openLiveTeacher({topic, context, …})        LiveTeacherContext.tsx:56
  → host SERVER  : POST /api/ateacher/session                  route.ts:22 / ateacher_routes.py:42
      → ATeacher : POST /api/auth/token   X-API-Key            routes/auth.py:167   ⇒ uuid token, 24h
      → ATeacher : POST /api/session/create  Bearer token      routes/auth.py:218   ⇒ session_id + context row
  ← host SERVER  : {token, session_id, expires_at}
  → host client  : iframe/WebView  ateacher.…?topic&…&session_id&token&autostart
      → client   : parse URL params                            main.dart:36
      → client   : socket.io connect (NO AUTH, polling)        api_client.dart:56
      → client   : emit start_lesson {session_id, context:''}  lesson_controller.dart:536
      → service  : load DB row+context, join_room(session_id)  events.py:219-320
      → service  : lesson_blueprint → lesson_plan → lesson_step* → chapter_complete → lesson_summary
  ✗ nothing flows back to the host. Ever.
```

---

# B. THE SAME CONTRACT, REDRAWN FOR ASCHOOL

Same shape — separate service, host-side broker, embedded player — with six things added that
Ashlya does not have: **per-tenant credentials, JWT-scoped sessions, authenticated sockets, a
school-side record of what happened, a cost/consent/moderation gate, and a callback so results come
home.** Everything below runs inside ASchool's existing conventions: `SchoolModel` (UUID PK +
`school_id` + TIMESTAMPTZ + soft delete, `backend/app/models/base.py:11-60`), `@plugin_required`
(`backend/app/plugins/decorators.py:81-117`), `g.school_id`/`g.installed_plugins`
(`backend/app/__init__.py:382,518`), `AITokenHub` (`backend/app/services/ai/token_hub.py:514-680`),
authenticated Socket.IO (`backend/app/realtime.py:53-131`), `ai_rate_limit`
(`backend/app/utils/rate_limiter.py:102-112`), and the workbench guardrail helpers
(`backend/app/services/ai/workbench.py:30-98,109-260`).

## B.1 Service topology (ASchool side)

```
                         ┌───────────────────────────────────────────┐
 browser / Flutter ─────►│ ASchool backend  (Flask, multi-tenant)    │
   (JWT cookie/bearer)   │  api/v1/ai-teacher/*        ← the broker  │
                         │  realtime.py  room lesson:{uuid}          │
                         │  ai_teacher_* tables  ← school truth      │
                         │  curriculum/teaching_* ← content (§C)     │
                         └───────┬───────────────────────┬───────────┘
                       S2S HTTPS │ X-ASchool-Key         │ HTTPS callback
                       (mTLS opt)│ + HMAC signature      │ (HMAC signed)
                         ┌───────▼───────────────────────┴───────────┐
                         │ AI Teacher service (unchanged deployable) │
                         │  /api/auth/token  /api/session/create     │
                         │  socket.io  · its own DB · its own Redis  │
                         └───────────────────────────────────────────┘
 player origin: teacher.<aschool-domain>  (iframe / WebView, own origin, CSP frame-src pinned)
```

Non-negotiables versus Ashlya: (1) the service gets **its own database**, never a table inside
ASchool's Postgres — the `ateacher_*`-tables-in-host-schema bleed (§A.1) is banned by review;
(2) the service is reachable **only** from the ASchool backend network for its S2S endpoints, and
from browsers only for socket + media; (3) the service is `-w N` capable or we accept `-w 1` per
school-shard and say so in the runbook (§E).

## B.2 Provisioning: how an install produces a credential

`ai_teacher` is a paid plugin that **depends_on `ai_suite`** (§D). Install → `POST /plugins/install`
→ `_run_plugin_hook(slug, "activate")` (`backend/app/api/v1/plugins.py:435`) → our `hooks.activate(db)`:

1. `model.__table__.create(db.engine, checkfirst=True)` for the plugin-owned tables (same pattern as
   `ai_adaptive_learning/hooks.py:23-30`).
2. Mint a **per-school service credential**:
   `key_id = "sch_" + school_id.hex[:12]`, `secret = secrets.token_urlsafe(48)`.
   Store `key_id` + `sha256(secret)` + `created_at` + `rotated_at` in `ai_teacher_service_keys`
   (school-scoped). The plaintext secret is written **once** to the process env-backed secret store
   (the same place `GROQ_API_KEY` lives, `backend/config.py:109`) if self-hosted, or POSTed to the
   service's `POST /admin/tenants` provisioning endpoint (the one endpoint we ask the service to add)
   and then dropped. It is **never** stored plaintext in `SchoolPlugin.config` and never returned by
   any API.
3. Register the tool row so the workbench guardrails apply:
   `AIToolRegistry(tool_key="ai_teacher_lesson", category="tutor", min_plan_tier="ai_suite",
   roles_allowed=["student","teacher","school_admin"], status="beta")` +
   `AINutritionFacts(tool_key="ai_teacher_lesson", …)` — the CI gate refuses `status="ga"` without
   the facts row (`backend/app/models/ai_workbench.py:50-79`).
4. Seed nothing else. Personas stay **service-side rows** (they are the service's prompt IP); ASchool
   reads them through `GET /personas` and caches (§B.4).

Deactivate = flip `SchoolPlugin.active` (no data touched, `plugins.py:780-810`) **plus** call the
service's tenant-disable so in-flight lessons stop; uninstall keeps lesson history (data), revokes
the key. Rotation: `POST /api/v1/ai-teacher/service-key/rotate` (superadmin/school_admin) issues a
new secret with a 24 h overlap window, both accepted, old one hard-revoked after.

**Why per-school keys and not one platform key:** a leaked platform key in Ashlya's model
(`config.py:39`, plain compare at `routes/auth.py:47-55`) lets anyone mint a token for **any**
`user_id`. With per-school keys the blast radius is one tenant, rotation is a single row, and the
service can attribute cost and rate limits per school without trusting the body.

## B.3 Brokering a lesson session — endpoint shapes

New blueprint `backend/app/plugins/modules/ai_teacher/routes.py`, mounted by the loader at
`/api/v1` (`backend/app/plugins/loader.py:246-248`). Every route: `@jwt_required()`,
`@school_required`, `@plugin_required("ai_teacher")`, `@ai_rate_limit(...)`.

```
POST /api/v1/ai-teacher/lessons
  body {
    persona_slug?          : "aria"
    topic?                 : "Reflection of Light"      # OR content refs below
    content_ref?           : { section_id | chapter_id | outcome_ids[] }   # §C, preferred
    level?                 : "beginner|intermediate|advanced"
    language?              : "en|ne|mixed"
    voice?                 : "ne-NP-HemkalaNeural"
    student_id?            : uuid    # required when role=teacher launching for a student
    max_minutes?           : int     # clamped to config lesson_max_minutes
  }
  → 201 {
      lesson_id            : uuid            # ASchool's id, the ONLY id clients use
      player_url           : "https://teacher.…/embed?lesson=<jwt>"   # jwt in FRAGMENT, see B.5
      socket_room          : "lesson:<uuid>"
      expires_at           : iso8601
      content_snapshot_id  : uuid            # which content version this lesson was grounded on
      persona              : {slug,name,accent,voice,language}
      estimated_cost_npr   : number         # from token_hub estimate, shown before start
    }
  errors 402 tier · 403 consent/kill-switch/role · 409 concurrent-lesson cap ·
         422 content not published · 429 rate/quota · 503 service down (§B.9)
```

Server-side sequence for that one call (the ASchool analogue of §A.3, with the ordering fixed so
nothing is spent before the gates pass):

1. **Gates first.** `SchoolAIToolSettings.enabled` kill switch → 403; `_require_plan_tier("ai_suite")`
   → 402; role check; if the subject is a student, `_require_guardian_consent(student_id)` → 403
   (`workbench.py:121-153`, `GuardianAIConsent` at `models/ai_workbench.py:217-232`).
   Grade allow-list from plugin config. Concurrency cap per school + per student.
2. **Resolve content, not prose.** From `content_ref`, read the published section/chapter from the
   §C schema (school override → platform row), build a **structured** context document
   (outcomes, teaching notes, worked examples, misconceptions, formulas, exam tips, media refs) in
   the requested language with EN fallback. Record `content_snapshot_id` = the exact
   `teaching_section_versions.id` used. If only `topic` was given (free-topic mode, gated by config
   `allow_free_topic`), the context is empty and the lesson is marked `grounded=false`.
3. **Sanitize.** `detect_injection()` on topic + any free text (`workbench.py:71-78`);
   `pseudonymize()` names (`workbench.py:30-51`); wrap the content document in
   `<source id="…" trust="curriculum">…</source>` and instruct the service to treat it as data.
4. **Budget.** `AITokenHub`-style estimate of a lesson (chapters × per-chapter tokens) →
   check against `SchoolPlugin.config.monthly_cost_ceiling_npr` and the existing
   `AISchoolQuota` daily/monthly (`models/ai_token.py:8-17`); reserve.
5. **Create ASchool's row first.** `ai_teacher_lessons` row (status `pending`) — ASchool's UUID is
   canonical. This is the structural fix for Ashlya's B-06 session-id divergence.
6. **Then call the service, S2S:** `POST {svc}/api/auth/token` with
   `X-ASchool-Key: <key_id>`, `X-ASchool-Signature: hmac_sha256(secret, ts + body)`,
   `X-ASchool-Timestamp`, body `{tenant_id, user_ref, display_name}` where **`user_ref` is a
   per-school pseudonymous id** (`hmac(school_secret, user_id)`), not the real UUID, and no email.
   Then `POST {svc}/api/session/create` with `Authorization: Bearer <svc token>` and
   `{external_lesson_id: <our uuid>, topic, level, language, voice, persona_slug,
   context_document, callback_url, callback_secret_id, max_minutes}`.
7. **Mint OUR player token** (§B.5), store the service's `session_id` on our row, flip status to
   `ready`, return.

Remaining endpoints (all school-scoped, all reading ASchool's own tables — the host is never blind
again):

```
GET    /ai-teacher/personas                     cached passthrough (+ per-school allow-list)
GET    /ai-teacher/lessons?student_id&status     history for the logged-in scope
GET    /ai-teacher/lessons/<id>                  lesson + chapters + cost + grounding refs
GET    /ai-teacher/lessons/<id>/messages         transcript (mirrored, see B.6)
GET    /ai-teacher/lessons/<id>/summary          summary + per-concept mastery
POST   /ai-teacher/lessons/<id>/stop             student/teacher stop → tells the service
POST   /ai-teacher/lessons/<id>/report           safety report on a lesson → ModerationFlag
GET    /ai-teacher/mastery?student_id            mastery rollup for dashboards/report cards
GET    /ai-teacher/usage                          per-school cost + minutes (admin)
POST   /ai-teacher/service-key/rotate             admin, rotates the S2S secret
POST   /ai-teacher/webhooks/lesson-event          ← THE SERVICE CALLS THIS (HMAC, no JWT)
GET    /ai-teacher/content/section/<id>           ← THE SERVICE PULLS CONTENT (§C.7, S2S)
```

## B.4 What ASchool persists vs what the service owns

| Concern | Owner | Where |
|---|---|---|
| Lesson existence, who/when/what/how long | **ASchool** | `ai_teacher_lessons` |
| Grounding — which content version taught | **ASchool** | `lesson.content_snapshot_id` → §C versions |
| Chapter outcomes + mastery per concept | **ASchool** | `ai_teacher_lesson_chapters`, `ai_teacher_mastery` (keyed **student_id + concept_key**, so it survives lessons and feeds report cards) |
| Transcript (for audit/parent view) | **ASchool** mirror, service master | `ai_teacher_messages` (written by the callback, retention = plugin config `transcript_retention_days`) |
| Cost + tokens + provider | **ASchool** | `ai_usage_logs` via token_hub + `lesson.cost_npr` |
| Learning events (xAPI) | **ASchool** | `ai_teacher_learning_events` (the service's shape is already xAPI-ish, `events.py:144-171`) |
| Safety flags | **ASchool** | existing `ModerationFlag` (`models/ai_workbench.py:235-249`) |
| Persona prompt text (4 columns) | **service** | prompt IP stays there; ASchool caches display fields only |
| Board/whiteboard state, slide snapshots, SVG | **service** | ASchool stores at most a per-chapter PNG/PDF export in its file storage |
| Streaming/LLM orchestration, TTS/STT | **service** | ASchool never proxies audio bytes |
| The 24 h service token | **service** | never leaves the ASchool backend |

Rule of thumb: **anything a school would put on a report card, an audit, an invoice or a DPDP
subject-access request lives in ASchool. Anything about how the lesson was rendered lives in the
service.**

## B.5 JWT + socket auth with school scoping

**Player token.** ASchool mints a short-lived RS256/HS256 JWT (`aud: "ai-teacher-player"`,
`ttl ≤ 15 min`, single-use `jti`) with claims
`{sub: user_id, school_id, lesson_id, service_session_id, role, scope:["lesson:play"], exp}`.
It is delivered in the **URL fragment** (`#t=…`) or, preferably, POSTed to the player origin which
immediately swaps it for an httpOnly cookie on its own origin. Ashlya's `?token=` query param
(`main.dart:60`, `LiveTeacherModal.tsx:38`) is banned: query strings land in access logs, browser
history, `Referer`, and Android WebView logs.

**Socket handshake — no token, no connection.** Reuse ASchool's contract verbatim
(`backend/app/realtime.py:40-100`): token from the socket.io `auth` payload, `Authorization`
header, or the httpOnly cookie; `decode_token`; live non-deleted active user; `iat` vs
`tokens_invalid_before`. Then add a lesson layer:

```python
@socketio.on("join_lesson")
def on_join_lesson(data):
    st = _sessions.get(str(request.sid)) or {}          # realtime.py:33
    if not st: return {"success": False, "error": "Not authorized"}
    lesson = AITeacherLesson.query.filter_by(
        id=data.get("lesson_id"), school_id=st["school_id"], is_deleted=False
    ).first()
    if lesson is None:
        return {"success": False, "error": "Unknown lesson"}     # 404-equivalent, no leak
    if st["role"] == "student" and str(lesson.student_user_id) != st["user_id"]:
        return {"success": False, "error": "Forbidden"}
    join_room(f"lesson:{lesson.id}")                    # school-scoped by construction
```

Every subsequent event re-derives the lesson from `_sessions[sid]`, never from the payload — killing
Ashlya's "knowing a session_id is authorization" model (§A.7), its
`get_active_session()` cross-user fallback (`events.py:448-452`) and its unauthenticated
`restore_session` (`events.py:753-798`). Teachers may join `lesson:*` for their own class in
read-only mirror mode; parents may not join live (they get the summary).

Server→client event names stay the ones the player already speaks (`lesson_status`, `lesson_plan`,
`lesson_step`, `chapter_complete`, `concept_mastery`, `lesson_summary`, `board_snapshot`, `error`)
so the vendor client works, **plus** `seq` on every `lesson_step` for ack-based backpressure.

## B.6 Results coming home (the thing Ashlya has none of)

The service posts to `POST /api/v1/ai-teacher/webhooks/lesson-event` — no JWT, authenticated by
`X-ASchool-Key` + HMAC over `timestamp + raw body` with a ±300 s window and a replay cache on
`event_id`. Idempotent by `(lesson_id, event_id)`.

```json
{ "event_id":"…","lesson_id":"<aschool uuid>","service_session_id":"…","ts":"…",
  "type":"lesson.started|chapter.completed|question.asked|mastery.updated|
          lesson.summary|lesson.ended|lesson.error|usage.reported",
  "payload":{ … } }
```

Handlers: `lesson.started` → status/started_at; `chapter.completed` → chapter row + outcome links;
`question.asked` → message mirror + `moderate()` (critical self-harm → `ModerationFlag` +
existing wellbeing escalation, `workbench.py:243-260`); `mastery.updated` → upsert
`ai_teacher_mastery` (student_id + concept_key) → feeds adaptive learning and report cards;
`lesson.summary` → summary text + evidence; `lesson.ended` → duration, chapters completed,
`lesson.error` → honest failure record; `usage.reported` → tokens/model/provider →
`AIUsageLog` row + `reconcile_quota_reservation` (`token_hub.py:413-426`).

**Belt and braces:** a Celery reconciler (`ai_teacher.reconcile_lessons`, every 10 min) polls
`GET {svc}/api/session/<id>` for lessons stuck in `teaching`/`ready` past `max_minutes + 5`, and
closes them as `abandoned` with whatever the service reports. Webhooks are best-effort; the poller
is the source of eventual truth. Ashlya has neither.

## B.7 Guardrails

| Guardrail | Mechanism (existing ASchool code) |
|---|---|
| Plugin gating | `@plugin_required("ai_teacher")` + `depends_on: [ai_suite]`; web pages wrapped in `<PluginGate slug="ai_teacher">` (`frontend/lib/plugins.tsx:253-352`); Flutter `PluginGate` from `aschool_shared` |
| Tier | `_require_plan_tier("ai_suite")` → 402 (`workbench.py:288-297`) |
| Kill switch | `SchoolAIToolSettings(tool_key="ai_teacher_lesson").enabled = false` → 403 in one request (`models/ai_workbench.py:115-127`) — plus a platform-wide env kill switch for incident response |
| Consent for minors | `GuardianAIConsent(scope="tutor")` must be granted before any student-subject lesson; revocation blocks new lessons and stops live ones on next event |
| Moderation | `moderate()` on every student question and on teacher speech before it reaches the student; `critical` → `ModerationFlag` + wellbeing path; strictness (`standard|strict`) from plugin config controls whether medium-severity pauses the lesson |
| Injection | `detect_injection()` on topic/question; **content documents are delimited and labelled `trust="curriculum"`** — admin-entered content is trusted-but-delimited, free-text is untrusted |
| PII | pseudonymized names in prompts; `user_ref` is an HMAC, not the user UUID; no email crosses the boundary (Ashlya sends real name + email, `route.ts:64-68`) |
| Transparency | `AINutritionFacts` row rendered on the AI Nutrition Facts page; every lesson shows model/provider/cost to admins |
| Data retention | `transcript_retention_days` config; nightly purge task; DPDP subject-access export from ASchool's own tables |

## B.8 Cost accounting through token_hub

The service burns the tokens, so ASchool cannot log them at call time. Two-sided accounting:

1. **Pre-flight reservation** at lesson create: estimate with the existing helper
   (`estimate_cost_usd`, `token_hub.py:74-90`) using planned chapters × the measured per-chapter
   envelope (blueprint ≈ 8-15k prompt / 3-6k completion per chapter — measured in
   `ATEACHER_INTEGRATION_BLUEPRINT.md` §10.1), then `_check_quota(school_id, est_cost_usd=…)` and
   `_reserve_cost` (`token_hub.py:343-411`). A school at its ceiling gets a clean 429 **before** the
   service is called.
2. **Post-hoc reconciliation** from `usage.reported` webhooks: write an `AIUsageLog` row per
   reported call with `feature="ai_teacher:lesson"`, real `prompt_tokens/completion_tokens/model/
   provider/cost_usd`, then `reconcile_quota_reservation(school_id, est, actual)`
   (`token_hub.py:413-426`). Rollups land in `AIToolAnalyticsDaily`
   (`models/ai_workbench.py:252-268`) so the existing `analytics/ai-usage` page shows AI Teacher
   next to every other tool with no new dashboard.

If the service refuses to report usage, we bill the estimate and flag the lesson
`cost_source="estimated"` — visible in the admin UI. We never pretend a number is measured.

## B.9 Rate limits

| Limit | Value (config-overridable) | Where |
|---|---|---|
| Lesson creates per student | 6 / day, 2 / hour | `ai_rate_limit` keyed school+user (`rate_limiter.py:102-112`) |
| Lesson creates per school | 200 / day | school-keyed `rate_limit` |
| Concurrent live lessons | per school = `min(config.max_concurrent, plan cap)`; per student = 1 | DB count check at create → 409 |
| Questions per lesson | 40 (config `max_questions_per_lesson`) | orchestrator, enforced service-side via `max_minutes`/`max_questions` in the create payload, re-checked on `question.asked` |
| Webhook ingest | 600 / min per school key | key-hashed limiter, same pattern as `device_rate_limit` (`rate_limiter.py:115-124`) |
| Content read API (S2S) | 300 / min per key | protects §C reads |
| Minutes per student per month | `config.monthly_minutes_per_student` | checked at create from `ai_teacher_lessons` sum |

## B.10 Failure modes — degrade honestly

Ashlya's honesty baseline is actually decent here and worth keeping: missing key → 503 "AI Teacher is
temporarily unavailable" (`route.ts:23-29`; `ateacher_routes.py:60-62`), connection error → 503,
timeout → 504, upstream non-200 → 502 with the service's message
(`ateacher_routes.py:87-131`). We keep those codes and add:

| Failure | Behaviour | User-visible text |
|---|---|---|
| Key not provisioned / plugin misconfigured | 503, `error_code="ai_teacher_not_configured"`, admin banner in settings | "AI Teacher is not configured for your school yet." |
| Service unreachable / 5xx / timeout | 503 or 504; lesson row written `status=failed`, **no reservation consumed**; retry-after hint | "The AI teacher service isn't responding. Nothing was charged. Try again in a few minutes." |
| Service healthy but LLM provider down | service reports `lesson.error`; ASchool offers the **honest fallback**: open the same chapter as a *readable* lesson from the §C content (notes, worked examples, misconceptions, formulas) — no fake teaching, clearly labelled "Text lesson — AI teacher unavailable" | "Live teaching is unavailable. Here is the chapter's notes and worked examples." |
| Quota/ceiling exhausted | 429 with the exact number used/limit (reuse `QuotaExceededError`, `token_hub.py:151-161`) | "Your school's AI budget for this month is used up." |
| Consent missing/revoked | 403, deep-link to the guardian consent screen | "A guardian needs to approve AI tutoring for this student." |
| Kill switch on | 403 | "AI Teacher has been turned off by your school admin." |
| Socket drops mid-lesson | client reconnects, re-`join_lesson`, service replays board snapshot; if the service lost in-process state → lesson closes as `interrupted` with partial mastery kept | "Connection lost — your progress up to chapter N was saved." |
| Webhook never arrives | reconciler closes the lesson, marks `cost_source="estimated"`, mastery from last known event | lesson shows "ended (unconfirmed)" in history |
| Content not published | 422 at create — never teach a draft | "This chapter hasn't been published yet." |

Anti-requirement: **no silent degradation to a generic chatbot.** If the whiteboard teaching path is
unavailable, we say so and hand back content, rather than substituting a different product.

---

# C. CONTENT SCHEMA — ADMIN-ENTERED TEACHING CONTENT (NO OCR)

## C.1 The decision, stated plainly

Ashlya feeds the AI teacher **prose scraped together at click time**: a notes preview
(`NotesToolbar.tsx:70-80`), a quiz digest (`QuizDetailAssistant.tsx:335-357`), or OCR text from a
phone camera (`ateacher_bridge_screen.dart:239-341`). It is then markdown-stripped and truncated to
150 000 chars (`routes/auth.py:96-136`). The service has no notion of unit, outcome or grade; there
is no provenance, no review, no reuse, no Nepali parity, and OCR errors become taught facts.

ASchool takes the opposite bet: **teaching content is first-class, normalized, multi-tenant,
versioned and bilingual data, entered by platform curriculum admins and school admins through
ordinary CRUD screens.** There is no OCR, no vision model, no PDF-scan ingestion, no "attach a photo
of your book" path anywhere. Media (a diagram, an audio clip) can be *attached* as a file reference
for the player to display, but it is never *parsed* for meaning. The AI teacher pulls a structured
document over a read API (§C.7) and teaches from it; if a chapter is not authored and published, the
lesson is refused (422, §B.10) rather than hallucinated.

## C.2 How it composes with what already exists (no duplication)

Already in ASchool — **reused, not rebuilt**:

| Existing | File | Role in this design |
|---|---|---|
| `curriculum_frameworks` (board, grade, subject_code, subject_name, `school_id` NULL = platform) | `backend/app/models/curriculum.py:16-44` | **is** the framework → subject → grade level. No new table. |
| `curriculum_units` (unit_no, title_en, title_ne, periods, weight_pct) | `curriculum.py:47-71` | **is** the chapter/unit level. No new table. |
| `learning_outcomes` (code, statement_en, statement_ne, bloom) | `curriculum.py:74-94` | **is** the outcome level. New content links *to* these rows; outcome text is never copied. |
| `subject_offerings` (theory/practical full+pass marks) | `curriculum.py:97-130` | exam-weighting context for "exam tips"; untouched. |
| CDC/NEB seed (grades 1-10 core + 11-12 streams) | `backend/app/services/ai/curriculum_seed.py:9-120` | the frameworks/units our sections hang off already exist and are idempotent. |
| `AIGeneration` provenance ledger | `models/ai_workbench.py:20-47` | any AI-*assisted* draft of a note records its `ai_generation_id` — so "was this written by a human or an LLM?" is answerable. |
| `ai_generations.citations` JSONB | `models/ai_workbench.py:45` | lesson generations cite `teaching_section_versions.id`, closing the grounding loop. |
| `courses/lessons/topics/study_materials` (LMS) | `models/lms.py:20-110` | **stays school course delivery.** It is per-school, not curriculum-anchored, not versioned, not bilingual-paired. A `teaching_sections.lms_topic_id` nullable FK links the two when a school wants them aligned — one column, no fork. |

**The gap being filled** is everything *below* `curriculum_units`: there is nowhere today to store a
section's teaching notes, worked examples, misconceptions, formulas or exam tips, no draft→published
workflow, no version identity to cite, and no school-override chain. That is the eight new tables
below, all prefixed `teaching_`, all inheriting the ASchool base contract (UUID PK
`gen_random_uuid()`, TIMESTAMPTZ `created_at`/`updated_at`, `is_deleted` soft delete —
`models/base.py:11-43`).

## C.3 Entity map

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

Two structural choices worth defending:

- **The version, not the section, owns the content.** Blocks FK to
  `teaching_section_versions.id`, so editing a draft can never mutate what is live, and a lesson can
  cite an immutable id forever. A published version is append-only; "editing" clones it to `v+1`
  draft.
- **Overrides are rows, not JSON patches.** A school row carries
  `school_id` + `overrides_section_id` pointing at the platform section it replaces. Resolution is
  one COALESCE-style query, diffs are inspectable, and a platform content fix can be re-adopted by
  clearing the override. §C.6.

## C.4 DDL — identity, versions, outcomes

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

`mastery_key` is the join to §B.4's `ai_teacher_mastery` (keyed `student_id + concept_key`): a
lesson's mastery signals are recorded against curriculum outcomes, not against ad-hoc chapter
titles. That single column is what makes spaced repetition and report-card evidence possible —
Ashlya's mastery keys are LLM-invented chapter labels (`events.py:849-878`) and therefore unusable
across lessons.

## C.5 DDL — content blocks (all FK the version, all bilingual)

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
  source_ref     VARCHAR(200),                           -- "CDC Sci G10 Ex 2.3 Q4" (text, typed by admin)
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
  file_id       UUID NULL REFERENCES files(id),  -- ASchool file storage
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

-- ── Snapshot: the immutable document handed to the AI service ─────────────
CREATE TABLE teaching_content_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NULL REFERENCES schools(id),
  version_id     UUID NOT NULL REFERENCES teaching_section_versions(id),
  language       VARCHAR(8)  NOT NULL,           -- en | ne | mixed
  document       JSONB       NOT NULL,           -- the exact payload sent (§C.7)
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

## C.6 Versioning, publish workflow, and the override chain

**State machine** (enforced in the service layer, audited in `teaching_content_reviews`):

```
draft ──submit──► in_review ──approve/publish──► published ──(edit)──► new draft (v+1)
  ▲                   │                              │
  └────reject─────────┘                              └──archive──► archived
```

- Only `curriculum_admin`/`superadmin` may publish platform rows (`school_id IS NULL`);
  `school_admin` (and a `content_editor` role) may publish their own school's rows.
- `uq_tsv_one_published` guarantees exactly one live version per section, so the read API never has to
  disambiguate.
- Publishing computes `content_sha256` + `language_coverage`. A **publish gate** refuses when: no
  `primary` outcome link; zero `teaching_notes` blocks; `body_en` empty on any block; media without
  `alt_text_en`; a formula without `spoken_en`; or (config-gated) `require_nepali=true` and any
  `*_ne` primary field missing. Honest bilingual state beats fake bilingual state — a section may
  ship EN-only with `language_coverage.ne=false`, and the launcher then tells the student "Nepali not
  available for this chapter yet" instead of machine-translating silently at teach time.
- Archived versions are never deleted: lessons cite version ids and a parent must still be able to
  see what their child was taught in Baisakh.

**Resolution order** for a `(unit, section_code)` in school S, language L:

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

School row wins; platform row is the fallback; a school "fork" is created by cloning the platform
section into a school row with `overrides_section_id` set (the clone copies the published version's
blocks as a `draft` v1). Clearing the override re-adopts platform content — which is how a
curriculum correction reaches 400 schools without 400 edits.

## C.7 The read API the AI Teacher pulls

One S2S endpoint, key+HMAC authenticated (same credential as §B.2), read-only, cacheable:

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
                        "diagnostic_question":{…},"severity":"common",
                        "outcome_code":"…"} ],
    "formulas": [ {"name":{…},"latex":"…","spoken":{…},"symbols":[…],
                   "conditions":{…},"derivable":true,"must_memorize":false} ],
    "exam_tips":[ {"type":"trap","board":"see","pattern":"4-mark numerical",
                   "typical_marks":4,"appeared_years":[2078,2080],"body":{…}} ],
    "key_terms":[ {"en":"refraction","ne":"अपवर्तन","keep_in_english":true,
                   "definition":{…}} ],
    "media":    [ {"id":"…","type":"svg","svg_inline":"<svg …>","alt_text":{…},
                   "caption":{…},"licence":"CC-BY-4.0"} ],
    "trust": "curriculum", "generated_at":"…", "etag":"W/\"<sha256>\""
  }
  304 on If-None-Match · 404 unknown/unpublished · 401 bad signature · 429 rate limited
```

`language=mixed` returns both `en` and `ne` fields and the `keep_in_english` flags — the service's
mixed Nepali+English mode (Ashlya exposes it as a UI chip,
`ateacher_bridge_screen.dart:1258-1305`) then has real data instead of guessing which nouns to keep.
`depth=outline` returns the section/outcome/heading skeleton only, for planning calls; `full` for
teaching. Both are wrapped by the caller in `<source trust="curriculum">` (§B.7).

Companion endpoints (same auth): `GET /content/units/{unit_id}/sections` (ordered outline for
multi-section lessons) and `GET /content/search?grade=&subject=&q=` (launcher picker, ASchool-internal
JWT version for the UI).

## C.8 SQLAlchemy model sketch

```python
# backend/app/models/teaching_content.py
"""Admin-entered teaching content (no OCR): sections → versions → blocks.

Extends the EXISTING curriculum chain (app/models/curriculum.py:
CurriculumFramework → CurriculumUnit → LearningOutcome) with the layer that
was missing: what to actually teach, versioned, bilingual, publishable, and
overridable per school. Nothing here duplicates curriculum.py or lms.py.
"""
from sqlalchemy import (
    ARRAY, Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index,
    Integer, String, Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel   # UUID PK + TIMESTAMPTZ + soft delete


class TeachingSection(BaseModel):
    """Stable identity of a teachable slice of a curriculum unit.

    school_id NULL  → platform-seeded (curriculum team)
    school_id set   → school's own row; overrides_section_id points at the
                      platform row it replaces (resolution: school → platform).
    """
    __tablename__ = "teaching_sections"

    school_id  = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)
    unit_id    = Column(UUID(as_uuid=True), ForeignKey("curriculum_units.id"),
                        nullable=False, index=True)
    overrides_section_id = Column(UUID(as_uuid=True), ForeignKey("teaching_sections.id"))
    lms_topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id"))   # optional alignment
    section_no = Column(Integer, nullable=False)
    code       = Column(String(60), nullable=False)
    kind       = Column(String(24), nullable=False, default="concept")
    title_en   = Column(String(300), nullable=False)
    title_ne   = Column(String(300))
    summary_en = Column(Text)
    summary_ne = Column(Text)
    estimated_minutes = Column(Integer, nullable=False, default=12)
    difficulty = Column(String(16), nullable=False, default="core")
    prerequisite_section_ids = Column(ARRAY(UUID(as_uuid=True)), default=list)
    tags       = Column(JSONB, default=list)
    is_active  = Column(Boolean, nullable=False, default=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    unit     = relationship("CurriculumUnit", backref="teaching_sections")
    versions = relationship("TeachingSectionVersion", backref="section",
                            cascade="all, delete-orphan",
                            order_by="TeachingSectionVersion.version_no")

    __table_args__ = (
        CheckConstraint("kind IN ('concept','derivation','procedure',"
                        "'experiment','reading','revision')", name="ck_teaching_sections_kind"),
        CheckConstraint("difficulty IN ('foundation','core','stretch')",
                        name="ck_teaching_sections_difficulty"),
        CheckConstraint("overrides_section_id IS NULL OR school_id IS NOT NULL",
                        name="ck_teaching_sections_override_scope"),
        Index("uq_teaching_sections_platform_code", "unit_id", "code", unique=True,
              postgresql_where=text("school_id IS NULL AND is_deleted = false")),
        Index("uq_teaching_sections_school_code", "school_id", "unit_id", "code", unique=True,
              postgresql_where=text("school_id IS NOT NULL AND is_deleted = false")),
        Index("ix_teaching_sections_unit_order", "unit_id", "section_no"),
    )

    @property
    def published_version(self):
        return next((v for v in self.versions
                     if v.status == "published" and not v.is_deleted), None)


class TeachingSectionVersion(BaseModel):
    """The publish unit AND the citation unit. Published rows are immutable;
    editing clones to version_no + 1 as a draft."""
    __tablename__ = "teaching_section_versions"

    school_id  = Column(UUID(as_uuid=True), ForeignKey("schools.id"), index=True)
    section_id = Column(UUID(as_uuid=True), ForeignKey("teaching_sections.id"),
                        nullable=False, index=True)
    version_no = Column(Integer, nullable=False)
    status     = Column(String(16), nullable=False, default="draft")
    supersedes_id = Column(UUID(as_uuid=True), ForeignKey("teaching_section_versions.id"))
    language_coverage = Column(JSONB, default=lambda: {"en": False, "ne": False})
    content_sha256 = Column(String(64))
    change_note    = Column(Text)
    ai_generation_id = Column(UUID(as_uuid=True), ForeignKey("ai_generations.id"))
    authored_by_id  = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    submitted_at    = Column(DateTime(timezone=True))
    reviewed_by_id  = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    reviewed_at     = Column(DateTime(timezone=True))
    published_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    published_at    = Column(DateTime(timezone=True))
    archived_at     = Column(DateTime(timezone=True))

    notes          = relationship("TeachingNote", backref="version",
                                  cascade="all, delete-orphan", order_by="TeachingNote.block_no")
    examples       = relationship("TeachingExample", backref="version", cascade="all, delete-orphan")
    misconceptions = relationship("TeachingMisconception", backref="version", cascade="all, delete-orphan")
    formulas       = relationship("TeachingFormula", backref="version", cascade="all, delete-orphan")
    exam_tips      = relationship("TeachingExamTip", backref="version", cascade="all, delete-orphan")
    key_terms      = relationship("TeachingKeyTerm", backref="version", cascade="all, delete-orphan")
    media          = relationship("TeachingMedia", backref="version", cascade="all, delete-orphan")
    outcome_links  = relationship("TeachingSectionOutcome", backref="version", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("status IN ('draft','in_review','published','archived','rejected')",
                        name="ck_tsv_status"),
        UniqueConstraint("section_id", "version_no", name="uq_tsv_section_version"),
        Index("uq_tsv_one_published", "section_id", unique=True,
              postgresql_where=text("status = 'published' AND is_deleted = false")),
        Index("ix_tsv_school", "school_id", "status"),
    )

# TeachingSectionOutcome(version_id, outcome_id → learning_outcomes.id, emphasis,
#     mastery_key, sort_order) — link table; outcome TEXT is never copied.
# TeachingNote(version_id, block_no, block_type, heading_en/ne, body_en/ne,
#     speaker_note_en/ne, board_hint, media_id)
# TeachingExample(version_id, example_no, kind, difficulty, prompt_en/ne,
#     given_en/ne, steps JSONB, answer_en/ne, answer_latex, unit_label, marks, source_ref)
# TeachingMisconception(version_id, wrong_belief_en/ne, why_students_think_en/ne,
#     correction_en/ne, diagnostic_question_en/ne, severity, linked_outcome_id)
# TeachingFormula(version_id, name_en/ne, latex, spoken_en/ne, symbols JSONB,
#     conditions_en/ne, derivable, must_memorize)
# TeachingExamTip(version_id, tip_type, body_en/ne, exam_board, question_pattern,
#     typical_marks, appeared_years JSONB, subject_offering_id)
# TeachingKeyTerm(version_id, term_en, term_ne, keep_in_english, definition_en/ne)
# TeachingMedia(version_id, media_type, file_id → files.id, external_url, svg_inline,
#     alt_text_en/ne, caption_en/ne, licence, attribution)
# TeachingContentSnapshot(school_id, version_id, language, document JSONB,
#     document_sha256, token_estimate, built_at)
# TeachingContentReview(school_id, version_id, action, from_status, to_status,
#     actor_id, comment)
```

Migration: one Alembic revision creating the eleven tables, the partial unique indexes and the
deferred `teaching_notes.media_id` FK. Platform seeding extends the existing idempotent
`seed_curriculum()` (`backend/app/services/ai/curriculum_seed.py:52-120`) with a second pass that
creates `teaching_sections` + a published v1 for the CDC units it already writes — starting with
Science and Math grades 8-10, which is where the AI teacher earns its keep.

---

# D. THE ASCHOOL PLUGIN PACKAGE

Ships as one Odoo-style module package — the loader discovers it by globbing
`app/plugins/modules/*/manifest.yaml` (`backend/app/plugins/loader.py:53-58`), auto-detects
`config_schema.yaml` and `hooks.py` next to the manifest (`loader.py:167-201`), mirrors the manifest
into the `plugins` catalog table on refresh (`loader.py:337-420`) and mounts the blueprint at
`/api/v1` (`loader.py:238-254`).

```
backend/app/plugins/modules/ai_teacher/
├── __init__.py
├── manifest.yaml          # catalog entry, pricing, sidebar, flutter surfaces, deps
├── config_schema.yaml     # the settings screen (SchoolPlugin.config)
├── hooks.py               # activate / deactivate / uninstall
├── routes.py              # the broker blueprint (ai_teacher_bp, url_prefix="/ai-teacher")
├── service_client.py      # HTTP client for the AI Teacher service (key+HMAC, timeouts, breaker)
├── content_api.py         # the S2S content read endpoints (§C.7)
├── webhooks.py            # HMAC-verified callback ingest (§B.6)
└── tasks.py               # reconcile_lessons, purge_transcripts, rollup_usage (Celery)
```

Models live at `backend/app/models/ai_teacher.py` + `backend/app/models/teaching_content.py`
(manifest `models_module` / `models` pointers are validated on boot,
`loader.py:104-134` — broken pointers log ERROR, so they must be real).

## D.1 `manifest.yaml`

```yaml
slug: ai_teacher
name: "AI Teacher (Live Whiteboard Tutor)"
name_nepali: "एआई शिक्षक (लाइभ ह्वाइटबोर्ड ट्युटर)"
category: premium
price_monthly: 1499
price_yearly: 14990
is_free: false
trial_days: 14
emoji: "👩‍🏫"
icon: "PenTool"
version: "1.0.0"
author: "ASchool"
published: true
coming_soon: false
description: >-
  A live one-to-one AI teacher that speaks and hand-writes on an animated
  whiteboard, chapter by chapter, grounded in your published curriculum content
  (units, learning outcomes, teaching notes, worked examples, misconceptions,
  formulas, exam tips) in English or Nepali. Students can interrupt and ask by
  voice or text; the lesson pauses, answers on the same board, and resumes.
  Mastery per learning outcome flows back into progress reports.
  Runs on a dedicated AI Teacher service; this plugin brokers sessions,
  enforces consent/moderation/cost limits and keeps the school's record.

api_blueprint: "app.plugins.modules.ai_teacher.routes"
models_module: "app.models.ai_teacher"
models:
  - "app.models.ai_teacher"
  - "app.models.teaching_content"
services:
  - "app.plugins.modules.ai_teacher.service_client"
  - "app.plugins.modules.ai_teacher.content_api"
tasks:
  - "app.plugins.modules.ai_teacher.tasks"

# ai_suite carries the AI licensing tier the workbench guardrails check
# (_require_plan_tier → "ai_suite"); academics carries curriculum_units, which
# every lesson is grounded on. Both are hard dependencies, not soft hints.
depends_on:
  - ai_suite
  - academics
conflicts_with: []

frontend:
  route: "/dashboard/ai-teacher"
  sidebar:
    section: "Learning"
    label: "AI Teacher"
    label_nepali: "एआई शिक्षक"
    icon: "PenTool"
    subitems:
      - { label: "Start a Lesson",     route: "/dashboard/ai-teacher" }
      - { label: "Lesson History",     route: "/dashboard/ai-teacher/lessons" }
      - { label: "Mastery",            route: "/dashboard/ai-teacher/mastery" }
      - { label: "Teaching Content",   route: "/dashboard/ai-teacher/content" }
      - { label: "Usage & Cost",       route: "/dashboard/ai-teacher/usage" }
      - { label: "Settings",           route: "/dashboard/settings/ai-teacher" }
    visible_to: ["school_admin", "teacher", "student"]

flutter:
  admin_app:
    { feature_folder: "ai_teacher", tabs: ["Usage", "Content", "Safety"] }
  teacher_app:
    { feature_folder: "ai_teacher", tabs: ["Assign Lesson", "Live", "Mastery"] }
  student_app:
    { feature_folder: "ai_teacher", tabs: ["Learn", "My Lessons", "Due for Review"] }
  parent_app:
    { feature_folder: "ai_teacher", tabs: ["Child's Lessons", "Consent"] }

events:
  emits:
    - "ai_teacher.lesson_started"
    - "ai_teacher.lesson_completed"
    - "ai_teacher.mastery_updated"
    - "ai_teacher.moderation_flagged"
    - "ai_teacher.cost_ceiling_reached"
    - "ai_teacher.service_unavailable"
  listens:
    - "curriculum.content_published"     # invalidate content snapshots/ETags
    - "student.consent_revoked"          # stop live lessons for that student
    - "plugin.deactivated"               # kill in-flight lessons
```

## D.2 `config_schema.yaml` — everything an admin controls

Rendered by the generic settings screen; values land in `SchoolPlugin.config` (JSONB) and are read
back via `GET /plugins/ai_teacher/config` (`backend/app/api/v1/plugins.py:812-826`), updated via
`PUT` with merge-or-replace semantics (`plugins.py:829-883`, 
`sp.config` is reassigned + `flag_modified`, never mutated in place).

```yaml
# AI Teacher plugin settings (SchoolPlugin.config).
# Real consumers are named per field — a setting with no consumer is a lie.
fields:
  # ── Service connection ────────────────────────────────────────────────
  - key: service_base_url
    label: "AI Teacher service URL"
    type: string
    default: ""
    help: "HTTPS base URL of the AI Teacher service. Leave blank to use the platform default."
    admin_only: true            # school_admin sees it read-only; superadmin edits
  - key: player_base_url
    label: "Lesson player URL"
    type: string
    default: ""
    help: "Origin of the embedded whiteboard player. Must be allowed by the site CSP frame-src."
    admin_only: true
  - key: service_key_id
    label: "Service key id"
    type: string
    default: ""
    readonly: true
    help: "Read-only. Provisioned on install; use Rotate Key to replace. The secret is never shown."

  # ── Teaching persona & voice ──────────────────────────────────────────
  - key: default_persona_slug
    label: "Default teacher persona"
    type: select
    options: ["aria", "max", "sophia", "leo", "nova"]
    default: "aria"
    help: "Which teacher character starts by default. Students may switch if allowed below."
  - key: allow_student_persona_choice
    label: "Let students choose the teacher"
    type: boolean
    default: true
  - key: default_language
    label: "Default teaching language"
    type: select
    options: ["en", "ne", "mixed"]
    default: "ne"
    help: "'mixed' speaks Nepali but keeps subject terms in English (uses the content glossary)."
  - key: default_voice
    label: "Default voice"
    type: select
    options:
      ["ne-NP-HemkalaNeural", "ne-NP-SagarNeural",
       "en-US-AriaNeural", "en-US-GuyNeural", "hi-IN-SwaraNeural"]
    default: "ne-NP-HemkalaNeural"
  - key: require_nepali_content
    label: "Require Nepali content before publishing"
    type: boolean
    default: false
    help: "Publish gate: a section cannot go live without its Nepali fields filled."

  # ── Lesson shape ──────────────────────────────────────────────────────
  - key: lesson_max_minutes
    label: "Maximum lesson length (minutes)"
    type: integer
    default: 25
    min: 5
    max: 90
  - key: lesson_target_chapters
    label: "Target chapters per lesson"
    type: integer
    default: 4
    min: 1
    max: 8
    help: "Upper bound on planned chapters — the main cost driver."
  - key: max_questions_per_lesson
    label: "Maximum student questions per lesson"
    type: integer
    default: 40
  - key: attention_reset_minutes
    label: "Attention break every N minutes"
    type: integer
    default: 10
    help: "0 disables the break cue."
  - key: allow_free_topic
    label: "Allow lessons on any typed topic"
    type: boolean
    default: false
    help: "Off = lessons must be grounded in published curriculum content (recommended)."

  # ── Who may use it ────────────────────────────────────────────────────
  - key: allowed_grades
    label: "Grades allowed"
    type: multiselect
    options: ["1","2","3","4","5","6","7","8","9","10","11","12"]
    default: ["6","7","8","9","10"]
  - key: allowed_subjects
    label: "Subjects allowed"
    type: multiselect
    options: []                 # populated from the school's subjects at render time
    default: []
    help: "Empty = all subjects that have published teaching content."
  - key: allowed_roles
    label: "Roles that can start a lesson"
    type: multiselect
    options: ["student", "teacher", "school_admin"]
    default: ["student", "teacher"]
  - key: student_hours_window
    label: "Students may learn between"
    type: string
    default: "06:00-21:00"
    help: "Local time window. Teachers and admins are exempt."

  # ── Safety ────────────────────────────────────────────────────────────
  - key: require_guardian_consent
    label: "Require guardian consent for students"
    type: boolean
    default: true
    help: "Cannot be turned off for students under 13 — the platform enforces that regardless."
  - key: moderation_strictness
    label: "Moderation strictness"
    type: select
    options: ["standard", "strict"]
    default: "standard"
    help: "strict = medium-severity flags pause the lesson and notify a teacher; critical always escalates."
  - key: kill_switch
    label: "Turn AI Teacher off now"
    type: boolean
    default: false
    help: "Immediately blocks new lessons and ends live ones (mirrors the AI tool kill switch)."
  - key: transcript_retention_days
    label: "Keep lesson transcripts for (days)"
    type: integer
    default: 180
    min: 7
    max: 1095
  - key: teacher_can_watch_live
    label: "Teachers may watch live lessons"
    type: boolean
    default: true
    help: "Read-only mirror of their own class's lessons."

  # ── Cost ──────────────────────────────────────────────────────────────
  - key: monthly_cost_ceiling_npr
    label: "Monthly AI budget (NPR)"
    type: integer
    default: 3000
    help: "New lessons are refused (429) once reached. 0 = platform quota only."
  - key: monthly_minutes_per_student
    label: "Monthly lesson minutes per student"
    type: integer
    default: 240
  - key: max_concurrent_lessons
    label: "Maximum simultaneous lessons"
    type: integer
    default: 25
  - key: cost_alert_percent
    label: "Alert admins at % of budget"
    type: integer
    default: 80
```

Every key has a named consumer: `service_*`/`player_base_url` → `service_client.py`;
persona/language/voice/lesson-shape → the create-lesson payload in `routes.py`;
`allowed_*`/`student_hours_window` → the create gate; `require_guardian_consent`/
`moderation_strictness`/`kill_switch` → the guardrail block (§B.7); `transcript_retention_days` →
`tasks.purge_transcripts`; cost keys → the reservation check (§B.8) and
`ai_teacher.cost_ceiling_reached` event.

## D.3 `hooks.py`

```python
"""AI Teacher — WP-style plugin lifecycle hooks.

activate(db)   : create plugin-owned tables (checkfirst), provision the
                 per-school service credential, register the workbench tool
                 row + nutrition facts, seed default config.
deactivate(db) : stop live lessons and tell the service to reject this tenant;
                 keep every row (lesson history is the school's record).
uninstall(db)  : revoke the credential and drop ONLY module-owned config;
                 lessons, mastery and teaching content are DATA and are kept.

Contract note: hooks are never fatal — plugins.py::_run_plugin_hook logs and
swallows failures (app/api/v1/plugins.py:83-101), so every step here is
idempotent and independently retryable via the settings screen.
"""
import logging
import secrets

logger = logging.getLogger(__name__)

TOOL_KEY = "ai_teacher_lesson"


def _owned_models():
    from app.models.ai_teacher import (
        AITeacherLesson, AITeacherLessonChapter, AITeacherMessage,
        AITeacherMastery, AITeacherLearningEvent, AITeacherServiceKey,
    )
    from app.models.teaching_content import (
        TeachingSection, TeachingSectionVersion, TeachingSectionOutcome,
        TeachingNote, TeachingExample, TeachingMisconception, TeachingFormula,
        TeachingExamTip, TeachingKeyTerm, TeachingMedia,
        TeachingContentSnapshot, TeachingContentReview,
    )
    return [
        AITeacherServiceKey, AITeacherLesson, AITeacherLessonChapter,
        AITeacherMessage, AITeacherMastery, AITeacherLearningEvent,
        TeachingSection, TeachingSectionVersion, TeachingSectionOutcome,
        TeachingNote, TeachingExample, TeachingMisconception, TeachingFormula,
        TeachingExamTip, TeachingKeyTerm, TeachingMedia,
        TeachingContentSnapshot, TeachingContentReview,
    ]


def activate(db) -> None:
    from flask import g
    school_id = getattr(g, "school_id", None)

    # 1. tables (idempotent) — same pattern as ai_adaptive_learning/hooks.py:23-30
    for model in _owned_models():
        model.__table__.create(db.engine, checkfirst=True)

    # 2. per-school service credential (hash stored, secret handed to the service once)
    from app.models.ai_teacher import AITeacherServiceKey
    from app.plugins.modules.ai_teacher.service_client import provision_tenant

    if school_id and not AITeacherServiceKey.query.filter_by(
        school_id=school_id, revoked_at=None, is_deleted=False
    ).first():
        secret = secrets.token_urlsafe(48)
        key = AITeacherServiceKey.issue(school_id=school_id, secret=secret)  # stores sha256 only
        db.session.add(key)
        db.session.commit()
        try:
            provision_tenant(school_id=school_id, key_id=key.key_id, secret=secret)
        except Exception as exc:                      # noqa: BLE001 — never fatal
            logger.warning("ai_teacher: tenant provisioning deferred (%s); "
                           "admin can retry from Settings", exc)
        finally:
            secret = None                             # not persisted anywhere in ASchool

    # 3. workbench tool registration → kill switch / tier / consent gates apply
    from app.models.ai_workbench import AIToolRegistry, AINutritionFacts
    if not AIToolRegistry.query.filter_by(tool_key=TOOL_KEY).first():
        db.session.add(AIToolRegistry(
            tool_key=TOOL_KEY, name="AI Teacher lesson", name_ne="एआई शिक्षक पाठ",
            category="tutor", min_plan_tier="ai_suite",
            roles_allowed=["student", "teacher", "school_admin"],
            status="beta",                # 'ga' requires the facts row below (CI gate)
        ))
    if not AINutritionFacts.query.filter_by(tool_key=TOOL_KEY).first():
        db.session.add(AINutritionFacts(
            tool_key=TOOL_KEY, model_name="external-service", provider="ai_teacher_service",
            data_accessed=["published curriculum content", "lesson transcript",
                           "mastery per learning outcome"],
            data_not_accessed=["marks", "attendance", "fees", "health records",
                               "student photos", "documents"],
            retention_days=180, no_training_guarantee=True, human_review_required=False,
            limitations="Teaches only from published curriculum content; may make mistakes; "
                        "not a substitute for a teacher. Voice and whiteboard rendering are "
                        "produced by an external service.",
            supported_language="en+ne",
        ))
    db.session.commit()

    # 4. default config, only for keys the admin has not set
    from app.models.plugin import SchoolPlugin
    from sqlalchemy.orm.attributes import flag_modified
    sp = SchoolPlugin.query.filter_by(school_id=school_id, plugin_slug="ai_teacher").first()
    if sp is not None:
        defaults = {"default_language": "ne", "lesson_max_minutes": 25,
                    "lesson_target_chapters": 4, "allow_free_topic": False,
                    "require_guardian_consent": True, "moderation_strictness": "standard",
                    "monthly_cost_ceiling_npr": 3000, "transcript_retention_days": 180}
        sp.config = {**defaults, **(sp.config or {})}
        flag_modified(sp, "config")
        db.session.commit()
    logger.info("ai_teacher activate: tables + credential + tool row ready (school=%s)", school_id)


def deactivate(db) -> None:
    """Stop teaching, keep everything. Live lessons must not survive a deactivate."""
    from flask import g
    from app.models.ai_teacher import AITeacherLesson
    from app.plugins.modules.ai_teacher.service_client import disable_tenant, stop_lesson

    school_id = getattr(g, "school_id", None)
    live = AITeacherLesson.query.filter(
        AITeacherLesson.school_id == school_id,
        AITeacherLesson.status.in_(("ready", "teaching", "paused")),
        AITeacherLesson.is_deleted.is_(False),
    ).all()
    for lesson in live:
        try:
            stop_lesson(lesson)
        except Exception:                             # noqa: BLE001
            logger.warning("ai_teacher deactivate: could not stop lesson %s", lesson.id)
        lesson.status = "ended"
        lesson.end_reason = "plugin_deactivated"
    db.session.commit()
    try:
        disable_tenant(school_id)
    except Exception:                                 # noqa: BLE001
        logger.warning("ai_teacher deactivate: tenant disable call failed (school=%s)", school_id)


def uninstall(db) -> None:
    """Revoke the credential + drop module-owned config keys. Data is kept
    (WP semantics, and lesson history is a school record parents can request)."""
    from datetime import datetime, timezone
    from flask import g
    from sqlalchemy.orm.attributes import flag_modified
    from app.models.ai_teacher import AITeacherServiceKey
    from app.models.plugin import SchoolPlugin

    school_id = getattr(g, "school_id", None)
    for key in AITeacherServiceKey.query.filter_by(
        school_id=school_id, revoked_at=None, is_deleted=False
    ).all():
        key.revoked_at = datetime.now(timezone.utc)
    sp = SchoolPlugin.query.filter_by(school_id=school_id, plugin_slug="ai_teacher").first()
    if sp is not None and sp.config:
        cfg = {k: v for k, v in sp.config.items() if k == "last_payment"}   # platform-reserved
        sp.config = cfg
        flag_modified(sp, "config")
    db.session.commit()
```

## D.4 `routes.py` — endpoint list

`ai_teacher_bp = Blueprint("ai_teacher", __name__, url_prefix="/ai-teacher")`; the loader mounts it
under `/api/v1` (`loader.py:246-248`). Decorator stack on user-facing routes:
`@jwt_required()` → `@school_required` → `@plugin_required("ai_teacher")` → `@role_required(...)` →
`@ai_rate_limit(...)`.

| Method + path | Purpose | Guards |
|---|---|---|
| `GET /ai-teacher/personas` | persona list (service passthrough + per-school allow-list, cached 10 min) | plugin |
| `GET /ai-teacher/launcher` | grades/subjects/units/sections that have **published** content, plus this student's due-for-review keys | plugin, role |
| `POST /ai-teacher/lessons` | broker a lesson (§B.3) | consent, tier, kill switch, grades, hours, quota, concurrency, `ai_rate_limit(6, 86400)` |
| `GET /ai-teacher/lessons` | history (`?student_id`, `?status`, `?from`, `?to`) | scope: student = own, teacher = their classes, admin = school |
| `GET /ai-teacher/lessons/<id>` | lesson detail + chapters + cost + grounding refs | ownership |
| `GET /ai-teacher/lessons/<id>/messages` | transcript (retention-aware) | ownership / teacher / admin |
| `GET /ai-teacher/lessons/<id>/summary` | summary + per-outcome mastery | ownership |
| `POST /ai-teacher/lessons/<id>/stop` | end a lesson (tells the service) | ownership |
| `POST /ai-teacher/lessons/<id>/report` | student/teacher safety report → `ModerationFlag` | ownership |
| `GET /ai-teacher/lessons/<id>/export.pdf` | Celery-rendered board/notes PDF into ASchool file storage | ownership |
| `GET /ai-teacher/mastery` | mastery rollup by outcome (`?student_id`, `?subject_code`) | scope |
| `GET /ai-teacher/usage` | minutes, lessons, tokens, NPR cost, ceiling headroom | school_admin |
| `POST /ai-teacher/service-key/rotate` | rotate the S2S secret (24 h overlap) | school_admin / superadmin |
| `GET /ai-teacher/health` | service reachability + last successful call + breaker state | school_admin |
| **content authoring** (`content_api.py`, same blueprint) | | |
| `GET/POST /ai-teacher/content/sections` · `GET/PUT/DELETE …/sections/<id>` | section CRUD | `role_required("school_admin","curriculum_admin","superadmin")` |
| `POST …/sections/<id>/versions` · `PUT …/versions/<vid>` | draft create/edit | authoring role |
| `POST …/versions/<vid>/{submit,approve,reject,publish,archive,revert}` | the §C.6 workflow, each writing a `teaching_content_reviews` row | publisher role |
| `GET/PUT/DELETE …/versions/<vid>/{notes,examples,misconceptions,formulas,exam-tips,key-terms,media,outcomes}` | block CRUD | authoring role |
| `POST …/sections/<id>/fork` | clone a platform section into a school override | school_admin |
| `GET …/versions/<vid>/preview?language=` | the exact document the AI would receive | authoring role |
| **service-to-service** | | |
| `GET /ai-teacher/content/section/<id>` | the read API of §C.7 | `X-ASchool-Key` + HMAC, **no JWT** |
| `GET /ai-teacher/content/units/<id>/sections` | ordered outline | key + HMAC |
| `POST /ai-teacher/webhooks/lesson-event` | callback ingest (§B.6) | key + HMAC + replay cache |

Celery (`tasks.py`): `reconcile_lessons` (10 min), `purge_transcripts` (nightly, honors
`transcript_retention_days`), `rollup_usage` (hourly → `AIToolAnalyticsDaily`),
`compute_due_reviews` (nightly, spaced repetition per `mastery_key`),
`export_lesson_pdf` (on demand).

## D.5 Plugin-owned widgets

**Web (Next.js, `frontend/app/dashboard/ai-teacher/`)** — every page wrapped in
`<PluginGate slug="ai_teacher">` (`frontend/lib/plugins.tsx:253-352`):

| Widget | What it does |
|---|---|
| `LessonLauncher` | grade → subject → unit → **section** picker fed by `/launcher` (published content only), persona gallery, language/voice, estimated minutes + **estimated NPR cost before you start**, "not available in Nepali yet" honesty badge |
| `AITeacherPlayer` | the iframe host: creates the lesson, mounts the player at `player_base_url` with the token in the fragment, `allow="microphone; autoplay; fullscreen"`, `sandbox="allow-scripts allow-same-origin"`, fullscreen + close controls, connection-state banner |
| `LessonProgressRail` | chapter list with live status from `lesson_step`/`chapter_complete`, jump-to-chapter |
| `AskBar` | text + mic question composer (mic uses the service's STT through the player, never ASchool) |
| `MasteryHeatmap` | outcome × mastery grid from `/mastery`; reused on the student profile and report-card evidence panel |
| `LessonHistoryTable` | date, chapter, minutes, questions, mastery delta, cost, transcript link, PDF export |
| `TeachingContentEditor` | the §C authoring surface: version rail (draft/in_review/published/archived), block editors for notes/examples/misconceptions/formulas/exam-tips/key-terms/media, **side-by-side EN | NE panes**, publish-gate checklist, diff-vs-published, fork/re-adopt platform content |
| `ContentPreviewDrawer` | renders `versions/<vid>/preview` — exactly what the AI receives |
| `AITeacherUsageCard` | minutes/cost/ceiling with the 80 % alert state; drops into the existing `analytics/ai-usage` page |
| `AITeacherSettingsForm` | the `config_schema.yaml` screen + Rotate Key + service health |
| `ServiceDownNotice` | the honest degradation panel (§B.10) with the "read the chapter instead" fallback |
| `ConsentBanner` | guardian-consent prompt/deep link when consent is missing |

**Flutter (feature folder `ai_teacher` in each app, shared bits in `aschool_shared`)**:

| App | Widgets |
|---|---|
| student | `AiTeacherHomeTab` (launcher + due-for-review chips), `LessonWebViewPlayer` (WebView of the player with the two platform hacks Ashlya proved necessary — `setMediaPlaybackRequiresUserGesture(false)` and landscape/immersive lock, `ateacher_bridge_screen.dart:487-501`), `MyLessonsList`, `MasteryStrip`, `AskSheet` |
| teacher | `AssignLessonSheet` (pick section + students → creates lessons for a class), `LiveLessonsMonitor` (read-only mirror, gated by `teacher_can_watch_live`), `ClassMasteryGrid` |
| parent | `ChildLessonsList` (summaries only, never live), `AiConsentTile` (grant/revoke `GuardianAIConsent`) |
| admin | `AiTeacherUsageTab`, `ContentCoverageTab` (which grades/subjects have published + Nepali content), `SafetyFlagsTab` (moderation flags + kill switch) |
| shared | `PluginGate` (existing, `aschool_shared/lib/widgets/plugin_gate.dart`), `ServiceUnavailableCard`, `NoDataContainer`/`ErrorContainer` reuse (existing shared widgets — no new empty/error states) |

---

# E. RISKS + WHAT NOT TO COPY

## E.1 What NOT to copy from ATeacher (with the evidence)

| Do not copy | Evidence | Why it must not cross the boundary |
|---|---|---|
| One static platform API key with an insecure default and a plain string compare | `backend/config.py:39`; `routes/auth.py:47-55` | Leak = mint a token for *any* user of *any* tenant. Replace with per-school key id + secret hash + HMAC-signed requests + rotation (§B.2). |
| Opaque UUID "tokens" with no claims | `services/db_service.py:91`; validation `db_service.py:116-128` | No tenant, no role, no audience, no signature; can't be verified without a DB round trip. Use ASchool JWTs, ≤15 min, single-use `jti` (§B.5). |
| Token in the query string | `routes/auth.py:70-71`; `LiveTeacherModal.tsx:38`; `ateacher_bridge_service.dart:139-148`; `main.dart:60` | Lands in access logs, history, `Referer`, WebView logs. Fragment or POST-then-cookie only. |
| Unauthenticated sockets | `websocket/events.py:188-191`; `api_client.dart:56-80`; `cors_allowed_origins="*"` at `app.py:71` | Knowing a session id *is* the authorization. ASchool authenticates at handshake and re-derives the lesson from the socket's session on every event. |
| `get_active_session()` fallback | `websocket/events.py:448-452` | A question with an unknown session id gets answered into *someone else's* lesson. Never ship a "whatever session is active" path. |
| Unauthenticated `restore_session` | `websocket/events.py:753-798` | Replays any lesson's board to any connection. |
| Unauthenticated content/media routes | `routes/lesson.py:7-42` (session create), `routes/tts.py:43-90` (arbitrary text→speech, 1 h public cache), `routes/stt.py:18` | Free TTS/STT for the internet, billed to us; a session-creation hole that bypasses every gate. Everything S2S or JWT-gated. |
| In-process lesson state | `_session_plans`/`_session_blueprints` `events.py:29-32`; `_sid_to_session`/`_active_streams` `events.py:174-179`; board state in `whiteboard_service` | Forces `-w 1` (`render.yaml:8`) and loses lessons on restart. If we ever own this code path: Redis with TTLs. As a vendored service, it becomes a capacity constraint we must state in the runbook, not hide. |
| `create_all()` schema management | `app.py:56-58`; MySQL `LONGTEXT` variants `models/database.py:292,357` | ASchool is Postgres + Alembic. Also the reason `ateacher_*` tables leaked into the host schema (§A.1). |
| Service tables inside the host database | `skilldarbar_api/migrations/live_schema_dump_2026_08_05.sql:360-442` | Separate service ⇒ separate database. A shared schema turns a vendor upgrade into a host migration. |
| Committed provider keys | `backend/render.yaml:9-10` (live `GROQ_API_KEY`), `backend/.env` present in-tree | Rotate on adoption; never copy the file. Secrets come from the platform secret store. |
| OCR / camera ingestion as a content path | `lib/screens/ateacher_bridge_screen.dart:239-341` (ML Kit), plus the in-lesson `setOnShowFileSelector` image path `:491,523-601` | Out of scope by decision (§C.1). OCR errors become taught facts, and it bypasses the review workflow entirely. |
| Prose context assembled at click time | `NotesToolbar.tsx:70-80`; `QuizDetailAssistant.tsx:335-357`; merged + truncated at `routes/auth.py:96-162` | No provenance, no versioning, no outcome links, no Nepali parity, 150 k-char truncation silently drops content. Replaced by §C's structured document + `content_snapshot_id`. |
| Sending real name + email to the service | `route.ts:64-68`; `ateacher_routes.py:84` | Minimize: pseudonymous `user_ref` + display first name only. |
| Mastery keyed by LLM-invented chapter titles | `events.py:849-878`; "a question means the student is confused" heuristic `events.py:530-559` | Unusable across lessons and pedagogically wrong. Key mastery on curriculum outcomes (`mastery_key`, §C.4) and treat questions as engagement, not failure. |
| The 2500 ms postMessage race | `frontend/lib/features/lesson/lesson_screen.dart:78-100` | Starts teaching with empty context if the message is late. Our context lives in the pre-created session, so the client needs no handshake at all. |
| `sandbox="… allow-same-origin"` **plus** a trusted parent origin | `LiveTeacherModal.tsx:194` | `allow-scripts` + `allow-same-origin` on a same-site frame effectively removes the sandbox. Serve the player from a distinct origin, pin `frame-src`, drop `allow-popups`/`allow-modals`. |

Also flagged in the earlier blueprint and still true: do not port `session_service.py`'s session-id
logic, the triple-duplicated token loop without `try/finally`
(`events.py:889-1008,1011-1163,1240-1465`), `_log_chapter_mastery`'s truncated stub
(`events.py:880-887` — builds `kg_mastery` then does nothing with it), or the dead
`image_gen_service.py` / `board_state_compressor.py`. And `ai_teacher/chemistgpt.txt` +
`physicsgpt.txt` are third-party MathGPT prompts — do not ship them.

## E.2 Risks in our own design, and the mitigation

| # | Risk | Mitigation / accepted position |
|---|---|---|
| 1 | **The content is the product now.** An empty `teaching_*` schema means the plugin is a beautiful shell. Authoring Science + Math grades 8-10 to a publishable standard is weeks of curriculum work, not engineering. | Ship the platform seed for CDC Science/Math 8-10 first; the launcher only offers sections with published content; `allow_free_topic=false` by default so we never fake grounding. Budget the authoring explicitly and track "content coverage %" as a release gate. |
| 2 | Vendor coupling: we depend on a single-worker Flask service with in-process state. | Version the contract (`/api/v1` on the service side too), keep `service_base_url` per school so a school can be pinned to a shard, health endpoint + circuit breaker in `service_client.py`, and the honest text-lesson fallback (§B.10). Capacity is a documented runbook number, not an assumption. |
| 3 | Webhooks are best-effort; a lost callback means a lesson with no mastery and no cost. | Idempotent ingest + the 10-minute reconciler + `cost_source="estimated"` marking. Never silently show an estimate as measured. |
| 4 | Cost blowout: a 5-chapter lesson is ~$0.05-0.15; a class of 40 doing daily lessons is real money. | Pre-flight reservation against `AISchoolQuota` **and** the per-school NPR ceiling, per-student monthly minutes, concurrency cap, 80 % alert, and cost shown to the student before they press start. |
| 5 | Nepali quality: Edge-TTS Nepali voices and Nepali LaTeX reading are uneven; `spoken_ne` on formulas is a hand-authored field for a reason. | `require_nepali_content` publish gate, `keep_in_english` glossary for the mixed mode, and honest "Nepali not available yet" UI rather than machine translation at teach time. |
| 6 | Consent + minors: a live voice tutor for a 10-year-old is a DPDP-grade exposure. | `GuardianAIConsent(scope="tutor")` enforced at create (cannot be disabled for under-13), revocation stops live lessons, transcripts retained per config and purged, parent can read every transcript. |
| 7 | Moderation asymmetry: ASchool's `moderate()` is regex-tier and English-first; the service generates the speech. | Moderate on both sides of the callback, escalate `critical` through the existing wellbeing path, `strict` mode pauses on medium, plus a student/teacher "report this lesson" button that files a `ModerationFlag`. Nepali pattern coverage is a known gap — record it, don't paper over it. |
| 8 | Prompt injection through *content*: an authored misconception field could contain "ignore your instructions". | Content is `trust="curriculum"` but still delimited in `<source>`; authoring roles are privileged and every change is attributed in `teaching_content_reviews`; `detect_injection()` runs on submitted content at publish time, not just on student input. |
| 9 | Two mastery systems: `ai_teacher_mastery` vs `MasteryRecord` in `ai_adaptive_learning` (`app/models/adaptive_learning.py`). | Keep AI Teacher's per-outcome rows as the fine-grained evidence and **feed** the adaptive-learning rollup rather than competing with it; one direction only, documented in the model docstring. |
| 10 | Iframe/WebView fragility: mic permission, autoplay policy, fullscreen, Android file chooser, landscape lock. Ashlya needed four platform hacks (`ateacher_bridge_screen.dart:413-501`). | Treat the player embed as a supported surface with its own device matrix test (Android WebView, iOS WKWebView, Chrome, Safari); permissions-policy and CSP `frame-src` pinned per environment. |
| 11 | Scope creep back into "let's just rebuild it inside ASchool". | This document is the boundary: ASchool owns brokering, records, content and guardrails; the service owns teaching, board and voice. Any PR that adds prompt text or board-grammar parsing to ASchool has crossed the line. |
| 12 | Content authoring UX debt: the editor is the biggest new frontend surface (bilingual panes, version diffs, publish gates). | Build it against the existing widget primitives, ship notes+examples first, and accept that misconceptions/formulas/exam-tips can land in a second pass — the read API tolerates empty arrays. |

## E.3 The one-paragraph verdict

Ashlya's integration is a clean **two-call broker + URL-param iframe**: the host server holds a
single static API key, mints a 24-hour opaque token, pre-creates a session with a blob of prose, and
hands the player a URL. It works, and its shape is worth keeping. Everything about *trust* in it is
wrong for a multi-tenant SaaS — one platform key, unsigned tokens in query strings, unauthenticated
sockets where knowing an id is authorization, and a completely one-way boundary where the school
learns nothing from a lesson it paid for. ASchool keeps the shape and replaces the trust model:
per-school HMAC credentials, short-lived scoped JWTs, handshake-authenticated sockets with
lesson-ownership checks, HMAC-signed callbacks so mastery and cost come home, and the existing
consent/moderation/quota machinery on the front door. The substantive product upgrade is not the
plumbing though — it is refusing the OCR shortcut and building a real, versioned, bilingual,
per-school-overridable teaching-content schema underneath the curriculum tables ASchool already has,
so the AI teaches published material with citable provenance instead of a truncated screenshot of
someone's notes.

---

*Evidence paths: service + consumer at `/home/bishal-regmi/Desktop/Ashlya Academy Latest/ashlya_academy/`
(`ATeacher/ai_teacher/**`, `next_app/src/**`, `skilldarbar_api/**`, `lib/**`); ASchool at
`/home/bishal-regmi/Desktop/ASchool/backend/**` and `frontend/**`. Companion documents:
`ATEACHER_INTEGRATION_BLUEPRINT.md` (service internals, prompts, board grammar) and
`ASHLYA_AI_DEEPDIVE.md` (provider routing, cost, anti-patterns).*
