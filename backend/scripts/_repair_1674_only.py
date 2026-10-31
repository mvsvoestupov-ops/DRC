"""One-off: rebuild PS 1674 from source_html (missing TF header dot)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy.orm import joinedload, undefer  # noqa: E402

from app.classinform_parser import parse_classinform_html  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.db.raw_models import GeneralizedFunctionRaw, StandardRaw  # noqa: E402
from app.db_operations import save_raw_standard  # noqa: E402
from app.repair_missing_tf_from_html import _tf_codes  # noqa: E402

OUT = ROOT / "scripts" / "output" / "_repair_missing_tf_result.json"


def main() -> int:
    session = SessionLocal()
    try:
        std = (
            session.query(StandardRaw)
            .options(
                undefer(StandardRaw.source_html),
                joinedload(StandardRaw.generalized_functions).joinedload(
                    GeneralizedFunctionRaw.particular_functions
                ),
            )
            .filter(StandardRaw.reg_number == "1674")
            .one()
        )
        html = std.source_html or ""
        old_codes = _tf_codes(std)
        parsed = parse_classinform_html(html)
        if std.reg_number:
            parsed.registration_number = std.reg_number
        new_codes = _tf_codes(parsed)
        sample = {
            "reg_number": std.reg_number,
            "ps_code": std.ps_code,
            "added": sorted(new_codes - old_codes),
            "removed": sorted(old_codes - new_codes),
            "tf_before": len(old_codes),
            "tf_after": len(new_codes),
        }
        rebuilt = 0
        if new_codes != old_codes:
            save_raw_standard(session, parsed, element_id=std.element_id)
            session.commit()
            rebuilt = 1
        result = {
            "mode": "single_reg_1674",
            "rebuilt": rebuilt,
            "unchanged": 0 if rebuilt else 1,
            "samples": [sample],
            "errors": [],
        }
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
