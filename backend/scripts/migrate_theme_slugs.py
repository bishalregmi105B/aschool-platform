"""Idempotent data migration: move SchoolWebsite.theme_slug off removed themes.

The original 20 invented themes were replaced by 10 themes ported from real,
openly-licensed school website designs (see frontend/themes/THEMES_CREDITS.md).
Any SchoolWebsite row still pointing at a removed theme id is remapped to the
closest new design. Safe to run any number of times: rows already on a valid
theme (old or new) are left untouched.

Run inside the backend container/venv:
    python scripts/migrate_theme_slugs.py          # apply + report
    python scripts/migrate_theme_slugs.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from extensions import db

# Old theme id -> closest new theme (palette/typography affinity).
OLD_TO_NEW = {
    "government": "collegiate-heritage",          # formal maroon/navy serif
    "private-classic": "collegiate-heritage",     # navy + gold serif
    "modern-minimal": "global-elearning",         # clean white + single blue accent
    "montessori": "blossom-montessori",           # pastels, rounded, playful
    "nepal-heritage": "educenter-bright",         # red + deep blue
    "tech-school": "institute-industrial",        # industrial skill-focused
    "international": "global-elearning",          # clean white & blue global
    "boarding": "boarding-crimson",               # residential heritage
    "community": "community-skyline",             # simple, accessible, high contrast
    "college": "university-azure",                # young college energy
    "primary-colorful": "kids-campus-playful",    # rainbow/fun for young students
    "secondary-professional": "educenter-bright", # professional grade 8-12
    "sports-school": "boarding-crimson",          # red + dark navy
    "arts-school": "blossom-montessori",          # colorful, expressive
    "religious": "collegiate-heritage",           # calm formal serif
    "girls-school": "blossom-montessori",         # rose/pastel elegance
    "science-school": "institute-industrial",     # STEM/lab feel
    "language-school": "global-elearning",        # clean blue multi-audience
    "dark-premium": "collegiate-heritage",        # premium dark navy
    "festival-auto": "educenter-bright",          # red/blue base theme
}


def migrate(dry_run: bool = False) -> int:
    from app.models.school import SchoolWebsite
    from app.services.website.theme_engine import ThemeEngineService

    valid = set(ThemeEngineService.THEMES.keys())
    rows = SchoolWebsite.query.filter(SchoolWebsite.is_deleted == False).all()  # noqa: E712

    changed = 0
    unknown: list[str] = []
    for row in rows:
        slug = (row.theme_slug or "").strip()
        if slug in valid:
            continue
        if slug in OLD_TO_NEW:
            target = OLD_TO_NEW[slug]
        else:
            # Null or unrecognized id (e.g. the legacy "default") — normalize
            # onto the platform default theme.
            target = ThemeEngineService.DEFAULT_THEME_ID
        unknown.append(f"{row.id}: {slug!r} -> {target}")
        if not dry_run:
            row.theme_slug = target

    if not dry_run:
        db.session.commit()

    print(f"SchoolWebsite rows scanned: {len(rows)}")
    if not unknown:
        print("No rows needed migration (idempotent no-op).")
        return 0
    for line in unknown:
        print(f"  {line}")
    print(f"{'Would migrate' if dry_run else 'Migrated'} {len(unknown)} row(s).")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Report without writing")
    args = parser.parse_args()
    app = create_app()
    with app.app_context():
        sys.exit(migrate(dry_run=args.dry_run))
