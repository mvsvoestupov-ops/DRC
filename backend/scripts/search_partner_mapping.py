"""
Поиск аналогов в страновых системах (шаг 9.2).

Найденное вставляется с отсылкой на источник и уровнем уверенности
(high/medium/low → Высокий/Средний/Низкий в UI). Не найден — слот пустой.
Опциональный --min-confidence отсекает слабые совпадения (по умолчанию low).

Примеры (COMPETENCE_ID — число):

  scripts\\search_partner_mapping.cmd --list
  scripts\\search_partner_mapping.cmd --competence-id 12 --dry-run
  scripts\\search_partner_mapping.cmd --competence-id 12 --systems KZ --apply
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.partner_mapping_search import run_partner_search_for_competence


def _list_competences(limit: int = 40) -> int:
    from app.db.competence_models import Competence

    session = SessionLocal()
    try:
        rows = (
            session.query(Competence)
            .order_by(Competence.updated_at.desc())
            .limit(max(1, min(limit, 200)))
            .all()
        )
        if not rows:
            print("Компетенций в БД нет.")
            return 0
        print(f"{'id':>6}  {'updated':<20}  name")
        print("-" * 72)
        for c in rows:
            updated = c.updated_at.isoformat(sep=" ", timespec="minutes") if c.updated_at else ""
            name = (c.name or "")[:80]
            print(f"{c.id:>6}  {updated:<20}  {name}")
        print("-" * 72)
        print("Дальше, например:")
        print(f"  scripts\\search_partner_mapping.cmd --competence-id {rows[0].id} --dry-run")
        return 0
    finally:
        session.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Поиск страновых аналогов для 9.2: вставка найденного + источник + уверенность"
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="Показать id компетенций из БД и выйти",
    )
    parser.add_argument(
        "--competence-id",
        type=int,
        default=None,
        help="Числовой ID паспорта компетенции (см. --list)",
    )
    parser.add_argument("--version-id", type=int, default=0, help="ID версии мостов (0 = ready/latest)")
    parser.add_argument(
        "--systems",
        default="",
        help="Коды систем через запятую (пусто = все не-ESCO из моста)",
    )
    parser.add_argument(
        "--min-confidence",
        choices=("high", "medium", "low"),
        default="low",
        help="Минимальная уверенность для вставки (default: low = всё найденное)",
    )
    parser.add_argument(
        "--no-llm",
        action="store_true",
        help="Только корпусный score, без доп. проверки ИИ",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Записать результат в PassportHarmonization.step3",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Только показать статистику/превью (по умолчанию, если нет --apply)",
    )
    parser.add_argument("--json", action="store_true", help="Печать полного JSON результата")
    args = parser.parse_args()

    if args.list:
        return _list_competences()

    if args.competence_id is None:
        parser.error("укажите --competence-id ЧИСЛО или --list (слово ID подставлять нельзя)")

    apply = bool(args.apply) and not bool(args.dry_run)
    systems = [s.strip() for s in args.systems.split(",") if s.strip()] or None

    session = SessionLocal()
    try:
        result = run_partner_search_for_competence(
            session,
            competence_id=int(args.competence_id),
            version_id=int(args.version_id) or None,
            target_systems=systems,
            min_confidence=args.min_confidence,
            use_llm_verify=not args.no_llm,
            apply=apply,
        )
        stats = result.get("stats") or {}
        print(
            f"competence={result.get('competence_id')} version={result.get('version_id')} "
            f"applied={result.get('applied')}"
        )
        print(
            f"domains={stats.get('domains')} searches={stats.get('searches')} "
            f"applied_slots={stats.get('applied')} "
            f"not_found={stats.get('skipped_not_found')} "
            f"low_confidence={stats.get('skipped_low_confidence')} "
            f"min_confidence={stats.get('min_confidence')}"
        )
        payload = result.get("payload") or {}
        rows = payload.get("rows") if isinstance(payload.get("rows"), list) else []
        for i, row in enumerate(rows[:12]):
            if not isinstance(row, dict):
                continue
            systems_map = row.get("systems") if isinstance(row.get("systems"), dict) else {}
            filled = {
                k: v.get("title")
                for k, v in systems_map.items()
                if isinstance(v, dict) and v.get("title") and str(v.get("match") or "") != "none"
            }
            print(
                f"  [{i}] {row.get('source_type')}/{row.get('source_id')}: "
                f"{(row.get('source_text') or '')[:60]!r} → {filled or '—'}"
            )
        if len(rows) > 12:
            print(f"  … ещё {len(rows) - 12} строк")
        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        if not apply:
            print("Режим просмотра: добавьте --apply для записи в step3.")
        return 0
    except Exception as exc:
        print(f"Ошибка: {exc}")
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
