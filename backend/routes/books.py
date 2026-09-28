from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool
from backend import database
from backend.auth import require_user
from backend.schemas import BookEdit, ProgressUpdate
from backend.services.pdf_service import inspect_pdf
from pathlib import Path
import uuid
import secrets

router=APIRouter(prefix="/api/books", tags=["books"])
MAX_FILE_SIZE=100*1024*1024

def public_book(book):
    return {k:v for k,v in book.items() if k not in {"file_path", "owner_id", "cover_path"}}

def get_book(book_id, owner_id, private=False):
    with database.connection() as db:
        row=db.execute("SELECT * FROM books WHERE id=? AND owner_id=?",(book_id,owner_id)).fetchone()
        if not row:
            raise HTTPException(404,"书籍不存在")
        return dict(row) if private else public_book(dict(row))

@router.get("")
def list_books(q: str="", category: str="", user=Depends(require_user)):
    with database.connection() as db:
        rows=[dict(r) for r in db.execute("SELECT * FROM books WHERE owner_id=? ORDER BY id", (user["id"],))]
    return [public_book(r) for r in rows if (not q or q.casefold() in (r["title"]+" "+r["author"]).casefold()) and (not category or r["category"]==category)]

@router.post("",status_code=201)
async def upload_book(file: UploadFile=File(...),title: str=Form(""),author: str=Form(""),category: str=Form("其他"),description: str=Form(""),user=Depends(require_user)):
    filename=uuid.uuid4().hex+".pdf"
    path=database.UPLOAD_DIR/filename
    try:
        if not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(400,"仅支持 PDF 文件")
        size=0
        with path.open("wb") as output:
            while chunk:=await file.read(1024*1024):
                size+=len(chunk)
                if size>MAX_FILE_SIZE:
                    raise HTTPException(413,"文件过大，最大支持 100 MB")
                output.write(chunk)
        if not size:
            raise HTTPException(400,"文件为空")
        total,meta_title,meta_author=await run_in_threadpool(inspect_pdf,path)
        title=(title.strip() or meta_title.strip() or Path(file.filename).stem)[:300]
        author=(author.strip() or meta_author.strip())[:200]
        if len(category)>50 or len(description)>5000:
            raise HTTPException(400,"分类或简介过长")
        with database.connection() as db:
            cursor=db.execute("INSERT INTO books(title,author,category,description,file_path,total_pages,theme_style_seed,owner_id) VALUES(?,?,?,?,?,?,?,?)",
            (title,author,category.strip() or "其他",description,filename,total,secrets.randbelow(2**28),user["id"]))
            book_id=cursor.lastrowid
        return get_book(book_id, user["id"])
    except Exception:
        path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

@router.get("/{book_id}/file")
def book_file(book_id: int,user=Depends(require_user)):
    book=get_book(book_id, user["id"], private=True)
    path=database.UPLOAD_DIR/book["file_path"]
    if not path.is_file():
        raise HTTPException(404,"PDF 文件不存在")
    return FileResponse(path,media_type="application/pdf")

@router.patch("/{book_id}")
def edit_book(book_id: int,payload: BookEdit,user=Depends(require_user)):
    get_book(book_id, user["id"])
    with database.connection() as db:
        db.execute("UPDATE books SET title=?,author=?,category=?,description=? WHERE id=? AND owner_id=?",
        (payload.title,payload.author,payload.category,payload.description,book_id,user["id"]))
    return get_book(book_id, user["id"])

@router.patch("/{book_id}/progress")
def update_progress(book_id: int,payload: ProgressUpdate,user=Depends(require_user)):
    book=get_book(book_id, user["id"])
    if payload.current_page>book["total_pages"]:
        raise HTTPException(400,"页码超出书籍范围")
    with database.connection() as db:
        db.execute("UPDATE books SET current_page=?,last_read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND owner_id=?",(payload.current_page,book_id,user["id"]))
    return get_book(book_id, user["id"])

@router.delete("/{book_id}",status_code=204)
def delete_book(book_id: int,user=Depends(require_user)):
    book=get_book(book_id, user["id"], private=True)
    path=database.UPLOAD_DIR/book["file_path"]
    tombstone=path.with_suffix(".deleting")
    moved=False
    try:
        if path.exists():
            path.replace(tombstone)
            moved=True
        with database.connection() as db:
            db.execute("DELETE FROM books WHERE id=? AND owner_id=?",(book_id,user["id"]))
    except Exception:
        if moved:
            tombstone.replace(path)
        raise
    tombstone.unlink(missing_ok=True)
