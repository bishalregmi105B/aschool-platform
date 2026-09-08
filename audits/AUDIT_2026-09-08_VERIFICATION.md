# VERIFICATION AUDIT — 2026-09-08
**Scope:** every plan/claim in `audits_old/` (latest: `research/ROADMAP_V5_2026-09-05.md` §8 ledger, `W5/W5_B_BACKEND_CORE.md`, `W5/W5_C_BACKEND_AI_CURRICULUM.md`, `W5/W5_D_PLUGINS_WIDGETS_THEME.md`, `IMPLEMENTATION_AUDIT_2026-09-04.md`) checked against the codebase at local HEAD (`84903da`) **and** against production `root@2.25.81.90:/opt/aschool`.
**Method:** 3 parallel read-only verification agents (W5-C register, W5-B register, V5 ledger claims) + direct SSH prod inspection. All file:line below re-measured 2026-09-08.

---

## 1. Production state (2.25.81.90) — measured live

| Check | Result |
|---|---|
| Repo rev | `0ec7365` (code-identical to local HEAD; local has 2 docs-only commits on top) |
| Containers | 9/9 healthy — flask, nextjs, nginx, postgres, redis, celery-worker ×2, celery-beat, flower (up 27h–8d) |
| Migrations | **single head `a7c3e9f1d4b8`; `flask db current` = head** (reconciled, matches ledger) |
| AI catalog | `ai_tool_registry` = **41 rows** (wave-2 17/17 included) |
| LIVE AI | Groq key present in `/opt/aschool/.env`; real generation verified 2026-09-06 (ledger `84903da`) |
| TLS (S-10) | **self-signed** cert `CN=brighternepal.com` (issuer=self, 2026-08-30 → 2036-08-27). Site serves 301 → HTTPS. No certbot / Cloudflare Origin CA yet |
| Cloudflare real-IP (S-08 remainder) | **DONE on prod** — `nginx.tls.conf` has `real_ip_header CF-Connecting-IP` + CF ranges |
| Uncommitted local WIP (textbook/curriculum ingestion) | **NOT deployed** — 0 `textbook_*` / `question_subparts` tables in prod DB |
| Plugin loader (prod log) | "49 modules registered (41 from modules/, legacy fills gaps)" — matches W5-D census |

**Owner note (non-ASchool):** the same VPS also hosts a `vexel` stack whose celery containers are crash-looping (`Restarting`) and nextjs is `unhealthy`. Not an ASchool defect; flagging since it shares the host.

---

## 2. V5 roadmap build claims vs code (agent-verified)

| Ledger claim | Verdict | Evidence |
|---|---|---|
| Phase P parity lock | ✅ CONFIRMED | `backend/scripts/capture_theme_baseline.py`; `backend/tests/test_theme_parity.py` (registry-sync asserts vs `frontend/themes/registry.ts`); `frontend/__tests__/theme-parity.test.ts`. (Ledger named it `test_theme_baseline.py` — file is `test_theme_parity.py`.) |
| A′ MarksGridWidget wired | ✅ CONFIRMED (via plugin registry, not direct import) | `frontend/app/dashboard/exams/marks/page.tsx:216-218` → `lib/plugin-widgets/registry.ts:44` → `MarksGridWidget.tsx` |
| A′ attendance keyboard + explicit-unmarked | ✅ CONFIRMED | `attendance/page.tsx:505` (onKeyDown), `:201/:557-559` (unmarked badge), `:573` (save disabled while unmarked) |
| A′ confirm()→ConfirmDialog | ⚠️ PARTIAL | 7 dashboard pages use `useConfirm()`; **~12 native `confirm(` remain** (website-builder ×2, timetable, transport ×2, parents/[id], attendance/holidays, …) |
| W ratchet 49/49 → schema v2 | ✅ CONFIRMED | all 41 module manifests + 8 legacy declare `schema_version: 2` (grep -L empty); plugin_doctor 0 errors / 0 warnings |
| T-1 writer blocks | ✅ CONFIRMED | `template_engine.py` `_w_section_header/_w_question/_w_answer_space/_w_page_break/_w_checklist` (:563-582) + `tests/test_writer_assessment_blocks.py` |
| T-2 wave-2 17/17, catalog 41 | ✅ CONFIRMED | 41 `"tool_key"` entries in `workbench_seed.py` TOOLS; all 17 wave-2 slugs present; frontend pages exist (dir names differ from slugs: `exam-timetable-draft`, `choice-board`) |
| C″ ATeacher host adaptation | ✅ CONFIRMED | `service_client.py` HMAC-SHA256 ±300s, real `stop_lesson` (:161-195, decrypts webhook-secret envelope); player URL query-param style (`routes.py:407-411`) |
| Frontend tests | ✅ jest 10 suites / **47/47 pass** | incl. theme-parity |
| Backend tests collectable | ⚠️ 630 collect clean **today**, but see §4 — `create_all` on a fresh schema crashes | |

**Net: the shipped roadmap slices are real and deployed.** The remaining V5 phases (A′ long tail, W dashboard_layouts/W-02..04/template packs, T waves 3-4, D/E/F) were **not started** — consistent with the ledger, which never claimed them.

---

## 3. W5 defect registers vs code — the audits' known issues are NOT fixed

### W5-C AI register (`W5_C` §7): **0 of 15 fixed, 1 partial**
| ID | Sev | Defect | Status | Evidence |
|---|---|---|---|---|
| A1 | **P0** | AI-Teacher self-harm moderation dead: `category, _ = moderate(...)` unpacks backwards; `ModerationFlag(tool_key=…)` is not a column | **STILL PRESENT** | `plugins/modules/ai_teacher/routes.py:700-711`; `workbench.py:91-97`; `models/ai_workbench.py:262-276` |
| A2 | P1 | `context_curriculum` uses helper function as model → AttributeError → **16 of 41 tools 500** once a framework is seeded | STILL PRESENT | `tool_handlers.py:27-33,53-56` |
| A3 | P1 | `models/__init__.py` never imports `textbook`/`curriculum_graph` → `NoReferencedTableError` on `db.metadata.sorted_tables` (live repro) | STILL PRESENT | `models/__init__.py:92-93`; repro run 2026-09-08 |
| A4 | P1 | Seed drops catalog columns (`trigger_phrases`, `ui_type`, `icon`, `badge`, `budget`, `grounding`, `sort_order`, `output_document_type`) | STILL PRESENT | `workbench_seed.py:890-902` |
| A5 | P1 | `POST /ai-teacher/lessons/<id>/stop` never calls `service_client.stop_lesson` | STILL PRESENT | `routes.py:497-517`; only caller `hooks.py:221-223` |
| A6 | P1 | No migrations for `textbook_*` ×5, `curriculum_*` ×3, `question_subparts`, `question_rubric_steps`, or the 12 new `question_bank_items` columns | STILL PRESENT | `migrations/versions/` (58 files, zero hits) |
| A7 | P2 | Consent `scope` (tutor\|tools\|all) never checked | STILL PRESENT | `workbench.py:294-310`; `ai_tutor.py:51-58` |
| A9 | P2 | AI-Teacher webhook resolves lesson by payload id with **no school check against the key** → cross-tenant event injection | STILL PRESENT | `routes.py:641-644` |
| A10 | P2 | Webhook idempotency unenforced → replays double-count + IntegrityError 500 | STILL PRESENT | `routes.py:652+` |
| A11 | P2 | `embed()`/`transcribe()` bypass `_check_quota` (un-metered spend) | STILL PRESENT | `token_hub.py:914-1005` |
| A12 | P2 | `AIGeneration.prompt_sha256` always NULL; `fallback_used` hardcoded | STILL PRESENT | `token_hub.py:723-730`; `workbench.py:373` |
| A14 | P2 | Tutor turn/close: any school member can post to any student's session | STILL PRESENT | `ai_tutor.py:101-143` |
| A15 | P2 | homework-help: no role/consent; IEP draft: real name unpseudonymized, no guardian consent | **PARTIAL** (IEP got `role_required`) | `ai_tools.py:163-182`; `ai_workbench.py:351-425` |
| A17 | P2 | `context_attendance` referenced by seed but handler doesn't exist; silent `{}` fallback | STILL PRESENT | `workbench_seed.py:358`; `tool_handlers.py:13,185`; `workbench.py:323-326` |
| A18 | P2 | `trigger_phrases` JSONB model vs `sa.Text()` migration drift | STILL PRESENT | `f6b2d8e4c1a9:25` vs `ai_workbench.py:106` |
| A25 | P3 | `seed_pd_framework` double-writes DocumentChunks (direct insert + RAGService.ingest) | STILL PRESENT | `extensions.py:56-81` |

### W5-B backend register (`W5_B` §8): **0 of 19 fixed, 2 partial**
| # | Sev | Defect | Status | Evidence |
|---|---|---|---|---|
| B1 | **P0** | `list_students` no `role_required`; `to_dict()` leaks `default_password_hint` (deterministic default pw) | **PARTIAL** — jwt+school added, no role gate, hint still leaked | `api/v1/students.py:27-29`; `models/student.py:192` |
| B2 | P1 | NULL-`school_id` non-superadmin user passes `_cross_tenant_response` → binds any school | STILL PRESENT | `app/__init__.py:434-447` |
| B3 | P1 | GPS Haversine `radians(lon2 - lat1)` typo → wrong geofence (child-safety) | STILL PRESENT | `tasks/gps_processing.py:150` |
| B4 | P1 | `report_generation` uses non-enum roles `"principal","admin"` → LookupError crash | STILL PRESENT | `tasks/report_generation.py:379` (also :301) |
| B5 | P1 | `website_live_sync` calls `create_app()` per task run | STILL PRESENT | `tasks/website_live_sync.py:38-41,251-254` |
| B6 | P1 | `utils/money.py` Decimal helpers dead; fees scholarship + IRD VAT split in float → paisa drift | STILL PRESENT | `fees.py:2425-2433,2798-2800`; zero importers |
| B9 | P1 | Zero composite FKs — no DB enforcement child.school_id == parent.school_id | STILL PRESENT | no `ForeignKeyConstraint` in models/ |
| B11 | P2 | 35× `date.today()` (server-local) for attendance/fee dates → wrong "today" before 05:45 NPT on UTC | STILL PRESENT | `api/v1/*.py`; no Kathmandu helper exists |
| B13 | P2 | GPS push to non-enum roles `["admin","principal","transport_manager"]` → matches zero users | STILL PRESENT | `gps_processing.py:176-182` |
| B14 | P2 | Attendance bulk-mark N+1 per-record queries | STILL PRESENT | `attendance.py:71-83` |
| B15 | P2 | `utils/permissions.py` RBAC matrix referenced nowhere | STILL PRESENT | zero importers |
| B16 | P2 | Orphan services `notification_engine.py`, `lms/video_service.py` | STILL PRESENT | zero importers |
| B17 | P2 | `faq.py`/`hostel.py` extend `db.Model` directly (no UUID/timestamps/soft-delete) | STILL PRESENT | `models/faq.py:8`; `models/hostel.py:8,27,54` |
| B19 | P2 | Human `student_id` no unique constraint | STILL PRESENT | `models/student.py:50` |
| B20 | P2 | `trigger_phrases` Text-vs-JSONB drift | STILL PRESENT | same as A18 |
| B21 | P3 | Timetable list unbounded `.all()` | STILL PRESENT | `timetable.py:42,52` |
| B22 | P3 | Request-ID/log middleware registered only in production | STILL PRESENT | `app/__init__.py:27` |
| B23 | P3 | `celery_app.py` module-level `app_context().push()` | STILL PRESENT (single context now) | `celery_app.py:7-8` |
| B24 | P3 | Silent `except: pass` in api/v1 | **PARTIAL** — down to 5 (files, assignments, iemis_importer, design_studio ×2) | |

*(B7/B8 fold into A3/A6 above; B10 naive-DateTime = D-03 remainder, still open — 113 naive columns.)*

---

## 4. Uncommitted local work (in-flight, beyond any ledger)

`git status` shows a **curriculum/textbook multimodal-ingestion feature in progress, uncommitted and undeployed**:
- New: `models/textbook.py`, `models/curriculum_graph.py`, `services/ai/curriculum_context_builder.py`, `utils/preeti_transcoder.py` (+tests), `scripts/ingest_textbook_catalog.py`, `docs/CURRICULUM_MULTIMODAL_INGESTION_ARCHITECTURE.md`, `pytest.ini`
- Modified: `models/question_bank.py` (adds QuestionSubpart/QuestionRubricStep + textbook FKs), `pyproject.toml`, `MarksGridWidget.tsx`, `test_b_prime_fixes.py`

**This WIP is actively breaking:** the new FKs to `textbook_assets/textbook_sections` in `question_bank.py` + missing `models/__init__.py` imports → `NoReferencedTableError` on `db.metadata.sorted_tables`, i.e. `conftest.create_all()` and `alembic revision --autogenerate` crash on a fresh schema. It also carries audit findings of its own: `curriculum_context_builder.py` has **zero tenancy checks** (A19, dormant cross-tenant read primitive), Preeti map duplicate keys, hard-coded corpus path in the ingest script.

**Bottom line: green-CI is one bad checkout away.** This must be completed or parked before any further work.

---

## 5. Verdict summary

| Bucket | Status |
|---|---|
| Planned & implemented & deployed | Parity lock, schema-v2 ratchet (41/41), writer blocks, wave-2 (17/17 → catalog 41 live on prod), ATeacher host adaptation (client rewrite/player URL/webhook envelope), MarksGrid + attendance A′ items, prod infra (CF real-IP, migrations at head, live Groq AI) |
| Planned but NOT started (per V5 sequencing — expected) | A′ long tail (12 native confirm(), fees POS, homework submit, pagination ×13, error states ×68, RBAC editor, exams `[id]` 404), W dashboard_layouts/config popovers/W-02..04/template packs/events.yaml/mobile.yaml, T waves 3-4 (wave-3 now unblocked: writer blocks done), D nepal_curriculum build, E money pack, F mobile, D-03 TIMESTAMPTZ contract, D-06 money JSONB, P-04 full observability (/metrics), P-05 entitlement repair, P-06 shared-layer adoption, F-01/F-02, Nepal N-03..N-08, AW-05 library CRUD, AW-06 red-team, AW-07 IEP completion, AW-12 student/parent pages, A-01 cost-atomic quota + per-user quotas, A-03 blueprint validation/PDF-OMR/UI, S-10 real TLS |
| Known issues identified by audits, still UNFIXED in code | **All 2 P0s, 8 P1s, 20+ P2/P3s from W5-B/W5-C (§3)** — zero remediation since the audits were written; prod runs this exact code |
| In-flight, uncommitted, breaking | Curriculum/textbook ingestion WIP (§4) |
