"""Generate original, short sample PDFs. These are not copies of the named books."""
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
from backend import database
import hashlib

SAMPLES = [
("The Great Gatsby","F. Scott Fitzgerald","小说",12),
("Pride and Prejudice","Jane Austen","文学",10),
("1984","George Orwell","小说",9),
("The Little Prince","Antoine de Saint-Exupery","文学",12),
("Python Crash Course","Eric Matthes","技术",10),
("Deep Learning","Ian Goodfellow","技术",8),
("Algorithms","Robert Sedgewick","学习",10),
("Walden","Henry David Thoreau","文学",8),
("A Brief History of Time","Stephen Hawking","学习",8),
("The Art of War","Sun Tzu","历史",8),
("The Old Man and the Sea","Ernest Hemingway","小说",8),
("The Design of Everyday Things","Don Norman","学习",8),
("Meditations","Marcus Aurelius","历史",8),
("A Room of One's Own","Virginia Woolf","文学",8),
("The Creative Act","Rick Rubin","其他",8),
("The Secret Garden","Frances Hodgson Burnett","小说",8),
("Sapiens","Yuval Noah Harari","历史",8),
]
def create_sample(path, title, author, pages):
    writer=PdfWriter()
    font=DictionaryObject({NameObject("/Type"):NameObject("/Font"),NameObject("/Subtype"):NameObject("/Type1"),NameObject("/BaseFont"):NameObject("/Helvetica")})
    font_ref=writer._add_object(font)
    def safe(s):
        return s.replace("\\","\\\\").replace("(","\\(").replace(")","\\)")
    for i in range(pages):
        p=writer.add_blank_page(width=595,height=842)
        p[NameObject("/Resources")]=DictionaryObject({NameObject("/Font"):DictionaryObject({NameObject("/F1"):font_ref})})
        lines=[(23,title),(13,author),(11,"DIGITAL BOOKSHELF / SAMPLE EDITION"),(11,""),(12,"A quiet space for your next great read."),(11,""),(11,"This is an original demonstration PDF, not the full book."),(11,"Upload your own PDF to start your personal collection."),(11,""),(11,"Try turning pages, adjusting the zoom, and returning to the shelf."),(11,"Your reading position will be saved automatically."),(11,""),(11,f"Reading room notes - page {i+1} of {pages}")]
        commands=["0.97 0.95 0.90 rg 0 0 595 842 re f","0.20 0.28 0.22 rg","BT","1 0 0 1 55 750 Tm"]
        for size, text in lines:
            commands.extend([f"/F1 {size} Tf",f"({safe(text)}) Tj","0 -34 Td"])
        commands.append("ET")
        stream=DecodedStreamObject()
        stream.set_data("\n".join(commands).encode("ascii",errors="replace"))
        p[NameObject("/Contents")]=writer._add_object(stream)
    writer.add_metadata({"/Title":title,"/Author":author})
    with path.open("wb") as stream:
        writer.write(stream)

def seed_once():
    with database.connection() as db:
        if db.execute("SELECT 1 FROM settings WHERE key='seeded'").fetchone():
            return
        for title, author, category, pages in SAMPLES:
            seed=int(hashlib.sha256(title.encode()).hexdigest()[:7],16)
            filename=f"sample-{seed}.pdf"
            create_sample(database.UPLOAD_DIR/filename,title,author,pages)
            db.execute("INSERT INTO books(title,author,category,description,file_path,total_pages,theme_style_seed) VALUES(?,?,?,?,?,?,?)",
            (title,author,category,"示例藏书 · 内含原创阅读器演示页，并非原著全文。你可以删除此示例，并导入自己的 PDF。",filename,pages,seed))
        db.execute("INSERT INTO settings VALUES('seeded','1')")

def add_user_samples(db, user_id, created_paths):
    """Call inside a transaction. Each account gets private files exactly once."""
    import uuid
    key = f"user_samples_v1:{user_id}"
    if db.execute("SELECT 1 FROM settings WHERE key=?", (key,)).fetchone():
        return 0
    existing = {(row["title"], row["author"]) for row in db.execute(
        "SELECT title,author FROM books WHERE owner_id=?", (user_id,))}
    added = 0
    for title, author, category, pages in SAMPLES:
        if (title, author) in existing:
            continue
        seed = int(hashlib.sha256(title.encode()).hexdigest()[:7], 16)
        filename = f"sample-user-{user_id}-{uuid.uuid4().hex}.pdf"
        path = database.UPLOAD_DIR / filename
        created_paths.append(path)
        create_sample(path, title, author, pages)
        db.execute("""INSERT INTO books(title,author,category,description,file_path,total_pages,theme_style_seed,owner_id)
                      VALUES(?,?,?,?,?,?,?,?)""",
                   (title, author, category, "示例藏书 · 内含原创阅读器演示页，并非原著全文。你可以删除此示例，并导入自己的 PDF。",
                    filename, pages, seed, user_id))
        added += 1
    db.execute("INSERT INTO settings(key,value) VALUES(?, '1')", (key,))
    return added


def seed_user_once(user_id):
    created_paths = []
    try:
        with database.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            if not db.execute("SELECT 1 FROM users WHERE id=?", (user_id,)).fetchone():
                raise ValueError("账号不存在")
            return add_user_samples(db, user_id, created_paths)
    except Exception:
        for path in created_paths:
            path.unlink(missing_ok=True)
        raise


def seed_existing_users():
    with database.connection() as db:
        user_ids = [row["id"] for row in db.execute("SELECT id FROM users")]
    return sum(seed_user_once(user_id) for user_id in user_ids)
