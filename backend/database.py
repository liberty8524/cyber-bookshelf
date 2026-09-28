"""SQLite connections and schema, isolated from HTTP and document services."""
import sqlite3
import os
from pathlib import Path
from contextlib import contextmanager, closing
ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = Path(os.environ.get("BOOKSHELF_DATA_DIR", str(ROOT))).resolve()
DB_PATH = DATA_ROOT / "database" / "bookshelf.db"
UPLOAD_DIR = DATA_ROOT / "uploads"

@contextmanager
def connection():
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def initialize():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    # SQLite backup includes WAL content and never overwrites the original backup.
    if DB_PATH.exists():
        with closing(sqlite3.connect(DB_PATH)) as source:
            columns = {r[1] for r in source.execute("PRAGMA table_info(books)")}
            backup = DB_PATH.with_name(DB_PATH.stem + "-before-accounts.db")
            if columns and "owner_id" not in columns and not backup.exists():
                with closing(sqlite3.connect(backup)) as target:
                    source.backup(target)
    with connection() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          csrf_token TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        CREATE TABLE IF NOT EXISTS auth_limits (
          key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL, author TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT '其他', description TEXT NOT NULL DEFAULT '',
          file_path TEXT NOT NULL, cover_path TEXT,
          current_page INTEGER NOT NULL DEFAULT 1,
          total_pages INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          last_read_at TEXT, theme_style_seed INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
        """)

        columns = {r[1] for r in db.execute("PRAGMA table_info(books)")}
        if "owner_id" not in columns:
            db.execute("ALTER TABLE books ADD COLUMN owner_id INTEGER REFERENCES users(id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_books_owner ON books(owner_id, id)")
