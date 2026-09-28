"""Shared authentication and CSRF dependency for every private endpoint."""
import hmac
import time
from fastapi import HTTPException, Request
from backend import database
from backend.services.auth_service import COOKIE_NAME, token_hash

def require_user(request: Request):
    if getattr(request.state, "auth_user", None):
        return request.state.auth_user
    token = request.cookies.get(COOKIE_NAME, "")
    if not token:
        raise HTTPException(401, "请先登录")
    with database.connection() as db:
        row = db.execute("""SELECT users.id,users.username,users.display_name,
                            sessions.csrf_token FROM sessions
                            JOIN users ON users.id=sessions.user_id
                            WHERE sessions.token_hash=? AND sessions.expires_at>?""",
                         (token_hash(token), int(time.time()))).fetchone()
    if not row:
        raise HTTPException(401, "登录已过期，请重新登录")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        if not hmac.compare_digest(request.headers.get("X-CSRF-Token", ""), row["csrf_token"]):
            raise HTTPException(403, "登录状态已变化，请刷新页面后重试")
    return dict(row)
