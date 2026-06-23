import re
from sqlalchemy.orm import Session
import numpy as np
from typing import List, Dict, Tuple
from .db import SessionLocal, StandardRaw, GeneralizedFunctionRaw, ParticularFunctionRaw, LaborActionRaw, SkillRaw, KnowledgeRaw
from .db.enriched_models import (
    EnrichedStandard, EnrichedGeneralizedFunction, EnrichedParticularFunction,
    EnrichedLaborAction, EnrichedSkill, EnrichedKnowledge
)
from .parser import parse_tf_page, get_tf_links_from_standard_page

# Глобальная переменная для модели (ленивая инициализация)
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
    """
    Распределяет элементы (умения/знания) между действиями.
    Возвращает список списков: для каждого действия — список элементов.
    """
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

    max_per_action = (n_items + n_actions - 1) // n_actions  # ceil
    assigned_counts = [0] * n_actions
    assigned_item_to_action = [None] * n_items

    for i, j, score in pairs:
        if assigned_item_to_action[j] is None and assigned_counts[i] < max_per_action:
            assigned_item_to_action[j] = i
            assigned_counts[i] += 1

    # Если остались не назначенные элементы (на всякий случай)
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
    """
    Обогащает один стандарт: читает из raw, парсит HTML трудовых функций,
    распределяет умения и знания по трудовым действиям с помощью эмбеддингов,
    и сохраняет в enriched-таблицы.
    """
    # 1. Получаем raw-данные
    raw_std = session.query(StandardRaw).filter(StandardRaw.reg_number == reg_number).first()
    if not raw_std:
        raise ValueError(f"Стандарт с рег. номером {reg_number} не найден в raw-БД")

    # 2. Получаем element_id
    element_id = raw_std.element_id
    if not element_id:
        from .parser import reg_to_element_cache
        element_id = reg_to_element_cache.get(reg_number)
        if not element_id:
            raise ValueError(f"Не удалось определить element_id для {reg_number}")

    # 3. Получаем ссылки на ТФ со страницы стандарта
    tf_links = get_tf_links_from_standard_page(element_id)
    # 4. Для каждой ТФ парсим страницу, получаем списки умений и знаний
    tf_data_map = {}
    for link in tf_links:
        tf_name = link['name']
        tf_data = parse_tf_page(link['url'])
        tf_data_map[tf_name] = tf_data

    # 5. Обновляем raw-таблицы: добавляем умения и знания на уровне ТФ
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

    # 6. Строим enriched-структуру
    session.query(EnrichedStandard).filter(EnrichedStandard.reg_number == reg_number).delete()
    session.commit()

    enriched_std = EnrichedStandard(
        reg_number=raw_std.reg_number,
        name=raw_std.name,
        order_number=raw_std.order_number,
        approval_date=raw_std.approval_date,
        kind_activity=raw_std.kind_activity,
        purpose=raw_std.purpose
    )
    session.add(enriched_std)
    session.flush()

    for gf_raw in raw_std.generalized_functions:
        gf_enr = EnrichedGeneralizedFunction(
            standard_id=enriched_std.id,
            code=gf_raw.code,
            name=gf_raw.name,
            level=gf_raw.level,
            possible_job_titles=gf_raw.possible_job_titles
        )
        session.add(gf_enr)
        session.flush()
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

            if not skills and not knowledges:
                for la_text in labor_actions:
                    action = EnrichedLaborAction(
                        particular_id=pf_enr.id,
                        text=la_text
                    )
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
                action = EnrichedLaborAction(
                    particular_id=pf_enr.id,
                    text=la_text
                )
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