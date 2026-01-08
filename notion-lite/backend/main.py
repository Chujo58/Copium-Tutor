from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil, json, time, hashlib, base64, re, secrets
from datetime import datetime
import datetime as dt
from dataclasses import dataclass


@dataclass
class FileMeta:
    fileid: str
    filepath: str
    projects: list[str]
    upload_date: str
    file_size: int
    file_type: str


@dataclass
class ProjectMeta:
    projectid: str
    name: str
    description: str
    created_date: str
    userid: str


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


app = FastAPI()

# Allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.post("/upload")
async def upload_file(file: UploadFile = File(...), project: str = Form(...)):
    file_db = json.load(open("db/files.json", "r"))
    filetype = file.content_type
    file_size = file.size or 0  # size might be None
    upload_date = datetime.now(tz=dt.UTC).strftime("%Y-%m-%d %H:%M:%S")

    filepath = os.path.join(UPLOAD_DIR, file.filename)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    metadata = FileMeta(
        fileid=gen_uuid(),
        filepath=filepath,
        projects=[project],
        upload_date=upload_date,
        file_size=file_size,
        file_type=filetype,
    )

    file_db[metadata.fileid] = metadata.__dict__
    with open("db/files.json", "w") as f:
        json.dump(file_db, f, indent=4)
    return {"status": "success", "fileid": metadata.fileid, "filepath": filepath}


@app.get("/files")
async def list_files():
    file_db = json.load(open("db/files.json", "r"))
    return file_db


@app.get("/files/{fileid}")
async def get_file(fileid: str):
    file_db = json.load(open("db/files.json", "r"))
    if fileid in file_db:
        return file_db[fileid]
    return {"error": "File not found"}


@app.delete("/files/{fileid}")
async def delete_file(fileid: str):
    file_db = json.load(open("db/files.json", "r"))
    if fileid not in file_db:
        return {"error": "File not found"}

    filepath = file_db[fileid]["filepath"]
    if os.path.exists(filepath):
        os.remove(filepath)
    del file_db[fileid]
    with open("db/files.json", "w") as f:
        json.dump(file_db, f, indent=4)
    return {"status": "deleted"}


@app.get("/projects")
async def list_projects():
    project_db = json.load(open("db/projects.json", "r"))
    return project_db
