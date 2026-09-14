"""
Синхронизация профстандартов по отчёту analyze_missing_standards.py:
  1. Догружает полностью отсутствующие ПС
  2. Перезагружает переопубликованные (тот же рег. №, новый ELEMENT_ID)
  3. Удаляет устаревшие записи (element_id больше нет на сайте)
  4. Переназначает FK в competences / qualifications при смене id записи

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\sync_standards_from_report.py

Сначала нужен отчёт:
  venv\\Scripts\\python.exe scripts\\analyze_missing_standards.py

Опции:
  --dry-run   только показать план, без загрузки и удаления
  --skip-cleanup   не удалять устаревшие и не запрашивать список ID с сайта
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from typing import Literal, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.db.competence_models import Competence
from app.db.qualifications_models import Qualification
from app.db.raw_models import StandardRaw
from app.db_operations import save_raw_standard
from app.enrichment import delete_enriched_by_reg_number
from app.parser import (
    REGISTRY_BASE_URL,
    download_bulk_xml_chunk,
    get_all_element_ids,
    parse_bulk_xml,
)

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT_PATH = os.path.join(os.path.dirname(__file__), "output", "missing_standards_report.json")
LOG_PATH = os.path.join(BACKEND_ROOT, "sync_standards_log.txt")


@dataclass
class LoadResult:
    status: Literal["ok", "skipped", "failed", "dry-run"]
    element_id: str
    reg_number: Optional[str]
    action: str = ""


def _remap_fk(session, old_id: int, new_id: int) -> None:
    session.query(Competence).filter(Competence.prof_standard_id == old_id).update(
        {Competence.prof_standard_id: new_id},
        synchronize_session=False,
    )
    session.query(Qualification).filter(Qualification.prof_standard_id == old_id).update(
        {Qualification.prof_standard_id: new_id},
        synchronize_session=False,
    )


def _clear_fk(session, standard_id: int) -> None:
    session.query(Competence).filter(Competence.prof_standard_id == standard_id).update(
        {Competence.prof_standard_id: None},
        synchronize_session=False,
    )
    session.query(Qualification).filter(Qualification.prof_standard_id == standard_id).update(
        {Qualification.prof_standard_id: None},
        synchronize_session=False,
    )


def load_report() -> dict:
    if not os.path.exists(REPORT_PATH):
        print("Сначала запустите анализ:")
        print("  venv\\Scripts\\python.exe scripts\\analyze_missing_standards.py")
        print(f"Ожидается файл: {REPORT_PATH}")
        sys.exit(1)
    with open(REPORT_PATH, encoding="utf-8") as f:
        return json.load(f)


def reload_by_element_id(element_id: str, dry_run: bool = False) -> LoadResult:
    session = SessionLocal()
    try:
        existing = session.query(StandardRaw).filter(StandardRaw.element_id == element_id).first()
        if existing:
            msg = f"Уже в БД: ELEMENT_ID={element_id} reg={existing.reg_number}"
            print(f"  ⏭ {msg}")
            return LoadResult("skipped", element_id, existing.reg_number, msg)

        if dry_run:
            msg = f"[dry-run] Загрузить ELEMENT_ID={element_id}"
            print(f"  • {msg}")
            return LoadResult("dry-run", element_id, None, msg)

        xml_path = os.path.join(BACKEND_ROOT, "downloads", f"standards_{element_id}.xml")
        os.makedirs(os.path.dirname(xml_path), exist_ok=True)
        download_bulk_xml_chunk([element_id], xml_path)
        standards = parse_bulk_xml(xml_path, element_ids=[element_id])
        if not standards:
            msg = f"Не удалось распарсить XML для ELEMENT_ID={element_id}"
            print(f"  ✗ {msg}")
            return LoadResult("failed", element_id, None, msg)

        std = standards[0]
        reg = std.registration_number

        old = session.query(StandardRaw).filter(StandardRaw.reg_number == reg).first()
        old_id = old.id if old else None
        action = "новый" if old_id is None else f"обновление reg={reg}, старый id={old_id}"

        save_raw_standard(session, std, element_id)

        session2 = SessionLocal()
        try:
            new = session2.query(StandardRaw).filter(StandardRaw.reg_number == reg).first()
            new_id = new.id if new else None
            if old_id and new_id and old_id != new_id:
                _remap_fk(session2, old_id, new_id)
                session2.commit()
                action += f" → FK {old_id}→{new_id}"
        finally:
            session2.close()

        name = (std.name or "")[:80]
        msg = f"Загружен reg={reg} ELEMENT_ID={element_id} ({action}): {name}"
        print(f"  ✓ {msg}")
        return LoadResult("ok", element_id, reg, msg)

    except Exception as e:
        msg = f"Ошибка ELEMENT_ID={element_id}: {e}"
        print(f"  ✗ {msg}")
        return LoadResult("failed", element_id, None, msg)
    finally:
        session.close()


def delete_stale_records(site_element_ids: set[str], dry_run: bool = False) -> list[dict]:
    session = SessionLocal()
    removed: list[dict] = []
    try:
        rows = (
            session.query(StandardRaw)
            .filter(
                StandardRaw.element_id.isnot(None),
                StandardRaw.element_id != "",
                ~StandardRaw.element_id.in_(site_element_ids),
            )
            .all()
        )

        if not rows:
            print("  Устаревших записей не найдено.")
            return removed

        print(f"  Найдено устаревших записей: {len(rows)}")
        for row in rows:
            info = {
                "reg_number": row.reg_number,
                "element_id": row.element_id,
                "name": (row.name or "")[:100],
            }
            removed.append(info)
            print(
                f"  {'• [dry-run]' if dry_run else '✗'} "
                f"reg={row.reg_number} ELEMENT_ID={row.element_id} — {info['name']}"
            )
            if not dry_run:
                _clear_fk(session, row.id)
                delete_enriched_by_reg_number(session, row.reg_number)
                session.delete(row)

        if not dry_run and rows:
            session.commit()
        return removed
    finally:
        session.close()


def count_db() -> int:
    session = SessionLocal()
    try:
        return session.query(StandardRaw).count()
    finally:
        session.close()


def write_log(lines: list[str]) -> None:
    with open(LOG_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"\nЛог: {LOG_PATH}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Синхронизация ПС по отчёту analyze_missing_standards.py")
    parser.add_argument("--dry-run", action="store_true", help="Только показать план")
    parser.add_argument(
        "--skip-cleanup",
        action="store_true",
        help="Не удалять устаревшие записи и не запрашивать ID с сайта",
    )
    args = parser.parse_args()

    report = load_report()
    missing = report.get("missing_in_local_db", [])
    if not missing:
        print("В отчёте нет недостающих ПС — синхронизация не требуется.")
        return

    republished = [m for m in missing if m.get("in_db_by_reg_number")]
    brand_new = [m for m in missing if not m.get("in_db_by_reg_number")]

    log: list[str] = [
        "СИНХРОНИЗАЦИЯ ПРОФСТАНДАРТОВ",
        "=" * 60,
        f"Режим: {'dry-run' if args.dry_run else 'выполнение'}",
        f"В БД до синхронизации: {count_db()}",
        f"Переопубликованных (обновить): {len(republished)}",
        f"Полностью новых (догрузить): {len(brand_new)}",
        "",
    ]

    print("=" * 60)
    print("СИНХРОНИЗАЦИЯ ПРОФСТАНДАРТОВ")
    print("=" * 60)
    print(f"БД до: {count_db()} записей")
    print(f"Переопубликованных: {len(republished)}, новых: {len(brand_new)}")
    if args.dry_run:
        print("Режим: dry-run (изменений не будет)\n")

    results: list[LoadResult] = []

    print("\n[1/2] Загрузка и обновление ПС...")
    for i, item in enumerate(republished + brand_new, 1):
        eid = item["element_id"]
        reg = item.get("reg_number") or "?"
        kind = "обновление" if item.get("in_db_by_reg_number") else "новый"
        print(f"\n[{i}/{len(missing)}] {kind} ELEMENT_ID={eid} reg={reg}")
        result = reload_by_element_id(eid, dry_run=args.dry_run)
        results.append(result)
        log.append(f"{kind}: {result.status} ELEMENT_ID={eid} reg={reg} — {result.action}")
        if not args.dry_run:
            time.sleep(0.5)

    removed: list[dict] = []
    if not args.skip_cleanup:
        print("\n[2/2] Удаление устаревших записей...")
        if args.dry_run:
            print("  [dry-run] Запрос списка ELEMENT_ID с сайта пропущен")
            extra = report.get("extra_in_db_not_on_site", [])
            for row in extra:
                print(
                    f"  • [dry-run] Удалить reg={row.get('reg_number')} "
                    f"ELEMENT_ID={row.get('element_id')}"
                )
                removed.append(row)
        else:
            print("  Получение актуального списка ELEMENT_ID с сайта...")
            site_ids = set(get_all_element_ids(REGISTRY_BASE_URL))
            print(f"  На сайте: {len(site_ids)} ELEMENT_ID")
            removed = delete_stale_records(site_ids, dry_run=False)
    else:
        print("\n[2/2] Пропущено (--skip-cleanup)")

    ok = sum(1 for r in results if r.status == "ok")
    skipped = sum(1 for r in results if r.status == "skipped")
    failed = sum(1 for r in results if r.status == "failed")

    db_after = count_db() if not args.dry_run else count_db()

    log.extend([
        "",
        f"Загружено/обновлено: {ok}, пропущено: {skipped}, ошибок: {failed}",
        f"Удалено устаревших: {len(removed) if not args.dry_run else 'dry-run'}",
        f"В БД после: {db_after}",
        "",
        "Проверка: venv\\Scripts\\python.exe scripts\\analyze_missing_standards.py",
    ])
    write_log(log)

    print("\n" + "=" * 60)
    print("ИТОГ")
    print(f"  Загружено/обновлено: {ok}")
    print(f"  Пропущено (уже были): {skipped}")
    print(f"  Ошибок: {failed}")
    if not args.skip_cleanup and not args.dry_run:
        print(f"  Удалено устаревших: {len(removed)}")
    print(f"  Записей в БД: {db_after}")
    print("\nДля проверки запустите:")
    print("  venv\\Scripts\\python.exe scripts\\analyze_missing_standards.py")
    print("=" * 60)

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
