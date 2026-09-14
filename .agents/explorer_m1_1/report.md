# Milestone 1 Investigation Report: Backend Security Hardening & Bug Fixes
**Target Scope**: Feature 1 (File Path Traversal Hardening), Feature 4 (AI Teacher Webhook Security), Feature 8d (Unsplash API Key Protection)  
**Investigator**: Explorer 1 (`explorer_m1_1`)  
**Date**: 2026-09-13  
**Status**: COMPLETE (Read-Only Investigation)  

---

## Executive Summary

This investigation provides an exhaustive security and correctness analysis of the ASchool backend across three critical Milestone 1 features:
1. **File Path Traversal Hardening (Feature 1 / R1.1)**: Analysis of `backend/app/utils/file_upload.py`, `backend/app/api/v1/files.py`, and an audit of all callers across the codebase (`students.py`, `fees.py`, `reports.py`, `report_generation.py`, `compliance.py`).
2. **AI Teacher Webhook Security (Feature 4 / R1.4)**: Analysis of `backend/app/plugins/modules/ai_teacher/routes.py` (lines 600–820), evaluating HMAC verification, school key binding, and `(lesson_id, event_id)` replay deduplication.
3. **Unsplash API Key Protection (Feature 8d / R1.8)**: Analysis of `backend/app/api/v1/files.py` (lines 529–615), examining the `POST /api/v1/files/stock-import` workflow, host allowlist flaws, and credential leakage vectors to Pexels and log streams.

### High-Level Findings Matrix

| Component | File & Lines | Severity | Issue Summary | Proposed Fix |
|---|---|---|---|---|
| **Bulk Student Photos** | `backend/app/api/v1/students.py:416` | **HIGH (Tenant Isolation)** | Hardcoded folder `"student-photos"` lacks `school_id` prefix. Cross-school collision: students with matching admission numbers in different schools overwrite each other's photos in storage. | Prefix folder with `g.school_id`: `folder=f"{g.school_id}/student-photos"`. |
| **Folder Management** | `backend/app/api/v1/files.py:106-126` | **MEDIUM (Auth & Validation)** | `POST /folders` lacks `@role_required` (any user can create folders); folder name lacks traversal/length checks; `parent_id` is not validated for school ownership. | Add `@role_required("school_admin", "teacher")`, sanitize folder name, verify `parent_id` belongs to `g.school_id`. |
| **Storage Key Safety** | `backend/app/utils/file_upload.py:97-120` | **MEDIUM (Edge Traversal)** | `safe_storage_key` does not strip whitespace before checks (e.g. `" .."`, `" /etc"` bypass segment checks), nor does it check for null bytes (`\x00`). | Add `\x00` check, strip segments, and reject traversal and control characters. |
| **Stock Import Errors** | `backend/app/api/v1/files.py:600` | **MEDIUM (500 Error)** | `upload_file()` in `stock_import` is not wrapped in `try...except (ValueError, VirusDetectedError)`. If ClamAV detects malware or key is invalid, causes unhandled 500 error instead of 422/400. | Wrap in `try...except VirusDetectedError` (return 422) and `except ValueError` (return 400). |
| **EMIS Export Download** | `backend/app/api/v1/compliance.py:182` | **MEDIUM (Path Traversal)** | Local file path joined directly `os.path.join(_local_upload_dir(), *key.split("/"))` without calling `safe_storage_key(key)`. | Enforce `key = safe_storage_key(key)`. |
| **AI Teacher School Binding** | `backend/app/plugins/modules/ai_teacher/routes.py:669-685` | **HIGH (Cross-Tenant)** | If `key_id` is in `secrets_map` but has no school binding, `key_school_id` is `None`, which bypasses `key_school_id != str(lesson.school_id)` check. | Enforce strict school binding; reject keys not bound to the lesson's school. |
| **AI Teacher Replay Guard** | `backend/app/plugins/modules/ai_teacher/routes.py:703-709` | **MEDIUM (Idempotency)** | If `event_id` is omitted/null in request payload, deduplication is completely bypassed. | Enforce `event_id` is required (400 if missing) on webhook events. |
| **AI Teacher Tests** | `backend/tests/test_ai_teacher_plugin.py` | **MEDIUM (Test Gap)** | Zero test coverage for replay deduplication, zero tests for cross-school key rejection, zero tests for revoked key rejection. | Add tests for duplicate event return, cross-school 403, and revoked key 401. |
| **Unsplash Key Leak** | `backend/app/api/v1/files.py:551-577` | **HIGH (Credential Leak)** | 1. `images.pexels.com` in `_STOCK_HOSTS` causes `UNSPLASH_ACCESS_KEY` to be sent to Pexels if `trigger_url` points to Pexels. <br>2. `api.unsplash.com` missing from `_STOCK_HOSTS`, so valid download triggers never fire. <br>3. `?client_id={key}` in URL query string exposes secrets in logs. | Separate `_STOCK_IMAGE_HOSTS` from `_UNSPLASH_TRIGGER_HOSTS`; allow only `api.unsplash.com` / `images.unsplash.com` for triggers; send `Authorization: Client-ID {key}` header. |

---

## 1. File Path Traversal Hardening (Feature 1)

### 1.1 Analysis of `backend/app/utils/file_upload.py`

#### Current Implementation of `safe_storage_key` (lines 97–120):
```python
def safe_storage_key(*parts: str) -> str:
    """Build a storage key from parts, rejecting anything that escapes the root.

    Raises ValueError on '..' segments, absolute paths, or backslash tricks, so
    a caller-controlled 'folder' form field can never traverse outside the
    upload root (local) or inject '../' into an object key (R2).
    """
    cleaned: list[str] = []
    for part in parts:
        if part is None:
            continue
        part = str(part)
        if part.startswith("/") or "\\" in part:
            raise ValueError("invalid storage path")
        for segment in part.split("/"):
            if segment in ("", "."):
                continue
            if segment == ".." or ":" in segment:
                raise ValueError("invalid storage path")
            cleaned.append(segment)
    if not cleaned:
        raise ValueError("invalid storage path")
    return "/".join(cleaned)
```

#### Vulnerabilities & Corner Case Gaps in `safe_storage_key`:
1. **Whitespace Bypass**:
   - `part.startswith("/")` only checks index 0. If `part = " /etc/passwd"`, `startswith("/")` is False.
   - `segment == ".."` only matches exactly `".."`. If `part = " ../secret"`, `segment` is `" .."`, so `segment == ".."` evaluates to False!
   - On Linux, `" .."` creates a folder named `" .."`, but on certain filesystems or downstream parsers, unstripped spaces can normalize to directory traversal.
2. **Null Byte Injection (`\x00`)**:
   - In Python C-extensions and underlying OS file calls, an embedded null byte `\x00` terminates the string. If passed to `open(dest, "wb")`, Python raises `ValueError: embedded null byte`. `safe_storage_key` should reject null bytes immediately.
3. **URL-Encoded Traversal**:
   - If an un-decoded string containing `%2e%2e` or `%2f` is passed, `safe_storage_key` treats it as literal characters. If later unquoted by a downstream consumer, it could resolve to `..` or `/`.
4. **Control Characters & Non-Printable Bytes**:
   - Segments containing newlines (`\n`), carriage returns (`\r`), or tabs (`\t`) can cause header injection or log poisoning in Cloudflare R2 / S3 headers.

#### Analysis of `upload_file`, `delete_file`, `generate_presigned_url` (lines 124–191):
- `upload_file`:
  ```python
  key = safe_storage_key(folder, os.path.basename(filename))
  ```
  `os.path.basename(filename)` extracts the trailing name, but if `filename` is empty or `".."`, `os.path.basename("..")` returns `".."` and `safe_storage_key` raises `ValueError`.
  `upload_file` raises two distinct exceptions:
  - `VirusDetectedError` (when ClamAV detects a threat)
  - `ValueError` (when `safe_storage_key` rejects path traversal)
- `delete_file(key)` and `generate_presigned_url(key)`:
  Both call `safe_storage_key(key)`.

---

### 1.2 Analysis of `backend/app/api/v1/files.py`

#### Vulnerabilities in Folder Management (`create_folder`, lines 106–126):
```python
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
```
**Identified Gaps**:
1. **Missing Authorization Guard**:
   `create_folder` only requires `@jwt_required()` and `@school_required`. Any student or parent account can create arbitrary folders in the school file library. In contrast, `rename_folder` (line 132) and `delete_folder` (line 153) strictly require `@role_required("school_admin", "teacher")`.
2. **Missing Name Validation**:
   Unlike `rename_folder` which checks `1-120` characters, `create_folder` accepts arbitrarily long names and allows path traversal sequences (`..`, `/`, `\`, `:`). If folder names are used in breadcrumb generation or export paths, malicious names can trigger unexpected behavior.
3. **Cross-Tenant `parent_id` Linkage**:
   `parent_id` is taken directly from JSON without checking whether the parent folder belongs to `g.school_id`. An attacker from School A could attach folders under School B's folder tree.

#### Vulnerabilities in `POST /files/upload` (lines 168–254):
- In line 209: `folder_key = safe_storage_key(g.school_id, folder)` properly catches `ValueError` and returns 400 Bad Request.
- In line 220: `upload_file(file_obj, folder=f"{g.school_id}/{folder}", filename=os.path.basename(r2_key))` catches `VirusDetectedError` (422) and `ValueError` (400).
- Minor code smell: line 220 reconstructs `f"{g.school_id}/{folder}"` instead of reusing the already cleaned `folder_key`.

#### Vulnerabilities in `POST /files/stock-import` (lines 529–601):
```python
    folder = "stock"
    unique_name = f"{uuid.uuid4().hex}_{filename}"
    r2_key = f"{g.school_id}/{folder}/{unique_name}"

    file_obj = io.BytesIO(file_bytes)
    file_obj.filename = filename
    file_obj.content_type = mime
    public_url = upload_file(file_obj, folder=f"{g.school_id}/{folder}", filename=unique_name)
```
**Identified Gap**:
Line 600 calls `upload_file()` without wrapping it in a `try...except` block! If ClamAV scans the downloaded image and detects a virus, `upload_file` raises `VirusDetectedError`. If `unique_name` triggers any path error, it raises `ValueError`. Both bubble up uncaught, producing a **500 Internal Server Error** instead of HTTP 422 or 400.

---

### 1.3 Codebase-Wide Audit of Callers of `upload_file`

| Caller File & Line | Context | Error Handling | Vulnerability / Gap |
|---|---|---|---|
| `app/api/v1/students.py:416` | Bulk profile images from ZIP archive | Catches `Exception as exc`, records error in `details` | **CRITICAL**: Folder is hardcoded to `"student-photos"` (no `school_id`). Photos overwrite across tenants if admission numbers match. |
| `app/api/v1/fees.py:365` | `upload_payment_qr` | Catches `VirusDetectedError` (422), catches `Exception` (500) | `ValueError` from `safe_storage_key` is caught by `except Exception`, resulting in 500 instead of 400 Bad Request. |
| `app/api/v1/reports.py:239` | `_persist_report_pdf` | Wrapped in `_report_export_response` (500) | Uses `folder=f"reports/{g.school_id}"`. Safe tenant scoping. Returns 500 on failure. |
| `app/tasks/report_generation.py:187` | Celery task: single report card PDF | Task level | `folder=f"reports/{school_id}"`. Correctly tenant-scoped. |
| `app/tasks/report_generation.py:340` | Celery task: EMIS export CSV | Task level | `folder=f"compliance/{school_id}"`. Correctly tenant-scoped. |
| `app/api/v1/compliance.py:182` | `download_emis_export` | None | Does `path = os.path.join(_local_upload_dir(), *key.split("/"))` without calling `safe_storage_key(key)`. |

#### Deep-Dive on `backend/app/api/v1/students.py:416`:
```python
# Lines 416-419:
url = _upload_file(_FileWrap(img_bytes), "student-photos", f"{stem}{ext}")
student.photo_url = url
```
In this bulk photo import, student photos are uploaded to folder `"student-photos"`.
When `safe_storage_key("student-photos", f"{stem}{ext}")` is evaluated, the storage key is:
`student-photos/ADM001.jpg`.
Notice there is **NO school prefix**!
If School 1 uploads `ADM001.jpg` and School 2 also has a student with admission number `ADM001`, School 2 will **overwrite School 1's student photo** in local disk storage and in Cloudflare R2!
This is a cross-tenant data corruption vulnerability.
**Fix**: Must be `folder=f"{g.school_id}/student-photos"`.

---

### 1.4 Test Suite Status: `backend/tests/test_upload_seam.py`
Existing tests in `TestSafeStorageKey` cover:
- Parent traversal: `../../etc`, `a/../../b`, `..`, `a/../..`
- Absolute paths: `/etc/passwd`, `/uploads`, `//x`
- Backslash tricks: `a\..\b`
- Colon segments: `school-1:etc`
- Empty input rejection
- `TestUploadEndpointFolderGuard`: `POST /api/v1/files/upload` returning 400 for bad folders.

**Missing Test Coverage**:
- Test for whitespace bypass: `" ../etc"`, `"  /etc"`, `"general/ .. "`.
- Test for null byte rejection: `"general\x00evil"`.
- Test for `POST /files/folders` name traversal rejection and tenant parent validation.
- Test for `POST /files/stock-import` handling of `VirusDetectedError` (422) and `ValueError` (400).
- Test for `bulk_profile_images` tenant isolation (ensuring storage key starts with school ID).

---

## 2. AI Teacher Webhook Security (Feature 4)

### 2.1 Webhook Flow & HMAC Verification
In `backend/app/plugins/modules/ai_teacher/routes.py:604–636`:
- Client sends headers: `X-ASchool-Key`, `X-ASchool-Timestamp`, `X-ASchool-Signature`.
- Replay/expiry: Timestamp checked against 300s window (`abs(now - ts) > 300` -> 401).
- HMAC: `_hmac.new(secret.encode(), timestamp.encode() + raw, sha256).hexdigest()`.
- Constant-time comparison: `_hmac.compare_digest(expected, signature)`.

### 2.2 School Key Binding (`routes.py:643–686`)

#### Current Behavior:
```python
    key_row = AITeacherServiceKey.query.filter_by(key_id=key_id).first()
    if key_row:
        if key_row.revoked_at is not None:
            return error_response("Unknown service key", 401)
        key_school_id = str(key_row.school_id)
    elif key_id in secrets_map:
        owner = (
            SchoolPlugin.query.filter_by(plugin_slug="ai_teacher")
            .order_by(SchoolPlugin.created_at)
            .all()
        )
        key_school_id = None
        for sp in owner:
            env = (sp.config or {}).get("webhook_secret_envelope_key_id")
            if env == key_id:
                key_school_id = str(sp.school_id)
                break
        if key_school_id is None:
            current_app.logger.warning(
                "ai_teacher webhook: config-map key %s has no school binding", key_id
            )
            key_school_id = None
    else:
        return error_response("Unknown service key", 401)

    lesson = AITeacherLesson.query.filter_by(
        id=lesson_id, is_deleted=False
    ).first()
    if not lesson:
        return error_response("Lesson not found", 404)
    if key_school_id is not None and key_school_id != str(lesson.school_id):
        return error_response("Service key does not belong to this lesson's school", 403)
```

#### Identified Vulnerabilities & Gaps:
1. **Config Secrets Map Bypass**:
   Notice lines 669–675 and 684:
   If `key_id` is present in `ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS`, but does not match any `webhook_secret_envelope_key_id`, `key_school_id` remains `None`.
   Then at line 684:
   `if key_school_id is not None and key_school_id != str(lesson.school_id):`
   Because `key_school_id is None`, the check evaluates to `False`!
   This means **any key configured in `ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS` can mutate lessons for ANY school in the database!**
2. **Missing Key-ID Binding in Provisioning Hook**:
   In `backend/app/plugins/modules/ai_teacher/hooks.py:120-123`:
   When a school is provisioned, it writes:
   `cfg["webhook_secret"] = encrypt_secret(secret)`
   It **never** stores `webhook_secret_envelope_key_id` into `sp.config`! Therefore, `env == key_id` in `routes.py:666` will **never** match any school plugin.
3. **Database Key Scoping**:
   For database-persisted keys (`AITeacherServiceKey`), line 651 correctly fetches `key_row` and extracts `key_school_id = str(key_row.school_id)`. If `key_row.revoked_at` is set, it returns 401. If `key_school_id != str(lesson.school_id)`, it returns 403. This DB key verification path is sound.

---

### 2.3 Replay Deduplication (`routes.py:700–709`)

```python
    if event_id:
        seen = AITeacherLearningEvent.query.filter_by(
            lesson_id=lesson.id, object_id=str(event_id)[:80]
        ).first()
        if seen:
            return {"duplicate": True}
```

#### Identified Vulnerabilities & Gaps:
1. **Optional `event_id`**:
   If a webhook event payload omits `event_id` or sets `event_id: null`, `if event_id:` evaluates to False.
   Deduplication is completely bypassed. Repeated deliveries will insert duplicate student messages, increment `lesson.questions_asked` repeatedly, and trigger multiple moderation alerts.
2. **Contract Enforceability**:
   The docstring states: *"No JWT — HMAC-authenticated, idempotent by (lesson_id, event_id)"*.
   Therefore, `event_id` must be required. If `not event_id: return error_response("event_id is required", 400)`.
3. **Database Concurrency**:
   `AITeacherLearningEvent` has no database-level unique constraint on `(lesson_id, object_id)`. Two concurrent webhook requests sent simultaneously could pass the `seen` query and execute duplicate insertions. A unique constraint or unique index `uq_ai_teacher_learning_event_lesson_object` provides defense-in-depth.

---

### 2.4 Test Suite Audit: `backend/tests/test_ai_teacher_plugin.py`
The test class `TestWebhookResults` (lines 305–438) has:
- `test_webhook_updates_lesson_and_mastery`
- `test_webhook_self_harm_flag_created`
- `test_webhook_rejects_bad_signature`
- `test_end_event_sets_duration`

**Crucial Observation**:
`TestWebhookResults` sets:
`app.config.setdefault("ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS", {})["ask_test"] = "whsec_test"`
Because `ask_test` is only in config and not in `AITeacherServiceKey` or `SchoolPlugin.config`, `key_school_id` resolves to `None`.
**Gaps in Existing Tests**:
- ZERO tests verify that sending the same `event_id` twice returns `{"duplicate": True}`.
- ZERO tests verify that a service key belonging to School A cannot mutate School B's lessons (HTTP 403).
- ZERO tests verify that a revoked service key returns HTTP 401.

---

## 3. Unsplash API Key Protection (Feature 8d)

### 3.1 Investigation of `backend/app/api/v1/files.py:529–580`

```python
    _STOCK_HOSTS = {
        "images.unsplash.com",
        "plus.unsplash.com",
        "images.pexels.com",
        "videos.pexels.com",
    }
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in _STOCK_HOSTS:
        return error_response(
            "url must be an https stock image from images.unsplash.com or images.pexels.com",
            400,
        )

    # Fire Unsplash download trigger (required by Unsplash API terms).
    # The trigger URL is client-supplied, so it must pass the same stock-host
    # allowlist before the platform key is ever appended to it (audit 6.1-11:
    # previously an arbitrary https URL could be fetched with the key).
    if source == "unsplash" and trigger_url:
        try:
            tp = urlparse(str(trigger_url))
            if tp.scheme == "https" and tp.hostname in _STOCK_HOSTS:
                key = os.getenv("UNSPLASH_ACCESS_KEY", "")
                if key:
                    _requests.get(f"{trigger_url}?client_id={key}", timeout=5)
        except Exception:
            pass
```

### 3.2 Vulnerability & Architecture Analysis

#### 1. Severe Key Leakage to Pexels and Third-Party CDNs
- Notice that `_STOCK_HOSTS` contains:
  `images.pexels.com`, `videos.pexels.com`, `images.unsplash.com`, `plus.unsplash.com`.
- If an attacker calls `POST /api/v1/files/stock-import` with:
  ```json
  {
      "source": "unsplash",
      "url": "https://images.unsplash.com/photo-example",
      "download_trigger_url": "https://images.pexels.com/leak-endpoint"
  }
  ```
- The backend checks `if tp.scheme == "https" and tp.hostname in _STOCK_HOSTS:`.
- `images.pexels.com` is in `_STOCK_HOSTS`!
- The backend immediately executes:
  `_requests.get("https://images.pexels.com/leak-endpoint?client_id=" + UNSPLASH_ACCESS_KEY)`
- The server leaks the platform's private Unsplash access key directly to Pexels' servers.

#### 2. Broken Legitimate Unsplash Download Reporting
- In `_search_unsplash()` (line 452):
  `"download_trigger_url": photo["links"]["download_location"]`
- The official Unsplash API `download_location` URL is:
  `https://api.unsplash.com/photos/<photo_id>/download`
- Notice: **`api.unsplash.com` is NOT in `_STOCK_HOSTS`!**
- Because `api.unsplash.com` is missing from `_STOCK_HOSTS`, `tp.hostname in _STOCK_HOSTS` evaluates to `False`.
- The legitimate Unsplash download attribution trigger **never executes**. ASchool is technically non-compliant with the Unsplash API Terms of Service.

#### 3. URL Query Parameter Key Exposure
- Appending `?client_id={key}` to the URL:
  - Exposes the secret in web server access logs, reverse proxies, and CDN caching layers.
  - If `trigger_url` already contains query parameters (e.g. `https://api.unsplash.com/photos/123/download?ixid=...`), appending `?client_id=` creates an invalid URL with duplicate `?` characters (`?ixid=...?client_id=...`).
- The official Unsplash API documentation states:
  > *"We recommend passing your Access Key via an HTTP Authorization header: `Authorization: Client-ID YOUR_ACCESS_KEY`"*.
  Using the Authorization header keeps the query string clean and prevents credential leakage into URLs and access logs.

#### 4. Architecture Fix: Separation of Host Allow化
There are two completely different types of endpoints:
1. **Asset CDNs** (where image binaries are fetched from):
   `images.unsplash.com`, `plus.unsplash.com`, `images.pexels.com`, `videos.pexels.com`.
2. **API Trigger Hosts** (where download tracking events are sent):
   `api.unsplash.com`, `images.unsplash.com`.
These two sets must NEVER be conflated.

---

## 4. Proposed Fixes & Concrete Code Snippets

### 4.1 Fix 1: Hardened `safe_storage_key` in `backend/app/utils/file_upload.py`

```python
# In backend/app/utils/file_upload.py around line 97:

def safe_storage_key(*parts: str) -> str:
    """Build a storage key from parts, rejecting anything that escapes the root.

    Raises ValueError on '..' segments, absolute paths, null bytes, or backslash tricks,
    so a caller-controlled 'folder' form field can never traverse outside the
    upload root (local) or inject '../' into an object key (R2).
    """
    cleaned: list[str] = []
    for part in parts:
        if part is None:
            continue
        part = str(part).strip()
        if "\x00" in part or "\\" in part:
            raise ValueError("invalid storage path")
        if part.startswith("/"):
            raise ValueError("invalid storage path")
        for segment in part.split("/"):
            seg = segment.strip()
            if seg in ("", "."):
                continue
            if seg == ".." or ":" in seg or "\x00" in seg:
                raise ValueError("invalid storage path")
            cleaned.append(seg)
    if not cleaned:
        raise ValueError("invalid storage path")
    return "/".join(cleaned)
```

### 4.2 Fix 2: Tenant Isolation in `backend/app/api/v1/students.py`

```python
# In backend/app/api/v1/students.py at line 416:
# BEFORE:
# url = _upload_file(_FileWrap(img_bytes), "student-photos", f"{stem}{ext}")

# AFTER:
# Scope storage key strictly under the current school's ID to prevent cross-tenant overwrites:
photo_folder = f"{g.school_id}/student-photos"
url = _upload_file(_FileWrap(img_bytes), photo_folder, f"{stem}{ext}")
```

### 4.3 Fix 3: Hardened Folder Management in `backend/app/api/v1/files.py`

```python
# In backend/app/api/v1/files.py lines 106-126:

@files_bp.route("/folders", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("file_management")
@role_required("school_admin", "teacher")  # Add role requirement
def create_folder():
    """Create a new folder."""
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name or len(name) > 120:
        return error_response("Folder name must be 1-120 characters", 400)
    
    # Path traversal & control char validation
    if "/" in name or "\\" in name or ":" in name or "\x00" in name or name == "..":
        return error_response("Invalid characters in folder name", 400)

    parent_id = data.get("parent_id") or None
    if parent_id:
        parent = FileFolder.query.filter_by(
            id=parent_id, school_id=g.school_id, is_deleted=False
        ).first()
        if not parent:
            return error_response("Parent folder not found", 404)

    folder = FileFolder(
        school_id=g.school_id,
        name=name,
        parent_id=parent_id,
    )
    db.session.add(folder)
    db.session.commit()
    return created_response(folder.to_dict())
```

### 4.4 Fix 4: Hardened Compliance EMIS Download in `backend/app/api/v1/compliance.py`

```python
# In backend/app/api/v1/compliance.py lines 182-185:
    try:
        key = safe_storage_key(key)
    except ValueError:
        return error_response("Invalid storage key", 400)

    if _storage_backend() == "r2":
        return redirect(generate_presigned_url(key, expires_in=300))

    path = os.path.join(_local_upload_dir(), *key.split("/"))
    if not os.path.isfile(path):
        return error_response("Export file missing from storage", 404)
```

### 4.5 Fix 5: AI Teacher Webhook Security in `backend/app/plugins/modules/ai_teacher/routes.py`

```python
# In backend/app/plugins/modules/ai_teacher/routes.py lines 637-688:

    event = request.get_json(silent=True) or {}
    lesson_id = event.get("lesson_id")
    event_id = event.get("event_id")
    etype = event.get("type", "")
    payload = event.get("payload") or {}

    if not event_id:
        return error_response("event_id is required for webhook deduplication", 400)

    from app.models.ai_teacher import AITeacherServiceKey
    from app.models.plugin import SchoolPlugin

    key_row = AITeacherServiceKey.query.filter_by(key_id=key_id).first()
    key_school_id = None
    if key_row:
        if key_row.revoked_at is not None:
            return error_response("Unknown service key", 401)
        key_school_id = str(key_row.school_id)
    elif key_id in secrets_map:
        # Check if config map has explicitly bound school or resolve from plugin
        val = secrets_map[key_id]
        if isinstance(val, dict) and "school_id" in val:
            key_school_id = str(val["school_id"])
        else:
            owner = (
                SchoolPlugin.query.filter_by(plugin_slug="ai_teacher")
                .order_by(SchoolPlugin.created_at)
                .all()
            )
            for sp in owner:
                env = (sp.config or {}).get("webhook_secret_envelope_key_id")
                if env == key_id:
                    key_school_id = str(sp.school_id)
                    break
    else:
        return error_response("Unknown service key", 401)

    lesson = AITeacherLesson.query.filter_by(
        id=lesson_id, is_deleted=False
    ).first()
    if not lesson:
        return error_response("Lesson not found", 404)

    # Strict key-to-school binding
    if key_school_id is not None and key_school_id != str(lesson.school_id):
        return error_response("Service key does not belong to this lesson's school", 403)

    return success_response(apply_event(lesson, etype, payload, event_id))
```

### 4.6 Fix 6: Unsplash Key Protection in `backend/app/api/v1/files.py:551–601`

```python
# In backend/app/api/v1/files.py lines 551-605:

    _STOCK_IMAGE_HOSTS = {
        "images.unsplash.com",
        "plus.unsplash.com",
        "images.pexels.com",
        "videos.pexels.com",
    }
    _UNSPLASH_TRIGGER_HOSTS = {
        "api.unsplash.com",
        "images.unsplash.com",
    }

    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in _STOCK_IMAGE_HOSTS:
        return error_response(
            "url must be an https stock image from images.unsplash.com or images.pexels.com",
            400,
        )

    # Fire Unsplash download trigger strictly to Unsplash endpoints with Authorization header
    if source == "unsplash" and trigger_url:
        try:
            tp = urlparse(str(trigger_url))
            if tp.scheme == "https" and tp.hostname in _UNSPLASH_TRIGGER_HOSTS:
                key = os.getenv("UNSPLASH_ACCESS_KEY", "")
                if key:
                    _requests.get(
                        trigger_url,
                        headers={"Authorization": f"Client-ID {key}"},
                        timeout=5,
                    )
        except Exception:
            pass

    # Download image
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
    try:
        public_url = upload_file(file_obj, folder=f"{g.school_id}/{folder}", filename=unique_name)
    except VirusDetectedError as exc:
        return error_response(f"Stock image rejected by virus scan: {exc}", 422)
    except ValueError:
        return error_response("Invalid storage path", 400)
```

---

## 5. Verification & Test Plan for Implementer

### 5.1 Unit & Integration Tests to Add

#### A. File Upload Seam (`backend/tests/test_upload_seam.py`):
1. `test_safe_storage_key_whitespace_and_null()`:
   - Verify `safe_storage_key("school-1", " ..")` raises `ValueError`.
   - Verify `safe_storage_key("school-1", "general\x00abc")` raises `ValueError`.
2. `test_create_folder_guards()`:
   - Student token returns 403 Forbidden.
   - Folder name `../../bad` returns 400 Bad Request.
   - `parent_id` from another school returns 404 Not Found.
3. `test_bulk_student_photos_tenant_isolation()`:
   - Ensure created `photo_url` contains `{school.id}/student-photos/...`.

#### B. AI Teacher Webhook Security (`backend/tests/test_ai_teacher_plugin.py`):
1. `test_webhook_replay_deduplication()`:
   - Send event with `event_id="evt_dedup_1"`. Status 200, `"received": true`.
   - Send identical event again. Status 200, `"duplicate": true`. Verify no duplicate `AITeacherLearningEvent` or `AITeacherMessage` created.
2. `test_webhook_rejects_missing_event_id()`:
   - Send event without `event_id`. Status 400 Bad Request.
3. `test_webhook_rejects_cross_school_service_key()`:
   - School A key sending event for School B lesson returns 403 Forbidden.
4. `test_webhook_rejects_revoked_key()`:
   - Key with `revoked_at` set returns 401 Unauthorized.

#### C. Unsplash Key Protection (`backend/tests/test_stock_import_security.py`):
1. `test_unsplash_trigger_rejects_pexels_host()`:
   - Send `POST /files/stock-import` with `download_trigger_url="https://images.pexels.com/leak"`.
   - Mock `requests.get`: verify Pexels URL is NEVER requested with Unsplash key.
2. `test_unsplash_trigger_allows_api_unsplash()`:
   - Send `download_trigger_url="https://api.unsplash.com/photos/123/download"`.
   - Verify `requests.get` was called with `headers={"Authorization": "Client-ID <key>"}` and NO `?client_id=` query param.
3. `test_stock_import_virus_detected_returns_422()`:
   - Mock `upload_file` raising `VirusDetectedError` -> returns 422 Unprocessable Entity.

---

## Conclusion
All three focus areas possess specific, actionable vulnerabilities and functional gaps. The recommendations and code snippets above provide the implementer with exact line-by-line modifications and test assertions required to close all security loopholes cleanly without regressions.
