# Handoff Report: Milestone 1 Security & Bug Fixes Explorer 1

**Agent**: `explorer_m1_1`  
**Working Directory**: `/home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_1`  
**Handoff Type**: Hard (Investigation & Analysis Complete)  
**Target Milestone**: Milestone 1 (R1 Backend Security Hardening & Bug Fixes)  
**Scope**: Feature 1 (File Path Traversal Hardening), Feature 4 (AI Teacher Webhook Security), Feature 8d (Unsplash API Key Protection)  

---

## 1. Observation

Direct observations made through pattern matching, direct code inspection, and test execution:

1. **Unsplash API Key Protection (`backend/app/api/v1/files.py:551–577`)**:
   - `_STOCK_HOSTS` is defined at line 551 as:
     ```python
     _STOCK_HOSTS = {
         "images.unsplash.com",
         "plus.unsplash.com",
         "images.pexels.com",
         "videos.pexels.com",
     }
     ```
   - Trigger handling at lines 568–576:
     ```python
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
   - The legitimate Unsplash download tracking URL returned by `_search_unsplash()` at line 452 is `photo["links"]["download_location"]` (which targets `https://api.unsplash.com/photos/<photo_id>/download`). `api.unsplash.com` is missing from `_STOCK_HOSTS`, so `tp.hostname in _STOCK_HOSTS` evaluates to `False`.
   - `images.pexels.com` is in `_STOCK_HOSTS`. A request with `source="unsplash"` and `download_trigger_url="https://images.pexels.com/..."` passes `in _STOCK_HOSTS` and sends `UNSPLASH_ACCESS_KEY` to Pexels.

2. **Bulk Student Profile Photo Tenant Isolation (`backend/app/api/v1/students.py:416`)**:
   - At line 416:
     ```python
     url = _upload_file(_FileWrap(img_bytes), "student-photos", f"{stem}{ext}")
     ```
   - The folder parameter is hardcoded to `"student-photos"` without `g.school_id`.
   - In `backend/app/utils/file_upload.py:136`, `safe_storage_key("student-photos", f"{stem}{ext}")` generates key `student-photos/<stem>.<ext>`. Two schools with students sharing the same admission number (e.g. `ADM101`) will overwrite each other's photo file in storage.

3. **Folder Creation Security (`backend/app/api/v1/files.py:106–126`)**:
   - Missing `@role_required("school_admin", "teacher")` on `POST /folders` (unlike `rename_folder` at line 132 and `delete_folder` at line 153).
   - Folder `name` has no length restriction or traversal character sanitization.
   - `parent_id` is not validated against `g.school_id`, allowing foreign school parent folders to be linked.

4. **Stock Import Exception Handling (`backend/app/api/v1/files.py:600`)**:
   - `public_url = upload_file(file_obj, folder=f"{g.school_id}/{folder}", filename=unique_name)` at line 600 is not wrapped in `try...except`.
   - If `scan_for_viruses` raises `VirusDetectedError` or path validation raises `ValueError`, the request crashes with unhandled 500 error.

5. **AI Teacher Webhook Security (`backend/app/plugins/modules/ai_teacher/routes.py:604–709`)**:
   - School key binding at lines 669–675: If `key_id` is in `ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS`, `key_school_id` is set to `None`. At line 684:
     ```python
     if key_school_id is not None and key_school_id != str(lesson.school_id):
         return error_response("Service key does not belong to this lesson's school", 403)
     ```
     When `key_school_id` is `None`, this condition evaluates to `False`, permitting cross-tenant mutations.
   - Replay protection at line 703:
     ```python
     if event_id:
         seen = AITeacherLearningEvent.query.filter_by(
             lesson_id=lesson.id, object_id=str(event_id)[:80]
         ).first()
         if seen:
             return {"duplicate": True}
     ```
     If `event_id` is omitted in the request payload, `event_id` is `None`, bypassing deduplication entirely.
   - Test execution `pytest backend/tests/test_ai_teacher_plugin.py::TestWebhookResults`:
     4 passed in 156.99s. Existing tests verify happy-path mastery update, self-harm flag, bad signature 401, and duration calculation, but have zero tests for replay deduplication, cross-school service keys, or revoked keys.

6. **Compliance Export Path (`backend/app/api/v1/compliance.py:182`)**:
   - `path = os.path.join(_local_upload_dir(), *key.split("/"))` does not validate `key` through `safe_storage_key(key)`.

---

## 2. Logic Chain

1. **Unsplash Key Leak**:
   - Observation 1 demonstrates `_STOCK_HOSTS` merges image CDNs (`images.pexels.com`) and image providers.
   - Because `trigger_url` is client-provided and checked against `_STOCK_HOSTS`, an attacker can pass a Pexels URL.
   - The backend appends `UNSPLASH_ACCESS_KEY` to that URL and issues a GET request, transmitting the secret to Pexels servers.
   - Because `api.unsplash.com` is omitted from `_STOCK_HOSTS`, real Unsplash triggers fail.
   - *Inference*: Separating `_STOCK_IMAGE_HOSTS` from `_UNSPLASH_TRIGGER_HOSTS = {"api.unsplash.com", "images.unsplash.com"}` and sending `Authorization: Client-ID {key}` header resolves both the leak and the broken trigger.

2. **Cross-Tenant Student Photo Collision**:
   - Observation 2 confirms `upload_file` is invoked with `"student-photos"`.
   - `safe_storage_key` constructs `student-photos/<stem>.<ext>`.
   - In a multi-tenant system, two different schools will share identical student admission numbers (`stem`).
   - Local filesystem or R2 will overwrite the existing file at that key.
   - *Inference*: Changing the folder to `f"{g.school_id}/student-photos"` partitions storage by tenant, preventing collision.

3. **Folder Creation & Compliance Path Safety**:
   - Observation 3 shows lack of role enforcement on `create_folder` and lack of character validation.
   - Observation 6 shows unvalidated key splitting in `compliance.py`.
   - *Inference*: Applying `@role_required("school_admin", "teacher")`, checking name length (1–120), rejecting traversal chars (`..`, `/`, `\`, `:`), verifying `parent_id` tenant ownership, and passing `compliance.py` keys through `safe_storage_key()` closes these gaps.

4. **AI Teacher Webhook Hardening**:
   - Observation 5 reveals `key_school_id` being `None` bypasses tenant scoping for deployment keys.
   - Observation 5 reveals `event_id` is optional, bypassing deduplication.
   - *Inference*: Requiring `event_id` in request payload and enforcing strict school binding closes replay and tenant isolation gaps.

---

## 3. Caveats

1. **Test Runner Performance**:
   - PostgreSQL in the test environment runs `TRUNCATE TABLE ... CASCADE` across 140+ tables on test reset. This incurs disk `fsync` overhead (`DataFileImmediateSync`) taking ~20–30s per test class. Tests should be run per-class or targeted rather than full suite all at once during local iteration.
2. **`ASCHOOL_AI_TEACHER_WEBHOOK_SECRETS` in Test Suite**:
   - `test_ai_teacher_plugin.py` injects `"ask_test": "whsec_test"` without creating an `AITeacherServiceKey` row or setting `webhook_secret_envelope_key_id`. If `key_school_id` is strictly enforced to be non-None, tests must seed `AITeacherServiceKey(key_id="ask_test", school_id=school.id)` or the config map must support `{"ask_test": {"secret": "...", "school_id": str(school.id)}}`.
3. **No other callers of `upload_file` leak credentials**:
   - All other callers (`fees.py`, `reports.py`, `report_generation.py`) correctly incorporate tenant prefixes and do not accept client-controlled trigger URLs.

---

## 4. Conclusion

The security vulnerabilities in Features 1, 4, and 8d are well-defined and remediable through concise, localized code modifications:
- **Feature 1**: Fix `students.py:416` (`folder=f"{g.school_id}/student-photos"`), harden `safe_storage_key` against whitespace/nulls, secure `create_folder` with role + validation + parent check, wrap `stock-import` `upload_file` in exception handler, and sanitize `compliance.py:182`.
- **Feature 4**: Enforce mandatory `event_id` in `routes.py`, bind config secrets to schools, and add missing unit tests for replay deduplication, cross-school keys, and revoked keys.
- **Feature 8d**: Split `_STOCK_HOSTS` into `_STOCK_IMAGE_HOSTS` and `_UNSPLASH_TRIGGER_HOSTS = {"api.unsplash.com", "images.unsplash.com"}` in `files.py:551`, and transmit Unsplash credentials strictly via `Authorization: Client-ID {key}` header.

Detailed proposed code snippets are written in `/home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_1/report.md`.

---

## 5. Verification Method

To independently verify the findings and any subsequent implementation:

1. **Inspect Target Source Files**:
   - `backend/app/utils/file_upload.py` lines 97–120
   - `backend/app/api/v1/files.py` lines 106–126, 208–225, 529–605
   - `backend/app/api/v1/students.py` lines 351–425
   - `backend/app/api/v1/compliance.py` lines 180–190
   - `backend/app/plugins/modules/ai_teacher/routes.py` lines 604–709

2. **Execute Targeted Test Commands**:
   ```bash
   # Verify file upload unit tests
   DATABASE_URL=postgresql://aschool:aschool@172.21.0.3:5432/aschool REDIS_URL=redis://172.21.0.4:6379/0 backend/.venv/bin/pytest backend/tests/test_upload_seam.py::TestSafeStorageKey

   # Verify AI Teacher webhook tests
   DATABASE_URL=postgresql://aschool:aschool@172.21.0.3:5432/aschool REDIS_URL=redis://172.21.0.4:6379/0 backend/.venv/bin/pytest backend/tests/test_ai_teacher_plugin.py::TestWebhookResults
   ```

3. **Invalidation Conditions**:
   - If `POST /files/stock-import` passes a Pexels trigger URL and outgoing HTTP headers contain `Client-ID`, the key protection is breached.
   - If two schools upload student photos with admission number `ADM1` and both point to `student-photos/ADM1.jpg`, tenant isolation is broken.
   - If sending duplicate `(lesson_id, event_id)` payloads creates duplicate entries in `ai_teacher_learning_events` or `ai_teacher_messages`, replay deduplication has failed.
