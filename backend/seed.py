"""Database seed script — creates superadmin, demo school, and core plugins."""
import uuid

from app import create_app
from extensions import db
from app.models.school import School
from app.models.user import User
from app.models.plugin import Plugin
from app.plugins.billing import install_plugin
from app.plugins.loader import PluginLoader

CORE_PLUGINS = ["attendance", "notices", "academics", "basic_reports", "basic_website"]


def seed():
    """Seed the database with essential data."""
    app = create_app()
    with app.app_context():
        # 1. Register all plugins from manifests into Plugin master table
        manifests = PluginLoader.get_all_manifests()
        for slug, m in manifests.items():
            existing = Plugin.query.filter_by(slug=slug).first()
            if not existing:
                plugin = Plugin(
                    id=str(uuid.uuid4()),
                    slug=slug,
                    name=m["name"],
                    name_nepali=m.get("name_nepali", ""),
                    description=m.get("description", ""),
                    category=m["category"],
                    price_monthly=m.get("pricing", {}).get("monthly", 0),
                    price_yearly=m.get("pricing", {}).get("yearly", 0),
                    is_free=m.get("pricing", {}).get("monthly", 0) == 0,
                    trial_days=m.get("pricing", {}).get("trial_days", 14),
                    version=m.get("version", "1.0.0"),
                    is_published=True,
                )
                db.session.add(plugin)
        db.session.commit()
        print(f"✓ Registered {len(manifests)} plugins")

        # 2. Create demo school
        demo = School.query.filter_by(slug="demo").first()
        if not demo:
            demo = School(
                id=str(uuid.uuid4()),
                name="Demo School Nepal",
                name_nepali="डेमो स्कूल नेपाल",
                slug="demo",
                type="private",
                level="secondary",
                district="Kathmandu",
                address="Kathmandu, Nepal",
                phone="+977-1-4000000",
                email="admin@demo.aschool.com.np",
                is_active=True,
                plan="growth",
            )
            db.session.add(demo)
            db.session.commit()
            print("✓ Created demo school (slug=demo)")

            # Auto-install core plugins for demo school
            for slug in CORE_PLUGINS:
                result = install_plugin(str(demo.id), slug)
                if "error" not in result:
                    print(f"  ✓ Installed {slug}")
            print(f"✓ Installed {len(CORE_PLUGINS)} core plugins for demo school")

        # 3. Create superadmin user
        superadmin = User.query.filter_by(email="superadmin@aschool.com.np").first()
        if not superadmin:
            superadmin = User(
                id=str(uuid.uuid4()),
                email="superadmin@aschool.com.np",
                phone="+977-9800000000",
                full_name="ASchool Superadmin",
                role="superadmin",
                is_active=True,
            )
            superadmin.set_password("changeme123")
            db.session.add(superadmin)
            db.session.commit()
            print("✓ Created superadmin (email=superadmin@aschool.com.np)")

        # 4. Create demo school admin
        admin = User.query.filter_by(email="admin@demo.aschool.com.np").first()
        if not admin:
            admin = User(
                id=str(uuid.uuid4()),
                email="admin@demo.aschool.com.np",
                phone="+977-9800000001",
                full_name="Demo Admin",
                role="school_admin",
                school_id=demo.id,
                is_active=True,
            )
            admin.set_password("changeme123")
            db.session.add(admin)
            db.session.commit()
            print("✓ Created demo school admin")

        print("\n🎉 Seed completed!")


if __name__ == "__main__":
    seed()
