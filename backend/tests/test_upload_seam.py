"""Upload-seam tests — the path-traversal regression suite (audit 6.1-1).

The `folder` form field used to flow unsanitized into both the local-disk
path and the R2 object key: a folder of `../../etc` wrote outside the upload
root (live-confirmed during the audit). These tests pin the guard at both
levels:

1. unit level — `safe_storage_key()` rejects traversal/absolute/backslash
   segments and accepts well-formed keys;
2. API level — `POST /files/upload` returns 400 (not 500, not a written
   file) for malicious folder values and 201 for a normal upload.
"""
import io

import pytest

from app.models.plugin import SchoolPlugin
from app.utils.file_upload import safe_storage_key

from tests.conftest import get_auth_headers


@pytest.fixture
def files_plugin(db, school):
    """The upload route is plugin-gated (file_management) — install it."""
    sp = SchoolPlugin(
        school_id=school.id,
        plugin_slug="file_management",
        active=True,
        is_trial=False,
    )
    db.session.add(sp)
    db.session.commit()
    return sp


class TestSafeStorageKey:
    def test_rejects_parent_traversal(self):
        for bad in ("../../etc", "a/../../b", "..", "a/../.."):
            try:
                safe_storage_key("school-1", bad)
            except ValueError:
                continue
            raise AssertionError(f"accepted traversal: {bad!r}")

    def test_rejects_absolute_paths(self):
        for bad in ("/etc/passwd", "/uploads", "//x"):
            try:
                safe_storage_key("school-1", bad)
            except ValueError:
                continue
            raise AssertionError(f"accepted absolute: {bad!r}")

    def test_rejects_backslash_tricks(self):
        try:
            safe_storage_key("school-1", "a\\..\\b")
        except ValueError:
            pass
        else:
            raise AssertionError("accepted backslash traversal")

    def test_rejects_colon_segments(self):
        # Windows drive/scheme confusion + R2 key oddities
        try:
            safe_storage_key("school-1:etc", "general")
        except ValueError:
            pass
        else:
            raise AssertionError("accepted colon in school segment")

    def test_accepts_well_formed(self):
        assert safe_storage_key("school-1", "general") == "school-1/general"
        assert safe_storage_key("school-1", "general", "abc.pdf") == "school-1/general/abc.pdf"
        # trailing/inner empty segments collapse; a leading '/' is an
        # absolute path and IS rejected by design
        assert safe_storage_key("school-1/", "general/") == "school-1/general"
        with pytest.raises(ValueError):
            safe_storage_key("school-1", "/general/")

    def test_rejects_all_empty(self):
        try:
            safe_storage_key()
        except ValueError:
            pass
        else:
            raise AssertionError("accepted empty input")


class TestUploadEndpointFolderGuard:
    def _upload(self, client, headers, folder):
        data = {"file": (io.BytesIO(b"test content"), "note.txt", "text/plain"),
                "folder": folder}
        return client.post("/api/v1/files/upload", data=data, headers=headers,
                           content_type="multipart/form-data")

    def test_traversal_folder_rejected_400(self, client, admin_user, files_plugin):
        headers = get_auth_headers(client, admin_user.email, "Test@1234")
        for folder in ("../../etc", "/etc/passwd", "a/../../b", ".."):
            resp = self._upload(client, headers, folder)
            assert resp.status_code == 400, (
                f"folder={folder!r} should 400, got {resp.status_code}"
            )

    def test_normal_upload_succeeds(self, client, admin_user, files_plugin):
        headers = get_auth_headers(client, admin_user.email, "Test@1234")
        resp = self._upload(client, headers, "general")
        assert resp.status_code in (200, 201), resp.get_json()
        body = resp.get_json()["data"]
        assert ".." not in body["url"]

    def test_unauthenticated_upload_rejected(self, client):
        resp = self._upload(client, {}, "general")
        assert resp.status_code in (401, 422)
