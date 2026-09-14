"""
Догрузка квалификаций НАРК с суффиксом из 3+ цифр (40.20900.100–310).

Старый regex \\d{2} обрезал 40.20900.100 → 40.20900.10, поэтому ~211 кодов
не попадали в индекс и скрипт писал «Нечего загружать».

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\fetch_nark_long_suffix.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.qualifications_parser import (
    get_qualification_stats,
    recover_long_suffix_and_fetch,
)


def main() -> int:
    before = get_qualification_stats()
    print(f"В БД до запуска: {before['local_count']}")
    result = recover_long_suffix_and_fetch(save=True)
    failed = result.get("failed") or []
    if failed:
        print(f"Ошибок карточек: {len(failed)}")
        for item in failed[:15]:
            print(f"  {item.get('code')}: {item.get('error')}")
        if not result.get("processed"):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
