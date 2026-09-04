# UNIFIED ROADMAP — Sahayatri integration, dedup, platform UX, competitive plan
_Date: 2026-09-04 · Sources: 9 deep-dive reports in `audits/research/` (see §0)_

---

## 0. Source reports

| Report | File |
|---|---|
| Sahayatri spec inventory (120+ AI tools, ingestion, whiteboard) | `SAHAYATRI_SPEC_INVENTORY.md` |
| Sahayatri backend code (323 routes, 38 tables, port patterns) | `SAHAYATRI_BACKEND_CODE.md` |
| Sahayatri web/mobile/whiteboard UX | `SAHAYATRI_CLIENTS_UX.md` |
| ASchool plugin duplication audit (51 plugins) | `ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md` |
| ASchool current state (item-id status table, open backlog) | `ASCHOOL_CURRENT_STATE.md` |
| ASchool web UI inventory (226 routes, plugin↔UI matrix) | `ASCHOOL_WEB_UI_INVENTORY.md` |
| ASchool Flutter apps (5 apps, consolidation verdict) | `ASCHOOL_MOBILE_APPS_INVENTORY.md` |
| Ashlya Academy AI deep dive (4 stacks, prompts, ingestion) | `ASHLYA_AI_DEEPDIVE.md` |
| Nepal competitor landscape (Veda, Paathshala, pricing) | `COMPETITOR_LANDSCAPE_NEPAL.md` |

---

## 1. Strategic picture in one paragraph

ASchool's backend is deep (560+ routes, 146 models, live Groq AI with guardrails, red-team PASS) but its **user-facing surfaces are the weak flank**: the web role portals are "Coming soon" stubs, the dashboard is desktop-only, mobile push is silently dead, and the apps have zero Nepali localization. Sahayatri is the opposite: a huge, well-designed **AI product surface** (121 tool pages from 20 templates, offline whiteboard, gamified learning, token economy) on a shallow, single-tenant backend. The Ashlya repos contribute the best AI **internals** (task-class router, credit ledger, textbook-extraction prompts). The market (Veda 1,300+ schools, Paathshala 1,200+) has **no AI, no Nepali UI, no published pricing, and weak parent apps (Veda iOS 2.9★)**. The winning move: port Sahayatri's surface and Ashlya's internals into ASchool's hardened multi-tenant AI layer, fix the dedup debt that blocks it, ship the portals and Nepali-first UX everyone lacks, and go to market with transparent per-student pricing and a free migration kit.

---

## 2. Phase R0 — Plugin dedup & registry repair (blocks everything; ~1 week)

From `ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md`. Do this first — the AI gate split-brain will 403 migrated schools and the dead plugins pollute the marketplace.

1. **P0 — Finish the ai_suite merge at the gate:** replace the 16 `@plugin_required("ai_tools")` + 8 `"ai_adaptive_learning"` + `"benchmarking"` gates with `ai_suite`; write a one-time migration row (`ai_tools`→`ai_suite` install); then delete the 7 deprecated AI manifests + `PLUGIN_SLUG_ALIASES` entries.
2. **P0 — Fix the coming_soon bypass:** `entitlements.grant_plan_plugins` must skip `coming_soon` plugins (currently installs conferences/gps/whatsapp via plan grants).
3. **Delete dead plugins:** `social_ads` + `social_hub` (withdrawn, zero UI, declared services don't exist) incl. `models/social.py`; `digital_content` manifest (duplicate of elibrary at 5× price); `advanced_analytics` manifest (its data is ungated core analytics).
4. **Fix benchmarking:** `/rankings` N+1 over all schools + cross-tenant metric dump → cache + aggregate-only response; fold remaining routes into basic_reports or ai_suite.
5. **Loader validator:** fail startup loudly on nonexistent `services:`/`models_module:`/`api_blueprint:` pointers (~20 today; ai_insights/digital_content point at design_studio's blueprint).
6. **Serve the plugin alias/feature table from the backend** (`/plugins/sidebar` already exists) — kill the hand-duplicated map in `frontend/lib/plugins.tsx`.
7. **Consolidate health tables** (`student_health_records` vs `health_profiles`); fold legacy flat manifests into `modules/`; fix inverted pricing (incident_management 199 < incidents 299); split `communications.py` routes by owning plugin; decide core vs ai_suite for `/dashboard/analytics`.
8. Delete 10 orphan `services/ai/*` modules (~630 LOC, zero importers).

## 3. Phase R1 — Sahayatri → ASchool: the ai_suite surface (the core ask, ~3–4 weeks)

Goal: ASchool's ai_suite becomes the Sahayatri product — 100+ tools behind ONE backend pattern — while keeping ASchool's superior guardrails (injection classifier, consent, moderation, quota, schema validation, red-team). Sahayatri's weaknesses (no moderation, no validation, Groq-only hard-coded, Redis-only persistence) are exactly what we already have; we only take its breadth and UX.

### R1.1 Tool catalog + template factory (the single most valuable port)
- One **registry-driven catalog** (we already have `AIToolRegistry` + seed; extend it with Sahayatri's fields: `category`, `icon`, `persona`, `ui_type`, `token_cost_estimate`, `is_premium`) → seed ~100 tools from Sahayatri's `sahayatri_v5_1_final.md` taxonomy (61 teacher + 60 student), **map onto our 55 documented catalog keys first** (lesson_plan, worksheet, flashcards, differentiation, study_guide…).
- Web: one config file per tool rendering **20 shared templates** (AiChatPage, AiFlashcardsPage, AiDoubtPage, AiSolverPage, AiExamPage, AiPlannerPage, AiWellbeingPage, AiWritingPage, AiContentPage, AiAnalysisPage + teacher workspace/presentation/document/diagram/analytics) — port Sahayatri's template factory into `frontend/app/dashboard/ai-workbench/`, replacing today's single ToolRunner.
- Steal the UX patterns: TopicSelector scope card, "✓ Based on your chapter" grounding badge, FollowUpChips, result-shape parsers with graceful degradation, two-panel form-left/result-right, actionable empty states, tokenCostBadge. (Full list: `SAHAYATRI_CLIENTS_UX.md` §12.)
- App: the same catalog drives an **AI Tools hub screen in flutter_student/flutter_teacher** via `ui_type` (today's apps only call 9 sync `/ai-tools/*` endpoints).

### R1.2 Chapter grounding / curated-context KB (Sahayatri's "chapter_ai_context")
- New workbench tables: `chapter_ai_context` (draft→approved→published workflow, admin approver) — LLM-generated structured knowledge (definitions, formulas w/ LaTeX, worked examples, common mistakes, exam tips) per curriculum topic (we have the CDC/NEB curriculum seed already).
- Inject into every tool's system prompt + tutor engine (this composes with our `rag.py` — pgvector stays for document search; the curated context is the quality layer).
- Admin UI: Smart Import Hub-style review/approve screens.

### R1.3 CDC textbook Vision-ingestion pipeline (crown jewel; Ashlya prompts + Sahayatri state machine)
- Port Sahayatri's 7-stage machine (rasterize → vision page-classify → TOC → chapter markdown w/ LaTeX → exercise blocks → AI context → human review → publish) into the `digital_content`/`elibrary` plugin as Celery pipelines with per-page progress (reuse `import_job_pages` state machine + idempotent publish back-refs design).
- Lift Ashlya's two-stage extraction contract (faithful-extract then rewrite prompts, `[FIGURE]` tagging, "sub-parts (क)(ख)(ग) are NOT MCQ options") — quoted in `ASHLYA_AI_DEEPDIVE.md`.
- Include: confidence auto-approve thresholds, Bloom auto-tagger (Nepali verbs), Jaccard ≥0.72 dedupe, exercise-block bank (19 Nepal block types) with KaTeX preview UI.
- Whisper/gpt-oss vision via `token_hub` (add vision model + `estimate_cost` entry; Ashlya uses `qwen3.8-27b`-class vision on Groq).

### R1.4 Learning-science engines
- **SM-2 spaced repetition** on exercise blocks + **adaptive learning path** (weak/in-progress w/ reasons) → `ai_adaptive_learning` module (already 649 LOC real code) + new `spaced_repetition.py` service; UI: Sahayatri's show-answer 6-button review screen and self-explaining adaptive rows in flutter_student.
- **Gamification service**: XP events, 11 levels, streaks, badges, institution leaderboard (`gamification` plugin has a manifest — fill it), gamified profile screen.
- **Live Kahoot-style quiz**: server-authoritative scoring, Redis state + TTL, join codes → `exams`/`live_poll` surface (we already have AW-10 LivePoll).
- **3D simulation library**: branded Sketchfab wrapper + 103 seeded models + AI auto-annotations + model quiz mode — new `digital_content` feature; web viewer + flutter WebView.

### R1.5 Multimodal tutor upgrades (Ashlya patterns into our tutor_engine)
- **TeachingBlueprint pre-pass** (intent/misconceptions/hook analysis before answering) — small, big quality win.
- **Guided/Direct Socratic modes + anti-cheating contract** prompt fragments; **response classifier → adaptive reteach**.
- **Voice tutor loop**: we have `ai_capture` voice two-stage + whisper; add **Nepali edge-tts (ne-NP-Sagar/Hemkala) with expressive presets** → new `services/ai/speech.py`.
- **Photo doubt solver**: un-block `/capture/photo` (Ashlya/Sahayatri both prove the Groq-vision path; Sahayatri's rasterize→vision trick also solves Preeti-font Devanagari PDFs).
- **Multi-round tool calling with persisted source chips** (anotes pattern) in tutor sessions.
- **AI lesson-summary artifact** → feeds `parent_email`/report_remarks tools.

### R1.6 Monetization of AI (Sahayatri token gate × Ashlya credits × our quota)
- We already have atomic micro-USD quota; add the **product-facing layer**: per-tool credit costs shown **before click** (client-side cost mirror + tokenCostBadge), 402 with remaining/needed, per-user token wallet + usage ledger (`token_usage_log` pattern), AI add-on plan gating.
- Task-class router in `token_hub.py` (Ashlya: 10 task classes w/ model/tokens/temperature/latency budget + p95 tracking + 404 auto-failover) — put per-tool model class on `AIToolRegistry` (columns; DB-editable prompt parts too).

### R1.7 Offline AI whiteboard (differentiator, ship last in R1)
- Port the Flutter whiteboard app into ASchool as a plugin-owned app/feature: offline-first canvas (perfect-freehand strokes, multi-page, PNG export, local persistence), QR-code live class sessions, IFP compatibility layer.
- Fix Sahayatri's known gap before shipping: stroke sync (`BoardProvider` never emits) — our Socket.IO authenticated rooms + Redis snapshots are the transport.
- AI panels: board solver (KaTeX), Circle-to-Search (crop→vision), AI PPT outline, 24h offline AI cache.
- Web twin: teacher starts live class from the workbench; students join by code.

**R1 acceptance:** a school with ai_suite gets a 100+-tool catalog with chapter-grounded outputs, a working textbook-import pipeline, spaced repetition + gamification in the student app, voice + photo tutor, visible per-tool costs — all behind the existing guardrail/quota stack.

## 4. Phase R2 — Portals + mobile (the credibility gap, ~3 weeks, parallel with R1)

From `ASCHOOL_WEB_UI_INVENTORY.md` + `ASCHOOL_MOBILE_APPS_INVENTORY.md` + master-plan F-01/F-02:

1. **Ship the 15 "Coming soon" web portal sections** (student/parent/teacher: attendance, results, fees, notices, bus, timetable, library, chat, ai-tutor…) — data + endpoints exist; this is pure frontend work against `/parent/*` etc.
2. **flutter_user becomes THE consumer app** (it already embeds student/parent/teacher as packages — formalize; stop shipping 4 binaries). Keep flutter_admin.
3. **Fix push end-to-end** (P0: no google-services.json, `setOnTapCallback` never called, no VIEW intent-filter → notifications silently dead): FCM config, deep links per notification type, notification inbox w/ categories.
4. **Nepali localization in apps** (zero today): ne arb files, Devanagari font, BS calendar (aschool_shared has BS date utils — surface them), NPR formatting.
5. **Offline attendance for teachers** (local queue + retry; kills the #1 rural objection), **camera/gallery homework submission** (currently a URL string!), **biometric login**, **payment receipt PDF**, **bus socket instead of 15 s polling**.
6. Admin app: make Promote actually POST, replace the fake Assignments screen.

## 5. Phase R3 — Web dashboard UX program (P-06, ~2 weeks)

Priority order from `ASCHOOL_WEB_UI_INVENTORY.md`: mobile-responsive shell + data tables → global ⌘K command palette → shared DataTable (bulk actions, saved filters, CSV/PDF export, pagination) → empty-state system → notification center over Socket.IO (socket is idle except bus map) → dark-mode toggle (tokens exist, no switch) → onboarding checklist wizard for new schools → impersonation for support → load the Mukta font & wire Nepali beyond sidebar labels → trim 404 nav items from manifests → a11y pass (24 aria attrs total today).

## 6. Phase R4 — Nepal competitive module gaps (from competitor research)

Ordered by sales impact vs Veda/Paathshala (see `COMPETITOR_LANDSCAPE_NEPAL.md` §B for the full 25):
1. **IRD-verified billing + VAT/PAN vouchers** (trust-critical; we have IRD groundwork — finish N-07).
2. **Smart SMS 2.0**: merge SMS+push per event, SMS-cost receipts, Sparrow provider (Sahayatri's SMS API + institution API keys port).
3. **Custom per-school marksheet/report-card print designer** (Veda's killer feature; our design_studio engine is the base — add marksheet templates).
4. **Certificates/ID/entrance cards** (designer already does ID cards — extend).
5. **Feature-barring for unpaid dues** (S backend, big behavioral feature).
6. **Discounts/scholarships engine polish + canteen wallet/POS + hostel**.
7. **ZKTeco biometric + RFID one-card events** (bring-your-own-device plugin vs Paathshala hardware giveaways).
8. **Nepali UI + BS calendar end-to-end** (F-02; nobody advertises it).
9. **One-click IEMIS export** (turn the importer inside-out).
10. **Excel import/export everywhere** + migration kit with per-competitor adapters (Veda/Paathshala/eZone exports, IEMIS XML fallback, dedupe on DOB+guardian-phone, BS↔AD normalization, parallel-run mode, same-day cutover <500 students).
11. **Admissions CRM** (inquiry→entrance→enrollment; plugin `admission` exists as shell).
12. **Alumni + wellbeing** whitespace (manifests exist as shells).
13. **White-label per-school app builds** (L; only after flutter_user consolidation).
14. **Zoom/Jitsi online classes** (`conferences` coming-soon → finish).
15. **Public pricing page + API docs** (credibility: literally nobody has them).

## 7. Phase R5 — Pricing & go-to-market (decision doc, not code)

Recommendation (details + evidence in `COMPETITOR_LANDSCAPE_NEPAL.md` §D):
- **Free Forever** ≤100 students (attendance, notices, website-lite, IEMIS) — classic land-and-expand; undercuts Paathshala's "free software" with actually-free software.
- **Standard Rs. 18/student/month** annual billing — everything Veda core does; above eZone's Rs.10 Lite, below its Rs.20 Standard.
- **Premium Rs. 35/student/month** — accounting, biometric, canteen/hostel, admissions CRM, white-label app, unlimited AI.
- **AI add-on Rs. 49/student/term** — sold as a teaching-quality line item (AI is our only true differentiator; every competitor's AI is vaporware).
- White-label onboarding Rs. 25k–75k one-time; migration free; SMS at cost +10%. Verify effective Veda quotes in sales calls before publishing.

## 8. Sequencing & staffing

```
R0 dedup (1w) ──┬──> R1 AI surface (3–4w) ──> R1.7 whiteboard (last)
                └──> R2 portals+mobile (3w, parallel)
R3 web UX (2w) after R2 trims portal stubs
R4 competitive modules — start IRD billing + marksheet designer immediately after R0 (revenue-blocking, independent of R1)
R5 pricing — decide before R4 ships so tiers gate the right plugins
```
Two workstreams: (A) AI/product (R1+R1.7), (B) platform/market (R2+R3+R4). R0 unblocks both.

## 9. Non-goals / anti-patterns to avoid
- Do not port Sahayatri's auth, subscription CRUD, Groq wrapper, Redis-only persistence, shared `run_text_tool()` antipattern, or its un-gated voice tutor (revenue leak).
- Do not adopt Ashlya's code — only its prompts/patterns (repo has committed secrets, churn scripts, IDOR-class trust of request bodies).
- Don't build AI features without the guardrail pipeline (every R1 tool goes through workbench orchestration, consent, quota, moderation — no exceptions like Sahayatri's).
- Don't publish competitor pricing claims — verify in sales calls.
