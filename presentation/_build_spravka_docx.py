# -*- coding: utf-8 -*-
"""Build spravka-proekta.docx from spravka-proekta.md using python-docx."""
from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
    from docx.oxml.ns import qn
    from docx.shared import Pt, Cm, RGBColor
except ImportError:
    print("python-docx is not installed. Run: pip install python-docx", file=sys.stderr)
    sys.exit(1)

HERE = Path(__file__).resolve().parent
MD_PATH = HERE / "spravka-proekta.md"
DOCX_PATH = HERE / "spravka-proekta.docx"

FONT_NAME = "Times New Roman"
BODY_SIZE = Pt(12)
TITLE_SIZE = Pt(14)
LINE_SPACING = 1.5


def set_run_font(run, size=BODY_SIZE, bold=False, italic=False):
    run.font.name = FONT_NAME
    run._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_NAME)
    run.font.size = size
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = RGBColor(0, 0, 0)


def set_paragraph_format(paragraph, space_after=Pt(6), space_before=Pt(0), first_line=None):
    pf = paragraph.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = LINE_SPACING
    pf.space_after = space_after
    pf.space_before = space_before
    if first_line is not None:
        pf.first_line_indent = first_line


def strip_md_inline(text: str) -> list[tuple[str, bool]]:
    """Split text into (plain, bold) segments; strip **, keep URLs as plain text."""
    text = text.replace("\\n", " ")
    parts: list[tuple[str, bool]] = []
    # **bold** segments
    pattern = re.compile(r"\*\*(.+?)\*\*")
    pos = 0
    for m in pattern.finditer(text):
        if m.start() > pos:
            parts.append((text[pos : m.start()], False))
        parts.append((m.group(1), True))
        pos = m.end()
    if pos < len(text):
        parts.append((text[pos:], False))
    if not parts:
        parts = [(text, False)]
    # Clean residual markdown link syntax [text](url) -> text (url)
    cleaned: list[tuple[str, bool]] = []
    link_re = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
    for seg, bold in parts:
        if "[" in seg and "](" in seg:
            rebuilt = []
            lp = 0
            for lm in link_re.finditer(seg):
                rebuilt.append(seg[lp : lm.start()])
                rebuilt.append(f"{lm.group(1)} ({lm.group(2)})")
                lp = lm.end()
            rebuilt.append(seg[lp:])
            cleaned.append(("".join(rebuilt), bold))
        else:
            cleaned.append((seg, bold))
    return cleaned


def add_runs(paragraph, text: str, size=BODY_SIZE, force_bold=False):
    for seg, is_bold in strip_md_inline(text):
        if not seg:
            continue
        run = paragraph.add_run(seg)
        set_run_font(run, size=size, bold=force_bold or is_bold)


def add_body_paragraph(doc, text: str, first_line=Cm(1.25)):
    p = doc.add_paragraph()
    set_paragraph_format(p, space_after=Pt(8), first_line=first_line)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    add_runs(p, text)
    return p


def add_heading_para(doc, text: str, level: int):
    # Use Heading styles but force Times New Roman
    style_name = {1: "Heading 1", 2: "Heading 2", 3: "Heading 3"}.get(level, "Heading 2")
    p = doc.add_paragraph(style=style_name)
    set_paragraph_format(p, space_before=Pt(14 if level <= 2 else 10), space_after=Pt(8))
    # Clear default runs from style if any empty, then add our text
    if p.runs:
        for r in p.runs:
            r.text = ""
    sizes = {1: Pt(14), 2: Pt(13), 3: Pt(12)}
    add_runs(p, text, size=sizes.get(level, BODY_SIZE), force_bold=True)
    for run in p.runs:
        run.font.name = FONT_NAME
        run._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_NAME)
        run.font.color.rgb = RGBColor(0, 0, 0)
    return p


def add_list_item(doc, text: str, ordered: bool, number: int | None = None):
    p = doc.add_paragraph()
    set_paragraph_format(p, space_after=Pt(4), first_line=Cm(0))
    p.paragraph_format.left_indent = Cm(1.0)
    prefix = f"{number}. " if ordered and number is not None else "• "
    run = p.add_run(prefix)
    set_run_font(run, bold=False)
    add_runs(p, text)
    return p


def add_meta_line(doc, text: str):
    p = doc.add_paragraph()
    set_paragraph_format(p, space_after=Pt(2), first_line=Cm(0))
    add_runs(p, text)
    return p


def add_table(doc, rows: list[list[str]]):
    if not rows:
        return
    table = doc.add_table(rows=len(rows), cols=len(rows[0]))
    table.style = "Table Grid"
    for i, row in enumerate(rows):
        for j, cell_text in enumerate(row):
            cell = table.rows[i].cells[j]
            cell.text = ""
            p = cell.paragraphs[0]
            set_paragraph_format(p, space_after=Pt(2), space_before=Pt(2), first_line=Cm(0))
            add_runs(p, cell_text.strip(), force_bold=(i == 0))
    # Spacer after table
    sp = doc.add_paragraph()
    set_paragraph_format(sp, space_after=Pt(6))
    return table


def parse_and_build(md: str, doc: Document):
    lines = md.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    i = 0
    n = len(lines)
    title_done = False
    subtitle_done = False
    ordered_counter = 0

    while i < n:
        line = lines[i]
        stripped = line.strip()

        # Skip empty
        if not stripped:
            i += 1
            ordered_counter = 0
            continue

        # Horizontal rule
        if re.match(r"^---+$", stripped):
            i += 1
            continue

        # ATX headings
        hm = re.match(r"^(#{1,3})\s+(.+)$", stripped)
        if hm:
            level = len(hm.group(1))
            text = hm.group(2).strip()
            if level == 1 and not title_done:
                p = doc.add_paragraph()
                set_paragraph_format(p, space_after=Pt(8), space_before=Pt(0))
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                add_runs(p, text, size=TITLE_SIZE, force_bold=True)
                title_done = True
            else:
                add_heading_para(doc, text, level)
            ordered_counter = 0
            i += 1
            continue

        # Table block
        if stripped.startswith("|") and "|" in stripped[1:]:
            table_rows: list[list[str]] = []
            while i < n and lines[i].strip().startswith("|"):
                row_line = lines[i].strip()
                # Skip separator |---|---|
                if re.match(r"^\|[\s\-:|]+\|$", row_line) or re.match(
                    r"^\|[\s\-:|]+$", row_line
                ):
                    i += 1
                    continue
                cells = [c.strip() for c in row_line.strip("|").split("|")]
                table_rows.append(cells)
                i += 1
            add_table(doc, table_rows)
            ordered_counter = 0
            continue

        # Unordered list
        um = re.match(r"^[-*]\s+(.+)$", stripped)
        if um:
            add_list_item(doc, um.group(1), ordered=False)
            ordered_counter = 0
            i += 1
            continue

        # Ordered list
        om = re.match(r"^(\d+)\.\s+(.+)$", stripped)
        if om:
            ordered_counter = int(om.group(1))
            add_list_item(doc, om.group(2), ordered=True, number=ordered_counter)
            i += 1
            continue

        # Subtitle (first non-heading paragraph after H1) — centered italic-ish / bold lead
        if title_done and not subtitle_done and not stripped.startswith("#"):
            # Collect until blank or meta/heading — the long "о ходе..." line
            p = doc.add_paragraph()
            set_paragraph_format(p, space_after=Pt(10), space_before=Pt(0))
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            add_runs(p, stripped, size=BODY_SIZE, force_bold=False)
            for run in p.runs:
                run.italic = True
            subtitle_done = True
            i += 1
            continue

        # Meta lines (Адресат / Подготовлено / Дата) — often end with two spaces
        if stripped.startswith("**Адресат:**") or stripped.startswith(
            "**Подготовлено:**"
        ) or stripped.startswith("**Дата:**"):
            add_meta_line(doc, stripped)
            i += 1
            continue

        # Intro paragraph after subtitle (before ---): center or body
        # Default body paragraph; may continue on next non-empty lines? MD uses single lines.
        add_body_paragraph(doc, stripped)
        i += 1

    return doc


def configure_document(doc: Document):
    for section in doc.sections:
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2)

    style = doc.styles["Normal"]
    style.font.name = FONT_NAME
    style.font.size = BODY_SIZE
    style._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_NAME)
    pf = style.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = LINE_SPACING

    for hname, size in (("Heading 1", 14), ("Heading 2", 13), ("Heading 3", 12)):
        try:
            hs = doc.styles[hname]
            hs.font.name = FONT_NAME
            hs.font.size = Pt(size)
            hs.font.bold = True
            hs.font.color.rgb = RGBColor(0, 0, 0)
            hs._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_NAME)
        except KeyError:
            pass


def main():
    if not MD_PATH.exists():
        print(f"Source not found: {MD_PATH}", file=sys.stderr)
        sys.exit(1)

    md = MD_PATH.read_text(encoding="utf-8")
    doc = Document()
    configure_document(doc)
    parse_and_build(md, doc)
    doc.save(str(DOCX_PATH))
    print(f"Created: {DOCX_PATH}")


if __name__ == "__main__":
    main()
