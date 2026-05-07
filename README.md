# ASchool — Plugin-Based School Operating System for Nepal

ASchool is a **multi-tenant SaaS platform** that transforms school management through a modular plugin architecture. Built specifically for Nepal's education ecosystem, it supports 43 plugins across 4 tiers — from free core features to premium AI-powered tools.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Nginx (Reverse Proxy)                    │
│   api.aschool.com.np → Flask    app.aschool.com.np → Next.js    │
│   {slug}.aschool.com.np → School Websites (SSR)                 │
└────────────┬──────────────────────────┬──────────────────────────┘
             │                          │
     ┌───────▼───────┐         ┌───────▼───────┐
     │  Flask API     │         │  Next.js 14   │
     │  (Python 3.12) │         │  (App Router) │
     │  + Socket.IO   │         │  + TypeScript  │
     └───────┬───────┘         └───────────────┘
             │
    ┌────────┼────────────┬──────────────┐
    │        │            │              │
┌───▼──┐ ┌──▼───┐ ┌─────▼─────┐ ┌─────▼─────┐
│Pg 16 │ │Redis │ │ Celery    │ │ Firebase  │
│pgvec │ │  7   │ │ Workers   │ │ RTDB (GPS)│
└──────┘ └──────┘ └───────────┘ └───────────┘

Flutter Apps (4):
  Admin → Teacher → Parent → Student
  All share `aschool_shared` package
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Flask 3.x, SQLAlchemy 2.0, Celery 5.4, Socket.IO |
| **Database** | PostgreSQL 16 (pgvector), Redis 7 |
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind, Radix UI |
| **Mobile** | Flutter 3.x (4 apps), Riverpod, GoRouter, Dio |
| **AI** | Anthropic Claude (haiku fast / sonnet quality) |
| **Payments** | eSewa, Khalti, Fonepay |
| **SMS** | Sparrow SMS (Nepal) |
| **GPS Tracking** | ESP32 + NEO-6M + SIM800L → Firebase RTDB |
| **Infrastructure** | Docker, Nginx, GitHub Actions CI/CD |

## Plugin System (43 Plugins)

Plugins are defined as YAML manifests and discovered at startup. Each plugin can have backend routes, frontend pages, and Flutter screens.

| Tier | Count | Price Range (NPR/mo) | Examples |
|------|-------|----------------------|----------|
| **Core (Free)** | 5 | Rs. 0 | Attendance, Gradebook, Notice Board, Calendar, Profile |
| **Starter** | 10 | Rs. 199–399 | Library, Transport, Hostel, Inventory, Timetable |
| **Growth** | 20 | Rs. 199–799 | LMS, Exam Manager, Fee Management, WhatsApp, AI Tutor |
| **Premium** | 8 | Rs. 999–2,999 | Biometric, AI Adaptive Learning, Disaster Mgmt, Social Ads |

## Project Structure

```
ASchool/
├── backend/                    # Flask API server
│   ├── app/
│   │   ├── models/             # SQLAlchemy models (30+)
│   │   ├── routes/             # API routes (13+ files)
│   │   ├── services/           # Business logic (AI, payments, comms)
│   │   ├── plugins/
│   │   │   ├── manifests/      # 29 YAML plugin definitions
│   │   │   └── loader.py       # Plugin discovery & registration
│   │   └── utils/              # Validators, decorators, helpers
│   ├── tests/                  # pytest test suite (7 files)
│   ├── migrations/             # Alembic migrations
│   ├── seed.py                 # Basic seed script
│   └── seed_full.py            # Full 43-plugin seed with demo data
│
├── frontend/                   # Next.js web dashboard
│   ├── app/                    # App Router pages
│   │   ├── dashboard/          # Admin dashboard
│   │   └── [slug]/             # School website SSR
│   ├── components/             # UI components (Radix-based)
│   ├── lib/                    # API client, auth, store
│   └── __tests__/              # Jest + RTL tests
│
├── flutter_shared/             # Shared Flutter package
│   ├── lib/
│   │   ├── models/             # User, School, PluginManifest, InstalledPlugin
│   │   ├── services/           # API, Auth, Plugins, Socket, Offline sync
│   │   ├── widgets/            # PluginGate, LoadingShimmer, NepaliDate
│   │   ├── theme/              # App theme
│   │   └── utils/              # NepaliFormatter, Constants
│   └── test/                   # Flutter unit & widget tests
│
├── flutter_admin/              # Admin app (15 screens)
├── flutter_teacher/            # Teacher app (13 screens)
├── flutter_parent/             # Parent app (13 screens)
├── flutter_student/            # Student app (17 screens)
│
├── hardware/                   # ESP32 GPS tracker
│   └── ESP32_GPS_tracker/      # Arduino firmware + wiring
│
├── nginx/                      # Nginx config (subdomain routing)
├── .github/workflows/          # CI/CD pipeline
├── docker-compose.yml          # Development
├── docker-compose.prod.yml     # Production
└── Makefile                    # Common commands
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.12+
- Node.js 20+
- Flutter 3.16+

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/aschool.git
cd aschool
cp .env.example .env
# Edit .env with your credentials
```

### 2. Start Development Services

```bash
make dev          # Docker: Postgres, Redis, Flask, Next.js, Celery
```

Or start individually:

```bash
make backend      # Flask API on :5000
make frontend     # Next.js on :3000
make worker       # Celery workers
```

### 3. Initialize Database

```bash
make upgrade                  # Run migrations
make seed                     # Basic plugin seed
# OR
cd backend && python seed_full.py  # Full 43-plugin seed with demo school
```

### 4. Run Flutter Apps

```bash
cd flutter_admin && flutter run
cd flutter_teacher && flutter run
cd flutter_parent && flutter run
cd flutter_student && flutter run
```

## Testing

### Backend (pytest)

```bash
make test                     # Run all backend tests
make test-cov                 # With coverage report
cd backend && python -m pytest tests/test_auth.py -v  # Specific file
```

Test files:
- `test_auth.py` — OTP, login, JWT, profile
- `test_plugins.py` — Install, uninstall, marketplace, access control
- `test_models.py` — UUID, soft delete, school isolation
- `test_api.py` — Health, errors, response format, roles
- `test_validators.py` — Nepal phone, email, PAN, BS date
- `test_plugin_manifests.py` — YAML validation, dependencies, routes

### Frontend (Jest)

```bash
make test-frontend            # Run all frontend tests
cd frontend && npm test       # Same
```

### Flutter

```bash
make test-flutter             # Shared package tests
cd flutter_shared && flutter test
```

### All Tests

```bash
make test-all                 # Backend + Frontend + Flutter
```

## API Overview

Base URL: `http://api.aschool.com.np/api/v1`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/auth/send-otp` | POST | Send phone OTP via Sparrow SMS |
| `/auth/verify-otp` | POST | Verify OTP & get tokens |
| `/auth/login` | POST | Email/password login |
| `/auth/me` | GET | Current user profile |
| `/plugins/marketplace` | GET | List available plugins |
| `/plugins/install` | POST | Install plugin for school |
| `/plugins/installed` | GET | List school's installed plugins |
| `/students/` | GET/POST | Student CRUD |
| `/teachers/` | GET/POST | Teacher CRUD |
| `/fees/` | GET/POST | Fee management |
| `/attendance/` | GET/POST | Attendance tracking |

All responses follow:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { "page": 1, "total": 50 }
}
```

## Multi-Tenancy

Every school gets:
- **Subdomain**: `{slug}.aschool.com.np` — public website (SSR)
- **Dashboard**: `app.aschool.com.np` — admin/teacher/staff portal
- **Mobile apps**: School-specific via login
- **Data isolation**: All queries scoped by `school_id` via `BaseModel.for_school()`

## Nepal-Specific Features

- **Bikram Sambat calendar** with Nepali date converter
- **NPR currency** with Indian numbering (1,00,000)
- **Nepal phone validation** (+977 98/97 prefixes)
- **Sparrow SMS** for OTP and notifications
- **eSewa, Khalti, Fonepay** payment gateways
- **PAN number validation** for billing
- **WhatsApp integration** for parent communication
- **Bus GPS tracking** via ESP32 (NTC/Ncell SIM)

## Environment Variables

See [.env.example](.env.example) for all configuration options:

- App & JWT configuration
- PostgreSQL & Redis connections
- Anthropic/Claude AI API keys
- Sparrow SMS, WhatsApp, Email credentials
- eSewa, Khalti, Fonepay payment keys
- Cloudflare R2 storage
- Firebase (GPS tracking)

## License

Proprietary — All rights reserved.
