# R2 — CORPUS MASTER LEDGER (deduplicated requirement/backlog union)

Date: 2026-09-05 · Method: full read of the ASchool audit corpus (~26k lines across 90 markdown files under
`audits/**` + `docs/MASTER_PLAN_2026-09.md`). **Nothing here was verified against source code** — this file
records what the corpus *asks for*, what it *claims is done*, and where it *contradicts itself*. A separate
verifier agent owns ground truth.

Citation shorthand used throughout: `ROADMAP` = `audits/research/UNIFIED_ROADMAP_2026-09.md` ·
`D1`/`D2`/`D3`/`D4`/`D5` = the `_digest/` files · `R1` = `_digest/R1_PRIOR_CORPUS_RECONCILED.md` ·
`MP` = `docs/MASTER_PLAN_2026-09.md` · `IA` = `audits/IMPLEMENTATION_AUDIT_2026-09-04.md` ·
`A1`/`A1a`/`A1b`/`A1c`/`A2` = `audits/research/W3/*` · `AT` = `ATEACHER_PLUGIN_INTEGRATION.md` ·
`ATIB` = `ATEACHER_INTEGRATION_BLUEPRINT.md` · `PTTA` = `PLUGIN_THEME_TEMPLATE_ARCHITECTURE.md` ·
`TC` = `AI_TOOL_CATALOG_AND_SKILLS.md` · `BCA` = `ASCHOOL_BACKEND_COMPLETENESS_AUDIT.md` ·
`PDA` = `ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md` · `WUI`/`WWA` = web UI / web widget audits ·
`MAI`/`FWA` = mobile apps inventory / flutter widget audit · `CS` = `ASCHOOL_CURRENT_STATE.md` ·
`CLN` = `COMPETITOR_LANDSCAPE_NEPAL.md` · `SI`/`BC`/`UX` = the three Sahayatri reports ·
`PUSA` = `PLUGIN_UI_SPEC_ALL.md` · `deep/NN` = `audits/deep2026/NN_*.md`.

---

# §0 CORPUS MAP

Verdict key: **CURRENT** = plan-of-record or its live evidence base · **SUPERSEDED** = still readable but
overtaken by a later file · **INCOMPLETE** = ends on an unfilled append marker / promises content it never
delivers · **ORPHANED** = not referenced by `AUDIT_INDEX.md` nor by `ROADMAP` · **HISTORICAL** = pre-2026-08
artefact kept for provenance.

## §0.1 Plan of record + its evidence base

| File | Lines | Date | Verdict |
|---|---|---|---|
| `audits/research/UNIFIED_ROADMAP_2026-09.md` | 247 | 2026-09-05 | **CURRENT** — roadmap v3 FINAL, plan of record; supersedes v2 (2026-09-04) and every earlier plan |
| `_digest/D1_AITEACHER_AND_TOOLS.md` | 1,137 | 2026-09-05 | **CURRENT** — locks AI Teacher topology/endpoints/12-table DDL + the 153-tool catalog; §D is its own staleness ledger |
| `_digest/D2_ARCHITECTURE_AND_ENGINE.md` | 574 | 2026-09-05 | **CURRENT** — plugin/widget/config/theme v2 + ATeacher engine internals; ends with an explicit "open gaps in the sources" section |
| `_digest/D3_SAHAYATRI_PLUGIN_SPEC.md` | 2,911 | 2026-09-05 | **CURRENT** — Sahayatri→`nepal_curriculum` spec; the largest single spec in the corpus |
| `_digest/D4_COMPETITOR_REFRESH.md` | 95 | 2026-09-05 | **CURRENT** — delta-only refresh; ROADMAP §0 mis-states its length as 65 lines |
| `_digest/D5_DAY_IN_THE_LIFE_REVIEW.md` | 124 | 2026-09-05 | **CURRENT** — 4-role click traces; ROADMAP §0 mis-states its length as 145 lines |
| `_digest/R1_PRIOR_CORPUS_RECONCILED.md` | 1,003 | 2026-09-05 | **INCOMPLETE** — delivers §A (17 precis) then stops at `<!--APPEND-A-->`. §B (13 forward-referenced contradictions `§B-1`…`§B-13`), §C and §D (the verifier job list, referenced from its own header and from A15) **do not exist**. This ledger's §3 reconstructs them |
| `docs/MASTER_PLAN_2026-09.md` | 448 | 2026-09-03 | **SUPERSEDED as sequencing, CURRENT as work-item spec** — ROADMAP replaces its phase order; MP is still the only place the S-/D-/P-/A-/AW-/W-/G-/M-/N-/I- item IDs and their acceptance criteria are written out |
| `audits/IMPLEMENTATION_AUDIT_2026-09-04.md` | 97 | 2026-09-04 | **CURRENT** — 4-agent verdict per master-plan ID over commits `097e39c`→`e3d5589`; the source of every "done" claim in CS §2 |
| `docs/AI_TEACHING_ECOSYSTEM_PROMPT_2026-09.md` | 740 | 2026-09-03 | **CURRENT (companion spec)** — the AW-01…AW-12 ecosystem spec MP §4b depends on; **not in the read list of any digest**, so its ~65-tool catalog was never reconciled against D1's 153 |

## §0.2 W3 wave (2026-09-05) — backend/datamodel audit + inventories

| File | Lines | Date | Verdict |
|---|---|---|---|
| `W3/A1_BACKEND_CORE_DATAMODEL.md` | 976 | 2026-09-05 (undated in body) | **CURRENT** — the deepest datamodel read in the corpus (196 tables, 66 model files, 22 utils, 21 task modules, 41 task names, 14 beat entries). Ends on `<!-- SECTION_2_ANCHOR -->`; §8+ (API audit) was split into A2. Not referenced by `AUDIT_INDEX` → **ORPHANED from the index** |
| `W3/A1a_BOOTSTRAP_AND_LIFECYCLE.md` | 328 | 2026-09-05 | **CURRENT** — boot/middleware/CORS/CSRF/seed-side-effect slice of A1; forward-references an `A1e` fix file that **does not exist**. ORPHANED from the index |
| `W3/A1b_TABLE_CATALOG.md` | 367 | 2026-09-05 | **CURRENT** — 196-table catalog + tenancy/JSONB/UQ tables. ORPHANED from the index |
| `W3/A1c_FK_MAP_AND_DEFECTS.md` | 328 | 2026-09-05 | **CURRENT** — FK map, cross-tenant edges, duplicate-table verdicts, enum/datetime defects. Ends on `<!--APPEND-->` after §4.5 → **INCOMPLETE**; ORPHANED from the index |
| `W3/A2_BACKEND_API_ACADEMIC_MONEY.md` | 871 | 2026-09-05 | **CURRENT** — 201 route decorators over 13,806 lines; money/academic/attendance/IEMIS correctness + a 34-item Nepal-ERP gap list (G1…G34). Ends on `<!--SECTION9-->` → likely **INCOMPLETE** (a Part 2 covering the AI/website/plugin blueprints was implied and never written). ORPHANED from the index |
| `W3/_inv/BACKEND_FILES.md` | 276 | undated | **CURRENT** — path:LOC inventory, backend |
| `W3/_inv/FRONTEND_FILES.md` | 426 | undated | **CURRENT** — path:LOC inventory, frontend |
| `W3/_inv/FLUTTER_FILES.md` | 266 | undated | **CURRENT** — path:LOC inventory, 5 apps + shared |
| `W3/_inv/PLUGIN_MODULES.md` | 208 | undated | **CURRENT** — per-module file listing; the only file in the corpus that shows `ai_teacher/` and `nepal_curriculum/` module folders now exist (ai_teacher: manifest 85 + config_schema 142 + hooks 249 + routes 774 + service_client 210 + tasks 96) |
| `W3/_inv/BACKEND_INFRA.md` | 173 | undated | **CURRENT** — migrations list (the only place the current revision set is enumerated) + infra files |
| `W3/_inv/ROOT_DOCS_FILES.md` | 121 | undated | **CURRENT** — root/docs/nginx/hardware/CI inventory + the full audits listing |

## §0.3 2026-09-04 research wave (13 reports; all precis'd in R1 §A)

| File | Lines | Date | Verdict |
|---|---|---|---|
| `ATEACHER_PLUGIN_INTEGRATION.md` | 1,767 | 2026-09-04 | **CURRENT** — the source of D1 §A/§B; the only place the full DDL + SQLAlchemy sketch + `config_schema` consumer table exists verbatim |
| `ATEACHER_INTEGRATION_BLUEPRINT.md` | 1,540 | 2026-09-04 | **CURRENT** — the source of D2 §G; the only place all 12+ ATeacher prompts are quoted verbatim (personas, analyzer, planner, board grammar, slide-type guidance, diagram critic) |
| `PLUGIN_THEME_TEMPLATE_ARCHITECTURE.md` | 1,648 | 2026-09-04 | **CURRENT** — source of D2 §A–§F; the only place the full v2 manifest reference, `widgets.yaml` schema, config dialect and 5-phase plan are written out |
| `AI_TOOL_CATALOG_AND_SKILLS.md` | 1,074 | 2026-09-04 | **CURRENT** — source of D1 §C; the 153-tool catalog, the claude-skills study, and the document/deck emitter contract |
| `ASHLYA_AI_DEEPDIVE.md` | 608 | 2026-09-04 | **CURRENT but partly unabsorbed** — 4 Ashlya AI stacks; its top-5 "add to ASchool" list (task-class router with p95 budgets, credit ledger with pre-action price, prompt-time section selection, multi-round tool calling) is **only partially reflected** in D1/D2 and appears nowhere in ROADMAP |
| `SAHAYATRI_CLIENTS_UX.md` | 461 | 2026-09-04 | **CURRENT** — source of D3 `UX §` refs; the template-factory + 12 UX patterns |
| `SAHAYATRI_SPEC_INVENTORY.md` | 341 | 2026-09-04 (body says 2026-05-26 for the Sahayatri spec version) | **CURRENT** — source of D3 `SI §`; from Sahayatri's *planning docs only*, not its code |
| `SAHAYATRI_BACKEND_CODE.md` | 306 | 2026-09-04 | **CURRENT** — source of D3 `BC §`; the as-implemented counterpart |
| `ASCHOOL_WEB_WIDGET_AUDIT.md` | 386 | 2026-09-04 | **CURRENT** — 21 primitives + 50-row EXISTS/MISSING checklist + 25 ranked upgrades + 3-tier widget roadmap (the source of ROADMAP B2) |
| `PLUGIN_UI_SPEC_ALL.md` | 395 | 2026-09-04/05 | **INCOMPLETE + ORPHANED** — declares scope "39 published plugins", delivers **4** (`academics`, `attendance`, `exams`, `fees`) and ends at `<!--APPEND-->`; Appendix P (8 platform-core manifests) missing. Not listed in `AUDIT_INDEX`; `ROADMAP` never cites it. Its §0 conventions (screen archetypes, the 7-part screen contract, widget-record grammar) are nevertheless normative and are the most defect-dense pages in the corpus |
| `ASCHOOL_MOBILE_APPS_INVENTORY.md` | 362 | 2026-09-04 | **CURRENT** — 5-app screen inventory + 22 UX gaps + P0/P1/P2 list; the source of the flutter_user consolidation decision |
| `ASCHOOL_WEB_UI_INVENTORY.md` | 319 | 2026-09-04 | **CURRENT** — 226 pages, nav truth, 404-nav list, orphan pages, 20 UX gaps |
| `COMPETITOR_LANDSCAPE_NEPAL.md` | 233 | 2026-09-04 | **CURRENT** — 22 gaps / 20 differentiators / NPR pricing recommendation / per-competitor migration plan |
| `ASCHOOL_CURRENT_STATE.md` | 241 | 2026-09-04 | **CURRENT** — the master-plan-ID status table every later plan reads "already built" from. Compiled from docs+git, **not from code**, and says so |
| `ASCHOOL_BACKEND_COMPLETENESS_AUDIT.md` | 238 | 2026-09-04 | **CURRENT, partly superseded** — 680 routes / ~92%; several findings were closed by W0 (absent-alert listener, leave write-through, curriculum API) |
| `ASCHOOL_FLUTTER_WIDGET_AUDIT.md` | 209 | 2026-09-04 | **CURRENT** — 30 shared widgets, zero domain widgets, 25 upgrades, 15-widget shared kit |
| `ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md` | 159 | 2026-09-04 | **CURRENT, partly superseded** — 8 duplication clusters + 18 issues + P0→P3 checklist; its P0-1 "AI gate split-brain" is declared stale by `ROADMAP §1` |
| `AI_TEACHER_INTEGRATION_BLUEPRINT.md` | 53 | 2026-09-04 | **INCOMPLETE** — ends at `<!-- APPEND-MARKER-A -->` under "§1.3 Pedagogy stack"; its own TOC promises 7 chapters (wire protocol, data model, quality verdict, integration blueprint) that do not exist. Filename differs from the complete `ATEACHER_INTEGRATION_BLUEPRINT.md` by one word — a live confusion hazard |

## §0.4 Older waves (2026-08-27 → 2026-09-03)

| File | Lines | Date | Verdict |
|---|---|---|---|
| `deep2026/00_OWN_FINDINGS.md` | 307 | 2026-09-02 | **CURRENT as measurement, SUPERSEDED as counts** — main-agent measured counts (681 routes, 161 model classes, 33 migrations, 222 pages, 12 GB tree). Every count is now stale vs A1/A2 |
| `deep2026/01_FRONTEND.md` | 89 | 2026-09-02 | **SUPERSEDED by WUI/WWA** — 153 findings condensed; still the only source for the per-metric counts (0 error boundaries, 557 `any`, 188/206 buttons without `type=`, 96/222 pages with no responsive prefix) |
| `deep2026/02_FLUTTER.md` | 140 | 2026-09-02 | **CURRENT + CORRECTIVE** — the only file that *corrects* the "NotificationService.init never called" claim: all 5 `main.dart` DO call it; push is dead for 4 other reasons. MAI/D5 still repeat the wrong version |
| `deep2026/03_AI.md` | 167 | 2026-09-02 | **SUPERSEDED by A-01 work** — 18 token_hub findings; most are recorded done in IA |
| `deep2026/04_DATAMODEL.md` | 157 | 2026-09-02 | **SUPERSEDED by A1/A1b/A1c** — P0-1…P0-10 + Task-C schema additions; MP §9 is its distilled form |
| `deep2026/05_PLUGINS.md` | 145 | 2026-09-02 | **CURRENT** — the money/entitlement analysis (B1/B2/B3), the event-bus defect list (E1–E5), the settings-schema defect list (S1–S6), and the 10-item "what a real WP architecture still needs". PDA and PTTA both build on it |
| `deep2026/06_BACKEND_INFRA_WEBSITE_DESIGNER.md` | 92 | 2026-09-02 | **SUPERSEDED by S-xx work** — BC-1…BC-7 + P1 highlights (51 bare endpoints, 204 object-level checks, 83 role lists) |
| `deep2026/07_MARKET_RESEARCH.md` | 55 | 2026-09-02 | **CURRENT** — the only source for the Nepal regulatory facts (139 SEE subjects, 14 fee headings, 2083 five-day week, IEMIS Flash I/II, National AI Policy 2082) and the price anchors |
| `deep2026/08_API_SUPPLEMENT_AND_TOPUP.md` | 61 | 2026-09-03 | **SUPERSEDED** — A-1…A-8 (all landed as B-01…B-06) + research top-ups (bge-m3, Langfuse, WCAG 2.2 24×24px, DOCX `w:rFonts w:cs`) |
| `coverage/BACKEND_FILE_VERIFICATION.md` | 73 | 2026-08-29 | **INCOMPLETE by its own statement** — slice 3 complete; slices 1/2/4–7 pending |
| `coverage/FRONTEND_PAGE_VERIFICATION.md` | 350 | 2026-08-29 | **CURRENT (historical)** — per-page pass ledger |
| `coverage/LIVE_BROWSER_UX_TEST.md` | 151 | 2026-08-30 | **CURRENT (historical)** — the origin of the login-lockout-500 and student/parent login-provisioning findings |
| `coverage/DATA_HYGIENE_2026-08-30.md` | 94 | 2026-08-30 | **CURRENT (historical)** — 32 junk tenants + ~1,350 rows removed |
| `discovery/FRONTEND_INVENTORY.md` | 159 | 2026-08-29 | **SUPERSEDED by WUI** — 215 pages; still the only place the auth-guard layering per route group is written out |
| `MASTER_PRODUCTION_AUDIT_2026-08-30.md` | 111 | 2026-08-30 | **SUPERSEDED** — ~173 findings E1–E219 + G1–G2 + M1–M12, 167 resolved; §4 resolves 10 prior-audit contradictions |
| `PRODUCTION_SCORECARD_2026-08-30.md` | 103 | 2026-08-30 | **SUPERSEDED** — 54/55 published plugins ✅; the "zero ❌" claim is contradicted by D5 |
| `REMAINING_BACKLOG_2026-08-30.md` | 37 | 2026-08-30 | **CURRENT for its 15 items** — several (login-lockout 500, teacher-delete orphan user, contact inbox, student/parent login provisioning) appear in **no** later plan |
| `CHANGELOG_2026-08-30.md` | 101 | 2026-08-30 | **SUPERSEDED (historical)** |
| `FIX_STATUS_2026-08-28.md` | 462 | 2026-08-28 | **SUPERSEDED (historical)** — E1–E219 with runtime evidence; the most detailed money-bug forensics in the corpus (E60–E66) |
| `PRIOR_AUDIT_DIFF_2026-08-28.md` | 137 | 2026-08-28 | **CURRENT as methodology** — per-claim CORRECT/WRONG/STALE verdicts against the 7 Gemini audits |
| `VERIFICATION_MONEY_GRADES_2026-08-28.md` | 260 | 2026-08-28 | **CURRENT (historical)** — 45+ hand-verified grading/money assertions, zero defects |
| `PHASE2_RUNTIME_SMOKE_2026-08-28.md` | 18 | 2026-08-28 | **CURRENT (historical)** — 180 GETs: 200×72 / 403×70 / 404×34 / 400×4 / 500×0 |
| `DISCOVERED_SYSTEM_INVENTORY.md` | 116 | 2026-08-28 | **SUPERSEDED** — 57 plugins, the category/price tables, the duplicate-slug clusters, the entitlement chain |
| `WP_PLUGIN_ARCHITECTURE_DESIGN.md` | 220 | 2026-08-30 | **SUPERSEDED by PTTA/D2** — the original WP-model research + one-folder-per-plugin target + migration steps |
| `ALL_57_PLUGINS_DEEP_DIVE_AUDIT_2026-08-27.md` | 669 | 2026-08-27 | **SUPERSEDED and explicitly discredited** — `deep/05` calls it "stale to the point of being misleading": every price wrong post-E234, biometric/multi_branch called unimplemented when both have 600–740-line routes, timetable/hostel called free when they are 99/149 |
| `PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md` | 245 | 2026-08-27 | **SUPERSEDED but historically load-bearing** — first to find the hardcoded-6-plugins registration bug and the dual pricing model (marketing 3 tiers vs 57 à-la-carte plugins) |
| `MARKET_COMPETITOR_ANALYSIS.md` | 65 | 2026-08-27 | **SUPERSEDED by CLN/D4** — Veda/Teachmint/PowerSchool/ManageBac/Toddle table with no pricing figures |
| `BACKEND_QA_AUDIT.md` | 26 | 2026-08-27 | **SUPERSEDED** — 3 ImportError fixes + weighted GPA + payslip math; its "reports.py has no PDF" claim was resolved 2026-08-28 |
| `FRONTEND_QA_AUDIT.md` | 32 | 2026-08-27 | **SUPERSEDED and partly WRONG** — `PRIOR_AUDIT_DIFF` found its missing-manifest claims (iemis_importer, file_management, communications) stale/incorrect |
| `MOBILE_APP_QA_AUDIT.md` | 60 | 2026-08-27 | **SUPERSEDED by MAI/FWA** — endpoint-mismatch leads and the "4 apps" error (there are 5) |
| `ASCHOOL FULL STACK PRODUCTION.md` | 256 | 2026-08-28 | **CURRENT as a mandate, not an audit** — the instruction document that produced the 2026-08-28→30 waves; §0 enumerates 7 contradictions among the Gemini audits |
| `AUDIT_INDEX.md` | 199 | header 2026-08-27, newest entry 2026-09-05 | **CURRENT but stale-headed and incomplete** — lists the 5 digests + roadmap, but **omits R1, all 5 W3 files, all 6 `_inv` files, `PLUGIN_UI_SPEC_ALL`, `WP_PLUGIN_ARCHITECTURE_DESIGN`, `DISCOVERED_SYSTEM_INVENTORY`, the whole `deep2026/`, `coverage/` and `discovery/` trees**, and its `old/` list names 12 of 18 files |

## §0.5 `audits/old/` — SKIMMED (historical; unique surviving asks noted)

22 files, 2026-04-25 → 2026-08-22. All **HISTORICAL/SUPERSEDED**. Skim verdicts:

| File | Lines | Unique surviving ask (if any) |
|---|---|---|
| `ASchool_ULTIMATE_v1.md` | 4,372 | The original product vision + plugin-marketplace spec. Surviving ask: the affordability promise ("a community school in Jumla can afford it") which the CLN pricing recommendation and the free-tier decision both trace back to |
| `IMPLEMENTATION_PLAN.md` | 652 | Phase-0 scaffolding plan; nothing survives that MP does not restate |
| `MASTER_IMPLEMENTATION_PLAN.md` | 620 | Its "AUDIT CORRECTIONS" table (audit claims that were wrong on inspection) is the earliest instance of the corpus's recurring problem — audits contradicting code |
| `previous.md` | 796 | A raw session transcript. Surviving asks are **student/teacher app UX items still open**: student home shows "Namaste student" with 0% and no name; profile icon goes to the parent list; results shows no subject-wise marks / marksheet / gradesheet; gallery click does not view or download; bottom-sheet too heavy; timetable broken — none of these appear in MAI/FWA/D5 by that description |
| `simulate.md` | 435 | The SMS end-to-end simulation prompt; superseded by the coverage ledgers |
| `PLAN_AUDIT_2026-04-25.md` | 458 | First plan-vs-code audit; nothing unique |
| `AUDIT_REPORT_2026-08-22.md` | 414 | 546 routes / 146 models baseline; the origin of the `flutter_shared`→`aschool_shared` rename confusion still visible in `flutter_user/README.md` |
| `aschool_audit_part1..part4` | 272/428/540/258 | Per-plugin scores (health 52/100) and a 25-flow integration map. Surviving ask: the **cross-plugin integration map** as an artefact — no later audit reproduces it |
| `FULL_STACK_AUDIT_2026-05-19.md` | 198 | Nothing unique |
| `ASCHOOL_SIMULATION_REPORT_2026-05-19.md` | 175 | 28 tests / 16 failed; superseded |
| `FIX_TRACKER.md` | 166 | Records a **722-passed backend baseline** — the highest test count claimed anywhere; collides with the 507/561 figures (§3) |
| `implementation_plan.md` (lowercase) | 410 | The eSchool/Mighty-School feature-parity gap table. Surviving ask: **parity with the two vendored PHP ERPs' Flutter feature sets**, which is why those directories were kept — and which S-14 says to delete |
| `backend_route_audit.md` | 84 | Nothing unique |
| `task.md` | 205 | A live-route audit helper (`backend/scripts/api_route_audit.py`, 449 probes) that later waves never reuse |
| `walkthrough.md` | 34 | Nothing unique |
| `ASchool_Copilot_Audit_Prompt.md` | 298 | An audit prompt, not an audit |

---

