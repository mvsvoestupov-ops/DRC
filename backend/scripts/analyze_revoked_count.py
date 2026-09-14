"""Диагностика подсчёта «утратил силу» в XLSX реестра ПС."""
from __future__ import annotations

import os
import re
import sys
from collections import Counter

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "scripts"))

from app.registry_status import parse_registry_status, REVOKED_RE
from compare_ps_with_xlsx import load_xlsx, load_xlsx_openpyxl, resolve_xlsx_path, parse_xlsx_rows, find_header_row, _trim_row


def normalize_text(value) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).strip().lower())


def row_has_utratil(row: list, cols: list[int] | None = None) -> bool:
    indices = cols if cols is not None else range(len(row))
    for i in indices:
        if i < len(row) and "утратил" in normalize_text(row[i]):
            return True
    return False


def main() -> int:
    path = resolve_xlsx_path(None)
    rows = load_xlsx_openpyxl(path)
    trimmed = [_trim_row(r, max_cols=40) for r in rows if r and any(r)]

    header_info = find_header_row(trimmed)
    header_row_idx, header = header_info if header_info[0] is not None else (None, [])

    order_idx = next((i for i, h in enumerate(header) if "приказ" in h), None)
    data_rows = trimmed[(header_row_idx + 1) if header_row_idx is not None else 0 :]

    # Подсчёты
    count_order_utratil = 0
    count_any_col_utratil = 0
    count_parser_revoked = 0
    count_utratila = 0
    count_multiline_break = 0
    patterns = Counter()
    only_any_not_order: list[tuple] = []
    only_order_not_parser: list[tuple] = []

    parsed_items = load_xlsx(path)
    parsed_revoked_regs = {i["reg_number"] for i in parsed_items if i.get("status") == "revoked"}

    for row in data_rows:
        order_text = str(row[order_idx] if order_idx is not None and order_idx < len(row) else "")
        norm_order = normalize_text(order_text)

        if "утратил" in norm_order:
            count_order_utratil += 1
            patterns[norm_order[:80]] += 1
        if row_has_utratil(row):
            count_any_col_utratil += 1
        if "утратила силу" in norm_order:
            count_utratila += 1
        if re.search(r"утратил\s*\n\s*силу", order_text, re.I):
            count_multiline_break += 1

        info = parse_registry_status(order_text)
        if info.status == "revoked":
            count_parser_revoked += 1
        elif "утратил" in norm_order:
            only_order_not_parser.append((row, order_text))

        if row_has_utratil(row) and not (order_idx is not None and "утратил" in norm_order):
            only_any_not_order.append(row)

    print("=" * 60)
    print("ДИАГНОСТИКА: утратил силу в XLSX")
    print("=" * 60)
    print(f"Файл: {path}")
    print(f"Строк данных (после заголовка): {len(data_rows)}")
    print(f"Записей parse_xlsx_rows (уник. reg): {len(parsed_items)}")
    print(f"revoked по parse_xlsx_rows: {len(parsed_revoked_regs)}")
    print()
    print(f"Строк, где «утратил» в колонке приказа: {count_order_utratil}")
    print(f"Строк, где «утратил» в ЛЮБОЙ колонке:   {count_any_col_utratil}")
    print(f"Строк, где parse_registry_status=revoked: {count_parser_revoked}")
    print(f"  из них «утратила силу» в приказе:       {count_utratila}")
    print(f"  multiline утратил\\nсилу в приказе:      {count_multiline_break}")
    print()
    print(f"REVOKED regex: {REVOKED_RE.pattern}")
    print()

    if only_order_not_parser:
        print(f"«утратил» в приказе, но parser=active ({len(only_order_not_parser)}):")
        for row, text in only_order_not_parser[:15]:
            reg = row[1] if len(row) > 1 else "?"
            print(f"  reg={reg} order={text[:100]!r}")
        if len(only_order_not_parser) > 15:
            print(f"  ... ещё {len(only_order_not_parser) - 15}")

    if only_any_not_order:
        print(f"\n«утратил» не в приказе, но в другой колонке ({len(only_any_not_order)}):")
        for row in only_any_not_order[:10]:
            hits = [f"col{i}={str(row[i])[:60]!r}" for i in range(len(row)) if "утратил" in normalize_text(row[i])]
            print("  " + "; ".join(hits))

    print("\nТоп-10 текстов приказа с «утратил»:")
    for text, cnt in patterns.most_common(10):
        print(f"  [{cnt}x] {text}")

    # Уникальные reg vs строки
    from compare_ps_with_xlsx import normalize_reg, is_valid_reg_number, PS_CODE_RE

    if header_row_idx is not None:
        from compare_ps_with_xlsx import map_columns

        cols = map_columns(header)
        reg_idx = cols["reg_idx"]
        order_idx = cols["order_idx"]
        seen_regs: set[str] = set()
        dup_revoked_rows = 0
        for row in data_rows:
            reg = normalize_reg(row[reg_idx] if reg_idx < len(row) else "")
            order = normalize_text(row[order_idx] if order_idx is not None and order_idx < len(row) else "")
            if "утратил" not in order:
                continue
            if reg in seen_regs:
                dup_revoked_rows += 1
            seen_regs.add(reg)
        print(f"\nСтрок с «утратил» в приказе, но дубли reg: {dup_revoked_rows}")
        print(f"Уникальных reg с «утратил» в приказе: {len(seen_regs)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
