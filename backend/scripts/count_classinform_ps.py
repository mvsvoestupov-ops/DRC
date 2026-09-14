"""Подсчёт профстандартов на classinform.ru/profstandarty.html"""
from __future__ import annotations

import re
import sys
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://classinform.ru/profstandarty.html"
ROOT = "https://classinform.ru/"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
PS_CODE_RE = re.compile(r"profstandarty/(\d{2}\.\d{3})-", re.I)
AREA_RE = re.compile(r"profstandarty/(\d{2})-[^/]+\.html", re.I)


def fetch(url: str) -> str:
    r = requests.get(url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def main() -> int:
    print("Загрузка главной страницы...")
    html = fetch(BASE)
    soup = BeautifulSoup(html, "html.parser")

    area_urls: list[str] = []
    for a in soup.find_all("a", href=True):
        href = urljoin(ROOT, a["href"])
        if AREA_RE.search(href) and href not in area_urls:
            area_urls.append(href)

    area_urls.sort()
    print(f"Областей (страниц разделов): {len(area_urls)}")

    all_codes: set[str] = set()
    per_area: list[tuple[str, int]] = []

    for url in area_urls:
        time.sleep(0.3)
        try:
            page = fetch(url)
        except Exception as e:
            print(f"  ОШИБКА {url}: {e}")
            continue
        codes = set(PS_CODE_RE.findall(page))
        area_code = AREA_RE.search(url)
        label = area_code.group(1) if area_code else "?"
        per_area.append((label, len(codes)))
        all_codes.update(codes)
        print(f"  {label}: {len(codes)} ПС")

    print("\n" + "=" * 50)
    print(f"ИТОГО уникальных кодов ПС (XX.XXX): {len(all_codes)}")
    print(f"Сумма по разделам (с возможными дублями): {sum(n for _, n in per_area)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
