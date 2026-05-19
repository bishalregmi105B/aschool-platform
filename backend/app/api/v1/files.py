"""Centralized File Management API.

Endpoints:
  GET    /files/folders           — List folders (filterable by parent_id)
  POST   /files/folders           — Create a folder
  DELETE /files/folders/<id>      — Delete a folder (and its files)
  POST   /files/upload            — Upload one or more files
  GET    /files/                  — List school files (filterable)
  GET    /files/<id>              — File metadata
  PATCH  /files/<id>              — Update metadata (tags, folder)
  DELETE /files/<id>              — Soft-delete + R2 removal
  GET    /files/<id>/presigned    — Generate presigned URL for private files
  GET    /files/usage             — Storage usage summary
  GET    /files/stock-search      — Search Unsplash / Pexels
  POST   /files/stock-import      — Download & save a stock image
"""
import io
import mimetypes
import os
import uuid
from datetime import UTC, datetime

import requests as _requests

from flask import Blueprint, g, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.file import FileFolder, ManagedFile
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.file_upload import VirusDetectedError, delete_file, generate_presigned_url, upload_file
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, success_response
from extensions import db

files_bp = Blueprint("files", __name__, url_prefix="/files")

# ── MIME → file_type mapping ──────────────────────────────────────────────────

_MIME_TYPE_MAP = {
    "image": "image",
    "video": "video",
    "audio": "audio",
    "application/pdf": "document",
    "application/msword": "document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/vnd.ms-excel": "spreadsheet",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
    "text/csv": "spreadsheet",
    "text/plain": "document",
}


def _detect_file_type(mime: str) -> str:
    if not mime:
        return "other"
    for prefix, ftype in _MIME_TYPE_MAP.items():
        if mime.startswith(prefix) or mime == prefix:
            return ftype
    return "other"


# ── Folders ──────────────────────────────────────────────────────────────────

@files_bp.route("/folders", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("file_management")
def list_folders():
    """List folders for the school, optionally filtered by parent_id."""
    parent_id = request.args.get("parent_id") or None
    q = FileFolder.query.filter_by(school_id=g.school_id, is_deleted=False)
    if parent_id:
        q = q.filter(FileFolder.parent_id == parent_id)
    else:
        q = q.filter(FileFolder.parent_id.is_(None))
    folders = q.order_by(FileFolder.name).all()
    return success_response([f.to_dict() for f in folders])


@files_bp.route("/folders", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("file_management")
def create_folder():
    """Create a new folder."""
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return error_response("Folder name is required", 400)
    parent_id = data.get("parent_id") or None

    folder = FileFolder(
        school_id=g.school_id,
        name=name,
        parent_id=parent_id,
    )
    db.session.add(folder)
    db.session.commit()
    return created_response(folder.to_dict())


@files_bp.route("/folders/<uuid:folder_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("file_management")
@role_required("school_admin", "teacher")
def delete_folder(folder_id):
    """Soft-delete a folder. Files inside are unlinked (folder_id set to NULL)."""
    folder = FileFolder.query.filter_by(id=folder_id, school_id=g.school_id, is_deleted=False).first()
    if not folder:
        return error_response("Folder not found", 404)
    # Unlink files from this folder
    ManagedFile.query.filter_by(folder_id=folder_id, is_deleted=False).update({"folder_id": None})
    folder.is_deleted = True
    db.session.commit()
    return success_response({"deleted": True, "id": str(folder_id)})


# ── Upload ────────────────────────────────────────────────────────────────────

@files_bp.route("/upload", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("file_management")
def upload():
    """Upload one or more files to the school's storage."""
    if "file" not in request.files and "files" not in request.files:
        return error_response("No file(s) attached", 400)

    folder = request.form.get("folder", "general")
    folder_id = request.form.get("folder_id") or None
    linked_module = request.form.get("linked_module")
    linked_entity_id = request.form.get("linked_entity_id")
    is_public = request.form.get("is_public", "school_only")

    # Accept single 'file' or multiple 'files'
    file_list = request.files.getlist("files") or [request.files.get("file")]
    file_list = [f for f in file_list if f and f.filename]

    if not file_list:
        return error_response("No valid file(s) provided", 400)

    MAX_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024
    created = []
    user_id = get_jwt_identity()

    for f in file_list:
        # Size guard — read into buffer, check size
        data = f.read()
        if len(data) > MAX_SIZE:
            return error_response(f"File '{f.filename}' exceeds {MAX_SIZE // (1024*1024)} MB limit", 413)

        ext = os.path.splitext(f.filename)[1].lstrip(".").lower() if f.filename else ""
        r2_key = f"{g.school_id}/{folder}/{uuid.uuid4().hex}.{ext}" if ext else f"{g.school_id}/{folder}/{uuid.uuid4().hex}"
        mime = f.content_type or "application/octet-stream"

        # Rewind and upload (raises VirusDetectedError if threat found)
        file_obj = io.BytesIO(data)
        file_obj.filename = f.filename
        file_obj.content_type = mime
        try:
            public_url = upload_file(file_obj, folder=f"{g.school_id}/{folder}", filename=os.path.basename(r2_key))
        except VirusDetectedError as exc:
            return error_response(f"File '{f.filename}' rejected: {exc}", 422)

        record = ManagedFile(
            school_id=g.school_id,
            uploaded_by=user_id,
            key=r2_key,
            url=public_url,
            original_name=f.filename,
            mime_type=mime,
            size_bytes=len(data),
            extension=ext,
            folder=folder,
            folder_id=folder_id,
            file_type=_detect_file_type(mime),
            linked_module=linked_module,
            linked_entity_id=linked_entity_id if linked_entity_id else None,
            is_public=is_public,
        )
        db.session.add(record)
        created.append(record)

    db.session.commit()

    from app.plugins.events import emit
    for rec in created:
        emit("file.uploaded", school_id=str(g.school_id), file_id=str(rec.id), folder=folder)

    if len(created) == 1:
        return created_response(created[0].to_dict())
    return created_response([r.to_dict() for r in created])


# ── List ──────────────────────────────────────────────────────────────────────

@files_bp.route("/", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("file_management")
def list_files():
    """List files for the school with optional filters."""
    q = ManagedFile.query.filter_by(school_id=g.school_id, is_deleted=False)

    folder_id = request.args.get("folder_id")
    if folder_id == "root":
        q = q.filter(ManagedFile.folder_id.is_(None))
    elif folder_id:
        q = q.filter(ManagedFile.folder_id == folder_id)

    folder = request.args.get("folder")
    if folder:
        q = q.filter(ManagedFile.folder == folder)

    file_type = request.args.get("type")
    if file_type:
        q = q.filter(ManagedFile.file_type == file_type)

    year = request.args.get("year")
    if year:
        try:
            start = datetime(int(year), 1, 1)
            end = datetime(int(year) + 1, 1, 1)
            q = q.filter(ManagedFile.created_at >= start, ManagedFile.created_at < end)
        except (TypeError, ValueError):
            return error_response("Invalid year filter", 400)

    module = request.args.get("module")
    if module:
        q = q.filter(ManagedFile.linked_module == module)

    search = request.args.get("search")
    if search:
        q = q.filter(ManagedFile.original_name.ilike(f"%{search}%"))

    items, meta = paginate(q.order_by(ManagedFile.created_at.desc()))
    return success_response([f.to_dict() for f in items], meta={"pagination": meta})


# ── Single file ───────────────────────────────────────────────────────────────

@files_bp.route("/<uuid:file_id>", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("file_management")
def get_file(file_id):
    f = ManagedFile.query.filter_by(id=file_id, school_id=g.school_id, is_deleted=False).first()
    if not f:
        return error_response("File not found", 404)
    return success_response(f.to_dict())


# ── Update metadata ───────────────────────────────────────────────────────────

@files_bp.route("/<uuid:file_id>", methods=["PATCH"])
@jwt_required()
@school_required
@plugin_required("file_management")
def update_file(file_id):
    f = ManagedFile.query.filter_by(id=file_id, school_id=g.school_id, is_deleted=False).first()
    if not f:
        return error_response("File not found", 404)

    data = request.get_json(silent=True) or {}
    for field in ("folder", "tags", "linked_module", "linked_entity_id", "is_public", "original_name"):
        if field in data:
            setattr(f, field, data[field])
    db.session.commit()
    return success_response(f.to_dict())


# ── Delete ────────────────────────────────────────────────────────────────────

@files_bp.route("/<uuid:file_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("file_management")
@role_required("school_admin", "teacher", "accountant")
def delete_file_record(file_id):
    f = ManagedFile.query.filter_by(id=file_id, school_id=g.school_id, is_deleted=False).first()
    if not f:
        return error_response("File not found", 404)

    # Physical deletion from R2
    try:
        delete_file(f.key)
    except Exception:
        pass  # Log but don't block the soft-delete

    f.is_deleted = True
    db.session.commit()

    from app.plugins.events import emit
    emit("file.deleted", school_id=str(g.school_id), file_id=str(f.id))

    return success_response({"deleted": True, "id": str(f.id)})


# ── Presigned URL for private files ──────────────────────────────────────────

@files_bp.route("/<uuid:file_id>/presigned", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("file_management")
def get_presigned(file_id):
    f = ManagedFile.query.filter_by(id=file_id, school_id=g.school_id, is_deleted=False).first()
    if not f:
        return error_response("File not found", 404)

    expires = int(request.args.get("expires", 3600))
    url = generate_presigned_url(f.key, expires_in=expires)
    return success_response({"presigned_url": url, "expires_in": expires})


# ── Storage usage ─────────────────────────────────────────────────────────────

@files_bp.route("/usage", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("file_management")
def storage_usage():
    """Return storage usage summary broken down by file type."""
    from sqlalchemy import func
    from extensions import db as _db

    rows = (
        _db.session.query(
            ManagedFile.file_type,
            func.count(ManagedFile.id).label("count"),
            func.coalesce(func.sum(ManagedFile.size_bytes), 0).label("total_bytes"),
        )
        .filter_by(school_id=g.school_id, is_deleted=False)
        .group_by(ManagedFile.file_type)
        .all()
    )

    total_bytes = sum(r.total_bytes for r in rows)
    breakdown = [
        {"file_type": r.file_type, "count": r.count, "total_bytes": r.total_bytes}
        for r in rows
    ]
    return success_response({
        "total_files": sum(r.count for r in rows),
        "total_bytes": total_bytes,
        "total_mb": round(total_bytes / (1024 * 1024), 2),
        "breakdown": breakdown,
    })


# ── Stock Image Search ────────────────────────────────────────────────────────

def _search_unsplash(q: str, page: int, per_page: int):
    key = os.getenv("UNSPLASH_ACCESS_KEY", "")
    if not key:
        return success_response({"results": [], "total": 0, "has_more": False,
                                 "error": "UNSPLASH_ACCESS_KEY not configured"})
    try:
        resp = _requests.get(
            "https://api.unsplash.com/search/photos",
            params={"query": q, "page": page, "per_page": per_page,
                    "client_id": key, "orientation": "landscape"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        results = []
        for photo in data.get("results", []):
            results.append({
                "id": photo["id"],
                "thumb_url": photo["urls"]["small"],
                "preview_url": photo["urls"]["regular"],
                "full_url": photo["urls"]["full"],
                "author": photo["user"]["name"],
                "author_url": photo["user"]["links"]["html"] + "?utm_source=aschool&utm_medium=referral",
                "source": "unsplash",
                "source_url": photo["links"]["html"] + "?utm_source=aschool&utm_medium=referral",
                "download_trigger_url": photo["links"]["download_location"],
                "width": photo.get("width"),
                "height": photo.get("height"),
            })
        total = data.get("total", 0)
        return success_response({"results": results, "total": total,
                                 "has_more": page * per_page < total})
    except Exception as e:
        from flask import current_app
        current_app.logger.warning("Unsplash search failed: %s", e)
        return error_response("Stock search failed", 502)


def _search_pexels(q: str, page: int, per_page: int):
    key = os.getenv("PEXELS_API_KEY", "")
    if not key:
        return success_response({"results": [], "total": 0, "has_more": False,
                                 "error": "PEXELS_API_KEY not configured"})
    try:
        resp = _requests.get(
            "https://api.pexels.com/v1/search",
            params={"query": q, "page": page, "per_page": per_page, "orientation": "landscape"},
            headers={"Authorization": key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        results = []
        for photo in data.get("photos", []):
            results.append({
                "id": str(photo["id"]),
                "thumb_url": photo["src"]["medium"],
                "preview_url": photo["src"]["large"],
                "full_url": photo["src"]["original"],
                "author": photo.get("photographer", ""),
                "author_url": photo.get("photographer_url", ""),
                "source": "pexels",
                "source_url": photo.get("url", ""),
                "download_trigger_url": None,
                "width": photo.get("width"),
                "height": photo.get("height"),
            })
        total = data.get("total_results", 0)
        return success_response({"results": results, "total": total,
                                 "has_more": data.get("next_page") is not None})
    except Exception as e:
        from flask import current_app
        current_app.logger.warning("Pexels search failed: %s", e)
        return error_response("Stock search failed", 502)


@files_bp.route("/stock-search", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("file_management")
def stock_search():
    """Proxy search to Unsplash or Pexels.
    ?q=query&source=unsplash|pexels&page=1&per_page=20
    """
    q = (request.args.get("q") or "").strip()
    source = request.args.get("source", "unsplash")
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(max(1, int(request.args.get("per_page", 20))), 30)

    if not q:
        return success_response({"results": [], "total": 0, "has_more": False})

    if source == "pexels":
        return _search_pexels(q, page, per_page)
    return _search_unsplash(q, page, per_page)


@files_bp.route("/stock-import", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("file_management")
def stock_import():
    """Download a stock image URL and save it to the school's file library."""
    from werkzeug.utils import secure_filename
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    url = (data.get("url") or "").strip()
    filename = secure_filename(data.get("filename") or "stock-image.jpg") or "stock-image.jpg"
    folder_id = data.get("folder_id") or None
    source = data.get("source", "")
    trigger_url = data.get("download_trigger_url") or None

    if not url:
        return error_response("url is required", 400)

    # Fire Unsplash download trigger (required by Unsplash API terms)
    if source == "unsplash" and trigger_url:
        try:
            key = os.getenv("UNSPLASH_ACCESS_KEY", "")
            if key:
                _requests.get(f"{trigger_url}?client_id={key}", timeout=5)
        except Exception:
            pass

    # Download the image
    try:
        resp = _requests.get(url, timeout=30)
        resp.raise_for_status()
        file_bytes = resp.content
    except Exception as e:
        return error_response(f"Failed to download image: {e}", 502)

    MAX_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024
    if len(file_bytes) > MAX_SIZE:
        return error_response("Image too large", 413)

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    mime = mimetypes.guess_type(filename)[0] or "image/jpeg"

    folder = "stock"
    unique_name = f"{uuid.uuid4().hex}_{filename}"
    r2_key = f"{g.school_id}/{folder}/{unique_name}"

    file_obj = io.BytesIO(file_bytes)
    file_obj.filename = filename
    file_obj.content_type = mime
    public_url = upload_file(file_obj, folder=f"{g.school_id}/{folder}", filename=unique_name)

    record = ManagedFile(
        school_id=g.school_id,
        uploaded_by=user_id,
        key=r2_key,
        url=public_url,
        original_name=filename,
        mime_type=mime,
        size_bytes=len(file_bytes),
        extension=ext,
        folder=folder,
        folder_id=folder_id,
        file_type="image",
        is_public="school_only",
    )
    db.session.add(record)
    db.session.commit()
    return created_response(record.to_dict())
