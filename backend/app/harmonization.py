"""Международное сопоставление (раздел 9.2): версии, шаги ТЗ, черновики ИИ-агента."""
from __future__ import annotations

import copy
import datetime
from typing import Any

from .deepseek_client import chat_json, deepseek_configured, deepseek_status

GLOBAL_STEPS = (1, 2, 4, 5)
PASSPORT_STEPS = (3, 6)
STEP_STATUSES = ("empty", "ai_draft", "edited", "verified")
VERSION_STATUSES = ("draft", "in_review", "archived")

PURPOSES = (
    "network_programs",
    "graduate_matching",
    "education_export",
    "migration",
)


def systems_from_registries(registries: Any) -> list[dict[str, str]]:
    """Системы шага 1 → список для матрицы уровней (шаг 2)."""
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    if not isinstance(registries, list):
        return out
    for row in registries:
        if not isinstance(row, dict):
            continue
        code = str(row.get("code") or "").strip()
        if not code:
            continue
        key = code.upper()
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "code": code,
                "name": str(row.get("name") or code).strip(),
                "region": str(row.get("region") or "").strip(),
            }
        )
    return out


def estimate_target_level(nsk: int, system: dict[str, str] | None = None, *, code: str = "") -> str:
    """Эвристика уровня по открытым шкалам НРК/мета-рамок (через EQF-мост)."""
    code_u = (code or (system or {}).get("code") or "").strip().upper()
    name_u = str((system or {}).get("name") or "").upper()
    region_u = str((system or {}).get("region") or "").upper()
    blob = f"{code_u} {name_u} {region_u}"
    eqf = 8 if nsk >= 9 else max(1, min(8, nsk))

    if code_u in ("EQF", "ESCO") or "ESCO" in blob or blob.strip() == "EQF":
        return str(eqf)
    if "ONET" in code_u or "O*NET" in blob or "O*NET" in name_u:
        # Job Zones 1–5
        if nsk <= 2:
            return "1"
        if nsk <= 4:
            return "2"
        if nsk <= 6:
            return "3"
        if nsk <= 8:
            return "4"
        return "5"
    if "CTDL" in code_u or "CREDENTIAL" in blob:
        return f"≈EQF {eqf}"
    if (
        "NSQF" in code_u
        or "NQR" in code_u
        or "ИНДИ" in region_u
        or "INDIA" in region_u
        or code_u == "IN"
    ):
        # NSQF: 10 уровней; НСК 1–8 ≈ NSQF 1–8, НСК 9 ≈ 9–10
        return "9–10" if nsk >= 9 else str(nsk)
    if (
        "QFEM" in code_u
        or "EMIRAT" in blob
        or "ОАЭ" in region_u
        or "UAE" in region_u
        or code_u == "AE"
    ):
        # QFEmirates: 10 уровней
        return "9–10" if nsk >= 9 else str(nsk)
    if "SAQA" in blob or "ЮАР" in region_u or "SOUTH AFRICA" in region_u or code_u == "ZA":
        # NQF ЮАР: 10 уровней
        return "9–10" if nsk >= 9 else str(nsk)
    if "VNQF" in code_u or "ВЬЕТНАМ" in region_u or "VIETNAM" in region_u or code_u == "VN":
        # VNQF: 8 уровней
        return str(eqf)
    if "АРМЕНИ" in region_u or code_u == "AM" or "ANQF" in code_u:
        return str(eqf)
    if "КАЗАХ" in region_u or code_u == "KZ" or "NQF-K" in code_u:
        return str(eqf)
    if "КИТАЙ" in region_u or "CHINA" in region_u or code_u == "CN":
        return f"≈EQF {eqf}"
    if "NQF" in code_u or "НРК" in name_u or "QUALIFICATION FRAMEWORK" in blob:
        # Типичная 8-уровневая НРК через EQF
        return str(eqf)
    return str(eqf)


def build_bridges_for_systems(systems: list[dict[str, str]]) -> list[dict[str, Any]]:
    if not systems:
        systems = systems_from_registries(DEFAULT_REGISTRIES)
    by_code = {s["code"]: s for s in systems if s.get("code")}
    codes = list(by_code.keys())
    bridges: list[dict[str, Any]] = []
    for n in range(1, 10):
        targets = {
            code: estimate_target_level(n, by_code.get(code), code=code) for code in codes
        }
        bridges.append(
            {
                "nsk_level": n,
                "eqf": 8 if n == 9 else n,
                "targets": targets,
                "source": "seed",
                "confidence": "medium",
            }
        )
    return bridges


def fill_empty_bridge_targets(
    bridges: list[dict[str, Any]],
    systems: list[dict[str, str]],
) -> list[dict[str, Any]]:
    """Дозаполняет пустые targets эвристикой по открытым шкалам."""
    by_code = {s["code"]: s for s in systems if s.get("code")}
    codes = list(by_code.keys())
    out: list[dict[str, Any]] = []
    for row in bridges:
        if not isinstance(row, dict):
            continue
        synced = dict(row)
        try:
            nsk = int(row.get("nsk_level") or 0)
        except (TypeError, ValueError):
            nsk = 0
        targets = dict(row.get("targets") or {}) if isinstance(row.get("targets"), dict) else {}
        for code in codes:
            val = str(targets.get(code) or "").strip()
            if not val or val in ("…", "...", "?", "n/a", "N/A", "null"):
                targets[code] = estimate_target_level(nsk, by_code.get(code), code=code) if nsk else ""
        if codes:
            targets = {k: v for k, v in targets.items() if k in codes}
        synced["targets"] = targets
        if not synced.get("eqf"):
            synced["eqf"] = 8 if nsk >= 9 else (nsk or "")
        out.append(synced)
    return out


def sync_bridges_payload_with_systems(
    payload: dict[str, Any] | None,
    registries: Any,
) -> dict[str, Any]:
    """Гарантирует, что в targets шага 2 есть все системы из шага 1."""
    systems = systems_from_registries(registries)
    if not systems:
        systems = systems_from_registries(DEFAULT_REGISTRIES)
    codes = [s["code"] for s in systems]
    base = dict(payload or {})
    bridges = base.get("bridges")
    if not isinstance(bridges, list) or not bridges:
        base["systems"] = systems
        base["bridges"] = build_bridges_for_systems(systems)
        base.setdefault("gaps", [])
        return base
    synced_bridges: list[dict[str, Any]] = []
    for row in bridges:
        if not isinstance(row, dict):
            continue
        targets = dict(row.get("targets") or {}) if isinstance(row.get("targets"), dict) else {}
        for code in codes:
            if code not in targets:
                targets[code] = ""
        # убираем targets, которых больше нет в шаге 1 (кроме пустого набора)
        if codes:
            targets = {k: v for k, v in targets.items() if k in codes}
        synced = dict(row)
        synced["targets"] = targets
        synced_bridges.append(synced)
    base["systems"] = systems
    base["bridges"] = fill_empty_bridge_targets(synced_bridges, systems)
    gaps = base.get("gaps") if isinstance(base.get("gaps"), list) else []
    base["gaps"] = gaps
    return base


def empty_step_payload(step: int) -> dict[str, Any]:
    if step == 1:
        return {"registries": copy.deepcopy(DEFAULT_REGISTRIES)}
    if step == 2:
        systems = systems_from_registries(DEFAULT_REGISTRIES)
        return {
            "systems": systems,
            "bridges": build_bridges_for_systems(systems),
            "gaps": [],
        }
    if step == 4:
        return {
            "education_map": copy.deepcopy(DEFAULT_EDUCATION_MAP),
            "partner_education": copy.deepcopy(DEFAULT_PARTNER_EDUCATION),
        }
    if step == 5:
        systems = systems_from_registries(DEFAULT_REGISTRIES)
        return {
            "systems": systems,
            "component_rules": build_component_rules_for_systems(systems),
        }
    if step == 3:
        return {"rows": [], "target_systems": []}
    if step == 6:
        return {
            "purpose": "",
            "purposes": [],
            "depth": "medium",
            "target_systems": [],
            "requirements": {
                "data": "",
                "formats": "",
                "verification": "",
            },
        }
    return {}


def normalize_purposes(raw: Any, *, fallback_purpose: Any = None) -> list[str]:
    """Список целей сопряжения; пустой список допустим (пользователь ещё не выбрал)."""
    out: list[str] = []
    seen: set[str] = set()
    items: list[Any]
    if isinstance(raw, list):
        items = raw
    elif raw:
        items = [raw]
    else:
        items = []
    if not items and fallback_purpose:
        items = [fallback_purpose]
    for item in items:
        code = str(item or "").strip()
        if not code or code not in PURPOSES or code in seen:
            continue
        seen.add(code)
        out.append(code)
    return out


def merge_purpose_requirements(purposes: list[str]) -> dict[str, str]:
    """Объединяет шаблоны требований по выбранным целям (без дублей)."""
    buckets: dict[str, list[str]] = {"data": [], "formats": [], "verification": []}
    for code in purposes:
        req = PURPOSE_REQUIREMENTS.get(code) or {}
        for key in buckets:
            text = str(req.get(key) or "").strip()
            if text and text not in buckets[key]:
                buckets[key].append(text)
    return {key: "; ".join(vals) for key, vals in buckets.items()}


def depth_for_purposes(purposes: list[str], current: str = "") -> str:
    cur = str(current or "").strip()
    if cur in ("low", "medium", "high"):
        return cur
    if any(p in ("network_programs", "education_export") for p in purposes):
        return "high"
    if purposes:
        return "medium"
    return "medium"


def _passport_text_blob(context: dict[str, Any] | None) -> str:
    context = context or {}
    parts: list[str] = [
        str(context.get("title") or ""),
        str(context.get("education_kind") or ""),
        str(context.get("education_level") or ""),
    ]
    for lf in context.get("labor_functions") or []:
        if isinstance(lf, dict):
            parts.append(str(lf.get("name") or ""))
            parts.append(str(lf.get("code") or ""))
            okz = lf.get("okz_codes")
            if isinstance(okz, list):
                parts.extend(str(x) for x in okz)
            elif okz:
                parts.append(str(okz))
    structure = context.get("structure") or {}
    if isinstance(structure, dict):
        for key in ("A", "B", "C", "knowledge", "skill"):
            for item in structure.get(key) or []:
                if isinstance(item, dict):
                    parts.append(str(item.get("text") or ""))
                else:
                    parts.append(str(item))
    return " ".join(parts).lower()


def detect_passport_domains(context: dict[str, Any] | None) -> list[str]:
    """Грубые домены паспорта для подсказок по страновым системам."""
    blob = _passport_text_blob(context)
    domains: list[str] = []
    if any(
        x in blob
        for x in (
            "пожар",
            "огнебор",
            "огнетуш",
            "спасат",
            "чрезвычайн",
            "firefighter",
            "fire fighter",
            "окз 5411",
        )
    ):
        domains.append("fire_rescue")
    if any(x in blob for x in ("медицин", "сестрин", "фельдшер", "врач", "healthcare", "nurse")):
        domains.append("healthcare")
    if any(x in blob for x in ("строител", "монтаж", "сварк", "construction")):
        domains.append("construction")
    if any(x in blob for x in ("информацион", "программ", "it ", " ict", "разработчик", "software")):
        domains.append("ict")
    return domains


# Публичные ориентиры по страновым системам (не каталог URI — методические подсказки для ИИ).
PARTNER_DOMAIN_REFERENCES: dict[str, dict[str, str]] = {
    "fire_rescue": {
        "KZ": (
            "Казахстан / пожарно-спасательная деятельность: ориентир — Приказ Министра по чрезвычайным "
            "ситуациям Республики Казахстан от 28 декабря 2022 года № 350 (квалификационные требования / "
            "деятельность пожарных). Также НСК РК, цифровой банк навыков, классификатор занятий РК. "
            "В title укажи занятие/квалификацию пожарного (или близкую ТФ); в notes — ссылку на приказ № 350 "
            "и уровень НСК из моста; match=partial, если нет дословного совпадения формулировок."
        ),
        "КАЗАХСТАН": (
            "Казахстан / пожарно-спасательная деятельность: Приказ МЧС РК от 28.12.2022 № 350; НСК; "
            "цифровой банк навыков. Укажи аналог должности/ТФ пожарного и сошлись на приказ в notes."
        ),
    },
}


def _system_is_kazakhstan(code: str, name: str = "", region: str = "") -> bool:
    blob = f"{code} {name} {region}".upper()
    return any(
        x in blob
        for x in (
            "KZ",
            "КАЗАХ",
            "KAZAKH",
            "НСК",
            "NQF-K",
            "NSK-KZ",
            "ENBEK",
        )
    )


def build_partner_mapping_hints(
    selected_codes: list[str],
    bridge: dict[str, Any] | None,
    context: dict[str, Any] | None,
) -> dict[str, str]:
    """Подсказки по выбранным не-ESCO системам с учётом домена паспорта."""
    bridge = bridge if isinstance(bridge, dict) else {}
    systems = bridge.get("systems") if isinstance(bridge.get("systems"), list) else []
    by_code = {
        str(s.get("code") or "").strip(): s
        for s in systems
        if isinstance(s, dict) and str(s.get("code") or "").strip()
    }
    domains = detect_passport_domains(context)
    out: dict[str, str] = {}
    for code in selected_codes:
        if code.upper() == "ESCO":
            continue
        meta = by_code.get(code) or {}
        name = str(meta.get("name") or "")
        region = str(meta.get("region") or "")
        level = str(meta.get("level_target") or "")
        bits: list[str] = [
            f"Система {code} ({name or code}, {region or 'регион не указан'}).",
            "Предложи конкретный аналог занятия/квалификации/трудовой функции на языке системы или на русском.",
            "uri оставь пустым. В notes укажи уровень из моста и известный нормативный/реестровый ориентир.",
        ]
        if level:
            bits.append(f"Уровень по мосту шага 2: {level}.")
        if _system_is_kazakhstan(code, name, region):
            bits.append(
                "Ориентиры Казахстана: НСК РК, цифровой банк навыков (на базе ESCO), "
                "профессиональные стандарты / квалификационные требования ведомств."
            )
            for domain in domains:
                ref = (PARTNER_DOMAIN_REFERENCES.get(domain) or {}).get("KZ") or (
                    PARTNER_DOMAIN_REFERENCES.get(domain) or {}
                ).get("КАЗАХСТАН")
                if ref:
                    bits.append(ref)
        elif domains:
            bits.append(
                "Используй открытые знания о национальной рамке и отраслевых профстандартах этой страны; "
                "не выдумывай несуществующие номера приказов — если документ не уверен, опиши тип источника."
            )
        out[code] = " ".join(bits)
    return out


def _enrich_non_esco_heuristic(
    rows: list[dict[str, Any]],
    *,
    selected_codes: list[str],
    bridge: dict[str, Any] | None,
    context: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Усиливает эвристику для не-ESCO (в т.ч. НРК/НСК Казахстана, пожарная тематика)."""
    domains = detect_passport_domains(context)
    hints = build_partner_mapping_hints(selected_codes, bridge, context)
    systems_meta = {
        str(s.get("code") or "").strip(): s
        for s in ((bridge or {}).get("systems") or [])
        if isinstance(s, dict)
    }
    for row in rows:
        systems = row.get("systems") if isinstance(row.get("systems"), dict) else {}
        for code in selected_codes:
            if code.upper() == "ESCO":
                continue
            slot = systems.get(code)
            if not isinstance(slot, dict):
                continue
            meta = systems_meta.get(code) or {}
            is_kz = _system_is_kazakhstan(
                code, str(meta.get("name") or ""), str(meta.get("region") or "")
            )
            if is_kz and "fire_rescue" in domains:
                if not slot.get("title") or str(slot.get("title") or "").startswith("Аналог в "):
                    slot["title"] = "Пожарный / специалист пожарно-спасательной службы (НСК РК)"
                note_parts = [
                    "Ориентир: Приказ Министра по ЧС Республики Казахстан от 28.12.2022 № 350 "
                    "(квалификационные требования к деятельности пожарных).",
                ]
                if slot.get("level_target"):
                    note_parts.append(f"Уровень по мосту: {slot['level_target']}.")
                if slot.get("rule_hint"):
                    note_parts.append(f"Правило A/B/C: {slot['rule_hint']}.")
                note_parts.append("Требуется экспертная сверка формулировок с текстом приказа.")
                slot["notes"] = " ".join(note_parts)
                slot["match"] = "partial"
            elif hints.get(code) and (
                not slot.get("title") or str(slot.get("title") or "").startswith("Аналог в ")
            ):
                # мягкая заготовка названия
                slot["title"] = slot.get("title") or f"Аналог в {code}"
                if not slot.get("notes"):
                    slot["notes"] = hints[code][:500]
                slot["match"] = slot.get("match") or "partial"
        _sync_legacy_esco_fields(row)
    return rows


DEFAULT_REGISTRIES: list[dict[str, Any]] = [
    {
        "code": "ESCO",
        "name": "ESCO",
        "region": "Европейский союз",
        "unit_type": "навык / занятие",
        "data_format": "RDF, API",
        "api_availability": "open",
        "priority": 1,
        "compatibility": {
            "levels": "yes",
            "labor_functions": "yes",
            "machine_readable": "yes",
            "multilingual": "yes",
            "open_api": "yes",
            "blockchain": "no",
        },
        "description": "Европейская многоязычная таксономия навыков и занятий; приоритетный объект сопоставления с ЦРК.",
        "notes": "Открытый API и машиночитаемые URI. Основной мост для шага 3.",
    },
    {
        "code": "ONET",
        "name": "O*NET",
        "region": "США",
        "unit_type": "занятие / навык",
        "data_format": "Открытая база данных",
        "api_availability": "limited",
        "priority": 5,
        "compatibility": {
            "levels": "no",
            "labor_functions": "yes",
            "machine_readable": "partial",
            "multilingual": "no",
            "open_api": "limited",
            "blockchain": "no",
        },
        "description": "Американская база профессий и требований к навыкам.",
        "notes": "Использовать как вспомогательный источник после ESCO.",
    },
    {
        "code": "CTDL",
        "name": "CTDL / Credential Registry",
        "region": "США",
        "unit_type": "credential / компетенция",
        "data_format": "JSON-LD",
        "api_availability": "open",
        "priority": 4,
        "compatibility": {
            "levels": "partial",
            "labor_functions": "partial",
            "machine_readable": "yes",
            "multilingual": "partial",
            "open_api": "yes",
            "blockchain": "no",
        },
        "description": "Реестр credentials и компетенций в формате JSON-LD.",
        "notes": "Перспективен для экспорта и верифицируемых описаний.",
    },
    {
        "code": "NSQF",
        "name": "NSQF / NQR",
        "region": "Индия",
        "unit_type": "квалификация",
        "data_format": "Цифровая платформа",
        "api_availability": "limited",
        "priority": 2,
        "compatibility": {
            "levels": "yes",
            "labor_functions": "yes",
            "machine_readable": "partial",
            "multilingual": "partial",
            "open_api": "limited",
            "blockchain": "no",
        },
        "description": "Национальная рамка квалификаций Индии (10 уровней).",
        "notes": "Мост уровней ведётся в матрице НРК; полный открытый API отсутствует.",
    },
    {
        "code": "QFEmirates",
        "name": "QFEmirates",
        "region": "ОАЭ",
        "unit_type": "квалификация",
        "data_format": "Цифровая платформа",
        "api_availability": "limited",
        "priority": 3,
        "compatibility": {
            "levels": "yes",
            "labor_functions": "yes",
            "machine_readable": "yes",
            "multilingual": "partial",
            "open_api": "limited",
            "blockchain": "yes",
        },
        "description": "Национальная рамка квалификаций ОАЭ (10 уровней).",
        "notes": "Доступ к данным ограничен; уровни сопоставляются через EQF-мост.",
    },
]

# Совместимость: старые версии могли хранить DEFAULT_BRIDGES с фиксированными странами.
DEFAULT_BRIDGES: list[dict[str, Any]] = build_bridges_for_systems(
    systems_from_registries(
        [
            {"code": "IN", "name": "NSQF", "region": "Индия"},
            {"code": "AE", "name": "QFEmirates", "region": "ОАЭ"},
            {"code": "ZA", "name": "SAQA NQF", "region": "ЮАР"},
            {"code": "VN", "name": "VNQF", "region": "Вьетнам"},
            {"code": "AM", "name": "НРК", "region": "Армения"},
        ]
    )
)

DEFAULT_EDUCATION_MAP: list[dict[str, Any]] = [
    {
        "ru_level": "Среднее общее образование",
        "isced": "3",
        "eqf_range": "3–4",
        "qualification_doc": "Аттестат",
        "nsk_levels": "1–3",
    },
    {
        "ru_level": "Профессиональное обучение (273-ФЗ)",
        "isced": "3–4",
        "eqf_range": "2–5",
        "qualification_doc": "Свидетельство о профессии рабочего / должности служащего",
        "nsk_levels": "1–5",
        "notes": (
            "Вид образования по ст. 73 Федерального закона № 273-ФЗ «Об образовании в РФ»: "
            "профессиональная подготовка, переподготовка и повышение квалификации рабочих и служащих. "
            "Не является СПО; предусматривает присвоение квалификации вплоть до 5-го уровня НСК (пр. 148н)."
        ),
    },
    {
        "ru_level": "СПО (квалифицированные рабочие)",
        "isced": "4",
        "eqf_range": "4",
        "qualification_doc": "Диплом СПО",
        "nsk_levels": "3–5",
    },
    {
        "ru_level": "СПО (специалисты среднего звена)",
        "isced": "5",
        "eqf_range": "5",
        "qualification_doc": "Диплом СПО",
        "nsk_levels": "4–5",
    },
    {
        "ru_level": "Бакалавриат",
        "isced": "6",
        "eqf_range": "6",
        "qualification_doc": "Диплом бакалавра",
        "nsk_levels": "6",
    },
    {
        "ru_level": "Специалитет",
        "isced": "7",
        "eqf_range": "7",
        "qualification_doc": "Диплом специалиста",
        "nsk_levels": "7",
    },
    {
        "ru_level": "Магистратура",
        "isced": "7",
        "eqf_range": "7",
        "qualification_doc": "Диплом магистра",
        "nsk_levels": "7",
    },
    {
        "ru_level": "Аспирантура",
        "isced": "8",
        "eqf_range": "8",
        "qualification_doc": "Диплом об окончании аспирантуры",
        "nsk_levels": "8",
    },
    {
        "ru_level": "Докторантура",
        "isced": "8",
        "eqf_range": "8+",
        "qualification_doc": "Диплом доктора наук",
        "nsk_levels": "9",
    },
]

PROFESSIONAL_TRAINING_MARKER = "профессиональное обучение"

DEFAULT_PARTNER_EDUCATION: list[dict[str, Any]] = [
    {"country": "CN", "bachelor_eq": "Бакалавр", "master_eq": "Магистр", "doctoral_eq": "Доктор"},
    {"country": "IN", "bachelor_eq": "Бакалавр / LL.B", "master_eq": "Магистр / LL.M", "doctoral_eq": "Ph.D."},
    {"country": "ZA", "bachelor_eq": "NQF уровень 8", "master_eq": "NQF уровень 9", "doctoral_eq": "NQF уровень 10"},
    {"country": "AE", "bachelor_eq": "QFEmirates уровень 7", "master_eq": "QFEmirates уровень 8", "doctoral_eq": "QFEmirates уровень 9"},
    {"country": "VN", "bachelor_eq": "NQF уровень 6", "master_eq": "NQF уровень 7", "doctoral_eq": "NQF уровень 8"},
    {"country": "EG", "bachelor_eq": "NQF уровень 6", "master_eq": "NQF уровень 7", "doctoral_eq": "NQF уровень 8"},
    {"country": "KZ", "bachelor_eq": "НСК уровень 6", "master_eq": "НСК уровень 7", "doctoral_eq": "НСК уровень 8"},
    {"country": "BY", "bachelor_eq": "НРК уровень 6", "master_eq": "НРК уровень 7", "doctoral_eq": "НРК уровень 8"},
    {"country": "AM", "bachelor_eq": "НРК уровень 6", "master_eq": "НРК уровень 7", "doctoral_eq": "НРК уровень 8"},
]

CRK_COMPONENTS = ("A", "B", "C", "soft")

# Базовые правила для известных таксономий (код системы из шага 1).
_TAXONOMY_RULES: dict[str, dict[str, str]] = {
    "ESCO": {
        "A": "Knowledge — прямое сопоставление",
        "B": "Skills / Competences (объединение с C)",
        "C": "Skills / Competences (объединение с B)",
        "soft": "Transversal skills",
    },
    "ONET": {
        "A": "Knowledge — прямое сопоставление",
        "B": "Skills",
        "C": "Abilities",
        "soft": "Work styles / Interests",
    },
    "CTDL": {
        "A": "Competency",
        "B": "Competency",
        "C": "Competency",
        "soft": "Competency",
    },
}


def estimate_component_rule(component: str, system: dict[str, str] | None = None, *, code: str = "") -> str:
    """Эвристика правила пересчёта A/B/C/soft → сущность в системе шага 1."""
    code_u = (code or (system or {}).get("code") or "").strip().upper()
    name_u = str((system or {}).get("name") or "").upper()
    region_u = str((system or {}).get("region") or "").upper()
    blob = f"{code_u} {name_u} {region_u}"
    comp = (component or "").strip()

    for tax_code, rules in _TAXONOMY_RULES.items():
        if code_u == tax_code or tax_code in code_u or tax_code in blob.replace("*", ""):
            return rules.get(comp, "")
    if "O*NET" in blob or "ONET" in blob:
        return _TAXONOMY_RULES["ONET"].get(comp, "")
    if "ESCO" in blob:
        return _TAXONOMY_RULES["ESCO"].get(comp, "")
    if "CTDL" in blob or "CREDENTIAL" in blob:
        return _TAXONOMY_RULES["CTDL"].get(comp, "")

    # НРК / квалификационные рамки — нет 1:1 с A/B/C; правило через дескрипторы уровня.
    if (
        "NQF" in code_u
        or "NSQF" in code_u
        or "НРК" in name_u
        or "НСК" in name_u
        or "QUALIFICATION FRAMEWORK" in blob
        or "QFEM" in code_u
    ):
        hints = {
            "A": "Дескрипторы знаний / professional knowledge уровня НРК",
            "B": "Дескрипторы умений / skills уровня НРК",
            "C": "Дескрипторы ответственности / autonomy и практического применения",
            "soft": "Сквозные / core skills дескрипторов уровня (если выделены)",
        }
        return hints.get(comp, "Через дескрипторы уровня НРК (нет прямой таксономии A/B/C)")
    return "Требуется экспертное уточнение правила сопоставления (встроенная таксономия A/B/C отсутствует)"


def _legacy_targets_from_row(row: dict[str, Any]) -> dict[str, str]:
    """Старый формат esco/onet/ctdl → targets."""
    targets: dict[str, str] = {}
    if isinstance(row.get("targets"), dict):
        for k, v in row["targets"].items():
            code = str(k or "").strip()
            if code:
                targets[code] = str(v or "").strip()
    for legacy_key, code in (("esco", "ESCO"), ("onet", "ONET"), ("ctdl", "CTDL")):
        if legacy_key in row and str(row.get(legacy_key) or "").strip():
            targets.setdefault(code, str(row.get(legacy_key) or "").strip())
    return targets


def build_component_rules_for_systems(systems: list[dict[str, str]]) -> list[dict[str, Any]]:
    if not systems:
        systems = systems_from_registries(DEFAULT_REGISTRIES)
    by_code = {s["code"]: s for s in systems if s.get("code")}
    codes = list(by_code.keys())
    notes = {
        "A": "Полное соответствие в таксономиях знаний",
        "B": "Частичное в ESCO (объединение с C)",
        "C": "Частичное; уточнять дескрипторы",
        "soft": "",
    }
    out: list[dict[str, Any]] = []
    for comp in CRK_COMPONENTS:
        targets = {
            code: estimate_component_rule(comp, by_code.get(code), code=code) for code in codes
        }
        out.append({"crk_component": comp, "targets": targets, "notes": notes.get(comp, "")})
    return out


def sync_component_rules_payload_with_systems(
    payload: dict[str, Any] | None,
    registries: Any,
) -> dict[str, Any]:
    """Гарантирует targets шага 5 по всем системам шага 1; мигрирует legacy esco/onet/ctdl."""
    systems = systems_from_registries(registries)
    if not systems:
        systems = systems_from_registries(DEFAULT_REGISTRIES)
    codes = [s["code"] for s in systems]
    by_code = {s["code"]: s for s in systems}
    base = dict(payload or {})
    rules = base.get("component_rules")
    if not isinstance(rules, list) or not rules:
        base["systems"] = systems
        base["component_rules"] = build_component_rules_for_systems(systems)
        return base

    synced: list[dict[str, Any]] = []
    seen_comps: set[str] = set()
    for row in rules:
        if not isinstance(row, dict):
            continue
        comp = str(row.get("crk_component") or "").strip()
        if not comp:
            continue
        seen_comps.add(comp)
        targets = _legacy_targets_from_row(row)
        for code in codes:
            val = str(targets.get(code) or "").strip()
            if not val:
                targets[code] = estimate_component_rule(comp, by_code.get(code), code=code)
        if codes:
            targets = {k: v for k, v in targets.items() if k in codes}
        synced.append(
            {
                "crk_component": comp,
                "targets": targets,
                "notes": str(row.get("notes") or "").strip(),
            }
        )
    for comp in CRK_COMPONENTS:
        if comp not in seen_comps:
            synced.append(
                {
                    "crk_component": comp,
                    "targets": {
                        code: estimate_component_rule(comp, by_code.get(code), code=code)
                        for code in codes
                    },
                    "notes": "",
                }
            )
    # Порядок A, B, C, soft, затем прочие
    order = {c: i for i, c in enumerate(CRK_COMPONENTS)}
    synced.sort(key=lambda r: (order.get(str(r.get("crk_component")), 99), str(r.get("crk_component"))))
    base["systems"] = systems
    base["component_rules"] = synced
    return base


# Совместимость: seed в старом виде больше не храним; строим динамически.
DEFAULT_COMPONENT_RULES: list[dict[str, Any]] = build_component_rules_for_systems(
    systems_from_registries(DEFAULT_REGISTRIES)
)

PURPOSE_REQUIREMENTS: dict[str, dict[str, str]] = {
    "network_programs": {
        "data": "Полное описание A/B/C, уровни, оценочные средства",
        "formats": "JSON-LD, RDF",
        "verification": "Экспертное подтверждение + audit trail",
    },
    "graduate_matching": {
        "data": "ID, уровни, подтверждение",
        "formats": "ESCO XML, JSON-LD",
        "verification": "Экспертное подтверждение",
    },
    "education_export": {
        "data": "Описательные эквиваленты",
        "formats": "Презентационные форматы",
        "verification": "Публичная доступность",
    },
    "migration": {
        "data": "Критические трудовые функции",
        "formats": "Нормативно закреплённые форматы",
        "verification": "Автоматическая проверка + эксперт",
    },
}

# Целевые страны/регионы для поиска реестров-аналогов (шаг 1).
REGISTRY_SEARCH_TARGETS: list[dict[str, str]] = [
    {"region": "Европейский союз", "hints": "ESCO, EQF, Europass, EURES"},
    {"region": "США", "hints": "O*NET, CTDL, Credential Registry, SOC"},
    {"region": "Австралия", "hints": "National Skills Taxonomy, AQF"},
    {"region": "Индия", "hints": "NSQF, NQR, NCO, NSDC"},
    {"region": "ОАЭ", "hints": "QFEmirates, NQC"},
    {"region": "ЮАР", "hints": "SAQA NQF, OFO"},
    {"region": "Вьетнам", "hints": "VNQF, AQRF"},
    {"region": "Китай", "hints": "национальная рамка квалификаций, стандарты профессий"},
    {"region": "Казахстан", "hints": "НСК, цифровой банк навыков на базе ESCO"},
    {"region": "Египет", "hints": "Egyptian NQF, NAQAAE, микроквалификации"},
    {"region": "Беларусь", "hints": "НРК"},
    {"region": "Армения", "hints": "НРК"},
    {"region": "Бразилия", "hints": "CBO, Catálogo Nacional de Cursos"},
    {"region": "Индонезия", "hints": "KKNI, KBJI"},
    {"region": "Иран", "hints": "национальная система квалификаций"},
    {"region": "Эфиопия", "hints": "Ethiopian NQF"},
]


def build_step2_level_matrix_prompt(*, systems: list[dict[str, str]]) -> str:
    codes = [s["code"] for s in systems]
    systems_lines = "\n".join(
        f"- code=`{s['code']}` | name={s['name']} | region={s['region'] or 'не указан'}"
        for s in systems
    )
    targets_example = ", ".join(f'"{c}":"…"' for c in codes[:8])
    if len(codes) > 8:
        targets_example += ", …"
    ref = (
        "Справочник открытых шкал (используй как опору, не оставляй пусто):\n"
        "• НСК РФ (пр. 148н): уровни 1–9.\n"
        "• EQF: уровни 1–8; НСК 9 ↔ EQF 8 (верхняя ступень).\n"
        "• ESCO: сопоставление через EQF (targets[ESCO] = уровень EQF).\n"
        "• NSQF / NQR (Индия): 10 уровней; ориентир НСК n ↔ NSQF n (1–8), НСК 9 ↔ 9–10.\n"
        "• QFEmirates (ОАЭ): 10 уровней; аналогично NSQF через EQF-мост.\n"
        "• SAQA NQF (ЮАР): 10 уровней.\n"
        "• VNQF / многие НРК СНГ и АСЕАН: часто 8 уровней ≈ EQF.\n"
        "• O*NET: Job Zones 1–5 (не 1:1 с НРК): НСК 1–2→1, 3–4→2, 5–6→3, 7–8→4, 9→5.\n"
        "• CTDL / Credential Registry: укажи ≈EQF N, если прямого уровня нет.\n"
        "• Неизвестная НРК: оцени число уровней по типу рамки и дай приближение через EQF "
        "(например «≈EQF 6» или «6»), confidence=low, и опиши допущение в gaps.\n"
    )
    return (
        "Задача: матрица соответствия уровней НСК РФ ко ВСЕМ системам каталога шага 1 "
        "и к EQF как meta-рамке.\n\n"
        "Действуй как методист по сопоставлению квалификационных рамок:\n"
        "1) Для КАЖДОГО nsk_level от 1 до 9 заполни eqf и targets по КАЖДОМУ code из списка — "
        "без пропусков и без пустых строк.\n"
        "2) Рамки и число уровней — открытая методическая информация. "
        "Если нет официальной таблицы «НСК↔система», построй мост через EQF / число уровней "
        "и укажи это в gaps (не пиши «нет данных»).\n"
        "3) Значение targets[code] — короткий уровень или диапазон "
        "(«6», «6–7», «9–10», «Job Zone 3», «≈EQF 5»).\n"
        "4) gaps — по системам, где соответствие приближённое или шкала иная: "
        "обязательно system_code (= code системы), nsk_level (или диапазон), country/region, "
        "reason, approach. Хотя бы по одной записи на систему с нестандартной шкалой "
        "(O*NET, CTDL, 10-уровневые НРК и т.п.).\n"
        "5) source=ai; confidence: high только при устоявшемся мосте (EQF/ESCO), "
        "иначе medium/low.\n"
        "6) Все тексты reason/approach — на русском.\n\n"
        f"{ref}\n"
        f"Системы (ключи targets — поле code):\n{systems_lines}\n\n"
        "Верни ровно 9 элементов bridges (nsk_level 1..9). "
        f"В каждом targets обязательны ВСЕ ключи: {', '.join(codes)}.\n"
        "Строгая схема JSON:\n"
        '{"systems":[{"code","name","region"}],'
        '"bridges":[{"nsk_level":1,"eqf":1,"targets":{'
        + targets_example
        + '},"source":"ai","confidence":"medium"}],'
        '"gaps":[{"nsk_level":"5–6","system_code":"NSQF","country":"Индия",'
        '"reason":"…","approach":"…"}]}'
    )


def build_step1_registry_search_prompt(*, context: dict[str, Any] | None = None) -> str:
    """Промпт: поиск международных/национальных систем для сопоставления с ЦРК."""
    context = context or {}
    targets_lines = "\n".join(
        f"- {row['region']}: ориентиры для поиска — {row['hints']}" for row in REGISTRY_SEARCH_TARGETS
    )
    existing = context.get("existing_registries") or []
    existing_codes = []
    if isinstance(existing, list):
        for item in existing:
            if isinstance(item, dict) and item.get("code"):
                existing_codes.append(str(item.get("code")))
    existing_note = (
        f"Уже есть в каталоге (не дублируй по code): {', '.join(existing_codes)}."
        if existing_codes
        else "Каталог пока пуст или базовый — можно предложить полный набор."
    )
    return (
        "Задача: НАЙДИ и каталогизируй цифровые реестры, классификаторы и рамки квалификаций "
        "разных стран и регионов, пригодные для сопоставления с российским ЦРК "
        "(цифровой реестр компетенций).\n\n"
        "Действуй как исследователь-методист:\n"
        "1) Пройди КАЖДЫЙ регион из списка ниже и предложи 1–3 релевантные системы "
        "(НРК/NQF, реестр навыков, классификатор занятий, credential registry и т.п.).\n"
        "2) Добавь глобальные/региональные системы (ESCO, EQF как meta-рамка только если "
        "это отдельный машиночитаемый ресурс; O*NET; CTDL).\n"
        "3) Для каждой системы оцени совместимость с ЦРК и приоритет для интеграции "
        "(1 = высший приоритет).\n"
        "4) Не выдумывай несуществующие официальные названия: если не уверен — укажи это в notes "
        "и поставь api_availability=unknown или planned.\n"
        "5) description и notes — на русском; region — строго на русском из списка или близкий вариант; "
        "code/name — официальные имена собственные латиницей/как принято.\n\n"
        f"Регионы для поиска:\n{targets_lines}\n\n"
        f"{existing_note}\n\n"
        "Верни НЕ МЕНЕЕ 10 записей в registries. "
        "api_availability: open|limited|planned|none|unknown. "
        "compatibility.*: yes|partial|no|unknown.\n"
        "Строгая схема JSON:\n"
        "{\"registries\":[{\"code\":\"ESCO\",\"name\":\"ESCO\",\"region\":\"Европейский союз\","
        "\"unit_type\":\"навык / занятие\",\"data_format\":\"RDF, API\","
        "\"api_availability\":\"open\",\"priority\":1,"
        "\"compatibility\":{\"levels\":\"yes\",\"labor_functions\":\"yes\","
        "\"machine_readable\":\"yes\",\"multilingual\":\"yes\",\"open_api\":\"yes\","
        "\"blockchain\":\"no\"},"
        "\"description\":\"Кратко: что это и зачем для ЦРК\","
        "\"notes\":\"Ограничения доступа, статус API, риски\"}]}"
    )


def ai_agent_status() -> dict[str, Any]:
    status = deepseek_status()
    return {"configured": bool(status.get("configured")), "model": status.get("model")}


def _iso(dt: datetime.datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def serialize_step(row) -> dict[str, Any]:
    return {
        "step": int(row.step),
        "status": row.status or "empty",
        "payload": row.payload or empty_step_payload(int(row.step)),
        "ai_meta": row.ai_meta or {},
        "verified_by_id": row.verified_by_id,
        "verified_at": _iso(row.verified_at),
        "updated_at": _iso(row.updated_at),
    }


def serialize_version(version, *, include_steps: bool = True) -> dict[str, Any]:
    steps = list(version.steps or [])
    step_map = {int(s.step): s for s in steps}
    payload = {
        "id": version.id,
        "title": version.title or "",
        "status": version.status or "draft",
        "ready_for_apply": bool(version.ready_for_apply),
        "notes": version.notes or "",
        "created_by_id": version.created_by_id,
        "updated_by_id": version.updated_by_id,
        "created_at": _iso(version.created_at),
        "updated_at": _iso(version.updated_at),
        "steps_summary": {
            str(step): (step_map[step].status if step in step_map else "empty")
            for step in GLOBAL_STEPS
        },
    }
    if include_steps:
        payload["steps"] = [
            serialize_step(step_map[step]) if step in step_map else {
                "step": step,
                "status": "empty",
                "payload": empty_step_payload(step),
                "ai_meta": {},
                "verified_by_id": None,
                "verified_at": None,
                "updated_at": None,
            }
            for step in GLOBAL_STEPS
        ]
    return payload


def serialize_passport(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "competence_id": row.competence_id,
        "version_id": row.version_id,
        "step3": {
            "status": row.step3_status or "empty",
            "payload": row.step3_payload or empty_step_payload(3),
            "ai_meta": row.step3_ai_meta or {},
            "verified_by_id": row.step3_verified_by_id,
            "verified_at": _iso(row.step3_verified_at),
        },
        "step6": {
            "status": row.step6_status or "empty",
            "payload": row.step6_payload or empty_step_payload(6),
            "ai_meta": row.step6_ai_meta or {},
            "verified_by_id": row.step6_verified_by_id,
            "verified_at": _iso(row.step6_verified_at),
        },
        "updated_by_id": row.updated_by_id,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _step_payload_map(version) -> dict[int, dict[str, Any]]:
    out: dict[int, dict[str, Any]] = {}
    for st in version.steps or []:
        payload = st.payload if isinstance(st.payload, dict) else {}
        out[int(st.step)] = payload
    return out


def _nsk_int(value: Any) -> int | None:
    try:
        n = int(str(value or "").strip().split(".")[0])
    except (TypeError, ValueError):
        return None
    if n < 1 or n > 9:
        return None
    return n


def build_bridge_context_for_passport(
    version,
    *,
    qualification_level: Any = None,
    education_kind: str = "",
    education_level: str = "",
) -> dict[str, Any]:
    """Контекст моста 1/2/4/5 для шага 9.2 (без изменения шагов 9 и 9.1)."""
    steps = _step_payload_map(version)
    regs = steps.get(1, {}).get("registries") or []
    systems = systems_from_registries(regs)
    bridges = steps.get(2, {}).get("bridges") if isinstance(steps.get(2), dict) else []
    if not isinstance(bridges, list):
        bridges = []
    nsk = _nsk_int(qualification_level)
    level_row: dict[str, Any] | None = None
    if nsk is not None:
        for row in bridges:
            if not isinstance(row, dict):
                continue
            if _nsk_int(row.get("nsk_level")) == nsk:
                level_row = row
                break

    education_map = steps.get(4, {}).get("education_map") if isinstance(steps.get(4), dict) else []
    if not isinstance(education_map, list):
        education_map = []
    edu_blob = f"{education_kind} {education_level}".lower()
    education_row: dict[str, Any] | None = None
    for row in education_map:
        if not isinstance(row, dict):
            continue
        ru = str(row.get("ru_level") or "").lower()
        if not ru:
            continue
        if edu_blob and (ru in edu_blob or any(tok and tok in ru for tok in edu_blob.split() if len(tok) > 4)):
            education_row = row
            break
        if "профессиональн" in edu_blob and "обучен" in edu_blob and "273" in ru:
            education_row = row
            break
    if education_row is None and education_map:
        # мягкий fallback: первая строка с пересечением ключевых слов
        for key in ("бакалавр", "магистр", "специалитет", "спо", "аспирант"):
            if key in edu_blob:
                for row in education_map:
                    if isinstance(row, dict) and key in str(row.get("ru_level") or "").lower():
                        education_row = row
                        break
            if education_row:
                break

    component_rules = steps.get(5, {}).get("component_rules") if isinstance(steps.get(5), dict) else []
    if not isinstance(component_rules, list):
        component_rules = []
    level_targets: dict[str, str] = {}
    if level_row and isinstance(level_row.get("targets"), dict):
        level_targets = {
            str(k).strip(): str(v or "").strip()
            for k, v in level_row["targets"].items()
            if str(k).strip()
        }

    systems_enriched: list[dict[str, Any]] = []
    for s in systems:
        code = s.get("code") or ""
        systems_enriched.append(
            {
                "code": code,
                "name": s.get("name") or code,
                "region": s.get("region") or "",
                "level_target": level_targets.get(code, ""),
            }
        )

    esco_rules: dict[str, str] = {}
    component_by_system: dict[str, dict[str, str]] = {}
    for row in component_rules:
        if not isinstance(row, dict):
            continue
        comp = str(row.get("crk_component") or "").strip().upper()
        targets = row.get("targets") if isinstance(row.get("targets"), dict) else {}
        for code, rule in targets.items():
            c = str(code).strip()
            if not c:
                continue
            component_by_system.setdefault(c, {})
            if comp:
                component_by_system[c][comp] = str(rule or "").strip()
            if c.upper() == "ESCO" and comp:
                esco_rules[comp] = str(rule or "").strip()

    return {
        "version_id": getattr(version, "id", None),
        "version_title": getattr(version, "title", "") or "",
        "ready_for_apply": bool(getattr(version, "ready_for_apply", False)),
        "systems": systems_enriched,
        "nsk_level": nsk,
        "level_bridge": {
            "nsk_level": level_row.get("nsk_level") if level_row else nsk,
            "eqf": level_row.get("eqf") if level_row else None,
            "targets": level_targets,
            "confidence": level_row.get("confidence") if level_row else "",
        }
        if nsk is not None
        else None,
        "education_bridge": education_row,
        "component_rules_esco": esco_rules,
        "component_rules_by_system": component_by_system,
        "component_rules": component_rules[:8],
    }


def normalize_target_system_codes(
    codes: Any,
    available: list[dict[str, Any]] | None = None,
) -> list[str]:
    """Коды выбранных систем; если available задан — только из каталога моста."""
    allowed: set[str] | None = None
    if available is not None:
        allowed = {
            str(s.get("code") or "").strip()
            for s in available
            if isinstance(s, dict) and str(s.get("code") or "").strip()
        }
    out: list[str] = []
    seen: set[str] = set()
    raw = codes if isinstance(codes, list) else []
    for item in raw:
        code = str(item or "").strip()
        if not code or code in seen:
            continue
        if allowed is not None and code not in allowed:
            continue
        seen.add(code)
        out.append(code)
    return out


def filter_bridge_context_by_systems(
    bridge: dict[str, Any] | None,
    codes: list[str] | None,
) -> dict[str, Any]:
    """Оставляет в снимке моста только выбранные системы (для 9.2)."""
    base = dict(bridge or {}) if isinstance(bridge, dict) else {}
    systems = base.get("systems") if isinstance(base.get("systems"), list) else []
    selected = normalize_target_system_codes(codes or [], systems if systems else None)
    if not selected and systems:
        # пустой выбор — снимок без систем (явный отказ от сопоставления)
        selected = []
    code_set = set(selected)
    filtered_systems = [
        s for s in systems if isinstance(s, dict) and str(s.get("code") or "").strip() in code_set
    ]
    lb = dict(base.get("level_bridge") or {}) if isinstance(base.get("level_bridge"), dict) else {}
    targets = lb.get("targets") if isinstance(lb.get("targets"), dict) else {}
    lb["targets"] = {k: v for k, v in targets.items() if str(k).strip() in code_set}
    by_sys = (
        base.get("component_rules_by_system")
        if isinstance(base.get("component_rules_by_system"), dict)
        else {}
    )
    filtered_rules = {k: v for k, v in by_sys.items() if str(k).strip() in code_set}
    esco_rules = base.get("component_rules_esco") if "ESCO" in code_set else {}
    if not isinstance(esco_rules, dict):
        esco_rules = {}
    out = {
        **base,
        "systems": filtered_systems,
        "selected_system_codes": selected,
        "level_bridge": lb if lb else base.get("level_bridge"),
        "component_rules_by_system": filtered_rules,
        "component_rules_esco": esco_rules if "ESCO" in code_set else {},
    }
    return out


def apply_bridge_snapshot_to_step6(
    step6_payload: dict[str, Any] | None,
    bridge: dict[str, Any],
    *,
    target_systems: list[str] | None = None,
) -> dict[str, Any]:
    """Встраивает снимок моста в payload шага 6 (не трогает 9 / 9.1)."""
    base = dict(step6_payload or {}) if isinstance(step6_payload, dict) else {}
    codes = normalize_target_system_codes(
        target_systems if target_systems is not None else base.get("target_systems"),
        bridge.get("systems") if isinstance(bridge.get("systems"), list) else None,
    )
    base["target_systems"] = codes
    filtered = filter_bridge_context_by_systems(bridge, codes)
    base["bridge_snapshot"] = filtered
    base["bridge_applied_at"] = datetime.datetime.utcnow().isoformat() + "Z"
    # Подсказка в requirements.verification, если пусто
    req = dict(base.get("requirements") or {}) if isinstance(base.get("requirements"), dict) else {}
    if not str(req.get("verification") or "").strip():
        eqf = None
        lb = filtered.get("level_bridge") or {}
        if isinstance(lb, dict):
            eqf = lb.get("eqf")
        edu = filtered.get("education_bridge") or {}
        bits = []
        if eqf is not None:
            bits.append(f"EQF из моста шага 2: {eqf}")
        if isinstance(edu, dict) and edu.get("isced"):
            bits.append(f"ISCED из моста шага 4: {edu.get('isced')}")
        if codes:
            bits.append("системы: " + ", ".join(codes))
        if bits:
            req["verification"] = (
                "Сверка с версией мостов «"
                + str(filtered.get("version_title") or filtered.get("version_id") or "")
                + "»: "
                + "; ".join(bits)
                + "."
            )
            base["requirements"] = req
    return base


def ensure_version_steps(session, version) -> None:
    existing = {int(s.step) for s in (version.steps or [])}
    for step in GLOBAL_STEPS:
        if step in existing:
            continue
        from .db.harmonization_models import HarmonizationStepState

        session.add(
            HarmonizationStepState(
                version_id=version.id,
                step=step,
                status="empty",
                payload=empty_step_payload(step),
                ai_meta={},
            )
        )
    session.flush()


def _as_dict_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: list[dict[str, Any]] = []
    for item in value:
        if isinstance(item, dict):
            out.append(item)
    return out


def _pick_list(data: dict[str, Any], *keys: str) -> list[dict[str, Any]]:
    for key in keys:
        if key in data:
            rows = _as_dict_list(data.get(key))
            if rows:
                return rows
    # иногда модель кладёт таблицы внутрь одного объекта
    for nest_key in ("data", "result", "payload", "tables"):
        nested = data.get(nest_key)
        if isinstance(nested, dict):
            found = _pick_list(nested, *keys)
            if found:
                return found
    return []


def normalize_step_payload(
    step: int,
    raw: Any,
    *,
    registries: Any = None,
) -> dict[str, Any]:
    """Приводит ответ ИИ к схеме шага; пустые массивы не затирают seed."""
    base = empty_step_payload(step)
    if not isinstance(raw, dict):
        if step == 2 and registries is not None:
            return sync_bridges_payload_with_systems(base, registries)
        return base
    data = raw

    if step == 1:
        registries = _pick_list(data, "registries", "реестры", "items")
        if registries:
            normalized: list[dict[str, Any]] = []
            for row in registries:
                compat = row.get("compatibility") if isinstance(row.get("compatibility"), dict) else {}
                normalized.append(
                    {
                        "code": str(row.get("code") or row.get("код") or "").strip(),
                        "name": str(row.get("name") or row.get("название") or "").strip(),
                        "region": str(row.get("region") or row.get("регион") or row.get("страна") or "").strip(),
                        "unit_type": str(row.get("unit_type") or row.get("единица") or "").strip(),
                        "data_format": str(row.get("data_format") or row.get("формат") or "").strip(),
                        "api_availability": str(row.get("api_availability") or row.get("api") or "unknown"),
                        "priority": row.get("priority") if row.get("priority") is not None else 99,
                        "compatibility": {
                            "levels": str(compat.get("levels") or "unknown"),
                            "labor_functions": str(compat.get("labor_functions") or "unknown"),
                            "machine_readable": str(compat.get("machine_readable") or "unknown"),
                            "multilingual": str(compat.get("multilingual") or "unknown"),
                            "open_api": str(compat.get("open_api") or "unknown"),
                            "blockchain": str(compat.get("blockchain") or "no"),
                        },
                        "description": str(row.get("description") or row.get("описание") or "").strip(),
                        "notes": str(row.get("notes") or row.get("заметки") or "").strip(),
                    }
                )
            normalized = [r for r in normalized if r["code"] or r["name"]]
            if normalized:
                # Дополняем seed-системами, которых модель не вернула (по code).
                seen = {str(r.get("code") or "").upper() for r in normalized}
                for seed in DEFAULT_REGISTRIES:
                    code = str(seed.get("code") or "").upper()
                    if code and code not in seen:
                        normalized.append(copy.deepcopy(seed))
                        seen.add(code)
                # Числовой приоритет для сортировки
                def _prio(item: dict[str, Any]) -> int:
                    try:
                        return int(item.get("priority") or 99)
                    except (TypeError, ValueError):
                        return 99

                normalized.sort(key=lambda r: (_prio(r), str(r.get("region") or ""), str(r.get("code") or "")))
                base["registries"] = normalized
        return base

    if step == 2:
        bridges = _pick_list(data, "bridges", "matrix", "уровни")
        gaps = _pick_list(data, "gaps", "расхождения")
        systems_raw = data.get("systems") if isinstance(data.get("systems"), list) else None
        if bridges:
            base["bridges"] = bridges
        if gaps or ("gaps" in data and isinstance(data.get("gaps"), list)):
            normalized_gaps: list[dict[str, Any]] = []
            for g in gaps:
                if not isinstance(g, dict):
                    continue
                normalized_gaps.append(
                    {
                        "nsk_level": str(g.get("nsk_level") or g.get("уровень") or "").strip(),
                        "system_code": str(
                            g.get("system_code") or g.get("code") or g.get("система") or ""
                        ).strip(),
                        "country": str(
                            g.get("country") or g.get("region") or g.get("страна") or ""
                        ).strip(),
                        "reason": str(g.get("reason") or g.get("причина") or "").strip(),
                        "approach": str(g.get("approach") or g.get("подход") or "").strip(),
                    }
                )
            base["gaps"] = [g for g in normalized_gaps if g["reason"] or g["approach"] or g["system_code"]]
        if systems_raw:
            base["systems"] = systems_from_registries(systems_raw)
        # Всегда выравниваем targets под системы шага 1 (если переданы) и дозаполняем пустые.
        source_regs = registries if registries is not None else systems_raw
        if source_regs is not None:
            return sync_bridges_payload_with_systems(base, source_regs)
        systems = systems_from_registries(base.get("systems")) or systems_from_registries(DEFAULT_REGISTRIES)
        base["systems"] = systems
        base["bridges"] = fill_empty_bridge_targets(
            base.get("bridges") if isinstance(base.get("bridges"), list) else [],
            systems,
        )
        return base

    if step == 4:
        education_map = _pick_list(
            data,
            "education_map",
            "educationMap",
            "isced_map",
            "education",
            "образование",
        )
        partner_education = _pick_list(
            data,
            "partner_education",
            "partnerEducation",
            "partners",
            "partner_map",
            "страны",
        )
        # нормализация ключей строк education_map
        if education_map:
            normalized_edu: list[dict[str, Any]] = []
            for row in education_map:
                # Уровень сформированности компетенции в этот шаг не входит — отбрасываем.
                normalized_edu.append(
                    {
                        "ru_level": str(
                            row.get("ru_level")
                            or row.get("level_ru")
                            or row.get("education_level")
                            or row.get("уровень")
                            or ""
                        ),
                        "isced": str(row.get("isced") or row.get("ISCED") or row.get("isced_level") or ""),
                        "eqf_range": str(row.get("eqf_range") or row.get("eqf") or row.get("EQF") or ""),
                        "qualification_doc": str(
                            row.get("qualification_doc")
                            or row.get("document")
                            or row.get("документ")
                            or ""
                        ),
                        "nsk_levels": str(
                            row.get("nsk_levels") or row.get("nsk") or row.get("НСК") or row.get("qualification_levels") or ""
                        ),
                        "notes": str(row.get("notes") or row.get("заметки") or "").strip(),
                    }
                )
            if any(r["ru_level"] or r["isced"] for r in normalized_edu):
                # Гарантируем строку про профессиональное обучение (273-ФЗ), если модель её пропустила.
                has_prof_training = any(
                    PROFESSIONAL_TRAINING_MARKER in str(r.get("ru_level") or "").lower()
                    for r in normalized_edu
                )
                if not has_prof_training:
                    seed_pt = next(
                        (
                            copy.deepcopy(r)
                            for r in DEFAULT_EDUCATION_MAP
                            if PROFESSIONAL_TRAINING_MARKER in str(r.get("ru_level") or "").lower()
                        ),
                        None,
                    )
                    if seed_pt:
                        # Вставляем после среднего общего, иначе в начало.
                        insert_at = 1 if normalized_edu else 0
                        for i, r in enumerate(normalized_edu):
                            if "среднее общее" in str(r.get("ru_level") or "").lower():
                                insert_at = i + 1
                                break
                        normalized_edu.insert(insert_at, seed_pt)
                base["education_map"] = normalized_edu
        if partner_education:
            normalized_partners: list[dict[str, Any]] = []
            for row in partner_education:
                normalized_partners.append(
                    {
                        "country": str(row.get("country") or row.get("код") or row.get("country_code") or ""),
                        "bachelor_eq": str(
                            row.get("bachelor_eq")
                            or row.get("bachelor")
                            or row.get("бакалавриат")
                            or ""
                        ),
                        "master_eq": str(
                            row.get("master_eq") or row.get("master") or row.get("магистратура") or ""
                        ),
                        "doctoral_eq": str(
                            row.get("doctoral_eq")
                            or row.get("doctoral")
                            or row.get("аспирантура")
                            or ""
                        ),
                    }
                )
            if any(r["country"] for r in normalized_partners):
                base["partner_education"] = normalized_partners
        # qual_formation / уровень сформированности — больше не используем на шаге 4
        base.pop("qual_formation", None)
        return base

    if step == 5:
        rules = _pick_list(data, "component_rules", "rules", "components")
        if rules:
            normalized_rules: list[dict[str, Any]] = []
            for row in rules:
                if not isinstance(row, dict):
                    continue
                comp = str(row.get("crk_component") or row.get("component") or row.get("компонент") or "").strip()
                if not comp:
                    continue
                targets = _legacy_targets_from_row(row)
                # Иногда модель кладёт правила плоско: {"ESCO": "...", "NSQF": "..."}
                for k, v in row.items():
                    if k in (
                        "crk_component",
                        "component",
                        "компонент",
                        "targets",
                        "notes",
                        "esco",
                        "onet",
                        "ctdl",
                        "примечание",
                    ):
                        continue
                    if isinstance(v, (str, int, float)) and str(k).strip():
                        targets.setdefault(str(k).strip(), str(v).strip())
                normalized_rules.append(
                    {
                        "crk_component": comp,
                        "targets": targets,
                        "notes": str(row.get("notes") or row.get("примечание") or "").strip(),
                    }
                )
            if normalized_rules:
                base["component_rules"] = normalized_rules
        source_regs = registries if registries is not None else data.get("systems")
        if source_regs is not None:
            return sync_component_rules_payload_with_systems(base, source_regs)
        return sync_component_rules_payload_with_systems(base, DEFAULT_REGISTRIES)

    if step == 3:
        rows = _pick_list(data, "rows", "mappings", "items")
        codes = normalize_target_system_codes(
            data.get("target_systems") if "target_systems" in data else base.get("target_systems")
        )
        normalized_rows: list[dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            normalized_rows.append(_normalize_step3_row(row, codes or None))
        out = {"rows": normalized_rows, "target_systems": codes}
        return out

    if step == 6:
        # Цели задаёт пользователь (чекбоксы). LLM/эвристика не подменяют их на migration.
        purposes = normalize_purposes(
            data.get("purposes") if "purposes" in data else base.get("purposes"),
            fallback_purpose=data.get("purpose") if data.get("purpose") else base.get("purpose"),
        )
        # Если в ответе модели есть purpose, но purposes пуст и в base уже были — берем base
        if not purposes:
            purposes = normalize_purposes(base.get("purposes"), fallback_purpose=base.get("purpose"))
        primary = purposes[0] if purposes else ""
        req_raw = data.get("requirements") if isinstance(data.get("requirements"), dict) else {}
        defaults = merge_purpose_requirements(purposes) if purposes else {"data": "", "formats": "", "verification": ""}
        out = {
            "purpose": primary,
            "purposes": purposes,
            "depth": depth_for_purposes(
                purposes,
                str(data.get("depth") or base.get("depth") or "medium"),
            ),
            "target_systems": normalize_target_system_codes(
                data.get("target_systems")
                if "target_systems" in data
                else base.get("target_systems")
            ),
            "requirements": {
                "data": str(req_raw.get("data") or defaults["data"]),
                "formats": str(req_raw.get("formats") or defaults["formats"]),
                "verification": str(req_raw.get("verification") or defaults["verification"]),
            },
        }
        # Снимок моста (9.2) не затираем черновиком ИИ шага 6
        for key in ("bridge_snapshot", "bridge_applied_at"):
            if key in data and data.get(key) is not None:
                out[key] = data[key]
            elif key in base and base.get(key) is not None:
                out[key] = base[key]
        return out

    # неизвестный шаг — мягкий merge без пустых списков
    merged = dict(base)
    for key, value in data.items():
        if value is None:
            continue
        if isinstance(value, list) and not value:
            continue
        merged[key] = value
    return merged


def heuristic_ai_draft(step: int, *, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Черновик без LLM: seed / эвристика по паспорту."""
    context = context or {}
    if step == 2:
        regs = context.get("registries") or context.get("existing_registries") or DEFAULT_REGISTRIES
        return sync_bridges_payload_with_systems(empty_step_payload(2), regs)
    if step == 5:
        regs = context.get("registries") or context.get("existing_registries") or DEFAULT_REGISTRIES
        return sync_component_rules_payload_with_systems(empty_step_payload(5), regs)
    if step in (1, 4):
        return empty_step_payload(step)
    if step == 6:
        purposes = normalize_purposes(
            context.get("purposes"),
            fallback_purpose=context.get("purpose"),
        )
        req = merge_purpose_requirements(purposes)
        return {
            "purpose": purposes[0] if purposes else "",
            "purposes": purposes,
            "depth": depth_for_purposes(purposes, str(context.get("depth") or "")),
            "target_systems": normalize_target_system_codes(context.get("target_systems")),
            "requirements": dict(req),
        }
    # step 3 — строки паспорта + слоты по выбранным системам моста
    rows: list[dict[str, Any]] = []
    for lf in context.get("labor_functions") or []:
        text = str(lf.get("name") or lf.get("code") or "").strip()
        if not text:
            continue
        rows.append(
            {
                "source_type": "tf",
                "source_id": str(lf.get("code") or ""),
                "source_text": text,
                "esco_uri": "",
                "esco_title": "",
                "match": "partial",
                "notes": "",
                "systems": {},
            }
        )
    structure = context.get("structure") or {}
    for component, key in (("A", "knowledge"), ("B", "skill"), ("C", "skill")):
        for item in structure.get(component) or []:
            text = str(item).strip() if not isinstance(item, dict) else str(item.get("text") or "").strip()
            if not text:
                continue
            rows.append(
                {
                    "source_type": key if component != "A" else "knowledge",
                    "source_id": component,
                    "source_text": text[:500],
                    "esco_uri": "",
                    "esco_title": "",
                    "match": "partial",
                    "notes": "",
                    "systems": {},
                }
            )
    bridge = context.get("bridge_context") if isinstance(context.get("bridge_context"), dict) else {}
    codes = normalize_target_system_codes(
        context.get("target_systems"),
        bridge.get("systems") if isinstance(bridge.get("systems"), list) else None,
    )
    rows = _attach_systems_to_rows(rows[:40], codes, bridge)
    # Не-ESCO: только слоты и подсказки уровня; title/match заполняет корпусной поиск
    # (partner_mapping_search) при достаточной уверенности — иначе остаётся пусто.
    for row in rows:
        systems = row.get("systems") if isinstance(row.get("systems"), dict) else {}
        for code, slot in systems.items():
            if not isinstance(slot, dict) or str(code).upper() == "ESCO":
                continue
            if not slot.get("title"):
                slot["match"] = "none"
    return {"rows": rows, "target_systems": codes}


def _latin_query(text: str, limit: int = 6) -> str:
    """Короткая латинская подстрока для поиска в ESCO (английские title)."""
    import re

    parts = re.findall(r"[A-Za-z][A-Za-z0-9\-/]{2,}", text or "")
    if parts:
        return " ".join(parts[:limit])
    # fallback: первые значимые слова исходного текста (API/локаль могут не найти)
    words = [w for w in re.split(r"\s+", (text or "").strip()) if len(w) > 3][:4]
    return " ".join(words)


def _empty_system_mapping(
    code: str,
    *,
    bridge: dict[str, Any] | None = None,
    source_type: str = "",
) -> dict[str, Any]:
    """Слот сопоставления одной системы для строки шага 3."""
    bridge = bridge if isinstance(bridge, dict) else {}
    level = ""
    systems = bridge.get("systems") if isinstance(bridge.get("systems"), list) else []
    for s in systems:
        if isinstance(s, dict) and str(s.get("code") or "").strip() == code:
            level = str(s.get("level_target") or "").strip()
            break
    if not level:
        lb = bridge.get("level_bridge") if isinstance(bridge.get("level_bridge"), dict) else {}
        targets = lb.get("targets") if isinstance(lb.get("targets"), dict) else {}
        level = str(targets.get(code) or "").strip()

    rule_hint = ""
    by_sys = (
        bridge.get("component_rules_by_system")
        if isinstance(bridge.get("component_rules_by_system"), dict)
        else {}
    )
    rules = by_sys.get(code) if isinstance(by_sys.get(code), dict) else {}
    if source_type in ("knowledge",) and rules.get("A"):
        rule_hint = str(rules.get("A") or "")
    elif source_type in ("skill",) and (rules.get("B") or rules.get("C")):
        rule_hint = str(rules.get("B") or rules.get("C") or "")
    elif rules:
        rule_hint = " | ".join(f"{k}: {v}" for k, v in list(rules.items())[:3] if v)

    return {
        "system_code": code,
        "uri": "",
        "title": "",
        "match": "partial",
        "notes": "",
        "level_target": level,
        "rule_hint": rule_hint,
        "confidence": "",
        "source": "",
        "corpus_id": "",
    }


def _sync_legacy_esco_fields(row: dict[str, Any]) -> dict[str, Any]:
    """Дублирует systems.ESCO → esco_* для совместимости."""
    systems = row.get("systems") if isinstance(row.get("systems"), dict) else {}
    esco = systems.get("ESCO") if isinstance(systems.get("ESCO"), dict) else None
    if esco is None:
        # найти по регистру
        for key, val in systems.items():
            if str(key).upper() == "ESCO" and isinstance(val, dict):
                esco = val
                break
    if esco:
        row["esco_uri"] = str(esco.get("uri") or "")
        row["esco_title"] = str(esco.get("title") or "")
        row["match"] = str(esco.get("match") or row.get("match") or "partial")
        if esco.get("notes") and not row.get("notes"):
            row["notes"] = str(esco.get("notes") or "")
    return row


def _normalize_step3_row(row: dict[str, Any], codes: list[str] | None = None) -> dict[str, Any]:
    """Нормализует строку шага 3: systems по выбранным кодам + legacy ESCO-поля."""
    out = {
        "source_type": str(row.get("source_type") or "").strip(),
        "source_id": str(row.get("source_id") or "").strip(),
        "source_text": str(row.get("source_text") or "").strip(),
        "notes": str(row.get("notes") or "").strip(),
        "match": str(row.get("match") or "partial").strip() or "partial",
        "esco_uri": str(row.get("esco_uri") or "").strip(),
        "esco_title": str(row.get("esco_title") or "").strip(),
        "systems": {},
    }
    raw_systems = row.get("systems") if isinstance(row.get("systems"), dict) else {}
    # Миграция со старого формата: только esco_*
    if not raw_systems and (out["esco_uri"] or out["esco_title"]):
        raw_systems = {
            "ESCO": {
                "system_code": "ESCO",
                "uri": out["esco_uri"],
                "title": out["esco_title"],
                "match": out["match"],
                "notes": out["notes"],
                "level_target": "",
                "rule_hint": "",
            }
        }
    wanted = codes if codes is not None else list(raw_systems.keys())
    systems: dict[str, Any] = {}
    for code in wanted:
        c = str(code or "").strip()
        if not c:
            continue
        prev = raw_systems.get(c) if isinstance(raw_systems.get(c), dict) else {}
        # регистр ESCO
        if not prev:
            for k, v in raw_systems.items():
                if str(k).upper() == c.upper() and isinstance(v, dict):
                    prev = v
                    break
        conf = str(prev.get("confidence") or "").strip().lower()
        if conf not in ("high", "medium", "low"):
            conf = ""
        slot = {
            "system_code": c,
            "uri": str(prev.get("uri") or "").strip(),
            "title": str(prev.get("title") or "").strip(),
            "match": str(prev.get("match") or "partial").strip() or "partial",
            "notes": str(prev.get("notes") or "").strip(),
            "level_target": str(prev.get("level_target") or "").strip(),
            "rule_hint": str(prev.get("rule_hint") or "").strip(),
            "confidence": conf,
            "source": str(prev.get("source") or prev.get("document") or "").strip(),
            "corpus_id": str(prev.get("corpus_id") or "").strip(),
        }
        if c.upper() == "ESCO" and not slot["uri"] and out["esco_uri"]:
            slot["uri"] = out["esco_uri"]
            slot["title"] = slot["title"] or out["esco_title"]
        systems[c] = slot
    out["systems"] = systems
    return _sync_legacy_esco_fields(out)


def _attach_systems_to_rows(
    rows: list[dict[str, Any]],
    codes: list[str],
    bridge: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Добавляет/выравнивает слоты systems для выбранных систем моста."""
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        base = _normalize_step3_row(row, codes)
        systems = dict(base.get("systems") or {})
        for code in codes:
            if code not in systems:
                systems[code] = _empty_system_mapping(
                    code,
                    bridge=bridge,
                    source_type=str(base.get("source_type") or ""),
                )
            else:
                # дозаполняем подсказки из моста, если пусто
                empty = _empty_system_mapping(
                    code,
                    bridge=bridge,
                    source_type=str(base.get("source_type") or ""),
                )
                if not systems[code].get("level_target"):
                    systems[code]["level_target"] = empty["level_target"]
                if not systems[code].get("rule_hint"):
                    systems[code]["rule_hint"] = empty["rule_hint"]
        # убрать системы вне выбора
        base["systems"] = {c: systems[c] for c in codes if c in systems}
        out.append(_sync_legacy_esco_fields(base))
    return out


def _step3_skill_candidates(session, rows: list[dict[str, Any]], occupation_uri: str = "") -> dict[str, list[dict[str, str]]]:
    from .esco_registry import search_skills

    out: dict[str, list[dict[str, str]]] = {}
    pool: list[dict[str, str]] = []
    if occupation_uri:
        try:
            res = search_skills(session, q="", occupation_uri=occupation_uri, limit=60)
            pool = [
                {"uri": str(it.get("uri") or "").strip(), "title": str(it.get("title") or "").strip()}
                for it in (res.get("items") or [])
                if str(it.get("uri") or "").strip()
            ]
        except Exception:
            pool = []

    for idx, row in enumerate(rows):
        key = str(row.get("source_id") or f"row{idx}")
        text = str(row.get("source_text") or "")
        cands: list[dict[str, str]] = []
        seen: set[str] = set()
        for it in pool[:24]:
            uri = it["uri"]
            if uri in seen:
                continue
            seen.add(uri)
            cands.append(it)
        q = _latin_query(text)
        if q:
            try:
                res = search_skills(session, q=q, occupation_uri="", limit=8)
                for it in res.get("items") or []:
                    uri = str(it.get("uri") or "").strip()
                    if not uri or uri in seen:
                        continue
                    seen.add(uri)
                    cands.append(
                        {"uri": uri, "title": str(it.get("title") or "").strip()}
                    )
            except Exception:
                pass
        out[key] = cands[:16]
    return out


def generate_step3_ai_draft(session, *, context: dict[str, Any] | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
    """Шаг 3 (9.2): сопоставление ТФ/ТД со ВСЕМИ выбранными системами моста (ESCO + остальные)."""
    import json

    from .esco_registry import ESCO_VERSION_LABEL, search_occupations, status as esco_status

    context = context or {}
    meta: dict[str, Any] = {
        "assistant": "ai_agent",
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "mode": "heuristic",
        "esco_version": ESCO_VERSION_LABEL,
    }
    bridge_raw = context.get("bridge_context") if isinstance(context.get("bridge_context"), dict) else {}
    selected_codes = normalize_target_system_codes(
        context.get("target_systems"),
        bridge_raw.get("systems") if isinstance(bridge_raw.get("systems"), list) else None,
    )
    bridge = filter_bridge_context_by_systems(bridge_raw, selected_codes)
    context = {**context, "bridge_context": bridge, "target_systems": selected_codes}
    seed = heuristic_ai_draft(3, context=context)
    rows = list(seed.get("rows") or [])
    meta["target_systems"] = selected_codes
    meta["passport_domains"] = detect_passport_domains(context)
    if not rows:
        return {"rows": [], "target_systems": selected_codes}, meta
    if not selected_codes:
        meta["mode"] = "no_systems_selected"
        meta["warning"] = "Не выбраны системы для сопоставления"
        return {"rows": rows, "target_systems": []}, meta

    # Не-ESCO: только поиск по корпусу + порог уверенности (ничего не выдумываем).
    from .partner_mapping_search import apply_verified_to_rows

    # Вставляем всё найденное; уверенность показывается в UI (по умолчанию без отсечения).
    min_conf = str(context.get("min_confidence") or "low").lower()
    if min_conf not in ("high", "medium", "low"):
        min_conf = "low"
    rows, search_stats = apply_verified_to_rows(
        rows,
        selected_codes=selected_codes,
        bridge=bridge,
        context=context,
        min_confidence=min_conf,
        use_llm_verify=deepseek_configured(),
    )
    meta["partner_search"] = search_stats
    partner_hints = build_partner_mapping_hints(selected_codes, bridge, context)
    meta["partner_hints"] = {k: v[:240] for k, v in partner_hints.items()}

    esco_info = esco_status(session)
    meta["esco_local"] = {
        "occupations": esco_info.get("occupations"),
        "skills": esco_info.get("skills"),
        "source": esco_info.get("source"),
        "local_ready": esco_info.get("local_ready"),
    }
    esco_selected = any(c.upper() == "ESCO" for c in selected_codes)

    occupation_candidates: list[dict[str, str]] = []
    skill_candidates: dict[str, list[dict[str, str]]] = {}
    if esco_selected:
        seen_occ: set[str] = set()
        okz = ""
        for lf in context.get("labor_functions") or []:
            if not isinstance(lf, dict):
                continue
            raw = lf.get("okz_codes")
            items = raw if isinstance(raw, list) else ([raw] if raw else [])
            for item in items:
                digits = "".join(ch for ch in str(item or "") if ch.isdigit())[:4]
                if len(digits) >= 4:
                    okz = digits
                    break
            if okz:
                break
        try:
            batches = []
            if okz:
                batches.append(search_occupations(session, q="", isco=okz, limit=10))
            title = str(context.get("title") or "").strip()
            if title:
                batches.append(
                    search_occupations(session, q=_latin_query(title) or title, isco="", limit=8)
                )
            for res in batches:
                for it in res.get("items") or []:
                    uri = str(it.get("uri") or "").strip()
                    if not uri or uri in seen_occ:
                        continue
                    seen_occ.add(uri)
                    occupation_candidates.append(
                        {
                            "uri": uri,
                            "title": str(it.get("title") or "").strip(),
                            "isco": str(it.get("isco") or "").strip(),
                        }
                    )
        except Exception as exc:
            meta["occupation_search_error"] = str(exc)[:200]
        occupation_uri = occupation_candidates[0]["uri"] if occupation_candidates else ""
        skill_candidates = _step3_skill_candidates(session, rows, occupation_uri=occupation_uri)

        if not deepseek_configured():
            for idx, row in enumerate(rows):
                key = str(row.get("source_id") or f"row{idx}")
                cands = skill_candidates.get(key) or []
                systems = row.get("systems") if isinstance(row.get("systems"), dict) else {}
                esco_slot = None
                for code, slot in systems.items():
                    if str(code).upper() == "ESCO" and isinstance(slot, dict):
                        esco_slot = slot
                        break
                if esco_slot and len(cands) == 1:
                    esco_slot["uri"] = cands[0]["uri"]
                    esco_slot["title"] = cands[0]["title"]
                    esco_slot["match"] = "partial"
                    esco_slot["notes"] = (esco_slot.get("notes") or "") + " (локальный ESCO, один кандидат)"
                _sync_legacy_esco_fields(row)
            meta["mode"] = "heuristic_multisystem"
            meta["bridge_version_id"] = bridge.get("version_id")
            return {"rows": rows, "target_systems": selected_codes}, meta
    elif not deepseek_configured():
        meta["mode"] = "heuristic_multisystem"
        meta["bridge_version_id"] = bridge.get("version_id")
        return {"rows": rows, "target_systems": selected_codes}, meta

    other_codes = [c for c in selected_codes if c.upper() != "ESCO"]
    system = (
        "Ты методист по международной гармонизации квалификаций ЦРК РФ (шаг 9.2).\n"
        "Задача: для КАЖДОЙ строки паспорта заполнить сопоставление по ВСЕМ выбранным системам моста.\n"
        "Жёсткие правила:\n"
        "1) Структура ответа: rows[].systems[CODE] = {title, uri, match, notes}.\n"
        "2) Для ESCO: uri и title ТОЛЬКО из skill_candidates[source_id]; иначе uri пустой, match=none. "
        "Не выдумывай URI ESCO.\n"
        "3) Для прочих систем (не ESCO): НЕ выдумывай документы и аналоги. "
        "Если в seed уже есть title/notes/source/confidence/corpus_id — сохрани source и confidence, "
        "формулировку title можно слегка уточнить, не подменяй другим актом. "
        "Если seed пустой (match=none) — оставь title пустым и match=none.\n"
        "4) match: full | partial | none.\n"
        "5) Без жаргона «маппить/маппинг». systems должен содержать каждый code из target_systems.\n"
        "Верни только JSON: {\"rows\":[...], \"target_systems\":[...]}."
    )
    # компактные строки для промпта + трудовые функции паспорта
    compact_lfs = []
    for lf in (context.get("labor_functions") or [])[:20]:
        if not isinstance(lf, dict):
            continue
        compact_lfs.append(
            {
                "code": lf.get("code"),
                "name": lf.get("name"),
                "okz_codes": lf.get("okz_codes"),
            }
        )
    compact_rows = []
    for row in rows[:40]:
        compact_rows.append(
            {
                "source_type": row.get("source_type"),
                "source_id": row.get("source_id"),
                "source_text": row.get("source_text"),
                "systems": {
                    code: {
                        "level_target": (row.get("systems") or {}).get(code, {}).get("level_target"),
                        "rule_hint": (row.get("systems") or {}).get(code, {}).get("rule_hint"),
                        "seed_title": (row.get("systems") or {}).get(code, {}).get("title"),
                        "seed_notes": ((row.get("systems") or {}).get(code, {}).get("notes") or "")[:280],
                        "seed_match": (row.get("systems") or {}).get(code, {}).get("match"),
                        "seed_confidence": (row.get("systems") or {}).get(code, {}).get("confidence"),
                        "seed_source": (row.get("systems") or {}).get(code, {}).get("source"),
                        "corpus_id": (row.get("systems") or {}).get(code, {}).get("corpus_id"),
                    }
                    for code in selected_codes
                },
            }
        )
    user = (
        "Сопоставь строки. Для не-ESCO сохраняй найденное из seed "
        "(title, source, confidence); пустые seed не заполняй выдуманными актами.\n\n"
        f"Паспорт: title={context.get('title')}, level={context.get('qualification_level')}, "
        f"kind={context.get('competence_kind')}, purposes={context.get('purposes') or context.get('purpose')}, "
        f"depth={context.get('depth')}, domains={meta.get('passport_domains')}\n"
        f"Трудовые функции: {json.dumps(compact_lfs, ensure_ascii=False)[:4000]}\n"
        f"target_systems={selected_codes}\n"
        f"partner_search_stats: {json.dumps(search_stats, ensure_ascii=False)}\n"
        f"Мост: {json.dumps(bridge, ensure_ascii=False)[:3500]}\n"
        f"Строки (seed): {json.dumps(compact_rows, ensure_ascii=False)[:12000]}\n"
        f"skill_candidates (только ESCO): {json.dumps(skill_candidates, ensure_ascii=False)[:8000]}\n"
        f"occupation_candidates: {json.dumps(occupation_candidates, ensure_ascii=False)[:2000]}\n"
        "Не-ESCO системы: " + (", ".join(other_codes) if other_codes else "нет") + "."
    )
    try:
        data = chat_json(system=system, user=user, temperature=0.15, timeout=150)
        if not isinstance(data, dict):
            data = {}
        data["target_systems"] = selected_codes
        # Сливаем ответ модели поверх seed, сохраняя слоты всех систем
        llm_rows = data.get("rows") if isinstance(data.get("rows"), list) else []
        by_id: dict[str, dict[str, Any]] = {}
        for r in llm_rows:
            if isinstance(r, dict) and r.get("source_id") is not None:
                by_id[str(r.get("source_id"))] = r
        merged: list[dict[str, Any]] = []
        allowed_esco: dict[str, dict[str, str]] = {}
        for key, cands in skill_candidates.items():
            for c in cands:
                allowed_esco[c["uri"]] = c

        for idx, base_row in enumerate(rows):
            key = str(base_row.get("source_id") or f"row{idx}")
            llm = by_id.get(key) or (llm_rows[idx] if idx < len(llm_rows) and isinstance(llm_rows[idx], dict) else {})
            systems_llm = llm.get("systems") if isinstance(llm.get("systems"), dict) else {}
            # legacy flat ESCO fields from LLM
            if not systems_llm and (llm.get("esco_uri") or llm.get("esco_title")):
                systems_llm = {
                    "ESCO": {
                        "uri": llm.get("esco_uri"),
                        "title": llm.get("esco_title"),
                        "match": llm.get("match"),
                        "notes": llm.get("notes"),
                    }
                }
            base_systems = base_row.get("systems") if isinstance(base_row.get("systems"), dict) else {}
            new_systems: dict[str, Any] = {}
            for code in selected_codes:
                slot = dict(base_systems.get(code) or _empty_system_mapping(code, bridge=bridge))
                src = systems_llm.get(code) if isinstance(systems_llm.get(code), dict) else {}
                if not src:
                    for k, v in systems_llm.items():
                        if str(k).upper() == code.upper() and isinstance(v, dict):
                            src = v
                            break
                if src:
                    uri = str(src.get("uri") or "").strip()
                    if code.upper() == "ESCO":
                        new_title = str(src.get("title") or "").strip()
                        new_notes = str(src.get("notes") or "").strip()
                        if new_title:
                            slot["title"] = new_title
                        if new_notes:
                            slot["notes"] = new_notes
                        match = str(src.get("match") or slot.get("match") or "partial").strip().lower()
                        slot["match"] = match if match in ("full", "partial", "none") else "partial"
                        cands = skill_candidates.get(key) or []
                        cand_uris = {c["uri"] for c in cands}
                        if uri and uri in cand_uris and uri in allowed_esco:
                            slot["uri"] = uri
                            slot["title"] = allowed_esco[uri]["title"]
                        else:
                            slot["uri"] = ""
                            if uri and uri not in cand_uris and not slot.get("title"):
                                slot["match"] = "none"
                    else:
                        # не-ESCO: seed из поиска; сохраняем source + confidence
                        slot["uri"] = ""
                        seed_title = str(slot.get("title") or "").strip()
                        seed_match = str(slot.get("match") or "none")
                        seed_source = str(slot.get("source") or "").strip()
                        seed_conf = str(slot.get("confidence") or "").strip().lower()
                        if seed_title and seed_match != "none":
                            new_title = str(src.get("title") or "").strip()
                            new_notes = str(src.get("notes") or "").strip()
                            if new_title:
                                slot["title"] = new_title
                            if new_notes:
                                slot["notes"] = new_notes
                            match = str(src.get("match") or seed_match).strip().lower()
                            slot["match"] = match if match in ("full", "partial", "none") else seed_match
                            slot["source"] = seed_source
                            if seed_conf in ("high", "medium", "low"):
                                slot["confidence"] = seed_conf
                        else:
                            slot["title"] = ""
                            slot["match"] = "none"
                            slot["source"] = ""
                            slot["confidence"] = ""
                new_systems[code] = slot
            merged_row = {
                "source_type": str(llm.get("source_type") or base_row.get("source_type") or ""),
                "source_id": key,
                "source_text": str(llm.get("source_text") or base_row.get("source_text") or ""),
                "notes": str(llm.get("notes") or base_row.get("notes") or "").strip(),
                "systems": new_systems,
            }
            merged.append(_sync_legacy_esco_fields(_normalize_step3_row(merged_row, selected_codes)))

        meta["mode"] = "llm_multisystem"
        meta["status"] = ai_agent_status()
        meta["bridge_version_id"] = bridge.get("version_id")
        meta["occupation_candidates"] = len(occupation_candidates)
        meta["systems_count"] = len(selected_codes)
        return {"rows": merged or rows, "target_systems": selected_codes}, meta
    except Exception as exc:
        meta["mode"] = "heuristic_fallback"
        meta["error"] = str(exc)[:300]
        return {"rows": rows, "target_systems": selected_codes}, meta


def generate_ai_draft(step: int, *, context: dict[str, Any] | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
    """Возвращает (payload, ai_meta)."""
    context = context or {}
    meta: dict[str, Any] = {
        "assistant": "ai_agent",
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "mode": "heuristic",
    }
    if not deepseek_configured():
        return heuristic_ai_draft(step, context=context), meta

    system = (
        "Ты методист по международной гармонизации квалификаций ЦРК РФ. "
        "Верни только JSON-объект без markdown. "
        "Все человекочитаемые тексты (region, unit_type, description, notes, reason, approach, "
        "targets, rules и т.п.) пиши на русском языке в научном и методическом стиле.\n"
        "Языковой режим (обязательно):\n"
        "• Запрещены англицизмы и жаргон: «маппить», «маппится», «маппинг», «замапить», "
        "«мэппинг», «matchить», «заматчить», «скиллы» (вместо «навыки»), «фреймворк» "
        "(вместо «рамка»), «аплай», «драфт» в смысле черновика методики и подобные кальки.\n"
        "• Используй термины: сопоставление, соответствие, гармонизация, пересчёт компонентов, "
        "приведение в соответствие, эквивалентность, дескрипторы уровня, таксономия, "
        "онтология навыков, мост уровней, степень соответствия (полное / частичное / отсутствует).\n"
        "• Формулировки должны быть пригодны для методического документа и экспертизы, "
        "без разговорного стиля.\n"
        "Имена собственные систем (ESCO, O*NET, NSQF, QFEmirates и коды) и устоявшиеся "
        "классы зарубежных таксономий (Knowledge, Skills, Abilities, Competency и т.п.) оставляй как есть. "
        "Не выдумывай URI ESCO — оставляй esco_uri пустым, если не уверен."
    )
    if step == 1:
        user = build_step1_registry_search_prompt(context=context)
    elif step == 2:
        regs = context.get("registries") or context.get("existing_registries") or []
        systems = systems_from_registries(regs) or systems_from_registries(DEFAULT_REGISTRIES)
        user = build_step2_level_matrix_prompt(systems=systems)
    elif step == 4:
        user = (
            "Заполни ДВЕ таблицы международного сопоставления образования (без уровней сформированности "
            "компетенции — базовый/продвинутый/экспертный сюда НЕ включать, поля formation_level и "
            "qual_formation не возвращай).\n\n"
            "Все тексты на русском, кроме кодов стран (CN, IN, ZA, AE, VN, EG, KZ, BY, AM) и ISCED/EQF.\n"
            "Обязательно верни НЕПУСТЫЕ массивы education_map (≥9 строк) и partner_education (≥6 стран).\n\n"
            "В education_map ОБЯЗАТЕЛЬНО отдельной строкой включи "
            "«Профессиональное обучение (273-ФЗ)» — вид образования по ст. 73 Федерального закона "
            "№ 273-ФЗ «Об образовании в Российской Федерации» (профессиональная подготовка, "
            "переподготовка и повышение квалификации рабочих и служащих). Это НЕ СПО. "
            "Документ: свидетельство о профессии рабочего / должности служащего. "
            "ISCED обычно 3–4, EQF 2–5, уровни квалификации НСК (пр. 148н) — вплоть до 5-го "
            "(nsk_levels: «1–5»). Укажи это в notes.\n\n"
            "Также включи: среднее общее; СПО (квалифицированные рабочие); СПО (специалисты среднего звена); "
            "бакалавриат; специалитет; магистратура; аспирантура; докторантура. "
            "Для каждой строки заполняй nsk_levels (уровни НСК / 148н), без сформированности.\n\n"
            "Строгая схема JSON:\n"
            '{"education_map":[{"ru_level":"Профессиональное обучение (273-ФЗ)","isced":"3–4",'
            '"eqf_range":"2–5","qualification_doc":"Свидетельство о профессии рабочего / должности служащего",'
            '"nsk_levels":"1–5","notes":"ст. 73 273-ФЗ; до 5 уровня НСК"}],'
            '"partner_education":[{"country":"IN","bachelor_eq":"Бакалавр / LL.B",'
            '"master_eq":"Магистр / LL.M","doctoral_eq":"Ph.D."}]}'
        )
    elif step == 5:
        regs = context.get("registries") or context.get("existing_registries") or []
        systems = systems_from_registries(regs) or systems_from_registries(DEFAULT_REGISTRIES)
        codes = [s["code"] for s in systems]
        systems_lines = "\n".join(
            f"- code=`{s['code']}` | {s['name']} ({s['region'] or 'регион не указан'})"
            for s in systems
        )
        targets_example = ", ".join(f'"{c}":"…"' for c in codes[:6])
        if len(codes) > 6:
            targets_example += ", …"
        user = (
            "Задача: правила пересчёта компонентов ЦРК A / B / C / soft во ВСЕ системы каталога шага 1.\n\n"
            "Для каждого crk_component из {A, B, C, soft} заполни targets по КАЖДОМУ code — "
            "кратко, на русском в методическом стиле (кроме имён классов таксономии: Knowledge, Skills…).\n"
            "Не используй слова «маппить / маппинг / maps» — только «сопоставление», "
            "«соответствие», «пересчёт», «приведение к …».\n"
            "• ESCO / O*NET / CTDL — онтологии навыков: укажи целевой класс сущности.\n"
            "• НРК/NQF (NSQF, QFEmirates и т.п.) — нет прямой таксономии A/B/C: опиши "
            "сопоставление через дескрипторы уровня (знания / умения / ответственность), не оставляй пустым.\n"
            "• Неизвестная система — предложи обоснованное правило сопоставления и отметь допущение в notes.\n"
            "Поле formation_level / сформированность НЕ использовать.\n\n"
            f"Системы (ключи targets):\n{systems_lines}\n\n"
            "Строгая схема JSON:\n"
            '{"systems":[{"code","name","region"}],'
            '"component_rules":[{"crk_component":"A","targets":{'
            + targets_example
            + '},"notes":"…"}]}'
        )
    elif step == 6:
        purposes = normalize_purposes(
            context.get("purposes"),
            fallback_purpose=context.get("purpose"),
        )
        labels = ", ".join(purposes) if purposes else "(не выбраны)"
        user = (
            f"Цели сопряжения (уже выбраны пользователем, не меняй): {labels}.\n"
            f"Глубина: {context.get('depth') or 'medium'}.\n"
            "Заполни только requirements (data, formats, verification) под эти цели. "
            "Поля purpose/purposes в ответе можно опустить — сервер сохранит выбор пользователя.\n"
            "JSON: {\"depth\",\"requirements\":{\"data\",\"formats\",\"verification\"}}"
        )
    else:
        user = (
            "Сопоставь трудовые функции/действия паспорта с навыками ESCO (без выдуманных URI). "
            "JSON: {\"rows\":[{\"source_type\",\"source_id\",\"source_text\",\"esco_uri\","
            "\"esco_title\",\"match\",\"notes\"}]}. "
            f"Паспорт: title={context.get('title')}, kind={context.get('competence_kind')}, "
            f"level={context.get('qualification_level')}, labor_functions={context.get('labor_functions')}, "
            f"structure={context.get('structure')}"
        )

    try:
        data = chat_json(system=system, user=user, temperature=0.2, timeout=120)
        regs_for_norm = None
        if step in (2, 5):
            regs_for_norm = context.get("registries") or context.get("existing_registries")
        if step == 6 and isinstance(data, dict):
            # Выбор целей — только от пользователя; модель заполняет requirements.
            forced = normalize_purposes(
                context.get("purposes"),
                fallback_purpose=context.get("purpose"),
            )
            data = {
                **data,
                "purposes": forced,
                "purpose": forced[0] if forced else "",
                "depth": str(context.get("depth") or data.get("depth") or "medium"),
            }
        payload = normalize_step_payload(step, data, registries=regs_for_norm)
        meta["mode"] = "llm"
        meta["status"] = ai_agent_status()
        # Если модель вернула пустышку по шагу 4 — отдаём seed, но помечаем fallback.
        if step == 4:
            edu = payload.get("education_map") or []
            partners = payload.get("partner_education") or []
            has_pt = any(
                PROFESSIONAL_TRAINING_MARKER in str(r.get("ru_level") or "").lower()
                for r in edu
                if isinstance(r, dict)
            )
            if not edu or not partners or not has_pt:
                payload = empty_step_payload(4)
                meta["mode"] = "llm_seed_fallback"
                meta["warning"] = (
                    "Модель вернула неполные таблицы образования "
                    "(нужны education_map с профессиональным обучением 273-ФЗ и partner_education); "
                    "подставлен seed"
                )
            else:
                # На всякий случай убираем устаревшее поле сформированности
                payload.pop("qual_formation", None)
        return payload, meta
    except Exception as exc:
        payload = heuristic_ai_draft(step, context=context)
        meta["mode"] = "heuristic_fallback"
        meta["error"] = str(exc)[:300]
        return payload, meta
