#!/usr/bin/env python3
"""Generate demo thumbnails for designer templates.

Usage (from the repo root or anywhere):

    backend/.venv/bin/python tools_gen_thumbnails.py            # all templates
    backend/.venv/bin/python tools_gen_thumbnails.py marksheet id_card_standard
    backend/.venv/bin/python tools_gen_thumbnails.py --force     # regenerate even if fresh

Writes backend/app/templates/designer/<key>/thumbnail.png (first page,
~420px wide) for every folder template. Skips thumbnails that already exist
and are newer than the template's canvas.json/writer.json/template.yaml.
"""

import argparse
import os
import sys

# Make `app.*` imports work no matter where the script is invoked from.
_REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.join(_REPO_ROOT, "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("keys", nargs="*", help="template keys (default: all)")
    parser.add_argument(
        "--force", action="store_true",
        help="regenerate even when a fresh thumbnail.png already exists",
    )
    args = parser.parse_args()

    # Logging config only matters when run directly — keep the output readable.
    import logging

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    from app.services.designer.thumbnails import (
        generate_all_thumbnails,
        list_template_keys,
        thumbnail_path,
    )

    keys = args.keys or list_template_keys()
    if not keys:
        print("No designer template folders found.")
        return 1

    print(f"Generating thumbnails for {len(keys)} template(s)...\n")
    report = generate_all_thumbnails(keys, force=args.force)

    if report["skipped"]:
        print(f"Skipped (already fresh): {len(report['skipped'])}")
        for key in report["skipped"]:
            print(f"  - {key}")
    if report["generated"]:
        print(f"\nGenerated {len(report['generated'])}:")
        for key in report["generated"]:
            path = thumbnail_path(key)
            size_kb = os.path.getsize(path) / 1024 if os.path.isfile(path) else 0
            print(f"  + {key:36s} {size_kb:8.1f} KB  {path}")
    if report["failed"]:
        print(f"\nFAILED {len(report['failed'])}:")
        for key, error in report["failed"].items():
            print(f"  x {key}: {error}")

    print(
        f"\nDone. generated={len(report['generated'])} "
        f"skipped={len(report['skipped'])} failed={len(report['failed'])}"
    )
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
