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
        position INTEGER
    )
    """)
    _add_column_if_missing("cards", "position", "INTEGER")

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