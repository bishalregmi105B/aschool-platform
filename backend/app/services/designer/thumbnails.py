"""Designer template demo thumbnails — one PNG per template folder.

Each template folder under backend/app/templates/designer/<key>/ ships a
canvas.json / writer.json layout. This service renders a rich demo document
(fictional school + sample student + sample marks) through the same
TemplateEngineService.render_html path the bulk generator uses, prints it to
PDF via WeasyPrint, rasterizes the FIRST page with poppler's pdftoppm
(pdf2image is not installed in the backend venv; the /usr/bin/pdftoppm
binary is), downsamples with Pillow to THUMBNAIL_WIDTH px and stores:

    backend/app/templates/designer/<key>/thumbnail.png

The templates list endpoint appends ``thumbnail_url`` when that file exists
and lazily triggers generation (fire-and-forget thread) for a small number
of missing thumbnails. tools_gen_thumbnails.py calls generate_all_thumbnails
directly from the CLI.
"""

import logging
import os
import re
import subprocess
import tempfile
import threading

logger = logging.getLogger(__name__)

THUMBNAIL_WIDTH = 420          # px — card display size @2x on a ~200px column
RENDER_SCALE = 3               # render PDF pages at ~3x CSS px for crisp text
PDF_DPI = 96 * RENDER_SCALE    # pdftoppm rasterization DPI

# One lazy background pass at a time (see ensure_thumbnails_async).
_LAZY_LOCK = threading.Lock()

TEMPLATES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "templates",
    "designer",
)

_THUMB_NAME = "thumbnail.png"


# ── Demo data ─────────────────────────────────────────────────────────────────


def _initials_avatar_data_uri(name: str, bg: str = "#1d4ed8") -> str:
    """data-URI SVG initials avatar used for every photo token so photo
    boxes render a recognizable portrait placeholder in the thumbnail."""
    import base64
    import html as _html

    initials = "".join(part[0] for part in re.split(r"\s+", name.strip()) if part)[:2].upper() or "S"
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" '
        'viewBox="0 0 200 200">'
        f'<rect width="200" height="200" fill="{bg}"/>'
        '<circle cx="100" cy="78" r="34" fill="rgba(255,255,255,0.92)"/>'
        '<path d="M 30 200 C 30 140 170 140 170 200 Z" fill="rgba(255,255,255,0.92)"/>'
        f'<text x="100" y="92" text-anchor="middle" font-family="Arial, sans-serif" '
        f'font-size="52" font-weight="700" fill="{bg}">{_html.escape(initials)}</text>'
        "</svg>"
    )
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("ascii")


def _qr_data_uri(value: str) -> str:
    """Real QR code as a PNG data URI (id_card_standard renders {qr_code} as
    an <img> src, so a plain string would break WeasyPrint's URL resolution)."""
    try:
        import base64
        import io

        import qrcode

        buf = io.BytesIO()
        qr = qrcode.QRCode(box_size=6, border=1)
        qr.add_data(value)
        qr.make(fit=True)
        qr.make_image(fill_color="black", back_color="white").save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:  # qrcode not installed — neutral placeholder keeps layout
        return _initials_avatar_data_uri(value[:2] or "QR", bg="#0f172a")


def demo_data(template_key: str) -> dict:
    """Rich demo payload covering every autofill field the template uses.

    Inspects the folder template's ``fields`` list plus the actual tokens in
    canvas.json / writer.json, so newly added tokens still get sensible
    values. Dates come from today's Bikram Sambat date.
    """
    from datetime import date

    from app.services.designer.template_folders import get_folder_template
    from app.utils.nepali_date import today_bs

    template = get_folder_template(template_key) or {}
    fields = set(template.get("fields") or [])

    today = today_bs()
    year_bs = today.split("-")[0]
    today_ad = date.today().strftime("%Y-%m-%d")
    school_logo = _initials_avatar_data_uri("BS", bg="#1e40af")

    data = {
        # ── School ──
        "school_name": "Bright Star Public School",
        "school_address": "Geta, Kailali",
        "school_phone": "+977-91-560123",
        "school_email": "info@brightstar.edu.np",
        "school_website": "www.brightstar.edu.np",
        "school_logo": school_logo,
        "principal_name": "Sita Sharma",
        "school_stamp": school_logo,
        # ── Student ──
        "name": "Ram Bahadur Shrestha",
        "student_name": "Ram Bahadur Shrestha",
        "first_name": "Ram Bahadur",
        "last_name": "Shrestha",
        "father_name": "Hari Prasad Shrestha",
        "mother_name": "Gita Devi Shrestha",
        "class": "10",
        "class_name": "10",
        "section": "A",
        "section_name": "A",
        "roll_no": "12",
        "roll_number": "12",
        "dob": "2065-04-23",
        "dob_ad": "2008-08-08",
        "admission_date": "2075-04-01",
        "enrollment_number": "BST-2075-0123",
        "admission_number": "BST-2075-0123",
        "student_id": "BST-2075-0123",
        "blood_group": "B+",
        "phone": "+977-9847000000",
        "address": "Geta-4, Kailali",
        "gender": "Male",
        # photos / qr
        "photo": _initials_avatar_data_uri("Ram Bahadur Shrestha"),
        "photo_url": _initials_avatar_data_uri("Ram Bahadur Shrestha"),
        "qr_code": _qr_data_uri("BST-2075-0123"),
        # ── Dates ──
        "today_bs": today,
        "today_ad": today_ad,
        "date": today,
        "issue_date": today,
        "leaving_date": today,
        "event_date": today,
        # ── Exam / report ──
        "exam_name": "Second Terminal Examination 2083",
        "exam_year": year_bs,
        "symbol_no": "431025",
        "iemis_code": "71234",
        "rank": "3",
        "achievement": "Outstanding Academic Performance",
        "conduct": "Excellent",
        "status": "pass",
        "grade": "A",
        "gpa": "3.85",
        "percentage": "88.6",
        "remarks": "Keep up the excellent work.",
        "exam_date": today,
        "position_title": "English Teacher",
        "position_level": "Primary Level",
        "qualifications": "B.Ed. in English with 2+ years classroom experience",
        "how_to_apply": "Email your CV to info@brightstar.edu.np or call the school office by 2083-06-10.",
        "contact_phone_1": "+977-91-560123",
        "contact_phone_2": "+977-9847000000",
        "title": "Second Terminal Examination Result Published",
    }

    # Attendance ledger grid: 20 students x 31 days (mostly P, sprinkled A/L)
    names = [
        "Ram Bahadur Shrestha", "Sita Karki", "Anil Chaudhary", "Puja Bista",
        "Krishna Thapa", "Sunita Rawal", "Bikash Bohara", "Anita Joshi",
        "Manish Hamal", "Sarita Dhami", "Ramesh Air", "Nirmala Saud",
        "Dipak Oad", "Kabita Rana", "Suresh Sarki", "Mina Kumari Yadav",
        "Tek Bahadur Bhandari", "Laxmi Mahara", "Ganesh Bhatta", "Rita Khatri",
    ]
    for i in range(1, 21):
        data[f"roll_{i}"] = str(i)
        data[f"name_{i}"] = names[i - 1]
        data[f"total_p_{i}"] = str(26 + (i % 3))
        data[f"total_a_{i}"] = str(31 - (26 + (i % 3)))
        for d in range(1, 32):
            data[f"m_{i}_{d}"] = "P" if d % 7 else ("A" if i % 4 else "L")
    data["month_name"] = "Shrawan"
    data["year_bs"] = year_bs

    # Marksheet / grade sheet rows (subject_rows & subject_rows_neb writers)
    marks = [
        {"subject": "English", "th_full": 75, "th_obtained": 68, "pr_full": 25,
         "pr_obtained": 21, "pass_marks": 27, "obtained": 89, "full_marks": 100,
         "grade": "A", "credit_hours": 4, "th_grade": "A", "th_gpa": 3.6,
         "in_grade": "A", "in_gpa": 4.0},
        {"subject": "Nepali", "th_full": 75, "th_obtained": 61, "pr_full": 25,
         "pr_obtained": 20, "pass_marks": 27, "obtained": 81, "full_marks": 100,
         "grade": "B+", "credit_hours": 4, "th_grade": "B+", "th_gpa": 3.2,
         "in_grade": "A", "in_gpa": 3.8},
        {"subject": "Mathematics", "th_full": 75, "th_obtained": 66, "pr_full": 25,
         "pr_obtained": 22, "pass_marks": 27, "obtained": 88, "full_marks": 100,
         "grade": "A", "credit_hours": 4, "th_grade": "A", "th_gpa": 3.6,
         "in_grade": "A", "in_gpa": 4.0},
        {"subject": "Science", "th_full": 75, "th_obtained": 64, "pr_full": 25,
         "pr_obtained": 21, "pass_marks": 27, "obtained": 85, "full_marks": 100,
         "grade": "A-", "credit_hours": 4, "th_grade": "A-", "th_gpa": 3.4,
         "in_grade": "A", "in_gpa": 3.8},
        {"subject": "Social Studies", "th_full": 75, "th_obtained": 59, "pr_full": 25,
         "pr_obtained": 20, "pass_marks": 27, "obtained": 79, "full_marks": 100,
         "grade": "B+", "credit_hours": 3, "th_grade": "B+", "th_gpa": 3.2,
         "in_grade": "A-", "in_gpa": 3.6},
        {"subject": "Computer Science", "th_full": 50, "th_obtained": 44, "pr_full": 50,
         "pr_obtained": 45, "pass_marks": 20, "obtained": 89, "full_marks": 100,
         "grade": "A", "credit_hours": 2, "th_grade": "A", "th_gpa": 3.8,
         "in_grade": "A", "in_gpa": 4.0},
    ]
    data["subjects_marks"] = marks

    # Fee bill rows
    data["fee_rows"] = [
        {"particular": "Tuition Fee (Shrawan)", "billed": 2500, "paid": 2500},
        {"particular": "Examination Fee", "billed": 800, "paid": 800},
        {"particular": "Transport Fee", "billed": 1200, "paid": 600},
        {"particular": "Computer Lab Fee", "billed": 500, "paid": 0},
    ]
    data["fees"] = data["fee_rows"]
    data["bill_no"] = "INV-2083-0417"
    data["bill_date"] = today
    data["due_date"] = "2083-06-15"
    data["total_amount"] = "Rs. 3,100"

    # Event / certificate extras
    data["event_name"] = "Annual Sports Meet 2083"
    data["event_venue"] = "School Playground"
    data["leaving_reason"] = "Parents transferred to Dhangadhi"
    data["academic_year"] = f"{year_bs} BS"

    # Any template field still missing gets a readable label instead of
    # silently rendering empty.
    for field in fields:
        if field and field not in data:
            data[field] = str(field).replace("_", " ").title()

    return data


# ── Rendering pipeline ────────────────────────────────────────────────────────


def _pdftoppm_path() -> str | None:
    """Locate poppler's pdftoppm (prefer venv/PDF2IMAGE-free environments)."""
    from shutil import which

    return which("pdftoppm") or "/usr/bin/pdftoppm"


def _first_page_png(pdf_bytes: bytes) -> bytes | None:
    """Rasterize the first PDF page to PNG bytes via pdftoppm subprocess.

    pdf2image is not installed in the backend venv and WeasyPrint 63 dropped
    write_png, so poppler's pdftoppm binary is the pragmatic rasterizer.
    """
    tool = _pdftoppm_path()
    if not tool or not os.path.exists(tool):
        logger.warning("pdftoppm not found — cannot rasterize thumbnails")
        return None
    with tempfile.TemporaryDirectory(prefix="dsthumb_") as tmpdir:
        pdf_path = os.path.join(tmpdir, "page.pdf")
        with open(pdf_path, "wb") as fh:
            fh.write(pdf_bytes)
        # -f/-l 1 → first page only; -png -r DPI; single file suffix -singlefile
        result = subprocess.run(
            [tool, "-f", "1", "-l", "1", "-singlefile", "-png",
             "-r", str(PDF_DPI), pdf_path, os.path.join(tmpdir, "page")],
            capture_output=True, timeout=60,
        )
        if result.returncode != 0:
            logger.warning("pdftoppm failed (%s): %s", result.returncode,
                           (result.stderr or b"").decode("utf-8", "replace")[:300])
            return None
        out_path = os.path.join(tmpdir, "page.png")
        if not os.path.isfile(out_path):
            return None
        with open(out_path, "rb") as fh:
            return fh.read()


def _downscale_to_width(png_bytes: bytes, target_width: int) -> bytes:
    """Downscale the rasterized page with Pillow (already a backend dep)."""
    import io

    from PIL import Image

    image = Image.open(io.BytesIO(png_bytes))
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    if image.width > target_width:
        ratio = target_width / float(image.width)
        image = image.resize(
            (target_width, max(1, round(image.height * ratio))),
            Image.LANCZOS,
        )
    buf = io.BytesIO()
    image.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _wrap_page_sized(html_body: str, width: int, height: int) -> str:
    """Full HTML doc with an @page rule sized to the template's first page.

    wrap_pdf_html hardcodes A4, which would clip the A5 admit cards, A2 wall
    calendar and 1080x1080 hiring poster; the canvas renderer emits pages at
    their design pixel size, so the PDF page must match them.
    """
    from app.services.designer.pdf_css import PDF_BASE_CSS

    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<style>{PDF_BASE_CSS} @page {{ size: {width}px {height}px; margin: 0; }}</style>"
        "</head><body style='margin:0;'>" + html_body + "</body></html>"
    )


def thumbnail_path(template_key: str) -> str:
    return os.path.join(TEMPLATES_DIR, template_key, _THUMB_NAME)


def generate_thumbnail(template_key: str) -> str | None:
    """Render demo data for one folder template → thumbnail.png (first page).

    Returns the output path on success, None on failure. Failures are logged
    and never raise — one broken template must not block the catalog.
    """
    from weasyprint import HTML

    from app.services.designer.template_engine import TemplateEngineService
    from app.services.designer.template_folders import get_folder_template

    template = get_folder_template(template_key)
    if not template or not template.get("_folder"):
        logger.warning("thumbnail: unknown folder template '%s'", template_key)
        return None

    data = demo_data(template_key)

    # Multi-page templates: thumbnail shows the FIRST page only, so trim the
    # canvas to page 1 (both faster and keeps one @page size in the PDF).
    # The folder template dict is the engine's cached object — never mutate it.
    render_meta = template
    canvas = template.get("canvas_json")
    pages = canvas.get("pages") if isinstance(canvas, dict) else None
    if isinstance(pages, list) and len(pages) > 1:
        import copy as _copy

        trimmed = _copy.deepcopy(canvas)
        trimmed["pages"] = [pages[0]]
        render_meta = dict(template)
        render_meta["canvas_json"] = trimmed

    try:
        html_body = TemplateEngineService.render_html(
            template_key,
            data=data,
            school_config={},       # demo school fields already in data
            school_id=None,
            template_meta=render_meta,  # skip the DB lookup — folder is truth
        )
    except Exception as exc:
        logger.warning("thumbnail: render_html failed for %s: %s", template_key, exc)
        return None

    try:
        pdf_bytes = HTML(
            string=_wrap_page_sized(
                html_body,
                int(template.get("width") or 794),
                int(template.get("height") or 1123),
            )
        ).write_pdf()
    except Exception as exc:
        logger.warning("thumbnail: weasyprint failed for %s: %s", template_key, exc)
        return None

    png = _first_page_png(pdf_bytes)
    if not png:
        return None
    try:
        png = _downscale_to_width(png, THUMBNAIL_WIDTH)
    except Exception as exc:
        logger.warning("thumbnail: downscale failed for %s: %s", template_key, exc)
        return None

    out_path = thumbnail_path(template_key)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as fh:
        fh.write(png)
    logger.info("thumbnail: wrote %s (%d bytes)", out_path, len(png))
    return out_path


def list_template_keys() -> list[str]:
    """Folder template keys on disk (filesystem scan, no engine cache)."""
    keys = []
    if os.path.isdir(TEMPLATES_DIR):
        for entry in sorted(os.listdir(TEMPLATES_DIR)):
            if os.path.isfile(os.path.join(TEMPLATES_DIR, entry, "template.yaml")):
                keys.append(entry)
    return keys


def needs_regeneration(template_key: str) -> bool:
    """Cheap freshness check: thumbnail exists AND is newer than canvas.json."""
    thumb = thumbnail_path(template_key)
    if not os.path.isfile(thumb):
        return True
    folder = os.path.join(TEMPLATES_DIR, template_key)
    for source in ("canvas.json", "writer.json", "template.yaml"):
        src = os.path.join(folder, source)
        if os.path.isfile(src) and os.path.getmtime(src) > os.path.getmtime(thumb):
            return True
    return False


def generate_all_thumbnails(keys: list[str] | None = None, force: bool = False) -> dict:
    """Batch-generate thumbnails. Skips fresh thumbnails unless ``force``.

    Every template is guarded: failures are logged and reported, never raised.
    Returns {"generated": [...], "skipped": [...], "failed": {key: error}}.
    """
    targets = keys or list_template_keys()
    report: dict = {"generated": [], "skipped": [], "failed": {}}
    for key in targets:
        try:
            if not force and not needs_regeneration(key):
                report["skipped"].append(key)
                continue
            if generate_thumbnail(key):
                report["generated"].append(key)
            else:
                report["failed"][key] = "render or rasterize failed (see logs)"
        except Exception as exc:  # per-template guard — batch must continue
            logger.warning("thumbnail generation failed for %s: %s", key, exc)
            report["failed"][key] = str(exc)
    return report


# ── Templates-list integration ────────────────────────────────────────────────

_THUMBNAIL_URL = "/api/v1/design-studio/templates/{key}/thumbnail"


def attach_thumbnail_urls(templates: list) -> list:
    """Appenditive serialization helper for GET /design-studio/templates.

    Sets ``thumbnail_url`` on each listed template whose folder ships a
    generated thumbnail.png (served by the /templates/<key>/thumbnail route).
    Existing non-empty thumbnail_url values (e.g. a custom DB overlay) win.
    """
    for template in templates or []:
        if not isinstance(template, dict):
            continue
        if template.get("thumbnail_url"):
            continue
        key = template.get("template_key") or template.get("id")
        if key and os.path.isfile(thumbnail_path(str(key))):
            template["thumbnail_url"] = _THUMBNAIL_URL.format(key=key)
    return templates


def ensure_thumbnails_async(max_missing: int = 40) -> int:
    """Fire-and-forget generation for missing thumbnails.

    Returns the number of missing thumbnails detected. Only spawns a
    background thread when the count is small (< ``max_missing``) so a fresh
    deployment's first catalog request doesn't stall for minutes; oversized
    batches are left to tools_gen_thumbnails.py / a future worker.
    """
    missing = [key for key in list_template_keys() if needs_regeneration(key)]
    if not missing:
        return 0
    if len(missing) >= max_missing:
        logger.info(
            "thumbnail: %d templates missing thumbnails — skipping lazy "
            "generation (use tools_gen_thumbnails.py)", len(missing),
        )
        return len(missing)
    if not _LAZY_LOCK.acquire(blocking=False):
        return len(missing)  # a lazy generation pass is already running

    import threading

    def _worker():
        try:
            generate_all_thumbnails(missing, force=False)
        except Exception as exc:  # never let a thumbnail thread crash the app
            logger.warning("thumbnail lazy generation failed: %s", exc)
        finally:
            _LAZY_LOCK.release()

    thread = threading.Thread(target=_worker, name="designer-thumbnails", daemon=True)
    thread.start()
    return len(missing)
