"""Extract source_html context around C/04.6, C/05.6, C/06.6 for reg 1674."""
from __future__ import annotations

import os
import re
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "profstandart.db")
OUT = os.path.join(ROOT, "scripts", "output", "c056_snippets_1674.txt")


def snippet_around(text: str, needle: str, radius: int = 800) -> str:
    idx = text.find(needle)
    if idx < 0:
        # try without slash variants
        alt = needle.replace("/", " / ")
        idx = text.find(alt)
        if idx < 0:
            return f"NOT FOUND: {needle!r}"
    start = max(0, idx - radius)
    end = min(len(text), idx + len(needle) + radius)
    return text[start:end]


def table_cell_context(html: str, code: str) -> str:
    """Find HTML table cells containing the code."""
    patterns = [
        re.escape(code),
        re.escape(code.replace("/", " / ")),
        re.escape(code.replace("/", "/ ")),
    ]
    for pat in patterns:
        for m in re.finditer(pat, html, re.I):
            s = max(0, m.start() - 400)
            e = min(len(html), m.end() + 400)
            return html[s:e]
    return f"NO TABLE MATCH: {code}"


def main() -> int:
    con = sqlite3.connect(DB)
    row = con.execute(
        "SELECT source_html FROM raw_standards WHERE reg_number = ?",
        ("1674",),
    ).fetchone()
    if not row or not row[0]:
        print("no source_html", file=sys.stderr)
        return 1
    html = row[0]
    lines: list[str] = []
    lines.append(f"source_html length: {len(html)}")
    lines.append(f"C/05.6 in html: {'C/05.6' in html}")
    lines.append(f"C/04.6 in html: {'C/04.6' in html}")
    lines.append(f"C/06.6 in html: {'C/06.6' in html}")
    for code in ("C/04.6", "C/05.6", "C/06.6"):
        lines.append("")
        lines.append("=" * 60)
        lines.append(f"=== HTML table context: {code} ===")
        lines.append("=" * 60)
        lines.append(table_cell_context(html, code))
    # Parse with classinform parser
    sys.path.insert(0, ROOT)
    from app.classinform_parser import parse_classinform_html, _page_lines, _parse_section_iii

    parsed = parse_classinform_html(html)
    otf_c = next((g for g in parsed.generalized_functions if g.code == "C"), None)
    lines.append("")
    lines.append("=" * 60)
    lines.append("=== Parsed OTF C TF codes ===")
    lines.append("=" * 60)
    if otf_c:
        for pf in otf_c.particular_functions:
            lines.append(f"  {pf.code!r} | {pf.name[:80]}...")
    else:
        lines.append("OTF C not found in parse")

    # Debug _parse_label_blocks for C/05.6 chunk
    page_lines = _page_lines(html)
    gfs = _parse_section_iii(page_lines)
    otf_c2 = next((g for g in gfs if g.code == "C"), None)
    lines.append("")
    lines.append(f"_parse_section_iii OTF C PF count: {len(otf_c2.particular_functions) if otf_c2 else 0}")

    # Find line index of C/05.6 in text lines
    for i, ln in enumerate(page_lines):
        if "C/05.6" in ln or "05.6" in ln and "C/" in ln:
            lines.append("")
            lines.append(f"page_lines around idx {i}: {ln!r}")
            for j in range(max(0, i - 5), min(len(page_lines), i + 15)):
                lines.append(f"  [{j}] {page_lines[j]!r}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("Wrote", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
