"""
FileShare Backend — FastAPI + SQLite + JWT
Run:  python main.py   (or uvicorn main:app --reload)
"""

import os
import re
import uuid
import zipfile
import sqlite3
import mimetypes
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import List, Optional

from fastapi import (
    FastAPI, HTTPException, Depends, UploadFile, File,
    Body, Query, Request,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import jwt
import bcrypt
from PIL import Image

# ── Configuration ────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
THUMBNAIL_DIR = BASE_DIR / "thumbnails"
DB_PATH = BASE_DIR / "ghumaggersnap.db"

SECRET_KEY = os.environ.get("FILE_SHARE_SECRET", "change-me-in-production-please!")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.environ.get("TOKEN_EXPIRE_HOURS", "72"))
THUMBNAIL_SIZE = (400, 400)

UPLOAD_DIR.mkdir(exist_ok=True)
THUMBNAIL_DIR.mkdir(exist_ok=True)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".svg"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".m4v"}


# ── Database ─────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            original_name TEXT NOT NULL,
            stored_name TEXT NOT NULL,
            mime_type TEXT,
            file_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        );
    """)
    cursor = conn.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        admin_id = str(uuid.uuid4())
        pw = bcrypt.hashpw("admin".encode(), bcrypt.gensalt()).decode()
        conn.execute(
            "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?,?,?,?,?)",
            (admin_id, "admin", pw, "admin", datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
    conn.close()


# ── Pydantic Models ──────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "viewer"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserOut(BaseModel):
    id: str
    username: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Auth Helpers ─────────────────────────────────────────────────────────────
security = HTTPBearer(auto_error=False)


def create_token(user_id: str, username: str, role: str) -> str:
    return jwt.encode(
        {
            "sub": user_id,
            "username": username,
            "role": role,
            "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: sqlite3.Connection = Depends(get_db),
):
    token = None
    if credentials:
        token = credentials.credentials
    else:
        token = request.query_params.get("token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    cursor = db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return dict(user)


def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── File Helpers ─────────────────────────────────────────────────────────────
def classify_file(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    return "other"


def guess_mime(filename: str) -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or "application/octet-stream"


def make_thumbnail(src: Path, dst: Path) -> bool:
    try:
        with Image.open(src) as img:
            img.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.save(dst, "JPEG", quality=85)
            return True
    except Exception:
        return False


# ── FastAPI App ──────────────────────────────────────────────────────────────
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield

app = FastAPI(title="GhumaggerSnap", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth Routes ──────────────────────────────────────────────────────────────
@app.post("/api/auth/login", response_model=TokenOut)
def login(req: LoginRequest, db=Depends(get_db)):
    cursor = db.execute("SELECT * FROM users WHERE username = ?", (req.username,))
    user = cursor.fetchone()
    if not user or not bcrypt.checkpw(req.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = dict(user)
    return TokenOut(
        access_token=create_token(user["id"], user["username"], user["role"]),
        user=UserOut(id=user["id"], username=user["username"], role=user["role"]),
    )


@app.get("/api/auth/me", response_model=UserOut)
def get_me(user=Depends(get_current_user)):
    return UserOut(id=user["id"], username=user["username"], role=user["role"])


@app.post("/api/auth/change-password")
def change_password(req: ChangePasswordRequest, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = db.execute("SELECT password_hash FROM users WHERE id = ?", (user["id"],))
    row = cursor.fetchone()
    if not bcrypt.checkpw(req.current_password.encode(), row["password_hash"].encode()):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    new_hash = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()
    db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user["id"]))
    db.commit()
    return {"ok": True}


@app.post("/api/auth/users", response_model=UserOut)
def create_user(req: CreateUserRequest, admin=Depends(require_admin), db=Depends(get_db)):
    cursor = db.execute("SELECT id FROM users WHERE username = ?", (req.username,))
    if cursor.fetchone():
        raise HTTPException(status_code=409, detail="Username already exists")
    uid = str(uuid.uuid4())
    pw = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    db.execute(
        "INSERT INTO users (id,username,password_hash,role,created_at) VALUES (?,?,?,?,?)",
        (uid, req.username, pw, req.role, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return UserOut(id=uid, username=req.username, role=req.role)


@app.get("/api/auth/users")
def list_users(admin=Depends(require_admin), db=Depends(get_db)):
    cursor = db.execute("SELECT id, username, role, created_at FROM users ORDER BY created_at")
    return [dict(r) for r in cursor.fetchall()]


@app.delete("/api/auth/users/{user_id}")
def delete_user(user_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    if admin["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    return {"ok": True}


# ── File Routes ──────────────────────────────────────────────────────────────
@app.get("/api/files")
def list_files(
    search: Optional[str] = None,
    file_type: Optional[str] = None,
    sort: str = "newest",
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    q = "SELECT f.*, u.username AS uploader_name FROM files f JOIN users u ON f.uploaded_by=u.id WHERE 1=1"
    params: list = []
    if search:
        q += " AND f.original_name LIKE ?"
        params.append(f"%{search}%")
    if file_type and file_type != "all":
        q += " AND f.file_type = ?"
        params.append(file_type)
    order = {
        "newest": "f.uploaded_at DESC",
        "oldest": "f.uploaded_at ASC",
        "name": "f.original_name ASC",
        "size": "f.size DESC",
    }
    q += f" ORDER BY {order.get(sort, 'f.uploaded_at DESC')}"
    cursor = db.execute(q, params)
    return [
        {
            **dict(row),
            "thumbnail_url": f"/api/files/{row['id']}/thumbnail",
            "preview_url": f"/api/files/{row['id']}/preview",
            "download_url": f"/api/files/{row['id']}/download",
        }
        for row in cursor.fetchall()
    ]


@app.get("/api/stats")
def stats(user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT COUNT(*) AS cnt, COALESCE(SUM(size),0) AS total FROM files").fetchone()
    by_type = {
        r["file_type"]: r["cnt"]
        for r in db.execute("SELECT file_type, COUNT(*) AS cnt FROM files GROUP BY file_type").fetchall()
    }
    return {"total_files": row["cnt"], "total_size": row["total"], "by_type": by_type}


@app.post("/api/files/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if user["role"] not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Upload permission required")

    uploaded = []
    for f in files:
        fid = str(uuid.uuid4())
        ext = Path(f.filename).suffix.lower()
        stored = f"{fid}{ext}"
        fpath = UPLOAD_DIR / stored

        content = await f.read()
        fpath.write_bytes(content)

        ftype = classify_file(f.filename)
        mime = guess_mime(f.filename)

        if ftype == "image":
            make_thumbnail(fpath, THUMBNAIL_DIR / f"{fid}.jpg")

        db.execute(
            "INSERT INTO files (id,original_name,stored_name,mime_type,file_type,size,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?)",
            (fid, f.filename, stored, mime, ftype, len(content), user["id"], datetime.now(timezone.utc).isoformat()),
        )
        uploaded.append({"id": fid, "name": f.filename, "size": len(content)})

    db.commit()
    return {"uploaded": uploaded, "count": len(uploaded)}


@app.get("/api/files/{file_id}/preview")
def preview_file(file_id: str, request: Request, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT * FROM files WHERE id=?", (file_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    rec = dict(row)
    fpath = UPLOAD_DIR / rec["stored_name"]
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="File missing from disk")

    file_size = fpath.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        m = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if m:
            start = int(m.group(1))
            end = int(m.group(2)) if m.group(2) else file_size - 1
            if start >= file_size:
                raise HTTPException(status_code=416, detail="Range not satisfiable")
            length = end - start + 1

            def ranged():
                with open(fpath, "rb") as fp:
                    fp.seek(start)
                    remaining = length
                    while remaining > 0:
                        chunk = fp.read(min(1024 * 1024, remaining))
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk

            return StreamingResponse(
                ranged(),
                status_code=206,
                media_type=rec["mime_type"],
                headers={
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(length),
                },
            )

    def iterfile():
        with open(fpath, "rb") as fp:
            while chunk := fp.read(1024 * 1024):
                yield chunk

    return StreamingResponse(
        iterfile(),
        media_type=rec["mime_type"],
        headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)},
    )


@app.get("/api/files/{file_id}/thumbnail")
def get_thumbnail(file_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT * FROM files WHERE id=?", (file_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    rec = dict(row)

    if rec["file_type"] == "image":
        thumb = THUMBNAIL_DIR / f"{file_id}.jpg"
        if thumb.exists():
            return StreamingResponse(open(thumb, "rb"), media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="No thumbnail")


@app.get("/api/files/{file_id}/download")
def download_file(file_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT * FROM files WHERE id=?", (file_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    rec = dict(row)
    fpath = UPLOAD_DIR / rec["stored_name"]
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="File missing from disk")

    def iterfile():
        with open(fpath, "rb") as fp:
            while chunk := fp.read(1024 * 1024):
                yield chunk

    return StreamingResponse(
        iterfile(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{rec["original_name"]}"',
            "Content-Length": str(rec["size"]),
        },
    )


@app.post("/api/files/bulk-download")
def bulk_download(
    file_ids: List[str] = Body(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if not file_ids:
        raise HTTPException(status_code=400, detail="No files selected")
    ph = ",".join("?" * len(file_ids))
    rows = [dict(r) for r in db.execute(f"SELECT * FROM files WHERE id IN ({ph})", file_ids).fetchall()]
    if not rows:
        raise HTTPException(status_code=404, detail="No files found")

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        seen: dict = {}
        for f in rows:
            fp = UPLOAD_DIR / f["stored_name"]
            if fp.exists():
                name = f["original_name"]
                if name in seen:
                    seen[name] += 1
                    stem, ext = Path(name).stem, Path(name).suffix
                    name = f"{stem} ({seen[name]}){ext}"
                else:
                    seen[name] = 0
                zf.write(fp, name)
    buf.seek(0)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="files-{ts}.zip"'},
    )


@app.delete("/api/files/{file_id}")
def delete_file(file_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    if user["role"] not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Delete permission required")
    row = db.execute("SELECT * FROM files WHERE id=?", (file_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    rec = dict(row)
    fp = UPLOAD_DIR / rec["stored_name"]
    if fp.exists():
        fp.unlink()
    tp = THUMBNAIL_DIR / f"{file_id}.jpg"
    if tp.exists():
        tp.unlink()
    db.execute("DELETE FROM files WHERE id=?", (file_id,))
    db.commit()
    return {"ok": True}


@app.post("/api/files/bulk-delete")
def bulk_delete(
    file_ids: List[str] = Body(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if user["role"] not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Delete permission required")
    ph = ",".join("?" * len(file_ids))
    rows = [dict(r) for r in db.execute(f"SELECT * FROM files WHERE id IN ({ph})", file_ids).fetchall()]
    for f in rows:
        fp = UPLOAD_DIR / f["stored_name"]
        if fp.exists():
            fp.unlink()
        tp = THUMBNAIL_DIR / f"{f['id']}.jpg"
        if tp.exists():
            tp.unlink()
    db.execute(f"DELETE FROM files WHERE id IN ({ph})", file_ids)
    db.commit()
    return {"ok": True, "deleted": len(rows)}


# ── Serve Frontend (production build) ────────────────────────────────────────
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")


# ── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
