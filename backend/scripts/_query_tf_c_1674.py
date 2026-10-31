"""One-off: list TF codes under OTF C for reg_number 1674."""
import json
import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "profstandart.db")
OUT = os.path.join(ROOT, "scripts", "output", "_query_tf_c_1674.json")


def main() -> int:
    if not os.path.isfile(DB):
        print("DB missing:", DB, file=sys.stderr)
        return 1
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    std = con.execute(
        "SELECT id, reg_number, ps_code, name FROM raw_standards WHERE reg_number = ?",
        ("1674",),
    ).fetchone()
    if not std:
        print("Standard 1674 not found", file=sys.stderr)
        return 1
    gfs = con.execute(
        """
        SELECT id, code, name, level FROM raw_generalized_functions
        WHERE standard_id = ? ORDER BY id
        """,
        (std["id"],),
    ).fetchall()
    otf_c = None
    for gf in gfs:
        code = (gf["code"] or "").strip()
        if code == "C" or code.startswith("C/") or code.startswith("C "):
            otf_c = gf
            break
        if code.upper() == "C":
            otf_c = gf
            break
    if otf_c is None:
        for gf in gfs:
            if (gf["code"] or "").strip().upper().startswith("C"):
                otf_c = gf
                break
    if otf_c is None:
        payload = {
            "source": DB,
            "standard": dict(std),
            "error": "OTF C not found",
            "otf_codes": [(g["code"], g["name"]) for g in gfs],
        }
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    pfs = con.execute(
        """
        SELECT code, name FROM raw_particular_functions
        WHERE generalized_id = ? ORDER BY id
        """,
        (otf_c["id"],),
    ).fetchall()
    tf_codes = [(r["code"], r["name"]) for r in pfs]
    has_056 = any(
        (c or "").replace(" ", "") in ("C/05.6", "C/05.6", "05.6")
        or (c or "").strip().endswith("05.6")
        for c, _ in tf_codes
    )
    name_056 = next(
        (n for c, n in tf_codes if "05.6" in (c or "").replace(" ", "")),
        None,
    )
    # Also check source_xml/html for C/05.6
    src = con.execute(
        "SELECT source_xml, source_html FROM raw_standards WHERE id = ?",
        (std["id"],),
    ).fetchone()
    xml_has = "C/05.6" in (src["source_xml"] or "") or "C/05.6" in (src["source_html"] or "")
    payload = {
        "source": DB,
        "standard": dict(std),
        "otf_c": {"code": otf_c["code"], "name": otf_c["name"], "level": otf_c["level"]},
        "tf_codes_ordered": [{"code": c, "name": n} for c, n in tf_codes],
        "C/05.6_present_in_db": has_056,
        "C/05.6_name": name_056,
        "C/05.6_in_source_xml_or_html": xml_has,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
