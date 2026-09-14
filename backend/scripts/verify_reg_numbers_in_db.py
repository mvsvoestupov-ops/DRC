"""
Проверка: все ли уникальные рег. номера из официального XLSX есть в БД.

Ключ сравнения — регистрационный номер (не код ПС).

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\verify_reg_numbers_in_db.py
"""
from __future__ import annotations

import argparse
import json
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "scripts"))

from compare_ps_with_xlsx import (
    DB_PATH,
    load_db_standards,
    load_xlsx,
    normalize_reg,
    resolve_xlsx_path,
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
REPORT_JSON = os.path.join(OUTPUT_DIR, "verify_reg_numbers_in_db.json")
REPORT_TXT = os.path.join(OUTPUT_DIR, "verify_reg_numbers_in_db.txt")


def find_duplicate_regs(items: list[dict]) -> dict[str, list[dict]]:
    by_reg: dict[str, list[dict]] = {}
    for item in items:
        reg = normalize_reg(item.get("reg_number"))
        if not reg:
            continue
        by_reg.setdefault(reg, []).append(item)
    return {reg: rows for reg, rows in by_reg.items() if len(rows) > 1}


def main() -> int:
    parser = argparse.ArgumentParser(description="Проверка рег. номеров XLSX в БД")
    parser.add_argument("xlsx", nargs="?", default=None, help="Путь к XLSX реестра")
    args = parser.parse_args()

    xlsx_path = resolve_xlsx_path(args.xlsx)
    xlsx_items = load_xlsx(xlsx_path)
    db_by_reg = load_db_standards()

    xlsx_regs = sorted({normalize_reg(i["reg_number"]) for i in xlsx_items if normalize_reg(i["reg_number"])})
    db_regs = sorted(db_by_reg.keys())

    xlsx_set = set(xlsx_regs)
    db_set = set(db_regs)

    missing_in_db = sorted(xlsx_set - db_set, key=lambda r: int(r) if r.isdigit() else 99999)
    extra_in_db = sorted(db_set - xlsx_set, key=lambda r: int(r) if r.isdigit() else 99999)

    xlsx_dupes = find_duplicate_regs(xlsx_items)

    report = {
        "xlsx_path": xlsx_path,
        "db_path": DB_PATH,
        "xlsx_rows": len(xlsx_items),
        "xlsx_unique_reg_numbers": len(xlsx_regs),
        "db_unique_reg_numbers": len(db_regs),
        "expected_unique_reg_numbers": 1682,
        "all_xlsx_regs_in_db": len(missing_in_db) == 0,
        "missing_in_db_count": len(missing_in_db),
        "extra_in_db_count": len(extra_in_db),
        "duplicate_reg_in_xlsx_count": len(xlsx_dupes),
        "duplicate_reg_in_xlsx": {
            reg: [{"ps_code": i.get("ps_code"), "name": (i.get("name") or "")[:120]} for i in rows]
            for reg, rows in sorted(xlsx_dupes.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 99999)
        },
        "missing_in_db": [
            next(i for i in xlsx_items if normalize_reg(i["reg_number"]) == reg)
            for reg in missing_in_db
        ],
        "extra_in_db": [db_by_reg[reg] for reg in extra_in_db],
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    lines = [
        "ПРОВЕРКА РЕГ. НОМЕРОВ ПС (XLSX ↔ БД)",
        "=" * 60,
        f"XLSX: {xlsx_path}",
        f"БД:   {DB_PATH}",
        "",
        f"Уникальных рег. номеров в XLSX: {len(xlsx_regs)}",
        f"Уникальных рег. номеров в БД:   {len(db_regs)}",
        f"Дубликатов рег. номера в XLSX:  {len(xlsx_dupes)}",
        "",
        f"Не хватает в БД: {len(missing_in_db)}",
        f"Лишних в БД:     {len(extra_in_db)}",
        "",
        f"Все {len(xlsx_regs)} рег. номеров из XLSX в БД: {'ДА' if not missing_in_db else 'НЕТ'}",
    ]

    if missing_in_db:
        lines += ["", "ОТСУТСТВУЮТ В БД:"]
        for reg in missing_in_db:
            item = next(i for i in xlsx_items if normalize_reg(i["reg_number"]) == reg)
            lines.append(f"  reg={reg}  code={item.get('ps_code')}  {(item.get('name') or '')[:80]}")

    if extra_in_db:
        lines += ["", "ЛИШНИЕ В БД (нет в XLSX):"]
        for reg in extra_in_db:
            item = db_by_reg[reg]
            lines.append(f"  reg={reg}  ELEMENT_ID={item.get('element_id')}  {(item.get('name') or '')[:80]}")

    with open(REPORT_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print("\n".join(lines))
    print(f"\nJSON: {REPORT_JSON}")
    print(f"TXT:  {REPORT_TXT}")
    return 0 if not missing_in_db else 1


if __name__ == "__main__":
    raise SystemExit(main())
