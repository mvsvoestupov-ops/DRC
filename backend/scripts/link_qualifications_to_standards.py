"""
Скрипт связывает квалификации из таблицы qualifications с профессиональными стандартами
и пишет отчёт аудита связей.
Основной способ — код квалификации (01.00100.01 → ПС 01.001).
Если код известен, а ПС нет в базе — квалификация остаётся без связи (без угадывания по № приказа).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from app.db import SessionLocal
from app.qualification_links import audit_qualification_links, relink_and_audit

OUTPUT_DIR = Path(__file__).resolve().parent / "output"


def _print_summary(payload: dict) -> None:
    audit = payload.get("audit") or payload
    issues = audit.get("issues") or {}
    print(f"Всего квалификаций: {audit.get('total_qualifications')}")
    print(f"Связано: {audit.get('linked_qualifications')}")
    print(f"Без связи: {audit.get('unlinked_qualifications')}")
    print(f"ПС с квалификациями: {audit.get('standards_with_qualifications')}")
    print("\nПроблемы:")
    for key, value in issues.items():
        print(f"  {key}: {value}")


def main() -> None:
    audit_only = "--audit-only" in sys.argv
    dry = "--dry-run" in sys.argv
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    session = SessionLocal()
    try:
        if audit_only:
            print("Режим: только аудит (без пересвязки)")
            payload = {"status": "audit_only", "audit": audit_qualification_links(session)}
        else:
            print(f"Режим: {'тестовый (dry-run)' if dry else 'пересвязка + аудит'}")
            if dry:
                from app.qualification_links import relink_all_qualifications

                result = relink_all_qualifications(
                    session, update_existing=True, commit=False
                )
                audit = audit_qualification_links(session)
                payload = {
                    "status": "dry_run",
                    "linked": result.linked,
                    "skipped": result.skipped,
                    "not_found": result.not_found,
                    "by_method": result.by_method,
                    "audit": audit,
                }
                session.rollback()
                print("(dry-run — изменения не сохранены)")
            else:
                payload = relink_and_audit(session)

            print(f"\nСвязано за проход: {payload.get('linked')}")
            print(f"Не найдено ПС: {payload.get('not_found')}")

        _print_summary(payload)

        json_path = OUTPUT_DIR / "qualification_links_audit.json"
        txt_path = OUTPUT_DIR / "qualification_links_audit.txt"
        json_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        audit = payload.get("audit") or {}
        lines = [
            "Аудит связей квалификаций НАРК с профстандартами",
            "=" * 60,
            f"linked_qualifications: {audit.get('linked_qualifications')}",
            f"unlinked_qualifications: {audit.get('unlinked_qualifications')}",
            f"code_mismatch: {audit.get('issues', {}).get('code_mismatch')}",
            f"name_mismatch: {audit.get('issues', {}).get('name_mismatch')}",
            f"year_mismatch: {audit.get('issues', {}).get('year_mismatch')}",
            f"unlinked_with_ps_in_db: {audit.get('issues', {}).get('unlinked_with_ps_in_db')}",
            f"unlinked_missing_ps_in_db: {audit.get('issues', {}).get('unlinked_missing_ps_in_db')}",
            f"order_number_collisions: {audit.get('issues', {}).get('order_number_collisions')}",
            "",
            "Примеры code_mismatch:",
        ]
        for row in (audit.get("code_mismatch") or [])[:30]:
            lines.append(
                f"  {row.get('code')} → expected {row.get('expected_ps_code')}, "
                f"linked {row.get('linked_ps_code')} ({row.get('linked_standard_name')})"
            )
        lines.append("")
        lines.append("Примеры name_mismatch:")
        for row in (audit.get("name_mismatch") or [])[:30]:
            lines.append(
                f"  {row.get('code')}: qual_ps={row.get('qualification_ps_name')!r} "
                f"↔ std={row.get('linked_standard_name')!r}"
            )
        lines.append("")
        lines.append("Коллизии номеров приказов (фрагмент):")
        for block in (audit.get("order_number_collisions_sample") or [])[:15]:
            lines.append(f"  № {block.get('order_token')}:")
            for std in block.get("standards") or []:
                lines.append(
                    f"    {std.get('ps_code')} reg={std.get('reg_number')} "
                    f"year={std.get('year')} {std.get('name')}"
                )

        txt_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"\nОтчёт JSON: {json_path}")
        print(f"Отчёт TXT:  {txt_path}")
    except Exception as exc:
        session.rollback()
        print(f"Ошибка: {exc}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
