# -*- coding: utf-8 -*-
"""Extract labor-function headers and C/xx.6 codes for PS 1674 from DB source."""
from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "profstandart.db")
OUT = os.path.join(ROOT, "scripts", "output", "_1674_headers.txt")

HEADER_RE = re.compile(r"3\.\d+\.\d+[. ]*Трудовая функция")
DOT_AFTER_THIRD_RE = re.compile(r"^3\.\d+\.\d+\.\s*Трудовая функция")
INNER_HEADER_DOT_RE = re.compile(r"3\.\d+\.\d+\.\s*Трудовая функция")
C_TF_RE = re.compile(r"C/0[1-6]\.6")


def main() -> int:
    import sqlite3

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    std = con.execute(
        "SELECT id, reg_number, source_html, source_xml FROM raw_standards WHERE reg_number = ?",
        ("1674",),
    ).fetchone()
    if not std:
        print("Standard 1674 not found", file=sys.stderr)
        return 1

    html = (std["source_html"] or "").strip()
    xml = (std["source_xml"] or "").strip()
    source_kind = "source_html"
    source = html
    if not source and xml:
        source_kind = "source_xml"
        source = xml
    if not source:
        print("No source_html or source_xml", file=sys.stderr)
        return 1

    lines_out: list[str] = []
    lines_out.append(f"reg_number: {std['reg_number']}")
    lines_out.append(f"standard_id: {std['id']}")
    lines_out.append(f"source_used: {source_kind}")
    lines_out.append(f"source_length: {len(source)}")
    lines_out.append("")

    # --- 1) Labor-function header lines from raw source (newline-split) ---
    lines_out.append("=" * 72)
    lines_out.append("1) Lines matching 3.\\d+.\\d+[. ]*Трудовая function (raw newline lines)")
    lines_out.append("=" * 72)
    raw_lines = source.splitlines()
    header_hits: list[tuple[int, str]] = []
    for i, line in enumerate(raw_lines):
        if HEADER_RE.search(line):
            header_hits.append((i + 1, line))
    if not header_hits:
        lines_out.append("(none on raw splitlines; scanning flattened text chunks)")
        for m in HEADER_RE.finditer(source):
            chunk = source[max(0, m.start() - 20) : m.end() + 40]
            chunk_one_line = chunk.replace("\r", "\\r").replace("\n", "\\n")
            lines_out.append(f"  match@{m.start()}: {chunk_one_line!r}")
    else:
        for lineno, text in header_hits:
            stripped = text.strip()
            has_dot = bool(
                DOT_AFTER_THIRD_RE.match(stripped)
                or INNER_HEADER_DOT_RE.search(stripped)
            )
            lines_out.append(f"  line {lineno}: {text!r}")
            lines_out.append(f"    has_dot_after_third_number: {has_dot}")

    lines_out.append("")
    lines_out.append("--- Exact headers for 3.3.5 and 3.3.6 (from raw source lines) ---")
    for target in ("3.3.5", "3.3.6"):
        found = False
        for lineno, text in header_hits:
            if target in text and "Трудовая функция" in text:
                lines_out.append(f"  {target}: line {lineno}: {text!r}")
                stripped = text.strip()
                has_dot = bool(
                    DOT_AFTER_THIRD_RE.match(stripped)
                    or INNER_HEADER_DOT_RE.search(stripped)
                )
                lines_out.append(f"    has_dot_after_third_number: {has_dot}")
                found = True
        if not found:
            pat = re.compile(
                rf"3\.3\.{target.split('.')[-1]}[. ]*Трудовая функция"
            )
            for m in pat.finditer(source):
                s = max(0, m.start() - 5)
                e = min(len(source), m.end() + 30)
                snippet = source[s:e].replace("\n", "\\n")
                lines_out.append(f"  {target}: inline@{m.start()}: {snippet!r}")
                found = True
        if not found:
            lines_out.append(f"  {target}: NOT FOUND")

    # --- 2) summary dot analysis (also via _page_lines) ---
    lines_out.append("")
    lines_out.append("=" * 72)
    lines_out.append("2) Parsed text lines (_page_lines) matching labor-function headers")
    lines_out.append("=" * 72)
    sys.path.insert(0, ROOT)
    from app.classinform_parser import _page_lines

    page = _page_lines(source) if source_kind == "source_html" else [
        ln.strip() for ln in source.splitlines() if ln.strip()
    ]
    for pline in page:
        if HEADER_RE.search(pline):
            has_dot = bool(DOT_AFTER_THIRD_RE.match(pline))
            lines_out.append(f"  {pline!r}  | dot_after_third: {has_dot}")

    # --- 3) C/01.6 .. C/06.6 ---
    lines_out.append("")
    lines_out.append("=" * 72)
    lines_out.append("3) Occurrences of C/01.6 through C/06.6 in source")
    lines_out.append("=" * 72)
    for code in [f"C/0{i}.6" for i in range(1, 7)]:
        positions = [m.start() for m in re.finditer(re.escape(code), source)]
        lines_out.append(f"  {code}: count={len(positions)} positions={positions[:20]}")
        if len(positions) > 20:
            lines_out.append(f"    ... and {len(positions) - 20} more")
    lines_out.append("")
    lines_out.append("All C/0x.6 matches (regex C/0[1-6].6):")
    for m in C_TF_RE.finditer(source):
        ctx_s = max(0, m.start() - 30)
        ctx_e = min(len(source), m.end() + 30)
        ctx = source[ctx_s:ctx_e].replace("\n", "\\n")
        lines_out.append(f"  @{m.start()} {m.group()!r} context: {ctx!r}")

    # --- 4) OTF B: B/04.5 in raw_particular_functions ---
    lines_out.append("")
    lines_out.append("=" * 72)
    lines_out.append("4) OTF B: B/04.5 in raw_particular_functions")
    lines_out.append("=" * 72)
    gf_b = con.execute(
        """
        SELECT id, code, name FROM raw_generalized_functions
        WHERE standard_id = ? AND trim(code) = 'B'
        """,
        (std["id"],),
    ).fetchone()
    if not gf_b:
        gf_b = con.execute(
            """
            SELECT id, code, name FROM raw_generalized_functions
            WHERE standard_id = ? AND upper(trim(code)) LIKE 'B%'
            ORDER BY id LIMIT 1
            """,
            (std["id"],),
        ).fetchone()
    if gf_b:
        lines_out.append(f"  OTF B row: id={gf_b['id']} code={gf_b['code']!r} name={gf_b['name']!r}")
        pfs = con.execute(
            "SELECT code, name FROM raw_particular_functions WHERE generalized_id = ? ORDER BY id",
            (gf_b["id"],),
        ).fetchall()
        codes = [(r["code"] or "").strip() for r in pfs]
        lines_out.append(f"  All PF codes under B: {codes}")
        has_b045 = any(c.replace(" ", "") == "B/04.5" for c in codes)
        lines_out.append(f"  B/04.5 present in raw_particular_functions: {has_b045}")
    else:
        lines_out.append("  OTF B not found in raw_generalized_functions")

    # --- 5) Re-parse with classinform_parser ---
    lines_out.append("")
    lines_out.append("=" * 72)
    lines_out.append("5) Parsed TF codes under OTF C (parse_classinform_html)")
    lines_out.append("=" * 72)
    if source_kind == "source_html":
        from app.classinform_parser import parse_classinform_html

        parsed = parse_classinform_html(source)
        otf_c = next(
            (g for g in parsed.generalized_functions if (g.code or "").strip() == "C"),
            None,
        )
        if otf_c:
            lines_out.append(f"  OTF C: {otf_c.name!r} level={otf_c.level!r}")
            for pf in otf_c.particular_functions:
                lines_out.append(f"    {pf.code!r} | {(pf.name or '')[:120]}")
        else:
            lines_out.append("  OTF C not found in parse")
            lines_out.append(
                "  OTF codes: "
                + str([(g.code, g.name[:40]) for g in parsed.generalized_functions])
            )
    else:
        lines_out.append("  (skipped: source_xml only, no HTML parser run)")

    con.close()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines_out) + "\n")
    print("WROTE", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
