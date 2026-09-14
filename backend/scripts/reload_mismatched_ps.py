"""
Точечная перезагрузка ПС с подменой содержимого (один reg — чужой документ).

Источник: только реестр Минтруда (XML по ELEMENT_ID), НЕ classinform
(у classinform устаревшие привязки кодов 03.010–03.013).

По умолчанию читает critical из scripts/output/ps_content_mismatch.json.
Можно передать reg явно: ... 846 860 988

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\reload_mismatched_ps.py
  venv\\Scripts\\python.exe scripts\\reload_mismatched_ps.py --dry-run
  venv\\Scripts\\python.exe scripts\\reload_mismatched_ps.py 846 860
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import warnings
from typing import Any

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "scripts"))

from app.db import SessionLocal
from app.db.competence_models import Competence
from app.db.qualifications_models import Qualification
from app.db.raw_models import StandardRaw
from app.db_operations import save_raw_standard
from app.enrichment import delete_enriched_by_reg_number
from app.parser import (
    build_reg_to_element_map,
    download_bulk_xml_chunk,
    find_element_id_by_reg_number,
    parse_bulk_xml,
    reg_to_element_cache,
    _search_element_id,
)
from app.qualification_links import normalize_name, normalize_ps_code, relink_all_qualifications

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
MISMATCH_REPORT = os.path.join(OUTPUT_DIR, "ps_content_mismatch.json")
RELOAD_LOG = os.path.join(OUTPUT_DIR, "reload_mismatched_ps.json")


def _remap_fk(session, old_id: int, new_id: int) -> None:
    session.query(Competence).filter(Competence.prof_standard_id == old_id).update(
        {Competence.prof_standard_id: new_id},
        synchronize_session=False,
    )
    session.query(Qualification).filter(Qualification.prof_standard_id == old_id).update(
        {Qualification.prof_standard_id: new_id},
        synchronize_session=False,
    )


def _names_close(a: str, b: str) -> bool:
    left = normalize_name(a)
    right = normalize_name(b)
    if not left or not right:
        return True  # нечего сверять
    if left == right:
        return True
    if len(left) >= 20 and len(right) >= 20 and left[:40] == right[:40]:
        return True
    if left in right or right in left:
        return True
    return False


def load_targets_from_report() -> list[dict[str, Any]]:
    if not os.path.isfile(MISMATCH_REPORT):
        return []
    with open(MISMATCH_REPORT, encoding="utf-8") as f:
        report = json.load(f)
    rows = report.get("critical") or report.get("mismatches") or []
    # только critical / code_and_name
    targets = [
        {
            "reg_number": str(r.get("reg_number") or "").strip(),
            "ps_code": r.get("xlsx_ps_code") or r.get("ps_code") or "",
            "name": r.get("xlsx_name") or r.get("name") or "",
            "order_number": r.get("xlsx_order") or r.get("order_number") or "",
            "kind": r.get("kind") or "code_and_name",
        }
        for r in rows
        if (r.get("severity") == "critical" or r.get("kind") == "code_and_name")
        and str(r.get("reg_number") or "").strip()
    ]
    # уникальные по reg
    by_reg: dict[str, dict] = {}
    for t in targets:
        by_reg[t["reg_number"]] = t
    return list(by_reg.values())


def default_critical_targets() -> list[dict[str, Any]]:
    """Запасной список, если отчёт ещё не строили."""
    return [
        {
            "reg_number": "846",
            "ps_code": "03.010",
            "name": "Тифлосурдопереводчик",
            "order_number": "575н",
            "kind": "code_and_name",
        },
        {
            "reg_number": "860",
            "ps_code": "03.011",
            "name": "Специалист по оказанию государственных услуг в области занятости населения",
            "order_number": "676н",
            "kind": "code_and_name",
        },
        {
            "reg_number": "988",
            "ps_code": "03.012",
            "name": "Ассистент (помощник) по оказанию технической помощи инвалидам и лицам с ограниченными возможностями здоровья",
            "order_number": "351н",
            "kind": "code_and_name",
        },
        {
            "reg_number": "1097",
            "ps_code": "03.013",
            "name": "Помощник по уходу",
            "order_number": "507н",
            "kind": "code_and_name",
        },
        {
            "reg_number": "1707",
            "ps_code": "19.085",
            "name": "Работник по контролю физико-химических свойств нефти, газа, газового конденсата",
            "order_number": "",
            "kind": "code_and_name",
        },
    ]


def force_reload_reg(target: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    reg = str(target["reg_number"]).strip()
    expected_code = normalize_ps_code(target.get("ps_code") or "") or (target.get("ps_code") or "").strip()
    expected_name = (target.get("name") or "").strip()
    order_number = (target.get("order_number") or "").strip()

    session = SessionLocal()
    try:
        old = session.query(StandardRaw).filter(StandardRaw.reg_number == reg).first()
        old_id = old.id if old else None
        old_name = old.name if old else None
        old_code = old.ps_code if old else None
        old_element_id = old.element_id if old else None
    finally:
        session.close()

    print(f"\n=== reg={reg} expected {expected_code} «{expected_name[:60]}» ===")
    print(f"  сейчас в БД: {old_code} «{(old_name or '')[:60]}» element_id={old_element_id}")

    # Сбрасываем возможный устаревший ELEMENT_ID в кэше карты реестра
    reg_to_element_cache.pop(reg, None)

    eid = find_element_id_by_reg_number(reg, ps_code=expected_code or None, order_number=order_number or None)
    if not eid:
        return {
            "reg_number": reg,
            "status": "failed",
            "error": "ELEMENT_ID не найден на сайте Минтруда",
            "expected_ps_code": expected_code,
            "expected_name": expected_name,
            "old_ps_code": old_code,
            "old_name": old_name,
        }

    # Если нашли тот же ELEMENT_ID, что уже лежит в БД с чужим текстом — всё равно
    # качаем XML заново (вдруг на сайте обновили). Если имя не совпадёт — отменим ниже.
    print(f"  ELEMENT_ID={eid}" + (f" (был {old_element_id})" if old_element_id and old_element_id != eid else ""))

    if dry_run:
        return {
            "reg_number": reg,
            "status": "dry-run",
            "element_id": eid,
            "expected_ps_code": expected_code,
            "expected_name": expected_name,
            "old_ps_code": old_code,
            "old_name": old_name,
            "old_element_id": old_element_id,
        }

    xml_path = os.path.join(BACKEND_DIR, "downloads", f"standards_reload_{reg}_{eid}.xml")
    os.makedirs(os.path.dirname(xml_path), exist_ok=True)
    download_bulk_xml_chunk([eid], xml_path)
    standards = parse_bulk_xml(xml_path, element_ids=[eid])
    if not standards:
        return {
            "reg_number": reg,
            "status": "failed",
            "error": "Не удалось распарсить XML",
            "element_id": eid,
        }

    std = standards[0]
    loaded_reg = str(std.registration_number or "").strip()
    loaded_name = (std.name or "").strip()

    if loaded_reg and loaded_reg != reg:
        return {
            "reg_number": reg,
            "status": "failed",
            "error": f"XML вернул другой reg={loaded_reg}",
            "element_id": eid,
            "loaded_name": loaded_name,
        }

    if expected_name and loaded_name and not _names_close(expected_name, loaded_name):
        print(
            f"  ⚠ имя XML не совпало («{loaded_name[:50]}»), ищем другой ELEMENT_ID…"
        )
        alt_queries = [q for q in (expected_code, expected_name[:60], order_number) if q]
        alt_eid = None
        for q in alt_queries:
            alt_eid = _search_element_id(q, expected_reg=reg)
            if alt_eid and alt_eid != eid:
                break
            alt_eid = None
        if not alt_eid:
            return {
                "reg_number": reg,
                "status": "failed",
                "error": "Имя в XML не совпало с ожидаемым из XLSX — загрузка отменена",
                "element_id": eid,
                "expected_name": expected_name,
                "loaded_name": loaded_name,
            }
        print(f"  повтор с ELEMENT_ID={alt_eid}")
        eid = alt_eid
        xml_path = os.path.join(BACKEND_DIR, "downloads", f"standards_reload_{reg}_{eid}.xml")
        download_bulk_xml_chunk([eid], xml_path)
        standards = parse_bulk_xml(xml_path, element_ids=[eid])
        if not standards:
            return {
                "reg_number": reg,
                "status": "failed",
                "error": "Не удалось распарсить XML (повтор)",
                "element_id": eid,
            }
        std = standards[0]
        loaded_reg = str(std.registration_number or "").strip()
        loaded_name = (std.name or "").strip()
        if loaded_reg and loaded_reg != reg:
            return {
                "reg_number": reg,
                "status": "failed",
                "error": f"Повторный XML вернул reg={loaded_reg}",
                "element_id": eid,
                "loaded_name": loaded_name,
            }
        if expected_name and loaded_name and not _names_close(expected_name, loaded_name):
            return {
                "reg_number": reg,
                "status": "failed",
                "error": "Имя в XML не совпало и после повторного поиска",
                "element_id": eid,
                "expected_name": expected_name,
                "loaded_name": loaded_name,
            }

    # Форсируем код из XLSX в объект до save (чтобы не унаследовать старый 08.029)
    if expected_code:
        std.ps_code = expected_code
        if "." in expected_code:
            std.professional_area_code = expected_code.split(".")[0]

    session = SessionLocal()
    try:
        save_raw_standard(session, std, eid)
        new = session.query(StandardRaw).filter(StandardRaw.reg_number == reg).first()
        if not new:
            return {
                "reg_number": reg,
                "status": "failed",
                "error": "После save запись не найдена",
                "element_id": eid,
            }

        # Гарантированно прописываем код/статус из XLSX
        if expected_code:
            new.ps_code = expected_code
            if "." in expected_code:
                new.professional_area_code = expected_code.split(".")[0]
        if target.get("xlsx_status") or target.get("status"):
            # не трогаем status без явного значения в target
            pass
        session.commit()

        new_id = new.id
        new_name = new.name
        new_code = new.ps_code

        if old_id and new_id and old_id != new_id:
            _remap_fk(session, old_id, new_id)
            session.commit()
            print(f"  FK переназначены {old_id} → {new_id}")
    finally:
        session.close()

    try:
        session = SessionLocal()
        delete_enriched_by_reg_number(session, reg)
        session.close()
    except Exception as exc:
        print(f"  предупреждение enrichment: {exc}")

    print(f"  OK: {new_code} «{(new_name or '')[:70]}»")
    return {
        "reg_number": reg,
        "status": "ok",
        "element_id": eid,
        "old_id": old_id,
        "new_id": new_id,
        "old_ps_code": old_code,
        "old_name": old_name,
        "new_ps_code": new_code,
        "new_name": new_name,
        "expected_ps_code": expected_code,
        "expected_name": expected_name,
    }


def run_reload(
    regs: list[str] | None = None,
    *,
    dry_run: bool = False,
    refresh_map: bool = True,
    relink: bool = True,
) -> dict[str, Any]:
    warnings.filterwarnings("ignore", message="Unverified HTTPS request")

    targets = load_targets_from_report() or default_critical_targets()
    if regs:
        want = {str(r).strip() for r in regs}
        targets = [t for t in targets if t["reg_number"] in want]
        # если в отчёте нет — собрать из default + голый reg
        have = {t["reg_number"] for t in targets}
        for r in want - have:
            fallback = next((t for t in default_critical_targets() if t["reg_number"] == r), None)
            targets.append(fallback or {"reg_number": r, "ps_code": "", "name": "", "order_number": ""})

    print(f"К перезагрузке: {len(targets)} ПС")
    for t in targets:
        print(f"  reg={t['reg_number']} {t.get('ps_code')} {(t.get('name') or '')[:50]}")

    if refresh_map and not dry_run:
        print("\nОбновление карты reg → ELEMENT_ID с сайта Минтруда...")
        build_reg_to_element_map(refresh=True)
    elif refresh_map and dry_run:
        print("\n[dry-run] карту ELEMENT_ID не обновляем полностью; точечный поиск")

    results = []
    for i, target in enumerate(targets, 1):
        print(f"\n[{i}/{len(targets)}]")
        try:
            results.append(force_reload_reg(target, dry_run=dry_run))
        except Exception as exc:
            results.append(
                {
                    "reg_number": target.get("reg_number"),
                    "status": "failed",
                    "error": str(exc),
                }
            )
            print(f"  ✗ {exc}")
        time.sleep(0.4)

    relink_info = None
    if relink and not dry_run and any(r.get("status") == "ok" for r in results):
        print("\nПересвязка квалификаций...")
        session = SessionLocal()
        try:
            link_result = relink_all_qualifications(session, update_existing=True, commit=True)
            relink_info = {
                "linked": link_result.linked,
                "not_found": link_result.not_found,
            }
            print(f"  связано: {link_result.linked}, без ПС: {link_result.not_found}")
        finally:
            session.close()

    summary = {
        "ok": sum(1 for r in results if r.get("status") == "ok"),
        "failed": sum(1 for r in results if r.get("status") == "failed"),
        "dry_run": sum(1 for r in results if r.get("status") == "dry-run"),
        "total": len(results),
    }
    payload = {
        "summary": summary,
        "results": results,
        "relink": relink_info,
        "dry_run": dry_run,
    }
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(RELOAD_LOG, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"\nИтого: ok={summary['ok']} failed={summary['failed']} dry-run={summary['dry_run']}")
    print(f"Лог: {RELOAD_LOG}")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Точечная перезагрузка ПС с подменой содержимого")
    parser.add_argument("regs", nargs="*", help="Рег. номера (по умолчанию — critical из отчёта)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-refresh-map", action="store_true")
    parser.add_argument("--no-relink", action="store_true")
    args = parser.parse_args()

    run_reload(
        args.regs or None,
        dry_run=args.dry_run,
        refresh_map=not args.no_refresh_map,
        relink=not args.no_relink,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
