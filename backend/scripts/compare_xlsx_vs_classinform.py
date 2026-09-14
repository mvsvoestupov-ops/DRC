"""
Сравнение кодов ПС из официального XLSX с индексом classinform.ru.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\compare_xlsx_vs_classinform.py
"""
from __future__ import annotations

import json
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "scripts"))

from compare_ps_with_xlsx import load_xlsx, resolve_xlsx_path  # noqa: E402
from app.classinform_parser import INDEX_CACHE_PATH  # noqa: E402

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "output", "xlsx_vs_classinform.json")


def main() -> int:
    if not os.path.exists(INDEX_CACHE_PATH):
        print("Сначала постройте индекс: run-build-classinform-index.bat")
        return 1

    with open(INDEX_CACHE_PATH, encoding="utf-8") as f:
        index = json.load(f)

    xlsx_path = resolve_xlsx_path(None)
    xlsx_rows = load_xlsx(xlsx_path)
    xlsx_codes = {row["ps_code"] for row in xlsx_rows if row.get("ps_code")}
    index_codes = set(index.keys())

    only_xlsx = sorted(xlsx_codes - index_codes)
    only_index = sorted(index_codes - xlsx_codes)

    print("=" * 60)
    print(f"XLSX (официальный реестр):     {len(xlsx_codes)} кодов ПС")
    print(f"classinform.ru (HTML-страницы): {len(index_codes)} кодов ПС")
    print(f"В XLSX, но без страницы на сайте: {len(only_xlsx)}")
    print(f"На сайте, но нет в XLSX:          {len(only_index)}")
    print("=" * 60)

    only_xlsx_details: list[dict] = []
    xlsx_by_code = {row["ps_code"]: row for row in xlsx_rows if row.get("ps_code")}

    if only_xlsx:
        print("\nКоды из XLSX без страницы на classinform (первые 30):")
        for code in only_xlsx:
            row = xlsx_by_code.get(code, {})
            order = row.get("order_number") or ""
            only_xlsx_details.append(
                {
                    "ps_code": code,
                    "reg_number": row.get("reg_number", ""),
                    "name": row.get("name", ""),
                    "order_number": order,
                    "status": row.get("status", "active"),
                    "revoked_date": row.get("revoked_date") or "",
                }
            )
        for item in only_xlsx_details[:30]:
            order = item.get("order_number") or ""
            name = (item.get("name") or "")[:55]
            revoked = "утратил" in order.lower()
            mark = " [утратил силу]" if revoked else ""
            print(
                f"  {item['ps_code']}  reg={item.get('reg_number', '?')}  {name}{mark}"
            )
        if len(only_xlsx) > 30:
            print(f"  ... ещё {len(only_xlsx) - 30}")

    report_path = os.path.join(os.path.dirname(__file__), "output", "missing_vs_xlsx_2026.json")
    if os.path.exists(report_path):
        with open(report_path, encoding="utf-8") as f:
            missing_db = json.load(f).get("missing_in_db", [])
        need_codes = [m["ps_code"] for m in missing_db if m.get("ps_code")]
        in_index = [c for c in need_codes if c in index_codes]
        not_in_index = [c for c in need_codes if c not in index_codes]
        print("\n--- Недостающие в вашей БД (из compare) ---")
        print(f"  Всего: {len(need_codes)}, есть на classinform: {len(in_index)}")
        if not_in_index:
            print(f"  Нет на classinform: {', '.join(not_in_index)}")
        else:
            print("  Все недостающие коды есть на classinform — можно догружать.")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {
                "xlsx_count": len(xlsx_codes),
                "classinform_count": len(index_codes),
                "only_in_xlsx": only_xlsx,
                "only_in_xlsx_details": only_xlsx_details if only_xlsx else [],
                "only_in_classinform": only_index,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    details_txt = os.path.join(os.path.dirname(OUTPUT_PATH), "missing_on_classinform.txt")
    if only_xlsx_details:
        lines = [
            "ПС из XLSX, которых НЕТ на classinform.ru",
            f"Всего: {len(only_xlsx_details)}",
            "=" * 100,
        ]
        for i, item in enumerate(only_xlsx_details, 1):
            revoked = "утратил" in (item.get("order_number") or "").lower()
            status = "revoked" if revoked else "active"
            lines.append(
                f"{i:>3}. {item['ps_code']}  reg={item['reg_number']}  [{status}]  {item['name']}"
            )
            if item.get("order_number"):
                lines.append(f"      приказ: {item['order_number']}")
        with open(details_txt, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        print(f"Полный список: {details_txt}")
    print(f"\nОтчёт: {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
