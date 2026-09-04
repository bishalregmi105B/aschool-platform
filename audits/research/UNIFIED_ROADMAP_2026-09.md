# UNIFIED ROADMAP v2 — FINAL PLAN (rewritten after full re-read)
_Date: 2026-09-04 · Supersedes v1 · Sources: 13 research reports in `audits/research/` (§0)_
_Status: plan of record for the next build cycle. Implementation starts at §9 W0._

---

## 0. Source reports (13)

| # | Report | File |
|---|--------|------|
| 1 | Sahayatri spec inventory (120+ AI tools, ingestion pipeline, token economy) | `SAHAYATRI_SPEC_INVENTORY.md` |
| 2 | Sahayatri backend code (323 routes, 38 tables, port patterns) | `SAHAYATRI_BACKEND_CODE.md` |
| 3 | Sahayatri web/mobile/whiteboard UX (121 tool pages from 20 templates) | `SAHAYATRI_CLIENTS_UX.md` |
| 4 | ASchool plugin duplication audit (51 plugins, registry mechanism) | `ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md` |
| 5 | ASchool current state (item-id status, open backlog) | `ASCHOOL_CURRENT_STATE.md` |
| 6 | ASchool web UI inventory (226 routes) | `ASCHOOL_WEB_UI_INVENTORY.md` |
| 7 | ASchool Flutter apps screen inventory (5 apps, consolidation verdict) | `ASCHOOL_MOBILE_APPS_INVENTORY.md` |
| 8 | Ashlya Academy AI deep dive (4 stacks, prompts, ingestion) | `ASHLYA_AI_DEEPDIVE.md` |
| 9 | Nepal competitor landscape (Veda, Paathshala, pricing, 25 gaps / 20 wins) | `COMPETITOR_LANDSCAPE_NEPAL.md` |
| 10 | **ATeacher integration blueprint (1,540 lines, verbatim prompts, board grammar)** | `ATEACHER_INTEGRATION_BLUEPRINT.md` |
| 11 | Web widget-level plugin UI audit (widget inventory + 25 upgrades) | `ASCHOOL_WEB_WIDGET_AUDIT.md` |
| 12 | Flutter widget-level UI audit (shared-kit + 25 upgrades + 12 shared widgets) | `ASCHOOL_FLUTTER_WIDGET_AUDIT.md` |
| 13 | Backend/plugin feature-completeness sweep (680 routes, ~92% complete) | `ASCHOOL_BACKEND_COMPLETENESS_AUDIT.md` |

---

## 1. Executive summary

ASchool's backend is ~92% complete and well-guarded; its deficit is user-facing. The web app has 21 behavior-free UI primitives (no sortable table anywhere, 14 hand-rolled paginations), the role portals are "Coming soon" stubs, the Flutter apps have dead push, no Nepali localization, no offline, and homework submission that pastes a URL instead of using the camera. The market leader (Veda, 1,300+ schools) has **no AI, hidden pricing, and a 2.9★ iOS parent app**; Paathshala gives hardware away and monetizes RFID cards. Neither has Nepali UI, an API, or offline.

The plan therefore concentrates on four thrusts, in dependency order:
1. **W0 Repair** — finish the plugin-registry merge, wire the silent gaps the completeness sweep found (absent-alert listener, leave→attendance, etc.).
2. **W1/W2 Surface** — a real web design system (12 Tier-1 widgets), ship the portals, consolidate the mobile apps, make everything Nepali-first.
3. **W3/W4 AI** — integrate **Ashlya ATeacher as the AI Teacher** (the whiteboard plan is cancelled) and expand ai_suite with Sahayatri's tool-catalog factory, chapter knowledge base, textbook ingestion, and learning-science engines — all on our guardrails.
4. **W5/W6 Market** — close the Nepal revenue features (transcripts, TDS payroll, refunds, marksheet designer) and publish transparent pricing + a free migration kit.

## 2. Decision record (locked)

| Decision | Rationale |
|---|---|
| **AI Teacher (ATeacher) replaces the Sahayatri whiteboard.** No whiteboard app port. | Owner decision. ATeacher's engine (board grammar, personas, analyzer→planner, voice) is strictly richer; its Flutter canvas is irrelevant to us — we rebuild the renderer for web + our apps. |
| Wire ATeacher's pedagogy properly; do not copy its dead code | Blueprint §11: analyzer output is discarded by the planner, slide guidance never wired, mastery inferred from question counts, chapter completion auto-records success. We port the *prompts* and *design*, implement the wiring for real. |
| `ai_suite` is the single AI gate; deprecated AI manifests deleted after row migration | Dedup audit P0 — current split-brain 403s migrated schools. |
| flutter_user becomes THE consumer app; flutter_admin separate; student/parent/teacher repos remain as embedded packages | It already embeds them and is the only multi-platform app; four binaries with duplicated shells are unmaintainable. |
| `/dashboard/analytics` stays core (ungated); deprecated `advanced_analytics` + `digital_content` + `social_ads` + `social_hub` deleted | Dedup audit; charging NPR 999 for ungated core data is dishonest. |
| AI tools ship ONLY through the workbench orchestrator (consent, injection, moderation, quota, ledger) | Sahayatri's un-gated voice tutor was a revenue + safety leak; we never repeat it. |
| Edge-TTS is the default school voice with a queue/cache; add a paid fallback before classroom-scale use | Blueprint risk #3 (unofficial API, 3-slot semaphore won't survive classrooms). |
| Web pricing page publishes our tiers; never publish claimed competitor prices | Competitor report §D/E. |

## 3. Findings digest (what the 13 reports established)

**Backend (report 13).** 680 routes / 68 blueprints / 507 tests; almost no stubs. Hard gaps: absent-parent alert emits `attendance.student_absent` with **no listener** (`tasks/attendance_alerts.py:51`); leave approval doesn't write attendance rows and drops rejection reasons (`api/v1/attendance.py:603-620`); no subject-wise attendance; transcripts missing; grading scale is a constant (no per-school schemes); payroll tax is flat % (no TDS/SSF/PF); refunds are Khalti-only full-amount; timetable "AI solver" is a greedy stub that ignores its own constraint map (`services/ai/timetable_solver.py:40-88`); no transport-fee billing; no bank reconciliation; curriculum/NEB tables have no API. Production risk: PDF endpoints 501 unless WeasyPrint/python-docx are in the runtime image; Sparrow SMS called over plain `http://`.
**Registry (report 4).** Filesystem manifests + `plugins` mirror + `school_plugins` installs + `@plugin_required` gate + alias table; 41/51 folders are shells (code lives in `api/v1`); AI gate split-brain (16 `ai_tools` + 8 `ai_adaptive_learning` + `benchmarking` gates vs ai_suite migration); `grant_plan_plugins` bypasses `coming_soon`; ~20 manifest pointers point at nonexistent files; benchmarking `/rankings` N+1 + cross-tenant dump; `frontend/lib/plugins.tsx` hand-duplicates the alias table.
**Web (reports 6+11).** 165 real / 6 partial / 19 stub routes; portals fake; 21 primitives with zero behavior; two gems (BS date input, schema-driven plugin settings); features with endpoints but no UI: leave-request approval queue, visitor appointments, inventory procurement + asset scan, compliance audit-logs UI, emergency headcount, IEP review, moderation flags, AI capture confirm, QTI export, fee statement PDF, payslip PDF, transfers list, notification settings; `useExport.ts` (413 lines) has zero importers.
**Flutter (reports 7+12).** aschool_shared has state scaffolding but zero domain widgets; `PaginatedList` unused; `UploadButton` fakes progress and `FileUploadService` calls `pickImage` (no documents); homework = paste-a-URL; no `.arb`, no Semantics, no deep links (`setOnTapCallback` never called, no VIEW intent-filters, no google-services.json — push silently dead); ~95 hardcoded `Colors.white` break dark mode; apps diverge from the web's Forest Green.
**Sahayatri (reports 1–3).** Port: tool-catalog factory (registry-as-data + 20 result templates), chapter_ai_context KB (draft→approve→publish), 7-stage vision ingestion state machine, exercise blocks (19 Nepal types), SM-2 + adaptive path + gamification, live quiz (server-authoritative), token-cost UX, Nepali formatting. Skip: its backend internals (we have better).
**ATeacher (report 10).** Flask+Socket.IO+Flutter single-tenant prototype. Assets to port: the **board grammar** (`[WRITE@x,y: text #RRGGBB]`, `<DRAW_SVG …>` with viewBox 500×200/400×300, MCQ annotations `[CROSS_OUT|CIRCLE|UNDERLINE|BOX@wb_N]`, y-cursor layout rules, NEXT_SLIDE at y>85, color semantics), the **verbatim prompts** (5 personas with Nepali code-switching, `_ANALYZER_SYSTEM`, `_PLANNER_PROMPT_TEMPLATE` cognitive-load/space-repetition/faded-scaffolding, `_slide_type_guidance`, board-compressor, lesson-summary), the **teaching flow** (blueprint → plan → per-chapter streaming with holdback parser → client queue pairing TTS + animation → barge-in classify → SM-2 → mastery summary), **voice** (Edge-TTS ne-NP + expressive presets, Whisper STT, prefetch). Must be re-built on: multi-tenant Postgres models, Redis room state, authenticated Socket.IO, token_hub streaming with cost accounting, workbench guardrails.
**Ashlya (report 8).** Task-class router (10 classes, latency budgets, 404 auto-failover), credit ledger with pre-click price, two-stage extraction prompts (faithful→rewrite), RRF hybrid search (we have it), prompt-time section selection for long docs.
**Competitors (report 9).** Our wins: only real AI, Nepali-first + BS calendar, offline apps, transparent pricing, open API/marketplace, one-click IEMIS export, free migration kit, 4.6★-targeted parent app. Must-close: IRD billing trust, Smart SMS, marksheet print designer, biometric/RFID, feature-barring on arrears, canteen/hostel, Excel everywhere, admissions CRM, alumni/wellbeing, white-label apps.

## 4. Per-plugin completeness matrix (backend · web UI · app UI · settings)

Legend: ● complete · ◐ partial · ○ missing. "Settings" = config_schema.yaml (6/53 today).

| Domain/Plugin | Backend | Web UI | App UI | Notable gap |
|---|---|---|---|---|
| Auth/users | ● | ◐ (profile read-only, roles page fake) | ◐ (no biometric/OTP in apps) | roles UI is static |
| Students/academics | ● | ● | ● | guardian edit missing; NEB curriculum no API |
| Attendance | ◐ | ◐ | ◐ | leave queue no web UI; no subject-wise; absent-alert dead listener; leave→attendance write-through |
| Fees | ◐ | ● | ◐ (no receipt/history) | bank reconciliation, non-Khalti/partial refunds, POS keyboard |
| Exams | ◐ | ◐ | ◐ | transcripts, grading scales, re-evaluation, scheduling detail, seat plans; marks keyboard flow |
| Timetable | ◐ | ○ (raw table) | ○ | drag grid, conflicts, real solver |
| HR/payroll | ◐ | ◐ | ◐ | TDS/SSF, payslip preview UI, leave bulk approve |
| Communications | ● | ◐ (no targeting) | ◐ | audience targeting, email templates, SMS 2.0 |
| Transport | ◐ | ● | ◐ (15s polling) | transport-fee billing, driver manifest, socket+ETA |
| Admission | ● | ◐ | ○ | kanban + follow-ups + docs |
| Library/elibrary | ● | ◐ | ◐ | barcode/QR, reminders, PDF viewer |
| LMS/assignments | ● | ◐ (quizzes no UI) | ◐ | quiz builder/attempt UI; side-by-side grading |
| Inventory/hostel | ◐ | ◐ | ○ | procurement UI, vendors, mess/maintenance |
| Safety cluster | ● | ◐ | ◐ | visitor appointments UI, emergency headcount UI |
| Website/builder/white-label | ● | ● | ○ (n/a) | history diff UI, undo, menu builder |
| IEMIS | ● | ◐ | ○ | column mapping, error download, new-vs-update diff |
| Designer | ● | ● | ○ | marksheet templates (see W5) |
| ai_suite | ● | ◐ | ◐ | everything in W3/W4; IEP/moderation/capture/QTI have no UI |
| Analytics/reports | ◐ | ◐ | ○ | custom report builder; core-vs-plugin decision executed |
| Biometric | ● | ◐ | ○ | device rate limit; BYO-ZKTeco story |
| Multi-branch | ● | ◐ | ○ | chain analytics UI |
| social_ads, social_hub, digital_content, advanced_analytics | — | — | — | **DELETE (W0)** |

## 5. W0 — Repair & wire (Week 1; unblocks everything)

*All items verified by reports 4+13; every change ships with a failure-mode pytest and an AUDIT_INDEX entry.*

**Registry/dedup:**
1. ai_suite gate migration: swap 16 `ai_tools` + 8 `ai_adaptive_learning` + `benchmarking` gates → `ai_suite`; one-time `school_plugins` row migration for schools holding legacy slugs; then delete 7 deprecated AI manifests + their alias entries.
2. Delete `social_ads`, `social_hub` (code + `models/social.py` + nav), `digital_content` manifest, `advanced_analytics` manifest; retire legacy flat-manifest path; delete 10 orphan `services/ai/*` modules.
3. `grant_plan_plugins` skips `coming_soon` (fixes free install of conferences/gps/whatsapp).
4. Loader validator: fail startup loudly on nonexistent `services:`/`models_module:`/`api_blueprint:` pointers; fix the ~20 bad pointers.
5. Serve the plugin catalog/aliases/feature flags from the backend (`/plugins/catalog`); consume it in `frontend/lib/plugins.tsx` and `lib/api.ts` (kills the triplicated maps).
6. Benchmarking: cache + aggregate-only `/rankings` (no per-school dumps, no N+1).
7. Consolidate `student_health_records`→`health_profiles`; split `communications.py` routes by owning plugin; fix inverted incidents pricing.

**Silent-gap wiring (backend quick wins):**
8. Implement the `attendance.student_absent` listener → notification pipeline (push + SMS credit check + diary entry), with a guardrail test.
9. Leave approval writes attendance rows; rejection reason persisted.
10. Curriculum/NEB grid API (read-only) off the existing tables — needed by W3 AI Teacher and W4 chapter KB.
11. Sparrow SMS `http://`→`https://` (+ verify cert); per-device rate limit on biometric ingest; add weasyprint/python-docx to the production image deps.
12. Guardian edit/delete endpoints; transfers admin list wiring.

**E2E gate W0:** registry refresh green on empty DB; migrated-legacy school hits ai_suite routes with 200; deleted plugins gone from marketplace+sidebar+DB mirror; absent student triggers one notification; leave approve creates attendance rows; pytest suite green; tsc clean.

## 6. W1 — Web design system + UX program (Weeks 2–3)

**Tier-1 shared widgets to build first (report 11 §5):** `DataTable` (server sort/paginate/filter/bulk/column-config/CSV), `ConfirmDialog` + undo toasts, `EmptyState`/`ErrorState`, `Skeleton` set, `PageHeader`, `FilterBar` (URL-synced + saved views), `Pagination`, `StatusPill` (one status vocabulary), `Sheet` drawer, `CommandPalette` (⌘K over sidebar + entities via `/search`), `Wizard/Stepper`, `JSONSchemaForm` v2 (enum/groups/help — grow the plugin-settings seed; write `config_schema.yaml` for the top-20 plugins).

**Screen upgrades (ranked):**
1. MarksGrid keyboard flow — Enter/arrows navigate, Excel-paste import, live grade preview (already exists) kept.
2. Attendance keyboard marking + honest "N unmarked" state (no silent all-present default) + heatmap from the unused summary endpoint.
3. Fees POS keyboard mode + virtualized list + refund UI (endpoint exists).
4. Notices: audience targeting (class/section/role), rich text (tiptap is already installed), attachments, bilingual bodies.
5. SMS: group picker, cost preview, delivery report (Sparrow statuses exist).
6. Admission kanban from the client-encoded transition machine + follow-up dates + document upload.
7. Leave-requests approval queue (endpoint exists, zero UI).
8. LMS quiz builder + attempt UI (endpoints exist, zero UI).
9. Student-create wizard (BSDateInput DOB, login preview, photo).
10. Global print stylesheet + wire `useExport` CSV/PDF on every table; skeleton loading everywhere; realtime notification panel over the existing socket.
11. Timetable: drag grid + teacher-conflict highlight (the real solver lands in W5).
12. Dark-mode toggle (tokens exist), Mukta font load, a11y pass, IEMIS column-mapping + error download, AI workbench markdown/KaTeX rendering + docx/pdf export of outputs (report 11 #14).

**E2E gate W1:** every Tier-1 widget adopted on ≥1 real page with Playwright/Mighty-free GUI runs (screenshots) + tsc + the portal pages render against the live API.

## 7. W2 — Portals + mobile (Weeks 3–5, parallel with W1/W3)

**Web portals (F-01):** ship the 15 "Coming soon" sections (student/parent/teacher: attendance, results, fees, notices, bus, timetable, library, chat, ai-tutor…) against existing `/parent/*`, `/student/*`, `/teacher/*` endpoints; role landing pages; honest permission errors.

**Flutter:**
1. Consolidation: promote flutter_user (single `MaterialApp.router`, deep links), stop building standalone binaries; flutter_admin stays.
2. Push end-to-end: FCM config per app, `setOnTapCallback` + VIEW intent-filters, deep-link routes (`/notifications/:id`, `/homework/:id`, `/fees`, `/bus`), notification inbox categories + per-category prefs.
3. Nepali locale: `.arb` files + flutter_localizations + Noto Sans Devanagari + BS/AD dual pickers + NPR formatting.
4. The 12 shared widgets (report 12 §6): `AschoolSearchField` (debounced), `BsAdDatePicker`, `TimetableGrid`, `AttendanceGrid` (bulk long-press + undo), `MarksGrid` (per-cell validation + outbox), `PaymentMethodSheet`+`PaymentReceiptView`, `MapCard` (polyline+ETA), `ChatThread` v2, `RichTextView` (markdown+KaTeX), `AppImageViewer`/PDF viewer (stop `launchUrl` exits), `FilePickUploadButton` (fix `pickImage`-only bug), `OfflineBanner`+`OutboxScaffold`.
5. Feature fixes: camera homework submission (crop→compress→progress); offline attendance outbox (teacher); payment success screen + PDF receipt share + history; bus socket stream (`bus_location` is already a constant) + arrival push; biometric unlock; fix `UploadButton` fake progress; fix the token system (Forest Green, kill ~95 `Colors.white`, dark mode); admin app: real Promote POST, rebuild fake Assignments.

**E2E gate W2:** parent: pay fee → receipt share; receive push → tap → deep-linked screen. Teacher: mark attendance offline → airplane-mode restore → synced. Student: submit photo homework. All screens pass a Nepali toggle smoke test.

## 8. W3 — AI Teacher (ATeacher integration; replaces whiteboard)

*Per `ATEACHER_INTEGRATION_BLUEPRINT.md`; build order P1→P5, each phase E2E-tested live with the Groq key.*

**P1 — Core engine (backend, L):**
- `models/ai_teacher.py`: `AITeacherPersona` (4 editable prompt columns + voice + language), `AILesson` (school/student/subject/topic/status/language), `AILessonContext` (source: curriculum topic / notes / question), `AILessonMessage`, `AILessonMasteryEvent`, `AILessonBoardSnapshot` (JSONB), `AILearningEvent` (xAPI-ish), `AIConceptRecord` (per-student SM-2: ease/interval/due/reps/lapses), `AILessonAsset`. One Alembic revision; persona seed (ARIA/Max/Sophia/Leo/Nova verbatim).
- `services/ai/teacher_board.py`: board state + holdback parser + `repair_svg` + layout rules — ported near-verbatim from the blueprint (this is pure logic; unit-test the grammar exhaustively: 30-140ms/char hints, y-cursor, overlap nudge, color semantics, NEXT_SLIDE at y>85, ≤3 blank rule, MCQ annotations).
- `services/ai/teacher_planner.py`: analyzer (`_ANALYZER_SYSTEM`) + planner (`_PLANNER_PROMPT_TEMPLATE`) **wired together** — blueprint feeds the plan; slide guidance (`_slide_type_guidance`) actually included in the teach prompt (fixing ATeacher's dead-code defect). Fed by curriculum_seed topics + (later) chapter context.
- `services/ai/ai_teacher.py`: `stream_chapter` — token-hub streaming (add streaming support to the AIClient so quota reserve/reconcile, cost logs, circuit breakers apply per call), emit normalized DrawCommand dicts; speech ≤260-char flush; `try/finally` per stream; Redis-backed room state (never process dicts).
- `api/v1/ai_teacher.py`: personas, lesson CRUD + start/stop, context attach (curriculum topic or notes), STT proxy, cached TTS, summary, mastery, PDF export; registered as an `AIToolRegistry` tool → kill switch + tier + guardian consent + injection/moderation on student input + pseudonymization + AIGeneration ledger for every LLM call.
- Socket.IO: rooms `lesson:{id}`, events `start_lesson/lesson_blueprint/lesson_plan/lesson_step/chapter_complete/barge_in/lesson_summary`, JWT handshake + membership checks + `seq` backpressure; Celery: summary, PDF export, nightly due-review scan, prewarm of analyzer+planner (kills ATeacher's 20–40s dead gap).

**P2 — Voice + web renderer (M):** `teacher_voice.py` (Edge-TTS with the 5 expressive presets inferred per sentence, ne-NP voices, server LRU cache + per-school queue/semaphore, 503+Retry-After, chunked response — not the GET-with-text-in-URL antipattern; Whisper STT with BCP-47 hints en/hi/ne). Web at `frontend/app/dashboard/ai-teacher/`: launcher (PersonaPicker, topic/level/language, teach-from-notes-or-curriculum, history w/ due-review badges) and `lessons/[id]/player` — BoardCanvas as DOM+SVG hybrid (positioned divs, handwriting webfont, KaTeX for `$…$`, stroke-dashoffset tracing for SVG, annotation overlays, slide history + wipe, hit-test selection), CaptionStream, LessonControls (pause/speed/voice/Continue), TopicProgressPanel, MasteryPanel, LessonSummaryModal; race-free step queue port (audio + animation both finish → next step).

**P3 — Pedagogy for real (M):** SM-2 keyed by **student** (cross-lesson spaced review), real quiz grading on INDEPENDENT_PRACTICE/QUIZ slides, mastery events from graded evidence (not question counts), adaptive slide overrides from mastery, confusion≥2 escalation, lesson summary + next-steps; barge-in flow (stop audio, cancel stream, classify, answer on board, resume with don't-repeat instruction).

**P4 — Guardrails & cost (M):** every student utterance/image through injection classifier + moderation; teacher speech moderated before emit; pseudonymize names in prompts; consent for minors; per-lesson cost estimate shown pre-start (credit layer W4); eval set: 20 golden lessons (topic→expected slide types/grammar validity) run in CI nightly.

**P5 — Apps + completeness (M):** flutter_student LessonList + LessonPlayer (audio+captions+board, snapshot cache for offline replay, TTS prefetch bounds); flutter_teacher monitoring (class mastery, due reviews) via school-room mirrors; marksheet-style lesson PDF export.

**E2E gate W3 (live):** start a Grade-8 algebra lesson as a seeded student → assert blueprint/plan events, ≥1 valid WRITE + 1 valid SVG per teaching slide, audio URL playable, captions match speech, barge-in works mid-slide, SM-2 rows updated, summary generated, cost logged; red-team: injection via barge-in, self-harm via barge-in, off-curriculum pivot — all guarded.

## 9. W4 — ai_suite surface expansion (Sahayatri-in; Weeks 6–8)

1. **Catalog + template factory:** extend `AIToolRegistry` (category, icon, persona, `ui_type`, token_cost_estimate, model task-class, is_premium) → seed ~100 tools from the documented 55-key catalog + Sahayatri's 121-tool taxonomy; web: 20 result templates (AiChat/Flashcards/Doubt/Solver/Exam/Planner/Wellbeing/Writing/Content/Analysis + teacher workspace/presentation/document/diagram/analytics) with TopicSelector, grounding badge, FollowUpChips, result-shape parsers, tokenCostBadge; apps: AI Tools hub driven by the same `ui_type`.
2. **Chapter AI Context KB:** tables + draft→approve→publish workflow + admin review UI; injected into teacher/tutor/tools; Ashlya's prompt-time section selection for long contexts.
3. **Textbook ingestion pipeline** (digital_content/elibrary): 7-stage Celery machine (rasterize→vision classify→TOC→chapter MD→exercise blocks→context→review→publish) with confidence auto-approve, Bloom tagger, Jaccard dedupe, exercise bank UI (KaTeX); Ashlya two-stage prompts; Preeti-font rasterize trick.
4. **Learning science:** SM-2 service (shared with AI Teacher concepts), adaptive path w/ reasons, gamification service (XP/levels/streaks/badges/leaderboard) filling the gamification plugin, live quiz (server-authoritative, join codes), 3D Sketchfab library w/ AI annotations.
5. **Multimodal tutor upgrades:** blueprint pre-pass, guided/direct modes + anti-cheat contract, response classifier → reteach, Nepali voice via `teacher_voice.py`, photo doubt solver (un-501 `/capture/photo` with vision model), multi-round tool calling w/ source chips.
6. **Task-class router + credits:** 10 task classes w/ model/tokens/temperature/latency budget + p95 + 404 auto-failover in token_hub; per-tool credit costs, pre-click price, wallet + ledger, 402 semantics, AI add-on plan gating.

**E2E gate W4:** golden-set evals per new tool family; catalog page renders 100 tools with correct gating/costs; ingestion round-trip on a real CDC PDF; credit exhaustion → honest 402 UI.

## 10. W5 — Nepal competitive modules (Weeks 6–10, track B)

Ordered by sales impact (reports 9+13): ① multi-term transcripts + per-school grading scales ② payroll TDS/SSF/PF ③ refunds on eSewa/FonePay + partial refunds + bank reconciliation/day-close ④ transport-fee billing + driver manifest ⑤ marksheet/report-card print designer (design_studio templates; Veda's killer feature) ⑥ Smart SMS 2.0 (merge SMS+push, cost receipts) ⑦ IRD-verified billing polish + VAT vouchers ⑧ real timetable solver (constraint-aware, replaces greedy stub) + seat plans + exam scheduling detail ⑨ subject-wise attendance + leave types ⑩ re-evaluation workflow ⑪ ZKTeco/RFID BYO plugin story + RFID one-card events ⑫ canteen wallet/POS + hostel mess/maintenance + inventory vendors/procurement UI ⑬ Excel import/export everywhere + migration kit (Veda/Paathshala/eZone/IEMIS adapters, DOB+guardian-phone dedupe, BS↔AD, parallel-run, same-day cutover) ⑭ admissions CRM kanban backend ⑮ alumni + wellbeing fill-in ⑯ white-label app build pipeline (last).

## 11. W6 — Pricing & GTM (decision doc before W5 tiers gate plugins)

Free Forever ≤100 students · Standard Rs.18/student/mo (annual) · Premium Rs.35/student/mo · AI add-on Rs.49/student/term · white-label onboarding Rs.25k–75k one-time · SMS at cost +10% · migration free. Public pricing page + API docs (credibility no competitor has). Reseller program funded by marketplace share.

## 12. Sequencing

```
W0 (1w) ──┬── Track A: W3 AI Teacher P1–P5 → W4 surface expansion
           ├── Track B: W1 web design system → W2 portals/mobile
           └── Track B continues: W5 competitive modules (starts after W0 #8-12 land)
W6 pricing decision before W5 gating work
```
E2E gates at the end of every phase (§5–§10); nightly evals + red-team in CI from W3 P4 onward.

## 13. Anti-goals / do-not-port
Sahayatri's auth/subscriptions/Groq wrapper/Redis-persistence/`run_text_tool()`/un-gated voice tutor. ATeacher's session service, in-memory state, GET-with-text TTS, dead 1,400 lines, MathGPT prompts, live keys in `render.yaml` (revoke upstream). Ashlya's fix-script churn, IDOR trust of request bodies, mock dashboards. No AI feature ships outside the workbench guardrails. Never publish claimed competitor pricing.
