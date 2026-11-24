# -*- coding: utf-8 -*-
import pathlib
import sys

pdf_path = pathlib.Path(r"C:\Users\Mihail\Downloads\1126-01 Шохину А.Н от АО НК Борисова М.П. по ЦРК.pdf")
out_dir = pathlib.Path(r"C:\IT\DRC\_pdf_pages")
out_dir.mkdir(exist_ok=True)

import pymupdf

doc = pymupdf.open(str(pdf_path))
print(f"pages={doc.page_count}", flush=True)
for i, page in enumerate(doc):
    raw = page.get_text("text") or ""
    blocks = page.get_text("dict")
    imgs = page.get_images(full=True)
    print(f"page={i+1} text_len={len(raw)} images={len(imgs)} blocks={len(blocks.get('blocks', []))}", flush=True)
    # high-res render
    mat = pymupdf.Matrix(2.5, 2.5)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    out = out_dir / f"page_{i+1:02d}.png"
    pix.save(str(out))
    print(f"wrote={out}", flush=True)
    # also try textpage from OCR if available
    try:
        tp = page.get_textpage_ocr(language="rus+eng", dpi=300)
        ocr_text = page.get_text(textpage=tp) or ""
        ocr_out = out_dir / f"page_{i+1:02d}_ocr.txt"
        ocr_out.write_text(ocr_text, encoding="utf-8")
        print(f"ocr_len={len(ocr_text)} wrote={ocr_out}", flush=True)
    except Exception as e:
        print(f"ocr_failed={e}", flush=True)
doc.close()
print("DONE", flush=True)
