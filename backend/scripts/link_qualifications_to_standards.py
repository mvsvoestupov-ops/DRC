"""
Скрипт связывает квалификации из таблицы qualifications с профессиональными стандартами
из таблицы raw_standards по названию и номеру приказа.
"""
import re
from sqlalchemy import func
from app.db import SessionLocal
from app.db.raw_models import StandardRaw
from app.db.qualifications_models import Qualification


def normalize_order_number(order_text: str) -> str:
    """
    Нормализует номер приказа, извлекая ключевую часть (например, "544н" из "... N 544н").
    """
    if not order_text:
        return ''
    # Удаляем "Приказ Министерства труда ... от ..." и оставляем номер
    # Ищем номер формата "N 544н", "№ 544н", "544н" (с буквой)
    match = re.search(r'(?:N|№|n|N\.?)\s*(\d+[а-я]?)', order_text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    # Если не нашли, пытаемся взять всё, что после последнего пробела (если похоже на номер)
    parts = order_text.split()
    last = parts[-1] if parts else ''
    if re.match(r'\d+[а-я]?', last):
        return last
    return ''

def find_standard_for_qualification(q, session):
    """
    Ищет ПС для одной квалификации.
    Возвращает StandardRaw или None.
    """
    # 1. По точному названию
    if q.prof_standard_name:
        std = session.query(StandardRaw).filter(
            func.lower(StandardRaw.name) == func.lower(q.prof_standard_name.strip())
        ).first()
        if std:
            return std, 'точное название'
    
    # 2. По номеру приказа (нормализованному)
    if q.prof_standard_order:
        order_norm = normalize_order_number(q.prof_standard_order)
        if order_norm:
            std = session.query(StandardRaw).filter(
                func.lower(StandardRaw.order_number).like(f'%{order_norm.lower()}%')
            ).first()
            if std:
                return std, 'номер приказа'
    
    # 3. По частичному совпадению названия (первые 30 символов)
    if q.prof_standard_name and len(q.prof_standard_name) > 10:
        # Берём первые 30 символов (или до запятой)
        name_part = q.prof_standard_name[:30]
        std = session.query(StandardRaw).filter(
            func.lower(StandardRaw.name).like(f'%{name_part.lower()}%')
        ).first()
        if std:
            return std, 'частичное название'
    
    # 4. По частичному совпадению номера приказа (без нормализации)
    if q.prof_standard_order:
        order_clean = re.sub(r'[^0-9а-яa-z]', '', q.prof_standard_order.lower())
        if len(order_clean) > 3:
            std = session.query(StandardRaw).filter(
                func.lower(StandardRaw.order_number).like(f'%{order_clean}%')
            ).first()
            if std:
                return std, 'частичный приказ'
    
    return None, None

def link_qualifications(update_existing=True, dry_run=False):
    """
    Основная функция связывания.
    - update_existing: обновлять ли уже существующие связи (если False, только заполняет пустые)
    - dry_run: если True, только выводит информацию, не сохраняет
    """
    session = SessionLocal()
    try:
        # Получаем все квалификации, у которых есть указание на ПС (не пусто и не "Нет связанного...")
        quals = session.query(Qualification).filter(
            Qualification.prof_standard_name.isnot(None),
            Qualification.prof_standard_name != '',
            Qualification.prof_standard_name != 'Нет связанного профессионального стандарта'
        ).all()
        
        print(f"Всего квалификаций с указанием ПС: {len(quals)}")
        
        linked_count = 0
        skipped_count = 0
        not_found_count = 0
        
        for q in quals:
            # Если связь уже есть и мы не обновляем, пропускаем
            if q.prof_standard_id is not None and not update_existing:
                skipped_count += 1
                continue
            
            std, method = find_standard_for_qualification(q, session)
            if std:
                if not dry_run:
                    q.prof_standard_id = std.id
                linked_count += 1
                print(f"✓ {q.code} -> {std.reg_number} ({method})")
            else:
                not_found_count += 1
                print(f"✗ {q.code}: не найден ПС для '{q.prof_standard_name[:50]}' | приказ: {q.prof_standard_order}")
        
        if not dry_run:
            session.commit()
            print(f"\n✅ Связывание завершено. Создано {linked_count} связей. Пропущено {skipped_count} (уже есть). Не найдено {not_found_count}.")
        else:
            print(f"\n🔍 Режим тестирования (dry_run). Найдено {linked_count} потенциальных связей, не найдено {not_found_count}.")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Ошибка: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    import sys
    dry = '--dry-run' in sys.argv
    update = '--update' in sys.argv or not dry  # по умолчанию обновляем все, если не указан --no-update
    if '--no-update' in sys.argv:
        update = False
    
    print(f"Режим: {'тестовый (dry-run)' if dry else 'реальный'}")
    print(f"Обновление существующих связей: {'да' if update else 'нет (только новые)'}")
    link_qualifications(update_existing=update, dry_run=dry)