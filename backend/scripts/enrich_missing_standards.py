"""
Обогащение только необогащённых профстандартов.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\enrich_missing_standards.py

Опции:
  --all   переобогатить все ПС (долго)
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.enrichment import enrich_standards_batch, get_enrichment_stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Обогащение профстандартов")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Переобогатить все ПС, а не только недостающие",
    )
    args = parser.parse_args()

    session = SessionLocal()
    try:
        before = get_enrichment_stats(session)
        print("=" * 60)
        print("ОБОГАЩЕНИЕ ПРОФСТАНДАРТОВ")
        print(f"Всего в raw: {before['total_raw']}")
        print(f"Уже обогащено: {before['enriched']}")
        print(f"Ожидают: {before['pending']}")
        print("=" * 60)

        if not args.all and before["pending"] == 0:
            print("Все профстандарты уже обогащены.")
            return

        result = enrich_standards_batch(session, only_missing=not args.all)

        print("\n" + "=" * 60)
        print("ИТОГ")
        print(f"  Запрошено: {result['requested']}")
        print(f"  Обогащено: {len(result['processed'])}")
        print(f"  Ошибок: {len(result['failed'])}")
        print(f"  Осталось необогащённых: {result['pending']}")
        if result["failed"]:
            print("\nОшибки:")
            for item in result["failed"][:20]:
                print(f"  reg={item['reg_number']}: {item['error']}")
        print("=" * 60)

        if result["failed"]:
            sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
