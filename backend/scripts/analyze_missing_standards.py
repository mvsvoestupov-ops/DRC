"""
Сравнение реестра Минтруда (XLSX + сайт) с локальной БД.
Запуск:
  cd backend
  python scripts/analyze_missing_standards.py

Отчёт: backend/scripts/output/missing_standards_report.txt
"""
import json
import os
import re
import sys
import time
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs

from app.db import SessionLocal  # noqa: F401 — регистрация всех ORM-моделей
from app.db.raw_models import StandardRaw
from app.parser import REGISTRY_BASE_URL, get_all_element_ids

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

XLSX_URL = (
    "https://profstandart.rosmintrud.ru/upload/iblock/bd6/"
    "%D0%A0%D0%B5%D0%B5%D1%81%D1%82%D1%80%20%D0%BF%D1%80%D0%BE%D1%84%D0%B5%D1%81%D1%81%D0%B8%D0%BE%D0%BD%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D1%85%20"
    "%1%81%D1%82%D0%B0%D0%BD%D0%B4%D0%B0%D1%80%D1%82%D0%BE%D0%B2%2004.03.2025.xlsx"
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def fetch_registry_page_items(page: int, page_size: int = 100):
    url = f"{REGISTRY_BASE_URL}?PAGEN_1={page}&SIZEN_1={page_size}"
    for attempt in range(3):
        try:
            response = requests.get(url, headers=HEADERS, verify=False, timeout=90)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            items = []
            seen = set()
            for link in soup.find_all("a", href=True):
                href = link["href"]
                if "ELEMENT_ID=" not in href:
                    continue
                if "reestr-professionalnykh-standartov" not in href:
                    continue
                eid = parse_qs(urlparse(href).query).get("ELEMENT_ID", [None])[0]
                if not eid or eid in seen:
                    continue
                seen.add(eid)
                text = link.get_text(" ", strip=True)
                reg = extract_reg_number(text)
                code = extract_ps_code(text)
                items.append({
                    "element_id": eid,
                    "reg_number": reg,
                    "ps_code": code,
                    "link_text": text,
                })
            total_match = re.search(r"из\s*(\d+)", response.text)
            page_total = int(total_match.group(1)) if total_match else None
            return items, page_total
        except Exception as e:
            print(f"  страница {page}, попытка {attempt + 1}/3: {e}")
            time.sleep(2 * (attempt + 1))
    return [], None


def fetch_all_registry_items(page_size: int = 100):
    all_items = {}
    page_total = None
    page = 1
    empty_streak = 0

    while empty_streak < 2:
        print(f"Реестр: страница {page}...")
        items, total = fetch_registry_page_items(page, page_size)
        if total and not page_total:
            page_total = total
            print(f"  На сайте указано всего: {page_total}")

        if not items:
            empty_streak += 1
            page += 1
            continue

        empty_streak = 0
        new = 0
        for item in items:
            if item["element_id"] not in all_items:
                all_items[item["element_id"]] = item
                new += 1
        print(f"  ссылок: {len(items)}, новых ID: {new}, уникальных: {len(all_items)}")
        page += 1
        time.sleep(0.5)

        if page_total and len(all_items) >= page_total:
            break

    return list(all_items.values()), page_total


def extract_reg_number(text: str) -> str:
    if not text:
        return ""
    m = re.search(r"(?<!\d)(\d{3,4})(?!\.\d)", text)
    if m:
        return m.group(1)
    return ""


def extract_ps_code(text: str) -> str:
    if not text:
        return ""
    m = re.search(r"\b(\d{2}\.\d{3})\b", text)
    return m.group(1) if m else ""


def load_xlsx_registry():
    """Загружает официальный XLSX (может быть не самой свежей версии)."""
    try:
        import openpyxl
    except ImportError:
        print("  openpyxl не установлен — pip install openpyxl")
        return []

    path = os.path.join(OUTPUT_DIR, "registry_official.xlsx")
    print(f"Загрузка XLSX: {XLSX_URL[:80]}...")
    try:
        r = requests.get(XLSX_URL, headers=HEADERS, verify=False, timeout=120)
        r.raise_for_status()
        with open(path, "wb") as f:
            f.write(r.content)
    except Exception as e:
        print(f"  Ошибка загрузки XLSX: {e}")
        return []

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    header = [str(c or "").strip().lower() for c in rows[0]]
    reg_idx = next((i for i, h in enumerate(header) if "регистрацион" in h), 0)
    code_idx = next((i for i, h in enumerate(header) if "код проф" in h), 1)
    name_idx = next((i for i, h in enumerate(header) if "наимен" in h), 2)

    items = []
    for row in rows[1:]:
        if not row or not any(row):
            continue
        reg = str(row[reg_idx] or "").strip()
        if not reg or reg.lower() == "none":
            continue
        items.append({
            "reg_number": reg,
            "ps_code": str(row[code_idx] or "").strip() if code_idx < len(row) else "",
            "name": str(row[name_idx] or "").strip() if name_idx < len(row) else "",
            "source": "xlsx",
        })
    wb.close()
    print(f"  XLSX: {len(items)} записей")
    return items


def get_local_standards():
    session = SessionLocal()
    try:
        rows = session.query(StandardRaw).all()
        by_element = {r.element_id: r for r in rows if r.element_id}
        by_reg = {str(r.reg_number).strip(): r for r in rows if r.reg_number}
        return rows, by_element, by_reg
    finally:
        session.close()


def main():
    print("=" * 60)
    print("АНАЛИЗ НЕДОСТАЮЩИХ ПРОФСТАНДАРТОВ")
    print("=" * 60)

    local_rows, by_element, by_reg = get_local_standards()
    print(f"\nЛокальная БД: {len(local_rows)} записей")

    registry_items, site_total = fetch_all_registry_items(page_size=100)
    registry_by_eid = {i["element_id"]: i for i in registry_items}
    registry_regs = {str(i.get("reg_number") or ""): i for i in registry_items if i.get("reg_number")}

    print(f"С сайта (ELEMENT_ID): {len(registry_items)}")
    if site_total:
        print(f"Счётчик на сайте «из N»: {site_total}")

    print("\nСверка get_all_element_ids (как при bulk-загрузке)...")
    parser_ids = set(get_all_element_ids(REGISTRY_BASE_URL))
    print(f"get_all_element_ids: {len(parser_ids)}")

    xlsx_items = load_xlsx_registry()
    xlsx_regs = {i["reg_number"]: i for i in xlsx_items}

    missing_by_element = []
    for item in registry_items:
        eid = item["element_id"]
        if eid in by_element:
            continue
        reg = item.get("reg_number") or ""
        in_db = by_reg.get(reg)
        missing_by_element.append({
            **item,
            "in_db_by_reg_number": in_db.reg_number if in_db else None,
            "in_db_name": in_db.name if in_db else None,
        })

    missing_by_reg_vs_xlsx = []
    for reg, xitem in xlsx_regs.items():
        if reg not in by_reg:
            missing_by_reg_vs_xlsx.append(xitem)

    missing_in_parser_ids = set(registry_by_eid.keys()) - parser_ids
    parser_not_on_site = parser_ids - set(registry_by_eid.keys())

    extra_in_db = []
    for row in local_rows:
        if row.element_id and row.element_id not in registry_by_eid:
            extra_in_db.append({
                "reg_number": row.reg_number,
                "name": row.name,
                "element_id": row.element_id,
            })

    expected = site_total or 1682
    report = {
        "summary": {
            "expected_on_site": expected,
            "site_element_ids_fetched": len(registry_items),
            "parser_element_ids": len(parser_ids),
            "local_db_count": len(local_rows),
            "missing_in_db_by_element_id": len(missing_by_element),
            "missing_vs_xlsx_reg_number": len(missing_by_reg_vs_xlsx),
            "gap_expected_minus_db": expected - len(local_rows),
            "parser_ids_not_in_paginated_fetch": len(missing_in_parser_ids),
        },
        "missing_in_local_db": missing_by_element,
        "missing_vs_xlsx": missing_by_reg_vs_xlsx[:100],
        "parser_fetch_gap_ids": list(missing_in_parser_ids)[:50],
        "extra_in_db_not_on_site": extra_in_db[:50],
    }

    out_json = os.path.join(OUTPUT_DIR, "missing_standards_report.json")
    out_txt = os.path.join(OUTPUT_DIR, "missing_standards_report.txt")

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    lines = [
        "ОТЧЁТ: недостающие профессиональные стандарты",
        "=" * 60,
        f"Ожидается на сайте: {expected}",
        f"Собрано ELEMENT_ID с сайта: {len(registry_items)}",
        f"get_all_element_ids (bulk-парсер): {len(parser_ids)}",
        f"В локальной БД: {len(local_rows)}",
        f"Разница (ожидание − БД): {expected - len(local_rows)}",
        f"Не хватает в БД (по ELEMENT_ID): {len(missing_by_element)}",
        f"ID есть на сайте, но не собраны парсером: {len(missing_in_parser_ids)}",
        "",
        "НЕДОСТАЮЩИЕ В БД (по реестру сайта):",
        "-" * 60,
    ]

    for i, m in enumerate(missing_by_element, 1):
        lines.append(f"{i}. ELEMENT_ID={m['element_id']}")
        if m.get("reg_number"):
            lines.append(f"   Рег. №: {m['reg_number']}")
        if m.get("ps_code"):
            lines.append(f"   Код ПС: {m['ps_code']}")
        lines.append(f"   {m.get('link_text', '')[:150]}")
        if m.get("in_db_by_reg_number"):
            lines.append(f"   ⚠ В БД уже есть reg={m['in_db_by_reg_number']} (другой element_id)")
        lines.append("")

    if missing_in_parser_ids:
        lines.extend(["", "ID НЕ СОБРАНЫ ПАРСЕРОМ (причина bulk-пропуска):", "-" * 60])
        for eid in list(missing_in_parser_ids)[:30]:
            item = registry_by_eid.get(eid, {})
            lines.append(f"  ELEMENT_ID={eid} reg={item.get('reg_number', '?')} {item.get('link_text', '')[:80]}")

    with open(out_txt, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    # Дубликат в корне backend — проще найти
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_txt_copy = os.path.join(backend_root, "missing_standards_report.txt")
    with open(out_txt_copy, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print("\n" + "=" * 60)
    print(f"ИТОГ: БД={len(local_rows)}, сайт={len(registry_items)}, не хватает={len(missing_by_element)}")
    print(f"Отчёт: {out_txt}")
    print(f"Копия: {out_txt_copy}")
    print(f"JSON:  {out_json}")

    if missing_by_element:
        print("\nНедостающие (первые 16):")
        for m in missing_by_element[:16]:
            print(f"  • [{m.get('reg_number', '?')}] {m.get('ps_code', '')} — {m.get('link_text', '')[:70]}")


if __name__ == "__main__":
    main()
