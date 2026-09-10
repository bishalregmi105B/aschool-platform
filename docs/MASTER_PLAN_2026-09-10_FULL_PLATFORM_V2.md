# ASchool Full-Platform Master Plan v2 — 2026-09-10

> Supersedes the per-theme scope of `docs/MASTER_PLAN_2026-09-09_FULL_COVERAGE.md`.
> Built from 7 parallel exploration waves (research, backend, web frontend, Flutter suite,
> plugin manifests, AI content architecture, website-builder/onboarding) plus fresh
> competitive research (PowerSchool, Classter, Fedena, Gradelink, QuickSchools, Gibbon,
> RosarioSIS, Otus, TeacherEase, Branching Minds, Securly/Raptor/SmartPass/PikMyKid/SchoolPass,
> Magnus Health, Eklavvya, MagicSchool, Seesaw, LiveSchool, Finalsite, PickATime, MyClassCampus,
> and Nepal vendors: Nimble Academic ERP, Veda, eDigital, SmartSikshya/MeroSchool, eShikshya, StuSync).
>
> **AI-workspace implementation (Program P-D) is GATED** — designed here, but not started until the
> founder explicitly approves, per standing instruction ("leave ai workspace … inform me before starting it").

---

## Part 0 — Method

| Wave | Agent scope | Output |
|---|---|---|
| 1 | Web research: expected pages/UI/UX per feature area, 2024-26 innovations, onboarding flows, nav patterns, file management patterns | Competitive feature reference (§4 "Expected" lines) |
| 2 | Backend full inventory: ~756 endpoints in `app/api/v1`, models, plugins, services, celery, files, tenancy, gaps | §1.1, §2 (defect backlog), §4 gap analysis |
| 3 | Web frontend inventory: 216 dashboard pages, components, uploads, menu, stubs, 9 file-URL anti-patterns | §1.2, P-A, P-C |
| 4 | Flutter suite: 5 apps, screen maps, feature matrix, shared layer, UX quality | §1.3, M-programs |
| 5 | Plugin manifest ↔ frontend cross-check: 50 plugins, route existence, widgets, events, capabilities, settings | §2, P-E, P-F |
| 6 | AI content architecture: RAG/teaching-content/textbook/question-bank stacks + `nepal_textbooks` corpus map (656 files, 2.2 GB) | P-D |
| 7 | Website builder data model + school onboarding/tenant setup | P-C, P-B |

Current branch state at planning time: `feat/fc-theme-a-hygiene` (3 commits: Theme A hygiene, Theme B library v2 + Theme C consolidation, fc-h dashboard widgets). Backend test suite was running at planning time (result pending, deliberately not waited on per founder instruction).

---

## Part 1 — Platform snapshot (what exists today)

### 1.1 Backend (Flask, `backend/`)

- **~756 API endpoints** under `/api/v1` across 60+ blueprint files; 50 plugins (42 module manifests + 8 legacy), of which 7 are WP-style with own `routes.py`. Celery: 22 task modules, 16 beat schedules, 4 queues. Channels live: Sparrow SMS, SMTP email, Meta WhatsApp Cloud, OneSignal push (+FCM fallback). Payments: eSewa, Khalti, FonePay. Files: `POST /files/upload` multipart → local or Cloudflare R2, `ManagedFile`/`FileFolder` metadata, ClamAV scan, stock-photo import. Tenancy via `SchoolModel.for_school()` + `resolve_school()` (subdomain → `X-School-Slug` → JWT). Audit trail via `before_flush` listener on sensitive tables.
- **AI stack**: workbench orchestrator (`ai/workbench.py`), 24 tools, token hub with quotas/ledger, tutor engine, question paper v2 (bank-first), adaptive learning, timetable solver, RAG service (pgvector 1024-dim + BM25 RRF hybrid — **complete but with zero retrieval call sites**), teaching-content spine (12 tables, versioned/publishable, admin-typed only), textbook tables (**zero writers**), curriculum skeleton (**synthetic seed**, no real CDC units, **zero learning outcomes seeded**).

### 1.2 Web frontend (Next.js, `frontend/`)

- **216 dashboard pages** (all real except 1 hardcoded stub: `settings/roles`), 17 alias/redirect pages, ~15 orphan pages (no nav entry, no inbound links — worst: `/dashboard/ai-tools/learning-paths` is the entire adaptive-learning UI). 4 auth pages, 14 public school-site routes, 11 parent-portal, 10 student-portal, 10 teacher-portal pages, super-admin.
- Sidebar is **100% manifest-driven** (`GET /plugins/sidebar`), 12 fixed sections, ~155 nav leaves, zero hard-404 nav entries (route normalizer works). Header: global search (no command palette), notification bell, EN/NE toggle.
- One DataTable component (server pagination, CSV export, bulk actions) used by 68 pages. FilePicker component exists and is good — used only by designer/IEMIS; **9 pages still ask users to paste file URLs** (P-A).
- Widget system: spec-driven, 6 plugins have `widgets.yaml` (29 widgets); **4 specs render wrong**, **2 fetch/link 404s**, **3 slot classes hosted by no page** (P-E).

### 1.3 Mobile (Flutter, 5 apps + aschool_shared, ~51k LOC)

- All Riverpod + go_router, shared theme (full dark mode), OneSignal/FCM push wired everywhere, plugin-gated drawers.
- **Admin** (10.9k): broadest app — 35+ screens but shallow (fees without collect, timetable read-only, no bulk ops, no roles, **assignments screen is a fake-data stub**).
- **Teacher** (10.9k): deepest app (attendance, marks, assignments + AI grading, diary, leave/payslips, library, wellbeing, portfolios — last one 404s, see B-06).
- **Student** (8.6k): solid; **drawer reachable only by edge-swipe** (Menu tab dead code); classmates via unfiltered `/students?per_page=100` (privacy leak).
- **Parent** (6.0k): smallest; bus map, QR dismissal, fee webview checkout, PT booking, chat (only live socket user).
- **User launcher** (1.5k): onboarding → school lookup → unified login → embeds the role app. No deep links, no OTP, no forgot-password.
- Shared layer: 17 repositories (**13 unused**), 15 provider files (mostly unused), file-upload service used by only 4 screens, **zero offline capability** (deps declared, never imported), i18n real only in admin chrome, form validation framework absent outside login.

### 1.4 Systemic weaknesses (the "why" behind the programs)

1. **Config-surface drift**: three section vocabularies for the website, two draft systems, two plugin-blueprint files both nav'ing `/dashboard/website-builder`, dead Craft.js `content` column, 15 legacy standalone website widgets, dead `website_sync.py`/`website_live_sync.py` tasks.
2. **Events fiction**: manifest `events:` blocks are ~60% aspirational; every cross-plugin `listens` contract except `attendance.marked`/`assignment.submitted` is broken at runtime; one dead listener name mismatch (`iemis.imported` vs `iemis.import_completed`).
3. **Grounding island**: RAG + textbook tables + context builder all exist, nothing is wired; curriculum ladder is synthetic; Nepali corpus is Preeti-encoded (mojibake) and unusable until transcoded.
4. **Mobile is a ported mirror, not a product**: repositories/providers scaffolding unused, no offline, breadth-over-depth admin.
5. **Onboarding is absent**: registration creates school + admin + free plugins and drops the user into an empty dashboard; no wizard, no checklist, no sample data, no readiness concept in `/mobile/bootstrap`.

---

## Part 2 — Defect backlog (Sprint 0 targets, all verified by exploration)

Priority: **P0** = user-visible breakage or data integrity; **P1** = wrong-but-tolerable; **P2** = hygiene.

| ID | Pri | Defect | Location | Fix |
|---|---|---|---|---|
| B-01 | P0 | Widget list specs render **literal field names** (`student_name`, `title`, `created_at` instead of values) — our fc-h widgets used bare keys; the contract needs `$`-prefixed tokens | `backend/app/plugins/modules/ai_suite/widgets.yaml`, `notices/widgets.yaml` | Change `title: student_name` → `title: $.student_name` etc.; add contract test asserting every `spec.item` key starts with `$.` |
| B-02 | P0 | `library_circulation_stats` renders empty forever — spec uses `stats:[{label,value_path}]` but `StatGroupWidget` reads `spec.items` | `backend/app/plugins/modules/library_management/widgets.yaml` | Reshape to `items` + `$.value` tokens (or teach renderer `stats` key; prefer reshape) |
| B-03 | P0 | `exams.upcoming_exams` rows link `/dashboard/exams/$.id` → **no exam detail page exists** (404 on click) | `exams/widgets.yaml` | Create `frontend/app/dashboard/exams/[id]/page.tsx` (exam overview + marks status + results count) and keep link |
| B-04 | P0 | `fees.mobile_fee_card` fetches `/parent-app/fees/summary` — route does not exist | `fees/widgets.yaml` | Point at `/parent/outstanding-fees` or add alias route |
| B-05 | P0 | Teacher app "Portfolios" screen calls `/teacher/portfolios` — **no such backend route** (404 in prod) | `aschool_shared/lib/repositories/student_repository.dart`, `flutter_teacher/lib/features/portfolio/student_portfolios_screen.dart` | Add `GET /teacher/portfolios` aggregate in `backend/app/api/v1/teacher.py` (list portfolios for teacher's students) |
| B-06 | P0 | Shared `FeeRepository` has 4 stale endpoints (`/fees/student/$id`, `/fees/pay`, `/fees/transactions`, `/fees/initiate-payment/$id`) — any adopter 404s | `aschool_shared/lib/repositories/fee_repository.dart` | Repoint to `/student/fees`, `/fees/collections/<id>/pay`, `/fees/recent`, flat `/fees/initiate-payment` |
| B-07 | P0 | `StudentRepository.getClassmates` → `/student/classmates` missing; student app works around it with `GET /students?per_page=100` (leaks whole roster, privacy + perf) | `aschool_shared/lib/repositories/student_repository.dart`, `flutter_student/.../classmates` | Add `GET /student/classmates` (scoped to student's sections); switch app to it |
| B-08 | P0 | `gallery_repository` POSTs to `/files/` (list route) — uploads go to `/files/upload` | `aschool_shared/lib/repositories/gallery_repository.dart` | Fix path; wire album photo upload into admin gallery screen (also P-A) |
| B-09 | P0 | `flutter_admin` calls `/dismissal/summary` and `/emergency/evacuation-plans`; backend defines `/dismissal/records` + `/emergency/plans` — probable 404s | `flutter_admin/lib/features/dismissal/`, `emergency/` | Verify against routes; repoint app or add backend aliases (prefer adding read-only aliases) |
| B-10 | P0 | Wrong plugin gates: `/design-studio/ai/question-paper` + `/ai/lesson-plan` gated on **`elibrary`** | `backend/app/api/v1/design_studio.py` (bulk block) | Gate to `ai_suite` |
| B-11 | P0 | Public school-site News pages fetch `/website/public/<slug>/news` — **route does not exist** → always empty | `frontend/app/school/[slug]/news/`, `backend/app/api/v1/website.py` | Add news feed route (published notices with `category="news"` or `is_news` flag) or remove page |
| B-12 | P0 | `seed_pd_framework` **double-inserts** document chunks (direct rows + RAGService.ingest) | `backend/app/services/ai/extensions.py` | Single write path |
| B-13 | P0 | Dead runtime listener: `@on("iemis.imported")` vs actual emit `iemis.import_completed` | `backend/app/plugins/listeners.py` | Rename listener |
| B-14 | P1 | Widget slots `dashboard.actions`, `student_profile.tab`, `plugin_page.header` are **hosted by no page** — 8 widgets can never render on web | `frontend/app/dashboard/page.tsx`, `students/[id]/page.tsx`, `exams/marks/page.tsx` | Add `WidgetSlot id="dashboard.actions"` strip on dashboard; tab host on student profile; header host on marks page |
| B-15 | P1 | `nepal_curriculum` manifest: nav route collides with academics; subitems point at ai_teacher/ai_suite pages it doesn't depend on (PluginGate upsell) | `backend/app/plugins/modules/nepal_curriculum/manifest.yaml` | Own nav (`/dashboard/teaching-content` page exists? create thin page) + `depends_on: [academics, ai_suite]` or remove cross subitems |
| B-16 | P1 | Three fully-built plugins hidden by `coming_soon: true`: **conferences, gps_tracking, whatsapp_bot** (nav never renders) | respective `manifest.yaml` | Unhide (they work end-to-end) |
| B-17 | P1 | `settings/roles` page is hardcoded fake data | `frontend/app/dashboard/settings/roles/page.tsx` | Real RBAC screen (P-O, O-04) |
| B-18 | P1 | `ai-tools` catalog lists `meeting-minutes` twice | `frontend/app/dashboard/ai-tools/page.tsx` | Dedupe |
| B-19 | P1 | `gamification/badges` field labeled `icon_url` but stores an emoji | `frontend/app/dashboard/gamification/badges/page.tsx` | Relabel "Emoji" (+ optional real icon upload via P-A) |
| B-20 | P1 | `suggest_sections` endpoint uses a section vocabulary the renderer doesn't know (dead/vestigial) | `backend/app/api/v1/website_builder.py`, `services/ai/website_designer.py` | Delete or rewrite against renderer registry (decide in P-C) |
| B-21 | P1 | `facilities` website section has a decorative `use_api` toggle that the renderer never reads | `frontend/components/website/SectionRenderer.tsx` | Make it dynamic (P-C W-03) |
| B-22 | P1 | Sitemap enumerates only 8 static paths — custom builder pages missing | `frontend/app/school/[slug]/sitemap.ts` | Enumerate published builder pages |
| B-23 | P1 | Tenancy hole: `Hostel`, `HostelRoom`, `HostelAllocation`, `FAQ` are plain `db.Model` (manual scoping only) | `backend/app/models/hostel.py`, faq model file | Convert to `SchoolModel` + migration backfill |
| B-24 | P2 | ~15 orphan pages unreachable by nav (list in §P-E) | various | Nav or delete (per-page decision table in P-E) |
| B-25 | P2 | Dead code: 15 standalone website components, `website_sync.py`, `website_live_sync.py`, `WebsiteBuilderService` duplicate CRUD, `WebsiteForm*` models, `create_missing_pages.py`, mobile `glow_orb`, `speech_to_text` dep, `connectivity_plus` unused, `force_update_dialog`/`ai_form_assist_sheet`/`mobile_version_service` unused exports | see §P-G | Delete or wire (decision per item) |
| B-26 | P2 | PDF exports 501 when WeasyPrint missing in prod (fees receipts, report cards, marksheets, basic reports) | `backend/app/api/v1/fees.py`, `exams.py`, `reports.py`, `design_studio.py` | Install WeasyPrint + system libs in prod image; smoke-test each PDF route |
| B-27 | P2 | `PushNotification` model orphaned — OneSignal path logs nothing | `backend/app/models/notification.py`, `tasks/push_notifications.py` | Write rows on send (audit + debugging value) |
| B-28 | P2 | Mobile: 12 deprecated `withOpacity` call sites; no router errorBuilder in admin app | `flutter_admin`, `flutter_parent` | Sweep |

---

## Part 3 — Cross-cutting programs

### P-A. File management everywhere (no manual URL pasting, no bespoke uploads)

**Principle (from research):** no mature platform uses bare URL fields; everything goes through upload widgets + entity-scoped libraries + previews. ASchool already has the full stack — `POST /files/upload` multipart → `ManagedFile` {id,url,folder,tags,visibility,linked_module}, `FilePicker.tsx` (grid, search, multi-select, inline upload), `files.service.ts`. The job is adoption + entity columns, not new infra.

| ID | Work | Where |
|---|---|---|
| F-01 | Build one shared `<FileField/>` wrapper: single-image variant (upload/replace/preview/alt-text) and multi-file variant (list, reorder, remove), both backed by FilePicker or direct upload; accept `folder` + `linked_module` props | `frontend/components/files/FileField.tsx` (new) |
| F-02 | Settings school branding: replace `logo_url`/`banner_url` paste inputs with FileField | `app/dashboard/settings/page.tsx:194` |
| F-03 | White-label branding logo → FileField | `app/dashboard/white-label/branding/page.tsx:137` |
| F-04 | Website builder editor image controls (all section `image`/`slides` fields) → FileField (also unlocks stock-photo import inside the editor) | `app/dashboard/website-builder/editor/page.tsx:262` + PropertiesPanel controls |
| F-05 | Website SEO OG image → FileField | `app/dashboard/website-builder/seo/page.tsx:172` |
| F-06 | Sliders `image_url` → FileField (most-uploaded asset class) | `app/dashboard/communications/sliders/page.tsx:201` |
| F-07 | Diary `attachment_urls` comma-separated input → multi-file FileField (copy the assignments pattern) | `app/dashboard/communications/diary/page.tsx:236` |
| F-08 | eLibrary add-dialog `file_url` → FileField (the two-step upload page stays as bulk flow) | `app/dashboard/elibrary/page.tsx:125` |
| F-09 | Portfolio credential/badge → FileField (keep external-URL option as secondary) | `app/dashboard/portfolio/page.tsx:512` |
| F-10 | Integrations QR: delete the manual paste fallback, keep upload only | `app/dashboard/settings/integrations/page.tsx:322` |
| F-11 | LMS course/lesson thumbnails + material files → FileField (field exists, no upload UI today) | `app/dashboard/lms/**`, teacher lessons screens |
| F-12 | Notices: add attachment support end-to-end (backend `Notice.attachment_file_ids` JSONB + public payload URLs; editor FileField; public NoticeBoard renders links/images) | `backend/app/models/notice.py`, `api/v1/notices.py`, `components/website/SectionRenderer.tsx` |
| F-13 | Entity attachment columns (backend) where research says docs belong: admission applications (document checklist + verification state), staff records (PIS documents), expenses (receipt image), health visits (report file), incidents (photos), events (poster) | respective models + create serializers + per-entity FileField in detail pages |
| F-14 | Mobile: switch all remaining flows to `FileUploadService` (admin gallery album upload — fixes B-08 UX, student homework picker, notice reader attachments, profile avatar) | `flutter_admin/gallery`, `flutter_student/homework`, `aschool_shared` |
| F-15 | File manager upgrades: per-entity "Linked files" tab (query `linked_module`/`linked_entity_id`), image preview drawer, per-type quotas display | `app/dashboard/files/page.tsx` |

**Acceptance:** zero `placeholder="https://..."` file inputs in dashboard grep; every upload tagged `linked_module`; mobile has no URL-typing flow.

### P-B. Onboarding & tenant setup (new-school journey)

Research pattern: setup wizard skeleton = school profile → session → classes/sections → subjects → staff import → student import → fee structures → comms → website → plugins, with progress meters and sample data. Today: registration drops an empty tenant into an empty dashboard.

| ID | Work | Detail |
|---|---|---|
| O-01 | `backend/app/api/v1/onboarding.py` — `GET /onboarding/status` computing 10 steps from real tables (profile+logo, academic year, classes+sections, subjects, teachers>0, students>0, fee structures, comms configured, website theme, plugins auto-done) with `done/skippable/href/remaining_count`; state kept in `School.settings["onboarding"]` | New blueprint, no new tables |
| O-02 | `POST /onboarding/complete-step`, `POST /onboarding/dismiss` | manual-completion escape hatch |
| O-03 | `POST /onboarding/seed-sample-data` + `services/onboarding_seed.py`: idempotent default BS year, ECD→12 class ladder with section A, core subject set, 3 fee types, 3 demo teachers + 5 `is_sample=True` students; `POST /onboarding/purge-sample-data` | lets a school click through attendance/marks on day one |
| O-04 | Real **Roles & Permissions** page replacing stub B-17: role list from JWT role set, per-role user counts (`GET /users/stats` new), permission matrix view (which plugins/modules each role sees — derived from visibility rules), invite-user flow | `app/dashboard/settings/roles/page.tsx` rewrite + `backend/app/api/v1/users.py` stats endpoint |
| O-05 | Dashboard onboarding card: full-width checklist when `remaining_count>0` and not dismissed; each row = check + deep link; slim "Finish setup (n)" pill after dismissal; shown as the landing experience right after register | `app/dashboard/page.tsx` |
| O-06 | Register flow post-step: redirect to `/dashboard?welcome=1` and auto-open the checklist (no backend change needed) | `app/(auth)/register/page.tsx` |
| O-07 | `/mobile/bootstrap` gains `readiness` block (remaining_count) so admin app can show the same checklist | `backend/app/api/v1/mobile.py`, `flutter_admin/settings` |
| O-08 | Multi-branch branch provisioning reuses `onboarding_seed` so new branches aren't empty (today they clone nothing, not even an admin) | `modules/multi_branch/routes.py` |

**Acceptance:** a fresh tenant can reach "students imported" in ≤5 guided clicks with sample data; admin app shows the same checklist.

### P-C. Website builder simplification (few pages, all synced with real data)

Target model: **9 fixed pages, every content section dynamic-first, custom pages demoted to an opt-in "extra pages" escape hatch.**

| ID | Work | Detail |
|---|---|---|
| W-01 | Public payload extension: bundle `events`, `facilities`, computed `stats` (from `School.total_students/total_staff/established_year_bs`), and `programs` derived from real `Classroom` rows (new public endpoint or fold into master payload) | `backend/app/api/v1/website.py` |
| W-02 | Dynamic-first sections: `stats` (live numbers, editor override optional), `programs` (real classes; fallback to static), `principal` (auto-fill from staff/principal fields), `facilities` (read `use_api`, feed exists), `about` (already dynamic-preferred) | `frontend/components/website/SectionRenderer.tsx` |
| W-03 | Kill fake fallbacks: no more placeholder notices/teachers/gallery/testimonial defaults — sections render honest empty states | `SectionRenderer.tsx` |
| W-04 | Shrink defaults: `DEFAULT_PAGE_SLUGS` → fixed set home/about/academics/admission/teachers/notices/events/gallery/results/contact (10) with rewritten always-dynamic starter sections; `ensure_default_pages` backfills existing tenants idempotently; removed slugs soft-flagged, never data-dropped | `backend/app/api/v1/website_builder.py` |
| W-05 | Pages page: "Theme Pages" = the fixed set (edit headings/toggles only); custom pages move under an "Advanced: extra pages" disclosure; delete the `news`/`alumni`/`facilities` enable-editing shadows (they stay hand-built dynamic pages) | `app/dashboard/website-builder/pages/page.tsx` |
| W-06 | Editor stays (sections add/reorder/edit) but gets: FileField images (F-04), live-data badges on dynamic sections ("synced from Notices"), and a simplified mode toggle hiding advanced controls | `editor/page.tsx` |
| W-07 | Delete dead weight: 15 standalone website components, `WebsitePage.content` Craft column (drop after confirm), `SchoolWebsite.draft_config`, `suggest_sections` vocab, `WebsiteBuilderService` duplication, `WebsiteTheme` rows or wire them, dead tasks `website_sync.py`/`website_live_sync.py` | backend + frontend |
| W-08 | Fix News: either add the `/news` public feed (from notices flagged `is_news`) or remove news pages — plus sitemap including custom pages (B-22) | B-11 + sitemap |
| W-09 | Merge nav surfaces: `basic_website` stops nav'ing website-builder entirely (superseded rule already exists — verify), single entry point | manifests |
| W-10 | Home fallback (600-line hardcoded) reduced to "render default dynamic sections" so fallback and builder output converge | `app/school/[slug]/page.tsx` |

**Acceptance:** a school that only fills its profile + publishes gets a complete real-data site; grep shows zero fake default content in website components; page count per school = 10 + opt-in extras.

### P-D. AI content spine & AI workspace rethink — ⛔ GATED (founder approval required before ANY implementation)

**Corpus reality (nepal_textbooks):** 656 files / 2.2 GB — 121 cataloged CDC textbooks (Grade 1–12), ~113 teacher guides, ~77 spec-grid/model-question PDFs, NCF 2076 docs; every PDF has a `.txt` sidecar; **all Nepali sidecars are Preeti/Kantipur 8-bit mojibake, not Unicode** (`g]kfn ;/sf/` = नेपाल सरकार). `preeti_transcoder.py` exists but is a partial map. English books are clean Unicode. The existing `ingest_textbook_catalog.py` is analysis-only (never writes DB).

**Current AI stack state:** 4 disconnected content stacks (curriculum skeleton with **synthetic** units and **zero outcomes**; teaching-content spine — mature but admin-typed only; textbook tables — zero writers; `document_chunks` RAG — service complete, **zero retrieval call sites**, one double-writing seed). Workbench has no retrieval stage; `AIGeneration.citations` never populated; `grounding` registry column dead; tutor ungrounded; question-paper v2 is bank-first but banks start empty, blueprints have no CRUD, no spec-grid parsing, **no model-set/variant concept**.

#### P-D.1 Schema (5 layers, additive)

- **L1 `content_sources`** — generalizes `textbook_corpora`: `kind ∈ textbook|teacher_guide|spec_grid|syllabus|curriculum_doc|model_question|past_paper|oer|school_upload`, board/grade/subject_code, editions, language, `font_encoding`, file_sha256 (UQ per kind), licence/attribution, `ingest_status ∈ registered→parsing→structuring→aligning→chunking→embedding→qa→published|failed`, `replaces_source_id`. Backfills: `DigitalBook`→`school_upload`, `PastPaper`→`past_paper`.
- **L2 `content_units`** — self-FK tree (part/chapter/section), `curriculum_unit_id` **NULLable with explicit `align_method`/`align_confidence`** (never fake alignment), page ranges, printed labels, `has_exercises`, review-queue flag for low-confidence matches.
- **L3 `content_chunks`** — page-anchored (page_start/end + printed no), `kind ∈ prose|definition|worked_example|exercise|figure_caption|formula_block|spec_grid_row|model_question|answer_key`, `text`/`text_en`/`text_ne`, `embedding_vec vector(1024)` + HNSW/GIN, `qa_status` + flags (mojibake, near-dup via jaccard), `is_published`. `TextbookPage` stays as page-render cache; `TextbookAsset` links by `chunk_id`.
- **L4 question_bank extensions** — `+ outcome_id`, `+ unit_id`, `+ content_chunk_id`, `+ source_source_id`, `provenance` JSONB, `language_status`, `variant_group_id`; enforce jaccard dedupe on ingest.
- **L5 blueprint/paper extensions** — `paper_blueprints + spec_grid_source_id`, sections schema v2 (unit_ids/outcome_ids/bloom targets, read-old-shape compat), `model_set_config {n_sets, labels, shuffle_seed, variant_strategy}`, `status draft|active|retired`; `generated_papers + set_label, variant_no, shuffle_seed, parent_paper_id`. One run → N papers sharing `parent_paper_id`, cross-set exclusion, deterministic re-render from seed.

#### P-D.2 Ingestion pipeline (8 stages)

`ACQUIRE` (drive from existing catalogs, sha256 dedupe, subject-name normalization YAML incl. NEB numbers 101/107… and अंग्रेजी spelling variants) → `PARSE` (PyMuPDF text-layer first; **Preeti→Unicode** via completed glyph table verified against translated-edition parallel structure; OCR ladder only for true scans: Google Vision DOCUMENT_TEXT_DETECTION > tesseract nep+hin ensemble, tagged `qa_flags.ocr`; pdfplumber for grids) → `STRUCTURE` (TOC + font-size heuristics → `content_units`, exercise boundaries) → `ALIGN` (embed unit titles vs **real CDC curriculum units** + LLM confirm, low-confidence → human review queue; spec grids → blueprint drafts) → `CHUNK` (400–800 tokens, never cross unit boundaries, kind-tagged, bilingual pairing via translated editions) → `EMBED+QA` (AITokenHub batches; gates: mojibake-zero, Devanagari-ratio, near-dup, coverage report) → `PUBLISH` (atomic per source; published chunks dual-write into `document_chunks` as `source_type='content_chunk'` — RAGService untouched) → `SERVE` (admin content endpoints + re-run CLI).

**Hard prerequisite:** replace the synthetic `curriculum_seed.py` with real CDC unit lists (grades 1–10 × core subjects, official periods/weights — extractable from the NCF docs already in-corpus) and seed headline learning outcomes.

#### P-D.3 Consumption wiring (all behind per-tool flags)

- Workbench: retrieval stage after context builder (`RAGService.retrieve` top-6 filtered by source_types + resolved units) + persist `AIGeneration.citations`; enforce `grounding='required'` → 422 when no published chunks.
- Tutor engine: one retrieve per turn → `build_context_block` into system prompt.
- Question paper v2: unit/outcome filters, difficulty fallback ladder, cross-set exclusion, grounded shortfall generation (seeds `content_chunk_id` provenance), model-set loop, blueprint CRUD + "import from spec grid".
- `CurriculumContextBuilder` rewired from textbook_* to content_* and **finally wired** as AI-Teacher grounding; `TeachingSection.content_unit_id` FK added (authored↔ingested join); `TeachingContentSnapshot` written at publish.
- Adaptive learning: mastery-driven practice from outcome-linked bank items.
- Fix `seed_pd_framework` double-write first (B-12).

#### P-D.4 Phasing + acceptance (for when approved)

Phase 0 hygiene (seed fix, real curriculum seed, register-writes) → Phase 1 additive tables + backfills → Phase 2 consume (flagged) → Phase 3 consolidate (`content_chunks` becomes retrieval primary, textbook chapter/section tables frozen). Key acceptance gates: ≥98% de-mojibake'd pages on the Grade 1–10 Math+Science batch; ≥90% chapter alignment at confidence ≥0.7 with honest NULLs; zero chunks crossing units; RAG retrieval demo ("प्रकाशको वर्ण विक्षेप" → Grade 10 Science passage with page ref); 3 model sets sharing parent id with zero bank-item overlap and seed reproducibility; citations rows on every grounded call.

### P-E. Navigation / IA & widget system

Research: mature platforms run 8–15 top modules with submenus (30–60 leaves), role dashboards, app-store style activation, and global search; command palettes are emerging. ASchool's manifest-driven 12-section / ~155-leaf sidebar is close, but has orphans, self-dup subitems, hidden-but-built plugins, and an unhosted widget slot system.

| ID | Work | Detail |
|---|---|---|
| N-01 | Orphan-page resolution (decide per page): **nav them** — `faqs` (add under settings_core), `hr/leaves/report` (subitem of Leave Mgmt), `library/transactions`, `transport/allocation` + `pickup-points`, `certificates/character` + `/transfer` (subitems), `students/guardians`, `diary/categories`, `designer/writer2` (merge writer→writer2 into one route), `academics/class-subjects` + `class-teachers` + `years` (manifest subitems), `bulk-uploads/history`, `ai-tools/progress` (add to catalog). **Delete** none without founder look — default is "nav it" | manifests + pages |
| N-02 | Remove self-duplicating subitems (8 plugins list parent route as first subitem) | manifests |
| N-03 | Unhide `coming_soon` plugins (B-16) and fix nepal_curriculum collision (B-15) | manifests |
| N-04 | Widget slot hosts: `dashboard.actions` strip (quick-action chips row on dashboard), `student_profile.tab` host in `students/[id]`, `plugin_page.header` host in `exams/marks` (B-14) | pages |
| N-05 | Widget spec contract hardening: contract test asserting `$`-tokens + known renderer shapes; fix B-01/B-02 specs; honor `limit`/`empty_text` in ListWidget | `renderers.tsx`, contract test |
| N-06 | Command palette (Ctrl/Cmd+K): index = sidebar tree + global search + recent records; lazy-load on first open | `components/layout/` (new `command-palette.tsx`) |
| N-07 | Favorites: per-user pinned menu items (localStorage v1, backend later) rendered at sidebar top | sidebar |
| N-08 | Query-param subitem active-state fix (files?type=image etc. should highlight correctly) | sidebar |
| N-09 | Section regroup pass: rename "Growth" → "Community" (alumni), ensure every plugin lands in one of the 12 sections; kill duplicate Reports entries (ai_suite subitem vs basic_reports) | manifests + PLUGIN_SECTION_ORDER |
| N-10 | Role-shaped dashboard: admin sees widgets + onboarding; teacher role gets teacher-dashboard widgets; document the role → widget contract | `app/dashboard/page.tsx` |
| N-11 | 404 page for unknown dashboard routes (admin app parity too) | router errorBuilder |
| N-12 | Menu count governance: validator rule — any plugin with >1 page must declare subitems; any manifest route must exist (already enforced) + **any page route must appear in a manifest or be linked** (CI check for orphans) | `backend/app/plugins/validator.py` |

### P-F. Events bus normalization (make the manifest contract true)

| ID | Work | Detail |
|---|---|---|
| E-01 | Canonical event vocabulary table (single source: `app/plugins/events.py` constants), then align runtime emits: `fee.paid`→`fees.collected` (or vice versa — pick one), `results.published`→`exams.result_published`, `attendance.student_absent`→`attendance.absent_alert`, `notice.created`→`notice.published`, `iemis.import_completed`→`iemis.imported` (B-13) | pick canonical names, migrate emit sites + listeners |
| E-02 | Emit the missing high-value events: `exams.result_published`, `fees.overdue` (from fee reminders task), `timetable.generated`, `wellbeing.alert_triggered`, `incident.reported`, `conference.booked`, `dismissal.student_picked_up`, `library.returned/overdue` | API + task sites |
| E-03 | Wire the valuable listeners that exist only on paper: sms on absent/overdue (already partly hand-written), whatsapp on results/fees, website_builder revalidate on notice published, timetable on class_created (no-op guard), gamification on result_published | listeners |
| E-04 | Audit: CI test that every manifest `listens` name has ≥1 runtime emit, and every runtime `@on` has a canonical emit (kills fiction at the source) | `backend/tests/test_plugin_contract.py` extension |
| E-05 | Delete aspirational manifest event blocks that remain unwired after E-01..03 (honesty > fiction) | manifests |

### P-G. Tenancy, models & repo hygiene

| ID | Work | Detail |
|---|---|---|
| T-01 | `Hostel*` + `FAQ` → `SchoolModel` (B-23) with backfill migration | models |
| T-02 | Orphan-model decision list (~20 tables): **wire** — `PushNotification` (B-27), `Substitution` (FA-07), `WellbeingSurveyResponse` (FA-14), `QuestionSubpart`/`QuestionRubricStep` (FA-06), `AdmissionForm` (FA-01 form builder), `AIInsight` trio (FA-14 EWS persistence), `StudentAIProfile` (FA-06), `AIToolAnalyticsDaily` read API. **Drop** — `BookTransaction`, `MoodCheckin`, `SchemeGrade`, `TimetablePeriod`, `WebsiteForm*`, `PluginUsageLog` (or wire metering in plugins page), `CounselorSession`, `AdmissionLead` (fold into inquiry), `DailyBrief`/`WeeklyInsightReport`/`RiskAlert` (only if EWS persists) | expand-then-contract migration pattern |
| T-03 | Delete dead code (B-25 list) after wiring decisions: website legacy set, Craft column, dead tasks, obsolete script, mobile orphans | backend + frontend + flutter |
| T-04 | Fix teacher-class scoping doc/debt: homeroom concept (class-teacher) vs `SectionSubjectTeacher` — document + helper `get_teacher_scope()` used by teacher endpoints | `backend/app/api/v1/teacher.py` |
| T-05 | WeasyPrint into prod image + PDF smoke tests (B-26) | Dockerfile, CI |
| T-06 | `WebsitePage.slug` unique constraint at DB level (currently API-validated only) | migration |
| T-07 | Design-studio writer route consolidation (`/designer/writer` → one real route) | frontend |
| T-08 | Repo hygiene: delete `create_missing_pages.py`, `tmp/aschool-next-dist/`, `.next-host`; decide `audits_old/` fate | root |

### P-H. i18n & quality pass

| ID | Work | Detail |
|---|---|---|
| L-01 | Mobile i18n: move drawer labels/screen titles/snackbars to `I18nService.t()` in teacher/student/parent (admin chrome already done); audit untranslated admin feature content | flutter |
| L-02 | Form validation kit: shared Flutter validators (required, phone `nepalPhoneRegex`, email, number ranges, BS date) + adopt in top 10 forms | aschool_shared |
| L-03 | Web: complete Nepali labels for the 155 nav leaves (spot-check missing) + key page titles | manifests/pages |
| L-04 | Mobile polish sweep: 12 `withOpacity` sites, admin errorBuilder (B-28), consistent EmptyState usage | flutter |

### P-I. Mobile programs (per app)

**M-A admin (biggest gap: breadth over depth + a fake screen)**
| ID | Work |
|---|---|
| M-A1 | **Rewrite assignments stub into a real screen** (list `GET /assignments`, status chips, tap→submissions count) — trust killer today |
| M-A2 | Fee collection flow: outstanding list → collect payment (cash/eSewa reference) → receipt share (PDF link) — uses existing `/fees/*` |
| M-A3 | Admissions pipeline screen (inquiries → applications → accept; uses `/admission/dashboard` + accept action) |
| M-A4 | Timetable: AI-generate trigger + per-class view; substitution notice feed |
| M-A5 | Users & roles: user list w/ toggle-active, reset password, roles read view (O-04 parity) |
| M-A6 | Bulk ops: student CSV import via file picker (`/iemis/import`), bulk password reset |
| M-A7 | Library ops parity: issue/return scan (camera barcode), fines quick actions |
| M-A8 | Onboarding checklist card (O-07) |
| M-A9 | Website quick actions: publish/unpublish site, latest contact messages |

**M-B teacher**: M-B1 portfolio screen endpoint fix (B-05) + UI polish; M-B2 offline attendance draft (M-F3); M-B3 diary attachments (F-14); M-B4 leave balance card.

**M-C student**: M-C1 drawer fix — add 5th "Menu" tab (dead `index==4` path) or switch to shared AppDrawer; M-C2 classmates via new `/student/classmates` (B-07); M-C3 homework file picker instead of URL fields (F-14); M-C4 route tree cleanup (collapse legacy redirect map).

**M-D parent**: M-D1 fee payment retry/cancel states + receipt view after webview; M-D2 conference booking parity with new plugin unhide (B-16); M-D3 notices attachments (F-12); M-D4 bus ETA card on dashboard.

**M-E user launcher**: M-E1 go_router deep links (`/login`, `/school/:slug`), M-E2 forgot-password + OTP flows (backend exists, no UI), M-E3 admin mode → open admin app store link instead of snackbar bounce, M-E4 in-app school switcher.

**M-F shared/platform**: M-F1 prune or adopt 13 unused repositories + unused providers (decision: adopt top 5, delete rest); M-F2 offline cache layer (sqflite/drift) starting with: auth session, today's timetable, notices cache; M-F3 **offline attendance draft queue** (attendance taken offline syncs later) — the Nepal differentiator (StuSync pattern); M-F4 force-update dialog adoption (already built, unused); M-F5 connectivity banner.

---

## Part 4 — Feature-area plans

Format per area: **Expected** (what leading platforms ship — from research) → **Current** → **Gap** → work items `BE-*` backend / `WE-*` web / `MB-*` mobile. Items marked ⛔-adjacent (AI) defer to P-D.

### FA-01 Admissions & enrollment
**Expected:** enquiry CRM pipeline w/ stages+counselor, online application form builder, doc checklist + verification, application fee, auto class allotment + ID card, merit lists, applicant portal, WhatsApp admission bot.
**Current:** `admission.py` (9 routes, follow-up task), inquiries from public form, admin web page + admin app dashboard; `AdmissionForm`/`AdmissionLead` models orphaned.
**Gap:** pipeline stages/counselor assignment, per-requirement document checklist w/ verification UI, application fee linkage, no form builder, no WhatsApp flow.
- BE-1: pipeline stage enum + counselor assignment + stage-transition notes on `AdmissionApplication`; dashboard by stage/source/counselor.
- BE-2: document checklist: `AdmissionRequirement` rows per class + per-application doc links (ManagedFile) + verify/reject actions (uses F-13).
- BE-3: wire `AdmissionForm` as public form-builder rows (or delete — decide with W-07); application-fee → fees plugin linkage.
- WE-1: admissions page upgrade: kanban-style pipeline view (stage columns), counselor filter, doc verification drawer.
- WE-2: applicant status page (public, tokenized link) — application timeline.
- MB-1 (admin): M-A3 covers pipeline; add doc-verify action.
- MB-2 (parent): application status card pre-enrollment.

### FA-02 Student information
**Expected:** 360° profile (demographics, docs, timeline, activity log), custom fields, remarks module, ID cards, sibling/family linking, alumni-inclusive records, bulk imports, NL search.
**Current:** strong CRUD + promote/transfer/roll-numbers/profile-images/bulk-import/guardians; detail page 420 lines; activity log absent.
**Gap:** timeline (unified attendance/incident/fee/mood/portfolio events), remarks module, custom fields, richer doc vault on profile.
- BE-1: `GET /students/<id>/timeline?type=&limit=` — union query over keyed tables (paginated).
- BE-2: `StudentRemark` model + CRUD (+ visible-to-parent flag).
- WE-1: profile tabs: Timeline, Remarks, Documents (FileField grid), Fees, Health, Wellbeing — some exist as pages; consolidate into profile.
- WE-2: remarks UI + report-card integration point.
- MB-1 (admin): student detail gets timeline tab.

### FA-03 Attendance (incl. biometric)
**Expected:** day+period-wise, half-days, custom codes, biometric device pages, kiosk, tardy/latecomer tracking, parent absence push, defaulter heatmaps, EWS integration, offline capture.
**Current:** full plugin (15 routes), biometric devices/ingest/heartbeat, alerts task, leave workflow, widgets (today overview + register).
**Gap:** period-wise/subject-wise marking, attendance codes config, chronic-absence analytics + parent push on absent (task exists? verify), kiosk mode, EWS thresholds.
- BE-1: subject-period attendance model extension (`AttendanceSubjectPeriod` or reuse with `period` column) + teacher marking surface.
- BE-2: attendance codes/settings (`/attendance/settings`); absent → parent push + SMS template wiring via E-02 event.
- BE-3: EWS service: nightly chronic-absence flags (≥N% monthly) → wellbeing alerts (FA-14) + RiskAlert persistence.
- WE-1: heatmap page (class × day grid, month selector); period-wise marking UI for teachers.
- WE-2: kiosk page (tablet fullscreen: student ID scan → in/out, auto tardy slip print hook).
- MB-1 (teacher): offline draft queue (M-F3); MB-2 (parent): real-time absent notification surfacing.

### FA-04 Fees & billing
**Expected:** structure designer (category/class-wise, installments/scheduled dates), master particulars, advance payments, discounts/scholarships (exists), sibling discounts, late fines, receipt designer + PDFs, defaulters + reminders (exists), AutoPay, eSewa/Khalti/ConnectIPS (eSewa/Khalti/FonePay exist), IRD e-billing compliance, VAT slabs, aging/AR reports, transport/hostel fee bundling.
**Current:** strongest plugin (33 routes): types/structures/apply/batch-monthly/collections/pay/refund/receipts PDF/defaulters+remind/scholarships/initiate-payment + webviews; widgets good.
**Gap:** installments per structure, late-fine automation, receipt template designer, AR-aging report, sibling discount logic, ConnectIPS, VAT fields, fee bundling across plugins.
- BE-1: installments: `FeeStructureItem` gains schedule (due dates per installment); collections due-view per installment; late-fine task (existing reminders task extended).
- BE-2: AR aging report endpoint (30/60/90 buckets by class).
- BE-3: sibling discount: sibling detection + percentage on structure apply.
- WE-1: receipt template designer (simple: header/footer/logo/footnote — reuse design-studio-lite patterns); WE-2: aging report page; WE-3: installment schedule editor.
- MB-1 (admin): collect flow M-A2; MB-2 (parent): installment due card + payment retry M-D1.

### FA-05 Exams, marks, report cards
**Expected:** exam groups, marks entry w/ verification workflow, mobile entry w/ submission status, grading systems (GPA/letter — Nepal letter grading exists?), skill-based marks, report card templates, transcripts, comment bank, hall tickets/admit cards, board exam mgmt (symbol numbers, back papers).
**Current:** 26 routes: CRUD/marks/grade-sheet/marksheets html+designer+bulk-pdf/publish/unlock/report-cards+bulk-pdf; admin+teacher apps.
**Gap:** marks verification (teacher submit → admin approve), admit-card generation (design-studio has it — link), NEB board exam fields (symbol no, registration), comment bank, exam detail page (B-03).
- BE-1: marks workflow states (draft→submitted→verified) w/ unlock flow integration.
- BE-2: exam symbol-number/registration fields for SEE/NEB.
- WE-1: exam detail page `[id]` (B-03) w/ status, marks progress, publish, results summary; WE-2: verification queue page for admins.
- MB-1 (teacher): marks submission-status chips (exists partially); MB-2 (admin): verification approve action.

### FA-06 Online exams & question banks
**Expected:** MCQ+descriptive, timers, auto-marking, question banks w/ roles (setter/validator), negative marking, proctoring-lite, analytics; AI: syllabus-mapped generation, Bloom tags (partially exists).
**Current:** online exams + attempts; question bank CRUD via ai-tools; paper v2 bank-first; QTI export (MCQ only); subpart/rubric models orphaned; blueprint CRUD missing; no model sets ⛔ (P-D).
- BE-1: blueprint CRUD endpoints + status lifecycle (prereq for P-D L5 but standalone useful).
- BE-2: wire `QuestionSubpart`/`QuestionRubricStep` into bank item detail + online exam rendering.
- BE-3: online exam: per-question timer + auto-submit + plagiarism-lite (tab-switch counter).
- WE-1: question bank manager page (filter type/difficulty/topic/approval queue) — today buried in ai-tools; WE-2: blueprint builder UI (exists as ai-tool — elevate).
- MB-1 (student): online exam UX hardening (auto-save answers).

### FA-07 Timetable & substitutions
**Expected:** subject-teacher allocation manager, one-click substitutes, swaps w/ notifications, room allocation, teacher/student/class views (exist), PDF export, auto-generation (exists via solver).
**Current:** 6 routes + solver + generate/save; views for teacher/student; `Substitution` model orphaned; web page + admin read-only app.
- BE-1: substitutions: create (absent teacher → candidates by free slots), notify substitute (push/SMS via E-01), apply to day.
- WE-1: substitution management page + "today's absences" panel; WE-2: PDF export of timetables.
- MB-1 (admin): M-A4; MB-2 (teacher): substitution notification card.

### FA-08 Assignments & LMS
**Expected:** submissions approve/reject/resubmit (exists), grading+feedback (exists + AI grade), rubrics, lesson planning mapped to curriculum, content sharing per chapter (⛔ P-D later), live classes (exists Jitsi), seating charts, course marketplace.
**Current:** solid both sides; LMS thin UI for courses/materials/live-classes; admin app assignments is a stub (M-A1); teacher file uploads work.
- WE-1: rubric builder on assignments (reuse QuestionRubricStep pattern); WE-2: LMS course page depth (materials list, enrollments, progress bars).
- MB-1 (admin): M-A1 rewrite stub; MB-2 (student): assignment resubmit flow.

### FA-09 Library
**Expected:** done to research spec in fc-b (copies/holds/fines/stocktake/PO/reports/OPAC). Remaining: membership types, rack map visual, equipment catalog (Gibbon pattern), due-date WhatsApp/push reminders (event exists).
- BE-1: reminder task → WhatsApp/push template (E-03).
- WE-1: rack map view (visual grid by rack); WE-2: OPAC polish (public search already exists).
- MB-1 (admin): scan issue/return M-A7; MB-2 (student): hold + renewal requests (endpoints exist).

### FA-10 Transport & GPS
**Expected:** route/stop/waypoint planning, vehicle+driver records, maintenance/fuel logs, live map (exists), geofence alerts, route fees in billing, bus boarding manifests, parent ETA push.
**Current:** routes/buses/stops CRUD + GPS logs + Firebase poller + live map + parent tracker; allocation + pickup-points pages orphaned (N-01); geofence events declared but not implemented.
- BE-1: geofence: stop-radius entry/exit events → parent push (uses GPS poller stream).
- BE-2: route-fee linkage into fee structures (FA-04 bundling).
- BE-3: driver/vehicle docs + maintenance log CRUD (extends buses).
- WE-1: nav allocation + pickup-points (N-01) and finish their pages; WE-2: maintenance log UI.
- MB-1 (parent): ETA/geofence "bus approaching" push M-D4.

### FA-11 HR & payroll
**Expected:** PIS w/ statutory fields (SSF/PAN/PF/CIT — verify present), biometric+app attendance→payroll (exists), leave masters w/ encashment/lapse, payroll engine w/ TDS + multiple sheets (exists), letter generator, ESS app (exists partially), recruitment tracker.
**Current:** 25 routes, payroll/leave/appraisals/expenses, monthly task; admin+teacher apps; duplicate route aliases.
- BE-1: letter generator: template store + docx render (reuse writer_docx service) — appointment/promotion/transfer.
- BE-2: leave masters config (types, quotas, carry-forward rules) + auto-reset task.
- WE-1: letter generator page (template → fill → download); WE-2: leave settings page.
- MB-1 (teacher): leave balance card M-B4; payslip PDF share.

### FA-12 Inventory & assets
**Expected:** multi-store, issuance to staff/departments, min/max reorder alerts, QR asset labels (exists), depreciation schedules, repair/warranty tracking, reconciliation, consumption analytics.
**Current:** assets CRUD + QR scan + procurement + audit logs (just rebuilt for mobile).
- BE-1: depreciation scheduler (monthly task, straight-line) + book-value report.
- BE-2: min-stock alerts → notifications (reorder list).
- WE-1: depreciation + reorder pages; asset QR label print (design-studio link).
- MB-1 (admin): QR audit scan flow (camera) — audit logs endpoint exists.

### FA-13 Health records
**Expected:** medical profile (allergies/immunizations/insurance — exists), nurse visit logging (exists), compliance reminders to parents for missing immunizations, emergency cards share, concussion/eligibility, parent self-service updates.
- BE-1: compliance reminder task (missing immunization → parent notice).
- WE-1: emergency-card print per student (design-studio template); WE-2: parent-editable medical consent form.
- MB-1 (parent): medical info self-service screen (read + request changes).

### FA-14 Wellbeing & counseling (MTSS)
**Expected:** MTSS workspace w/ Tier 1-3 plans, progress monitoring charts, ABC early-warning (attendance/behavior/course), check-in/check-out, IEP tracking (exists via workbench IEP), anonymous tips.
**Current:** moods/summaries/dashboards/alerts/counselor notes/surveys + dashboard/alerts endpoints (fc-h); `WellbeingSurveyResponse` orphaned; risk alerts computed not persisted.
- BE-1: persist `RiskAlert` rows from nightly EWS (attendance FA-03 + marks trends + mood) with status lifecycle (open→in_intervention→resolved).
- BE-2: intervention plans: `WellbeingIntervention` (student, tier, goal, steps, review date) + progress notes.
- BE-3: survey responses wiring (model exists).
- WE-1: MTSS board (student list × risk tier, plan drawer); WE-2: survey builder + response charts.
- MB-1 (student): mood check-in streaks; MB-2 (parent): wellbeing alerts card.

### FA-15 Visitors
**Expected:** kiosk check-in w/ ID scan, badge print (exists), watchlist screening, appointments (exists), event check-in, volunteer mgmt.
- WE-1: kiosk mode page (fullscreen tablet, camera QR/ID, auto badge); WE-2: watchlist (block-listed persons → alert on check-in).
- MB-1 (admin): QR badge scan verify (exists) + kiosk toggle.

### FA-16 Dismissal
**Expected:** parent announce flow, carline queue, pickup modes, authorized-pickup validation (exists), dispatcher screen, reports, digital car tags (QR exists).
- WE-1: live dismissal queue board (dispatcher view: announce → verify → done timeline).
- MB-1 (parent): "announce pickup" button (creates today's dismissal record intent) M-D parity.

### FA-17 Emergency & disaster
**Expected:** panic/alert broadcast (exists), drill manager w/ compliance dashboards (exists via disaster), real-time accountability/headcount (exists), reunification workflow, mass-notification integration (channels exist).
- WE-1: drill compliance dashboard (per-class participation %, last-drill dates); WE-2: reunification checklist mode (student released → guardian verified log).
- MB-1 (teacher): headcount submit from class roster (endpoint exists; surface).

### FA-18 Communications hub
**Expected:** multi-channel blast (SMS/email/voice/push — SMS+push exist, email service exists), templates library w/ dynamic fields, WhatsApp-first templates + two-way bot (exists), in-app chat (exists), diary (exists), auto-triggers per event, feedback/complaint loop.
**Current:** sms/broadcast/templates, WhatsApp bot, notices, diary, chat, push; events wiring broken (P-F); gallery/sliders parked under sms nav.
- BE-1: unified Broadcast API (audience builder: class/section/house/route/club + channels multi-select) replacing per-channel sends.
- BE-2: template variable engine shared across channels ({{student_name}}, {{amount_due}}, BS dates).
- WE-1: communications hub page restructure: Compose (audience → channels → template), Templates, Diary, Gallery, WhatsApp; nav regroup (N-09).
- MB-1 (admin): broadcast compose screen.

### FA-19 Conferences (PTM)
**Expected:** admin scheduler, parent booking portal (exists), teacher views, reminders, calendar sync, reports; portfolio-powered conferences (Seesaw pattern).
**Current:** full plugin hidden by `coming_soon` (B-16); parent booking exists; notes exist.
- BE-1: reminders (slot reminder task → push/SMS).
- WE-1: unhide + nav (N-03); conference prep page linking AI tool (exists) + portfolio evidence tab.
- MB-1 (parent): M-D2.

### FA-20 Alumni
**Expected:** alumni records, portal (events, directory), donations/fundraising, employer/internship tie-in.
**Current:** alumni/events/donations + public site feed; single admin page.
- WE-1: alumni management depth: events w/ RSVP, donation campaigns w/ totals, batch filters.
- WE-2: public alumni page form: "register as alumni" (creates pending record).

### FA-21 Gamification & behavior points
**Expected:** behavior rubrics w/ point categories, one-tap awarding, house competitions, rewards store redemption, family celebration feed, positive-ratio analytics.
**Current:** badges/points/houses/leaderboard/rewards + streak task; badge emoji field (B-19).
- BE-1: reward redemption workflow (request → approve → fulfilled) + stock counts.
- WE-1: points ledger page per student; weekly positive-ratio chart.
- MB-1 (teacher): one-tap point award from class list (mobile-first action).

### FA-22 Portfolio
**Expected:** journal w/ photos/audio/video, year-over-year growth, activity library, peer assessment, competency mapping.
**Current:** items + micro-credentials; credential URL paste (F-09); teacher view (B-05 fix); parent view exists.
- WE-1: media-first item composer (F-09); competency tag picker from learning outcomes (prepares for P-D mastery).
- MB-1 (teacher): quick-add portfolio item (camera) per student.

### FA-23 Compliance & iEMIS
**Expected:** one-click statutory exports, audit trail (exists), state-report style modules; Nepal: iEMIS census auto-fill, IRD billing compliance.
**Current:** compliance reports CRUD + EMIS exports + audit-logs read; iEMIS importer strong (formats/validate/import/history).
- BE-1: iEMIS auto-export generator: map live DB → iEMIS sheet format (extends importer formats into exports).
- WE-1: compliance calendar (filing deadlines w/ status); export center page consolidation.

### FA-24 Multi-branch & white-label
**Expected:** chain dashboards (exist), template-driven branch provisioning (O-08), cross-branch transfers, owner app.
- BE-1: branch template clone (config snapshot → new branch): classes/subjects/fee types/roles.
- WE-1: chain analytics depth (per-branch comparison tables).
- MB-1: owner overview screen (chain dashboard read-only).

### FA-25 Hostel
**Expected:** rooms/blocks, allocation/checkout (exists), mess management, visitor logs, fee linkage.
- BE-1: SchoolModel conversion (B-23/T-01); fee linkage for boarding.
- WE-1: room occupancy grid view; visitor/parole log.

### FA-26 eLibrary & digital content
**Expected:** digital books (exists), past papers w/ exam-type taxonomy (exists), OER (exists), reading progress, chapter-mapped media (⛔ P-D later), subscriptions.
- BE-1: reading progress per student (last page, minutes) + teacher report.
- WE-1: fix add-dialog (F-08); reading analytics page.
- MB-1 (student): reader screen w/ progress sync.

### FA-27 Design studio & certificates
**Expected:** (covered) bulk generation, templates, revisions, AI suggest, writer. Gaps found: wrong gates (B-10), writer route split (T-07), 2 orphan certificate pages (N-01).
- WE-1: certificate subpage nav completion; ID-card field mapping polish (photo from ManagedFile — already FilePicker).

### FA-28 Public website & portals
Covered by P-C (website) — plus portal gaps:
- WE-1: parent portal: add missing modules as routes surface (conferences exists, add dismissal announce M-D parity, documents tab).
- WE-2: student/teacher portals: ai-tutor exists; add learning-paths UI once P-D Phase 2 lands (currently orphan page N-01).
- WE-3: portal notifications inbox (reuse notifications service).

---

## Part 5 — Sprint sequencing

Each sprint = one implementation run with tests at the end (founder's workflow). Dependencies noted. Backend drift gate + `pytest` + `tsc` + `flutter analyze` are the per-sprint gates.

| Sprint | Scope | Items | Depends on |
|---|---|---|---|
| **S0 — Defect sweep** | All P0 defects + quick P1s | B-01..B-13, B-15, B-16, B-18..B-20, B-27, B-28 + N-02 (self-dup subitems) | none |
| **S1 — Files everywhere + widget system** | F-01..F-10, B-14 (slot hosts), N-05, B-03 (exam detail page), B-04 | F,B,N | S0 |
| **S2 — Onboarding & access** | O-01..O-07, B-17 (roles page), profile edit screen, N-11 | O,B | S0 |
| **S3 — Website simplification** | W-01..W-10, B-11, B-21, B-22 | W | S0 (F-04 for editor images can land in S1) |
| **S4 — IA / nav completion** | N-01, N-03 (if not in S0), N-06..N-10, N-12, P-F events (E-01..E-05) | N,E | S0 |
| **S5 — Money & exams depth** | FA-04 (BE/WE/MB), FA-05, FA-06 BE-1/2 | FA | S0 |
| **S6 — Attendance & people depth** | FA-03, FA-02 (timeline+remarks), FA-11, T-04 | FA | S0 |
| **S7 — Communications & community** | FA-18 (broadcast hub, template engine), FA-19, FA-20, FA-12 (unhide work included), F-11..F-13 | FA,F | S4 (events) |
| **S8 — Operations depth** | FA-07 (substitutions), FA-10 (geofence, allocation pages), FA-15 (kiosk), FA-16 (queue board), FA-17, FA-25 | FA | S4 |
| **S9 — Mobile wave A** | M-A1..M-A9, M-C1..M-C3, M-F4 | M | S0 (B-05..B-09) |
| **S10 — Mobile wave B + offline** | M-B1..M-B4, M-D1..M-D4, M-E1..M-E4, M-F1..M-F3 (offline attendance draft), M-F5 | M | S9 |
| **S11 — Wellbeing/EWS + compliance + chain** | FA-14 (EWS persistence + MTSS), FA-23 (iEMIS export), FA-24 (provisioning), O-08 | FA | S6 (EWS needs attendance data) |
| **S12 ⛔ — AI spine Phase 0-1** | B-12, real CDC curriculum seed, `content_sources/units/chunks` migration + corpus Stage 1-2 (Preeti conversion on Math+Science batch) | P-D | **founder go-ahead** |
| **S13 ⛔ — AI spine Phase 2** | Retrieval wiring (workbench/tutor/papers), blueprint CRUD+model sets, question bank extensions | P-D | S12 |
| **S14 ⛔ — AI spine Phase 3 + consolidation** | Model-set polish, chunk-table consolidation, adaptive learning mastery loop, learning-paths UI | P-D | S13 |

Parallelizable: S9/S10 can interleave with S5-S8 (different apps). T-02/T-03 hygiene rides whichever sprint touches the area.

**Sprint acceptance criteria (uniform):** drift gate 0 blocking; new tables have model tests; every new endpoint has a contract test; `tsc` clean; `flutter analyze` 0 errors; mobile endpoints verified against backend routes (no new B-05-class 404s — add a CI check that greps Flutter API paths against Flask route table); audits ledger updated.

---

## Part 6 — Founder decisions requested (do not block S0-S4)

1. **AI workspace (P-D / S12-14)**: approve to start? Any scope cut (e.g., skip OCR tier, start with Math+Science only)? — *standing instruction: inform before starting; this plan is the information.*
2. **Custom website pages**: keep the catch-all "extra pages" escape hatch (recommended) or hard-fix to 10 pages?
3. **Orphan pages**: default is "nav everything" (N-01) — any page you'd rather delete outright?
4. **Events vocabulary**: confirm canonical names in E-01 (e.g., `fees.collected` vs `fee.paid`) — plan picks the manifest/plural form.
5. **Model sets default**: 4 sets (A-D) with shuffle+variant strategy — OK as default config?
6. **Offline-first investment**: S10 includes offline attendance drafts (the StuSync differentiator). Full offline-first (all write queues) is a bigger lift — confirm attendance-only first.
7. **ai_adaptive_learning**: give it its own marketplace plugin (recommended: keep captive under ai_suite, just nav its page).

---

## Part 7 — Source notes

- Competitive expectations quoted/condensed in FA sections come from the Wave-1 research report (Fedena/QuickSchools/Gibbon/Nimble/Veda patterns; MTSS/MTSS-lite from PowerSchool/Branching Minds; safety suite from Raptor/Securly; dismissal from PikMyKid/SchoolPass; health from Magnus; assessment AI from Eklavvya/MagicSchool; WhatsApp-first from Vidyalaya/OpenEduCat; offline-first from StuSync).
- Code facts (file:line references) come from Waves 2-7 exploration reports; every B-item was verified against the named files during exploration.
- The prior plan (`MASTER_PLAN_2026-09-09_FULL_COVERAGE.md`) remains valid for Theme A/B/C/H work already shipped; this document supersedes its sequencing and extends scope platform-wide.

