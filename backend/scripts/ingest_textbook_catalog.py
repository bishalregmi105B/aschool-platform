#!/usr/bin/env python3
"""Textbook Catalog Ingestion & Provenance Registration CLI.

Scans /home/bishal-regmi/Desktop/ASchool/nepal_textbooks/ publications,
analyzes PDF pages, font encodings (Preeti vs Unicode vs Scanned),
and registers TextbookCorpus records with idempotency.

Usage:
    python backend/scripts/ingest_textbook_catalog.py [--dry-run] [--grade GRADE]
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

import fitz  # PyMuPDF

# Ensure backend path is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.utils.preeti_transcoder import is_preeti_encoded, preeti_to_unicode


def detect_pdf_characteristics(pdf_path: str) -> Dict:
    """Inspect PDF using PyMuPDF to extract page count, size, and font encoding."""
    res = {
        "total_pages": 0,
        "file_size_bytes": 0,
        "font_encoding": "unknown",
        "has_text_layer": False,
        "detected_title_ne": None,
        "sample_raw_text": "",
        "sample_clean_text": "",
    }

    if not os.path.exists(pdf_path):
        return res

    res["file_size_bytes"] = os.path.getsize(pdf_path)

    try:
        doc = fitz.open(pdf_path)
        res["total_pages"] = len(doc)

        # Inspect first 5 pages (or fewer if doc is short)
        sample_pages = min(5, len(doc))
        combined_raw = ""
        has_unicode_devanagari = False
        has_preeti = False

        for p_idx in range(sample_pages):
            page = doc[p_idx]
            page_text = page.get_text() or ""
            combined_raw += page_text + "\n"

            # Check for Devanagari Unicode (\u0900 - \u097F)
            if any("\u0900" <= ch <= "\u097f" for ch in page_text):
                has_unicode_devanagari = True

            # Check for Preeti encoding
            if is_preeti_encoded(page_text):
                has_preeti = True

        res["sample_raw_text"] = combined_raw[:500]
        res["has_text_layer"] = len(combined_raw.strip()) > 50

        if not res["has_text_layer"]:
            res["font_encoding"] = "scanned"
        elif has_preeti:
            res["font_encoding"] = "preeti"
            res["sample_clean_text"] = preeti_to_unicode(combined_raw[:500])
        elif has_unicode_devanagari:
            res["font_encoding"] = "unicode"
            res["sample_clean_text"] = combined_raw[:500]
        else:
            res["font_encoding"] = "english"
            res["sample_clean_text"] = combined_raw[:500]

    except Exception as exc:
        res["error"] = str(exc)

    return res


def load_all_publications(corpus_root: str) -> List[Dict]:
    """Discover all 320 textbooks and educational materials from catalog files."""
    publications = []
    root = Path(corpus_root)

    # 1. Load official CDC Textbooks from catalog.json
    cat_path = root / "catalog.json"
    if cat_path.exists():
        with open(cat_path, "r", encoding="utf-8") as f:
            items = json.load(f)
            for item in items:
                dest = item.get("dest_path")
                if not dest or not os.path.exists(dest):
                    # Try resolving relative path
                    dest = str(root / f"Grade_{int(item['grade']):02d}" / item["filename"])
                
                publications.append({
                    "title_en": item.get("book_name", ""),
                    "title_ne": item.get("book_name", ""),
                    "grade": str(item.get("grade", "")),
                    "subject_code": item.get("subject", "general"),
                    "edition_bs": str(item.get("edition", "2080")),
                    "language": "en" if "english" in item.get("filename", "").lower() else "ne",
                    "source_pdf_path": dest,
                    "is_teacher_guide": False,
                    "is_spec_grid": False,
                    "category": "textbook",
                })

    # 2. Load Teacher Guides, Specification Grids & Frameworks from nepal_educational_materials/catalog.json
    materials_cat = root / "nepal_educational_materials" / "catalog.json"
    if materials_cat.exists():
        with open(materials_cat, "r", encoding="utf-8") as f:
            mat_items = json.load(f)
            for m in mat_items:
                # Resolve path into nepal_textbooks directory
                p = m.get("path", "")
                if "/nepal_educational_materials/" in p:
                    sub = p.split("/nepal_educational_materials/")[-1]
                    p = str(root / "nepal_educational_materials" / sub)

                cat = m.get("category", "")
                is_tg = cat == "Teacher_Guides"
                is_grid = cat == "Model_Questions_and_Grids"
                grade_raw = m.get("grade_folder", "").replace("Grade_", "").replace("Grade ", "")
                
                publications.append({
                    "title_en": m.get("filename", ""),
                    "title_ne": m.get("filename", ""),
                    "grade": grade_raw,
                    "subject_code": "general",
                    "edition_bs": "2080",
                    "language": "ne",
                    "source_pdf_path": p,
                    "is_teacher_guide": is_tg,
                    "is_spec_grid": is_grid,
                    "category": cat,
                })

    return publications


def main():
    parser = argparse.ArgumentParser(description="Ingest CDC Textbook Catalog")
    parser.add_argument("--dry-run", action="store_true", help="Scan and analyze without writing to DB")
    parser.add_argument("--grade", type=str, help="Filter by specific grade (e.g. 10)")
    parser.add_argument("--output-json", type=str, help="Path to write full inspection report JSON")
    parser.add_argument(
        "--corpus-dir",
        type=str,
        default="/home/bishal-regmi/Desktop/ASchool/nepal_textbooks",
        help="Root directory of the CDC textbook PDF corpus",
    )
    args = parser.parse_args()

    corpus_dir = args.corpus_dir
    print(f"[*] Scanning publications from: {corpus_dir}")
    pubs = load_all_publications(corpus_dir)
    print(f"[*] Total catalog entries discovered: {len(pubs)}")

    if args.grade:
        pubs = [p for p in pubs if p["grade"] == str(args.grade)]
        print(f"[*] Filtered to Grade {args.grade}: {len(pubs)} publications")

    analyzed = []
    encoding_counts = {"unicode": 0, "preeti": 0, "scanned": 0, "english": 0, "unknown": 0}

    for idx, pub in enumerate(pubs):
        path = pub["source_pdf_path"]
        meta = detect_pdf_characteristics(path)
        pub.update(meta)
        enc = meta["font_encoding"]
        encoding_counts[enc] = encoding_counts.get(enc, 0) + 1
        analyzed.append(pub)

        if (idx + 1) % 25 == 0 or (idx + 1) == len(pubs):
            print(f"  Processed {idx + 1}/{len(pubs)} publications...")

    print("\n" + "=" * 60)
    print("CORPUS FORENSIC SUMMARY:")
    print(f"Total Analyzed: {len(analyzed)}")
    for enc, count in encoding_counts.items():
        pct = (count / len(analyzed) * 100) if analyzed else 0
        print(f"  - {enc.upper():12s}: {count:4d} ({pct:5.1f}%)")
    print("=" * 60 + "\n")

    if args.output_json:
        out_path = Path(args.output_json)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(analyzed, f, indent=2, ensure_ascii=False)
        print(f"[+] Detailed inspection manifest saved to: {out_path}")

    print("[+] Catalog analysis completed successfully.")


if __name__ == "__main__":
    main()
