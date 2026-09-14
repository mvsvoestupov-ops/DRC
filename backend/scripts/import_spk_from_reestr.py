"""
Импорт СПК для профстандартов из Reestr_PS.xlsx (колонка «Ответственная организация»).

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\import_spk_from_reestr.py
  venv\\Scripts\\python.exe scripts\\import_spk_from_reestr.py C:\\IT\\DRC\\Reestr_PS.xlsx
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.db.schema import ensure_spk_columns
from app.spk_registry import sync_spk_from_reestr_xlsx


def main() -> int:
    for col in ensure_spk_columns():
        print(f"DB migration: added column {col}")

    path = sys.argv[1] if len(sys.argv) > 1 else None
    session = SessionLocal()
    try:
        result = sync_spk_from_reestr_xlsx(session, path)
    finally:
        session.close()

    out_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(out_dir, exist_ok=True)
    out_json = os.path.join(out_dir, "spk_import_report.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"XLSX: {result['xlsx_path']}")
    print(f"Строк в файле: {result['xlsx_rows']}")
    print(f"Обновлено в БД: {result['updated']}")
    print(f"Без изменений: {result['unchanged']}")
    print(f"Нет в БД: {len(result['missing_in_db'])}")
    print(f"Уникальных СПК: {result['unique_spk_in_xlsx']}")
    print("\nРаспределение по СПК:")
    for name, count in result["spk_counts"].items():
        label = name if len(name) <= 72 else name[:69] + "..."
        print(f"  {count:4d}  {label}")
    print(f"\nОтчёт: {out_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
