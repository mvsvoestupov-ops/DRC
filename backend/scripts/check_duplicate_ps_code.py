"""
Проверка пары ПС с одинаковым кодом 06.050 (reg 1586 и 1587).

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\check_duplicate_ps_code.py 06.050
  venv\\Scripts\\python.exe scripts\\check_duplicate_ps_code.py 06.050 --load-missing
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import warnings

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "scripts"))

from compare_ps_with_xlsx import load_xlsx, normalize_reg, resolve_xlsx_path
from app.db import SessionLocal
from app.db.raw_models import StandardRaw
from app.parser import build_reg_to_element_map, find_element_id_by_reg_number

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
PS_CODE_RE = re.compile(r"^\d{2}\.\d{3}$")

DEFAULT_REGS = ("1586", "1587")


def xlsx_items_for_code(items: list[dict], ps_code: str) -> list[dict]:
    return [i for i in items if (i.get("ps_code") or "").strip() == ps_code]


def db_rows_for_regs(regs: list[str]) -> dict[str, StandardRaw]:
    session = SessionLocal()
    try:
        rows = session.query(StandardRaw).filter(StandardRaw.reg_number.in_(regs)).all()
        return {normalize_reg(r.reg_number): r for r in rows}
    finally:
        session.close()


def row_summary(db: StandardRaw | None, xlsx: dict | None, site_eid: str | None) -> dict:
    return {
        "in_db": db is not None,
        "db_reg_number": db.reg_number if db else None,
        "db_element_id": db.element_id if db else None,
        "db_order_number": db.order_number if db else None,
        "db_name": (db.name or "")[:120] if db else None,
        "in_xlsx": xlsx is not None,
        "xlsx_reg_number": xlsx.get("reg_number") if xlsx else None,
        "xlsx_order_number": xlsx.get("order_number") if xlsx else None,
        "xlsx_name": (xlsx.get("name") or "")[:120] if xlsx else None,
        "xlsx_status": xlsx.get("status") if xlsx else None,
        "site_element_id": site_eid,
        "element_id_match": bool(
            db and site_eid and db.element_id and str(db.element_id) == str(site_eid)
        ),
    }


def main() -> int:
    warnings.filterwarnings("ignore", message="Unverified HTTPS request")

    parser = argparse.ArgumentParser(description="Проверка дубликата кода ПС (разные reg)")
    parser.add_argument("ps_code", nargs="?", default="06.050")
    parser.add_argument("--regs", nargs="*", default=list(DEFAULT_REGS))
    parser.add_argument("--load-missing", action="store_true", help="Догрузить отсутствующие reg с сайта Минтруда")
    args = parser.parse_args()

    ps_code = args.ps_code.strip()
    if not PS_CODE_RE.match(ps_code):
        print(f"Некорректный код ПС: {ps_code}")
        return 1

    regs = [normalize_reg(r) for r in args.regs if normalize_reg(r)]
    xlsx_path = resolve_xlsx_path(None)
    xlsx_items = load_xlsx(xlsx_path)
    xlsx_for_code = xlsx_items_for_code(xlsx_items, ps_code)
    xlsx_by_reg = {normalize_reg(i["reg_number"]): i for i in xlsx_for_code}

    print(f"Код ПС: {ps_code}")
    print(f"XLSX: {xlsx_path}")
    print(f"Записей с кодом {ps_code} в XLSX: {len(xlsx_for_code)}")
    for item in xlsx_for_code:
        print(
            f"  reg={item['reg_number']}  order={item.get('order_number')}  "
            f"{(item.get('name') or '')[:70]}"
        )

    print("\nПостроение карты reg → ELEMENT_ID с сайта Минтруда...")
    site_map = build_reg_to_element_map(page_size=20, refresh=True)

    db_by_reg = db_rows_for_regs(regs)
    report_regs = []
    for reg in regs:
        site_eid = site_map.get(reg)
        if not site_eid:
            site_eid = find_element_id_by_reg_number(reg, ps_code=None)
        summary = row_summary(db_by_reg.get(reg), xlsx_by_reg.get(reg), site_eid)
        summary["reg_number"] = reg
        report_regs.append(summary)

        print(f"\n--- reg={reg} ---")
        print(f"  XLSX: {'да' if summary['in_xlsx'] else 'нет'}", end="")
        if summary["in_xlsx"]:
            print(f"  {summary['xlsx_name']}")
        else:
            print()
        print(f"  БД:   {'да' if summary['in_db'] else 'НЕТ'}", end="")
        if summary["in_db"]:
            print(f"  ELEMENT_ID={summary['db_element_id']}")
            print(f"  {summary['db_name']}")
        else:
            print()
        print(f"  Сайт ELEMENT_ID: {site_eid or 'не найден'}")
        if summary["in_db"] and site_eid:
            print(f"  ELEMENT_ID актуален: {'да' if summary['element_id_match'] else 'НЕТ'}")

    missing_regs = [r for r in report_regs if not r["in_db"]]
    if args.load_missing and missing_regs:
        from load_missing_standards import load_professional_standard_by_id

        print("\nДогрузка отсутствующих...")
        for row in missing_regs:
            eid = row.get("site_element_id")
            if not eid:
                print(f"  reg={row['reg_number']}: ELEMENT_ID не найден")
                continue
            print(f"  reg={row['reg_number']} ELEMENT_ID={eid}")
            load_professional_standard_by_id(str(eid))

    report = {
        "ps_code": ps_code,
        "xlsx_path": xlsx_path,
        "xlsx_count_for_code": len(xlsx_for_code),
        "expected_regs": regs,
        "items": report_regs,
        "all_expected_in_db": all(r["in_db"] for r in report_regs),
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out = os.path.join(OUTPUT_DIR, f"duplicate_ps_code_{ps_code.replace('.', '_')}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nJSON: {out}")

    if len(xlsx_for_code) < 2:
        print(f"\n⚠ В XLSX найдено меньше 2 записей с кодом {ps_code}. Проверьте файл реестра.")
    if not report["all_expected_in_db"]:
        print(f"\n⚠ Не все reg из списка {regs} есть в БД.")
        if not args.load_missing:
            print("  Догрузка: venv\\Scripts\\python.exe scripts\\check_duplicate_ps_code.py 06.050 --load-missing")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
