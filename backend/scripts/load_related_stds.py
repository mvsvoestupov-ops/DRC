import os
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, quote
from app.db import SessionLocal
from app.db.raw_models import StandardRaw
from app.db.qualifications_models import Qualification
from app.parser import download_bulk_xml_chunk, parse_bulk_xml, save_raw_standard, REGISTRY_BASE_URL

def find_element_id_by_name(name: str, order: str = None) -> str:
    """
    Ищет ELEMENT_ID профессионального стандарта по названию и/или номеру приказа.
    Возвращает строку ID или None.
    """
    # Формируем поисковый запрос: используем название или приказ
    query = name
    if order:
        # Очищаем номер приказа от лишних слов
        order_clean = order.replace('Приказ', '').strip()
        query += f' {order_clean}'
    
    search_url = urljoin(REGISTRY_BASE_URL, f"index.php?search={quote(query)}")
    print(f"  Поиск: {search_url}")
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    try:
        response = requests.get(search_url, headers=headers, verify=False, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"  Ошибка поиска: {e}")
        return None
    
    soup = BeautifulSoup(response.text, 'html.parser')
    # Ищем ссылки, содержащие 'reestr-professionalnykh-standartov/index.php?ELEMENT_ID='
    for link in soup.find_all('a', href=True):
        href = link['href']
        if 'reestr-professionalnykh-standartov/index.php' in href and 'ELEMENT_ID=' in href:
            # Проверяем, что текст ссылки содержит часть названия
            link_text = link.get_text(strip=True)
            if name[:20].lower() in link_text.lower():
                # Извлекаем ID
                import re
                match = re.search(r'ELEMENT_ID=(\d+)', href)
                if match:
                    return match.group(1)
    return None

def load_professional_standard_by_id(element_id: str):
    """
    Загружает и сохраняет профессиональный стандарт по его ELEMENT_ID.
    """
    session = SessionLocal()
    try:
        # Проверяем, не загружен ли уже этот ПС (по element_id)
        existing = session.query(StandardRaw).filter(StandardRaw.element_id == element_id).first()
        if existing:
            print(f"  ПС с ID {element_id} уже загружен (рег. № {existing.reg_number})")
            return
        
        # Скачиваем и парсим
        chunk = [element_id]
        xml_path = os.path.join('downloads', f'standards_{element_id}.xml')
        os.makedirs('downloads', exist_ok=True)
        download_bulk_xml_chunk(chunk, xml_path)
        standards = parse_bulk_xml(xml_path, element_ids=chunk)
        if standards:
            std = standards[0]
            save_raw_standard(session, std, element_id)
            session.commit()
            print(f"  Загружен ПС: {std.registration_number} - {std.name}")
        else:
            print(f"  Не удалось распарсить ПС с ID {element_id}")
    except Exception as e:
        print(f"  Ошибка загрузки ПС {element_id}: {e}")
    finally:
        session.close()

def load_all_related_professional_standards():
    """
    Находит все уникальные ПС, упомянутые в квалификациях, и загружает их.
    """
    session = SessionLocal()
    try:
        # Получаем все квалификации, у которых указан ПС (не "Нет связанного...")
        quals = session.query(Qualification).filter(
            Qualification.prof_standard_name.isnot(None),
            Qualification.prof_standard_name != '',
            Qualification.prof_standard_name != 'Нет связанного профессионального стандарта'
        ).all()
        
        # Собираем уникальные пары (название, приказ)
        ps_set = set()
        for q in quals:
            key = (q.prof_standard_name.strip(), q.prof_standard_order.strip() if q.prof_standard_order else '')
            ps_set.add(key)
        
        print(f"Найдено уникальных профессиональных стандартов в квалификациях: {len(ps_set)}")
        
        for name, order in ps_set:
            print(f"\nОбработка: {name} | {order}")
            # Ищем ID
            element_id = find_element_id_by_name(name, order)
            if element_id:
                print(f"  Найден ELEMENT_ID: {element_id}")
                load_professional_standard_by_id(element_id)
            else:
                print(f"  Не удалось найти ELEMENT_ID для {name}")
            time.sleep(0.5)  # пауза между запросами
    except Exception as e:
        print(f"Ошибка: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    load_all_related_professional_standards()