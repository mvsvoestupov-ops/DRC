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
        return {"rows": []}
    if step == 6:
        return {
            "purpose": "migration",
            "depth": "medium",
            "requirements": {
                "data": "",
                "formats": "",
                "verification": "",
            },
        }
    return {}


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
        base["rows"] = rows
        return base

    if step == 6:
        purpose = str(data.get("purpose") or base.get("purpose") or "migration")
        if purpose not in PURPOSES:
            purpose = "migration"
        req_raw = data.get("requirements") if isinstance(data.get("requirements"), dict) else {}
        defaults = PURPOSE_REQUIREMENTS[purpose]
        base = {
            "purpose": purpose,
            "depth": str(data.get("depth") or base.get("depth") or "medium"),
            "requirements": {
                "data": str(req_raw.get("data") or defaults["data"]),
                "formats": str(req_raw.get("formats") or defaults["formats"]),
                "verification": str(req_raw.get("verification") or defaults["verification"]),
            },
        }
        return base

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
        purpose = str(context.get("purpose") or "migration")
        if purpose not in PURPOSES:
            purpose = "migration"
        req = PURPOSE_REQUIREMENTS[purpose]
        return {
            "purpose": purpose,
            "depth": "high" if purpose in ("network_programs", "education_export") else "medium",
            "requirements": dict(req),
        }
    # step 3
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
                "notes": "Черновик: требуется подбор ESCO",
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
                }
            )
    return {"rows": rows[:40]}


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
        purpose = context.get("purpose") or "migration"
        user = (
            f"Цель сопряжения: {purpose}. Заполни требования. "
            "JSON: {\"purpose\",\"depth\",\"requirements\":{\"data\",\"formats\",\"verification\"}}"
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
