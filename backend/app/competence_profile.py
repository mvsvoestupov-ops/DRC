"""Профиль компетенции: валидация, матрица, formation_profile."""
from __future__ import annotations

import re
from typing import Any

from .reference_data import (
    DESCRIPTOR_CATEGORIES,
    FORMATION_LEVEL_CODES,
    get_matrix_context,
    normalize_descriptors,
    normalize_qualification_level_code,
    parse_universal_skills,
)

COMPETENCE_KINDS = ("professional", "general", "universal")


def expert_formation_allowed(education_level: str | None = None) -> bool:
    """Mirror of frontend expertFormationAllowed (competenceMappers)."""
    text = str(education_level or "").lower()
    if "среднее профессиональное" in text or re.search(r"\bспо\b", text):
        return False
    if "бакалавр" in text:
        return False
    return True


def formation_levels_for_education(education_level: str | None = None) -> tuple[str, ...]:
    """Mirror of frontend formationLevelsForEducation."""
    if expert_formation_allowed(education_level):
        return FORMATION_LEVEL_CODES
    return tuple(level for level in FORMATION_LEVEL_CODES if level != "экспертный")


def empty_descriptors() -> dict[str, dict[str, str]]:
    return normalize_descriptors({})


def suggest_descriptors_from_matrix(
    qualification_level: str | int | None,
    structure: dict[str, list[str]] | None = None,
) -> dict[str, dict[str, str]]:
    """Подставляет эталонные формулировки из матрицы по категориям A/B/C."""
    ctx = get_matrix_context(qualification_level)
    if not ctx:
        return empty_descriptors()

    by_cat = ctx.get("descriptors_by_category") or {}
    templates: dict[str, str] = ctx.get("formation_levels") or {}
    result = empty_descriptors()

    for cat in DESCRIPTOR_CATEGORIES:
        cat_levels = by_cat.get(cat) or {}
        for level in FORMATION_LEVEL_CODES:
            matrix_text = (cat_levels.get(level) or templates.get(level) or "").strip()
            if matrix_text:
                result[cat][level] = matrix_text

    return result


def build_formation_profile(
    *,
    competence_kind: str = "professional",
    qualification_level: str | int | None,
    universal_skills: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    code = normalize_qualification_level_code(qualification_level)
    ctx = get_matrix_context(qualification_level) if code else None
    skills = universal_skills
    if skills is None and ctx:
        skills = ctx.get("universal_skills") or []

    return {
        "competence_kind": competence_kind if competence_kind in COMPETENCE_KINDS else "professional",
        "target_qualification_level_code": code,
        "matrix_ref": {
            "source": "docx/Matrix_for_projekt.docx",
            "qualification_level": code,
        }
        if code
        else None,
        "universal_skills": skills or [],
        "formation_templates": (ctx or {}).get("formation_levels") or {},
    }


def merge_raw_data(
    existing: dict | None,
    *,
    description: str = "",
    industry: str = "",
    hours: str = "",
    formation_profile: dict[str, Any] | None = None,
    professional_area_code: str = "",
) -> dict[str, Any]:
    raw = dict(existing or {})
    if description:
        raw["description"] = description
    if industry:
        raw["industry"] = industry
    if professional_area_code:
        raw["professional_area_code"] = professional_area_code
    if hours:
        raw["hours"] = hours
    if formation_profile is not None:
        raw["formation_profile"] = formation_profile
    return raw


def validate_competence_payload(
    *,
    competence_kind: str = "professional",
    qualification_level: str | int | None,
    labor_functions: list | None,
    descriptors: dict | None,
    assessment_tools: list | None,
    education_level: str | None = None,
    strict: bool = False,
) -> list[str]:
    errors: list[str] = []
    kind = competence_kind if competence_kind in COMPETENCE_KINDS else "professional"
    ql_code = normalize_qualification_level_code(qualification_level)

    if kind == "professional" and strict:
        if ql_code is None or ql_code < 1 or ql_code > 9:
            errors.append("Укажите уровень квалификации по приказу №148н (1–9)")
        # Профстандарт и ТФ необязательны для отправки на экспертизу.
        # Если ТФ уже выбраны — оставляем их как есть, без требования минимум одной.

    normalized = normalize_descriptors(descriptors)
    if strict:
        required_levels = formation_levels_for_education(education_level)
        missing = [
            f"{cat}/{level}"
            for cat in DESCRIPTOR_CATEGORIES
            for level in required_levels
            if not normalized.get(cat, {}).get(level, "").strip()
        ]
        if missing:
            level_label = "/".join(required_levels)
            errors.append(
                f"Заполните дескрипторы уровней сформированности (A/B/C × {level_label})"
            )
        # assessment_tools: ФОС не обязательны для отправки на экспертизу (параметр оставлен для API).

    return errors


def suggest_competence_profile(
    qualification_level: str | int | None,
    structure: dict[str, list[str]] | None = None,
    competence_kind: str = "professional",
) -> dict[str, Any]:
    ctx = get_matrix_context(qualification_level)
    formation_profile = build_formation_profile(
        competence_kind=competence_kind,
        qualification_level=qualification_level,
    )
    return {
        "matrix_context": ctx,
        "formation_profile": formation_profile,
        "descriptors": suggest_descriptors_from_matrix(qualification_level, structure),
        "qualification_level_code": normalize_qualification_level_code(qualification_level),
    }
