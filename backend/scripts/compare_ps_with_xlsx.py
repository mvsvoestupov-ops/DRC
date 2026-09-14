"""
Сравнение официального XLSX реестра ПС с локальной БД.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\compare_ps_with_xlsx.py
  venv\\Scripts\\python.exe scripts\\compare_ps_with_xlsx.py "C:\\path\\to\\file.xlsx"

Отчёт:
  backend\\missing_vs_xlsx_2026.txt
  backend\\scripts\\output\\missing_vs_xlsx_2026.txt
  backend\\scripts\\output\\missing_vs_xlsx_2026.json  — для догрузки
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import traceback
import xml.etree.ElementTree as ET
import zipfile

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
XLSX_PATH_FILE = os.path.join(os.path.dirname(__file__), "xlsx_path.txt")
DEFAULT_XLSX = r"c:\Users\Mihail\Downloads\Реестр профессиональных стандартов 18.08.2026.xlsx"
DB_PATH = os.path.join(BACKEND_DIR, "profstandart.db")
ERROR_LOG = os.path.join(OUTPUT_DIR, "compare_xlsx_error.log")

XLSX_KEYWORDS = ("реестр", "профессион", "стандарт", "profstand", "professional", "standard")
PS_CODE_RE = re.compile(r"^\d{2}\.\d{3}$")
REG_NUMBER_RE = re.compile(r"^\d+$")


def normalize_reg(reg) -> str:
    if reg is None:
        return ""
    s = str(reg).strip()
    if s.lower() in ("none", "nan", ""):
        return ""
    if re.fullmatch(r"\d+\.0", s):
        s = s[:-2]
    return s


def find_xlsx_in_downloads() -> str | None:
    downloads = os.path.join(os.path.expanduser("~"), "Downloads")
    if not os.path.isdir(downloads):
        return None

    scored: list[tuple[int, float, str]] = []
    try:
        names = os.listdir(downloads)
    except OSError:
        return None

    for name in names:
        if not name.lower().endswith(".xlsx"):
            continue
        path = os.path.join(downloads, name)
        lower = name.lower()
        score = sum(1 for kw in XLSX_KEYWORDS if kw in lower)
        if score == 0:
            continue
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            mtime = 0
        scored.append((score, mtime, path))

    if not scored:
        return None

    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return scored[0][2]


def read_xlsx_path_file() -> str | None:
    if not os.path.isfile(XLSX_PATH_FILE):
        return None
    with open(XLSX_PATH_FILE, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            path = os.path.expandvars(os.path.expanduser(line))
            if os.path.isfile(path):
                return path
            raise FileNotFoundError(f"Файл из xlsx_path.txt не найден: {path}")
    return None


def list_downloads_xlsx() -> list[str]:
    downloads = os.path.join(os.path.expanduser("~"), "Downloads")
    if not os.path.isdir(downloads):
        return []
    try:
        return sorted(
            name
            for name in os.listdir(downloads)
            if name.lower().endswith(".xlsx")
        )
    except OSError:
        return []


def resolve_xlsx_path(cli_path: str | None) -> str:
    if cli_path:
        path = os.path.abspath(os.path.expandvars(os.path.expanduser(cli_path)))
        if not os.path.exists(path):
            raise FileNotFoundError(f"Файл XLSX не найден: {path}")
        return path

    from_file = read_xlsx_path_file()
    if from_file:
        print(f"XLSX из scripts/xlsx_path.txt: {from_file}")
        return from_file

    if os.path.exists(DEFAULT_XLSX):
        return DEFAULT_XLSX

    found = find_xlsx_in_downloads()
    if found:
        print(f"XLSX найден в Downloads: {found}")
        return found

    hint_lines = [
        "Файл XLSX не найден.",
        f"  scripts/xlsx_path.txt — укажите путь (UTF-8, одна строка)",
        f"  или: venv\\Scripts\\python.exe scripts\\compare_ps_with_xlsx.py \"C:\\path\\file.xlsx\"",
    ]
    xlsx_list = list_downloads_xlsx()
    if xlsx_list:
        hint_lines.append("  XLSX в Downloads:")
        for name in xlsx_list[:15]:
            hint_lines.append(f"    - {name}")
    raise FileNotFoundError("\n".join(hint_lines))


def _cell_col_index(cell_ref: str) -> int:
    col = 0
    for ch in cell_ref:
        if ch.isalpha():
            col = col * 26 + (ord(ch.upper()) - ord("A") + 1)
        else:
            break
    return col - 1


def _cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    value_el = cell.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
    if value_el is None or value_el.text is None:
        inline = cell.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}is")
        if inline is not None:
            texts = inline.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
            return "".join(t.text or "" for t in texts)
        return ""

    raw = value_el.text
    if cell_type == "s":
        try:
            return shared_strings[int(raw)]
        except (ValueError, IndexError):
            return raw
    return raw


def _format_cell_value(value: str) -> str:
    if not value:
        return ""
    if re.fullmatch(r"\d+\.0", value):
        return value[:-2]
    return value.strip()


def load_xlsx_stdlib(path: str) -> list[list[str]]:
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as zf:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root.findall("m:si", ns):
                texts = si.findall(".//m:t", ns)
                if texts:
                    shared_strings.append("".join(t.text or "" for t in texts))
                else:
                    shared_strings.append("")

        sheet_name = next((n for n in zf.namelist() if n.startswith("xl/worksheets/sheet")), None)
        if not sheet_name:
            raise ValueError("В XLSX не найден лист")

        sheet_root = ET.fromstring(zf.read(sheet_name))
        rows_by_num: dict[int, dict[int, str]] = {}
        max_col = 0
        for row_el in sheet_root.findall(".//m:sheetData/m:row", ns):
            row_num = int(row_el.attrib.get("r", "0") or 0)
            row_cells: dict[int, str] = {}
            for cell in row_el.findall("m:c", ns):
                ref = cell.attrib.get("r", "")
                col_idx = _cell_col_index(ref) if ref else len(row_cells)
                row_cells[col_idx] = _format_cell_value(_cell_value(cell, shared_strings))
                max_col = max(max_col, col_idx)
            if row_cells:
                rows_by_num[row_num] = row_cells

    if not rows_by_num:
        return []

    table: list[list[str]] = []
    for row_num in sorted(rows_by_num):
        row_cells = rows_by_num[row_num]
        table.append([row_cells.get(i, "") for i in range(max_col + 1)])
    return table


def _trim_row(row: tuple | list, max_cols: int = 25) -> list[str]:
    cells = [_format_cell_value("" if c is None else str(c)) for c in row[:max_cols]]
    while cells and not cells[-1]:
        cells.pop()
    return cells


def is_valid_reg_number(reg: str) -> bool:
    if not reg or not REG_NUMBER_RE.match(reg):
        return False
    return 1 <= int(reg) <= 9999


def find_header_row(rows: list[list[str]]) -> tuple[int, list[str]] | tuple[None, None]:
    for i, row in enumerate(rows[:50]):
        header = [str(c or "").strip().lower() for c in row[:25]]
        joined = " ".join(h for h in header if h)
        if "регистрацион" in joined:
            return i, header
        if any("регистрацион" in h for h in header):
            return i, header
    return None, None


def map_columns(header: list[str]) -> dict[str, int | None]:
    reg_idx = next((i for i, h in enumerate(header) if "регистрацион" in h), None)
    code_idx = next((i for i, h in enumerate(header) if "код проф" in h), None)
    name_idx = next((i for i, h in enumerate(header) if "наимен" in h and "проф" in h), None)
    if name_idx is None:
        name_idx = next((i for i, h in enumerate(header) if "наимен" in h), None)
    order_idx = next((i for i, h in enumerate(header) if "приказ" in h or "реквизит" in h), None)
    date_idx = next((i for i, h in enumerate(header) if "дата" in h and "регист" in h), None)
    if reg_idx is None:
        raise ValueError("Не найдена колонка «Регистрационный номер» в XLSX")
    return {
        "reg_idx": reg_idx,
        "code_idx": code_idx,
        "name_idx": name_idx,
        "order_idx": order_idx,
        "date_idx": date_idx,
    }


def infer_columns_from_data(rows: list[list[str]]) -> dict[str, int | None]:
    sample = [r for r in rows if r and any(r)][:400]
    if not sample:
        raise ValueError("Нет данных для определения колонок XLSX")

    max_cols = min(25, max(len(r) for r in sample))
    ps_scores = [0] * max_cols
    reg_scores = [0] * max_cols

    for row in sample:
        for col in range(min(len(row), max_cols)):
            value = str(row[col] or "").strip()
            if PS_CODE_RE.match(value):
                ps_scores[col] += 1
            if is_valid_reg_number(value):
                reg_scores[col] += 1

    code_idx = ps_scores.index(max(ps_scores))
    if ps_scores[code_idx] < 10:
        raise ValueError("Не удалось определить колонку с кодом ПС (XX.XXX)")

    reg_idx = None
    best_reg_score = 0
    for col, score in enumerate(reg_scores):
        if col == code_idx:
            continue
        if score > best_reg_score:
            best_reg_score = score
            reg_idx = col

    if reg_idx is None or best_reg_score < 10:
        raise ValueError("Не удалось определить колонку с регистрационным номером")

    name_idx = code_idx + 1 if code_idx + 1 < max_cols else None
    print(f"Колонки определены по данным: reg={reg_idx}, code={code_idx}, name={name_idx}")
    return {
        "reg_idx": reg_idx,
        "code_idx": code_idx,
        "name_idx": name_idx,
        "order_idx": None,
        "date_idx": None,
    }


def load_xlsx_openpyxl(path: str) -> list[list[str]]:
    import openpyxl

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = [_trim_row(row) for row in ws.iter_rows(values_only=True)]
    wb.close()
    return [r for r in rows if r]


def _is_garbage_xlsx_name(name: str) -> bool:
    text = (name or "").strip()
    if not text:
        return True
    if text.isdigit():
        return True
    return len(text) < 5


def _merge_xlsx_item(existing: dict, row: dict) -> dict:
    """
    При повторе reg_number (несколько редакций одного ПС в Excel):
    — актуальная (не revoked) редакция побеждает;
    — валидный ps_code / нормальное название не затираются пустыми
      или «мусорными» значениями со строки старой редакции.
    """
    from app.registry_status import STATUS_REVOKED

    merged = dict(existing)
    existing_revoked = existing.get("status") == STATUS_REVOKED
    row_revoked = row.get("status") == STATUS_REVOKED

    def take_code(target: dict, source: dict) -> None:
        src = (source.get("ps_code") or "").strip()
        if src and not (target.get("ps_code") or "").strip():
            target["ps_code"] = src

    def take_name(target: dict, source: dict) -> None:
        src = (source.get("name") or "").strip()
        if not src or _is_garbage_xlsx_name(src):
            return
        if _is_garbage_xlsx_name(target.get("name") or ""):
            target["name"] = src

    # Активная редакция важнее исторической «утратил силу»
    if existing_revoked and not row_revoked:
        merged["status"] = row.get("status") or merged.get("status")
        merged["revoked_date"] = row.get("revoked_date") or ""
        if row.get("order_number"):
            merged["order_number"] = row["order_number"]
        if row.get("approval_date"):
            merged["approval_date"] = row["approval_date"]
        if row.get("ps_code"):
            merged["ps_code"] = row["ps_code"]
        take_name(merged, row)
        take_code(merged, row)
        return merged

    if (not existing_revoked) and row_revoked:
        # Не затираем актуальную редакцию старой revoked-строкой
        take_code(merged, row)
        take_name(merged, row)
        return merged

    # Обе активны или обе revoked — дополняем пустые поля
    take_code(merged, row)
    take_name(merged, row)
    if row_revoked:
        merged["status"] = STATUS_REVOKED
        if row.get("revoked_date"):
            merged["revoked_date"] = row["revoked_date"]
        if row.get("order_number") and (
            not merged.get("order_number") or "утратил" not in (merged.get("order_number") or "").lower()
        ):
            # для двух revoked оставляем более информативный order при необходимости
            if "утратил" in (row.get("order_number") or "").lower():
                merged["order_number"] = row["order_number"]
    elif row.get("order_number") and not merged.get("order_number"):
        merged["order_number"] = row["order_number"]
    if row.get("approval_date") and not merged.get("approval_date"):
        merged["approval_date"] = row["approval_date"]
    return merged


def _normalize_ps_code_cell(raw: str) -> str:
    """
    Код ПС из Excel: текст «40.001» или число, ставшее «40.01» / «1.001».
    """
    text = (raw or "").strip()
    if not text or text.lower() in ("none", "nan"):
        return ""
    if PS_CODE_RE.match(text):
        return text
    # Число из Excel: 40.01 → 40.010, 1.001 → 01.001
    if re.fullmatch(r"\d{1,2}\.\d{1,3}", text):
        left, right = text.split(".", 1)
        return f"{int(left):02d}.{int(right):03d}"
    # Float-шум: 40.000999999999997
    if re.fullmatch(r"\d{1,2}\.\d+", text):
        try:
            value = float(text)
        except ValueError:
            return ""
        whole = int(value)
        frac = int(round((value - whole) * 1000))
        if frac < 0 or frac > 999:
            return ""
        candidate = f"{whole:02d}.{frac:03d}"
        if PS_CODE_RE.match(candidate):
            return candidate
    return ""


def count_revoked_rows_in_xlsx(rows: list[list[str]], cols: dict) -> dict:
    """Подсчёт для диагностики: строки vs уникальные reg."""
    reg_idx = cols["reg_idx"]
    order_idx = cols["order_idx"]
    rows_with_utratil = 0
    rows_revoked = 0
    unique_revoked_regs: set[str] = set()

    for row in rows:
        if not row or not any(row):
            continue
        reg = normalize_reg(row[reg_idx] if reg_idx is not None and reg_idx < len(row) else "")
        if not is_valid_reg_number(reg):
            continue
        order_number = str(row[order_idx] or "").strip() if order_idx is not None and order_idx < len(row) else ""
        norm = re.sub(r"\s+", " ", order_number.lower())
        if "утратил" not in norm:
            continue
        rows_with_utratil += 1
        from app.registry_status import STATUS_REVOKED, parse_registry_status

        if parse_registry_status(order_number).status == STATUS_REVOKED:
            rows_revoked += 1
            unique_revoked_regs.add(reg)

    return {
        "rows_with_utratil_in_order": rows_with_utratil,
        "rows_revoked_parsed": rows_revoked,
        "unique_revoked_regs": len(unique_revoked_regs),
    }


def parse_xlsx_rows(rows: list[list[str]]) -> list[dict]:
    if not rows:
        raise ValueError("XLSX пустой или не содержит строк")

    trimmed = [_trim_row(r) for r in rows if r and any(r)]
    if not trimmed:
        raise ValueError("XLSX не содержит непустых строк")

    header_info = find_header_row(trimmed)
    if header_info[0] is not None:
        header_row_idx, header = header_info
        cols = map_columns(header)
        data_rows = trimmed[header_row_idx + 1 :]
        print(f"Строка заголовков XLSX: {header_row_idx + 1}")
        print(f"Заголовки: {[h for h in header if h][:8]}")
    else:
        print("Строка заголовков не найдена — определение колонок по содержимому")
        cols = infer_columns_from_data(trimmed)
        data_rows = trimmed

    reg_idx = cols["reg_idx"]
    code_idx = cols["code_idx"]
    name_idx = cols["name_idx"]
    order_idx = cols["order_idx"]
    date_idx = cols["date_idx"]

    from app.registry_status import STATUS_REVOKED, parse_registry_status

    by_reg: dict[str, dict] = {}
    duplicate_regs = 0
    for row in data_rows:
        if not row or not any(row):
            continue
        reg = normalize_reg(row[reg_idx] if reg_idx is not None and reg_idx < len(row) else "")
        if not is_valid_reg_number(reg):
            continue

        ps_code = ""
        if code_idx is not None and code_idx < len(row):
            ps_code = _normalize_ps_code_cell(str(row[code_idx] or "").strip())
            if ps_code and not PS_CODE_RE.match(ps_code):
                ps_code = ""

        order_number = str(row[order_idx] or "").strip() if order_idx is not None and order_idx < len(row) else ""
        status_info = parse_registry_status(order_number)

        item = {
            "reg_number": reg,
            "ps_code": ps_code,
            "name": str(row[name_idx] or "").strip() if name_idx is not None and name_idx < len(row) else "",
            "order_number": order_number,
            "approval_date": str(row[date_idx] or "").strip() if date_idx is not None and date_idx < len(row) else "",
            "status": status_info.status,
            "revoked_date": status_info.revoked_date or "",
        }

        if reg in by_reg:
            duplicate_regs += 1
            by_reg[reg] = _merge_xlsx_item(by_reg[reg], item)
        else:
            by_reg[reg] = item

    items = list(by_reg.values())
    if duplicate_regs:
        print(f"Дубликаты reg в XLSX (объединены): {duplicate_regs}")

    if not items:
        raise ValueError(
            "В XLSX не найдено ни одной записи с рег. номером. "
            "Проверьте структуру колонок."
        )
    return items


def load_xlsx(path: str) -> list[dict]:
    try:
        import openpyxl  # noqa: F401

        rows = load_xlsx_openpyxl(path)
        print("Чтение XLSX: openpyxl")
    except ImportError:
        print("openpyxl не установлен — чтение XLSX встроенным парсером")
        rows = load_xlsx_stdlib(path)
    return parse_xlsx_rows(rows)


def collect_xlsx_ps_codes(path: str | None = None) -> set[str]:
    """
    Все валидные коды ПС из Excel, включая строки дубликатов редакций.
    Нужен, чтобы код вроде 40.001 не терялся при merge со старой revoked-строкой.
    """
    from app.qualification_links import normalize_ps_code

    xlsx_path = resolve_xlsx_path(path)
    try:
        import openpyxl  # noqa: F401

        raw_rows = load_xlsx_openpyxl(xlsx_path)
    except ImportError:
        raw_rows = load_xlsx_stdlib(xlsx_path)

    trimmed = [_trim_row(r) for r in raw_rows if r and any(r)]
    if not trimmed:
        return set()

    header_info = find_header_row(trimmed)
    if header_info[0] is not None:
        header_row_idx, header = header_info
        cols = map_columns(header)
        data_rows = trimmed[header_row_idx + 1 :]
    else:
        cols = infer_columns_from_data(trimmed)
        data_rows = trimmed

    code_idx = cols.get("code_idx")
    reg_idx = cols.get("reg_idx")
    codes: set[str] = set()
    for row in data_rows:
        if not row or not any(row):
            continue
        reg = normalize_reg(row[reg_idx] if reg_idx is not None and reg_idx < len(row) else "")
        if not is_valid_reg_number(reg):
            continue
        if code_idx is None or code_idx >= len(row):
            continue
        n = normalize_ps_code(_normalize_ps_code_cell(str(row[code_idx] or "").strip()))
        if n:
            codes.add(n)
    return codes


def load_db_standards() -> dict[str, dict]:
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(
            f"База данных не найдена: {DB_PATH}\n"
            "Запускайте скрипт из папки backend (run-compare-xlsx.bat делает это автоматически)."
        )

    from app.db import SessionLocal
    from app.db.raw_models import StandardRaw

    session = SessionLocal()
    try:
        rows = session.query(StandardRaw).all()
        return {
            normalize_reg(r.reg_number): {
                "reg_number": normalize_reg(r.reg_number),
                "name": r.name,
                "element_id": r.element_id,
                "ps_code": getattr(r, "professional_area_code", None),
                "status": getattr(r, "status", None) or "active",
                "revoked_date": getattr(r, "revoked_date", None),
            }
            for r in rows
            if normalize_reg(r.reg_number)
        }
    finally:
        session.close()


def write_reports(xlsx_path: str, xlsx_items: list[dict], db_by_reg: dict[str, dict]) -> tuple[str, str]:
    xlsx_by_reg = {i["reg_number"]: i for i in xlsx_items}
    missing = [xlsx_by_reg[r] for r in xlsx_by_reg if r not in db_by_reg]
    extra = [db_by_reg[r] for r in db_by_reg if r not in xlsx_by_reg]

    missing.sort(key=lambda x: (x.get("ps_code", ""), x["reg_number"]))
    extra.sort(key=lambda x: x["reg_number"])

    report = {
        "xlsx_path": xlsx_path,
        "xlsx_count": len(xlsx_items),
        "db_count": len(db_by_reg),
        "missing_in_db_count": len(missing),
        "extra_in_db_count": len(extra),
        "missing_in_db": missing,
        "extra_in_db": extra,
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_json = os.path.join(OUTPUT_DIR, "missing_vs_xlsx_2026.json")
    out_txt = os.path.join(OUTPUT_DIR, "missing_vs_xlsx_2026.txt")

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    lines = [
        "ОТЧЁТ: ПС из XLSX, которых нет в локальной БД",
        "=" * 60,
        f"Файл XLSX: {xlsx_path}",
        f"Записей в XLSX: {len(xlsx_items)}",
        f"Записей в БД: {len(db_by_reg)}",
        f"Не хватает в БД: {len(missing)}",
        f"Лишних в БД (нет в XLSX): {len(extra)}",
        "",
        "НЕДОСТАЮЩИЕ В БД:",
        "-" * 60,
    ]
    for i, m in enumerate(missing, 1):
        lines.append(f"{i}. Рег. № {m['reg_number']}")
        if m.get("ps_code"):
            lines.append(f"   Код ПС: {m['ps_code']}")
        lines.append(f"   {m.get('name', '')[:200]}")
        lines.append("")

    if extra:
        lines.extend(["", "ЛИШНИЕ В БД (нет в XLSX):", "-" * 60])
        for i, e in enumerate(extra[:30], 1):
            lines.append(
                f"{i}. Рег. № {e['reg_number']} ELEMENT_ID={e.get('element_id', '?')} "
                f"{(e.get('name') or '')[:100]}"
            )

    txt_content = "\n".join(lines)
    with open(out_txt, "w", encoding="utf-8") as f:
        f.write(txt_content)

    copy_txt = os.path.join(BACKEND_DIR, "missing_vs_xlsx_2026.txt")
    with open(copy_txt, "w", encoding="utf-8") as f:
        f.write(txt_content)

    return out_txt, out_json


def main() -> int:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    parser = argparse.ArgumentParser(description="Сравнение XLSX реестра ПС с БД")
    parser.add_argument("xlsx", nargs="?", default=None, help="Путь к XLSX")
    args = parser.parse_args()

    try:
        xlsx_path = resolve_xlsx_path(args.xlsx)

        print("=" * 60)
        print("СРАВНЕНИЕ РЕЕСТРА ПС (XLSX) С БД")
        print("=" * 60)
        print(f"XLSX: {xlsx_path}")
        print(f"БД:   {DB_PATH}")

        xlsx_items = load_xlsx(xlsx_path)
        db_by_reg = load_db_standards()

        print(f"\nВ XLSX: {len(xlsx_items)}")
        print(f"В БД:   {len(db_by_reg)}")

        out_txt, out_json = write_reports(xlsx_path, xlsx_items, db_by_reg)
        missing_count = len([r for r in {i["reg_number"] for i in xlsx_items} if r not in db_by_reg])

        print(f"\nНе хватает в БД: {missing_count}")
        print(f"\nОтчёт: {out_txt}")
        print(f"JSON:  {out_json}")
        print(f"Копия: {os.path.join(BACKEND_DIR, 'missing_vs_xlsx_2026.txt')}")

        if missing_count:
            print("\nДогрузка:")
            print("  venv\\Scripts\\python.exe scripts\\load_missing_from_xlsx.py")

        if os.path.exists(ERROR_LOG):
            os.remove(ERROR_LOG)
        return 0

    except Exception:
        err = traceback.format_exc()
        with open(ERROR_LOG, "w", encoding="utf-8") as f:
            f.write(err)
        print("\nОШИБКА при сравнении XLSX с БД:\n")
        print(err)
        print(f"\nЛог ошибки: {ERROR_LOG}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
