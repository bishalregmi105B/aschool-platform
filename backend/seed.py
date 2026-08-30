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
        # 1. Register all plugins from manifests into Plugin master table.
        # Manifests are the pricing/tier source of truth and use FLAT keys
        # (price_monthly / price_yearly / category / is_free) — NOT nested
        # `pricing.monthly`; the old dead path silently seeded every paid
        # plugin as price-0/free (audit E6). Existing rows are synced
        # idempotently so a stale DB self-heals on the next seed.
        manifests = PluginLoader.get_all_manifests()
        created = synced = 0
        for slug, m in manifests.items():
            price_monthly = int(m.get("price_monthly") or 0)
            price_yearly = int(m.get("price_yearly") or 0)
            is_free = bool(m.get("is_free", price_monthly == 0))
            category = m.get("category", "core")
            # Manifests may delist a plugin from the catalog (e.g. the
            # deprecated digital_content duplicate of elibrary): a top-level
            # `published: false` maps to Plugin.is_published=False so the
            # marketplace stops offering it while legacy installs keep working.
            is_published = bool(m.get("published", True))
            existing = Plugin.query.filter_by(slug=slug).first()
            if not existing:
                plugin = Plugin(
                    id=str(uuid.uuid4()),
                    slug=slug,
                    name=m["name"],
                    name_nepali=m.get("name_nepali", ""),
                    description=m.get("description", ""),
                    category=category,
                    price_monthly=price_monthly,
                    price_yearly=price_yearly,
                    is_free=is_free,
                    trial_days=14,  # manifests carry no trial_days; default 14
                    version=m.get("version", "1.0.0"),
                    is_published=is_published,
                )
                db.session.add(plugin)
                created += 1
                continue
            # Idempotent sync of price/tier/category/published from the manifest.
            changed = False
            if float(existing.price_monthly or 0) != price_monthly:
                existing.price_monthly = price_monthly
                changed = True
            if float(existing.price_yearly or 0) != price_yearly:
                existing.price_yearly = price_yearly
                changed = True
            if bool(existing.is_free) != is_free:
                existing.is_free = is_free
                changed = True
            if existing.category != category:
                existing.category = category
                changed = True
            if bool(existing.is_published) != is_published:
                existing.is_published = is_published
                changed = True
            if changed:
                synced += 1
        db.session.commit()
        print(
            f"✓ Registered {len(manifests)} plugins "
            f"({created} created, {synced} synced from manifests)"
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
