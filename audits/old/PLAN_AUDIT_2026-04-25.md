# ASchool Plan Audit — 2026-04-25

This audit was produced after reading both planning documents completely:

- `ASchool_ULTIMATE_v1.md` (4372 lines)
- `IMPLEMENTATION_PLAN.md` (652 lines)

The goal of this file is simple: say clearly what is already implemented, what is only partial or renamed, and what is still missing from the declared ASchool scope.

## Overall Verdict

ASchool is **not yet complete against the two plans**.

The repo already has a strong plugin-oriented foundation, a large backend surface, a working Next.js dashboard shell, public school website routes, shared Flutter infrastructure, and many AI service files. But several plan-declared systems are still missing, renamed without full parity, or only present as shallow screens/endpoints.

In short:

- Plugin architecture: **mostly implemented**
- Backend breadth: **strong but incomplete**
- Frontend breadth: **broad but uneven**
- Flutter apps: **foundation present, feature coverage incomplete**
- Website builder: **present, but far from 20-theme/full-builder target**
- Advanced AI school OS promise: **partially implemented, not complete**
- Testing/docs/deployment completeness: **not complete**

## What I Fixed During This Audit

While auditing, I fixed a few concrete implementation-alignment issues:

- corrected frontend transport plugin slug from `transport_gps` to `gps_tracking`
- corrected website builder dashboard links from `/website-builder/...` to `/dashboard/website-builder/...`
- corrected website builder pages to import `{ api }` from `frontend/lib/api.ts`
- corrected `frontend/lib/plugin-gate.tsx` to use real installed-plugin checks instead of `includes()` on object arrays
- added shared frontend plugin-slug normalization so legacy dashboard slugs like `hr`, `visitors`, and `communications` resolve to installed plugin slugs such as `hr_payroll`, `visitor_management`, and `sms_notifications`
- gated the file manager and IEMIS importer pages through real plugin checks
- added a real backend `communications.py` API surface for stats, templates, and broadcast sending, backed by the existing notification models
- fixed `sms.py` to use the real notification template fields and the existing bulk SMS task
- added a WhatsApp settings dashboard page under `/dashboard/communications/whatsapp`
- added plan-compatible backend route modules for `super_admin.py`, `staff.py`, `mobile.py`, `sse.py`, `themes.py`, `elibrary.py`, `benchmarking.py`, and `webhooks.py`
- added plan-compatible alias modules for `backend/app/extensions.py`, `backend/app/plugins/registry.py`, `backend/app/utils/auth.py`, `backend/app/utils/image_utils.py`, and `backend/app/services/notification_engine.py`
- added plan-compatible model alias files for staff, communication, health, hr, analytics, designer, and ad-campaign naming parity
- added HR compatibility endpoints for `/hr/stats`, `/hr/payroll/generate`, plural leave routes, and frontend-friendly appraisal/payroll field aliases
- aligned benchmarking and e-library dashboard pages to the new compatibility APIs and improved the HR appraisal page to use real staff selections
- fixed website-builder theme API/frontend parity so the dashboard reads the real backend response shape, theme application accepts the active theme ids, and the public `school/[slug]` layout now applies registry theme CSS variables
- expanded website-builder compatibility routes with dashboard-used status, section CRUD/reorder, and domain verification endpoints, and aligned the pages manager to the actual backend payload shape

Files updated:

- `frontend/components/layout/sidebar.tsx`
- `frontend/app/dashboard/transport/page.tsx`
- `frontend/lib/plugin-gate.tsx`
- `frontend/app/dashboard/website-builder/*`
- `frontend/lib/plugins.tsx`
- `frontend/app/dashboard/files/page.tsx`
- `frontend/app/dashboard/iemis-import/page.tsx`
- `frontend/app/dashboard/communications/broadcast/page.tsx`
- `frontend/app/dashboard/communications/whatsapp/page.tsx`
- `frontend/app/dashboard/benchmarking/page.tsx`
- `frontend/app/dashboard/elibrary/page.tsx`
- `frontend/app/dashboard/hr/appraisal/page.tsx`
- `frontend/app/dashboard/website-builder/page.tsx`
- `frontend/app/dashboard/website-builder/pages/page.tsx`
- `frontend/app/dashboard/website-builder/themes/page.tsx`
- `frontend/app/school/[slug]/layout.tsx`
- `frontend/themes/loader.ts`
- `backend/app/api/v1/communications.py`
- `backend/app/api/v1/sms.py`
- `backend/app/api/v1/__init__.py`
- `backend/app/api/v1/themes.py`
- `backend/app/api/v1/elibrary.py`
- `backend/app/api/v1/staff.py`
- `backend/app/api/v1/super_admin.py`
- `backend/app/api/v1/mobile.py`
- `backend/app/api/v1/sse.py`
- `backend/app/api/v1/webhooks.py`
- `backend/app/api/v1/benchmarking.py`
- `backend/app/api/v1/hr_payroll.py`
- `backend/app/api/v1/website_builder.py`
- `backend/app/extensions.py`
- `backend/app/plugins/registry.py`
- `backend/app/utils/auth.py`
- `backend/app/utils/image_utils.py`
- `backend/app/services/notification_engine.py`
- `backend/app/models/staff.py`
- `backend/app/models/communication.py`
- `backend/app/models/health.py`
- `backend/app/models/hr.py`
- `backend/app/models/analytics.py`
- `backend/app/models/designer.py`
- `backend/app/models/ad_campaign.py`

## Phase-by-Phase Status

### Phase 0 — Project Scaffolding & Infrastructure
Status: **Mostly complete**

Present:

- `docker-compose.yml`
- `docker-compose.prod.yml`
- `Makefile`
- `.env.example`
- `README.md`
- `backend/config.py`
- `backend/extensions.py`
- `backend/wsgi.py`
- `nginx/nginx.conf`

Gaps:

- docs directory is only partial
- not all plan-declared infra/docs files are present

### Phase 1A — Core Backend Foundation
Status: **Mostly complete**

Present:

- `backend/app/__init__.py`
- `backend/app/models/base.py`
- utilities for pagination, validators, Nepali date/number handling, i18n, rate limiting

Gaps:

- plan-named compatibility files for `backend/app/extensions.py`, `backend/app/utils/auth.py`, and `backend/app/utils/image_utils.py` now exist, but they are still thinner than a fully plan-built implementation

### Phase 1B — Plugin System Core
Status: **Mostly complete**

Present:

- `backend/app/plugins/loader.py`
- `backend/app/plugins/decorators.py`
- `backend/app/plugins/events.py`
- `backend/app/plugins/billing.py`
- a large manifest set under `backend/app/plugins/manifests/`
- plugin install/uninstall data model in `backend/app/models/plugin.py`

Gaps:

- module-based plugin packages under `backend/app/plugins/modules/` are not actually populated as the plan suggests
- some manifest slugs/names drift from plan naming

### Phase 1C — Database Models + Migrations
Status: **Partial**

Present:

- many domain models exist, including school, plugin, user, student, academic, attendance, exam, assignment, fee, transport, social, admission, visitor, alumni, gamification, inventory, LMS, wellbeing, dismissal, compliance, emergency, digital content, conference, portfolio, incident

Important gaps or naming drift:

- these concerns are partly merged into other files such as:
  - `health_records.py`
  - `hr_payroll.py`
  - `designer_document.py`
  - `notice.py`
- plan-named alias files now exist for the above concepts, but several are compatibility exports over existing implementations rather than fully separate model modules
- migrations exist, but not as one complete plan-aligned `001_initial.py`

### Phase 2A — Authentication & Core API Routes
Status: **Partial**

Present:

- `auth.py`
- `schools.py`
- `students.py`
- `users.py`
- `academics.py`
- `search.py`

Gaps:

- newly added plan-named route/service files still need deeper behavioral parity in some areas, especially mobile and real-time flows

### Phase 2B — Plugin Marketplace API
Status: **Mostly complete**

Present:

- browse marketplace
- install plugin
- uninstall plugin
- list installed plugins
- get/update plugin config

Gaps:

- billing endpoint not implemented as declared
- trial endpoint not implemented as declared
- live websocket/frontend/plugin sync is only partially reflected

### Phase 3 — Free Plugin Backends
Status: **Partial**

Present:

- attendance
- notices
- academics
- website
- analytics/basic reporting

Gaps:

- not every free plugin surface is aligned to the exact plan naming/structure
- `academics.py` is not plugin-gated despite the plan treating academic setup as a pluginized feature

### Phase 4 — Frontend Foundation
Status: **Partial**

Present:

- `frontend/middleware.ts`
- auth pages
- dashboard shell
- plugin context/provider
- dashboard sidebar/header/layout
- marketplace page

Gaps:

- route groups differ from plan shape
- many plan-declared dedicated component folders are missing, especially marketplace and website-builder component sets
- plugin shell is functional but not as dynamic and complete as declared

### Phase 5 — Frontend Dashboard Pages
Status: **Partial**

Present:

- many school-admin dashboard pages
- teacher, parent, student top-level portals
- super-admin page
- public school pages

Gaps:

- web teacher/parent/student portals are much shallower than the plan
- several feature pages exist but are not full production workflows
- there is still plugin slug drift in some dashboard pages

Known frontend plugin slug mismatches found during audit:

- `hostel` has no corresponding manifest
- `file_management` and `iemis_importer` exist as module manifests, but still need broader parity review across dashboard + mobile surfaces

### Phase 6 — Starter Plugin Backends
Status: **Partial to Mostly Complete**

Present:

- `fees.py`
- `exams.py`
- `library.py`
- `whatsapp_bot.py`
- `assignments.py`
- `conferences.py`
- `dismissal.py`
- `incidents.py`

Gaps:

- payment services differ from plan naming:
  - repo has `esewa_gateway.py`, `khalti_gateway.py`
  - plan expects `esewa.py`, `khalti.py`, `fonepay.py`
- WhatsApp service/webhook structure differs from plan naming

### Phase 7 — Growth Plugins + AI Services
Status: **Partial**

Present:

- social hub
- admission
- design studio
- HR/payroll
- health records
- alumni
- gamification
- inventory
- visitor management
- LMS
- wellbeing
- emergency
- compliance
- portfolio
- many AI services under `backend/app/services/ai/`

Gaps:

- social boost / meta ads implementation is not present as plan-named backend surface
- website builder/design studio are present but not yet at declared depth
- `timetable_gen.py` is missing; repo has `timetable_solver.py`
- several AI services exist as files but still need full workflow wiring to UI and data

### Phase 8 — School Website Builder
Status: **Partial**

Present:

- website builder route group exists
- public `school/[slug]` pages exist
- website-related backend routes exist
- theme registry defines **20 themes**
- theme loader now synthesizes registry themes into builder-facing theme definitions
- public school layout now applies registry theme CSS variables based on the saved `theme_slug`
- dashboard compatibility improved for theme apply, website status, pages, section editing, and domain verification

Other gaps:

- only 2 full folder-based theme packages still exist under `frontend/themes/`; the broader 20-theme coverage currently comes from the registry/loader path rather than 20 fully fleshed-out theme folders
- no `frontend/components/website-builder/` folder as planned
- builder flow exists, but not at the full Craft.js/block/theme ecosystem described in the spec

### Phase 9 — Flutter Apps Foundation
Status: **Partial**

Present:

- all 4 Flutter apps exist
- shared plugin provider exists
- shared socket/offline/auth infrastructure exists
- several core screens exist in each app

Gaps:

- feature coverage is still much smaller than the plan
- many promised per-app feature folders/screens are missing
- most app-specific `test/` directories are missing

### Phase 10 — Premium Plugins + Real-Time + GPS
Status: **Partial**

Present:

- premium plugin manifests exist
- analytics/benchmarking/emergency/GPS-related concepts exist in code
- socket client/shared infra exists

Gaps:

- no `hardware/ESP32_GPS_tracker/firmware.ino`
- no full Firebase GPS pipeline in repo
- premium features are not fully complete end-to-end

### Phase 11 — Celery Background Tasks
Status: **Partial**

Present:

- attendance alerts
- fee reminders
- weekly AI insights
- analytics aggregate
- library overdue
- payroll monthly
- social scheduler
- sitemap rebuild
- streak updater

Gaps:

- several task names differ from plan
- missing as plan-named files:
  - `admission_nurture.py`
  - `gps_tracker.py`
  - `report_generator.py` (repo has `report_generation.py`)

### Phase 12 — Testing & Deployment
Status: **Incomplete**

Present:

- a small backend pytest suite
- 2 frontend Jest tests
- shared Flutter tests only

Missing:

- broad module-by-module backend tests
- multi-tenant isolation tests as declared
- e2e frontend suite
- per-app Flutter tests
- `.github/workflows/` CI/CD files

### Phase 13 — Seed Data, Docs & Polish
Status: **Partial**

Present:

- seed scripts exist
- some documentation exists

Missing:

- several docs named in plan:
  - `docs/api-reference.md`
  - `docs/theme-development.md`
  - `docs/flutter-setup.md`
  - `docs/hardware-gps-setup.md`
- richer builder/theme packaging and theme-development docs
- full launch-ready polish level

## Confirmed High-Value Strengths Already in Repo

These are real and materially advance the project:

- multi-tenant school context resolution in backend app factory
- plugin manifests plus install/uninstall persistence model
- broad plugin API surface already implemented
- many AI service files already present
- public school website route group and live-data-oriented school pages
- shared Flutter plugin provider and offline-oriented shared package
- analytics endpoints added for live dashboard data
- several previously static frontend and Flutter screens already moved toward real backend data

## Biggest Remaining Gaps To Reach the Plan

If the goal is to honestly say “the system matches the plans,” these are the biggest blockers:

1. Complete the missing backend route modules:
   - continue hardening the newly added compatibility modules so they match the full planned behavior, not only the plan filenames

2. Resolve model/API naming drift so plan concepts map 1:1 in code:
   - HR, health, staff, communications, analytics, designer, visitors, payments

3. Finish plugin slug consistency across frontend and Flutter

4. Bring website builder up to spec:
   - deepen the 20-theme system from registry parity into full folder/theme-package parity and richer builder tooling
   - richer theme/block editor surface
   - full publish/domain/SEO workflow parity

5. Deepen web and Flutter role portals:
   - teacher
   - parent
   - student
   - super-admin

6. Wire AI service files into real end-to-end workflows with persisted outputs and UI

7. Add the missing real-time/GPS/hardware surfaces if they remain part of scope

8. Build the missing docs, tests, and CI/CD workflows

## Recommendation

Do **not** treat the current codebase as “fully complete against both plans.”

The right next move is to use this audit as the working checklist and close the remaining work in this order:

1. backend naming/completeness parity
2. frontend plugin slug/path parity
3. website builder parity
4. teacher/parent/student/admin app parity
5. tests + docs + deployment completeness
