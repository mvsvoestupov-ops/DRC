"""
Синхронизация status и revoked_date для ПС из официального XLSX реестра.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\sync_ps_status_from_xlsx.py
"""
from __future__ import annotations

import json
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "scripts"))

from app.db import SessionLocal
from app.db.schema import ensure_ps_status_columns
from app.registry_status import STATUS_REVOKED, sync_status_to_db
from compare_ps_with_xlsx import (
    count_revoked_rows_in_xlsx,
    find_header_row,
    load_xlsx,
    load_xlsx_openpyxl,
    map_columns,
    resolve_xlsx_path,
    _trim_row,
)

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "output", "ps_status_sync.json")


def main() -> int:
    added = ensure_ps_status_columns()
    if added:
        print("Добавлены колонки:", ", ".join(added))

    xlsx_path = resolve_xlsx_path(None)
    raw_rows = load_xlsx_openpyxl(xlsx_path)
    trimmed = [_trim_row(r) for r in raw_rows if r and any(r)]
    header_info = find_header_row(trimmed)
    row_stats = {}
    if header_info[0] is not None:
        header_row_idx, header = header_info
        cols = map_columns(header)
        data_rows = trimmed[header_row_idx + 1 :]
        row_stats = count_revoked_rows_in_xlsx(data_rows, cols)

    items = load_xlsx(xlsx_path)

    session = SessionLocal()
    try:
        stats = sync_status_to_db(session, items)
    finally:
        session.close()

    revoked_rows = [i for i in items if i.get("status") == STATUS_REVOKED]
    revoked_no_date = [i for i in revoked_rows if not i.get("revoked_date")]

    print("\n" + "=" * 60)
    print("СИНХРОНИЗАЦИЯ СТАТУСА ПС ИЗ XLSX")
    print("=" * 60)
    print(f"XLSX: {xlsx_path}")
    print(f"Записей в XLSX (уник. reg): {stats['xlsx_total']}")
    if row_stats:
        print(f"Строк с «утратил» в колонке приказа: {row_stats['rows_with_utratil_in_order']}")
        print(f"Строк, распознанных как revoked:     {row_stats['rows_revoked_parsed']}")
        print(f"Уникальных reg revoked (по строкам): {row_stats['unique_revoked_regs']}")
    print(f"Утратили силу (после объединения reg): {stats['revoked_in_xlsx']}")
    print(f"  из них с датой: {stats['revoked_with_date']}")
    print(f"  без даты в тексте приказа: {len(revoked_no_date)}")
    print(f"Обновлено raw_standards: {stats['raw_updated']}")
    print(f"Обновлено enriched_standards: {stats['enriched_updated']}")
    print(f"В XLSX, но нет в БД: {len(stats['missing_in_db'])}")

    if revoked_rows[:10]:
        print("\nПримеры утративших силу (первые 10):")
        for item in revoked_rows[:10]:
            date_part = item.get("revoked_date") or "дата не указана"
            print(
                f"  reg={item['reg_number']} {item.get('ps_code', '')} "
                f"— {date_part} — {(item.get('order_number') or '')[:50]}"
            )

    report = {
        "xlsx_path": xlsx_path,
        **stats,
        **row_stats,
        "revoked_without_date_count": len(revoked_no_date),
        "revoked_without_date_regs": [i["reg_number"] for i in revoked_no_date[:100]],
    }
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nОтчёт: {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
