import os
import time
import re
import requests
from lxml import etree
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs, urljoin, quote
from typing import List, Dict, Optional
from .models import *
from .db_operations import save_raw_standard
from .db import SessionLocal

REGISTRY_BASE_URL = "https://profstandart.rosmintrud.ru/obshchiy-informatsionnyy-blok/natsionalnyy-reestr-professionalnykh-standartov/reestr-professionalnykh-standartov/index.php"

tf_cache = {}
reg_to_element_cache: dict[str, str] = {}
ps_code_to_element_cache: dict[str, str] = {}

def normalize_okso_code(code: str) -> str:
    if not code:
        return ''
    parts = code.strip().split('.')
    parts = [p for p in parts if p]
    if len(parts) > 3:
        parts = parts[-3:]
    parts = [p.zfill(2) for p in parts]
    return '.'.join(parts)


def extract_okso_values(raw) -> list[str]:
    """Коды и названия из JSON-полей okso_codes / okso_units ОТФ."""
    if not raw:
        return []
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return []
        if text[0] in "[{":
            try:
                import json
                raw = json.loads(text)
            except Exception:
                return [text]
        else:
            return [text]
    values: list[str] = []

    def _add(item) -> None:
        if isinstance(item, str):
            text = item.strip()
            if text and text not in values:
                values.append(text)
            return
        if isinstance(item, dict):
            for key in ("code", "name"):
                text = str(item.get(key) or "").strip()
                if text and text not in values:
                    values.append(text)

    if isinstance(raw, dict):
        _add(raw)
        return values
    if isinstance(raw, list):
        for item in raw:
            _add(item)
    return values


OKSO_CODE_IN_TEXT_RE = re.compile(r"(?<![\d])(\d{1,2}(?:\.\d{2}){2,3})(?![\d])")


def extract_okso_codes_from_text(text: str) -> list[str]:
    """Коды вида 09.02.07 / 2.09.02.07 из свободного текста раздела ОКСО."""
    if not text:
        return []
    found: list[str] = []
    for match in OKSO_CODE_IN_TEXT_RE.finditer(text):
        norm = normalize_okso_code(match.group(1))
        if norm and norm not in found:
            found.append(norm)
    return found


def normalize_okpdtr_code(code: str) -> str:
    text = (code or "").strip()
    digits = re.sub(r"\D", "", text)
    return digits or text


OKPDTR_CODE_IN_TEXT_RE = re.compile(r"(?<![\d])(\d{5,6})(?![\d])")


def extract_okpdtr_codes_from_text(text: str) -> list[str]:
    """Коды ОКПДТР (обычно 5 цифр) из свободного текста раздела ОТФ."""
    if not text:
        return []
    found: list[str] = []
    for match in OKPDTR_CODE_IN_TEXT_RE.finditer(text):
        norm = normalize_okpdtr_code(match.group(1))
        if norm and norm not in found:
            found.append(norm)
    return found


def okpdtr_matches(okpdtr_value: str, needle: str) -> bool:
    """Раздел ОКПДТР содержит выбранный код (точное совпадение или код как отдельный токен)."""
    want = normalize_okpdtr_code(needle)
    raw = (okpdtr_value or "").strip()
    if not want or not raw:
        return False
    have = normalize_okpdtr_code(raw)
    if have and have == want:
        return True
    if re.search(rf"(?<![\d]){re.escape(want)}(?![\d])", raw):
        return True
    if have and have != raw and re.search(rf"(?<![\d]){re.escape(want)}(?![\d])", have):
        return True
    return False


def okso_matches_fgos(okso_value: str, fgos_code: str) -> bool:
    """Раздел ОКСО содержит код ФГОС (точное совпадение или код как отдельный токен)."""
    fgos_raw = (fgos_code or "").strip()
    okso_raw = (okso_value or "").strip()
    if not fgos_raw or not okso_raw:
        return False
    fgos_n = normalize_okso_code(fgos_raw)
    okso_n = normalize_okso_code(okso_raw)
    if fgos_n and okso_n and fgos_n == okso_n:
        return True
    haystacks = [okso_raw]
    if okso_n and okso_n != okso_raw:
        haystacks.append(okso_n)
    needles = {n for n in (fgos_raw, fgos_n) if n}
    for haystack in haystacks:
        for needle in needles:
            if re.search(rf"(?<![\d]){re.escape(needle)}(?![\d])", haystack):
                return True
    return False

def _xml_text(node, *tags: str) -> str:
    if node is None:
        return ""
    for tag in tags:
        direct = node.findtext(tag)
        if direct and direct.strip():
            return direct.strip()
        found = node.find(f".//{tag}")
        if found is not None and found.text and found.text.strip():
            return found.text.strip()
    return ""


def _xml_texts(node, *tags: str) -> List[str]:
    if node is None:
        return []
    values: List[str] = []
    for tag in tags:
        for el in node.findall(f".//{tag}"):
            text = (el.text or "").strip()
            if text and text not in values:
                values.append(text)
    return values


def _parse_classifier_units(parent, list_tag: str, unit_tag: str, code_tag: str, name_tag: str):
    units = []
    codes = []
    if parent is None:
        return units, codes
    list_node = parent.find(f".//{list_tag}")
    if list_node is None:
        return units, codes
    for unit in list_node.findall(unit_tag):
        code = (unit.findtext(code_tag) or "").strip()
        name = (unit.findtext(name_tag) or "").strip()
        if code_tag == "CodeOKSO" and code:
            code = normalize_okso_code(code)
        if not code and not name:
            continue
        units.append(ClassifierUnit(code=code, name=name))
        if code and code not in codes:
            codes.append(code)
    return units, codes


def parse_xml(content: bytes, element_id: str = None) -> ProfessionalStandard:
    text = content
    if isinstance(content, bytes):
        for enc in ("utf-8", "windows-1251", "cp1251"):
            try:
                decoded = content.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            decoded = content.decode("utf-8", errors="ignore")
        import html as html_mod
        decoded = html_mod.unescape(decoded)
        text = decoded.encode("utf-8")
    root = etree.fromstring(text)
    ps = root.find('.//ProfessionalStandart')
    if ps is None:
        raise ValueError("ProfessionalStandart not found")
    standard = parse_ps_node(ps, element_id=element_id)
    try:
        standard.source_xml = text.decode("utf-8") if isinstance(text, bytes) else text
        standard.source_kind = "mintrud_xml"
    except Exception:
        pass
    return standard


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
    effective_date = _xml_text(ps_node, 'DateOfEntry', 'DateOfIntroduction', 'EffectiveDate')

    first_section = ps_node.find('FirstSection')
    kind = first_section.findtext('KindProfessionalActivity', '').strip() if first_section is not None else ''
    purpose = first_section.findtext('PurposeKindProfessionalActivity', '').strip() if first_section is not None else ''

    ps_code = ''
    professional_area_code = ''
    if first_section is not None:
        code_kind = first_section.findtext('CodeKindProfessionalActivity', '').strip()
        if code_kind:
            ps_code = code_kind
            professional_area_code = code_kind[:2] if len(code_kind) >= 2 else ''
    if not professional_area_code and reg_num:
        if '.' in reg_num:
            professional_area_code = reg_num.split('.')[0].strip()
        else:
            professional_area_code = reg_num[:2]

    okved_units = []
    okved_codes = []
    employment_group = ps_node.find('.//EmploymentGroup')
    if employment_group is not None:
        list_okved = employment_group.find('.//ListOKVED')
        if list_okved is not None:
            for unit in list_okved.findall('UnitOKVED'):
                code = (unit.findtext('CodeOKVED') or '').strip()
                uname = (unit.findtext('NameOKVED') or '').strip()
                if code:
                    okved_codes.append(code)
                    okved_units.append(ClassifierUnit(code=code, name=uname))

    okz_group_code = _xml_text(first_section, 'CodeOKZ', 'CodeEmploymentGroup')
    okz_group_name = _xml_text(first_section, 'NameOKZ', 'NameEmploymentGroup')
    opd_code = _xml_text(first_section, 'CodeOPD', 'CodeProfessionalArea') or professional_area_code
    opd_name = _xml_text(first_section, 'NameOPD', 'NameProfessionalArea')

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
                    titles = [t.text.strip() for t in g_node.findall('.//PossibleJobTitle') if t.text]

                    okz_units, okz_codes = _parse_classifier_units(
                        g_node, 'ListOKZ', 'UnitOKZ', 'CodeOKZ', 'NameOKZ'
                    )
                    okpdtr_units, okpdtr_codes = _parse_classifier_units(
                        g_node, 'ListOKPDTR', 'UnitOKPDTR', 'CodeOKPDTR', 'NameOKPDTR'
                    )
                    okso_units, okso_codes = _parse_classifier_units(
                        g_node, 'ListOKSO', 'UnitOKSO', 'CodeOKSO', 'NameOKSO'
                    )
                    etks_units, _ = _parse_classifier_units(
                        g_node, 'ListETKS', 'UnitETKS', 'CodeETKS', 'NameETKS'
                    )
                    if not etks_units:
                        etks_units, _ = _parse_classifier_units(
                            g_node, 'ListEKS', 'UnitEKS', 'CodeEKS', 'NameEKS'
                        )

                    education = _xml_text(
                        g_node,
                        'RequirementsToEducationAndTraining',
                        'EducationalRequirements',
                        'RequirementsEducation',
                    )
                    experience = _xml_text(
                        g_node,
                        'RequirementsToExperienceOfPracticalWork',
                        'ExperienceRequirements',
                        'RequirementsExperience',
                    )
                    admission = _xml_text(
                        g_node,
                        'ParticularConditionsForAdmissionToWork',
                        'ParticularConditionsForAdmission',
                        'SpecialConditions',
                    )
                    other_gf = _xml_text(g_node, 'OtherCharacteristics', 'AdditionalCharacteristics')

                    p_funcs = []
                    for p_node in g_node.findall('.//ParticularWorkFunction'):
                        p_code = p_node.findtext('CodeTF', '').strip()
                        p_name = p_node.findtext('NameTF', '').strip()
                        p_sub = p_node.findtext('SubQualification', '').strip()
                        labor_actions = [
                            LaborAction(text=(la.text or '').strip())
                            for la in p_node.findall('.//LaborAction')
                            if (la.text or '').strip()
                        ]
                        skills = _xml_texts(p_node, 'RequiredSkill', 'NecessarySkill')
                        knowledges = _xml_texts(p_node, 'NecessaryKnowledge', 'RequiredKnowledge')
                        other_pf = _xml_text(p_node, 'OtherCharacteristics', 'AdditionalCharacteristics')
                        p_funcs.append(
                            ParticularWorkFunction(
                                code=p_code,
                                name=p_name,
                                sub_qualification=p_sub,
                                labor_actions=labor_actions,
                                required_skills=skills,
                                necessary_knowledges=knowledges,
                                other_characteristics=other_pf or None,
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
                            okso_codes=okso_codes,
                            okz_units=okz_units,
                            okpdtr_units=okpdtr_units,
                            okso_units=okso_units,
                            etks_units=etks_units,
                            education_training=education or None,
                            practical_experience=experience or None,
                            special_admission=admission or None,
                            other_characteristics=other_gf or None,
                        )
                    )

    developer_org = ""
    developer_head = ""
    co_developers: List[str] = []
    fourth = ps_node.find('FourthSection')
    if fourth is not None:
        developer_org = _xml_text(
            fourth,
            'NameResponsibleOrganization',
            'NameOfOrganization',
            'ResponsibleOrganization',
        )
        developer_head = _xml_text(
            fourth,
            'NameOfResponsiblePerson',
            'NameResponsiblePerson',
            'ResponsiblePerson',
        )
        head_pos = _xml_text(fourth, 'PositionOfResponsiblePerson', 'PositionResponsiblePerson')
        if head_pos and developer_head:
            developer_head = f"{head_pos} {developer_head}".strip()
        elif head_pos and not developer_head:
            developer_head = head_pos
        for org in fourth.findall('.//OrganizationDeveloper') + fourth.findall('.//DeveloperOrganization'):
            org_name = _xml_text(org, 'NameOfOrganization', 'NameOrganization', 'Name')
            if org_name:
                co_developers.append(org_name)
        if not co_developers:
            co_developers = [
                t for t in _xml_texts(fourth, 'NameOfOrganizationDeveloper', 'OrganizationName')
                if t != developer_org
            ]

    abbreviations = []
    fifth = ps_node.find('FifthSection')
    if fifth is not None:
        for abbr in fifth.findall('.//Abbreviation'):
            code = _xml_text(abbr, 'Code', 'ShortName', 'AbbreviationCode')
            meaning = _xml_text(abbr, 'Name', 'FullName', 'Meaning', 'Description')
            raw = (abbr.text or '').strip()
            if code or meaning:
                abbreviations.append({"abbr": code, "meaning": meaning})
            elif raw:
                abbreviations.append({"text": raw})
        if not abbreviations:
            for line in _xml_texts(fifth, 'ListOfAbbreviations', 'AbbreviationItem'):
                abbreviations.append({"text": line})

    return ProfessionalStandard(
        name=name,
        registration_number=reg_num,
        order_number=order_num,
        approval_date=date,
        kind_activity=kind,
        purpose=purpose,
        generalized_functions=generalized_functions,
        professional_area_code=professional_area_code,
        okved_codes=okved_codes,
        ps_code=ps_code or None,
        okved_units=okved_units,
        opd_code=opd_code or None,
        opd_name=opd_name or None,
        okz_group_code=okz_group_code or None,
        okz_group_name=okz_group_name or None,
        developer_org=developer_org or None,
        developer_head=developer_head or None,
        co_developers=co_developers,
        effective_date=effective_date or None,
        abbreviations=abbreviations,
        source_kind="mintrud_xml",
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

def get_all_element_ids(base_url: str, page_size: int = 100, max_retries: int = 3) -> List[str]:
    """Обходит все страницы реестра с повторами при ошибках."""
    all_ids = set()
    page = 1
    empty_streak = 0
    expected_total = None

    while empty_streak < 2:
        url = f"{base_url}?PAGEN_1={page}&SIZEN_1={page_size}"
        print(f"Парсинг страницы {page}...")
        ids = None
        page_total = None

        for attempt in range(max_retries):
            try:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
                response = requests.get(url, headers=headers, verify=False, timeout=90)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'html.parser')
                total_match = re.search(r'из\s*(\d+)', response.text)
                if total_match:
                    page_total = int(total_match.group(1))
                    if expected_total is None:
                        expected_total = page_total
                        print(f"  На сайте указано всего: {expected_total}")

                ids = set()
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    if 'reestr-professionalnykh-standartov/index.php' in href and 'ELEMENT_ID=' in href:
                        parsed = urlparse(href)
                        params = parse_qs(parsed.query)
                        if 'ELEMENT_ID' in params:
                            ids.add(params['ELEMENT_ID'][0])
                break
            except Exception as e:
                print(f"  Ошибка (попытка {attempt + 1}/{max_retries}): {e}")
                time.sleep(2 * (attempt + 1))

        if not ids:
            print(f"  Страница {page} пуста или недоступна.")
            empty_streak += 1
            page += 1
            continue

        empty_streak = 0
        prev_len = len(all_ids)
        all_ids.update(ids)
        new_count = len(all_ids) - prev_len
        print(f"  На странице {len(ids)} ID, +{new_count} новых, всего {len(all_ids)}")

        if new_count == 0:
            empty_streak += 1

        if expected_total and len(all_ids) >= expected_total:
            print(f"  Достигнуто ожидаемое количество ({expected_total}).")
            break

        page += 1
        time.sleep(0.5)

    print(f"Всего собрано ID: {len(all_ids)}" + (f" (ожидалось {expected_total})" if expected_total else ""))
    if expected_total and len(all_ids) < expected_total:
        print(f"⚠️  Не хватает {expected_total - len(all_ids)} ID — проверьте сеть или запустите analyze_missing_standards.py")
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
            print("\n🚀 Автообогащение: только ПС без enriched-записи...")
            from .enrichment import enrich_standards_batch
            result = enrich_standards_batch(session, only_missing=True)
            print(
                f"✅ Обогащено: {len(result['processed'])}, "
                f"ошибок: {len(result['failed'])}, "
                f"всего enriched: {result['enriched']}"
            )

    except Exception as e:
        session.rollback()
        print(f"Ошибка при работе с БД: {e}")
        raise
    finally:
        session.close()

    return loaded


def extract_reg_number_from_link(text: str) -> str:
    if not text:
        return ""
    m = re.search(r"(?<!\d)(\d{2,4})(?!\.\d)", text)
    return m.group(1) if m else ""


def extract_ps_code_from_link(text: str) -> str:
    if not text:
        return ""
    m = re.search(r"\b(\d{2}\.\d{3})\b", text)
    return m.group(1) if m else ""


def _extract_element_id_from_row(tr) -> str:
    for link in tr.find_all("a", href=True):
        href = link["href"]
        if "ELEMENT_ID=" not in href:
            continue
        eid = parse_qs(urlparse(href).query).get("ELEMENT_ID", [None])[0]
        if eid:
            return eid
    return ""


def _find_registry_table(soup: BeautifulSoup):
    table = soup.find("table", class_="listofitemps")
    if table is not None:
        return table
    tables = soup.find_all("table")
    if not tables:
        return None
    return max(tables, key=lambda t: len(t.find_all("tr")))


def parse_registry_table_rows(soup: BeautifulSoup) -> list[dict]:
    """Парсит строки таблицы реестра на странице списка (6 основных колонок)."""
    table = _find_registry_table(soup)
    if table is None:
        return []

    items: list[dict] = []
    seen: set[str] = set()
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if len(cells) < 6:
            continue

        values = [cell.get_text(" ", strip=True) for cell in cells[:6]]
        reg_number, ps_code, name, developer, effective_date, expiration_date = values
        if not reg_number and not ps_code and not name:
            continue

        element_id = _extract_element_id_from_row(tr)
        dedupe_key = element_id or f"{reg_number}|{ps_code}"
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        items.append(
            {
                "element_id": element_id,
                "reg_number": reg_number,
                "ps_code": ps_code,
                "name": name,
                "developer": developer,
                "effective_date": effective_date,
                "expiration_date": expiration_date,
                "link_text": name or reg_number,
            }
        )
    return items


def fetch_registry_page_items(page: int, page_size: int = 100) -> tuple[list[dict], int | None]:
    url = f"{REGISTRY_BASE_URL}?PAGEN_1={page}&SIZEN_1={page_size}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    for attempt in range(3):
        try:
            response = requests.get(url, headers=headers, verify=False, timeout=90)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            items = parse_registry_table_rows(soup)
            if not items:
                items = []
                seen: set[str] = set()
                for link in soup.find_all("a", href=True):
                    href = link["href"]
                    if "ELEMENT_ID=" not in href or "reestr-professionalnykh-standartov" not in href:
                        continue
                    eid = parse_qs(urlparse(href).query).get("ELEMENT_ID", [None])[0]
                    if not eid or eid in seen:
                        continue
                    seen.add(eid)
                    text = link.get_text(" ", strip=True)
                    items.append(
                        {
                            "element_id": eid,
                            "reg_number": extract_reg_number_from_link(text),
                            "ps_code": extract_ps_code_from_link(text),
                            "link_text": text,
                        }
                    )
            total_match = re.search(r"из\s*(\d+)", response.text)
            page_total = int(total_match.group(1)) if total_match else None
            return items, page_total
        except Exception as e:
            print(f"  страница {page}, попытка {attempt + 1}/3: {e}")
            time.sleep(2 * (attempt + 1))
    return [], None


def build_reg_to_element_map(page_size: int = 100, refresh: bool = False) -> dict[str, str]:
    """Строит карту рег. номер -> ELEMENT_ID, обходя все страницы реестра."""
    global reg_to_element_cache, ps_code_to_element_cache
    if reg_to_element_cache and not refresh:
        return reg_to_element_cache

    all_items: dict[str, dict] = {}
    page_total = None
    page = 1
    empty_streak = 0

    print("Обход реестра на сайте Минтруда...")
    while empty_streak < 2:
        print(f"  страница {page}...")
        items, total = fetch_registry_page_items(page, page_size)
        if total and not page_total:
            page_total = total
            print(f"  на сайте указано всего: {page_total}")

        if not items:
            empty_streak += 1
            page += 1
            continue

        empty_streak = 0
        new = 0
        for item in items:
            if item["element_id"] not in all_items:
                all_items[item["element_id"]] = item
                new += 1
        print(f"  ссылок: {len(items)}, новых ID: {new}, уникальных: {len(all_items)}")
        page += 1
        time.sleep(0.5)

        if page_total and len(all_items) >= page_total:
            break

    reg_map: dict[str, str] = {}
    ps_map: dict[str, str] = {}
    for item in all_items.values():
        reg = str(item.get("reg_number") or "").strip()
        eid = item["element_id"]
        if reg and reg not in reg_map:
            reg_map[reg] = eid
        ps_code = str(item.get("ps_code") or "").strip()
        if ps_code and ps_code not in ps_map:
            ps_map[ps_code] = eid

    reg_to_element_cache = reg_map
    ps_code_to_element_cache = ps_map
    print(f"  карта reg->ELEMENT_ID: {len(reg_map)} записей")
    return reg_map


def _search_element_id(query: str, expected_reg: str | None = None) -> str | None:
    if not query:
        return None
    search_url = f"{REGISTRY_BASE_URL}?search={quote(str(query))}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        response = requests.get(search_url, headers=headers, verify=False, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"  Ошибка поиска «{query}»: {e}")
        return None

    soup = BeautifulSoup(response.text, "html.parser")
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if "reestr-professionalnykh-standartov/index.php" not in href or "ELEMENT_ID=" not in href:
            continue
        match = re.search(r"ELEMENT_ID=(\d+)", href)
        if not match:
            continue
        eid = match.group(1)
        if not expected_reg:
            return eid
        block = link.find_parent("tr") or link.find_parent("li") or link.find_parent("div")
        text = block.get_text(" ", strip=True) if block else link.get_text(" ", strip=True)
        if re.search(rf"(?<!\d){re.escape(expected_reg)}(?!\.\d)", text):
            return eid
    return None


def find_element_id_by_reg_number(
    reg_number: str,
    ps_code: str | None = None,
    order_number: str | None = None,
) -> str | None:
    """
    Ищет ELEMENT_ID профессионального стандарта по рег. номеру.
    Сначала карта реестра, затем поиск по рег. номеру / коду ПС / приказу.
    """
    reg = str(reg_number or "").strip()
    if not reg:
        return None

    if reg_to_element_cache:
        if reg in reg_to_element_cache:
            return reg_to_element_cache[reg]
    else:
        build_reg_to_element_map()
        if reg in reg_to_element_cache:
            return reg_to_element_cache[reg]

    queries: list[str] = [reg]
    if ps_code:
        queries.append(ps_code)
    if order_number:
        m = re.search(r"(\d+[а-я]?)", str(order_number), re.IGNORECASE)
        if m:
            queries.append(m.group(1))

    for query in queries:
        eid = _search_element_id(query, expected_reg=reg)
        if eid:
            reg_to_element_cache[reg] = eid
            return eid

    return None