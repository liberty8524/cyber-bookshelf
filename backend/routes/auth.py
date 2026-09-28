import os
import sqlite3
from urllib.parse import urlsplit
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator, ConfigDict
from backend import database
from backend.auth import require_user
from backend.services.seed import add_user_samples
from backend.services.auth_service import (
    COOKIE_NAME, SESSION_SECONDS, hash_password, verify_password, new_session, token_hash, throttle,
)

router = APIRouter(prefix="/api/auth", tags=["accounts"])

class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(min_length=15, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize(cls, value):
        return value.lower()

class Registration(Credentials):
    display_name: str = Field(default="", max_length=40)

def browser_request(request):
    if request.headers.get("X-Requested-With") != "bookshelf":
        raise HTTPException(403, "请从本站登录或注册")
    origin = request.headers.get("origin")
    if origin:
        parsed = urlsplit(origin)
        public_origin = os.environ.get("BOOKSHELF_PUBLIC_ORIGIN", "").rstrip("/")
        same_host = parsed.scheme in {"http", "https"} and parsed.netloc == request.headers.get("host")
        if not same_host and (not public_origin or origin != public_origin):
            raise HTTPException(403, "请求来源不被允许")
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "请求来源不被允许")

def set_cookie(response, token):
    response.set_cookie(COOKIE_NAME, token, max_age=SESSION_SECONDS, httponly=True,
                        secure=os.environ.get("BOOKSHELF_COOKIE_SECURE", "0") == "1",
                        samesite="lax", path="/")

def public_user(user, csrf):
    return {"user": {"id":user["id"], "username":user["username"], "display_name":user["display_name"]},
            "csrf_token":csrf}

@router.post("/register", status_code=201)
def register(payload: Registration, request: Request, response: Response):
    browser_request(request)
    ip = request.client.host if request.client else "unknown"
    throttle("register", ip, 10)
    password_hash = hash_password(payload.password)
    created_paths = []
    try:
        with database.connection() as db:
            cursor = db.execute("INSERT INTO users(username,display_name,password_hash) VALUES(?,?,?)",
                                (payload.username, payload.display_name.strip() or payload.username, password_hash))
            user_id = cursor.lastrowid
            add_user_samples(db, user_id, created_paths)
            token, csrf = new_session(db, user_id, request.cookies.get(COOKIE_NAME))
            user = db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    except Exception as exc:
        for path in created_paths:
            path.unlink(missing_ok=True)
        if isinstance(exc, sqlite3.IntegrityError):
            raise HTTPException(409, "该用户名已被使用，请换一个") from exc
        raise
    set_cookie(response, token)
    return public_user(user, csrf)

@router.post("/login")
def login(payload: Credentials, request: Request, response: Response):
    browser_request(request)
    ip = request.client.host if request.client else "unknown"
    throttle("login-ip", ip, 60)
    throttle("login-user", payload.username, 10)
    with database.connection() as db:
        user = db.execute("SELECT * FROM users WHERE username=?", (payload.username,)).fetchone()
    # Missing accounts perform the same expensive work to reduce timing differences.
    valid = verify_password(payload.password, user["password_hash"]) if user else bool(hash_password(payload.password)) and False
    if not valid:
        raise HTTPException(401, "用户名或密码不正确")
    with database.connection() as db:
        token, csrf = new_session(db, user["id"], request.cookies.get(COOKIE_NAME))
    set_cookie(response, token)
    return public_user(user, csrf)

@router.get("/me")
def me(user=Depends(require_user)):
    return public_user(user, user["csrf_token"])

@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, user=Depends(require_user)):
    with database.connection() as db:
        db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(request.cookies[COOKIE_NAME]),))
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, samesite="lax",
                           secure=os.environ.get("BOOKSHELF_COOKIE_SECURE", "0") == "1")
