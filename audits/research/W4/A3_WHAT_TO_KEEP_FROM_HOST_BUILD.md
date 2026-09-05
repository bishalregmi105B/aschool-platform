# W4/A3 — What to KEEP from the ASchool host-side build (and what was assumed wrong)

Shorthand: `P/` = `backend/app/plugins/modules/ai_teacher/`, `SC/` = `P/service_client.py`,
`R/` = `P/routes.py`; `AT/` = the real service; `TH/` = `backend/app/services/ai/token_hub.py`.

## 1. Inventory — keep as-is (valuable regardless of adapter shape)

| Piece | Where | Why it stays |
|---|---|---|
| Lesson lifecycle gates | R:208-346 (kill switch R:216-217, tier R:219, role, consent, published-only content resolution R:51-69, injection scan R:315-318, budget reserve R:320-334, concurrency cap R:336-346) | Pure ASchool-side policy; the real service has NONE of this (no auth on /api/lesson/*, no moderation, no rate limits — ATIB §9.3). This is exactly what makes ours a school product. |
| Context document builder | R:72-193 (`_build_context_document` from published teaching_* versions, media as alt-text only R:184-192) | Becomes the "flatten to text" input for the service's `context` field (A2 §4). The structure is right; only the wire format changes. |
| Webhook receiver logic | R:578-727 (HMAC verify R:585-603; appliers R:623-712) | Keep the HMAC design AND refactor each `etype` branch into a callable `apply_event(lesson, etype, payload, event_id)` so the reconciler can feed poll-derived events through the SAME code (A2 §7). Add the secrets-hydration fix (A2 §3). |
| Models + migration | `backend/app/models/ai_teacher.py` (service keys :42-76, lessons :78+, chapters/messages/mastery/events), migration `backend/migrations/versions/e5a8c2d7f3b1_ai_teacher_runtime_tables.py` | Schema matches what the appliers write; `service_session_id` (models/ai_teacher.py:103) is exactly the join key to the real service. |
| Reconciler + purge tasks | P/tasks.py:13-63 (reconcile: close stale lessons past max_minutes+5 as `abandoned`), tasks.py:66-96 (retention purge per school config) | Both correct; only `get_session_state` inside reconcile becomes real (A2 §2). Registration via manifest `tasks:` (manifest.yaml:39-40) is done. |
| token_hub integration | TH/request :574, stream_request :799 (first-token latency design), estimate_cost_usd :74, reconcile_quota_reservation :456, transcribe :960 | `stream_request` was built for AI Teacher board/caption sync and stays the metering spine for any FUTURE in-host AI; `estimate/reconcile` already drive R:196-205, 690-711. |
| config_schema.yaml | P/config_schema.yaml (service_base_url/player_base_url :7-18, persona/lang/voice :21-41, cost + guardrails :43-142) | Keep wholesale; two value fixes only (A2 §4/§9): `default_language` options `en/ne/mixed` need a mapping table (service speaks English/Hindi/Nepali), and `player_base_url` help should say "origin of the Flutter-web player build (query-param launch), CSP frame-src". |
| hooks.py | P/hooks.py (idempotent activate :74-92, provisioning :95-119, workbench tool + nutrition facts :122-167, deactivate stops live lessons :190-220, uninstall revokes keys :223-249) | WordPress-semantics lifecycle is right. One addition: register the webhook secret into app config at issue time (A2 §3). |
| manifest.yaml | P/manifest.yaml (surfaces, flutter tabs :55-58, events, owns_tables :77-84) | Ownership split (runtime records ours, teaching_* owned by nepal_curriculum, comment :75-77) is exactly right. |

## 2. Assumptions that were WRONG (about the real service)

1. **"The service has a tenant API."** No `/api/tenants`, no tenant concept at all — single static
   `X-API-Key` (AT/backend/routes/auth.py:47-55; A1 §2). `provision_tenant` (SC:94-102) 404s today.
2. **"The service accepts our session payload."** It reads only topic/level/language/voice/context/
   teacher_slug/source_* (auth.py:218-292). `external_lesson_id`, `persona_slug`, `context_document`,
   `callback_url`, `callback_secret_id`, `max_minutes` (SC:178-189) are all unknown fields it ignores.
3. **"The service signs and ships webhooks."** It has zero outbound HTTP; results exist only as
   Socket.IO emissions to the player (events.py:182+) and xAPI rows (lesson.py:69-89). Ashlya's own
   host confirms: "nothing flows back to the host. Ever." (D1 §A.3 quoting AT §A.11).
4. **"The player is served from an /embed route keyed by our lesson id."** Real player = Flutter Web
   static build on its own origin, launched by query params `session_id/token/topic/…` (main.dart:
   36-69; bridge dart:129-150). `{player_base}/embed#lesson={id}` (R:396-399) would render nothing.
5. **"HMAC S2S with per-school keys."** Real S2S = one shared secret; per-school isolation must live
   in ASchool (our keys + our gates) and/or in the shim (A2 §7).
6. **"We may need to build analyzer→planner / rooms / streaming in a new service."** The real
   service already IS that service: two-stage analyzer+planner on lesson start (events.py:342-405),
   per-session socket rooms (events.py:313-320), token-streamed chapters with board commands
   (events.py:1240-1465), TTS/STT (A1 §5), knowledge-graph mastery (events.py:547-551). DO NOT
   rebuild any of it — D2 §G documents the engine as the service's IP with an explicit do-not-port
   list (ATIB §11: session_service id logic, triple-duplicated token loops, InterruptDetector,
   HandwritingAnimator, board_state_compressor, image_gen_service, etc.).
7. **"`socket_room: lesson:{our_id}`"** (R:404) — service rooms are its own session UUIDs
   (events.py:313-320); join-by-our-id is a no-op. Real monitoring = embed player or join
   `service_session_id`.
8. **"usage.reported will carry provider/model/tokens."** The service has no token accounting at all
   (latency-only in memory, ai_gateway.py:342-366; ATIB §11). Until the shim meters gateway calls,
   cost stays `cost_source="estimated"` — never fake a measured one (same honesty rule as tasks.py:39-40).

## 3. "Fully working in our ecosystem" — the acceptance checklist

1. **Install**: superadmin installs `ai_teacher` from marketplace → hooks.activate creates tables
   (hooks.py:79-80), issues per-school service key (hooks.py:95-119) AND registers its plaintext in
   the webhook-secrets map (fix, A2 §3), registers workbench tool `ai_teacher_lesson`
   (hooks.py:122-136), applies config defaults (hooks.py:170-187).
2. **Provision**: shim `POST /api/tenants` acks (or drop after A2 §7 lands); admin sets
   `service_base_url` + `player_base_url` in plugin settings (config_schema.yaml:7-18); CSP allows
   the player origin.
3. **Configure service**: env deployed per A1 §8 (SERVER_API_KEY, GROQ_API_KEY, MySQL, Redis, port
   6001, CORS_ORIGINS = player + dashboard).
4. **Create lesson**: student/teacher picks a published teaching_* section → gates pass →
   `AITeacherLesson` row `pending` (R:349-365) → service session created (shimmed create) → row
   `ready` with `service_session_id` (R:392-394) → response carries `player_url` built as
   `{player_base}?session_id={service_session_id}&token={svc_token}&topic=…&user_id=…&autostart=true`
   (replace R:396-399).
5. **Student plays**: dashboard embeds the iframe (frame-src ok); Flutter player connects to the
   service socket, emits `start_lesson` with `session_id` (lesson_controller.dart:536-545); service
   loads the context document from its DB row (events.py:233-246) — grounded teaching from OUR
   published content; barge-in questions work natively (events.py:434-604).
6. **Results write home**: shim event-bridge posts HMAC `lesson.started / chapter.completed /
   question.asked / mastery.updated / lesson.summary / lesson.ended` to `/webhooks/lesson-event`
   (R:578-727) → chapters, messages (+moderation R:647-672), mastery rollup (R:730-756), summary,
   duration land in ASchool tables; belt-and-braces: reconciler polls
   `GET /api/lesson/status` + `/api/session/<id>/messages` and feeds the same appliers (tasks.py:
   13-63 refit), closing stale lessons `abandoned`.
7. **Costs reconcile**: shim meters ai_gateway calls per session → `usage.reported` →
   `estimate_cost_usd` + `reconcile_quota_reservation` + `AIUsageLog` (R:690-711); until then
   reservation stays estimated (R:320-334) and `usage` endpoint (R:538-575) reports estimates
   honestly.
8. **Transcripts purge**: nightly `purge_transcripts` deletes mirrored `AITeacherMessage` rows past
   `transcript_retention_days` (tasks.py:66-96; default 180, config_schema.yaml:114-119).
9. **Off-switches**: kill switch blocks creation AND deactivation ends live lessons via
   /api/lesson/stop (R:216-217, hooks.py:190-220, real endpoint lesson.py:45-55).

## 4. Nothing to unbuild

No host-side code needs deletion: everything wrong is confined to `SC/` (rewrite of ~120 lines:
auth scheme + payloads + stop/poll) and two spots in `R/` (player_url shape :396-399; webhook secret
hydration :589-592). The D2 §G do-not-port list and the locked anti-goals (no whiteboard, no session
service rebuild) remain in force; 3D/Sketchfab has no service surface and stays deferred.
