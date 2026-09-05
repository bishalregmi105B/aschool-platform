# W4/A2 — ASchool plugin vs the REAL ATeacher service: gap list

Shorthand (same roots as A1): `AT/` service, `ASH/` Ashlya host, `P/` = ASchool plugin
`backend/app/plugins/modules/ai_teacher/`, `SC/` = `P/service_client.py`, `R/` = `P/routes.py`.

## 1. The core finding

ASchool's `service_client.py` was written against the BLUEPRINT's imagined service (AT
§B.3: tenants, HMAC, callbacks, usage reporting). The real service (A1 digest) is a single-tenant
Flask app with one static `X-API-Key`, no callbacks, no usage endpoint. Every S2S call we make must
be reshaped to the real surface — or the service gets a small shim. Field-by-field:

## 2. Endpoint-by-endpoint gaps

| ASchool calls (SC) | Real service | Gap | Severity |
|---|---|---|---|
| `provision_tenant` → POST /api/tenants {tenant_id, plan} (SC:94-102) | does not exist | Drop, or shim accepts-and-acks. Tenant model = NONE. | blocker for activate |
| POST /api/auth/token {tenant_id, user_ref} via HMAC `X-ASchool-*` (SC:163-166) | POST /api/auth/token {user_id, name?, email?} + `X-API-Key` (AT/backend/routes/auth.py:167-189) | body keys wrong; auth scheme wrong (static key, not HMAC) | blocker |
| POST /api/session/create with {external_lesson_id, persona_slug, context_document, callback_url, callback_secret_id, max_minutes} (SC:170-191) | {topic, level, language, voice, context, teacher_slug, source_type, source_id} (auth.py:218-292) | 5 of our 9 fields are unknown to it; `context_document` (structured, R:72-193) must be flattened to TEXT ≤150k (auth.py:42); persona = `teacher_slug`; `external_lesson_id`/callbacks/max_minutes silently ignored | blocker |
| `stop_lesson` — raises NotImplementedError (SC:120-134) | POST /api/lesson/stop {session_id} (unauthenticated, AT/backend/routes/lesson.py:45-55) OR socket `stop_lesson` (events.py:677) | we can implement today against /api/lesson/stop | easy win |
| `get_session_state` — graceful no-op (SC:202-206); reconciler tasks.py:40-58 polls nothing | GET /api/lesson/status?session_id= (lesson.py:58-66) + GET /api/session/<id>/messages (auth.py:315-320) | implement reconciler against these | easy win |
| `disable_tenant` no-op (SC:105-117) | nothing exists | keep as no-op | fine |

Auth mismatch detail: our `_signed_headers` (SC:53-61) sends `X-ASchool-Key/Timestamp/Signature`
HMAC; the service compares `X-API-Key` verbatim to its `SERVER_API_KEY` (auth.py:47-55). The
service would 401 every call before even reading the body.

## 3. Webhook events: service emits NOTHING; host expects 8

Our receiver `R:578-727` expects HMAC headers `X-ASchool-Key/Timestamp/Signature` and types
`lesson.started, chapter.completed, question.asked, mastery.updated, lesson.summary, lesson.ended,
lesson.error, usage.reported` (R:623-712). The real service has zero outbound webhooks; the closest
native surfaces are the socket stream + `GET /api/lesson/events` (xAPI verbs `lesson_started`,
`chapter_introduced`, `question_answered`, `concept_mastered`, `image_uploaded`, `lesson_completed`,
lesson.py:69-89). Name mapping if we shim events: `lesson_started→lesson.started`,
`chapter_introduced/concept_mastered→chapter.completed`, `question_answered→question.asked`,
`lesson_completed→lesson.ended`; `mastery.updated` ≈ socket `concept_mastery`; `lesson.summary` ≈
socket `lesson_summary`; `usage.reported` has NO source at all (service keeps latency-only in-memory
accounting, ai_gateway.py:342-366 — ATIB §11 "no token accounting exists").

**The flag the task asked for — webhook secrets are never populated:** `R:589-592` reads
`current_app.config["ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS"]` (map key_id → plaintext). Nothing ever
writes it (grep across backend = 0 writers). `hooks._provision_school` (hooks.py:95-119) issues
`AITeacherServiceKey` storing only sha256 (`models/ai_teacher.py:62-76`, `issue()`), and the
plaintext is deliberately discarded (hooks.py:118-119 `secret = None`). So even a perfect shim
cannot authenticate to us. Fix (both halves required):
1. In `_provision_school`, before zeroing, register the plaintext: `current_app.config.setdefault(
   "ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS", {})[key.key_id] = secret` (same for the retry path, and at
   boot for keys whose plaintext still exists — for already-issued keys only rotation can recover).
2. Config must be per-process and survive restarts → store an ENCRYPTED copy of the plaintext
   (ASchool already has a decryptable secrets path for service keys) and hydrate the map in the app
   factory; sha256-only (models/ai_teacher.py:52-62) can never verify an HMAC.

## 4. Field-by-field create_session deltas (our payload → real)

| Our field (SC:178-189) | Real target | Transform |
|---|---|---|
| `external_lesson_id: str(lesson.id)` | `source_type="aschool_lesson"`, `source_id=str(lesson.id)` (auth.py:252-259 accepts both, stored in ateacher_session_context) | rename |
| `topic` (R:357 clamps 300) | `topic` (required) | pass-through |
| `level` | `level` | pass-through (beginner default) |
| `language` "en/ne/mixed" (config_schema.yaml:31-36) | literal "English"/"Hindi"/"Nepali" (config.py:95-99) | MAP: en→English, ne→Nepali, mixed→English (or Nepali) — no mixed mode in service |
| `voice` `ne-NP-HemkalaNeural` etc (config_schema.yaml:37-41) | same Edge-TTS ids (config.py:62-76) | pass-through (voices coincide — lucky) |
| `persona_slug` (R:358) | `teacher_slug` — values must be the seeded set aria/max/sophia/leo/nova (auth.py:266-275); unknown slug = 404 | rename; our config options already match (config_schema.yaml:24) |
| `context_document` (structured dict, R:72-193) | `context` TEXT ≤150 000 chars, markdown-stripped (auth.py:42,131-162); optional `context_payload` merged as text (auth.py:139-162) | flatten: render our notes/examples/formulas/misconceptions/key_terms/exam_tips into a compact study-sheet text; keep `context_document` dict as `context_payload` too if size allows |
| `callback_url`, `callback_secret_id` | nothing | drop (or shim stores them) |
| `max_minutes` | nothing — lesson runs until student stops / last chapter (events.py:652-675) | drop; enforce locally in reconciler (tasks.py:35 already does) |
| token body {tenant_id, user_ref} (SC:158-166) | {user_id: str(student), name, email} (auth.py:174-189) | rename; user_id = ASchool student id string |
| token auth HMAC (SC:163) | `X-API-Key: <shared secret>` | rewrite `_request` |

## 5. Player embedding: reality vs our assumption

Our assumption (R:396-399): player served at `{player_base}/embed#lesson={lesson.id}` — no such
route exists. Reality: the player is a **Flutter Web static build on its own origin**
(`ateacher.ashlyaacademy.com`, DEPLOY_GUIDE.md:16-17) with params in the QUERY STRING (main.dart:
36-69), launched by URL (WebView or iframe), NOT path-routed. Auth for the player = the 24h UUID
token from /api/auth/token (auth.py:167) passed as `?token=` (main.dart:59); the socket itself
accepts no auth at all (events.py:188-201); TTS/STT are unauthenticated HTTP.
So ASchool must embed: `<iframe src="{player_base}?session_id={service_session_id}&token={svc_token}
&topic=…&user_id={student}&autostart=true" allow="microphone">`. The `service_token` from
create_session must be returned to the browser (R:400-412 currently returns `player_url` +
`socket_room` only — add `service_session_id` + player query params). Player needs its own
deployment/domain and its own CSP entries: dashboard `frame-src` player origin; player
`connect-src`/`media-src`/`img-src` to the API origin (constants.dart:6-9); microphone permission
policy (`allow="microphone"`) for STT.
`context` should NOT go in the URL (leaks content; also size) — the service pulls context from its
own DB row created at /api/session/create (events.py:233-246), so pass `context=''` and rely on the
session row, exactly like Ashlya does (lesson_controller.dart:536-545 `hasPreCreatedSession ? '' : context`).

## 6. Socket room mismatch (cosmetic but real)

We return `socket_room: f"lesson:{lesson.id}"` (R:404). The service's rooms are its OWN
`session_id` UUIDs (events.py:313-320); our dashboard would join a room that doesn't exist. Live
monitoring (config `teacher_can_watch_live`, config_schema.yaml:121-124) can only be done by
embedding the same player read-only or subscribing to the service's socket room = `service_session_id`.

## 7. Recommended path — thin adapter shim on the SERVICE, honest client on ASchool

Chosen: **keep ASchool's client as the contract owner, add a ~150-line Flask shim mounted in the
ATeacher service** (new blueprint `shim.py`, no engine changes) that:
- `POST /api/tenants` → 200 {} (ack; logs tenant_id for observability only)
- `POST /api/auth/token` → accepts `X-ASchool-Key/Timestamp/Signature` HMAC (verifies against the
  provisioned per-school secret) + `{tenant_id, user_ref}`, maps to `POST /api/auth/token`
  `{user_id: f"{tenant_id}:{user_ref}", name, email}` (auth.py:167)
- `POST /api/session/create` → accepts our full payload; flattens `context_document` to text;
  maps language/persona fields; calls the internal `create_db_session`; records
  `external_lesson_id/callback_url/max_minutes` on the session row's source_type/source_id (free) and
  returns `{session_id, token, expires_at}` in one round-trip
- `POST /api/lesson/stop` (already exists) + a `POST /api/session/<id>/state` convenience that
  bundles lesson status + events + messages for our reconciler
- an event-bridge task: subscribes to the service's own Socket.IO (or reuses the in-process
  emitters) and POSTs HMAC-signed events to `callback_url` with EXACTLY our 8 types + headers
  `X-ASchool-Key/Timestamp/Signature` (R:586-603). `usage.reported` can only carry REAL data once
  the shim also wraps ai_gateway calls to count tokens per session (wrap `route_stream_sync`,
  ai_gateway.py:303-340) — otherwise omit the event and keep our `cost_source="estimated"`.
Why not change ASchool only: we would still have NO callbacks, NO per-school keys, NO usage —
the webhook receiver, reconciler, cost model and kill-switch semantics (R:578-727, tasks.py) all
presuppose events flowing home. Why not rewrite the service: anti-goal — the engine (board grammar,
personas, TTS, session pipeline) is the service's IP (D1 §A.1; D2 §G defect list = do-not-port).
ASchool client changes regardless (small): language mapping, persona pass-through, stop_lesson via
/api/lesson/stop, reconciler via /api/lesson/status + /api/session/<id>/messages, response parse of
{session_id, token}.

## 8. Deploy steps (config/compose)

1. Deploy service: dedicated host/port `6001` (config.py:24-25), gunicorn `--worker-class eventlet
   -w 1` (render.yaml:8; -w 1 is mandatory, sessions are in-proc dicts session_service.py:15),
   MySQL (`DATABASE_URL`/DB_* config.py:28-36) + Redis (`REDIS_URL`, app.py:73), Python 3.12
   (eventlet skipped on 3.13, app.py:5-15). Secrets: `GROQ_API_KEY`, `SERVER_API_KEY`,
   `SECRET_KEY`; rotate the leaked render.yaml Groq key (render.yaml:14, S-01).
2. Player: `flutter build web --dart-define=API_BASE_URL=https://<service-host>` (constants.dart:6-7)
   → serve static on its own origin (e.g. `player.aschool.app`), nginx.
3. CORS on the service (`CORS_ORIGINS`): player origin + ASchool dashboard origin (config.py:41-60;
   keep `CORS_ALLOW_ALL=false` in prod).
4. Compose service entries: `ai-teacher` (Flask+gunicorn eventlet, 6001), `ai-teacher-player`
   (nginx static), reuse ASchool's redis; do NOT co-locate MySQL with ASchool Postgres (D1 §A.1:
   service tables never enter ASchool's DB).
5. ASchool config: `service_base_url=https://<service-host>:6001`, `player_base_url=https://
   <player-host>` (config_schema.yaml:7-18), CSP `frame-src` + `connect-src` updates, env
   `ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS` hydrated from encrypted store (§3 fix above).
6. DNS/ingress: websocket-capable route for `/socket.io` (long-polling works too — client forces
   polling, api_client.dart:50-64), Cloudflare bypass on the API host (DEPLOY_GUIDE.md:42).

## 9. ASchool must NOT do (anti-goals, locked)

No whiteboard implementation; no session-service rebuild (no port of events.py/session pipeline);
no porting board grammar/personas/TTS internals (D2 §G.1 is description, not a port spec); no
service tables in ASchool Postgres (D1 §A.1:1); no multi-worker Flask for the service; no
token-in-query-string invention beyond what the player already does (fix belongs to the service
owner later); no 3D/Sketchfab integration (nothing exists; deferred).
