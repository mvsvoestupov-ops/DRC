"""
Адресная догрузка недостающих квалификаций с nok-nark.ru.

Полный обход page=1..405 после ~375 часто отдаёт пустые ответы.
Этот скрипт:
  1) собирает индекс кодов через короткие списки по ОПД и СПК;
  2) сравнивает с БД;
  3) качает только отсутствующие карточки по /pk/detail/{code}/.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\fetch_missing_qualifications.py

Только отчёт (без скачивания карточек):
  venv\\Scripts\\python.exe scripts\\fetch_missing_qualifications.py --report-only

Без повторного обхода фильтров (только кэш + БД):
  venv\\Scripts\\python.exe scripts\\fetch_missing_qualifications.py --from-cache
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.qualifications_parser import (
    _session,
    complete_index_from_missing_pages,
    discover_links_by_filters,
    fetch_missing_qualifications,
    find_missing_qualification_links,
    get_qualification_stats,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Адресная догрузка недостающих квалификаций НАРК"
    )
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="Только обновить индекс и отчёт missing_*, без карточек",
    )
    parser.add_argument(
        "--from-cache",
        action="store_true",
        help="Не обходить фильтры — взять кэш ссылок и сравнить с БД",
    )
    parser.add_argument(
        "--areas-only",
        action="store_true",
        help="Обходить только фильтр ОПД (без СПК)",
    )
    parser.add_argument(
        "--spks-only",
        action="store_true",
        help="Обходить только фильтр СПК (без ОПД)",
    )
    parser.add_argument(
        "--skip-filters",
        action="store_true",
        help="После обхода страниц не использовать фильтры ОПД/СПК",
    )
    parser.add_argument(
        "--skip-page-audit",
        action="store_true",
        help="Не выполнять аудит страниц 1–405 (только фильтры, старый режим)",
    )
    parser.add_argument(
        "--long-suffix-only",
        action="store_true",
        help="Только коды с суффиксом 3+ цифр (стр. 368–392, 40.20900.100–310)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.15,
        help="Пауза между карточками, сек (по умолчанию 0.15)",
    )
    args = parser.parse_args()

    use_areas = not args.spks_only
    use_spks = not args.areas_only
    if args.areas_only and args.spks_only:
        use_areas = use_spks = True

    before = get_qualification_stats()
    print(f"В БД до запуска: {before['local_count']}")

    if args.long_suffix_only:
        from app.qualifications_parser import recover_long_suffix_and_fetch

        result = recover_long_suffix_and_fetch(save=True, delay=args.delay)
        failed = result.get("failed") or []
        if failed and not result.get("processed"):
            sys.exit(1)
        return

    if args.report_only:
        if args.from_cache:
            gap = find_missing_qualification_links(rediscover=False)
        elif args.skip_page_audit:
            discover_links_by_filters(use_areas=use_areas, use_spks=use_spks)
            gap = find_missing_qualification_links(rediscover=False)
        else:
            complete_index_from_missing_pages(_session(), merge_cache=True)
            if not args.skip_filters:
                discover_links_by_filters(
                    use_areas=use_areas,
                    use_spks=use_spks,
                    skip_full_list=True,
                )
            gap = find_missing_qualification_links(rediscover=False)
        print(
            f"Ожидается: {gap.get('expected_site_count', 4049)}\n"
            f"Индекс: {gap['site_count']}, дыра в индексе: {gap.get('index_gap', 0)}\n"
            f"БД: {gap['db_count']}, не хватает в БД: {gap['missing_count']}"
        )
        if gap["missing_codes"][:20]:
            print("Первые отсутствующие:")
            for code in gap["missing_codes"][:20]:
                print(f"  {code}")
        return

    result = fetch_missing_qualifications(
        save=True,
        delay=args.delay,
        rediscover=not args.from_cache,
        use_areas=use_areas,
        use_spks=use_spks,
        skip_page_audit=args.skip_page_audit,
    )

    if result.get("failed"):
        print(f"\nОшибок карточек: {len(result['failed'])}")
        for item in result["failed"][:15]:
            print(f"  {item['code']}: {item.get('error')}")
        # частичный успех — не фатальный exit
        if not result.get("processed"):
            sys.exit(1)


if __name__ == "__main__":
    main()
