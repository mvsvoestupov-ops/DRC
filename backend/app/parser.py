import os
import time
import re
import requests
from lxml import etree
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs, urljoin
from typing import List, Dict, Optional
from .models import *
from .db_operations import save_raw_standard
from .db import SessionLocal

# Базовый URL реестра
REGISTRY_BASE_URL = "https://profstandart.rosmintrud.ru/obshchiy-informatsionnyy-blok/natsionalnyy-reestr-professionalnykh-standartov/reestr-professionalnykh-standartov/index.php"

# Кэш для трудовых функций (чтобы не парсить одно и то же дважды)
tf_cache = {}
# Кэш для соответствия reg_number -> element_id
reg_to_element_cache = {}


# ============================================================
# 1. Функция для парсинга ОДНОГО XML (для загрузки через интерфейс)
# ============================================================
def parse_xml(content: bytes) -> ProfessionalStandard:
    """Парсит XML-файл одного профессионального стандарта."""
    root = etree.fromstring(content)
    ps = root.find('.//ProfessionalStandart')
    if ps is None:
        raise ValueError("ProfessionalStandart not found")

    name = ps.findtext('NameProfessionalStandart', '').strip()
    reg_num = ps.findtext('RegistrationNumber', '').strip()
    order_num = ps.findtext('OrderNumber', '').strip()
    date = ps.findtext('DateOfApproval', '').strip()

    first_section = ps.find('FirstSection')
    kind = first_section.findtext('KindProfessionalActivity', '').strip() if first_section is not None else ''
    purpose = first_section.findtext('PurposeKindProfessionalActivity', '').strip() if first_section is not None else ''

    third_section = ps.find('ThirdSection')
    generalized_functions = []
    if third_section is not None:
        work_functions = third_section.find('.//WorkFunctions')
        if work_functions is not None:
            generalized = work_functions.find('.//GeneralizedWorkFunctions')
            if generalized is not None:
                for g_node in generalized.findall('GeneralizedWorkFunction'):
                    code = g_node.findtext('CodeOTF', '').strip()
                    name_g = g_node.findtext('NameOTF', '').strip()
                    level = g_node.findtext('LevelOfQualification', '').strip()
                    titles = [t.text.strip() for t in g_node.findall('.//PossibleJobTitle')]
                    p_funcs = []
                    for p_node in g_node.findall('.//ParticularWorkFunction'):
                        p_code = p_node.findtext('CodeTF', '').strip()
                        p_name = p_node.findtext('NameTF', '').strip()
                        p_sub = p_node.findtext('SubQualification', '').strip()
                        
                        labor_actions = []
                        for la in p_node.findall('.//LaborAction'):
                            labor_actions.append(LaborAction(text=la.text.strip() if la.text else ''))
                        
                        p_funcs.append(
                            ParticularWorkFunction(
                                code=p_code,
                                name=p_name,
                                sub_qualification=p_sub,
                                labor_actions=labor_actions,
                                required_skills=[],
                                necessary_knowledges=[]
                            )
                        )
                    generalized_functions.append(
                        GeneralizedWorkFunction(
                            code=code,
                            name=name_g,
                            level=level,
                            possible_job_titles=titles,
                            particular_functions=p_funcs
                        )
                    )

    return ProfessionalStandard(
        name=name,
        registration_number=reg_num,
        order_number=order_num,
        approval_date=date,
        kind_activity=kind,
        purpose=purpose,
        generalized_functions=generalized_functions
    )


# ============================================================
# 2. Функция для парсинга XML-узла (для массовой загрузки)
# ============================================================
def parse_ps_node(ps_node) -> ProfessionalStandard:
    """Парсит XML-узел ProfessionalStandart напрямую (без переконвертации)."""
    name = ps_node.findtext('NameProfessionalStandart', '').strip()
    reg_num = ps_node.findtext('RegistrationNumber', '').strip()
    order_num = ps_node.findtext('OrderNumber', '').strip()
    date = ps_node.findtext('DateOfApproval', '').strip()

    first_section = ps_node.find('FirstSection')
    kind = first_section.findtext('KindProfessionalActivity', '').strip() if first_section is not None else ''
    purpose = first_section.findtext('PurposeKindProfessionalActivity', '').strip() if first_section is not None else ''

    third_section = ps_node.find('ThirdSection')
    generalized_functions = []
    if third_section is not None:
        work_functions = third_section.find('.//WorkFunctions')
        if work_functions is not None:
            generalized = work_functions.find('.//GeneralizedWorkFunctions')
            if generalized is not None:
                for g_node in generalized.findall('GeneralizedWorkFunction'):
                    code = g_node.findtext('CodeOTF', '').strip()
                    name_g = g_node.findtext('NameOTF', '').strip()
                    level = g_node.findtext('LevelOfQualification', '').strip()
                    titles = [t.text.strip() for t in g_node.findall('.//PossibleJobTitle')]
                    p_funcs = []
                    for p_node in g_node.findall('.//ParticularWorkFunction'):
                        p_code = p_node.findtext('CodeTF', '').strip()
                        p_name = p_node.findtext('NameTF', '').strip()
                        p_sub = p_node.findtext('SubQualification', '').strip()
                        
                        labor_actions = []
                        for la in p_node.findall('.//LaborAction'):
                            labor_actions.append(LaborAction(text=la.text.strip() if la.text else ''))
                        
                        p_funcs.append(
                            ParticularWorkFunction(
                                code=p_code,
                                name=p_name,
                                sub_qualification=p_sub,
                                labor_actions=labor_actions,
                                required_skills=[],
                                necessary_knowledges=[]
                            )
                        )
                    generalized_functions.append(
                        GeneralizedWorkFunction(
                            code=code,
                            name=name_g,
                            level=level,
                            possible_job_titles=titles,
                            particular_functions=p_funcs
                        )
                    )

    return ProfessionalStandard(
        name=name,
        registration_number=reg_num,
        order_number=order_num,
        approval_date=date,
        kind_activity=kind,
        purpose=purpose,
        generalized_functions=generalized_functions
    )


# ============================================================
# 3. Функции для сбора ID
# ============================================================
def get_element_ids_from_page(page_url: str) -> List[str]:
    """Парсит одну страницу реестра и возвращает список ELEMENT_ID."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    response = requests.get(page_url, headers=headers, verify=False, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, 'html.parser')
    ids = set()
    for link in soup.find_all('a', href=True):
        href = link['href']
        if 'reestr-professionalnykh-standartov/index.php' in href and 'ELEMENT_ID=' in href:
            parsed = urlparse(href)
            params = parse_qs(parsed.query)
            if 'ELEMENT_ID' in params:
                ids.add(params['ELEMENT_ID'][0])
    return list(ids)


def get_all_element_ids(base_url: str) -> List[str]:
    """Обходит все страницы реестра и собирает все ELEMENT_ID."""
    all_ids = set()
    page = 1
    max_pages = 1  # 👈 Ограничение на 1 страницу для тестирования
    while page <= max_pages:
        url = f"{base_url}?PAGEN_1={page}&SIZEN_1=100"
        print(f"Парсинг страницы {page}...")
        ids = get_element_ids_from_page(url)
        if not ids:
            break
        all_ids.update(ids)
        page += 1
        time.sleep(0.5)
    print(f"Всего собрано ID: {len(all_ids)}")
    return list(all_ids)


# ============================================================
# 4. Функция для скачивания XML через форму
# ============================================================
def download_bulk_xml_chunk(element_ids: List[str], save_path: str) -> str:
    """Отправляет POST-запрос на wservGenXMLSave.php с частью ID."""
    url = urljoin(REGISTRY_BASE_URL, "wservGenXMLSave.php")
    
    data = {}
    for i, elem_id in enumerate(element_ids):
        data[f'fn[{i}]'] = elem_id
    data['save'] = 'Скачать в XML'
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': REGISTRY_BASE_URL,
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    print(f"  Отправка {len(element_ids)} ID в wservGenXMLSave.php...")
    response = requests.post(url, data=data, headers=headers, verify=False, timeout=60)
    response.raise_for_status()
    
    with open(save_path, 'wb') as f:
        f.write(response.content)
    print(f"  Файл сохранён: {save_path} (размер: {len(response.content)} байт)")
    return save_path


# ============================================================
# 5. Универсальный парсер страницы трудовой функции (HTML)
# ============================================================
def split_by_capital(text: str) -> List[str]:
    """
    Разделяет текст по заглавным буквам (CamelCase).
    Пример: "Вести журналПользоваться программами" -> ["Вести журнал", "Пользоваться программами"]
    """
    if not text:
        return []
    
    result = []
    start = 0
    for i in range(1, len(text)):
        # Если текущая буква заглавная, а предыдущая строчная или точка/вопросительный знак
        if (text[i].isupper() and text[i-1].islower()) or \
           (text[i].isupper() and text[i-1] in '.!?;'):
            result.append(text[start:i].strip())
            start = i
    
    # Добавляем последнюю часть
    if start < len(text):
        result.append(text[start:].strip())
    
    # Если не удалось разделить, возвращаем исходный текст как один элемент
    if len(result) <= 1:
        return [text.strip()]
    
    return [p for p in result if p.strip() and len(p.strip()) > 3]


def clean_and_split(text: str) -> List[str]:
    """Очищает текст и разделяет по заглавным буквам."""
    if not text:
        return []
    # Убираем множественные пробелы
    text = re.sub(r'\s+', ' ', text).strip()
    # Разделяем по заглавным
    parts = split_by_capital(text)
    # Убираем пустые строки
    return [p.strip() for p in parts if p.strip() and len(p.strip()) > 3]


def parse_tf_page(tf_url: str) -> dict:
    """
    Парсит страницу трудовой функции и возвращает ТД, У, З.
    Для умений использует разделение по заглавным буквам (слипшийся текст).
    Для знаний использует разделение по переводу строки (т.к. на сайте они разделены <br />).
    """
    if tf_url in tf_cache:
        return tf_cache[tf_url]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    full_url = f"https://profstandart.rosmintrud.ru{tf_url}" if tf_url.startswith('/') else tf_url
    print(f"    Парсинг ТФ: {full_url}")
    
    try:
        response = requests.get(full_url, headers=headers, verify=False, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"    Ошибка при загрузке ТФ: {e}")
        return {'labor_actions': [], 'skills': [], 'knowledges': []}
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    result = {
        'labor_actions': [],
        'skills': [],
        'knowledges': []
    }
    
    # Ищем все таблицы на странице
    tables = soup.find_all('table')
    
    for table in tables:
        rows = table.find_all('tr')
        for row in rows:
            cells = row.find_all('td')
            if len(cells) >= 2:
                label = cells[0].get_text(strip=True)
                content_cell = cells[1]
                label_lower = label.lower()
                
                if 'трудовые действия' in label_lower:
                    # Трудовые действия тоже могут быть слипшимися, используем clean_and_split
                    raw_text = content_cell.get_text(separator=' ').strip()
                    items = clean_and_split(raw_text)
                    result['labor_actions'] = items
                    print(f"      Найдено {len(items)} трудовых действий")
                    
                elif 'необходимые умения' in label_lower or 'умения' in label_lower:
                    # Умения — слипшийся текст, используем clean_and_split
                    raw_text = content_cell.get_text(separator=' ').strip()
                    items = clean_and_split(raw_text)
                    result['skills'] = items
                    print(f"      Найдено {len(items)} умений")
                    
                elif 'необходимые знания' in label_lower or 'знания' in label_lower:
                    # Знания разделены <br />, поэтому используем разделение по переводу строки
                    raw_text = content_cell.get_text(separator='\n').strip()
                    # Разбиваем по строкам, убираем пустые и короткие
                    items = [line.strip() for line in raw_text.splitlines() if line.strip() and len(line.strip()) > 3]
                    # Если не получилось (например, знания в одной строке через запятую), применяем clean_and_split
                    if not items:
                        items = clean_and_split(raw_text)
                    result['knowledges'] = items
                    print(f"      Найдено {len(items)} знаний")
                    for i, item in enumerate(items[:3]):
                        print(f"        Знание {i+1}: {item[:50]}...")
    
    # Сохраняем в кэш
    tf_cache[tf_url] = result
    return result


# ============================================================
# 6. Получение ссылок на трудовые функции со страницы стандарта
# ============================================================
def get_tf_links_from_standard_page(element_id: str) -> List[dict]:
    """
    Парсит HTML-страницу стандарта и возвращает список ссылок на трудовые функции.
    """
    url = f"https://profstandart.rosmintrud.ru/obshchiy-informatsionnyy-blok/natsionalnyy-reestr-professionalnykh-standartov/reestr-professionalnykh-standartov/index.php?ELEMENT_ID={element_id}"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    try:
        response = requests.get(url, headers=headers, verify=False, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"  Ошибка при загрузке страницы стандарта: {e}")
        return []
    
    soup = BeautifulSoup(response.text, 'html.parser')
    tf_links = []
    
    # Ищем ссылки на реестр трудовых функций
    for link in soup.find_all('a', href=True):
        href = link['href']
        if 'reestr-trudovyh-funkcij/index.php' in href and 'ELEMENT_ID=' in href:
            name = link.get_text(strip=True)
            parsed = urlparse(href)
            params = parse_qs(parsed.query)
            tf_id = params.get('ELEMENT_ID', [''])[0]
            
            if tf_id and tf_id != element_id:
                tf_links.append({
                    'url': href,
                    'name': name,
                    'tf_id': tf_id
                })
    
    return tf_links


# ============================================================
# 7. Обновление стандарта данными из трудовых функций (устарело, оставлено для совместимости)
# ============================================================
def enrich_standard_with_tf_data(standard: ProfessionalStandard, element_id: str) -> ProfessionalStandard:
    """
    Для каждого стандарта находит ссылки на трудовые функции и добавляет ТД, У, З.
    Эта функция больше не используется в автоматическом процессе, но оставлена для возможного ручного вызова.
    """
    print(f"  Обогащение стандарта {standard.registration_number} (ID: {element_id})...")
    
    try:
        tf_links = get_tf_links_from_standard_page(element_id)
        print(f"    Найдено {len(tf_links)} трудовых функций")
        
        for tf_link in tf_links:
            tf_name = tf_link['name']
            tf_id = tf_link['tf_id']
            
            found = False
            for g_func in standard.generalized_functions:
                for p_func in g_func.particular_functions:
                    if p_func.name == tf_name:  # убрали сравнение с tf_id
                        tf_data = parse_tf_page(tf_link['url'])
                        if tf_data['skills']:
                            p_func.required_skills = tf_data['skills']
                            print(f"      Добавлено {len(tf_data['skills'])} умений для {p_func.name[:30]}...")
                        if tf_data['knowledges']:
                            p_func.necessary_knowledges = tf_data['knowledges']
                            print(f"      Добавлено {len(tf_data['knowledges'])} знаний для {p_func.name[:30]}...")
                        found = True
                        break
                if found:
                    break
            
            if not found:
                print(f"    ТФ '{tf_name}' (ID: {tf_id}) не найдена в стандарте")
        
        # УБИРАЕМ save_standard(standard) — сохранение происходит снаружи
        
    except Exception as e:
        print(f"  Ошибка при обогащении стандарта {standard.registration_number}: {e}")
    
    return standard


# ============================================================
# 8. Парсинг bulk XML
# ============================================================
def parse_bulk_xml(file_path: str) -> List[ProfessionalStandard]:
    """Парсит XML-файл с несколькими стандартами."""
    with open(file_path, 'rb') as f:
        content = f.read()
    
    # Пробуем разные кодировки
    for encoding in ['utf-8', 'windows-1251', 'cp1251']:
        try:
            text_content = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        text_content = content.decode('utf-8', errors='ignore')
    
    import html
    text_content = html.unescape(text_content)
    content = text_content.encode('utf-8')
    
    try:
        root = etree.fromstring(content)
    except Exception as e:
        print(f"  Ошибка парсинга XML: {e}")
        return []
    
    ps_nodes = root.findall('.//ProfessionalStandart')
    print(f"  Найдено ProfessionalStandart: {len(ps_nodes)}")
    
    standards = []
    for ps_node in ps_nodes:
        try:
            standard = parse_ps_node(ps_node)
            standards.append(standard)
        except Exception as e:
            print(f"  Ошибка при парсинге стандарта: {e}")
            continue
    
    return standards


# ============================================================
# 9. Основная функция для массовой загрузки с сохранением в raw БД
# ============================================================
def fetch_all_standards_bulk(download_dir: str = "downloads", enrich: bool = False) -> List[Dict]:
    """
    Собирает все ID, скачивает XML по частям, парсит и сохраняет в raw-базу данных.
    Параметр enrich игнорируется — обогащение выполняется отдельно через эндпоинт /run-enrichment.
    Ограничение: обрабатывает только 3 стандарта для теста.
    """
    os.makedirs(download_dir, exist_ok=True)

    print("Сбор всех ELEMENT_ID...")
    all_ids = get_all_element_ids(REGISTRY_BASE_URL)
    print(f"Найдено {len(all_ids)} стандартов.")

    if not all_ids:
        return []

    # Ограничиваемся первыми 3 ID для теста
    test_ids = all_ids[:3]
    print(f"Для теста взято {len(test_ids)} стандартов (ID: {test_ids})")

    # Разбиваем на чанки (по 3 — это один чанк)
    chunk_size = 3
    chunks = [test_ids[i:i + chunk_size] for i in range(0, len(test_ids), chunk_size)]
    print(f"Разбито на {len(chunks)} частей по {chunk_size} ID")

    loaded = []
    total_standards = 0

    # Создаём сессию БД для сохранения
    session = SessionLocal()

    try:
        for idx, chunk in enumerate(chunks):
            print(f"\n--- Часть {idx + 1}/{len(chunks)} ({len(chunk)} ID) ---")
            try:
                xml_path = os.path.join(download_dir, f"standards_chunk_{idx + 1}.xml")
                download_bulk_xml_chunk(chunk, xml_path)
                
                print(f"Парсинг части {idx + 1}...")
                standards = parse_bulk_xml(xml_path)
                
                # Сохраняем соответствие reg_number -> element_id
                for i, std in enumerate(standards):
                    if i < len(chunk):
                        reg_to_element_cache[std.registration_number] = chunk[i]
                
                # Сохраняем каждый стандарт в raw БД (без обогащения)
                for std in standards:
                    try:
                        element_id = reg_to_element_cache.get(std.registration_number)
                        if not element_id:
                            print(f"  Предупреждение: для {std.registration_number} не найден element_id")
                        # Сохраняем в raw БД
                        save_raw_standard(session, std, element_id)
                        total_standards += 1
                    except Exception as e:
                        print(f"Ошибка при сохранении {std.registration_number}: {e}")
                
                loaded.append({
                    'chunk': idx + 1,
                    'count': len(standards),
                    'status': 'ok'
                })
                print(f"✓ Часть {idx + 1} завершена. Загружено {len(standards)} стандартов.")
                
            except Exception as e:
                print(f"✗ Ошибка в части {idx + 1}: {e}")
                loaded.append({
                    'chunk': idx + 1,
                    'status': 'error',
                    'error': str(e)
                })
            
            time.sleep(1)
        
        session.commit()
        print(f"\n✅ Всего загружено стандартов в raw БД: {total_standards}")
        
    except Exception as e:
        session.rollback()
        print(f"Ошибка при работе с БД: {e}")
        raise
    finally:
        session.close()

    return loaded