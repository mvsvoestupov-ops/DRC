"""Re-parse PS from source_html when classinform TF headers omit the trailing dot.

Example broken header: «3.3.6 Трудовая функция» (no period after 6).
Strict parser previously merged/skipped that TF; after PF_HEADER_RE fix we rebuild
only affected rows from stored HTML (no network, limited set → safe on VPS).
"""
from __future__ import annotations

import re

from sqlalchemy.orm import defer, joinedload, undefer

from .classinform_parser import parse_classinform_html
from .db.raw_models import GeneralizedFunctionRaw, StandardRaw
from .db_operations import save_raw_standard
from .tf_codes import compact_tf_code

# Dot after the third number is missing: "3.3.6 Трудовая" not "3.3.6. Трудовая".
_HEADER_MISSING_DOT_RE = re.compile(r"3\.\d+\.\d+ Трудовая функция")


def _tf_codes(std: StandardRaw | object) -> set[str]:
    codes: set[str] = set()
    for gf in getattr(std, "generalized_functions", None) or []:
        for pf in getattr(gf, "particular_functions", None) or []:
            compact = compact_tf_code(getattr(pf, "code", None))
            if compact:
                codes.add(compact)
    return codes


def repair_missing_tf_from_html(session, limit: int | None = None) -> dict:
    """Rebuild standards whose source_html has TF headers without a trailing dot."""
    candidates = (
        session.query(StandardRaw)
        .options(
            defer(StandardRaw.source_xml),
            undefer(StandardRaw.source_html),
            joinedload(StandardRaw.generalized_functions).joinedload(
                GeneralizedFunctionRaw.particular_functions
            ),
        )
        .filter(StandardRaw.source_html.isnot(None))
        .filter(StandardRaw.source_html != "")
        .all()
    )

    scanned = 0
    matched_header = 0
    rebuilt = 0
    unchanged = 0
    errors: list[dict] = []
    samples: list[dict] = []

    for std in candidates:
        html = std.source_html or ""
        if not _HEADER_MISSING_DOT_RE.search(html):
            continue
        matched_header += 1
        if limit is not None and rebuilt >= limit:
            break
        scanned += 1
        old_codes = _tf_codes(std)
        try:
            parsed = parse_classinform_html(html)
        except Exception as exc:  # noqa: BLE001 — keep going on bad HTML
            errors.append(
                {
                    "reg_number": std.reg_number,
                    "ps_code": std.ps_code,
                    "error": str(exc)[:200],
                }
            )
            continue

        # Keep registration number aligned with DB row (HTML meta can drift).
        if std.reg_number and not parsed.registration_number:
            parsed.registration_number = std.reg_number
        elif std.reg_number:
            parsed.registration_number = std.reg_number

        new_codes = _tf_codes(parsed)
        if new_codes == old_codes:
            unchanged += 1
            continue

        save_raw_standard(session, parsed, element_id=std.element_id)
        rebuilt += 1
        sample = {
            "reg_number": std.reg_number,
            "ps_code": std.ps_code,
            "added": sorted(new_codes - old_codes),
            "removed": sorted(old_codes - new_codes),
            "tf_before": len(old_codes),
            "tf_after": len(new_codes),
        }
        if len(samples) < 20:
            samples.append(sample)

    return {
        "candidates_with_html": len(candidates),
        "matched_missing_dot_header": matched_header,
        "scanned": scanned,
        "rebuilt": rebuilt,
        "unchanged": unchanged,
        "errors": errors[:20],
        "samples": samples,
    }
