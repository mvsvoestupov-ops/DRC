# -*- coding: utf-8 -*-
"""Dump competence id=24 for FOS fill."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "profstandart.db"
OUT = Path(__file__).resolve().parent / "_dump_comp_24.txt"

con = sqlite3.connect(str(DB))
con.row_factory = sqlite3.Row
cur = con.cursor()

# schema
cols = [r[1] for r in cur.execute("PRAGMA table_info(competences)").fetchall()]
OUT.write_text("cols=" + ",".join(cols) + "\n", encoding="utf-8")

row = cur.execute(
    """
    SELECT id, public_code, name, status, education_level,
           structure, assessment_tools, assessment_tools_v2, raw_data, updated_at
    FROM competences WHERE id = 24
    """
).fetchone()
lines = [f"cols={','.join(cols)}"]
if not row:
    # try find by name
    rows = cur.execute(
        """
        SELECT id, public_code, name FROM competences
        WHERE public_code LIKE '%0024%' OR name LIKE '%легализ%' OR name LIKE '%пожар%'
        ORDER BY id
        """
    ).fetchall()
    lines.append("id=24 not found; candidates:")
    for r in rows:
        lines.append(f"  id={r['id']} code={r['public_code']} name={r['name']}")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    raise SystemExit(1)

lines.append(f"id={row['id']} code={row['public_code']} status={row['status']}")
lines.append(f"name={row['name']}")
lines.append(f"education_level={row['education_level']}")
lines.append(f"updated_at={row['updated_at'] if 'updated_at' in cols else 'N/A'}")

def parse(v):
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return v
    s = str(v).strip()
    if not s:
        return None
    try:
        return json.loads(s)
    except Exception:
        return {"_raw_len": len(s)}

structure = parse(row["structure"])
v2 = parse(row["assessment_tools_v2"])
v1 = parse(row["assessment_tools"])
raw = parse(row["raw_data"])

def count_abc(st):
    if not isinstance(st, dict):
        return (0, 0, 0, [])
    out = {}
    ids = {}
    for k in ("A", "B", "C"):
        items = [x for x in (st.get(k) or []) if isinstance(x, dict) and str(x.get("text") or "").strip()]
        out[k] = len(items)
        ids[k] = [(x.get("id"), (x.get("text") or "")[:60]) for x in items]
    return out, ids

counts, ids = count_abc(structure)
lines.append(f"structure counts={counts}")
for k in ("A", "B", "C"):
    lines.append(f"--- {k} ---")
    for i, t in ids[k]:
        lines.append(f"  {i}: {t}")

# v2 summary
lines.append(f"v2 type={type(v2).__name__}")
if isinstance(v2, dict):
    by = v2.get("by_level") or v2.get("byLevel") or v2
    lines.append(f"v2 keys={list(v2.keys())[:20]}")
    if isinstance(by, dict):
        for level in ("базовый", "продвинутый", "экспертный"):
            block = by.get(level) or {}
            if not isinstance(block, dict):
                lines.append(f"level={level} NOT_DICT")
                continue
            tests = block.get("tests") or []
            tasks = block.get("practicalTasks") or block.get("practical_tasks") or []
            lines.append(
                f"level={level} tests={len(tests)} practical={len(tasks)} "
                f"compositionDone={block.get('compositionDone')}"
            )
            # sample first test/task shapes
            if tests:
                t0 = tests[0]
                lines.append(
                    f"  test0 keys={list(t0.keys()) if isinstance(t0, dict) else type(t0)}"
                )
                if isinstance(t0, dict):
                    lines.append(
                        f"  test0 prompt={str(t0.get('prompt') or '')[:50]!r} "
                        f"criteria={str(t0.get('criteria') or '')[:40]!r} "
                        f"comps={t0.get('componentIds')} itemType={t0.get('itemType')} "
                        f"opts={len(t0.get('options') or [])}"
                    )
            if tasks:
                p0 = tasks[0]
                lines.append(
                    f"  prac0 keys={list(p0.keys()) if isinstance(p0, dict) else type(p0)}"
                )
                if isinstance(p0, dict):
                    lines.append(
                        f"  prac0 name={p0.get('name')!r} comps={p0.get('componentIds')} "
                        f"prompt={str(p0.get('prompt') or '')[:50]!r} "
                        f"criteria={p0.get('criteria')!r}"
                    )

lines.append(f"v1 type={type(v1).__name__}")
if isinstance(v1, dict):
    lines.append(f"v1 keys={list(v1.keys())[:20]}")

# raw_data education / formation levels
if isinstance(raw, dict):
    lines.append(f"raw keys sample={list(raw.keys())[:40]}")
    for key in (
        "formation_levels",
        "formationLevels",
        "education_level",
        "educationLevel",
        "levels",
        "assessment_tools_v2",
        "assessmentV2",
    ):
        if key in raw:
            val = raw[key]
            if isinstance(val, (dict, list)):
                lines.append(f"raw.{key} type={type(val).__name__} len={len(val)}")
            else:
                lines.append(f"raw.{key}={val!r}")

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {OUT}")
