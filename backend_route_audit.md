# ASchool Backend Route Audit

Date: 2026-05-04

## Scope

- ASchool backend: `backend/app/api/v1`, `backend/app/api/webhooks`, models, services, migrations.
- ASchool clients touched in this pass: `frontend`, `flutter_shared`, `flutter_admin`, `flutter_teacher`, `flutter_student`, `flutter_parent`.
- Reference systems inspected at source-layout level:
  - `Mighty School Pro v1.6`: vendor delivery is mostly zip archives for API and Flutter/web desktop code.
  - `eSchool SaaS v1.8.0 Nulled`: Laravel `PHP_CODE`, documentation, update archives, and Flutter student/parent/staff app packages.

## Route Inventory

- `backend/app/api/v1` contains 56 Python route modules.
- Static route decorator scan found 481 route declarations across `backend/app/api/v1` and `backend/app/api/webhooks`.
- Core blueprint registration is centralized in `backend/app/api/v1/__init__.py`.
- Plugin routes are registered dynamically through `backend/app/plugins/loader.py`.

## Implemented In This Pass

- Added persistent direct chat:
  - `GET /api/v1/communications/contacts`
  - `GET /api/v1/communications/messages/<user_id>`
  - `POST /api/v1/communications/send`
  - Parent chat endpoints now use the same persisted chat service.
- Added school banner/slider CRUD:
  - `GET /api/v1/sliders`
  - `POST /api/v1/sliders`
  - `PUT /api/v1/sliders/<slider_id>`
  - `DELETE /api/v1/sliders/<slider_id>`
- Added fee receipt and PDF routes:
  - `GET /api/v1/fees/collections/<collection_id>/receipt`
  - `GET /api/v1/fees/receipts/<receipt_id>`
  - `GET /api/v1/fees/receipts/<receipt_id>/pdf`
  - `POST /api/v1/fees/initiate-payment` for the parent app payment flow.
- Added mobile version policy:
  - `GET /api/v1/mobile/version`
  - `PUT /api/v1/mobile/version`
- Added current-school update route used by admin settings:
  - `PATCH /api/v1/schools/current`
  - `PUT /api/v1/schools/current`
- Extended files listing with `year` filter for gallery views.

## Stub/Mock Audit

- No `TODO`, `FIXME`, `coming soon`, `mock data`, `demo data`, `dummy data`, `fake data`, `not implemented`, or `/api/placeholder` matches remain in active ASchool backend/frontend/Flutter source scans.
- Empty-list API returns that remain are no-data guards, not unimplemented placeholders. Reviewed examples include portfolio items without a portfolio, parent views without selected wards, short search queries, and missing student report cards.
- Public website sample fallbacks for notices/events/principal/welcome/hero were removed so missing content renders empty states or no section.

## Verification

- `PYTHONPYCACHEPREFIX=/tmp/aschool_pycache python3 -m compileall backend/app` passed.
- `flutter analyze` passed for:
  - `flutter_shared`
  - `flutter_admin`
  - `flutter_student`
  - `flutter_teacher`
  - `flutter_parent`
- `npm run lint` in `frontend` is now configured and runs in the `nextjs` container.

## Residual Risk

- Next lint still reports non-blocking warnings for raw `<img>` usage and two hook dependency warnings.

## Live API Audit Update — 2026-05-05

- Logged in with the demo school admin and reproduced the browser 500s on:
  - `GET /api/v1/academics/subjects`
  - `GET /api/v1/academics/classes`
  - `GET /api/v1/users?role=teacher`
- Root cause: the running Postgres database was stamped at `28636966600d` while model code expected later migrations. Applied the missing Alembic chain through `c0a1b2c3d4e5`.
- Resolved an Alembic branch drift where `designer_templates` already existed but revision `9d4d0b8f3c21` was not recorded.
- Added `backend/scripts/api_route_audit.py` for repeatable safe route probing.
- Final live route audit result: 449 probes, 218 authenticated GET routes, 231 OPTIONS probes for unsafe routes, 0 server errors.
- Additional backend fixes from the live audit:
  - Notice audience compatibility in `analytics/teacher-dashboard`.
  - Fee collection/report compatibility with current `FeeCollection` model fields.
  - Website/AI/task service imports normalized from stale `backend.*` paths to app-local imports.
- Verification after fixes:
  - `docker compose exec -T flask python -m compileall app scripts` passed.
  - `docker compose exec -T flask python -m pytest` passed: 614 tests.
  - `docker compose exec -T nextjs npm run lint` exits 0.
  - `GET /api/v1/reports/fees/collection?start_date=2026-05-01&end_date=2026-05-05` returns 200.
