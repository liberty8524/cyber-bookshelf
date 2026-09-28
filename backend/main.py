from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from backend.auth import require_user
from fastapi.staticfiles import StaticFiles
from backend.database import initialize, ROOT
from backend.routes.books import router
from backend.routes.auth import router as auth_router
from backend.services.seed import seed_existing_users
import tempfile

# Keep multipart spool files inside the project, including large uploads.
TEMP_DIR = ROOT / '.cache' / 'tmp'
TEMP_DIR.mkdir(parents=True, exist_ok=True)
tempfile.tempdir = str(TEMP_DIR)

@asynccontextmanager
async def lifespan(app):
    initialize()
    seed_existing_users()
    yield

app=FastAPI(title="藏间 Digital Bookshelf",lifespan=lifespan)
app.include_router(auth_router)
app.include_router(router)

@app.middleware('http')
async def private_response_headers(request, call_next):
    # Authenticate uploads before Starlette parses/spools the multipart body.
    try:
        if request.url.path.startswith("/api/books"):
            request.state.auth_user = await run_in_threadpool(require_user, request)
            length = request.headers.get("content-length")
            if length and int(length) > 101 * 1024 * 1024:
                raise HTTPException(413, "文件过大，最大支持 100 MB")
        response = await call_next(request)
    except HTTPException as exc:
        response = JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)
    except ValueError:
        response = JSONResponse({"detail": "请求长度格式不正确"}, status_code=400)
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Pragma'] = 'no-cache'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'same-origin'
    return response

@app.get("/api/health")
def health():
    return {"status":"ok"}

if (ROOT/"dist").exists():
    app.mount("/",StaticFiles(directory=ROOT/"dist",html=True),name="frontend")
