"""Small image helpers for uploads, previews, and validation."""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4


ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}


def is_allowed_image(filename: str) -> bool:
    suffix = Path(filename).suffix.lower().lstrip(".")
    return suffix in ALLOWED_IMAGE_EXTENSIONS


def build_image_name(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    suffix = suffix if suffix else ".jpg"
    return f"{uuid4().hex}{suffix}"


def image_meta(width: int | None = None, height: int | None = None) -> dict:
    return {
        "width": width,
        "height": height,
        "orientation": (
            "landscape"
            if width and height and width > height
            else "portrait"
            if width and height and height > width
            else "square"
            if width and height and width == height
            else None
        ),
    }
