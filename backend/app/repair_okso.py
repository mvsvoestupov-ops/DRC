"""Fill empty OTF OKSO fields from stored source_html / source_xml.

Process one standard at a time so a small VPS is not OOM-killed.
"""
from __future__ import annotations

import gc
import re

from sqlalchemy.orm import defer, joinedload, undefer

from .db.raw_models import StandardRaw
from .db_operations import _codes_from_units, _units_to_json
from .parser import extract_okso_codes_from_text, parse_xml


def _norm_name(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").lower()).strip()


def _gf_has_okso(gf) -> bool:
    for raw in (getattr(gf, "okso_codes", None), getattr(gf, "okso_units", None)):
        if extract_okso_codes_from_text(str(raw or "")):
            return True
        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, dict) and extract_okso_codes_from_text(str(item.get("code") or "")):
                    return True
                if isinstance(item, str) and extract_okso_codes_from_text(item):
                    return True
    return False


def _apply_okso(gf, units, codes) -> bool:
    payload = _units_to_json(units)
    code_list = _codes_from_units(units, codes)
    if not payload and not code_list:
        return False
    if _gf_has_okso(gf) and gf.okso_units and gf.okso_codes:
        return False
    gf.okso_units = payload
    gf.okso_codes = code_list
    return True


def _parsed_by_key(generalized_functions) -> dict[str, object]:
    mapped: dict[str, object] = {}
    for gf in generalized_functions or []:
        name = _norm_name(getattr(gf, "name", None))
        letter = (getattr(gf, "code", None) or "").strip().upper()
        if name:
            mapped[f"name:{name}"] = gf
        if letter:
            mapped[f"letter:{letter}"] = gf
    return mapped


def _overlay_parsed(std: StandardRaw, parsed_gfs) -> int:
    mapped = _parsed_by_key(parsed_gfs)
    updated = 0
    for gf in std.generalized_functions or []:
        src = mapped.get(f"name:{_norm_name(gf.name)}") or mapped.get(
            f"letter:{(gf.code or '').strip().upper()}"
        )
        if not src:
            continue
        if _apply_okso(gf, getattr(src, "okso_units", None), getattr(src, "okso_codes", None)):
            updated += 1
    return updated


def repair_okso_units(session) -> dict:
    ids = [row[0] for row in session.query(StandardRaw.id).order_by(StandardRaw.id).all()]
    session.expunge_all()

    html_updated = 0
    xml_updated = 0
    needed = 0
    parse_html = None

    for index, sid in enumerate(ids, 1):
        std = (
            session.query(StandardRaw)
            .options(
                defer(StandardRaw.source_xml),
                defer(StandardRaw.source_html),
                joinedload(StandardRaw.generalized_functions),
            )
            .filter(StandardRaw.id == sid)
            .first()
        )
        if not std or all(_gf_has_okso(gf) for gf in (std.generalized_functions or [])):
            session.expunge_all()
            continue
        needed += 1
        updated = 0

        html = (
            session.query(StandardRaw.source_html)
            .filter(StandardRaw.id == sid)
            .scalar()
        )
        if html and str(html).strip():
            if parse_html is None:
                from .classinform_parser import parse_classinform_html

                parse_html = parse_classinform_html
            try:
                parsed = parse_html(html)
                updated = _overlay_parsed(std, parsed.generalized_functions)
                html_updated += updated
            except Exception:
                updated = 0
            del html

        if not updated:
            xml = (
                session.query(StandardRaw.source_xml)
                .filter(StandardRaw.id == sid)
                .scalar()
            )
            if xml and str(xml).strip():
                try:
                    payload = xml.encode("utf-8") if isinstance(xml, str) else xml
                    parsed = parse_xml(payload)
                    xml_updated += _overlay_parsed(std, parsed.generalized_functions)
                except Exception:
                    pass
                del xml

        session.commit()
        session.expunge_all()
        if index % 25 == 0:
            print(f"repair_okso: {index}/{len(ids)} needed={needed} html={html_updated} xml={xml_updated}", flush=True)
            gc.collect()

    return {
        "standards": len(ids),
        "needed": needed,
        "html_updated": html_updated,
        "xml_updated": xml_updated,
    }
