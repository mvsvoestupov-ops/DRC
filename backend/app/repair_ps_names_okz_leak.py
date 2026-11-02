"""Fix PS names overwritten by ОКЗ occupation titles (parser variable shadowing).

Root cause: in classinform_parser._extract_metadata the OKZ cell loop used a local
variable ``name``, which in Python overwrote the professional standard title.
Example: reg 1674 became «Квалифицированные рабочие промышленности…» (ОКЗ 7549)
instead of «Работник авиатопливообеспечения».
"""
from __future__ import annotations

import re

from sqlalchemy.orm import defer, undefer

from .classinform_parser import (
    _name_from_index,
    _name_from_ps_block,
    _page_lines,
    looks_like_okz_occupation_name,
    pick_professional_standard_name,
)
from .db.raw_models import StandardRaw


def _candidate_name_from_html(html: str, ps_code: str | None) -> str:
    if not (html or "").strip():
        return _name_from_index(ps_code or "")
    lines = _page_lines(html)
    full_text = "\n".join(lines)
    block_name, _ = _name_from_ps_block(full_text)
    index_name = _name_from_index(ps_code or "")
    # Do not trust raw h2 here — may be missing in stored fragments.
    return pick_professional_standard_name(block_name, index_name)


def repair_ps_names_okz_leak(session, reg_numbers: list[str] | None = None) -> dict:
    q = session.query(StandardRaw).options(
        defer(StandardRaw.source_xml),
        undefer(StandardRaw.source_html),
    )
    if reg_numbers:
        q = q.filter(StandardRaw.reg_number.in_(reg_numbers))
    rows = q.order_by(StandardRaw.reg_number).all()

    scanned = 0
    suspicious = 0
    fixed = 0
    skipped = 0
    samples: list[dict] = []
    errors: list[dict] = []

    for std in rows:
        scanned += 1
        old_name = (std.name or "").strip()
        if not looks_like_okz_occupation_name(old_name):
            # Still allow forced regs (e.g. 1674 already partially fixed).
            if not reg_numbers:
                continue
        else:
            suspicious += 1

        try:
            new_name = _candidate_name_from_html(std.source_html or "", std.ps_code)
            if not new_name:
                new_name = _name_from_index(std.ps_code or "")
            new_name = re.sub(r"\s+", " ", (new_name or "").strip())
            if not new_name or looks_like_okz_occupation_name(new_name):
                skipped += 1
                errors.append(
                    {
                        "reg_number": std.reg_number,
                        "ps_code": std.ps_code,
                        "old_name": old_name[:120],
                        "error": "no reliable replacement name",
                    }
                )
                continue
            if new_name == old_name:
                skipped += 1
                continue
            std.name = new_name
            fixed += 1
            if len(samples) < 40:
                samples.append(
                    {
                        "reg_number": std.reg_number,
                        "ps_code": std.ps_code,
                        "old_name": old_name,
                        "new_name": new_name,
                    }
                )
        except Exception as exc:  # noqa: BLE001
            errors.append(
                {
                    "reg_number": std.reg_number,
                    "ps_code": std.ps_code,
                    "error": str(exc)[:200],
                }
            )

    session.commit()
    return {
        "scanned": scanned,
        "suspicious_okz_like": suspicious,
        "fixed": fixed,
        "skipped": skipped,
        "samples": samples,
        "errors": errors[:30],
    }
