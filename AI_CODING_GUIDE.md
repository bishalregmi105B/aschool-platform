# 🤖 ASCHOOL — AI CODE EDITOR & ASSISTANT INSTRUCTION GUIDE
**Repository:** ASchool Multi-Tenant School OS (Nepal)  
**Standardized For:** Antigravity, Cursor, Windsurf, Claude Code, GitHub Copilot, Roo/Aider  
**Last Updated:** August 27, 2026  

---

## 📌 1. MANDATORY DIRECTIVE FOR ALL AI AGENTS & EDITORS

> ⚠️ **CRITICAL RULE:**  
> Before modifying any backend endpoints, frontend pages, database models, or plugin manifests:  
> 1. **You MUST read the latest audit reports in `audits/`** (specifically [`audits/PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md`](audits/PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md) and [`audits/AUDIT_INDEX.md`](audits/AUDIT_INDEX.md)).
> 2. **After making any significant modifications or fixes**, you MUST update the **Changelog & Audit Log** in [`audits/AUDIT_INDEX.md`](audits/AUDIT_INDEX.md) detailing what changed, the rationale, and all affected components.

---

## 🏛️ 2. SYSTEM ARCHITECTURE & REPOSITORY STRUCTURE

```
ASchool/
├── frontend/                     # Next.js 14 App Router + Tailwind CSS + TanStack Query
│   ├── app/                      # Route segments: (auth)/, dashboard/, school/[slug]/, page.tsx
│   ├── components/               # UI components, layouts, sidebar, header, website builder
│   ├── lib/                      # api.ts (Axios), auth-context.tsx, plugins.tsx, plugin-gate.tsx
│   └── globals.css               # Forest Green theme tokens (--ocean: #0e3b2e, --mint: #c5f4dd)
│
├── backend/                      # Python Flask 3.0 API + SQLAlchemy + Celery
│   ├── app/
│   │   ├── api/v1/               # Modular REST Blueprints (auth, students, fees, exams, plugins, etc.)
│   │   ├── models/               # SQLAlchemy DB Models (School, User, Student, Plugin, SchoolPlugin, etc.)
│   │   ├── plugins/              # 57 Plugin Manifests (.yaml), Loader, Registry, Events, Billing
│   │   ├── services/             # Domain services (auth, payments, ai, communications, exports)
│   │   └── utils/                # Decorators (@plugin_required, @role_required, @school_required)
│   └── config.py                 # Multi-tenant config, JWT, Redis, Celery, ClamAV
│
├── audits/                       # Centralized Audit Reports & Verification History
│   ├── AUDIT_INDEX.md            # Live Index of all system audits and edit logs
│   ├── PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md # Current primary audit
│   └── old/                      # Archived historical audit reports and simulations
│
├── flutter_admin/                # Mobile Flutter App for School Administrators
├── flutter_teacher/              # Mobile Flutter App for Teachers
├── flutter_parent/               # Mobile Flutter App for Parents
├── flutter_student/              # Mobile Flutter App for Students
├── aschool_shared/               # Shared Dart API models, theme, state & utilities
└── docker-compose.yml            # Docker orchestration (Next.js, Flask, Postgres 16, Redis, Celery)
```

---

## 🎨 3. DESIGN SYSTEM & COLOR PALETTE SPECIFICATION

The application uses an **Evergreen Forest & Mint Nepal Theme**:
- **Primary / Ocean:** `#0e3b2e` (HSL `163 62% 14%`) — Primary buttons, active states, key branding.
- **Secondary Accent / Mint:** `#c5f4dd` / `#e6f9f0` (HSL `151 55% 92%`) — Badges, highlight chips, subtle glows.
- **Warm Background / Fog:** `#f7f5f0` (HSL `45 20% 97.5%`) — Crisp warm ivory dashboard and landing page backdrop.
- **Dark Text / Ink:** `#0d1f14` (HSL `150 40% 9%`) — High-contrast typography.
- **Warning / Sun:** `#f4c25d` — Popular badges, alerts, highlights.

*Always maintain this color scheme across all new pages, cards, and UI components.*

---

## 🔌 4. PLUGIN & GATING RULES

1. **57 Master Plugins in Database:**
   - Defined in `backend/app/plugins/manifests/*.yaml` and populated in the `plugins` DB table.
   - Core Free Plugins (12): `attendance`, `notices`, `academics`, `basic_reports`, `basic_website`, `dashboard`, `students`, `teachers`, `users`, `file_management`, `settings_core`, `marketplace_nav`.
   - Starter Plugins (12): `fees`, `exams`, `assignments`, `library_management`, `sms_notifications`, `whatsapp_bot`, `conferences`, `dismissal`, `elibrary`, `incidents`, `timetable`, `iemis_importer`.
   - Growth / Pro Plugins (24): `admission`, `ai_grading`, `ai_insights`, `ai_tutor`, `alumni`, `compliance`, `design_studio`, `emergency`, `gamification`, `gps_tracking`, `health_records`, `hostel`, `hr_payroll`, `inventory`, `lms`, `social_ads`, `social_hub`, `student_portfolio`, `visitor_management`, `website_builder`, `wellbeing`, etc.
   - Premium / Enterprise Plugins (8): `ai_tools`, `advanced_analytics`, `benchmarking`, `biometric`, `disaster_management`, `multi_branch`, `white_label`, `ai_adaptive_learning`.

2. **Backend API Protection:**
   - Any endpoint belonging to a plugin MUST be decorated with `@plugin_required("<plugin_slug>")`.
   - Plugin access is resolved per school and cached in Redis under `school:<id>:plugins`.
   - Invalidate cache with `_invalidate_plugin_cache(school_id)` whenever a plugin is installed/uninstalled.

3. **Frontend Protection:**
   - Gated dashboard pages MUST be wrapped with `<PluginGate slug="<plugin_slug>">`.
   - Use `normalizePluginSlug()` from `frontend/lib/plugins.tsx` to handle slug aliases cleanly.

---

## 📝 5. AI PROMPTS LIBRARY (COPY & PASTE FOR AI EDITORS)

### 🔹 Prompt A: Read Audits Before Starting Any Task
```text
You are an expert full-stack developer on the ASchool platform.
Before generating or modifying any code:
1. View the latest audit in `audits/PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md` and `audits/AUDIT_INDEX.md`.
2. Review the known gaps in plugin auto-installation, student limits (School.max_students), and AI token quotas.
3. Make sure your planned modifications comply with the established Forest Green design system and plugin gating patterns.
```

### 🔹 Prompt B: Full Codebase Feature Audit Prompt
```text
Perform a thorough audit of the ASchool codebase for [SPECIFIC_MODULE]:
1. Check database models in `backend/app/models/` and relationships.
2. Verify corresponding REST API endpoints in `backend/app/api/v1/` for @plugin_required, @role_required, and input validation.
3. Verify the frontend page in `frontend/app/dashboard/` for <PluginGate>, responsive UI, and error handling.
4. Record your findings and update `audits/AUDIT_INDEX.md` with timestamp and impacted files.
```

### 🔹 Prompt C: Plan & Feature Bundle Alignment Prompt
```text
Ensure that the school plan assigned at signup (free, starter, growth/pro, enterprise) correctly provisions all corresponding plugins, sets `school.max_students` appropriately, and initializes `AISchoolQuota`.
Verify that neither frontend routes nor backend APIs throw unhandled 403 or 500 errors for authorized plan tiers.
```

---

## 🔄 6. AUDIT LOGGING PROTOCOL

Whenever an AI assistant edits code in this project, it must append a new entry to [`audits/AUDIT_INDEX.md`](audits/AUDIT_INDEX.md) using the following format:

```markdown
### [YYYY-MM-DD] - <Brief Title of Changes>
- **Author/Agent:** <AI Model / Developer Name>
- **Rationale:** <Why the change was made>
- **Files Modified:**
  - `path/to/file1`: <Description of edit>
  - `path/to/file2`: <Description of edit>
- **Affected Subsystems:** <e.g., Auth, Fees, Exams, Database, UI>
- **Audit Reference:** `audits/PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md`
```
