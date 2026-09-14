"""
Анализ Reestr_PS.xlsx: колонки, в т.ч. «Совет по профессиональным квалификациям» (СПК).

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\inspect_reestr_ps_xlsx.py
  venv\\Scripts\\python.exe scripts\\inspect_reestr_ps_xlsx.py "C:\\IT\\DRC\\Reestr_PS.xlsx"

Результат:
  scripts/output/reestr_ps_inspect.json
  scripts/output/reestr_ps_inspect.txt
"""
from __future__ import annotations

import json
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "scripts"))

from compare_ps_with_xlsx import (  # noqa: E402
    find_header_row,
    is_valid_reg_number,
    load_xlsx_openpyxl,
    load_xlsx_stdlib,
    normalize_reg,
)

DEFAULT_PATH = r"C:\IT\DRC\Reestr_PS.xlsx"
OUT_JSON = os.path.join(os.path.dirname(__file__), "output", "reestr_ps_inspect.json")
OUT_TXT = os.path.join(os.path.dirname(__file__), "output", "reestr_ps_inspect.txt")


def load_rows(path: str) -> list[list[str]]:
    try:
        return load_xlsx_openpyxl(path)
    except ImportError:
        return load_xlsx_stdlib(path)


def find_column(header: list[str], *needles: str) -> int | None:
    for index, raw in enumerate(header):
        name = (raw or "").strip().lower()
        if any(needle in name for needle in needles):
            return index
    return None


def inspect(path: str) -> dict:
    rows = load_rows(path)
    header_row_idx, header_lower = find_header_row(rows)
    if header_row_idx is None:
        header_row_idx = 0
        header_lower = [str(c or "").strip().lower() for c in rows[0]]

    header_display = [str(c or "").strip() for c in rows[header_row_idx]]

    reg_idx = find_column(header_lower, "регистрацион")
    code_idx = find_column(header_lower, "код проф")
    name_idx = find_column(header_lower, "наимен", "проф")
    spk_idx = find_column(
        header_lower,
        "совет по профессиональным квалификациям",
        "спк",
        "совет",
    )
    developer_idx = find_column(header_lower, "ответствен", "разработ")

    data_rows = rows[header_row_idx + 1 :]
    valid_rows = []
    spk_values: list[str] = []

    for row in data_rows:
        if not row or not any(row):
            continue
        reg = normalize_reg(row[reg_idx] if reg_idx is not None and reg_idx < len(row) else "")
        if not is_valid_reg_number(reg):
            continue
        spk = ""
        if spk_idx is not None and spk_idx < len(row) and row[spk_idx]:
            spk = str(row[spk_idx]).strip()
        if spk:
            spk_values.append(spk)
        valid_rows.append(
            {
                "reg_number": reg,
                "ps_code": str(row[code_idx] or "").strip() if code_idx is not None and code_idx < len(row) else "",
                "name": str(row[name_idx] or "").strip() if name_idx is not None and name_idx < len(row) else "",
                "spk": spk,
                "developer": str(row[developer_idx] or "").strip()
                if developer_idx is not None and developer_idx < len(row)
                else "",
            }
        )

    unique_spk = sorted(set(spk_values))
    return {
        "file": path,
        "total_rows_in_sheet": len(rows),
        "header_row": header_row_idx + 1,
        "headers": [{"index": i, "name": h} for i, h in enumerate(header_display) if h],
        "columns": {
            "reg_number": {"index": reg_idx, "header": header_display[reg_idx] if reg_idx is not None else None},
            "ps_code": {"index": code_idx, "header": header_display[code_idx] if code_idx is not None else None},
            "name": {"index": name_idx, "header": header_display[name_idx] if name_idx is not None else None},
            "spk": {"index": spk_idx, "header": header_display[spk_idx] if spk_idx is not None else None},
            "developer": {
                "index": developer_idx,
                "header": header_display[developer_idx] if developer_idx is not None else None,
            },
        },
        "valid_ps_rows": len(valid_rows),
        "rows_with_spk": len(spk_values),
        "unique_spk_count": len(unique_spk),
        "unique_spk": unique_spk,
        "sample_rows": valid_rows[:8],
    }


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PATH
    if not os.path.isfile(path):
        print(f"Файл не найден: {path}")
        return 1

    report = inspect(path)
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    lines = [
        f"file: {report['file']}",
        f"header row: {report['header_row']}",
        f"valid PS rows: {report['valid_ps_rows']}",
        f"rows with SPK: {report['rows_with_spk']}",
        f"unique SPK: {report['unique_spk_count']}",
        "",
        "headers:",
    ]
    for item in report["headers"]:
        lines.append(f"  [{item['index']}] {item['name']}")
    lines.append("")
    spk_col = report["columns"]["spk"]
    lines.append(f"SPK column: index={spk_col['index']}, header={spk_col['header']!r}")
    lines.append("")
    lines.append("unique SPK names:")
    for name in report["unique_spk"]:
        lines.append(f"  - {name}")
    lines.append("")
    lines.append("sample rows:")
    for row in report["sample_rows"]:
        lines.append(
            f"  reg={row['reg_number']} code={row['ps_code']} spk={row['spk'][:80]}{'…' if len(row['spk']) > 80 else ''}"
        )

    text = "\n".join(lines)
    with open(OUT_TXT, "w", encoding="utf-8") as f:
        f.write(text)

    print(text)
    print(f"\nSaved: {OUT_JSON}")
    print(f"Saved: {OUT_TXT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
