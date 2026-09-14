"""
Переименовать коды квалификаций 10.104xx.xx → 40.104xx.xx.

На НАРК ошибочно/устаревше указан префикс 10.104, актуальный код ПС — 40.104.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\fix_qual_codes_10104_to_40104.py
"""
from __future__ import annotations

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.db import SessionLocal
from app.db.qualifications_models import Qualification


OLD_PREFIX = "10.104"
NEW_PREFIX = "40.104"


def fix_qualification_codes_10104_to_40104(session=None) -> dict:
    own = session is None
    if own:
        session = SessionLocal()
    try:
        quals = (
            session.query(Qualification)
            .filter(Qualification.code.like(f"{OLD_PREFIX}%"))
            .order_by(Qualification.code)
            .all()
        )
        updated: list[dict] = []
        skipped: list[dict] = []
        for q in quals:
            old_code = q.code or ""
            if not old_code.startswith(OLD_PREFIX):
                continue
            new_code = NEW_PREFIX + old_code[len(OLD_PREFIX) :]
            conflict = (
                session.query(Qualification.id)
                .filter(Qualification.code == new_code, Qualification.id != q.id)
                .first()
            )
            if conflict:
                skipped.append(
                    {
                        "id": q.id,
                        "old_code": old_code,
                        "new_code": new_code,
                        "reason": f"код уже занят id={conflict[0]}",
                    }
                )
                continue
            q.code = new_code
            updated.append({"id": q.id, "old_code": old_code, "new_code": new_code})
        session.commit()
        return {
            "status": "ok",
            "updated": updated,
            "skipped": skipped,
            "updated_count": len(updated),
            "skipped_count": len(skipped),
        }
    except Exception:
        session.rollback()
        raise
    finally:
        if own:
            session.close()


def main() -> int:
    result = fix_qualification_codes_10104_to_40104()
    print(f"Обновлено: {result['updated_count']}")
    for row in result["updated"]:
        print(f"  {row['old_code']} → {row['new_code']}")
    if result["skipped"]:
        print(f"Пропущено: {result['skipped_count']}")
        for row in result["skipped"]:
            print(f"  {row['old_code']}: {row['reason']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
