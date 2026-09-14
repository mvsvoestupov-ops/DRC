# -*- coding: utf-8 -*-
from docx import Document
import json
import os

src = r"c:\Users\Mihail\Downloads\maket_professionalnogog_standarta_446n.docx"
out_dir = r"C:\IT\DRC\backend\scripts\output"
os.makedirs(out_dir, exist_ok=True)
out_txt = os.path.join(out_dir, "maket_446n_structure.txt")
out_json = os.path.join(out_dir, "maket_446n_structure.json")

d = Document(src)
lines = []
paras = []
for i, p in enumerate(d.paragraphs):
    t = p.text.strip()
    if t:
        lines.append(f"P{i}: {t}")
        paras.append(t)

tables = []
lines.append("\n=== TABLES ===\n")
for ti, t in enumerate(d.tables):
    lines.append(f"\n--- TABLE {ti} ({len(t.rows)}x{len(t.columns)}) ---")
    rows = []
    for row in t.rows:
        cells = [c.text.replace("\n", " / ").strip() for c in row.cells]
        # dedupe merged cell repeats
        deduped = []
        for c in cells:
            if not deduped or deduped[-1] != c:
                deduped.append(c)
        lines.append(" | ".join(cells))
        rows.append(cells)
    tables.append({"index": ti, "rows": len(t.rows), "cols": len(t.columns), "data": rows})

text = "\n".join(lines)
with open(out_txt, "w", encoding="utf-8") as f:
    f.write(text)
with open(out_json, "w", encoding="utf-8") as f:
    json.dump({"paragraphs": paras, "tables": tables}, f, ensure_ascii=False, indent=2)
print(text[:8000])
print("\n...\nWrote", out_txt)
