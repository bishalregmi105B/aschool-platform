# ASCHOOL MASTER IMPLEMENTATION PLAN v2 — 2026-09-09
**Codename:** FULL-COVERAGE PASS (all plugins, all platforms, all screens)

**Method:** 8 exploration/research agents (waves of 2): (1) industry feature research — Nepal (MySecondTeacher, CloudEDU, Teachmint-NP, IEMIS/CEHRD portals), South Asia (Fedena, Entab, Vidyalaya, MyClassCampus), international SIS (PowerSchool, Classter, Veracross, Infinite Campus, Skyward, RosarioSIS, Gibbon), LMS (Canvas, Classroom, Seesaw, ClassDojo, Brightwheel), 2024–26 innovations (Khanmigo, Panorama Solara, Securly Pass, SmartPass, Minga, LiveSchool, Raptor); (2) domain deep dives — library systems (Koha, Follett Destiny, Librarika, Libib, Alma), school website CMS (Finalsite, Edlio, Apptegy), RAG-for-textbooks architecture (Anthropic contextual retrieval, pgvector, chunking strategies), question-paper generation (blueprints, spec grids, model sets), Nepal payments/SMS/government (eSewa ePay v2, Khalti, Sparrow SMS, IEMIS); (3) backend code audit (66 route files, ~68 model files, plugin framework); (4) frontend audit (~222 pages, component library, manifest-driven nav); (5) Flutter audit (5 apps, 129 routes); (6) AI/textbook architecture audit (2.2 GB CDC corpus, all AI services/tables).

**Relation to prior plans:** `docs/MASTER_PLAN_2026-09-03.md` (Phases 0–6; security/money/AI foundations — still in force) and `audits/PLAN_2026-09-08.md` (Waves R/F/Q/I — R done, F/Q/I partially done). **This plan does not duplicate those; it covers everything they didn't: full per-plugin feature completeness vs. the market, the AI content-spine rebuild, library rebuild, website-builder consolidation, mobile catch-up, and the widget layer.** Wave IDs here are namespaced `FC-xx` (full coverage).

---

## 0. FIRST: THE TWO PROD 500s — ROOT-CAUSED AND ALREADY FIXED LOCALLY

| Incident | Root cause | Fix | Status |
|---|---|---|---|
| `PUT /api/v1/website-builder/pages/0dff62fa…` → 500 | Schema drift: `draft_config` column existed on `school_websites` but **not** on `website_pages`; the W-02 draft/live editor (website_builder.py:430–478) writes `page.draft_config` | Migration `c9d3e7f1a5b2` adds `website_pages.draft_config JSONB` + `book_issues.fine_amount/fine_paid` | ✅ Fixed in local commit `0ca0264`. **AC-01: verify deployed to prod + `PUT /pages/<id> {"draft":true}` round-trips → publish-draft → revert-draft** |
| `GET /api/v1/library/issues?status=issued&book_id=…&student_id=…` → 500 | `_issue_dict()` read `i.fine_amount` which existed only on legacy `book_transactions`, not active `book_issues` | Same migration adds the columns; library.py:266–285 now reads/persists them | ✅ Fixed locally. **AC-02: re-run the exact failing URL against prod and confirm 200.** The filters themselves (status/book_id/student_id) were never buggy — library.py:138–161 supports all three |

**Systemic lesson (FC-00):** both 500s are the same class — hand-maintained models/ + migrations/ with no drift check. Gate: add `alembic revision --autogenerate` diff-empty CI job (audits/PLAN R1 already proved the method: "flask db check shows ZERO diff"). Every migration from now on must pass the autogenerate-diff-empty gate.

---

## 1. SYSTEM SNAPSHOT (verified this pass)

| Layer | Reality |
|---|---|
| Backend | Flask 3, 66 api/v1 files (6 are 2-line shims), **478 routes** incl. plugin modules, 59 manifests (46 published). Plugins: filesystem catalog + per-school `SchoolPlugin` + entitlements tiers (free→enterprise) + `@plugin_required` alias-aware gating. Widget contract: widgets.yaml → `GET /plugins/widgets` (only attendance/exams/fees ship widgets today — 22 widgets total) |
| Frontend | Next.js 14, ~222 pages, manifest-driven sidebar (`components/layout/sidebar.tsx` ← `get_frontend_sidebar`), DataTable (495L) as the table standard, PluginWidgetHost + 6 spec renderers, plugin settings form-renderer, i18n `t(en,ne)` + BS dates, 2 web themes |
| Mobile | 5 Flutter apps + aschool_shared. Parent app strongest (20 screens, child switcher, live bus map, eSewa/Khalti WebView pay). Teacher 26, Admin 38 (mostly read-only viewers), Student 25, User shell 5. Push fully wired (OneSignal+FCM). **No offline queue, no scanner usage, widget contract unused, 11 screens call nonexistent/wrong endpoints** |
| AI | TokenHub (Groq primary/Anthropic fallback/OpenAI embeddings-1024) → 43-tool workbench (2 generations of endpoints), Socratic tutor engine (guarded, **not grounded**), question-paper v2 (bank-first), pgvector RAG (ingests **only** the UNESCO policy doc), `curriculum_context_builder.py` **dormant**, textbook tables exist+empty, **2.2 GB CDC corpus 100% un-ingested** |
| Known debt | models↔migrations drift (two 500s shipped), `book_transactions` legacy dual table, N+1s in library/fees lists, 2 parallel incident plugins, 3 website-editor surfaces, 3 AI panel implementations, RBAC settings page is a pure stub |

---

## 2. MARKET RESEARCH SYNTHESIS (what "complete" means)

### 2.1 Benchmarks (module → expected distinct screens, synthesized from Fedena/Vidyalaya/Classter/RosarioSIS + portals)

| Module | Expected screens | ASchool web today | Verdict |
|---|---|---|---|
| Academics/curriculum | 6–8 | 6 | ✅ Near-complete (missing syllabus-completion %, competency mapping) |
| Admissions | 8–10 | 1 page (2 tabs) | ⚠️ No kanban funnel, no source analytics, no document checklist, no waitlist |
| Attendance | 7–9 | 4 | ⚠️ No heatmap, no chronic-absenteeism flags, no auto-absence SMS, no biometric reconcile |
| Timetable | 6–8 | 3 | ⚠️ No drag-drop builder, **no substitutions (model exists, zero usage)**, no conflict report |
| Exams & grading | 10–14 | 7 | ⚠️ Strong marks/results/report-cards; **no blueprint↔exam link, no model sets, no seating, no question-bank UI** |
| Fees & finance | 10–14 | 6 | ✅ Gateways (eSewa/Khalti/FonePay) + receipts + defaulters; ⚠️ no bulk reminder campaigns, no voucher/accounting flow, no discount approval workflow |
| HR & payroll | 8–10 | 7 | ⚠️ No leave balances/accrual, flat taxRate only (no SST/TDS breakdown), no payslip email |
| **Library** | **6–8 (we count full LMS: 11 areas)** | **3 pages** | ❌ **Weakest module** — see Theme B |
| Transport/GPS | 7–9 | 7 | ✅ Good (missing geofence alerts, ridership scans, doc-expiry dashboard) |
| Health records | 6–8 | 4 | ⚠️ No medication schedules, screenings, clinic live board |
| Wellbeing/SEL | 5–7 | 4 | ⚠️ CounselorSession model unused, no tier pyramid/MTSS, no crisis escalation |
| Behavior/incidents | 7–9 | 2 parallel plugins | ⚠️ Consolidate; no PBIS points link, no hall passes |
| Communication | 6–8 | 8 | ✅ Good (missing scheduled sends, SMS credit ledger, read receipts) |
| Conferences | 4–5 | 1 | ⚠️ Backend slots/booking exist; admin slot management unsurfaced |
| Alumni | 4–6 | 1 | ⚠️ Backend events/donations unsurfaced |
| Inventory | 6–8 | 1 | ❌ Assets only in UI; procurement/QR-audit endpoints unsurfaced; **no PO/GRN/indents/vendors/stock** |
| Hostel | 7–9 | 1 | ⚠️ No mess, roll-call, gate-pass |
| Visitor mgmt | 4–6 | 1 | ⚠️ Appointments unsurfaced, no badge printing, no watchlist |
| Gamification | 5–7 | 5 | ⚠️ **No redemption endpoint** — rewards are catalog-only |
| Compliance/IEMIS | 6–8 | 2 | ⚠️ EMIS export exists; no IEMIS **verification-cycle tracker**, no validation dashboard |
| Analytics | 6–10 | 4 | ⚠️ No early-warning composite, no drill-to-student-list, dashboards miss widgets |
| LMS/assignments | 12–16 | 4 | ⚠️ No to-do widget, no rubrics, no guardian summaries, no adaptive surfacing |
| Portfolio | 4–6 | 1 | ⚠️ No approval queue, no export |
| Multi-branch | 5–7 | 4 | ❌ **No cross-branch transfers**, no consolidated billing |
| White-label/SaaS | 7–10 | 4 | ⚠️ No tenant health table, no module-per-plan grid |
| Parent app | 8–12 | 20 mobile | ✅ Strongest mobile app |
| Student app | 8–12 | 25 mobile | ⚠️ Fees view-only, tutor downgraded to one-shot tool |
| Teacher app | 9–13 | 26 mobile | ⚠️ 3 broken calls, payroll dead-end, no AI workbench |
| Admin app | — | 38 mobile | ❌ Mostly read-only; 4 broken screens; no fee collect, marks publish, payroll actions |
| Public website | 8–12 | 14 | ✅ Page coverage good; builder UX fragmented (Theme C) |

**Rule-of-thumb from research:** mature single-school ERP ≈ 150–220 screens; ASchool multi-tenant target ≈ **250–350 across web + portals + apps**. Web is ~70% there on count but ~50% on depth; mobile is ~40% on depth; library/inventory/multi-branch are the deep holes.

### 2.2 Top differentiating innovations worth building (2024–26)

1. **Persona-scoped AI copilots** (PowerBuddy: Learning/Educators/Parents/Data) — we already have the pieces; need persona routing (§Theme D, FC-AI-10).
2. **Early-warning composite** (Panorama/Aeries): attendance+grades+behavior → risk tier + intervention tracking. Backend risk-alerts exist (`/ai-tools/insights/risk-alerts`) — **no widget, no UI**.
3. **Blueprint-driven paper generation with model sets A–D + human review** (MySecondTeacher secret test bank is the local benchmark) — Theme E.
4. **PBIS positive-behavior loop + rewards redemption** (LiveSchool 5:1 ratio metric; our gamification has no redeem).
5. **Campus-movement consolidation** (Minga/Securly: passes + tardy + visitor + dismissal in one) — we have 3 of 4 pieces; add digital hall passes later.
6. **Bus ridership + geofence parent alerts** (Here Comes the Bus pattern; we have live map, no geofence).
7. **Website auto-synced from SIS** (Edlio/Apptegy model: ERP events → site) — we already have LiveData sections; extend to full dynamic-first architecture (Theme C).
8. **Standards/competency mastery view** (JumpRope/Seesaw) — our curriculum_graph + mastery_records tables are the perfect substrate; nothing renders them.
9. **Guardian weekly digests** (Google Classroom pattern) — Celery task + templates; cheap, high parent lock-in.
10. **Nepal moat (nobody has):** CDC spec-grid-driven paper generation, IEMIS update-and-verification workflow tracker, Nepali-language AI tutor grounded in CDC textbooks, eSewa/Khalti agent-voucher flow for unbanked parents, BS-date everything, bilingual notices.

### 2.3 Nepal-specific requirements (from research, verified against our codebase)

| Requirement | Our status |
|---|---|
| eSewa ePay v2 (HMAC-SHA256, status-check API, UAT creds) + Khalti unified gateway | ✅ Implemented (services/payments + webhooks) — **missing: status-poll fallback if no callback in 5 min; parent-app return-from-gateway confirmation UX** |
| Sparrow SMS-class gateway, Devanagari SMS | ✅ SMS send/logs exist; ⚠️ no credit balance ledger, no per-SMS cost |
| IEMIS annual/periodic submission: enrollment by grade×gender, student details, teacher records, school info, exam results; community vs institutional classification; Province→District→Municipality→Ward taxonomy | ⚠️ `/iemis` importer + `/compliance/emis` export exist; **no verification-cycle tracker, no pre-export validation dashboard** |
| SEE letter grades A+→NG (GPA 4.0), BLE, NEB 11–12; send-up eligibility (75% attendance) | ⚠️ Grade schemes exist (`grade-table`); **no eligibility dashboard** |
| Nepali FY (Shrawan–Ashad), BS dates everywhere, Nepali numerals option | ⚠️ BS inputs exist; Asia/Kathmandu date helper is Q10 debt (35 `date.today()` sites) |
| Fee culture: monthly dues, sibling/Dashain concessions, late-fine day-calculator, concession approval by principal | ⚠️ Scholarships exist; no approval workflow, no fine calculator for fees (library has one) |
| eSewa/Khalti **agent-voucher flow** for unbanked parents (400k agents as cash-in points) | ❌ Not built — differentiator, cheap (voucher code + verify screen) |
| Corporal-punishment-free documented discipline (digital record protects schools) | ⚠️ Incidents exist; add sign-off workflow |

---

## 3. THE PLAN — 8 THEMES

Sequencing principle: **correctness → data spine → module rebuilds in revenue order** (library and AI workspace are the two founder-named priorities; everything else is coverage).

```
Theme A (hygiene, 3–4 d) ──► Theme D (content spine, 2–3 wk) ──► Theme E (exams/QP, 1–2 wk, overlaps D)
        │
        ├──► Theme B (library rebuild, 1.5–2 wk)          ──► Theme F (feature waves, rolling)
        ├──► Theme C (website builder consolidation, 1 wk) ──► Theme G (mobile, rolling)
        └────────────────────────────────────────────────► Theme H (widgets+moat, rolling)
```

---

### THEME A — PLATFORM HYGIENE (P0, ~3–4 days)

| ID | Item | Evidence | Change | Accept |
|---|---|---|---|---|
| A-01 | Deploy the c9d3e7f1a5b2 migration | Both prod 500s | Deploy commit `0ca0264`; re-run the two failing URLs | 200s + draft publish/revert works |
| A-02 | Autogenerate-diff-empty CI gate | systemic drift | CI: fresh DB → `flask db upgrade` → `alembic check` (or revision --autogenerate emits empty diff) | CI job fails on any drift |
| A-03 | Fix 11 mobile broken API calls | flutter_admin: wellbeing `/wellbeing/dashboard`+`/alerts` (no such routes), health `/health/*` (prefix is `/health-records`), inventory `/inventory` (is `/inventory/assets`), social `/social/*` (no blueprint), visitor `/visitors/badge/<code>`, admission `/admission/leads` (is `/inquiries`), `/lms/live-classes`; flutter_teacher: `/announcements` (is `/notices`), `/teacher/wellbeing`, `/lms/live-classes`; shared: `/transport/live/<id>` (dead) | Two options per call: repoint to real endpoint OR add tiny backend alias route where the mobile UX is right (e.g., add `GET /visitors/badge/<code>` lookup, `GET /wellbeing/summary` admin rollup, `GET /lms/live-classes` if LiveClass table is real — it exists in models) | Every mobile screen returns data; add a `mobile-api-contract` test fixture list |
| A-04 | Pagination bugs in library pages | `dashboard/library/page.tsx` + `overdue/page.tsx` drop `meta.pagination` → only page 1 ever shows; overdue computed client-side while backend has `status=overdue` | Use DataTable server pagination; pass `status=overdue` | >25 issues all visible; overdue page hits `/library/issues?status=overdue` |
| A-05 | N+1 hot paths | library `_issue_dict` (2 queries/row), `fees.list_recent_fees` (fees.py:549), `list_outstanding_fees` (:583) | `joinedload(Book, Student)` / prefetch maps | Query count test: issues(50) ≤ 3 queries |
| A-06 | Missing indexes | `book_issues.book_id`, `books(school_id,is_deleted)`, `book_issues(status,due_date)` | One migration | `\d` shows indexes; EXPLAIN uses them |
| A-07 | Menu↔page reconciliation | Missing from nav: ai-workbench, faqs, certificates/*, communications hub pages, notifications, bulk-uploads, analytics/ai-usage, hr/expense-categories, exams/online/questions, conferences slots/history, ai-teacher history/mastery/content | Update manifests (loader `ui.nav`): add real pages, delete/redirect dupes (library/books), create the 6 missing ai-teacher/conference pages (F-wave) | `plugin_doctor` extended check: every nav route resolves to a page.tsx; every orphan page either menued or deleted |
| A-08 | Delete dead surfaces | `book_transactions` legacy table usage, `website_themes` vestigial table, `content` Craft.js column unused, `MoodCheckin` vs `MoodEntry` duality, `Substitution` model unused | Deprecate columns (keep in DB one release), remove model duals | Autogenerate diff clean after intentional migration |
| A-09 | Consolidate duplicate plugins | `incidents` vs `incident_management` (two parallel plugins + 2 nav sections); `elibrary` category inference hack (`_book_dict` title-suffix sniffing) | Merge nav under one "Safety" section (incidents basic = entry form, management = case workflow); add explicit `category` column to DigitalBook | One nav entry each; plugin_doctor 0 warnings |

---

### THEME B — LIBRARY REBUILD (the weakest module → full LMS; ~1.5–2 wk backend+web, +3 d mobile)

**Current state (verified):** books CRUD + issue/return with fines + settings + student OPAC-lite. Missing entirely: holds (student request endpoint returns fake `{"requested":true}` — student_app.py:455), fine payment (`fine_paid` never set), renewals, stock-take, OPAC search, reports, barcode (column + dependency both orphaned), copy-level management, acquisition, dashboard widget. Market reference: Librarika/Koha feature set (Report 1 §2).

**Data model additions (migration `fc_library_v2`):**
```
book_copies        id, school_id, book_id, accession_no (uniq/school), barcode (uniq), status enum(available,issued,reserved,lost,damaged,weeded,repair), condition, rack_id, added_at
book_racks         id, school_id, name, location_code, capacity
book_reservations  id, school_id, book_id, student_id, status enum(requested,ready,collected,expired,cancelled), queue_pos, requested_at, ready_at, pickup_deadline
book_fines         id, school_id, issue_id, student_id, amount, reason enum(overdue,damage,lost,card), status enum(unpaid,partial,paid,waived), paid_via, paid_at, waived_by, waived_reason
book_fine_payments id, school_id, fine_id, amount, method enum(cash,esewa,khalti,fonepay,voucher), reference, collected_by
stocktake_sessions id, school_id, name, status enum(open,closed), started_by, scan_count, expected_count, closed_at
stocktake_items    id, session_id, copy_id, scan_value, outcome enum(found,missing,unexpected,damaged), rack_id, scanned_at
book_vendors / book_purchase_orders / book_po_items   (acquisition; PO status draft→sent→partial→received→paid)
library_settings additions: per-member-type rules JSONB {student:{max_books,loan_days,fine_per_day,fine_max}, teacher:{...}}, renewal_limit, renewal_days, reservation_pickup_days
```
On `books`: keep header-level `total_copies`; derive `available_copies` from `book_copies` (kill the `is_available`/`available_copies` duality); add `cover_image_url`, `min_stock_alert` int, `language`, `reading_level`.

**Backend endpoints (extend `api/v1/library.py`, keep `/library` prefix):**
- Copies: `GET/POST /library/books/<id>/copies`, `PUT/DELETE /library/copies/<id>` (barcode gen), `GET /library/copies/scan/<barcode>` → copy+book+current issue (single scan-resolution endpoint for mobile/web).
- Circulation v2: issue/return re-target `book_copies`; add `POST /library/issues/<id>/renew` (policy: renewal_limit, blocked if hold exists); lost/damage flow `POST /library/issues/<id>/mark-lost|damaged` → creates fine(reason) + copy status.
- Holds: `GET/POST /library/books/<id>/reservations` (student request persists now), `POST /library/reservations/<id>/ready|cancel|collect` (auto-assign next in queue on return; notification event `library.hold_ready`).
- Fines: `GET /library/fines?status=`, `POST /library/fines/<id>/pay` (creates payment; optional bridge → FeeCollection line), `POST /library/fines/<id>/waive` (principal role), student/parent outstanding fines in `student_app.py`/`parent_app.py` payloads.
- Stock-take: `GET/POST /library/stocktakes`, `POST /library/stocktakes/<id>/scan` (barcode → outcome), `POST /library/stocktakes/<id>/close` (produce missing/unexpected lists; optional bulk mark-lost + fine generation).
- Acquisition: CRUD `book_vendors`, `book_purchase_orders` (+items, receive action creates copies + accession numbers).
- Reports: `GET /library/reports/{circulation_daily,popular,per_class_reading,overdue_by_class,fines_collected,dead_stock,collection_stats}` (all CSV-exportable via existing pattern).
- OPAC: `GET /library/public/search?=&facets(category,language,grade,availability)` + `GET /library/public/books/<id>` (no auth or student-token; real-time availability per rack).
- Fix the fake: `POST /student/library/request` → creates `book_reservations` row.
- Events (plugin events.py): `library.issued, library.returned, library.overdue, library.hold_ready, library.fine_created` → listeners: in-app + parent push; Celery daily job: due T-1 reminder, overdue D+1/D+7 escalation, hold-expiry sweep.

**Web UI (rebuild `dashboard/library/*`):**
- `library/page.tsx` → **librarian dashboard**: KPI cards (titles/copies, issued today, available, overdue count+NRs, ready-for-pickup, fines this month), 30-day issue/return trend, top-10 borrowed, due-today list with inline return/renew, low-stock alerts (`min_stock_alert`), quick actions. Ship as **plugin widget set** (widgets.yaml): `library_due_today` (list/side), `library_overdue` (table/wide), `library_circulation_stats` (stat-group/main) → also fills the admin-home gap.
- `library/catalog` — upgrade: cover thumbs (upload + ISBN auto-fetch via OpenLibrary/Google Books where reachable), copy-level accordion, rack mapping, filters (category/language/grade/status), bulk CSV import/export, cover-grid toggle.
- `library/checkout` — circulation desk: **barcode field first** (keyboard-wedge scanners type into inputs — zero drivers), member panel (photo, class, issues vs limit, outstanding fines in red, block over threshold), due-date preview from policy, rapid multi-issue; return flow with condition prompt + damage-charge + fine collection receipt.
- New pages: `library/reservations` (queue per title, ready-shelf list), `library/fines` (ledger + pay/waive), `library/members` (limits per type, history, block/unblock, no-dues certificate print via design-studio), `library/stocktake` (session wizard + scan UI + exceptions), `library/acquisition` (vendors/POs), `library/reports`, `library/settings` (policy matrix per member type).
- OPAC for student portal: upgrade `student/library` → search + facets + availability + place-hold + my-books countdowns; add OPAC section to public website (Theme C widget).

**Mobile:** admin app gets Circulation screen (scan-issue/scan-return via `mobile_scanner` — dependency already declared, zero usage today); student app scan-to-search; parent app sees child's loans+fines on dashboard card. Backend scan endpoints (§above) serve all three.

---

### THEME C — WEBSITE BUILDER CONSOLIDATION (founder ask: "simplified few pages, all synced with real data"; ~1 wk)

**Current state (verified):** 3 editor surfaces (website-builder editor+pages+themes+seo+domain+ai-builder; designer stack — different purpose, keep; `settings/website-design` — duplicate of the hub). 2 near-duplicate renderers (`SectionRenderer.tsx` 49KB public vs `EditorSectionRenderer.tsx` 44KB preview) that must be kept in sync by hand. Draft/publish/history backend exists (W-02), **no UI for it**. 16 section types; notices/teachers/gallery/results/events already render live data on the public site; hero/about/programs manual. `website_themes` table vestigial.

**Research verdict (Report 2 §4):** dynamic-first for everything data-backed; designed editor only for narrative pages. "Many pages" should be *auto-generated* per entity with clean slugs (`/notices/<slug>`, `/events/<slug>`), not hand-made.

| ID | Change | Detail |
|---|---|---|
| C-01 | Kill `settings/website-design` page | Redirect to `/dashboard/website-builder`. One hub: status+publish+domain+theme+SEO |
| C-02 | Merge the two renderers | One `SectionRenderer` with `mode: "public"\|"preview"` prop; delete EditorSectionRenderer (~44KB gone); snapshot test renders both modes identical for a fixture site |
| C-03 | Editor simplification (few pages, synced) | Pages manager trimmed to: **Home, About, Admissions, Facilities/Programs, Contact** as designed pages (+auto pages below). Autosave → draft_config; add the missing draft UI: **Save-draft / Preview (token URL) / Publish / Revert / History** buttons wired to existing endpoints (`publish-draft`, `revert-draft`, `history`, `history/<i>/restore`) |
| C-04 | Dynamic-first auto pages | New `page_type: "auto"` — single template per entity rendered server-side from SIS data: notices list + notice detail (`/notices/<slug>`), events + detail, results hub, teachers directory, fee-structure (from fees structures API, publish-gated), gallery. SEO: meta from entity fields, sitemap.xml auto-generated, OG cards. No editor needed — that's the point |
| C-05 | Public OPAC + live-data widgets | Add sections: `LibrarySearch` (Theme B OPAC), `FeeStructure` (auto), `NoticeTicker` (exists), `StatsCounters` (count-up), `WhatsAppFloat` (Nepal staple), `AdmissionInquiryForm` (exists → ensure it creates AdmissionInquiry rows — it does; add submission inbox link) |
| C-06 | Bilingual pages | Per-page `content_ne` variant + language toggle (research: curated Nepali, not machine-translate); BS dates in notices/events |
| C-07 | Theme engine cleanup | Drop `website_themes` table (A-08); keep in-code registry + parity test (already exists as test_theme_parity pattern) |
| C-08 | AI builder stays | `ai/generate-design|copy` kept, but generates **sections for the simplified page set**, not free-form sites |

**Accept:** a school with zero editor effort gets a correct public site (home + about + auto pages) driven entirely by SIS data; editor used only for hero/about/admissions copy; publish/revert/history works; `/sitemap.xml` live; Lighthouse ≥ 90 mobile.

---

### THEME D — AI WORKSPACE ARCHITECTURE RETHINK (the founder's core ask; ~2–3 wk)

**Verified today:** 2.2 GB / 656-file CDC corpus (121 textbooks + 121 teacher guides + 72 spec-grid/model-question PDFs + NCF docs, full provenance in catalog.json) is **0% ingested**. `ingest_textbook_catalog.py` writes nothing (analysis-only CLI, hardcoded dev path). Textbook tables (`textbook_corpora/pages/chapters/sections/assets`) exist and are empty with **zero API**. RAG ingests only a UNESCO policy doc. Tutor is prompt-only (no retrieval). `curriculum_context_builder.py` (tutor grounding + exam-grid payloads) is dormant with zero callers. Question bank keys on subject/class/free-text topic — **not linked to the curriculum tree**; no model sets; CDC spec grids unused. Preeti-legacy sidecars are mojibake (transcoder exists, unused in pipeline). Embeddings need `OPENAI_API_KEY` else BM25-only (weak on Devanagari).

**Decision (recorded):** the content spine is **platform-level** (one CDC corpus shared by all schools); school-level layers are: school-authored overrides (teaching_sections — already supports platform+override), school question banks (existing) + platform bank contributions, and per-school usage/mastery. RAG already retrieves `school_id = :sid OR NULL` — the tenant model is right; the content is just missing.

#### D-1 Content spine (new schema — replaces nothing, extends textbook_*)
```
content_sources        id, kind enum(textbook,teacher_guide,spec_grid,model_questions,curriculum_doc,past_paper,other), grade, subject_code, title_en/ne, edition_bs, language, source_url(cdc), file_path(managed storage), file_hash(uniq), page_count, encoding_class enum(unicode,preeti,scanned,english), ingest_status enum(pending,extracted,chunked,indexed,failed), ingest_error
  → replaces textbook_corpora as the catalog of ALL 656 files (keep textbook_corpora as a VIEW or migrate columns; textbooks get textbook_corpora rows with kind=textbook)
content_pages          id, source_id, page_number, printed_page, raw_text, clean_text(unicode), is_scanned, image_path(webp 200dpi)
  = textbook_pages generalized (or keep textbook_pages + source_id FK)
content_chapters       id, source_id, chapter_no, title_en/ne, page_start/end, curriculum_unit_id FK(→curriculum_units — the tree bridge), summary_text, summary_embedding, concept_ids JSONB, status enum(raw,segmented,summarized,reviewed)
content_sections       id, chapter_id, section_no, title, pages, teaching_section_id FK (bridge to school-authoring)
derived_content        id, scope_type enum(chapter,section,unit,subject,grade), scope_id, kind enum(summary,glossary,formula_sheet,learning_objectives,key_terms,exam_tips,misconceptions,spec_grid_extract), body(md), body_ne, source_chunk_ids JSONB, model, prompt_sha256, review_status enum(auto,approved,rejected), reviewer_id, created_at
  (replaces ad-hoc "contexts" — everything AI needs is a retrievable derived_content row)
content_chunks         id, source_id, chapter_id, page_start/end, chunk_index, text, text_ne, contextual_prefix(50–100 tok Anthropic-style), embedding vector(1024), tsv, metadata JSONB
  (generalizes document_chunks; keep document_chunks for school docs or migrate — prefer migrating: add source_kind column)
question_bank_items    ADD: unit_id FK, outcome_id FK, spec_grid_ref, model_set_usage JSONB, review_status enum(draft,ai_generated,reviewed,approved,published), reviewer_id, duplicate_of_id
paper_blueprints       ADD: source enum(cdc_spec_grid,manual,ai), spec_grid_source_id, validation_status, marks_sum CHECK
blueprint_rows         NEW TABLE (explode sections JSONB → rows: chapter_id/unit_id, type, count, marks_each, difficulty, bloom) — enables grid validation + per-cell generation
generated_papers       ADD: model_set enum(A,B,C,D,main), parent_paper_id (set siblings), status enum(draft,pending_review,approved,published), export_path
question_review_log    id, question_id, reviewer_id, action, comment, diff JSONB
```

#### D-2 Ingestion pipeline (Celery; new `app/services/ai/content_ingestion.py` + `tasks/content_ingestion.py`)
1. **Catalog stage** — read `nepal_textbooks/catalog.json` + `nepal_educational_materials/catalog.json` (+ resources_catalog for guides/grids) → `content_sources` rows (idempotent by file_hash); copy files into managed storage (`models/file.py` infra or R2) — kill the hardcoded dev path.
2. **Extract stage** — per source: PyMuPDF page render + text; classify encoding (reuse `preeti_transcoder.is_preeti_encoded`); Preeti → transcode to Unicode into `clean_text`; scanned (no text layer) → flag for VLM/OCR stage (design doc `docs/CURRICULUM_MULTIMODAL_INGESTION_ARCHITECTURE.md` covers the VLM path; phase 1 ships text-layer books only — the Unicode-era २०८०+ books — and queues the rest).
3. **Structure stage** — chapter/section detection: TOC-page parse (Devanagari "एकाइ/पाठ" headings) + heading-font heuristics + LLM assist for ambiguous cases → `content_chapters` (+ map to `curriculum_units` by grade+subject+title fuzzy-match with human-confirm queue for misses).
4. **Derived stage** — per chapter: LLM summary + glossary + formula sheet + learning objectives + key terms (+ Nepali versions) → `derived_content` (review_status=auto).
5. **Chunk+index stage** — structure-aware chunking (~512–1024 tok, heading metadata, never split tables/figures), Anthropic-style contextual prefixes (cheap with prompt caching), embed via TokenHub (needs OPENAI_API_KEY; **FC-AI-00 adds a Groq/local embedding fallback** so this isn't a hard gate), HNSW index. `ingest_status=indexed`.
6. **Spec-grid stage** — for the 72 grid/model-question PDFs: extract the मापदण्ड tables → `paper_blueprints(source=cdc_spec_grid)` + `blueprint_rows` per grade/subject + seed platform question bank from model questions.
7. **Teacher-guide stage** — guides chunked with `kind=teacher_guide` (retrieval-filterable so the tutor can answer "how should I teach this" for teachers but not leak answer-oriented guidance to students).
**Ops:** all stages re-runnable per source id; admin UI `super-admin/content-pipeline` (status counts, failures, re-run buttons, chapter-mapping confirm queue). Full corpus budget: extraction CPU-bound (~hours), LLM derived-stage ~121 books × chapters ≈ few thousand calls through TokenHub quota (platform tenant).

#### D-3 Grounding everything (wake the dormant code)
- Wire `curriculum_context_builder.py` (246L, already school-scoped post-R1) into: (a) **tutor_engine** — retrieve per turn: `content_chunks` hybrid (RRF already in rag.py) filtered by grade/subject/chapter + `derived_content` summaries; render citations as `[गणित किताब, पृ. ४५]` with page anchors from chunk metadata; tutor system prompt gains "answer only from retrieved context, else say the book doesn't cover it". (b) **workbench tools** — `context_curriculum` handler upgraded: units+outcomes **+ chapter summaries + textbook excerpts** (today it's hand-typed seed units only). (c) **question_paper_v2** — generation constrained per blueprint cell to unit_id with retrieved chapter context; bank-first already done.
- New read API (platform, superadmin+school read): `GET /content/sources`, `/content/chapters?grade&subject`, `/content/chapters/<id>` (sections+derived), `/content/search` (hybrid, used by every AI surface + teacher content browser UI).
- **Student-facing textbook reader** (web + mobile later): chapter list → page images + clean text + "Ask AI about this chapter" (opens tutor session pre-scoped).

#### D-4 Question bank + model sets (Theme E lives here)
- Blueprint editor UI (`dashboard/ai-tools/blueprint-builder` upgrade): grid editor chapter×type×marks×difficulty with live marks-sum validation (SEE 75-mark TH + 25 internal presets), **load-from-CDC-spec-grid** button, save blueprint, reuse per exam.
- **Model sets A–D:** generate main paper → request N set variants ("same cell, different item", shuffle order) → `generated_papers.model_set`; export **PDF per set + combined answer-key booklet** (design-studio template_engine already has writer/exam blocks: `_w_question/_w_answer_space/_w_page_break` — reuse).
- Review workflow: AI-generated bank items land `review_status=ai_generated`; review queue page (approve/edit/reject + embedding-similarity duplicate detection — jaccard_content_hash column already exists); only `approved` items sampled by default (v2 already filters is_approved; migrate to review_status).
- Link the exams module: exam record gets optional `blueprint_id` + generated paper attach (today blueprints live only in ai_tools — exams.py has zero linkage).

#### D-5 Persona copilots (the differentiator)
Route one assistant across 4 personas, all grounded on the spine: **Student** (tutor, Socratic, citations), **Teacher** (workbench tools + "ask my class data"), **Parent** (`/parent/*` Q&A — "how is my child doing?" from real records), **Admin/Data** (analytics NLQ → SQL-bounded queries on school schema). Phase 1: ship Student + Teacher (tutor grounding + workbench); Parent/Admin in F-wave.

**Accept for Theme D:** ≥1 grade (start Grade 10 — SEE year, highest demand) fully ingested end-to-end (textbook + guide + spec grid): chapters mapped to units, derived content generated, chunks indexed; tutor answers a Grade-10 Science question with a correct chapter+page citation (golden-set eval file, ≥90% citation validity); one 75-mark blueprint from the real CDC grid generates Sets A–D as PDFs with answer keys; all 5 ingest stages re-runnable with admin UI.

---

### THEME F — FULL-COVERAGE FEATURE WAVES (per-plugin depth vs §2.1 matrix)

Ordered by (revenue plugin tier × gap size). Each item: backend → web → mobile where applicable.

**Wave F1 — Money & admin depth (fees/hr/multi-branch):**
- Fees: bulk defaulter campaign UI (`POST /fees/defaulters/remind-bulk` + channel picker + schedule), fee fine calculator (per-day, like library), concession/discount approval workflow (status pending→principal-approved), cheque clearance states, eSewa/Khalti **agent-voucher flow** (voucher code generate → verify screen → ledger), payment status-poll fallback (5-min no-callback → status API), accounting export (Tally-compatible CSV ledger).
- HR: leave balances + accrual policy (new table + endpoints + UI), SST/TDS structured deductions (replace flat taxRate; Nepal slabs), payslip email/PDF delivery, salary structure templates per grade, Form-16-style annual report.
- Multi-branch: **cross-branch student transfers** (reuse StudentTransfer with source+target school; TC auto-generation via design-studio), consolidated fee dashboard, branch-comparison view (backend `/schools/chain/analytics` exists — add per-KPI branch breakdown).

**Wave F2 — Operations depth (inventory/visitor/conferences/gamification/wellbeing/health):**
- Inventory: surface procurement + QR audit (endpoints exist, unsurfaced); add vendors, PO/GRN chain (mirror library acquisition pattern), consumable stock movements (new tables), reorder alerts.
- Visitors: appointments approve UI, badge print (design-studio), host-notify on check-in (in-app + push), watchlist flag.
- Conferences: admin slot-manager page (backend slots/book/cancel exist; parent booking exists), teacher day-schedule view, post-meeting notes visible to parents.
- Gamification: **redemption endpoint + approval queue** (rewards catalog exists, no redeem), point rules automation (event-driven via plugins/events.py), house point events feed.
- Wellbeing: counselor session scheduling (CounselorSession model exists, unused), MTSS-lite tier view (mood+incidents+attendance composite), crisis escalation path.
- Health: medication schedules + screening camps + clinic live board; allergy red-banner on student profile header (safety pattern from research).
- Alumni: surface events + donations (endpoints exist, unsurfaced); graduate-conversion wizard (student→alumni with document archive).

**Wave F3 — Learning depth (lms/assignments/attendance/timetable/portfolio/admission):**
- LMS: student to-do widget (assignments+quizzes+fee dues aggregated), rubric grading (Canvas pattern) on assignments, guardian weekly digest (Celery + email/SMS template — Google-Classroom-style), plagiarism-lite flag (AI text heuristic — label honestly).
- Attendance: absence→auto-SMS push (event listener exists for parent notify — add SMS channel + threshold config), chronic-absenteeism flag on analytics (≥3/week), heatmap (day×class), **SEE send-up eligibility dashboard (75% rule)**, biometric↔manual reconcile report (punches vs marked).
- Timetable: drag-drop builder (swap on drop with conflict check), **substitutions workflow** (model exists! — teacher-absent → free-teacher finder → assign → notify), workload summary per teacher.
- Portfolio: teacher approval queue, term-over-term growth view, PDF export (design-studio).
- Admission: funnel kanban (status pipeline exists as table), source-wise analytics, document checklist with verify badges, waitlist, SEE-GPA cutoff per stream (Nepal Grade-11 intake), entrance-test scheduling + merit list.
- Exams (beyond Theme E): seating arrangement generator, invigilation schedule, re-evaluation flow, report-card template designer (wire design-studio to report-card layouts — three certificate paths already prove the pattern).

**Wave F4 — Communications depth:** scheduled sends + recurring notices, SMS credit ledger + low-balance alert, WhatsApp broadcast template-approval tracking, read-receipts for notices (per-student notice-read table — feeds parent-app "unread" badges), birthday/celebration auto-notices (RosarioSIS pattern — popular in South Asia), bilingual composer EN/नेपाली toggle.

**Wave F5 — Platform depth (super-admin/compliance):** tenant health table (last login, storage, SMS balance, AI quota, error rates), module-per-plan grid UI (entitlements data exists), RBAC **real editor** (replaces the only true frontend stub `settings/roles/page.tsx` — roles exist server-side: superadmin/school_admin/teacher/staff/student/parent), IEMIS verification-cycle tracker (draft→submitted→verified per cycle + validation dashboard with jump-to-fix), audit-log viewer UI (table exists), compliance calendar.

---

### THEME G — MOBILE CATCH-UP (rolling, per-app priorities)

| App | Priority adds (in order) |
|---|---|
| **flutter_admin** | 1) Fix A-03 broken screens 2) **Fee collection + receipt** (money = the product) 3) Exams: publish/unlock + marks approve 4) Payroll approve/pay + leave approve 5) Library circulation w/ scanner 6) Timetable generate + substitutions 7) Visitor appointments + badge 8) Notice read-receipts view 9) Content-pipeline status (superadmin) |
| **flutter_teacher** | 1) Fix A-03 (announcements→notices, teacher/wellbeing, live-classes) 2) Real AI tutor/workbench (sessions not one-shot homework-help — web contract `POST /ai/tutor/plans→sessions→turn`) 3) Substitution accept flow 4) Chapter reader + "teach from this" (Theme D) 5) Attendance offline queue 6) Hide payroll drawer item for teacher role |
| **flutter_student** | 1) Real AI tutor (replace homework-help one-shot) 2) Fees payment (parent already proves WebView flow) 3) Textbook reader + library OPAC/holds + barcode scan 4) Bus live map (reuse parent OSM map) 5) To-do widget 6) Gamification redemption |
| **flutter_parent** | Strongest app — adds: 1) Library loans/fines card 2) Bus geofence alerts (backend event) 3) Fee voucher flow (agent pay) 4) Notice read-receipt auto 5) Weekly digest deep-links |
| **flutter_user** | Force-update check at startup (service exists, never called); push tap→deep-link routing (setOnTapCallback never registered) |
| **Cross-cutting** | Wire `GET /plugins/widgets` mobile-card renderers (backend ships them, zero Flutter consumers — the whole widget contract is web-only today); i18n: `t()` only used in admin app-bar — sweep student/parent/teacher strings; image compression before upload; `connectivity_plus` actually imported + offline queue for attendance/marks (SecureStorage queue + retry — no need for full local DB in phase 1) |

---

### THEME H — DASHBOARD WIDGETS + NEPAL MOAT (cheap, high visibility)

**H-1 Widgets closable via YAML + one API each (no frontend deploy — spec renderers exist):** notices recent (core or notices plugin), events calendar, at-risk students (`/ai-tools/insights/risk-alerts` exists), library overdue (Theme B), admissions funnel counts, alumni events, inventory low-stock. Ship as widgets.yaml per plugin; slots already render server-side gated.

**H-2 Nepal moat pack (post spine):** CDC spec-grid paper generation (D-4) · IEMIS verification tracker (F5) · Nepali-language grounded tutor (D-3) · eSewa/Khalti agent-voucher fee flow (F1) · BS-date helper sweep (Q10 debt) · bilingual notices + report cards (report-card remark generation in Nepali via workbench tool) · SEE/NEB practice hub on student portal (past-paper chunks `kind=model_questions` → practice sets with instant feedback, MySecondTeacher pattern).

**H-3 Innovation backlog (not scheduled, ranked):** early-warning composite risk tier (attendance+grades+behavior+mood — tables all exist) · guardian digest automation · digital hall passes (campus-movement suite completion) · bus ridership scans + geofence · competency mastery report rendering curriculum_graph + mastery_records · AI report-card remarks · parent NLQ copilot.

---

## 4. SEQUENCING & MILESTONES

| Sprint | Contents | Exit criteria |
|---|---|---|
| **S1 (wk 1)** | Theme A hygiene (A-01..09) | Prod 500s verified dead; CI drift gate green; mobile broken calls fixed; pagination+N+1 fixed; menu reconciled |
| **S2–S3 (wk 2–3)** | Theme D spine stages 1–5 for **Grade 10** + Theme B backend | Grade-10 corpus indexed; tutor cites textbook pages; library v2 endpoints + tests |
| **S4 (wk 4)** | Theme B web+mobile + Theme C consolidation | Library dashboard→OPAC live; single renderer; draft/publish UI |
| **S5 (wk 5)** | Theme E/D-4 (blueprints, model sets, review) + Theme H-1 widgets | Spec-grid blueprint → sets A–D PDFs; admin home gains 5 widgets |
| **S6–S7 (wk 6–7)** | Wave F1 + F2 (money/ops) | Bulk campaigns, concessions, cross-branch transfers, redemption, PO/GRN |
| **S8 (wk 8)** | Wave F3 (learning) + mobile catch-up batch 1 | Substitutions live; eligibility dashboard; admin app money screens |
| **S9–S10 (wk 9–10)** | Wave F4+F5, Theme G remainder, Theme H-2 moat pack | Digests, RBAC editor, IEMIS tracker, practice hub; corpus ingest extended to remaining grades |
| **Continuous** | Corpus ingestion backlog (Grades 1–9, 11–12), golden-set AI evals per grade, Q-wave debt burn (naive timestamps, Fernet secrets) | — |

Dependency notes: Theme E needs D-1 schema (blueprint_rows) but can start UI on existing tables; Theme B is independent of D (start immediately after A); Theme C needs no backend beyond A-01; mobile A-03 fixes need nothing.

---

## 5. TESTS & VERIFICATION (per repo rule)
- Every backend change: pytest (fixtures for library v2 flows incl. race-tested issue/return, reservation queue ordering, fine math; blueprint marks-sum validation; ingest idempotency by file_hash).
- Frontend: jest/RTL for library desk flow, website draft/publish/revert, widget slots; renderer-merge parity test (public vs preview).
- Mobile: API-contract test fixture (all endpoints called by any app must exist in a recorded OpenAPI snapshot — prevents the A-03 class forever).
- E2E golden paths: issue→renew→overdue→fine→pay; student hold→ready→collect; draft→preview→publish→revert; spec-grid→blueprint→sets→review→export; Grade-10 tutor citation eval.

## 6. RISKS
1. **LLM cost of derived-content generation** for all 121 books — mitigate: platform-tenant quota, per-stage budgets, batch off-peak (Celery), cache by chapter hash.
2. **Scanned/Preeti books unparseable in phase 1** — mitigate: ship Unicode-era books first (२०८०+), queue others for the VLM stage already designed in docs/CURRICULUM_MULTIMODAL_INGESTION_ARCHITECTURE.md.
3. **Embedding dependency (OPENAI_API_KEY)** — FC-AI-00: add Groq embedding or a local bge-m3 endpoint fallback; until then BM25-only for Nepali is weak.
4. **Scope gravity** — this plan is ~10 weeks of focused work; the guardrail is the sprint exit criteria, not the item list.
5. **Curriculum-unit mapping misses** (CDC chapter titles vs hand-seeded units) — human-confirm queue in the pipeline UI is mandatory, not optional.

## 7. FOUNDER DECISIONS REQUESTED (defaults chosen; change anything)
1. Library fines bridge: pay at library desk only (default) vs post into FeeCollection ledger. → **Default: desk + optional bridge later.**
2. Website pages set: Home/About/Admissions/Facilities/Contact designed + auto pages (default) — or keep more designed pages.
3. Grade-10 first for the spine (default, SEE demand) — confirm.
4. Mobile strategy: keep 4 role apps + user shell (default) vs consolidate.
5. OPAC auth: student-token (default) vs fully public per-school toggle.
6. Model sets: A–D fixed (default, SEE convention).
