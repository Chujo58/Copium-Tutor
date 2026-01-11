import base64, hashlib, re, secrets, time, sqlite3, os, bcrypt, logging, uuid, json
from dataclasses import dataclass
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Response, Cookie, Body
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import datetime as dt
from pydantic import BaseModel
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import asyncio
from backboard import BackboardClient
from pdf_splitter import split_pdf_to_max_size, MAX_BYTES


load_dotenv()
BACKBOARD_API_KEY = os.getenv("BACKBOARD_API_KEY")

logger = logging.getLogger("uvicorn.error")
logger.setLevel(logging.DEBUG)

app = FastAPI()
salt = bcrypt.gensalt()
conn = sqlite3.connect("database.db")
cursor = conn.cursor()

@dataclass
class User:
    userid: str
    email: str
    hashed_password: str


@dataclass
class File:
    fileid: str
    filepath: str
    upload_date: str
    file_size: int
    file_type: str


@dataclass
class Project:
    projectid: str
    name: str
    description: str
    created_date: str
    userid: str


@dataclass
class FileProjectRelation:
    fileid: str
    projectid: str

class CreateDeckRequest(BaseModel):
    name: str
    prompt: str

async def get_or_create_backboard_memory(projectid: str):
    # check DB first
    cursor.execute(
        "SELECT assistant_id, memory_thread_id FROM backboard_projects WHERE projectid=?",
        (projectid,),
    )
    row = cursor.fetchone()

    client = BackboardClient(api_key=BACKBOARD_API_KEY)

    if row and row[0] and row[1]:
        return client, row[0], row[1]

    # create new assistant + thread for this course
    assistant = await client.create_assistant(
        name=f"CopiumTutor Course {projectid}",
        description="Study tutor that generates flashcards/quizzes using course documents and memory.",
    )
    thread = await client.create_thread(assistant.assistant_id)

    # Convert UUIDs to strings BEFORE inserting into sqlite
    assistant_id = str(assistant.assistant_id)
    thread_id = str(thread.thread_id)

    cursor.execute(
        "INSERT OR REPLACE INTO backboard_projects (projectid, assistant_id, memory_thread_id) VALUES (?, ?, ?)",
        (projectid, assistant_id, thread_id),
    )
    conn.commit()

    return client, assistant_id, thread_id


def gen_uuid(length: int = 8, salt: str = "yourSaltHere") -> str:
    """
    Python equivalent of the PHP gen_uuid($len=8). https://stackoverflow.com/questions/307486/short-unique-id-in-php

    - length: desired length (clamped to [4, 128]).
    - salt: string salt used in MD5 input.
    """
    length = max(4, min(128, int(length)))

    # Create a unique token similar to PHP uniqid(..., true)
    uniq = f"{time.time_ns()}-{secrets.token_hex(8)}"

    # MD5 of salt + uniq
    h = hashlib.md5((salt + uniq).encode("utf-8")).hexdigest()

    # convert hex to bytes, then base64 encode
    packed = bytes.fromhex(h)
    tmp = base64.b64encode(packed).decode("ascii")

    # strip non-alphanumeric characters (UTF-8 safe)
    uid = re.sub(r"[^A-Za-z0-9]", "", tmp)

    # If too short, append more by recursive generation (chunks of 22 to match original)
    while len(uid) < length:
        uid += gen_uuid(22, salt)

    return uid[:length]

def init_db():
    # decks: one row per deck created inside a course (project)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS decks (
        deckid TEXT PRIMARY KEY,
        projectid TEXT NOT NULL,
        userid TEXT NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        createddate TEXT NOT NULL
    )
    """)

    # cards: the generated (or manual) Q/A inside a deck
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cards (
        cardid TEXT PRIMARY KEY,
        deckid TEXT NOT NULL,
        front TEXT NOT NULL,
        back TEXT NOT NULL
    )
    """)

    # backboard: persistent memory per course
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS backboard_projects (
        projectid TEXT PRIMARY KEY,
        assistant_id TEXT,
        memory_thread_id TEXT
    )
    """)

    # indexed_files: track which files have been indexed for a project
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS indexed_files (
        projectid TEXT NOT NULL,
        fileid TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        indexed_at TEXT NOT NULL,
        PRIMARY KEY (projectid, fileid, content_hash)
    )
    """)

    conn.commit()


init_db()

def get_project_file_paths(projectid: str) -> list[str]:
    cursor.execute("""
        SELECT f.filepath
        FROM files f
        JOIN fileinproj fp ON fp.fileid = f.fileid
        WHERE fp.projectid = ?
    """, (projectid,))
    rows = cursor.fetchall()

    base_dir = os.path.dirname(__file__)  # folder where main.py lives (backend/)
    paths = []

    for (rel_path,) in rows:
        if not rel_path:
            continue

        # Make it absolute and normalized
        abs_path = os.path.normpath(os.path.join(base_dir, rel_path))

        if os.path.exists(abs_path) and os.path.isfile(abs_path):
            paths.append(abs_path)

    return paths


# Allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_credentials=True,
    allow_headers=["*"],
)

UPLOAD_DIR = "uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ME
@app.get("/me")
async def get_me(session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session
    cursor.execute(
        "SELECT email, fname, lname, pfp FROM users WHERE userid=?",
        (userid,),
    )
    row = cursor.fetchone()
    if not row:
        return {"success": False, "message": "User not found"}

    sanitized_user = {
        "userid": userid,
        "email": row[0],
        "hashed_password": "REDACTED",
        "fname": row[1],
        "lname": row[2],
        "pfp": row[3],
    }
    return {"success": True, "user": sanitized_user}


# Login
@app.post("/login")
async def login(data: dict, response: Response):
    email = data.get("email")
    password = data.get("password")
    cursor.execute("SELECT userid, password FROM users WHERE email=?", (email,))
    row = cursor.fetchone()
    logger.debug(f"Login attempt: {email}")
    logger.debug(row)
    stored_password = row[1] if row else None
    if stored_password is None:
        return {"success": False, "message": "Invalid email or password"}

    try:
        if not bcrypt.checkpw(password.encode("utf-8"), stored_password):
            return {"success": False, "message": "Invalid password"}
    except ValueError:
        return {"success": False, "message": "Encryption error"}

    response.set_cookie(
        key="session",
        value=row[0],
        httponly=True,
        max_age=7 * 24 * 60 * 60,  # 1 week
    )

    sanitized_user = {"userid": row[0], "email": email, "hashed_password": "REDACTED"}
    return {"success": True, "user": sanitized_user, "message": "Login successful"}


# Sign Up
@app.post("/signup")
async def signup(data: dict, response: Response):
    email = data.get("email")
    password = data.get("password")
    confirm_password = data.get("confirm_password")
    fname = data.get("fname")
    lname = data.get("lname")

    if password != confirm_password:
        return {"success": False, "message": "Passwords do not match"}

    cursor.execute("SELECT userid FROM users WHERE email=?", (email,))
    if cursor.fetchone():
        return {"success": False, "message": "Email already registered"}

    userid = gen_uuid()
    hashed_password = bcrypt.hashpw(password.encode("utf-8"), salt)

    cursor.execute(
        "INSERT INTO users (userid, email, password, fname, lname) VALUES (?, ?, ?, ?, ?)",
        (userid, email, hashed_password, fname, lname),
    )
    conn.commit()

    response.set_cookie(
        key="session",
        value=userid,
        httponly=True,
        max_age=7 * 24 * 60 * 60,  # 1 week
    )

    sanitized_user = {"userid": userid, "email": email, "hashed_password": "REDACTED"}
    return {"success": True, "user": sanitized_user, "message": "Sign up successful"}


# Logout
@app.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="session")
    return {"success": True, "message": "Logged out successfully"}


# NOW API BS:
###############
# FILES
###############


# Document upload:
@app.post("/upload")
async def upload_file(
    file: UploadFile, project: str = Form(...), session: str = Cookie(None)
):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session

    cursor.execute(
        "SELECT projectid FROM projects WHERE userid=? AND name=?", (userid, project)
    )
    project_row = cursor.fetchone()
    if not project_row:
        return {"success": False, "message": "Project not found or unauthorized"}
    projectid = project_row[0]

    fileid = gen_uuid()
    filepath = os.path.join(UPLOAD_DIR, f"{fileid}_{file.filename}")
    upload_date = datetime.now(dt.UTC).timestamp()
    file_size = 0

    file_type = file.content_type

    cursor.execute(
        "INSERT INTO files (fileid, filepath, uploaddate, filesize, filetype) VALUES (?, ?, ?, ?, ?)",
        (fileid, filepath, upload_date, file_size, file_type),
    )
    cursor.execute(
        "INSERT INTO fileinproj (fileid, projectid) VALUES (?, ?)",
        (fileid, projectid),
    )
    conn.commit()

    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
        file_size = len(content)

    logger.debug(f"Uploaded file {file.filename} as {filepath}")
    return {"success": True, "fileid": fileid, "message": "File uploaded successfully"}


# FIX for pdf preview:
@app.get("/files/{fileid}")
async def get_file(fileid: str):
    cursor.execute("SELECT filepath FROM files WHERE fileid=?", (fileid,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")

    filepath = row[0]
    return FileResponse(
        filepath,
        media_type="application/pdf",
    )


@app.get("/files/{fileid}/path")
async def get_file_path(fileid: str):
    cursor.execute("SELECT filepath FROM files WHERE fileid=?", (fileid,))
    row = cursor.fetchone()
    if not row:
        return {"success": False, "message": "File not found"}

    filepath = row[0]
    return {"success": True, "filepath": os.path.abspath(filepath)}

# Get course specific files

@app.get("/projects/{projectid}/files")
async def list_project_files(projectid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session

    cursor.execute(
        """
        SELECT f.fileid, f.filepath, f.uploaddate, f.filesize, f.filetype
        FROM files f
        JOIN fileinproj fp ON f.fileid = fp.fileid
        JOIN projects p ON fp.projectid = p.projectid
        WHERE p.projectid=? AND p.userid=?
        """,
        (projectid, userid),
    )
    rows = cursor.fetchall()

    files = [
        {
            "fileid": r[0],
            "filepath": r[1],
            "upload_date": r[2],
            "file_size": r[3],
            "file_type": r[4],
        }
        for r in rows
    ]

    return {"success": True, "files": files}


# Document removal:
@app.delete("/files/{fileid}")
async def delete_file(fileid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session

    cursor.execute(
        "SELECT p.projectid FROM projects p JOIN fileinproj fp ON p.projectid = fp.projectid WHERE fp.fileid=? AND p.userid=?",
        (fileid, userid),
    )
    if not cursor.fetchone():
        return {"success": False, "message": "File not found or unauthorized"}

    cursor.execute("SELECT filepath FROM files WHERE fileid=?", (fileid,))
    row = cursor.fetchone()
    if row:
        filepath = row[0]
        if os.path.exists(filepath):
            os.remove(filepath)

    cursor.execute("DELETE FROM files WHERE fileid=?", (fileid,))
    cursor.execute("DELETE FROM fileinproj WHERE fileid=?", (fileid,))
    conn.commit()

    return {"success": True, "message": "File deleted successfully"}


# Add new project to a file
@app.post("/files/{fileid}/add_project")
async def add_file_to_project(
    fileid: str, project: str = Form(...), session: str = Cookie(None)
):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session

    cursor.execute(
        "SELECT projectid FROM projects WHERE userid=? AND name=?", (userid, project)
    )
    project_row = cursor.fetchone()
    if not project_row:
        return {"success": False, "message": "Project not found or unauthorized"}
    projectid = project_row[0]

    cursor.execute(
        "INSERT INTO fileinproj (fileid, projectid) VALUES (?, ?)",
        (fileid, projectid),
    )
    conn.commit()

    return {"success": True, "message": "File added to project successfully"}


# Get files in general
@app.get("/files")
async def list_files(session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session

    cursor.execute(
        """
        SELECT f.fileid, f.filepath, f.uploaddate, f.filesize, f.filetype
        FROM files f
        JOIN fileinproj fp ON f.fileid = fp.fileid
        JOIN projects p ON fp.projectid = p.projectid
        WHERE p.userid=?
        """,
        (userid,),
    )
    rows = cursor.fetchall()

    files = []
    for row in rows:
        files.append(
            {
                "fileid": row[0],
                "filepath": row[1],
                "upload_date": row[2],
                "file_size": row[3],
                "file_type": row[4],
            }
        )

    return {"success": True, "files": files}


###############
# PROJECTS
###############


# List projects using session cookie
@app.get("/projects")
async def list_projects(session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session

    cursor.execute(
        "SELECT projectid, name, description, createddate, image FROM projects WHERE userid=?",
        (userid,),
    )
    rows = cursor.fetchall()

    projects = []
    for row in rows:
        projects.append(
            {
                "projectid": row[0],
                "name": row[1],
                "description": row[2],
                "created_date": row[3],
                "image": row[4],
            }
        )

    return {"success": True, "projects": projects}


# Create new project
@app.post("/projects")
async def create_project(data: dict, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session
    name = data.get("name")
    description = data.get("description", "")
    image = data.get("image", "")

    projectid = gen_uuid()
    created_date = datetime.now(dt.UTC).timestamp()

    # First check if another project with the same name exists for this user
    cursor.execute(
        "SELECT projectid FROM projects WHERE userid=? AND name=?",
        (userid, name),
    )
    if cursor.fetchone():
        return {"success": False, "message": "Project with this name already exists"}

    cursor.execute(
        "INSERT INTO projects (projectid, name, description, createddate, image, userid) VALUES (?, ?, ?, ?, ?, ?)",
        (projectid, name, description, created_date, image, userid),
    )
    conn.commit()

    return {
        "success": True,
        "projectid": projectid,
        "message": "Project created successfully",
    }


# Delete project
@app.delete("/projects/{projectid}")
async def delete_project(projectid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session

    cursor.execute(
        "SELECT projectid FROM projects WHERE projectid=? AND userid=?",
        (projectid, userid),
    )
    if not cursor.fetchone():
        return {"success": False, "message": "Project not found or unauthorized"}

    cursor.execute("DELETE FROM projects WHERE projectid=?", (projectid,))
    cursor.execute("DELETE FROM fileinproj WHERE projectid=?", (projectid,))
    conn.commit()

    return {"success": True, "message": "Project deleted successfully"}

###############
# DECKS
###############

# List decks in a project
@app.get("/projects/{projectid}/decks")
async def list_decks(projectid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session

    # ensure this project belongs to the user
    cursor.execute("SELECT 1 FROM projects WHERE projectid=? AND userid=?", (projectid, userid))
    if cursor.fetchone() is None:
        return {"success": False, "message": "Project not found"}

    cursor.execute(
        "SELECT deckid, name, prompt, createddate FROM decks WHERE projectid=? AND userid=? ORDER BY createddate DESC",
        (projectid, userid),
    )
    rows = cursor.fetchall()

    decks = [
        {"deckid": r[0], "name": r[1], "prompt": r[2], "createddate": r[3]}
        for r in rows
    ]
    return {"success": True, "decks": decks}

# Create a new deck in a project (QUERY ONLY — assumes documents already indexed)

FLASHCARDS_SYSTEM = """
You are an expert tutor.
Return ONLY valid JSON (no markdown, no commentary).
If you cannot comply, return exactly: {"cards":[]}

Schema:
{
  "cards": [
    { "front": "...", "back": "..." }
  ]
}
Rules:
- 10 to 20 cards
- Front is a question/term, Back is concise explanation
- Use ONLY the course documents already indexed in memory as the source of truth
""".strip()


def _extract_json_object(raw: str) -> str | None:
    """Best-effort extraction of the first JSON object in a string."""
    if not isinstance(raw, str):
        raw = str(raw)
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return raw[start:end + 1]


@app.post("/projects/{projectid}/decks")
async def create_deck(projectid: str, body: CreateDeckRequest, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    # verify project belongs to user
    cursor.execute("SELECT 1 FROM projects WHERE projectid=? AND userid=?", (projectid, userid))
    if cursor.fetchone() is None:
        return {"success": False, "message": "Project not found"}

    deckid = uuid.uuid4().hex[:8]
    createddate = datetime.utcnow().isoformat()

    cursor.execute(
        "INSERT INTO decks (deckid, projectid, userid, name, prompt, createddate) VALUES (?, ?, ?, ?, ?, ?)",
        (deckid, projectid, userid, body.name, body.prompt, createddate),
    )
    conn.commit()

    # ---- Backboard generation starts here (QUERY ONLY) ----
    print("BACKBOARD KEY PRESENT:", bool(BACKBOARD_API_KEY))

    if not BACKBOARD_API_KEY:
        return {
            "success": True,
            "deckid": deckid,
            "generated": 0,
            "warning": "BACKBOARD_API_KEY not set, cards not generated",
        }

    client, assistant_id, thread_id = await get_or_create_backboard_memory(projectid)

    generation_prompt = f"""
Course: {projectid}
Deck name: {body.name}

User study prompt:
{body.prompt}

Task:
Generate 10–20 high-quality flashcards using ONLY the indexed course documents in memory.
Focus on definitions, core concepts, key equations, comparisons, and exam-relevant facts.
""".strip()

    try:
        response = await client.add_message(
            thread_id=thread_id,
            content=FLASHCARDS_SYSTEM + "\n\n" + generation_prompt,
            llm_provider="openai",
            model_name="gpt-4o",
            stream=False,
            memory="Auto",
        )
    except Exception as e:
        logger.error(f"Backboard generation failed: {e}")
        return {
            "success": True,
            "deckid": deckid,
            "generated": 0,
            "warning": "Backboard generation failed (see server logs)",
        }

    raw = getattr(response, "content", response)
    print("BACKBOARD RAW RESPONSE:", raw)

    # Parse JSON safely
    cards = []
    try:
        raw_str = raw if isinstance(raw, str) else str(raw)
        json_text = _extract_json_object(raw_str) or raw_str
        cards_json = json.loads(json_text)
        if isinstance(cards_json, dict):
            cards = cards_json.get("cards", []) or []
    except Exception as e:
        logger.error(f"Failed to parse JSON from Backboard: {e}")
        cards = []

    print("PARSED CARDS COUNT:", len(cards))

    # Save cards
    inserted = 0
    for c in cards:
        if not isinstance(c, dict):
            continue
        front = (c.get("front") or "").strip()
        back = (c.get("back") or "").strip()
        if not front or not back:
            continue

        cardid = uuid.uuid4().hex[:8]
        cursor.execute(
            "INSERT INTO cards (cardid, deckid, front, back) VALUES (?, ?, ?, ?)",
            (cardid, deckid, front, back),
        )
        inserted += 1

    conn.commit()

    cursor.execute("SELECT COUNT(*) FROM cards WHERE deckid=?", (deckid,))
    print("DB CARDS INSERTED:", cursor.fetchone()[0])

    return {"success": True, "deckid": deckid, "generated": inserted}



# Get deck details and cards
@app.get("/decks/{deckid}")
async def get_deck(deckid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session

    cursor.execute(
        "SELECT deckid, projectid, name, prompt, createddate FROM decks WHERE deckid=? AND userid=?",
        (deckid, userid),
    )
    row = cursor.fetchone()
    if row is None:
        return {"success": False, "message": "Deck not found"}

    deck = {
        "deckid": row[0],
        "projectid": row[1],
        "name": row[2],
        "prompt": row[3],
        "createddate": row[4],
    }

    cursor.execute("SELECT cardid, front, back FROM cards WHERE deckid=?", (deckid,))
    card_rows = cursor.fetchall()
    cards = [{"cardid": r[0], "front": r[1], "back": r[2]} for r in card_rows]

    return {"success": True, "deck": deck, "cards": cards}

def sha256_file(path: str, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(chunk_size)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


@app.post("/projects/{projectid}/index")
async def index_project_documents(projectid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    # verify project belongs to user
    cursor.execute(
        "SELECT 1 FROM projects WHERE projectid=? AND userid=?",
        (projectid, userid),
    )
    if cursor.fetchone() is None:
        return {"success": False, "message": "Project not found"}

    if not BACKBOARD_API_KEY:
        return {"success": False, "message": "BACKBOARD_API_KEY not set"}

    client, assistant_id, thread_id = await get_or_create_backboard_memory(projectid)

    # Get fileid + relative filepath from DB
    cursor.execute(
        """
        SELECT f.fileid, f.filepath
        FROM files f
        JOIN fileinproj fp ON fp.fileid = f.fileid
        WHERE fp.projectid = ?
        """,
        (projectid,),
    )
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
                logger.warning(f"Missing file on disk: {abs_path}")
                continue

            # Compute content hash
            content_hash = sha256_file(abs_path)

            # Check if already indexed
            cursor.execute(
                """
                SELECT 1 FROM indexed_files
                WHERE projectid=? AND fileid=? AND content_hash=?
                """,
                (projectid, fileid, content_hash),
            )
            if cursor.fetchone() is not None:
                skipped += 1
                continue

            size = os.path.getsize(abs_path)

            # <=10MB: upload directly
            if size <= MAX_BYTES:
                await client.upload_document_to_thread(
                    thread_id=thread_id,
                    file_path=abs_path,
                )
                uploaded_docs += 1

            # >10MB: split then upload
            else:
                parts = split_pdf_to_max_size(abs_path, max_bytes=MAX_BYTES)

                for part_path in parts:
                    await client.upload_document_to_thread(
                        thread_id=thread_id,
                        file_path=part_path,
                    )
                    uploaded_split_docs += 1

                    # cleanup temp split file
                    try:
                        os.remove(part_path)
                    except Exception:
                        pass

            # Mark as indexed ONLY after successful upload(s)
            cursor.execute(
                """
                INSERT OR IGNORE INTO indexed_files
                (projectid, fileid, content_hash, indexed_at)
                VALUES (?, ?, ?, ?)
                """,
                (projectid, fileid, content_hash, datetime.utcnow().isoformat()),
            )
            conn.commit()

        except Exception as e:
            failed += 1
            logger.error(f"Indexing failed for fileid={fileid}: {e}")

    return {
        "success": True,
        "thread_id": thread_id,
        "uploaded_documents": uploaded_docs,
        "uploaded_split_documents": uploaded_split_docs,
        "skipped_files": skipped,
        "failed_files": failed,
    }
