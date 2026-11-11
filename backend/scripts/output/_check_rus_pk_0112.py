# -*- coding: utf-8 -*-
"""Quick local dump for RUS-PK-0112 assessment V2 vs gate."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "profstandart.db"
if not DB.exists():
    DB = ROOT / "app" / "profstandart.db"
OUT = Path(__file__).resolve().parent / "_check_rus_pk_0112.txt"


def _parse(raw):
    if raw is None:
        return None
    if isinstance(raw, (dict, list)):
        return raw
    text = str(raw).strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def _items(structure, key):
    if not isinstance(structure, dict):
        return []
    rows = structure.get(key) or []
    if not isinstance(rows, list):
        return []
    return [r for r in rows if isinstance(r, dict) and str(r.get("text") or "").strip()]


def _test_complete(test: dict) -> bool:
    if not str(test.get("criteria") or "").strip():
        return False
    if not str(test.get("prompt") or "").strip():
        return False
    item_type = str(test.get("itemType") or test.get("item_type") or "single")
    if item_type == "open":
        return True
    options = test.get("options") or []
    filled = [o for o in options if isinstance(o, dict) and str(o.get("text") or "").strip()]
    if len(filled) < 2:
        return False
    return any(bool(o.get("isCorrect") or o.get("is_correct")) for o in filled)


def _practical_complete(task: dict) -> bool:
    ids = task.get("componentIds") or task.get("component_ids") or []
    if not ids:
        return False
    if not str(task.get("prompt") or "").strip():
        return False
    criteria = task.get("criteria") or []
    return any(str(c or "").strip() for c in criteria)


def main() -> int:
    lines: list[str] = [f"db={DB} exists={DB.exists()}"]
    if not DB.exists():
        OUT.write_text("\n".join(lines), encoding="utf-8")
        return 1

    con = sqlite3.connect(str(DB))
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    rows = cur.execute(
        """
        SELECT id, public_code, name, status, assessment_tools_v2, structure, education_level
        FROM competences
        WHERE public_code LIKE '%0112%' OR public_code = 'RUS-PK-0112'
        ORDER BY id DESC
        LIMIT 5
        """
    ).fetchall()
    lines.append(f"matches={len(rows)}")
    for row in rows:
        structure = _parse(row["structure"])
        v2 = _parse(row["assessment_tools_v2"])
        a, b, c = _items(structure, "A"), _items(structure, "B"), _items(structure, "C")
        edu = str(row["education_level"] or "")
        spo_like = ("среднее профессиональное" in edu.lower()) or ("бакалавр" in edu.lower())
        gate_levels = ["базовый", "продвинутый"] if spo_like else ["базовый", "продвинутый", "экспертный"]
        lines.append("---")
        lines.append(
            f"id={row['id']} code={row['public_code']} status={row['status']} name={row['name']}"
        )
        lines.append(f"education_level={edu}")
        lines.append(f"structure A={len(a)} B={len(b)} C={len(c)}")
        lines.append(f"gate_levels={gate_levels}")
        by_level = None
        if isinstance(v2, dict):
            by_level = v2.get("by_level") or v2.get("byLevel") or v2
        if not isinstance(by_level, dict):
            lines.append("assessment_tools_v2=MISSING")
            continue
        knowledge_ids = {str(x.get("id")) for x in a}
        for level in ["базовый", "продвинутый", "экспертный"]:
            block = by_level.get(level) or {}
            if not isinstance(block, dict):
                block = {}
            tests = block.get("tests") or []
            tasks = block.get("practicalTasks") or block.get("practical_tasks") or []
            created = 0
            complete = 0
            for kid in knowledge_ids:
                t = next(
                    (
                        x
                        for x in tests
                        if isinstance(x, dict)
                        and kid in [str(i) for i in (x.get("componentIds") or x.get("component_ids") or [])]
                    ),
                    None,
                )
                if t and str(t.get("prompt") or "").strip():
                    created += 1
                if t and _test_complete(t):
                    complete += 1
            prac_ok = sum(1 for t in tasks if isinstance(t, dict) and _practical_complete(t))
            lines.append(
                f"level={level} tests_created={created}/{len(a)} tests_complete={complete}/{len(a)} "
                f"practical={prac_ok}/{len(tasks)} compositionDone={block.get('compositionDone')}"
            )
        planned = 0
        done = 0
        for level in gate_levels:
            block = by_level.get(level) or {}
            tests = (block.get("tests") or []) if isinstance(block, dict) else []
            tasks = (
                (block.get("practicalTasks") or block.get("practical_tasks") or [])
                if isinstance(block, dict)
                else []
            )
            for kid in knowledge_ids:
                planned += 1
                t = next(
                    (
                        x
                        for x in tests
                        if isinstance(x, dict)
                        and kid in [str(i) for i in (x.get("componentIds") or x.get("component_ids") or [])]
                    ),
                    None,
                )
                if t and _test_complete(t):
                    done += 1
            for task in tasks:
                planned += 1
                if isinstance(task, dict) and _practical_complete(task):
                    done += 1
        lines.append(f"old_gate_counter complete={done} planned={planned}")

    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
