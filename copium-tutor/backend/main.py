# region imports
import base64, hashlib, re, secrets, time, sqlite3, os, bcrypt, logging, uuid, json
from pathlib import Path
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
from fastapi.staticfiles import StaticFiles
from datetime import datetime, timedelta
import datetime as dt
from pydantic import BaseModel
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import asyncio
from backboard import BackboardClient
from backboard.exceptions import BackboardNotFoundError, BackboardServerError
from pdf_splitter import split_pdf_to_max_size, MAX_BYTES
from db import conn, cursor, init_db, DB_PATH
from backboard_ops import index_project_documents_impl
from typing import Literal, Optional

# endregion

# region Config & Initialization
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")
BACKBOARD_API_KEY = os.getenv("BACKBOARD_API_KEY")

logger = logging.getLogger("uvicorn.error")
logger.setLevel(logging.DEBUG)

app = FastAPI()
salt = bcrypt.gensalt()
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()

init_db()

PUBLIC_DIR = Path(__file__).resolve().parent / "public"
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/public", StaticFiles(directory=PUBLIC_DIR), name="public")
# endregion


# region Data Classes and Models
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


class CreateQuizRequest(BaseModel):
    topic: str
    quiz_type: str
    num_questions: int
    document_ids: list[str] = []


class SubmitQuizRequest(BaseModel):
    answers: dict


class CreateCardRequest(BaseModel):
    front: str
    back: str


class UpdateCardRequest(BaseModel):
    front: str | None = None
    back: str | None = None


class ReviewCardRequest(BaseModel):
    rating: Literal["again", "hard", "good", "easy"]


class CreateChatRequest(BaseModel):
    title: str | None = None
    llm_provider: str | None = "openai"
    model_name: str | None = "gpt-4o"


class SendChatMessageRequest(BaseModel):
    content: str
    llm_provider: str | None = None
    model_name: str | None = None


class RenameChatRequest(BaseModel):
    title: str


# endregion


# region Helper: Backboard & Memory
async def get_or_create_backboard_memory(projectid: str, db_cursor=None, db_conn=None):
    db_cursor = db_cursor or cursor
    db_conn = db_conn or conn
    # check DB first
    db_cursor.execute(
        "SELECT assistant_id, memory_thread_id FROM backboard_projects WHERE projectid=?",
        (projectid,),
    )
    row = db_cursor.fetchone()
    client = BackboardClient(api_key=BACKBOARD_API_KEY)

    if row and row[0] and row[1]:
        assistant_id = row[0]
        thread_id = row[1]
        try:
            await client.get_thread(thread_id)
            return client, assistant_id, thread_id
        except BackboardNotFoundError:
            logger.warning(
                "Backboard thread missing for project %s, recreating", projectid
            )
            try:
                thread = await client.create_thread(assistant_id)
                thread_id = str(thread.thread_id)
                db_cursor.execute(
                    "UPDATE backboard_projects SET memory_thread_id=? WHERE projectid=?",
                    (thread_id, projectid),
                )
                db_cursor.execute(
                    "DELETE FROM indexed_files WHERE projectid=?", (projectid,)
                )
                db_conn.commit()
                return client, assistant_id, thread_id
            except BackboardNotFoundError:
                logger.warning(
                    "Backboard assistant missing for project %s, recreating", projectid
                )
            except Exception as e:
                logger.warning(
                    "Backboard thread recreate failed for project %s: %s", projectid, e
                )

    # create new assistant + thread for this course
    assistant = await client.create_assistant(
        name=f"CopiumTutor Course {projectid}",
        description="Study tutor that generates flashcards/quizzes using course documents and memory.",
    )
    thread = await client.create_thread(assistant.assistant_id)

    # Convert UUIDs to strings BEFORE inserting into sqlite
    assistant_id = str(assistant.assistant_id)
    thread_id = str(thread.thread_id)

    db_cursor.execute(
        "INSERT OR REPLACE INTO backboard_projects (projectid, assistant_id, memory_thread_id) VALUES (?, ?, ?)",
        (projectid, assistant_id, thread_id),
    )
    db_cursor.execute("DELETE FROM indexed_files WHERE projectid=?", (projectid,))
    db_conn.commit()

    return client, assistant_id, thread_id


# endregion


# region Helper: UUID & Chat Title
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


def generate_chat_title_from_first_message(text: str) -> str:
    """
    Heuristic title generator (no extra LLM call):
    - strips code blocks/extra whitespace
    - takes a short, descriptive slice
    """
    if not text:
        return "New chat"

    t = text.strip()

    # Remove huge code blocks to avoid titles like "```"
    t = re.sub(r"```[\s\S]*?```", "", t).strip()

    # Collapse whitespace
    t = re.sub(r"\s+", " ", t).strip()

    # Remove leading filler
    t = re.sub(
        r"^(please|can you|could you|help me|i need|i want to)\s+",
        "",
        t,
        flags=re.IGNORECASE,
    ).strip()

    # Cap length
    if len(t) > 60:
        t = t[:60].rsplit(" ", 1)[0] + "…"

    # Titlecase-ish (but not screaming)
    # Keep acronyms like “AI”, “GPT”, etc.
    words = t.split(" ")
    words2 = []
    for w in words:
        if w.isupper() and len(w) <= 5:
            words2.append(w)
        else:
            words2.append(w[:1].upper() + w[1:])
    t = " ".join(words2)

    return t or "New chat"


# endregion


# region Helper: File & Ownership
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
    cursor.execute(
        """
        SELECT c.cardid, c.deckid, c.front, c.back
        FROM cards c
        JOIN decks d ON d.deckid = c.deckid
        WHERE c.cardid=? AND d.userid=?
    """,
        (cardid, userid),
    )
    return cursor.fetchone()


def _require_project_owned(projectid: str, userid: str) -> bool:
    cursor.execute(
        "SELECT 1 FROM projects WHERE projectid=? AND userid=?", (projectid, userid)
    )
    return cursor.fetchone() is not None


# endregion

# region App Settings
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

# endregion


# region Authentication
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


@app.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="session")
    return {"success": True, "message": "Logged out successfully"}


# endregion

# NOW API BS:
###############
# FILES
###############


# region Document Upload / Management
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


# endregion

###############
# PROJECTS / COURSES
###############


# region Projects
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


# Edit a project
@app.put("/projects/{projectid}")
async def edit_project(projectid: str, data: dict, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    # Check if project exists and belongs to user
    userid = session
    cursor.execute(
        "SELECT projectid FROM projects WHERE projectid=? AND userid=?",
        (projectid, userid),
    )
    if not cursor.fetchone():
        return {"success": False, "message": "Project not found or unauthorized"}

    # Get the information from the data dictionary:
    name = data.get("name")
    description = data.get("description", "")
    image = data.get("image", "")
    color = data.get("color", "")
    icon = data.get("icon", "")

    # Update the project
    cursor.execute(
        "UPDATE projects SET name=?, description=?, image=?, color=?, icon=? WHERE projectid=?",
        (name, description, image, color, icon, projectid),
    )
    conn.commit()

    return {"success": True, "message": "Project updated successfully"}


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


# endregion

###############
# DECKS
###############

# region Decks and Flashcards


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


# List all decks for user
@app.get("/decks")
async def list_all_decks(session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}

    userid = session
    cursor.execute(
        """
        SELECT d.deckid, d.projectid, d.name, d.prompt, d.createddate, p.name
        FROM decks d
        JOIN projects p ON p.projectid = d.projectid
        WHERE d.userid=?
        ORDER BY d.createddate DESC
        """,
        (userid,),
    )
    rows = cursor.fetchall()
    decks = [
        {
            "deckid": r[0],
            "projectid": r[1],
            "name": r[2],
            "prompt": r[3],
            "createddate": r[4],
            "project_name": r[5],
        }
        for r in rows
    ]
    return {"success": True, "decks": decks}


# Create a new deck in a project (QUERY ONLY — assumes documents already indexed)

# region Generation Prompt Templates
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

QUIZ_SYSTEM = """
You are an expert tutor generating quizzes from course documents.
Return ONLY valid JSON (no markdown, no commentary).
Always return the requested number of questions; never return an empty questions list.

Schema:
{
  "questions": [
    {
      "id": "q1",
      "type": "mcq|short|long",
      "question": "...",
      "choices": ["Option text A", "Option text B", "Option text C", "Option text D"] // for mcq only
    }
  ],
  "answers": {
    "q1": 0,           // mcq: index of correct choice
    "q2": "..."        // short/long: model answer
  },
  "explanations": {
    "q1": "..."
  }
}
Rules:
- Generate the requested number of questions exactly.
- Use ONLY the course documents already indexed in memory as the source of truth.
- For mcq: 4 choices, one correct; answers use 0-based index; choices must be full answer text (not labels like A/B/C/D).
""".strip()

# endregion


def _extract_json_object(raw: str) -> str | None:
    if raw is None:
        return None
    if not isinstance(raw, str):
        raw = str(raw)
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return raw[start : end + 1]


def _fix_unescaped_newlines(json_text: str) -> str:
    fixed = []
    in_string = False
    escaped = False
    for ch in json_text:
        if in_string:
            if ch in "\r\n":
                fixed.append("\\n")
                escaped = False
                continue
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
        else:
            if ch == '"':
                in_string = True
        fixed.append(ch)
    return "".join(fixed)


def _extract_questions_array(raw: str) -> list:
    if not isinstance(raw, str):
        return []
    key = '"questions"'
    key_idx = raw.find(key)
    if key_idx == -1:
        return []
    bracket_idx = raw.find("[", key_idx)
    if bracket_idx == -1:
        return []
    depth = 0
    for i in range(bracket_idx, len(raw)):
        if raw[i] == "[":
            depth += 1
        elif raw[i] == "]":
            depth -= 1
            if depth == 0:
                snippet = raw[bracket_idx : i + 1]
                try:
                    return json.loads(snippet)
                except json.JSONDecodeError:
                    try:
                        return json.loads(_fix_unescaped_newlines(snippet))
                    except json.JSONDecodeError:
                        return []
    return []


def _parse_quiz_payload(raw_text: str):
    json_text = _extract_json_object(raw_text) or raw_text
    try:
        return json.loads(json_text)
    except json.JSONDecodeError:
        try:
            return json.loads(_fix_unescaped_newlines(json_text))
        except json.JSONDecodeError:
            questions_only = _extract_questions_array(raw_text)
            if questions_only:
                return questions_only
            raise


def _safe_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_tokens(text: str) -> list[str]:
    if not text:
        return []
    return re.findall(r"[a-z0-9]+", text.lower())


def _token_overlap_ratio(expected: str, actual: str) -> float:
    expected_tokens = set(_normalize_tokens(expected))
    if not expected_tokens:
        return 0.0
    actual_tokens = set(_normalize_tokens(actual))
    matches = sum(1 for token in expected_tokens if token in actual_tokens)
    return matches / len(expected_tokens)


def _normalize_document_status(status):
    if status is None:
        return None
    value = getattr(status, "value", None)
    if value:
        return str(value).lower()
    return str(status).lower()


def _display_filename(filepath: str) -> str:
    if not filepath:
        return ""
    base = filepath.split("/")[-1]
    if "_" in base:
        return base.split("_", 1)[1]
    return base


async def _wait_for_thread_ready(
    client, thread_id: str, timeout_s: int = 900, interval_s: int = 2
):
    deadline = time.monotonic() + timeout_s
    last_statuses = []
    while True:
        try:
            docs = await client.list_thread_documents(thread_id)
            last_statuses = [
                _normalize_document_status(getattr(doc, "status", None)) for doc in docs
            ]
        except Exception:
            last_statuses = []

        if last_statuses and all(
            status in {"indexed", "failed"} for status in last_statuses
        ):
            return True, last_statuses

        if time.monotonic() >= deadline:
            return False, last_statuses

        await asyncio.sleep(interval_s)


def _set_quiz_status(
    db_cursor, db_conn, quizid: str, status: str, generation_error: str | None = None
):
    db_cursor.execute(
        "UPDATE quizzes SET status=?, generation_error=? WHERE quizid=?",
        (status, generation_error, quizid),
    )
    db_conn.commit()


def _set_quiz_payload(
    db_cursor,
    db_conn,
    quizid: str,
    questions_payload: dict,
    answer_key: dict,
    explanations: dict,
):
    num_questions = len(questions_payload.get("questions", []))
    db_cursor.execute(
        """
        UPDATE quizzes
        SET status=?, generation_error=?, questions_json=?, answer_key_json=?, explanations_json=?, num_questions=?
        WHERE quizid=?
        """,
        (
            "ready",
            None,
            json.dumps(questions_payload),
            json.dumps(answer_key),
            json.dumps(explanations),
            num_questions,
            quizid,
        ),
    )
    db_conn.commit()


async def _generate_quiz_content(
    quizid: str,
    projectid: str,
    userid: str,
    topic: str,
    quiz_type: str,
    num_questions: int,
    document_ids: list[str],
):
    local_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    local_cursor = local_conn.cursor()
    try:
        if not BACKBOARD_API_KEY:
            _set_quiz_status(
                local_cursor, local_conn, quizid, "failed", "BACKBOARD_API_KEY not set"
            )
            return

        if not document_ids:
            _set_quiz_status(
                local_cursor, local_conn, quizid, "failed", "No documents selected."
            )
            return

        placeholders = ",".join(["?"] * len(document_ids))
        local_cursor.execute(
            f"""
            SELECT COUNT(DISTINCT fileid)
            FROM indexed_files
            WHERE projectid=? AND fileid IN ({placeholders})
            """,
            (projectid, *document_ids),
        )
        count = local_cursor.fetchone()[0]
        if count != len(set(document_ids)):
            _set_quiz_status(
                local_cursor,
                local_conn,
                quizid,
                "failed",
                "Selected documents are not indexed yet. Go to the course page and click Index documents.",
            )
            return

        client, assistant_id, thread_id = await get_or_create_backboard_memory(
            projectid, db_cursor=local_cursor, db_conn=local_conn
        )

        try:
            docs = await client.list_thread_documents(thread_id)
        except Exception:
            docs = []

        if not docs:
            _set_quiz_status(
                local_cursor,
                local_conn,
                quizid,
                "failed",
                "No indexed documents found for this course. Click Index documents first.",
            )
            return

        logger.debug(
            "Quiz generation: thread %s has %d documents", thread_id, len(docs)
        )

        ready, statuses = await _wait_for_thread_ready(client, thread_id)
        if not ready:
            _set_quiz_status(
                local_cursor,
                local_conn,
                quizid,
                "failed",
                "Documents are still indexing. Try again soon.",
            )
            return

        local_cursor.execute(
            f"SELECT fileid, filepath FROM files WHERE fileid IN ({placeholders})",
            (*document_ids,),
        )
        file_rows = local_cursor.fetchall()
        selected_files = [
            _display_filename(row[1]) for row in file_rows if row and row[1]
        ]

        generation_prompt = f"""
Course: {projectid}
Quiz topic: {topic}
Quiz type: {quiz_type}
Number of questions: {num_questions}

Task:
Generate a quiz with the exact number of questions requested.
Prioritize these files: {", ".join(selected_files) if selected_files else "selected documents"}.
If needed, you may use any indexed course documents to complete the quiz.
""".strip()

        response = await client.add_message(
            thread_id=thread_id,
            content=QUIZ_SYSTEM + "\n\n" + generation_prompt,
            llm_provider="openai",
            model_name="gpt-4o",
            stream=False,
            memory="Auto",
        )

        raw = getattr(response, "content", response)
        raw_str = raw if isinstance(raw, str) else str(raw)
        logger.debug("Quiz raw response: %s", raw_str[:2000])
        payload = _parse_quiz_payload(raw_str)

        questions = []
        answer_key = {}
        explanations = {}
        if isinstance(payload, dict) or isinstance(payload, list):
            questions, answer_key, explanations = _normalize_quiz_payload(
                payload, quiz_type, num_questions
            )

        if not questions:
            retry_prompt = (
                generation_prompt
                + "\n\nReturn the JSON directly. Do not return an empty questions list."
            )
            response = await client.add_message(
                thread_id=thread_id,
                content=QUIZ_SYSTEM + "\n\n" + retry_prompt,
                llm_provider="openai",
                model_name="gpt-4o",
                stream=False,
                memory="Auto",
            )
            raw = getattr(response, "content", response)
            raw_str = raw if isinstance(raw, str) else str(raw)
            logger.debug("Quiz retry raw response: %s", raw_str[:2000])
            payload = _parse_quiz_payload(raw_str)
            if isinstance(payload, dict) or isinstance(payload, list):
                questions, answer_key, explanations = _normalize_quiz_payload(
                    payload, quiz_type, num_questions
                )

        if not questions:
            _set_quiz_status(
                local_cursor,
                local_conn,
                quizid,
                "failed",
                "No questions were generated. Try re-indexing documents.",
            )
            return

        _set_quiz_payload(
            local_cursor,
            local_conn,
            quizid,
            {"questions": questions},
            answer_key,
            explanations,
        )

    except Exception as e:
        logger.error("Quiz generation failed: %s", e)
        err_detail = f"{type(e).__name__}: {e}".strip()
        message = (
            f"Quiz generation failed ({err_detail})"
            if err_detail
            else "Quiz generation failed"
        )
        _set_quiz_status(local_cursor, local_conn, quizid, "failed", message)
    finally:
        local_conn.close()


def _normalize_choice_list(raw):
    if isinstance(raw, dict):
        items = list(raw.items())
        try:
            items.sort(key=lambda kv: str(kv[0]))
        except Exception:
            pass
        values = [str(v).strip() for _, v in items if str(v).strip()]
        if values:
            return values
        return [str(k).strip() for k, _ in items if str(k).strip()]
    if isinstance(raw, list):
        cleaned = []
        for choice in raw:
            if isinstance(choice, dict):
                value = (
                    choice.get("text")
                    or choice.get("option")
                    or choice.get("choice")
                    or choice.get("label")
                    or choice.get("value")
                )
                if value is None and len(choice) == 1:
                    value = next(iter(choice.values()))
                if value is None:
                    continue
                cleaned.append(str(value).strip())
            else:
                cleaned.append(str(choice).strip())
        return [c for c in cleaned if c]
    if isinstance(raw, str):
        for sep in ("\n", ";", ","):
            parts = [p.strip() for p in raw.split(sep) if p.strip()]
            if len(parts) >= 2:
                return parts
        return [raw.strip()] if raw.strip() else []
    return []


def _mcq_answer_to_index(answer, choices):
    if answer is None or not choices:
        return None
    if isinstance(answer, (int, float)):
        idx = int(answer)
        if 0 <= idx < len(choices):
            return idx
        if 1 <= idx <= len(choices):
            return idx - 1
    answer_text = str(answer).strip()
    if not answer_text:
        return None
    first = answer_text[0].upper()
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if first in letters:
        idx = letters.index(first)
        if idx < len(choices):
            return idx
    for i, choice in enumerate(choices):
        if answer_text.lower() == str(choice).strip().lower():
            return i
    return None


def _answer_from_question(question: dict):
    for key in (
        "answer",
        "correct",
        "correct_answer",
        "correctAnswer",
        "correct_index",
        "correctIndex",
        "correct_choice",
        "correctChoice",
    ):
        if key in question:
            return question.get(key)
    return None


def _explanation_from_question(question: dict):
    for key in ("explanation", "rationale", "reasoning", "feedback"):
        if key in question:
            return question.get(key)
    return None


def _normalize_quiz_payload(payload, quiz_type: str, num_questions: int):
    if isinstance(payload, list):
        questions_in = payload
        answers_in = {}
        explanations_in = {}
    elif isinstance(payload, dict):
        questions_in = payload.get("questions") or payload.get("items") or []
        answers_in = (
            payload.get("answers")
            or payload.get("answer_key")
            or payload.get("answerKey")
            or {}
        )
        explanations_in = (
            payload.get("explanations") or payload.get("explanation") or {}
        )
        nested = payload.get("quiz") or payload.get("data") or {}
        if not questions_in and isinstance(nested, dict):
            questions_in = nested.get("questions") or nested.get("items") or []
        if not answers_in and isinstance(nested, dict):
            answers_in = (
                nested.get("answers")
                or nested.get("answer_key")
                or nested.get("answerKey")
                or {}
            )
        if not explanations_in and isinstance(nested, dict):
            explanations_in = (
                nested.get("explanations") or nested.get("explanation") or {}
            )
    else:
        questions_in = []
        answers_in = {}
        explanations_in = {}

    if isinstance(answers_in, list):
        answers_map = {
            str(a.get("id")): a.get("answer")
            for a in answers_in
            if isinstance(a, dict) and a.get("id") is not None
        }
    elif isinstance(answers_in, dict):
        answers_map = answers_in
    else:
        answers_map = {}

    if isinstance(explanations_in, list):
        explanations_map = {
            str(e.get("id")): e.get("explanation")
            for e in explanations_in
            if isinstance(e, dict) and e.get("id") is not None
        }
    elif isinstance(explanations_in, dict):
        explanations_map = explanations_in
    else:
        explanations_map = {}

    questions = []
    answer_key = {}
    explanations = {}
    source_map = {}

    for idx, q in enumerate(questions_in):
        if not isinstance(q, dict):
            continue
        qid = str(q.get("id") or f"q{idx + 1}")
        prompt = (q.get("question") or q.get("prompt") or "").strip()
        if not prompt:
            continue

        item = {"id": qid, "type": quiz_type, "question": prompt}
        if quiz_type == "mcq":
            choices_raw = q.get("choices") or q.get("options") or q.get("options_list")
            choices = _normalize_choice_list(choices_raw)
            if len(choices) < 2:
                continue
            item["choices"] = choices[:4]

        questions.append(item)
        source_map[qid] = q
        if len(questions) >= num_questions:
            break

    for q in questions:
        qid = q["id"]
        if quiz_type == "mcq":
            answer_value = answers_map.get(qid)
            if answer_value is None:
                answer_value = _answer_from_question(source_map.get(qid, {}))
            idx_value = _mcq_answer_to_index(answer_value, q.get("choices", []))
            if idx_value is None:
                idx_value = 0
            answer_key[qid] = idx_value
        else:
            answer_text = answers_map.get(qid)
            if answer_text is None:
                answer_text = _answer_from_question(source_map.get(qid, {}))
            answer_key[qid] = (
                str(answer_text).strip() if answer_text is not None else ""
            )

        explanation = explanations_map.get(qid)
        if explanation is None:
            explanation = _explanation_from_question(source_map.get(qid, {}))
        explanations[qid] = str(explanation).strip() if explanation is not None else ""

    return questions, answer_key, explanations


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
async def create_deck(
    projectid: str, body: CreateDeckRequest, session: str = Cookie(None)
):
    print("\n" + "=" * 80)
    print(f"[CREATE_DECK] projectid={projectid}")
    print(f"[DECK NAME] {body.name}")
    print(f"[USER PROMPT] {body.prompt}")

    if session is None:
        print("[AUTH] ❌ Unauthorized")
        return {"success": False, "message": "Unauthorized"}
    userid = session
    print(f"[AUTH] ✅ userid={userid}")

    cursor.execute(
        "SELECT 1 FROM projects WHERE projectid=? AND userid=?", (projectid, userid)
    )
    if cursor.fetchone() is None:
        print("[PROJECT] ❌ Project not found or not owned by user")
        return {"success": False, "message": "Project not found"}
    print("[PROJECT] ✅ Ownership verified")

    deckid = uuid.uuid4().hex[:8]
    createddate = datetime.now(dt.UTC).isoformat()

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
            + FLASHCARDS_SYSTEM
            + "\n\n"
            + user_prompt,
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

        cleaned.append(
            {"front": front, "back": back, "external": external, "note": note}
        )

    while len(cleaned) < 10:
        cleaned.append(
            {
                "front": f"Key idea #{len(cleaned) + 1}",
                "back": "Write a concise explanation and one example from your notes.",
                "external": True,
                "note": "General study template (not found in course docs).",
            }
        )
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
    cursor.execute(
        """
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
    """,
        (deckid,),
    )

    rows = cursor.fetchall()

    cards = []
    for r in rows:
        cards.append(
            {
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
            }
        )

    return {"success": True, "deck": deck, "cards": cards}


@app.delete("/decks/{deckid}")
async def delete_deck(deckid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    # Verify deck belongs to this user
    cursor.execute(
        "SELECT projectid FROM decks WHERE deckid=? AND userid=?", (deckid, userid)
    )
    row = cursor.fetchone()
    if row is None:
        return {"success": False, "message": "Deck not found"}

    # Delete cards first (safe even without foreign keys)
    cursor.execute("DELETE FROM cards WHERE deckid=?", (deckid,))
    cursor.execute("DELETE FROM decks WHERE deckid=?", (deckid,))
    conn.commit()

    return {"success": True, "deleted_deckid": deckid}


# endregion

###############
# QUIZZES
###############

# region Quizzes


@app.get("/projects/{projectid}/quizzes")
async def list_quizzes(projectid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    cursor.execute(
        "SELECT 1 FROM projects WHERE projectid=? AND userid=?", (projectid, userid)
    )
    if cursor.fetchone() is None:
        return {"success": False, "message": "Project not found"}

    cursor.execute(
        """
        SELECT quizid, title, topic, quiz_type, num_questions, status, generation_error, createddate
        FROM quizzes
        WHERE projectid=? AND userid=?
        ORDER BY createddate DESC
        """,
        (projectid, userid),
    )
    rows = cursor.fetchall()
    quizzes = [
        {
            "quizid": r[0],
            "title": r[1],
            "topic": r[2],
            "quiz_type": r[3],
            "num_questions": r[4],
            "status": r[5],
            "generation_error": r[6],
            "createddate": r[7],
        }
        for r in rows
    ]

    return {"success": True, "quizzes": quizzes}


@app.get("/quizzes")
async def list_all_quizzes(session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    cursor.execute(
        """
        SELECT q.quizid, q.projectid, q.title, q.topic, q.quiz_type, q.num_questions,
               q.status, q.generation_error, q.createddate, p.name
        FROM quizzes q
        JOIN projects p ON p.projectid = q.projectid
        WHERE q.userid=?
        ORDER BY q.createddate DESC
        """,
        (userid,),
    )
    rows = cursor.fetchall()
    quizzes = [
        {
            "quizid": r[0],
            "projectid": r[1],
            "title": r[2],
            "topic": r[3],
            "quiz_type": r[4],
            "num_questions": r[5],
            "status": r[6],
            "generation_error": r[7],
            "createddate": r[8],
            "project_name": r[9],
        }
        for r in rows
    ]
    return {"success": True, "quizzes": quizzes}


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
    cursor.execute(
        "SELECT COALESCE(MAX(position), 0) FROM cards WHERE deckid=?", (deckid,)
    )
    max_pos = cursor.fetchone()[0] or 0
    pos = int(max_pos) + 1

    cardid = uuid.uuid4().hex[:8]
    createddate = datetime.now(dt.UTC).isoformat()

    # initial scheduling defaults
    due_at = datetime.now(dt.UTC).isoformat()
    interval_days = 0.0
    ease = 2.5
    reps = 0
    lapses = 0
    last_reviewed_at = None

    cursor.execute(
        """
        INSERT INTO cards (
            cardid, deckid, front, back, position,
            due_at, interval_days, ease, reps, lapses, last_reviewed_at, createddate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            cardid,
            deckid,
            front,
            back,
            pos,
            due_at,
            interval_days,
            ease,
            reps,
            lapses,
            last_reviewed_at,
            createddate,
        ),
    )
    conn.commit()

    return {
        "success": True,
        "card": {
            "cardid": cardid,
            "deckid": deckid,
            "front": front,
            "back": back,
            "position": pos,
        },
    }


@app.post("/projects/{projectid}/quizzes")
async def create_quiz(
    projectid: str, body: CreateQuizRequest, session: str = Cookie(None)
):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    cursor.execute(
        "SELECT 1 FROM projects WHERE projectid=? AND userid=?", (projectid, userid)
    )
    if cursor.fetchone() is None:
        return {"success": False, "message": "Project not found"}

    topic = (body.topic or "").strip()
    quiz_type = (body.quiz_type or "").strip().lower()
    num_questions = int(body.num_questions or 0)
    document_ids = body.document_ids or []

    if not topic:
        return {"success": False, "message": "topic is required"}
    if quiz_type not in {"mcq", "short", "long"}:
        return {
            "success": False,
            "message": "quiz_type must be one of: mcq, short, long",
        }
    if num_questions <= 0 or num_questions > 50:
        return {"success": False, "message": "num_questions must be between 1 and 50"}

    # If no document_ids supplied, default to all documents in the project
    if not document_ids:
        cursor.execute(
            """
            SELECT documentid
            FROM documents
            WHERE projectid=? AND userid=?
            """,
            (projectid, userid),
        )
        document_ids = [r[0] for r in cursor.fetchall()]

    if not document_ids:
        return {"success": False, "message": "No documents available for this course"}

    quizid = uuid.uuid4().hex[:8]
    createddate = datetime.now(dt.UTC).isoformat()
    title = f"{topic} ({quiz_type.upper()})"

    cursor.execute(
        """
        INSERT INTO quizzes (
            quizid, projectid, userid, title, topic, quiz_type, num_questions,
            document_ids_json, questions_json, answer_key_json, explanations_json,
            status, generation_error, createddate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            quizid,
            projectid,
            userid,
            title,
            topic,
            quiz_type,
            num_questions,
            json.dumps(document_ids),
            json.dumps({"questions": []}),
            json.dumps({}),
            json.dumps({}),
            "pending",
            None,
            createddate,
        ),
    )
    conn.commit()

    asyncio.create_task(
        _generate_quiz_content(
            quizid=quizid,
            projectid=projectid,
            userid=userid,
            topic=topic,
            quiz_type=quiz_type,
            num_questions=num_questions,
            document_ids=document_ids,
        )
    )

    return {
        "success": True,
        "quiz": {
            "quizid": quizid,
            "projectid": projectid,
            "title": title,
            "topic": topic,
            "quiz_type": quiz_type,
            "num_questions": num_questions,
            "document_ids": document_ids,
            "status": "pending",
            "generation_error": None,
            "createddate": createddate,
        },
    }


@app.get("/quizzes/{quizid}")
async def get_quiz(quizid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    cursor.execute(
        """
        SELECT quizid, projectid, title, topic, quiz_type, num_questions,
               questions_json, status, generation_error, createddate
        FROM quizzes
        WHERE quizid=? AND userid=?
        """,
        (quizid, userid),
    )
    row = cursor.fetchone()
    if row is None:
        return {"success": False, "message": "Quiz not found"}

    try:
        questions_payload = json.loads(row[6] or "{}")
    except json.JSONDecodeError:
        questions_payload = {"questions": []}

    quiz = {
        "quizid": row[0],
        "projectid": row[1],
        "title": row[2],
        "topic": row[3],
        "quiz_type": row[4],
        "num_questions": row[5],
        "status": row[7],
        "generation_error": row[8],
        "createddate": row[9],
    }
    questions = questions_payload.get("questions", [])

    return {"success": True, "quiz": quiz, "questions": questions}


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


@app.post("/quizzes/{quizid}/generate")
async def generate_quiz(quizid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    cursor.execute(
        """
        SELECT quizid, projectid, userid, topic, quiz_type, num_questions, document_ids_json
        FROM quizzes
        WHERE quizid=? AND userid=?
        """,
        (quizid, userid),
    )
    row = cursor.fetchone()
    if row is None:
        return {"success": False, "message": "Quiz not found"}

    try:
        document_ids = json.loads(row[6] or "[]")
        if not isinstance(document_ids, list):
            document_ids = []
    except json.JSONDecodeError:
        document_ids = []

    # kick off async generation
    asyncio.create_task(
        _generate_quiz_content(
            quizid=row[0],
            projectid=row[1],
            userid=row[2],
            topic=row[3],
            quiz_type=row[4],
            num_questions=row[5],
            document_ids=document_ids,
        )
    )

    return {"success": True}


@app.post("/cards/{cardid}/review")
async def review_card(
    cardid: str, body: ReviewCardRequest, session: str = Cookie(None)
):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    cursor.execute(
        """
        SELECT c.deckid, c.due_at, c.interval_days, c.ease, c.reps, c.lapses
        FROM cards c
        JOIN decks d ON d.deckid = c.deckid
        WHERE c.cardid=? AND d.userid=?
        """,
        (cardid, userid),
    )
    row = cursor.fetchone()
    if row is None:
        return {"success": False, "message": "Card not found"}

    deckid, due_at, interval_days, ease, reps, lapses = row

    ease = float(ease) if ease is not None else 2.5
    interval_days = float(interval_days) if interval_days is not None else 0.0
    reps = int(reps) if reps is not None else 0
    lapses = int(lapses) if lapses is not None else 0

    rating = body.rating
    now = datetime.now(dt.UTC)

    # Simple Anki-ish rules
    if rating == "again":
        ease = max(1.3, ease - 0.2)
        interval_days = 0.02  # ~30 minutes
        lapses += 1
    elif rating == "hard":
        ease = max(1.3, ease - 0.15)
        interval_days = 0.5 if reps == 0 else max(0.5, interval_days * 1.2)
        reps += 1
    elif rating == "good":
        interval_days = 1.0 if reps == 0 else max(1.0, interval_days * ease)
        reps += 1
    elif rating == "easy":
        ease = min(3.0, ease + 0.15)
        interval_days = 2.0 if reps == 0 else max(2.0, interval_days * ease * 1.3)
        reps += 1

    due_at = (now + timedelta(days=interval_days)).isoformat()
    last_reviewed_at = now.isoformat()

    cursor.execute(
        """
        UPDATE cards
        SET due_at=?, interval_days=?, ease=?, reps=?, lapses=?, last_reviewed_at=?
        WHERE cardid=?
        """,
        (due_at, interval_days, ease, reps, lapses, last_reviewed_at, cardid),
    )
    conn.commit()

    return {
        "success": True,
        "cardid": cardid,
        "deckid": deckid,
        "due_at": due_at,
        "interval_days": interval_days,
        "ease": ease,
        "reps": reps,
        "lapses": lapses,
        "rating": rating,
    }


@app.post("/quizzes/{quizid}/submit")
async def submit_quiz(
    quizid: str, body: SubmitQuizRequest, session: str = Cookie(None)
):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    cursor.execute(
        """
        SELECT quiz_type, questions_json, answer_key_json, explanations_json
        FROM quizzes
        WHERE quizid=? AND userid=?
        """,
        (quizid, userid),
    )
    row = cursor.fetchone()
    if row is None:
        return {"success": False, "message": "Quiz not found"}

    quiz_type = row[0]
    try:
        questions_payload = json.loads(row[1] or "{}")
    except json.JSONDecodeError:
        questions_payload = {"questions": []}
    try:
        answer_key = json.loads(row[2] or "{}")
    except json.JSONDecodeError:
        answer_key = {}
    try:
        explanations = json.loads(row[3] or "{}")
    except json.JSONDecodeError:
        explanations = {}

    questions = questions_payload.get("questions", [])
    answers = body.answers if isinstance(body.answers, dict) else {}

    feedback = {}
    score = 0

    for q in questions:
        if not isinstance(q, dict):
            continue
        qid = q.get("id")
        if qid is None:
            continue
        qid = str(qid)

        expected = answer_key.get(qid)
        response = answers.get(qid)
        explanation = explanations.get(qid, "")

        if quiz_type == "mcq":
            expected_idx = _safe_int(expected, default=None)
            response_idx = _safe_int(response, default=None)
            correct = (
                response_idx is not None
                and expected_idx is not None
                and response_idx == expected_idx
            )
        else:
            expected_text = str(expected or "").strip()
            response_text = str(response or "").strip()
            ratio = _token_overlap_ratio(expected_text, response_text)
            threshold = 0.6 if quiz_type == "short" else 0.4
            correct = ratio >= threshold
            expected = expected_text
            response = response_text

        if correct:
            score += 1

        feedback[qid] = {
            "correct": bool(correct),
            "expected": expected,
            "response": response,
            "explanation": explanation,
        }

    attemptid = uuid.uuid4().hex[:8]
    createddate = datetime.now(dt.UTC).isoformat()
    cursor.execute(
        """
        INSERT INTO attempts (attemptid, quizid, userid, answers_json, score, feedback_json, createddate)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            attemptid,
            quizid,
            userid,
            json.dumps(answers),
            score,
            json.dumps(feedback),
            createddate,
        ),
    )
    conn.commit()

    return {"success": True, "score": score, "feedback": feedback}


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

    try:
        return await index_project_documents_impl(
            projectid=projectid,
            userid=userid,
            cursor=cursor,
            conn=conn,
            client_factory=None,  # optional
            get_memory=get_or_create_backboard_memory,
        )
    except BackboardServerError as e:
        logger.error("Backboard indexing failed: %s", e)
        return {
            "success": False,
            "message": "Backboard service unavailable. Please try again shortly.",
        }


# endregion

################################
# CHAT SESSIONS (per course)
################################

# region Chat Sessions


# List all chats for user
@app.get("/chats")
async def list_all_chats(session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    cursor.execute(
        """
        SELECT c.chatid, c.projectid, c.title, c.llm_provider, c.model_name, c.created_at, c.updated_at, p.name
        FROM chat_sessions c
        JOIN projects p ON p.projectid = c.projectid
        WHERE c.userid=?
        ORDER BY c.updated_at DESC
    """,
        (userid,),
    )
    rows = cursor.fetchall()
    chats = [
        {
            "chatid": r[0],
            "projectid": r[1],
            "title": r[2],
            "llm_provider": r[3],
            "model_name": r[4],
            "created_at": r[5],
            "updated_at": r[6],
            "project_name": r[7],
        }
        for r in rows
    ]

    return {"success": True, "chats": chats}


# List chats in a project
@app.get("/projects/{projectid}/chats")
async def list_chats(projectid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    if not _require_project_owned(projectid, userid):
        return {"success": False, "message": "Project not found"}

    cursor.execute(
        """
        SELECT chatid, title, llm_provider, model_name, created_at, updated_at
        FROM chat_sessions
        WHERE projectid=? AND userid=?
        ORDER BY updated_at DESC
    """,
        (projectid, userid),
    )

    rows = cursor.fetchall()
    chats = [
        {
            "chatid": r[0],
            "title": r[1],
            "llm_provider": r[2],
            "model_name": r[3],
            "created_at": r[4],
            "updated_at": r[5],
        }
        for r in rows
    ]

    return {"success": True, "chats": chats}


# Create new chat in a project
@app.post("/projects/{projectid}/chats")
async def create_chat(
    projectid: str, body: CreateChatRequest, session: str = Cookie(None)
):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    if not _require_project_owned(projectid, userid):
        return {"success": False, "message": "Project not found"}

    chatid = uuid.uuid4().hex[:10]
    now = datetime.now(dt.UTC).isoformat()

    title = (body.title or "").strip() or "New chat"
    llm_provider = (body.llm_provider or "openai").strip()
    model_name = (body.model_name or "gpt-4o").strip()

    cursor.execute(
        """
        INSERT INTO chat_sessions (chatid, projectid, userid, title, llm_provider, model_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (chatid, projectid, userid, title, llm_provider, model_name, now, now),
    )
    conn.commit()

    return {
        "success": True,
        "chat": {
            "chatid": chatid,
            "projectid": projectid,
            "title": title,
            "llm_provider": llm_provider,
            "model_name": model_name,
            "created_at": now,
            "updated_at": now,
        },
    }


# Get chat details and messages
@app.get("/chats/{chatid}")
async def get_chat(chatid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    cursor.execute(
        """
        SELECT chatid, projectid, title, llm_provider, model_name, created_at, updated_at
        FROM chat_sessions
        WHERE chatid=? AND userid=?
    """,
        (chatid, userid),
    )
    row = cursor.fetchone()
    if row is None:
        return {"success": False, "message": "Chat not found"}

    chat = {
        "chatid": row[0],
        "projectid": row[1],
        "title": row[2],
        "llm_provider": row[3],
        "model_name": row[4],
        "created_at": row[5],
        "updated_at": row[6],
    }

    cursor.execute(
        """
        SELECT msgid, role, content, created_at
        FROM chat_messages
        WHERE chatid=?
        ORDER BY created_at ASC
    """,
        (chatid,),
    )
    msgs = cursor.fetchall()

    messages = [
        {
            "msgid": m[0],
            "role": m[1],
            "content": m[2],
            "created_at": m[3],
        }
        for m in msgs
    ]

    return {"success": True, "chat": chat, "messages": messages}


# Rename chat
@app.patch("/chats/{chatid}")
async def rename_chat(
    chatid: str, body: RenameChatRequest, session: str = Cookie(None)
):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    title = (body.title or "").strip()
    if not title:
        return {"success": False, "message": "Title cannot be empty"}

    cursor.execute(
        "SELECT 1 FROM chat_sessions WHERE chatid=? AND userid=?", (chatid, userid)
    )
    if cursor.fetchone() is None:
        return {"success": False, "message": "Chat not found"}

    now = datetime.now(dt.UTC).isoformat()
    cursor.execute(
        """
        UPDATE chat_sessions
        SET title=?, updated_at=?
        WHERE chatid=? AND userid=?
    """,
        (title, now, chatid, userid),
    )
    conn.commit()

    return {"success": True, "chatid": chatid, "title": title, "updated_at": now}


# Delete chat
@app.delete("/chats/{chatid}")
async def delete_chat(chatid: str, session: str = Cookie(None)):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    cursor.execute(
        "SELECT 1 FROM chat_sessions WHERE chatid=? AND userid=?", (chatid, userid)
    )
    if cursor.fetchone() is None:
        return {"success": False, "message": "Chat not found"}

    cursor.execute("DELETE FROM chat_messages WHERE chatid=?", (chatid,))
    cursor.execute(
        "DELETE FROM chat_sessions WHERE chatid=? AND userid=?", (chatid, userid)
    )
    conn.commit()

    return {"success": True, "deleted": True, "chatid": chatid}


# -----------------------
# CHAT MESSAGES
# -----------------------

CHAT_SYSTEM = """
You are Copium Tutor: a smart teaching assistant for this course.

Goals:
- Help the student understand assignments, problems, and concepts.
- Be rigorous and clear. Show steps.
- If course documents are relevant, prioritize them.
- You are allowed to use external knowledge as well.
- Always be friendly and encouraging.
- If you are unsure, ask a focused follow-up question.
- When helpful, give a short answer first, then a deeper explanation. Please don't make it too lengthy.

Style:
- Use headings and bullet points.
- Provide small examples when relevant.
""".strip()


@app.post("/chats/{chatid}/messages")
async def send_chat_message(
    chatid: str,
    body: SendChatMessageRequest,
    session: str = Cookie(None),
):
    if session is None:
        return {"success": False, "message": "Unauthorized"}
    userid = session

    content = (body.content or "").strip()
    if not content:
        return {"success": False, "message": "Message cannot be empty"}

    # Load chat session + project
    cursor.execute(
        """
        SELECT projectid, title, llm_provider, model_name
        FROM chat_sessions
        WHERE chatid=? AND userid=?
        """,
        (chatid, userid),
    )
    row = cursor.fetchone()
    if row is None:
        return {"success": False, "message": "Chat not found"}

    projectid, chat_title, saved_provider, saved_model = row

    # Ensure project ownership
    if not _require_project_owned(projectid, userid):
        return {"success": False, "message": "Project not found"}

    # Is this the first message in this chat?
    cursor.execute("SELECT COUNT(*) FROM chat_messages WHERE chatid=?", (chatid,))
    msg_count = cursor.fetchone()[0] or 0
    is_first_message = msg_count == 0

    # Only auto-title if title still looks like a placeholder
    should_autotitle = (chat_title or "").strip().lower() in {
        "",
        "new chat",
        "untitled",
        "chat",
    }

    # Allow per-message override, otherwise use saved chat model
    llm_provider = (body.llm_provider or saved_provider or "openai").strip()
    model_name = (body.model_name or saved_model or "gpt-4o").strip()

    # Store user message
    now = datetime.now(dt.UTC).isoformat()
    user_msgid = uuid.uuid4().hex[:10]
    cursor.execute(
        """
        INSERT INTO chat_messages (msgid, chatid, role, content, created_at)
        VALUES (?, ?, 'user', ?, ?)
        """,
        (user_msgid, chatid, content, now),
    )
    conn.commit()

    # Get assistant response (course-level memory: one thread per project)
    assistant_text = ""
    if not BACKBOARD_API_KEY:
        assistant_text = "BACKBOARD_API_KEY not set, so I can't answer yet."
    else:
        client, assistant_id, thread_id = await get_or_create_backboard_memory(
            projectid
        )

        # Keep memory structured by chat title
        prompt = f"[Chat: {chat_title}] {content}"

        resp = await client.add_message(
            thread_id=thread_id,
            content=CHAT_SYSTEM + "\n\n" + prompt,
            llm_provider=llm_provider,
            model_name=model_name,
            stream=False,
            memory="Readwrite",
        )
        assistant_text = getattr(resp, "content", resp)
        if not isinstance(assistant_text, str):
            assistant_text = str(assistant_text)

    # Store assistant message
    now2 = datetime.now(dt.UTC).isoformat()
    assistant_msgid = uuid.uuid4().hex[:10]
    cursor.execute(
        """
        INSERT INTO chat_messages (msgid, chatid, role, content, created_at)
        VALUES (?, ?, 'assistant', ?, ?)
        """,
        (assistant_msgid, chatid, assistant_text, now2),
    )

    # Update chat metadata (and persist model changes)
    cursor.execute(
        """
        UPDATE chat_sessions
        SET updated_at=?, llm_provider=?, model_name=?
        WHERE chatid=? AND userid=?
        """,
        (now2, llm_provider, model_name, chatid, userid),
    )

    # Auto-title on first message
    new_title = None
    if is_first_message and should_autotitle:
        new_title = generate_chat_title_from_first_message(content)
        cursor.execute(
            """
            UPDATE chat_sessions
            SET title=?, updated_at=?
            WHERE chatid=? AND userid=?
            """,
            (new_title, now2, chatid, userid),
        )
        chat_title = new_title

    conn.commit()

    return {
        "success": True,
        "chatid": chatid,
        "chat_title": chat_title,  # NEW: frontend can update header/sidebar immediately
        "llm_provider": llm_provider,
        "model_name": model_name,
        "messages": [
            {
                "msgid": user_msgid,
                "role": "user",
                "content": content,
                "created_at": now,
            },
            {
                "msgid": assistant_msgid,
                "role": "assistant",
                "content": assistant_text,
                "created_at": now2,
            },
        ],
    }


# endregion
