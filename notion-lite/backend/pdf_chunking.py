from __future__ import annotations
from typing import Dict, List
from pypdf import PdfReader
import os

DEFAULT_PAGES_PER_CHUNK = 4

MAX_CHARS_PER_CHUNK = 25_000


def chunk_pdf_to_text(
    pdf_path: str,
    pages_per_chunk: int = DEFAULT_PAGES_PER_CHUNK,
    max_chars_per_chunk: int = MAX_CHARS_PER_CHUNK,
) -> List[Dict]:
    """
    Returns list of {"text": str, "meta": {"filename": str, "start_page": int, "end_page": int}}
    Pages are 1-indexed in metadata.
    """
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    filename = os.path.basename(pdf_path)

    chunks: List[Dict] = []
    for start0 in range(0, total_pages, pages_per_chunk):
        end0 = min(start0 + pages_per_chunk, total_pages)

        parts = []
        for i in range(start0, end0):
            t = reader.pages[i].extract_text() or ""
            t = t.strip()
            if t:
                parts.append(t)

        text = "\n\n".join(parts).strip()
        if not text:
            continue

        # truncate if too long (prevents “giant message” issues)
        if len(text) > max_chars_per_chunk:
            text = text[:max_chars_per_chunk] + "\n\n[TRUNCATED: chunk exceeded max_chars_per_chunk]"

        chunks.append({
            "text": text,
            "meta": {
                "filename": filename,
                "start_page": start0 + 1,
                "end_page": end0,
            }
        })

    return chunks
