import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()

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
