# -*- coding: utf-8 -*-
"""Local dump: assessment V2 progress for competence with fire/legalize name."""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "profstandart.db"
if not DB.exists():
    DB = ROOT / "app" / "profstandart.db"

OUT = Path(__file__).resolve().parent / "_check_fos_progress.txt"


def main() -> int:
    lines: list[str] = []
    lines.append(f"db={DB} exists={DB.exists()}")
    if not DB.exists():
        OUT.write_text("\n".join(lines), encoding="utf-8")
        return 1

    con = sqlite3.connect(str(DB))
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    rows = cur.execute(
        """
        SELECT id, public_code, name, status, assessment_tools, assessment_tools_v2,
               structure, education_level, raw_data
        FROM competences
        WHERE name LIKE '%пожар%' OR name LIKE '%легализ%' OR name LIKE '%туш%'
        ORDER BY id DESC
        LIMIT 10
        """
    ).fetchall()
    lines.append(f"matches={len(rows)}")
    for row in rows:
        lines.append("---")
        lines.append(
            f"id={row['id']} code={row['public_code']} status={row['status']} name={row['name']}"
        )
        lines.append(f"education_level={row['education_level']}")

        structure = _parse(row["structure"])
        v2 = _parse(row["assessment_tools_v2"])
        v1 = _parse(row["assessment_tools"])
        raw = _parse(row["raw_data"])

        a = _items(structure, "A")
        b = _items(structure, "B")
        c = _items(structure, "C")
        lines.append(f"structure A={len(a)} B={len(b)} C={len(c)}")

        by_level = None
        if isinstance(v2, dict):
            by_level = v2.get("by_level") or v2.get("byLevel") or v2
        if not isinstance(by_level, dict) and isinstance(raw, dict):
            nested = raw.get("assessment_tools_v2") or raw.get("assessmentV2")
            nested = _parse(nested) if isinstance(nested, str) else nested
            if isinstance(nested, dict):
                by_level = nested.get("by_level") or nested.get("byLevel") or nested
                lines.append("v2 source=raw_data")

        if not isinstance(by_level, dict):
            lines.append("assessment_tools_v2=MISSING_OR_EMPTY")
            lines.append(f"assessment_tools_v1_type={type(v1).__name__} len={_lenish(v1)}")
            continue

        levels = ["базовый", "продвинутый", "экспертный"]
        planned = 0
        complete = 0
        for level in levels:
            block = by_level.get(level) or {}
            if not isinstance(block, dict):
                block = {}
            tests = block.get("tests") or []
            tasks = block.get("practicalTasks") or block.get("practical_tasks") or []
            lines.append(
                f"level={level} tests={len(tests)} practical={len(tasks)} "
                f"compositionDone={block.get('compositionDone') or block.get('composition_done')}"
            )

            # knowledge slots
            for item in a:
                planned += 1
                tid = item.get("id")
                test = next(
                    (
                        t
                        for t in tests
                        if isinstance(t, dict)
                        and (
                            tid in (t.get("componentIds") or t.get("component_ids") or [])
                            or t.get("componentId") == tid
                            or t.get("component_id") == tid
                        )
                    ),
                    None,
                )
                ok = bool(test) and _test_complete(test)
                if ok:
                    complete += 1
                elif complete < 3:
                    lines.append(
                        f"  incomplete test level={level} knowledge={item.get('id')} "
                        f"prompt={_short((test or {}).get('prompt'))} "
                        f"criteria={_short((test or {}).get('criteria'))} "
                        f"itemType={(test or {}).get('itemType') or (test or {}).get('item_type')} "
                        f"options={len((test or {}).get('options') or [])}"
                    )

            # practical coverage rough
            used = set()
            for task in tasks:
                if not isinstance(task, dict):
                    continue
                for cid in task.get("componentIds") or task.get("component_ids") or []:
                    used.add(cid)
            practical_ids = {item.get("id") for item in b + c}
            covered = len(practical_ids & used)
            lines.append(
                f"  practical_coverage={covered}/{len(practical_ids)} tasks={len(tasks)}"
            )
            for task in tasks:
                if not isinstance(task, dict):
                    continue
                planned += 1
                ok = _practical_complete(task)
                if ok:
                    complete += 1
                else:
                    lines.append(
                        f"  incomplete practical level={level} name={_short(task.get('name'))} "
                        f"comps={len(task.get('componentIds') or task.get('component_ids') or [])} "
                        f"prompt={_short(task.get('prompt'))} "
                        f"criteria={_short(task.get('criteria'))}"
                    )

        lines.append(f"counter_like_gate complete={complete} planned={planned}")
        # Also: if only базовый+продвинутый (no expert)
        planned2 = complete2 = 0
        for level in ["базовый", "продвинутый"]:
            block = by_level.get(level) or {}
            tests = (block.get("tests") or []) if isinstance(block, dict) else []
            tasks = (
                (block.get("practicalTasks") or block.get("practical_tasks") or [])
                if isinstance(block, dict)
                else []
            )
            for item in a:
                planned2 += 1
                tid = item.get("id")
                test = next(
                    (
                        t
                        for t in tests
                        if isinstance(t, dict)
                        and (
                            tid in (t.get("componentIds") or t.get("component_ids") or [])
                            or t.get("componentId") == tid
                        )
                    ),
                    None,
                )
                if test and _test_complete(test):
                    complete2 += 1
            for task in tasks:
                if isinstance(task, dict):
                    planned2 += 1
                    if _practical_complete(task):
                        complete2 += 1
        lines.append(f"without_expert complete={complete2} planned={planned2}")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUT}")
    return 0


def _parse(val):
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    text = str(val).strip()
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
    return [x for x in rows if isinstance(x, dict) and str(x.get("text") or "").strip()]


def _test_complete(test: dict) -> bool:
    comps = test.get("componentIds") or test.get("component_ids") or []
    if test.get("componentId") or test.get("component_id"):
        comps = comps or [test.get("componentId") or test.get("component_id")]
    if not comps:
        return False
    if not str(test.get("criteria") or "").strip():
        return False
    if not str(test.get("prompt") or "").strip():
        return False
    item_type = test.get("itemType") or test.get("item_type") or "single"
    if item_type == "open":
        return True
    options = test.get("options") or []
    filled = [o for o in options if isinstance(o, dict) and str(o.get("text") or "").strip()]
    if len(filled) < 2:
        return False
    if item_type in ("single", "multiple"):
        return any(o.get("isCorrect") or o.get("is_correct") for o in filled)
    return True


def _practical_complete(task: dict) -> bool:
    comps = task.get("componentIds") or task.get("component_ids") or []
    if not comps:
        return False
    if not str(task.get("prompt") or "").strip():
        return False
    criteria = task.get("criteria")
    if isinstance(criteria, list):
        return any(str(x or "").strip() for x in criteria)
    return bool(str(criteria or "").strip())


def _short(val, n=40):
    text = str(val or "").replace("\n", " ").strip()
    return text[:n]


def _lenish(val):
    if val is None:
        return 0
    if isinstance(val, (list, dict, str)):
        return len(val)
    return -1


if __name__ == "__main__":
    sys.exit(main())
