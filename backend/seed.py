"""Database seed script — creates superadmin, demo school, and demo installs.

WP-style plugin model (2026-08-30): the plugins DIRECTORY is the catalog
source of truth. This script NEVER seeds plugin catalog rows — the DB
`plugins` table is only a mirror of the scanned manifests, kept in sync by
PluginLoader.refresh_registry() (also runs on every app startup). The demo
school's SchoolPlugin installs are created through install_plugin() against
those registry-backed rows; only install STATE lives in the DB.
"""
import uuid

from app import create_app
from extensions import db
from app.models.school import School
from app.models.user import User
from app.plugins.billing import install_plugin
from app.plugins.loader import PluginLoader

CORE_PLUGINS = ["attendance", "notices", "academics", "basic_reports", "basic_website"]


def seed():
    """Seed the database with essential data (no plugin catalog seeding)."""
    app = create_app()
    with app.app_context():
        # 1. Sync the catalog MIRROR from the plugins directory (the registry
        # scan — NOT seeding; identical to what runs at app startup). This
        # guarantees the mirror rows exist before the demo installs below on
        # a fresh database, and self-heals a stale DB idempotently.
        result = PluginLoader.refresh_registry()
        print(
            f"✓ Registry synced from plugins directory: "
            f"{result['scanned']} scanned, {result['created']} created, "
            f"{result['updated']} updated, {result['deactivated']} deactivated"
        )

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

        # 3. Demo install STATE only — every slug resolves against the
        # registry-backed mirror rows via install_plugin (never a catalog
        # insert). Runs even when the school already existed so a re-seed
        # tops up any missing core install.
        installed = 0
        for slug in CORE_PLUGINS:
            result = install_plugin(str(demo.id), slug)
            if "error" not in result:
                installed += 1
        print(f"✓ Demo school install state: {installed} core plugins ensured")

        # 4. Create superadmin user
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

        # 5. Create demo school admin
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
