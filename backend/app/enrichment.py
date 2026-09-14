import re
from sqlalchemy.orm import Session
import numpy as np
from typing import List, Dict, Tuple
from .db import SessionLocal, StandardRaw, GeneralizedFunctionRaw, ParticularFunctionRaw, LaborActionRaw, SkillRaw, KnowledgeRaw
from .db.enriched_models import (
    EnrichedStandard, EnrichedGeneralizedFunction, EnrichedParticularFunction,
    EnrichedLaborAction, EnrichedSkill, EnrichedKnowledge
)
from .parser import parse_tf_page, get_tf_links_from_standard_page, normalize_okso_code, find_element_id_by_reg_number
import requests
from bs4 import BeautifulSoup

_model = None

def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
    return _model

def get_embedding(text: str) -> np.ndarray:
    model = get_model()
    return model.encode(text, convert_to_numpy=True)

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def distribute_items(actions_texts, items_texts, action_embeddings, item_embeddings):
    n_actions = len(actions_texts)
    n_items = len(items_texts)
    if n_items == 0:
        return [[] for _ in range(n_actions)]
    if n_actions == 0:
        return []

    similarities = np.zeros((n_actions, n_items))
    for i in range(n_actions):
        for j in range(n_items):
            similarities[i][j] = cosine_similarity(action_embeddings[i], item_embeddings[j])

    pairs = [(i, j, similarities[i][j]) for i in range(n_actions) for j in range(n_items)]
    pairs.sort(key=lambda x: x[2], reverse=True)

    max_per_action = (n_items + n_actions - 1) // n_actions
    assigned_counts = [0] * n_actions
    assigned_item_to_action = [None] * n_items

    for i, j, score in pairs:
        if assigned_item_to_action[j] is None and assigned_counts[i] < max_per_action:
            assigned_item_to_action[j] = i
            assigned_counts[i] += 1

    for j in range(n_items):
        if assigned_item_to_action[j] is None:
            min_count = min(assigned_counts)
            min_indices = [i for i, c in enumerate(assigned_counts) if c == min_count]
            i = min_indices[0]
            assigned_item_to_action[j] = i
            assigned_counts[i] += 1

    result = [[] for _ in range(n_actions)]
    for j, i in enumerate(assigned_item_to_action):
        result[i].append(items_texts[j])
    return result

def enrich_standard(reg_number: str, session: Session):
    # 1. Получаем raw-данные
    raw_std = session.query(StandardRaw).filter(StandardRaw.reg_number == reg_number).first()
    if not raw_std:
        raise ValueError(f"Стандарт с рег. номером {reg_number} не найден в raw-БД")
    print(f"\n=== Обогащение стандарта {reg_number} ===")

    # 2. Источник умений/знаний: classinform или страницы ТФ Минтруда
    element_id = (raw_std.element_id or "").strip()
    tf_data_map: dict = {}

    if element_id.startswith("classinform:"):
        ps_code = element_id.split(":", 1)[1]
        print(f"  Источник classinform ({ps_code}) — умения/знания не с Минтруда")
        from .classinform_parser import get_tf_data_from_classinform
        tf_data_map = get_tf_data_from_classinform(ps_code)
        print(f"  ТФ с classinform: {len(tf_data_map)}")
        if not tf_data_map:
            print("  ⚠ classinform не вернул умения/знания — enriched из raw (трудовые действия)")
    else:
        if not element_id:
            print(f"  element_id пуст — ищем ID на сайте Минтруда...")
            from .parser import reg_to_element_cache
            element_id = reg_to_element_cache.get(reg_number) or find_element_id_by_reg_number(reg_number) or ""
            if element_id:
                raw_std.element_id = element_id
                session.commit()
                print(f"  Найден и сохранён ELEMENT_ID: {element_id}")
        else:
            print(f"  Используем element_id из БД: {element_id}")

        if not element_id:
            raise ValueError(f"Не удалось определить element_id для {reg_number}")

        print("  Получение ссылок на ТФ со страницы стандарта...")
        tf_links = get_tf_links_from_standard_page(element_id)
        print(f"  Найдено {len(tf_links)} ссылок на ТФ")
        if not tf_links:
            raise ValueError(
                f"На странице ПС ELEMENT_ID={element_id} нет ссылок на трудовые функции — "
                f"enriched-запись не создана"
            )
        for link in tf_links:
            tf_name = link["name"]
            print(f"  Парсинг ТФ: {tf_name}")
            tf_data = parse_tf_page(link["url"])
            tf_data_map[tf_name] = tf_data
            print(
                f"    Получено: {len(tf_data.get('skills', []))} умений, "
                f"{len(tf_data.get('knowledges', []))} знаний"
            )

    # 5. Обновляем raw: добавляем умения и знания (без изменений)
    for gf_raw in raw_std.generalized_functions:
        for pf_raw in gf_raw.particular_functions:
            tf_name = pf_raw.name
            skills = tf_data_map.get(tf_name, {}).get('skills', [])
            knowledges = tf_data_map.get(tf_name, {}).get('knowledges', [])
            
            session.query(SkillRaw).filter(SkillRaw.particular_id == pf_raw.id).delete()
            session.query(KnowledgeRaw).filter(KnowledgeRaw.particular_id == pf_raw.id).delete()
            for skill_text in skills:
                skill = SkillRaw(particular_id=pf_raw.id, text=skill_text)
                session.add(skill)
            for know_text in knowledges:
                know = KnowledgeRaw(particular_id=pf_raw.id, text=know_text)
                session.add(know)
    session.commit()
    print("  Raw-данные обновлены (умения и знания добавлены на уровень ТФ)")

    # 6. Удаляем старую enriched-запись
    session.query(EnrichedStandard).filter(EnrichedStandard.reg_number == reg_number).delete()
    session.commit()
    print("  Старая enriched-запись удалена")

    # 7. Создаём enriched-стандарт
    enriched_std = EnrichedStandard(
        reg_number=raw_std.reg_number,
        name=raw_std.name,
        order_number=raw_std.order_number,
        approval_date=raw_std.approval_date,
        kind_activity=raw_std.kind_activity,
        purpose=raw_std.purpose,
        professional_area_code=raw_std.professional_area_code,
        okved_codes=raw_std.okved_codes,
        status=getattr(raw_std, "status", None) or "active",
        revoked_date=getattr(raw_std, "revoked_date", None),
    )
    session.add(enriched_std)
    session.flush()
    print("  Enriched-стандарт создан")

    # 8. Проходим по всем ОТФ и ТФ
    for gf_raw in raw_std.generalized_functions:
        gf_enr = EnrichedGeneralizedFunction(
            standard_id=enriched_std.id,
            code=gf_raw.code,
            name=gf_raw.name,
            level=gf_raw.level,
            possible_job_titles=gf_raw.possible_job_titles,
            okz_codes=gf_raw.okz_codes,
            okpdtr_codes=gf_raw.okpdtr_codes,
            okso_codes=gf_raw.okso_codes
        )
        session.add(gf_enr)
        session.flush()
        print(f"  ОТФ {gf_raw.code} создана")

        for pf_raw in gf_raw.particular_functions:
            pf_enr = EnrichedParticularFunction(
                generalized_id=gf_enr.id,
                code=pf_raw.code,
                name=pf_raw.name,
                sub_qualification=pf_raw.sub_qualification
            )
            session.add(pf_enr)
            session.flush()

            labor_actions = [la.text for la in pf_raw.labor_actions]
            tf_name = pf_raw.name
            skills = tf_data_map.get(tf_name, {}).get('skills', [])
            knowledges = tf_data_map.get(tf_name, {}).get('knowledges', [])
            print(f"    ТФ {pf_raw.code}: labor_actions={len(labor_actions)}, skills={len(skills)}, knowledges={len(knowledges)}")

            if not labor_actions or (not skills and not knowledges):
                for la_text in labor_actions:
                    action = EnrichedLaborAction(particular_id=pf_enr.id, text=la_text)
                    session.add(action)
                continue

            # Вычисляем эмбеддинги
            action_embeddings = [get_embedding(la) for la in labor_actions]
            skill_embeddings = [get_embedding(s) for s in skills] if skills else []
            know_embeddings = [get_embedding(k) for k in knowledges] if knowledges else []

            # Распределяем умения
            if skills:
                skill_distribution = distribute_items(labor_actions, skills, action_embeddings, skill_embeddings)
            else:
                skill_distribution = [[] for _ in labor_actions]

            # Распределяем знания
            if knowledges:
                know_distribution = distribute_items(labor_actions, knowledges, action_embeddings, know_embeddings)
            else:
                know_distribution = [[] for _ in labor_actions]

            # Создаём действия с привязками
            for i, la_text in enumerate(labor_actions):
                action = EnrichedLaborAction(particular_id=pf_enr.id, text=la_text)
                session.add(action)
                session.flush()

                for skill_text in skill_distribution[i]:
                    skill_obj = session.query(EnrichedSkill).filter(EnrichedSkill.text == skill_text).first()
                    if not skill_obj:
                        skill_obj = EnrichedSkill(text=skill_text)
                        session.add(skill_obj)
                        session.flush()
                    action.skills.append(skill_obj)

                for know_text in know_distribution[i]:
                    know_obj = session.query(EnrichedKnowledge).filter(EnrichedKnowledge.text == know_text).first()
                    if not know_obj:
                        know_obj = EnrichedKnowledge(text=know_text)
                        session.add(know_obj)
                        session.flush()
                    action.knowledges.append(know_obj)

    session.commit()
    print(f"  Обогащение стандарта {reg_number} завершено успешно")


def get_enriched_reg_numbers(session: Session) -> set[str]:
    """Рег. номера с enriched-записью, для которых есть raw."""
    rows = (
        session.query(EnrichedStandard.reg_number)
        .join(StandardRaw, StandardRaw.reg_number == EnrichedStandard.reg_number)
        .all()
    )
    return {r[0] for r in rows if r[0]}


def delete_enriched_by_reg_number(session: Session, reg_number: str) -> bool:
    row = session.query(EnrichedStandard).filter(EnrichedStandard.reg_number == reg_number).first()
    if not row:
        return False
    session.delete(row)
    return True


def cleanup_orphaned_enriched(session: Session, *, commit: bool = True) -> list[str]:
    """Удаляет enriched-записи без соответствующего raw ПС."""
    raw_regs = {r[0] for r in session.query(StandardRaw.reg_number).all() if r[0]}
    if raw_regs:
        orphans = (
            session.query(EnrichedStandard)
            .filter(~EnrichedStandard.reg_number.in_(raw_regs))
            .all()
        )
    else:
        orphans = session.query(EnrichedStandard).all()

    removed = [o.reg_number for o in orphans if o.reg_number]
    for row in orphans:
        session.delete(row)
    if commit and orphans:
        session.commit()
    return removed


def get_unenriched_standards(session: Session) -> list[StandardRaw]:
    enriched_regs = get_enriched_reg_numbers(session)
    if not enriched_regs:
        return session.query(StandardRaw).order_by(StandardRaw.reg_number).all()
    return (
        session.query(StandardRaw)
        .filter(~StandardRaw.reg_number.in_(enriched_regs))
        .order_by(StandardRaw.reg_number)
        .all()
    )


def get_enrichment_stats(session: Session, *, cleanup_orphans: bool = False) -> dict:
    if cleanup_orphans:
        cleanup_orphaned_enriched(session, commit=True)

    total_raw = session.query(StandardRaw).count()
    raw_regs = {r[0] for r in session.query(StandardRaw.reg_number).all() if r[0]}
    enriched_regs = {r[0] for r in session.query(EnrichedStandard.reg_number).all() if r[0]}

    matched = len(raw_regs & enriched_regs)
    pending = len(raw_regs - enriched_regs)
    orphaned = len(enriched_regs - raw_regs)

    return {
        "total_raw": total_raw,
        "enriched": matched,
        "pending": pending,
        "orphaned_enriched": orphaned,
    }


def enrich_standards_batch(
    session: Session,
    *,
    only_missing: bool = True,
    reg_numbers: list[str] | None = None,
) -> dict:
    """
    only_missing=True  — только ПС без записи в enriched_standards
    only_missing=False — все raw ПС (переобогащение)
    reg_numbers        — явный список рег. номеров (only_missing игнорируется)
    """
    cleanup_orphaned_enriched(session, commit=True)

    if reg_numbers:
        targets = []
        for reg in reg_numbers:
            std = session.query(StandardRaw).filter(StandardRaw.reg_number == reg).first()
            if std:
                targets.append(std)
    elif only_missing:
        targets = get_unenriched_standards(session)
    else:
        targets = session.query(StandardRaw).order_by(StandardRaw.reg_number).all()

    processed: list[str] = []
    failed: list[dict] = []
    stats_before = get_enrichment_stats(session)

    for i, std in enumerate(targets, 1):
        print(f"\n[{i}/{len(targets)}] Обогащение reg={std.reg_number}")
        try:
            enrich_standard(std.reg_number, session)
            processed.append(std.reg_number)
        except Exception as e:
            print(f"  Ошибка: {e}")
            failed.append({"reg_number": std.reg_number, "error": str(e)})

    stats_after = get_enrichment_stats(session)
    return {
        "processed": processed,
        "failed": failed,
        "requested": len(targets),
        "pending_before": stats_before["pending"],
        **stats_after,
    }