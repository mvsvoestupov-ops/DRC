"""
Разбор перечня приказа №534 и загрузка в БД.

Пример:
  cd backend
  venv\\Scripts\\python.exe scripts\\import_prof_training_professions.py ^
    "C:\\Users\\Mihail\\.cursor\\projects\\c-IT-DRC\\agent-tools\\8c6234e2-715b-463a-ae4c-34d562689ae1.txt"
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import Base, SessionLocal, engine
from app.db.prof_training_models import ProfTrainingProfession  # noqa: F401
from app.prof_training_registry import (
    parse_order_534_markdown,
    sync_prof_training_professions,
    write_seed_json,
)


def main() -> int:
    Base.metadata.create_all(bind=engine)

    src = sys.argv[1] if len(sys.argv) > 1 else None
    if not src or not os.path.isfile(src):
        print("Укажите путь к markdown/тексту приказа №534")
        print("  python scripts/import_prof_training_professions.py <path>")
        return 1

    text = open(src, encoding="utf-8").read()
    items = parse_order_534_markdown(text)
    if not items:
        print("Не удалось разобрать ни одной записи")
        return 2

    seed_path = write_seed_json(items)
    print(f"JSON: {seed_path} ({len(items)} записей)")

    session = SessionLocal()
    try:
        result = sync_prof_training_professions(session, items, replace=True)
    finally:
        session.close()

    out_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(out_dir, exist_ok=True)
    out_json = os.path.join(out_dir, "prof_training_import_report.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"БД: total={result['total']} active={result['active']} inactive={result['inactive']}")
    print(f"Отчёт: {out_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
