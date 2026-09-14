import os
import time
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, quote
from app.db import SessionLocal
from app.db.raw_models import StandardRaw
from app.db.qualifications_models import Qualification
from app.parser import download_bulk_xml_chunk, parse_bulk_xml, save_raw_standard, REGISTRY_BASE_URL

def find_element_id_by_order(order_key: str) -> str:
    """
    Ищет ELEMENT_ID по номеру приказа (например, "544н").
    """
    search_url = urljoin(REGISTRY_BASE_URL, f"index.php?search={quote(order_key)}")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    try:
        response = requests.get(search_url, headers=headers, verify=False, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"  Ошибка поиска по приказу {order_key}: {e}")
        return None
    
    soup = BeautifulSoup(response.text, 'html.parser')
    for link in soup.find_all('a', href=True):
        href = link['href']
        if 'reestr-professionalnykh-standartov/index.php' in href and 'ELEMENT_ID=' in href:
            text = link.get_text(strip=True)
            if order_key.lower() in text.lower():
                match = re.search(r'ELEMENT_ID=(\d+)', href)
                if match:
                    return match.group(1)
    return None

def load_professional_standard_by_id(element_id: str):
    session = SessionLocal()
    try:
        existing = session.query(StandardRaw).filter(StandardRaw.element_id == element_id).first()
        if existing:
            print(f"  ПС с ID {element_id} уже загружен (рег. № {existing.reg_number})")
            return
        
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
    Находит все уникальные номера приказов из квалификаций и загружает соответствующие ПС.
    """
    session = SessionLocal()
    try:
        quals = session.query(Qualification).filter(
            Qualification.prof_standard_name.isnot(None),
            Qualification.prof_standard_name != '',
            Qualification.prof_standard_name != 'Нет связанного профессионального стандарта'
        ).all()
        
        # Собираем уникальные номера приказов (нормализованные)
        ps_set = set()
        for q in quals:
            order = q.prof_standard_order.strip() if q.prof_standard_order else ''
            if order:
                # Извлекаем номер приказа: ищем "N 544н", "№ 544н", "544н" и т.п.
                match = re.search(r'(?:N|№|n|N\.?)\s*(\d+[а-я]?)', order, re.IGNORECASE)
                if match:
                    key = match.group(1).strip()
                    ps_set.add(key)
                else:
                    # Если не нашли, пробуем взять последнее слово (может быть номер)
                    parts = order.split()
                    last = parts[-1] if parts else ''
                    if re.match(r'\d+[а-я]?', last):
                        ps_set.add(last)
        
        print(f"Найдено уникальных приказов: {len(ps_set)}")
        for order_key in ps_set:
            print(f"\nПоиск по приказу: {order_key}")
            element_id = find_element_id_by_order(order_key)
            if element_id:
                print(f"  Найден ELEMENT_ID: {element_id}")
                load_professional_standard_by_id(element_id)
            else:
                print(f"  Не найден ELEMENT_ID для приказа {order_key}")
            time.sleep(1)  # задержка
    except Exception as e:
        print(f"Ошибка: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    load_all_related_professional_standards()