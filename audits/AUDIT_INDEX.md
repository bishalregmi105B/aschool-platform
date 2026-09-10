# ASCHOOL AUDIT INDEX

Running ledger of change waves (per `.cursorrules` rule 1). Historical audits
live in `audits_old/`.

## 2026-09-09 — FC Wave 1: Theme A platform hygiene (branch `feat/fc-theme-a-hygiene`)

Plan: `docs/MASTER_PLAN_2026-09-09_FULL_COVERAGE.md` (Theme A).

| ID | What landed | Files |
|---|---|---|
| A-05 | N+1 removal: joinedload on `/library/issues` + `/teacher/library`; joinedload on `/fees/recent` receipts and `/fees/outstanding` collections(+class). Delta-based query-count regression tests | `backend/app/api/v1/library.py`, `backend/app/api/v1/fees.py`, `backend/tests/test_fc_a05_n_plus_one.py` |
| A-06 | Hot-path indexes: `ix_book_issues_school_book`, `ix_book_issues_school_status_due`, `ix_books_school_deleted_title` (migration `fc_a06_idx` + model mirror) | `backend/migrations/versions/fc_a06_library_indexes.py`, `backend/app/models/library.py` |
| A-04 | Library web pages fixed: issues + books tabs now server-paginated (previously only page 1 ever rendered); overdue page uses live `status=overdue` filter instead of fetching all issued issues | `frontend/app/dashboard/library/page.tsx`, `frontend/app/dashboard/library/overdue/page.tsx` |
| A-03 | 11 broken mobile API calls fixed: repoints (health→`/health-records/profiles|immunizations` with field adaptation, admission leads→`inquiries` + `dashboard`, teacher announcements→`/notices` incl. content field, shared notice repo, teacher live-classes `mine=1`); new backend endpoints `GET /visitors/badge/<code>`, `GET /wellbeing/dashboard`, `GET /wellbeing/alerts`, `GET /teacher/wellbeing`, `GET /lms/live-classes`; admin inventory screen rewritten to the real asset model; dead `TransportRepository.getLiveLocation` fails honestly; social-hub screen/route removed (no backend ever existed) | flutter_admin/teacher/shared files, `backend/app/api/v1/{visitor,wellbeing,teacher,lms}.py`, `backend/tests/test_fc_mob_endpoints.py` |
| A-07 | Manifest nav reconciliation: removed subitems pointing at nonexistent pages (ai_teacher history/mastery/content, conferences slots/history); repointed nepal_curriculum nav; surfaced orphan pages (AI Workbench, Certificates, Online Question Bank, Expense Categories, Communications hub pages under SMS). plugin_doctor 49/0/0 | `backend/app/plugins/modules/*/{ai_teacher,conferences,nepal_curriculum,ai_suite,design_studio,exams,hr_payroll,sms_notifications}/manifest.yaml` |
| A-02 | Migration drift gate: `scripts/check_migration_drift.py` (scratch DB → `flask db upgrade` → `compare_metadata` vs models → exit 1 on diff) wired into CI backend job | `backend/scripts/check_migration_drift.py`, `.github/workflows/deploy.yml` |

Deferred in this wave (was A-08/A-09 partially): dropping vestigial columns
(`books.is_available`, `website_themes`, `book_transactions`) and merging the
two incident plugins — both need an expand-then-contract migration cycle and
are scheduled with the Theme B/F waves.

**Verification:** pytest `test_fc_a05_n_plus_one.py` (3), `test_fc_mob_endpoints.py` (4), campus-ops library tests — all green; `flutter analyze` clean on admin/teacher/shared; `tsc --noEmit` clean; drift gate PASS; plugin_doctor 0 errors.

## 2026-09-09 — FC Wave 2: Theme B library rebuild + Theme C consolidation + Theme H widgets (same branch)

Plan: `docs/MASTER_PLAN_2026-09-09_FULL_COVERAGE.md`. **AI workspace (Theme D/E) intentionally excluded from this run per founder instruction.**

| ID | What landed | Files |
|---|---|---|
| B-migration | Library v2 schema: `book_copies` (accession+barcode, per-school unique accession), `book_racks`, `book_reservations` (queue), `book_fines` + `book_fine_payments` ledger, `stocktake_sessions/items`, `book_vendors`/`book_purchase_orders`/`book_po_items`; `book_issues.copy_id+renewal_count`; `books.price/language/min_stock_alert`. Migration `fc_b_lib` matches models exactly (drift gate PASS) | `backend/migrations/versions/fc_b_library_v2.py`, `backend/app/models/library.py`, `backend/app/models/__init__.py` |
| B-api | 25+ endpoints under `/library/*`: copies CRUD + `GET /copies/scan/<code>` (one scan-resolution endpoint for web+mobile), renewal (hold-aware, renewal_limit), mark-lost → replacement fine from `books.price`, holds lifecycle (request→ready→collect/cancel, auto-promotion + auto-serve on return), fines pay/waive, stock-take (open/scan/close/missing-report/auto-fines), vendors + POs + receive-creates-copies, reports (popular/overdue_by_class/fines_collected/dead_stock/collection_stats), public OPAC search+detail (`school_slug` resolved, no auth) | `backend/app/api/v1/library.py` |
| B-fixes | `return_book` now writes ledger fines (fine_paid was unreachable) + hands returned copies to waiting holds; issue flow draws from physical copies; **`/student/library/request` persists a real reservation** (was a fake `{"requested":true}` — student_app.py:455); `/student/library` returns holds + outstanding fines + search | `backend/app/api/v1/student_app.py` |
| B-web | Library hub: KPI cards + quick links; NEW pages: reservations queue, fines ledger (pay/waive dialog), stock-take wizard (scan/close/auto-fine), reports (5 reports); checkout desk: barcode-first ScanPanel + Renew action; student portal OPAC: search, holds w/ queue position, fines notice | `frontend/app/dashboard/library/*`, `frontend/app/student/library/page.tsx` |
| B-widgets | `library_management/widgets.yaml`: library_circulation_stats (dashboard.main) + library_overdue (dashboard.wide) | backend/widgets.yaml |
| C-01 | `settings/website-design` → redirect to `/dashboard/website-builder` (3rd overlapping surface removed); settings link repointed | `frontend/app/dashboard/settings/website-design/page.tsx` |
| C-03 | Editor draft controls: **Revert draft** + **History panel (restore)** wired to existing W-02 endpoints (`revert-draft`, `/history`, `/history/<i>/restore`) — previously backend-only | `frontend/app/dashboard/website-builder/editor/page.tsx` |
| H-1 | YAML-only dashboard widgets: notices (`recent_notices`, `upcoming_events`), ai_suite (`at_risk_students` via `/ai-tools/insights/risk-alerts`) — closes the "notices/events/at-risk missing from admin home" gap with zero frontend deploy | `backend/app/plugins/modules/{notices,ai_suite}/widgets.yaml` |

**Deferred (honest):** C-02 renderer merge (`SectionRenderer` 1019L vs `EditorSectionRenderer` 875L — the editor one is the superset; needs a dedicated session + visual regression), C-04 dynamic-first auto pages (`/notices/<slug>` etc.), C-06 bilingual page variants, A-08 column drops (expand-then-contract), incident-plugin merge (A-09).

**Verification:** `test_fc_b_library_v2.py` 13/13 green (incl. fake-request regression + hold queue lifecycle + availability math); plugin_doctor 49/0/0; widget YAMLs parse; drift gate PASS; `tsc --noEmit` clean; jest 47/47.
