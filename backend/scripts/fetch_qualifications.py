"""
Загрузка всех квалификаций с nok-nark.ru в локальную БД.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\fetch_qualifications.py

Только недостающие (быстрее при догрузке):
  venv\\Scripts\\python.exe scripts\\fetch_qualifications.py --only-missing

Только проверить сбор ссылок (~2 мин):
  venv\\Scripts\\python.exe scripts\\fetch_qualifications.py --links-only
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.qualifications_parser import (
    fetch_all_qualifications,
    get_all_qualification_links,
    get_qualification_stats,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Загрузка квалификаций НАРК")
    parser.add_argument("--only-missing", action="store_true", help="Только отсутствующие в БД")
    parser.add_argument("--links-only", action="store_true", help="Только сбор ссылок")
    args = parser.parse_args()

    before = get_qualification_stats()
    print(f"В БД до загрузки: {before['local_count']}")

    if args.links_only:
        links = get_all_qualification_links()
        print(f"На сайте (уникальных кодов): {len(links)}")
        return

    result = fetch_all_qualifications(save=True, only_missing=args.only_missing)
    if result.get("failed"):
        print(f"\nОшибок: {len(result['failed'])}")
        for item in result["failed"][:10]:
            print(f"  {item['code']}: {item.get('error')}")
        sys.exit(1 if len(result["failed"]) == len(result.get("processed", [])) else 0)


if __name__ == "__main__":
    main()
