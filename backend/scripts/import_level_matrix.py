"""Импорт / обновление матрицы уровней из DOCX."""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.level_matrix import DOCX_PATH, JSON_PATH, load_matrix, load_structured_matrix
from app.reference_data import get_reference_bundle


def main() -> None:
    if not DOCX_PATH.exists():
        print(f"DOCX не найден: {DOCX_PATH}")
        sys.exit(1)

    raw = load_matrix(force_refresh=True)
    structured = load_structured_matrix(force_refresh=False)
    bundle = get_reference_bundle(force_refresh=True)

    print(f"Источник: {DOCX_PATH}")
    print(f"Абзацев: {raw.get('paragraph_count', 0)}, таблиц: {raw.get('table_count', 0)}")
    print(f"Уровней квалификации: {len(structured.get('qualification_levels', []))}")
    print(f"Уровней сформированности: {len(structured.get('formation_level_definitions', []))}")
    print(f"Категорий soft skills: {len(bundle.get('universal_skills_catalog', []))}")
    print(f"JSON: {JSON_PATH}")


if __name__ == "__main__":
    main()
