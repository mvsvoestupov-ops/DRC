# -*- coding: utf-8 -*-
import pathlib
import sys

downloads = pathlib.Path(r"C:\Users\Mihail\Downloads")
target = downloads / "1126-01 Шохину А.Н от АО НК Борисова М.П. по ЦРК.pdf"

# Find matching files
files = list(downloads.glob("*ЦРК*.pdf")) + list(downloads.glob("*Шохин*.pdf"))
# Deduplicate
seen = set()
unique = []
for f in files:
    if f.resolve() not in seen:
        seen.add(f.resolve())
        unique.append(f)

print("FOUND:", [f.name for f in unique], flush=True)

pdf_path = target if target.exists() else (unique[0] if unique else None)
if pdf_path is None:
    print("ERROR: PDF not found", flush=True)
    sys.exit(1)

print("USING:", pdf_path.name, flush=True)
print("---TEXT---", flush=True)

text = None
errors = []

# Try pymupdf/fitz
try:
    import fitz
    doc = fitz.open(str(pdf_path))
    parts = []
    for page in doc:
        parts.append(page.get_text())
    doc.close()
    text = "\n".join(parts)
    print("ENGINE: fitz", flush=True)
except Exception as e:
    errors.append(f"fitz: {e}")

# Try pypdf
if not text or not text.strip():
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(pdf_path))
        parts = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
        text = "\n".join(parts)
        print("ENGINE: pypdf", flush=True)
    except Exception as e:
        errors.append(f"pypdf: {e}")

# Try pdfminer
if not text or not text.strip():
    try:
        from pdfminer.high_level import extract_text
        text = extract_text(str(pdf_path))
        print("ENGINE: pdfminer", flush=True)
    except Exception as e:
        errors.append(f"pdfminer: {e}")

if text and text.strip():
    out = pathlib.Path(r"C:\IT\DRC\_pdf_extract.txt")
    out.write_text(text, encoding="utf-8")
    print(text)
    print("---END---", flush=True)
    print("WROTE:", out, flush=True)
else:
    print("ERROR: Could not extract text", flush=True)
    for err in errors:
        print(err, flush=True)
    sys.exit(2)
