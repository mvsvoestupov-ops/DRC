"""Заполнение ОКЗ у ПС/ОТФ из сохранённых source_html / source_xml (без выдуманных кодов)."""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session, joinedload

from .classinform_parser import parse_classinform_html
from .db.raw_models import StandardRaw
from .db_operations import _codes_from_units, _units_to_json
from .models import ProfessionalStandard
from .tf_codes import compact_otf_code


def _gf_key(code: str | None) -> str:
    return compact_otf_code(code) or (code or "").strip()


def _has_okz_codes(value: Any) -> bool:
    if not value:
        return False
    if isinstance(value, list):
        return any(str(c or "").strip() for c in value)
    return bool(str(value).strip())


def standard_needs_okz_repair(std: StandardRaw) -> bool:
    if not (std.okz_group_code or "").strip():
        return True
    for gf in std.generalized_functions or []:
        if not _has_okz_codes(getattr(gf, "okz_codes", None)):
            return True
    return False


def apply_okz_from_parsed(
    std: StandardRaw,
    parsed: ProfessionalStandard,
    *,
    only_missing: bool = True,
) -> dict[str, Any]:
    """Проставить okz_group_* и okz_* ОТФ из уже распарсенной модели.

    Не подставляет группу занятий вместо справочных кодов ОТФ.
    При only_missing=True не затирает уже заполненные поля пустыми значениями.
    """
    stats: dict[str, Any] = {
        "group_updated": False,
        "otf_touched": 0,
        "otf_filled": 0,
        "otf_skipped_filled": 0,
        "otf_no_source": 0,
    }

    parsed_group = (parsed.okz_group_code or "").strip()
    if parsed_group and (not only_missing or not (std.okz_group_code or "").strip()):
        std.okz_group_code = parsed.okz_group_code
        std.okz_group_name = parsed.okz_group_name
        stats["group_updated"] = True

    by_code = {_gf_key(gf.code): gf for gf in (parsed.generalized_functions or [])}

    for gf_raw in std.generalized_functions or []:
        already = _has_okz_codes(getattr(gf_raw, "okz_codes", None))
        if only_missing and already:
            stats["otf_skipped_filled"] += 1
            continue

        pgf = by_code.get(_gf_key(gf_raw.code))
        if not pgf:
            stats["otf_no_source"] += 1
            continue

        new_codes = _codes_from_units(pgf.okz_units, pgf.okz_codes)
        new_units = _units_to_json(pgf.okz_units)
        if only_missing and not new_codes:
            stats["otf_no_source"] += 1
            continue

        gf_raw.okz_units = new_units
        gf_raw.okz_codes = new_codes
        stats["otf_touched"] += 1
        if new_codes:
            stats["otf_filled"] += 1

    return stats


def apply_parsed_okz(std: StandardRaw, html: str, *, only_missing: bool = True) -> bool:
    """Совместимость: обновить ОКЗ из HTML. True, если что-то изменили."""
    parsed = parse_classinform_html(html)
    stats = apply_okz_from_parsed(std, parsed, only_missing=only_missing)
    return bool(stats["group_updated"] or stats["otf_touched"])


def apply_okz_from_xml(std: StandardRaw, xml_text: str, *, only_missing: bool = True) -> bool:
    from .parser import parse_xml

    raw = xml_text.encode("utf-8") if isinstance(xml_text, str) else xml_text
    parsed = parse_xml(raw)
    stats = apply_okz_from_parsed(std, parsed, only_missing=only_missing)
    return bool(stats["group_updated"] or stats["otf_touched"])


def repair_standard_okz(
    std: StandardRaw,
    *,
    only_missing: bool = True,
) -> dict[str, Any]:
    """Заполнить ОКЗ для одного ПС из source_html, иначе из source_xml."""
    result: dict[str, Any] = {
        "id": std.id,
        "reg_number": std.reg_number,
        "ps_code": getattr(std, "ps_code", None),
        "name": std.name,
        "source": None,
        "changed": False,
        "error": None,
        "stats": None,
    }
    if only_missing and not standard_needs_okz_repair(std):
        result["source"] = "skip-already-filled"
        return result

    html = (getattr(std, "source_html", None) or "").strip()
    xml = (getattr(std, "source_xml", None) or "").strip()

    try:
        if html:
            parsed = parse_classinform_html(html)
            stats = apply_okz_from_parsed(std, parsed, only_missing=only_missing)
            result["source"] = "source_html"
            result["stats"] = stats
            result["changed"] = bool(stats["group_updated"] or stats["otf_touched"])
            return result
        if xml:
            from .parser import parse_xml

            parsed = parse_xml(xml.encode("utf-8"))
            stats = apply_okz_from_parsed(std, parsed, only_missing=only_missing)
            result["source"] = "source_xml"
            result["stats"] = stats
            result["changed"] = bool(stats["group_updated"] or stats["otf_touched"])
            return result
        result["source"] = "no-source"
        result["error"] = "нет source_html и source_xml"
    except Exception as exc:
        result["error"] = str(exc)[:500]
    return result


def repair_all_okz(
    session: Session,
    *,
    only_missing: bool = True,
    force: bool = False,
    limit: int | None = None,
    ps_code: str | None = None,
    reg_number: str | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Пройти по ПС в БД и заполнить ОКЗ из сохранённых источников."""
    only_missing = only_missing and not force
    q = session.query(StandardRaw).options(joinedload(StandardRaw.generalized_functions))
    if ps_code:
        q = q.filter(StandardRaw.ps_code == ps_code.strip())
    if reg_number:
        q = q.filter(StandardRaw.reg_number == str(reg_number).strip())
    q = q.order_by(StandardRaw.id)

    rows = q.all()
    if limit is not None and limit > 0:
        rows = rows[:limit]

    summary: dict[str, Any] = {
        "total": len(rows),
        "examined": 0,
        "changed": 0,
        "skipped_filled": 0,
        "no_source": 0,
        "errors": 0,
        "otf_filled": 0,
        "items": [],
    }

    for std in rows:
        summary["examined"] += 1
        if only_missing and not standard_needs_okz_repair(std):
            summary["skipped_filled"] += 1
            continue

        info = repair_standard_okz(std, only_missing=only_missing)
        if info.get("source") == "no-source":
            summary["no_source"] += 1
        if info.get("error"):
            summary["errors"] += 1
            summary["items"].append(info)
            continue
        if info.get("changed"):
            summary["changed"] += 1
            stats = info.get("stats") or {}
            summary["otf_filled"] += int(stats.get("otf_filled") or 0)
            summary["items"].append(info)
        elif info.get("source") == "skip-already-filled":
            summary["skipped_filled"] += 1

    if dry_run:
        session.rollback()
    else:
        session.commit()

    return summary


def repair_ps_120013_okz(session: Session) -> bool:
    """Обратная совместимость: починить только 12.013 / 1492."""
    summary = repair_all_okz(session, only_missing=True, ps_code="12.013", dry_run=False)
    if summary["examined"] == 0:
        summary = repair_all_okz(session, only_missing=True, reg_number="1492", dry_run=False)
    return summary["changed"] > 0
