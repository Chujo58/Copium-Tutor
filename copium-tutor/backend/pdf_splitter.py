from __future__ import annotations
from pypdf import PdfReader, PdfWriter
from typing import List
import os
import tempfile

MAX_BYTES = 10 * 1024 * 1024  # 10MB

def split_pdf_to_max_size(pdf_path: str, max_bytes: int = MAX_BYTES) -> List[str]:
    """
    Splits pdf into multiple PDFs, each under max_bytes (best-effort).
    Returns paths to chunk PDFs.
    """
    reader = PdfReader(pdf_path)
    out_paths: List[str] = []

    base = os.path.splitext(os.path.basename(pdf_path))[0]
    total_pages = len(reader.pages)

    def write_writer_to_temp(writer: PdfWriter, idx: int) -> str:
        fd, path = tempfile.mkstemp(prefix=f"{base}_part{idx}_", suffix=".pdf")
        os.close(fd)
        with open(path, "wb") as f:
            writer.write(f)
        return path

    part_idx = 1
    writer = PdfWriter()

    for i in range(total_pages):
        writer.add_page(reader.pages[i])

        # write to temp to measure size
        temp_path = write_writer_to_temp(writer, part_idx)
        size = os.path.getsize(temp_path)

        if size > max_bytes and len(writer.pages) > 1:
            # remove last page from current writer, finalize previous chunk
            # rebuild: previous chunk = writer without last page
            prev_writer = PdfWriter()
            for j in range(len(writer.pages) - 1):
                prev_writer.add_page(writer.pages[j])

            # overwrite temp_path with prev_writer
            with open(temp_path, "wb") as f:
                prev_writer.write(f)

            out_paths.append(temp_path)

            # start new chunk with the last page
            part_idx += 1
            writer = PdfWriter()
            writer.add_page(reader.pages[i])

        elif size <= max_bytes:
            # keep building, discard temp (we'll rewrite later for final)
            os.remove(temp_path)
        else:
            # single page chunk is still > max_bytes (rare but possible)
            out_paths.append(temp_path)
            part_idx += 1
            writer = PdfWriter()

    # flush remaining pages
    if len(writer.pages) > 0:
        final_path = write_writer_to_temp(writer, part_idx)
        out_paths.append(final_path)

    return out_paths
