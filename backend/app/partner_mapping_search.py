"""
Поиск аналогов в страновых системах для шага 9.2.

Правило: если кандидат найден — вставляем результат, указываем источник
и уровень уверенности (high / medium / low). Ничего не выдумываем:
нет попадания в корпус → слот остаётся пустым.
"""
from __future__ import annotations

import datetime
import re
from typing import Any, Literal

from sqlalchemy.orm import Session

from .deepseek_client import chat_json, deepseek_configured
from .harmonization import (
    _attach_systems_to_rows,
    _normalize_step3_row,
    _sync_legacy_esco_fields,
    _system_is_kazakhstan,
    build_bridge_context_for_passport,
    detect_passport_domains,
    filter_bridge_context_by_systems,
    heuristic_ai_draft,
    normalize_target_system_codes,
)

Confidence = Literal["high", "medium", "low"]
CONF_RANK = {"high": 3, "medium": 2, "low": 1}

# Проверенный корпус публичных ориентиров (расширяется вручную).
# keywords — все должны дать суммарный score; document/title — что можно вставлять.
PARTNER_CORPUS: list[dict[str, Any]] = [
    {
        "id": "kz-mes-350-2022-fire",
        "system_match": {"regions": ["казахстан", "kazakhstan"], "codes": ["KZ", "NSK", "НСК", "NQF-K", "ENBEK"]},
        "domains": ["fire_rescue"],
        "title": "Пожарный / специалист пожарно-спасательной службы (НСК РК)",
        "document": (
            "Приказ Министра по чрезвычайным ситуациям Республики Казахстан "
            "от 28 декабря 2022 года № 350"
        ),
        "keywords": [
            "пожар",
            "огнебор",
            "спасат",
            "чрезвычайн",
            "firefighter",
            "огнетуш",
        ],
        "min_keyword_hits": 1,
        "base_confidence": "high",
        "match": "partial",
        "source_url": "",
    },
]


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _system_matches_entry(code: str, name: str, region: str, entry: dict[str, Any]) -> bool:
    sm = entry.get("system_match") if isinstance(entry.get("system_match"), dict) else {}
    codes = [str(c).upper() for c in (sm.get("codes") or [])]
    regions = [_norm(r) for r in (sm.get("regions") or [])]
    code_u = (code or "").upper()
    name_u = (name or "").upper()
    region_n = _norm(region)
    if any(c and (c == code_u or c in name_u or c in code_u) for c in codes):
        return True
    if regions and any(r and r in region_n for r in regions):
        return True
    # Казахстан по эвристике кода/региона
    if _system_is_kazakhstan(code, name, region) and any(
        "казах" in r or "kz" in r for r in regions
    ):
        return True
    return False


def score_corpus_hit(blob: str, entry: dict[str, Any]) -> tuple[int, list[str]]:
    hits: list[str] = []
    for kw in entry.get("keywords") or []:
        k = _norm(str(kw))
        if k and k in blob:
            hits.append(k)
    return len(hits), hits


def search_partner_corpus(
    *,
    query_text: str,
    system_code: str,
    system_name: str = "",
    system_region: str = "",
    domains: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Поиск в локальном корпусе. Пустой список = ничего не найдено."""
    blob = _norm(query_text)
    domains = domains or []
    found: list[dict[str, Any]] = []
    for entry in PARTNER_CORPUS:
        if not _system_matches_entry(system_code, system_name, system_region, entry):
            continue
        entry_domains = entry.get("domains") or []
        if entry_domains and domains and not any(d in entry_domains for d in domains):
            # домен паспорта не совпал — не предлагаем
            continue
        if entry_domains and not domains:
            # нет домена у паспорта — не навязываем отраслевой акт
            continue
        score, hits = score_corpus_hit(blob, entry)
        min_hits = int(entry.get("min_keyword_hits") or 1)
        if score < min_hits:
            continue
        conf: Confidence = entry.get("base_confidence") or "medium"
        if score >= 3:
            conf = "high"
        elif score == 1 and conf == "high":
            conf = "medium"
        found.append(
            {
                "corpus_id": entry.get("id"),
                "system_code": system_code,
                "title": entry.get("title") or "",
                "document": entry.get("document") or "",
                "match": entry.get("match") or "partial",
                "confidence": conf,
                "keyword_hits": hits,
                "score": score,
                "source_url": entry.get("source_url") or "",
                "notes": (
                    f"Найдено в корпусе [{entry.get('id')}]: {entry.get('document')}. "
                    f"Ключевые совпадения: {', '.join(hits)}. "
                    "Требуется экспертная сверка формулировок."
                ),
            }
        )
    found.sort(key=lambda x: (-CONF_RANK.get(x["confidence"], 0), -int(x.get("score") or 0)))
    return found


def meets_confidence(value: str, minimum: str) -> bool:
    return CONF_RANK.get(str(value).lower(), 0) >= CONF_RANK.get(str(minimum).lower(), 3)


def rate_candidate_with_llm(
    *,
    source_text: str,
    passport_title: str,
    candidate: dict[str, Any],
) -> dict[str, Any]:
    """
    ИИ оценивает уверенность найденного кандидата (не отбрасывает его).
    Без ИИ — возвращает корпусную оценку.
    """
    base = dict(candidate)
    base["source"] = str(candidate.get("document") or candidate.get("source") or "").strip()
    if not deepseek_configured():
        base["verified"] = False
        base["verify_mode"] = "corpus_only"
        conf = str(base.get("confidence") or "medium").lower()
        base["confidence"] = conf if conf in CONF_RANK else "medium"
        return base

    system = (
        "Ты методист по международной гармонизации. "
        "Кандидат УЖЕ найден в проверенном корпусе — не выдумывай другие документы. "
        "Оцени уверенность соответствия строке паспорта и слегка уточни формулировки.\n"
        "Верни JSON: {\"confidence\": \"high|medium|low\", \"match\": \"full|partial|none\", "
        "\"title\": \"...\", \"notes\": \"краткий комментарий на русском\"}.\n"
        "confidence=high — явное тематическое совпадение; medium — близкий аналог; "
        "low — слабая связь, но кандидат всё же релевантен корпусу."
    )
    user = (
        f"Паспорт (название): {passport_title}\n"
        f"Строка: {source_text}\n"
        f"Кандидат title: {candidate.get('title')}\n"
        f"Источник: {candidate.get('document')}\n"
        f"keyword_hits: {candidate.get('keyword_hits')}\n"
        f"Корпусная оценка: {candidate.get('confidence')}"
    )
    try:
        raw = chat_json(system=system, user=user, temperature=0.0, timeout=60)
    except Exception as exc:
        base["verified"] = False
        base["verify_error"] = str(exc)[:200]
        base["verify_mode"] = "corpus_fallback"
        conf = str(base.get("confidence") or "medium").lower()
        base["confidence"] = conf if conf in CONF_RANK else "medium"
        return base

    conf = str(raw.get("confidence") or base.get("confidence") or "medium").lower()
    if conf not in CONF_RANK:
        conf = "medium"
    match = str(raw.get("match") or candidate.get("match") or "partial").lower()
    if match not in ("full", "partial", "none"):
        match = "partial"
    title = str(raw.get("title") or candidate.get("title") or "").strip()
    notes = str(raw.get("notes") or "").strip() or str(candidate.get("notes") or "")
    return {
        **base,
        "confidence": conf,
        "match": match if match != "none" else "partial",
        "title": title or str(candidate.get("title") or ""),
        "notes": notes,
        "source": str(candidate.get("document") or ""),
        "verified": True,
        "verify_mode": "llm",
    }


def search_and_rate(
    *,
    query_text: str,
    system_code: str,
    system_name: str = "",
    system_region: str = "",
    domains: list[str] | None = None,
    passport_title: str = "",
    use_llm_verify: bool = True,
) -> list[dict[str, Any]]:
    """Найти кандидатов и проставить уверенность; все найденные возвращаются для вставки."""
    hits = search_partner_corpus(
        query_text=query_text,
        system_code=system_code,
        system_name=system_name,
        system_region=system_region,
        domains=domains,
    )
    rated: list[dict[str, Any]] = []
    for hit in hits:
        if use_llm_verify:
            checked = rate_candidate_with_llm(
                source_text=query_text,
                passport_title=passport_title,
                candidate=hit,
            )
        else:
            checked = {
                **hit,
                "source": str(hit.get("document") or ""),
                "verified": False,
                "verify_mode": "corpus_only",
            }
            conf = str(checked.get("confidence") or "medium").lower()
            checked["confidence"] = conf if conf in CONF_RANK else "medium"
        rated.append(checked)
    rated.sort(key=lambda x: (-CONF_RANK.get(str(x.get("confidence")), 0), -int(x.get("score") or 0)))
    return rated


# Совместимость со старым именем
def search_and_gate(**kwargs: Any) -> list[dict[str, Any]]:
    kwargs.pop("min_confidence", None)
    return search_and_rate(**kwargs)


def apply_verified_to_rows(
    rows: list[dict[str, Any]],
    *,
    selected_codes: list[str],
    bridge: dict[str, Any] | None,
    context: dict[str, Any] | None,
    min_confidence: str = "low",
    use_llm_verify: bool = True,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Для каждой строки и каждой не-ESCO системы: поиск → вставка найденного
    с источником и уровнем уверенности. ESCO не трогаем.
    """
    context = context or {}
    bridge = bridge if isinstance(bridge, dict) else {}
    systems_meta = {
        str(s.get("code") or "").strip(): s
        for s in (bridge.get("systems") or [])
        if isinstance(s, dict)
    }
    domains = detect_passport_domains(context)
    passport_title = str(context.get("title") or "")
    stats = {
        "rows": len(rows),
        "searches": 0,
        "hits_raw": 0,
        "applied": 0,
        "by_confidence": {"high": 0, "medium": 0, "low": 0},
        "skipped_not_found": 0,
        "min_confidence": min_confidence,
        "domains": domains,
    }
    out: list[dict[str, Any]] = []
    for row in rows:
        base = _normalize_step3_row(row, selected_codes)
        systems = dict(base.get("systems") or {})
        row_blob = " ".join(
            [
                passport_title,
                str(base.get("source_text") or ""),
                str(base.get("source_type") or ""),
            ]
        )
        for code in selected_codes:
            if code.upper() == "ESCO":
                continue
            meta = systems_meta.get(code) or {}
            stats["searches"] += 1
            found = search_and_rate(
                query_text=row_blob,
                system_code=code,
                system_name=str(meta.get("name") or ""),
                system_region=str(meta.get("region") or ""),
                domains=domains,
                passport_title=passport_title,
                use_llm_verify=use_llm_verify,
            )
            slot = systems.get(code) or {
                "system_code": code,
                "uri": "",
                "title": "",
                "match": "none",
                "notes": "",
                "level_target": str(meta.get("level_target") or ""),
                "rule_hint": "",
            }
            slot["uri"] = ""
            slot["title"] = ""
            slot["match"] = "none"
            slot["notes"] = ""
            slot["confidence"] = ""
            slot["source"] = ""
            slot["corpus_id"] = ""
            if not found:
                stats["skipped_not_found"] += 1
                slot["notes"] = "В проверенном корпусе аналог не найден — поле не заполнено."
                systems[code] = slot
                continue

            best = found[0]
            # опциональный фильтр порога (по умолчанию low = вставляем всё найденное)
            if not meets_confidence(str(best.get("confidence") or "low"), min_confidence):
                stats["skipped_not_found"] += 1
                slot["notes"] = (
                    f"Найден источник «{best.get('source') or best.get('document')}», "
                    f"но уверенность {best.get('confidence')} ниже порога {min_confidence}."
                )
                systems[code] = slot
                continue

            stats["hits_raw"] += 1
            stats["applied"] += 1
            conf = str(best.get("confidence") or "medium").lower()
            if conf not in stats["by_confidence"]:
                conf = "medium"
            stats["by_confidence"][conf] += 1
            level = str(meta.get("level_target") or slot.get("level_target") or "")
            source = str(best.get("source") or best.get("document") or "").strip()
            notes = str(best.get("notes") or "").strip()
            if level and "уровень по мосту" not in notes.lower():
                notes = f"{notes} Уровень по мосту: {level}.".strip()
            systems[code] = {
                **slot,
                "title": str(best.get("title") or ""),
                "match": str(best.get("match") or "partial"),
                "notes": notes,
                "level_target": level,
                "confidence": conf,
                "source": source,
                "corpus_id": str(best.get("corpus_id") or ""),
                "uri": "",
            }
        base["systems"] = systems
        out.append(_sync_legacy_esco_fields(base))
    return out, stats


def run_partner_search_for_competence(
    session: Session,
    *,
    competence_id: int,
    version_id: int | None = None,
    target_systems: list[str] | None = None,
    min_confidence: str = "low",
    use_llm_verify: bool = True,
    apply: bool = False,
) -> dict[str, Any]:
    """
    Поиск по паспорту. При apply=True пишет найденное в step3 с источником и уверенностью.
    """
    from .db.competence_models import Competence
    from .db.harmonization_models import HarmonizationVersion, PassportHarmonization
    from .harmonization import empty_step_payload

    comp = session.query(Competence).filter(Competence.id == competence_id).first()
    if not comp:
        raise ValueError(f"Компетенция {competence_id} не найдена")

    if version_id:
        version = session.query(HarmonizationVersion).filter(HarmonizationVersion.id == version_id).first()
    else:
        version = (
            session.query(HarmonizationVersion)
            .filter(HarmonizationVersion.ready_for_apply.is_(True))
            .order_by(HarmonizationVersion.updated_at.desc())
            .first()
        )
        if not version:
            version = (
                session.query(HarmonizationVersion)
                .order_by(HarmonizationVersion.updated_at.desc())
                .first()
            )
    if not version:
        raise ValueError("Нет версии мостов")

    raw = comp.raw_data or {}
    bridge = build_bridge_context_for_passport(
        version,
        qualification_level=comp.qualification_level,
        education_kind=str(raw.get("education_kind") or ""),
        education_level=str(raw.get("education_level") or ""),
    )
    available = bridge.get("systems") if isinstance(bridge.get("systems"), list) else []
    codes = normalize_target_system_codes(target_systems, available)
    if not codes:
        # все не-ESCO из моста, если явно не передали
        codes = [
            str(s.get("code") or "").strip()
            for s in available
            if isinstance(s, dict)
            and str(s.get("code") or "").strip()
            and str(s.get("code") or "").upper() != "ESCO"
        ]
    bridge_f = filter_bridge_context_by_systems(bridge, codes)
    ctx = {
        "title": comp.name,
        "competence_kind": (raw.get("formation_profile") or {}).get("competence_kind") or "professional",
        "qualification_level": comp.qualification_level,
        "labor_functions": comp.labor_functions or [],
        "structure": comp.structure or {},
        "education_level": raw.get("education_level") or "",
        "education_kind": raw.get("education_kind") or "",
        "bridge_context": bridge_f,
        "target_systems": codes,
    }
    seed = heuristic_ai_draft(3, context=ctx)
    rows = _attach_systems_to_rows(list(seed.get("rows") or []), codes, bridge_f)
    rows, stats = apply_verified_to_rows(
        rows,
        selected_codes=codes,
        bridge=bridge_f,
        context=ctx,
        min_confidence=min_confidence,
        use_llm_verify=use_llm_verify,
    )
    payload = {
        "rows": rows,
        "target_systems": codes,
        "search_meta": {
            **stats,
            "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
            "mode": "partner_corpus_search",
        },
    }
    result: dict[str, Any] = {
        "competence_id": competence_id,
        "version_id": version.id,
        "applied": False,
        "stats": stats,
        "payload_preview": {
            "rows_count": len(rows),
            "filled_slots": stats["applied"],
        },
    }
    if not apply:
        result["payload"] = payload
        return result

    row = (
        session.query(PassportHarmonization)
        .filter(
            PassportHarmonization.competence_id == competence_id,
            PassportHarmonization.version_id == version.id,
        )
        .first()
    )
    if not row:
        row = PassportHarmonization(
            competence_id=competence_id,
            version_id=version.id,
            step3_payload=empty_step_payload(3),
            step6_payload=empty_step_payload(6),
        )
        session.add(row)
        session.flush()

    # Сохраняем выбор систем в step6
    step6 = dict(row.step6_payload or {}) if isinstance(row.step6_payload, dict) else {}
    step6["target_systems"] = codes
    row.step6_payload = step6
    if row.step6_status in (None, "empty"):
        row.step6_status = "edited"

    # Мержим с существующим step3: ESCO-слоты сохраняем, не-ESCO перезаписываем результатом поиска
    existing = row.step3_payload if isinstance(row.step3_payload, dict) else {}
    old_rows = existing.get("rows") if isinstance(existing.get("rows"), list) else []
    old_by_id = {
        str(r.get("source_id") or f"i{i}"): r
        for i, r in enumerate(old_rows)
        if isinstance(r, dict)
    }
    merged_rows: list[dict[str, Any]] = []
    for i, new_r in enumerate(rows):
        key = str(new_r.get("source_id") or f"i{i}")
        old = old_by_id.get(key) or {}
        old_systems = old.get("systems") if isinstance(old.get("systems"), dict) else {}
        new_systems = dict(new_r.get("systems") or {})
        # сохранить ESCO из старого, если новое пустое
        for ocode, oslot in old_systems.items():
            if str(ocode).upper() == "ESCO" and isinstance(oslot, dict):
                if not (new_systems.get(ocode) or {}).get("uri") and not (
                    new_systems.get("ESCO") or {}
                ).get("uri"):
                    new_systems[ocode] = oslot
        merged = {**new_r, "systems": new_systems}
        if old.get("esco_uri") and not merged.get("esco_uri"):
            merged["esco_uri"] = old.get("esco_uri")
            merged["esco_title"] = old.get("esco_title")
        merged_rows.append(_sync_legacy_esco_fields(_normalize_step3_row(merged, codes)))

    row.step3_payload = {
        "rows": merged_rows,
        "target_systems": codes,
        "search_meta": payload["search_meta"],
    }
    row.step3_status = "ai_draft"
    row.step3_ai_meta = {
        "mode": "partner_corpus_search",
        "stats": stats,
        "min_confidence": min_confidence,
        "generated_at": payload["search_meta"]["generated_at"],
    }
    row.step3_verified_by_id = None
    row.step3_verified_at = None
    row.updated_at = datetime.datetime.utcnow()
    session.commit()
    result["applied"] = True
    result["payload"] = row.step3_payload
    return result
