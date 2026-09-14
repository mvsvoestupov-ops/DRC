"""
Загрузка ПС 40.104 (рег. 545) с Минтруда и пересвязка квалификаций 10.10400.*.

На НАРК код квалификации начинается с 10.104, а код профстандарта — 40.104.
Если ПС уже в БД — только пересвязка.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\load_ps_40104_and_relink.py
"""
from __future__ import annotations

import os
import sys
import warnings

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.classinform_parser import load_ps_from_classinform
from app.db import SessionLocal
from app.db.qualifications_models import Qualification
from app.db.raw_models import StandardRaw
from app.parser import find_element_id_by_reg_number, download_bulk_xml_chunk, parse_bulk_xml
from app.db_operations import save_raw_standard
from app.qualification_links import relink_all_qualifications

PS_CODE = "40.104"
REG_NUMBER = "545"
QUAL_PREFIX = "10.104"


def ensure_ps() -> StandardRaw | None:
    session = SessionLocal()
    try:
        existing = (
            session.query(StandardRaw)
            .filter(
                (StandardRaw.ps_code == PS_CODE) | (StandardRaw.reg_number == REG_NUMBER)
            )
            .first()
        )
        if existing:
            print(f"Уже в БД: id={existing.id} reg={existing.reg_number} {existing.ps_code} «{existing.name}»")
            return existing
    finally:
        session.close()

    print(f"Загрузка {PS_CODE} (reg={REG_NUMBER}) с Минтруда...")
    warnings.filterwarnings("ignore", message="Unverified HTTPS request")
    eid = find_element_id_by_reg_number(REG_NUMBER, ps_code=PS_CODE, order_number="593н")
    if eid:
        print(f"  ELEMENT_ID={eid}")
        xml_path = os.path.join(BACKEND_DIR, "downloads", f"standards_{REG_NUMBER}_{eid}.xml")
        os.makedirs(os.path.dirname(xml_path), exist_ok=True)
        download_bulk_xml_chunk([eid], xml_path)
        standards = parse_bulk_xml(xml_path, element_ids=[eid])
        if standards:
            std = standards[0]
            std.ps_code = PS_CODE
            session = SessionLocal()
            try:
                save_raw_standard(session, std, eid)
                loaded = session.query(StandardRaw).filter(StandardRaw.reg_number == REG_NUMBER).first()
                print(f"  OK Минтруд: {loaded.ps_code} «{loaded.name}»")
                return loaded
            finally:
                session.close()

    print("  Минтруд не сработал, пробуем classinform...")
    if load_ps_from_classinform(PS_CODE, reg_number=REG_NUMBER):
        session = SessionLocal()
        try:
            return session.query(StandardRaw).filter(StandardRaw.ps_code == PS_CODE).first()
        finally:
            session.close()

    print("  ✗ Не удалось загрузить ПС")
    return None


def main() -> int:
    ensure_ps()
    print("\nПересвязка квалификаций...")
    session = SessionLocal()
    try:
        result = relink_all_qualifications(session, update_existing=True, commit=True)
        print(f"Связано: {result.linked}, без ПС: {result.not_found}")
        linked = (
            session.query(Qualification)
            .filter(Qualification.code.like(f"{QUAL_PREFIX}%"))
            .all()
        )
        print(f"\nКвалификации {QUAL_PREFIX}*:")
        for q in linked:
            print(f"  {q.code} → ps_id={q.prof_standard_id} | {(q.name or '')[:60]}")
    finally:
        session.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
