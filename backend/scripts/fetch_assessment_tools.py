"""
Загрузка оценочных средств с nok-nark.ru и связь с квалификациями.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\fetch_assessment_tools.py

Только недостающие:
  venv\\Scripts\\python.exe scripts\\fetch_assessment_tools.py --only-missing

Только индекс ссылок:
  venv\\Scripts\\python.exe scripts\\fetch_assessment_tools.py --links-only
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.os_parser import (
    crawl_os_list,
    fetch_all_assessment_tools,
    get_assessment_tool_stats,
    link_assessment_tools_to_qualifications,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Загрузка оценочных средств НАРК")
    parser.add_argument("--only-missing", action="store_true", help="Только отсутствующие в БД")
    parser.add_argument("--links-only", action="store_true", help="Только сбор ссылок")
    parser.add_argument("--relink-only", action="store_true", help="Только пересвязать с квалификациями")
    parser.add_argument("--from-cache", action="store_true", help="Не перечитывать список, взять кэш")
    args = parser.parse_args()

    before = get_assessment_tool_stats()
    print(f"В БД до загрузки: {before['local_count']} (связано: {before['linked']})")

    if args.relink_only:
        result = link_assessment_tools_to_qualifications()
        print(f"Связано: {result['linked']}, без квалификации: {result['unlinked']}")
        return

    if args.links_only:
        links = crawl_os_list(merge_cache=True)
        print(f"На сайте (уникальных кодов ОС): {len(links)}")
        return

    result = fetch_all_assessment_tools(
        save=True,
        only_missing=args.only_missing,
        rediscover=not args.from_cache,
    )
    if result.get("failed"):
        print(f"\nОшибок: {len(result['failed'])}")
        for item in result["failed"][:10]:
            print(f"  {item['code']}: {item.get('error')}")
        sys.exit(1 if len(result["failed"]) == len(result.get("processed", [])) else 0)


if __name__ == "__main__":
    main()
