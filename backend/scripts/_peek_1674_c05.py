# -*- coding: utf-8 -*-
"""Peek source_html / TF list for PS 1674 around C/05.6. Run via cmd: py -3 scripts/_peek_1674_c05.py"""
import sqlite3
from pathlib import Path

db = Path(__file__).resolve().parents[1] / "profstandart.db"
con = sqlite3.connect(str(db))
con.row_factory = sqlite3.Row
cur = con.cursor()

std = cur.execute(
    "SELECT id, reg_number, ps_code, name FROM raw_standards WHERE reg_number=?",
    ("1674",),
).fetchone()
print("STD", dict(std) if std else None)
if not std:
    raise SystemExit(1)

# column discovery
cols = [r[1] for r in cur.execute("PRAGMA table_info(raw_standards)")]
print("COLS", cols)
html = None
for c in ("source_html", "html", "raw_html", "content_html", "document_html"):
    if c in cols:
        html = cur.execute(f"SELECT {c} FROM raw_standards WHERE id=?", (std["id"],)).fetchone()[0]
        print("HTML_COL", c, "LEN", len(html or ""))
        break

gfs = cur.execute(
    "SELECT id, code, name FROM raw_generalized_functions WHERE standard_id=? ORDER BY id",
    (std["id"],),
).fetchall()
for gf in gfs:
    pfs = cur.execute(
        "SELECT code, name FROM raw_particular_functions WHERE generalized_id=? ORDER BY id",
        (gf["id"],),
    ).fetchall()
    print(f"OTF {gf['code']}: {[p['code'] for p in pfs]}")

out = Path(__file__).resolve().parents[1] / "scripts" / "output" / "_1674_c05_snip.txt"
out.parent.mkdir(parents=True, exist_ok=True)
if html:
    markers = ["C/05.6", "C/04.6", "C/06.6", "3.3.5", "3.3.6", "Трудовая функция"]
    idx = html.find("C/05.6")
    print("IDX C/05.6", idx)
    if idx < 0:
        # try escaped / spaced
        for m in ("C/05.6", "C / 05.6", "C/05", "повышению эффективности работы оборудования"):
            i = html.find(m)
            print("FIND", m, i)
            if i >= 0:
                idx = i
                break
    if idx >= 0:
        snip = html[max(0, idx - 800) : idx + 1200]
        out.write_text(snip, encoding="utf-8")
        print("WROTE", out, "chars", len(snip))
    # also dump all C/xx.6 occurrences
    import re
    codes = re.findall(r"C/\d{2}\.\d", html)
    print("CODES_IN_HTML", codes)
else:
    out.write_text("NO HTML COLUMN\n", encoding="utf-8")
con.close()
