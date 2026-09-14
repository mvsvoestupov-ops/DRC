"""
Догрузка ПС, которых нет в БД, по отчёту compare_ps_with_xlsx.py

Источник: classinform.ru (основной), реестр Минтруда (резерв).
Для неуникальных кодов ПС в XLSX — только Минтруд по reg.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\compare_ps_with_xlsx.py
  venv\\Scripts\\python.exe scripts\\load_missing_from_xlsx.py
"""
from __future__ import annotations

import json
import os
import sys
import time
import warnings

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.classinform_parser import build_ps_index, load_ps_from_classinform
from app.registry_status import STATUS_REVOKED
from app.parser import find_element_id_by_reg_number
from scripts.load_missing_standards import load_professional_standard_by_id
from compare_ps_with_xlsx import load_xlsx, resolve_xlsx_path

REPORT_PATH = os.path.join(os.path.dirname(__file__), "output", "missing_vs_xlsx_2026.json")


def _is_revoked(item: dict) -> bool:
    if item.get("status") == STATUS_REVOKED:
        return True
    order_number = item.get("order_number") or ""
    return "утратил" in order_number.lower()


def _ambiguous_ps_codes() -> set[str]:
    counts: dict[str, int] = {}
    for row in load_xlsx(resolve_xlsx_path(None)):
        code = (row.get("ps_code") or "").strip()
        if code:
            counts[code] = counts.get(code, 0) + 1
    return {code for code, cnt in counts.items() if cnt > 1}


def main() -> None:
    warnings.filterwarnings("ignore", message="Unverified HTTPS request")

    if not os.path.exists(REPORT_PATH):
        print("Сначала запустите:")
        print("  venv\\Scripts\\python.exe scripts\\compare_ps_with_xlsx.py")
        sys.exit(1)

    with open(REPORT_PATH, encoding="utf-8") as f:
        report = json.load(f)

    missing = report.get("missing_in_db", [])
    if not missing:
        print("Недostающих ПС не найдено — БД совпадает с XLSX.")
        return

    refresh_index = "--refresh-index" in sys.argv
    skip_revoked = "--include-revoked" not in sys.argv
    ambiguous_codes = _ambiguous_ps_codes()
    if ambiguous_codes:
        print(f"Неуникальные коды ПС в XLSX ({len(ambiguous_codes)}): {', '.join(sorted(ambiguous_codes)[:10])}"
              + (" ..." if len(ambiguous_codes) > 10 else ""))

    print(f"Догрузка {len(missing)} профстандартов...")
    print("Индекс classinform.ru...")
    index = build_ps_index(refresh=refresh_index)

    loaded = 0
    skipped = 0
    failed = []

    for i, item in enumerate(missing, 1):
        reg = item["reg_number"]
        ps_code = item.get("ps_code") or ""
        order_number = item.get("order_number") or ""
        name = (item.get("name") or "")[:60]
        print(f"\n[{i}/{len(missing)}] Рег. № {reg} ({ps_code}) — {name}")

        if skip_revoked and _is_revoked(item):
            print("  ⊘ Пропуск: приказ утратил силу")
            skipped += 1
            continue

        use_classinform = bool(ps_code) and ps_code not in ambiguous_codes
        if use_classinform and load_ps_from_classinform(ps_code, reg_number=reg, index=index):
            loaded += 1
            time.sleep(0.3)
            continue

        if ps_code in ambiguous_codes:
            print("  код ПС не уникален — загрузка с сайта Минтруда по reg")
        else:
            print("  classinform не сработал, пробуем Минтруд...")

        eid = find_element_id_by_reg_number(reg, ps_code=None, order_number=order_number)
        if not eid:
            print("  ✗ Не найден ни на classinform, ни в реестре Минтруда")
            failed.append({"reg_number": reg, "ps_code": ps_code, "error": "not found"})
            time.sleep(0.3)
            continue

        print(f"  ELEMENT_ID={eid}")
        load_professional_standard_by_id(eid)
        loaded += 1
        time.sleep(0.3)

    print("\n" + "=" * 60)
    print(f"Загружено: {loaded}, пропущено: {skipped}, ошибок: {len(failed)}")
    if failed:
        print("Не загружены:")
        for row in failed:
            print(f"  reg={row['reg_number']} ({row.get('ps_code', '')}): {row['error']}")
    print("\nПроверка: venv\\Scripts\\python.exe scripts\\compare_ps_with_xlsx.py")
    print("=" * 60)

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
