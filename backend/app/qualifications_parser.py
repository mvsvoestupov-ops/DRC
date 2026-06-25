import time
import re
from typing import List, Dict
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from .db import SessionLocal
from .db.qualifications_models import Qualification

BASE_URL = "https://nok-nark.ru"
LIST_URL = "/pk/list/"

def get_driver():
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    return webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options
    )

def get_qualification_links(page: int = 1) -> List[Dict[str, str]]:
    driver = get_driver()
    url = f"{BASE_URL}{LIST_URL}?page={page}"
    print(f"Загрузка страницы {page}: {url}")
    driver.get(url)
    time.sleep(3)

    links = []
    items = driver.find_elements(By.CSS_SELECTOR, "a[href*='/pk/detail/']")
    for item in items:
        href = item.get_attribute('href')
        if not href:
            continue
        code = href.split('/')[-1]
        parent = item.find_element(By.XPATH, "..")
        full_text = parent.text.strip()
        name = re.sub(r'\s*ПОДРОБНЕЕ\s*.*$', '', full_text, flags=re.IGNORECASE)
        name = re.sub(r'\s*\d{2}\.\d{5}\.\d{2}$', '', name).strip()
        if not name:
            name = code
        links.append({'code': code, 'name': name, 'url': href})

    driver.quit()
    unique = {}
    for item in links:
        if item['code'] not in unique:
            unique[item['code']] = item
    return list(unique.values())

def get_all_qualification_links(max_pages: int = None) -> List[Dict[str, str]]:
    all_links = []
    page = 1
    while True:
        if max_pages and page > max_pages:
            break
        links = get_qualification_links(page)
        if not links:
            print("Больше страниц нет.")
            break
        all_links.extend(links)
        print(f"Страница {page}: найдено {len(links)} квалификаций")
        page += 1
        time.sleep(1)
    unique = {}
    for item in all_links:
        if item['code'] not in unique:
            unique[item['code']] = item
    return list(unique.values())

def parse_qualification_detail(url: str) -> dict:
    driver = get_driver()
    print(f"  Загрузка детальной страницы: {url}")
    driver.get(url)

    try:
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CLASS_NAME, "task__row"))
        )
    except Exception as e:
        print(f"  ⚠️ Таймаут ожидания загрузки данных: {e}")

    time.sleep(2)
    html = driver.page_source
    driver.quit()

    soup = BeautifulSoup(html, 'html.parser')

    result = {
        'code': url.split('/')[-1],
        'name': '',
        'level': '',
        'labor_functions': [],
        'activity_area': '',
        'prof_standard_name': '',
        'prof_standard_order': '',
        'qualification_requirement': '',
        'possible_job_titles': [],
        'special_admission': [],
        'exam_documents': [],
        'certificate_validity': '',
        'okz_codes': [],
        'okpdtr_codes': [],
        'okso_codes': [],
        'council_protocol': '',
        'nark_order': '',
        'raw_data': html[:5000]  # ограничим длину для отладки
    }

    # Извлекаем код квалификации из спана
    code_span = soup.find('span', class_='item-detail__tabs-content-header')
    if code_span:
        code_text = code_span.get_text(strip=True)
        if code_text:
            result['code'] = code_text

    rows = soup.find_all('div', class_='task__row')
    for row in rows:
        title_elem = row.find('h3', class_='task__cell-title')
        if not title_elem:
            continue
        title = title_elem.get_text(strip=True)
        content_elem = row.find('p', class_='task__cell-item')
        if not content_elem:
            content_elem = row.find('div', class_='task__cell-content')
        if content_elem:
            text = content_elem.get_text(separator=' ', strip=True)
        else:
            text = ''

        if 'Наименование квалификации' in title:
            result['name'] = text
        elif 'Уровень квалификации' in title:
            result['level'] = text
        elif 'Трудовые функции' in title:
            # Парсим трудовые функции
            tf_blocks = row.find_all('div', class_='task__cell-item')
            for block in tf_blocks:
                header = block.find('div', class_='task__cell-item-tf-header')
                if header:
                    num_elem = header.find('div', class_='task__cell-item-tf-header-num')
                    code_elem = header.find('div', class_='task__cell-item-tf-header-code')
                    name_elem = header.find('div', class_='task__cell-item-tf-header-name')
                    if code_elem and name_elem:
                        result['labor_functions'].append({
                            'number': num_elem.get_text(strip=True) if num_elem else '',
                            'code': code_elem.get_text(strip=True),
                            'name': name_elem.get_text(strip=True)
                        })
            if not result['labor_functions']:
                items = row.find_all('p', class_='task__cell-item')
                for item in items:
                    text_item = item.get_text(strip=True)
                    match = re.match(r'(\d+)\s*\.\s*([A-Z]/\d+\.\d+)\s*(.+)', text_item)
                    if match:
                        result['labor_functions'].append({
                            'number': match.group(1),
                            'code': match.group(2),
                            'name': match.group(3).strip()
                        })
        elif 'Вид профессиональной деятельности' in title:
            result['activity_area'] = text
        elif 'Наименование профессионального стандарта' in title:
            result['prof_standard_name'] = text
        elif 'Реквизиты профессионального стандарта' in title:
            result['prof_standard_order'] = text
        elif 'Квалификационное требование' in title:
            result['qualification_requirement'] = text
        elif 'Возможные наименования должностей' in title:
            if text and text != '-':
                result['possible_job_titles'] = [t.strip() for t in re.split(r'[,;]\s*', text) if t.strip()]
        elif 'Особые условия допуска' in title:
            if text and text != '-':
                result['special_admission'] = [t.strip() for t in re.split(r'\d+\.\s*', text) if t.strip()]
        elif 'Перечень документов для прохождения профессионального экзамена' in title:
            if text and text != '-':
                result['exam_documents'] = [t.strip() for t in re.split(r'\d+\.\s*', text) if t.strip()]
        elif 'Срок действия свидетельства' in title:
            result['certificate_validity'] = text

    return result

def save_qualification_to_db(qualification_data: dict):
    session = SessionLocal()
    try:
        existing = session.query(Qualification).filter(Qualification.code == qualification_data['code']).first()
        if existing:
            for key, value in qualification_data.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            print(f"  Обновлена квалификация {qualification_data['code']}")
        else:
            new_qual = Qualification(**qualification_data)
            session.add(new_qual)
            print(f"  Добавлена квалификация {qualification_data['code']}")
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"  Ошибка сохранения квалификации {qualification_data.get('code')}: {e}")
    finally:
        session.close()

def fetch_all_qualifications(max_pages: int = None, save: bool = True):
    links = get_all_qualification_links(max_pages)
    print(f"Всего найдено квалификаций: {len(links)}")
    for idx, link in enumerate(links):
        print(f"Обработка {idx+1}/{len(links)}: {link['code']}")
        detail = parse_qualification_detail(link['url'])
        if detail and save:
            save_qualification_to_db(detail)
        time.sleep(0.5)

if __name__ == "__main__":
    # Тест на одной странице
    print("=== Тест сбора ссылок ===")
    links = get_qualification_links(1)
    print(f"Найдено квалификаций на первой странице: {len(links)}")
    for l in links[:3]:
        print(l)

    print("\n=== Тест парсинга детальной страницы ===")
    if links:
        detail = parse_qualification_detail(links[0]['url'])
        print("Код:", detail.get('code'))
        print("Наименование:", detail.get('name'))
        print("Уровень:", detail.get('level'))
        print("Количество трудовых функций:", len(detail.get('labor_functions', [])))
        for lf in detail.get('labor_functions', []):
            print(f"  {lf['number']}. {lf['code']} - {lf['name']}")
        print("Наименование профстандарта:", detail.get('prof_standard_name'))
        print("Реквизиты профстандарта:", detail.get('prof_standard_order'))
        print("Вид деятельности:", detail.get('activity_area'))

         # Сохраняем первую квалификацию в БД
    if links:
        detail = parse_qualification_detail(links[0]['url'])
        save_qualification_to_db(detail)
        print("Сохранено!")