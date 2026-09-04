# UNIFIED ROADMAP v3 — FINAL INTEGRATION & BUILD PLAN
_Date: 2026-09-05 · Supersedes v2 (2026-09-04) · Basis: 13 source reports + 5 new digests in `audits/research/_digest/` + a ground-truth verification pass of the working tree (commit `1b6d295` "W0: plugin-registry repair…")_
_Status: plan of record. Phases B onward are the build order; Phase A is DONE and verified._

---

## 0. Evidence base

| Digest | File | Lines | Locks |
|---|---|---|---|
| D1 AI Teacher plugin + 153-tool catalog | `_digest/D1_AITEACHER_AND_TOOLS.md` | 1,137 | Separate-service topology, 25 endpoints, teaching-content DDL (12 `teaching_*` tables), catalog rows, deck/document emitter contract |
| D2 Plugin/theme/widget/config v2 + ATeacher engine | `_digest/D2_ARCHITECTURE_AND_ENGINE.md` | 574 | Plugin package v2 contract, widget contract, config dialect v2, theme parity lock, board grammar + prompts + defect list |
| D3 Sahayatri → plugin spec | `_digest/D3_SAHAYATRI_PLUGIN_SPEC.md` | 2,911 | ONE new plugin `nepal_curriculum`; 12-table de-dup verdicts; result templates; live-quiz sockets; admin entry UI; slices |
| D4 Competitor refresh | `_digest/D4_COMPETITOR_REFRESH.md` | 65 | Veda/Paathshala re-verified 2026-09-05; new inconsistency findings; confirms roadmap unchanged |
| D5 Day-in-the-life review | `_digest/D5_DAY_IN_THE_LIFE_REVIEW.md` | 145 | 4-role click-by-click traces; portal/MOCK findings; fix order |

Plus the 13 reports of 2026-09-04 (§0 of v2) which remain valid except where
corrected below.

---

## 1. Ground truth: what is DONE (verified against the tree, 2026-09-05)

W0 from v2 is **landed** (commit `1b6d295` + working tree):

- social_ads + social_hub deleted end-to-end (routes, module, `models/social.py`,
  tests, tasks, migration `e8b1c4d6a9f2`); 7 deprecated AI manifests deleted;
  `ai_suite` bundle with `__init__.py` + `config_schema.yaml`; alias table in
  `decorators.py:36-42` is **bidirectional in effect** (verified by running
  `_acceptable_plugin_slugs`: an `ai_suite` install passes `ai_tools`/`ai_adaptive_learning`/
  `benchmarking` gates AND a legacy install passes `ai_suite` gates) — v2's
  "split-brain 403" finding was stale; the remaining legacy gates are cosmetic.
- `attendance.student_absent` listener wired (`listeners.py:69` → push + SMS + in-app).
- Leave approve/reject write-through to TeacherAttendance + `rejection_reason`
  column (migration `d5c8f2a7b4e1`).
- `grant_plan_plugins` skips `coming_soon`/`deprecated` (`entitlements.py:63-90`).
- Benchmarking `/rankings`: set-based aggregate SQL, 10-min cache, anonymous rows.
- Loader pointer validator (fail-soft ERROR logs) + NEW `backend/app/plugins/validator.py`
  plugin-contract validator (widgets/slots/ownership/nav/icons; currently 0 errors,
  1 warning over 48 manifests).
- Curriculum/NEB read API (`academics.py:983+`), Sparrow on HTTPS, WeasyPrint +
  python-docx in requirements, `scripts/migrate.py` Alembic driver.
- Test environment repaired this pass: project Postgres/Redis on 5435/6383;
  `aschool_test` recreated clean (vector/pg_trgm/uuid-ossp); suite = 561 collected.
  (Baseline run was invalid: 343 errors from a stale-schema DB + 5 real failures —
  rerun on the fresh DB is the first CI gate of Phase B.)

**Still open from W0 (carried into Phase B):** canonicalize the 23 legacy AI gates
(16 `ai_tools` + 7 `ai_adaptive_learning`); delete `ai_adaptive_learning/manifest.yaml`
after row migration; `/plugins/catalog` endpoint + delete the frontend alias
mirror (`frontend/lib/plugins.tsx:55`); delete 10 dead `services/ai/*` modules;
`student_health_records` → `health_profiles` merge; guardian edit/delete endpoints;
`log_usage`/`plugin_usage_logs` wiring or deletion; `basic_reports` manifest fix.

## 2. Corrections to the 2026-09-04 corpus (staleness ledger)

From D1 §D + today's verification (each now annotated in the digests):
`TC §3.14` "10 registry rows" is a runtime-seeded `TOOLS` list, not 4 rows;
"13 unmounted services" is now 11 (`curriculum_seed` and `rag` ARE mounted);
no `ai_teacher`/`teaching_content` models exist (greenfield confirmed);
`teaching_media.file_id` must reference `managed_files.id` (there is no `files` table);
`AIToolRegistry` has 14 columns (the 5-6 new catalog columns need a migration);
`min_plan_tier` is a literal `ai_suite` membership check, not tier comparison —
AI Teacher must NOT alias to `ai_suite` (separate paid plugin) and must assert
guardian consent explicitly (orchestrator only does it for category tutor/student);
`app/realtime.py` is 159 lines with only school rooms — lesson rooms are new code;
`design_studio.py` hosts 7 `/ai/*` routes duplicating `ai_tools.py` — included in
the W0-close migration; `exportPPTX` bug confirmed (`useExport.ts:314`).

## 3. Locked decisions (unchanged from v2 where still valid)

1. AI Teacher = **separate premium plugin `ai_teacher`** (D1 §A: separate service
   topology, per-school credential, session brokering, results written home) —
   Ashlya's ATeacher pattern, rebuilt on multi-tenant Postgres, Redis room state,
   token_hub streaming, workbench guardrails. NOT aliased into ai_suite.
2. **No AI whiteboard** (D3 §A.2 — every whiteboard-dependent capability SKIPped
   with named equivalents; circle-to-search dies, solvers survive as tools).
3. **No OCR/vision ingestion**; all teaching content admin-entered; the D1 §B
   `teaching_*` schema is the data model (draft→review→publish; override chain).
4. Sahayatri lands as **`nepal_curriculum`** (one new starter plugin, NPR 199:
   content entry, exercise bank, chapter reader, question-paper interop) +
   extensions to `ai_suite` (tool catalog + result templates + voice) +
   `ai_adaptive_learning` (SM-2/adaptive), `gamification`, `exams` (live quiz),
   `elibrary` (Sketchfab/OER + PDF chat), `wellbeing` (emotion coach). Only
   **4 genuinely new tables** beyond D1's 12: `spaced_rep_cards`, `student_xp_state`,
   `live_quiz_sessions`, `exercise_section_links`. Everything else EXTENDS an
   existing table (`question_bank_items`, `oer_resources`, `ai_tool_registry`,
   `points_logs`, `learning_paths`) — D3 §C is the field-by-field mapping.
5. Plugin/theme/widget/config v2 per D2: v1 manifests keep working via the
   `_normalize_manifest` adapter; the ratchet (`schema_version: 2`) converts
   warnings to errors; **public-site parity lock** (byte-equal theme CSS + 3-school
   Playwright visual diff at threshold 0) exists BEFORE any theme code changes.
6. Edge-TTS default voice with per-school queue/cache; Whisper STT via token_hub;
   every AI call (incl. TTS/STT) metered in the ledger; 402 semantics for credits.
7. Web pricing page publishes OUR tiers; never competitor prices (D4).
8. flutter_user is THE consumer app; flutter_admin stays; consolidation per v2 §7.

## 4. Phase A (DONE) — see §1.

## 5. Phase B — W0-close + design-system foundation (the everything-unblocker)

**B1 Backend closes (S):**
1. Canonicalize 23 legacy gates → `@plugin_required("ai_suite")`; add
   `test_ai_gate_aliases.py` asserting every gate slug is canonical-or-alias.
2. Row migration for legacy `school_plugins` slugs → canonical; then delete
   `ai_adaptive_learning/manifest.yaml` (keep its routes; slug alias remains).
3. `GET /api/v1/plugins/catalog` serving catalog + `slug_aliases` + icon map +
   feature flags; consume in `frontend/lib/plugins.tsx` (delete the mirror) and
   in the sidebar bootstrapper.
4. Delete the 10 dead `services/ai/*` modules (0 importers, re-verified);
   delete the empty `social_ads/` folder; fix `basic_reports` manifest pointer.
5. Guardian PATCH/DELETE endpoints + tests.
6. `student_health_records` → `health_profiles` data migration + drop shim
   `models/health.py`; declare `owns_tables` in both manifests.
7. Wire or delete `log_usage`/`plugin_usage_logs`.

**B2 Web Tier-1 widgets (M) — the D5 fix-order prerequisite:**
`DataTable` (server sort/filter/paginate/bulk/CSV), `ConfirmDialog` + undo toast,
`EmptyState`/`ErrorState`/`Skeleton`, `Sheet` drawer, `PageHeader`, `FilterBar`
(URL-synced), `Pagination`, `StatusPill`, `Wizard`, `JSONSchemaForm` v2 (18 typed
fields per D2 §C) + write `config_schema.yaml` for the top-20 plugins.

**B3 Portals (M) — kills D5's worst findings:**
1. **Delete the mock `/student` landing**; replace with real student_app data.
2. Re-export pattern (already proven by teacher/marks) for every portal route
   with an existing dashboard page; dedicated pages for
   parent: attendance/results/fees/chat/bus, student: results/timetable/library/lms,
   teacher: attendance/marks/timetable/notices.
3. Honest permission errors; role landing pages.

**E2E gate B:** pytest green on fresh DB (first valid full-suite run); validator
0 errors; `/plugins/catalog` consumed by web with the mirror deleted; all 18
portal routes render real data; mock page gone.

## 6. Phase C — AI Teacher plugin (D1 §A + D2 §G; replaces v2 W3, now as a PLUGIN)

Build order P1→P5, each E2E-tested live with the Groq key:

- **P1 Content spine:** `teaching_content.py` models per D1 §B DDL (12 tables;
  `teaching_media.file_id → managed_files.id`); admin entry API + draft→review→publish
  workflow; override chain (school version over platform seed).
- **P2 Runtime service:** separate service per D1 §A.1 (Flask app in
  `services/ai_teacher/` with its own Postgres schema access via restricted
  role + Redis room state); provisioning on install (credential per school);
  session brokering plugin routes; JWT + `lesson:{id}` socket auth with school
  scoping; board grammar + holdback parser + `repair_svg` ported verbatim
  (D2 §G grammar); analyzer→planner **wired** (fix ATeacher's dead-code defect);
  slide guidance included; streaming through token_hub (add `stream=True`
  support + quota reserve/reconcile per call); cost accounting two-sided
  (host-side plugin ledger + service-side task classes).
- **P3 Web client:** `frontend/app/dashboard/ai-teacher/` launcher + lesson player
  (BoardCanvas DOM+SVG hybrid, CaptionStream, barge-in, mastery panel); teacher
  monitoring widgets; Flutter follows in P5.
- **P4 Guardrails:** explicit consent assert, injection + moderation on every
  student turn, pseudonymization, per-lesson cost estimate pre-start, kill
  switch via plugin deactivate; eval set of 20 golden lessons in CI.
- **P5 Apps + completeness:** flutter_student LessonPlayer (snapshot cache for
  offline replay), flutter_teacher monitoring; lesson PDF export.

**E2E gate C:** seeded Grade-8 algebra lesson asserts blueprint/plan events,
valid WRITE+SVG per teaching slide, playable audio, captions match speech,
barge-in works, SM-2 rows update, summary + cost logged; red-team: injection via
barge-in, self-harm escalation, off-curriculum pivot — all guarded.

## 7. Phase D — Sahayatri-in: `nepal_curriculum` + ai_suite surface (D3 slices)

1. **D-1 `nepal_curriculum` plugin:** package v2 (`schema_version: 2` — the first
   ratchet dogfood), 12 tables from D1 §B + config_schema + hooks + widgets.yaml;
   admin entry UI (chapters/notes blocks/examples/formulas/terms/misconceptions/
   exam tips, bilingual, Bloom autofill + Jaccard dedupe); exercise bank browser
   (extends `question_bank_items`: +11 columns, enum widened with the 19 Nepal
   types — never force MCQ); chapter reader (web + flutter_student).
2. **D-2 Catalog + result templates:** `ai_tool_registry` +9 columns (D3 §D);
   seed the 153-tool catalog (D1 §C) with status tiers; 15 result templates
   (D3 §E) with TopicSelector/grounding badge/FollowUpChips/tokenCostBadge;
   web AI hub drives from `ui_type`; Flutter hub mirrors.
3. **D-3 Learning science:** `spaced_rep_cards` (SM-2 shared service with AI
   Teacher concepts), adaptive path + reasons (extends `learning_paths`),
   `student_xp_state` + XP events via `points_logs`, live quiz
   (`live_quiz_sessions`, join codes, server-authoritative, `lq:{code}` rooms on
   the existing socket auth model), gamification plugin screens filled.
4. **D-4 Voice + documents:** edge-tts service (ne-NP Sagar/Hemkala, expressive
   presets, LRU cache, per-school queue, 503+Retry-After), STT proxy, deck
   emitter via designer canvas (fix `useExport.ts:314` defineLayout bug), docx/pdf
   writers for every AI output; AI workbench pages render markdown+KaTeX.
5. **D-5 elibrary extensions:** Sketchfab/OER viewer (+6 columns licence/attribution),
   model annotator tool, PDF chat via RAG (SSRF-safe), research agent with
   allow-lists.

**E2E gate D:** golden-set evals per tool family; catalog renders 153 tools with
gating/costs; admin enters a chapter + 10 exercises and publishes; student reads
chapter and runs SM-2 review; live quiz with 3 sockets; credit exhaustion → 402 UI.

## 8. Phase E — Nepal competitive modules (v2 §10 unchanged, re-ranked by D4/D5)

① transcripts + per-school grading scales ② payroll TDS/SSF/PF ③ eSewa/FonePay +
partial refunds + bank reconciliation ④ marksheet/report-card print designer
(Veda's moat) ⑤ transport-fee billing + driver manifest ⑥ Smart SMS 2.0
(merge SMS+push + cost receipts) ⑦ IRD-verified billing polish + VAT vouchers
⑧ real timetable solver (constraint-aware; replaces greedy stub) + seat plans
⑨ subject-wise attendance + leave types + leave-requests approval UI
⑩ Excel import/export everywhere + migration kit (Veda/Paathshala/eZone/IEMIS
adapters; DOB+guardian-phone dedupe; BS↔AD; parallel-run; same-day cutover)
⑪ admissions CRM kanban ⑫ re-evaluation workflow ⑬ ZKTeco/RFID BYO + one-card
events ⑭ canteen wallet/POS + hostel mess/maintenance ⑮ alumni + wellbeing
fill-in ⑯ white-label app build pipeline (last).

## 9. Phase F — Mobile + market (v2 §7 + §11 unchanged)

Portals→apps: FCM deep links end-to-end, Nepali .arb + BS/AD pickers, the 12
shared widgets, camera homework submission, offline outbox, payment receipts,
dark-mode token fix; then pricing page + API docs + migration-kit landing.

## 10. Sequencing

```
Phase A done ──┬── B1 closes W0 ─→ B2 widgets ─→ B3 portals        (web track)
               ├── C AI Teacher P1–P5   (AI track, starts after B1)
               ├── D Sahayatri-in D1–D5 (content track, starts after B1; D-1 needs B2 forms)
               └── E competitive modules (after B3)
F mobile/market after C+D E2E gates
```

## 11. Anti-goals (unchanged)

No whiteboard. No OCR ingestion. No AI outside the workbench guardrails. No
Sahayatri auth/subscription internals, Redis-only persistence, `run_text_tool()`
catch-all, un-gated voice tutor, SSRF-y PDF fetch. No ATeacher session service,
in-memory room state, GET-with-text TTS, dead 1,400 lines. Never publish claimed
competitor pricing. The live public site's rendered design does not change
(parity lock before any theme work).
