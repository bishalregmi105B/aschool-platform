"""File storage utilities.

Controlled by the FILE_STORAGE_BACKEND environment variable:
  local  — save files to LOCAL_UPLOAD_DIR on disk (default, good for dev)
  r2     — upload to Cloudflare R2 (production)

ClamAV virus scanning:
  Enabled when CLAMAV_ENABLED=true. Requires clamd running and accessible at
  CLAMAV_HOST:CLAMAV_PORT (defaults: localhost:3310).
  Upload is rejected with a 422 if a threat is detected.
"""
import logging
import os
import uuid

logger = logging.getLogger(__name__)


# ── Backend selection ──────────────────────────────────────────────────────

def _backend() -> str:
    """Return the active storage backend: 'local' or 'r2'."""
    return os.getenv("FILE_STORAGE_BACKEND", "local").strip().lower()


def _local_upload_dir() -> str:
    base = os.getenv("LOCAL_UPLOAD_DIR", "/app/uploads")
    os.makedirs(base, exist_ok=True)
    return base


# ── R2 client (lazy import so boto3 is not required for local mode) ────────

def _get_r2_client():
    import boto3
    from botocore.config import Config
    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


# ── ClamAV virus scanning ──────────────────────────────────────────────────

class VirusDetectedError(ValueError):
    """Raised when ClamAV reports a threat in an uploaded file."""


def scan_for_viruses(data: bytes, filename: str = "") -> None:
    """Scan *data* with ClamAV. Raises VirusDetectedError if a threat is found.

    Does nothing when CLAMAV_ENABLED is not 'true'. Connection failures are
    logged as warnings but do NOT block the upload (fail-open), unless
    CLAMAV_STRICT=true in which case they raise RuntimeError.
    """
    if os.getenv("CLAMAV_ENABLED", "false").strip().lower() != "true":
        return

    host = os.getenv("CLAMAV_HOST", "localhost")
    port = int(os.getenv("CLAMAV_PORT", "3310"))
    strict = os.getenv("CLAMAV_STRICT", "false").strip().lower() == "true"

    try:
        import clamd  # pip install clamd
        cd = clamd.ClamdNetworkSocket(host=host, port=port, timeout=15)
        result = cd.instream(data if hasattr(data, "read") else __import__("io").BytesIO(data))
        status, message = result.get("stream", ("OK", ""))
        if status == "FOUND":
            logger.warning("ClamAV: threat detected in '%s': %s", filename, message)
            raise VirusDetectedError(f"Virus/malware detected: {message}")
        logger.debug("ClamAV: clean scan for '%s'", filename)
    except VirusDetectedError:
        raise
    except Exception as exc:
        if strict:
            raise RuntimeError(f"ClamAV scan failed and CLAMAV_STRICT=true: {exc}") from exc
        logger.warning("ClamAV scan unavailable (non-strict): %s", exc)


# ── Public API ─────────────────────────────────────────────────────────────

def upload_file(file_obj, folder: str, filename: str | None = None) -> str:
    """Upload a file and return its public URL or local path.

    Raises VirusDetectedError if ClamAV is enabled and a threat is found.
    """
    ext = ""
    if hasattr(file_obj, "filename") and file_obj.filename:
        ext = os.path.splitext(file_obj.filename)[1]
    if filename is None:
        filename = f"{uuid.uuid4().hex}{ext}"

    key = f"{folder}/{filename}"

    content_type = "application/octet-stream"
    if hasattr(file_obj, "content_type") and file_obj.content_type:
        content_type = file_obj.content_type

    body = file_obj.read() if hasattr(file_obj, "read") else file_obj

    # Virus scan before storing
    scan_for_viruses(body, filename=filename)

    if _backend() == "r2":
        client = _get_r2_client()
        bucket = os.getenv("R2_BUCKET_NAME", "aschool")
        client.put_object(Bucket=bucket, Key=key, Body=body, ContentType=content_type)
        public_url = os.getenv("R2_PUBLIC_URL", "").rstrip("/")
        return f"{public_url}/{key}"

    # local
    upload_dir = _local_upload_dir()
    dest = os.path.join(upload_dir, *key.split("/"))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(body)
    return f"/uploads/{key}"


def delete_file(key: str):
    """Delete a file by its storage key."""
    if _backend() == "r2":
        client = _get_r2_client()
        bucket = os.getenv("R2_BUCKET_NAME", "aschool")
        client.delete_object(Bucket=bucket, Key=key)
    else:
        upload_dir = _local_upload_dir()
        dest = os.path.join(upload_dir, *key.split("/"))
        try:
            os.remove(dest)
        except FileNotFoundError:
            pass


def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Return a time-limited URL for a file (R2) or a direct local path."""
    if _backend() == "r2":
        client = _get_r2_client()
        bucket = os.getenv("R2_BUCKET_NAME", "aschool")
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires_in,
        )
    return f"/uploads/{key}"
