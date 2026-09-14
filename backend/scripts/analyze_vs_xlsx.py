"""Анализ vs.xlsx: кол1=сайт Минтруда, кол2=реестр."""
from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "scripts"))

from compare_ps_with_xlsx import load_xlsx_openpyxl, _trim_row

VS_PATH = r"c:\Users\Mihail\Downloads\vs.xlsx"
OUT_JSON = os.path.join(os.path.dirname(__file__), "output", "vs_xlsx_analysis.json")
OUT_TXT = os.path.join(os.path.dirname(__file__), "output", "vs_xlsx_analysis.txt")

PS_CODE_RE = re.compile(r"^\d{2}\.\d{3}$")


def norm_code(value) -> str:
    s = str(value or "").strip()
    if PS_CODE_RE.match(s):
        return s
    # иногда в ячейке лишние пробелы или число как float
    if re.fullmatch(r"\d+\.0", s):
        s = s[:-2]
    return s if PS_CODE_RE.match(s) else ""


def load_vs(path: str) -> tuple[list[str], list[str]]:
    rows = [_trim_row(r) for r in load_xlsx_openpyxl(path)]
    site_codes: list[str] = []
    registry_codes: list[str] = []
    for row in rows:
        if not row:
            continue
        c1 = norm_code(row[0] if len(row) > 0 else "")
        c2 = norm_code(row[1] if len(row) > 1 else "")
        if c1:
            site_codes.append(c1)
        if c2:
            registry_codes.append(c2)
    return site_codes, registry_codes


def main() -> int:
    if not os.path.isfile(VS_PATH):
        print(f"Файл не найден: {VS_PATH}")
        return 1

    site_codes, registry_codes = load_vs(VS_PATH)
    site_counter = Counter(site_codes)
    registry_set = set(registry_codes)
    site_unique = set(site_codes)

    dup_on_site = sorted(
        [(code, cnt) for code, cnt in site_counter.items() if cnt > 1],
        key=lambda x: x[0],
    )
    missing_on_site = sorted(registry_set - site_unique)

    report = {
        "file": VS_PATH,
        "site_rows_with_code": len(site_codes),
        "site_unique_codes": len(site_unique),
        "registry_rows_with_code": len(registry_codes),
        "registry_unique_codes": len(registry_set),
        "duplicates_on_site_count": len(dup_on_site),
        "duplicates_on_site": [{"ps_code": c, "times": n} for c, n in dup_on_site],
        "missing_on_site_count": len(missing_on_site),
        "missing_on_site": missing_on_site,
    }

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    lines = [
        f"Файл: {VS_PATH}",
        f"Кодов на сайте (строк): {len(site_codes)}, уникальных: {len(site_unique)}",
        f"Кодов в реестре (строк): {len(registry_codes)}, уникальных: {len(registry_set)}",
        "",
        f"ДУБЛИКАТЫ на сайте Минтруда ({len(dup_on_site)} кодов):",
    ]
    if dup_on_site:
        for code, cnt in dup_on_site:
            lines.append(f"  {code} — {cnt} раз")
    else:
        lines.append("  (нет)")

    lines += ["", f"Кодов из реестра, которых НЕТ на сайте ({len(missing_on_site)}):"]
    if missing_on_site:
        for code in missing_on_site:
            lines.append(f"  {code}")
    else:
        lines.append("  (нет)")

    with open(OUT_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print("\n".join(lines))
    print(f"\nJSON: {OUT_JSON}")
    print(f"TXT:  {OUT_TXT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
