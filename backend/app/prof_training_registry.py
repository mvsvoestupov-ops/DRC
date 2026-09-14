"""
Перечень профессий рабочих / должностей служащих для профессионального обучения
(приказ Минпросвещения России от 14.07.2023 № 534, ред. от 25.06.2026).

Источник: https://docs.cntd.ru/document/1302339887
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from .db.prof_training_models import ProfTrainingProfession

DATA_PATH = Path(__file__).resolve().parent / "data" / "prof_training_professions.json"
MARKDOWN_CANDIDATES = (
    Path(__file__).resolve().parent / "data" / "order_534_source.md",
    Path(r"C:\Users\Mihail\.cursor\projects\c-IT-DRC\agent-tools\8c6234e2-715b-463a-ae4c-34d562689ae1.txt"),
)

SOURCE_URL = "https://docs.cntd.ru/document/1302339887"
SOURCE_ORDER = "Приказ Минпросвещения России от 14.07.2023 № 534"

CATEGORY_WORKER = "worker"
CATEGORY_EMPLOYEE = "employee"

CATEGORY_LABELS = {
    CATEGORY_WORKER: "Профессии рабочих",
    CATEGORY_EMPLOYEE: "Должности служащих",
}

ROW_RE = re.compile(
    r"^\|\s*(\d+(?:\(\d+\))?)\.\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|?\s*$"
)
REVOKED_RE = re.compile(
    r"^\|\s*(\d+(?:\(\d+\))?)\.\s*(Строка утратила силу\.?)\s*\|\s*\|?\s*\|?\s*\|?\s*$",
    re.IGNORECASE,
)
HEADER_RE = re.compile(r"^\|\s*([^|]+?)\s*\|\s*\|\s*\|\s*\|?\s*$")
EDIT_NOTE_RE = re.compile(r"^\|\s*\(в ред\.", re.IGNORECASE)
SKIP_NOTE_RE = re.compile(
    r"В электронном документе|нумерация строк",
    re.IGNORECASE,
)

_items_cache: list[dict[str, Any]] | None = None


def _serialize_row(r: ProfTrainingProfession) -> dict[str, Any]:
    return {
        "id": r.id,
        "item_number": r.item_number,
        "sort_order": r.sort_order,
        "name": r.name,
        "category": r.category,
        "category_label": CATEGORY_LABELS.get(r.category, r.category),
        "section": r.section,
        "okpdtr_code": r.okpdtr_code,
        "qualification_rank": r.qualification_rank,
        "is_active": r.is_active,
    }


def _normalize_item(item: dict[str, Any], index: int) -> dict[str, Any]:
    category = item.get("category") or CATEGORY_WORKER
    sort_order = int(item.get("sort_order") or index + 1)
    return {
        "id": int(item.get("id") or sort_order),
        "item_number": str(item.get("item_number") or sort_order),
        "sort_order": sort_order,
        "name": item.get("name") or "",
        "category": category,
        "category_label": CATEGORY_LABELS.get(category, category),
        "section": item.get("section"),
        "okpdtr_code": item.get("okpdtr_code"),
        "qualification_rank": item.get("qualification_rank"),
        "is_active": int(item.get("is_active", 1)),
    }


def invalidate_prof_training_cache() -> None:
    global _items_cache
    _items_cache = None


def warm_prof_training_cache(session: Session | None = None) -> int:
    """Кэш в памяти: сначала JSON-сид, иначе БД. Поиск по перечню не ходит в SQLite."""
    global _items_cache
    items = [_normalize_item(row, i) for i, row in enumerate(load_seed_items())]
    if not items and session is not None:
        items = [_serialize_row(r) for r in session.query(ProfTrainingProfession).all()]
    _items_cache = items
    return len(items)


def _norm_cell(value: str | None) -> str | None:
    text = (value or "").strip()
    if not text or text == "-":
        return None
    return text


def parse_order_534_markdown(text: str) -> list[dict[str, Any]]:
    """Разбор markdown-таблицы перечня из приказа №534."""
    items: list[dict[str, Any]] = []
    category = CATEGORY_WORKER
    section: str | None = None
    sort_order = 0

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line.startswith("|"):
            continue
        if line.startswith("| ---") or "N п/п" in line:
            continue
        if EDIT_NOTE_RE.match(line) or SKIP_NOTE_RE.search(line):
            continue

        revoked = REVOKED_RE.match(line)
        if revoked:
            sort_order += 1
            items.append(
                {
                    "item_number": revoked.group(1),
                    "sort_order": sort_order,
                    "name": revoked.group(2).rstrip("."),
                    "category": category,
                    "section": section,
                    "okpdtr_code": None,
                    "qualification_rank": None,
                    "is_active": 0,
                }
            )
            continue

        row = ROW_RE.match(line)
        if row:
            name = _norm_cell(row.group(2))
            if not name:
                continue
            sort_order += 1
            active = 0 if "утратила силу" in name.lower() else 1
            items.append(
                {
                    "item_number": row.group(1),
                    "sort_order": sort_order,
                    "name": name.rstrip(".") if not active else name,
                    "category": category,
                    "section": section,
                    "okpdtr_code": _norm_cell(row.group(3)),
                    "qualification_rank": _norm_cell(row.group(4)),
                    "is_active": active,
                }
            )
            continue

        header = HEADER_RE.match(line)
        if not header:
            continue
        title = header.group(1).strip()
        lower = title.lower()
        if "профессии рабочих" in lower:
            category = CATEGORY_WORKER
            section = None
            continue
        if "должности служащих" in lower:
            category = CATEGORY_EMPLOYEE
            section = None
            continue
        if title and not title.startswith("("):
            section = title

    return items


def load_seed_items(path: Path | None = None) -> list[dict[str, Any]]:
    data_path = path or DATA_PATH
    if not data_path.is_file():
        return []
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        return list(payload.get("items") or [])
    if isinstance(payload, list):
        return payload
    return []


def load_items_from_markdown(path: Path | None = None) -> list[dict[str, Any]]:
    candidates = [path] if path else list(MARKDOWN_CANDIDATES)
    for candidate in candidates:
        if candidate and candidate.is_file():
            return parse_order_534_markdown(candidate.read_text(encoding="utf-8"))
    return []


def write_seed_json(items: list[dict[str, Any]], path: Path | None = None) -> Path:
    data_path = path or DATA_PATH
    data_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source_url": SOURCE_URL,
        "source_order": SOURCE_ORDER,
        "revision": "2026-06-25",
        "count": len(items),
        "active_count": sum(1 for i in items if i.get("is_active", 1)),
        "items": items,
    }
    data_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return data_path


def sync_prof_training_professions(
    session: Session,
    items: list[dict[str, Any]] | None = None,
    *,
    replace: bool = True,
) -> dict[str, Any]:
    """Загрузка перечня в БД. По умолчанию полная замена."""
    rows = items if items is not None else load_seed_items()
    if not rows:
        rows = load_items_from_markdown()
        if rows:
            write_seed_json(rows)
    if not rows:
        return {"status": "empty", "total": 0, "active": 0, "inactive": 0}

    if replace:
        session.query(ProfTrainingProfession).delete()
        session.commit()

    for row in rows:
        session.add(
            ProfTrainingProfession(
                item_number=str(row.get("item_number") or row.get("seq")),
                sort_order=int(row.get("sort_order") or row.get("seq") or 0),
                name=row["name"],
                category=row.get("category") or CATEGORY_WORKER,
                section=row.get("section"),
                okpdtr_code=row.get("okpdtr_code"),
                qualification_rank=row.get("qualification_rank"),
                is_active=int(row.get("is_active", 1)),
                source="minprosveshcheniya_534",
            )
        )
    session.commit()
    invalidate_prof_training_cache()
    warm_prof_training_cache(session)

    active = sum(1 for r in rows if int(r.get("is_active", 1)) == 1)
    return {
        "status": "ok",
        "total": len(rows),
        "active": active,
        "inactive": len(rows) - active,
        "source_url": SOURCE_URL,
        "source_order": SOURCE_ORDER,
    }


def import_prof_training_from_path(session: Session, path: str | Path) -> dict[str, Any]:
    source = Path(path)
    if not source.is_file():
        return {"status": "error", "detail": f"Файл не найден: {source}"}
    text = source.read_text(encoding="utf-8")
    items = parse_order_534_markdown(text)
    if not items:
        return {"status": "error", "detail": "Не удалось разобрать ни одной записи"}
    write_seed_json(items)

    # Пересоздаём таблицу — схема могла измениться (seq → item_number)
    from .db.base import Base
    from .db.session import engine

    ProfTrainingProfession.__table__.drop(engine, checkfirst=True)
    ProfTrainingProfession.__table__.create(engine, checkfirst=True)

    result = sync_prof_training_professions(session, items, replace=False)
    result["source_path"] = str(source)
    return result


def ensure_prof_training_seeded(session: Session) -> dict[str, Any]:
    """Если таблица пуста — загрузить из JSON-сида или markdown-источника."""
    count = session.query(ProfTrainingProfession).count()
    if count > 0:
        active = (
            session.query(ProfTrainingProfession)
            .filter(ProfTrainingProfession.is_active == 1)
            .count()
        )
        warm_prof_training_cache(session)
        return {"status": "exists", "total": count, "active": active}
    result = sync_prof_training_professions(session)
    warm_prof_training_cache(session)
    return result


def list_prof_training_professions(
    session: Session | None = None,
    *,
    q: str | None = None,
    category: str | None = None,
    section: str | None = None,
    only_active: bool = True,
    limit: int = 40,
    offset: int = 0,
) -> dict[str, Any]:
    if _items_cache is None:
        warm_prof_training_cache(session)

    items = list(_items_cache or [])
    if only_active:
        items = [item for item in items if int(item.get("is_active", 1)) == 1]
    if category in (CATEGORY_WORKER, CATEGORY_EMPLOYEE):
        items = [item for item in items if item.get("category") == category]
    if section:
        items = [item for item in items if item.get("section") == section]
    needle = (q or "").strip().lower()
    if needle:
        items = [
            item
            for item in items
            if needle in (item.get("name") or "").lower()
            or needle in (item.get("okpdtr_code") or "").lower()
            or needle in (item.get("section") or "").lower()
            or needle in str(item.get("item_number") or "").lower()
        ]

    total = len(items)
    page_size = min(max(1, limit), 200)
    page = items[max(0, offset) : max(0, offset) + page_size]
    return {
        "total": total,
        "items": page,
        "source_url": SOURCE_URL,
        "source_order": SOURCE_ORDER,
    }


def prof_training_sections(session: Session, *, only_active: bool = True) -> list[dict[str, Any]]:
    query = session.query(
        ProfTrainingProfession.category,
        ProfTrainingProfession.section,
    )
    if only_active:
        query = query.filter(ProfTrainingProfession.is_active == 1)
    rows = (
        query.group_by(ProfTrainingProfession.category, ProfTrainingProfession.section)
        .order_by(ProfTrainingProfession.category, ProfTrainingProfession.section)
        .all()
    )
    return [
        {
            "category": cat,
            "category_label": CATEGORY_LABELS.get(cat, cat),
            "section": section,
        }
        for cat, section in rows
        if section
    ]
