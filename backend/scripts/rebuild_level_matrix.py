"""Пересобрать backend/app/data/level_matrix.json из уже извлечённого matrix_levels.json."""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.level_matrix import DATA_PATH, JSON_PATH, build_structured_matrix, load_matrix, load_structured_matrix


def main() -> None:
    raw = load_matrix(force_refresh=True)
    structured = build_structured_matrix(raw)
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    with DATA_PATH.open("w", encoding="utf-8") as f:
        json.dump(structured, f, ensure_ascii=False, indent=2)

    # also refresh via official path
    load_structured_matrix(force_refresh=False)

    levels = structured.get("qualification_levels", [])
    print(f"source: {structured.get('source')}")
    print(f"raw tables: {raw.get('table_count')}, paragraphs: {raw.get('paragraph_count')}")
    print(f"qualification levels: {len(levels)}")
    print(f"formation defs: {len(structured.get('formation_level_definitions', []))}")
    if levels:
        sample = levels[0]
        print(f"sample L{sample.get('qualification_level')}:")
        print(json.dumps(sample.get("descriptors_by_category"), ensure_ascii=False, indent=2)[:500])
    print(f"wrote: {DATA_PATH}")
    print(f"raw json: {JSON_PATH}")


if __name__ == "__main__":
    main()
