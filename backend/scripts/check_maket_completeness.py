"""
Сверка заполненности полей макета ПС (P0/P1).

  venv\\Scripts\\python.exe scripts\\check_maket_completeness.py
"""
from __future__ import annotations

import json
import os
import sys
from collections import Counter

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.db import SessionLocal
from app.db.raw_models import StandardRaw
from app.db.schema import ensure_maket_columns, ensure_ps_status_columns

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


def gaps_for(std: StandardRaw) -> list[str]:
    gaps = []
    if not getattr(std, "ps_code", None):
        gaps.append("ps_code")
    if not getattr(std, "developer_org", None):
        gaps.append("developer_org")
    if not any(getattr(gf, "education_training", None) for gf in std.generalized_functions):
        gaps.append("education_training")
    if not any(getattr(gf, "special_admission", None) for gf in std.generalized_functions):
        gaps.append("special_admission")
    if not getattr(std, "abbreviations", None):
        gaps.append("abbreviations")
    if not getattr(std, "source_html", None) and not getattr(std, "source_xml", None):
        gaps.append("source")
    if not getattr(std, "okved_units", None) and not std.okved_codes:
        gaps.append("okved")
    return gaps


def main() -> int:
    for col in ensure_ps_status_columns() + ensure_maket_columns():
        print(f"migration: {col}")
    session = SessionLocal()
    try:
        standards = session.query(StandardRaw).all()
        active = [s for s in standards if (getattr(s, "status", None) or "active") == "active"]
        gap_counter = Counter()
        p0_ok = 0
        samples_missing = []
        for std in active:
            gaps = gaps_for(std)
            gap_counter.update(gaps)
            if not any(g in gaps for g in ("ps_code", "developer_org", "education_training")):
                p0_ok += 1
            elif len(samples_missing) < 30:
                samples_missing.append({"reg": std.reg_number, "gaps": gaps, "name": (std.name or "")[:80]})

        report = {
            "total": len(standards),
            "active": len(active),
            "p0_ok": p0_ok,
            "p0_ok_pct": round(100.0 * p0_ok / len(active), 2) if active else 0,
            "gap_counts": dict(gap_counter),
            "samples_missing_p0": samples_missing,
        }
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        path = os.path.join(OUTPUT_DIR, "ps_maket_completeness.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print(f"Wrote {path}")
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
