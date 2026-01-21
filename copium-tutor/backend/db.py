import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()


def _add_column_if_missing(table: str, col: str, coldef: str):
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [r[1] for r in cursor.fetchall()]
    if col not in cols:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {coldef}")
        conn.commit()


def init_db():
    # users: one row per user
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (userid TEXT PRIMARY KEY, fname TEXT, lname TEXT, email TEXT, password TEXT, pfp TEXT)
    """)

    # files: one row per uploaded file
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS files (fileid TEXT PRIMARY KEY, filepath TEXT, uploadeddate INTEGER, filesize INTEGER, filetype TEXT)""")

    # fileinproj: mapping table between files and projects (courses)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fileinproj (projectid TEXT, fileid TEXT, PRIMARY KEY (projectid, fileid), FOREIGN KEY (fileid) REFERENCES files(fileid) ON DELETE CASCADE, FOREIGN KEY (projectid) REFERENCES projects(projectid) ON DELETE CASCADE)
    """)

    # projects: one row per course
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (projectid TEXT PRIMARY KEY, userid TEXT NOT NULL, name TEXT NOT NULL, description TEXT, createddate INTEGER, image TEXT, color TEXT, icon TEXT, FOREIGN KEY (userid) REFERENCES users(userid) ON DELETE CASCADE)
    """)

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
    back TEXT NOT NULL,
    position INTEGER,

    due_at TEXT,
    interval_days REAL,
    ease REAL,
    reps INTEGER,
    lapses INTEGER,
    last_reviewed_at TEXT
    )
    """)

    _add_column_if_missing("cards", "position", "INTEGER")
    _add_column_if_missing("cards", "due_at", "TEXT")
    _add_column_if_missing("cards", "interval_days", "REAL")
    _add_column_if_missing("cards", "ease", "REAL")
    _add_column_if_missing("cards", "reps", "INTEGER")
    _add_column_if_missing("cards", "lapses", "INTEGER")
    _add_column_if_missing("cards", "last_reviewed_at", "TEXT")

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

    # chat_sessions: one row per chat "thread" shown in the left sidebar (per course)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_sessions (
        chatid TEXT PRIMARY KEY,
        projectid TEXT NOT NULL,
        userid TEXT NOT NULL,
        title TEXT NOT NULL,
        llm_provider TEXT NOT NULL DEFAULT 'openai',
        model_name TEXT NOT NULL DEFAULT 'gpt-4o',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    # chat_messages: message history for a given chat session
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_messages (
        msgid TEXT PRIMARY KEY,
        chatid TEXT NOT NULL,
        role TEXT NOT NULL,               -- 'user' | 'assistant' | 'system'
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    # quizzes: one row per quiz created inside a course (project)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quizzes (
        quizid TEXT PRIMARY KEY,
        projectid TEXT NOT NULL,
        userid TEXT NOT NULL,
        title TEXT NOT NULL,
        topic TEXT NOT NULL,
        quiz_type TEXT NOT NULL,
        num_questions INTEGER NOT NULL,
        document_ids_json TEXT,
        questions_json TEXT,
        answer_key_json TEXT,
        explanations_json TEXT,
        status TEXT,
        generation_error TEXT,
        createddate TEXT NOT NULL
    )
    """)

    # attempts: one row per quiz submission
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attempts (
        attemptid TEXT PRIMARY KEY,
        quizid TEXT NOT NULL,
        userid TEXT NOT NULL,
        answers_json TEXT,
        score INTEGER,
        feedback_json TEXT,
        createddate TEXT NOT NULL
    )
    """)

    # basic migrations for quizzes table
    cursor.execute("PRAGMA table_info(quizzes)")
    quiz_cols = {row[1] for row in cursor.fetchall()}
    if "status" not in quiz_cols:
        cursor.execute("ALTER TABLE quizzes ADD COLUMN status TEXT")
    if "generation_error" not in quiz_cols:
        cursor.execute("ALTER TABLE quizzes ADD COLUMN generation_error TEXT")

    conn.commit()
