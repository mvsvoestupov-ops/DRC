# -*- coding: utf-8 -*-
"""
Заполнить RUS-PK-0090 на сервере случайными валидными данными до шага 7 (МТО).
Статус остаётся «проект». wizard_step = 8 (лейбл «7»).

Запуск на сервере (из /opt/drc/backend):
  ./venv/bin/python /tmp/_fill_server_0090.py

Или локально через fill-server-0090.cmd
"""
from __future__ import annotations

import json
import os
import random
import string
import sys
import time
from datetime import datetime
from typing import Any

BACKEND = os.environ.get("DRC_BACKEND", "/opt/drc/backend")
PUBLIC_CODE = os.environ.get("DRC_PUBLIC_CODE", "RUS-PK-0090")
WIZARD_STEP = 8  # внутренний шаг МТО = лейбл 7
RNG = random.Random(90_0090)

sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from app.db.session import SessionLocal  # noqa: E402
from app.db.competence_models import Competence, CompetenceStatus  # noqa: E402

LEVELS = ("базовый", "продвинутый", "экспертный")

KNOWLEDGE = [
    "Требования охраны труда на рабочем месте",
    "Нормативные документы по виду деятельности",
    "Порядок подготовки рабочего места",
    "Правила применения средств индивидуальной защиты",
    "Алгоритм действий в нештатной ситуации",
    "Критерии качества выполняемых работ",
    "Состав и назначение применяемого оборудования",
    "Требования к оформлению рабочей документации",
]
SKILLS = [
    "Применять нормативные требования в типовых ситуациях",
    "Планировать последовательность выполнения работ",
    "Контролировать соблюдение требований безопасности",
    "Оформлять результаты выполненной работы",
    "Выявлять отклонения от заданных параметров",
    "Взаимодействовать с участниками рабочего процесса",
]
ABILITIES = [
    "Выполнять рабочую операцию по технологической карте",
    "Использовать оборудование по назначению",
    "Устранять типовые замечания по результатам контроля",
]
TEST_PROMPTS = [
    "Какой документ определяет порядок выполнения работ?",
    "Что необходимо проверить перед началом работы?",
    "Какое действие выполняется при выявлении отклонения?",
    "Какой критерий подтверждает качество результата?",
]
PRAC_PROMPTS = [
    "Подготовьте рабочее место и выполните типовую операцию.",
    "Проведите контроль результата и оформите акт.",
    "Составьте план устранения выявленных замечаний.",
]
CRITERIA = [
    "Ответ соответствует нормативным требованиям.",
    "Последовательность действий соблюдена.",
    "Результат оформлен полно и без противоречий.",
]
RESOURCES = {
    "A": ["Учебные пособия и нормативные документы", "Мультимедийный проектор"],
    "B": ["Практикум / кейсы", "Программное обеспечение для оформления документов"],
    "C": ["Учебный полигон / мастерская", "Комплект СИЗ и рабочий инструмент"],
}


def nid(prefix: str) -> str:
    alphabet = string.ascii_lowercase + string.digits
    tail = "".join(RNG.choice(alphabet) for _ in range(8))
    return f"{prefix}-{int(time.time() * 1000) % 10_000_000}-{tail}"


def as_dict(val: Any) -> dict:
    if isinstance(val, dict):
        return dict(val)
    if isinstance(val, str) and val.strip():
        try:
            parsed = json.loads(val)
            return dict(parsed) if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def items_abc(structure: dict, key: str) -> list[dict]:
    rows = structure.get(key) or []
    if not isinstance(rows, list):
        return []
    out = []
    for row in rows:
        if isinstance(row, dict) and str(row.get("text") or "").strip():
            item = dict(row)
            if not item.get("id"):
                item["id"] = nid(key.lower())
            out.append(item)
        elif isinstance(row, str) and row.strip():
            out.append({"id": nid(key.lower()), "text": row.strip()})
    return out


def ensure_structure(structure: dict) -> dict:
    a = items_abc(structure, "A")
    b = items_abc(structure, "B")
    c = items_abc(structure, "C")
    if len(a) < 4:
        a = [{"id": nid("a"), "text": t, "tfCode": "A/01.4", "tdText": "ТД-1"} for t in KNOWLEDGE[:6]]
    if len(b) < 3:
        b = [{"id": nid("b"), "text": t, "tfCode": "A/01.4", "tdText": "ТД-1"} for t in SKILLS[:5]]
    if len(c) < 1:
        c = [{"id": nid("c"), "text": t, "tfCode": "A/01.4", "tdText": "ТД-1"} for t in ABILITIES[:2]]
    return {"A": a, "B": b, "C": c}


def ensure_descriptors(structure: dict, education_level: str | None) -> dict:
    levels = list(LEVELS)
    if education_level and "средн" in education_level.lower():
        levels = ["базовый", "продвинутый"]
    out: dict[str, dict[str, str]] = {}
    for cat in ("A", "B", "C"):
        out[cat] = {}
        for level in levels:
            out[cat][level] = (
                f"Дескриптор {cat} ({level}): обучающийся демонстрирует "
                f"освоение компонентов {cat} на уровне «{level}»."
            )
    return out


def ensure_discipline_mapping(structure: dict) -> list[dict]:
    rows: list[dict] = []
    for cat in ("A", "B", "C"):
        for i, item in enumerate(items_abc(structure, cat), start=1):
            rows.append(
                {
                    "component": f"{cat}{i}",
                    "category": cat,
                    "text": item["text"],
                    "discipline": "Профильная дисциплина",
                    "control": "зачет",
                    "importance": 3,
                    "volume": 2,
                }
            )
    return rows


def make_test(component_id: str, level: str, index: int) -> dict:
    opts = [
        {"id": nid("ao"), "text": "Верный вариант", "isCorrect": True},
        {"id": nid("ao"), "text": "Неверный вариант", "isCorrect": False},
        {"id": nid("ao"), "text": "Частично верный вариант", "isCorrect": False},
    ]
    RNG.shuffle(opts)
    if not any(o["isCorrect"] for o in opts):
        opts[0]["isCorrect"] = True
    return {
        "id": nid("at"),
        "method": "testing",
        "prompt": f"{RNG.choice(TEST_PROMPTS)} (уровень {level}, #{index + 1})",
        "itemType": "single",
        "options": opts,
        "context": "",
        "roles": "",
        "product": "",
        "criteria": RNG.choice(CRITERIA),
        "componentIds": [component_id],
        "forNok": False,
        "planKey": f"testing:{component_id}",
        "attachments": [],
    }


def make_practical(index: int, component_ids: list[str]) -> dict:
    return {
        "id": nid("p"),
        "name": f"Задание {index + 1}",
        "prompt": f"{RNG.choice(PRAC_PROMPTS)} (задание {index + 1})",
        "instruction": "Выполните задание и оформите результат.",
        "description": "Практическая проверка умений и навыков.",
        "location": "Учебная мастерская / объект практики",
        "componentIds": list(component_ids),
        "criteria": [RNG.choice(CRITERIA), RNG.choice(CRITERIA)],
        "attachments": [],
    }


def build_v2(structure: dict) -> dict:
    knowledge = items_abc(structure, "A")
    practical = items_abc(structure, "B") + items_abc(structure, "C")
    practical_ids = [str(x["id"]) for x in practical]
    by_level: dict[str, Any] = {}
    for level in LEVELS:
        n = max(1, min(3, len(practical_ids)))
        chunks: list[list[str]] = [[] for _ in range(n)]
        for i, cid in enumerate(practical_ids):
            chunks[i % n].append(cid)
        tasks = [make_practical(i, chunk) for i, chunk in enumerate(chunks) if chunk]
        by_level[level] = {
            "tests": [make_test(str(item["id"]), level, i) for i, item in enumerate(knowledge)],
            "practicalTasks": tasks,
            "compositionDone": True,
        }
    return {"version": 2, "by_level": by_level}


def flatten_tools(structure: dict, by_level: dict) -> list[dict]:
    tools: list[dict] = []
    for level, block in by_level.items():
        for test in block.get("tests") or []:
            tools.append(
                {
                    "id": test["id"],
                    "level": level,
                    "tool": "Тестирование",
                    "method": "testing",
                    "item_type": "single",
                    "prompt": test["prompt"],
                    "options": test["options"],
                    "criteria": test["criteria"],
                    "component_ids": test["componentIds"],
                    "for_nok": False,
                    "attachments": [],
                }
            )
        for task in block.get("practicalTasks") or []:
            tools.append(
                {
                    "id": task["id"],
                    "level": level,
                    "tool": "Практическое задание",
                    "method": "practical",
                    "prompt": task["prompt"],
                    "product": "Результат практического задания",
                    "criteria": "; ".join(task.get("criteria") or []),
                    "component_ids": task["componentIds"],
                    "for_nok": False,
                    "attachments": [],
                }
            )
    return tools


def gate_levels(education_level: str | None) -> tuple[str, ...]:
    if education_level and "средн" in str(education_level).lower():
        return ("базовый", "продвинутый")
    return LEVELS


def verify(structure: dict, by_level: dict, levels: tuple[str, ...]) -> tuple[int, int]:
    knowledge = items_abc(structure, "A")
    practical_ids = {str(x["id"]) for x in items_abc(structure, "B") + items_abc(structure, "C")}
    planned = complete = 0
    for level in levels:
        block = by_level.get(level) or {}
        tests = block.get("tests") or []
        tasks = block.get("practicalTasks") or []
        for item in knowledge:
            planned += 1
            tid = str(item["id"])
            test = next(
                (t for t in tests if tid in [str(x) for x in (t.get("componentIds") or [])]),
                None,
            )
            if (
                test
                and str(test.get("prompt") or "").strip()
                and str(test.get("criteria") or "").strip()
                and len([o for o in (test.get("options") or []) if str(o.get("text") or "").strip()]) >= 2
                and any(o.get("isCorrect") for o in (test.get("options") or []) if isinstance(o, dict))
            ):
                complete += 1
        used: set[str] = set()
        for task in tasks:
            for cid in task.get("componentIds") or []:
                used.add(str(cid))
        if practical_ids - used:
            return complete, planned + max(1, len(tasks))
        for task in tasks:
            planned += 1
            if (
                (task.get("componentIds") or [])
                and str(task.get("prompt") or "").strip()
                and any(str(x or "").strip() for x in (task.get("criteria") or []))
            ):
                complete += 1
    return complete, planned


def main() -> int:
    session = SessionLocal()
    try:
        comp = session.query(Competence).filter(Competence.public_code == PUBLIC_CODE).first()
        if not comp:
            print(json.dumps({"error": "not_found", "public_code": PUBLIC_CODE}, ensure_ascii=False))
            return 1

        raw = as_dict(comp.raw_data)
        base_structure = comp.structure if isinstance(comp.structure, dict) else as_dict(comp.structure)
        structure = ensure_structure(base_structure)

        education_level = None
        if hasattr(comp, "education_level"):
            education_level = getattr(comp, "education_level", None)
        education_level = education_level or raw.get("education_level") or "среднее профессиональное образование"

        descriptors = ensure_descriptors(structure, str(education_level))
        discipline_mapping = ensure_discipline_mapping(structure)
        v2 = build_v2(structure)
        tools = flatten_tools(structure, v2["by_level"])
        resources = {k: list(v) for k, v in RESOURCES.items()}

        raw["assessment_tools_v2"] = v2
        raw["wizard_step"] = WIZARD_STEP
        raw["education_level"] = education_level
        if not raw.get("description"):
            raw["description"] = (
                f"Тестовое описание компетенции {PUBLIC_CODE} для проверки отправки на экспертизу."
            )
        if not raw.get("education_kind"):
            raw["education_kind"] = "профессиональное образование"
        if not raw.get("professional_area_code"):
            raw["professional_area_code"] = "40"

        # status: keep draft
        if comp.status != CompetenceStatus.DRAFT:
            # only auto-reset if still editable draft-like; otherwise refuse
            print(
                json.dumps(
                    {
                        "error": "unexpected_status",
                        "status": str(comp.status),
                        "hint": "Ожидался статус «проект». Скрипт не меняет уже отправленные/утверждённые.",
                    },
                    ensure_ascii=False,
                )
            )
            return 2

        if not (comp.name or "").strip() or str(comp.name).startswith("DRAFT") or str(comp.name).startswith("RUS-PK"):
            # keep existing meaningful name; if placeholder-ish leave/set test name
            if not (comp.name or "").strip() or str(comp.name).startswith("DRAFT"):
                comp.name = f"Тестовая компетенция {PUBLIC_CODE} (заполнение до шага 7)"
                comp.qualification_name = comp.name

        if not (comp.developer or "").strip():
            comp.developer = "auto-fill-script"

        comp.structure = structure
        comp.descriptors = descriptors
        comp.discipline_mapping = discipline_mapping
        comp.assessment_tools = tools
        comp.resources = resources
        comp.ed_technologies = ["тестирование", "практическое задание"]
        comp.raw_data = raw
        comp.updated_at = datetime.utcnow()
        if hasattr(comp, "education_level"):
            try:
                setattr(comp, "education_level", education_level)
            except Exception:
                pass

        session.add(comp)
        session.commit()

        levels = gate_levels(str(education_level))
        complete, planned = verify(structure, v2["by_level"], levels)
        a_n = len(items_abc(structure, "A"))
        b_n = len(items_abc(structure, "B"))
        c_n = len(items_abc(structure, "C"))

        result = {
            "ok": complete == planned,
            "id": comp.id,
            "public_code": comp.public_code,
            "status": str(getattr(comp.status, "value", comp.status)),
            "wizard_step": WIZARD_STEP,
            "education_level": education_level,
            "structure": {"A": a_n, "B": b_n, "C": c_n},
            "fos_gate": f"{complete}/{planned}",
            "resources": {k: len(v) for k, v in resources.items()},
            "edit_url": f"https://drc.ao-nk.online/competency/{comp.id}/edit",
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if complete == planned else 3
    except Exception as exc:
        session.rollback()
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())
