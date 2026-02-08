"""
GhumaggerSnap Backend — FastAPI + SQLite (users only) + Filesystem browser
Run:  MEDIA_DIR=/path/to/photos python main.py
"""

import os
import re
import uuid
import hashlib
import zipfile
import sqlite3
import mimetypes
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import (
    FastAPI, HTTPException, Depends,
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
MEDIA_DIR = Path(os.environ.get("MEDIA_DIR", str(BASE_DIR / "media")))
THUMBNAIL_DIR = BASE_DIR / "thumbnails"
DB_PATH = BASE_DIR / "ghumaggersnap.db"

SECRET_KEY = os.environ.get("FILE_SHARE_SECRET", "change-me-in-production-please!")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.environ.get("TOKEN_EXPIRE_HOURS", "72"))
THUMBNAIL_SIZE = (400, 400)

THUMBNAIL_DIR.mkdir(exist_ok=True)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".m4v"}
MEDIA_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS


# ── Database (users only) ────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    admin_user = os.environ.get("ADMIN_USER", "").strip()
    admin_pass = os.environ.get("ADMIN_PASS", "").strip()

    # If env vars not set, prompt interactively
    if not admin_user or not admin_pass:
        import getpass
        print()
        print("  ── GhumaggerSnap — Admin Setup ──")
        print()
        admin_user = admin_user or input("  Enter admin username: ").strip()
        admin_pass = admin_pass or getpass.getpass("  Enter admin password: ").strip()
        if not admin_user or not admin_pass:
            print("  [ERR] Username and password cannot be empty.")
            raise SystemExit(1)
        print()

    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            created_at TEXT NOT NULL
        );
    """)

    # Reset admin user on every startup (ensures credentials match what was entered)
    pw_hash = bcrypt.hashpw(admin_pass.encode(), bcrypt.gensalt()).decode()
    existing = conn.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1").fetchone()
    if existing:
        conn.execute(
            "UPDATE users SET username=?, password_hash=? WHERE id=?",
            (admin_user, pw_hash, existing[0]),
        )
    else:
        admin_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id,username,password_hash,role,created_at) VALUES (?,?,?,?,?)",
            (admin_id, admin_user, pw_hash, "admin", datetime.now(timezone.utc).isoformat()),
        )
    conn.commit()
    conn.close()
    print(f"  [OK] Admin user '{admin_user}' ready.")


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


# ── Filesystem Helpers ───────────────────────────────────────────────────────
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


def safe_resolve(rel_path: str) -> Path:
    """Resolve a relative path under MEDIA_DIR, preventing traversal attacks."""
    # Normalise and strip leading slashes
    cleaned = rel_path.strip("/").replace("\\", "/")
    if cleaned in ("", "."):
        return MEDIA_DIR
    resolved = (MEDIA_DIR / cleaned).resolve()
    media_resolved = MEDIA_DIR.resolve()
    if not str(resolved).startswith(str(media_resolved)):
        raise HTTPException(status_code=403, detail="Path traversal denied")
    return resolved


def thumb_key(fpath: Path) -> str:
    """Deterministic cache key from absolute path + mtime."""
    stat = fpath.stat()
    raw = f"{fpath}:{stat.st_mtime_ns}:{stat.st_size}"
    return hashlib.md5(raw.encode()).hexdigest()


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


def stream_file(fpath: Path, request: Request, mime: str):
    """Stream a file with optional range-request support (for video seeking)."""
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
                media_type=mime,
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
        media_type=mime,
        headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)},
    )


# ── FastAPI App ──────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app):
    init_db()
    # Validate MEDIA_DIR exists
    if not MEDIA_DIR.exists():
        print(f"[WARN] MEDIA_DIR does not exist: {MEDIA_DIR}")
        print(f"       Set MEDIA_DIR env var to point to your media folder.")
        MEDIA_DIR.mkdir(parents=True, exist_ok=True)
        print(f"       Created empty directory: {MEDIA_DIR}")
    else:
        print(f"[OK]   MEDIA_DIR: {MEDIA_DIR}")
    yield


app = FastAPI(title="GhumaggerSnap", version="2.0.0", lifespan=lifespan)

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


# ── File Routes (read-only filesystem browser) ──────────────────────────────
@app.get("/api/files")
def list_files(
    path: str = "/",
    search: Optional[str] = None,
    file_type: Optional[str] = None,
    sort: str = "name",
    user=Depends(get_current_user),
):
    """Lazy-scan a directory under MEDIA_DIR. Returns folders + files."""
    target = safe_resolve(path)

    if not target.exists():
        raise HTTPException(status_code=404, detail="Directory not found")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    folders = []
    files = []

    try:
        with os.scandir(target) as entries:
            for entry in entries:
                # Skip hidden files/dirs
                if entry.name.startswith("."):
                    continue

                try:
                    stat = entry.stat()
                except OSError:
                    continue

                if entry.is_dir(follow_symlinks=False):
                    # Count immediate children (quick peek)
                    try:
                        child_count = sum(1 for _ in os.scandir(entry.path) if not _.name.startswith("."))
                    except OSError:
                        child_count = 0

                    folders.append({
                        "name": entry.name,
                        "type": "folder",
                        "path": f"{path.rstrip('/')}/{entry.name}",
                        "item_count": child_count,
                        "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    })

                elif entry.is_file(follow_symlinks=False):
                    ext = Path(entry.name).suffix.lower()
                    ftype = classify_file(entry.name)

                    # Only show media files (images + videos) + common files
                    if search and search.lower() not in entry.name.lower():
                        continue
                    if file_type and file_type != "all" and ftype != file_type:
                        continue

                    rel_path = f"{path.rstrip('/')}/{entry.name}"
                    files.append({
                        "name": entry.name,
                        "type": "file",
                        "path": rel_path,
                        "file_type": ftype,
                        "mime_type": guess_mime(entry.name),
                        "size": stat.st_size,
                        "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                        "thumbnail_url": f"/api/files/thumbnail?path={rel_path}",
                        "preview_url": f"/api/files/preview?path={rel_path}",
                        "download_url": f"/api/files/download?path={rel_path}",
                    })
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    # Sort folders by name always
    folders.sort(key=lambda f: f["name"].lower())

    # Sort files
    if sort == "name":
        files.sort(key=lambda f: f["name"].lower())
    elif sort == "newest":
        files.sort(key=lambda f: f["modified_at"], reverse=True)
    elif sort == "oldest":
        files.sort(key=lambda f: f["modified_at"])
    elif sort == "size":
        files.sort(key=lambda f: f["size"], reverse=True)

    return {
        "path": path,
        "folders": folders,
        "files": files,
        "total_folders": len(folders),
        "total_files": len(files),
    }


@app.get("/api/stats")
def stats(path: str = "/", user=Depends(get_current_user)):
    """Quick stats for current directory."""
    target = safe_resolve(path)
    if not target.exists() or not target.is_dir():
        return {"total_files": 0, "total_size": 0, "by_type": {}}

    total_size = 0
    by_type: dict = {}
    count = 0

    try:
        with os.scandir(target) as entries:
            for entry in entries:
                if entry.name.startswith(".") or not entry.is_file(follow_symlinks=False):
                    continue
                try:
                    st = entry.stat()
                except OSError:
                    continue
                ftype = classify_file(entry.name)
                total_size += st.st_size
                by_type[ftype] = by_type.get(ftype, 0) + 1
                count += 1
    except PermissionError:
        pass

    return {"total_files": count, "total_size": total_size, "by_type": by_type}


@app.get("/api/files/preview")
def preview_file(path: str, request: Request, user=Depends(get_current_user)):
    fpath = safe_resolve(path)
    if not fpath.exists() or not fpath.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    mime = guess_mime(fpath.name)
    return stream_file(fpath, request, mime)


@app.get("/api/files/thumbnail")
def get_thumbnail(path: str, user=Depends(get_current_user)):
    fpath = safe_resolve(path)
    if not fpath.exists() or not fpath.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    ftype = classify_file(fpath.name)
    if ftype != "image":
        raise HTTPException(status_code=404, detail="No thumbnail for non-image")

    key = thumb_key(fpath)
    thumb_path = THUMBNAIL_DIR / f"{key}.jpg"

    if not thumb_path.exists():
        if not make_thumbnail(fpath, thumb_path):
            raise HTTPException(status_code=500, detail="Thumbnail generation failed")

    return StreamingResponse(open(thumb_path, "rb"), media_type="image/jpeg")


@app.get("/api/files/download")
def download_file(path: str, user=Depends(get_current_user)):
    fpath = safe_resolve(path)
    if not fpath.exists() or not fpath.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    file_size = fpath.stat().st_size

    def iterfile():
        with open(fpath, "rb") as fp:
            while chunk := fp.read(1024 * 1024):
                yield chunk

    return StreamingResponse(
        iterfile(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{fpath.name}"',
            "Content-Length": str(file_size),
        },
    )


@app.post("/api/files/bulk-download")
def bulk_download(
    paths: List[str] = Body(...),
    user=Depends(get_current_user),
):
    if not paths:
        raise HTTPException(status_code=400, detail="No files selected")

    resolved = []
    for p in paths:
        fpath = safe_resolve(p)
        if fpath.exists() and fpath.is_file():
            resolved.append(fpath)

    if not resolved:
        raise HTTPException(status_code=404, detail="No valid files found")

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        seen: dict = {}
        for fp in resolved:
            name = fp.name
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
        headers={"Content-Disposition": f'attachment; filename="GhumaggerSnap-{ts}.zip"'},
    )


# ── Serve Frontend (production build) ────────────────────────────────────────
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")


# ── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
