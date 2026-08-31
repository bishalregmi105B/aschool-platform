"""
Full seed script — demo school with users across all roles.

Usage:
    python seed_full.py

WP-style plugin model (2026-08-30): this script seeds NO plugin catalog.
The plugins directory is the catalog source of truth; PluginLoader.
refresh_registry() (also run at app startup) mirrors it into the `plugins`
table. Demo-school plugin installs are STATE only, resolved through
install_plugin() against registry-backed mirror rows.
"""
from app import create_app
from app.models.plugin import SchoolPlugin
from app.models.school import School
from app.models.user import User
from app.plugins.billing import install_plugin
from app.plugins.loader import PluginLoader
from extensions import db

# Demo school gets the free (core) + starter tiers of the REGISTRY — slugs
# come from the scanned manifests, never a hardcoded catalog list.
DEMO_INSTALL_TIERS = ("core", "starter")


def seed_demo_school_full():
    """Create demo school with free + starter registry plugins installed."""
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

    # Registry ids only — the catalog mirror was synced at app startup (and
    # is re-synced here defensively); installs are pure SchoolPlugin state.
    PluginLoader.refresh_registry()
    target_slugs = [
        slug
        for slug, m in PluginLoader.get_all_manifests().items()
        if (m.get("category") or "core") in DEMO_INSTALL_TIERS
        and bool(m.get("published", True))
    ]
    installed = 0
    for slug in target_slugs:
        sp = SchoolPlugin.query.filter_by(school_id=school.id, plugin_slug=slug).first()
        if not sp:
            result = install_plugin(str(school.id), slug)
            if "error" not in result:
                installed += 1

    print(f"✅ Installed {installed} plugins for demo school (registry tiers: core+starter)")
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
        school = seed_demo_school_full()
        seed_demo_users(school)
        print("\n🎉 Full seeding complete! (catalog = plugins directory, zero plugin seeding)")
