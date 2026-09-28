"""Password hashes, revocable sessions and database-backed login throttling."""
import hashlib
import hmac
import secrets
import threading
import time
from fastapi import HTTPException
from backend import database

COOKIE_NAME = "bookshelf_session"
SESSION_SECONDS = 7 * 24 * 3600
_hash_slots = threading.BoundedSemaphore(2)

def hash_password(password):
    salt = secrets.token_bytes(16)
    with _hash_slots:
        digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**17, r=8, p=1, maxmem=256*1024*1024)
    return f"scrypt$131072$8$1${salt.hex()}${digest.hex()}"

def verify_password(password, encoded):
    try:
        algorithm, n, r, p, salt, digest = encoded.split("$")
        if algorithm != "scrypt":
            return False
        with _hash_slots:
            candidate = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p), maxmem=256*1024*1024)
        return hmac.compare_digest(candidate.hex(), digest)
    except (ValueError, TypeError):
        return False

def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()

def throttle(scope, identifier, limit, window=900):
    key = scope + ":" + token_hash(identifier)
    now = int(time.time())
    with database.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM auth_limits WHERE expires_at <= ?", (now,))
        row = db.execute("SELECT attempts, expires_at FROM auth_limits WHERE key=?", (key,)).fetchone()
        if row and row["attempts"] >= limit:
            raise HTTPException(429, "尝试次数较多，请稍后再试", headers={"Retry-After": str(row["expires_at"]-now)})
        db.execute("""INSERT INTO auth_limits(key,attempts,expires_at) VALUES(?,1,?)
                      ON CONFLICT(key) DO UPDATE SET attempts=attempts+1""", (key, now+window))

def new_session(db, user_id, old_token=None):
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    now = int(time.time())
    db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
    if old_token:
        db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(old_token),))
    db.execute("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)",
               (token_hash(token), user_id, csrf, now+SESSION_SECONDS))
    return token, csrf

def claim_legacy(username):
    """Local administrator action only; no public HTTP endpoint."""
    with database.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        user = db.execute("SELECT id FROM users WHERE username=?", (username.strip().lower(),)).fetchone()
        if not user:
            raise ValueError("账号不存在，请先在网页注册")
        return db.execute("UPDATE books SET owner_id=? WHERE owner_id IS NULL", (user["id"],)).rowcount
