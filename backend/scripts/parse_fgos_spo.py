"""
Парсинг ФГОС с classinform.ru.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\parse_fgos_spo.py --save-db
  venv\\Scripts\\python.exe scripts\\parse_fgos_spo.py --save-db --category bachelor
  venv\\Scripts\\python.exe scripts\\parse_fgos_spo.py --save-db --remaining

Или: run-parse-fgos.bat / run-parse-fgos-remaining.bat
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.fgos_registry import FGOS_CATEGORY_IDS
from app.fgos_parser import (
    DEFAULT_JSON,
    fetch_all_fgos,
    fetch_all_fgos_remaining,
    fetch_all_fgos_spo,
    get_fgos_stats,
    get_fgos_stats_by_category,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Парсинг ФГОС (classinform.ru)")
    parser.add_argument("--save-db", action="store_true", help="Сохранить в SQLite")
    parser.add_argument("--links-only", action="store_true", help="Только индекс ссылок")
    parser.add_argument("--output", default=None, help="JSON-файл результата")
    parser.add_argument("--delay", type=float, default=0.4, help="Пауза между запросами (с)")
    parser.add_argument(
        "--category",
        choices=sorted(FGOS_CATEGORY_IDS),
        help="Категория ФГОС (spo, bachelor, master, …)",
    )
    parser.add_argument(
        "--remaining",
        action="store_true",
        help="Парсить все разделы кроме СПО",
    )
    args = parser.parse_args()

    before = get_fgos_stats_by_category()
    print(f"В БД до загрузки: {before}")

    if args.remaining:
        fetch_all_fgos_remaining(
            save_db=args.save_db,
            links_only=args.links_only,
            delay_sec=args.delay,
        )
    elif args.category:
        fetch_all_fgos(
            args.category,
            save_db=args.save_db,
            output_file=args.output,
            links_only=args.links_only,
            delay_sec=args.delay,
        )
    else:
        fetch_all_fgos_spo(
            save_db=args.save_db,
            output_file=args.output or DEFAULT_JSON,
            links_only=args.links_only,
            delay_sec=args.delay,
        )

    if args.save_db and not args.links_only:
        after = get_fgos_stats_by_category()
        stats = get_fgos_stats()
        print(f"В БД после загрузки: {after} (всего {stats['local_count']})")


if __name__ == "__main__":
    main()
