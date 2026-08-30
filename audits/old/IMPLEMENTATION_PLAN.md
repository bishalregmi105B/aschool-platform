# ASchool — Multi-Phase Implementation Plan
## Plugin-Based School OS — From Spec to Production

---

## PHASE 0: PROJECT SCAFFOLDING & INFRASTRUCTURE
**Duration: Foundation setup**
**Dependencies: None**
**Deliverables: Empty but runnable project skeleton**

```
Files Created:
├── docker-compose.yml              # Dev: postgres, redis, flask, nextjs, celery
├── docker-compose.prod.yml         # Prod: + nginx, flower, celery-beat
├── Makefile                        # Common commands (make dev, make migrate, etc.)
├── .env.example                    # All env vars documented
├── .gitignore
├── README.md
│
├── backend/
│   ├── requirements.txt            # All Python dependencies
│   ├── wsgi.py                     # Gunicorn entry point
│   ├── config.py                   # Dev/Staging/Prod configs
│   ├── extensions.py               # Flask extension instances
│   └── app/
│       └── __init__.py             # Empty app factory shell
│
├── frontend/
│   ├── package.json                # All npm dependencies
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
└── nginx/
    └── nginx.conf                  # Subdomain routing
```

**Validation: `docker-compose up` starts all services, health check passes**

---

## PHASE 1A: CORE BACKEND FOUNDATION
**Dependencies: Phase 0**
**Deliverables: Flask app factory, extensions, base model, utils**

```
Files:
├── backend/app/__init__.py          # Full app factory with middleware
├── backend/app/extensions.py        # db, migrate, jwt, cors, limiter, cache, socketio, celery
├── backend/app/models/base.py       # BaseModel: UUID PK, created_at, updated_at, is_deleted, school_id
├── backend/app/utils/
│   ├── auth.py                      # JWT helpers, role decorators
│   ├── pagination.py                # Cursor/offset pagination
│   ├── validators.py                # Phone, email, BS date validators
│   ├── nepali_date.py               # BS ↔ AD conversion
│   ├── nepali_numbers.py            # Nepali numeral formatting
│   ├── image_utils.py               # R2 upload, Sharp resize
│   ├── rate_limiter.py              # Custom rate limit configs
│   └── i18n.py                      # Nepali translation helpers
```

**Validation: Flask app starts, `/health` returns 200**

---

## PHASE 1B: PLUGIN SYSTEM CORE
**Dependencies: Phase 1A**
**Deliverables: Complete plugin infrastructure**

```
Files:
├── backend/app/plugins/
│   ├── __init__.py
│   ├── registry.py                  # Plugin manifest registry + discovery
│   ├── loader.py                    # Dynamic blueprint registration
│   ├── decorators.py                # @plugin_required('slug') decorator
│   ├── events.py                    # Inter-plugin event bus (PG NOTIFY)
│   ├── billing.py                   # Plugin billing engine
│   └── manifests/
│       ├── _template.yaml           # Template for new plugins
│       ├── attendance.yaml          # Free: Attendance
│       ├── notices.yaml             # Free: Notices & Circulars
│       ├── academic_setup.yaml      # Free: Academic Setup
│       ├── basic_website.yaml       # Free: School Website (Basic)
│       ├── basic_reports.yaml       # Free: Basic Reports
│       ├── fees.yaml                # Starter: Fee Collection
│       ├── exams.yaml               # Starter: Exams & Results
│       ├── library.yaml             # Starter: Library
│       ├── sms.yaml                 # Starter: SMS Notifications
│       ├── whatsapp.yaml            # Starter: WhatsApp Bot
│       ├── assignments.yaml         # Starter: Assignments
│       ├── elibrary.yaml            # Starter: E-Library
│       ├── conferences.yaml         # Starter: PT Conferences
│       ├── dismissal.yaml           # Starter: Dismissal/Pickup
│       ├── incident_reporting.yaml  # Starter: Incident Reporting
│       ├── gps_tracking.yaml        # Growth: GPS Bus Tracking
│       ├── social_hub.yaml          # Growth: Social Hub
│       ├── social_boost.yaml        # Growth: Ad Boosting
│       ├── admission_crm.yaml       # Growth: Admission CRM
│       ├── website_pro.yaml         # Growth: Website Builder Pro
│       ├── design_studio.yaml       # Growth: Design Studio
│       ├── hr_payroll.yaml          # Growth: HR & Payroll
│       ├── health.yaml              # Growth: Health Records
│       ├── alumni.yaml              # Growth: Alumni Network
│       ├── gamification.yaml        # Growth: Gamification
│       ├── inventory.yaml           # Growth: Inventory & Assets
│       ├── visitors.yaml            # Growth: Visitor Management
│       ├── lms.yaml                 # Growth: LMS
│       ├── wellbeing.yaml           # Growth: Student Wellbeing
│       ├── auto_grading.yaml        # Growth: AI Auto-Grading
│       ├── homework_helper.yaml     # Growth: AI Homework Helper
│       ├── incident_management.yaml # Growth: Full Incident Mgmt
│       ├── emergency_alerts.yaml    # Growth: Emergency Alerts
│       ├── compliance.yaml          # Growth: Government Compliance
│       ├── portfolio.yaml           # Growth: Student Portfolio
│       ├── ai_tools.yaml            # Premium: AI Tools Suite
│       ├── advanced_analytics.yaml  # Premium: Advanced Analytics
│       ├── disaster_management.yaml # Premium: Disaster Management
│       ├── benchmarking.yaml        # Premium: School Benchmarking
│       ├── adaptive_learning.yaml   # Premium: AI Adaptive Learning
│       ├── multi_branch.yaml        # Premium: Multi-Branch Chain
│       ├── biometric.yaml           # Premium: Biometric Integration
│       └── white_label.yaml         # Premium: White-Label Branding
```

**Validation: PluginLoader discovers all manifests, registers blueprints**

---

## PHASE 1C: ALL DATABASE MODELS + MIGRATIONS
**Dependencies: Phase 1A, 1B**
**Deliverables: Complete schema, Alembic initial migration**

```
Models (ordered by dependency):
1. backend/app/models/school.py       # School, SchoolWebsite, SchemeGrade
2. backend/app/models/plugin.py       # Plugin, SchoolPlugin, PluginUsageLog
3. backend/app/models/user.py         # User (all roles)
4. backend/app/models/student.py      # Student, Guardian, StudentHealthRecord
5. backend/app/models/staff.py        # Teacher, Staff, Department, Qualification
6. backend/app/models/academic.py     # Class, Section, Subject, Timetable
7. backend/app/models/attendance.py   # AttendanceRecord, AttendanceSummary
8. backend/app/models/exam.py         # Exam, Marks, ReportCard
9. backend/app/models/assignment.py   # Assignment, Submission, Feedback
10. backend/app/models/fee.py         # FeeStructure, FeeCollection, FeeReceipt
11. backend/app/models/library.py     # Book, BookCheckout, BookReservation
12. backend/app/models/transport.py   # Bus, Route, BusStop, GPSLog
13. backend/app/models/communication.py # Notice, Circular, SMS_Log
14. backend/app/models/social.py      # SocialAccount, SocialPost, SocialMessage
15. backend/app/models/ad_campaign.py # BoostCampaign, AdMetrics
16. backend/app/models/admission.py   # AdmissionLead, AdmissionApplication
17. backend/app/models/visitor.py     # Visitor, VisitorLog
18. backend/app/models/health.py      # StudentHealth, MedicalRecord
19. backend/app/models/alumni.py      # Alumni, AlumniPost
20. backend/app/models/gamification.py    # Badge, StudentBadge, Points
21. backend/app/models/analytics.py       # DailyMetric, WeeklyInsight
22. backend/app/models/designer.py        # DesignTemplate, DesignProject
23. backend/app/models/inventory.py       # Asset, AssetCheckout
24. backend/app/models/hr.py              # Payroll, Leave, Appraisal
25. backend/app/models/lms.py             # Course, Lesson, LiveClass
26. backend/app/models/wellbeing.py       # MoodCheckin, CounselorSession
27. backend/app/models/dismissal.py       # DismissalRecord, AuthorizedPickup
28. backend/app/models/compliance.py      # ComplianceReport, EMISExport
29. backend/app/models/emergency.py       # EmergencyAlert, EvacuationPlan
30. backend/app/models/digital_content.py # DigitalBook, PastPaper
31. backend/app/models/conference.py      # PTConference, TimeSlot
32. backend/app/models/portfolio.py       # StudentPortfolio, Achievement
33. backend/app/models/incident.py        # Incident, WitnessStatement

Alembic:
├── backend/migrations/alembic.ini
├── backend/migrations/env.py
└── backend/migrations/versions/001_initial.py
```

**Validation: `flask db upgrade` creates all tables, no errors**

---

## PHASE 2A: AUTHENTICATION & CORE API ROUTES
**Dependencies: Phase 1C**
**Deliverables: Working auth system with JWT + OTP**

```
Files:
├── backend/app/api/v1/__init__.py    # API v1 blueprint registration
├── backend/app/api/v1/auth.py        # Login, register, OTP, refresh, logout
├── backend/app/api/v1/schools.py     # School CRUD, settings, branding
├── backend/app/api/v1/super_admin.py # Platform owner: all schools + metrics
├── backend/app/api/v1/students.py    # Student CRUD, bulk import, transfers
├── backend/app/api/v1/staff.py       # Teacher/staff management
├── backend/app/api/v1/academics.py   # Class, section, subject, timetable CRUD
├── backend/app/api/v1/mobile.py      # Flutter-optimized endpoints
├── backend/app/api/v1/sse.py         # Server-sent events
├── backend/app/api/v1/webhooks.py    # Webhook registration
│
├── backend/app/services/
│   └── communications/
│       ├── sms.py                    # Sparrow SMS wrapper
│       └── email_service.py          # Email templates + sending
│
└── backend/app/services/notification_engine.py  # Unified notification dispatch
```

**Validation: Register school → login → get JWT → access dashboard API → refresh token**

---

## PHASE 2B: PLUGIN MARKETPLACE API
**Dependencies: Phase 2A**
**Deliverables: Browse, install, uninstall, configure plugins via API**

```
Files:
├── backend/app/api/v1/plugins.py     # Full marketplace API
│   - GET  /plugins/marketplace       # Browse all plugins (grouped by category)
│   - POST /plugins/install           # Install a plugin
│   - POST /plugins/uninstall         # Uninstall (soft-disable)
│   - GET  /plugins/installed         # This school's installed plugins
│   - PUT  /plugins/{slug}/config     # Plugin-specific settings
│   - GET  /plugins/{slug}/billing    # Plugin billing details
│   - POST /plugins/{slug}/trial      # Start 14-day trial
│
└── backend/app/plugins/billing.py    # Prorated billing, usage tracking
```

**Validation: Install plugin → access plugin route (200) → uninstall → access (403)**

---

## PHASE 3: FREE PLUGIN BACKENDS (Core Features)
**Dependencies: Phase 2B**
**Deliverables: 5 free plugins fully functional**

```
1. Attendance Plugin:
   ├── backend/app/api/v1/attendance.py     # Mark, view, reports
   └── (uses models/attendance.py from Phase 1C)

2. Notices & Circulars Plugin:
   ├── backend/app/api/v1/communications.py # CRUD notices, circulars, broadcast
   └── (uses models/communication.py)

3. Academic Setup Plugin:
   └── (already in Phase 2A: academics.py)

4. Basic Website Plugin:
   ├── backend/app/api/v1/website.py        # School website config API
   └── backend/app/api/v1/themes.py         # Theme management

5. Basic Reports Plugin:
   └── backend/app/api/v1/analytics.py      # Attendance reports, student count
```

**Validation: Each plugin route returns 403 if not installed, 200 if installed**

---

## PHASE 4: FRONTEND FOUNDATION (Next.js)
**Dependencies: Phase 2B (API must be ready)**
**Deliverables: Working Next.js app with auth, plugin-aware shell**

```
Files:
├── frontend/middleware.ts              # Subdomain routing + JWT check
├── frontend/app/layout.tsx             # Root layout
├── frontend/app/page.tsx               # ASchool marketing homepage
│
├── frontend/app/(auth)/
│   ├── login/page.tsx                  # Login with phone + OTP or password
│   ├── register/page.tsx               # School registration
│   └── verify-otp/page.tsx
│
├── frontend/lib/
│   ├── api.ts                          # Axios client with JWT interceptor
│   ├── auth.ts                         # Auth context + hooks
│   ├── store.ts                        # Zustand global state
│   ├── socket.ts                       # Socket.IO client
│   ├── nepali-utils.ts                # BS dates, NPR format
│   ├── plugins.ts                     # ★ useInstalledPlugins() hook
│   └── plugin-gate.ts                 # ★ PluginGate component
│
├── frontend/components/
│   ├── ui/                            # shadcn/ui components
│   ├── dashboard/
│   │   ├── Sidebar.tsx                # ★ Plugin-aware dynamic sidebar
│   │   ├── TopNav.tsx
│   │   ├── CommandCenter.tsx          # Principal dashboard widgets
│   │   └── PluginGate.tsx             # ★ Conditional render wrapper
│   └── marketplace/
│       ├── PluginCard.tsx
│       ├── PluginDetail.tsx
│       ├── InstallButton.tsx
│       ├── CategoryFilter.tsx
│       └── InstalledPlugins.tsx
│
├── frontend/app/(dashboard)/
│   ├── layout.tsx                     # Dashboard shell with Sidebar
│   └── page.tsx                       # Command center overview
│
├── frontend/app/(marketplace)/
│   ├── layout.tsx
│   ├── page.tsx                       # Browse all plugins
│   ├── [slug]/page.tsx                # Plugin detail page
│   └── installed/page.tsx             # My installed plugins
│
└── frontend/app/(super-admin)/
    ├── layout.tsx
    ├── page.tsx                       # All schools overview
    ├── schools/page.tsx
    └── revenue/page.tsx
```

**Validation: Login → see dashboard → browse marketplace → install plugin → sidebar updates**

---

## PHASE 5: FRONTEND DASHBOARD PAGES
**Dependencies: Phase 3 (free plugin APIs), Phase 4 (frontend shell)**
**Deliverables: All dashboard pages for free plugins + core management**

```
Pages (all wrapped in PluginGate):
├── (dashboard)/students/              # Student directory, profile, bulk import
├── (dashboard)/staff/                 # Staff management
├── (dashboard)/attendance/            # Live dashboard, mark, reports
├── (dashboard)/academics/             # Timetable, subjects, classes
├── (dashboard)/communications/        # Notices, broadcast
├── (dashboard)/settings/              # General, branding, payments, plugins
│
├── (teacher)/                         # Teacher portal
│   ├── page.tsx, attendance/, marks/, timetable/
│
├── (parent)/                          # Parent portal
│   ├── page.tsx, attendance/, notices/
│
└── (student)/                         # Student portal
    ├── page.tsx, timetable/
```

**Validation: All role dashboards render with correct data from API**

---

## PHASE 6: STARTER PLUGIN BACKENDS
**Dependencies: Phase 3**
**Deliverables: 10 starter plugins fully functional**

```
1. Fee Collection:       backend/app/api/v1/fees.py (POS, eSewa, Khalti, receipts)
2. Exams & Results:      backend/app/api/v1/exams.py (schedule, marks, report cards)
3. Library:              backend/app/api/v1/library.py (catalog, checkout, ISBN)
4. SMS Notifications:    backend/app/services/communications/sms.py
5. WhatsApp Bot:         backend/app/api/v1/whatsapp_bot.py + webhooks
6. Assignments:          backend/app/api/v1/assignments.py
7. E-Library:            backend/app/api/v1/elibrary.py
8. PT Conferences:       backend/app/api/v1/conferences.py
9. Dismissal/Pickup:     backend/app/api/v1/dismissal.py
10. Incident Reporting:  backend/app/api/v1/incidents.py

Payment Services:
├── backend/app/services/payments/esewa.py
├── backend/app/services/payments/khalti.py
└── backend/app/services/payments/fonepay.py

WhatsApp:
├── backend/app/services/communications/whatsapp.py
├── backend/app/services/communications/whatsapp_bot.py
└── backend/app/api/webhooks/whatsapp.py
```

**Validation: Each plugin installable, full CRUD working, payment flows tested**

---

## PHASE 7: GROWTH PLUGIN BACKENDS + AI SERVICES
**Dependencies: Phase 6**
**Deliverables: 20 growth plugins + all AI services**

```
Growth Plugins:
├── GPS Bus Tracking:    transport.py + gps_service.py
├── Social Hub:          social_hub.py + meta_api.py + tiktok_api.py
├── Social Boost:        social_boost.py + meta_ads.py
├── Admission CRM:       admission.py + admission_bot.py
├── Website Builder Pro: website.py (extended) + website_designer.py
├── Design Studio:       designer.py + canvas_engine.py + bulk_generator.py
├── HR & Payroll:        hr.py
├── Health Records:      health.py
├── Alumni Network:      alumni.py
├── Gamification:        gamification.py
├── Inventory:           inventory.py
├── Visitor Management:  visitors.py
├── LMS:                 lms.py + video_service.py + content_engine.py
├── Wellbeing:           wellbeing.py + wellbeing_ai.py
├── AI Auto-Grading:     auto_grader.py
├── AI Homework Helper:  homework_helper.py
├── Full Incidents:      incidents.py (extended)
├── Emergency Alerts:    emergency.py + alert_service.py
├── Compliance:          compliance.py + moe_reports.py
└── Portfolio:           portfolio.py

AI Services (all under backend/app/services/ai/):
├── question_paper.py      # AI exam generator
├── report_remarks.py      # Auto report card comments
├── lesson_plan.py         # AI lesson plan generator
├── timetable_gen.py       # Clash-free timetable
├── risk_detector.py       # At-risk student detection
├── attendance_ai.py       # Attendance pattern analysis
├── fee_predictor.py       # Payment default prediction
├── school_insights.py     # Weekly AI intelligence report
├── admission_bot.py       # Admission inquiry AI
├── social_ai.py           # AI social reply generator
├── content_gen.py         # School content generator
├── website_designer.py    # AI website builder
├── translator.py          # Nepali ↔ English
├── sentiment.py           # Comment sentiment analysis
├── plagiarism.py          # Assignment plagiarism
├── adaptive_learning.py   # Personalized learning paths
├── wellbeing_ai.py        # Student wellbeing analyzer
├── auto_grader.py         # Homework auto-grading
├── homework_helper.py     # Student AI tutor chatbot
└── benchmarking_ai.py     # School benchmarking
```

**Validation: Each plugin installs, AI features return structured responses**

---

## PHASE 8: SCHOOL WEBSITE BUILDER
**Dependencies: Phase 4 (frontend), Phase 7 (website_designer AI)**
**Deliverables: Complete website builder with 20 themes**

```
Files:
├── frontend/themes/
│   ├── registry.ts
│   └── (20 theme folders with styles + layouts)
│
├── frontend/components/website-builder/
│   ├── ThemeCard.tsx
│   ├── BlockEditor.tsx             # Craft.js canvas
│   ├── BlockPanel.tsx              # School-specific blocks
│   ├── StylePanel.tsx
│   ├── AIWebsitePrompt.tsx
│   └── DevicePreview.tsx
│
├── frontend/app/(dashboard)/website-builder/
│   ├── page.tsx
│   ├── themes/page.tsx
│   ├── editor/page.tsx             # Craft.js editor
│   ├── ai-builder/page.tsx         # AI prompt → website
│   ├── pages/page.tsx
│   ├── domain/page.tsx
│   └── seo/page.tsx
│
├── frontend/app/school/[slug]/     # Public SSR pages
│   ├── layout.tsx
│   ├── page.tsx                    # Homepage
│   ├── about/page.tsx
│   ├── academics/page.tsx
│   ├── teachers/page.tsx
│   ├── events/page.tsx
│   ├── gallery/page.tsx
│   ├── results/page.tsx            # Public result checker
│   ├── admission/page.tsx          # Live admission form
│   └── contact/page.tsx
│
└── frontend/components/school/     # Public website components
    ├── SchoolHeader.tsx
    ├── HeroSection.tsx
    ├── ResultChecker.tsx
    ├── AdmissionForm.tsx
    └── GalleryGrid.tsx
```

**Validation: Create school → pick theme → AI generates → edit in Craft.js → publish → visit subdomain**

---

## PHASE 9: FLUTTER APPS FOUNDATION
**Dependencies: Phase 6 (starter APIs), Phase 2B (plugin API)**
**Deliverables: 4 Flutter apps with plugin system + core features**

```
Shared Core (all apps share):
├── shared/services/plugin_provider.dart   # Riverpod plugin state
├── shared/widgets/plugin_gate.dart        # Conditional render
├── shared/models/plugin_manifest.dart     # Freezed model
├── shared/services/offline_sync.dart      # Isar sync
├── shared/services/socket_service.dart    # Socket.IO
├── shared/services/notification.dart      # FCM

Per App:
flutter_admin/   → Principal dashboard, student/staff mgmt, fees POS, analytics
flutter_teacher/  → Attendance marking, marks entry, assignments, AI tools
flutter_parent/   → Child tracker, fees payment, bus GPS, notices, messaging
flutter_student/  → Timetable, assignments, results, library, achievements

Each app:
├── main.dart                # App entry with Riverpod + GoRouter
├── features/                # Feature modules (wrapped in PluginGate)
│   └── {feature}/
│       ├── screens/
│       ├── providers/
│       └── widgets/
└── shared/                  # App-specific shared code
```

**Validation: Login → fetch plugins → see only installed features → offline mode works**

---

## PHASE 10: PREMIUM PLUGINS + REAL-TIME + GPS
**Dependencies: Phase 7, Phase 9**
**Deliverables: Premium features, Socket.IO events, GPS system**

```
Premium Plugins:
├── AI Tools Suite          # Unified AI hub
├── Advanced Analytics      # AI weekly insights
├── Disaster Management     # Earthquake API, evacuation
├── School Benchmarking     # Anonymous comparison
├── AI Adaptive Learning    # Personalized paths
├── Multi-Branch Chain      # Cross-school dashboard
├── Biometric Integration   # ZKTeco sync
└── White-Label Branding    # Custom domain app

Real-Time:
├── Socket.IO event catalog (attendance, fees, leads, bus, risk alerts)
└── SSE fallback for school websites

GPS SafeRide:
├── hardware/ESP32_GPS_tracker/firmware.ino
├── Firebase Realtime DB integration
└── Flutter bus tracking screen (flutter_map + OpenStreetMap)
```

**Validation: Real-time events flow from action → Socket.IO → dashboard/app update**

---

## PHASE 11: CELERY BACKGROUND TASKS
**Dependencies: Phase 6, Phase 7**
**Deliverables: All automated background jobs**

```
Tasks:
├── attendance_alerts.py     # Daily absent parent notification
├── fee_reminders.py         # 3-touch fee reminder sequence
├── report_generator.py      # Bulk report card generation
├── social_scheduler.py      # Scheduled social posts
├── ai_insights_weekly.py    # Sunday night AI analysis
├── gps_tracker.py           # Bus tracking + route deviation
├── admission_nurture.py     # Lead follow-up sequences
├── library_overdue.py       # Overdue book notifications
├── payroll_monthly.py       # Monthly payroll processing
├── sitemap_rebuild.py       # School website sitemaps
├── analytics_aggregate.py   # Daily metric rollup
└── streak_updater.py        # Gamification streaks
```

**Validation: Celery Beat schedules fire, workers process correctly**

---

## PHASE 12: TESTING & DEPLOYMENT
**Dependencies: All previous phases**
**Deliverables: Test suite, CI/CD, production deployment**

```
Tests:
├── backend/tests/
│   ├── test_auth.py
│   ├── test_plugins.py           # Install/uninstall/billing/access
│   ├── test_attendance.py
│   ├── test_fees.py
│   ├── test_school_isolation.py  # Multi-tenancy security
│   └── ... (one per module)
│
├── frontend/ (Jest + Playwright)
│   ├── __tests__/
│   └── e2e/
│
├── flutter_*/test/                # Flutter widget + integration tests

CI/CD:
├── .github/workflows/
│   ├── backend-test.yml
│   ├── frontend-test.yml
│   ├── deploy.yml
│   └── flutter-build.yml

Production:
├── docker-compose.prod.yml (final)
├── nginx/nginx.conf (SSL, caching, rate limits)
└── Deployment scripts
```

---

## PHASE 13: SEED DATA, DOCS & POLISH
**Dependencies: Phase 12**
**Deliverables: Ready for launch**

```
Seed Data:
├── All 35+ Plugin records in plugins table
├── Demo school with sample data
├── 20 theme configurations
├── Template designs for Design Studio
├── Nepal district/municipality data

Documentation:
├── docs/api-reference.md
├── docs/plugin-development.md
├── docs/theme-development.md
├── docs/flutter-setup.md
├── docs/deployment.md
└── docs/hardware-gps-setup.md
```

---

## IMPLEMENTATION PRIORITY ORDER

```
WEEK 1-2:  Phase 0 + Phase 1A + Phase 1B + Phase 1C
           → Runnable backend with DB and plugin system

WEEK 3-4:  Phase 2A + Phase 2B
           → Auth working, plugin marketplace API live

WEEK 5-6:  Phase 3 + Phase 4
           → Free plugins + frontend shell with plugin UI

WEEK 7-8:  Phase 5 + Phase 6
           → Complete dashboards + starter plugins

WEEK 9-12: Phase 7 + Phase 8
           → Growth plugins + AI + website builder

WEEK 13-16: Phase 9 + Phase 10
            → Flutter apps + premium features

WEEK 17-18: Phase 11 + Phase 12 + Phase 13
            → Background jobs + tests + deployment + polish
```

---

*Start with Phase 0 → build upward*
