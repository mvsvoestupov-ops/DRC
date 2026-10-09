"""Fill empty OTF OKSO fields from stored source_html / source_xml."""
from __future__ import annotations

import re

from sqlalchemy.orm import defer, joinedload, undefer

from .db.raw_models import GeneralizedFunctionRaw, StandardRaw
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


def _chunks(ids: list[int], size: int = 400):
    for i in range(0, len(ids), size):
        yield ids[i : i + size]


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
    standards = (
        session.query(StandardRaw)
        .options(
            defer(StandardRaw.source_xml),
            defer(StandardRaw.source_html),
            joinedload(StandardRaw.generalized_functions),
        )
        .all()
    )
    need_ids = [
        std.id
        for std in standards
        if any(not _gf_has_okso(gf) for gf in (std.generalized_functions or []))
    ]
    html_updated = 0
    xml_updated = 0
    filled_ids: set[int] = set()
    if need_ids:
        from .classinform_parser import parse_classinform_html

        for chunk in _chunks(need_ids):
            html_rows = (
                session.query(StandardRaw)
                .options(
                    undefer(StandardRaw.source_html),
                    defer(StandardRaw.source_xml),
                    joinedload(StandardRaw.generalized_functions),
                )
                .filter(StandardRaw.id.in_(chunk))
                .all()
            )
            for std in html_rows:
                html = getattr(std, "source_html", None) or ""
                if not html.strip():
                    continue
                try:
                    parsed = parse_classinform_html(html)
                except Exception:
                    continue
                count = _overlay_parsed(std, parsed.generalized_functions)
                html_updated += count
                if count:
                    filled_ids.add(std.id)

        still_need = [sid for sid in need_ids if sid not in filled_ids]
        for chunk in _chunks(still_need):
            xml_rows = (
                session.query(StandardRaw)
                .options(
                    undefer(StandardRaw.source_xml),
                    defer(StandardRaw.source_html),
                    joinedload(StandardRaw.generalized_functions),
                )
                .filter(StandardRaw.id.in_(chunk))
                .all()
            )
            for std in xml_rows:
                xml = getattr(std, "source_xml", None) or ""
                if not xml.strip():
                    continue
                try:
                    payload = xml.encode("utf-8") if isinstance(xml, str) else xml
                    parsed = parse_xml(payload)
                except Exception:
                    continue
                xml_updated += _overlay_parsed(std, parsed.generalized_functions)

    session.commit()
    still_empty = 0
    for std in standards:
        for gf in std.generalized_functions or []:
            if not _gf_has_okso(gf):
                still_empty += 1
    return {
        "standards": len(standards),
        "needed": len(need_ids),
        "html_updated": html_updated,
        "xml_updated": xml_updated,
        "still_empty_otf": still_empty,
    }
