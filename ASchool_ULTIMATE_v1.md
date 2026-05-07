# ═══════════════════════════════════════════════════════════════════════
# ASCHOOL — ULTIMATE SAAS BUILD PROMPTS v2.0
# Nepal's Most Advanced AI-First School Operating System
# PLUGIN-BASED ARCHITECTURE: Schools Install Only What They Need
# Multi-Tenant SaaS: Core + Plugin Marketplace + School Website Builder
# Stack: Next.js 14 + Python Flask + Flutter 4 Apps
# ═══════════════════════════════════════════════════════════════════════

> **"Every school in Nepal deserves a complete AI-powered digital backbone —
> at a price even a community school in Jumla can afford."**
>
> ASchool = Modular School OS with Plugin Marketplace
> Core Platform (free) + Pick-and-choose plugins = Schools pay ONLY for what they use.
> Think WordPress + WooCommerce: lightweight core, powerful when extended.
> Just like NepalCart gives merchants their storefront, ASchool gives every
> school its own live, dynamic, SEO-ready website — synced with live school data.

---

## ★ COMPETITIVE INTELLIGENCE — READ BEFORE BUILDING (UPDATED March 2026)

### Nepal Competitor Gaps — Exploit Every One:

| Competitor | Their Weakness | Your ASchool Edge |
|---|---|---|
| **Veda App** (1,300+ schools) | Basic, no AI, no WhatsApp bot, no LMS | Full Claude AI + WhatsApp 2-way bot + integrated LMS |
| **Smart School Nepal** | Desktop-first, no mobile, no AI | 4 native Flutter apps + AI in all 35+ modules |
| **Hamro School** | Portal/news site only, no management | Full school OS: management + website + social + LMS |
| **iSmartClass** | AI only in attendance, no parent app | AI woven into ALL modules + 4 dedicated apps |
| **eSchool (foreign)** | No Nepal payments, no BS dates, no Nepali | eSewa + Khalti + FonePay + BS calendar + full Nepali UI |
| **ALL Nepal competitors** | No school website builder | AI drag-drop website per school with live data |
| **ALL Nepal competitors** | No Canva-like designer | Built-in school design studio |
| **ALL Nepal competitors** | No social media management | FB+IG+TikTok+YouTube unified hub |
| **ALL Nepal competitors** | No ad boosting | Meta Ads API inbuilt |
| **ALL Nepal competitors** | No GPS bus tracking | DIY ESP32 SafeRide (Rs. 2,500/bus) |
| **ALL Nepal competitors** | No admission CRM | Full funnel: social DM → lead → enrolled |
| **ALL Nepal competitors** | Breaks offline | Full offline-first Flutter (Isar + auto-sync) |
| **ALL Nepal competitors** | No multi-school chain | Enterprise chain dashboard |
| **ALL Nepal competitors** | No AI timetable | 30-second clash-free timetable generator |
| **ALL Nepal competitors** | No alumni network | Integrated alumni + LinkedIn module |
| **ALL Nepal competitors** | No LMS / video classes | Integrated LMS with live + recorded classes |
| **ALL Nepal competitors** | No student mental health tracking | AI-powered wellbeing module + counselor workflow |
| **ALL Nepal competitors** | No government compliance reports | Auto-generate MoE flash reports + EMIS data |
| **ALL Nepal competitors** | No emergency/disaster module | Earthquake-ready: evacuation plans + instant parent alerts |
| **ALL Nepal competitors** | No student pickup/dismissal system | QR-code verified safe pickup + parent notification |

### Global Competitors — Features to Beat:

| Global Competitor | What They Do Well | How ASchool Beats Them |
|---|---|---|
| **Teachmint** (India, Google EDLA) | AI interactive whiteboard, EduAI (math solver, quiz creation, homework gen), hardware board | Nepal-native: BS calendar, eSewa/Khalti, Nepali AI, no hardware dependency |
| **Classter** (500+ institutions) | All-in-one: SIS + LMS + billing + CRM, student portal | All that + school website builder + social hub + offline-first Flutter |
| **ParentLocker** (top-rated K-12) | Admissions management, parent communication | + WhatsApp bot, GPS bus tracking, AI insights, social media hub |
| **Alma SIS** (modern SIS) | Attendance tracking, Google integrations | + AI risk detection, fee prediction, offline-first, Nepal payments |
| **Classe365** (cloud LMS+SIS) | Learning management + student info | + 4 native apps, school website, social hub, design studio |
| **Pikmykid** (student safety) | Dismissal management, safety tracking | ASchool adds this + entire management platform, not just safety |
| **Google Classroom** (dominant free) | Free, Google ecosystem, assignment flow | Full management (fees, HR, transport, AI) — Google only does classroom |
| **PowerSchool** (US leader) | Enterprise SIS, analytics, compliance | Nepal-specific: BS dates, Nepali AI, eSewa, WhatsApp bot, affordable |
| **Wayground/Quizizz** | Gamified learning, student engagement | ASchool integrates gamification + entire school OS |

### ═══ CORE PROBLEMS OF SCHOOLS IN NEPAL — What ASchool Solves ═══

#### ADMINISTRATIVE PROBLEMS (Direct Revenue Impact):
1. **Manual paper-based records** — Student files, fee ledgers, attendance registers all on paper
   → ASchool: 100% digital records with offline-first sync
2. **Fee collection chaos** — Cash-only, no tracking, easy embezzlement, parents dispute payments
   → ASchool: Digital receipts, eSewa/Khalti, real-time dashboard, WhatsApp confirmation
3. **Attendance fraud** — Teachers mark fake attendance, no verification
   → ASchool: Timestamped digital marking, photo attendance, parent instant notification
4. **No data-driven decisions** — Principals run schools on gut feeling
   → ASchool: AI weekly insights, predictive analytics, at-risk early warning
5. **Staff management nightmare** — Leave tracking on paper, payroll manual, no appraisal system
   → ASchool: Full HR module with payroll, leave management, performance tracking

#### PARENT COMMUNICATION PROBLEMS (Retention Impact):
6. **Parents feel disconnected** — No real-time updates, only yearly parent meetings
   → ASchool: WhatsApp bot, parent app, real-time attendance/fee/bus notifications
7. **Fee transparency issues** — Parents don't know what they're paying for
   → ASchool: Digital fee structure, itemized receipts, payment history in app
8. **No bus safety tracking** — Parents anxiety about children's commute
   → ASchool: GPS SafeRide, ETA alerts, arrival/departure notifications
9. **Report card delays** — Takes weeks to distribute, parents visit school to collect
   → ASchool: Instant digital report cards via WhatsApp, AI-personalized remarks

#### ACADEMIC PROBLEMS (Quality Impact):
10. **No learning management** — No structured homework submission, no content library
    → ASchool: Integrated LMS with assignments, submissions, AI grading
11. **Teacher quality issues** — No lesson plan templates, no resource sharing
    → ASchool: AI lesson plan generator, question paper maker, teaching resources
12. **Student mental health ignored** — No counselor workflow, no mood tracking
    → ASchool: Student wellbeing module, mood check-ins, counselor referral workflow
13. **One-size-fits-all teaching** — No personalized learning paths
    → ASchool: AI adaptive recommendations, student learning style detection
14. **Exam paper leaks & poor quality** — Manual paper setting, repeated questions
    → ASchool: AI question paper generator with Bloom's taxonomy, chapter-wise balance

#### INFRASTRUCTURE & TECHNOLOGY PROBLEMS (Nepal-Specific):
15. **Load shedding / power cuts** — Systems go down frequently
    → ASchool: Offline-first architecture, Isar local DB, background sync
16. **Low internet connectivity** — Rural schools have <1 Mbps
    → ASchool: Compressed API calls, image optimization, works offline
17. **No school website** — 95%+ Nepal schools have zero online presence
    → ASchool: AI website builder, {slug}.aschool.com.np in 60 seconds
18. **Earthquake/disaster readiness** — No emergency communication system
    → ASchool: Emergency alert module, instant parent WhatsApp blast, evacuation plans

#### BUSINESS/GROWTH PROBLEMS (Scale Impact):
19. **No admission funnel** — Schools wait for walk-ins, no marketing
    → ASchool: Social media hub + ad boosting + admission CRM + AI chatbot
20. **Multi-branch chaos** — Chain schools can't see unified data
    → ASchool: Enterprise chain dashboard with cross-school analytics
21. **Government compliance burden** — Flash reports, EMIS data manually prepared
    → ASchool: Auto-generate MoE reports, EMIS-compatible data export

### ═══ NEW FEATURES TO ADD — 2026 INNOVATION UPDATE ═══

These features are MISSING from v1.0 and must be added to stay ahead of global competition:

#### MODULE 29: LEARNING MANAGEMENT SYSTEM (LMS) — NEW
```
Priority: HIGH | No Nepal competitor has this integrated
Files to add:
  backend/app/api/v1/lms.py
  backend/app/models/lms.py
  backend/app/services/ai/adaptive_learning.py

Features:
- Live class scheduling (teacher broadcasts via Jitsi/WebRTC)
- Recorded class library (auto-upload to Cloudflare R2)
- Course content builder (chapters → lessons → resources)
- AI adaptive learning paths per student (weak areas get more practice)
- Interactive quizzes with auto-grading
- Video annotations (teacher marks key moments in recorded classes)
- Student watch time analytics (who watched, how long, drop-off points)
- Offline class download (Flutter: download video for offline viewing)
- Parent view: see child's learning progress and watch history
- Integration: assignments module feeds into LMS grades
- AI tutor chatbot per subject (students ask questions 24/7)
```

#### MODULE 30: STUDENT WELLBEING & MENTAL HEALTH — NEW
```
Priority: HIGH | Critical gap globally, zero in Nepal
Files to add:
  backend/app/api/v1/wellbeing.py
  backend/app/models/wellbeing.py
  backend/app/services/ai/wellbeing_ai.py

Features:
- Daily mood check-in (emoji-based for younger students)
- Wellbeing survey (weekly, anonymous, age-appropriate)
- AI sentiment analysis on student submissions & behavior data
- Counselor dashboard (flagged students, session scheduling)
- Counselor session notes (encrypted, HIPAA-equivalent privacy)
- Bullying report system (anonymous, tracked, action required)
- Parent notification when child's wellbeing score drops
- Integration with at-risk detection engine (existing Module 5)
- Stress pattern correlation (exam periods, attendance drops)
- Mindfulness/activity suggestions pushed to student app
- Teacher training resources on student mental health
```

#### MODULE 31: STUDENT PICKUP & DISMISSAL SAFETY — NEW
```
Priority: MEDIUM | Pikmykid charges $3/student/month for just this
Files to add:
  backend/app/api/v1/dismissal.py
  backend/app/models/dismissal.py

Features:
- QR code generated per student per day
- Parent scans QR or enters PIN at pickup
- Authorized pickup list per student (photo + ID of authorized persons)
- Teacher confirms pickup on app → parent gets notification
- Unauthorized pickup attempt → instant alert to admin + parent
- Late pickup tracking with automated follow-up
- Bus dismissal mode (mark students as "on bus" vs "parent pickup")
- Integration with GPS SafeRide (student boarded confirmation)
- Emergency early dismissal workflow (admin triggers, all parents notified)
- Historical pickup data for safety auditing
```

#### MODULE 32: GOVERNMENT COMPLIANCE & REPORTING — NEW
```
Priority: HIGH | Every school MUST submit reports to MoE
Files to add:
  backend/app/api/v1/compliance.py
  backend/app/services/compliance/moe_reports.py

Features:
- Auto-generate MoE Flash Report I & II
- EMIS (Education Management Information System) data export
- District Education Office report format
- Teacher qualification compliance tracking
- Student enrollment statistics (by gender, ethnicity, disability)
- Scholarship recipient tracking (government scholarship)
- Physical infrastructure inventory report
- Mid-day meal program tracking (for government schools)
- Audit-ready financial statements per academic year
- One-click report generation vs weeks of manual work
```

#### MODULE 33: EMERGENCY & DISASTER MANAGEMENT — NEW
```
Priority: HIGH | Nepal is earthquake-prone, schools need this
Files to add:
  backend/app/api/v1/emergency.py
  backend/app/models/emergency.py

Features:
- Emergency alert broadcast (WhatsApp + SMS + push to all parents in <60 seconds)
- Earthquake alert integration (Nepal Seismological Centre API)
- Evacuation plan storage and display (per school building)
- Student headcount during emergency (teacher marks "accounted for")
- Parent reunification tracking (child handed to which parent/guardian)
- Emergency contact auto-dial for unreachable parents
- Drill scheduling and tracking (fire drill, earthquake drill)
- Post-disaster school status update (school open/closed banner on website)
- Insurance claim document preparation
- Integration with local authorities notification
```

#### MODULE 34: E-LIBRARY & DIGITAL CONTENT — NEW
```
Priority: MEDIUM | Extends existing library module
Files to add:
  backend/app/api/v1/elibrary.py
  backend/app/models/digital_content.py

Features:
- Digital book library (PDF, EPUB upload/reader)
- Open Educational Resources (OER) integration
- Nepal curriculum textbook digitization (NEB, CDC content)
- AI study material generator per chapter
- Past exam paper archive (SEE, NEB papers organized by year/subject)
- Student notes & highlights (saved per book, synced across devices)
- Audio books / text-to-speech for Nepali content
- Teacher resource library (lesson plans, worksheets shared by community)
- Offline download for Flutter apps (read without internet)
- Reading analytics (which students read, how much, comprehension quizzes)
```

#### MODULE 35: PARENT-TEACHER CONFERENCE SCHEDULER — NEW
```
Priority: MEDIUM | Every school does this manually
Files to add:
  backend/app/api/v1/conferences.py
  backend/app/models/conference.py

Features:
- Teacher sets available time slots
- Parent books slot via app (no phone tag)
- Automatic reminders (WhatsApp + push notification)
- Video conference option (Jitsi integration for remote parents)
- Pre-conference: AI summary of child's performance auto-shared
- Post-conference: teacher logs action items, shared with parent
- No-show tracking with follow-up automation
- Bulk scheduling for report card days
- Multilingual invitation (Nepali + English)
```

#### MODULE 36: STUDENT PORTFOLIO & ACHIEVEMENTS — NEW
```
Priority: LOW | Differentiator for premium schools
Files to add:
  backend/app/api/v1/portfolio.py
  backend/app/models/portfolio.py

Features:
- Digital portfolio per student (auto-builds across years)
- Academic records, certificates, awards compiled automatically
- Extracurricular activity log
- Teacher endorsements / skill badges
- AI-generated student summary for college applications
- Portfolio export as PDF or shareable public link
- Integration with alumni module (portfolio persists after graduation)
- Micro-credentials: verified skill badges (coding, public speaking, etc.)
- Parent shareability (share portfolio with relatives)
```

#### MODULE 37: INCIDENT & BEHAVIOR MANAGEMENT — NEW
```
Priority: MEDIUM | Schools track this on paper, leads to legal issues
Files to add:
  backend/app/api/v1/incidents.py
  backend/app/models/incident.py

Features:
- Incident report form (injury, behavior, bullying, property damage)
- Severity classification (minor/moderate/major/critical)
- Photographic evidence attachment
- Witness statements
- Action taken log (warning, suspension, parent meeting, counselor referral)
- Parent notification workflow
- Repeat offender tracking with AI pattern detection
- Integration with student wellbeing module
- Government-mandated incident reporting format
- Historical incident analytics per class/student
```

#### MODULE 38: AI HOMEWORK ASSISTANT & AUTO-GRADING — NEW
```
Priority: HIGH | Saves teachers 10+ hours/week
Files to add:
  backend/app/services/ai/auto_grader.py
  backend/app/services/ai/homework_helper.py

Features:
- Student photos handwritten work → AI OCR → text extraction
- AI auto-grading for objective questions (MCQ, fill-blank, true/false)
- AI-suggested grades for subjective answers (teacher confirms)
- Personalized feedback generation per student
- Common mistake detection across class (shows teacher what to re-teach)
- Student-facing AI tutor: "Help me understand question 3"
- Plagiarism detection across submissions
- Homework analytics: completion rates, average time, difficulty analysis
- Nepali handwriting OCR support (Devanagari script)
- Integration with LMS gradebook
```

#### MODULE 39: SCHOOL-TO-SCHOOL BENCHMARKING — NEW
```
Priority: LOW | Enterprise feature for growth plan
Files to add:
  backend/app/api/v1/benchmarking.py
  backend/app/services/ai/benchmarking_ai.py

Features:
- Anonymous performance comparison across ASchool network
- Metrics: attendance rate, fee collection rate, exam averages, parent engagement
- District/province ranking (opt-in)
- SEE result comparison (after results published)
- Best practices sharing (anonymized: "A school in Lalitpur improved attendance 15% by...")
- AI recommendations based on what top-performing schools do differently
- Enrollment trend comparison
- Parent satisfaction survey benchmarking
- Only available to Growth+ plans (valuable upsell feature)
```

### ═══ UPDATED TECH STACK ADDITIONS ═══

| New Layer | Technology | Purpose |
|---|---|---|
| **Video/LMS** | Jitsi Meet SDK (self-hosted or JaaS) | Live classes, video conferences |
| **Video Storage** | Cloudflare Stream (or R2 + HLS) | Recorded class video hosting |
| **OCR** | Tesseract.js + Claude Vision | Handwritten homework scanning |
| **Text-to-Speech** | Browser API + edge-tts (Nepali) | E-library audio, accessibility |
| **Earthquake Alert** | Nepal Seismological Centre RSS/API | Emergency module trigger |
| **Portfolio** | Puppeteer PDF + public link router | Student portfolio export |

### Your 7 Unfair Advantages (Updated):
1. **Plugin marketplace model** — schools pay ONLY for what they use, not bloated bundles
2. **Real school as sandbox** — father's school tests everything before launch
3. **Flask backend already built** — months ahead, just extend with plugin system
4. **School website per school** — nobody in Nepal does this
5. **Offline-first Flutter** — critical for Nepal's load shedding reality
6. **Nepal-native AI** — Claude speaks Nepali, understands BS calendar, knows eSewa
7. **LMS + Management + Marketplace in one** — competitors sell fixed packages, we let schools customize

---

# ═══════════════════════════════════════════════════════════════════════
# PART 1: SAAS ARCHITECTURE — PLUGIN-BASED DESIGN
# ═══════════════════════════════════════════════════════════════════════

You are an elite principal engineer building **ASchool** — Nepal's most advanced
AI-powered multi-tenant School Operating System. Every feature is a **plugin**
that schools can install/uninstall from a marketplace. Core is free forever.

## THE PLUGIN ARCHITECTURE CONCEPT

```
ASCHOOL PLATFORM = CORE + PLUGIN MARKETPLACE
│
├── CORE (Free Forever — Always Included):
│   ├── Multi-tenant school shell + subdomain routing
│   ├── User management (all roles: admin, teacher, parent, student)
│   ├── Basic school profile + branding
│   ├── Plugin marketplace dashboard
│   ├── Settings & configuration
│   └── Notification engine (push only, no SMS/WA)
│
├── PLUGIN MARKETPLACE: Schools browse + install what they need
│   │
│   ├── ── FREE PLUGINS (unlimited use) ──────────────────────
│   │   ├── 📋 Attendance                # Digital attendance register
│   │   ├── 📝 Notices & Circulars       # School communication
│   │   ├── 📅 Academic Setup            # Class, section, subject, timetable
│   │   ├── 🌐 School Website (Basic)    # {slug}.aschool.com.np + 5 themes
│   │   └── 📊 Basic Reports             # Attendance + student count reports
│   │
│   ├── ── STARTER PLUGINS (Rs. 199-499/month each) ─────────
│   │   ├── 💰 Fee Collection            # Digital fees, receipts, eSewa/Khalti
│   │   ├── 📝 Exams & Results           # Exam schedule, marks, report cards
│   │   ├── 📚 Library Management        # Book catalog, checkout, overdue
│   │   ├── 📨 SMS Notifications         # Sparrow SMS integration
│   │   ├── 💬 WhatsApp Bot              # Two-way WhatsApp communication
│   │   ├── 📋 Assignments & Homework    # Create, submit, track
│   │   ├── 📖 E-Library                 # Digital books, past papers, resources
│   │   ├── 📅 PT Conference Scheduler   # Parent-teacher meetings booking
│   │   ├── 🚸 Student Dismissal/Pickup  # QR-based safe pickup system
│   │   └── 📋 Incident Reporting        # Basic behavior tracking
│   │
│   ├── ── GROWTH PLUGINS (Rs. 499-999/month each) ──────────
│   │   ├── 🚌 GPS Bus Tracking          # DIY ESP32 SafeRide + live map
│   │   ├── 📱 Social Media Hub          # FB+IG+TikTok+YouTube unified
│   │   ├── 📢 Social Ad Boosting        # Meta Ads API post boosting
│   │   ├── 🎓 Admission CRM             # Full lead funnel: social→enrolled
│   │   ├── 🌐 Website Builder (Pro)     # All 20 themes + custom domain + AI builder
│   │   ├── 🎨 Design Studio             # Canva-like school designer
│   │   ├── 👔 HR & Payroll              # Staff payroll, leaves, appraisal
│   │   ├── 🏥 Health Records            # Student medical records
│   │   ├── 🎓 Alumni Network            # Alumni portal + mentoring
│   │   ├── 🏆 Gamification              # Badges, points, leaderboards
│   │   ├── 📦 Inventory & Assets        # QR asset tracking, procurement
│   │   ├── 👥 Visitor Management        # Visitor log + appointments
│   │   ├── 📹 LMS (Live + Recorded)     # Courses, live classes (Jitsi), video library
│   │   ├── 🧠 Student Wellbeing         # Mood tracking, counselor workflow
│   │   ├── ✅ AI Auto-Grading           # AI grades homework + feedback
│   │   ├── 🤖 AI Homework Helper        # Student AI tutor chatbot
│   │   ├── 📋 Incident Management       # Full behavior + witness + action log
│   │   ├── 🆘 Emergency Alerts          # Basic emergency broadcast
│   │   ├── 📜 Government Compliance     # MoE flash reports, EMIS export
│   │   └── 🎒 Student Portfolio         # Digital achievement portfolio
│   │
│   ├── ── PREMIUM PLUGINS (Rs. 999-2999/month each) ────────
│   │   ├── 🤖 AI Tools Suite            # Question paper, lesson plan, timetable, remarks
│   │   ├── 📊 Advanced Analytics        # AI weekly insights, risk detection, predictions
│   │   ├── 🆘 Disaster Management       # Earthquake API, evacuation plans, drills
│   │   ├── 📈 School Benchmarking       # Anonymous school-to-school comparison
│   │   ├── 🧠 AI Adaptive Learning      # Personalized learning paths per student
│   │   ├── 🏢 Multi-Branch Chain        # Cross-school unified dashboard
│   │   ├── ✋ Biometric Integration      # ZKTeco fingerprint attendance
│   │   └── 🏷️ White-Label Branding      # Custom branding, domain app
│   │
│   └── ── ADD-ON USAGE (Pay-Per-Use) ───────────────────────
│       ├── AI Credits (100k tokens): Rs. 499/pack
│       ├── Extra WhatsApp messages (1000): Rs. 199/pack
│       ├── Extra custom domain: Rs. 299/month
│       ├── Extra SMS credits (500): Rs. 199/pack
│       └── Extra storage (10GB): Rs. 199/month
│
├── PRODUCT B: SCHOOL WEBSITE BUILDER (per school - plugin-driven)
│   ├── Free plugin:    {slug}.aschool.com.np (5 basic themes)
│   └── Pro plugin:     20 themes + custom domain + AI builder + Craft.js editor
│
└── PLUGIN TECHNICAL ARCHITECTURE:
    ├── Each plugin = self-contained module (routes + models + services + UI)
    ├── Plugin registry: defines manifest, dependencies, permissions
    ├── Install/uninstall: instant, no data loss (data preserved on uninstall)
    ├── Plugin isolation: separate blueprint registration, lazy-loaded UI
    ├── Inter-plugin events: PostgreSQL LISTEN/NOTIFY + internal event bus
    └── Plugin billing: tracked per school, prorated, auto-billed monthly
```

## HOW PLUGIN SYSTEM WORKS (Technical)

```
SCHOOL INSTALLS A PLUGIN:
1. Admin goes to Plugin Marketplace → browses/searches
2. Clicks "Install" on a plugin → API: POST /api/v1/plugins/install
3. Backend:
   a. Check school's plan limits + billing
   b. Create SchoolPlugin record (school_id, plugin_slug, active=True)
   c. Run plugin.on_install() → creates any needed DB tables/seeds
   d. Register plugin's API blueprints into Flask router
   e. Notify frontend → sidebar adds new menu item
   f. Notify Flutter apps → new feature tab appears
4. School admin sees plugin immediately — zero restart needed

SCHOOL UNINSTALLS A PLUGIN:
1. Admin goes to Settings → Installed Plugins → "Uninstall"
2. Backend:
   a. Soft-disable: SchoolPlugin.active = False
   b. Data NOT deleted (preserved for re-install)
   c. Unregister plugin routes from school's context
   d. Frontend sidebar hides menu item
   e. Flutter apps hide feature tab
   f. Billing: stop charging next cycle

PLUGIN REQUEST FLOW:
  Browser → Next.js → /api/v1/lms/courses
                         ↓
  Flask: @plugin_required('lms')   ← decorator checks school has plugin
                         ↓
  If installed → process request normally
  If NOT installed → 403 {"error": "Plugin 'lms' not installed", "install_url": "/marketplace/lms"}
```

## THE TWIN-PRODUCT CONCEPT

```
ASCHOOL SAAS PLATFORM
│
├── PRODUCT A: SCHOOL MANAGEMENT SYSTEM (Plugin-Based)
│   ├── Super Admin Panel   → you (ASchool owner), all schools + plugin marketplace admin
│   ├── School Admin Panel  → principal: install plugins, manage school
│   ├── Teacher Portal      → web dashboard + Flutter app (sees installed plugins only)
│   ├── Parent Portal       → web + Flutter app (sees installed plugins only)
│   └── Student Portal      → web + Flutter app (sees installed plugins only)
│
└── PRODUCT B: SCHOOL WEBSITE BUILDER (per school)
    ├── Every school gets:  {slug}.aschool.com.np (free plugin)
    ├── Custom domain:      www.school.edu.np (pro website plugin, CNAME)
    ├── AI Visual Builder:  prompt → school website in 60 seconds (pro)
    ├── 20 school themes:   classic, modern, government, montessori, etc.
    ├── Live data sync:     events, notices, results auto-published from SMS
    ├── Admission portal:   live form connected to Admission CRM plugin
    ├── Teacher directory:  auto-synced from staff records
    ├── Alumni section:     auto-updated on graduation (if alumni plugin installed)
    └── SEO-optimized:      schema markup, sitemap, fast Core Web Vitals
```

## SUBDOMAIN ROUTING (Exactly Like NepalCart)

```
aschool.com.np                    → ASchool Marketing Homepage
app.aschool.com.np                → Super Admin Panel (you)
{slug}.aschool.com.np             → School's PUBLIC WEBSITE
{slug}.aschool.com.np/admin       → School Admin Dashboard
{slug}.aschool.com.np/teacher     → Teacher Portal
{slug}.aschool.com.np/parent      → Parent Login
{slug}.aschool.com.np/student     → Student Login
www.{school}.edu.np               → Custom domain (paid) → CNAME to above

# Examples:
bdps.aschool.com.np               → Budhanilkantha D.P.S public website
bdps.aschool.com.np/admin         → BDPS school dashboard
greenfield.aschool.com.np         → Greenfield Academy public website
www.greenfieldschool.edu.np       → Custom domain pointing to above
```

## COMPLETE TECH STACK

### Backend + Web Dashboard + API
| Layer | Technology | Why |
|---|---|---|
| **API Backend** | Python Flask 3.x + Flask-RESTful + Blueprints | Already built, extend it |
| **Web Dashboard** | Next.js 14 (App Router, TypeScript, Tailwind, shadcn/ui) | Data-rich admin panels |
| **Visual Editor** | Craft.js (drag-and-drop school website builder) | Block-based theme system |
| **Database** | PostgreSQL 16 (primary) + Redis 7 (cache/queues) | Relational + real-time |
| **Vector Search** | pgvector extension | AI semantic search |
| **AI** | Anthropic Claude API (haiku-4-5 for speed, sonnet-4 for complex) | All AI across all modules |
| **Queue** | Celery + Redis | Background jobs, notifications |
| **Real-time** | Flask-SocketIO (Socket.IO) + SSE | Live dashboard events |
| **Auth** | JWT + refresh tokens + OTP (Sparrow SMS) | Multi-role secure auth |
| **File Storage** | Cloudflare R2 (10GB free) + Sharp (image optimization) | Documents, photos |
| **SMS** | Sparrow SMS API (Nepal, Rs. 1.50/SMS) | Nepal SMS delivery |
| **WhatsApp** | Meta WhatsApp Cloud API | Two-way bot |
| **Email** | Amazon SES / Mailgun | Transactional emails |
| **Social** | Meta Graph API + TikTok for Developers API | Social Hub |
| **Payments** | eSewa + Khalti + FonePay (school fees) | Nepal gateways |
| **PDF** | WeasyPrint (Flask) + Puppeteer (complex layouts) | Report cards, invoices |
| **Design Engine** | Fabric.js (canvas) + PIL (server-side) | Canva-like designer |
| **GPS** | Firebase Realtime DB (bus tracking relay) | Real-time bus location |
| **Search** | pgvector + PostgreSQL FTS (hybrid) | Student/staff search |
| **Monitoring** | Sentry + Prometheus | Errors + metrics |
| **Testing** | pytest + Jest + Playwright | Full coverage |

### Flutter Apps (4 Separate Apps, Shared Core)
| App | Users | Key Features |
|---|---|---|
| **ASchool Admin** | Principal, accountant, office | Full management, analytics, POS fees, compliance reports, emergency mgmt, benchmarking |
| **ASchool Teacher** | All teachers | Attendance, marks, assignments, AI tools, LMS, auto-grading, wellbeing, incidents |
| **ASchool Parent** | All parents | Child tracking, fees, bus GPS, chat, wellbeing view, dismissal/pickup, PT conferences |
| **ASchool Student** | All students | Timetable, homework, results, library, LMS, e-library, AI tutor, portfolio, wellbeing |

### Flutter Tech Stack
| Layer | Technology |
|---|---|
| Framework | Flutter 3.x (Dart) — single codebase, Android + iOS |
| State | Riverpod 2.x + AsyncNotifier |
| Navigation | GoRouter |
| HTTP | Dio + Retrofit (type-safe API) |
| Local DB | Isar (offline-first, fast) |
| Real-time | Socket.IO Flutter client |
| Push | Firebase Cloud Messaging |
| Barcode | mobile_scanner (library books, inventory) |
| Maps | flutter_map + OpenStreetMap (bus tracking, free) |
| Camera | camera + image_picker (attendance photo, documents) |
| Auth | flutter_secure_storage + biometric_storage |
| Charts | fl_chart |
| Animations | flutter_animate + Lottie |
| Payments | eSewa SDK + Khalti SDK (fee payment from app) |
| Calendar | nepali_date_converter + table_calendar |
| Offline | Isar local DB + background sync service |

### Nepal-Specific Stack
| Feature | Tool |
|---|---|
| SMS | Sparrow SMS (Rs. 1.50/SMS) |
| Payments | eSewa + Khalti + FonePay + ConnectIPS |
| Calendar | Bikram Sambat (BS) + AD dual display |
| Language | Nepali (Devanagari) + English toggle |
| Phone | +977 format with validation |
| GPS Bus | DIY ESP32 + NEO-6M + SIM800L (Rs. 2,500/bus) |
| Maps | OpenStreetMap (free vs Google Maps) |

---

# ═══════════════════════════════════════════════════════════════════════
# PART 2: COMPLETE PROJECT STRUCTURE
# ═══════════════════════════════════════════════════════════════════════

```
aschool/
│
├── README.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── docker-compose.prod.yml
├── Makefile
│
├── backend/                              # Python Flask API
│   ├── requirements.txt
│   ├── wsgi.py
│   ├── config.py
│   ├── extensions.py
│   │
│   ├── app/
│   │   ├── __init__.py                  # Flask app factory + plugin loader
│   │   │
│   │   ├── plugins/                     # ★ PLUGIN SYSTEM CORE
│   │   │   ├── __init__.py
│   │   │   ├── registry.py             # Plugin manifest registry + discovery
│   │   │   ├── loader.py               # Dynamic blueprint registration per school
│   │   │   ├── decorators.py           # @plugin_required('slug') decorator
│   │   │   ├── events.py               # Inter-plugin event bus (PG NOTIFY)
│   │   │   ├── billing.py              # Plugin billing engine (per school)
│   │   │   └── manifests/              # Each plugin's manifest.yaml
│   │   │       ├── attendance.yaml
│   │   │       ├── fees.yaml
│   │   │       ├── exams.yaml
│   │   │       ├── library.yaml
│   │   │       ├── transport.yaml
│   │   │       ├── social_hub.yaml
│   │   │       ├── lms.yaml
│   │   │       ├── wellbeing.yaml
│   │   │       ├── ... (one per plugin)
│   │   │       └── _template.yaml      # Manifest template for new plugins
│   │   │
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py              # Login, register, OTP, refresh (CORE)
│   │   │   │   ├── super_admin.py       # ASchool owner: all schools + plugin mgmt (CORE)
│   │   │   │   ├── schools.py           # School CRUD, settings, plan management (CORE)
│   │   │   │   ├── plugins.py           # ★ Plugin marketplace API: browse, install, uninstall
│   │   │   │   ├── website.py           # School website builder API
│   │   │   │   ├── themes.py            # Theme management + publish
│   │   │   │   ├── students.py          # Student CRUD, profiles, transfers
│   │   │   │   ├── staff.py             # Teacher + staff management
│   │   │   │   ├── attendance.py        # Mark, view, reports, analytics
│   │   │   │   ├── academics.py         # Subjects, timetable, class management
│   │   │   │   ├── exams.py             # Exam schedule, marks, results
│   │   │   │   ├── assignments.py       # Homework, submissions
│   │   │   │   ├── fees.py              # Fee structure, collection, receipts
│   │   │   │   ├── library.py           # Books, checkout, ISBN lookup
│   │   │   │   ├── transport.py         # Routes, buses, GPS tracking
│   │   │   │   ├── inventory.py         # Assets, QR tracking, procurement
│   │   │   │   ├── hr.py                # Payroll, leaves, appraisal
│   │   │   │   ├── communications.py    # Notices, circulars, announcements
│   │   │   │   ├── messages.py          # Internal school messaging
│   │   │   │   ├── social_hub.py        # FB/IG/TikTok/YouTube management
│   │   │   │   ├── social_boost.py      # Post boosting via Meta Ads API
│   │   │   │   ├── admission.py         # Admission CRM + pipeline
│   │   │   │   ├── visitors.py          # Visitor management
│   │   │   │   ├── health.py            # Student health records
│   │   │   │   ├── alumni.py            # Alumni network
│   │   │   │   ├── analytics.py         # School analytics + AI insights
│   │   │   │   ├── gamification.py      # Badges, points, leaderboards
│   │   │   │   ├── ai_tools.py          # AI endpoints (question paper, remarks, etc.)
│   │   │   │   ├── designer.py          # Canva-like designer API
│   │   │   │   ├── lms.py               # LMS: courses, live classes, content — NEW
│   │   │   │   ├── wellbeing.py         # Student mental health & wellbeing — NEW
│   │   │   │   ├── dismissal.py         # Student pickup & dismissal safety — NEW
│   │   │   │   ├── compliance.py        # Government compliance & MoE reports — NEW
│   │   │   │   ├── emergency.py         # Emergency & disaster management — NEW
│   │   │   │   ├── elibrary.py          # E-library & digital content — NEW
│   │   │   │   ├── conferences.py       # Parent-teacher conference scheduler — NEW
│   │   │   │   ├── portfolio.py         # Student portfolio & achievements — NEW
│   │   │   │   ├── incidents.py         # Incident & behavior management — NEW
│   │   │   │   ├── benchmarking.py      # School-to-school benchmarking — NEW
│   │   │   │   ├── mobile.py            # Flutter-specific optimized endpoints
│   │   │   │   ├── sse.py               # Server-sent events
│   │   │   │   └── webhooks.py
│   │   │   │
│   │   │   └── webhooks/
│   │   │       ├── whatsapp.py          # WhatsApp Cloud API webhook
│   │   │       ├── facebook.py          # FB page comments/DMs
│   │   │       ├── instagram.py         # IG comments/DMs
│   │   │       ├── tiktok.py            # TikTok comments
│   │   │       ├── esewa.py             # eSewa payment callback
│   │   │       ├── khalti.py            # Khalti payment callback
│   │   │       ├── fonepay.py           # FonePay callback
│   │   │       └── gps.py               # ESP32 bus GPS data
│   │   │
│   │   ├── models/
│   │   │   ├── base.py                  # BaseModel: id(UUID), created_at, updated_at, is_deleted
│   │   │   ├── school.py                # School, SchoolPlan, SchoolWebsite, ThemeVersion
│   │   │   ├── plugin.py                # ★ Plugin, SchoolPlugin, PluginUsageLog
│   │   │   ├── user.py                  # User (all roles: superadmin/admin/teacher/parent/student)
│   │   │   ├── student.py               # Student, StudentProfile, Guardian
│   │   │   ├── staff.py                 # Teacher, Staff, Department, Qualification
│   │   │   ├── academic.py              # Class, Section, Subject, Timetable
│   │   │   ├── attendance.py            # AttendanceRecord, AttendanceSummary
│   │   │   ├── exam.py                  # Exam, ExamSchedule, Marks, Result, ReportCard
│   │   │   ├── assignment.py            # Assignment, Submission, Feedback
│   │   │   ├── fee.py                   # FeeStructure, FeeCollection, Receipt, Ledger
│   │   │   ├── library.py               # Book, BookCheckout, BookReservation
│   │   │   ├── transport.py             # Bus, Route, Stop, GPSLog, StudentBus
│   │   │   ├── inventory.py             # Asset, AssetCheckout, MaintenanceLog
│   │   │   ├── hr.py                    # Payroll, Leave, LeaveBalance, Appraisal
│   │   │   ├── communication.py         # Notice, Circular, SMS_Log, Email_Log
│   │   │   ├── social.py                # SocialAccount, Post, Comment, DM, Conversation
│   │   │   ├── ad_campaign.py           # BoostCampaign, AdMetrics
│   │   │   ├── admission.py             # AdmissionLead, AdmissionApplication, Pipeline
│   │   │   ├── visitor.py               # Visitor, VisitorLog
│   │   │   ├── health.py                # StudentHealth, MedicalRecord, Incident
│   │   │   ├── alumni.py                # Alumni, AlumniPost, Mentorship
│   │   │   ├── gamification.py          # Badge, StudentBadge, Points, Leaderboard
│   │   │   ├── analytics.py             # DailyMetric, WeeklyInsight, AIInsight
│   │   │   ├── designer.py              # DesignTemplate, DesignProject, BulkGeneration
│   │   │   ├── lms.py                   # Course, Lesson, LiveClass, StudentProgress — NEW
│   │   │   ├── wellbeing.py             # MoodCheckin, WellbeingSurvey, CounselorSession — NEW
│   │   │   ├── dismissal.py             # DismissalRecord, AuthorizedPickup — NEW
│   │   │   ├── compliance.py            # ComplianceReport, EMISExport — NEW
│   │   │   ├── emergency.py             # EmergencyAlert, EvacuationPlan, Headcount — NEW
│   │   │   ├── digital_content.py       # DigitalBook, OERResource, PastPaper — NEW
│   │   │   ├── conference.py            # PTConference, TimeSlot, ConferenceNotes — NEW
│   │   │   ├── portfolio.py             # StudentPortfolio, Achievement, MicroCredential — NEW
│   │   │   └── incident.py              # Incident, WitnessStatement, ActionLog — NEW
│   │   │
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── question_paper.py    # AI exam generator
│   │   │   │   ├── report_remarks.py    # Auto report card comments
│   │   │   │   ├── lesson_plan.py       # AI lesson plan generator
│   │   │   │   ├── timetable_gen.py     # Clash-free timetable optimizer
│   │   │   │   ├── risk_detector.py     # At-risk student early warning
│   │   │   │   ├── attendance_ai.py     # Attendance pattern analysis
│   │   │   │   ├── fee_predictor.py     # Payment default prediction
│   │   │   │   ├── school_insights.py   # Weekly AI intelligence report
│   │   │   │   ├── admission_bot.py     # Admission inquiry AI handler
│   │   │   │   ├── social_ai.py         # AI reply generator for social
│   │   │   │   ├── content_gen.py       # School content: notices, letters
│   │   │   │   ├── website_designer.py  # AI school website generator
│   │   │   │   ├── translator.py        # Nepali ↔ English translation
│   │   │   │   ├── sentiment.py         # Social comment sentiment
│   │   │   │   ├── plagiarism.py        # Assignment plagiarism check
│   │   │   │   ├── voice_parser.py      # Voice → text → command
│   │   │   │   ├── adaptive_learning.py # AI personalized learning paths — NEW
│   │   │   │   ├── wellbeing_ai.py      # Student wellbeing AI analysis — NEW
│   │   │   │   ├── auto_grader.py       # AI auto-grading for homework — NEW
│   │   │   │   ├── homework_helper.py   # AI tutor chatbot for students — NEW
│   │   │   │   └── benchmarking_ai.py   # School-to-school comparison AI — NEW
│   │   │   │
│   │   │   ├── communications/
│   │   │   │   ├── whatsapp.py          # WhatsApp Cloud API wrapper
│   │   │   │   ├── whatsapp_bot.py      # Two-way WhatsApp bot logic
│   │   │   │   ├── sms.py               # Sparrow SMS wrapper
│   │   │   │   └── email_service.py     # Email templates + sending
│   │   │   │
│   │   │   ├── social/
│   │   │   │   ├── meta_api.py          # Facebook + Instagram Graph API
│   │   │   │   ├── tiktok_api.py        # TikTok for Developers
│   │   │   │   ├── youtube_api.py       # YouTube Data API v3
│   │   │   │   ├── social_hub.py        # Unified multi-platform manager
│   │   │   │   └── post_scheduler.py    # Scheduled posts engine
│   │   │   │
│   │   │   ├── payments/
│   │   │   │   ├── esewa.py             # eSewa fee collection
│   │   │   │   ├── khalti.py            # Khalti fee collection
│   │   │   │   ├── fonepay.py           # FonePay QR
│   │   │   │   └── meta_ads.py          # Meta Marketing API (post boosting)
│   │   │   │
│   │   │   ├── website/
│   │   │   │   ├── theme_engine.py      # School website theme compiler
│   │   │   │   ├── seo_generator.py     # Auto SEO for school pages
│   │   │   │   └── sitemap.py           # Auto sitemap generation
│   │   │   │
│   │   │   ├── designer/
│   │   │   │   ├── canvas_engine.py     # Fabric.js server-side helpers
│   │   │   │   ├── bulk_generator.py    # Bulk ID cards, certificates
│   │   │   │   └── pdf_generator.py     # WeasyPrint PDF generation
│   │   │   │
│   │   │   ├── gps_service.py           # ESP32 GPS data processor
│   │   │   ├── library_isbn.py          # Google Books API ISBN lookup
│   │   │   ├── biometric_sync.py        # ZKTeco fingerprint device sync
│   │   │   ├── notification_engine.py   # Unified: WA + SMS + push + email
│   │   │   │
│   │   │   ├── compliance/              # Government compliance — NEW
│   │   │   │   ├── moe_reports.py       # MoE Flash Report I & II generator
│   │   │   │   └── emis_export.py       # EMIS data format export
│   │   │   │
│   │   │   ├── lms/                     # Learning Management — NEW
│   │   │   │   ├── video_service.py     # Jitsi live class + recording
│   │   │   │   └── content_engine.py    # Course content organization
│   │   │   │
│   │   │   └── emergency/               # Disaster management — NEW
│   │   │       ├── alert_service.py     # Multi-channel emergency broadcast
│   │   │       └── earthquake_api.py    # Nepal Seismological Centre integration
│   │   │
│   │   ├── tasks/                       # Celery background jobs
│   │   │   ├── attendance_alerts.py     # Daily absent parent notification
│   │   │   ├── fee_reminders.py         # Automated 3-touch fee sequence
│   │   │   ├── report_generator.py      # Bulk report card generation
│   │   │   ├── social_scheduler.py      # Scheduled social post publishing
│   │   │   ├── ai_insights_weekly.py    # Weekly AI school report
│   │   │   ├── gps_tracker.py           # Bus location polling + ETA
│   │   │   ├── admission_nurture.py     # Lead follow-up sequences
│   │   │   ├── library_overdue.py       # Overdue book notifications
│   │   │   ├── payroll_monthly.py       # Monthly payroll processing
│   │   │   ├── sitemap_rebuild.py       # School website sitemap rebuild
│   │   │   ├── analytics_aggregate.py   # Daily metric aggregation
│   │   │   └── streak_updater.py        # Student gamification streaks
│   │   │
│   │   └── utils/
│   │       ├── auth.py
│   │       ├── pagination.py
│   │       ├── validators.py
│   │       ├── nepali_date.py           # BS ↔ AD conversion
│   │       ├── nepali_numbers.py        # Nepali numeral formatting
│   │       ├── image_utils.py
│   │       ├── rate_limiter.py
│   │       └── i18n.py                  # Nepali translations
│   │
│   ├── migrations/                      # Alembic migrations
│   └── tests/
│
├── frontend/                            # Next.js 14 Web Dashboards
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── middleware.ts                    # Subdomain routing + auth
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                     # ASchool marketing homepage
│   │   ├── pricing/page.tsx
│   │   ├── features/page.tsx
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── verify-otp/page.tsx
│   │   │
│   │   ├── (super-admin)/               # ASchool owner panel
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                 # All schools overview
│   │   │   ├── schools/
│   │   │   │   ├── page.tsx             # School list + plan management
│   │   │   │   └── [id]/page.tsx        # Individual school settings
│   │   │   ├── revenue/page.tsx         # MRR, ARR, churn dashboard
│   │   │   ├── support/page.tsx         # Help tickets
│   │   │   └── settings/page.tsx
│   │   │
│   │   ├── (dashboard)/                 # School Admin Dashboard
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                 # Command center overview
│   │   │   │
│   │   │   ├── students/
│   │   │   │   ├── page.tsx             # Student directory
│   │   │   │   ├── new/page.tsx
│   │   │   │   ├── [id]/page.tsx        # 360° student profile
│   │   │   │   ├── bulk-import/page.tsx # CSV/Excel bulk import
│   │   │   │   └── transfers/page.tsx
│   │   │   │
│   │   │   ├── staff/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   │
│   │   │   ├── attendance/
│   │   │   │   ├── page.tsx             # Live attendance dashboard
│   │   │   │   ├── mark/page.tsx        # Mark attendance (class-wise)
│   │   │   │   └── reports/page.tsx
│   │   │   │
│   │   │   ├── academics/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── timetable/page.tsx   # AI timetable generator
│   │   │   │   ├── subjects/page.tsx
│   │   │   │   └── classes/page.tsx
│   │   │   │
│   │   │   ├── exams/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── schedule/page.tsx
│   │   │   │   ├── marks/page.tsx
│   │   │   │   ├── results/page.tsx
│   │   │   │   └── report-cards/page.tsx # AI bulk report cards
│   │   │   │
│   │   │   ├── fees/
│   │   │   │   ├── page.tsx             # Fee collection dashboard
│   │   │   │   ├── structure/page.tsx
│   │   │   │   ├── collect/page.tsx     # POS-style fee collection
│   │   │   │   ├── defaulters/page.tsx  # AI-predicted defaulters
│   │   │   │   └── reports/page.tsx
│   │   │   │
│   │   │   ├── library/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── books/page.tsx
│   │   │   │   ├── checkout/page.tsx    # Barcode scan checkout
│   │   │   │   └── overdue/page.tsx
│   │   │   │
│   │   │   ├── transport/
│   │   │   │   ├── page.tsx             # Bus fleet overview
│   │   │   │   ├── routes/page.tsx
│   │   │   │   ├── live-tracking/page.tsx # Real-time GPS map
│   │   │   │   └── saferide/page.tsx    # ESP32 setup guide
│   │   │   │
│   │   │   ├── communications/
│   │   │   │   ├── page.tsx             # Unified send center
│   │   │   │   ├── notices/page.tsx     # School circular + notice
│   │   │   │   ├── broadcast/page.tsx   # Bulk WhatsApp/SMS campaigns
│   │   │   │   └── templates/page.tsx
│   │   │   │
│   │   │   ├── social-hub/
│   │   │   │   ├── page.tsx             # Unified social inbox
│   │   │   │   ├── compose/page.tsx     # Create + schedule post
│   │   │   │   ├── boost/page.tsx       # Post boosting (Meta Ads)
│   │   │   │   ├── ai-replies/page.tsx  # AI reply settings
│   │   │   │   └── analytics/page.tsx   # Social media analytics
│   │   │   │
│   │   │   ├── admission/
│   │   │   │   ├── page.tsx             # Admission pipeline (Kanban)
│   │   │   │   ├── leads/page.tsx
│   │   │   │   ├── applications/page.tsx
│   │   │   │   └── settings/page.tsx    # Admission form builder
│   │   │   │
│   │   │   ├── website-builder/         # School Website Builder
│   │   │   │   ├── page.tsx             # Builder entry + preview
│   │   │   │   ├── themes/page.tsx      # 20 school themes
│   │   │   │   ├── editor/page.tsx      # Craft.js drag-drop editor
│   │   │   │   ├── ai-builder/page.tsx  # Prompt → school website
│   │   │   │   ├── pages/page.tsx       # Manage website pages
│   │   │   │   ├── domain/page.tsx      # Custom domain setup
│   │   │   │   └── seo/page.tsx         # SEO settings
│   │   │   │
│   │   │   ├── designer/
│   │   │   │   ├── page.tsx             # School design studio
│   │   │   │   ├── templates/page.tsx   # All template categories
│   │   │   │   ├── editor/page.tsx      # Fabric.js canvas editor
│   │   │   │   └── bulk/page.tsx        # Bulk ID cards, certificates
│   │   │   │
│   │   │   ├── ai-tools/
│   │   │   │   ├── page.tsx             # AI Tools Hub
│   │   │   │   ├── question-paper/page.tsx
│   │   │   │   ├── lesson-plan/page.tsx
│   │   │   │   ├── timetable/page.tsx
│   │   │   │   ├── report-remarks/page.tsx
│   │   │   │   ├── letter-writer/page.tsx
│   │   │   │   └── insights/page.tsx    # AI school intelligence
│   │   │   │
│   │   │   ├── hr/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── payroll/page.tsx     # Monthly payroll + slips
│   │   │   │   ├── leaves/page.tsx
│   │   │   │   └── appraisal/page.tsx
│   │   │   │
│   │   │   ├── inventory/page.tsx
│   │   │   ├── visitors/page.tsx
│   │   │   ├── health/page.tsx
│   │   │   ├── alumni/page.tsx
│   │   │   ├── gamification/page.tsx
│   │   │   ├── analytics/
│   │   │   │   ├── page.tsx             # Full analytics dashboard
│   │   │   │   ├── academic/page.tsx
│   │   │   │   ├── financial/page.tsx
│   │   │   │   └── ai-report/page.tsx   # Weekly AI insights
│   │   │   │
│   │   │   ├── lms/                     # Learning Management — NEW
│   │   │   │   ├── page.tsx             # LMS dashboard
│   │   │   │   ├── courses/page.tsx     # Course builder
│   │   │   │   ├── live-classes/page.tsx # Schedule & join live classes
│   │   │   │   ├── recordings/page.tsx  # Recorded class library
│   │   │   │   └── ai-tutor/page.tsx    # AI tutor settings
│   │   │   │
│   │   │   ├── wellbeing/               # Student Wellbeing — NEW
│   │   │   │   ├── page.tsx             # Wellbeing dashboard
│   │   │   │   ├── mood-tracker/page.tsx  # Class mood overview
│   │   │   │   ├── counselor/page.tsx   # Counselor session management
│   │   │   │   └── reports/page.tsx     # Bullying & incident reports
│   │   │   │
│   │   │   ├── dismissal/              # Student Pickup — NEW
│   │   │   │   ├── page.tsx            # Daily dismissal dashboard
│   │   │   │   └── settings/page.tsx   # Authorized pickup management
│   │   │   │
│   │   │   ├── compliance/             # Government Reports — NEW
│   │   │   │   ├── page.tsx            # Compliance dashboard
│   │   │   │   └── reports/page.tsx    # Generate MoE/EMIS reports
│   │   │   │
│   │   │   ├── emergency/              # Emergency Module — NEW
│   │   │   │   ├── page.tsx            # Emergency control center
│   │   │   │   ├── plans/page.tsx      # Evacuation plans
│   │   │   │   └── drills/page.tsx     # Drill scheduling
│   │   │   │
│   │   │   ├── elibrary/              # E-Library — NEW
│   │   │   │   ├── page.tsx           # Digital library dashboard
│   │   │   │   ├── books/page.tsx     # Digital book collection
│   │   │   │   └── past-papers/page.tsx # Past exam papers archive
│   │   │   │
│   │   │   ├── conferences/           # PT Conferences — NEW
│   │   │   │   ├── page.tsx           # Upcoming conferences
│   │   │   │   └── schedule/page.tsx  # Teacher slot management
│   │   │   │
│   │   │   ├── incidents/             # Incident Management — NEW
│   │   │   │   ├── page.tsx           # Incident dashboard
│   │   │   │   └── report/page.tsx    # Report new incident
│   │   │   │
│   │   │   ├── benchmarking/page.tsx  # School Benchmarking — NEW
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── general/page.tsx
│   │   │       ├── branding/page.tsx
│   │   │       ├── payments/page.tsx
│   │   │       ├── whatsapp/page.tsx    # WA Business setup
│   │   │       ├── social/page.tsx      # Social accounts connect
│   │   │       ├── notifications/page.tsx
│   │   │       ├── roles/page.tsx
│   │   │       ├── api/page.tsx
│   │   │       ├── plugins/page.tsx     # ★ Installed plugins manager
│   │   │       └── plan/page.tsx        # Subscription management
│   │   │
│   │   ├── (marketplace)/              # ★ PLUGIN MARKETPLACE
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                # Browse all plugins (grid view)
│   │   │   ├── [slug]/page.tsx         # Plugin detail: screenshots, pricing, install
│   │   │   └── installed/page.tsx      # My installed plugins + billing
│   │   │
│   │   ├── (teacher)/                   # Teacher Portal
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                 # Teacher dashboard
│   │   │   ├── attendance/page.tsx      # Take attendance (voice + tap)
│   │   │   ├── assignments/page.tsx     # Create, grade assignments
│   │   │   ├── marks/page.tsx           # Enter marks
│   │   │   ├── timetable/page.tsx       # My schedule
│   │   │   ├── ai-tools/page.tsx        # Question paper, lesson plan
│   │   │   ├── messages/page.tsx
│   │   │   └── leaves/page.tsx
│   │   │
│   │   ├── (parent)/                    # Parent Portal
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                 # My children overview
│   │   │   ├── attendance/page.tsx
│   │   │   ├── results/page.tsx
│   │   │   ├── fees/page.tsx            # Pay fees via eSewa/Khalti
│   │   │   ├── bus/page.tsx             # Live bus tracking
│   │   │   ├── messages/page.tsx
│   │   │   └── notices/page.tsx
│   │   │
│   │   ├── (student)/                   # Student Portal
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── timetable/page.tsx
│   │   │   ├── assignments/page.tsx
│   │   │   ├── results/page.tsx
│   │   │   ├── library/page.tsx
│   │   │   └── achievements/page.tsx    # Badges + gamification
│   │   │
│   │   └── school/                      # PUBLIC SCHOOL WEBSITES (SSR)
│   │       └── [slug]/
│   │           ├── layout.tsx           # School theme shell
│   │           ├── page.tsx             # School homepage
│   │           ├── about/page.tsx
│   │           ├── academics/page.tsx
│   │           ├── teachers/page.tsx    # Auto-synced teacher directory
│   │           ├── facilities/page.tsx
│   │           ├── events/page.tsx      # Auto-synced from SMS
│   │           ├── news/
│   │           │   ├── page.tsx
│   │           │   └── [slug]/page.tsx
│   │           ├── gallery/page.tsx
│   │           ├── results/page.tsx     # Public result checker
│   │           ├── alumni/page.tsx
│   │           ├── admission/page.tsx   # Live admission form → CRM
│   │           └── contact/page.tsx
│   │
│   ├── components/
│   │   ├── ui/                          # shadcn/ui
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx              # ★ PLUGIN-AWARE: dynamically renders menu from installed plugins
│   │   │   ├── TopNav.tsx
│   │   │   ├── CommandCenter.tsx        # Principal morning dashboard
│   │   │   ├── AttendanceLive.tsx       # Real-time attendance ticker
│   │   │   ├── FeeCollection.tsx        # POS-style fee collection UI
│   │   │   ├── RiskAlert.tsx            # AI early warning cards
│   │   │   ├── BusTracker.tsx           # Live map with bus markers
│   │   │   ├── SocialInbox.tsx          # Unified social messages
│   │   │   ├── AIInsightCard.tsx
│   │   │   └── PluginGate.tsx           # ★ Wrapper: shows install prompt if plugin missing
│   │   ├── marketplace/
│   │   │   ├── PluginCard.tsx           # ★ Plugin card: icon, name, price, install button
│   │   │   ├── PluginDetail.tsx         # ★ Full plugin page: screenshots, description, reviews
│   │   │   ├── InstallButton.tsx        # ★ Install/trial/uninstall button with billing flow
│   │   │   ├── CategoryFilter.tsx       # ★ Filter: Free, Starter, Growth, Premium
│   │   │   └── InstalledPlugins.tsx     # ★ Manage installed plugins list
│   │   ├── website-builder/
│   │   │   ├── ThemeCard.tsx
│   │   │   ├── BlockEditor.tsx          # Craft.js canvas
│   │   │   ├── BlockPanel.tsx           # School-specific blocks
│   │   │   ├── StylePanel.tsx
│   │   │   ├── AIWebsitePrompt.tsx
│   │   │   └── DevicePreview.tsx
│   │   ├── designer/
│   │   │   ├── CanvasEditor.tsx         # Fabric.js wrapper
│   │   │   ├── TemplateGrid.tsx
│   │   │   └── BulkGenerator.tsx
│   │   └── school/                      # Public website components
│   │       ├── SchoolHeader.tsx
│   │       ├── HeroSection.tsx
│   │       ├── EventsWidget.tsx         # Live-synced from SMS
│   │       ├── ResultChecker.tsx
│   │       ├── AdmissionForm.tsx        # Connected to CRM
│   │       └── GalleryGrid.tsx
│   │
│   ├── themes/                          # 20 School Website Themes
│   │   ├── registry.ts
│   │   ├── government/                  # GON school look
│   │   ├── private-classic/             # Traditional private school
│   │   ├── modern-minimal/              # Clean modern look
│   │   ├── montessori/                  # Colorful, playful
│   │   ├── tech-school/                 # Technical/vocational
│   │   ├── boarding/                    # Boarding school style
│   │   ├── international/               # IB/Cambridge look
│   │   ├── nepal-heritage/              # Nepal culture inspired
│   │   ├── community/                   # Simple community school
│   │   ├── college/                     # +2/Degree college
│   │   ├── primary-colorful/            # Bright for younger kids
│   │   ├── secondary-professional/      # Professional grade 8-12
│   │   ├── sports-school/               # Sports academy
│   │   ├── arts-school/                 # Arts & creative school
│   │   ├── religious/                   # Faith-based schools
│   │   ├── girls-school/                # Girls' schools
│   │   ├── language-school/             # Language institutes
│   │   ├── science-school/              # Science-focused
│   │   ├── dark-premium/                # Dark, premium look
│   │   └── festival-auto/               # Auto-switches for festivals
│   │
│   └── lib/
│       ├── api.ts
│       ├── auth.ts
│       ├── store.ts                     # Zustand global state
│       ├── socket.ts
│       ├── theme-engine.ts
│       ├── nepali-utils.ts              # BS dates, NPR format
│       ├── plugins.ts                   # ★ Plugin hooks: useInstalledPlugins(), usePluginSidebar()
│       └── plugin-gate.ts              # ★ PluginGate component: conditional render by plugin
│
├── flutter_admin/                       # ASchool Admin Flutter App
│   ├── pubspec.yaml
│   └── lib/
│       ├── main.dart
│       ├── features/
│       │   ├── dashboard/               # Principal command center
│       │   ├── students/                # Full student management
│       │   ├── attendance/              # Mark + view reports
│       │   ├── fees/                    # POS fee collection + reports
│       │   ├── exams/                   # Results, report cards
│       │   ├── staff/                   # Staff management
│       │   ├── transport/               # Bus fleet + live GPS
│       │   ├── social_hub/              # Social media management
│       │   ├── ai_tools/                # All AI features
│       │   ├── analytics/               # Charts + AI insights
│       │   ├── compliance/              # MoE reports, EMIS export — NEW
│       │   ├── emergency/               # Emergency alerts, drills — NEW
│       │   ├── lms/                     # Course management, live classes — NEW
│       │   ├── dismissal/               # Student pickup management — NEW
│       │   ├── incidents/               # Behavior/incident tracking — NEW
│       │   ├── benchmarking/            # School-to-school comparison — NEW
│       │   └── settings/
│       └── shared/
│           ├── services/
│           │   ├── offline_sync.dart    # Isar + background sync
│           │   ├── notification.dart    # FCM + local notifications
│           │   ├── socket_service.dart  # Real-time events
│           │   └── plugin_provider.dart # ★ Plugin system: fetch installed plugins, show/hide features
│           ├── widgets/
│           │   └── plugin_gate.dart     # ★ Widget wrapper: shows feature only if plugin installed
│           └── models/
│               └── plugin_manifest.dart # ★ Freezed model for plugin data
│
├── flutter_teacher/                     # Teacher Flutter App
│   └── lib/
│       ├── features/
│       │   ├── attendance/              # Voice + tap attendance
│       │   ├── marks/                   # Enter marks, bulk upload
│       │   ├── assignments/             # Create, review, grade
│       │   ├── timetable/               # My class schedule
│       │   ├── ai_tools/                # Question paper, lesson plan
│       │   ├── messages/                # Parent communication
│       │   ├── leaves/                  # Apply + track leaves
│       │   ├── lms/                     # Course builder, live class, recordings — NEW
│       │   ├── auto_grading/            # AI homework grading — NEW
│       │   ├── wellbeing/               # Student mood overview — NEW
│       │   ├── incidents/               # Report/track behavior incidents — NEW
│       │   ├── conferences/             # PT conference slot management — NEW
│       │   └── portfolio/               # Student portfolio review — NEW
│       └── shared/
│
├── flutter_parent/                      # Parent Flutter App (Most Used)
│   └── lib/
│       ├── features/
│       │   ├── children/                # My children switcher
│       │   ├── attendance/              # Child attendance + history
│       │   ├── results/                 # Marks, report cards
│       │   ├── fees/                    # Pay via eSewa/Khalti
│       │   ├── bus_tracker/             # Live GPS map + ETA alerts
│       │   ├── notices/                 # School announcements
│       │   ├── assignments/             # Child's homework
│       │   ├── messages/                # Teacher messaging
│       │   ├── health/                  # Child health records
│       │   ├── wellbeing/               # Child mood & wellbeing view — NEW
│       │   ├── dismissal/               # QR pickup, authorize pickups — NEW
│       │   ├── conferences/             # Book PT conference slots — NEW
│       │   ├── portfolio/               # View child's digital portfolio — NEW
│       │   ├── elibrary/                # Browse e-books & past papers — NEW
│       │   └── emergency/               # Emergency alerts & safe status — NEW
│       └── shared/
│
├── flutter_student/                     # Student Flutter App
│   └── lib/
│       ├── features/
│       │   ├── dashboard/               # Today's schedule, homework
│       │   ├── timetable/               # Class schedule
│       │   ├── assignments/             # Submit, view feedback
│       │   ├── results/                 # Marks + AI study tips
│       │   ├── library/                 # Catalog + checkout status
│       │   ├── achievements/            # Badges, points, leaderboard
│       │   ├── school_feed/             # School news + events
│       │   ├── lms/                     # Video classes, course content — NEW
│       │   ├── elibrary/                # E-books, past papers, resources — NEW
│       │   ├── portfolio/               # Build digital portfolio — NEW
│       │   ├── ai_tutor/                # AI homework helper chatbot — NEW
│       │   └── wellbeing/               # Mood check-in, counselor chat — NEW
│       └── shared/
│
├── hardware/                            # GPS SafeRide DIY Guide
│   ├── ESP32_GPS_tracker/
│   │   ├── firmware.ino                 # Arduino ESP32 + NEO-6M + SIM800L
│   │   └── wiring_diagram.png
│   └── README.md
│
├── nginx/
│   └── nginx.conf                       # Subdomain routing config
│
├── docker-compose.yml
├── docker-compose.prod.yml
└── docs/
    ├── api-reference.md
    ├── theme-development.md
    ├── flutter-setup.md
    └── deployment.md
```

---

# ═══════════════════════════════════════════════════════════════════════
# PART 3: DATABASE MODELS — COMPLETE IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════════════

Generate complete SQLAlchemy models. All models extend BaseModel with:
`id (UUID PK), created_at, updated_at, is_deleted (soft delete), school_id (FK, mandatory)`
Every DB query MUST filter by school_id — StoreIsolationError if missing.

## backend/app/models/school.py

```python
class School(BaseModel):
    __tablename__ = 'schools'

    # Identity
    name = Column(String(300), nullable=False)
    name_nepali = Column(String(300))
    slug = Column(String(100), unique=True)         # bdps → bdps.aschool.com.np
    custom_domain = Column(String(255))             # www.bdps.edu.np
    logo_url = Column(Text)
    favicon_url = Column(Text)
    banner_url = Column(Text)

    # Plan & Status
    plan = Column(Enum('free','starter','growth','enterprise'), default='free')
    plan_expires_at = Column(DateTime)
    status = Column(Enum('trial','active','suspended','cancelled'), default='trial')
    trial_ends_at = Column(DateTime)
    owner_id = Column(UUID, ForeignKey('users.id'))
    max_students = Column(Integer, default=100)     # Limit per plan tier

    # School Info
    type = Column(Enum('government','private','community','boarding',
                       'international','technical','college'))
    level = Column(Enum('primary','secondary','higher_secondary','college','all'))
    established_year_bs = Column(String(4))        # BS year
    established_year_ad = Column(Integer)
    affiliated_to = Column(String(200))            # SEE, NEB, Cambridge, IB
    regd_number = Column(String(100))
    pan_number = Column(String(20))

    # Location
    province = Column(String(100))
    district = Column(String(100))
    municipality = Column(String(100))
    ward = Column(String(10))
    address = Column(Text)
    latitude = Column(Numeric(10,7))
    longitude = Column(Numeric(10,7))
    google_maps_url = Column(Text)

    # Contact
    phone = Column(String(20))
    phone_2 = Column(String(20))
    email = Column(String(200))
    website_external = Column(String(200))         # Their existing site (if any)

    # Social Accounts
    facebook_page_id = Column(String(200))
    facebook_page_token = Column(Text)             # Encrypted
    facebook_ad_account_id = Column(String(100))  # For post boosting
    instagram_account_id = Column(String(200))
    instagram_token = Column(Text)
    tiktok_handle = Column(String(100))
    tiktok_token = Column(Text)
    youtube_channel_id = Column(String(100))
    youtube_token = Column(Text)
    whatsapp_number = Column(String(20))
    whatsapp_phone_number_id = Column(String(100)) # Meta WA Cloud API
    whatsapp_token = Column(Text)

    # Configuration (JSONB)
    settings = Column(JSONB, default={})           # General
    website_config = Column(JSONB, default={})     # School website builder config
    ai_config = Column(JSONB, default={})          # AI settings per module
    fee_config = Column(JSONB, default={})         # Fee structure config
    exam_config = Column(JSONB, default={})        # Grading scheme, GPA
    notification_config = Column(JSONB, default={})
    social_ai_config = Column(JSONB, default={})   # AI reply settings
    gamification_config = Column(JSONB, default={})
    admission_config = Column(JSONB, default={})

    # ★ PLUGIN-BASED: No more hardcoded feature flags!
    # Instead of is_gps_enabled, is_social_hub_enabled, etc.
    # All features are controlled via SchoolPlugin records.
    # school.installed_plugins → returns list of active plugin slugs
    # Use: @plugin_required('gps_tracking') decorator on routes
    # Frontend: useInstalledPlugins() hook checks before rendering
    # Flutter: PluginProvider checks before showing feature tabs
    is_multichain = Column(Boolean, default=False)  # Chain school (kept: infra-level flag)

    # Calendar
    academic_year_start_bs = Column(String(10))    # "2081-01-01"
    academic_year_end_bs = Column(String(10))
    working_days = Column(ARRAY(String))            # ["Sunday","Monday",...]
    school_start_time = Column(Time)
    school_end_time = Column(Time)

    # Denormalized metrics (updated by background tasks)
    total_students = Column(Integer, default=0)
    total_staff = Column(Integer, default=0)
    total_revenue_ytd = Column(Numeric(15,2), default=0)
    fee_collection_rate = Column(Numeric(5,2))

    # Currency & Language
    currency = Column(String(3), default='NPR')
    default_language = Column(String(10), default='ne')  # ne=Nepali, en=English

class SchoolWebsite(BaseModel):
    """Published school website configuration"""
    school_id, theme_slug, customizations (JSONB),
    active_theme_version_id, draft_config (JSONB),
    is_published, published_at, custom_css,
    google_analytics_id, facebook_pixel_id,
    meta_title, meta_description, og_image_url

class SchemeGrade(BaseModel):
    """Grading scheme per school (A+, A, B+, etc. or percentage)"""
    school_id, name, type (ENUM: letter/gpa/percentage),
    ranges (JSONB)  # [{min:90, max:100, grade:"A+", gpa:4.0, remark:"Distinction"}]
```

## ★ backend/app/models/plugin.py — PLUGIN SYSTEM CORE

```python
class Plugin(BaseModel):
    """
    Master plugin registry — managed by ASchool super admin.
    Each row = one installable plugin definition.
    """
    __tablename__ = 'plugins'

    # Identity
    slug = Column(String(100), unique=True, nullable=False)  # 'lms', 'gps_tracking', 'fees'
    name = Column(String(200), nullable=False)                # 'Learning Management System'
    name_nepali = Column(String(200))                         # 'शिक्षण व्यवस्थापन प्रणाली'
    description = Column(Text)
    description_nepali = Column(Text)
    icon = Column(String(50))                                 # 'BookOpen', 'Bus', 'CreditCard'
    emoji = Column(String(10))                                # '📹', '🚌', '💰'
    category = Column(Enum(
        'core',           # Free plugins (attendance, notices, academic_setup, basic_website, basic_reports)
        'starter',        # Rs. 199-499/month
        'growth',         # Rs. 499-999/month
        'premium',        # Rs. 999-2999/month
        'add_on'          # Pay-per-use credits
    ), nullable=False)
    
    # Pricing
    price_monthly = Column(Numeric(10,2), default=0)         # Rs. per month (0 = free)
    price_yearly = Column(Numeric(10,2), default=0)          # Rs. per year (discounted)
    is_free = Column(Boolean, default=False)                  # True for core plugins
    trial_days = Column(Integer, default=14)                  # Free trial per plugin

    # Technical
    version = Column(String(20), default='1.0.0')
    api_blueprint = Column(String(100))                       # 'app.api.v1.lms' → Flask blueprint path
    models_module = Column(String(100))                       # 'app.models.lms' → SQLAlchemy models
    frontend_route = Column(String(100))                      # '/lms' → Next.js dashboard route
    flutter_feature = Column(String(100))                     # 'lms' → Flutter feature folder name
    frontend_sidebar_config = Column(JSONB)                   # {label, icon, route, subitems[], roles[]}
    
    # Dependencies (other plugins required)
    depends_on = Column(ARRAY(String), default=[])            # ['attendance'] → must install attendance first
    conflicts_with = Column(ARRAY(String), default=[])        # plugins that can't coexist
    
    # Who can see this plugin (role-based visibility)
    visible_to_roles = Column(ARRAY(String), default=[        # Which roles see this in their app
        'school_admin', 'teacher', 'parent', 'student'
    ])
    
    # Marketplace display
    screenshots = Column(ARRAY(Text), default=[])
    video_demo_url = Column(Text)
    tags = Column(ARRAY(String), default=[])                  # ['attendance', 'safety', 'ai']
    sort_order = Column(Integer, default=0)                   # Display order in marketplace
    is_featured = Column(Boolean, default=False)
    is_published = Column(Boolean, default=True)              # Hidden if unpublished
    
    # Stats (denormalized for fast display)
    install_count = Column(Integer, default=0)                # How many schools installed
    avg_rating = Column(Numeric(2,1), default=0)
    
    # school_id = NULL → this is a platform-level record, not per-school


class SchoolPlugin(BaseModel):
    """
    Per-school plugin installation record.
    If row exists + active=True → school has this plugin.
    """
    __tablename__ = 'school_plugins'
    __table_args__ = (
        UniqueConstraint('school_id', 'plugin_slug'),
    )

    school_id = Column(UUID, ForeignKey('schools.id'), nullable=False)
    plugin_slug = Column(String(100), ForeignKey('plugins.slug'), nullable=False)
    
    # Status
    active = Column(Boolean, default=True)                    # False = uninstalled but data kept
    installed_at = Column(DateTime, default=func.now())
    uninstalled_at = Column(DateTime, nullable=True)
    
    # Billing
    billing_cycle = Column(Enum('monthly', 'yearly'), default='monthly')
    trial_started_at = Column(DateTime)
    trial_ends_at = Column(DateTime)
    is_trial = Column(Boolean, default=True)                  # True during trial period
    next_billing_date = Column(Date)
    
    # Configuration per-school overrides
    config = Column(JSONB, default={})                        # Plugin-specific settings
    
    # Relations
    plugin = relationship('Plugin')
    school = relationship('School', backref='installed_plugins')


class PluginUsageLog(BaseModel):
    """Track API calls per plugin per school (for usage-based billing)"""
    __tablename__ = 'plugin_usage_logs'
    
    school_id = Column(UUID, ForeignKey('schools.id'), nullable=False)
    plugin_slug = Column(String(100), nullable=False)
    action = Column(String(100))                              # 'ai_generate', 'sms_send', 'wa_send'
    usage_count = Column(Integer, default=1)
    usage_date = Column(Date, default=func.current_date())
    cost = Column(Numeric(10,2), default=0)                   # Cost in Rs.
```

### Plugin Manifest Example — backend/app/plugins/manifests/lms.yaml
```yaml
slug: lms
name: "Learning Management System"
name_nepali: "शिक्षण व्यवस्थापन प्रणाली"
category: growth
price_monthly: 799
price_yearly: 7999
emoji: "📹"
icon: "MonitorPlay"
description: "Live classes via Jitsi, recorded class library, course builder, AI adaptive learning paths, student watch analytics"

# Technical registration
api_blueprint: "app.api.v1.lms"
models_module: "app.models.lms"
services:
  - "app.services.lms.video_service"
  - "app.services.lms.content_engine"
  - "app.services.ai.adaptive_learning"
tasks:
  - "app.tasks.lms_video_processor"

# Dependencies
depends_on:
  - attendance        # Need student roster
  - academics         # Need class/section/subject structure
conflicts_with: []

# Frontend (Next.js) — auto-registered in sidebar
frontend:
  route: "/lms"
  sidebar:
    label: "LMS"
    label_nepali: "एल.एम.एस"
    icon: "MonitorPlay"
    subitems:
      - { label: "Dashboard", route: "/lms" }
      - { label: "Courses", route: "/lms/courses" }
      - { label: "Live Classes", route: "/lms/live-classes" }
      - { label: "Recordings", route: "/lms/recordings" }
      - { label: "AI Tutor", route: "/lms/ai-tutor" }
    visible_to: ["school_admin", "teacher"]

# Flutter — per-app feature mapping
flutter:
  admin_app:
    feature_folder: "lms"
    tabs: ["Course Management", "Live Class Schedule"]
  teacher_app:
    feature_folder: "lms"
    tabs: ["My Courses", "Start Live Class", "Recordings"]
  parent_app:
    feature_folder: "lms"
    tabs: ["Child's Courses", "Watch History"]
  student_app:
    feature_folder: "lms"
    tabs: ["My Courses", "Live Classes", "Recordings"]

# Events this plugin emits/listens to
events:
  emits:
    - "lms.class_started"
    - "lms.class_ended"
    - "lms.course_completed"
  listens:
    - "attendance.marked"      # Show attendance in live class
    - "exams.result_published" # Update course grade
```

### Plugin Manifest Example — backend/app/plugins/manifests/fees.yaml
```yaml
slug: fees
name: "Fee Collection & Management"
name_nepali: "शुल्क संकलन"
category: starter
price_monthly: 399
price_yearly: 3999
emoji: "💰"
icon: "CreditCard"
description: "Digital fee structure, collection, receipts, eSewa/Khalti payment, defaulter tracking, automatic reminders"

api_blueprint: "app.api.v1.fees"
models_module: "app.models.fee"
services:
  - "app.services.payments.esewa"
  - "app.services.payments.khalti"
  - "app.services.payments.fonepay"
tasks:
  - "app.tasks.fee_reminders"

depends_on: []    # No dependencies — can be first plugin installed
conflicts_with: []

frontend:
  route: "/fees"
  sidebar:
    label: "Fee Collection"
    label_nepali: "शुल्क संकलन"
    icon: "CreditCard"
    subitems:
      - { label: "Dashboard", route: "/fees" }
      - { label: "Structure", route: "/fees/structure" }
      - { label: "Collect", route: "/fees/collect" }
      - { label: "Defaulters", route: "/fees/defaulters" }
      - { label: "Reports", route: "/fees/reports" }
    visible_to: ["school_admin", "accountant"]

flutter:
  admin_app: { feature_folder: "fees", tabs: ["POS Collection", "Fee Reports", "Defaulters"] }
  teacher_app: null     # Teachers don't use fees
  parent_app: { feature_folder: "fees", tabs: ["Pay Fees", "Payment History", "Receipts"] }
  student_app: null     # Students don't see fees
```

## backend/app/models/user.py

```python
class User(BaseModel):
    __tablename__ = 'users'

    school_id = Column(UUID, ForeignKey('schools.id'))  # NULL for superadmin
    role = Column(Enum(
        'superadmin',    # ASchool platform owner
        'school_admin',  # Principal, vice-principal
        'accountant',    # Fee management only
        'teacher',       # Academic + attendance
        'staff',         # Non-teaching staff
        'parent',        # Parent/guardian
        'student'        # Student
    ), nullable=False)

    # Profile
    full_name = Column(String(300), nullable=False)
    full_name_nepali = Column(String(300))
    email = Column(String(200))
    phone = Column(String(20), nullable=False)
    phone_verified = Column(Boolean, default=False)
    avatar_url = Column(Text)
    gender = Column(Enum('male','female','other'))
    dob_bs = Column(String(10))     # Bikram Sambat DOB
    dob_ad = Column(Date)
    address = Column(JSONB)

    # Auth
    password_hash = Column(String(255))
    otp_code = Column(String(6))
    otp_expires_at = Column(DateTime)
    last_login_at = Column(DateTime)
    is_active = Column(Boolean, default=True)

    # Push Notifications
    fcm_tokens = Column(ARRAY(Text))    # Multiple devices

    # Language Preference
    preferred_language = Column(String(10), default='ne')

    # Permissions override (JSON: {module: [read,write,delete]})
    permissions = Column(JSONB, default={})
```

## backend/app/models/student.py

```python
class Student(BaseModel):
    __tablename__ = 'students'

    school_id, user_id FK(User)

    # Academic
    student_id = Column(String(50))        # School-assigned ID: "BDPS-2025-001"
    roll_number = Column(Integer)
    class_id = Column(UUID, FK)
    section_id = Column(UUID, FK)
    academic_year = Column(String(10))     # "2081-82"
    admission_date_bs = Column(String(10))
    admission_date_ad = Column(Date)
    admission_number = Column(String(50))

    # Personal
    nationality = Column(String(100), default='Nepali')
    religion = Column(String(100))
    ethnicity = Column(String(100))
    blood_group = Column(String(5))
    disability = Column(String(200))
    previous_school = Column(String(300))
    transport_enrolled = Column(Boolean, default=False)
    bus_stop_id = Column(UUID, FK)

    # Status
    status = Column(Enum('active','transferred_in','transferred_out',
                         'dropped_out','graduated','on_leave'))

    # Documents
    photo_url = Column(Text)
    birth_cert_url = Column(Text)
    character_cert_url = Column(Text)

    # AI
    risk_score = Column(Float)             # 0-1, updated weekly
    risk_level = Column(Enum('low','medium','high','critical'))
    learning_style = Column(String(50))    # visual/auditory/kinesthetic (AI-detected)
    strengths = Column(ARRAY(Text))
    weaknesses = Column(ARRAY(Text))
    embedding = Column(Vector(1536))       # pgvector for semantic search

    # Gamification
    total_points = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)

class Guardian(BaseModel):
    student_id, user_id FK(User),
    relation = Enum('father','mother','guardian','other'),
    is_primary = Boolean,
    occupation, annual_income_range,
    education_level, workplace

class StudentHealthRecord(BaseModel):
    student_id, height_cm, weight_kg, blood_group,
    allergies (ARRAY), chronic_conditions (ARRAY),
    vaccination_records (JSONB), emergency_contact,
    doctor_name, doctor_phone, insurance_info (JSONB),
    last_checkup_date, notes
```

## backend/app/models/exam.py

```python
class Exam(BaseModel):
    school_id, name, name_nepali,
    exam_type = Enum('unit_test','terminal','annual','pre_board','board_trial'),
    class_id, subject_ids (ARRAY),
    start_date_bs, end_date_bs,
    total_marks, pass_marks,
    is_practical = Boolean,
    practical_marks = Integer,
    status = Enum('scheduled','ongoing','completed','result_published')

class Marks(BaseModel):
    exam_id, student_id, subject_id, teacher_id,
    theory_marks = Numeric, practical_marks = Numeric,
    total_marks = Numeric, grade = String, gpa = Numeric,
    rank_in_class = Integer, rank_in_section = Integer,
    remarks = Text, is_absent = Boolean, is_withheld = Boolean

class ReportCard(BaseModel):
    student_id, exam_id, school_id,
    generated_at, pdf_url, ai_remarks = Text,
    ai_remarks_nepali = Text,
    total_percentage, overall_grade, overall_gpa,
    rank_in_class, attendance_percentage,
    teacher_remarks = Text, principal_remarks = Text,
    parent_signature_required = Boolean, signed_at
```

## backend/app/models/fee.py

```python
class FeeStructure(BaseModel):
    school_id, class_id (nullable — school-wide if null),
    academic_year, fee_items (JSONB),
    # [{name:"Tuition", amount:5000, due_day:1, is_monthly:True},
    #  {name:"Exam Fee", amount:800, due_month:3, is_once:True}]
    total_annual, total_monthly

class FeeCollection(BaseModel):
    school_id, student_id, academic_year,
    fee_item_name, amount, month_bs, year_bs,
    payment_method = Enum('cash','esewa','khalti','fonepay','bank','cheque'),
    transaction_id, receipt_number,
    collected_by_id FK(User), collected_at,
    late_fine_amount = Numeric, discount_amount = Numeric,
    is_scholarship = Boolean,
    payment_status = Enum('paid','pending','partial','waived'),
    notes, receipt_url

class FeeReceipt(BaseModel):
    collection_id FK, student_id, school_id,
    receipt_number, pdf_url, qr_code_url,
    sent_via_whatsapp = Boolean, sent_at,
    verified_hash  # For receipt authenticity
```

## backend/app/models/transport.py

```python
class Bus(BaseModel):
    school_id, vehicle_number, driver_id FK(User),
    conductor_id FK(User), capacity, current_students_count,
    gps_device_id,  # ESP32 device ID
    make, model, year, insurance_expiry,
    route_id FK(Route),
    is_active = Boolean

class GPSLog(BaseModel):
    bus_id, latitude, longitude,
    speed_kmh, heading, accuracy_m,
    timestamp, firebase_synced = Boolean
    # Stored every 15-20 seconds from ESP32

class BusStop(BaseModel):
    school_id, route_id, name, name_nepali,
    latitude, longitude, sequence_number,
    arrival_time_am, arrival_time_pm,
    student_ids (ARRAY)  # Students at this stop
```

## backend/app/models/social.py

```python
class SocialAccount(BaseModel):
    school_id, platform = Enum('facebook','instagram','tiktok','youtube'),
    account_id, account_name, access_token (encrypted),
    token_expires_at, page_id, page_name,
    follower_count, is_active, connected_at,
    ai_auto_reply = Boolean, ai_reply_mode = Enum('full_auto','draft_approve'),
    ai_reply_language = Enum('nepali','english','auto')

class SocialPost(BaseModel):
    school_id, platforms (ARRAY),  # ['facebook','instagram']
    content_en, content_ne,
    media_urls (JSONB), post_type = Enum('post','reel','story','youtube'),
    status = Enum('draft','scheduled','published','failed'),
    scheduled_at, published_at,
    platform_post_ids (JSONB),  # {facebook: "xxx", instagram: "yyy"}
    organic_reach, organic_engagement, organic_clicks,
    is_boosted = Boolean, boost_campaign_id FK

class SocialMessage(BaseModel):
    school_id, platform, external_id,
    sender_id, sender_name, sender_avatar,
    message_type = Enum('comment','dm'),
    content, media_url, post_id,
    direction = Enum('inbound','outbound'),
    is_ai_replied = Boolean, ai_confidence = Float,
    ai_draft = Text, approved_by FK(User),
    is_admission_lead = Boolean,  # AI flagged as potential admission
    sentiment = Enum('positive','neutral','negative'),
    status = Enum('new','replied','ignored','flagged'),
    replied_at, created_at

class AdCampaign(BaseModel):
    school_id, post_id FK(SocialPost),
    platform = Enum('facebook','instagram'),
    fb_campaign_id, fb_adset_id, fb_ad_id,
    daily_budget_npr, total_budget_npr,
    start_date, end_date, status,
    objective,  # OUTCOME_AWARENESS, OUTCOME_LEADS
    targeting (JSONB),  # {age_min,age_max,interests,locations}
    ai_suggested = Boolean,  # Was this AI-recommended boost?
    # Metrics (updated by background task)
    spend_npr = Numeric, reach, impressions, clicks,
    cost_per_click, inquiries_received, leads_generated
```

---

# ═══════════════════════════════════════════════════════════════════════
# PART 4: PYTHON FLASK BACKEND — COMPLETE IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════════════

Generate complete, production-ready Flask Blueprint files. No placeholders.
**Every plugin route must use `@plugin_required('slug')` decorator.**

## backend/app/__init__.py — Flask App Factory + Plugin Loader

```python
def create_app(config_name='development'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})
    limiter.init_app(app)
    cache.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*", async_mode='gevent')
    celery.init_app(app)
    sentry_sdk.init(dsn=os.getenv('SENTRY_DSN'))

    # Register CORE blueprints (always loaded)
    from .api.v1 import api_v1
    app.register_blueprint(api_v1, url_prefix='/api/v1')
    from .api.webhooks import webhooks_bp
    app.register_blueprint(webhooks_bp, url_prefix='/webhooks')

    # ★ PLUGIN SYSTEM: Register all plugin blueprints
    from .plugins.loader import PluginLoader
    plugin_loader = PluginLoader(app)
    plugin_loader.discover_and_register()
    app.plugin_loader = plugin_loader  # Accessible via current_app.plugin_loader

    # Subdomain routing + plugin context middleware
    @app.before_request
    def resolve_school():
        """Extract school from subdomain and inject into g.school + g.installed_plugins"""
        host = request.headers.get('X-School-Slug') or \
               request.host.split('.')[0]
        if host not in ['app','www','api','dashboard']:
            school = School.query.filter_by(slug=host,
                     is_deleted=False).first()
            g.school = school
            g.school_id = school.id if school else None
            # ★ Load installed plugins for this school (cached 5 min)
            if school:
                g.installed_plugins = cache.get(f'school:{school.id}:plugins') or \
                    _load_school_plugins(school.id)

    # Consistent JSON error responses
    @app.errorhandler(Exception)
    def handle_error(e):
        return jsonify({
            "success": False,
            "data": None,
            "error": str(e),
            "meta": {}
        }), getattr(e, 'code', 500)

    # Health check
    @app.route('/health')
    def health():
        return jsonify({"status": "ok", "service": "aschool-api"})

    return app

def _load_school_plugins(school_id):
    """Load active plugin slugs for a school, cache for 5 min."""
    from .models.plugin import SchoolPlugin
    plugins = SchoolPlugin.query.filter_by(
        school_id=school_id, active=True
    ).all()
    slugs = [p.plugin_slug for p in plugins]
    cache.set(f'school:{school_id}:plugins', slugs, timeout=300)
    return slugs
```

## ★ backend/app/plugins/loader.py — Plugin Dynamic Loader

```python
"""
Plugin Loader — discovers manifests and registers Flask blueprints.
All plugin blueprints are loaded once at startup. The @plugin_required
decorator handles per-school access control at request time.
"""
import yaml, importlib, os
from pathlib import Path

class PluginLoader:
    def __init__(self, app):
        self.app = app
        self.plugins = {}  # slug → manifest dict
        self.manifests_dir = Path(__file__).parent / 'manifests'

    def discover_and_register(self):
        """Scan manifests/ folder, load each plugin's blueprint."""
        for manifest_file in self.manifests_dir.glob('*.yaml'):
            if manifest_file.name.startswith('_'):
                continue  # Skip _template.yaml
            manifest = yaml.safe_load(manifest_file.read_text())
            slug = manifest['slug']
            self.plugins[slug] = manifest

            # Register Flask blueprint if it has API routes
            bp_path = manifest.get('api_blueprint')
            if bp_path:
                try:
                    module = importlib.import_module(bp_path)
                    bp = getattr(module, f'{slug}_bp', None) or \
                         getattr(module, 'bp', None)
                    if bp:
                        self.app.register_blueprint(
                            bp, url_prefix=f'/api/v1/{slug}'
                        )
                except ImportError as e:
                    self.app.logger.warning(f"Plugin {slug} blueprint not found: {e}")

    def get_manifest(self, slug):
        return self.plugins.get(slug)

    def get_all_manifests(self):
        return self.plugins

    def get_frontend_sidebar(self, installed_slugs, user_role):
        """Build dynamic sidebar config for a school based on installed plugins."""
        sidebar = []
        for slug in installed_slugs:
            manifest = self.plugins.get(slug)
            if not manifest:
                continue
            fe = manifest.get('frontend', {})
            sb = fe.get('sidebar', {})
            if user_role in sb.get('visible_to', []):
                sidebar.append({
                    'slug': slug,
                    'label': sb.get('label'),
                    'label_nepali': sb.get('label_nepali'),
                    'icon': sb.get('icon'),
                    'route': fe.get('route'),
                    'subitems': sb.get('subitems', [])
                })
        return sidebar
```

## ★ backend/app/plugins/decorators.py — Plugin Access Control

```python
"""
@plugin_required('lms') — Use on ALL plugin routes.
Checks if the requesting school has the plugin installed + active.
If not → returns 403 with install URL.
"""
from functools import wraps
from flask import g, jsonify

def plugin_required(plugin_slug):
    """Decorator: ensures school has this plugin installed and active."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(g, 'installed_plugins') or not g.installed_plugins:
                return jsonify({
                    "success": False,
                    "error": "School context not found",
                    "data": None
                }), 403

            if plugin_slug not in g.installed_plugins:
                return jsonify({
                    "success": False,
                    "error": f"Plugin '{plugin_slug}' is not installed",
                    "data": {
                        "plugin_slug": plugin_slug,
                        "install_url": f"/marketplace/{plugin_slug}",
                        "message": "Install this plugin from the marketplace to use this feature."
                    }
                }), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Usage in any plugin API file:
# @lms_bp.route('/courses')
# @jwt_required()
# @plugin_required('lms')
# def get_courses():
#     ...
```

## ★ backend/app/api/v1/plugins.py — Plugin Marketplace API

```python
"""
Plugin marketplace API — browse, install, uninstall, configure plugins.
This is a CORE route (no @plugin_required, always available).
"""

# GET /api/v1/plugins/marketplace
# → Returns all available plugins with install status for this school
# → Grouped by category: free, starter, growth, premium
# → Shows: name, description, price, install_count, rating, screenshots
# → Includes: is_installed (bool) + trial_days_remaining for this school

# POST /api/v1/plugins/install
# Body: { "plugin_slug": "lms", "billing_cycle": "monthly" }
# → Validates: plugin exists, school doesn't already have it, no conflicts
# → Creates SchoolPlugin record (is_trial=True, trial_ends_at=+14 days)
# → Invalidates school plugin cache
# → Returns: {installed: true, trial_ends_at, next_steps}
# → Emits Socket.IO: 'plugin_installed' → frontend adds sidebar item live

# POST /api/v1/plugins/uninstall
# Body: { "plugin_slug": "lms" }
# → Sets SchoolPlugin.active = False, uninstalled_at = now()
# → Data is PRESERVED (not deleted) — can reinstall later
# → Invalidates cache
# → Emits Socket.IO: 'plugin_uninstalled' → frontend removes sidebar item

# GET /api/v1/plugins/installed
# → Returns this school's installed plugins with config + billing info
# → Used by frontend sidebar builder + Flutter app plugin loader

# PUT /api/v1/plugins/{slug}/config
# → Update plugin-specific settings for this school
# → Example: LMS config = {jitsi_server: "...", max_concurrent_classes: 5}

# GET /api/v1/plugins/{slug}/billing
# → Plugin billing details: current cycle, usage, next charge date

# POST /api/v1/plugins/{slug}/trial
# → Start free trial (14 days) for a paid plugin
# → Only one trial per plugin per school (prevents abuse)
```

## backend/app/api/v1/whatsapp_bot.py — Complete Two-Way WhatsApp Bot

```python
"""
COMPLETE WhatsApp two-way bot for ASchool.
When a parent texts the school's WhatsApp number, this handles it.

Supported commands:
- "Attendance" / "Haajiri" → Child's attendance
- "Fees" / "Shulka" → Outstanding fees + payment link
- "Result" / "Natiija" → Latest exam results
- "Timetable" / "Samay Taalik" → Today's class schedule
- "Bus" / "Bus Kahan Cha" → Live bus location + ETA
- "Homework" / "Grihakarya" → Today's homework
- Free text → AI Chat Agent handles it
"""

WHATSAPP_BOT_COMMANDS = {
    # Nepali (Devanagari)
    "हाजिरी": "attendance", "उपस्थिति": "attendance",
    "शुल्क": "fees", "फि": "fees", "दस्तुर": "fees",
    "नतिजा": "result", "परीक्षाफल": "result",
    "समय तालिका": "timetable", "तालिका": "timetable",
    "बस": "bus", "गृहकार्य": "homework",
    # Romanized Nepali
    "haajiri": "attendance", "upsthiti": "attendance",
    "shulka": "fees", "fee": "fees",
    "natiija": "result", "result": "result",
    "timetable": "timetable", "samay": "timetable",
    "bus": "bus", "grihakarya": "homework", "homework": "homework",
    # English
    "attendance": "attendance", "fees": "fees",
    "results": "result", "marks": "result",
    "schedule": "timetable", "location": "bus",
}

class WhatsAppBotService:

    def handle_incoming(self, phone: str, message: str,
                        school_id: str) -> str:
        """
        Main router. Returns reply text.
        1. Find parent by phone
        2. Detect command or free text
        3. Route to handler
        4. Format reply (Nepali/English based on parent preference)
        5. Return reply string
        """

    def cmd_attendance(self, parent: User, school: School) -> str:
        """
        "Ram was present today ✅
         This month: 22/24 days (91%)
         Last absent: Mangsir 15 (Sick leave)"
        """

    def cmd_fees(self, parent: User, school: School) -> str:
        """
        "Outstanding Fee for Ram:
         Tuition (Poush): Rs. 5,000
         Computer Fee: Rs. 500
         Total: Rs. 5,500
         Due: Poush 15
         Pay via eSewa: [link]
         Pay via Khalti: [link]"
        """

    def cmd_result(self, parent: User, school: School) -> str:
        """
        "First Terminal Exam Results — Ram:
         Mathematics: 78/100 (B+)
         Science: 82/100 (A-)
         English: 71/100 (B)
         Nepali: 85/100 (A)
         Total: 316/400 (79%)
         Class Rank: 8/35"
        """

    def cmd_bus(self, parent: User, school: School) -> str:
        """
        "Bus No. 3 Location:
         📍 Currently near Kalanki Chowk
         🚌 ETA to your stop (Baneshwor): ~12 minutes
         [Track Live] → [link]"
        """

    def handle_free_text(self, parent: User, message: str,
                          school: School) -> str:
        """
        Routes to AI ChatAgent for natural language handling.
        Agent knows: school info, this parent's children,
        fee status, attendance, results, policies.
        Replies in parent's preferred language.
        """
```

## backend/app/api/v1/fees.py — Complete Fee Management API

```python
"""
Fee management: structure, collection, receipts, analytics, BNPL
"""

# Endpoints:
GET    /api/v1/fees/structure              # Get school fee structure
POST   /api/v1/fees/structure              # Create/update structure
GET    /api/v1/fees/student/:student_id    # Student's complete ledger
POST   /api/v1/fees/collect                # Collect fee (POS-style)
GET    /api/v1/fees/collection/today       # Today's collections + total
GET    /api/v1/fees/defaulters             # Overdue payers list
GET    /api/v1/fees/defaulters/predicted   # AI-predicted upcoming defaulters
POST   /api/v1/fees/reminder/send          # Send individual fee reminder
POST   /api/v1/fees/reminder/bulk          # Bulk WhatsApp/SMS reminders
GET    /api/v1/fees/receipts/:id           # Download PDF receipt
GET    /api/v1/fees/reports/collection     # Collection rate, period stats
POST   /api/v1/fees/waiver                 # Apply fee waiver/scholarship
GET    /api/v1/fees/analytics              # Revenue trends, pie charts

# POST /api/v1/fees/collect — POS-style collection
def collect_fee():
    """
    Request:
    {
      student_id, fee_items: [{name, amount, month_bs}],
      payment_method: "esewa",
      discount_amount: 0, late_fine: 0
    }

    Process:
    1. Validate student belongs to this school
    2. Calculate total with fine/discount
    3. If cash: create receipt immediately
    4. If eSewa: initiate eSewa payment → return payment URL
    5. If Khalti: initiate Khalti → return pidx + payment URL
    6. Generate PDF receipt (WeasyPrint)
    7. Upload receipt to Cloudflare R2
    8. Send WhatsApp confirmation to parent
    9. Emit Socket.IO 'fee_collected' event to dashboard
    Returns: {success, receipt_url, payment_url (if digital)}
    """
```

## backend/app/api/webhooks/whatsapp.py — Complete Webhook

```python
"""
Handles all incoming WhatsApp Cloud API messages for all schools.
School is identified by whatsapp_phone_number_id.
Rate limit: 200/min per source IP.
"""

@webhooks_bp.route('/whatsapp', methods=['GET','POST'])
@limiter.limit("200/minute")
def whatsapp_webhook():
    if request.method == 'GET':
        # Meta verification challenge
        mode = request.args.get('hub.mode')
        token = request.args.get('hub.verify_token')
        challenge = request.args.get('hub.challenge')
        if mode == 'subscribe' and token == os.getenv('WA_VERIFY_TOKEN'):
            return challenge, 200
        return 'Forbidden', 403

    # POST — incoming message
    data = request.json
    # 1. Verify x-hub-signature-256 HMAC
    _verify_signature(request)

    entry = data.get('entry', [{}])[0]
    changes = entry.get('changes', [{}])[0]
    value = changes.get('value', {})

    # Identify school by phone_number_id
    phone_number_id = value.get('metadata', {}).get('phone_number_id')
    school = School.query.filter_by(
        whatsapp_phone_number_id=phone_number_id
    ).first()
    if not school: return 'ok', 200

    messages = value.get('messages', [])
    for msg in messages:
        # Queue processing to avoid webhook timeout
        process_whatsapp_message.delay(msg, school.id)

    return 'ok', 200

@celery.task
def process_whatsapp_message(msg: dict, school_id: str):
    """
    Full processing pipeline:
    1. Extract sender phone, message type, content
    2. Find parent by phone → get their children
    3. Save raw message to SocialMessage table
    4. Detect message type: text / image / audio / document
    5. For audio: transcribe (Claude audio) → process as text
    6. Detect command vs free text
    7. Route to WhatsAppBotService
    8. Send reply via WhatsApp Cloud API
    9. Update conversation: unread_count, last_message_at
    10. Emit Socket.IO to school dashboard
    11. If admission inquiry: create AdmissionLead
    """
```

## backend/app/services/ai/school_insights.py — AI Intelligence Engine

```python
"""
Weekly AI school intelligence report using Claude.
Analyzes all school data and generates actionable insights.
"""

class SchoolIntelligenceEngine:

    MODEL = "claude-sonnet-4-20250514"

    async def generate_weekly_report(self, school_id: str) -> WeeklyReport:
        """
        Data collected for analysis:
        - Attendance: this week vs last, trends by class
        - Fee collection: rate, defaulters, method breakdown
        - Academic: average marks, class-wise performance
        - Social: messages received, response rate, sentiment
        - Admission: leads this week, conversion rate
        - Risk students: new flagged, escalations, resolved

        Returns 6-8 insights:
        [{
          title_en, title_ne,
          body_en, body_ne,  # 2-3 sentences with specific numbers
          impact: positive|negative|warning|opportunity,
          action_en, action_ne,  # Specific recommendation
          priority: high|medium|low,
          data: {metric: value}  # Chart data
        }]

        Example insights:
        - "Grade 10 attendance dropped 12% this week — exam stress pattern"
        - "Fee collection rate 78% — 15 families haven't paid Poush installment"
        - "Facebook admission inquiries up 45% — boost post for Grade 11 opened"
        - "3 students flagged by AI risk engine — 2 need counselor attention"
        - "Science teacher's class has highest marks this term — share methods"
        """

    async def generate_principal_morning_brief(self, school: School) -> dict:
        """
        Daily 7 AM digest:
        {
          date_bs, date_ad,
          expected_students, yesterday_attendance_pct,
          fee_collected_ytd, pending_fees_count,
          unanswered_social_messages,
          risk_students_count,
          today_events: [],
          ai_tip: "Consider scheduling Grade 10 parent meeting"
        }
        """

    async def detect_at_risk_students(self, school_id: str) -> list[RiskAlert]:
        """
        Analyzes: attendance pattern, marks trend, assignment submission rate,
        fee default (family stress indicator), behavioral incidents.

        Risk levels:
        🟡 Yellow: 1-2 signals — monitor, contact teacher
        🟠 Orange: 3-4 signals — parent call, counselor
        🔴 Red: 5+ signals — immediate intervention
        🆘 Critical: dropout risk — principal involvement

        Returns: [{student_id, risk_score, risk_level, signals, recommended_action}]
        """

    async def predict_fee_defaulters(self, school_id: str) -> list:
        """
        ML pattern: analyzes payment history, due dates, reminder response rates.
        Identifies families likely to default BEFORE due date.
        Allows proactive reminder targeting.
        """

    async def generate_timetable(self, school_id: str,
                                  constraints: dict) -> Timetable:
        """
        AI + constraint satisfaction solver:
        Input: teachers, subjects, classes, rooms, periods/day, constraints
        Output: clash-free timetable in under 60 seconds

        Constraints handled:
        - No teacher in two classes simultaneously
        - Max periods per subject per day (e.g., Math: max 2)
        - Teacher preferred periods (e.g., no Monday morning)
        - Room capacity matching
        - Lab periods require lab rooms
        - Sports/activities on specific days
        """
```

## backend/app/services/ai/question_paper.py — Complete Exam Generator

```python
"""
AI-powered examination question paper generator.
Takes subject, chapters, difficulty ratio → complete paper + answer key.
Uses Claude with structured output.
"""

class QuestionPaperGenerator:

    PAPER_TYPES = {
        "see": {
            "total_marks": 100,
            "sections": [
                {"type": "mcq", "marks": 20, "questions": 20, "difficulty": "easy"},
                {"type": "short", "marks": 40, "questions": 8, "difficulty": "medium"},
                {"type": "long", "marks": 40, "questions": 4, "difficulty": "hard"},
            ]
        },
        "neb_theory": {...},
        "unit_test": {...},
        "custom": None  # Teacher defines
    }

    SYSTEM_PROMPT = """
    You are an expert examination paper setter for Nepal's school system.
    Create questions following NEB/SEE curriculum standards.
    Questions must be:
    - Aligned with Bloom's Taxonomy (remember/understand/apply/analyze/evaluate/create)
    - Clear and unambiguous in language
    - Free from cultural bias
    - At the specified difficulty level
    - Including complete answer key with marking scheme

    For Nepali-medium schools: generate questions in Nepali (Devanagari)
    For English-medium: generate in English
    For Nepali subject: always in Devanagari

    Return structured JSON with:
    - paper_title, subject, class, date, duration, total_marks
    - sections: [{section_name, instructions, questions: [
        {q_number, question, options (for MCQ), marks, answer, marking_guide,
         bloom_level, difficulty}
      ]}]
    """

    async def generate(self, request: PaperRequest) -> GeneratedPaper:
        """
        PaperRequest:
        - school_id, subject, class_name, chapters[]
        - difficulty_distribution: {easy:30, medium:50, hard:20}
        - paper_type: "see"|"unit_test"|"custom"
        - question_types: ["mcq", "short_answer", "long_answer", "fill_blank"]
        - total_marks, duration_minutes
        - language: "nepali"|"english"
        - exclude_questions: [] # From previous papers

        Returns GeneratedPaper:
        - All questions + answers
        - Formatted HTML (for PDF generation)
        - Bloom's taxonomy distribution chart
        - Difficulty analysis
        """

    async def generate_from_chapter(self, chapter_pdf: bytes,
                                     count: int) -> list:
        """
        Teacher uploads PDF chapter → AI extracts key concepts
        → Generates targeted questions from actual content
        """
```

## backend/app/services/ai/website_designer.py — AI School Website Builder

```python
"""
AI-powered school website generator.
Like NepalCart's AI store designer but for schools.
"""

class SchoolWebsiteDesigner:

    async def generate_from_prompt(
        self,
        prompt: str,
        school_data: dict,
        logo_base64: Optional[str],
        style_preference: str,
        language: str
    ) -> list[WebsiteVariation]:
        """
        Process:
        1. Analyze: school type, level, audience (parents), goals
        2. If logo: extract brand colors via Claude vision
        3. Generate 3 design variations:
           - Traditional: formal, trustworthy, classic
           - Modern: clean, contemporary, vibrant
           - Nepal-cultural: local identity, warm, community

        Each variation returns:
        {
          theme_slug, style_label, why_this_fits,
          color_palette: {primary, secondary, accent, bg, text},
          fonts: {heading, body},
          hero_style: "image_right"|"full_bg"|"centered",
          ai_generated_copy: {
            headline_ne, headline_en,
            tagline_ne, tagline_en,
            cta_text: "Admission Inquiry" / "भर्ना सोधपुछ"
          }
        }
        """

    async def generate_school_copy(self, school: School,
                                    page: str) -> dict:
        """
        Auto-generates website copy for all pages.
        About Us, Academics, Facilities, Contact — all AI-written.
        Uses school's actual data (established year, level, location).
        """

    async def sync_live_data_to_website(self, school_id: str):
        """
        Called by Celery task after:
        - New notice published → appears on school website
        - Exam result published → Result Checker updates
        - Event created → Events page updates
        - Teacher added → Teachers page updates
        - Admission status changed → Admission page updates
        """
```

## backend/app/services/social/meta_api.py — Social Hub

```python
"""
Complete Meta Graph API integration for Facebook + Instagram.
Handles: post publishing, reading comments/DMs, AI replying.
"""

class MetaAPIService:

    BASE_URL = "https://graph.facebook.com/v19.0"

    def connect_facebook(self, school_id: str,
                          auth_code: str) -> ConnectionResult:
        """OAuth flow: exchange code → long-lived page token → save"""

    def post_to_facebook(self, school_id: str,
                          content: str, media_urls: list,
                          schedule_time: datetime = None) -> str:
        """Publish (or schedule) post to Facebook Page"""

    def post_to_instagram(self, school_id: str,
                           content: str, media_url: str) -> str:
        """Publish to Instagram (requires media)"""

    def post_to_both(self, school_id: str, post: SocialPost) -> dict:
        """Simultaneously publish to all connected platforms"""

    def get_all_messages(self, school_id: str,
                          platform: str) -> list[SocialMessage]:
        """Fetch all DMs + comments from last 24 hours"""

    def reply_to_comment(self, school_id: str, comment_id: str,
                          reply: str) -> bool:
        """Reply to a Facebook/Instagram comment"""

    def reply_to_dm(self, school_id: str, sender_id: str,
                     message: str, platform: str) -> bool:
        """Send DM reply (respects 24-hour window rule)"""

    def hide_comment(self, school_id: str, comment_id: str) -> bool:
        """Hide abusive/spam comment"""

    def boost_post(self, school_id: str, post_id: str,
                   budget_npr: float, days: int,
                   targeting: dict, objective: str) -> AdCampaign:
        """
        Complete Meta Ads API boost:
        1. Create Campaign
        2. Create Ad Set with targeting
        3. Create Ad Creative from existing post
        4. Activate (start paused, then activate)
        5. Store campaign ID in DB
        Returns AdCampaign object with live tracking data
        """

    def get_boost_analytics(self, campaign: AdCampaign) -> dict:
        """Pull live metrics: spend, reach, impressions, clicks"""
```

## backend/app/services/designer/bulk_generator.py — Canva-Like Designer

```python
"""
School Design Studio: generate certificates, ID cards, notices, admit cards.
Uses Fabric.js for client-side canvas + PIL/WeasyPrint for server-side generation.
"""

class BulkDesignGenerator:

    TEMPLATE_CATEGORIES = {
        "id_cards": ["student_id", "teacher_id", "staff_id"],
        "certificates": ["merit", "participation", "sports",
                          "character", "transfer"],
        "admit_cards": ["exam_admit", "hall_ticket"],
        "notices": ["circular", "notice_board", "event_poster"],
        "reports": ["report_card_cover", "result_slip"],
        "letterheads": ["official", "informal"]
    }

    async def bulk_generate_id_cards(
        self,
        school_id: str,
        class_id: str,
        template_id: str,
        academic_year: str
    ) -> BulkResult:
        """
        For a class of 40 students:
        1. Fetch all students + photos
        2. Load template design (JSON from Fabric.js)
        3. For each student: substitute name, class, photo, ID number
        4. Render to PIL image
        5. Arrange 4-per-A4-page layout
        6. Generate PDF via WeasyPrint
        7. Upload to R2: bulk_id_cards_{class}_{date}.pdf
        8. Return download URL

        Time: ~30 seconds for 500 students
        """

    async def bulk_generate_report_covers(
        self, school_id: str, exam_id: str
    ) -> BulkResult:
        """Generate personalized report card covers for all students"""

    async def generate_admit_cards(
        self, school_id: str, exam_id: str,
        class_ids: list
    ) -> BulkResult:
        """
        Exam admit cards with:
        - Student photo, name, roll number
        - Exam schedule (subject, date, time, room)
        - QR code for verification
        - School stamp placeholder
        """

    def generate_single_certificate(
        self, template: dict, student: Student,
        certificate_type: str, data: dict
    ) -> bytes:
        """Generate one certificate as PDF"""
```

---

# ═══════════════════════════════════════════════════════════════════════
# PART 5: SCHOOL WEBSITE BUILDER — COMPLETE SYSTEM
# Like NepalCart storefront but for schools
# ═══════════════════════════════════════════════════════════════════════

## WEBSITE BLOCK SYSTEM

Every school website is composed of **Sections → Blocks → Settings**,
just like NepalCart's theme engine.

### Available Sections (school-specific):

```
HEADER SECTIONS:
├── Classic School Header (logo + nav + admission button)
├── Minimal Header (logo + hamburger)
└── Gov-Style Header (flag + logo + school name + tagline)

HERO SECTIONS:
├── Photo Hero (school building full-width + headline + CTA)
├── Slider Hero (3-5 rotating school photos)
├── Video Hero (promo video background)
└── Stats Hero (students, teachers, years, achievements)

ABOUT SECTIONS:
├── Principal's Message (photo + message)
├── School History Timeline (founding story)
├── Mission & Vision (two-column)
└── Achievements Wall (awards, rankings)

ACADEMIC SECTIONS:
├── Curriculum Overview (NEB, Cambridge, Montessori cards)
├── Subjects Grid
├── Class Structure (Nursery to Grade 12 tree)
└── Exam Results Banner (auto-synced, latest results)

STAFF SECTIONS:
├── Teacher Gallery (auto-synced from SMS staff records)
├── Department Heads (featured teachers)
└── Administrative Staff

DYNAMIC SECTIONS (auto-synced from SMS data):
├── Upcoming Events Widget (pulls from school calendar)
├── Latest Notices (latest 5 circulars)
├── Notice Board (scrolling notices)
├── Admission Status Banner (LIVE: "Admissions Open for Grade 6-8")
└── Today's Attendance Rate (live %)

ADMISSION SECTIONS:
├── Admission Form (connected to ASchool CRM → auto creates lead)
├── Fee Structure Display
├── Admission Process Steps
└── Online Application Status Checker

FACILITIES SECTIONS:
├── Facilities Grid (lab, library, sports, cafeteria)
├── Photo Gallery (masonry layout)
└── Virtual Tour Embed (YouTube 360)

SOCIAL PROOF SECTIONS:
├── Testimonials (parent quotes)
├── Alumni Success Stories (auto-synced from alumni module)
└── Social Media Feed (live FB/IG posts)

CONTACT SECTIONS:
├── Contact Form + Map (OpenStreetMap)
├── Location Card
└── Social Links Footer

MISC SECTIONS:
├── Newsletter Signup
├── Blog/News Grid
├── FAQ Accordion
└── Custom HTML Block
```

### 20 School Themes — Complete Specs:

1. **Government Classic** — NEB color scheme (maroon + gold), formal serif, flag display, government stamp look
2. **Private Prestige** — Navy + gold, Playfair Display, elegant, trust-building for fee-paying parents
3. **Modern Minimal** — White + single accent color, Inter font, generous whitespace, contemporary
4. **Montessori Colorful** — Bright pastels, rounded corners, playful Nunito font, child-friendly
5. **Technical Vocational** — Gray + orange, industrial feel, skill-focused CTAs, practical
6. **International School** — Clean white + blue, Cambridge/IB inspired, global feel
7. **Boarding School** — Warm wood tones + deep green, residential feel, safety emphasis
8. **Nepal Heritage** — Terracotta + gold, traditional patterns, culturally rooted, warm
9. **Community School** — Simple, accessible, high contrast, works on slow connections
10. **+2 College** — Young, energetic, purple + blue gradient, social media integrated
11. **Primary Colorful** — Rainbow palette, large text, cartoon-style illustrations, fun
12. **Secondary Pro** — Professional gray + blue, grade-8-to-12 appropriate, academic
13. **Sports Academy** — Dynamic angles, red + black, sports photography heavy, active
14. **Arts & Creative** — Free-form layout, colorful, portfolio showcase, expressive
15. **Faith-Based** — Calm neutrals, cross/dharma symbol integration, community-focused
16. **Girls' School** — Elegant rose + purple, empowerment messaging, strong + graceful
17. **Science School** — Dark theme with neon accents, STEM-focused, modern lab feel
18. **Language Institute** — Multi-script display, flags, linguistics-inspired, multilingual
19. **Dark Premium** — Near-black + gold, ultra-premium feel, exclusive positioning
20. **Festival Auto** — Base is any theme + auto-activates seasonal overlays:
    - Dashain (Oct): marigold + red banner, "बडादशैंको शुभकामना"
    - Tihar (Nov): diyo lights animation, warm gold overlays
    - Saraswati Puja (Feb): white + yellow, "विद्या की देवी" banner
    - Republic Day: Nepal flag colors + patriotic overlay

### frontend/app/(dashboard)/website-builder/ai-builder/page.tsx — AI Builder Flow

```
STEP 1 — TELL US ABOUT YOUR SCHOOL
  - Large form with warm Nepali greeting
  - School name (auto-filled from profile)
  - School type selector: Government/Private/Community/Boarding/International
  - School level: Primary/Secondary/+2/All Levels
  - Upload school logo (AI reads brand colors)
  - Style preference: Traditional / Modern / Vibrant / Minimal
  - Language: Nepali First / English First / Both
  - Key strength (pick 3): Results, Teachers, Facilities, Values, Sports, Arts
  - "Generate My School Website" button

STEP 2 — CHOOSE YOUR DESIGN (3 AI variations)
  - 3 large preview cards
  - Each shows: live desktop mockup + mobile mockup
  - Color palette swatches
  - Font pairing preview
  - AI explanation: "This suits a government school because..."
  - "See Full Preview" → full page demo
  - "Use This Design" CTA per option
  - "Generate 3 More" link

STEP 3 — EDIT IN CRAFT.JS (see editor spec)
  - All school-specific blocks available
  - Live data blocks already connected to SMS
  - Mobile preview built in

STEP 4 — REVIEW & PUBLISH
  - SEO checklist (meta title, description, school schema markup)
  - Accessibility check
  - Mobile speed test
  - "Publish Website" → shows URL: bdps.aschool.com.np
  - Custom domain wizard (paid plans)
  - Share on WhatsApp group button
```

### Live Data Auto-Sync — backend/tasks/sitemap.py

```python
@celery.task
def sync_website_live_data(school_id: str, trigger: str):
    """
    Called whenever school data changes that affects the website.
    Triggers:
    - 'notice_published' → updates Notices section
    - 'event_created' → updates Events widget
    - 'result_published' → updates Results page + banner
    - 'staff_added' → updates Teachers directory
    - 'admission_status_changed' → updates Admission banner
    - 'gallery_photo_added' → updates Gallery

    Process:
    1. Fetch latest data from respective tables
    2. Build static JSON file per section
    3. Upload to Cloudflare R2
    4. Next.js ISR: revalidate that school's website page
    5. Sitemap.xml rebuild
    6. ping Google Search Console
    """
```

---

# ═══════════════════════════════════════════════════════════════════════
# PART 6: FLUTTER APPS — PLUGIN-AWARE IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════════════

**Every Flutter app dynamically shows/hides features based on installed plugins.**
On login, the app fetches `GET /api/v1/plugins/installed` and caches the list locally.
Socket.IO events `plugin_installed` / `plugin_uninstalled` update the UI in real-time.

## ★ Flutter Plugin System — Shared Architecture

```dart
// shared/services/plugin_provider.dart
//
// PluginProvider — Riverpod provider that manages installed plugins
//
// On app start / login:
//   1. Fetch GET /api/v1/plugins/installed → list of {slug, config}
//   2. Cache to Isar (offline support — plugins still visible offline)
//   3. Expose: isPluginInstalled(slug) → bool
//   4. Expose: getPluginConfig(slug) → Map<String, dynamic>?
//   5. Listen Socket.IO 'plugin_installed' → add to installed list
//   6. Listen Socket.IO 'plugin_uninstalled' → remove from list
//
// Usage in any feature screen:
//   final hasLms = ref.watch(pluginProvider).isInstalled('lms');
//   if (!hasLms) return PluginNotInstalledScreen(slug: 'lms');

// shared/widgets/plugin_gate.dart
//
// PluginGate — Widget that conditionally renders child based on plugin
//
// PluginGate(
//   pluginSlug: 'lms',
//   child: LMSDashboard(),
//   fallback: PluginPromoCard(slug: 'lms'),  // Shows "Install LMS" card
// )
//
// Used in:
//   - Bottom navigation tabs (hide tab if plugin not installed)
//   - Dashboard cards (show promo card instead of feature card)
//   - Feature screens (redirect to marketplace if not installed)

// GoRouter integration:
// All plugin routes use redirect guard:
//   GoRoute(
//     path: '/lms',
//     redirect: (context, state) {
//       if (!ref.read(pluginProvider).isInstalled('lms')) {
//         return '/marketplace/lms';  // Redirect to install page
//       }
//       return null;
//     },
//     builder: (context, state) => LMSScreen(),
//   ),
```

## ★ Flutter Bottom Navigation — Dynamic Plugin Tabs

```dart
// Each app's main.dart uses dynamic bottom nav based on installed plugins
//
// Parent App Example:
//   Fixed tabs:  [Home, Children]              ← Always visible
//   Plugin tabs: [Fees, Bus, LMS, Wellbeing]   ← Only if installed
//
// Admin App Example:
//   Fixed tabs:  [Dashboard, Settings]
//   Plugin tabs: [Students, Attendance, Fees, Exams, LMS, Analytics, ...]
//
// Logic:
//   final installedPlugins = ref.watch(pluginProvider);
//   final tabs = [
//     ...fixedTabs,
//     if (installedPlugins.isInstalled('fees')) FeesTab(),
//     if (installedPlugins.isInstalled('bus_tracking')) BusTab(),
//     if (installedPlugins.isInstalled('lms')) LMSTab(),
//     // ... etc
//   ];
//
// If too many tabs → "More" tab with grid of remaining plugins
```

## Shared pubspec.yaml (all 4 apps inherit from this)

```yaml
name: aschool_shared
environment:
  sdk: '>=3.2.0 <4.0.0'
  flutter: '>=3.16.0'

dependencies:
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5
  go_router: ^13.2.0
  dio: ^5.4.3
  retrofit: ^4.1.0
  isar: ^3.1.0
  isar_flutter_libs: ^3.1.0
  flutter_secure_storage: ^9.0.0
  firebase_core: ^2.31.1
  firebase_messaging: ^14.9.4
  socket_io_client: ^2.0.3+1
  flutter_local_notifications: ^17.2.2
  fl_chart: ^0.68.0
  flutter_animate: ^4.5.0
  lottie: ^3.1.2
  cached_network_image: ^3.3.1
  shimmer: ^3.0.0
  flutter_map: ^6.1.0         # OpenStreetMap (free)
  latlong2: ^0.9.1
  geolocator: ^11.3.0
  mobile_scanner: ^5.1.1      # Barcode scanner
  intl: ^0.19.0
  nepali_date_converter: ^3.0.2
  table_calendar: ^3.1.2
  khalti_flutter: ^1.0.1
  url_launcher: ^6.3.0
  share_plus: ^9.0.0
  permission_handler: ^11.3.1
  connectivity_plus: ^6.0.3
  freezed: ^2.5.7
  json_annotation: ^4.9.0
  logger: ^2.4.0
```

## ASchool Parent App — Most Critical App

### flutter_parent/lib/features/bus_tracker/screens/bus_tracking_screen.dart

```dart
// LIVE BUS TRACKING — Real-time parent GPS view
//
// Screen Layout:
// TOP (60%): flutter_map with OpenStreetMap
//   - School marker (pin with school logo)
//   - Home/stop marker (pin with house icon)
//   - Bus marker: animated school bus icon
//   - Route polyline (blue dashed line)
//   - Zoom controls
//
// BOTTOM (40%): Info Panel
//   - Bus number: "Bus No. 3 | Driver: Ram Bahadur | 9800XXXXXX"
//   - Status: "🚌 Moving towards your stop"
//   - ETA: "Arrives at your stop in 8 minutes"
//   - Last updated: "Updated 12 seconds ago"
//   - Bus speed: "42 km/h"
//   - Student boarded status (if RFID): "✅ Ram boarded at 7:42 AM"
//
// Notifications:
//   - "Bus 5 minutes away" → system notification + in-app alert
//   - "Bus has arrived at your stop" → sound + vibration
//
// Data source:
//   - Firebase Realtime DB: /schools/{id}/buses/{bus_id}/location
//   - Updated every 15 seconds from ESP32 on bus
//   - ETA calculated: distance remaining / avg speed + stop count

class BusTrackingScreen extends ConsumerStatefulWidget {
  final String busId;
  // Full implementation:
  // - StreamBuilder on Firebase Realtime DB
  // - Smooth bus marker animation (interpolate between GPS points)
  // - Offline: shows last known location with timestamp
  // - ETA algorithm: Haversine distance + traffic estimate
  // - Background location tracking (optional: share parent location too)
}
```

### flutter_parent/lib/features/fees/screens/fee_payment_screen.dart

```dart
// FEE PAYMENT — eSewa + Khalti integration
//
// Screen: Fee Summary
//   - Child name + class
//   - Outstanding fees list:
//     Tuition (Poush) - Rs. 5,000
//     Computer Fee - Rs. 500
//     Late Fine - Rs. 100
//     Total: Rs. 5,600
//   - Select items to pay (checkboxes)
//   - Payment method:
//     [eSewa Logo] [Khalti Logo] [Cash at School]
//
// eSewa Flow:
//   1. Tap eSewa → POST /api/v1/fees/initiate-payment
//   2. Get payment URL
//   3. Open in WebView (not external browser)
//   4. eSewa success callback → verify payment → show receipt
//   5. Receipt PDF shareable + downloadable
//
// Khalti Flow:
//   1. Tap Khalti → khalti_flutter SDK handles full flow
//   2. On success → verify with backend → show receipt
//
// Success Screen:
//   - Green checkmark animation (Lottie)
//   - Receipt preview
//   - "Share Receipt on WhatsApp" button
//   - "Download PDF" button

class FeePaymentScreen extends ConsumerWidget {
  // Full implementation with payment gateway integration
}
```

## ASchool Teacher App — Daily Use App

### flutter_teacher/lib/features/attendance/screens/attendance_screen.dart

```dart
// ATTENDANCE MARKING — Teacher's most-used feature
//
// Must be fast: teacher marks 40 students in < 2 minutes
//
// Screen Layout:
// TOP: Class: Grade 8 Tulsi | Date: Mangsir 20, 2081 (Fri Dec 6, 2024)
//      Period: 1st | Subject: Mathematics
//      Quick: [Present All] [Absent All]
//
// Student List: Virtual scrolling (react-window equivalent: flutter_list_view)
// Each student tile:
//   - Roll: 01 | Photo | Ram Sharma | [P] [A] [L] [H]
//     P=Present (green), A=Absent (red), L=Late (yellow), H=Holiday
//   - Tap [P] → haptic feedback + turns green
//   - Default: P for all (optimistic — most students present)
//   - Late: slide right → time picker → "Late by X minutes"
//
// Features:
//   - Voice Mode: tap mic → say "Absent: 5, 12, 23" → marks those
//   - Camera Mode: scan faces (future feature placeholder)
//   - Offline: stores in Isar, syncs when online
//     "Offline Mode — will sync when connected" banner
//
// Submit:
//   - "Submit Attendance" button
//   - Shows summary: "35 Present | 3 Absent | 2 Late"
//   - Confirm → POST /api/v1/attendance/submit
//   - Auto WhatsApp to absent students' parents (if school setting enabled)
//   - "Sent: 3 parent notifications" confirmation toast
//
// Quick Stats bar (above list):
//   - This month: Ram - 22/25 days (88%) (shown on tap of student)

class AttendanceScreen extends ConsumerStatefulWidget {
  final String classId, sectionId, periodId;
  // Full implementation with:
  // - Isar local caching
  // - Voice recognition (speech_to_text package)
  // - Background sync service
  // - Optimistic UI (submit works offline)
  // - Parent notification trigger
}
```

### flutter_teacher/lib/features/ai_tools/screens/ai_tools_screen.dart

```dart
// AI TOOLS HUB — Teacher's AI assistant
//
// Tool Cards Grid:
//
// 📝 Question Paper Generator
//   → Subject picker → Chapter picker → Difficulty slider
//   → "Generate Paper" → loading → paper preview
//   → Share as PDF, Print, Save to drafts
//   → Answer key toggle
//
// 📚 Lesson Plan Generator
//   → Topic input: "Photosynthesis - Grade 8 - 45 minutes"
//   → Language: Nepali/English
//   → Generate → Full lesson plan:
//     - Objectives, Materials, Introduction, Content,
//       Activity, Assessment, Homework
//   → Save/Share/Edit
//
// 📊 Report Card Remarks
//   → Select student → View their stats (auto-loaded)
//   → AI drafts personalized remark (300 chars max)
//   → Teacher reviews → Edit if needed → Approve
//   → Bulk: approve all AI drafts in one tap
//
// 📋 Assignment Feedback
//   → Camera scan of handwritten work
//   → AI reads → Highlights missing concepts → Suggests grade
//   → Teacher finalizes → Feedback saved to student profile
//
// 🎯 Personalized Study Tips
//   → For a struggling student: AI analyzes marks + attendance
//   → Generates specific study plan for that student
//   → Share with parent via WhatsApp
//
// 🔍 Plagiarism Checker
//   → Paste/upload student assignment
//   → Shows originality % + suspicious sections highlighted
//
// All tools work via POST /api/v1/ai-tools/{tool_name}
// Loading: Lottie robot animation
// Results: Markdown rendered beautifully
```

## ASchool Admin App — Power User App

### flutter_admin/lib/features/dashboard/screens/principal_dashboard.dart

```dart
// PRINCIPAL'S COMMAND CENTER
//
// AppBar: School name + date (BS + AD) + notification bell
//
// Morning Brief Card (AI-generated, delivered 7 AM):
//   Gold gradient card:
//   "आज Mangsir 20 गते | 815 students expected
//    Yesterday: 94% attendance | Rs. 12,500 fees collected
//    ⚠️ 3 students flagged by AI risk system
//    💬 5 unanswered social messages
//    📋 Staff meeting at 11 AM"
//   [View Full Report]
//
// Live KPI Cards (4 in 2x2 grid):
//   - Today's Attendance % (animated from 0 to value on load)
//   - Fee Collected Today (NPR counter)
//   - Unanswered Messages (badge-style, tap to open inbox)
//   - Risk Students (red if > 0)
//
// Revenue Chart (fl_chart): last 30 days fee collection
//   Toggle: Daily / Weekly / Monthly
//
// Attendance Heatmap: per class, tap to drill down
//
// Quick Actions Row:
//   [📢 Send Notice] [💰 Collect Fee] [📊 Reports] [🤖 AI Tools]
//
// Recent Activity Feed:
//   - "Ram Sharma paid Rs. 5,500 via eSewa — 10 mins ago"
//   - "Grade 8 attendance: 38/40 present — 2 mins ago"
//   - "New admission inquiry from Facebook — 5 mins ago"
//   - "Bus No. 3 departed school — 3 mins ago"
//
// Socket.IO real-time events:
//   - New fee payment → update NPR counter + add to feed
//   - Low attendance alert → update KPI + push notification
//   - Social message → badge increment
//   - GPS bus deviation → alert banner

class PrincipalDashboard extends ConsumerWidget {
  // Full implementation with all widgets
  // Offline: shows cached data from yesterday
  // Pull to refresh: fetches fresh data
}
```

### flutter_admin/lib/features/social_hub/screens/social_hub_screen.dart

```dart
// SOCIAL HUB — Manage all school social media
//
// Top Tabs: All | Facebook | Instagram | TikTok | YouTube
//
// Unified Inbox (main view):
// Each message tile:
//   - Platform icon + sender name + message preview
//   - "Admission inquiry 🎯" badge (AI-detected)
//   - "AI Replied ✅" or "Needs Reply 🔴"
//   - Sentiment dot: 🟢 positive / 🟡 neutral / 🔴 negative
//   - Time ago
//
// Tap message → Full conversation view:
//   - Original post thumbnail
//   - Comment/message thread
//   - 3 AI-suggested replies (tap to use)
//   - Text field for custom reply
//   - [Reply] [Hide] [Create Lead] [Mark Resolved]
//
// Create Post button (FAB):
//   - Rich text editor
//   - Photo/video picker
//   - Platform selector: [FB] [IG] [TikTok] [YouTube]
//   - Schedule: Post Now / Schedule (date+time picker)
//   - Language toggle: Nepali / English / Both
//   - AI Caption Generator button
//
// Boost Post Screen:
//   - Select post from recent list
//   - AI suggests: "Boost this? It has 3x your avg engagement 🔥"
//   - Budget: daily (Rs. 200 / 500 / 1000 / custom)
//   - Duration: 3 / 7 / 14 / 30 days
//   - Total spend calculator
//   - Targeting:
//     Age: [25-45] (auto-set for parents)
//     Location: [Kathmandu] (auto-set from school location)
//     Interests: [Education, Parenting] (AI-suggested)
//   - Estimated reach: "8,000–15,000 parents"
//   - [Boost Now] → loading → success with campaign ID
//
// Analytics Tab:
//   - Per platform: followers, reach, engagement
//   - Best performing post this month
//   - Admission inquiries from social: X this week
//   - Cost per admission inquiry: Rs. Y (if boosting active)
```

---

# ═══════════════════════════════════════════════════════════════════════
# PART 7: ALL AI FEATURES — COMPLETE IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════════════

All AI uses Anthropic Claude API ONLY. claude-haiku-4-5 for speed-critical tasks,
claude-sonnet-4-20250514 for quality-critical tasks. Retry 3x with exponential backoff.

## Complete AI Feature Matrix

### 1. AI Timetable Generator
```python
"""
Input: teachers[], subjects[], classes[], constraints{}
Algorithm: Claude + backtracking constraint solver

Constraints solved:
- Teacher not in 2 classes simultaneously
- Max N periods per subject per day
- Lab subjects need lab rooms
- Sports on designated days
- Teacher preferred free periods
- Lunch break uniform across classes
- Assembly periods (Mondays?)

Output in 30-60 seconds:
- Complete clash-free weekly timetable
- Teacher workload summary
- Export: PDF A4 / Excel / iCal
- Import into all teacher apps automatically
"""
```

### 2. AI Report Card Remarks Generator
```python
SYSTEM_PROMPT = """
You are an experienced, warm Nepali school teacher.
Write a personalized report card remark for this student.

Rules:
- Max 300 characters
- Start positive (always find something good)
- Specific: mention actual subjects, not generic
- Actionable: suggest what to improve
- Warm, encouraging tone — never discouraging
- If student excels: celebrate specifically
- Language: {language} (Nepali/English/Both)

Student Data:
- Name: {name}
- Percentage: {percentage}%
- Strongest subject: {best_subject} ({best_marks})
- Weakest subject: {weak_subject} ({weak_marks})
- Attendance: {attendance}%
- Behavior: {behavior_note}
- Previous remark was: {last_remark}

Generate remark ONLY. No intro text.
"""
# Example output:
# "Ram is excelling in Mathematics this term. His curiosity and
#  dedication are commendable. With more focus on English grammar,
#  we expect even better results next term. Keep it up, Ram! 🌟"
```

### 3. AI Social Reply System
```python
SOCIAL_REPLY_PROMPT = """
You are the social media AI assistant for {school_name},
a {school_type} school in {location}, Nepal.

Your personality: {tone} (professional/friendly/formal)
Your language: {language} (Nepali/English/Auto)

School Context:
- Admission: {admission_status} for {available_grades}
- Fee range: {fee_range}
- Contact: {phone}
- Hours: {hours}
- Location: {address}
- Notable: {achievements}

Comment/Message received: "{message}"
Platform: {platform}
Sender: {sender_name}

Rules:
- Comment replies: under 150 characters
- DM replies: under 400 characters
- NEVER make up information
- If unsure: give contact number
- If negative: apologize sincerely, offer to resolve
- If admission inquiry: ask grade + provide process
- Detect language and reply in same language
- Add appropriate emoji (school-appropriate)

Reply ONLY. No explanation.
"""
```

### 4. AI Admission Bot
```python
"""
Multi-turn conversation: social DM → admission lead
Uses sliding window memory (8 turns) stored in Redis

Tools available:
- check_seat_availability(class, section)
- get_fee_structure(class)
- get_admission_requirements()
- get_school_info(topic)
- create_lead(name, phone, grade, source)

Conversation flow:
Turn 1: "Admission ko barey ma jankari chahiyo"
AI: "Namaste! Grade kuntai ko lagi inquiry hun cha? 😊"

Turn 2: "Grade 6 ko lagi"
AI: "Grade 6 ma still 5 seats available cha ✅ 
     Required documents:
     - Previous school character certificate
     - Mark sheet (Grade 5)
     - Birth certificate
     
     Admission test: Chaitra 15, 10 AM
     Registration fee: Rs. 500
     
     Visit school or fill online form: [link]
     Appointment book garna chahanu huncha?"

Turn 3: "Fees kati ho?"
AI: [calls get_fee_structure("Grade 6")]
→ "Monthly fee: Rs. 3,500
   Annual fees: Rs. 8,000
   Total first year: Rs. 50,000

   Sibling discount: 10% for second child
   Scholarship available for merit students"

Turn 4: Creates lead → notifies school admin
"""
```

### 5. Student At-Risk Detection
```python
"""
Weekly Celery task. Analyzes ALL students every Sunday midnight.
Signals analyzed (weighted):

Attendance signals (weight 35%):
- Attendance below 75%: red flag
- 3+ consecutive absences: alert
- Declining trend (was 90%, now 70%): yellow
- Pattern (always misses Mondays): flag for counselor

Academic signals (weight 35%):
- Marks declined 20%+ from previous exam
- Failed 2+ subjects
- Not submitting assignments (< 50% submission rate)
- Sudden decline in best subject

Behavioral signals (weight 20%):
- Multiple behavior incidents
- Negative teacher remarks trend

Family signals (weight 10%):
- Fee default for 2+ months (family stress)
- Parent not attending meetings
- No parent app login in 30 days

Risk calculation:
- Score each signal: 0-10
- Weighted average
- Categorize: Low (0-3) / Medium (3-6) / High (6-8) / Critical (8-10)

Actions triggered:
- Low: log only, monitor
- Medium: notify class teacher via app
- High: notify counselor + principal + send parent WhatsApp
- Critical: escalate to principal + schedule parent meeting
"""
```

### 6. AI Fee Defaulter Predictor
```python
"""
Runs 5 days before fee due date.
Analyzes payment history to predict who won't pay.

Signals:
- Always pays on last day → likely to pay but needs reminder
- Paid late last 2 months → probably will be late, send early reminder
- Never uses digital payment → phone call more effective than WhatsApp
- 2+ months pending → high default risk, personal contact needed
- New student (< 6 months) → unknown, send reminders

Output: categorized list for admin
- "Definitely will pay" → standard WhatsApp reminder
- "Likely to pay late" → early reminder + call
- "High default risk" → personal visit or call
- "Already paid" → no action needed

Saves admin hours by prioritizing who to contact personally
"""
```

### 7. AI Lesson Plan Generator
```python
LESSON_PLAN_PROMPT = """
Create a complete {duration}-minute lesson plan for:
Subject: {subject}
Topic: {topic}
Grade: {grade}
School Type: {school_type}
Language: {language}
Learning Objectives: {objectives}

Structure:
1. INTRODUCTION (5 min): Hook activity to engage students
2. PRIOR KNOWLEDGE CHECK (3 min): Connect to what they know
3. MAIN CONTENT (20 min): Explanation + examples + demonstrations
4. STUDENT ACTIVITY (10 min): Practice task or group work
5. FORMATIVE CHECK (5 min): Quick questions to assess understanding
6. CLOSURE (2 min): Summary + preview next lesson
7. HOMEWORK: Specific, achievable task

Also provide:
- Materials needed (locally available in Nepal)
- Common misconceptions to watch for
- Differentiation: activity for advanced students
- Differentiation: support for struggling students
- Real-world Nepal context examples for this topic
- 5 assessment questions with answers
- Safe YouTube video links (search terms, not URLs)

Format as structured JSON.
"""
```

### 8. AI Homework Auto-Grader — NEW
```python
"""
Input: assignment_type (essay/math/science), student_submission (text/image), 
       rubric{}, grade_level, subject, language

Process:
1. If image → OCR to extract handwriting (supports Nepali Devanagari)
2. Parse submission against rubric criteria
3. AI evaluates: correctness, completeness, effort, creativity
4. Generate step-by-step feedback (not just marks)

Output:
- Score: X/total with breakdown per rubric criterion
- Strengths: what student did well (encouraging)
- Areas to improve: specific, actionable feedback
- Model answer: show correct approach
- Similar practice questions: 3 extra questions for weak areas
- Teacher override: teacher can adjust AI grade before publishing

Model: claude-sonnet-4-20250514 (grading needs quality reasoning)
Bulk mode: Grade entire class submission in one batch (Celery task)
"""
```

### 9. AI Student Wellbeing Analyzer — NEW
```python
"""
Input: student_mood_checkins[], attendance_patterns[], grade_trends[],
       incident_reports[], teacher_notes[], peer_interaction_data

Analysis:
1. Mood trend: declining, stable, improving over 30 days
2. Attendance correlation: mood drops → attendance drops?
3. Academic impact: mood changes → grade changes?
4. Behavioral flags: sudden aggression, withdrawal, isolation
5. Risk level: LOW / MEDIUM / HIGH / CRITICAL

Output:
- Risk dashboard: color-coded class view
- Individual student wellbeing report
- Recommended interventions (age-appropriate)
- Counselor referral trigger (auto-notify if HIGH/CRITICAL)
- Parent communication template (sensitive, professional)
- Trend graph for school-wide emotional health

Privacy: All data encrypted, only counselor + principal access
Model: claude-sonnet-4-20250514 (sensitive analysis needs best model)
"""
```

### 10. AI Adaptive Learning Path — NEW
```python
"""
Input: student_id, subject, current_grade, exam_results[],
       assignment_scores[], learning_style (visual/auditory/kinesthetic),
       weak_topics[], strong_topics[]

Process:
1. Analyze performance gaps per topic
2. Map to Nepal curriculum (CDC syllabus) or school-specific syllabus
3. Generate personalized learning path: sequence of topics + resources
4. Recommend: video content, practice problems, reading material
5. Adjust difficulty: too easy → skip ahead, struggling → provide scaffolding

Output:
- Personalized study plan (weekly)
- Topic mastery map: ████░░░░ 45% Algebra, ██████░░ 75% Geometry
- Recommended resources matched to learning style
- Practice problem sets (AI-generated, curriculum-aligned)
- Progress prediction: "At current pace, 80% mastery by Chaitra"
- Parent summary: simple "Your child needs focus on X, Y"

Model: claude-haiku-4-5 (fast, runs per-student frequently)
"""
```

### 11. AI Homework Helper Chatbot — NEW (Student-Facing)
```python
"""
Student asks: "I don't understand fractions" or sends photo of problem

Rules (CRITICAL):
1. NEVER give direct answers — guide student to discover
2. Use Socratic method: ask leading questions
3. Match language to student's grade level
4. Support Nepali + English, auto-detect
5. Use Nepal-relevant examples (Rs. currency, local context)
6. If student is frustrated → switch to encouraging, simpler explanation
7. Rate-limit: max 20 queries/day per student
8. Flag if student asks about non-academic/harmful content

Flow:
1. Student sends question/photo
2. AI identifies topic + difficulty level
3. Responds with hint, not answer
4. Student tries → AI checks attempt
5. After 3 failed attempts → show worked solution
6. Log session for teacher insight

Model: claude-haiku-4-5 (fast, interactive chat)
Safety: All sessions logged, no personal data in prompts
"""
```

### 12. AI School Benchmarking — NEW
```python
"""
Input: school_metrics{}, anonymized_peer_school_data[]

Metrics compared (anonymized, never school names):
- Subject-wise average marks distribution
- Attendance rates (by grade, gender)
- Teacher-student ratios
- Fee collection rates
- Parent engagement scores
- Digital adoption (app usage, online fee payment %)
- Extra-curricular participation

Output:
- School scorecard vs district/national average
- Strengths: "Your Grade 10 math scores are top 15% in Kathmandu"
- Improvement areas: "Attendance in Grade 6-8 below district average"
- Actionable recommendations (specific to school context)
- Trend: improving / declining / stable vs peers
- Target setting: "To reach top 25%, improve X by Y%"

Privacy: All peer data fully anonymized, opt-in only
Enterprise plan only
Model: claude-sonnet-4-20250514 (complex analysis)
"""
```

---

# ═══════════════════════════════════════════════════════════════════════
# PART 8: SAAS SCHOOL WEBSITE — PUBLIC PAGES (SSR)
# ═══════════════════════════════════════════════════════════════════════

## middleware.ts — Subdomain + Auth Routing

```typescript
// Runs on every request
// Detects subdomain → routes to correct Next.js section
// JWT check for dashboard routes

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const subdomain = hostname.split('.')[0]

  // Super admin panel
  if (subdomain === 'app') {
    return enforceAuth(request, '/super-admin')
  }

  // Known system subdomains → marketing/auth
  if (['www','aschool','staging'].includes(subdomain)) {
    return NextResponse.next()
  }

  // School subdomain → route to school section
  // All {subdomain}. requests → /school/{slug}/...
  const url = request.nextUrl.clone()
  const path = url.pathname

  // School dashboard routes
  if (path.startsWith('/admin'))   return enforceSchoolAuth(request, 'admin')
  if (path.startsWith('/teacher')) return enforceSchoolAuth(request, 'teacher')
  if (path.startsWith('/parent'))  return enforceSchoolAuth(request, 'parent')
  if (path.startsWith('/student')) return enforceSchoolAuth(request, 'student')

  // Public school website → rewrite to /school/[slug]/...
  url.pathname = `/school/${subdomain}${path}`
  const response = NextResponse.rewrite(url)
  response.headers.set('x-school-slug', subdomain)
  return response
}
```

## app/school/[slug]/page.tsx — Dynamic School Homepage

```typescript
// Server-side rendered school homepage
// ISR: revalidate every 5 minutes
// Uses school's active theme config

export const revalidate = 300

export default async function SchoolHomepage({ params }) {
  const { slug } = params

  // Fetch school data + website config
  const school = await fetchSchool(slug)
  if (!school?.website?.is_published) return notFound()

  const theme = getTheme(school.website.theme_slug)
  const sections = school.website.customizations.sections

  // Inject live data into dynamic sections
  const liveData = await Promise.all([
    fetchLatestNotices(school.id, 5),
    fetchUpcomingEvents(school.id, 3),
    fetchAdmissionStatus(school.id),
    fetchResultBanners(school.id),
  ])

  // Apply CSS variables from theme
  return (
    <SchoolThemeProvider theme={theme} customizations={school.website.customizations}>
      <SchoolLayout school={school}>
        {sections.map(section => (
          <DynamicSection
            key={section.id}
            section={section}
            liveData={liveData}
            school={school}
          />
        ))}
      </SchoolLayout>
    </SchoolThemeProvider>
  )
}

// SEO metadata — school-specific
export async function generateMetadata({ params }) {
  const school = await fetchSchool(params.slug)
  return {
    title: `${school.name} | ${school.tagline}`,
    description: school.website?.meta_description || \
      `${school.name} — ${school.type} school in ${school.municipality}, Nepal`,
    openGraph: { images: [school.website?.og_image_url || school.logo_url] },
    // Schema.org JSON-LD for Google
    other: {
      'application/ld+json': JSON.stringify({
        "@type": "EducationalOrganization",
        "name": school.name,
        "address": school.address,
        "telephone": school.phone,
        "url": \`https://${params.slug}.aschool.com.np\`
      })
    }
  }
}
```

## app/school/[slug]/admission/page.tsx — Live Admission Form

```typescript
// Connected to ASchool CRM — every submission creates AdmissionLead
// Real-time admission status banner: "Admissions Open for Grade 6-8"

export default function AdmissionPage({ params }) {
  return (
    <>
      <AdmissionStatusBanner schoolSlug={params.slug} />
      <AdmissionForm
        onSubmit={async (data) => {
          // POST /api/v1/admission/leads (public, no auth)
          // Creates lead → notifies school via WhatsApp
          // Parent gets WhatsApp confirmation immediately
          await createAdmissionLead({ ...data, schoolSlug: params.slug })
        }}
      />
      <FeeStructureTable schoolSlug={params.slug} />
      <AdmissionProcessSteps />
    </>
  )
}
```

## app/school/[slug]/results/page.tsx — Public Result Checker

```typescript
// Parents/students check results without logging in
// Enter: roll number OR student ID → see results

export default function ResultsPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)

  const checkResult = async () => {
    // GET /api/v1/exams/public-result?roll={query}&school={slug}
    // Returns: student name + subject-wise marks (no personal details)
    const data = await fetchPublicResult(query, params.slug)
    setResults(data)
  }

  return (
    <div>
      <h1>परीक्षाफल / Exam Results</h1>
      <input placeholder="Roll Number / Student ID" onChange={e => setQuery(e.target.value)} />
      <button onClick={checkResult}>Check Result</button>
      {results && <ResultCard data={results} />}
    </div>
  )
}
```

---

# ═══════════════════════════════════════════════════════════════════════
# PART 9: REAL-TIME, NOTIFICATIONS & GPS SAFERIDE
# ═══════════════════════════════════════════════════════════════════════

## Socket.IO Events — Complete Catalog

```python
# Room: school_{school_id} → all staff in that school

# Attendance
emit('attendance_submitted', {
    'class_id', 'class_name', 'present_count',
    'absent_count', 'teacher_name', 'period'
})

# Fee collection
emit('fee_collected', {
    'student_name', 'amount', 'payment_method',
    'collected_by', 'receipt_number'
})

# New admission lead
emit('new_lead', {
    'student_name', 'grade_applying', 'source',  # 'facebook'|'website'|'walkin'
    'parent_phone', 'received_at'
})

# Social message
emit('social_message', {
    'platform', 'sender_name', 'preview',
    'is_admission_inquiry', 'sentiment'
})

# WhatsApp message from parent
emit('whatsapp_message', {
    'parent_name', 'student_name', 'preview',
    'is_bot_handled', 'conversation_id'
})

# Bus events
emit('bus_departed', {'bus_id', 'bus_name', 'student_count', 'time'})
emit('bus_arrived_school', {'bus_id', 'time'})
emit('bus_route_deviation', {'bus_id', 'deviation_meters', 'location'})

# Risk alerts
emit('student_risk_alert', {
    'student_name', 'class', 'risk_level',
    'signals', 'recommended_action'
})

# Heartbeat every 30s
emit('heartbeat', {'timestamp', 'school_id'})
```

## GPS SafeRide System — Low-Cost Hardware

```
HARDWARE PER BUS (Total: ~Rs. 2,500-3,000):

Component           Price (Nepal)
─────────────────   ────────────
ESP32 Dev Board     Rs. 600-800
NEO-6M GPS Module   Rs. 400-600
SIM800L GSM Module  Rs. 500-700
Li-ion Battery      Rs. 300-400
12V Buck Converter  Rs. 150-200
SIM card (NTC/Ncell) Rs. 100 + monthly Rs. 150
Enclosure + wiring  Rs. 200-300
─────────────────   ────────────
TOTAL               Rs. 2,250-3,100/bus
Monthly cost        Rs. 150 (SIM data only)

Commercial GPS tracker: Rs. 2,000/month subscription
ASchool SafeRide:       Rs. 150/month → saves Rs. 1,850/bus/month
School with 5 buses:    Saves Rs. 9,250/month = Rs. 111,000/year
```

### hardware/ESP32_GPS_tracker/firmware.ino

```cpp
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// Firebase Realtime Database endpoint
const char* FIREBASE_URL = "https://aschool-gps.firebaseio.com";
const char* BUS_ID = "BUS_003";   // Configure per device
const char* SCHOOL_ID = "your-school-id";
const char* FIREBASE_SECRET = "your-firebase-secret";

TinyGPSPlus gps;
HardwareSerial gpsSerial(1);  // UART1

unsigned long lastSend = 0;
const int SEND_INTERVAL = 15000;  // Send every 15 seconds

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17);  // RX=16, TX=17
  connectWiFiOrGSM();  // Connect via SIM800L if no WiFi
}

void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());

  if (millis() - lastSend > SEND_INTERVAL) {
    if (gps.location.isValid()) {
      sendLocationToFirebase(
        gps.location.lat(),
        gps.location.lng(),
        gps.speed.kmph(),
        gps.course.deg(),
        gps.hdop.value()  // Accuracy
      );
      lastSend = millis();
    }
  }
}

void sendLocationToFirebase(float lat, float lng,
                             float speed, float heading, int accuracy) {
  HTTPClient http;
  String url = String(FIREBASE_URL) +
               "/schools/" + SCHOOL_ID +
               "/buses/" + BUS_ID +
               "/location.json?auth=" + FIREBASE_SECRET;

  String payload = "{\"lat\":" + String(lat, 7) +
                   ",\"lng\":" + String(lng, 7) +
                   ",\"speed\":" + String(speed, 1) +
                   ",\"heading\":" + String(heading, 1) +
                   ",\"accuracy\":" + String(accuracy) +
                   ",\"ts\":" + String(millis()) + "}";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.PUT(payload);
  http.end();
}
```

## Firebase Real-time Bus Data Flow

```
ESP32 on bus
    ↓ (every 15 seconds via SIM800L GSM)
Firebase Realtime DB
/schools/{school_id}/buses/{bus_id}/location
    {lat, lng, speed, heading, accuracy, ts}
    ↓ (real-time listener)
Parent Flutter App
    → flutter_map marker updates smoothly
    → ETA recalculated (Haversine formula)
    → "3 minutes" → notification fires
    ↓ (also)
Backend Celery task (polls Firebase every 30s)
    → Stores GPSLog to PostgreSQL (for history)
    → Detects route deviation (> 500m from route)
    → Alerts principal + parents if deviation
```

---

# ═══════════════════════════════════════════════════════════════════════
# PART 10: PLUGIN MARKETPLACE PRICING, DEPLOYMENT & BUSINESS MODEL
# ═══════════════════════════════════════════════════════════════════════

## ★ PLUGIN MARKETPLACE — Schools Pay Only for What They Use

```
═══════════════════════════════════════════════════════════════
PLATFORM BASE PLANS (controls school capacity, not features):
═══════════════════════════════════════════════════════════════

FREE — Rs. 0:
  - 1 school, up to 100 students
  - All FREE plugins included (5 core plugins)
  - ASchool branding on website
  - Community forum support
  - Install up to 3 paid plugins (with 14-day trials)
  → Goal: Get schools on platform, discover plugins they need

STANDARD — Rs. 999/month | Rs. 9,999/year:
  - 1 school, up to 500 students
  - All FREE plugins included
  - Remove ASchool branding
  - Custom domain (1)
  - Install unlimited paid plugins
  - Email + WhatsApp support
  → Target: Any school that outgrows free

ENTERPRISE — Rs. 4,999/month | Rs. 49,999/year:
  - Unlimited students
  - Multi-branch support
  - White-label (custom branding)
  - API access + webhooks
  - Priority support (4-hour SLA)
  - Dedicated account manager
  - Install unlimited paid plugins
  - Custom plugin development (1/year included)
  → Target: Chain schools, large institutions

═══════════════════════════════════════════════════════════════
PLUGIN MARKETPLACE — Install what you need:
═══════════════════════════════════════════════════════════════

🟢 FREE PLUGINS (always included):
  📋 Attendance                     Rs. 0/month
  📝 Notices & Circulars            Rs. 0/month
  📅 Academic Setup                 Rs. 0/month
  🌐 School Website (Basic)         Rs. 0/month  (5 themes)
  📊 Basic Reports                  Rs. 0/month

🔵 STARTER PLUGINS (Rs. 199–499/month each):
  💰 Fee Collection                 Rs. 399/month  | Rs. 3,999/year
  📝 Exams & Results                Rs. 399/month  | Rs. 3,999/year
  📚 Library Management             Rs. 199/month  | Rs. 1,999/year
  📨 SMS Notifications              Rs. 199/month  | Rs. 1,999/year  + per-SMS cost
  💬 WhatsApp Bot                   Rs. 399/month  | Rs. 3,999/year
  📋 Assignments & Homework         Rs. 299/month  | Rs. 2,999/year
  📖 E-Library & Digital Content    Rs. 299/month  | Rs. 2,999/year
  📅 PT Conference Scheduler        Rs. 199/month  | Rs. 1,999/year
  🚸 Student Dismissal/Pickup       Rs. 299/month  | Rs. 2,999/year
  📋 Incident Reporting             Rs. 199/month  | Rs. 1,999/year

🟡 GROWTH PLUGINS (Rs. 499–999/month each):
  🚌 GPS Bus Tracking               Rs. 599/month  | Rs. 5,999/year  + hardware
  📱 Social Media Hub               Rs. 699/month  | Rs. 6,999/year
  📢 Social Ad Boosting             Rs. 499/month  | Rs. 4,999/year  (req: Social Hub)
  🎓 Admission CRM                  Rs. 699/month  | Rs. 6,999/year
  🌐 Website Builder Pro            Rs. 499/month  | Rs. 4,999/year  (20 themes + AI builder)
  🎨 Design Studio                  Rs. 499/month  | Rs. 4,999/year
  👔 HR & Payroll                   Rs. 699/month  | Rs. 6,999/year
  🏥 Health Records                 Rs. 299/month  | Rs. 2,999/year
  🎓 Alumni Network                 Rs. 299/month  | Rs. 2,999/year
  🏆 Gamification                   Rs. 299/month  | Rs. 2,999/year
  📦 Inventory & Assets             Rs. 299/month  | Rs. 2,999/year
  👥 Visitor Management             Rs. 199/month  | Rs. 1,999/year
  📹 LMS (Live + Recorded)          Rs. 799/month  | Rs. 7,999/year
  🧠 Student Wellbeing              Rs. 499/month  | Rs. 4,999/year
  ✅ AI Auto-Grading                Rs. 599/month  | Rs. 5,999/year  + AI credits
  🤖 AI Homework Helper             Rs. 499/month  | Rs. 4,999/year  + AI credits
  📋 Full Incident Management       Rs. 399/month  | Rs. 3,999/year  (req: Incident Reporting)
  🆘 Emergency Alerts               Rs. 399/month  | Rs. 3,999/year
  📜 Government Compliance          Rs. 499/month  | Rs. 4,999/year
  🎒 Student Portfolio              Rs. 299/month  | Rs. 2,999/year

🔴 PREMIUM PLUGINS (Rs. 999–2999/month each):
  🤖 AI Tools Suite                 Rs. 1,499/month | Rs. 14,999/year
  📊 Advanced Analytics             Rs. 999/month   | Rs. 9,999/year
  🆘 Disaster Management (Full)     Rs. 999/month   | Rs. 9,999/year  (req: Emergency)
  📈 School Benchmarking            Rs. 1,499/month | Rs. 14,999/year
  🧠 AI Adaptive Learning           Rs. 1,499/month | Rs. 14,999/year  (req: LMS)
  🏢 Multi-Branch Chain             Rs. 2,999/month | Rs. 29,999/year
  ✋ Biometric Integration           Rs. 1,999/month | Rs. 19,999/year
  🏷️ White-Label Branding           Rs. 2,999/month | Rs. 29,999/year

💳 PAY-PER-USE ADD-ONS:
  AI Credits (100k tokens):         Rs. 499/pack
  Extra WhatsApp messages (1000):   Rs. 199/pack
  Extra SMS credits (500):          Rs. 199/pack
  Extra custom domain:              Rs. 299/month
  Extra storage (10GB):             Rs. 199/month

🔧 HARDWARE:
  GPS SafeRide ESP32 Device:        Rs. 3,500/device (cost Rs. 2,500)
  → School with 5 buses = Rs. 17,500 hardware + Rs. 599/month plugin

═══════════════════════════════════════════════════════════════
EXAMPLE SCHOOL CONFIGURATIONS:
═══════════════════════════════════════════════════════════════

🏫 Small Community School (200 students, budget-conscious):
  Base: Standard plan                Rs. 999/month
  + Fee Collection                   Rs. 399/month
  + SMS Notifications                Rs. 199/month
  + Exams & Results                  Rs. 399/month
  ─────────────────────────────────
  TOTAL:                             Rs. 1,996/month (Rs. ~10/student)

🏫 Mid-Size Private School (400 students):
  Base: Standard plan                Rs. 999/month
  + Fee Collection                   Rs. 399/month
  + Exams & Results                  Rs. 399/month
  + WhatsApp Bot                     Rs. 399/month
  + GPS Bus Tracking                 Rs. 599/month
  + Website Builder Pro              Rs. 499/month
  + LMS                              Rs. 799/month
  + AI Tools Suite                   Rs. 1,499/month
  ─────────────────────────────────
  TOTAL:                             Rs. 5,592/month (Rs. ~14/student)

🏫 Premium Boarding School (800 students, wants everything):
  Base: Standard plan                Rs. 999/month
  + 10 Starter plugins               ~Rs. 2,800/month
  + 12 Growth plugins                ~Rs. 5,800/month
  + AI Tools Suite                   Rs. 1,499/month
  + Advanced Analytics               Rs. 999/month
  ─────────────────────────────────
  TOTAL:                             ~Rs. 12,097/month (Rs. ~15/student)

🏫 Chain School (3 branches, 2000+ students):
  Base: Enterprise plan              Rs. 4,999/month
  + Multi-Branch Chain               Rs. 2,999/month
  + All Growth plugins               ~Rs. 8,000/month
  + All Premium plugins              ~Rs. 10,000/month
  ─────────────────────────────────
  TOTAL:                             ~Rs. 25,998/month

EVERY PLUGIN: 14-day free trial → school tests before paying.
```

## ★ Plugin Marketplace Psychology — Why This Works Better Than Tiers

```
OLD MODEL (fixed tiers): School pays Rs. 3,999/month for 20 features they don't use
NEW MODEL (plugins):     School pays Rs. 1,996/month for exactly 4 things they need

Benefits:
1. LOWER BARRIER: School starts free → adds fee collection → adds exams → grows organically
2. NO WASTE: Community school doesn't pay for Social Hub they'll never use
3. UPSELL PATH: Every uninstalled plugin is a visible upsell in their dashboard
4. TRIAL HOOK: 14-day trial per plugin → school gets hooked → converts to paid
5. TRANSPARENT: School controls their own bill — no "what am I paying for?"
6. STICKY: More plugins installed → harder to switch (data + workflow dependency)
7. COMPETITION KILLER: Competitors sell fixed packages — we let schools customize

Revenue Growth Strategy:
- Month 1: School installs 2-3 plugins (Rs. ~1,000/month)
- Month 3: School installs 2 more after seeing value (Rs. ~2,000/month)
- Month 6: School installs LMS + AI (Rs. ~4,000/month)
- Month 12: School has 10+ plugins (Rs. ~6,000/month)
- ARPU grows 6x organically without any sales calls
```

## Revenue Projections (Plugin Model)

```
Year 1 (Father's school + 20 early adopters):
  Average 4 plugins × Rs. 350 avg = Rs. 1,400 plugin revenue/school
  + Standard plan: Rs. 999/school
  20 schools × Rs. 2,399: Rs. 48,000/month
  + GPS hardware sales (50 units): Rs. 175,000 one-time
  Total MRR: Rs. 48,000 → ARR: Rs. 576,000

Year 2 (100 schools, avg 6 plugins each):
  100 × (Rs. 999 + Rs. 2,100 plugins) = Rs. 310,000/month
  Total MRR: Rs. 310,000 → ARR: Rs. 3.7M

Year 3 (500 schools, avg 8 plugins each):
  500 × (Rs. 999 + Rs. 2,800 plugins) = Rs. 1,900,000/month
  Total MRR: Rs. 1,900,000 → ARR: Rs. 22.8M
  + 5 Enterprise chains: Rs. 130,000/month

Key insight: Plugin model ARPU grows over time as schools add more plugins.
No sales needed — schools self-serve from marketplace.
```

## Go-To-Market Strategy

```
PHASE 1 — PROOF (Month 1-3):
  - Deploy at father's school (free plan + all plugins free for testing)
  - Measure: admin hours saved/week, fee collection improvement,
             parent satisfaction NPS score
  - Document which plugins provide most value (data for marketplace ranking)
  - Build case study: "ASchool saved BDPS 15 hours/week with just 5 plugins"
  - Launch school website for father's school → show as live demo

PHASE 2 — EXPANSION (Month 4-6):
  - Cold outreach to 50 nearby schools with case study
  - Target pain: "How many hours does your staff spend on fee collection?"
  - Demo: show father's school's live dashboard
  - Offer: Free plan forever + 30-day trial on ALL plugins
  - First 10 schools: personally recommend which plugins they need
  - Let THEM choose — don't force bundles

PHASE 3 — GROWTH (Month 7-12):
  - Partner with Nepal Private School Association
  - Teacher WhatsApp groups (where principals lurk) — post testimonials
  - Facebook groups of school owners
  - YouTube channel: "How ASchool saves 20 hours/week at BDPS"
  - School conference demos
  - Agency model: train 5 IT agencies to resell (30% commission)

COMPETITION ATTACK:
  - Veda App comparison page: aschool.com.np/vs/veda
  - Smart School comparison: aschool.com.np/vs/smart-school
  - Free migration: "We migrate your data from any system — free"
  - Target their unhappy customers in FB groups + Reddit Nepal
```

## Docker Compose Production

```yaml
version: '3.9'
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    # Handles: *.aschool.com.np routing
    # school subdomain → Next.js school website
    # app.aschool.com.np → Next.js dashboard
    # /api/* → Flask backend
    # /socket.io/ → Flask Socket.IO (WebSocket upgrade)

  nextjs:
    build: ./frontend
    environment: [NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL]

  flask:
    build: ./backend
    command: gunicorn --worker-class eventlet -w 4 wsgi:app
    environment: [DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY, ...]

  postgres:
    image: pgvector/pgvector:pg16
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine

  celery-worker:
    build: ./backend
    command: celery -A app.celery worker -Q default,ai,notifications,gps
    replicas: 2

  celery-beat:
    build: ./backend
    command: celery -A app.celery beat --scheduler redbeat.RedBeatScheduler

  flower:
    image: mher/flower
    # Monitor Celery tasks at :5555
```

## nginx/nginx.conf — Subdomain Routing

```nginx
# Map subdomains
map $host $school_slug {
    ~^(?<slug>[^.]+)\.aschool\.com\.np$ $slug;
    default "";
}

# App/dashboard → Next.js dashboard routes
server {
    listen 443 ssl;
    server_name app.aschool.com.np;
    location / { proxy_pass http://nextjs:3000; }
    location /api/ { proxy_pass http://flask:5000; }
    location /socket.io/ {
        proxy_pass http://flask:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# All school subdomains → school website (public) or portals
server {
    listen 443 ssl;
    server_name ~^(?<slug>[^.]+)\.aschool\.com\.np$;

    location / {
        proxy_pass http://nextjs:3000;
        proxy_set_header X-School-Slug $slug;
        # ISR cache: 5 min for school websites
        proxy_cache school_pages_cache;
        proxy_cache_valid 200 5m;
        add_header X-Cache-Status $upstream_cache_status;
    }

    location /api/ { proxy_pass http://flask:5000; }
    location /webhooks/ {
        limit_req zone=webhook burst=200;
        proxy_pass http://flask:5000;
    }
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=webhook:10m rate=200r/m;
```

---

# ═══════════════════════════════════════════════════════════════════════
# CODING STANDARDS — APPLY TO ALL CODE
# ═══════════════════════════════════════════════════════════════════════

## ★ Plugin System Rules (CRITICAL — Apply Everywhere):
1. **Every feature is a plugin** — no feature should be hardcoded to always appear
2. **Backend**: Every plugin route MUST use `@plugin_required('slug')` decorator
3. **Frontend**: Every plugin page MUST be wrapped in `<PluginGate slug="...">` component
4. **Flutter**: Every feature screen MUST check `pluginProvider.isInstalled('slug')`
5. **Sidebar/Nav**: Menu items are dynamically built from `GET /api/v1/plugins/installed`
6. **Data isolation**: Plugin uninstall = soft-disable, NEVER delete data
7. **Dependencies**: Check `depends_on` before install (e.g., LMS requires Attendance)
8. **Manifest**: Every plugin has a YAML manifest defining routes, UI, dependencies, pricing
9. **Events**: Plugins communicate via event bus, never direct imports between plugin modules
10. **Billing**: Plugin usage tracked in PluginUsageLog for pay-per-use add-ons

## Python/Flask Rules:
1. Response format: `{"success": bool, "data": {}, "error": null, "meta": {pagination}}`
2. Every model: `id (UUID PK), created_at, updated_at, is_deleted, school_id`
3. **Multi-tenancy**: EVERY query MUST filter by `school_id` — raise `SchoolIsolationError` if missing
4. JWT required on ALL non-public endpoints
5. Rate limiting: 60r/min API, 10r/min auth, 200r/min webhooks
6. Never hardcode secrets — `.env` only
7. Claude API: retry 3x with exponential backoff, timeout 30s (haiku) / 60s (sonnet)
8. Cache: school config TTL=10min, student lists TTL=5min, AI responses TTL=1hr
9. Google-style docstrings on all functions
10. Sentry capture on all unexpected exceptions
11. Structured JSON logging: include `school_id, user_id, request_id` always

## TypeScript/Next.js Rules:
1. Strict mode: no `any`, proper generics, Zod validation on all inputs
2. SWR for all data fetching (revalidate: 30s default)
3. Error boundaries on all pages
4. Shimmer loading skeletons on all async content
5. Mobile-first responsive (always)
6. Lighthouse 90+ enforced in CI
7. ISR for school websites: revalidate=300 (5 minutes)

## Dart/Flutter Rules:
1. Riverpod 2.x with code generation (AsyncNotifier)
2. Freezed for all data models
3. Isar for all offline storage
4. GoRouter for navigation + deep links
5. flutter_animate for all animations
6. ALL text: support Nepali Unicode + English
7. BS dates displayed alongside AD dates always
8. Offline-first: every feature must work without internet
9. Handle all states: loading, error, empty, offline
10. Accessibility: semantic labels on all interactive elements

## Nepal-Specific Rules:
1. Prices: formatted as "रू. X,XX,XXX" (Nepali number system)
2. Phone: +977-XXXXXXXXXX format with validation
3. Dates: always show both BS and AD
4. Timezone: Asia/Kathmandu (UTC+5:45) — note: unusual 45-minute offset
5. Default language: Nepali (ne) first, English (en) second
6. SMS via Sparrow SMS (Nepal's most reliable)
7. Payments: eSewa first (most widely used in Nepal)
8. Maps: OpenStreetMap (free, good Nepal coverage, no API cost)
9. Festival calendar: Dashain/Tihar/Teej affect school calendars
10. Academic year: starts Baisakh (April/May), BS calendar primary

---

# ═══════════════════════════════════════════════════════════════════════
# GENERATE ORDER — Run These Parts in Sequence
# ═══════════════════════════════════════════════════════════════════════

IMPORTANT: Every module is a PLUGIN. Generate code with @plugin_required()
decorators, PluginGate wrappers, and plugin manifest YAML files.

PART 1 → Generate: docker-compose.yml, requirements.txt, pubspec.yaml (shared),
                   .env.example, backend/config.py, backend/extensions.py,
                   backend/app/__init__.py (with PluginLoader integration),
                   frontend/package.json

PART 2 → Generate: ★ Plugin system core files FIRST:
                   backend/app/plugins/registry.py, loader.py, decorators.py,
                   events.py, billing.py
                   backend/app/models/plugin.py (Plugin, SchoolPlugin, PluginUsageLog)
                   All plugin manifest YAML files (one per plugin)
                   Then: All SQLAlchemy models for each plugin module
                   (lms.py, wellbeing.py, dismissal.py, compliance.py,
                   emergency.py, digital_content.py, conference.py,
                   portfolio.py, incident.py, etc.)

PART 3 → Generate: backend/app/api/v1/plugins.py (marketplace API — CORE)
                   All Flask Blueprint API files (each with @plugin_required)
                   All Celery background tasks
                   All service files (AI, social, payments, GPS)
                   Each plugin's API must:
                   - Use @plugin_required('slug') on every route
                   - Register as separate blueprint (loaded by PluginLoader)
                   - Emit events via inter-plugin event bus

PART 4 → Generate: ★ Plugin marketplace pages: (marketplace)/ route group
                   PluginCard, PluginDetail, InstallButton components
                   Plugin-aware Sidebar.tsx (dynamic menu from installed plugins)
                   PluginGate.tsx wrapper component
                   frontend/lib/plugins.ts (useInstalledPlugins hook)
                   All Next.js dashboard pages + components (each wrapped in PluginGate)
                   middleware.ts (subdomain routing)
                   School website public pages (SSR)
                   Website builder (Craft.js editor)

PART 5 → Generate: ★ Flutter plugin system:
                   shared/services/plugin_provider.dart (Riverpod provider)
                   shared/widgets/plugin_gate.dart (conditional render)
                   shared/models/plugin_manifest.dart (Freezed model)
                   All 4 Flutter apps with dynamic bottom nav (plugin-aware)
                   Shared data models (Freezed) + API client (Retrofit + Dio)
                   Offline sync service (Isar) + plugin cache
                   All feature screens wrapped in PluginGate
                   GoRouter with plugin redirect guards

PART 6 → Generate: nginx.conf, docker-compose.prod.yml,
                   .github/workflows/deploy.yml,
                   All test files (pytest + Jest + Flutter)
                   Plugin system tests: install/uninstall/billing/access
                   ESP32 GPS firmware (Arduino/C++)
                   Plugin manifest validation tests
                   Database seed: create all Plugin records in plugins table

---

*End of ASchool ULTIMATE Build Prompts v2.0*
*══════════════════════════════════════════════════════*
*PLUGIN-BASED ARCHITECTURE | 35+ INSTALLABLE PLUGINS*
*20 THEMES | 4 FLUTTER APPS | PLUGIN MARKETPLACE*
*Schools install only what they need — pay per plugin*
*Web + Flask Backend + School Website Builder + GPS*
*Nepal-Native 🇳🇵 — Built Inside a Real School — AI-First*
