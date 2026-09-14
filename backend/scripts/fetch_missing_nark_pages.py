"""
Точечная догрузка квалификаций НАРК по проблемным страницам списка.

1) аудит всех 405 страниц (asc + desc);
2) повторная загрузка только пустых/«слабых» страниц;
3) загрузка карточек, которых нет в БД.

Запуск (cmd.exe):
  cd backend
  venv\\Scripts\\python.exe scripts\\fetch_missing_nark_pages.py

Только аудит страниц (без карточек):
  venv\\Scripts\\python.exe scripts\\fetch_missing_nark_pages.py --pages-only

Без фильтров ОПД/СПК (только страницы):
  venv\\Scripts\\python.exe scripts\\fetch_missing_nark_pages.py --skip-filters
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.qualifications_parser import (
    complete_index_from_missing_pages,
    fetch_missing_qualifications,
    find_missing_qualification_links,
    get_qualification_stats,
    _session,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Точечная догрузка квалификаций НАРК по страницам списка"
    )
    parser.add_argument(
        "--pages-only",
        action="store_true",
        help="Только аудит/догрузка страниц, без карточек",
    )
    parser.add_argument(
        "--skip-filters",
        action="store_true",
        help="Не использовать фильтры ОПД/СПК после обхода страниц",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.15,
        help="Пауза между карточками, сек",
    )
    args = parser.parse_args()

    before = get_qualification_stats()
    print(f"В БД до запуска: {before['local_count']}")

    if args.pages_only:
        report = complete_index_from_missing_pages(_session(), merge_cache=True)
        gap = find_missing_qualification_links(rediscover=False)
        print(
            f"\nИндекс: {gap['site_count']}, дыра: {gap.get('index_gap', 0)}, "
            f"не хватает в БД: {gap['missing_count']}"
        )
        print(f"Пустые страницы (asc): {report.get('empty_pages_asc', [])}")
        return 0

    result = fetch_missing_qualifications(
        save=True,
        delay=args.delay,
        rediscover=True,
        use_areas=not args.skip_filters,
        use_spks=not args.skip_filters,
        skip_page_audit=False,
    )

    after = get_qualification_stats()
    print(
        f"\nИтог: БД {before['local_count']} → {after['local_count']}, "
        f"индекс {result.get('site_count')}, "
        f"дыра в индексе {result.get('index_gap', 0)}"
    )

    if result.get("failed"):
        print(f"Ошибок карточек: {len(result['failed'])}")
        for item in result["failed"][:10]:
            print(f"  {item['code']}: {item.get('error')}")

    if result.get("index_gap", 0) > 0:
        print(
            "\nИндекс всё ещё неполный — запустите скрипт ещё раз "
            "(сайт иногда отдаёт пустые страницы)."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
