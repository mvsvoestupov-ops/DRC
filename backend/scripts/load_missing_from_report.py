"""
Догрузка недостающих ПС по отчёту analyze_missing_standards.py
Запуск: python scripts/load_missing_from_report.py
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.load_missing_standards import load_professional_standard_by_id

REPORT_PATH = os.path.join(os.path.dirname(__file__), "output", "missing_standards_report.json")


def main():
    if not os.path.exists(REPORT_PATH):
        print(f"Сначала запустите: python scripts/analyze_missing_standards.py")
        print(f"Ожидается файл: {REPORT_PATH}")
        sys.exit(1)

    with open(REPORT_PATH, encoding="utf-8") as f:
        report = json.load(f)

    missing = report.get("missing_in_local_db", [])
    if not missing:
        print("Недостающих ПС не найдено.")
        return

    print(f"Догрузка {len(missing)} профстандартов...")
    for i, item in enumerate(missing, 1):
        eid = item["element_id"]
        print(f"\n[{i}/{len(missing)}] ELEMENT_ID={eid} reg={item.get('reg_number', '?')}")
        load_professional_standard_by_id(eid)
        time.sleep(0.5)

    print("\nГотово. Перезапустите analyze_missing_standards.py для проверки.")


if __name__ == "__main__":
    main()
