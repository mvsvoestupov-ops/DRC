"""
Полный перечень ПС из XLSX, которых нет на classinform.ru.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\list_missing_on_classinform.py
"""
from __future__ import annotations

import json
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "scripts"))

from app.classinform_parser import INDEX_CACHE_PATH
from compare_ps_with_xlsx import load_xlsx, resolve_xlsx_path

OUTPUT_JSON = os.path.join(os.path.dirname(__file__), "output", "missing_on_classinform.json")
OUTPUT_TXT = os.path.join(os.path.dirname(__file__), "output", "missing_on_classinform.txt")


def main() -> int:
    if not os.path.exists(INDEX_CACHE_PATH):
        print("Сначала: run-build-classinform-index.bat")
        return 1

    with open(INDEX_CACHE_PATH, encoding="utf-8") as f:
        index = json.load(f)

    xlsx_rows = load_xlsx(resolve_xlsx_path(None))
    xlsx_by_code = {row["ps_code"]: row for row in xlsx_rows if row.get("ps_code")}
    index_codes = set(index.keys())

    missing = []
    for code in sorted(xlsx_by_code.keys() - index_codes):
        row = xlsx_by_code[code]
        order = row.get("order_number") or ""
        missing.append(
            {
                "ps_code": code,
                "reg_number": row.get("reg_number", ""),
                "name": row.get("name", ""),
                "order_number": order,
                "status": row.get("status", "active"),
                "revoked_date": row.get("revoked_date") or "",
                "revoked_in_xlsx": "утратил" in order.lower(),
            }
        )

    lines = [
        "ПС из официального XLSX, которых НЕТ на classinform.ru",
        f"Всего: {len(missing)}",
        "=" * 100,
        f"{'№':>3}  {'Код':<8} {'Рег.№':<6} {'Статус':<10} {'Наименование'}",
        "-" * 100,
    ]
    for i, item in enumerate(missing, 1):
        status = "revoked" if item["revoked_in_xlsx"] else "active"
        lines.append(
            f"{i:>3}.  {item['ps_code']:<8} {item['reg_number']:<6} {status:<10} {item['name']}"
        )
        if item["order_number"]:
            lines.append(f"      приказ: {item['order_number']}")

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(missing, f, ensure_ascii=False, indent=2)
    with open(OUTPUT_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print("\n".join(lines))
    print(f"\nJSON: {OUTPUT_JSON}")
    print(f"TXT:  {OUTPUT_TXT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
