"""
Full seed script — insert all 43 plugins with exact pricing from the spec,
plus demo school data with users across all roles.

Usage:
    python seed_full.py

This extends the basic seed.py with complete marketplace data.
"""
from app import create_app
from app.models.plugin import Plugin, SchoolPlugin
from app.models.school import School
from app.models.user import User
from extensions import db

ALL_PLUGINS = [
    # ═══════════ FREE (core) ═══════════
    {"slug": "attendance", "name": "Attendance Management", "name_nepali": "उपस्थिति व्यवस्थापन", "category": "core", "price_monthly": 0, "price_yearly": 0, "is_free": True, "emoji": "📋", "icon": "UserCheck", "description": "Digital attendance register — daily student & teacher attendance, bulk marking, QR check-in", "sort_order": 1},
    {"slug": "notices", "name": "Notices & Circulars", "name_nepali": "सूचना तथा परिपत्र", "category": "core", "price_monthly": 0, "price_yearly": 0, "is_free": True, "emoji": "📝", "icon": "Bell", "description": "School communication — notices, circulars, announcements with push notifications", "sort_order": 2},
    {"slug": "academics", "name": "Academic Setup", "name_nepali": "शैक्षिक सेटअप", "category": "core", "price_monthly": 0, "price_yearly": 0, "is_free": True, "emoji": "📅", "icon": "BookOpen", "description": "Classes, sections, subjects, timetable management", "sort_order": 3},
    {"slug": "basic_website", "name": "School Website (Basic)", "name_nepali": "विद्यालय वेबसाइट (आधारभूत)", "category": "core", "price_monthly": 0, "price_yearly": 0, "is_free": True, "emoji": "🌐", "icon": "Globe", "description": "{slug}.aschool.com.np — 5 themes, about, contact, gallery", "sort_order": 4},
    {"slug": "basic_reports", "name": "Basic Reports", "name_nepali": "आधारभूत प्रतिवेदन", "category": "core", "price_monthly": 0, "price_yearly": 0, "is_free": True, "emoji": "📊", "icon": "FileText", "description": "Attendance summaries, student count reports", "sort_order": 5},
    # ═══════════ STARTER ═══════════
    {"slug": "fees", "name": "Fee Collection", "name_nepali": "शुल्क संकलन", "category": "starter", "price_monthly": 399, "price_yearly": 3999, "is_free": False, "trial_days": 14, "emoji": "💰", "icon": "BadgeDollarSign", "description": "Digital fees, receipts, eSewa/Khalti/FonePay payment", "sort_order": 10},
    {"slug": "exams", "name": "Exams & Results", "name_nepali": "परीक्षा र नतिजा", "category": "starter", "price_monthly": 399, "price_yearly": 3999, "is_free": False, "trial_days": 14, "emoji": "📝", "icon": "ClipboardList", "description": "Exam scheduling, marks entry, report cards, Nepal grading system", "sort_order": 11},
    {"slug": "library_management", "name": "Library Management", "name_nepali": "पुस्तकालय व्यवस्थापन", "category": "starter", "price_monthly": 199, "price_yearly": 1999, "is_free": False, "trial_days": 14, "emoji": "📚", "icon": "Library", "description": "Book catalog, issue/return, overdue tracking", "sort_order": 12},
    {"slug": "sms_notifications", "name": "SMS Notifications", "name_nepali": "SMS सूचना", "category": "starter", "price_monthly": 199, "price_yearly": 1999, "is_free": False, "trial_days": 14, "emoji": "📨", "icon": "MessageSquare", "description": "Sparrow SMS integration — bulk SMS, automated alerts", "sort_order": 13},
    {"slug": "whatsapp_bot", "name": "WhatsApp Bot", "name_nepali": "व्हाट्सएप बोट", "category": "starter", "price_monthly": 399, "price_yearly": 3999, "is_free": False, "trial_days": 14, "emoji": "💬", "icon": "MessageCircle", "description": "Two-way WhatsApp communication, automated responses", "sort_order": 14},
    {"slug": "assignments", "name": "Assignments & Homework", "name_nepali": "गृहकार्य", "category": "starter", "price_monthly": 299, "price_yearly": 2999, "is_free": False, "trial_days": 14, "emoji": "📋", "icon": "FileEdit", "description": "Create, submit, track assignments with file attachments", "sort_order": 15},
    {"slug": "elibrary", "name": "E-Library & Digital Content", "name_nepali": "ई-पुस्तकालय", "category": "starter", "price_monthly": 299, "price_yearly": 2999, "is_free": False, "trial_days": 14, "emoji": "📖", "icon": "Tablet", "description": "Digital books, past papers, educational resources", "sort_order": 16},
    {"slug": "conferences", "name": "PT Conference Scheduler", "name_nepali": "अभिभावक भेटघाट", "category": "starter", "price_monthly": 199, "price_yearly": 1999, "is_free": False, "trial_days": 14, "emoji": "📅", "icon": "CalendarCheck", "description": "Parent-teacher meeting scheduling, slot booking", "sort_order": 17},
    {"slug": "dismissal", "name": "Student Dismissal/Pickup", "name_nepali": "विद्यार्थी विदाई", "category": "starter", "price_monthly": 299, "price_yearly": 2999, "is_free": False, "trial_days": 14, "emoji": "🚸", "icon": "ShieldCheck", "description": "QR-based safe pickup, authorized person list", "sort_order": 18},
    {"slug": "incidents", "name": "Incident Reporting", "name_nepali": "घटना प्रतिवेदन", "category": "starter", "price_monthly": 199, "price_yearly": 1999, "is_free": False, "trial_days": 14, "emoji": "📋", "icon": "AlertTriangle", "description": "Basic behavior tracking, incident logging", "sort_order": 19},
    # ═══════════ GROWTH ═══════════
    {"slug": "gps_tracking", "name": "GPS Bus Tracking", "name_nepali": "GPS बस ट्र्याकिङ", "category": "growth", "price_monthly": 599, "price_yearly": 5999, "is_free": False, "trial_days": 14, "emoji": "🚌", "icon": "Bus", "description": "DIY ESP32 SafeRide — live bus tracking, parent app map", "sort_order": 20},
    {"slug": "social_hub", "name": "Social Media Hub", "name_nepali": "सामाजिक मिडिया हब", "category": "growth", "price_monthly": 699, "price_yearly": 6999, "is_free": False, "trial_days": 14, "emoji": "📱", "icon": "Share2", "description": "Unified FB+IG+TikTok+YouTube scheduling & analytics", "sort_order": 21},
    {"slug": "social_ads", "name": "Social Ad Boosting", "name_nepali": "विज्ञापन बुस्टिङ", "category": "growth", "price_monthly": 499, "price_yearly": 4999, "is_free": False, "trial_days": 14, "emoji": "📢", "icon": "Megaphone", "description": "Meta Ads API post boosting for admission campaigns", "depends_on": ["social_hub"], "sort_order": 22},
    {"slug": "admission", "name": "Admission CRM", "name_nepali": "भर्ना CRM", "category": "growth", "price_monthly": 699, "price_yearly": 6999, "is_free": False, "trial_days": 14, "emoji": "🎓", "icon": "UserPlus", "description": "Full lead funnel: social → form → interview → enrolled", "sort_order": 23},
    {"slug": "website_builder", "name": "Website Builder (Pro)", "name_nepali": "वेबसाइट बिल्डर (प्रो)", "category": "growth", "price_monthly": 499, "price_yearly": 4999, "is_free": False, "trial_days": 14, "emoji": "🌐", "icon": "PaintBrush", "description": "20 themes + custom domain + AI builder + Craft.js editor", "sort_order": 24},
    {"slug": "design_studio", "name": "Design Studio", "name_nepali": "डिजाइन स्टुडियो", "category": "growth", "price_monthly": 499, "price_yearly": 4999, "is_free": False, "trial_days": 14, "emoji": "🎨", "icon": "Palette", "description": "Canva-like designer — certificates, ID cards, flyers", "sort_order": 25},
    {"slug": "hr_payroll", "name": "HR & Payroll", "name_nepali": "कर्मचारी तथा तलब", "category": "growth", "price_monthly": 699, "price_yearly": 6999, "is_free": False, "trial_days": 14, "emoji": "👔", "icon": "Briefcase", "description": "Staff payroll, leave management, appraisal, PF/SSF", "sort_order": 26},
    {"slug": "health_records", "name": "Health Records", "name_nepali": "स्वास्थ्य अभिलेख", "category": "growth", "price_monthly": 299, "price_yearly": 2999, "is_free": False, "trial_days": 14, "emoji": "🏥", "icon": "Heart", "description": "Student medical records, vaccination tracking", "sort_order": 27},
    {"slug": "alumni", "name": "Alumni Network", "name_nepali": "पूर्व विद्यार्थी नेटवर्क", "category": "growth", "price_monthly": 299, "price_yearly": 2999, "is_free": False, "trial_days": 14, "emoji": "🎓", "icon": "Users", "description": "Alumni portal, mentoring, events, donation tracking", "sort_order": 28},
    {"slug": "gamification", "name": "Gamification", "name_nepali": "गेमिफिकेशन", "category": "growth", "price_monthly": 299, "price_yearly": 2999, "is_free": False, "trial_days": 14, "emoji": "🏆", "icon": "Trophy", "description": "XP points, badges, leaderboards, rewards", "sort_order": 29},
    {"slug": "inventory", "name": "Inventory & Assets", "name_nepali": "सामग्री व्यवस्थापन", "category": "growth", "price_monthly": 299, "price_yearly": 2999, "is_free": False, "trial_days": 14, "emoji": "📦", "icon": "Package", "description": "QR asset tracking, procurement, depreciation", "sort_order": 30},
    {"slug": "visitor_management", "name": "Visitor Management", "name_nepali": "आगन्तुक व्यवस्थापन", "category": "growth", "price_monthly": 199, "price_yearly": 1999, "is_free": False, "trial_days": 14, "emoji": "👥", "icon": "UserCheck2", "description": "Visitor log, appointments, ID verification", "sort_order": 31},
    {"slug": "lms", "name": "LMS (Live + Recorded)", "name_nepali": "शिक्षण व्यवस्थापन प्रणाली", "category": "growth", "price_monthly": 799, "price_yearly": 7999, "is_free": False, "trial_days": 14, "emoji": "📹", "icon": "Video", "description": "Courses, live classes via Jitsi, recorded video library", "sort_order": 32},
    {"slug": "wellbeing", "name": "Student Wellbeing", "name_nepali": "विद्यार्थी कल्याण", "category": "growth", "price_monthly": 499, "price_yearly": 4999, "is_free": False, "trial_days": 14, "emoji": "🧠", "icon": "HeartPulse", "description": "Mood tracking, counselor dashboard, mindfulness", "sort_order": 33},
    {"slug": "ai_grading", "name": "AI Auto-Grading", "name_nepali": "AI स्वचालित ग्रेडिङ", "category": "growth", "price_monthly": 599, "price_yearly": 5999, "is_free": False, "trial_days": 14, "emoji": "✅", "icon": "CheckCircle", "description": "AI grades homework, rubric analysis, plagiarism check", "sort_order": 34},
    {"slug": "ai_tutor", "name": "AI Homework Helper", "name_nepali": "AI गृहकार्य सहायक", "category": "growth", "price_monthly": 499, "price_yearly": 4999, "is_free": False, "trial_days": 14, "emoji": "🤖", "icon": "Bot", "description": "Student AI tutor chatbot — 24/7 subject help", "sort_order": 35},
    {"slug": "incident_management", "name": "Full Incident Management", "name_nepali": "पूर्ण घटना व्यवस्थापन", "category": "growth", "price_monthly": 399, "price_yearly": 3999, "is_free": False, "trial_days": 14, "emoji": "📋", "icon": "ShieldAlert", "description": "Full behavior management — witnesses, escalation, parent conferences", "depends_on": ["incidents"], "sort_order": 36},
    {"slug": "emergency", "name": "Emergency Alerts", "name_nepali": "आपतकालीन सूचना", "category": "growth", "price_monthly": 399, "price_yearly": 3999, "is_free": False, "trial_days": 14, "emoji": "🆘", "icon": "Siren", "description": "Emergency broadcast, instant parent WhatsApp/SMS blast", "sort_order": 37},
    {"slug": "compliance", "name": "Government Compliance", "name_nepali": "सरकारी अनुपालन", "category": "growth", "price_monthly": 499, "price_yearly": 4999, "is_free": False, "trial_days": 14, "emoji": "📜", "icon": "FileCheck", "description": "MoE flash reports, EMIS export, DEO format", "sort_order": 38},
    {"slug": "student_portfolio", "name": "Student Portfolio", "name_nepali": "विद्यार्थी पोर्टफोलियो", "category": "growth", "price_monthly": 299, "price_yearly": 2999, "is_free": False, "trial_days": 14, "emoji": "🎒", "icon": "Backpack", "description": "Digital achievement portfolio, badges, PDF export", "sort_order": 39},
    # ═══════════ PREMIUM ═══════════
    {"slug": "ai_tools", "name": "AI Tools Suite", "name_nepali": "AI उपकरण सूट", "category": "premium", "price_monthly": 1499, "price_yearly": 14999, "is_free": False, "trial_days": 7, "emoji": "🤖", "icon": "Sparkles", "description": "AI question paper, lesson plan, timetable, remarks generator", "sort_order": 40},
    {"slug": "advanced_analytics", "name": "Advanced Analytics", "name_nepali": "उन्नत विश्लेषण", "category": "premium", "price_monthly": 999, "price_yearly": 9999, "is_free": False, "trial_days": 7, "emoji": "📊", "icon": "BarChart3", "description": "AI weekly insights, at-risk detection, dropout prediction", "sort_order": 41},
    {"slug": "disaster_management", "name": "Disaster Management", "name_nepali": "विपद व्यवस्थापन", "category": "premium", "price_monthly": 999, "price_yearly": 9999, "is_free": False, "trial_days": 7, "emoji": "🆘", "icon": "Shield", "description": "Earthquake API, evacuation plans, drill scheduling", "depends_on": ["emergency"], "sort_order": 42},
    {"slug": "benchmarking", "name": "School Benchmarking", "name_nepali": "विद्यालय बेन्चमार्किङ", "category": "premium", "price_monthly": 1499, "price_yearly": 14999, "is_free": False, "trial_days": 7, "emoji": "📈", "icon": "TrendingUp", "description": "Anonymous school-to-school comparison, national rankings", "sort_order": 43},
    {"slug": "ai_adaptive_learning", "name": "AI Adaptive Learning", "name_nepali": "AI अनुकूली शिक्षा", "category": "premium", "price_monthly": 1499, "price_yearly": 14999, "is_free": False, "trial_days": 7, "emoji": "🧠", "icon": "Brain", "description": "Personalized learning paths per student", "depends_on": ["lms"], "sort_order": 44},
    {"slug": "multi_branch", "name": "Multi-Branch Chain", "name_nepali": "बहु-शाखा चेन", "category": "premium", "price_monthly": 2999, "price_yearly": 29999, "is_free": False, "trial_days": 7, "emoji": "🏢", "icon": "Building2", "description": "Cross-school unified dashboard, chain analytics", "sort_order": 45},
    {"slug": "biometric", "name": "Biometric Integration", "name_nepali": "बायोमेट्रिक इन्टिग्रेसन", "category": "premium", "price_monthly": 1999, "price_yearly": 19999, "is_free": False, "trial_days": 7, "emoji": "✋", "icon": "Fingerprint", "description": "ZKTeco fingerprint attendance", "depends_on": ["attendance"], "sort_order": 46},
    {"slug": "white_label", "name": "White-Label Branding", "name_nepali": "ह्वाइट-लेबल ब्राण्डिङ", "category": "premium", "price_monthly": 2999, "price_yearly": 29999, "is_free": False, "trial_days": 7, "emoji": "🏷️", "icon": "Tag", "description": "Custom branding, own domain, remove ASchool branding", "sort_order": 47},
]


def seed_all_plugins():
    """Insert all 43 plugins. Updates existing records with latest pricing."""
    created = 0
    updated = 0
    for p_data in ALL_PLUGINS:
        existing = Plugin.query.filter_by(slug=p_data["slug"]).first()
        if existing:
            # Update pricing and metadata
            existing.name = p_data["name"]
            existing.name_nepali = p_data.get("name_nepali")
            existing.category = p_data["category"]
            existing.price_monthly = p_data.get("price_monthly", 0)
            existing.price_yearly = p_data.get("price_yearly", 0)
            existing.is_free = p_data.get("is_free", False)
            existing.emoji = p_data.get("emoji")
            existing.icon = p_data.get("icon")
            existing.description = p_data.get("description")
            existing.sort_order = p_data.get("sort_order", 0)
            existing.depends_on = p_data.get("depends_on", [])
            existing.trial_days = p_data.get("trial_days", 14)
            existing.is_published = True
            updated += 1
        else:
            plugin = Plugin(
                slug=p_data["slug"],
                name=p_data["name"],
                name_nepali=p_data.get("name_nepali"),
                category=p_data["category"],
                price_monthly=p_data.get("price_monthly", 0),
                price_yearly=p_data.get("price_yearly", 0),
                is_free=p_data.get("is_free", False),
                trial_days=p_data.get("trial_days", 14),
                emoji=p_data.get("emoji"),
                icon=p_data.get("icon"),
                description=p_data.get("description"),
                depends_on=p_data.get("depends_on", []),
                sort_order=p_data.get("sort_order", 0),
                is_published=True,
                version="1.0.0",
            )
            db.session.add(plugin)
            created += 1

    db.session.commit()
    total = len(ALL_PLUGINS)
    print(f"✅ Plugins: {created} created, {updated} updated ({total} total)")
    return total


def seed_demo_school_full():
    """Create demo school with all free + starter plugins."""
    from app.plugins.billing import install_plugin

    school = School.query.filter_by(slug="demo").first()
    if not school:
        school = School(
            name="ASchool Demo Vidyalaya",
            name_nepali="एस्कूल डेमो विद्यालय",
            slug="demo",
            plan="growth",
            status="active",
            is_active=True,
            phone="+9779800000001",
            email="demo@aschool.com.np",
            province="Bagmati",
            district="Kathmandu",
            municipality="Kathmandu Metropolitan City",
            ward="10",
            type="private",
            level="all",
            default_language="ne",
            working_days=["sun", "mon", "tue", "wed", "thu", "fri"],
            total_students=450,
            total_staff=35,
        )
        db.session.add(school)
        db.session.commit()
        print("✅ Demo school created (slug: demo)")

    # Install free + starter plugins
    target_slugs = [p["slug"] for p in ALL_PLUGINS if p["category"] in ("core", "starter")]
    installed = 0
    for slug in target_slugs:
        sp = SchoolPlugin.query.filter_by(school_id=school.id, plugin_slug=slug).first()
        if not sp:
            result = install_plugin(str(school.id), slug)
            if "error" not in result:
                installed += 1

    print(f"✅ Installed {installed} plugins for demo school")
    return school


def seed_demo_users(school):
    """Create demo users for all roles."""
    demo_users = [
        {"role": "school_admin", "full_name": "Ram Bahadur Sharma", "full_name_nepali": "राम बहादुर शर्मा", "phone": "+9779841111001", "email": "admin@demo.aschool.com.np", "gender": "male"},
        {"role": "accountant", "full_name": "Sita Devi Adhikari", "full_name_nepali": "सीता देवी अधिकारी", "phone": "+9779841111002", "email": "accountant@demo.aschool.com.np", "gender": "female"},
        {"role": "teacher", "full_name": "Hari Prasad Gurung", "full_name_nepali": "हरि प्रसाद गुरुङ", "phone": "+9779841111003", "gender": "male"},
        {"role": "teacher", "full_name": "Maya Kumari KC", "full_name_nepali": "माया कुमारी केसी", "phone": "+9779841111004", "gender": "female"},
        {"role": "teacher", "full_name": "Binod Thapa", "full_name_nepali": "बिनोद थापा", "phone": "+9779841111005", "gender": "male"},
        {"role": "parent", "full_name": "Bishal Tamang", "full_name_nepali": "बिशाल तामाङ", "phone": "+9779841111006", "gender": "male"},
        {"role": "parent", "full_name": "Sunita Rai", "full_name_nepali": "सुनिता राई", "phone": "+9779841111007", "gender": "female"},
        {"role": "student", "full_name": "Aastha Sharma", "full_name_nepali": "आस्था शर्मा", "phone": "+9779841111008", "gender": "female"},
        {"role": "student", "full_name": "Bikash Gurung", "full_name_nepali": "बिकास गुरुङ", "phone": "+9779841111009", "gender": "male"},
        {"role": "student", "full_name": "Priya Thapa", "full_name_nepali": "प्रिया थापा", "phone": "+9779841111010", "gender": "female"},
        {"role": "staff", "full_name": "Kumar Poudel", "full_name_nepali": "कुमार पौडेल", "phone": "+9779841111011", "gender": "male"},
    ]

    created = 0
    for u_data in demo_users:
        existing = User.query.filter_by(phone=u_data["phone"]).first()
        if existing:
            continue
        user = User(
            school_id=school.id,
            role=u_data["role"],
            full_name=u_data["full_name"],
            full_name_nepali=u_data.get("full_name_nepali"),
            phone=u_data["phone"],
            email=u_data.get("email"),
            gender=u_data.get("gender"),
            is_active=True,
            phone_verified=True,
            preferred_language="ne",
        )
        if u_data.get("email"):
            user.set_password("Demo@1234")
        db.session.add(user)
        created += 1

    db.session.commit()
    print(f"✅ Created {created} demo users")


if __name__ == "__main__":
    app = create_app("development")
    with app.app_context():
        count = seed_all_plugins()
        school = seed_demo_school_full()
        seed_demo_users(school)
        print(f"\n🎉 Full seeding complete! {count} plugins in marketplace.")
