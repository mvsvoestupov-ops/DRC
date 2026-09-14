"""
Перепарсинг образовательных квалификаций и привязанных ОК/ПК для ФГОС уже в БД.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\reparse_fgos_tracks.py

Один код:
  venv\\Scripts\\python.exe scripts\\reparse_fgos_tracks.py --code 08.02.02
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.fgos_parser import reparse_fgos_qualification_tracks


def main() -> None:
    parser = argparse.ArgumentParser(description="Перепарсинг qualification_tracks ФГОС")
    parser.add_argument("--code", action="append", help="Код специальности (можно несколько раз)")
    args = parser.parse_args()
    result = reparse_fgos_qualification_tracks(codes=args.code or None)
    print(f"Обновлено: {result['updated']}, пропущено: {result['skipped']}, ошибок: {result['failed']}")


if __name__ == "__main__":
    main()
