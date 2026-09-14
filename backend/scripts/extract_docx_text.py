"""Extract plain text and tables from DOCX."""
from __future__ import annotations

import json
import sys
import zipfile
import xml.etree.ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _cell_text(cell: ET.Element) -> str:
    parts: list[str] = []
    for t in cell.iter(W + "t"):
        if t.text:
            parts.append(t.text)
        if t.tail:
            parts.append(t.tail)
    return " ".join("".join(parts).split())


def extract_paragraphs(root: ET.Element) -> list[str]:
    paras: list[str] = []
    for p in root.iter(W + "p"):
        parts: list[str] = []
        for t in p.iter(W + "t"):
            if t.text:
                parts.append(t.text)
            if t.tail:
                parts.append(t.tail)
        line = "".join(parts).strip()
        if line:
            paras.append(line)
    return paras


def extract_tables(root: ET.Element) -> list[list[list[str]]]:
    tables: list[list[list[str]]] = []
    for tbl in root.iter(W + "tbl"):
        table: list[list[str]] = []
        for row in tbl.findall(f".//{W}tr"):
            cells = [_cell_text(cell) for cell in row.findall(f"{W}tc")]
            if any(cells):
                table.append(cells)
        if table:
            tables.append(table)
    return tables


def extract(path: str) -> dict:
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    return {
        "paragraphs": extract_paragraphs(root),
        "tables": extract_tables(root),
    }


if __name__ == "__main__":
    docx_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else None
    data = extract(docx_path)
    text_lines = [f"{i + 1}|{p}" for i, p in enumerate(data["paragraphs"])]
    text = "\n".join(text_lines)
    if out_path:
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(text)
            f.write("\n\n=== TABLES ===\n\n")
            f.write(json.dumps(data["tables"], ensure_ascii=False, indent=2))
        json_path = out_path.rsplit(".", 1)[0] + ".json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    else:
        print(text)
        print("\n=== TABLES ===\n")
        print(json.dumps(data["tables"], ensure_ascii=False, indent=2))
