"""One-off verification after fix_okz_all — not part of production."""
from __future__ import annotations

import os
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload

from app.classinform_parser import parse_classinform_html
from app.db.raw_models import GeneralizedFunctionRaw, StandardRaw
from app.db.session import SessionLocal
from app.db_operations import _codes_from_units
from app.okz_repair import _gf_key, _has_okz_codes, standard_needs_okz_repair

CHECKS = [
    ("12.013", "1492"),
    ("16.124", "996"),
    ("40.175", "997"),
    ("03.012", "988"),
]


def norm_codes(value) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(c).strip() for c in value if str(c or "").strip()]
    s = str(value).strip()
    return [s] if s else []


def main() -> int:
    session = SessionLocal()
    try:
        print("=== SPOT STANDARDS ===")
        for ps, reg in CHECKS:
            std = (
                session.query(StandardRaw)
                .options(joinedload(StandardRaw.generalized_functions))
                .filter(StandardRaw.ps_code == ps, StandardRaw.reg_number == reg)
                .first()
            )
            if not std:
                std = (
                    session.query(StandardRaw)
                    .options(joinedload(StandardRaw.generalized_functions))
                    .filter(
                        (StandardRaw.ps_code == ps) | (StandardRaw.reg_number == reg)
                    )
                    .first()
                )
            if not std:
                print(f"{ps} reg={reg}: NOT FOUND")
                continue
            print(f"\n{std.ps_code} reg={std.reg_number} id={std.id}")
            print(f"  okz_group_code: {std.okz_group_code!r}")
            print(f"  has source_html: {bool((std.source_html or '').strip())}")
            print(f"  needs_repair: {standard_needs_okz_repair(std)}")
            for gf in sorted(std.generalized_functions or [], key=lambda g: g.code or ""):
                print(f"  OTF {(gf.code or '?')[:28]}: okz_codes={norm_codes(gf.okz_codes)}")

        print("\n=== SANITY STATS ===")
        empty_group = (
            session.query(StandardRaw)
            .filter(
                or_(
                    StandardRaw.okz_group_code.is_(None),
                    func.trim(StandardRaw.okz_group_code) == "",
                )
            )
            .count()
        )
        print(f"standards empty okz_group_code: {empty_group}")

        all_gfs = session.query(GeneralizedFunctionRaw).all()
        otf_empty = sum(1 for gf in all_gfs if not _has_okz_codes(gf.okz_codes))
        print(f"OTFs null/empty okz_codes: {otf_empty} / {len(all_gfs)}")

        all_std = (
            session.query(StandardRaw)
            .options(joinedload(StandardRaw.generalized_functions))
            .all()
        )
        need = [s for s in all_std if standard_needs_okz_repair(s)]
        need_with_src = [
            s
            for s in need
            if (s.source_html or "").strip() or (s.source_xml or "").strip()
        ]
        need_no_src = [
            s
            for s in need
            if not ((s.source_html or "").strip() or (s.source_xml or "").strip())
        ]
        print(f"still need repair (total): {len(need)}")
        print(f"  with source_html/xml: {len(need_with_src)}")
        print(f"  no_source: {len(need_no_src)}")
        print(
            f"fully OK (no repair needed): "
            f"{sum(1 for s in all_std if not standard_needs_okz_repair(s))} / {len(all_std)}"
        )

        print("\n=== RE-PARSE SPOT CHECK ===")
        for ps in ("12.013", "16.124"):
            std = (
                session.query(StandardRaw)
                .options(joinedload(StandardRaw.generalized_functions))
                .filter(StandardRaw.ps_code == ps)
                .first()
            )
            if not std:
                print(f"{ps}: standard not found")
                continue
            html = (std.source_html or "").strip()
            if not html:
                print(f"{ps}: no source_html")
                continue
            parsed = parse_classinform_html(html)
            parsed_by = {_gf_key(gf.code): gf for gf in (parsed.generalized_functions or [])}
            mismatches = []
            for gf in std.generalized_functions or []:
                pgf = parsed_by.get(_gf_key(gf.code))
                db_c = sorted(norm_codes(gf.okz_codes))
                if pgf:
                    parsed_c = sorted(
                        norm_codes(_codes_from_units(pgf.okz_units, pgf.okz_codes))
                    )
                else:
                    parsed_c = None
                if parsed_c != db_c:
                    mismatches.append((gf.code, db_c, parsed_c))
            if mismatches:
                print(f"{ps}: MISMATCH {len(mismatches)} OTFs")
                for code, db_c, parsed_c in mismatches[:15]:
                    print(f"  {code}: db={db_c} parsed={parsed_c}")
            else:
                n = len(std.generalized_functions or [])
                print(f"{ps}: all {n} OTF okz_codes match parsed source")

        std = (
            session.query(StandardRaw)
            .options(joinedload(StandardRaw.generalized_functions))
            .filter(StandardRaw.ps_code == "03.012")
            .first()
        )
        if std:
            print("\n=== 03.012 detail ===")
            print(f"  okz_group_code: {std.okz_group_code!r}")
            for gf in std.generalized_functions or []:
                print(f"  OTF {gf.code}: okz={norm_codes(gf.okz_codes)}")
    finally:
        session.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
