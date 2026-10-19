"""ИИ-черновик шага 9 (ГАРМ-ESCO): сопоставление паспорта с ESCO / EQF / ISCED."""
from __future__ import annotations

import datetime
import json
import re
from typing import Any

from sqlalchemy.orm import Session

from .deepseek_client import chat_json, deepseek_configured, deepseek_status
from .esco_registry import ESCO_VERSION_LABEL, search_occupations, search_skills

RELATION_TYPES = ("equivalent", "broader", "narrower", "related", "none")
COVERAGE_TYPES = ("full", "partial", "absent", "national-only")
CONFIDENCE = ("high", "medium", "low")

NATIONAL_RE = re.compile(
    r"гк\s*рф|гпк\s*рф|апк\s*рф|ук\s*рф|кодекс|фз\s|приказ\s+мин|иерархи\w+\s+нпа|"
    r"юридическ\w+\s+техник|требования\s+фгос",
    re.I,
)

SYSTEM_PROMPT = """Ты методист по международной гармонизации квалификаций (методика ГАРМ-ESCO) для Цифрового реестра компетенций РФ.

Задача: подготовить ЧЕРНОВИК сопоставления паспорта компетенции с ESCO, EQF и ISCED,
включая таблицу покрытия навыков (skills) по каждому компоненту структуры A/B/C.

Жёсткие правила верификации (обязательны):
1) НЕ ВЫДУМЫВАЙ занятия и навыки ESCO, URI, коды ISCO и любые «официальные» ссылки.
2) Для esco_occupation и skills[].esco_term / esco_uri выбирай ТОЛЬКО из списков кандидатов,
   переданных в сообщении пользователя. Если подходящего кандидата нет — оставь поля пустыми
   и поставь coverage=absent (или national-only для сугубо национальных норм РФ).
3) Нельзя сочинять URI вида https://esco.ec.europa.eu/... если его нет в кандидатах.
4) Обязательно заполни массив skills для КАЖДОГО компонента из базового расчёта:
   coverage = full | partial | absent | national-only; при full/partial укажи esco_term и esco_uri из кандидатов.
5) Если данных недостаточно для уверенного сопоставления — confidence=low и явно опиши это в notes.
6) Не утверждай взаимное признание квалификаций и не выдавай черновик за официальный акт.

Язык:
• Все человекочитаемые тексты (notes и пояснения) — на русском, в научном методическом стиле.
• Запрещены жаргон и англицизмы: «маппить», «маппинг», «замапить» и т.п.
• Используй: сопоставление, соответствие, гармонизация, покрытие, национальная специфика.

Верни только один JSON-объект без markdown по схеме из запроса пользователя.
"""

SKILLS_SYSTEM_PROMPT = """Ты методист по международной гармонизации квалификаций (методика ГАРМ-ESCO).

Задача: заполнить таблицу ПОКРЫТИЯ НАВЫКОВ (skills) черновика сопоставления.

Жёсткие правила:
1) НЕ ВЫДУМЫВАЙ навыки ESCO и URI.
2) Для каждого компонента выбирай esco_term / esco_uri ТОЛЬКО из skill_candidates этого компонента.
   Если подходящего кандидата нет — esco_term и esco_uri оставь пустыми.
3) КРИТИЧНО: esco_uri копируй СИМВОЛ В СИМВОЛ из кандидата. esco_term — точный английский title
   из того же кандидата (не переводи на русский).
4) coverage:
   • full — полное смысловое соответствие национальному тексту;
   • partial — частичное соответствие;
   • absent — среди кандидатов нет подходящего навыка;
   • national-only — сугубо национальная норма РФ (кодексы, ФЗ, приказы, ФГОС и т.п.), без ESCO.
5) Заполни ВСЕ компоненты из списка components — ни одну строку не пропускай.
6) Не добавляй вымышленных URI вида https://esco.ec.europa.eu/...

Язык notes — русский, методический стиль; без жаргона «маппить» / «маппинг».

Верни только один JSON-объект: {"skills":[...], "notes":"..."}.
"""


def _digits(value: Any, size: int = 4) -> str:
    return re.sub(r"\D", "", str(value or ""))[:size]


def _eqf_from_148n(level: Any) -> int | None:
    try:
        n = int(str(level).strip().split(".")[0])
    except (TypeError, ValueError):
        return None
    if n < 1:
        return None
    if n >= 9:
        return 8
    return min(n, 8)


def _eqf_from_education(education_level: str, education_kind: str) -> int | None:
    text = f"{education_kind} {education_level}".lower()
    if any(x in text for x in ("высшей квалификации", "аспирант", "адъюнкт", "докторант")):
        return 8
    if "магистратур" in text or "специалитет" in text:
        return 7
    if "бакалавр" in text:
        return 6
    if "среднее профессиональное" in text or "спо" in text:
        return 5
    if "профессиональное обучение" in text:
        return 4
    return None


def _isced_from_eqf(eqf: int | None) -> str:
    if eqf is None:
        return ""
    return f"ISCED {eqf}"


def _first_okz(labor_functions: list[dict[str, Any]]) -> str:
    for lf in labor_functions or []:
        raw = lf.get("okz_codes")
        items = raw if isinstance(raw, list) else ([raw] if raw else [])
        for item in items:
            code = _digits(item)
            if len(code) >= 4:
                return code[:4]
        blob = f"{lf.get('otf_code') or ''} {lf.get('name') or ''}"
        labeled = re.search(r"ОКЗ\s+(\d{4})", blob, re.I)
        if labeled:
            return labeled.group(1)
    return ""


def _collect_components(payload: dict[str, Any]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for cat in ("A", "B", "C"):
        items = payload.get(f"structure_{cat.lower()}") or payload.get(f"structure_{cat}") or []
        if not isinstance(items, list):
            continue
        for idx, item in enumerate(items):
            text = str(item).strip() if not isinstance(item, dict) else str(item.get("text") or "").strip()
            if not text:
                continue
            rows.append({"component": f"{cat}{idx + 1}", "text": text[:500]})
    return rows[:40]


def _heuristic_base(payload: dict[str, Any]) -> dict[str, Any]:
    kind = str(payload.get("competence_kind") or "professional").strip().lower()
    labor = payload.get("labor_functions") if isinstance(payload.get("labor_functions"), list) else []
    has_tf = any(str(lf.get("code") or "").strip() for lf in labor if isinstance(lf, dict))
    admitted = not (kind == "professional" and not has_tf)
    deny = "no-tf" if not admitted else ""
    okz = _first_okz([lf for lf in labor if isinstance(lf, dict)])
    eqf_occ = _eqf_from_148n(payload.get("qualification_level"))
    eqf_edu = _eqf_from_education(
        str(payload.get("education_level") or ""),
        str(payload.get("education_kind") or ""),
    )
    components = _collect_components(payload)
    skills = []
    for row in components:
        if NATIONAL_RE.search(row["text"]):
            coverage = "national-only"
        else:
            coverage = "absent"
        skills.append(
            {
                "id": row["component"],
                "component": row["component"],
                "text": row["text"],
                "esco_term": "",
                "esco_uri": "",
                "coverage": coverage,
            }
        )
    return {
        "admitted": admitted,
        "deny_reason": deny,
        "okz": okz,
        "isco": okz,
        "esco_occupation": "",
        "esco_occupation_uri": "",
        "occupation_type": "related" if admitted else "none",
        "eqf_occupational": eqf_occ,
        "eqf_educational": eqf_edu,
        "isced": _isced_from_eqf(eqf_edu or eqf_occ),
        "aggregate_type": "related" if admitted else "none",
        "confidence": "medium" if admitted and okz else "low",
        "skills": skills,
        "notes": (
            "Эвристический черновик по методике ГАРМ-ESCO. "
            "Занятие и навыки ESCO не заполнены без верифицированных кандидатов."
            if admitted
            else "Профессиональная компетенция без трудовой функции к гармонизации не допускается."
        ),
        "esco_version": ESCO_VERSION_LABEL,
    }


def _fetch_occupation_candidates(session: Session, payload: dict[str, Any], base: dict[str, Any]) -> list[dict[str, str]]:
    okz = base.get("okz") or ""
    title = str(payload.get("title") or "").strip()
    items: list[dict[str, str]] = []
    seen: set[str] = set()

    def add_batch(res: dict[str, Any]) -> None:
        for it in res.get("items") or []:
            uri = str(it.get("uri") or "").strip()
            if not uri or uri in seen:
                continue
            seen.add(uri)
            items.append(
                {
                    "uri": uri,
                    "title": str(it.get("title") or "").strip(),
                    "isco": str(it.get("isco") or "").strip(),
                    "code": str(it.get("code") or "").strip(),
                }
            )

    try:
        if okz:
            add_batch(search_occupations(session, q="", isco=okz, limit=12))
        if title:
            add_batch(search_occupations(session, q=title, isco="", limit=8))
    except Exception:
        pass
    return items[:16]


def _flatten_skill_candidates(skill_candidates: dict[str, list[dict[str, str]]]) -> list[dict[str, str]]:
    flat: list[dict[str, str]] = []
    seen: set[str] = set()
    for rows in skill_candidates.values():
        for row in rows or []:
            uri = str(row.get("uri") or "").strip()
            if not uri or uri in seen:
                continue
            seen.add(uri)
            flat.append({"uri": uri, "title": str(row.get("title") or "").strip()})
    return flat


def _fetch_skill_candidates(
    session: Session,
    *,
    occupation_uri: str,
    components: list[dict[str, str]],
) -> dict[str, list[dict[str, str]]]:
    out: dict[str, list[dict[str, str]]] = {}
    if not components:
        return out
    try:
        if occupation_uri:
            res = search_skills(session, q="", occupation_uri=occupation_uri, limit=60)
            pool = [
                {"uri": str(it.get("uri") or "").strip(), "title": str(it.get("title") or "").strip()}
                for it in (res.get("items") or [])
                if str(it.get("uri") or "").strip()
            ]
            # Пустой кэш — принудительно подтянуть профиль занятия с ESCO API.
            if not pool:
                try:
                    from .esco_registry import cache_occupation_profile

                    cache_occupation_profile(session, occupation_uri)
                    res = search_skills(session, q="", occupation_uri=occupation_uri, limit=60)
                    pool = [
                        {
                            "uri": str(it.get("uri") or "").strip(),
                            "title": str(it.get("title") or "").strip(),
                        }
                        for it in (res.get("items") or [])
                        if str(it.get("uri") or "").strip()
                    ]
                except Exception:
                    pool = []
            for row in components:
                out[row["component"]] = pool[:40]
            return out
    except Exception:
        pass

    for row in components:
        text = row["text"]
        # Поиск по русскому тексту в английском ESCO часто пуст — всё равно пробуем короткий запрос.
        query = text[:80]
        try:
            res = search_skills(session, q=query, occupation_uri="", limit=8)
            out[row["component"]] = [
                {"uri": str(it.get("uri") or "").strip(), "title": str(it.get("title") or "").strip()}
                for it in (res.get("items") or [])
                if str(it.get("uri") or "").strip()
            ][:8]
        except Exception:
            out[row["component"]] = []
    return out


def _build_user_prompt(
    payload: dict[str, Any],
    base: dict[str, Any],
    occupation_candidates: list[dict[str, str]],
    skill_candidates: dict[str, list[dict[str, str]]],
) -> str:
    schema = {
        "admitted": "boolean",
        "deny_reason": "string",
        "okz": "string",
        "isco": "string",
        "esco_occupation": "string — только title из occupation_candidates или пусто",
        "esco_occupation_uri": "string — только uri из occupation_candidates или пусто",
        "occupation_type": "equivalent|broader|narrower|related|none",
        "eqf_occupational": "number|null",
        "eqf_educational": "number|null",
        "isced": "string",
        "aggregate_type": "equivalent|broader|narrower|related|none",
        "confidence": "high|medium|low",
        "skills": [
            {
                "component": "A1",
                "text": "национальный текст",
                "esco_term": "только title из skill_candidates[component] или пусто",
                "esco_uri": "только uri из skill_candidates[component] или пусто",
                "coverage": "full|partial|absent|national-only",
            }
        ],
        "notes": "методический комментарий на русском",
        "esco_version": ESCO_VERSION_LABEL,
    }
    return (
        "Паспорт компетенции (входные данные):\n"
        + json.dumps(payload, ensure_ascii=False)[:12000]
        + "\n\nБазовый расчёт допуска / EQF / ISCED / ОКЗ (не выдумывай против него без причины):\n"
        + json.dumps(base, ensure_ascii=False)[:8000]
        + "\n\nВерифицированные кандидаты занятий ESCO (единственный допустимый источник для занятия):\n"
        + json.dumps(occupation_candidates, ensure_ascii=False)[:6000]
        + "\n\nВерифицированные кандидаты навыков ESCO по компонентам "
        "(единственный допустимый источник для skills):\n"
        + json.dumps(skill_candidates, ensure_ascii=False)[:12000]
        + "\n\nОбязательно заполни skills для каждого компонента базового расчёта "
        "(покрытие навыков — часть черновика).\n"
        "Если кандидатный список пуст — не заполняй соответствующие ESCO-поля, "
        "поставь coverage=absent или national-only.\n"
        "Верни JSON со схемой:\n"
        + json.dumps(schema, ensure_ascii=False)
    )


def _build_skills_user_prompt(
    *,
    occupation_title: str,
    occupation_uri: str,
    components: list[dict[str, str]],
    skill_candidates: dict[str, list[dict[str, str]]],
) -> str:
    schema = {
        "skills": [
            {
                "component": "A1",
                "text": "национальный текст (скопируй из components)",
                "esco_term": "только title из skill_candidates[component] или пусто",
                "esco_uri": "только uri из skill_candidates[component] или пусто",
                "coverage": "full|partial|absent|national-only",
            }
        ],
        "notes": "краткий методический комментарий о покрытии навыков",
    }
    return (
        "Выбранное занятие ESCO (контекст):\n"
        + json.dumps(
            {"title": occupation_title, "uri": occupation_uri},
            ensure_ascii=False,
        )
        + "\n\nКомпоненты национального паспорта (заполни skills по каждому):\n"
        + json.dumps(components, ensure_ascii=False)[:8000]
        + "\n\nВерифицированные кандидаты навыков ESCO по компонентам "
        "(единственный допустимый источник):\n"
        + json.dumps(skill_candidates, ensure_ascii=False)[:14000]
        + "\n\nВерни JSON со схемой:\n"
        + json.dumps(schema, ensure_ascii=False)
    )


def _ask_skills_coverage(
    *,
    occupation_title: str,
    occupation_uri: str,
    components: list[dict[str, str]],
    skill_candidates: dict[str, list[dict[str, str]]],
) -> dict[str, Any]:
    """Второй проход ИИ: только таблица покрытия навыков."""
    if not components:
        return {"skills": [], "notes": ""}
    raw = chat_json(
        system=SKILLS_SYSTEM_PROMPT,
        user=_build_skills_user_prompt(
            occupation_title=occupation_title,
            occupation_uri=occupation_uri,
            components=components,
            skill_candidates=skill_candidates,
        ),
        temperature=0.1,
        timeout=120,
    )
    return raw if isinstance(raw, dict) else {}


def _pick_from_candidates(
    uri: str,
    title: str,
    candidates: list[dict[str, str]],
) -> tuple[str, str]:
    uri_s = (uri or "").strip()
    title_s = (title or "").strip()
    by_uri = {c["uri"]: c for c in candidates if c.get("uri")}
    if uri_s and uri_s in by_uri:
        hit = by_uri[uri_s]
        return hit.get("title") or title_s, uri_s
    # URI с хвостом / опечаткой регистра — сопоставляем по суффиксу path.
    if uri_s and by_uri:
        uri_l = uri_s.lower().rstrip("/")
        for cand_uri, hit in by_uri.items():
            cu = cand_uri.lower().rstrip("/")
            if uri_l == cu or uri_l.endswith(cu) or cu.endswith(uri_l):
                return hit.get("title") or title_s, cand_uri
    if title_s:
        title_l = title_s.lower()
        for c in candidates:
            if (c.get("title") or "").strip().lower() == title_l:
                return c.get("title") or title_s, c.get("uri") or ""
        # Мягкое совпадение (без выдумки URI): только для достаточно длинных строк.
        if len(title_l) >= 6:
            for c in candidates:
                cand = (c.get("title") or "").strip().lower()
                if len(cand) < 6:
                    continue
                if title_l in cand or cand in title_l:
                    return c.get("title") or title_s, c.get("uri") or ""
    return "", ""


def _normalize_suggestion(
    raw: dict[str, Any],
    base: dict[str, Any],
    occupation_candidates: list[dict[str, str]],
    skill_candidates: dict[str, list[dict[str, str]]],
    *,
    source: str,
    model: str | None,
) -> dict[str, Any]:
    occ_title, occ_uri = _pick_from_candidates(
        str(raw.get("esco_occupation_uri") or ""),
        str(raw.get("esco_occupation") or ""),
        occupation_candidates,
    )
    # Если ИИ не выбрал, но есть один явный кандидат по ОКЗ — не подставляем молча
    # (только верифицированный выбор или пусто).

    relation = str(raw.get("occupation_type") or base.get("occupation_type") or "none").lower()
    if relation not in RELATION_TYPES:
        relation = "none"
    agg = str(raw.get("aggregate_type") or base.get("aggregate_type") or "none").lower()
    if agg not in RELATION_TYPES:
        agg = "none"
    confidence = str(raw.get("confidence") or base.get("confidence") or "low").lower()
    if confidence not in CONFIDENCE:
        confidence = "low"

    base_skills = {
        str(s.get("component")): s
        for s in (base.get("skills") or [])
        if isinstance(s, dict)
    }
    raw_skills = raw.get("skills") if isinstance(raw.get("skills"), list) else []
    by_comp_raw = {
        str(s.get("component") or "").strip(): s
        for s in raw_skills
        if isinstance(s, dict) and str(s.get("component") or "").strip()
    }

    flat_skills = _flatten_skill_candidates(skill_candidates)
    skills_out: list[dict[str, Any]] = []
    for comp, seed in base_skills.items():
        chosen = by_comp_raw.get(comp) or {}
        cands = skill_candidates.get(comp) or []
        if not cands:
            cands = flat_skills
        term, uri = _pick_from_candidates(
            str(chosen.get("esco_uri") or chosen.get("escoUri") or ""),
            str(chosen.get("esco_term") or chosen.get("escoTerm") or ""),
            cands,
        )
        coverage = str(chosen.get("coverage") or seed.get("coverage") or "absent").lower()
        if coverage not in COVERAGE_TYPES:
            coverage = "absent"
        if NATIONAL_RE.search(str(seed.get("text") or "")):
            coverage = "national-only"
            term, uri = "", ""
        elif not uri:
            if coverage in ("full", "partial"):
                coverage = "absent"
        skills_out.append(
            {
                "id": str(seed.get("id") or comp),
                "component": comp,
                "text": str(seed.get("text") or ""),
                "esco_term": term,
                "esco_uri": uri,
                "coverage": coverage,
            }
        )

    admitted = bool(raw.get("admitted")) if "admitted" in raw else bool(base.get("admitted"))
    notes = str(raw.get("notes") or base.get("notes") or "").strip()
    if not occ_uri and admitted:
        notes = (
            (notes + " " if notes else "")
            + "Занятие ESCO не заполнено: среди верифицированных кандидатов однозначного соответствия не найдено."
        ).strip()
    if base_skills and not flat_skills:
        notes = (
            (notes + " " if notes else "")
            + "Покрытие навыков: нет верифицированных кандидатов ESCO для выбранного занятия "
            "(пустой профиль навыков) — строки оставлены с coverage=absent/national-only."
        ).strip()
    elif base_skills and not any(s.get("esco_uri") for s in skills_out):
        filled_cov = [s for s in skills_out if s.get("coverage") in ("full", "partial")]
        if not filled_cov:
            notes = (
                (notes + " " if notes else "")
                + "Покрытие навыков: ИИ не сопоставил компоненты с кандидатами ESCO "
                f"(кандидатов: {len(flat_skills)}). Проверьте вручную или повторите черновик."
            ).strip()

    isco = str(raw.get("isco") or base.get("isco") or "").strip()
    if occ_uri:
        for c in occupation_candidates:
            if c.get("uri") == occ_uri and c.get("isco"):
                isco = c["isco"]
                break

    def _num(v: Any) -> int | None:
        try:
            if v is None or str(v).strip() == "":
                return None
            return int(v)
        except (TypeError, ValueError):
            return None

    return {
        "admitted": admitted,
        "deny_reason": str(raw.get("deny_reason") or base.get("deny_reason") or ""),
        "okz": str(raw.get("okz") or base.get("okz") or ""),
        "isco": isco,
        "esco_occupation": occ_title,
        "esco_occupation_uri": occ_uri,
        "occupation_type": relation if admitted else "none",
        "eqf_occupational": _num(raw.get("eqf_occupational"))
        if raw.get("eqf_occupational") is not None
        else base.get("eqf_occupational"),
        "eqf_educational": _num(raw.get("eqf_educational"))
        if raw.get("eqf_educational") is not None
        else base.get("eqf_educational"),
        "isced": str(raw.get("isced") or base.get("isced") or ""),
        "aggregate_type": agg if admitted else "none",
        "confidence": confidence if admitted else "low",
        "skills": skills_out,
        "notes": notes[:2000],
        "esco_version": str(raw.get("esco_version") or ESCO_VERSION_LABEL),
        "analyzed_at": datetime.datetime.utcnow().isoformat() + "Z",
        "assistant": source,
        "model": model,
        "disclaimer": (
            "Черновик ИИ-агента по методике ГАРМ-ESCO. "
            "URI ESCO допускаются только из верифицированных кандидатов локального/официального реестра. "
            "Не является актом взаимного признания квалификаций."
        ),
    }


def suggest_garm_esco(session: Session, payload: dict[str, Any]) -> dict[str, Any]:
    base = _heuristic_base(payload)
    components = [
        {"component": s["component"], "text": s["text"]}
        for s in base.get("skills") or []
    ]
    occupation_candidates = _fetch_occupation_candidates(session, payload, base)

    # Предварительно подтянем навыки занятия, если есть явный ISCO-кандидат.
    provisional_occ_uri = ""
    if len(occupation_candidates) == 1:
        provisional_occ_uri = occupation_candidates[0].get("uri") or ""
    skill_candidates = _fetch_skill_candidates(
        session,
        occupation_uri=provisional_occ_uri,
        components=components,
    )

    if not deepseek_configured():
        # Без ИИ: эвристика + если ровно один кандидат занятия по ОКЗ — предложим его с low confidence.
        result = dict(base)
        if len(occupation_candidates) == 1 and result.get("admitted"):
            only = occupation_candidates[0]
            result["esco_occupation"] = only.get("title") or ""
            result["esco_occupation_uri"] = only.get("uri") or ""
            result["isco"] = only.get("isco") or result.get("isco") or ""
            result["confidence"] = "low"
            result["notes"] = (
                "Эвристический черновик: занятие предложено как единственный верифицированный "
                "кандидат по ОКЗ/ISCO. Покрытие навыков не заполнено без ИИ — требуется проверка методистом."
            )
        result["assistant"] = "heuristic"
        result["analyzed_at"] = datetime.datetime.utcnow().isoformat() + "Z"
        result["disclaimer"] = (
            "Эвристический черновик без ИИ. ESCO-поля заполняются только из верифицированных кандидатов."
        )
        result["status"] = deepseek_status()
        result["occupation_candidates_count"] = len(occupation_candidates)
        return result

    skills_pass_error = ""
    try:
        raw = chat_json(
            system=SYSTEM_PROMPT,
            user=_build_user_prompt(payload, base, occupation_candidates, skill_candidates),
            temperature=0.1,
            timeout=120,
        )
        if not isinstance(raw, dict):
            raw = {}

        if not components:
            raw["notes"] = (
                (str(raw.get("notes") or "").strip() + "\n" if raw.get("notes") else "")
                + "Покрытие навыков не заполнено: в паспорте пуста структура A/B/C "
                "(нет компонентов для таблицы)."
            ).strip()

        # После выбора занятия — подтянуть навыки занятия и отдельным проходом заполнить покрытие.
        chosen_uri, chosen_title = _pick_from_candidates(
            str(raw.get("esco_occupation_uri") or ""),
            str(raw.get("esco_occupation") or ""),
            occupation_candidates,
        )
        if chosen_uri and components:
            skill_candidates = _fetch_skill_candidates(
                session,
                occupation_uri=chosen_uri,
                components=components,
            )
            try:
                skills_raw = _ask_skills_coverage(
                    occupation_title=chosen_title,
                    occupation_uri=chosen_uri,
                    components=components,
                    skill_candidates=skill_candidates,
                )
                if isinstance(skills_raw.get("skills"), list) and skills_raw["skills"]:
                    raw["skills"] = skills_raw["skills"]
                skills_notes = str(skills_raw.get("notes") or "").strip()
                if skills_notes:
                    base_notes = str(raw.get("notes") or "").strip()
                    raw["notes"] = (
                        f"{base_notes}\n{skills_notes}".strip() if base_notes else skills_notes
                    )
            except Exception as skills_exc:
                skills_pass_error = str(skills_exc)[:400]
                raw["notes"] = (
                    (str(raw.get("notes") or "").strip() + "\n" if raw.get("notes") else "")
                    + f"Второй проход ИИ (покрытие навыков) не выполнен: {skills_pass_error}"
                ).strip()
        elif components:
            # Занятия нет, но компоненты есть — всё равно просим агента проставить coverage.
            try:
                skills_raw = _ask_skills_coverage(
                    occupation_title="",
                    occupation_uri="",
                    components=components,
                    skill_candidates=skill_candidates,
                )
                if isinstance(skills_raw.get("skills"), list) and skills_raw["skills"]:
                    raw["skills"] = skills_raw["skills"]
            except Exception as skills_exc:
                skills_pass_error = str(skills_exc)[:400]
                raw["notes"] = (
                    (str(raw.get("notes") or "").strip() + "\n" if raw.get("notes") else "")
                    + f"Проход ИИ по навыкам без занятия не выполнен: {skills_pass_error}"
                ).strip()

        status = deepseek_status()
        result = _normalize_suggestion(
            raw,
            base,
            occupation_candidates,
            skill_candidates,
            source="ai-agent",
            model=status.get("model"),
        )
        result["status"] = status
        result["occupation_candidates_count"] = len(occupation_candidates)
        result["skill_candidates_count"] = len(_flatten_skill_candidates(skill_candidates))
        result["components_count"] = len(components)
        if skills_pass_error:
            result["skills_pass_error"] = skills_pass_error
        return result
    except Exception as exc:
        fallback = _normalize_suggestion(
            {},
            base,
            occupation_candidates,
            skill_candidates,
            source="heuristic-fallback",
            model=None,
        )
        fallback["notes"] = (
            f"ИИ-агент недоступен ({exc}). Показан эвристический черновик без выдуманных URI ESCO. "
            + str(fallback.get("notes") or "")
        )[:2000]
        fallback["status"] = deepseek_status()
        fallback["occupation_candidates_count"] = len(occupation_candidates)
        return fallback
