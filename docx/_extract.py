import json, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
path = Path(r"C:\IT\DRC\docx\Заготовка для матрицы.docx")
out = Path(r"C:\IT\DRC\docx\_template_extract.json")

def cell_text(cell):
    parts = []
    for t in cell.iter(W + "t"):
        if t.text: parts.append(t.text)
        if t.tail: parts.append(t.tail)
    return " ".join("".join(parts).split())

with zipfile.ZipFile(path) as z:
    root = ET.fromstring(z.read("word/document.xml"))

paras = []
for p in root.iter(W + "p"):
    parts = []
    for t in p.iter(W + "t"):
        if t.text: parts.append(t.text)
        if t.tail: parts.append(t.tail)
    line = "".join(parts).strip()
    if line: paras.append(line)

tables = []
for tbl in root.iter(W + "tbl"):
    table = []
    for row in tbl.findall(f".//{W}tr"):
        cells = [cell_text(c) for c in row.findall(f"{W}tc")]
        if any(cells): table.append(cells)
    if table: tables.append(table)

data = {"paragraphs": paras, "tables": tables, "table_count": len(tables)}
out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print("OK", len(paras), len(tables))
