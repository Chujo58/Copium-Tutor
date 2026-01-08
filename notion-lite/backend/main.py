import base64, hashlib, re, secrets, time, sqlite3, os, bcrypt
from dataclasses import dataclass
from fastapi import FastAPI, UploadFile, File, Form, Response, Cookie
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import datetime as dt

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


# Allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# Login
@app.post("/login")
async def login(data: dict, response: Response):
    email = data.get("email")
    password = data.get("password")
    cursor.execute("SELECT userid, hashed_password FROM users WHERE email=?", (email,))
    row = cursor.fetchone()

    stored_password = row[1] if row else None
    if stored_password is None:
        return {"success": False, "message": "Invalid email or password"}

    try:
        if not bcrypt.checkpw(password.encode("utf-8"), stored_password):
            return {"success": False, "message": "Invalid email or password"}
    except ValueError:
        return {"success": False, "message": "Invalid email or password"}

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

    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
        file_size = len(content)

    file_type = file.content_type

    cursor.execute(
        "INSERT INTO files (fileid, filepath, upload_date, file_size, file_type) VALUES (?, ?, ?, ?, ?)",
        (fileid, filepath, upload_date, file_size, file_type),
    )
    cursor.execute(
        "INSERT INTO fileinproj (fileid, projectid) VALUES (?, ?)",
        (fileid, projectid),
    )
    conn.commit()

    return {"success": True, "fileid": fileid, "message": "File uploaded successfully"}


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
