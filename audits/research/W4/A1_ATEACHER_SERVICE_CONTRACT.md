# W4/A1 — ATeacher REAL service contract (as read from code, 2026-09-05)

Path shorthand (all citations relative to these roots):
- `AT/` = `/home/bishal-regmi/Desktop/Ashlya Academy Latest/ashlya_academy/ATeacher/ai_teacher/` (the service)
- `ASH/` = `/home/bishal-regmi/Desktop/Ashlya Academy Latest/ashlya_academy/` (the Ashlya host)
- `P/` = `/home/bishal-regmi/Desktop/ASchool/backend/app/plugins/modules/ai_teacher/` (our plugin)

Shape: ONE Flask app + Flask-SocketIO (`AT/backend/app.py:34,69-76`), single gunicorn eventlet
worker (`AT/backend/render.yaml:8`), MySQL via SQLAlchemy/pymysql (`AT/backend/config.py:28-36`),
Redis ONLY as the Socket.IO message queue (`AT/backend/app.py:73`). **Single-tenant** — the string
"tenant" appears nowhere in the backend (grep across `AT/backend/**/*.py` = 0 hits).

## 1. HTTP API surface (every route)

Auth decorators (`AT/backend/routes/auth.py`): `_require_api_key` = static `X-API-Key` header must
equal env `SERVER_API_KEY` (auth.py:47-55; default in config.py:39). `_require_token` = Bearer UUID
token, also accepted as `?token=` query param (auth.py:58-80).

| Method+Path | Auth | Payload / query | Response | Code |
|---|---|---|---|---|
| POST /api/auth/token | X-API-Key | `{user_id, name?, email?}` — user_id is the PLATFORM's user id (auth.py:167-189) | `{token, user_id, expires_at}` (24h UUID token, db_service.py:31,87-107) | auth.py:167 |
| POST /api/auth/verify | none | `{token}` | `{valid, user?}` | auth.py:192 |
| POST /api/auth/revoke | Bearer | — | `{revoked: true}` | auth.py:208 |
| POST /api/session/create | Bearer | `{topic* , level, language, voice, context, context_payload?/extra_context?, source_type?, source_id?, teacher_slug}` (auth.py:223-263) | session dict incl `session_id` (db_service.create_db_session, db_service.py:149-215) | auth.py:218 |
| GET /api/session/<id> | Bearer | — | session dict or 404 | auth.py:295 |
| GET /api/session/history | Bearer | `?limit<=50` | `{sessions:[…]}` | auth.py:305 |
| GET /api/session/<id>/messages | Bearer | — | `{messages:[…]}` | auth.py:315 |
| POST /api/session/<id>/teacher | Bearer | `{teacher_slug}` (switch persona pre-lesson) | `{session_id, teacher}` | auth.py:351 |
| GET /api/teachers/ + /api/teachers/<slug> | none (public) | — | persona catalog (seeded by AT/backend/seed_teachers.py, called at app.py:60-63) | auth.py:328-348 |
| POST /api/lesson/start | **NONE** (unauthenticated) | `{topic*, level, voice, language, context, user_id, teacher_slug}` → creates session `source_type="public_api"` | session dict | lesson.py:7-42 |
| POST /api/lesson/stop | none | `{session_id}` → stops in-memory lesson | lesson dict | lesson.py:45-55 |
| GET /api/lesson/status | none | `?session_id=` | lesson dict | lesson.py:58-66 |
| GET /api/lesson/events | none | `?session_id=&limit<=500` — xAPI-shaped learning events (lesson_started, chapter_introduced, question_answered, concept_mastered, image_uploaded, lesson_completed) from DB | `{session_id, events, count}` | lesson.py:69-89 |
| GET /api/tts/stream | none | `?text=&voice=` → `audio/mpeg` bytes; LRU-128 server cache keyed sha256(voice\|text); 503 `tts_server_busy` + `Retry-After: 2`; 502 on fail | mp3 bytes | tts.py:43-110 |
| POST /api/stt/transcribe | none | multipart `audio` file ≤25 MB + optional `language` (accepts BCP-47 or Edge voice id, stt.py:37-39) | transcription JSON (Groq Whisper) | stt.py:18-50 |
| GET / , GET /api/health | none | — | status JSON | app.py:99-106 |

**Does NOT exist**: `/api/tenants` (or anything tenant-like), any webhook emitter, any per-school
credential, any usage/token reporting endpoint, any stop-with-auth, `external_lesson_id`,
`callback_url`, `persona_slug`, `context_document`, `max_minutes` — none of these strings occur in
`AT/backend/`.

## 2. Host authentication (what "S2S" really is)

One static shared secret `SERVER_API_KEY` checked verbatim per request (`X-API-Key`, auth.py:47-55).
No key ids, no HMAC, no rotation, no tenant registry. The user token (24h, db_service.py:31) is then
the bearer for session APIs. Tokens are DB rows `ateacher_user_tokens` (db_service.py:96-107).

## 3. Socket.IO contract (the real lesson runtime)

Namespace default; CORS `*` on socket (`AT/backend/app.py:69-76`); rooms = `join_room(session_id)`
(events.py:313-320). Client must use **polling transport** (frontend does: `AT/frontend/lib/core/api_client.dart:50-64`).

Client → server (register_events, `AT/backend/websocket/events.py:182`):
- `start_lesson` {topic, session_id, level, voice, language, context, user_id, teacher_slug} — events.py:203-432. DB is source of truth when `session_id` given: unknown id → `error` and abort (events.py:248-254); context is loaded from the DB session, NOT from the payload (events.py:233-246).
- `student_question` {session_id, question_text|question|text, image_base64?, mime_type?, selected_item_id?} — events.py:434-604 (image ≤4 MB, MIME whitelist events.py:467-484)
- `pause_lesson` (606) / `resume_lesson` (615) / `continue_after_question` (633) / `next_chapter` (652) — each `{session_id}`
- `stop_lesson` {session_id} — ends, logs mastery, saves board snapshot, emits summary async — events.py:677-705
- `clear_board` (707), `attention_reset` (718-751), `restore_session` (753-798)

Server → client (payloads):
- `error` {message, session_id} — events.py:248-252,265
- `lesson_status` {status, session_id[, current_chapter, chapter_title]} — statuses: `teaching, answering_question, awaiting_resume, paused, ended, attention_reset, restored` — events.py:322,490,604,613,664,705,733,747,793
- `teacher_info` {session_id, teacher{slug,name,emoji,…}} — events.py:327-331
- `lesson_blueprint` {session_id, blueprint} (analyzer Stage 1) — events.py:367-370
- `lesson_plan` {session_id, plan[], total_chapters, session_plan} (planner Stage 2, concept graph) — events.py:413-418
- `lesson_step` {speech, commands[], session_id} — ONE draw command per step, speech only on first — events.py:1468-1493; emitted mid-stream as tokens arrive (events.py:1240-1465)
- `chapter_complete` {session_id, chapter_index, chapter_title, is_last} — events.py:1460-1465
- `concept_mastery` {session_id, mastery{concept_id: level}} (knowledge graph) — events.py:547-551, 816-819; legacy `lesson_mastery` {mastery{idx: outcome}} — events.py:560-566
- `lesson_summary` {session_id, summary} — events.py:843-844
- `board_snapshot` {session_id, elements, next_write_y, chapter_index} (restore) — events.py:776-781

Lesson start pipeline (all inside `start_lesson`, events.py:342-432): analyzer → blueprint
(`analyze_learning_need`, events.py:348-373) → planner concept graph (`create_session_plan_sync`,
events.py:375-405, falls back to Groq generate_plan → 4 static titles) → chapter 1 stream.
LLMs via `AT/backend/ai_gateway.py` ROUTING_TABLE: llama-3.3-70b-versatile for analyzer/planner/
slide-script/diagram, llama-3.1-8b-instant for parse/classify (ai_gateway.py:74-99).

## 4. Session / room model

In-memory dict of `Lesson` objects (`AT/backend/services/session_service.py:15`) + DB mirror
`ateacher_sessions` / `ateacher_session_context` (`create_db_session`, db_service.py:149-215).
`create_session_with_id` reuses a pre-created DB session id (session_service.py:67-80) — this is how
the host's `POST /api/session/create` row becomes the socket lesson. Pre-created context lives in
the DB (`ateacher_session_context.context_text` ≤150 000 chars, markdown-stripped; auth.py:42,131-162).
Sessions NOT in the in-memory dict are recreated from DB on `start_lesson` (events.py:268-286).

## 5. TTS / STT flow

- TTS: client fetches `GET /api/tts/stream?text&voice` per speech chunk (chunks capped ~260 chars,
  events.py:179). Server synthesizes with Edge-TTS, caches mp3 LRU-128 (tts.py:15-35), concurrency
  capped `TTS_MAX_CONCURRENT_SYNTH` + inter-request delay (config.py:15-22). Client prefetches and
  plays via `BytesSource` (`AT/frontend/lib/features/voice/tts_player.dart`, per ATIB §5).
- STT: client POSTs recorded audio to `/api/stt/transcribe` with a voice→language hint
  (config.py:82-99); Groq Whisper `whisper-large-v3-turbo` (config.py:12). 25 MB cap (config.py:104).

## 6. Player (frontend) embedding mechanics

The "player" is a **Flutter Web build** served as static files on its OWN domain:
`https://ateacher.ashlyaacademy.com` (nginx static; `ASH/DEPLOY_GUIDE.md:16-17,35-36`), API at
`https://ateacherapi.ashlyaacademy.com:6001` behind systemd+gunicorn (DEPLOY_GUIDE.md:16,427-483).
Launch = URL query params, NOT an embed route: `?topic&level&language&voice&user_id&session_id&token
&autostart[&listen_for_context]` — parsed in `AT/frontend/lib/main.dart:36-69`; host builds it in
`ASH/lib/services/ateacher_bridge_service.dart:129-150`. Mobile host opens it in a WebView
(`ASH/lib/screens/ateacher_bridge_screen.dart:389-423`); desktop opens a browser tab.
Optional iframe postMessage channel: with `listen_for_context=1` the player waits for
`{type:'ATEACHER_CONTEXT', context}` before starting (lesson_screen.dart:78-95; main.dart:62-63).
Player→service calls: Socket.IO (polling) + TTS GET + STT POST + `/api/lesson/*` — all to
`API_BASE_URL` (constants.dart:6-9; baked at `flutter build web --dart-define=API_BASE_URL=…`).
CSP needs: `frame-src` the player origin; player page needs `connect-src`/`media-src` to the API
origin. Token rides the query string (known defect S-04, ATIB §9.4) — socket itself has NO auth.

## 7. Host provisioning flow (Ashlya, the only working reference)

1. Flutter app → `POST {platform}/api/ateacher/session` with platform `X-API-KEY`
   (ASH/lib/services/ateacher_bridge_service.dart:42-105).
2. Platform mid-tier `ASH/skilldarbar_api/routes/ateacher_routes.py:39-142` proxies two calls:
   `POST {ATEACHER_BACKEND_URL}/api/auth/token` with `X-API-Key: ATEACHER_SERVER_API_KEY`
   (ateacher_routes.py:80-103) → then `POST /api/session/create` with `Authorization: Bearer
   {token}` and `{topic, level, language, voice, context}` (ateacher_routes.py:105-136).
   Env: `ATEACHER_BACKEND_URL` (default http://localhost:6001) + `ATEACHER_SERVER_API_KEY`
   (ateacher_routes.py:27-28).
3. Returns `{token, session_id, expires_at}`; host opens player URL with those params.
4. **Nothing flows back**: no webhooks, no callbacks, no usage reporting anywhere in the service.

## 8. Env vars + deploy requirements

Env (`AT/backend/config.py:6-60`, `.env.example`, `ASH/ateacher_api.env`): `GROQ_API_KEY`,
`ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, `GROQ_TEXT_MODEL` (llama-3.3-70b-versatile), `SECRET_KEY`,
`REDIS_URL` (optional, socket fan-out), `STT_MODEL`, `STT_LANGUAGE`, `TTS_VOICE`,
`TTS_MAX_CONCURRENT_SYNTH` (1→3 ramp, DEPLOY_GUIDE.md:466), `TTS_INTER_REQUEST_DELAY`,
`FLASK_ENV`, `BACKEND_HOST`, `BACKEND_PORT` (6001), `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`
or `DATABASE_URL` (MySQL+pymysql only; requirements.txt has no psycopg2), **`SERVER_API_KEY`**,
`CORS_ALLOW_ALL`, `CORS_ORIGINS` (must list the player origin + host dashboard; defaults in
config.py:46-51).
Deps (AT/backend/requirements.txt): flask 3.0.3, flask-socketio 5.3.6, gunicorn 22, eventlet 0.35.2,
edge-tts 7.2.8, groq, redis, sqlalchemy 2.0.36, pymysql, cryptography.
Deploy topology (DEPLOY_GUIDE.md:16-21,35-36,427-483): dedicated subdomains, port 6001, Python 3.12
(eventlet monkey-patch is skipped on 3.13, app.py:5-15), MySQL + Redis on same box, nginx static for
the Flutter web player, Cloudflare cache-bypass for the API host.

## 9. Personas / voices / languages (what values are legal)

Personas = seeded rows in `ateacher_teachers` (aria, max, sophia, leo, nova — service resolves by
`teacher_slug`, 404 on unknown, auth.py:266-275; seed_teachers.py seeds at boot, app.py:60-63).
Voices = Edge-TTS ids, `TTS_VOICES` map (config.py:62-76): en-US-AriaNeural/JennyNeural/GuyNeural,
en-GB-SoniaNeural/RyanNeural, hi-IN-SwaraNeural/MadhurNeural, ne-NP-HemkalaNeural/SagarNeural.
Languages = literal strings "English" | "Hindi" | "Nepali" (config.py:95-99; default at auth.py:262).

## 10. 3D models

No 3D/Sketchfab/three.js anything in the service (grep over AT/backend = only a false hit for the
word "three" in a prompt, groq_service.py:1446). Nothing to integrate; 3D stays deferred.
