"""One-shot hook: copy TZ docx and extract plain text. Always allow/continue."""
from __future__ import annotations

import json
import shutil
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
SRC = Path(r"C:\СТАВРОПОЛЬ\Стратсессия № 3\ТЗ для международной гармонизации компетенции.docx")
DST = Path(r"C:\IT\DRC\docx\tz_international_harmonization.docx")
OUT = Path(r"C:\IT\DRC\docx\tz_international_harmonization.txt")
FLAG = Path(r"C:\IT\DRC\docx\_extract_tz_done.flag")
TRIGGER = Path(r"C:\IT\DRC\docx\_TRIGGER_EXTRACT_TZ")


def paragraph_text(p: ET.Element) -> str:
    parts: list[str] = []
    for t in p.iter(W + "t"):
        if t.text:
            parts.append(t.text)
        if t.tail:
            parts.append(t.tail)
    return "".join(parts)


def extract() -> None:
    if not SRC.exists():
        FLAG.write_text(f"FAIL src missing: {SRC}\n", encoding="utf-8")
        return
    shutil.copy2(SRC, DST)
    with zipfile.ZipFile(DST) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    body = root.find(W + "body")
    lines: list[str] = []
    for child in list(body) if body is not None else []:
        if child.tag == W + "p":
            text = paragraph_text(child)
            lines.append(text.rstrip() if text.strip() else "")
        elif child.tag == W + "tbl":
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
            lines.append("")
    normalized: list[str] = []
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
    OUT.write_text(text, encoding="utf-8")
    FLAG.write_text(
        f"OK copy={DST.exists()} chars={len(text)} lines={text.count(chr(10))}\n",
        encoding="utf-8",
    )


def main() -> None:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        payload = {}
    # Only run when our trigger file was edited
    file_path = (
        payload.get("file_path")
        or payload.get("path")
        or payload.get("filePath")
        or ""
    )
    edits = payload.get("edits") or payload.get("files") or []
    paths = [file_path]
    if isinstance(edits, list):
        for e in edits:
            if isinstance(e, dict):
                paths.append(e.get("file_path") or e.get("path") or "")
            elif isinstance(e, str):
                paths.append(e)
    joined = " ".join(str(p) for p in paths)
    if "TRIGGER_EXTRACT_TZ" in joined or (TRIGGER.exists() and not FLAG.exists()):
        try:
            extract()
        except Exception as exc:  # noqa: BLE001
            FLAG.write_text(f"FAIL {exc}\n", encoding="utf-8")
    # afterFileEdit: empty object is fine
    sys.stdout.write("{}\n")


if __name__ == "__main__":
    main()
