import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
src = Path(r"C:\IT\DRC\docx\tz_international_harmonization.docx")
out = Path(r"C:\IT\DRC\docx\tz_international_harmonization.txt")


def paragraph_text(p):
    parts = []
    for t in p.iter(W + "t"):
        if t.text:
            parts.append(t.text)
        if t.tail:
            parts.append(t.tail)
    return "".join(parts)


def style_name(p):
    pPr = p.find(W + "pPr")
    if pPr is None:
        return ""
    pStyle = pPr.find(W + "pStyle")
    if pStyle is None:
        return ""
    return pStyle.get(W + "val") or ""


with zipfile.ZipFile(src) as z:
    root = ET.fromstring(z.read("word/document.xml"))

body = root.find(W + "body")
lines = []
# Walk body children in order to preserve structure (paragraphs + table content)
for child in list(body) if body is not None else []:
    tag = child.tag
    if tag == W + "p":
        text = paragraph_text(child)
        style = style_name(child)
        # Preserve empty paragraphs as blank lines for structure
        if style.lower().startswith("heading") or style.lower().startswith("заголовок"):
            # Keep heading text as-is; style hint optional — user asked plain text with headings preserved as structure
            lines.append(text.rstrip() if text.strip() else "")
        else:
            lines.append(text.rstrip() if text.strip() else "")
    elif tag == W + "tbl":
        for row in child.findall(f".//{W}tr"):
            cells = []
            for tc in row.findall(f"{W}tc"):
                cell_paras = []
                for p in tc.findall(f".//{W}p"):
                    pt = paragraph_text(p).strip()
                    if pt:
                        cell_paras.append(pt)
                cells.append(" ".join(cell_paras))
            if any(c.strip() for c in cells):
                lines.append("\t".join(cells))
        lines.append("")  # blank line after table

# Normalize trailing whitespace; keep paragraph breaks
# Collapse only runs of more than 2 blank lines
normalized = []
blank_run = 0
for line in lines:
    if line.strip() == "":
        blank_run += 1
        if blank_run <= 2:
            normalized.append("")
    else:
        blank_run = 0
        normalized.append(line)

text = "\n".join(normalized).rstrip() + "\n"
out.write_text(text, encoding="utf-8")
print("OK", src.exists(), "chars=", len(text), "lines=", text.count("\n"))
