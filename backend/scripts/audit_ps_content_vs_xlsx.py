"""
Сверка содержимого ПС в БД с официальным XLSX-реестром.

Ищет случаи, когда регистрационный номер есть в обеих сторонах,
но название и/или код ПС не совпадают (подмена документа под тем же reg).

Также считает:
  - есть в XLSX, нет в БД
  - есть в БД, нет в XLSX
  - дубликаты ps_code в БД

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\audit_ps_content_vs_xlsx.py
  venv\\Scripts\\python.exe scripts\\audit_ps_content_vs_xlsx.py "C:\\path\\to\\reestr.xlsx"

Отчёт:
  scripts/output/ps_content_mismatch.json
  scripts/output/ps_content_mismatch.txt
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "scripts"))

from compare_ps_with_xlsx import (  # noqa: E402
    load_xlsx_openpyxl,
    load_xlsx_stdlib,
    normalize_reg,
    parse_xlsx_rows,
    resolve_xlsx_path,
)
from app.db import SessionLocal  # noqa: E402
from app.db.raw_models import StandardRaw  # noqa: E402
from app.qualification_links import normalize_name, normalize_ps_code  # noqa: E402

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
REPORT_JSON = os.path.join(OUTPUT_DIR, "ps_content_mismatch.json")
REPORT_TXT = os.path.join(OUTPUT_DIR, "ps_content_mismatch.txt")


def names_equivalent(a: str, b: str) -> bool:
    left = normalize_name(a)
    right = normalize_name(b)
    if not left or not right:
        return False
    if left == right:
        return True
    # лёгкая толерантность к сокращениям в скобках / хвостам
    if len(left) >= 20 and len(right) >= 20 and left[:40] == right[:40]:
        return True
    return False


def load_xlsx_items(path: str) -> list[dict]:
    try:
        rows = load_xlsx_openpyxl(path)
    except Exception as exc:
        print(f"openpyxl недоступен ({exc}), читаем через stdlib ZIP")
        rows = load_xlsx_stdlib(path)
    return parse_xlsx_rows(rows)


def load_db_by_reg() -> dict[str, dict]:
    session = SessionLocal()
    try:
        by_reg: dict[str, dict] = {}
        for std in session.query(StandardRaw).all():
            reg = normalize_reg(std.reg_number)
            if not reg:
                continue
            item = {
                "id": std.id,
                "reg_number": reg,
                "ps_code": normalize_ps_code(std.ps_code or "") or (std.ps_code or ""),
                "name": (std.name or "").strip(),
                "status": getattr(std, "status", None) or "active",
                "order_number": (std.order_number or "").strip(),
                "element_id": (std.element_id or "").strip(),
                "source_kind": getattr(std, "source_kind", None),
            }
            # если дубль reg в БД — оставляем active, иначе первый
            existing = by_reg.get(reg)
            if existing is None:
                by_reg[reg] = item
            elif existing.get("status") != "active" and item.get("status") == "active":
                by_reg[reg] = item
        return by_reg
    finally:
        session.close()


def classify_mismatch(xlsx_item: dict, db_item: dict) -> dict | None:
    x_code = normalize_ps_code(xlsx_item.get("ps_code") or "") or ""
    d_code = normalize_ps_code(db_item.get("ps_code") or "") or ""
    x_name = xlsx_item.get("name") or ""
    d_name = db_item.get("name") or ""

    code_mismatch = bool(x_code and d_code and x_code != d_code)
    name_mismatch = bool(x_name and d_name and not names_equivalent(x_name, d_name))

    if not code_mismatch and not name_mismatch:
        return None

    severity = "critical" if code_mismatch and name_mismatch else "warning"
    if code_mismatch and name_mismatch:
        kind = "code_and_name"
    elif code_mismatch:
        kind = "code_only"
    else:
        kind = "name_only"

    return {
        "reg_number": xlsx_item.get("reg_number"),
        "kind": kind,
        "severity": severity,
        "xlsx_ps_code": x_code or xlsx_item.get("ps_code"),
        "db_ps_code": d_code or db_item.get("ps_code"),
        "xlsx_name": x_name,
        "db_name": d_name,
        "xlsx_status": xlsx_item.get("status"),
        "db_status": db_item.get("status"),
        "xlsx_order": xlsx_item.get("order_number"),
        "db_order": db_item.get("order_number"),
        "db_id": db_item.get("id"),
        "db_element_id": db_item.get("element_id"),
    }


def find_db_code_duplicates(db_by_reg: dict[str, dict]) -> list[dict]:
    by_code: dict[str, list[dict]] = defaultdict(list)
    for item in db_by_reg.values():
        code = normalize_ps_code(item.get("ps_code") or "") or ""
        if code:
            by_code[code].append(item)
    rows = []
    for code, items in sorted(by_code.items()):
        if len(items) < 2:
            continue
        rows.append(
            {
                "ps_code": code,
                "count": len(items),
                "regs": [i["reg_number"] for i in items],
                "names": [i["name"] for i in items],
            }
        )
    return rows


def run_audit(cli_path: str | None = None) -> dict:
    xlsx_path = resolve_xlsx_path(cli_path)
    print(f"XLSX: {xlsx_path}")

    xlsx_items = load_xlsx_items(xlsx_path)
    xlsx_by_reg = {item["reg_number"]: item for item in xlsx_items}
    print(f"XLSX уникальных reg: {len(xlsx_by_reg)}")

    db_by_reg = load_db_by_reg()
    print(f"БД уникальных reg: {len(db_by_reg)}")

    mismatches: list[dict] = []
    matched_ok = 0
    for reg, x_item in sorted(xlsx_by_reg.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 0):
        d_item = db_by_reg.get(reg)
        if not d_item:
            continue
        row = classify_mismatch(x_item, d_item)
        if row:
            mismatches.append(row)
        else:
            matched_ok += 1

    missing_in_db = sorted(
        (
            {
                "reg_number": reg,
                "ps_code": item.get("ps_code"),
                "name": item.get("name"),
                "status": item.get("status"),
            }
            for reg, item in xlsx_by_reg.items()
            if reg not in db_by_reg
        ),
        key=lambda r: int(r["reg_number"]) if str(r["reg_number"]).isdigit() else 0,
    )
    extra_in_db = sorted(
        (
            {
                "reg_number": reg,
                "ps_code": item.get("ps_code"),
                "name": item.get("name"),
                "status": item.get("status"),
            }
            for reg, item in db_by_reg.items()
            if reg not in xlsx_by_reg
        ),
        key=lambda r: int(r["reg_number"]) if str(r["reg_number"]).isdigit() else 0,
    )

    critical = [m for m in mismatches if m["severity"] == "critical"]
    code_only = [m for m in mismatches if m["kind"] == "code_only"]
    name_only = [m for m in mismatches if m["kind"] == "name_only"]
    dup_codes = find_db_code_duplicates(db_by_reg)

    tipho = [
        m
        for m in mismatches
        if "тифлосурдо" in (m.get("xlsx_name") or "").lower()
        or "тифлосурдо" in (m.get("db_name") or "").lower()
        or m.get("xlsx_ps_code") == "03.010"
        or m.get("reg_number") == "846"
    ]

    return {
        "xlsx_path": xlsx_path,
        "summary": {
            "xlsx_regs": len(xlsx_by_reg),
            "db_regs": len(db_by_reg),
            "content_ok": matched_ok,
            "content_mismatch_total": len(mismatches),
            "critical_code_and_name": len(critical),
            "code_only": len(code_only),
            "name_only": len(name_only),
            "missing_in_db": len(missing_in_db),
            "extra_in_db": len(extra_in_db),
            "db_duplicate_ps_codes": len(dup_codes),
        },
        "mismatches": mismatches,
        "critical": critical,
        "code_only": code_only,
        "name_only": name_only,
        "missing_in_db": missing_in_db,
        "extra_in_db": extra_in_db,
        "db_duplicate_ps_codes": dup_codes,
        "highlight_tiflosurdo": tipho,
    }


def write_audit_reports(report: dict) -> tuple[str, str]:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    summary = report.get("summary") or {}
    critical = report.get("critical") or []
    code_only = report.get("code_only") or []
    name_only = report.get("name_only") or []
    tipho = report.get("highlight_tiflosurdo") or []
    dup_codes = report.get("db_duplicate_ps_codes") or []
    missing_in_db = report.get("missing_in_db") or []

    lines = [
        "СВЕРКА СОДЕРЖИМОГО ПС: XLSX ↔ БД (по регистрационному номеру)",
        f"XLSX: {report.get('xlsx_path')}",
        "=" * 100,
        f"XLSX regs: {summary.get('xlsx_regs')}",
        f"БД regs:   {summary.get('db_regs')}",
        f"Содержимое совпало: {summary.get('content_ok')}",
        f"Подмены/расхождения: {summary.get('content_mismatch_total')}",
        f"  critical (код+название): {summary.get('critical_code_and_name')}",
        f"  только код:              {summary.get('code_only')}",
        f"  только название:         {summary.get('name_only')}",
        f"Есть в XLSX, нет в БД: {summary.get('missing_in_db')}",
        f"Есть в БД, нет в XLSX: {summary.get('extra_in_db')}",
        f"Дубликаты ps_code в БД: {summary.get('db_duplicate_ps_codes')}",
        "",
        "--- CRITICAL: один reg, разные код И название ---",
    ]
    for m in critical:
        lines.append(
            f"reg={m['reg_number']}: "
            f"XLSX {m['xlsx_ps_code']} «{m['xlsx_name'][:70]}» "
            f"↔ БД {m['db_ps_code']} «{m['db_name'][:70]}»"
        )

    lines.append("")
    lines.append("--- Только код (название похоже) ---")
    for m in code_only[:40]:
        lines.append(
            f"reg={m['reg_number']}: XLSX {m['xlsx_ps_code']} ↔ БД {m['db_ps_code']} | {m['xlsx_name'][:60]}"
        )
    if len(code_only) > 40:
        lines.append(f"... ещё {len(code_only) - 40}")

    lines.append("")
    lines.append("--- Только название (код совпал) ---")
    for m in name_only[:40]:
        lines.append(
            f"reg={m['reg_number']} code={m['xlsx_ps_code']}: "
            f"XLSX «{m['xlsx_name'][:55]}» ↔ БД «{m['db_name'][:55]}»"
        )
    if len(name_only) > 40:
        lines.append(f"... ещё {len(name_only) - 40}")

    if tipho:
        lines.append("")
        lines.append("--- Подсветка: Тифлосурдо / 03.010 / reg 846 ---")
        for m in tipho:
            lines.append(
                f"reg={m['reg_number']}: XLSX {m['xlsx_ps_code']} «{m['xlsx_name']}» "
                f"↔ БД {m['db_ps_code']} «{m['db_name']}»"
            )

    lines.append("")
    lines.append("--- Дубликаты ps_code в БД (фрагмент) ---")
    for row in dup_codes[:30]:
        lines.append(
            f"{row['ps_code']}: regs={','.join(row['regs'])} | "
            + " / ".join((n or "")[:40] for n in row["names"])
        )

    if missing_in_db:
        lines.append("")
        lines.append("--- Есть в XLSX, нет в БД ---")
        for row in missing_in_db[:50]:
            lines.append(
                f"reg={row['reg_number']} {row.get('ps_code')} {(row.get('name') or '')[:70]}"
            )

    with open(REPORT_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return REPORT_TXT, REPORT_JSON


def main() -> int:
    cli_path = sys.argv[1] if len(sys.argv) > 1 else None
    report = run_audit(cli_path)
    txt_path, json_path = write_audit_reports(report)
    summary = report["summary"]
    print()
    print(f"Подмены/расхождения: {summary['content_mismatch_total']} (critical={summary['critical_code_and_name']})")
    print(f"Отчёт TXT:  {txt_path}")
    print(f"Отчёт JSON: {json_path}")
    if report.get("highlight_tiflosurdo"):
        print("Тифлосурдо/846 попал в critical — см. отчёт.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Ошибка: {exc}")
        raise
