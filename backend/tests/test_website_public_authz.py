"""S-12: website publish/serve authz.

- Draft (unpublished) pages 404 on the public renderer.
- The public gallery only exposes files marked is_public='public'.
- /uploads enforces ManagedFile visibility (school_only needs the school's
  token; unknown files need the school-scope path).
"""
import uuid as _uuid

import pytest

from app.models.file import ManagedFile
from app.models.website import WebsitePage
from app.models.school import SchoolWebsite
from app.models.plugin import Plugin, SchoolPlugin
from tests.conftest import get_auth_headers


@pytest.fixture
def website_school(client, db, school, admin_user):
    p = Plugin.query.filter_by(slug="basic_website").first()
    if not p:
        p = Plugin(
            slug="basic_website", name="Basic Website", category="core",
            is_free=True, is_published=True, version="1.0.0", emoji="🌐",
        )
        db.session.add(p)
    db.session.add(
        SchoolPlugin(school_id=school.id, plugin_slug="basic_website", active=True, is_trial=False)
    )
    db.session.add(SchoolWebsite(school_id=school.id, is_published=True))
    db.session.commit()
    return school


def _page(db, school, slug, is_published):
    page = WebsitePage(
        school_id=school.id,
        slug=slug,
        title=slug.title(),
        is_published=is_published,
        sections=[],
    )
    db.session.add(page)
    db.session.commit()
    return page


class TestDraftPagesPrivate:
    def test_draft_page_404_publicly(self, client, db, website_school):
        page = _page(db, website_school, "draft-page", is_published=False)
        r = client.get(
            f"/api/v1/website/public/{website_school.slug}/pages/draft-page"
        )
        assert r.status_code == 404

    def test_published_page_served(self, client, db, website_school):
        _page(db, website_school, "live-page", is_published=True)
        r = client.get(
            f"/api/v1/website/public/{website_school.slug}/pages/live-page"
        )
        assert r.status_code == 200

    def test_unpublished_home_not_used_for_homepage(self, client, db, website_school):
        _page(db, website_school, "home", is_published=False)
        r = client.get(f"/api/v1/website/public/{website_school.slug}")
        assert r.status_code == 200
        assert r.get_json()["data"]["sections"] == []


class TestGalleryVisibility:
    def test_gallery_excludes_school_only_images(self, client, db, website_school):
        public_img = ManagedFile(
            school_id=website_school.id,
            key=f"{website_school.id}/gallery/pub-{_uuid.uuid4().hex}.jpg",
            url="/uploads/x.jpg",
            original_name="pub.jpg",
            mime_type="image/jpeg",
            file_type="image",
            is_public="public",
        )
        private_img = ManagedFile(
            school_id=website_school.id,
            key=f"{website_school.id}/docs/scan-{_uuid.uuid4().hex}.pdf",
            url="/uploads/y.pdf",
            original_name="scan.jpg",
            mime_type="image/jpeg",
            file_type="image",
            is_public="school_only",
        )
        db.session.add_all([public_img, private_img])
        db.session.commit()

        r = client.get(f"/api/v1/website/public/{website_school.slug}")
        urls = [g["url"] for g in r.get_json()["data"]["gallery"]]
        assert urls == [public_img.url]
