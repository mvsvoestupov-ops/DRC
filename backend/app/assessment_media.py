"""Загрузка графики, PDF, видео и аудио для заданий конструктора ФОС."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .auth import get_current_user
from .db.user_models import User

router = APIRouter()

BACKEND_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BACKEND_DIR / "uploads" / "assessment"

KIND_LIMITS = {
    "image": 10 * 1024 * 1024,
    "pdf": 20 * 1024 * 1024,
    "audio": 40 * 1024 * 1024,
    "video": 100 * 1024 * 1024,
}

MIME_KIND = {
    "image/jpeg": "image",
    "image/png": "image",
    "image/gif": "image",
    "image/webp": "image",
    "application/pdf": "pdf",
    "audio/mpeg": "audio",
    "audio/mp3": "audio",
    "audio/wav": "audio",
    "audio/x-wav": "audio",
    "audio/ogg": "audio",
    "audio/webm": "audio",
    "audio/aac": "audio",
    "audio/mp4": "audio",
    "audio/x-m4a": "audio",
    "video/mp4": "video",
    "video/webm": "video",
    "video/ogg": "video",
    "video/quicktime": "video",
}

EXT_KIND = {
    ".jpg": "image",
    ".jpeg": "image",
    ".png": "image",
    ".gif": "image",
    ".webp": "image",
    ".pdf": "pdf",
    ".mp3": "audio",
    ".wav": "audio",
    ".ogg": "audio",
    ".oga": "audio",
    ".m4a": "audio",
    ".aac": "audio",
    ".mp4": "video",
    ".webm": "video",
    ".mov": "video",
}

EXT_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
}

FILE_ID_RE = re.compile(r"^[0-9a-f]{32}$")
UNSAFE_NAME = re.compile(r"[^\w.\- ()а-яА-ЯёЁ]+", re.UNICODE)


def _ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _kind_for(filename: str, content_type: str | None) -> str | None:
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime in MIME_KIND:
        return MIME_KIND[mime]
    ext = Path(filename or "").suffix.lower()
    return EXT_KIND.get(ext)


def _safe_name(name: str) -> str:
    cleaned = UNSAFE_NAME.sub("_", (name or "").strip())[:180].strip(" ._")
    return cleaned or "файл"


def _meta_path(file_id: str) -> Path:
    return UPLOAD_DIR / f"{file_id}.meta.json"


def _read_meta(file_id: str) -> dict:
    path = _meta_path(file_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Файл не найден")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise HTTPException(status_code=404, detail="Файл не найден")


@router.post("/assessment-media")
async def upload_assessment_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    original = file.filename or "файл"
    kind = _kind_for(original, file.content_type)
    if not kind:
        raise HTTPException(
            status_code=400,
            detail="Допустимы изображения (JPEG, PNG, GIF, WebP), PDF, аудио и видео.",
        )
    content = await file.read()
    limit = KIND_LIMITS[kind]
    if len(content) > limit:
        megabytes = limit // (1024 * 1024)
        raise HTTPException(
            status_code=400,
            detail=f"Файл слишком большой. Максимум для этого типа — {megabytes} МБ.",
        )
    if not content:
        raise HTTPException(status_code=400, detail="Пустой файл")

    _ensure_upload_dir()
    file_id = uuid.uuid4().hex
    ext = Path(original).suffix.lower()
    if ext not in EXT_KIND:
        ext = next((item for item, value in EXT_KIND.items() if value == kind), "")
    stored_name = f"{file_id}{ext}"
    stored_path = UPLOAD_DIR / stored_name
    stored_path.write_bytes(content)
    mime = (file.content_type or "").split(";")[0].strip().lower() or EXT_MIME.get(ext, "application/octet-stream")
    meta = {
        "id": file_id,
        "kind": kind,
        "name": _safe_name(original),
        "mime": mime,
        "stored": stored_name,
        "size": len(content),
        "owner_id": getattr(current_user, "id", None),
    }
    _meta_path(file_id).write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return {
        "id": file_id,
        "kind": kind,
        "name": meta["name"],
        "mime": mime,
        "url": f"/assessment-media/{file_id}",
        "size": len(content),
    }


@router.get("/assessment-media/{file_id}")
async def get_assessment_media(file_id: str):
    if not FILE_ID_RE.fullmatch(file_id or ""):
        raise HTTPException(status_code=404, detail="Файл не найден")
    meta = _read_meta(file_id)
    stored = UPLOAD_DIR / str(meta.get("stored") or "")
    if not stored.is_file():
        raise HTTPException(status_code=404, detail="Файл не найден")
    filename = _safe_name(str(meta.get("name") or "файл"))
    return FileResponse(
        path=stored,
        media_type=str(meta.get("mime") or "application/octet-stream"),
        filename=filename,
        content_disposition_type="inline",
    )
