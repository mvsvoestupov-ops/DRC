"""Догрузка конкретных кодов квалификаций НАРК в БД."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.qualifications_parser import (
    BASE_URL,
    _load_links_cache,
    _merge_links,
    _save_links_cache,
    fetch_qualifications_by_codes,
    get_qualification_stats,
)

CODES = [
    "03.01500.07",
    "03.01500.08",
    "03.01500.09",
    "03.01500.10",
    "03.01500.11",
]


def main() -> int:
    before = get_qualification_stats()
    print(f"В БД до запуска: {before['local_count']}")
    cache = _load_links_cache()
    _merge_links(
        cache,
        [
            {"code": code, "name": code, "url": f"{BASE_URL}/pk/detail/{code}/"}
            for code in CODES
        ],
    )
    _save_links_cache(cache)
    result = fetch_qualifications_by_codes(CODES, save=True)
    failed = result.get("failed") or []
    print(f"Скачано: {len(result.get('processed') or [])}, ошибок: {len(failed)}")
    print(f"В БД после: {result.get('local_count')}")
    if failed and not result.get("processed"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
