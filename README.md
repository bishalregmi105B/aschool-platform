# ASchool — Plugin-Based School Operating System for Nepal

ASchool is a **multi-tenant SaaS platform** for Nepali schools built on a
modular plugin architecture: a Flask API, a Next.js dashboard with per-school
SSR websites, and five Flutter apps sharing one `aschool_shared` package.

> **Status (2026-08):** deep and substantially functional — 560 unique API
> rules, 146 models, real eSewa/Khalti/FonePay gateways with refunds +
> idempotency, TOTP MFA, ClamAV upload scanning, automated DB backups,
> BS-calendar/NEB-grading core. Not yet launched: production deploy config
> exists but needs an operator (see `docs/deployment.md`), GPS hardware loop
> is wired end-to-end in code but unproven against live devices, web role
> portals are honest "Coming soon" stubs pending build-out. Track:
> `FIX_TRACKER.md` · Audit: `docs/AUDIT_REPORT_2026-08-22.md`.

## Architecture

```
                    Nginx (reverse proxy)
   aschool.com.np → Next.js      api.aschool.com.np → Flask
   {slug}.aschool.com.np → School websites (SSR)
                     │
   ┌─────────┬───────┴──┬─────────────┐
   Pg16+pgvector  Redis 7   Celery workers/beat   Firebase RTDB (GPS)

Flutter Apps (5), all sharing `aschool_shared`:
   admin · teacher · parent · student · user (unified entry)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Flask 3.x, SQLAlchemy 2.0, Celery 5 beat, Socket.IO |
| **Database** | PostgreSQL 16 (pgvector), Redis 7 |
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind, Radix UI, Leaflet live map |
| **Mobile** | Flutter 3.x (5 apps), Riverpod, GoRouter, Dio |
| **AI** | Groq primary / Anthropic fallback via `AITokenHub` quota gateway |
| **Payments** | eSewa (ePay v2 HMAC), Khalti v2 (+refund), FonePay (HMAC-SHA512) — idempotent |
| **SMS/OTP** | Sparrow SMS; console-mode for dev; prod boot refuses unconfigured SMS |
| **GPS Tracking** | ESP32 + NEO-6M + SIM800L → Firebase RTDB → poller → Socket.IO live map |
| **Security** | JWT + HttpOnly cookie sessions w/ rotation revocation, TOTP MFA, login lockout, CSRF origin guard, bleach/DOMPurify sanitization, ClamAV scans, strict API CSP |

## Project Structure

```
ASchool/
├── backend/                    Flask API server
│   ├── app/api/v1/             60 route modules (~560 unique rules at /api/v1)
│   ├── app/models/             146 SQLAlchemy model classes (53 files)
│   ├── app/services/           AI hub, payments, comms, designer, social
│   ├── app/plugins/            manifest-driven plugin system (modules/ + legacy manifests/)
│   ├── app/tasks/              20 Celery modules, 14 beat schedules
│   └── tests/                  pytest suite (750+ tests, live-Postgres backed)
├── frontend/                   Next.js 14 dashboard (215 pages) + school-site SSR/ISR
├── aschool_shared/             shared Flutter package (models, repositories,
│                               services incl. queued token-refresh, widgets, theme)
├── flutter_admin/              Admin app (42 routes)
├── flutter_teacher/            Teacher app (28 routes)
├── flutter_parent/             Parent app (23 routes)
├── flutter_student/            Student app (30 routes)
├── flutter_user/               Unified entry app (onboarding → school lookup → role app)
├── hardware/ESP32_GPS_tracker/ Arduino firmware + wiring docs
├── nginx/                      site config (4 server blocks)
├── docs/                       deployment guide, audit reports
├── docker-compose.yml          development stack
├── docker-compose.prod.yml     production stack (nginx + flower included)
└── Makefile                    common commands
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.12+ (a local `.venv` works too)
- Node.js 20+
- Flutter 3.16+

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/aschool.git
cd aschool
cp .env.example .env   # edit credentials
```

### 2. Start Development Services

```bash
make dev          # Docker: Postgres, Redis, Flask, Next.js, Celery
# or individually:
make backend      # Flask API on :5001 (proxied dev port mapping)
make frontend     # Next.js on :3001
make worker       # Celery worker
make beat         # Celery beat
```

### 3. Initialize Database

```bash
make upgrade      # Alembic migrations
make seed         # seed.py: superadmin, demo school, plugin registry
# or the full marketplace demo data:
cd backend && python seed_full.py
```

### 4. Run Flutter Apps

```bash
cd flutter_admin && flutter run    # same pattern for the other four
```

## Testing

| Suite | Command | Notes |
|---|---|---|
| Backend | `make test` (pytest) | requires live Postgres (`aschool_test`); conftest resets schema per test |
| Backend w/ coverage | `make test-cov` | |
| Frontend | `make test-frontend` | jest + RTL; includes security-regression suite |
| Flutter (shared) | `make test-flutter` | unit + widget tests |
| Everything | `make test-all` | backend + frontend + flutter |

CI (`.github/workflows/deploy.yml`) runs all three suites on every push,
builds ghcr images on main, and deploys via SSH.

## API Overview

Base URL: `/api/v1` (behind nginx: `https://api.aschool.com.np/api/v1`).

Representative endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health`, `/ready` | GET | liveness / DB+Redis readiness |
| `/auth/send-otp` · `/verify-otp` | POST | phone OTP (Sparrow SMS) |
| `/auth/login` · `/student-login` · `/refresh` | POST | password + token flows (Bearer or HttpOnly cookies) |
| `/auth/me` | GET/PUT | profile |
| `/plugins/marketplace` · `/install` · `/<slug>/trial` · `/<slug>/subscribe` | GET/POST | marketplace lifecycle |
| `/students/` | GET/POST | student CRUD |
| `/fees/collections/<id>/pay` | POST | payment recording (idempotency-key supported) |
| `/exams/online` | POST | online exam authoring |
| `/design-studio/bulk/*` | POST | bulk ID cards / marksheets / admit cards / certificates |
| `/transport/gps-logs` | GET | latest bus fixes (live map also uses Socket.IO `gps_update`) |
| `/webhooks/esewa|khalti|fonepay|whatsapp|stripe` | POST | payment & messaging callbacks |

All responses follow:

```json
{ "success": true, "data": {}, "error": null, "meta": {} }
```

## Multi-Tenancy

Every request resolves its tenant (subdomain slug → `X-School-Slug` header →
JWT claim) into `g.school_id`; queries go through `BaseModel.for_school()`.
Schools get `{slug}.aschool.com.np` SSR websites, the shared dashboard at
`app.aschool.com.np`, and mobile access via login. Cross-tenant probes return
403 (covered by regression tests).

## Nepal-Specific Features

- **Bikram Sambat calendar** everywhere dates matter (`nepali-datetime`)
- **NEB grading**: theory/practical split, component-fail rules, GPA tables
- **NPR formatting** with Indian numbering + Devanagari numerals
- **eSewa / Khalti / Fonepay** payments with refunds + idempotency;
  IRD PAN/VAT fields on fee receipts (opt-in VAT %)
- **Sparrow SMS** OTP + notifications; WhatsApp Cloud (optional)
- **IEMIS import/export**, EMIS fields incl. caste/mother-tongue/disability
- **Bus GPS tracking** from Rs ~2,500/bus ESP32 hardware to live web map

## Environment Variables

See [.env.example](.env.example) — every key the code references is listed
there, including AI quotas, payment gateways, Firebase/GPS, ClamAV, backups,
and cookie-session domain settings.

## License

Proprietary — All rights reserved.
