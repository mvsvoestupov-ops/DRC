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

REGISTRY_BASE_URL = "https://profstandart.rosmintrud.ru/obshchiy-informatsionnyy-blok/natsionalnyy-reestr-professionalnykh-standartov/reestr-professionalnykh-standartov/index.php"

tf_cache = {}
reg_to_element_cache = {}

def normalize_okso_code(code: str) -> str:
    if not code:
        return ''
    parts = code.strip().split('.')
    parts = [p for p in parts if p]
    if len(parts) > 3:
        parts = parts[-3:]
    parts = [p.zfill(2) for p in parts]
    return '.'.join(parts)

def parse_xml(content: bytes, element_id: str = None) -> ProfessionalStandard:
    root = etree.fromstring(content)
    ps = root.find('.//ProfessionalStandart')
    if ps is None:
        raise ValueError("ProfessionalStandart not found")
    return parse_ps_node(ps, element_id=element_id)

def parse_ps_node(ps_node, element_id: str = None) -> ProfessionalStandard:
    name = ps_node.findtext('NameProfessionalStandart', '').strip()
    reg_elem = ps_node.find('RegistrationNumber')
    reg_num = reg_elem.text.strip() if reg_elem is not None and reg_elem.text else ''
    if not reg_num and element_id:
        reg_num = element_id
        print(f"  ⚠️ RegistrationNumber отсутствует для '{name}', используем element_id={element_id}")
    elif not reg_num:
        reg_num = f"TEMP_{name[:10]}_{int(time.time())}"
        print(f"  ❌ RegistrationNumber отсутствует для '{name}', создан временный номер {reg_num}")

    order_num = ps_node.findtext('OrderNumber', '').strip()
    date = ps_node.findtext('DateOfApproval', '').strip()

    first_section = ps_node.find('FirstSection')
    kind = first_section.findtext('KindProfessionalActivity', '').strip() if first_section is not None else ''
    purpose = first_section.findtext('PurposeKindProfessionalActivity', '').strip() if first_section is not None else ''

    professional_area_code = ''
    if first_section is not None:
        code_kind = first_section.findtext('CodeKindProfessionalActivity', '').strip()
        if code_kind:
            professional_area_code = code_kind[:2] if len(code_kind) >= 2 else ''
    if not professional_area_code and reg_num:
        if '.' in reg_num:
            professional_area_code = reg_num.split('.')[0].strip()
        else:
            professional_area_code = reg_num[:2]

    okved_codes = []
    employment_group = ps_node.find('.//EmploymentGroup')
    if employment_group is not None:
        list_okved = employment_group.find('.//ListOKVED')
        if list_okved is not None:
            for unit in list_okved.findall('UnitOKVED'):
                code = unit.findtext('CodeOKVED', '').strip()
                if code:
                    okved_codes.append(code)

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

                    okz_codes = []
                    list_okz = g_node.find('.//ListOKZ')
                    if list_okz is not None:
                        for unit in list_okz.findall('UnitOKZ'):
                            c = unit.findtext('CodeOKZ', '').strip()
                            if c:
                                okz_codes.append(c)

                    okpdtr_codes = []
                    list_okpdtr = g_node.find('.//ListOKPDTR')
                    if list_okpdtr is not None:
                        for unit in list_okpdtr.findall('UnitOKPDTR'):
                            c = unit.findtext('CodeOKPDTR', '').strip()
                            if c:
                                okpdtr_codes.append(c)

                    okso_codes = []
                    list_okso = g_node.find('.//ListOKSO')
                    if list_okso is not None:
                        for unit in list_okso.findall('UnitOKSO'):
                            c = unit.findtext('CodeOKSO', '').strip()
                            if c:
                                norm = normalize_okso_code(c)
                                if norm:
                                    okso_codes.append(norm)

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
                            particular_functions=p_funcs,
                            okz_codes=okz_codes,
                            okpdtr_codes=okpdtr_codes,
                            okso_codes=okso_codes
                        )
                    )

    return ProfessionalStandard(
        name=name,
        registration_number=reg_num,
        order_number=order_num,
        approval_date=date,
        kind_activity=kind,
        purpose=purpose,
        generalized_functions=generalized_functions,
        professional_area_code=professional_area_code,
        okved_codes=okved_codes
    )

def get_element_ids_from_page(page_url: str) -> List[str]:
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
    """Обходит все страницы реестра, останавливается при таймауте или пустом ответе."""
    all_ids = set()
    page = 1
    while True:
        url = f"{base_url}?PAGEN_1={page}&SIZEN_1=100"
        print(f"Парсинг страницы {page}...")
        try:
            ids = get_element_ids_from_page(url)
            if not ids:
                print(f"Страница {page} пуста, завершаем сбор.")
                break
            all_ids.update(ids)
            print(f"На странице {page} найдено {len(ids)} ID, всего собрано {len(all_ids)}")
            page += 1
            time.sleep(0.5)
        except Exception as e:
            # Если страница не загружается (таймаут, ошибка соединения), вероятно, это конец списка
            print(f"Ошибка при загрузке страницы {page}: {e}")
            print("Предполагаем, что это конец списка, завершаем сбор.")
            break
    print(f"Всего собрано ID: {len(all_ids)}")
    return list(all_ids)

def download_bulk_xml_chunk(element_ids: List[str], save_path: str) -> str:
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

def split_by_capital(text: str) -> List[str]:
    if not text:
        return []
    result = []
    start = 0
    for i in range(1, len(text)):
        if (text[i].isupper() and text[i-1].islower()) or \
           (text[i].isupper() and text[i-1] in '.!?;'):
            result.append(text[start:i].strip())
            start = i
    if start < len(text):
        result.append(text[start:].strip())
    if len(result) <= 1:
        return [text.strip()]
    return [p for p in result if p.strip() and len(p.strip()) > 3]

def clean_and_split(text: str) -> List[str]:
    if not text:
        return []
    text = re.sub(r'\s+', ' ', text).strip()
    parts = split_by_capital(text)
    return [p.strip() for p in parts if p.strip() and len(p.strip()) > 3]

def parse_tf_page(tf_url: str) -> dict:
    if tf_url in tf_cache:
        return tf_cache[tf_url]

    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    full_url = f"https://profstandart.rosmintrud.ru{tf_url}" if tf_url.startswith('/') else tf_url

    print(f"    Парсинг страницы: {full_url}")

    try:
        response = requests.get(full_url, headers=headers, verify=False, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"    Ошибка при загрузке страницы: {e}")
        return {'labor_actions': [], 'skills': [], 'knowledges': [], 'okso_codes': []}

    soup = BeautifulSoup(response.text, 'html.parser')
    result = {'labor_actions': [], 'skills': [], 'knowledges': [], 'okso_codes': []}
    tables = soup.find_all('table')

    for table in tables:
        rows = table.find_all('tr')
        for row in rows:
            cells = row.find_all('td')
            if len(cells) >= 2:
                label = cells[0].get_text(strip=True)
                content_cell = cells[1]
                raw_text = content_cell.get_text(separator=' ').strip()
                label_lower = label.lower()
                if 'трудовые действия' in label_lower:
                    items = clean_and_split(raw_text)
                    result['labor_actions'] = items
                    print(f"      Найдено {len(items)} трудовых действий")
                elif 'необходимые умения' in label_lower or 'умения' in label_lower:
                    items = clean_and_split(raw_text)
                    result['skills'] = items
                    print(f"      Найдено {len(items)} умений")
                elif 'необходимые знания' in label_lower or 'знания' in label_lower:
                    raw_text_lines = content_cell.get_text(separator='\n').strip()
                    items = [line.strip() for line in raw_text_lines.splitlines() if line.strip() and len(line.strip()) > 3]
                    if not items:
                        items = clean_and_split(raw_text)
                    result['knowledges'] = items
                    print(f"      Найдено {len(items)} знаний")

    for table in tables:
        rows = table.find_all('tr')
        for row in rows:
            cells = row.find_all('td')
            if len(cells) >= 1 and 'Перечни СПО и ВО' in cells[0].get_text(strip=True):
                for next_row in row.find_all_next('tr'):
                    next_cells = next_row.find_all('td')
                    if len(next_cells) >= 2:
                        center_tag = next_cells[0].find('center')
                        if center_tag:
                            code_text = center_tag.get_text(strip=True)
                            if re.match(r'^\d{2}\.\d{2}\.\d{2}$', code_text):
                                norm = normalize_okso_code(code_text)
                                if norm and norm not in result['okso_codes']:
                                    result['okso_codes'].append(norm)
                                    print(f"      Найден ОКСО: {norm}")
                break
        else:
            continue
        break

    tf_cache[tf_url] = result
    return result

def get_tf_links_from_standard_page(element_id: str) -> List[dict]:
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
    for link in soup.find_all('a', href=True):
        href = link['href']
        if 'reestr-trudovyh-funkcij/index.php' in href and 'ELEMENT_ID=' in href:
            name = link.get_text(strip=True)
            parsed = urlparse(href)
            params = parse_qs(parsed.query)
            tf_id = params.get('ELEMENT_ID', [''])[0]
            if tf_id and tf_id != element_id:
                tf_links.append({'url': href, 'name': name, 'tf_id': tf_id})
    return tf_links

def parse_bulk_xml(file_path: str, element_ids: List[str] = None) -> List[ProfessionalStandard]:
    with open(file_path, 'rb') as f:
        content = f.read()
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
    for idx, ps_node in enumerate(ps_nodes):
        try:
            elem_id = element_ids[idx] if element_ids and idx < len(element_ids) else None
            standard = parse_ps_node(ps_node, element_id=elem_id)
            standards.append(standard)
        except Exception as e:
            print(f"  Ошибка при парсинге стандарта: {e}")
            continue
    return standards

def fetch_all_standards_bulk(download_dir: str = "downloads", auto_enrich: bool = False) -> List[Dict]:
    """
    Загружает все профессиональные стандарты (все страницы) и сохраняет их в raw БД.
    Параметр auto_enrich: если True, после загрузки всех ПС запускает обогащение.
    """
    os.makedirs(download_dir, exist_ok=True)

    print("Сбор всех ELEMENT_ID...")
    all_ids = get_all_element_ids(REGISTRY_BASE_URL)
    print(f"Найдено {len(all_ids)} стандартов.")

    if not all_ids:
        return []

    chunk_size = 20
    chunks = [all_ids[i:i + chunk_size] for i in range(0, len(all_ids), chunk_size)]
    print(f"Разбито на {len(chunks)} частей по {chunk_size} ID")

    loaded = []
    total_standards = 0
    session = SessionLocal()

    try:
        for idx, chunk in enumerate(chunks):
            print(f"\n--- Часть {idx + 1}/{len(chunks)} ({len(chunk)} ID) ---")
            try:
                xml_path = os.path.join(download_dir, f"standards_chunk_{idx + 1}.xml")
                download_bulk_xml_chunk(chunk, xml_path)

                print(f"Парсинг части {idx + 1}...")
                standards = parse_bulk_xml(xml_path, element_ids=chunk)

                for i, std in enumerate(standards):
                    if i < len(chunk):
                        reg_to_element_cache[std.registration_number] = chunk[i]

                for std in standards:
                    try:
                        element_id = reg_to_element_cache.get(std.registration_number)
                        if not element_id:
                            print(f"  Предупреждение: для {std.registration_number} не найден element_id")
                        save_raw_standard(session, std, element_id)
                        total_standards += 1
                    except Exception as e:
                        print(f"Ошибка при сохранении {std.registration_number}: {e}")

                loaded.append({'chunk': idx + 1, 'count': len(standards), 'status': 'ok'})
                print(f"✓ Часть {idx + 1} завершена. Загружено {len(standards)} стандартов.")

            except Exception as e:
                print(f"✗ Ошибка в части {idx + 1}: {e}")
                loaded.append({'chunk': idx + 1, 'status': 'error', 'error': str(e)})

            time.sleep(1)

        session.commit()
        print(f"\n✅ Всего загружено стандартов в raw БД: {total_standards}")

        if auto_enrich:
            print("\n🚀 Запуск автоматического обогащения всех загруженных ПС...")
            from .enrichment import enrich_standard
            stds = session.query(StandardRaw).all()
            for i, std in enumerate(stds):
                print(f"Обогащение {i+1}/{len(stds)}: {std.registration_number} - {std.name[:50]}...")
                try:
                    enrich_standard(std.reg_number, session)
                except Exception as e:
                    print(f"  ⚠️ Ошибка обогащения {std.reg_number}: {e}")
                if i % 10 == 0:
                    time.sleep(1)
            print("✅ Обогащение завершено.")

    except Exception as e:
        session.rollback()
        print(f"Ошибка при работе с БД: {e}")
        raise
    finally:
        session.close()

    return loaded

def find_element_id_by_reg_number(reg_number: str) -> str:
    """
    Ищет ELEMENT_ID профессионального стандарта по его регистрационному номеру.
    Возвращает строку ID или None.
    """
    search_url = urljoin(REGISTRY_BASE_URL, f"index.php?search={reg_number}")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    try:
        response = requests.get(search_url, headers=headers, verify=False, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"  Ошибка поиска ELEMENT_ID для {reg_number}: {e}")
        return None

    soup = BeautifulSoup(response.text, 'html.parser')
    for link in soup.find_all('a', href=True):
        href = link['href']
        if 'reestr-professionalnykh-standartov/index.php' in href and 'ELEMENT_ID=' in href:
            text = link.get_text(strip=True)
            if reg_number in text:
                import re
                match = re.search(r'ELEMENT_ID=(\d+)', href)
                if match:
                    return match.group(1)
    return None