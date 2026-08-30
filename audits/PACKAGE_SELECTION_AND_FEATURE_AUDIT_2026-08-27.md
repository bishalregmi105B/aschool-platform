# ASCHOOL PLATFORM — COMPREHENSIVE SIGNUP PACKAGE SELECTION & FEATURE AUDIT REPORT
**Audit Execution Date:** August 27, 2026  
**Auditors:** System Architecture Team, Multi-Agent Audit Group  
- Subagent 1: Backend Plan, Billing & Plugin Architecture Auditor
- Subagent 2: Frontend Plan Selection & Feature Gating Auditor
- Subagent 3: Quotas, Limits & Database Feature Auditor  
**Audit Scope:** End-to-end audit of Package Selection at Signup, Plan Mapping, Feature Entitlements, Auto-Installation, Frontend Gating, Backend Access Decorators, Limits/Quotas, and Database Integrity.

---

## 1. Executive Summary & Flow Logic

ASchool currently operates on a **disconnected dual-model architecture**:
1. **Frontend / Public Marketing Model:** Advertises 3 tiered SaaS packages (`Free` @ NPR 0, `Starter` @ NPR 2,999/mo, `Pro` @ NPR 7,999/mo) with tiered student limits (100 / 500 / Unlimited) and bundled features.
2. **Backend Engine Model:** Implements an individual **A La Carte Plugin Marketplace** with 57 granular plugins priced individually (e.g. LMS @ NPR 799/mo, AI Tools @ NPR 1,499/mo, Fees @ NPR 399/mo) gated by the `@plugin_required` decorator.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                SIGNUP & FEATURE FLOW LOGIC                              │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [ USER SIGNUP (register/page.tsx) ]
   │
   ├─► Selects Plan: "free" | "starter" | "pro"
   ├─► Inputs School & Admin credentials
   │
   ▼
 [ POST /api/v1/auth/register ]
   │
   ├─► Maps plan: "pro" ➔ "growth", "starter" ➔ "starter", "free" ➔ "free"
   ├─► Creates School(plan=plan, status="trial", max_students=100 [DEFAULT])
   ├─► Creates User(role="school_admin", is_active=True, phone_verified=True)
   │
   ▼
 [ HARDCODED PLUGIN INSTALLATION ] ⚠️ CRITICAL DISCONNECT
   │
   ├─► Installs ONLY 6 hardcoded plugins for ALL plans:
   │   ["attendance", "notices", "academics", "basic_reports", "basic_website", "fees"]
   │   (Starter & Pro registrations DO NOT receive their advertised features)
   │
   ▼
 [ DASHBOARD ACCESS ]
   │
   ├─► useInstalledPlugins queries /api/v1/plugins/installed & /api/v1/plugins/sidebar
   ├─► Dynamic Sidebar shows ONLY the 6 installed plugins
   ├─► If user visits uninstalled route (e.g., /dashboard/exams or /dashboard/lms):
   │   └─► Frontend PluginGate renders <PluginInstallPrompt /> (LOCKED)
   │   └─► Backend API with @plugin_required returns 403 Forbidden
   │
   ▼
 [ LIMITS & QUOTAS ] ⚠️ ENFORCEMENT GAP
   │
   ├─► POST /api/v1/students: ZERO check against school.max_students
   ├─► IEMIS bulk import: ZERO check against student capacity
   └─► AI Tokens: AISchoolQuota NOT provisioned on signup (fails if enforcement enabled)
```

---

## 2. Package Selection Audit: Advertised vs Actual Backend State

| Plan Tier | Marketing Price | Promised Features in UI | Actual Backend Installed Plugins | Student Limit | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Free** | NPR 0 / forever | • Up to 100 students<br>• Public Website<br>• Attendance & Basic Academics<br>• Notice Board | `attendance`, `notices`, `academics`, `basic_reports`, `basic_website`, `fees` *(on trial)* | 100 *(Not enforced)* | 🟡 **Partially Working** (Fees on trial bug) |
| **Starter** | NPR 2,999 / month | • Up to 500 students<br>• Core Modules & Fees<br>• Exam Marks & Grade Sheets (`exams`)<br>• Mobile Apps<br>• WhatsApp Support (`whatsapp_bot`)<br>• SMS Notifications (`sms_notifications`) | `attendance`, `notices`, `academics`, `basic_reports`, `basic_website`, `fees` *(only 6 core)* | 100 *(Not upgraded to 500)* | ❌ **Broken Bundle** (`exams`, `sms`, `library` locked) |
| **Pro / Growth** | NPR 7,999 / month | • Unlimited students & staff<br>• eSewa / Khalti Online Payments<br>• Website Builder (`website_builder`)<br>• LMS (`lms`)<br>• HR & Payroll (`hr_payroll`)<br>• Biometric Attendance (`biometric`) | `attendance`, `notices`, `academics`, `basic_reports`, `basic_website`, `fees` *(only 6 core)* | 100 *(Not set to Unlimited)* | ❌ **Broken Bundle** (Pro modules locked) |
| **Enterprise** | Custom | • Multi-branch chain<br>• Custom white-labeling<br>• Full AI Suite<br>• Dedicated Manager | `attendance`, `notices`, `academics`, `basic_reports`, `basic_website`, `fees` *(only 6 core)* | 100 *(Not set to Unlimited)* | ❌ **Unreachable in UI** |

---

## 3. Complete 57-Plugin Matrix & Gating Status

| # | Plugin Slug | Category | Monthly Price (NPR) | Plan Bundle Target | Frontend `PluginGate` | Backend `@plugin_required` | Current State for New School |
| :-: | :--- | :--- | :-: | :--- | :-: | :-: | :--- |
| 1 | `academics` | Core | Free (0) | Free, Starter, Pro | Built-in | None | 🟢 **Active & Enabled** |
| 2 | `attendance` | Core | Free (0) | Free, Starter, Pro | Built-in | None | 🟢 **Active & Enabled** |
| 3 | `basic_reports` | Core | Free (0) | Free, Starter, Pro | ✅ `basic_reports` | None | 🟢 **Active & Enabled** |
| 4 | `basic_website` | Core | Free (0) | Free, Starter, Pro | Built-in | None | 🟢 **Active & Enabled** |
| 5 | `dashboard` | Core | Free (0) | Free, Starter, Pro | Built-in | None | 🟢 **Active & Enabled** |
| 6 | `file_management`| Core | Free (0) | Free, Starter, Pro | Built-in | None | 🟢 **Active & Enabled** |
| 7 | `marketplace_nav`| Core | Free (0) | Free, Starter, Pro | Built-in | None | 🟢 **Active & Enabled** |
| 8 | `notices` | Core | Free (0) | Free, Starter, Pro | Built-in | None | 🟢 **Active & Enabled** |
| 9 | `settings_core` | Core | Free (0) | Free, Starter, Pro | Built-in | None | 🟢 **Active & Enabled** |
| 10 | `students` | Core | Free (0) | Free, Starter, Pro | Built-in | None | 🟢 **Active & Enabled** |
| 11 | `teachers` | Core | Free (0) | Free, Starter, Pro | Built-in | None | 🟢 **Active & Enabled** |
| 12 | `users` | Core | Free (0) | Free, Starter, Pro | Built-in | None | 🟢 **Active & Enabled** |
| 13 | `fees` | Starter | 399.00 | Starter, Pro | ✅ `fees` | ✅ `@plugin_required` | 🟡 **Trial Active** (Free gets 14d trial) |
| 14 | `exams` | Starter | 399.00 | Starter, Pro | ✅ `exams` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 15 | `assignments` | Starter | 299.00 | Starter, Pro | ✅ `assignments` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 16 | `library_management`| Starter| 199.00 | Starter, Pro | ✅ `library_management`| ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 17 | `sms_notifications`| Starter| 199.00 | Starter, Pro | ✅ `sms_notifications`| ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 18 | `whatsapp_bot` | Starter | 399.00 | Starter, Pro | ✅ `whatsapp_bot` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 19 | `conferences` | Starter | 199.00 | Starter, Pro | ✅ `conferences` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 20 | `dismissal` | Starter | 299.00 | Starter, Pro | ✅ `dismissal` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 21 | `elibrary` | Starter | 299.00 | Starter, Pro | ✅ `elibrary` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 22 | `incidents` | Starter | 199.00 | Starter, Pro | ✅ `incidents` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 23 | `library` *(alias)*| Starter| Free (0) | Starter, Pro | Normalized | None | 🟢 Alias of `library_management` |
| 24 | `timetable` | Starter | Free (0) | Free, Starter, Pro | Built-in | None | 🟢 **Active & Enabled** |
| 25 | `admission` | Growth | 699.00 | Pro, Enterprise | ✅ `admission` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 26 | `ai_grading` | Growth | 599.00 | Pro, Enterprise | ✅ `ai_grading` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 27 | `ai_insights` | Growth | Free (0) | Pro, Enterprise | ✅ `ai_insights` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 28 | `ai_tutor` | Growth | 499.00 | Pro, Enterprise | ✅ `ai_tutor` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 29 | `alumni` | Growth | 299.00 | Pro, Enterprise | ✅ `alumni` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 30 | `compliance` | Growth | 499.00 | Pro, Enterprise | ✅ `compliance` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 31 | `design_studio` | Growth | 499.00 | Pro, Enterprise | ✅ `design_studio` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 32 | `digital_content`*(alias)*| Growth| Free (0)| Pro, Enterprise | Normalized | None | 🟢 Alias of `elibrary` |
| 33 | `emergency` | Growth | 399.00 | Pro, Enterprise | ✅ `emergency` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 34 | `gamification` | Growth | 299.00 | Pro, Enterprise | ✅ `gamification` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 35 | `gps_tracking` | Growth | 599.00 | Pro, Enterprise | ✅ `gps_tracking` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 36 | `health_records`| Growth | 299.00 | Pro, Enterprise | ✅ `health_records` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 37 | `hostel` | Growth | Free (0) | Pro, Enterprise | ✅ `hostel` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 38 | `hr_payroll` | Growth | 699.00 | Pro, Enterprise | ✅ `hr_payroll` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 39 | `incident_management`| Growth| 399.00 | Pro, Enterprise | ✅ `incident_management`| ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 40 | `inventory` | Growth | 299.00 | Pro, Enterprise | ✅ `inventory` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 41 | `lms` | Growth | 799.00 | Pro, Enterprise | ✅ `lms` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 42 | `portfolio` *(alias)*| Growth| Free (0)| Pro, Enterprise | Normalized | None | 🟢 Alias of `student_portfolio` |
| 43 | `social_ads` | Growth | 499.00 | Pro, Enterprise | ✅ `social_ads` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 44 | `social_hub` | Growth | 699.00 | Pro, Enterprise | ✅ `social_hub` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 45 | `student_portfolio`| Growth | 299.00 | Pro, Enterprise | ✅ `student_portfolio`| ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 46 | `visitor_management`| Growth| 199.00 | Pro, Enterprise | ✅ `visitor_management`| ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 47 | `website_builder`| Growth| 499.00 | Pro, Enterprise | ✅ `website_builder`| ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 48 | `wellbeing` | Growth | 499.00 | Pro, Enterprise | ✅ `wellbeing` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 49 | `advanced_analytics`| Premium| 999.00 | Enterprise | ✅ `advanced_analytics`| ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 50 | `ai_adaptive_learning`| Premium| 1499.00 | Enterprise | ✅ `ai_adaptive_learning`| ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 51 | `ai_tools` | Premium | 1499.00 | Enterprise | ✅ `ai_tools` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 52 | `benchmarking` | Premium | 1499.00 | Enterprise | ✅ `benchmarking` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 53 | `biometric` | Premium | 1999.00 | Enterprise | ✅ `biometric` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 54 | `disaster_management`| Premium| 999.00 | Enterprise | ✅ `disaster_management`| ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 55 | `multi_branch` | Premium | 2999.00 | Enterprise | ✅ `multi_branch` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 56 | `white_label` | Premium | 2999.00 | Enterprise | ✅ `white_label` | ✅ `@plugin_required` | 🔴 **Locked** (Needs manual install) |
| 57 | `iemis_importer`| Add-on | Free (0) | Free, Starter, Pro | ⚠️ **UNGATED in UI** | ✅ `@plugin_required` | ⚠️ UI open, API requires plugin |

---

## 4. Key Findings & Discrepancies Breakdown

### Discrepancy 1: Hardcoded 6-Plugin Auto-Install on Registration
In `backend/app/api/v1/auth.py` (lines 302–308):
```python
# ── Auto-install core plugins ─────────────────────────────────────────────
try:
    from app.plugins.billing import install_plugin
    for plugin_slug in ["attendance", "notices", "academics", "basic_reports", "basic_website", "fees"]:
        install_plugin(str(school.id), plugin_slug)
except Exception:
    pass
```
* **Effect:** Even if a school signs up for **Starter** (NPR 2,999) or **Pro** (NPR 7,999), they receive only the 6 core plugins. Essential features like `exams` (Exam marksheets), `sms_notifications`, `library_management`, `website_builder`, `lms`, and `hr_payroll` are omitted from their installation list and locked in the UI.

---

### Discrepancy 2: Unenforced Student Limits (`School.max_students`)
In `backend/app/api/v1/students.py` (`create_student`, `bulk_import`) and `backend/app/api/v1/iemis_importer.py` (`_import_students`):
* **Effect:** There is **zero check** against `school.max_students`.
* A school on the Free plan (advertised max 100 students) can enroll 10,000+ students without being prompted to upgrade.
* Registration never updates `max_students` for Starter (should be 500) or Pro (should be Unlimited).

---

### Discrepancy 3: AI Quota Initialization Gap
In `backend/app/services/ai/token_hub.py`:
* `AITokenHub` checks `AISchoolQuota` before fulfilling AI requests.
* Because `register_school()` never initializes `AISchoolQuota`, all AI requests fail with `QuotaExceededError("inactive")` if quota enforcement is turned on.
* **Secondary Gap:** 6 AI service files (`lesson_plan.py`, `question_paper.py`, `homework_helper.py`, `school_insights.py`, `auto_grader.py`, `website_designer.py`) instantiate `Anthropic()` directly instead of through `AITokenHub`, bypassing usage logging.

---

### Discrepancy 4: Ungated UI Routes
The following frontend routes lack `<PluginGate>` protection:
* `/dashboard/website-builder/*` (Editor, AI Builder, Themes, Pages, Domain, SEO)
* `/dashboard/conferences`
* `/dashboard/bulk-uploads/iemis`

Users visiting these pages see full interfaces, but API calls fail with generic 403 errors instead of clean upgrade prompts.

---

## 5. Architectural Remediation Plan

To unify the platform so that selecting a package on signup automatically assigns all features and enforces proper limits:

### Step 1: Define Plan-to-Plugin Bundles in Backend
Add centralized bundle definitions in `backend/app/plugins/constants.py`:
```python
PLAN_BUNDLES = {
    "free": [
        "attendance", "notices", "academics", "basic_reports", 
        "basic_website", "iemis_importer"
    ],
    "starter": [
        "attendance", "notices", "academics", "basic_reports", 
        "basic_website", "iemis_importer", "fees", "exams", 
        "assignments", "library_management", "sms_notifications", 
        "whatsapp_bot", "conferences", "elibrary", "incidents", "dismissal"
    ],
    "growth": [  # Pro Tier
        "attendance", "notices", "academics", "basic_reports", 
        "basic_website", "iemis_importer", "fees", "exams", 
        "assignments", "library_management", "sms_notifications", 
        "whatsapp_bot", "conferences", "elibrary", "incidents", "dismissal",
        "admission", "website_builder", "design_studio", "hr_payroll", 
        "lms", "wellbeing", "ai_grading", "ai_tutor", "ai_insights",
        "student_portfolio", "inventory", "visitor_management", 
        "compliance", "emergency", "gamification", "health_records", "hostel", "alumni", "gps_tracking"
    ],
    "enterprise": [ # All 57 plugins
        "ai_tools", "advanced_analytics", "benchmarking", 
        "disaster_management", "ai_adaptive_learning", "biometric", 
        "multi_branch", "white_label", "social_ads", "social_hub"
        # + all growth plugins
    ]
}

PLAN_STUDENT_LIMITS = {
    "free": 100,
    "starter": 500,
    "growth": None,       # Unlimited
    "enterprise": None,   # Unlimited
}
```

### Step 2: Update Registration Flow (`backend/app/api/v1/auth.py`)
1. Set `school.max_students = PLAN_STUDENT_LIMITS.get(plan)`.
2. Iterate through `PLAN_BUNDLES.get(plan)` and install all plugins with `is_trial=False`.
3. Call `AITokenHub.ensure_quota_exists(school.id, plan_type=plan)`.

### Step 3: Enforce Student Limits in Student Endpoints
In `backend/app/api/v1/students.py` (`create_student`, `bulk_import`) and `iemis_importer.py`:
```python
if school.max_students is not None:
    current_count = Student.query.filter_by(school_id=g.school_id, is_deleted=False).count()
    if current_count >= school.max_students:
        return error_response(
            f"Student limit of {school.max_students} reached for your plan. Please upgrade to enroll more students.",
            403
        )
```

### Step 4: Fix Frontend Gating
* Wrap `/dashboard/website-builder/*` and `/dashboard/bulk-uploads/iemis` in `<PluginGate>`.

---

**Generated by ASchool Auditor System**  
**Saved to:** `audits/PACKAGE_SELECTION_AND_FEATURE_AUDIT_2026-08-27.md`
