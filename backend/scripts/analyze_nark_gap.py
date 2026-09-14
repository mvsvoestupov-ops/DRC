"""Диагностика пропусков в индексе квалификаций НАРК (без загрузки карточек)."""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.qualifications_parser import (
    BASE_URL,
    EXPECTED_SITE_COUNT,
    _load_links_cache,
    discover_links_by_filters,
    find_missing_qualification_links,
    get_qualification_stats,
)

OUTPUT = os.path.join(os.path.dirname(__file__), "output", "nark_gap_analysis.json")


def main() -> int:
    before = get_qualification_stats()
    cache_before = len(_load_links_cache())

    print("=" * 60)
    print("АНАЛИЗ ПРОПУСКОВ НАРК (только индекс + сравнение с БД)")
    print("=" * 60)
    print(f"Кэш до обхода:  {cache_before}")
    print(f"В БД:           {before['local_count']}")
    print(f"Ожидается:      {EXPECTED_SITE_COUNT}")

    discover_links_by_filters(merge_cache=True)
    gap = find_missing_qualification_links(rediscover=False)

    report = {
        "cache_before": cache_before,
        "expected": EXPECTED_SITE_COUNT,
        **gap,
    }

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    txt = OUTPUT.replace(".json", ".txt")
    with open(txt, "w", encoding="utf-8") as f:
        f.write(
            f"Ожидается: {EXPECTED_SITE_COUNT}\n"
            f"Индекс: {gap['site_count']}, дыра в индексе: {gap.get('index_gap', 0)}\n"
            f"БД: {gap['db_count']}, не хватает в БД: {gap['missing_count']}\n\n"
        )
        for code in gap.get("missing_codes") or []:
            f.write(f"{code}\t{BASE_URL}/pk/detail/{code}/\n")

    print(
        f"\nИндекс после обхода: {gap['site_count']}, "
        f"дыра: {gap.get('index_gap', 0)}, "
        f"не хватает в БД: {gap['missing_count']}"
    )
    print(f"Отчёт: {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
