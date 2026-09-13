# DUPLICATION_MATRIX — Feature/Plugin Duplication Across ASchool's Stack

**Date:** 2026-09-13. **Built by:** the orchestrator (Step 2.5a), from `RECON_MAP.md` (auto-generated spine), `aschool-backend.md` (42 plugin flow traces + 867-route inventory), `aschool-frontend.md` (60-module route/element inventory), `aschool-mobile.md` (zero-representation enumeration), `aschool-supporting.md` (IEMIS wiring), and the prior corpus leads (`audits_old/research/ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md`, `audits_old/ALL_57_PLUGINS_DEEP_DIVE_AUDIT_2026-08-27.md`) re-verified at source by the subagents. Every row below carries evidence from the current pass — nothing is inherited unverified.

**How to read:** each row names a feature concept that appears more than once in ASchool's own stack (different names, different code, or partial overlap). Resolution column uses: **merge / rename / deprecate / keep-as-is / needs-product-decision**, with reason.

---

## 1. Incidents cluster — `incidents` vs `incident_management`

**Question asked:** are these genuinely different concepts or one feature built twice?

**Answer: one feature, layered twice — architecturally clean, commercially and navigationally duplicated.**

| Layer | `incidents` (base tier) | `incident_management` (workflow tier) |
|---|---|---|
| Plugin manifest | `modules/incidents/manifest.yaml` — display name **"Incident Management"**, **premium, NPR 299** | `modules/incident_management/manifest.yaml` — display name **"Full Incident Management"**, **growth, NPR 199** |
| Models | `app/models/incident.py:18-83` — `incidents`, `witness_statements`, `incident_actions` | `app/models/incident_management.py:23-57` — `incident_escalations`, `incident_workflow_events` (FK onto base `incidents`) |
| API | `app/api/v1/incidents.py` — 8 routes (CRUD + statements + actions), `POST /incidents` at `:43-98` | `app/plugins/modules/incident_management/routes.py` — 11 routes (`/incidents/management/*`: overview/active/escalations/assign/status/resolve/conference/audit/reports), escalate at `:304-383` reads base entity, severity must strictly rise |
| Frontend | `/dashboard/incidents` (175 lines) | `/dashboard/incident-management` (4 pages: 104/142/103/129 lines) |
| Mobile | flutter_admin `incidents` feature (thin list screen) | **zero mobile** |
| Desktop shell | both appear as separate apps under the **Safety & Compliance** folder (`aschool-frontend.md` §9.3) | same |

**Verdict:** the entity split is real and good — base CRUD vs escalation/workflow tier with no route duplication (verified: no `POST /incidents` in the workflow module, `aschool-backend.md` §4 #28-29). What's duplicated is the *product surface*: two manifests with colliding display names ("Incident Management" vs "Full Incident Management"), a **pricing inversion** (the smaller workflow tier is cheaper than the base at a higher tier name), two dashboard route families, two desktop apps, and mobile covering only one slug. The merge has been deferred twice in the ledger (AUDIT_INDEX A-09 deferral note, 2026-09-09; S-A1 notes).

**Recommendation: MERGE (as one product, two capability tiers).** Single plugin `incidents` ("Incident Management"); fold `incident_management`'s routes/models in as its workflow module; marketplace shows one card with "Escalation & Workflow" as a plan-gated capability (the entitlement system already supports per-capability gating — `aschool-backend.md` §2). Redirect `/dashboard/incident-management` → `/dashboard/incidents/workflow`. Eliminates the name collision, the pricing inversion, and the mobile orphan in one move. **Owner: backend + frontend, ~2-3 days.**

---

## 2. Library cluster — `library` (route) vs `elibrary` (route+plugin) vs `library_management` (plugin) (+ legacy `digital_content`)

**Question asked:** physical vs digital library, or overlapping?

**Answer: conceptually distinct (physical vs digital) and largely cleaned up — one live manifest bug and one vestigial table remain.**

| Surface | Physical library | Digital library |
|---|---|---|
| Models | `app/models/library.py` (v2: `book_copies`, racks, reservations, fines, stocktake, vendors, POs) | `app/models/digital_content.py` (`digital_books`, `past_papers`, `oer`) |
| API | `app/api/v1/library.py` — 34 routes (`/library/*`) | `app/api/v1/elibrary.py` — 6 routes (`/elibrary/*`: books/papers/resources) |
| Plugin | `library_management` (starter 99, alias `library`) | `elibrary` (starter 99, legacy alias `digital_content`) |
| Frontend | `/dashboard/library` — 10 pages (hub/books/catalog/checkout/fines/overdue/reports/reservations/stocktake) | `/dashboard/elibrary` — 3 pages (hub/past-papers/upload) + student `/student/elibrary` |
| Mobile | admin/teacher/student library screens — **thin**: 3 of 34 rules consumed (no scan/holds/fines/stocktake) | student + parent elibrary screens |

**Verified cleanups this pass:** deprecated manifests removed; aliases reduced to `decorators.py:19-20` entries (`library→library_management`, `digital_content→elibrary`) — the old "library vs digital_content plugin alias mess" from the prior duplication audit is resolved at manifest level (`aschool-backend.md` §3.2).

**Remaining defects:**
1. **elibrary manifest pointer bug:** `modules/elibrary/manifest.yaml` declares `api_blueprint: app.api.v1.library` — the *physical* blueprint — instead of its own `app.api.v1.elibrary`. Inert today only because elibrary's own blueprint is statically mounted and elibrary happens to sort before library_management in loader order (i.e., it works by accident). (`aschool-backend.md` §4.0 — flagged as the exact bug class the pointer validator exists to catch.)
2. **Vestigial `book_transactions` table** still exists (AUDIT_INDEX A-08 deferred drop).
3. **Mobile depth gap**: physical library on mobile is 3 endpoints deep vs the 34-route v2 backend (mobile report §5.2 "thin" list).

**Recommendation: KEEP-AS-IS conceptually (physical vs digital are real, distinct products — no merge); FIX the three defects.** (a) correct elibrary's `api_blueprint` to `app.api.v1.elibrary` and add a loader rule that a manifest may not point at another domain's blueprint; (b) execute the deferred `book_transactions` drop; (c) treat mobile scan/holds as a parity item (see MOBILE_PARITY_GAP.md). No user-facing rename needed — the two dashboard routes are legible ("Library" vs "E-Library"). **Owner: backend, half a day + one migration.**

---

## 3. AI surface fragmentation — the largest cluster

**Question asked:** `ai-teacher`, `ai-tools`, `ai-workbench` (dashboard routes), `ai-tutor` (student route) vs `ai_suite`, `ai_teacher`, `ai_adaptive_learning` (plugins) vs `ai_insight`, `ai_token`, `ai_workbench`, `ai_teacher`, `adaptive_learning` (models) vs 7 AI API modules — are the boundaries legible to an end user or just to the codebase?

**Answer: the backend gating is now consolidated and legible; the user-facing surface is still fragmented across 3 dashboard routes + 1 student route + adjacent analytics/benchmarking, with one broken module and several zero-mobile pillar surfaces.**

**Backend state (verified this pass):**
- The 7-way consolidation is DONE at the entitlement layer: `ai_grading/ai_tutor/ai_tools/ai_adaptive_learning/ai_insights/benchmarking/advanced_analytics → ai_suite` (alias family, `aschool-backend.md` §2). The prior "ai_suite gating split-brain" (duplication-audit P0-1) is **FIXED**: every `ai_*` route gates `ai_suite` (verified in `ai_tools.py`, `ai_adaptive_learning/routes.py:221,255,298,418,436,474,507`, `ai_tutor.py`, `benchmarking.py:33,49`).
- API modules: `ai_tools.py`, `ai_tutor.py`, `ai_workbench.py` (14 rules), `ai_usage.py`, `ai_capture.py` (3), `ai_extensions.py` (service module hosting **in-memory live-polls routes** — a P2: no gates, no tests, no consumers), `adaptive_learning.py`.
- Models: `ai_insight`, `ai_token`, `ai_workbench`, `ai_teacher`, `adaptive_learning` — distinct backing stores, fine internally.

**What each role actually encounters (the legibility test):**

| Role | AI surfaces encountered | Legible? |
|---|---|---|
| School admin (AOS shell) | Desktop "AI tools" hub (catalog of 20+ tools, 23 subpages), "AI Teacher" app (359-ln launch page), "AI Workbench" app (396 ln), Insights folder → analytics (4 pages) + benchmarking (1 page) — **4-6 separate entry points**, all gated by one `ai_suite` install | Partially — one install but four product names; legacy AOS aliases still map `lab→ai-workbench` (`AOSModuleRegistry.tsx:154-190`) |
| Teacher | Teacher portal `ai-tools` = **one-line re-export of the dashboard page** (`app/teacher/ai-tools/page.tsx`), rendering OUTSIDE the AOS shell with different chrome (`aschool-frontend.md` §3.3) | No — teachers get an unshelled redirect, not a tailored surface |
| Student | `/student/ai-tutor` only — **stateless single-shot** homework-help; the richer `ai_tutor.py` session endpoints (plans/sessions/turn/close/messages/monitor, `ai_tutor.py:18-187`) have ZERO mobile consumers (mobile report §5.2) | No — the product's stated AI pillar has almost no student-facing depth |
| Parent | none | Deliberate |

**Broken/orphan pieces in this cluster:**
1. **`ai_adaptive_learning` is the only manifest-less plugin module** (42 dirs, 41 manifests — RECON_MAP §1 #10). Its routes are live and ai_suite-gated, but its lifecycle hooks are unreachable dead code and it is invisible to the catalog/validator (`aschool-backend.md` weaknesses #9).
2. `ai_capture.py` (photo-capture AI — homework scan, a stated plan in FINAL_AI_PLATFORM_PLAN) has **no client anywhere**.
3. `ai_workbench` (14 rules) has zero mobile consumers; `ai_teacher` has zero mobile consumers.

**Recommendation (split):**
- **backend:** give `ai_adaptive_learning` a manifest or fold its module into `ai_suite` (needs-product-decision only on whether adaptive practice is sold separately — default: fold, it already gates ai_suite); move `live-polls` out of `ai_extensions.py` into a real gated route module or delete it.
- **frontend:** unify the admin/teacher surface under ONE "AI Hub" app with tabs (Tools / Teacher / Workbench / Insights); retire the `lab→ai-workbench` legacy alias; give teachers a real in-shell teacher-tailored AI page instead of the one-line re-export.
- **product:** the AI pillar's mobile absence (student tutor sessions, teacher AI tools beyond 4 generate-tools) is a roadmap item, not a rename — see MOBILE_PARITY_GAP.md rows.
**Owner: backend 1 day (manifest/fold), frontend 3-5 days (hub consolidation).**

---

## 4. Compliance cluster — `compliance` (plugin+route) vs `iemis_importer` (plugin) vs `iemis-import` (route) vs `iemis.py`/`compliance.py` (models) (+ `bulk-uploads/iemis`)

**Question asked:** one Nepal-compliance flow surfaced three times, or three real sub-flows?

**Answer: three real sub-flows (import / export / reports) — but they are scattered across two plugins, three frontend entry points, and the paid one is functionally hollow.**

| Sub-flow | Plugin | API | Frontend | State (verified live this pass) |
|---|---|---|---|---|
| MoEST Excel **import** | `iemis_importer` (add_on, free) | `iemis_importer.py` — 6 routes; `POST /iemis/import` at `:1111-1180+` parses 3 government formats header-exact, writes `iemis_import_logs`, imports students/staff/school-level | `/dashboard/iemis-import` (546 + 136 lines) AND `/dashboard/bulk-uploads/iemis` (202 lines) — **two entry points for the same import** | WORKS — live dry-run validated 308/308 rows against the real templates (`aschool-supporting.md` §3) |
| EMIS **export** | `compliance` (growth 149) | `compliance.py:134-155` `POST /compliance/emis/generate` writes `emis_exports`; download at `:156+` | `/dashboard/compliance` (91 lines) | **BROKEN-ISH** — the page "renders a field contract the API never returns with a dead button"; the `export_emis_data` Celery task has **no caller** (`aschool-supporting.md` §3, `aschool-backend.md` §5) |
| Compliance **reports** + audit logs | `compliance` | `compliance.py:25-120` reports CRUD + `:211` audit-logs (mobile-consumed per route table) | inside `/dashboard/compliance` | thin but functional |
| Models | — | `app/models/iemis.py` + `app/models/compliance.py` (separate stores: import logs vs exports/reports) | — | distinct, fine |

**Also verified:** the `iemis_templates/` XLSX files themselves are orphaned from code (referenced by zero files) and contain **308 real student PII rows** — a compliance liability in itself (supporting report §3). The compliance plugin's manifest claims mobile support but ships none.

**Recommendation: KEEP three sub-flows, ONE product surface.** (a) Merge `/dashboard/bulk-uploads/iemis` into `/dashboard/iemis-import` (single import wizard with history); (b) fix the compliance page to the real API contract and wire `export_emis_data` (or delete the task); (c) re-title the marketplace card to "Compliance & IEMIS" covering import+export+reports so schools stop seeing two products; (d) purge the PII XLSX from the repo and git history. **Owner: backend 1-2 days, frontend 1-2 days, security hygiene immediate.**

---

## 5. Website cluster — `basic_website` (plugin) vs `website_builder` (plugin) vs `website`/`website_builder` (APIs) vs `website-builder` (route) vs public site

| Piece | Gate | Evidence |
|---|---|---|
| `basic_website` — "School Website", **core, free** | gates `app.api.v1.website` (21 routes: public site config/sliders/teachers/events) | `aschool-backend.md` §4 #10 |
| `website_builder` — "Advanced Website Builder", **premium 299** | gates `app.api.v1.website_builder` (27 routes: pages/sections/themes/AI-design/SEO/domain/publish/revert/history) | §4 #40; publish→ISR revalidate→`website.published` event |
| Frontend | `/dashboard/website-builder` (7 pages incl. `website-design` 11-line redirect into it); public site `app/school/[slug]` (14+ routes) renders both basic config and builder pages | frontend report §8 |

**Verdict: a deliberate free-tier vs premium-tier split over genuinely different APIs — but presented in the marketplace as two unrelated plugins rather than one product with tiers.** The `basic_website` card does nothing to explain that installing only it yields the simple site, and the builder is the upgrade.

**Recommendation: keep-as-is at the code level; RENAME in the marketplace layer** — present "Website" (core) and "Website Builder Pro" (upgrade path, "requires/includes Website"), the same way the incidents merge should present tiers. Trivial: catalog metadata only. **Owner: plugin catalog config, hours.**

---

## 6. Transport vs `gps_tracking` — naming-only duplication

`gps_tracking` (premium 299) gates the entire `app/api.v1.transport` domain (28 routes); alias `transport→gps_tracking` (`decorators.py`). One coherent product (S-A4 trip lifecycle + geofence engine + ESP32 ingest); the plugin is named after one feature of the domain it gates. Mobile covers it three ways (parent bus tracker, flutter_user driver, admin transport). **Recommendation: rename the plugin display name to "Transport & GPS Tracking" (catalog-only change). Keep-as-is otherwise.**

---

## 7. SMS/Communications — `sms_notifications` (plugin) vs `sms` (API+route) vs `communications` (API+route family)

- `sms_notifications` (starter 99) gates both `app/api.v1.sms` (5 routes) and the `communications` API (broadcast etc., e.g. `POST /communications/broadcast` gated by sms_notifications at `communications.py:234`); alias `communications→sms_notifications`.
- Frontend: `/dashboard/sms` (1 page, 716 lines) whose Quick Links panel points into `/dashboard/communications/*` (9+5 pages: announcements/broadcast/diary/gallery/sliders/templates/whatsapp) — the SMS page is already acting as a de-facto hub for the communications family (frontend report §4 #17-18).
- Mobile: zero (deliberate — backend channel).

**Verdict: one plugin, two route families, one page already federating the other.** **Recommendation: merge `/dashboard/sms` into `/dashboard/communications` as a "Broadcast & SMS" tab (frontend consolidation, mirrors the incidents merge); keep the plugin as-is.**

---

## 8. AOS legacy route aliases (frontend-internal)

`classroom→lms`, `gradebook→exams`, `vault→filemanager`, `notebook→assignments`, `lab→ai-workbench`, `admin→users`, `finance→fees` (`AOSModuleRegistry.tsx:154-190`) — harmless redirects that keep old deep links alive but "grow conceptual surface" (frontend report §9.3). **Recommendation: keep-as-is until usage telemetry says otherwise; do not add new ones.**

---

## 9. Resolved-this-pass / dismissed candidates (recorded so nobody re-opens them without new evidence)

| Prior-corpus candidate | Status at current HEAD |
|---|---|
| library vs digital_content plugin alias mess | **Resolved** — deprecated manifests removed; only `decorators.py` alias entries remain (backend report §3.2) |
| ai_suite gating split-brain (P0-1) | **Resolved** — all ai_* routes gate ai_suite (backend report §2, verified per-file) |
| ~20 fictional service declarations in manifests | **Resolved** — pointer validation (`loader.py:187-237`) killed the class; the one survivor it can't catch (elibrary, §2 above) is a valid path to the *wrong* domain |
| `book_transactions` vestigial table | **Still open** (deferred drop, A-08) — tracked in §2 |
| incidents/incident_management merge | **Still open** (deferred twice) — this matrix's #1 recommendation |

---

## Priority order of the recommendations

1. **Incidents merge** (name collision + pricing inversion + mobile orphan + user-visible duplicate apps) — merge, 2-3 days.
2. **Compliance cluster** (broken paid page + duplicate import entry + PII files in repo) — fix + consolidate, 3-4 days + immediate hygiene.
3. **AI cluster** (manifest-less module + hub consolidation + teacher re-export) — fold/manifest + AI Hub, ~1 week.
4. **elibrary manifest pointer + book_transactions drop** — half a day.
5. **Marketplace tier-presentation for website pair + gps_tracking rename** — catalog metadata, hours.
6. **SMS page merge into communications** — frontend consolidation, 1 day.
