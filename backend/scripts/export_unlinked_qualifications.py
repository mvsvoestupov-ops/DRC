"""
Выгрузка квалификаций без связи с профстандартом (prof_standard_id IS NULL).

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\export_unlinked_qualifications.py

Отчёт:
  scripts/output/unlinked_qualifications.txt
  scripts/output/unlinked_qualifications.csv
  scripts/output/unlinked_qualifications.json
"""
from __future__ import annotations

import csv
import json
import os
import sys
from collections import defaultdict

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.db import SessionLocal
from app.db.qualifications_models import Qualification
from app.db.raw_models import StandardRaw
from app.qualification_links import ps_code_from_qualification_code

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
OUT_TXT = os.path.join(OUTPUT_DIR, "unlinked_qualifications.txt")
OUT_CSV = os.path.join(OUTPUT_DIR, "unlinked_qualifications.csv")
OUT_JSON = os.path.join(OUTPUT_DIR, "unlinked_qualifications.json")


def export_unlinked() -> dict:
    from app.qualification_links import normalize_ps_code

    session = SessionLocal()
    try:
        quals = (
            session.query(Qualification)
            .filter(Qualification.prof_standard_id.is_(None))
            .order_by(Qualification.code)
            .all()
        )
        ps_codes_in_db = set()
        for (c,) in session.query(StandardRaw.ps_code).filter(StandardRaw.ps_code.isnot(None)).all():
            n = normalize_ps_code(c)
            if n:
                ps_codes_in_db.add(n)

        rows = []
        for q in quals:
            expected = ps_code_from_qualification_code(q.code or "") or ""
            rows.append(
                {
                    "id": q.id,
                    "code": q.code or "",
                    "name": q.name or "",
                    "level": q.level or "",
                    "expected_ps_code": expected,
                    "ps_in_db": bool(expected and expected in ps_codes_in_db),
                    "prof_standard_name": q.prof_standard_name or "",
                    "prof_standard_order": q.prof_standard_order or "",
                    "activity_area": q.activity_area or "",
                }
            )
    finally:
        session.close()

    by_ps: dict[str, list] = defaultdict(list)
    for row in rows:
        key = row["expected_ps_code"] or "(без кода ПС)"
        by_ps[key].append(row)

    payload = {
        "total": len(rows),
        "groups": len(by_ps),
        "with_ps_in_db_but_unlinked": sum(1 for r in rows if r["ps_in_db"]),
        "missing_ps_in_db": sum(1 for r in rows if not r["ps_in_db"]),
        "items": rows,
        "by_expected_ps_code": {
            code: [{"code": r["code"], "name": r["name"], "id": r["id"]} for r in items]
            for code, items in sorted(by_ps.items())
        },
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    with open(OUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "id",
                "code",
                "name",
                "level",
                "expected_ps_code",
                "ps_in_db",
                "prof_standard_name",
                "prof_standard_order",
                "activity_area",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    lines = [
        f"Несвязанные квалификации НАРК: {len(rows)}",
        f"Групп по коду ПС: {len(by_ps)}",
        f"ПС есть в БД, но не связано: {payload['with_ps_in_db_but_unlinked']}",
        f"ПС нет в БД: {payload['missing_ps_in_db']}",
        "=" * 100,
    ]
    n = 0
    for ps_code, items in sorted(by_ps.items()):
        sample_name = items[0].get("prof_standard_name") or ""
        in_db = items[0].get("ps_in_db")
        flag = "ПС в БД есть" if in_db else "ПС в БД нет"
        lines.append("")
        lines.append(f"### {ps_code} — {sample_name[:80]} [{flag}] ({len(items)})")
        for row in items:
            n += 1
            lines.append(f"{n:>3}. {row['code']}\t{row['name']}")

    with open(OUT_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    return payload


def main() -> int:
    payload = export_unlinked()
    print(f"Всего несвязанных: {payload['total']}")
    print(f"TXT:  {OUT_TXT}")
    print(f"CSV:  {OUT_CSV}")
    print(f"JSON: {OUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
