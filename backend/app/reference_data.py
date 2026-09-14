"""Справочники уровней квалификации и сформированности компетенций."""
from __future__ import annotations

import re
from typing import Any

from .level_matrix import load_structured_matrix

FORMATION_LEVEL_CODES = ("базовый", "продвинутый", "экспертный")
DESCRIPTOR_CATEGORIES = ("A", "B", "C")

# Группы уровней квалификации (приказ №148н)
QUALIFICATION_LEVEL_GROUPS: dict[str, list[int]] = {
    "unskilled": [1],
    "workers": [2, 3, 4],
    "specialists": [5, 6],
    "managers": [7, 8, 9],
}

# Показатели уровней по приказу Минтруда России от 12.04.2013 № 148н
ORDER_148N_INDICATORS: dict[int, str] = {
    1: (
        "Полномочия и ответственность: деятельность под руководством; индивидуальная ответственность.\n"
        "Характер умений: выполнение стандартных заданий (обычно физический труд).\n"
        "Характер знаний: применение элементарных фактических знаний и (или) ограниченного круга специальных знаний."
    ),
    2: (
        "Полномочия и ответственность: деятельность под руководством с элементами самостоятельности при выполнении знакомых заданий; индивидуальная ответственность.\n"
        "Характер умений: выполнение стандартных заданий; выбор способа действия по инструкции; корректировка действий с учетом условий их выполнения.\n"
        "Характер знаний: применение специальных знаний."
    ),
    3: (
        "Полномочия и ответственность: деятельность под руководством с проявлением самостоятельности при решении типовых практических задач; планирование собственной деятельности исходя из поставленной руководителем задачи; индивидуальная ответственность.\n"
        "Характер умений: решение типовых практических задач; выбор способа действия на основе знаний и практического опыта; корректировка действий с учетом условий их выполнения.\n"
        "Характер знаний: понимание технологических или методических основ решения типовых практических задач; применение специальных знаний."
    ),
    4: (
        "Полномочия и ответственность: деятельность под руководством с проявлением самостоятельности при решении практических задач, требующих анализа ситуации и ее изменений; планирование собственной деятельности и/или деятельности группы работников исходя из поставленных задач; ответственность за решение поставленных задач или результат деятельности группы работников.\n"
        "Характер умений: решение различных типов практических задач; выбор способа действия из известных на основе знаний и практического опыта; текущий и итоговый контроль, оценка и коррекция деятельности.\n"
        "Характер знаний: понимание научно-технических или методических основ решения практических задач; применение специальных знаний; самостоятельная работа с информацией."
    ),
    5: (
        "Полномочия и ответственность: самостоятельная деятельность по решению практических задач, требующих самостоятельного анализа ситуации и ее изменений; участие в управлении решением поставленных задач в рамках подразделения; ответственность за решение поставленных задач или результат деятельности группы работников или подразделения.\n"
        "Характер умений: решение различных типов практических задач с элементами проектирования; выбор способов решения в изменяющихся (различных) условиях рабочей ситуации; текущий и итоговый контроль, оценка и коррекция деятельности.\n"
        "Характер знаний: применение профессиональных знаний технологического или методического характера; самостоятельный поиск информации, необходимой для решения поставленных профессиональных задач."
    ),
    6: (
        "Полномочия и ответственность: самостоятельная деятельность, предполагающая определение задач собственной работы и/или подчиненных по достижению цели; обеспечение взаимодействия сотрудников и смежных подразделений; ответственность за результат выполнения работ на уровне подразделения или организации.\n"
        "Характер умений: разработка, внедрение, контроль, оценка и корректировка направлений профессиональной деятельности, технологических или методических решений.\n"
        "Характер знаний: применение профессиональных знаний технологического или методического характера, в том числе инновационных; самостоятельный поиск, анализ и оценка профессиональной информации."
    ),
    7: (
        "Полномочия и ответственность: определение стратегии, управление процессами и деятельностью, в том числе инновационной, с принятием решения на уровне крупных организаций или подразделений; ответственность за результаты деятельности крупных организаций или подразделений.\n"
        "Характер умений: решение задач развития области профессиональной деятельности и (или) организации с использованием разнообразных методов и технологий, в том числе инновационных; разработка новых методов, технологий.\n"
        "Характер знаний: понимание методологических основ профессиональной деятельности; создание новых знаний прикладного характера в определенной области; определение источников и поиск информации, необходимой для развития области профессиональной деятельности и/или организации."
    ),
    8: (
        "Полномочия и ответственность: определение стратегии, управление процессами и деятельностью (в том числе инновационной) с принятием решения на уровне крупных организаций; ответственность за результаты деятельности крупных организаций и (или) отрасли.\n"
        "Характер умений: решение задач исследовательского и проектного характера, связанных с повышением эффективности процессов.\n"
        "Характер знаний: создание новых знаний междисциплинарного и межотраслевого характера; оценка и отбор информации, необходимой для развития области деятельности."
    ),
    9: (
        "Полномочия и ответственность: определение стратегии, управление большими техническими системами, социальными и экономическими процессами; значительный вклад в определенную область деятельности; ответственность за результаты деятельности на национальном или международном уровнях.\n"
        "Характер умений: решение задач методологического, исследовательского и проектного характера, связанных с развитием и повышением эффективности процессов.\n"
        "Характер знаний: создание новых фундаментальных знаний междисциплинарного и межотраслевого характера."
    ),
}


def get_order_148n_indicators(level: int | None) -> str:
    if level is None:
        return ""
    return ORDER_148N_INDICATORS.get(int(level), "")


def normalize_qualification_level_code(raw: str | int | None) -> int | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    match = re.match(r"^(\d+)", text)
    return int(match.group(1)) if match else None


def parse_universal_skills(text: str | None) -> list[dict[str, str]]:
    if not text:
        return []
    parts = re.split(r"\.(?=[А-ЯA-Z])", text.strip())
    skills: list[dict[str, str]] = []
    for part in parts:
        part = part.strip().strip(".")
        if not part or ":" not in part:
            continue
        category, description = part.split(":", 1)
        skills.append({"category": category.strip(), "description": description.strip()})
    return skills


def get_structured_reference(force_refresh: bool = False) -> dict[str, Any]:
    return load_structured_matrix(force_refresh=force_refresh)


def get_formation_levels(force_refresh: bool = False) -> list[dict[str, Any]]:
    structured = get_structured_reference(force_refresh)
    items = structured.get("formation_level_definitions", [])
    return [{**item, "order": idx + 1} for idx, item in enumerate(items)]


def get_qualification_levels(force_refresh: bool = False) -> list[dict[str, Any]]:
    structured = get_structured_reference(force_refresh)
    result: list[dict[str, Any]] = []
    for row in structured.get("qualification_levels", []):
        level = row.get("qualification_level")
        group = next(
            (name for name, levels in QUALIFICATION_LEVEL_GROUPS.items() if level in levels),
            None,
        )
        indicators = (row.get("order_148n_indicators") or "").strip() or get_order_148n_indicators(level)
        result.append(
            {
                **row,
                "order_148n_indicators": indicators,
                "group": group,
                "universal_skills": parse_universal_skills(row.get("universal_skills")),
            }
        )
    return result


def get_qualification_level(level: int, force_refresh: bool = False) -> dict[str, Any] | None:
    for row in get_qualification_levels(force_refresh):
        if row.get("qualification_level") == level:
            return row
    return None


def get_universal_skill_catalog(force_refresh: bool = False) -> list[dict[str, Any]]:
    catalog: dict[str, dict[str, Any]] = {}
    for row in get_qualification_levels(force_refresh):
        level = row.get("qualification_level")
        for skill in row.get("universal_skills", []):
            category = skill["category"]
            entry = catalog.setdefault(
                category,
                {"category": category, "levels": {}},
            )
            entry["levels"][str(level)] = skill["description"]
    return sorted(catalog.values(), key=lambda x: x["category"])


def get_matrix_context(qualification_level_raw: str | int | None, force_refresh: bool = False) -> dict[str, Any] | None:
    code = normalize_qualification_level_code(qualification_level_raw)
    if code is None:
        return None
    row = get_qualification_level(code, force_refresh)
    if not row:
        return None
    return {
        "qualification_level": code,
        "qualification_level_label": row.get("qualification_level_label"),
        "order_148n_indicators": row.get("order_148n_indicators"),
        "formation_levels": row.get("formation_levels"),
        "descriptors_by_category": row.get("descriptors_by_category") or {},
        "universal_skills": row.get("universal_skills"),
        "formation_level_definitions": get_formation_levels(force_refresh),
    }


def normalize_descriptors(descriptors: dict | None) -> dict[str, dict[str, str]]:
    """Канонический формат: { A: { базовый: '...', ... }, B: {...}, C: {...} }."""
    result: dict[str, dict[str, str]] = {
        cat: {level: "" for level in FORMATION_LEVEL_CODES} for cat in DESCRIPTOR_CATEGORIES
    }
    if not descriptors:
        return result

    for cat in DESCRIPTOR_CATEGORIES:
        nested = descriptors.get(cat)
        if isinstance(nested, dict):
            for level in FORMATION_LEVEL_CODES:
                value = nested.get(level)
                if value:
                    result[cat][level] = str(value)
        for level in FORMATION_LEVEL_CODES:
            flat_key = f"{cat}_{level}"
            flat_value = descriptors.get(flat_key)
            if flat_value:
                result[cat][level] = str(flat_value)

    return result


def get_descriptor_text(descriptors: dict | None, category: str, level: str) -> str:
    normalized = normalize_descriptors(descriptors)
    return normalized.get(category, {}).get(level, "")


def get_reference_bundle(force_refresh: bool = False) -> dict[str, Any]:
    structured = get_structured_reference(force_refresh)
    return {
        "formation_levels": get_formation_levels(force_refresh),
        "qualification_levels": get_qualification_levels(force_refresh),
        "universal_skills_catalog": get_universal_skill_catalog(force_refresh),
        "principles": structured.get("principles", []),
        "source": structured.get("source"),
    }
