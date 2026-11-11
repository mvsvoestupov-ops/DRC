# -*- coding: utf-8 -*-
"""Fill assessment_tools_v2 for competence id=24 (RUS-PK-0024) with valid random data."""
from __future__ import annotations

import json
import random
import sqlite3
import string
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "profstandart.db"
if not DB.exists():
    DB = ROOT / "app" / "profstandart.db"

OUT = Path(__file__).resolve().parent / "_fill_fos_0024.txt"
COMP_ID = 24
LEVELS = ("базовый", "продвинутый", "экспертный")
GATE_LEVELS = ("базовый", "продвинутый")  # SPO → базовый + продвинутый
RNG = random.Random(24_0024)

PROMPTS_TEST = [
    "Какой нормативный акт определяет порядок легализации средств пожаротушения?",
    "Что относится к первичным средствам пожаротушения на объекте?",
    "В каком случае требуется повторная проверка противопожарного оборудования?",
    "Какой документ подтверждает соответствие огнетушителя требованиям?",
    "Что необходимо выполнить перед вводом системы оповещения о пожаре?",
    "Какое действие выполняется при обнаружении неисправности пожарного гидранта?",
    "Какой срок хранения журнала учёта проверок средств пожаротушения?",
    "Что входит в состав комплекта для легализации противопожарного оборудования?",
]

OPTS = [
    ("Верный вариант ответа", True),
    ("Неверный вариант ответа", False),
    ("Частично верный, но неполный ответ", False),
    ("Ответ, не относящийся к требованиям", False),
]

CRITERIA_TEST = [
    "Выбран корректный вариант в соответствии с нормативными требованиями.",
    "Ответ соответствует правилам пожарной безопасности и легализации оборудования.",
    "Указан верный порядок действий при проверке средств пожаротушения.",
    "Ответ содержит ссылку на применимое требование и исключает типичные ошибки.",
]

PROMPTS_PRAC = [
    "Подготовьте комплект документов для легализации средств пожаротушения на объекте.",
    "Проведите проверку готовности первичных средств пожаротушения и оформите акт.",
    "Составьте план действий по устранению замечаний по противопожарному оборудованию.",
    "Выполните практическое задание по оценке соответствия огнетушителей требованиям.",
    "Организуйте проверку системы оповещения и зафиксируйте результаты в журнале.",
]

CRITERIA_PRAC = [
    "Документы оформлены полностью и без противоречий.",
    "Порядок проверки соблюдён, замечания зафиксированы.",
    "Выбраны корректные средства и методы контроля.",
    "Результат соответствует требованиям пожарной безопасности.",
]


def log_lines(lines: list[str]) -> None:
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    text = str(val).strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def items_abc(structure: dict | None, key: str) -> list[dict]:
    if not isinstance(structure, dict):
        return []
    rows = structure.get(key) or []
    if not isinstance(rows, list):
        return []
    return [x for x in rows if isinstance(x, dict) and str(x.get("text") or "").strip()]


def nid(prefix: str) -> str:
    alphabet = string.ascii_lowercase + string.digits
    tail = "".join(RNG.choice(alphabet) for _ in range(8))
    return f"{prefix}-{int(time.time() * 1000) % 10_000_000}-{tail}"


def pick(seq: list[str]) -> str:
    return RNG.choice(seq)


def ensure_test(component_id: str, existing: dict | None, level: str, index: int) -> dict:
    base = dict(existing) if isinstance(existing, dict) else {}
    item_type = base.get("itemType") or base.get("item_type") or "single"
    if item_type not in ("single", "multiple", "open", "ordering", "matching"):
        item_type = "single"

    prompt = str(base.get("prompt") or "").strip()
    if not prompt:
        prompt = f"{pick(PROMPTS_TEST)} (уровень: {level}, A{index + 1})"

    criteria = str(base.get("criteria") or "").strip()
    if not criteria:
        criteria = pick(CRITERIA_TEST)

    options = base.get("options") if isinstance(base.get("options"), list) else []
    options = [o for o in options if isinstance(o, dict)]

    if item_type != "open":
        # keep filled options; ensure ≥2 with texts and a correct one
        filled = [o for o in options if str(o.get("text") or "").strip()]
        if len(filled) < 2:
            options = []
            for text, correct in OPTS[:3]:
                options.append(
                    {
                        "id": nid("ao"),
                        "text": text,
                        "isCorrect": bool(correct),
                    }
                )
            # shuffle but keep one correct
            RNG.shuffle(options)
            if not any(o.get("isCorrect") for o in options):
                options[0]["isCorrect"] = True
        else:
            # ensure texts + correct flag
            for o in filled:
                if not str(o.get("text") or "").strip():
                    o["text"] = "Вариант ответа"
                if "isCorrect" not in o and "is_correct" in o:
                    o["isCorrect"] = bool(o.get("is_correct"))
            if item_type in ("single", "multiple") and not any(
                o.get("isCorrect") or o.get("is_correct") for o in filled
            ):
                filled[0]["isCorrect"] = True
            options = filled if len(filled) >= 2 else options
            if len(options) < 2:
                options = [
                    {"id": nid("ao"), "text": OPTS[0][0], "isCorrect": True},
                    {"id": nid("ao"), "text": OPTS[1][0], "isCorrect": False},
                ]
    else:
        options = []

    return {
        "id": str(base.get("id") or nid("at")),
        "method": "testing",
        "prompt": prompt,
        "itemType": item_type if item_type != "open" else "single",  # prefer single for gate options
        "options": options
        if item_type != "open"
        else [
            {"id": nid("ao"), "text": OPTS[0][0], "isCorrect": True},
            {"id": nid("ao"), "text": OPTS[1][0], "isCorrect": False},
        ],
        "context": str(base.get("context") or ""),
        "roles": str(base.get("roles") or ""),
        "product": str(base.get("product") or ""),
        "criteria": criteria,
        "componentIds": [component_id],
        "forNok": bool(base.get("forNok") or base.get("for_nok") or False),
        "planKey": f"testing:{component_id}",
        "attachments": base.get("attachments") if isinstance(base.get("attachments"), list) else [],
    }


def ensure_practical(task: dict | None, index: int, component_ids: list[str]) -> dict:
    base = dict(task) if isinstance(task, dict) else {}
    comps = [str(x) for x in (base.get("componentIds") or base.get("component_ids") or []) if x]
    if not comps:
        comps = list(component_ids)

    prompt = str(base.get("prompt") or "").strip()
    if not prompt:
        prompt = f"{pick(PROMPTS_PRAC)} (задание {index + 1})"

    criteria = base.get("criteria")
    if isinstance(criteria, list):
        crit_list = [str(x) for x in criteria]
    elif criteria:
        crit_list = [str(criteria)]
    else:
        crit_list = []
    if not any(str(x or "").strip() for x in crit_list):
        crit_list = [pick(CRITERIA_PRAC), pick(CRITERIA_PRAC)]

    name = str(base.get("name") or "").strip() or f"Задание {index + 1}"

    return {
        "id": str(base.get("id") or nid("p")),
        "name": name,
        "prompt": prompt,
        "instruction": str(base.get("instruction") or "Выполните задание согласно инструкции и оформите результат."),
        "description": str(base.get("description") or "Практическая проверка умений по легализации средств пожаротушения."),
        "location": str(base.get("location") or "Учебный полигон / объект защиты"),
        "componentIds": comps,
        "criteria": crit_list,
        "attachments": base.get("attachments") if isinstance(base.get("attachments"), list) else [],
    }


def test_complete(test: dict) -> bool:
    comps = test.get("componentIds") or test.get("component_ids") or []
    if not comps:
        return False
    if not str(test.get("criteria") or "").strip():
        return False
    if not str(test.get("prompt") or "").strip():
        return False
    item_type = test.get("itemType") or test.get("item_type") or "single"
    if item_type == "open":
        return True
    options = test.get("options") or []
    filled = [o for o in options if isinstance(o, dict) and str(o.get("text") or "").strip()]
    if len(filled) < 2:
        return False
    if item_type in ("single", "multiple"):
        return any(o.get("isCorrect") or o.get("is_correct") for o in filled)
    return True


def practical_complete(task: dict) -> bool:
    comps = task.get("componentIds") or task.get("component_ids") or []
    if not comps:
        return False
    if not str(task.get("prompt") or "").strip():
        return False
    criteria = task.get("criteria")
    if isinstance(criteria, list):
        return any(str(x or "").strip() for x in criteria)
    return bool(str(criteria or "").strip())


def build_level_block(
    level: str,
    knowledge: list[dict],
    practical_ids: list[str],
    prev_block: dict | None,
) -> dict:
    prev = prev_block if isinstance(prev_block, dict) else {}
    prev_tests = prev.get("tests") if isinstance(prev.get("tests"), list) else []
    prev_tasks = prev.get("practicalTasks") or prev.get("practical_tasks") or []
    if not isinstance(prev_tasks, list):
        prev_tasks = []

    by_comp: dict[str, dict] = {}
    for raw in prev_tests:
        if not isinstance(raw, dict):
            continue
        ids = raw.get("componentIds") or raw.get("component_ids") or []
        if raw.get("componentId") or raw.get("component_id"):
            ids = list(ids) or [raw.get("componentId") or raw.get("component_id")]
        for cid in ids:
            cid = str(cid)
            if cid and cid not in by_comp:
                by_comp[cid] = raw

    tests = []
    for i, item in enumerate(knowledge):
        cid = str(item["id"])
        tests.append(ensure_test(cid, by_comp.get(cid), level, i))

    # practical: keep existing if they cover; otherwise rebuild covering all B/C
    tasks_in = [t for t in prev_tasks if isinstance(t, dict)]
    used: set[str] = set()
    for t in tasks_in:
        for cid in t.get("componentIds") or t.get("component_ids") or []:
            used.add(str(cid))

    missing = [cid for cid in practical_ids if cid not in used]
    tasks: list[dict] = []

    if tasks_in and not missing:
        for i, t in enumerate(tasks_in):
            comps = [str(x) for x in (t.get("componentIds") or t.get("component_ids") or []) if x]
            tasks.append(ensure_practical(t, i, comps))
    elif tasks_in and missing:
        # keep existing filled tasks, append one task for missing
        for i, t in enumerate(tasks_in):
            comps = [str(x) for x in (t.get("componentIds") or t.get("component_ids") or []) if x]
            tasks.append(ensure_practical(t, i, comps))
        tasks.append(ensure_practical(None, len(tasks), missing))
    else:
        # create ~3 tasks chunking practical ids
        n = max(1, min(3, len(practical_ids)))
        chunks: list[list[str]] = [[] for _ in range(n)]
        for i, cid in enumerate(practical_ids):
            chunks[i % n].append(cid)
        for i, chunk in enumerate(chunks):
            if chunk:
                tasks.append(ensure_practical(None, i, chunk))

    return {
        "tests": tests,
        "practicalTasks": tasks,
        "compositionDone": True,
    }


def verify(structure: dict, by_level: dict, levels: tuple[str, ...]) -> tuple[int, int, list[str]]:
    knowledge = items_abc(structure, "A")
    practical = items_abc(structure, "B") + items_abc(structure, "C")
    practical_ids = {str(x["id"]) for x in practical}
    gaps: list[str] = []
    planned = complete = 0

    for level in levels:
        block = by_level.get(level) or {}
        tests = block.get("tests") or []
        tasks = block.get("practicalTasks") or block.get("practical_tasks") or []

        for item in knowledge:
            planned += 1
            tid = str(item["id"])
            test = next(
                (
                    t
                    for t in tests
                    if isinstance(t, dict)
                    and tid in [str(x) for x in (t.get("componentIds") or t.get("component_ids") or [])]
                ),
                None,
            )
            if test and test_complete(test):
                complete += 1
            else:
                gaps.append(f"{level}: incomplete test for {tid}")

        used: set[str] = set()
        for task in tasks:
            if not isinstance(task, dict):
                continue
            for cid in task.get("componentIds") or task.get("component_ids") or []:
                used.add(str(cid))
        if practical_ids - used:
            gaps.append(
                f"{level}: practical coverage {len(practical_ids & used)}/{len(practical_ids)} missing={sorted(practical_ids - used)[:5]}"
            )
        if not tasks:
            gaps.append(f"{level}: no practical tasks")

        for i, task in enumerate(tasks):
            if not isinstance(task, dict):
                continue
            planned += 1
            if practical_complete(task):
                complete += 1
            else:
                gaps.append(f"{level}: incomplete practical[{i}] name={task.get('name')}")

    return complete, planned, gaps


def apply_v2_to_assessment_tools(structure: dict, by_level: dict) -> list[dict]:
    """Optional flat assessment_tools from v2 tests + practical."""
    tools: list[dict] = []
    a_map = {str(x["id"]): x for x in items_abc(structure, "A")}
    bc_map = {str(x["id"]): x for x in items_abc(structure, "B") + items_abc(structure, "C")}

    for level in LEVELS:
        block = by_level.get(level) or {}
        for test in block.get("tests") or []:
            if not isinstance(test, dict):
                continue
            comps = [str(x) for x in (test.get("componentIds") or [])]
            tools.append(
                {
                    "id": test.get("id"),
                    "level": level,
                    "tool": "Тестирование",
                    "method": "testing",
                    "item_type": test.get("itemType") or "single",
                    "prompt": test.get("prompt"),
                    "options": test.get("options"),
                    "criteria": test.get("criteria"),
                    "component_ids": comps,
                    "component_texts": [a_map[c]["text"] for c in comps if c in a_map],
                    "for_nok": bool(test.get("forNok")),
                    "attachments": test.get("attachments") or [],
                }
            )
        for task in block.get("practicalTasks") or []:
            if not isinstance(task, dict):
                continue
            comps = [str(x) for x in (task.get("componentIds") or [])]
            crit = task.get("criteria")
            if isinstance(crit, list):
                crit_s = "; ".join(str(x) for x in crit if str(x).strip())
            else:
                crit_s = str(crit or "")
            tools.append(
                {
                    "id": task.get("id"),
                    "level": level,
                    "tool": "Практическое задание",
                    "method": "practical",
                    "prompt": task.get("prompt"),
                    "product": "Результат выполнения практического задания",
                    "criteria": crit_s,
                    "component_ids": comps,
                    "component_texts": [bc_map[c]["text"] for c in comps if c in bc_map],
                    "for_nok": False,
                    "attachments": task.get("attachments") or [],
                }
            )
    return tools


def main() -> int:
    lines: list[str] = []
    lines.append(f"ts={datetime.now(timezone.utc).isoformat()}")
    lines.append(f"db={DB} exists={DB.exists()}")
    if not DB.exists():
        lines.append("ERROR: db not found")
        log_lines(lines)
        return 1

    con = sqlite3.connect(str(DB))
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    cols = [r[1] for r in cur.execute("PRAGMA table_info(competences)").fetchall()]
    lines.append(f"cols_has_assessment_tools_v2={'assessment_tools_v2' in cols}")
    lines.append(f"cols_has_updated_at={'updated_at' in cols}")

    select_cols = [
        "id",
        "public_code",
        "name",
        "status",
        "structure",
        "assessment_tools",
        "raw_data",
    ]
    if "assessment_tools_v2" in cols:
        select_cols.append("assessment_tools_v2")
    if "updated_at" in cols:
        select_cols.append("updated_at")
    if "education_level" in cols:
        select_cols.append("education_level")

    row = cur.execute(
        f"SELECT {', '.join(select_cols)} FROM competences WHERE id = ?",
        (COMP_ID,),
    ).fetchone()
    if not row:
        # fallback by name/code
        row = cur.execute(
            f"""
            SELECT {', '.join(select_cols)} FROM competences
            WHERE public_code LIKE '%0024%'
               OR (name LIKE '%легализ%' AND name LIKE '%пожар%')
               OR name LIKE '%легализ%'
            ORDER BY id LIMIT 1
            """
        ).fetchone()
    if not row:
        lines.append("ERROR: competence not found")
        log_lines(lines)
        return 1

    cid = row["id"]
    lines.append(f"id={cid} code={row['public_code']} name={row['name']}")
    lines.append(f"status={row['status']}")
    if "education_level" in row.keys():
        lines.append(f"education_level={row['education_level']}")

    structure = parse(row["structure"]) or {}
    raw = parse(row["raw_data"]) or {}
    if not isinstance(raw, dict):
        raw = {}

    knowledge = items_abc(structure, "A")
    skills = items_abc(structure, "B")
    abilities = items_abc(structure, "C")
    practical_ids = [str(x["id"]) for x in skills + abilities]
    lines.append(f"structure A={len(knowledge)} B={len(skills)} C={len(abilities)}")

    if len(knowledge) == 0 or len(practical_ids) == 0:
        lines.append("ERROR: structure missing A or B/C")
        log_lines(lines)
        return 1

    # existing v2
    v2 = None
    if "assessment_tools_v2" in row.keys():
        v2 = parse(row["assessment_tools_v2"])
    if not isinstance(v2, dict):
        v2 = parse(raw.get("assessment_tools_v2"))
    if not isinstance(v2, dict):
        v2 = {}

    prev_by = v2.get("by_level") or v2.get("byLevel") or {}
    if not isinstance(prev_by, dict):
        prev_by = {}

    by_level: dict[str, Any] = {}
    for level in LEVELS:
        by_level[level] = build_level_block(level, knowledge, practical_ids, prev_by.get(level))

    payload = {"version": 2, "by_level": by_level}

    # verify before write
    complete_all, planned_all, gaps_all = verify(structure, by_level, LEVELS)
    complete_gate, planned_gate, gaps_gate = verify(structure, by_level, GATE_LEVELS)
    lines.append(f"prewrite all complete={complete_all}/{planned_all} gaps={len(gaps_all)}")
    lines.append(f"prewrite gate(базовый+продвинутый) complete={complete_gate}/{planned_gate} gaps={len(gaps_gate)}")
    for g in gaps_gate[:20]:
        lines.append(f"  gap: {g}")

    if complete_gate < planned_gate:
        lines.append("ERROR: gate still incomplete after build; aborting write")
        log_lines(lines)
        return 2

    # also update assessment_tools (optional applyV2)
    new_tools = apply_v2_to_assessment_tools(structure, by_level)

    raw2 = dict(raw)
    raw2["assessment_tools_v2"] = payload

    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    sets = ["raw_data = ?", "assessment_tools = ?"]
    params: list[Any] = [json.dumps(raw2, ensure_ascii=False), json.dumps(new_tools, ensure_ascii=False)]

    if "assessment_tools_v2" in cols:
        sets.append("assessment_tools_v2 = ?")
        params.append(json.dumps(payload, ensure_ascii=False))
    if "updated_at" in cols:
        sets.append("updated_at = ?")
        params.append(now)

    params.append(cid)
    cur.execute(f"UPDATE competences SET {', '.join(sets)} WHERE id = ?", params)
    con.commit()
    lines.append(f"wrote id={cid} updated_at={now if 'updated_at' in cols else 'N/A'}")
    lines.append(f"assessment_tools rows={len(new_tools)}")
    lines.append(
        f"v2 levels: "
        + ", ".join(
            f"{lv}: tests={len(by_level[lv]['tests'])} practical={len(by_level[lv]['practicalTasks'])}"
            for lv in LEVELS
        )
    )

    # re-read verify
    row2 = cur.execute(
        f"SELECT {', '.join(select_cols)} FROM competences WHERE id = ?",
        (cid,),
    ).fetchone()
    raw_r = parse(row2["raw_data"]) or {}
    v2_r = None
    if "assessment_tools_v2" in row2.keys():
        v2_r = parse(row2["assessment_tools_v2"])
    if not isinstance(v2_r, dict):
        v2_r = parse(raw_r.get("assessment_tools_v2")) if isinstance(raw_r, dict) else None
    by_r = (v2_r or {}).get("by_level") or {}
    complete2, planned2, gaps2 = verify(structure, by_r, GATE_LEVELS)
    complete3, planned3, gaps3 = verify(structure, by_r, LEVELS)
    lines.append(f"verify gate complete={complete2} planned={planned2} gaps={len(gaps2)}")
    lines.append(f"verify all complete={complete3} planned={planned3} gaps={len(gaps3)}")
    for g in gaps2[:10]:
        lines.append(f"  remain: {g}")
    lines.append("OK" if complete2 == planned2 and not gaps2 else "FAIL")

    con.close()
    log_lines(lines)
    print(f"wrote {OUT}")
    print(f"id={cid} gate={complete2}/{planned2} all={complete3}/{planned3}")
    return 0 if complete2 == planned2 else 3


if __name__ == "__main__":
    sys.exit(main())
