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
