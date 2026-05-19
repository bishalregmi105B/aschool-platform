"""Automated PostgreSQL database backup task.

Runs nightly via Celery Beat (3:00 AM).
Strategy:
    1. Execute pg_dump to produce a gzip-compressed SQL dump.
    2. Upload the dump to Cloudflare R2 under the `backups/` prefix.
    3. Prune local temp file on success.
    4. Retain last 30 backups in R2 (older keys are deleted).

Required environment variables (same as main app):
    DATABASE_URL       — PostgreSQL connection string
    R2_ACCOUNT_ID      — Cloudflare account ID
    R2_ACCESS_KEY_ID   — R2 access key
    R2_SECRET_ACCESS_KEY — R2 secret
    R2_BUCKET_NAME     — Defaults to "aschool"
"""
import gzip
import logging
import os
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone

from extensions import celery

logger = logging.getLogger(__name__)

_BACKUP_PREFIX = "backups/db"
_RETAIN_COUNT = 30  # keep this many backups in R2


@celery.task(name="db_backup_daily", queue="default")
def db_backup_daily():
    """Run a full pg_dump and upload to Cloudflare R2."""
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        logger.error("[db_backup] DATABASE_URL not set — aborting")
        return {"status": "error", "message": "DATABASE_URL not set"}

    if not database_url.startswith("postgresql"):
        logger.error("[db_backup] DATABASE_URL is not PostgreSQL — aborting")
        return {"status": "error", "message": "Non-PostgreSQL database not supported"}

    timestamp = datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S")
    dump_filename = f"aschool_{timestamp}.sql.gz"

    # Create a temp directory so we can clean up easily
    tmpdir = tempfile.mkdtemp(prefix="aschool_backup_")
    raw_dump = os.path.join(tmpdir, "dump.sql")
    gz_dump = os.path.join(tmpdir, dump_filename)

    try:
        # pg_dump uses the DATABASE_URL directly
        env = os.environ.copy()
        env["PGPASSWORD"] = _extract_password(database_url)

        logger.info("[db_backup] Running pg_dump …")
        result = subprocess.run(
            ["pg_dump", "--clean", "--no-owner", "--no-acl", "--format=plain", database_url],
            stdout=open(raw_dump, "wb"),
            stderr=subprocess.PIPE,
            env=env,
            timeout=600,
        )
        if result.returncode != 0:
            stderr_msg = result.stderr.decode(errors="replace")[:500]
            logger.error("[db_backup] pg_dump failed: %s", stderr_msg)
            return {"status": "error", "message": f"pg_dump exit {result.returncode}"}

        # Gzip the dump
        with open(raw_dump, "rb") as f_in, gzip.open(gz_dump, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)

        file_size_mb = os.path.getsize(gz_dump) / 1_048_576
        logger.info("[db_backup] Dump size: %.2f MB", file_size_mb)

        # Upload to R2
        r2_key = f"{_BACKUP_PREFIX}/{dump_filename}"
        _upload_to_r2(gz_dump, r2_key)
        logger.info("[db_backup] Uploaded to R2: %s", r2_key)

        # Prune old backups
        deleted = _prune_old_backups()
        logger.info("[db_backup] Pruned %d old backups", deleted)

        return {
            "status": "success",
            "key": r2_key,
            "size_mb": round(file_size_mb, 2),
            "pruned": deleted,
        }

    except subprocess.TimeoutExpired:
        logger.exception("[db_backup] pg_dump timed out")
        return {"status": "error", "message": "pg_dump timed out after 10 minutes"}
    except Exception:
        logger.exception("[db_backup] Unexpected error during backup")
        return {"status": "error", "message": "Unexpected error — see logs"}
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ── Helpers ───────────────────────────────────────────────────────────────

def _extract_password(database_url: str) -> str:
    """Parse the password from a postgres:// URI without third-party libs."""
    try:
        # postgresql://user:password@host:port/db
        userinfo = database_url.split("@")[0].split("//")[-1]
        if ":" in userinfo:
            return userinfo.split(":", 1)[1]
    except Exception:
        pass
    return ""


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


def _upload_to_r2(local_path: str, r2_key: str) -> None:
    client = _get_r2_client()
    bucket = os.getenv("R2_BUCKET_NAME", "aschool")
    with open(local_path, "rb") as f:
        client.put_object(
            Bucket=bucket,
            Key=r2_key,
            Body=f,
            ContentType="application/gzip",
        )


def _prune_old_backups() -> int:
    """Delete backup objects from R2 that exceed the retention count."""
    try:
        client = _get_r2_client()
        bucket = os.getenv("R2_BUCKET_NAME", "aschool")

        paginator = client.get_paginator("list_objects_v2")
        all_keys = []
        for page in paginator.paginate(Bucket=bucket, Prefix=f"{_BACKUP_PREFIX}/"):
            for obj in page.get("Contents", []):
                all_keys.append((obj["LastModified"], obj["Key"]))

        # Sort oldest first
        all_keys.sort(key=lambda x: x[0])
        to_delete = all_keys[:-_RETAIN_COUNT] if len(all_keys) > _RETAIN_COUNT else []

        for _, key in to_delete:
            client.delete_object(Bucket=bucket, Key=key)
            logger.debug("[db_backup] Pruned: %s", key)

        return len(to_delete)
    except Exception:
        logger.exception("[db_backup] Failed to prune old backups")
        return 0
