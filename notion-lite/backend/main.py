import base64, hashlib, re, secrets, time, sqlite3, os, bcrypt, logging, uuid, json
from dataclasses import dataclass
from fastapi import (
    FastAPI,
    HTTPException,
    UploadFile,
    File,
    Form,
    Response,
    Cookie,
    Body,
)
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import datetime as dt
from pydantic import BaseModel
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import asyncio
from backboard import BackboardClient
from pdf_splitter import split_pdf_to_max_size, MAX_BYTES
from db import conn, cursor, init_db
from backboard_ops import index_project_documents_impl
from typing import Literal

load_dotenv()
BACKBOARD_API_KEY = os.getenv("BACKBOARD_API_KEY")

logger = logging.getLogger("uvicorn.error")
logger.setLevel(logging.DEBUG)

app = FastAPI()
salt = bcrypt.gensalt()
conn = sqlite3.connect("database.db")
cursor = conn.cursor()

init_db()


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

class CreateCardRequest(BaseModel):
    front: str
    back: str

class UpdateCardRequest(BaseModel):
    front: str | None = None
    back: str | None = None

class ReviewCardRequest(BaseModel):
    rating: Literal["again", "hard", "good", "easy"]

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


def get_project_file_paths(projectid: str) -> list[str]:
    cursor.execute(
        """
        SELECT f.filepath
        FROM files f
        JOIN fileinproj fp ON fp.fileid = f.fileid
        WHERE fp.projectid = ?
    """,
        (projectid,),
    )
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

def _require_deck_owned(deckid: str, userid: str):
    cursor.execute("SELECT 1 FROM decks WHERE deckid=? AND userid=?", (deckid, userid))
    if cursor.fetchone() is None:
        return False
    return True

def _get_card_and_verify_owner(cardid: str, userid: str):
    cursor.execute("""
        SELECT c.cardid, c.deckid, c.front, c.back
        FROM cards c
        JOIN decks d ON d.deckid = c.deckid
        WHERE c.cardid=? AND d.userid=?
    """, (cardid, userid))
    return cursor.fetchone()

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

#==================================================================
#==================================================================
#                         ENDPOINTS START HERE
#==================================================================
#==================================================================


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
    logger.debug(row)
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
# PROJECTS / COURSES
###############


# List projects using session cookie
@app.get("/projects")
async def list_projects(session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session

    cursor.execute(
        "SELECT projectid, name, description, createddate, image, color, icon FROM projects WHERE userid=?",
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
                "color": row[5],
                "icon": row[6],
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
    color = data.get("color", "")
    icon = data.get("icon", "")

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
        "INSERT INTO projects (projectid, name, description, createddate, image, color, icon, userid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (projectid, name, description, created_date, image, color, icon, userid),
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
    cursor.execute(
        "SELECT 1 FROM projects WHERE projectid=? AND userid=?", (projectid, userid)
    )
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
You are an expert tutor creating study flashcards.

You have access to the course's INDEXED documents for this course (retrieval may be automatic).

Return ONLY valid JSON:
{
  "ok": true,
  "mode": "grounded" | "mixed" | "external_only",
  "confidence": 0-100,
  "cards": [
    {
      "front": "...",
      "back": "...",
      "external": true/false,
      "note": "string"
    }
  ]
}

Rules:
- ALWAYS return ok=true.
- Produce 10–20 cards.
- Cards do NOT need to be verbatim excerpts; paraphrase and synthesize.
- Prefer indexed docs. If a card is not clearly supported by indexed docs, set external=true and
  note="General knowledge (not found in course docs)."
- If most cards are doc-supported: mode="grounded".
- If mix: mode="mixed".
- If you could not rely on docs at all: mode="external_only".
""".strip()


def _extract_json_object(raw: str) -> str | None:
    if raw is None:
        return None
    if not isinstance(raw, str):
        raw = str(raw)
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return raw[start:end + 1]


def _safe_json_load(raw: str):
    try:
        return json.loads(raw)
    except Exception:
        extracted = _extract_json_object(raw)
        if extracted:
            try:
                return json.loads(extracted)
            except Exception:
                return None
        return None


@app.post("/projects/{projectid}/decks")
async def create_deck(projectid: str, body: CreateDeckRequest, session: str = Cookie(None)):

    print("\n" + "=" * 80)
    print(f"[CREATE_DECK] projectid={projectid}")
    print(f"[DECK NAME] {body.name}")
    print(f"[USER PROMPT] {body.prompt}")

    if session is None:
        print("[AUTH] ❌ Unauthorized")
        return {"success": False, "message": "Unauthorized"}
    userid = session
    print(f"[AUTH] ✅ userid={userid}")

    cursor.execute("SELECT 1 FROM projects WHERE projectid=? AND userid=?", (projectid, userid))
    if cursor.fetchone() is None:
        print("[PROJECT] ❌ Project not found or not owned by user")
        return {"success": False, "message": "Project not found"}
    print("[PROJECT] ✅ Ownership verified")

    deckid = uuid.uuid4().hex[:8]
    createddate = datetime.utcnow().isoformat()

    cursor.execute(
        "INSERT INTO decks (deckid, projectid, userid, name, prompt, createddate) VALUES (?, ?, ?, ?, ?, ?)",
        (deckid, projectid, userid, body.name, body.prompt, createddate),
    )
    conn.commit()
    print(f"[DB] Deck created deckid={deckid}")

    print("[BACKBOARD] API key present:", bool(BACKBOARD_API_KEY))
    if not BACKBOARD_API_KEY:
        print("[BACKBOARD] ❌ No API key, skipping generation")
        return {
            "success": True,
            "deckid": deckid,
            "generated": 0,
            "confidence": 0,
            "mode": "external_only",
            "warning": "BACKBOARD_API_KEY not set, cards not generated",
        }

    client, assistant_id, thread_id = await get_or_create_backboard_memory(projectid)
    print("[BACKBOARD]")
    print("  assistant_id:", assistant_id)
    print("  thread_id:", thread_id)

    file_paths = get_project_file_paths(projectid)
    file_names = [os.path.basename(p) for p in (file_paths or [])]

    print("[INDEXED FILES]")
    if not file_names:
        print("  ⚠️ NONE FOUND")
    else:
        for n in file_names:
            print("  -", n)

    user_prompt = f"""
Course: {projectid}
Deck name: {body.name}

User study prompt:
{body.prompt}

Indexed file names (for context; retrieval uses the indexed docs automatically):
{chr(10).join(f"- {n}" for n in file_names) if file_names else "- (none found)"}
""".strip()

    # -------------------------
    # Generate cards (single pass + one retry if JSON is bad)
    # -------------------------
    warning = None
    print("[GENERATION] Generating flashcards (single-pass)")

    gen = await client.add_message(
        thread_id=thread_id,
        content=FLASHCARDS_SYSTEM + "\n\n" + user_prompt,
        llm_provider="openai",
        model_name="gpt-4o",
        stream=False,
        # use Readonly so you don't store flashcards in memory
        memory="Readonly",
    )

    gen_raw = getattr(gen, "content", gen)
    print("[GENERATION RAW]")
    print(gen_raw)

    gen_json = _safe_json_load(gen_raw)
    if not isinstance(gen_json, dict):
        print("[GENERATION] ❌ Invalid JSON; retrying once")
        retry = await client.add_message(
            thread_id=thread_id,
            content="Return ONLY valid JSON. No markdown. No commentary.\n\n"
                    + FLASHCARDS_SYSTEM + "\n\n" + user_prompt,
            llm_provider="openai",
            model_name="gpt-4o",
            stream=False,
            memory="Readonly",
        )
        retry_raw = getattr(retry, "content", retry)
        print("[RETRY RAW]")
        print(retry_raw)
        gen_json = _safe_json_load(retry_raw)

    mode = "external_only"
    confidence = 25
    cards = []

    if isinstance(gen_json, dict):
        mode = (gen_json.get("mode") or "external_only").strip().lower()
        if mode not in ("grounded", "mixed", "external_only"):
            mode = "external_only"

        try:
            confidence = int(gen_json.get("confidence", 25))
        except Exception:
            confidence = 25
        confidence = max(0, min(100, confidence))

        cards = gen_json.get("cards") or []
        if not isinstance(cards, list):
            cards = []
    else:
        warning = "Model did not return valid JSON; padded with generic cards."
        mode = "external_only"
        confidence = 20
        cards = []

    # -------------------------
    # Clean & ensure 10 cards minimum (always generate)
    # -------------------------
    cleaned = []
    for c in cards[:20]:
        if not isinstance(c, dict):
            continue
        front = (c.get("front") or "").strip()
        back = (c.get("back") or "").strip()
        if not front or not back:
            continue

        external = bool(c.get("external", True))
        note = (c.get("note") or "").strip()
        if external and not note:
            note = "General knowledge (not found in course docs)."

        cleaned.append({"front": front, "back": back, "external": external, "note": note})

    while len(cleaned) < 10:
        cleaned.append({
            "front": f"Key idea #{len(cleaned)+1}",
            "back": "Write a concise explanation and one example from your notes.",
            "external": True,
            "note": "General study template (not found in course docs).",
        })
        confidence = min(confidence, 25)
        warning = warning or "Some cards were padded with general study templates."

    cleaned = cleaned[:20]

    print("[GENERATION FINAL]")
    print("  final_mode:", mode)
    print("  final_confidence:", confidence)
    print("  final_cards:", len(cleaned))
    if warning:
        print("  warning:", warning)

    # -------------------------
    # Save cards
    # (DB only stores front/back; append external marker to back)
    # -------------------------
    inserted = 0
    for c in cleaned:
        cardid = uuid.uuid4().hex[:8]

        back_to_store = c["back"]
        if c["external"]:
            back_to_store += f"\n\n[External] {c['note']}"

        cursor.execute(
            "INSERT INTO cards (cardid, deckid, front, back) VALUES (?, ?, ?, ?)",
            (cardid, deckid, c["front"], back_to_store),
        )
        inserted += 1

    conn.commit()
    print(f"[DB] cards inserted: {inserted}")

    return {
        "success": True,
        "deckid": deckid,
        "generated": inserted,
        "confidence": confidence,
        "mode": mode,
        "matched_files": file_names,
        "warning": warning,
    }


# Get deck details and cards (with scheduling fields)
@app.get("/decks/{deckid}")
async def get_deck(deckid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session

    # Deck ownership check
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

    # Cards + scheduling fields
    cursor.execute("""
        SELECT
            cardid,
            front,
            back,
            COALESCE(position, 999999) as pos,
            due_at,
            interval_days,
            ease,
            reps,
            lapses,
            last_reviewed_at
        FROM cards
        WHERE deckid=?
        ORDER BY pos ASC, rowid ASC
    """, (deckid,))

    rows = cursor.fetchall()

    cards = []
    for r in rows:
        cards.append({
            "cardid": r[0],
            "front": r[1],
            "back": r[2],
            "position": r[3],
            "due_at": r[4],
            "interval_days": r[5],
            "ease": r[6],
            "reps": r[7],
            "lapses": r[8],
            "last_reviewed_at": r[9],
        })

    return {"success": True, "deck": deck, "cards": cards}

@app.delete("/decks/{deckid}")
async def delete_deck(deckid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    # Verify deck belongs to this user
    cursor.execute("SELECT projectid FROM decks WHERE deckid=? AND userid=?", (deckid, userid))
    row = cursor.fetchone()
    if row is None:
        return {"success": False, "message": "Deck not found"}

    # Delete cards first (safe even without foreign keys)
    cursor.execute("DELETE FROM cards WHERE deckid=?", (deckid,))
    cursor.execute("DELETE FROM decks WHERE deckid=?", (deckid,))
    conn.commit()

    return {"success": True, "deleted_deckid": deckid}

###############
# CARDS
###############

# create card
@app.post("/decks/{deckid}/cards")
async def add_card(deckid: str, body: CreateCardRequest, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    if not _require_deck_owned(deckid, userid):
        return {"success": False, "message": "Deck not found"}

    front = (body.front or "").strip()
    back = (body.back or "").strip()
    if not front or not back:
        return {"success": False, "message": "front and back are required"}

    # position = max(position)+1 (fallback if null)
    cursor.execute("SELECT COALESCE(MAX(position), 0) FROM cards WHERE deckid=?", (deckid,))
    max_pos = cursor.fetchone()[0] or 0
    pos = int(max_pos) + 1

    cardid = uuid.uuid4().hex[:8]
    cursor.execute(
        "INSERT INTO cards (cardid, deckid, front, back, position) VALUES (?, ?, ?, ?, ?)",
        (cardid, deckid, front, back, pos),
    )
    conn.commit()

    return {
        "success": True,
        "card": {"cardid": cardid, "deckid": deckid, "front": front, "back": back, "position": pos},
    }

# edit card
@app.patch("/cards/{cardid}")
async def update_card(cardid: str, body: UpdateCardRequest, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    row = _get_card_and_verify_owner(cardid, userid)
    if row is None:
        return {"success": False, "message": "Card not found"}

    current_front, current_back = row[2], row[3]
    new_front = current_front if body.front is None else (body.front or "").strip()
    new_back = current_back if body.back is None else (body.back or "").strip()

    if not new_front or not new_back:
        return {"success": False, "message": "front/back cannot be empty"}

    cursor.execute(
        "UPDATE cards SET front=?, back=? WHERE cardid=?",
        (new_front, new_back, cardid),
    )
    conn.commit()

    return {
        "success": True,
        "card": {"cardid": cardid, "deckid": row[1], "front": new_front, "back": new_back},
    }

# delete card
@app.delete("/cards/{cardid}")
async def delete_card(cardid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    row = _get_card_and_verify_owner(cardid, userid)
    if row is None:
        return {"success": False, "message": "Card not found"}

    cursor.execute("DELETE FROM cards WHERE cardid=?", (cardid,))
    conn.commit()

    return {"success": True, "deleted": True, "cardid": cardid}

# review card
@app.post("/cards/{cardid}/review")
async def review_card(cardid: str, body: ReviewCardRequest, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    # verify ownership via join
    cursor.execute("""
        SELECT c.deckid, c.due_at, c.interval_days, c.ease, c.reps, c.lapses
        FROM cards c
        JOIN decks d ON d.deckid = c.deckid
        WHERE c.cardid=? AND d.userid=?
    """, (cardid, userid))
    row = cursor.fetchone()
    if row is None:
        return {"success": False, "message": "Card not found"}

    deckid, due_at, interval_days, ease, reps, lapses = row

    # defaults
    ease = float(ease) if ease is not None else 2.5
    interval_days = float(interval_days) if interval_days is not None else 0.0
    reps = int(reps) if reps is not None else 0
    lapses = int(lapses) if lapses is not None else 0

    rating = body.rating
    now = datetime.utcnow()

    # Simple Anki-ish rules
    if rating == "again":
        ease = max(1.3, ease - 0.2)
        interval_days = 0.02  # ~30 minutes
        lapses += 1
    elif rating == "hard":
        ease = max(1.3, ease - 0.15)
        if reps == 0:
            interval_days = 0.5
        else:
            interval_days = max(0.5, interval_days * 1.2)
    elif rating == "good":
        if reps == 0:
            interval_days = 1.0
        else:
            interval_days = max(1.0, interval_days * ease)
    elif rating == "easy":
        ease = ease + 0.15
        if reps == 0:
            interval_days = 2.0
        else:
            interval_days = max(2.0, interval_days * ease * 1.3)

    reps += 1
    due = now + timedelta(days=interval_days)

    cursor.execute("""
        UPDATE cards
        SET due_at=?, interval_days=?, ease=?, reps=?, lapses=?, last_reviewed_at=?
        WHERE cardid=?
    """, (
        due.isoformat(),
        interval_days,
        ease,
        reps,
        lapses,
        now.isoformat(),
        cardid
    ))
    conn.commit()

    return {
        "success": True,
        "cardid": cardid,
        "deckid": deckid,
        "rating": rating,
        "due_at": due.isoformat(),
        "interval_days": interval_days,
        "ease": ease,
        "reps": reps,
        "lapses": lapses,
        "last_reviewed_at": now.isoformat(),
    }


# Index project documents
@app.post("/projects/{projectid}/index")
async def index_project_documents(projectid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    cursor.execute(
        "SELECT 1 FROM projects WHERE projectid=? AND userid=?", (projectid, userid)
    )
    if cursor.fetchone() is None:
        return {"success": False, "message": "Project not found"}

    if not BACKBOARD_API_KEY:
        return {"success": False, "message": "BACKBOARD_API_KEY not set"}

    return await index_project_documents_impl(
        projectid=projectid,
        userid=userid,
        cursor=cursor,
        conn=conn,
        client_factory=None,  # optional, you can remove if unused
        get_memory=get_or_create_backboard_memory,
    )
