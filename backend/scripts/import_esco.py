"""
Загрузка занятий ESCO v1.2 в локальную SQLite.

Навыки подтягиваются при выборе занятия на шаге 9 (essential/optional).
Полный проход по алфавиту занимает несколько минут и требует сеть.

Запуск из backend (cmd):
  venv\\Scripts\\python.exe scripts\\import_esco.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.esco_registry import import_occupations, status


def main() -> int:
    session = SessionLocal()
    try:
        before = status(session)
        print(f"ESCO до загрузки: занятий {before['occupations']}, навыков {before['skills']}")
        print("Качаю занятия ESCO v1.2 через официальный API…")
        after = import_occupations(session)
        print(
            f"Готово: занятий {after['occupations']}, навыков {after['skills']}, "
            f"связей {after['relations']}"
        )
        return 0
    except Exception as exc:
        print(f"Ошибка загрузки ESCO: {exc}")
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
