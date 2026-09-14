"""
Сравнение двух XLSX реестров ПС: официальный vs экспорт с сайта Минтруда.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\compare_two_xlsx.py
"""
from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter, defaultdict

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "scripts"))

from compare_ps_with_xlsx import load_xlsx, load_xlsx_openpyxl, parse_xlsx_rows, _trim_row

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
OFFICIAL_XLSX = os.path.join(OUTPUT_DIR, "Реестр профессиональных стандартов 18.08.2026 (2).xlsx")
MINTRUD_XLSX = os.path.join(OUTPUT_DIR, "reestr_mintrud_2026-08-31.xlsx")
REPORT_JSON = os.path.join(OUTPUT_DIR, "compare_official_vs_mintrud_export.json")
REPORT_TXT = os.path.join(OUTPUT_DIR, "compare_official_vs_mintrud_export.txt")

PS_CODE_RE = re.compile(r"^\d{2}\.\d{3}$")

MINTRUD_HEADERS = [
    "Регистрационный номер",
    "Код профессионального стандарта",
    "Наименование",
    "Ответственная организация – разработчик",
    "Дата вступления в силу",
    "Дата утраты силы",
]


def load_mintrud_export(path: str) -> list[dict]:
    rows = [_trim_row(r) for r in load_xlsx_openpyxl(path)]
    if not rows:
        return []

    header = [str(c or "").strip() for c in rows[0]]
    if header[:6] == MINTRUD_HEADERS:
        data_rows = rows[1:]
    else:
        data_rows = rows

    items: list[dict] = []
    for row in data_rows:
        if not row or not any(row):
            continue
        reg = str(row[0] or "").strip()
        ps_code = str(row[1] or "").strip() if len(row) > 1 else ""
        name = str(row[2] or "").strip() if len(row) > 2 else ""
        if not reg and not ps_code:
            continue
        items.append(
            {
                "reg_number": reg,
                "ps_code": ps_code,
                "name": name,
                "developer": str(row[3] or "").strip() if len(row) > 3 else "",
                "effective_date": str(row[4] or "").strip() if len(row) > 4 else "",
                "expiration_date": str(row[5] or "").strip() if len(row) > 5 else "",
            }
        )
    return items


def find_duplicates(items: list[dict]) -> dict:
    by_reg: dict[str, list[dict]] = defaultdict(list)
    by_code: dict[str, list[dict]] = defaultdict(list)
    by_reg_code: dict[str, list[dict]] = defaultdict(list)

    for item in items:
        reg = item.get("reg_number") or ""
        code = item.get("ps_code") or ""
        by_reg[reg].append(item)
        if code:
            by_code[code].append(item)
        by_reg_code[f"{reg}|{code}"].append(item)

    dup_reg = {k: v for k, v in by_reg.items() if len(v) > 1}
    dup_code = {k: v for k, v in by_code.items() if len(v) > 1}
    dup_pair = {k: v for k, v in by_reg_code.items() if len(v) > 1}

    return {
        "duplicate_reg_numbers": {
            k: [{"ps_code": i["ps_code"], "name": i["name"][:80]} for i in v]
            for k, v in sorted(dup_reg.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 99999)
        },
        "duplicate_ps_codes": {
            k: [{"reg_number": i["reg_number"], "name": i["name"][:80]} for i in v]
            for k, v in sorted(dup_code.items())
        },
        "duplicate_reg_code_pairs": {
            k: len(v) for k, v in dup_pair.items()
        },
        "counts": {
            "duplicate_reg_count": len(dup_reg),
            "duplicate_code_count": len(dup_code),
            "duplicate_pair_count": len(dup_pair),
            "extra_rows_from_duplicates": sum(len(v) - 1 for v in by_reg.values()),
        },
    }


def index_by_code(items: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for item in items:
        code = (item.get("ps_code") or "").strip()
        if code and code not in out:
            out[code] = item
    return out


def index_by_reg(items: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for item in items:
        reg = (item.get("reg_number") or "").strip()
        if reg and reg not in out:
            out[reg] = item
    return out


def format_item(item: dict) -> str:
    return f"{item.get('ps_code') or '?'}  reg={item.get('reg_number') or '?'}  {(item.get('name') or '')[:55]}"


def write_report(report: dict, path: str) -> None:
    lines = [
        "СРАВНЕНИЕ: официальный XLSX 18.08.2026 (2) ↔ экспорт с сайта Минтруда",
        f"Официальный: {report['official_path']}",
        f"Сайт:        {report['mintrud_path']}",
        "",
        f"Официальный XLSX: {report['official_count']} записей, {report['official_unique_codes']} кодов ПС",
        f"Экспорт сайта:    {report['mintrud_count']} строк, {report['mintrud_unique_codes']} кодов ПС",
        "",
        f"Только в официальном XLSX (нет в экспорте сайта): {report['only_in_official_count']}",
        f"Только в экспорте сайта (нет в официальном):     {report['only_in_mintrud_count']}",
        "",
        "ДУБЛИКАТЫ в reestr_mintrud_2026-08-31.xlsx:",
        f"  Повторяющихся рег. номеров: {report['duplicates']['counts']['duplicate_reg_count']}",
        f"  Повторяющихся кодов ПС:     {report['duplicates']['counts']['duplicate_code_count']}",
        f"  Лишних строк из-за дублей:  {report['duplicates']['counts']['extra_rows_from_duplicates']}",
        "",
        "=" * 80,
        "ТОЛЬКО В ОФИЦИАЛЬНОМ XLSX (отсутствуют в экспорте сайта)",
        "=" * 80,
    ]
    for item in report["only_in_official"]:
        lines.append(format_item(item))
    if not report["only_in_official"]:
        lines.append("(нет)")

    lines += [
        "",
        "=" * 80,
        "ДУБЛИКАТЫ ПО РЕГ. НОМЕРУ в reestr_mintrud_2026-08-31.xlsx",
        "=" * 80,
    ]
    dup_reg = report["duplicates"]["duplicate_reg_numbers"]
    if dup_reg:
        for reg, entries in dup_reg.items():
            lines.append(f"reg={reg} ({len(entries)} раз):")
            for e in entries:
                lines.append(f"  code={e['ps_code']}  {e['name']}")
    else:
        lines.append("(нет)")

    lines += [
        "",
        "=" * 80,
        "ДУБЛИКАТЫ ПО КОДУ ПС в reestr_mintrud_2026-08-31.xlsx",
        "=" * 80,
    ]
    dup_code = report["duplicates"]["duplicate_ps_codes"]
    if dup_code:
        for code, entries in dup_code.items():
            lines.append(f"code={code} ({len(entries)} раз):")
            for e in entries:
                lines.append(f"  reg={e['reg_number']}  {e['name']}")
    else:
        lines.append("(нет)")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main() -> int:
    for path in (OFFICIAL_XLSX, MINTRUD_XLSX):
        if not os.path.isfile(path):
            print(f"Файл не найден: {path}")
            return 1

    print(f"Официальный: {OFFICIAL_XLSX}")
    official_items = load_xlsx(OFFICIAL_XLSX)
    print(f"Экспорт сайта: {MINTRUD_XLSX}")
    mintrud_items = load_mintrud_export(MINTRUD_XLSX)

    official_by_code = index_by_code(official_items)
    mintrud_by_code = index_by_code(mintrud_items)

    official_codes = set(official_by_code.keys())
    mintrud_codes = set(mintrud_by_code.keys())

    only_official_codes = sorted(official_codes - mintrud_codes)
    only_mintrud_codes = sorted(mintrud_codes - official_codes)

    only_in_official = [official_by_code[c] for c in only_official_codes]
    only_in_mintrud = [mintrud_by_code[c] for c in only_mintrud_codes]

    duplicates = find_duplicates(mintrud_items)

    report = {
        "official_path": OFFICIAL_XLSX,
        "mintrud_path": MINTRUD_XLSX,
        "official_count": len(official_items),
        "official_unique_codes": len(official_codes),
        "mintrud_count": len(mintrud_items),
        "mintrud_unique_codes": len(mintrud_codes),
        "only_in_official_count": len(only_in_official),
        "only_in_mintrud_count": len(only_in_mintrud),
        "only_in_official": [
            {
                "ps_code": i.get("ps_code"),
                "reg_number": i.get("reg_number"),
                "name": i.get("name"),
                "status": i.get("status"),
                "order_number": i.get("order_number"),
            }
            for i in only_in_official
        ],
        "only_in_mintrud": [
            {
                "ps_code": i.get("ps_code"),
                "reg_number": i.get("reg_number"),
                "name": i.get("name"),
            }
            for i in only_in_mintrud
        ],
        "duplicates": duplicates,
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    write_report(report, REPORT_TXT)

    print("\n" + "=" * 60)
    print("СРАВНЕНИЕ XLSX")
    print("=" * 60)
    print(f"Официальный: {len(official_items)} записей, {len(official_codes)} кодов")
    print(f"Сайт:        {len(mintrud_items)} строк, {len(mintrud_codes)} кодов")
    print(f"Только в официальном: {len(only_in_official)}")
    print(f"Только на сайте:      {len(only_in_mintrud)}")
    print(f"Дублей reg в экспорте: {duplicates['counts']['duplicate_reg_count']}")
    print(f"Дублей code в экспорте: {duplicates['counts']['duplicate_code_count']}")
    print(f"\nОтчёт: {REPORT_TXT}")
    print(f"JSON:  {REPORT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
