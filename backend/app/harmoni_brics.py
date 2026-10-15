"""Harmoni-BRICS: сопоставление с национальными системами стран БРИКС+."""
from __future__ import annotations

import json
from typing import Any

from .deepseek_client import chat_json, deepseek_configured, deepseek_status

BRICS_COUNTRIES: list[dict[str, Any]] = [
    {
        "code": "BR",
        "name_ru": "Бразилия",
        "name_en": "Brazil",
        "nqf": "Catálogo Nacional de Cursos / CBO",
        "nqf_levels": "CBO (занятия) + уровни образования MEC",
        "bridge": "ISCO-08 ↔ CBO; уровни ↔ EQF через ISCED",
    },
    {
        "code": "RU",
        "name_ru": "Россия",
        "name_en": "Russia",
        "nqf": "НСК / приказ № 148н",
        "nqf_levels": "9 уровней квалификации",
        "bridge": "ОКЗ ↔ ISCO-08; 148н ↔ EQF (ГАблицы ГАРМ-ESCO)",
    },
    {
        "code": "IN",
        "name_ru": "Индия",
        "name_en": "India",
        "nqf": "NSQF (National Skills Qualifications Framework)",
        "nqf_levels": "уровни 1–10",
        "bridge": "NSQF → EQF (рабочие таблицы); занятия → NCO / ISCO",
    },
    {
        "code": "CN",
        "name_ru": "Китай",
        "name_en": "China",
        "nqf": "Национальные стандарты профессий / система квалификации",
        "nqf_levels": "национальные уровни профессий + образование",
        "bridge": "занятия → ISCO; образование → ISCED; EQF как meta",
    },
    {
        "code": "ZA",
        "name_ru": "ЮАР",
        "name_en": "South Africa",
        "nqf": "SAQA NQF",
        "nqf_levels": "уровни 1–10",
        "bridge": "SAQA NQF ↔ EQF (referencing); OFO ↔ ISCO",
    },
    {
        "code": "EG",
        "name_ru": "Египет",
        "name_en": "Egypt",
        "nqf": "Egyptian NQF",
        "nqf_levels": "национальная рамка",
        "bridge": "NQF ↔ EQF; занятия → ISCO",
    },
    {
        "code": "ET",
        "name_ru": "Эфиопия",
        "name_en": "Ethiopia",
        "nqf": "Ethiopian NQF",
        "nqf_levels": "национальная рамка",
        "bridge": "NQF ↔ EQF; занятия → ISCO",
    },
    {
        "code": "IR",
        "name_ru": "Иран",
        "name_en": "Iran",
        "nqf": "Национальная система квалификаций",
        "nqf_levels": "национальные уровни",
        "bridge": "занятия → ISCO; EQF как meta",
    },
    {
        "code": "AE",
        "name_ru": "ОАЭ",
        "name_en": "United Arab Emirates",
        "nqf": "QFEmirates",
        "nqf_levels": "уровни QFEmirates",
        "bridge": "QFEmirates ↔ EQF; занятия → ISCO",
    },
    {
        "code": "ID",
        "name_ru": "Индонезия",
        "name_en": "Indonesia",
        "nqf": "KKNI",
        "nqf_levels": "уровни 1–9",
        "bridge": "KKNI ↔ AQRF ↔ EQF; занятия → KBJI / ISCO",
    },
]

# Рабочие мосты 148н → типичный уровень партнёра (эвристика реестра, не акт признания).
LEVEL_BRIDGES: dict[str, dict[int, str]] = {
    "IN": {1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7–8", 8: "9", 9: "10"},
    "ZA": {1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6–7", 7: "8", 8: "9", 9: "10"},
    "ID": {1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7–8", 8: "9", 9: "9"},
    "BR": {1: "ISCED 2", 2: "ISCED 2–3", 3: "ISCED 3", 4: "ISCED 3–4", 5: "ISCED 5", 6: "ISCED 6", 7: "ISCED 7", 8: "ISCED 8", 9: "ISCED 8"},
    "CN": {1: "entry", 2: "entry", 3: "skilled", 4: "skilled", 5: "technician", 6: "bachelor-eq", 7: "master-eq", 8: "research", 9: "research+"},
    "AE": {1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "8–9"},
    "EG": {1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "8"},
    "ET": {1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "8"},
    "IR": {1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "8"},
    "RU": {1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9"},
}

RELATION_TYPES = ("equivalent", "broader", "narrower", "related", "none")
REGIME_TYPES = ("notify", "adapt", "refuse")


def list_countries() -> list[dict[str, Any]]:
    return BRICS_COUNTRIES


def get_country(code: str) -> dict[str, Any] | None:
    needle = (code or "").strip().upper()
    for row in BRICS_COUNTRIES:
        if row["code"] == needle:
            return row
    return None


def _parse_level(value: Any) -> int | None:
    try:
        n = int(str(value).strip().split(".")[0])
    except (TypeError, ValueError):
        return None
    return n if 1 <= n <= 9 else None


def heuristic_suggest(payload: dict[str, Any]) -> dict[str, Any]:
    """Черновик без LLM: мост по ISCO/EQF и таблице уровней."""
    country = get_country(str(payload.get("target_country") or ""))
    if not country:
        raise ValueError("Неизвестная страна БРИКС")

    level = _parse_level(payload.get("qualification_level"))
    eqf = payload.get("eqf_occupational")
    if eqf is None and level is not None:
        eqf = 8 if level == 9 else level

    isco = str(payload.get("isco") or payload.get("okz") or "").strip()
    partner_level = ""
    if level is not None:
        partner_level = LEVEL_BRIDGES.get(country["code"], {}).get(level, "")

    title = str(payload.get("title") or "").strip()
    national_only_hints: list[str] = []
    for item in payload.get("structure_c") or []:
        text = str(item).strip()
        if text and any(token in text.lower() for token in ("рф", "кодекс", "фз ", "приказ мин", "гк ", "гпк ")):
            national_only_hints.append(text[:180])

    admitted = bool(payload.get("admitted_garm", True))
    if str(payload.get("competence_kind") or "") == "professional" and not (
        payload.get("labor_functions") or []
    ):
        admitted = False

    relation = "narrower" if admitted and isco else "related"
    if not admitted:
        relation = "none"
    if national_only_hints and relation == "equivalent":
        relation = "narrower"

    regime = "adapt" if national_only_hints else ("notify" if relation in ("equivalent", "narrower") else "refuse")
    if relation == "none":
        regime = "refuse"

    confidence = "medium" if admitted and isco else "low"
    if national_only_hints:
        confidence = "medium"

    rationale = (
        f"Эвристический черновик Harmoni-BRICS для {country['name_ru']} ({country['nqf']}). "
        f"Мост: {country['bridge']}. "
        f"Уровень 148н={level or '—'} → партнёрский ориентир «{partner_level or '—'}»; "
        f"EQF meta={eqf if eqf is not None else '—'}. "
        "Требуется проверка экспертом; ИИ-агент не вызывался."
    )

    return {
        "admitted": admitted,
        "deny_reason": "" if admitted else "no-tf",
        "target_country": country["code"],
        "partner_nqf_name": country["nqf"],
        "partner_nqf_level": partner_level,
        "partner_occupation_code": isco,
        "partner_occupation_title": title[:120] if title else "",
        "isco": isco,
        "eqf_meta": eqf,
        "relation_type": relation,
        "mobility_regime": regime,
        "confidence": confidence,
        "national_only": national_only_hints[:8],
        "rationale": rationale,
        "assistant": "heuristic",
        "model": None,
        "disclaimer": "Черновик. Не является актом взаимного признания квалификаций.",
    }


SYSTEM_PROMPT = """You are the Harmoni-BRICS AI agent for a national competency registry.
You propose a DRAFT crosswalk from a Russian competency passport to a BRICS+ partner national qualifications system.
Rules:
1. Never invent official recognition or licence to practise.
2. Prefer ISCO-08 and EQF as pivot layers.
3. Mark Russia-specific law/procedure items as national_only.
4. relation_type must be one of: equivalent, broader, narrower, related, none.
5. mobility_regime must be one of: notify, adapt, refuse.
6. confidence must be one of: high, medium, low.
7. Respond with a single JSON object only, matching the schema in the user message.
8. Keep rationale concise (max 800 characters), in Russian.
"""


def _build_user_prompt(payload: dict[str, Any], country: dict[str, Any]) -> str:
    schema = {
        "admitted": "boolean",
        "deny_reason": "string",
        "target_country": country["code"],
        "partner_nqf_name": "string",
        "partner_nqf_level": "string",
        "partner_occupation_code": "string",
        "partner_occupation_title": "string",
        "isco": "string",
        "eqf_meta": "number|null",
        "relation_type": "equivalent|broader|narrower|related|none",
        "mobility_regime": "notify|adapt|refuse",
        "confidence": "high|medium|low",
        "national_only": ["string"],
        "rationale": "string",
    }
    return (
        "Target country profile:\n"
        + json.dumps(country, ensure_ascii=False)
        + "\n\nCompetency passport payload:\n"
        + json.dumps(payload, ensure_ascii=False)
        + "\n\nReturn JSON with keys:\n"
        + json.dumps(schema, ensure_ascii=False)
    )


def _normalize_suggestion(raw: dict[str, Any], country: dict[str, Any], source: str, model: str | None) -> dict[str, Any]:
    relation = str(raw.get("relation_type") or "related").strip().lower()
    if relation not in RELATION_TYPES:
        relation = "related"
    regime = str(raw.get("mobility_regime") or "adapt").strip().lower()
    if regime not in REGIME_TYPES:
        regime = "adapt"
    confidence = str(raw.get("confidence") or "low").strip().lower()
    if confidence not in ("high", "medium", "low"):
        confidence = "low"
    national = raw.get("national_only") or []
    if not isinstance(national, list):
        national = [str(national)]
    eqf = raw.get("eqf_meta")
    try:
        eqf_n = int(eqf) if eqf is not None and str(eqf).strip() != "" else None
    except (TypeError, ValueError):
        eqf_n = None
    return {
        "admitted": bool(raw.get("admitted", True)),
        "deny_reason": str(raw.get("deny_reason") or ""),
        "target_country": country["code"],
        "partner_nqf_name": str(raw.get("partner_nqf_name") or country["nqf"]),
        "partner_nqf_level": str(raw.get("partner_nqf_level") or ""),
        "partner_occupation_code": str(raw.get("partner_occupation_code") or ""),
        "partner_occupation_title": str(raw.get("partner_occupation_title") or ""),
        "isco": str(raw.get("isco") or ""),
        "eqf_meta": eqf_n,
        "relation_type": relation,
        "mobility_regime": regime,
        "confidence": confidence,
        "national_only": [str(x)[:240] for x in national if str(x).strip()][:12],
        "rationale": str(raw.get("rationale") or "")[:1200],
        "assistant": source,
        "model": model,
        "disclaimer": "Черновик ассистента. Не является актом взаимного признания квалификаций.",
    }


def suggest_mapping(payload: dict[str, Any]) -> dict[str, Any]:
    country = get_country(str(payload.get("target_country") or ""))
    if not country:
        raise ValueError("Неизвестная страна БРИКС")

    if not deepseek_configured():
        result = heuristic_suggest(payload)
        result["assistant"] = "heuristic"
        result["status"] = deepseek_status()
        return result

    try:
        raw = chat_json(system=SYSTEM_PROMPT, user=_build_user_prompt(payload, country))
        status = deepseek_status()
        result = _normalize_suggestion(raw, country, "ai-agent", status.get("model"))
        result["status"] = status
        return result
    except Exception as exc:
        fallback = heuristic_suggest(payload)
        fallback["assistant"] = "heuristic-fallback"
        fallback["rationale"] = (
            f"ИИ-агент недоступен ({exc}). Показан эвристический черновик. "
            + str(fallback.get("rationale") or "")
        )[:1200]
        fallback["status"] = deepseek_status()
        return fallback
