"""One-shot prod dump for RUS-PK-0067 PS/TF fields (run on server under /opt/drc/backend)."""
import json
import os
import re
import sys

BACKEND = os.environ.get("DRC_BACKEND", "/opt/drc/backend")
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from app.db.session import SessionLocal  # noqa: E402
from app.db.competence_models import Competence  # noqa: E402
from app.db.raw_models import StandardRaw  # noqa: E402

PUBLIC_CODE = "RUS-PK-0067"
JSON_COLS = (
    "labor_functions",
    "structure",
    "descriptors",
    "discipline_mapping",
    "ed_technologies",
    "assessment_tools",
    "resources",
    "raw_data",
)

STD_KEY_RE = re.compile(
    r"standard|prof_standard|reg_number|ps_code|raw_standards",
    re.I,
)


def mentions_standards(obj, depth=0):
    if depth > 12:
        return False
    if isinstance(obj, dict):
        for k, v in obj.items():
            if STD_KEY_RE.search(str(k)):
                return True
            if mentions_standards(v, depth + 1):
                return True
    elif isinstance(obj, list):
        return any(mentions_standards(x, depth + 1) for x in obj)
    elif isinstance(obj, str):
        return bool(STD_KEY_RE.search(obj))
    return False


def collect_reg_numbers(labor_functions):
    regs = set()
    if not labor_functions:
        return regs
    for lf in labor_functions:
        if not isinstance(lf, dict):
            continue
        for key in ("standard_reg_number", "reg_number", "prof_standard_reg_number"):
            val = lf.get(key)
            if val is not None and str(val).strip():
                regs.add(str(val).strip())
    return regs


session = SessionLocal()
try:
    comp = (
        session.query(Competence)
        .filter(Competence.public_code == PUBLIC_CODE)
        .first()
    )
    if not comp:
        print(
            json.dumps(
                {"error": "not_found", "public_code": PUBLIC_CODE},
                ensure_ascii=False,
            )
        )
        sys.exit(1)

    raw = comp.raw_data or {}
    formation = raw.get("formation_profile") or {}
    kind = formation.get("competence_kind") or raw.get("competence_kind") or "professional"
    level = comp.qualification_level

    prof_std = None
    if comp.prof_standard_id:
        prof_std = (
            session.query(StandardRaw)
            .filter(StandardRaw.id == comp.prof_standard_id)
            .first()
        )

    labor_functions = comp.labor_functions or []
    reg_numbers = collect_reg_numbers(labor_functions)
    if prof_std and prof_std.reg_number:
        reg_numbers.add(str(prof_std.reg_number).strip())

    standards_raw = {}
    for reg in sorted(reg_numbers, key=lambda x: (len(x), x)):
        row = session.query(StandardRaw).filter(StandardRaw.reg_number == reg).first()
        if row:
            standards_raw[reg] = {
                "exists": True,
                "id": row.id,
                "reg_number": row.reg_number,
                "ps_code": row.ps_code,
                "name": row.name,
                "status": row.status,
            }
        else:
            standards_raw[reg] = {"exists": False, "reg_number": reg}

    json_with_standards = {}
    for col in JSON_COLS:
        val = getattr(comp, col, None)
        if val and mentions_standards(val):
            json_with_standards[col] = val

    tf_with_reg = [
        {
            "code": lf.get("code"),
            "name": lf.get("name"),
            "standard_id": lf.get("standard_id"),
            "standard_reg_number": lf.get("standard_reg_number"),
            "standard_name": lf.get("standard_name"),
        }
        for lf in labor_functions
        if isinstance(lf, dict) and lf.get("standard_reg_number")
    ]
    tf_without_reg = [
        {"code": lf.get("code"), "name": lf.get("name")}
        for lf in labor_functions
        if isinstance(lf, dict) and not lf.get("standard_reg_number")
    ]

    diagnosis = {
        "prof_standard_id_empty": comp.prof_standard_id is None,
        "prof_standard_reg_number": prof_std.reg_number if prof_std else None,
        "labor_functions_count": len(labor_functions),
        "labor_functions_with_standard_reg_number_count": len(tf_with_reg),
        "labor_functions_without_standard_reg_number_count": len(tf_without_reg),
        "summary": "",
    }
    if diagnosis["prof_standard_id_empty"] and tf_with_reg:
        diagnosis["summary"] = (
            "Primary PS link (prof_standard_id) is empty, but labor_functions "
            "contain standard_reg_number on TFs — likely wizard saved TFs without "
            "setting the main PS selection."
        )
    elif diagnosis["prof_standard_id_empty"] and labor_functions:
        diagnosis["summary"] = (
            "prof_standard_id is empty and TFs lack standard_reg_number — "
            "empty PS selection with unattributed labor functions."
        )
    elif not diagnosis["prof_standard_id_empty"] and tf_without_reg:
        diagnosis["summary"] = (
            "prof_standard_id is set, but some TFs have no standard_reg_number "
            "(single-PS or legacy rows)."
        )
    elif not labor_functions:
        diagnosis["summary"] = "No labor_functions stored."
    else:
        diagnosis["summary"] = "PS selection and TF standard_reg_number appear consistent."

    out = {
        "public_code": PUBLIC_CODE,
        "core": {
            "id": comp.id,
            "name": comp.name,
            "public_code": comp.public_code,
            "level": level,
            "kind": kind,
            "qualification_level": comp.qualification_level,
            "competence_kind": kind,
        },
        "ps_row_fields": {
            "prof_standard_id": comp.prof_standard_id,
            "prof_standard_reg_number": prof_std.reg_number if prof_std else None,
            "prof_standard_ps_code": prof_std.ps_code if prof_std else None,
            "prof_standard_name": prof_std.name if prof_std else None,
            "qualification_id": comp.qualification_id,
        },
        "labor_functions": labor_functions,
        "json_columns_mentioning_standards": json_with_standards,
        "standard_raw_by_reg_number": standards_raw,
        "diagnosis": diagnosis,
    }
    print(json.dumps(out, ensure_ascii=False, default=str, indent=2))
finally:
    session.close()
