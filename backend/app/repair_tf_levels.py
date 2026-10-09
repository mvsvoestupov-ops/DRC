"""Fill missing 148н levels and compact dirty OTF/TF codes in the local SQLite DB."""
from __future__ import annotations

import re
from collections import Counter

from sqlalchemy.orm import defer, joinedload, undefer

from .db.raw_models import GeneralizedFunctionRaw, StandardRaw
from .tf_codes import (
    compact_otf_code,
    compact_tf_code,
    parse_tf_code,
    qualification_digit,
    tf_qualification_level,
)


def _norm_name(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").lower()).strip()


def _apply_row(gf, pf, otf_code: str | None, otf_level: str | None, tf_code: str | None, tf_level: str | None) -> None:
    compact = compact_tf_code(tf_code or pf.code)
    if compact and parse_tf_code(compact):
        pf.code = compact
    level = tf_qualification_level(otf_level or gf.level, tf_level or pf.sub_qualification, pf.code)
    if level:
        pf.sub_qualification = level
        if not qualification_digit(gf.level):
            gf.level = level
    letter = compact_otf_code(otf_code or gf.code, pf.code) or compact_otf_code(gf.code)
    if letter and (not gf.code or len((gf.code or "").strip()) != 1):
        gf.code = letter


def _overlay_from_html(std: StandardRaw) -> int:
    html = getattr(std, "source_html", None) or ""
    if not html.strip():
        return 0
    from .classinform_parser import parse_classinform_html

    try:
        parsed = parse_classinform_html(html)
    except Exception:
        return 0
    by_name: dict[str, tuple[str, str, str, str]] = {}
    for gf in parsed.generalized_functions or []:
        for pf in gf.particular_functions or []:
            key = _norm_name(pf.name)
            if key:
                by_name[key] = (gf.code, gf.level, pf.code, pf.sub_qualification)
    updated = 0
    for gf in std.generalized_functions or []:
        for pf in gf.particular_functions or []:
            hit = by_name.get(_norm_name(pf.name))
            if not hit:
                continue
            before = (pf.code, pf.sub_qualification, gf.code, gf.level)
            _apply_row(gf, pf, *hit)
            after = (pf.code, pf.sub_qualification, gf.code, gf.level)
            if before != after:
                updated += 1
    return updated


def repair_tf_levels(session) -> dict:
    standards = (
        session.query(StandardRaw)
        .options(
            defer(StandardRaw.source_xml),
            defer(StandardRaw.source_html),
            joinedload(StandardRaw.generalized_functions).joinedload(
                GeneralizedFunctionRaw.particular_functions
            ),
        )
        .all()
    )

    otf_code_fixed = 0
    otf_level_fixed = 0
    tf_code_fixed = 0
    tf_level_fixed = 0
    html_overlay = 0
    missing_std_ids: set[int] = set()
    still_missing = []

    for std in standards:
        for gf in std.generalized_functions or []:
            child_letters: list[str] = []
            child_levels: list[str] = []
            for pf in gf.particular_functions or []:
                original_code = pf.code or ""
                compact = compact_tf_code(original_code)
                if compact and parse_tf_code(compact) and compact != original_code:
                    pf.code = compact
                    tf_code_fixed += 1
                level = tf_qualification_level(gf.level, pf.sub_qualification, pf.code or original_code)
                if level:
                    child_levels.append(level)
                    if qualification_digit(pf.sub_qualification) != level:
                        pf.sub_qualification = level
                        tf_level_fixed += 1
                parts = parse_tf_code(pf.code)
                if parts:
                    child_letters.append(parts.letter)

            letter = compact_otf_code(gf.code) or (child_letters[0] if child_letters else "")
            if letter and letter != (gf.code or "").strip():
                gf.code = letter
                otf_code_fixed += 1

            gf_level = qualification_digit(gf.level)
            if not gf_level and child_levels:
                gf_level = Counter(child_levels).most_common(1)[0][0]
            if gf_level and qualification_digit(gf.level) != gf_level:
                gf.level = gf_level
                otf_level_fixed += 1

            for pf in gf.particular_functions or []:
                if not tf_qualification_level(gf.level, pf.sub_qualification, pf.code):
                    missing_std_ids.add(std.id)

    if missing_std_ids:
        html_rows = (
            session.query(StandardRaw)
            .options(
                undefer(StandardRaw.source_html),
                defer(StandardRaw.source_xml),
                joinedload(StandardRaw.generalized_functions).joinedload(
                    GeneralizedFunctionRaw.particular_functions
                ),
            )
            .filter(StandardRaw.id.in_(missing_std_ids))
            .all()
        )
        for std in html_rows:
            html_overlay += _overlay_from_html(std)

    still_missing = []
    for std in standards:
        for gf in std.generalized_functions or []:
            for pf in gf.particular_functions or []:
                if not tf_qualification_level(gf.level, pf.sub_qualification, pf.code):
                    still_missing.append(
                        {
                            "ps_code": std.ps_code,
                            "reg_number": std.reg_number,
                            "name": std.name,
                            "tf_code": (pf.code or "")[:80],
                            "otf_code": (gf.code or "")[:40],
                        }
                    )

    session.commit()
    return {
        "standards": len(standards),
        "otf_code_fixed": otf_code_fixed,
        "otf_level_fixed": otf_level_fixed,
        "tf_code_fixed": tf_code_fixed,
        "tf_level_fixed": tf_level_fixed,
        "html_overlay": html_overlay,
        "still_missing_tf": len(still_missing),
        "still_missing_sample": still_missing[:30],
    }
