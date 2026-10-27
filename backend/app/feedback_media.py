"""Вложения к обратной связи: изображения и текстовые документы."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .auth import get_current_admin, get_current_user
from .db.user_models import User

router = APIRouter()

BACKEND_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BACKEND_DIR / "uploads" / "feedback"

KIND_LIMITS = {
    "image": 10 * 1024 * 1024,
    "text": 15 * 1024 * 1024,
}

MIME_KIND = {
    "image/jpeg": "image",
    "image/png": "image",
    "image/gif": "image",
    "image/webp": "image",
    "text/plain": "text",
    "text/markdown": "text",
    "text/csv": "text",
    "application/rtf": "text",
    "text/rtf": "text",
    "application/msword": "text",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "text",
    "application/vnd.oasis.opendocument.text": "text",
    "application/pdf": "text",
}

EXT_KIND = {
    ".jpg": "image",
    ".jpeg": "image",
    ".png": "image",
    ".gif": "image",
    ".webp": "image",
    ".txt": "text",
    ".md": "text",
    ".csv": "text",
    ".rtf": "text",
    ".doc": "text",
    ".docx": "text",
    ".odt": "text",
    ".pdf": "text",
}

EXT_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".rtf": "application/rtf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".pdf": "application/pdf",
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


@router.post("/feedback-media")
async def upload_feedback_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    original = file.filename or "файл"
    kind = _kind_for(original, file.content_type)
    if not kind:
        raise HTTPException(
            status_code=400,
            detail="Допустимы изображения (JPEG, PNG, GIF, WebP) и текстовые документы (TXT, MD, CSV, RTF, DOC, DOCX, ODT, PDF).",
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
    (UPLOAD_DIR / stored_name).write_bytes(content)
    mime = (file.content_type or "").split(";")[0].strip().lower() or EXT_MIME.get(
        ext, "application/octet-stream"
    )
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
        "url": f"/feedback-media/{file_id}",
        "size": len(content),
    }


@router.get("/feedback-media/{file_id}")
async def get_feedback_media(
    file_id: str,
    current_user: User = Depends(get_current_admin),
):
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
