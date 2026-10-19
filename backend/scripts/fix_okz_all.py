"""
Заполнить коды ОКЗ для ПС в БД из сохранённых source_html / source_xml.

Не выдумывает коды: берёт только справочные данные из исходника ПС
(«Дополнительные характеристики» / ListOKZ в XML).

Примеры (cmd.exe):

  cd /d C:\\IT\\DRC\\backend
  venv\\Scripts\\python.exe scripts\\fix_okz_all.py
  venv\\Scripts\\python.exe scripts\\fix_okz_all.py --dry-run
  venv\\Scripts\\python.exe scripts\\fix_okz_all.py --force
  venv\\Scripts\\python.exe scripts\\fix_okz_all.py --ps-code 12.013
  venv\\Scripts\\python.exe scripts\\fix_okz_all.py --limit 50
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from app.db.session import SessionLocal
from app.okz_repair import repair_all_okz

REPORT_DIR = os.path.join(BACKEND, "scripts", "output")
REPORT_JSON = os.path.join(REPORT_DIR, "fix_okz_all_report.json")
REPORT_TXT = os.path.join(REPORT_DIR, "fix_okz_all_report.txt")


def main() -> int:
    parser = argparse.ArgumentParser(description="Заполнить ОКЗ у всех ПС из source_html/xml")
    parser.add_argument(
        "--only-missing",
        action="store_true",
        default=True,
        help="Только пустые ОКЗ (по умолчанию)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Перезаписать ОКЗ из источника даже если уже заполнены",
    )
    parser.add_argument("--dry-run", action="store_true", help="Без commit в БД")
    parser.add_argument("--limit", type=int, default=None, help="Ограничить число ПС")
    parser.add_argument("--ps-code", type=str, default=None, help="Только один код ПС, напр. 12.013")
    parser.add_argument("--reg-number", type=str, default=None, help="Только один рег. номер")
    args = parser.parse_args()

    os.makedirs(REPORT_DIR, exist_ok=True)
    session = SessionLocal()
    try:
        summary = repair_all_okz(
            session,
            only_missing=not args.force,
            force=args.force,
            limit=args.limit,
            ps_code=args.ps_code,
            reg_number=args.reg_number,
            dry_run=args.dry_run,
        )
    finally:
        session.close()

    summary["ran_at"] = datetime.now(timezone.utc).isoformat()
    summary["dry_run"] = bool(args.dry_run)
    summary["force"] = bool(args.force)

    # В JSON не тащим все items целиком, если их слишком много — оставляем ошибки и изменённые
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    lines = [
        f"OKZ repair all @ {summary['ran_at']}",
        f"dry_run={summary['dry_run']} force={summary['force']}",
        f"total={summary['total']} examined={summary['examined']}",
        f"changed={summary['changed']} skipped_filled={summary['skipped_filled']}",
        f"no_source={summary['no_source']} errors={summary['errors']}",
        f"otf_filled={summary['otf_filled']}",
        "",
    ]
    for item in summary.get("items") or []:
        if not item.get("changed") and not item.get("error"):
            continue
        lines.append(
            f"{item.get('ps_code') or '-'} reg={item.get('reg_number')} "
            f"src={item.get('source')} changed={item.get('changed')} "
            f"err={item.get('error') or '-'} "
            f"stats={item.get('stats')}"
        )
    text = "\n".join(lines) + "\n"
    with open(REPORT_TXT, "w", encoding="utf-8") as f:
        f.write(text)
    print(text)
    print(f"Report: {REPORT_TXT}")
    return 1 if summary["errors"] and summary["changed"] == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
