"""Parse level matrix from docx/Matrix_for_projekt.docx."""
from __future__ import annotations

import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCX_PATH = REPO_ROOT / "docx" / "Matrix_for_projekt.docx"
OUTPUT_DIR = REPO_ROOT / "backend" / "scripts" / "output"
JSON_PATH = OUTPUT_DIR / "matrix_levels.json"
TEXT_PATH = OUTPUT_DIR / "matrix_levels.txt"
DATA_PATH = Path(__file__).resolve().parent / "data" / "level_matrix.json"


def _cell_text(cell: ET.Element) -> str:
    parts: list[str] = []
    for t in cell.iter(W + "t"):
        if t.text:
            parts.append(t.text)
        if t.tail:
            parts.append(t.tail)
    return " ".join("".join(parts).split())


def extract_docx(path: Path) -> dict[str, Any]:
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))

    paragraphs: list[str] = []
    for p in root.iter(W + "p"):
        parts: list[str] = []
        for t in p.iter(W + "t"):
            if t.text:
                parts.append(t.text)
            if t.tail:
                parts.append(t.tail)
        line = "".join(parts).strip()
        if line:
            paragraphs.append(line)

    tables: list[list[list[str]]] = []
    for tbl in root.iter(W + "tbl"):
        table: list[list[str]] = []
        for row in tbl.findall(f".//{W}tr"):
            cells = [_cell_text(cell) for cell in row.findall(f"{W}tc")]
            if any(cells):
                table.append(cells)
        if table:
            tables.append(table)

    return {
        "source": str(path),
        "paragraphs": paragraphs,
        "tables": tables,
        "table_count": len(tables),
        "paragraph_count": len(paragraphs),
    }


def save_extracted(data: dict[str, Any]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)

    with JSON_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    lines = [f"{i + 1}|{p}" for i, p in enumerate(data.get("paragraphs", []))]
    with TEXT_PATH.open("w", encoding="utf-8") as f:
        f.write("\n".join(lines))
        f.write("\n\n=== TABLES ===\n\n")
        f.write(json.dumps(data.get("tables", []), ensure_ascii=False, indent=2))


def load_matrix(force_refresh: bool = False) -> dict[str, Any]:
    if not force_refresh and JSON_PATH.exists() and DOCX_PATH.exists():
        docx_mtime = DOCX_PATH.stat().st_mtime
        json_mtime = JSON_PATH.stat().st_mtime
        if json_mtime >= docx_mtime:
            with JSON_PATH.open(encoding="utf-8") as f:
                return json.load(f)

    if not DOCX_PATH.exists():
        if JSON_PATH.exists():
            with JSON_PATH.open(encoding="utf-8") as f:
                return json.load(f)
        return {
            "source": str(DOCX_PATH),
            "error": "DOCX not found",
            "paragraphs": [],
            "tables": [],
        }

    data = extract_docx(DOCX_PATH)
    save_extracted(data)
    return data


def parse_formation_level_definitions(data: dict[str, Any]) -> list[dict[str, str]]:
    """Определения базовый/продвинутый/экспертный.

    В Matrix_for_projekt.docx отдельной таблицы определений нет —
    используем канонические формулировки проекта (принцип «уровень внутри уровня»).
    """
    tables = data.get("tables", [])
    # Старый формат: первая таблица — 3 строки определений
    if len(tables) >= 2:
        rows = tables[0][1:]
        parsed = [
            {"code": row[0].strip().lower(), "label": row[0].strip(), "description": row[1].strip()}
            for row in rows
            if len(row) >= 2 and row[0].strip().lower() in ("базовый", "продвинутый", "экспертный")
        ]
        if len(parsed) >= 3:
            return parsed

    return [
        {
            "code": "базовый",
            "label": "Базовый",
            "description": (
                "Соответствует минимальным требованиям уровня квалификации. "
                "Действия выполняются в стандартных ситуациях, с возможной консультацией."
            ),
        },
        {
            "code": "продвинутый",
            "label": "Продвинутый",
            "description": (
                "Превосходит минимальные требования: более высокая степень самостоятельности, "
                "способность анализировать и адаптироваться к изменениям."
            ),
        },
        {
            "code": "экспертный",
            "label": "Экспертный",
            "description": (
                "Демонстрирует мастерство в рамках уровня: способен обучать других, "
                "разрабатывать методики, принимать решения в сложных ситуациях."
            ),
        },
    ]


def _detect_category(cell: str) -> str | None:
    text = (cell or "").strip().upper()
    if not text:
        return None
    if text.startswith("A") or "ЗНАНИ" in text:
        return "A"
    if text.startswith("B") or "УМЕНИ" in text or "ИНТЕЛЛЕКТ" in text:
        return "B"
    if text.startswith("C") or "ПРАКТИЧ" in text:
        return "C"
    return None


def _empty_descriptors_by_category() -> dict[str, dict[str, str]]:
    return {
        cat: {"базовый": "", "продвинутый": "", "экспертный": ""}
        for cat in ("A", "B", "C")
    }


def parse_qualification_matrix_rows(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Парсит матрицу уровней.

    Новый формат (Matrix_for_projekt.docx) — одна таблица:
      [уровень | A/B/C | базовый | продвинутый | экспертный]
      уровень указан только в первой строке блока (категория A).

    Старый формат — вторая таблица:
      [уровень | 148н | базовый | продвинутый | экспертный | soft skills]
    """
    tables = data.get("tables", [])
    if not tables:
        return []

    # Новый формат: одна широкая таблица с категориями A/B/C во 2-й колонке
    main = tables[0] if len(tables) == 1 else tables[-1]
    header = " ".join(main[0]).lower() if main else ""
    looks_new = (
        "базовый уровень сформированности" in header
        or any(_detect_category(row[1]) for row in main[1:3] if len(row) > 1)
    )

    if looks_new:
        return _parse_new_abc_matrix(main)

    # Старый формат
    if len(tables) < 2:
        return []
    rows = tables[1][1:]
    parsed: list[dict[str, Any]] = []
    for row in rows:
        if len(row) < 6:
            continue
        label = row[0].strip()
        level_num = label.replace("-й уровень", "").strip()
        parsed.append(
            {
                "qualification_level": int(level_num) if level_num.isdigit() else None,
                "qualification_level_label": label,
                "order_148n_indicators": row[1].strip(),
                "formation_levels": {
                    "базовый": row[2].strip(),
                    "продвинутый": row[3].strip(),
                    "экспертный": row[4].strip(),
                },
                "descriptors_by_category": _empty_descriptors_by_category(),
                "universal_skills": row[5].strip(),
            }
        )
    return parsed


def _parse_new_abc_matrix(table: list[list[str]]) -> list[dict[str, Any]]:
    by_level: dict[int, dict[str, Any]] = {}
    current_level: int | None = None

    for row in table[1:]:
        if not row:
            continue
        cells = list(row) + [""] * (5 - len(row))
        col0, col1, col2, col3, col4 = cells[:5]

        # Сдвинутая строка (как у 9-C): категория в col0, тексты в col1–col3
        cat = _detect_category(col1)
        if cat is None and _detect_category(col0):
            cat = _detect_category(col0)
            col2, col3, col4 = col1, col2, col3
            col0 = ""

        label = (col0 or "").strip()
        if label and "уровень" in label.lower():
            level_num = label.replace("-й уровень", "").replace("уровень", "").strip()
            if level_num.isdigit():
                current_level = int(level_num)
                by_level.setdefault(
                    current_level,
                    {
                        "qualification_level": current_level,
                        "qualification_level_label": f"{current_level}-й уровень",
                        "order_148n_indicators": "",
                        "formation_levels": {
                            "базовый": "",
                            "продвинутый": "",
                            "экспертный": "",
                        },
                        "descriptors_by_category": _empty_descriptors_by_category(),
                        "universal_skills": "",
                    },
                )

        if current_level is None or cat is None:
            continue

        entry = by_level[current_level]
        entry["descriptors_by_category"][cat] = {
            "базовый": col2.strip(),
            "продвинутый": col3.strip(),
            "экспертный": col4.strip(),
        }
        # Для совместимости: эталон formation_levels = категория A (знания)
        if cat == "A":
            entry["formation_levels"] = {
                "базовый": col2.strip(),
                "продвинутый": col3.strip(),
                "экспертный": col4.strip(),
            }

    return [by_level[k] for k in sorted(by_level.keys())]


def build_structured_matrix(data: dict[str, Any]) -> dict[str, Any]:
    from .reference_data import get_order_148n_indicators

    levels = parse_qualification_matrix_rows(data)
    for row in levels:
        if not (row.get("order_148n_indicators") or "").strip():
            row["order_148n_indicators"] = get_order_148n_indicators(row.get("qualification_level"))

    return {
        "source": data.get("source"),
        "formation_level_definitions": parse_formation_level_definitions(data),
        "qualification_levels": levels,
        "principles": [
            p
            for p in data.get("paragraphs", [])
            if p.startswith(("3.", "4.")) or "уровень внутри уровня" in p.lower()
        ],
    }


def load_structured_matrix(force_refresh: bool = False) -> dict[str, Any]:
    data = load_matrix(force_refresh=force_refresh)
    structured = build_structured_matrix(data)
    with DATA_PATH.open("w", encoding="utf-8") as f:
        json.dump(structured, f, ensure_ascii=False, indent=2)
    return structured


def matrix_summary(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "source": data.get("source"),
        "paragraph_count": data.get("paragraph_count", len(data.get("paragraphs", []))),
        "table_count": data.get("table_count", len(data.get("tables", []))),
        "paragraphs_preview": data.get("paragraphs", [])[:20],
        "tables_preview": data.get("tables", [])[:3],
    }
