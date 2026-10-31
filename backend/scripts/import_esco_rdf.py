"""
Импорт ESCO v1.2 из локального RDF (ESCO/esco-v1.2.0.rdf) в SQLite.

Нужен для офлайн-поиска на шаге 9.2 (ТФ/ТД ↔ ESCO). Файл RDF в git не хранится.

Запуск из backend:
  venv\\Scripts\\python.exe scripts\\import_esco_rdf.py
  venv\\Scripts\\python.exe scripts\\import_esco_rdf.py --clear
  venv\\Scripts\\python.exe scripts\\import_esco_rdf.py --path ..\\ESCO\\esco-v1.2.0.rdf
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.esco_rdf_import import default_rdf_path, import_esco_rdf


def main() -> int:
    parser = argparse.ArgumentParser(description="Import ESCO RDF into local SQLite cache")
    parser.add_argument("--path", default="", help="Path to esco-v1.2.0.rdf")
    parser.add_argument("--clear", action="store_true", help="Clear existing ESCO tables first")
    args = parser.parse_args()

    path = args.path.strip() or str(default_rdf_path())
    print(f"Источник: {path}")
    session = SessionLocal()
    try:
        def on_progress(info: dict) -> None:
            if info.get("ok"):
                return
            print(
                f"  … занятий≈{info.get('occupations', 0)}, "
                f"навыков≈{info.get('skills', 0)}, "
                f"связей≈{info.get('relations', 0)}, "
                f"concepts={info.get('concepts', 0)}"
            )

        result = import_esco_rdf(
            session,
            path,
            clear_existing=bool(args.clear),
            progress=on_progress,
        )
        print(
            f"Готово: занятий {result['occupations']}, навыков {result['skills']}, "
            f"связей {result['relations']} (source={result['source']}); "
            f"blobs={result.get('blobs')}, parsed={result.get('parsed')}, "
            f"concepts={result.get('concepts')}"
        )
        return 0
    except Exception as exc:
        print(f"Ошибка импорта ESCO RDF: {exc}")
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
