"""
Сравнение официального XLSX реестра ПС с порталом Минтруда.

Колонка 1: есть на сайте, нет в XLSX
Колонка 2: есть в XLSX, нет на сайте

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\compare_xlsx_vs_mintrud_site.py
  venv\\Scripts\\python.exe scripts\\compare_xlsx_vs_mintrud_site.py --refresh-site
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import warnings
from datetime import datetime, timezone

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "scripts"))

from app.parser import REGISTRY_BASE_URL, fetch_registry_page_items
from compare_ps_with_xlsx import load_xlsx, resolve_xlsx_path

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
SITE_CACHE_PATH = os.path.join(OUTPUT_DIR, "mintrud_site_registry.json")
REPORT_JSON = os.path.join(OUTPUT_DIR, "xlsx_vs_mintrud_site.json")
REPORT_TXT = os.path.join(OUTPUT_DIR, "xlsx_vs_mintrud_site.txt")


def fetch_all_site_items(page_size: int = 20) -> tuple[list[dict], int | None]:
    all_items: dict[str, dict] = {}
    page_total: int | None = None
    page = 1
    empty_streak = 0

    print(f"Обход реестра Минтруда (по {page_size} на страницу)...")
    while empty_streak < 2:
        print(f"  страница {page}...", end=" ", flush=True)
        items, total = fetch_registry_page_items(page, page_size)
        if total and page_total is None:
            page_total = total
            print(f"всего на сайте: {total}", end=" ")
        if not items:
            print("пусто")
            empty_streak += 1
            page += 1
            continue

        empty_streak = 0
        new = 0
        for item in items:
            if item["element_id"] not in all_items:
                all_items[item["element_id"]] = item
                new += 1
        print(f"ссылок={len(items)}, новых={new}, уникальных={len(all_items)}")
        page += 1
        time.sleep(0.4)

        if page_total and len(all_items) >= page_total:
            break

    return list(all_items.values()), page_total


def load_or_fetch_site(page_size: int, refresh: bool) -> tuple[list[dict], int | None]:
    if not refresh and os.path.exists(SITE_CACHE_PATH):
        with open(SITE_CACHE_PATH, encoding="utf-8") as f:
            cached = json.load(f)
        items = cached.get("items", [])
        if items:
            print(f"Кэш сайта: {SITE_CACHE_PATH} ({len(items)} записей)")
            return items, cached.get("site_total")

    items, site_total = fetch_all_site_items(page_size)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(SITE_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {
                "crawled_at": datetime.now(timezone.utc).isoformat(),
                "page_size": page_size,
                "site_total": site_total,
                "items_count": len(items),
                "items": items,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"Кэш сохранён: {SITE_CACHE_PATH}")
    return items, site_total


def index_by_code(items: list[dict], code_key: str = "ps_code") -> dict[str, dict]:
    out: dict[str, dict] = {}
    for item in items:
        code = (item.get(code_key) or "").strip()
        if code and code not in out:
            out[code] = item
    return out


def format_row(item: dict | None, source: str) -> str:
    if not item:
        return ""
    code = item.get("ps_code") or "?"
    reg = item.get("reg_number") or "?"
    name = (item.get("name") or item.get("link_text") or "")[:55]
    return f"{code}  reg={reg}  {name}"


def write_two_column_table(col1: list[dict], col2: list[dict], path: str, headers: tuple[str, str]) -> None:
    width = 78
    lines = [
        "СРАВНЕНИЕ: XLSX ↔ сайт Минтруда",
        f"Сайт: {REGISTRY_BASE_URL}",
        "=" * (width * 2 + 3),
        f"{headers[0]:<{width}} | {headers[1]}",
        "-" * (width * 2 + 3),
    ]
    max_rows = max(len(col1), len(col2), 1)
    for i in range(max_rows):
        left = format_row(col1[i] if i < len(col1) else None, "site")
        right = format_row(col2[i] if i < len(col2) else None, "xlsx")
        lines.append(f"{left:<{width}} | {right}")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main() -> int:
    warnings.filterwarnings("ignore", message="Unverified HTTPS request")

    parser = argparse.ArgumentParser(description="Сравнение XLSX реестра ПС с сайтом Минтруда")
    parser.add_argument("--refresh-site", action="store_true", help="Пересканировать сайт (игнор кэша)")
    parser.add_argument("--page-size", type=int, default=20, help="Записей на страницу (на сайте по умолчанию 20)")
    args = parser.parse_args()

    xlsx_path = resolve_xlsx_path(None)
    xlsx_items = load_xlsx(xlsx_path)
    site_items, site_total = load_or_fetch_site(args.page_size, refresh=args.refresh_site)

    xlsx_by_code = index_by_code(xlsx_items)
    site_by_code = index_by_code(site_items)

    xlsx_codes = set(xlsx_by_code.keys())
    site_codes = set(site_by_code.keys())

    only_site_codes = sorted(site_codes - xlsx_codes)
    only_xlsx_codes = sorted(xlsx_codes - site_codes)

    only_on_site = [site_by_code[c] for c in only_site_codes]
    only_in_xlsx = [xlsx_by_code[c] for c in only_xlsx_codes]

    site_no_code = [i for i in site_items if not (i.get("ps_code") or "").strip()]
    xlsx_no_code = [i for i in xlsx_items if not (i.get("ps_code") or "").strip()]

    report = {
        "xlsx_path": xlsx_path,
        "xlsx_count": len(xlsx_items),
        "xlsx_unique_codes": len(xlsx_codes),
        "site_count": len(site_items),
        "site_unique_codes": len(site_codes),
        "site_total_declared": site_total,
        "only_on_site_count": len(only_on_site),
        "only_in_xlsx_count": len(only_in_xlsx),
        "only_on_site": [
            {
                "ps_code": i.get("ps_code"),
                "reg_number": i.get("reg_number"),
                "element_id": i.get("element_id"),
                "name": i.get("link_text"),
            }
            for i in only_on_site
        ],
        "only_in_xlsx": [
            {
                "ps_code": i.get("ps_code"),
                "reg_number": i.get("reg_number"),
                "name": i.get("name"),
                "order_number": i.get("order_number"),
                "status": i.get("status"),
            }
            for i in only_in_xlsx
        ],
        "site_without_ps_code": len(site_no_code),
        "xlsx_without_ps_code": len(xlsx_no_code),
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    write_two_column_table(
        only_on_site,
        only_in_xlsx,
        REPORT_TXT,
        (
            f"На сайте, нет в XLSX ({len(only_on_site)})",
            f"В XLSX, нет на сайте ({len(only_in_xlsx)})",
        ),
    )

    print("\n" + "=" * 60)
    print("XLSX ↔ САЙТ МИНТРУДА")
    print("=" * 60)
    print(f"XLSX: {len(xlsx_items)} записей, {len(xlsx_codes)} кодов ПС")
    print(f"Сайт: {len(site_items)} ELEMENT_ID, {len(site_codes)} кодов ПС", end="")
    if site_total:
        print(f" (на сайте указано: {site_total})")
    else:
        print()
    print(f"Только на сайте:  {len(only_on_site)}")
    print(f"Только в XLSX:   {len(only_in_xlsx)}")
    if site_no_code:
        print(f"На сайте без кода ПС в ссылке: {len(site_no_code)}")

    check_12024 = "12.024" in only_xlsx_codes
    print(f"\n12.024 в XLSX, но не на сайте: {'да' if check_12024 else 'нет'}")

    if only_in_xlsx[:15]:
        print("\nПримеры «только в XLSX»:")
        for item in only_in_xlsx[:15]:
            print(f"  {item.get('ps_code')} reg={item.get('reg_number')} {(item.get('name') or '')[:50]}")
        if len(only_in_xlsx) > 15:
            print(f"  ... ещё {len(only_in_xlsx) - 15}")

    if only_on_site[:15]:
        print("\nПримеры «только на сайте»:")
        for item in only_on_site[:15]:
            print(
                f"  {item.get('ps_code')} reg={item.get('reg_number')} "
                f"EID={item.get('element_id')} {(item.get('link_text') or '')[:40]}"
            )
        if len(only_on_site) > 15:
            print(f"  ... ещё {len(only_on_site) - 15}")

    print(f"\nТаблица: {REPORT_TXT}")
    print(f"JSON:    {REPORT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
