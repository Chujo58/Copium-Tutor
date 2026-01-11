import os
import hashlib
from datetime import datetime
from pdf_splitter import split_pdf_to_max_size, MAX_BYTES

def sha256_file(path: str, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(chunk_size)
            if not b:
                break
            h.update(b)
    return h.hexdigest()

async def index_project_documents_impl(projectid: str, userid: str, cursor, conn, client_factory, get_memory):
    """
    Returns dict payload for the endpoint.
    - client_factory: function that returns Backboard client
    - get_memory: async function to get (client, assistant_id, thread_id)
    """
    client, assistant_id, thread_id = await get_memory(projectid)

    # fileid + filepath
    cursor.execute("""
        SELECT f.fileid, f.filepath
        FROM files f
        JOIN fileinproj fp ON fp.fileid = f.fileid
        WHERE fp.projectid = ?
    """, (projectid,))
    rows = cursor.fetchall()

    base_dir = os.path.dirname(__file__)
    uploaded_docs = 0
    uploaded_split_docs = 0
    skipped = 0
    failed = 0

    for fileid, rel_path in rows:
        try:
            abs_path = os.path.normpath(os.path.join(base_dir, rel_path))
            if not os.path.exists(abs_path):
                continue

            content_hash = sha256_file(abs_path)

            cursor.execute("""
                SELECT 1 FROM indexed_files
                WHERE projectid=? AND fileid=? AND content_hash=?
            """, (projectid, fileid, content_hash))
            if cursor.fetchone():
                skipped += 1
                continue

            size = os.path.getsize(abs_path)
            if size <= MAX_BYTES:
                await client.upload_document_to_thread(thread_id=thread_id, file_path=abs_path)
                uploaded_docs += 1
            else:
                parts = split_pdf_to_max_size(abs_path, max_bytes=MAX_BYTES)
                for part_path in parts:
                    await client.upload_document_to_thread(thread_id=thread_id, file_path=part_path)
                    uploaded_split_docs += 1
                    try:
                        os.remove(part_path)
                    except Exception:
                        pass

            cursor.execute("""
                INSERT OR IGNORE INTO indexed_files (projectid, fileid, content_hash, indexed_at)
                VALUES (?, ?, ?, ?)
            """, (projectid, fileid, content_hash, datetime.utcnow().isoformat()))
            conn.commit()

        except Exception:
            failed += 1

    return {
        "success": True,
        "thread_id": thread_id,
        "uploaded_documents": uploaded_docs,
        "uploaded_split_documents": uploaded_split_docs,
        "skipped_files": skipped,
        "failed_files": failed,
    }
