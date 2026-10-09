"""Count PS/OTF/TF with missing qualification level vs recoverable from TF code."""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

print("audit_tf_levels: start", flush=True)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.orm import defer, joinedload

from app.db import SessionLocal
from app.db.raw_models import GeneralizedFunctionRaw, StandardRaw
from app.tf_codes import compact_otf_code, parse_tf_code, tf_qualification_level


def main() -> None:
    print("audit_tf_levels: opening database", flush=True)
    session = SessionLocal()
    try:
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
        print(f"audit_tf_levels: loaded {len(standards)} standards", flush=True)
        source = Counter((s.source_kind or "unknown") for s in standards)
        empty_otf = 0
        dirty_otf_code = 0
        tf_total = 0
        tf_missing_otf_level = 0
        tf_recoverable = 0
        tf_unrecoverable = 0
        dirty_tf_code = 0
        affected_ps = set()
        unrecoverable_ps = set()

        for std in standards:
            ps_hit = False
            ps_unrec = False
            for gf in std.generalized_functions or []:
                if not tf_qualification_level(gf.level, None, None):
                    empty_otf += 1
                tf_sample = next((item.code for item in (gf.particular_functions or []) if item.code), None)
                expected = compact_otf_code(gf.code, tf_sample)
                if expected and (gf.code or "").strip() != expected:
                    dirty_otf_code += 1
                for pf in gf.particular_functions or []:
                    tf_total += 1
                    code = pf.code or ""
                    parts = parse_tf_code(code)
                    if parts and code.strip() != parts.compact:
                        dirty_tf_code += 1
                    otf_ok = bool(tf_qualification_level(gf.level, pf.sub_qualification, None))
                    if not otf_ok:
                        tf_missing_otf_level += 1
                        ps_hit = True
                        if tf_qualification_level(None, None, code):
                            tf_recoverable += 1
                        else:
                            tf_unrecoverable += 1
                            ps_unrec = True
            if ps_hit:
                affected_ps.add(std.id)
            if ps_unrec:
                unrecoverable_ps.add(f"{std.ps_code or ''}#{std.reg_number} {std.name}")

        print(f"standards_total={len(standards)}", flush=True)
        print("source_kind", dict(source), flush=True)
        print(f"otf_missing_level={empty_otf}", flush=True)
        print(f"otf_dirty_code={dirty_otf_code}", flush=True)
        print(f"tf_total={tf_total}", flush=True)
        print(f"tf_missing_otf_level={tf_missing_otf_level}", flush=True)
        print(f"tf_recoverable_from_code={tf_recoverable}", flush=True)
        print(f"tf_unrecoverable={tf_unrecoverable}", flush=True)
        print(f"tf_dirty_code={dirty_tf_code}", flush=True)
        print(f"ps_with_missing_otf_level={len(affected_ps)}", flush=True)
        print(f"ps_unrecoverable={len(unrecoverable_ps)}", flush=True)
        for row in sorted(unrecoverable_ps)[:30]:
            print("  UNREC", row, flush=True)
        if len(unrecoverable_ps) > 30:
            print(f"  ... {len(unrecoverable_ps) - 30} more", flush=True)
    finally:
        session.close()


if __name__ == "__main__":
    main()
