"""
Заполняет 6 столов SWOT правдоподобными демо-данными (4 темы × стол).
Привязка к admin@aonk.ru (или первому admin / первому пользователю).

Запуск из backend:
  venv/Scripts/python.exe -u scripts/seed_swot_demo.py
  ./venv/bin/python -u scripts/seed_swot_demo.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import ensure_swot_tables
from app.db.swot_seed import seed_swot_demo


def main() -> int:
    ensure_swot_tables()
    result = seed_swot_demo(force=True)
    print(result)
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
