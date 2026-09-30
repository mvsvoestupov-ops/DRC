"""
Публикует примеры RUS-PK-0019 и RUS-PK-0020 в текущую БД (upsert по коду/имени).
Не перезаписывает файл БД и не трогает остальные компетенции.

Запуск из backend:
  venv/bin/python scripts/seed_example_competences.py
  venv\\Scripts\\python.exe scripts\\seed_example_competences.py
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.competence_profile import build_formation_profile, merge_raw_data
from app.db import SessionLocal
from app.db.competence_models import Competence, CompetenceStatus
from app.db.fgos_models import FgosSpo
from app.db.raw_models import StandardRaw
from app.db.user_models import User
from app.reference_data import normalize_descriptors

DATA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "app",
    "data",
    "example_competences_legal.json",
)


def _status(value: str) -> CompetenceStatus:
    try:
        return CompetenceStatus(value)
    except ValueError:
        return CompetenceStatus.APPROVED


def _find_standard(session, reg_number: str | None) -> StandardRaw | None:
    if not reg_number:
        return None
    found = (
        session.query(StandardRaw)
        .filter(StandardRaw.reg_number == str(reg_number))
        .first()
    )
    if found:
        return found
    found = (
        session.query(StandardRaw)
        .filter(StandardRaw.reg_number.like(f"%{reg_number}"))
        .first()
    )
    if found:
        return found
    return (
        session.query(StandardRaw)
        .filter(StandardRaw.name.ilike("%Специалист по конкурентному праву%"))
        .first()
    )


def _find_fgos(session, code: str | None, category: str | None) -> FgosSpo | None:
    if not code:
        return None
    try:
        q = session.query(FgosSpo).filter(FgosSpo.code == code)
        if category:
            found = q.filter(FgosSpo.category == category).first()
            if found:
                return found
        return q.first()
    except Exception as exc:
        print(f"WARNING: ФГОС {code} не прочитан ({exc})")
        return None


def _admin_id(session) -> int | None:
    user = session.query(User).filter(User.email == "admin@aonk.ru").first()
    if user:
        return user.id
    row = session.query(User).order_by(User.id.asc()).first()
    return row.id if row else None


def _remap_labor_functions(session, items: list) -> list:
    out = []
    for item in items or []:
        row = dict(item)
        reg = row.get("standard_reg_number")
        std = _find_standard(session, reg)
        if std:
            row["standard_id"] = std.id
            row["standard_reg_number"] = std.reg_number
            row["standard_name"] = std.name or row.get("standard_name")
        out.append(row)
    return out


def _claim_public_code(session, code: str, keep_id: int | None) -> None:
    q = session.query(Competence).filter(Competence.public_code == code)
    if keep_id:
        q = q.filter(Competence.id != keep_id)
    other = q.first()
    if not other:
        return
    other.public_code = f"RUS-PK-{int(other.id):04d}-moved"
    session.flush()


def _find_row(session, public_code: str, name: str) -> Competence | None:
    by_code = session.query(Competence).filter(Competence.public_code == public_code).first()
    if by_code:
        return by_code
    return session.query(Competence).filter(Competence.name == name).first()


def _raw_data(item: dict, fgos: FgosSpo | None, seed_tag: str) -> dict:
    kind = item.get("competence_kind") or "professional"
    formation_profile = build_formation_profile(
        competence_kind=kind,
        qualification_level=item.get("qualification_level"),
        universal_skills=item.get("universal_skills") or [],
    )
    raw = merge_raw_data(
        None,
        description=item.get("description") or "",
        industry=item.get("industry") or "",
        hours=str(item.get("hours") or ""),
        formation_profile=formation_profile,
        professional_area_code=item.get("professional_area_code") or "",
    )
    raw["education_level"] = item.get("education_level") or ""
    raw["education_kind"] = item.get("education_kind") or ""
    raw["seed_tag"] = seed_tag
    if item.get("expertise"):
        raw["expertise"] = item["expertise"]
    if item.get("international_mapping"):
        raw["international_mapping"] = item["international_mapping"]
    if fgos:
        raw["fgos_id"] = fgos.id
        raw["fgos_code"] = fgos.code
        raw["fgos_name"] = fgos.name
        raw["fgos_category"] = fgos.category
    else:
        raw["fgos_code"] = item.get("fgos_code") or ""
        raw["fgos_name"] = item.get("fgos_name") or ""
        raw["fgos_category"] = item.get("fgos_category") or ""
    return raw


def upsert_item(session, item: dict, seed_tag: str, admin_id: int | None) -> str:
    public_code = item["public_code"]
    name = item["name"]
    std = _find_standard(session, item.get("standard_reg_number"))
    fgos = _find_fgos(session, item.get("fgos_code"), item.get("fgos_category"))
    labor = _remap_labor_functions(session, item.get("labor_functions") or [])
    kind = item.get("competence_kind") or "professional"
    if kind == "professional" and not std:
        print(f"WARNING {public_code}: ПС рег. {item.get('standard_reg_number')} не найден, пишу без привязки")

    row = _find_row(session, public_code, name)
    created = row is None
    if created:
        row = Competence(name=name, is_active=1)
        session.add(row)
        session.flush()

    _claim_public_code(session, public_code, row.id)
    row.public_code = public_code
    row.name = name
    row.qualification_name = item.get("qualification_name") or name
    row.qualification_level = str(item.get("qualification_level") or "6")
    row.prof_standard_id = std.id if std else None
    row.labor_functions = labor
    row.structure = item.get("structure") or {"A": [], "B": [], "C": []}
    row.descriptors = normalize_descriptors(item.get("descriptors") or {})
    row.discipline_mapping = item.get("discipline_mapping") or []
    row.ed_technologies = item.get("ed_technologies") or []
    row.assessment_tools = item.get("assessment_tools") or []
    row.resources = item.get("resources") or []
    row.developer = item.get("developer") or "Национальный реестр компетенций"
    row.validator = item.get("validator")
    row.status = _status(item.get("status") or "утверждена")
    row.is_active = 1
    row.raw_data = _raw_data(item, fgos, seed_tag)
    row.updated_at = datetime.utcnow()
    if admin_id and not row.user_id:
        row.user_id = admin_id
    action = "created" if created else "updated"
    print(f"{action} {public_code} id={row.id}")
    return action


def main() -> int:
    with open(DATA_PATH, encoding="utf-8") as fh:
        payload = json.load(fh)
    seed_tag = payload.get("seed_tag") or "example_legal_v1"
    session = SessionLocal()
    try:
        admin_id = _admin_id(session)
        for item in payload["items"]:
            upsert_item(session, item, seed_tag, admin_id)
        session.commit()
        print("OK: example competences seeded")
        return 0
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
