"""Activity journal, contribution and wizard progress for a competence project."""

from __future__ import annotations

import copy
import json
from typing import Any

from .db.competence_models import Competence, CompetenceStatus

FIELD_LABELS = {
    "name": "name",
    "qualification_level": "qualification_level",
    "prof_standard_id": "prof_standard",
    "labor_functions": "labor_functions",
    "structure": "structure",
    "descriptors": "descriptors",
    "discipline_mapping": "disciplines",
    "assessment_tools": "assessment",
    "resources": "resources",
    "status": "status",
    "developer": "developer",
    "description": "description",
    "education_kind": "education",
    "education_level": "education",
    "fgos_id": "fgos",
    "td_zu_mapping": "td_zu",
    "expertise": "expertise",
    "international_mapping": "international",
    "professional_area_code": "area",
    "hours": "workload",
    "development_due": "deadline",
    "qualification_name": "name",
    "qualification_id": "qualification_level",
    "education_training_profession_id": "education",
    "education_training_profession": "education",
    "fgos_code": "fgos",
    "fgos_name": "fgos",
    "fgos_category": "fgos",
}

FIELD_STEPS = {
    "name": 1,
    "description": 1,
    "developer": 1,
    "education_kind": 1,
    "education_level": 1,
    "education_training_profession_id": 1,
    "education_training_profession": 1,
    "fgos_id": 1,
    "fgos_code": 1,
    "fgos_name": 1,
    "fgos_category": 1,
    "professional_area_code": 1,
    "hours": 1,
    "qualification_name": 1,
    "qualification_level": 2,
    "qualification_id": 2,
    "prof_standard_id": 2,
    "labor_functions": 2,
    "td_zu_mapping": 2,
    "structure": 3,
    "descriptors": 4,
    "discipline_mapping": 5,
    "assessment_tools": 6,
    "resources": 7,
    "expertise": 8,
    "international_mapping": 9,
    "status": 10,
}

# Internal identifiers — never shown in the journal.
TECHNICAL_KEYS = {
    "id",
    "component_ids",
    "user_id",
    "origin",
    "tfId",
    "tdIndex",
    "key",
    "confirmedTfKey",
    "item_type",
    "attachments",
    "url",
    "mime",
    "size",
    "isCorrect",
}

SKIP_PUBLIC_KEYS = {
    "qualification_id",
    "prof_standard_id",
    "education_training_profession_id",
    "fgos_id",
}

STRUCTURE_LABELS = {"A": "А (знания)", "B": "B (умения)", "C": "C (практические навыки)"}
RESOURCE_LABELS = {"A": "Для знаний", "B": "Для умений", "C": "Для практических навыков"}

COLUMN_KEYS = {
    "name",
    "qualification_name",
    "qualification_level",
    "qualification_id",
    "prof_standard_id",
    "labor_functions",
    "structure",
    "descriptors",
    "discipline_mapping",
    "assessment_tools",
    "resources",
    "status",
    "developer",
}

RAW_KEYS = {
    "description",
    "education_kind",
    "education_level",
    "education_training_profession_id",
    "education_training_profession",
    "fgos_id",
    "fgos_code",
    "fgos_name",
    "fgos_category",
    "td_zu_mapping",
    "expertise",
    "international_mapping",
    "professional_area_code",
    "hours",
    "development_due",
}

JSON_COLUMNS = {
    "labor_functions",
    "structure",
    "descriptors",
    "discipline_mapping",
    "assessment_tools",
    "resources",
}

ACTION_WEIGHTS = {
    "create": 3,
    "edit": 2,
    "status": 2,
    "chat": 1,
    "deadline": 1,
    "invite": 0,
    "remove": 0,
    "revert": 1,
}

SKIP_DIFF_KEYS = {"wizard_step"}


def _canon(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    except TypeError:
        return str(value)


def _has_text(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, dict):
        return any(_has_text(item) for item in value.values())
    if isinstance(value, list):
        return any(_has_text(item) for item in value)
    return bool(value)


def _structure_filled(structure: Any, key: str) -> bool:
    items = (structure or {}).get(key) if isinstance(structure, dict) else None
    if not isinstance(items, list):
        return False
    for item in items:
        if isinstance(item, str) and item.strip():
            return True
        if isinstance(item, dict) and str(item.get("text") or "").strip():
            return True
    return False


def _resources_filled(resources: Any) -> bool:
    if isinstance(resources, dict):
        groups = ("A", "B", "C")
        return all(
            any(str(item or "").strip() for item in (resources.get(key) or []) if isinstance(resources.get(key), list))
            for key in groups
        )
    if isinstance(resources, list):
        return any(str(item or "").strip() for item in resources)
    return False


def _expertise_filled(expertise: Any) -> bool:
    if not isinstance(expertise, dict) or not expertise:
        return False
    return any(
        str((row or {}).get("value") or "").strip()
        for row in expertise.values()
        if isinstance(row, dict)
    )


def snapshot_competence(comp: Competence) -> dict[str, Any]:
    raw = comp.raw_data or {}
    return copy.deepcopy(
        {
            "name": comp.name or "",
            "qualification_name": comp.qualification_name or "",
            "qualification_level": comp.qualification_level or "",
            "qualification_id": comp.qualification_id,
            "prof_standard_id": comp.prof_standard_id,
            "labor_functions": comp.labor_functions or [],
            "structure": comp.structure or {},
            "descriptors": comp.descriptors or {},
            "discipline_mapping": comp.discipline_mapping or [],
            "assessment_tools": comp.assessment_tools or [],
            "resources": comp.resources or [],
            "status": comp.status.value if comp.status else "",
            "developer": comp.developer or "",
            "description": raw.get("description") or "",
            "education_kind": raw.get("education_kind") or "",
            "education_level": raw.get("education_level") or "",
            "education_training_profession_id": raw.get("education_training_profession_id"),
            "education_training_profession": raw.get("education_training_profession") or "",
            "fgos_id": raw.get("fgos_id"),
            "fgos_code": raw.get("fgos_code") or "",
            "fgos_name": raw.get("fgos_name") or "",
            "fgos_category": raw.get("fgos_category") or "",
            "td_zu_mapping": raw.get("td_zu_mapping") or {},
            "expertise": raw.get("expertise") or {},
            "international_mapping": raw.get("international_mapping") or {},
            "professional_area_code": raw.get("professional_area_code") or "",
            "hours": raw.get("hours") or "",
            "development_due": raw.get("development_due") or "",
            "wizard_step": raw.get("wizard_step"),
        }
    )


def _clip(text: str, limit: int = 800) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[:limit] + "…"


def _item_text(item: Any) -> str:
    if item is None:
        return ""
    if isinstance(item, str):
        return item.strip()
    if isinstance(item, dict):
        for key in ("text", "name", "title", "discipline", "tool", "prompt", "value", "code"):
            value = item.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""
    return str(item).strip()


def _bullet(items: list[str]) -> str:
    return "\n".join(f"• {item}" for item in items if item)


def _texts_from_structure_items(items: Any) -> list[str]:
    out: list[str] = []
    if not isinstance(items, list):
        return out
    for item in items:
        if isinstance(item, str):
            text = item.strip()
            if text:
                out.append(text)
            continue
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        tf = str(item.get("tfCode") or "").strip()
        td = str(item.get("tdText") or "").strip()
        extra = " · ".join(part for part in (tf, td) if part)
        out.append(f"{text} ({extra})" if extra else text)
    return out


def _human_structure(value: Any) -> str:
    if not isinstance(value, dict):
        return _generic_human(value)
    lines: list[str] = []
    for cat in ("A", "B", "C"):
        texts = _texts_from_structure_items(value.get(cat))
        if not texts:
            continue
        lines.append(f"{STRUCTURE_LABELS.get(cat, cat)}:")
        lines.extend(f"• {text}" for text in texts)
    return "\n".join(lines)


def _human_assessment(value: Any) -> str:
    if not isinstance(value, list):
        return _generic_human(value)
    blocks: list[str] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        title = " · ".join(part for part in (item.get("tool"), item.get("level")) if part) or "Задание"
        lines = [title]
        prompt = str(item.get("prompt") or "").strip()
        criteria = str(item.get("criteria") or "").strip()
        context = str(item.get("context") or "").strip()
        if prompt:
            lines.append(f"Описание задания: {prompt}")
        if criteria:
            lines.append(f"Критерии: {criteria}")
        if context:
            lines.append(f"Контекст: {context}")
        texts = item.get("component_texts")
        if not isinstance(texts, list):
            components = item.get("components")
            texts = [
                _item_text(row)
                for row in (components if isinstance(components, list) else [])
            ]
        texts = [str(row).strip() for row in texts if str(row).strip()]
        if texts:
            lines.append("Компоненты:")
            lines.extend(f"• {text}" for text in texts)
        options = item.get("options")
        if isinstance(options, list):
            option_texts = []
            for option in options:
                label = _item_text(option)
                if not label:
                    continue
                if isinstance(option, dict) and option.get("isCorrect"):
                    option_texts.append(f"{label} (верный)")
                else:
                    option_texts.append(label)
            if option_texts:
                lines.append("Варианты:")
                lines.extend(f"• {text}" for text in option_texts)
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _human_descriptors(value: Any) -> str:
    if not isinstance(value, dict):
        return _generic_human(value)
    lines: list[str] = []
    for cat in ("A", "B", "C"):
        levels = value.get(cat)
        label = STRUCTURE_LABELS.get(cat, cat)
        if isinstance(levels, dict):
            for level, text in levels.items():
                body = str(text or "").strip()
                if body:
                    lines.append(f"{label} · {level}: {body}")
        elif isinstance(levels, str) and levels.strip():
            lines.append(f"{label}: {levels.strip()}")
    return "\n".join(lines)


def _human_labor_functions(value: Any) -> str:
    if not isinstance(value, list):
        return _generic_human(value)
    lines: list[str] = []
    for item in value:
        if isinstance(item, dict):
            code = str(item.get("code") or "").strip()
            name = str(item.get("name") or "").strip()
            line = " — ".join(part for part in (code, name) if part)
            if line:
                lines.append(line)
        elif str(item).strip():
            lines.append(str(item).strip())
    return _bullet(lines)


def _human_disciplines(value: Any) -> str:
    if not isinstance(value, list):
        return _generic_human(value)
    lines: list[str] = []
    for row in value:
        if not isinstance(row, dict):
            text = _item_text(row)
            if text:
                lines.append(text)
            continue
        discipline = str(row.get("discipline") or "").strip()
        component = str(row.get("text") or row.get("component") or "").strip()
        control = str(row.get("control") or row.get("form") or "").strip()
        parts = [part for part in (discipline, component) if part]
        line = " — ".join(parts)
        if control:
            line = f"{line} (контроль: {control})" if line else f"контроль: {control}"
        if line:
            lines.append(line)
    return _bullet(lines)


def _human_resources(value: Any) -> str:
    if isinstance(value, dict):
        lines: list[str] = []
        for cat in ("A", "B", "C"):
            items = [str(item).strip() for item in (value.get(cat) or []) if str(item).strip()]
            if not items:
                continue
            lines.append(f"{RESOURCE_LABELS.get(cat, cat)}:")
            lines.extend(f"• {item}" for item in items)
        return "\n".join(lines)
    if isinstance(value, list):
        return _bullet([str(item).strip() for item in value if str(item).strip()])
    return str(value or "").strip()


def _human_td_zu(value: Any) -> str:
    if not isinstance(value, dict):
        return _generic_human(value)
    cards = value.get("cards") or []
    if not isinstance(cards, list):
        return ""
    blocks: list[str] = []
    for card in cards:
        if not isinstance(card, dict):
            continue
        header = " · ".join(
            part for part in (str(card.get("tfCode") or "").strip(), str(card.get("tdText") or "").strip()) if part
        ) or "Трудовое действие"
        lines = [header]
        knowledges = [_item_text(item) for item in (card.get("knowledges") or [])]
        skills = [_item_text(item) for item in (card.get("skills") or [])]
        knowledges = [item for item in knowledges if item]
        skills = [item for item in skills if item]
        if knowledges:
            lines.append("Знания:")
            lines.extend(f"• {item}" for item in knowledges)
        if skills:
            lines.append("Умения:")
            lines.extend(f"• {item}" for item in skills)
        if knowledges or skills:
            blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _human_expertise(value: Any) -> str:
    if not isinstance(value, dict):
        return _generic_human(value)
    lines: list[str] = []
    for key, row in value.items():
        if isinstance(row, dict):
            body = str(row.get("value") or "").strip()
            comment = str(row.get("comment") or "").strip()
            if body or comment:
                lines.append(f"{key}: {body}" + (f" ({comment})" if comment else ""))
        elif str(row).strip():
            lines.append(f"{key}: {str(row).strip()}")
    return "\n".join(lines)


def _human_international(value: Any) -> str:
    if not isinstance(value, dict):
        return _generic_human(value)
    lines: list[str] = []
    for key in ("framework", "level", "comment", "result", "summary"):
        body = value.get(key)
        if isinstance(body, str) and body.strip():
            lines.append(body.strip())
    matches = value.get("matches") or value.get("items") or value.get("rows")
    if isinstance(matches, list):
        for item in matches:
            text = _item_text(item)
            if text:
                lines.append(f"• {text}")
    return "\n".join(lines)


def _generic_human(value: Any) -> str:
    if value is None or value == "" or value == [] or value == {}:
        return ""
    if isinstance(value, bool):
        return "да" if value else "нет"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts = [_generic_human(item) for item in value]
        parts = [part for part in parts if part]
        return _bullet(parts) if all("\n" not in part for part in parts) else "\n\n".join(parts)
    if isinstance(value, dict):
        lines: list[str] = []
        for key, nested in value.items():
            if key in TECHNICAL_KEYS or str(key).endswith("_id"):
                continue
            text = _generic_human(nested)
            if not text:
                continue
            if "\n" in text:
                lines.append(f"{key}:")
                lines.append(text)
            else:
                lines.append(f"{key}: {text}")
        return "\n".join(lines)
    return str(value)


HUMANIZERS = {
    "structure": _human_structure,
    "assessment_tools": _human_assessment,
    "descriptors": _human_descriptors,
    "labor_functions": _human_labor_functions,
    "discipline_mapping": _human_disciplines,
    "resources": _human_resources,
    "td_zu_mapping": _human_td_zu,
    "expertise": _human_expertise,
    "international_mapping": _human_international,
}


def value_preview(value: Any, limit: int = 800, key: str | None = None) -> str:
    formatter = HUMANIZERS.get(key or "")
    text = formatter(value) if formatter else _generic_human(value)
    return _clip(text, limit)


def diff_snapshots(before: dict[str, Any], after: dict[str, Any]) -> list[dict[str, Any]]:
    changes: list[dict[str, Any]] = []
    keys = set(before) | set(after)
    for key in sorted(keys):
        if key in SKIP_DIFF_KEYS:
            continue
        old = before.get(key)
        new = after.get(key)
        if _canon(old) == _canon(new):
            continue
        changes.append(
            {
                "key": key,
                "field": FIELD_LABELS.get(key, key),
                "before": old,
                "after": new,
            }
        )
    return changes


def change_field_labels(changes: list[dict[str, Any]]) -> list[str]:
    labels: list[str] = []
    for row in changes:
        label = row.get("field") or row.get("key")
        if label and label not in labels:
            labels.append(label)
    return labels


def public_changes(changes: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for row in changes or []:
        key = str(row.get("key") or "")
        if not key or key in SKIP_PUBLIC_KEYS:
            continue
        field = str(row.get("field") or FIELD_LABELS.get(key, key))
        before_text = value_preview(row.get("before"), key=key)
        after_text = value_preview(row.get("after"), key=key)
        if before_text == after_text:
            continue
        bucket = grouped.get(field)
        if bucket is None:
            bucket = {
                "key": key,
                "field": field,
                "step": FIELD_STEPS.get(key),
                "befores": [],
                "afters": [],
            }
            grouped[field] = bucket
            order.append(field)
        if before_text and before_text not in bucket["befores"]:
            bucket["befores"].append(before_text)
        if after_text and after_text not in bucket["afters"]:
            bucket["afters"].append(after_text)
        if bucket.get("step") is None:
            bucket["step"] = FIELD_STEPS.get(key)
    payload = []
    for field in order:
        bucket = grouped[field]
        payload.append(
            {
                "key": bucket["key"],
                "field": bucket["field"],
                "step": bucket.get("step"),
                "before_preview": "\n".join(bucket["befores"]),
                "after_preview": "\n".join(bucket["afters"]),
            }
        )
    return payload


def before_values(changes: list[dict[str, Any]] | None) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for row in changes or []:
        key = row.get("key")
        if key:
            values[str(key)] = copy.deepcopy(row.get("before"))
    return values


def apply_field_values(comp: Competence, values: dict[str, Any]) -> None:
    raw = dict(comp.raw_data or {})
    for key, value in values.items():
        copied = copy.deepcopy(value)
        if key in COLUMN_KEYS:
            if key == "status":
                if copied:
                    try:
                        comp.status = CompetenceStatus(copied)
                    except ValueError:
                        pass
            else:
                setattr(comp, key, copied)
        elif key in RAW_KEYS:
            raw[key] = copied
    comp.raw_data = raw


def compute_progress(comp: Competence) -> dict[str, Any]:
    raw = comp.raw_data or {}
    kind = (raw.get("formation_profile") or {}).get("competence_kind") or "professional"
    structure = comp.structure or {}
    descriptors = comp.descriptors or {}
    td_zu = raw.get("td_zu_mapping") or {}
    mapping = raw.get("international_mapping") or {}
    wizard_step = int(raw.get("wizard_step") or 0)
    status = comp.status

    step2 = bool(comp.qualification_level)
    if kind == "professional":
        step2 = step2 and bool(comp.labor_functions) and bool(td_zu.get("confirmed") or comp.labor_functions)

    steps = [
        {
            "step": 1,
            "key": "info",
            "done": bool(
                (comp.name or "").strip()
                and str(raw.get("description") or "").strip()
                and str(raw.get("education_kind") or "").strip()
                and str(raw.get("professional_area_code") or "").strip()
            ),
        },
        {"step": 2, "key": "standard", "done": step2},
        {
            "step": 3,
            "key": "structure",
            "done": _structure_filled(structure, "A") and _structure_filled(structure, "B"),
        },
        {
            "step": 4,
            "key": "descriptors",
            "done": all(
                str(((descriptors.get(cat) or {}) if isinstance(descriptors, dict) else {}).get("базовый") or "").strip()
                for cat in ("A", "B", "C")
            ),
        },
        {"step": 5, "key": "disciplines", "done": bool(comp.discipline_mapping)},
        {"step": 6, "key": "assessment", "done": bool(comp.assessment_tools)},
        {"step": 7, "key": "resources", "done": _resources_filled(comp.resources)},
        {"step": 8, "key": "expertise", "done": _expertise_filled(raw.get("expertise"))},
        {"step": 9, "key": "international", "done": bool(isinstance(mapping, dict) and mapping.get("analyzedAt"))},
        {
            "step": 10,
            "key": "preview",
            "done": wizard_step >= 10 or status in (CompetenceStatus.REVIEW, CompetenceStatus.APPROVED),
        },
    ]
    filled = sum(1 for row in steps if row["done"])
    total = len(steps)
    return {
        "percent": round(100 * filled / total) if total else 0,
        "filled": filled,
        "total": total,
        "steps": steps,
    }


def action_weight(action: str) -> int:
    return ACTION_WEIGHTS.get(action, 1)
