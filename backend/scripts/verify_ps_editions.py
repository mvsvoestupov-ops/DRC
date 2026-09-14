"""
Проверка актуальности редакций ПС в БД (новая vs старая).

Критерии:
  1. element_id в БД совпадает с текущим на сайте Минтруда (reg → ELEMENT_ID)
  2. приказ/дата в БД совпадают с официальным XLSX
  3. element_id вида classinform:XX.XXX — загрузка не с XML Минтруда

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\verify_ps_editions.py
  venv\\Scripts\\python.exe scripts\\verify_ps_editions.py 01.006 06.050 17.001
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
from app.parser import build_reg_to_element_map

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
REPORT_JSON = os.path.join(OUTPUT_DIR, "verify_ps_editions.json")
REPORT_TXT = os.path.join(OUTPUT_DIR, "verify_ps_editions.txt")

DEFAULT_CODES = [
    "01.006",
    "02.034",
    "03.015",
    "06.050",
    "16.076",
    "17.001",
    "17.005",
    "17.026",
    "17.032",
    "17.049",
    "17.077",
    "20.004",
    "21.001",
    "27.010",
]

PS_CODE_RE = re.compile(r"^\d{2}\.\d{3}$")


def norm_order(value: str) -> str:
    s = (value or "").strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s.split(" - ")[0].split(" — ")[0].strip()


def index_xlsx_by_code(items: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for item in items:
        code = (item.get("ps_code") or "").strip()
        if code and PS_CODE_RE.match(code) and code not in out:
            out[code] = item
    return out


def load_db_by_reg() -> dict[str, StandardRaw]:
    session = SessionLocal()
    try:
        rows = session.query(StandardRaw).all()
        return {normalize_reg(r.reg_number): r for r in rows if normalize_reg(r.reg_number)}
    finally:
        session.close()


def classify_record(
    ps_code: str,
    xlsx: dict | None,
    db: StandardRaw | None,
    site_element_id: str | None,
) -> dict:
    issues: list[str] = []
    verdict = "ok"

    if not db:
        return {
            "ps_code": ps_code,
            "verdict": "missing_in_db",
            "issues": ["нет записи в БД по рег. номеру из XLSX"],
        }

    db_eid = (db.element_id or "").strip()
    if db_eid.startswith("classinform:"):
        issues.append("источник classinform (не официальный XML Минтруда)")
        verdict = "classinform_source"

    if site_element_id:
        if not db_eid:
            issues.append("в БД нет element_id")
            verdict = "no_element_id"
        elif db_eid.startswith("classinform:"):
            pass
        elif db_eid != site_element_id:
            issues.append(f"устаревший ELEMENT_ID: БД={db_eid}, сайт={site_element_id}")
            verdict = "stale_element_id"
    else:
        issues.append("не найден ELEMENT_ID на сайте Минтруда для рег. номера")

    if xlsx:
        x_order = norm_order(xlsx.get("order_number") or "")
        db_order = norm_order(db.order_number or "")
        if x_order and db_order and x_order != db_order:
            issues.append(f"приказ в БД ({db.order_number}) ≠ XLSX ({xlsx.get('order_number')})")
            if verdict == "ok":
                verdict = "order_mismatch"

        x_name = (xlsx.get("name") or "").strip()
        db_name = (db.name or "").strip()
        if x_name and db_name and x_name != db_name:
            # не всегда ошибка (актуализация на сайте), но сигнал для ручной проверки
            if x_name[:40] != db_name[:40]:
                issues.append("наименование в БД отличается от XLSX")
                if verdict == "ok":
                    verdict = "name_mismatch"

    if issues and verdict == "ok":
        verdict = "check"

    return {
        "ps_code": ps_code,
        "verdict": verdict,
        "issues": issues,
        "xlsx_reg_number": xlsx.get("reg_number") if xlsx else None,
        "xlsx_order_number": xlsx.get("order_number") if xlsx else None,
        "xlsx_name": (xlsx.get("name") or "")[:100] if xlsx else None,
        "xlsx_status": xlsx.get("status") if xlsx else None,
        "db_reg_number": db.reg_number,
        "db_element_id": db.element_id,
        "db_order_number": db.order_number,
        "db_approval_date": db.approval_date,
        "db_name": (db.name or "")[:100],
        "site_element_id": site_element_id,
    }


def main() -> int:
    warnings.filterwarnings("ignore", message="Unverified HTTPS request")

    parser = argparse.ArgumentParser(description="Проверка актуальности редакций ПС")
    parser.add_argument("codes", nargs="*", help="Коды ПС (по умолчанию — список из 14 шт.)")
    parser.add_argument("--skip-site", action="store_true", help="Не запрашивать сайт Минтруда")
    args = parser.parse_args()

    codes = args.codes or DEFAULT_CODES
    xlsx_path = resolve_xlsx_path(None)
    xlsx_by_code = index_xlsx_by_code(load_xlsx(xlsx_path))
    db_by_reg = load_db_by_reg()

    site_reg_map: dict[str, str] = {}
    if not args.skip_site:
        print("Построение карты reg → ELEMENT_ID с сайта Минтруда...")
        site_reg_map = build_reg_to_element_map(page_size=20, refresh=True)

    rows = []
    for ps_code in codes:
        xlsx = xlsx_by_code.get(ps_code)
        reg = normalize_reg(xlsx.get("reg_number") if xlsx else "")
        db = db_by_reg.get(reg) if reg else None
        site_eid = site_reg_map.get(reg) if reg else None
        rows.append(classify_record(ps_code, xlsx, db, site_eid))

    counts: dict[str, int] = {}
    for row in rows:
        counts[row["verdict"]] = counts.get(row["verdict"], 0) + 1

    report = {
        "xlsx_path": xlsx_path,
        "checked_codes": codes,
        "summary": counts,
        "items": rows,
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    lines = [
        "ПРОВЕРКА РЕДАКЦИЙ ПС (БД vs XLSX vs сайт Минтруда)",
        "=" * 70,
        f"XLSX: {xlsx_path}",
        "",
        "Сводка:",
    ]
    for verdict, cnt in sorted(counts.items()):
        lines.append(f"  {verdict}: {cnt}")
    lines.append("")

    for row in rows:
        lines.append(f"{row['ps_code']}  reg={row.get('db_reg_number')}  →  {row['verdict']}")
        lines.append(f"  БД ELEMENT_ID: {row.get('db_element_id')}")
        lines.append(f"  Сайт ELEMENT_ID: {row.get('site_element_id')}")
        lines.append(f"  БД приказ: {row.get('db_order_number')}")
        lines.append(f"  XLSX приказ: {row.get('xlsx_order_number')}")
        if row.get("issues"):
            for issue in row["issues"]:
                lines.append(f"  ! {issue}")
        lines.append("")

    with open(REPORT_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print("\n".join(lines))
    print(f"JSON: {REPORT_JSON}")
    print(f"TXT:  {REPORT_TXT}")
    return 0 if all(r["verdict"] in ("ok", "name_mismatch") for r in rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
