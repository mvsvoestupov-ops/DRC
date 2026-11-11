# -*- coding: utf-8 -*-
"""Checks for competence payload validation (run: py -3 -m app.test_competence_profile)."""
from __future__ import annotations

from .competence_profile import (
    expert_formation_allowed,
    formation_levels_for_education,
    validate_competence_payload,
)


def _filled_descriptors(*levels: str) -> dict:
    return {
        cat: {level: f"{cat}/{level}" for level in levels}
        for cat in ("A", "B", "C")
    }


def test_expert_blocked_for_spo_and_bachelor() -> None:
    assert not expert_formation_allowed("среднее профессиональное образование")
    assert not expert_formation_allowed("СПО")
    assert not expert_formation_allowed("высшее образование - бакалавриат")
    assert expert_formation_allowed("высшее образование - магистратура")
    assert expert_formation_allowed("")


def test_formation_levels_skip_expert_for_spo() -> None:
    assert formation_levels_for_education("среднее профессиональное образование") == (
        "базовый",
        "продвинутый",
    )
    assert formation_levels_for_education("магистратура") == (
        "базовый",
        "продвинутый",
        "экспертный",
    )


def test_strict_spo_accepts_without_expert() -> None:
    errors = validate_competence_payload(
        competence_kind="professional",
        qualification_level=4,
        labor_functions=[],
        descriptors=_filled_descriptors("базовый", "продвинутый"),
        assessment_tools=[],
        education_level="среднее профессиональное образование",
        strict=True,
    )
    assert errors == []


def test_strict_spo_rejects_missing_advanced() -> None:
    errors = validate_competence_payload(
        competence_kind="professional",
        qualification_level=4,
        labor_functions=[],
        descriptors=_filled_descriptors("базовый"),
        assessment_tools=[],
        education_level="среднее профессиональное образование",
        strict=True,
    )
    assert any("дескрипторы" in err for err in errors)
    assert any("базовый/продвинутый" in err for err in errors)
    assert not any("экспертный" in err for err in errors)


def test_strict_master_still_requires_expert() -> None:
    errors = validate_competence_payload(
        competence_kind="professional",
        qualification_level=7,
        labor_functions=[],
        descriptors=_filled_descriptors("базовый", "продвинутый"),
        assessment_tools=[],
        education_level="высшее образование - магистратура",
        strict=True,
    )
    assert any("экспертный" in err for err in errors)


if __name__ == "__main__":
    test_expert_blocked_for_spo_and_bachelor()
    test_formation_levels_skip_expert_for_spo()
    test_strict_spo_accepts_without_expert()
    test_strict_spo_rejects_missing_advanced()
    test_strict_master_still_requires_expert()
    print("OK")
