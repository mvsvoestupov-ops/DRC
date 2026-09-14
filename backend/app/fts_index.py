"""Полнотекстовый индекс профстандартов для поиска."""
from __future__ import annotations

import re

from sqlalchemy import text

from .db import SessionLocal
from .db.raw_models import StandardRaw

_FTS_TOKEN_RE = re.compile(r"[\w\d]+", flags=re.UNICODE)


def build_fts_match_query(text: str) -> str:
    """Безопасный MATCH для FTS5: префиксный поиск по каждому токену."""
    tokens = [t for t in _FTS_TOKEN_RE.findall(text or "") if len(t) >= 2]
    if not tokens:
        cleaned = (text or "").replace('"', '""').strip()
        return f'"{cleaned}"*' if cleaned else ""
    return " ".join(f'"{token}"*' for token in tokens)


def area_filter_clause(area_code: str, *, alias: str = "rs") -> tuple[str, dict[str, str]]:
    """Фильтр по области: professional_area_code или префикс ps_code (XX.)."""
    code = area_code.zfill(2)
    return (
        f" AND ({alias}.professional_area_code = :area OR {alias}.ps_code LIKE :area_ps_prefix)",
        {"area": code, "area_ps_prefix": f"{code}.%"},
    )


def ensure_fts_populated(force: bool = False) -> int:
    """Заполняет fts_standards, если таблица пуста. Возвращает число проиндексированных записей."""
    session = SessionLocal()
    try:
        count = session.execute(text("SELECT COUNT(*) FROM fts_standards")).scalar() or 0
        if count > 0 and not force:
            return int(count)

        if force:
            session.execute(text("DELETE FROM fts_standards"))
            session.commit()

        standards = session.query(StandardRaw).all()
        for std in standards:
            texts: list[str] = []
            for gf in std.generalized_functions:
                if gf.name:
                    texts.append(gf.name)
                for pf in gf.particular_functions:
                    if pf.name:
                        texts.append(pf.name)
                    for la in pf.labor_actions:
                        if la.text:
                            texts.append(la.text)
            labor_text = " ".join(texts)
            session.execute(
                text("""
                    INSERT INTO fts_standards (standard_id, name, kind_activity, purpose, labor_functions_text)
                    VALUES (:sid, :name, :kind, :purpose, :labor)
                """),
                {
                    "sid": std.id,
                    "name": std.name or "",
                    "kind": std.kind_activity or "",
                    "purpose": std.purpose or "",
                    "labor": labor_text,
                },
            )
        session.commit()
        session.execute(text("INSERT INTO fts_standards_fts(fts_standards_fts) VALUES('rebuild')"))
        session.commit()
        return len(standards)
    finally:
        session.close()
