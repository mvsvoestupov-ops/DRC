#!/usr/bin/env python3
"""Modernize PowerPoint title slide; preserve all Russian text."""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

try:
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_SHAPE_TYPE
    from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
    from pptx.util import Inches, Pt
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "python-pptx"])
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_SHAPE_TYPE
    from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
    from pptx.util import Inches, Pt

# Modern palette (Tailwind-inspired slate + sky accent)
NAVY = RGBColor(0x0F, 0x17, 0x2A)
SLATE = RGBColor(0x1E, 0x29, 0x3B)
SLATE_LIGHT = RGBColor(0x33, 0x41, 0x55)
ACCENT = RGBColor(0x38, 0xBD, 0xF8)
ACCENT_SOFT = RGBColor(0x0E, 0x74, 0x90)
WHITE = RGBColor(0xF8, 0xFA, 0xFC)
MUTED = RGBColor(0x94, 0xA3, 0xB8)

SOURCE = Path(r"c:\Users\Mihail\Downloads\вариант шаблона титульного листа.pptx")
OUTPUT = Path(r"c:\Users\Mihail\Downloads\вариант шаблона титульного листа_modern.pptx")
ANALYSIS_JSON = Path(__file__).resolve().parent / "output" / "title_slide_analysis.json"
NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}


def emu_to_inches(emu: int) -> float:
    return emu / 914400


def analyze_presentation(prs: Presentation) -> dict:
    slide = prs.slides[0]
    info = {
        "slide_width_in": emu_to_inches(prs.slide_width),
        "slide_height_in": emu_to_inches(prs.slide_height),
        "shape_count": len(slide.shapes),
        "shapes": [],
    }
    for i, shape in enumerate(slide.shapes):
        entry = {
            "index": i,
            "name": shape.name,
            "shape_type": str(shape.shape_type),
            "left_in": round(emu_to_inches(shape.left), 2),
            "top_in": round(emu_to_inches(shape.top), 2),
            "width_in": round(emu_to_inches(shape.width), 2),
            "height_in": round(emu_to_inches(shape.height), 2),
        }
        if shape.has_text_frame:
            entry["text"] = shape.text_frame.text.strip()
            runs = []
            for para in shape.text_frame.paragraphs:
                for run in para.runs:
                    runs.append(
                        {
                            "text": run.text,
                            "font": run.font.name,
                            "size_pt": run.font.size.pt if run.font.size else None,
                            "bold": run.font.bold,
                        }
                    )
            entry["runs"] = runs
        info["shapes"].append(entry)
    return info


def _set_solid_fill(shape, rgb: RGBColor) -> None:
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb


def _set_slide_background(slide, rgb: RGBColor) -> None:
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = rgb


def _max_font_size(shape) -> float:
    sizes = []
    for para in shape.text_frame.paragraphs:
        for run in para.runs:
            if run.font.size:
                sizes.append(run.font.size.pt)
    return max(sizes) if sizes else 12.0


def _style_runs(shape, *, size: int, bold: bool, color: RGBColor, font_name: str = "Segoe UI") -> None:
    for para in shape.text_frame.paragraphs:
        para.line_spacing = 1.2
        for run in para.runs:
            run.font.name = font_name
            run.font.size = Pt(size)
            run.font.bold = bold
            run.font.color.rgb = color


def _send_to_back(slide, shape) -> None:
    tree = slide.shapes._spTree
    el = shape._element
    tree.remove(el)
    tree.insert(2, el)


def modernize(prs: Presentation) -> list[str]:
    changes: list[str] = []
    slide = prs.slides[0]
    sw, sh = prs.slide_width, prs.slide_height

    text_shapes = [s for s in slide.shapes if s.has_text_frame and s.text_frame.text.strip()]
    pictures = [s for s in slide.shapes if s.shape_type == MSO_SHAPE_TYPE.PICTURE]
    original_texts = [s.text_frame.text.strip() for s in text_shapes]

    # Remove old decorative auto-shapes (keep text + images)
    removed = 0
    for shape in list(slide.shapes):
        if shape.has_text_frame and shape.text_frame.text.strip():
            continue
        if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
            continue
        if shape.shape_type == MSO_SHAPE_TYPE.PLACEHOLDER:
            continue
        shape._element.getparent().remove(shape._element)
        removed += 1
    changes.append(f"Removed {removed} decorative shapes; kept {len(text_shapes)} text blocks and {len(pictures)} images.")

    _set_slide_background(slide, NAVY)
    changes.append("Slide background: deep navy (#0F172A).")

    # Accent stripe (left edge)
    stripe = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, 0, Inches(0.18), sh)
    _set_solid_fill(stripe, ACCENT)
    stripe.line.fill.background()
    _send_to_back(slide, stripe)

    # Soft geometric accents
    orb1 = slide.shapes.add_shape(
        MSO_AUTO_SHAPE_TYPE.OVAL,
        int(sw * 0.78),
        int(sh * 0.05),
        Inches(2.4),
        Inches(2.4),
    )
    _set_solid_fill(orb1, ACCENT_SOFT)
    orb1.line.fill.background()
    _send_to_back(slide, orb1)

    orb2 = slide.shapes.add_shape(
        MSO_AUTO_SHAPE_TYPE.OVAL,
        int(sw * 0.85),
        int(sh * 0.68),
        Inches(1.6),
        Inches(1.6),
    )
    _set_solid_fill(orb2, SLATE_LIGHT)
    orb2.line.fill.background()
    _send_to_back(slide, orb2)

    # Content card
    card_l, card_t, card_w, card_h = Inches(0.55), Inches(0.95), Inches(8.8), Inches(5.75)
    card = slide.shapes.add_shape(
        MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE,
        card_l,
        card_t,
        card_w,
        card_h,
    )
    _set_solid_fill(card, SLATE)
    card.line.color.rgb = ACCENT
    card.line.width = Pt(1.25)
    _send_to_back(slide, card)

    # Horizontal accent line under header zone
    accent_line = slide.shapes.add_shape(
        MSO_AUTO_SHAPE_TYPE.RECTANGLE,
        card_l + Inches(0.5),
        card_t + Inches(2.55),
        Inches(2.4),
        Pt(4),
    )
    _set_solid_fill(accent_line, ACCENT)
    accent_line.line.fill.background()

    changes.append("Added accent stripe, soft orbs, rounded content card, accent divider.")

    # Rank text blocks: title = largest font or longest text near top
    def title_score(s):
        return (_max_font_size(s), -s.top, len(s.text_frame.text.strip()))

    ranked = sorted(text_shapes, key=title_score, reverse=True)
    title_shape = ranked[0]
    body_shapes = sorted(ranked[1:], key=lambda s: (s.top, s.left))

    inner_l = card_l + Inches(0.55)
    inner_w = card_w - Inches(1.1)
    y = card_t + Inches(0.5)

    # Title
    title_shape.left = inner_l
    title_shape.top = y
    title_shape.width = inner_w
    title_shape.height = Inches(2.0)
    title_shape.text_frame.word_wrap = True
    title_shape.text_frame.vertical_anchor = MSO_ANCHOR.TOP
    for para in title_shape.text_frame.paragraphs:
        para.alignment = PP_ALIGN.LEFT
    _style_runs(title_shape, size=34, bold=True, color=WHITE)
    y += Inches(2.15)

    # Body blocks
    for shape in body_shapes:
        text_len = len(shape.text_frame.text.strip())
        block_h = Inches(1.0 if text_len >= 100 else 0.65 if text_len >= 40 else 0.45)
        shape.left = inner_l
        shape.top = y
        shape.width = inner_w
        shape.height = block_h
        shape.text_frame.word_wrap = True
        shape.text_frame.vertical_anchor = MSO_ANCHOR.TOP
        for para in shape.text_frame.paragraphs:
            para.alignment = PP_ALIGN.LEFT
        is_subheading = _max_font_size(shape) >= 18 or text_len < 60
        if is_subheading and shape is body_shapes[0]:
            _style_runs(shape, size=20, bold=True, color=WHITE)
        else:
            _style_runs(shape, size=14, bold=False, color=MUTED)
        y += block_h + Inches(0.12)

    changes.append("Typography: Segoe UI, 34pt title, 20pt subheading, 14pt body; left-aligned layout.")

    # Reposition logos to top-right if present
    for pic in pictures:
        pic.left = sw - pic.width - Inches(0.45)
        pic.top = Inches(0.35)
    if pictures:
        changes.append(f"Repositioned {len(pictures)} image(s) to top-right.")

    final_texts = [
        s.text_frame.text.strip()
        for s in slide.shapes
        if s.has_text_frame and s.text_frame.text.strip()
    ]
    for text in original_texts:
        if text not in final_texts:
            changes.append(f"WARNING: text block may be missing: {text[:60]}...")

    return changes


def patch_background_gradient(path: Path) -> None:
    """Replace first large rectangle solid fill with subtle gradient via XML."""
    with zipfile.ZipFile(path, "a") as zf:
        slide_names = sorted(
            n for n in zf.namelist() if n.startswith("ppt/slides/slide") and n.endswith(".xml")
        )
        if not slide_names:
            return
        root = ET.fromstring(zf.read(slide_names[0]))
        bg_fill = root.find(".//p:bg/p:bgPr/a:solidFill", {"p": "http://schemas.openxmlformats.org/presentationml/2006/main", **NS})
        if bg_fill is not None:
            parent = bg_fill.getparent()
            grad = ET.Element(f"{{{NS['a']}}}gradFill")
            gs_lst = ET.SubElement(grad, f"{{{NS['a']}}}gsLst")
            for pos, val in [("0", "0F172A"), ("100000", "1E293B")]:
                gs = ET.SubElement(gs_lst, f"{{{NS['a']}}}gs")
                gs.set("pos", pos)
                ET.SubElement(gs, f"{{{NS['a']}}}srgbClr").set("val", val)
            lin = ET.SubElement(grad, f"{{{NS['a']}}}lin")
            lin.set("ang", "5400000")
            lin.set("scaled", "1")
            parent.remove(bg_fill)
            parent.insert(0, grad)
        zf.writestr(slide_names[0], ET.tostring(root, encoding="utf-8", xml_declaration=True))


def main() -> int:
    if not SOURCE.is_file():
        print("ERROR: исходный файл не найден:")
        print(SOURCE)
        return 1

    print("Анализ исходного слайда...")
    prs = Presentation(str(SOURCE))
    analysis = analyze_presentation(prs)
    ANALYSIS_JSON.parent.mkdir(parents=True, exist_ok=True)
    ANALYSIS_JSON.write_text(json.dumps(analysis, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Анализ сохранён: {ANALYSIS_JSON}")

    print("Модернизация...")
    prs = Presentation(str(SOURCE))
    changes = modernize(prs)
    prs.save(str(OUTPUT))

    try:
        patch_background_gradient(OUTPUT)
        changes.append("Background: navy→slate linear gradient (XML).")
    except Exception as exc:
        changes.append(f"Gradient patch skipped: {exc}")

    print("\nИзменения:")
    for item in changes:
        print(" •", item)
    print(f"\nГотово: {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
