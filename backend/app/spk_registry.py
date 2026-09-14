"""СПК (советы по профессиональным квалификациям), закреплённые за профстандартами."""
from __future__ import annotations

import os
import re
from pathlib import Path

from sqlalchemy.orm import Session

from .db.raw_models import StandardRaw

SPK_UNASSIGNED = "Не закреплен за СПК"

# Резервный СПК при отсутствии профильного (48-я позиция в реестре).
SPK_VNIIT = 'ФГБУ «Всероссийский научно-исследовательский институт труда»'

PS_CODE_RE = re.compile(r"^\d{2}\.\d{3}$")
REG_NUMBER_RE = re.compile(r"^\d+$")

DEFAULT_REESTR_XLSX = Path(__file__).resolve().parent.parent.parent / "Reestr_PS.xlsx"

REG_COL = 1
PS_CODE_COL = 2
SPK_COL = 18


def normalize_reg(reg) -> str:
    if reg is None:
        return ""
    text = str(reg).strip()
    if re.fullmatch(r"\d+\.0", text):
        text = text[:-2]
    return text


def is_valid_reg_number(reg: str) -> bool:
    if not reg or not REG_NUMBER_RE.match(reg):
        return False
    return 1 <= int(reg) <= 9999


def normalize_spk_name(value: str | None) -> str:
    text = re.sub(r"\s+", " ", (value or "").strip())
    if not text or text.isdigit():
        return SPK_UNASSIGNED
    # В реестре встречаются «совет по…» и «Совет по…» — одна организация.
    if re.match(r"(?i)^совет\b", text):
        rest = re.sub(r"(?i)^совет\s*", "", text, count=1)
        return f"Совет {rest}" if rest else "Совет"
    return text


def reconcile_spk_names_in_db(session: Session, *, commit: bool = True) -> int:
    """Приводит spk_name в БД к каноническому виду (регистр и пробелы)."""
    updated = 0
    for std in session.query(StandardRaw).filter(StandardRaw.spk_name.isnot(None)).all():
        normalized = normalize_spk_name(std.spk_name)
        if normalized != std.spk_name:
            std.spk_name = normalized
            updated += 1
    if commit and updated:
        session.commit()
    return updated


def _find_header_row(rows: list[list[str]]) -> int:
    for index, row in enumerate(rows[:10]):
        joined = " ".join(str(c or "") for c in row).lower()
        if "регистрацион" in joined and "код проф" in joined:
            return index
    return 1


def parse_reestr_ps_xlsx(path: str | Path) -> list[dict[str, str]]:
    import sys

    backend_dir = Path(__file__).resolve().parent.parent
    scripts_dir = backend_dir / "scripts"
    for entry in (str(backend_dir), str(scripts_dir)):
        if entry not in sys.path:
            sys.path.insert(0, entry)

    from compare_ps_with_xlsx import load_xlsx_openpyxl, load_xlsx_stdlib

    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Файл не найден: {path}")

    try:
        rows = load_xlsx_openpyxl(str(path))
    except ImportError:
        rows = load_xlsx_stdlib(str(path))

    header_idx = _find_header_row(rows)
    items: list[dict[str, str]] = []
    seen_regs: set[str] = set()

    for row in rows[header_idx + 1 :]:
        if not row or not any(row):
            continue
        reg = normalize_reg(row[REG_COL] if len(row) > REG_COL else "")
        ps_code = str(row[PS_CODE_COL] or "").strip() if len(row) > PS_CODE_COL else ""
        if not is_valid_reg_number(reg) or not PS_CODE_RE.match(ps_code):
            continue
        if reg in seen_regs:
            continue
        seen_regs.add(reg)
        spk_raw = str(row[SPK_COL] or "").strip() if len(row) > SPK_COL else ""
        items.append(
            {
                "reg_number": reg,
                "ps_code": ps_code,
                "spk_name": normalize_spk_name(spk_raw),
            }
        )
    return items


def sync_spk_from_reestr_xlsx(
    session: Session,
    path: str | Path | None = None,
    *,
    commit: bool = True,
) -> dict:
    xlsx_path = Path(path) if path else DEFAULT_REESTR_XLSX
    if not xlsx_path.is_file():
        alt = Path(__file__).resolve().parent.parent / "Reestr_PS.xlsx"
        if alt.is_file():
            xlsx_path = alt
        else:
            raise FileNotFoundError(f"Reestr XLSX not found: {xlsx_path}")

    items = parse_reestr_ps_xlsx(xlsx_path)
    updated = 0
    unchanged = 0
    missing_in_db: list[str] = []

    for item in items:
        std = session.query(StandardRaw).filter(StandardRaw.reg_number == item["reg_number"]).first()
        if not std:
            missing_in_db.append(item["reg_number"])
            continue
        if (std.spk_name or None) != item["spk_name"]:
            std.spk_name = item["spk_name"]
            updated += 1
        else:
            unchanged += 1

    reconcile_spk_names_in_db(session, commit=False)

    if commit:
        session.commit()

    spk_counts: dict[str, int] = {}
    for item in items:
        spk_counts[item["spk_name"]] = spk_counts.get(item["spk_name"], 0) + 1

    return {
        "xlsx_path": str(xlsx_path),
        "xlsx_rows": len(items),
        "updated": updated,
        "unchanged": unchanged,
        "missing_in_db": missing_in_db,
        "unique_spk_in_xlsx": len(spk_counts),
        "spk_counts": dict(sorted(spk_counts.items(), key=lambda x: (-x[1], x[0]))),
    }


def list_spk_names(session: Session) -> list[dict[str, str | int]]:
    rows = (
        session.query(StandardRaw.spk_name)
        .filter(StandardRaw.spk_name.isnot(None))
        .all()
    )
    groups: dict[str, dict[str, int | str]] = {}
    for (name,) in rows:
        if not name:
            continue
        canonical = normalize_spk_name(name)
        key = canonical.casefold()
        if key not in groups:
            groups[key] = {"name": canonical, "count": 0}
        groups[key]["count"] = int(groups[key]["count"]) + 1
    return sorted(
        ({"name": str(item["name"]), "count": int(item["count"])} for item in groups.values()),
        key=lambda row: row["name"].casefold(),
    )


def resolve_reestr_xlsx_path() -> str | None:
    candidates = [
        os.environ.get("REESTR_PS_XLSX"),
        str(DEFAULT_REESTR_XLSX),
        str(Path(__file__).resolve().parent.parent / "Reestr_PS.xlsx"),
    ]
    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            return candidate
    return None
