import os
import time
import re
from typing import List, Dict
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from .db import SessionLocal
from .db.qualifications_models import Qualification

BASE_URL = "https://nok-nark.ru"
LIST_URL = "/pk/list/"
MAX_PAGES = 500  # запас, чтобы точно собрать все

def get_driver(max_retries=3):
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--page-load-strategy=normal")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-logging")
    chrome_options.add_argument("--log-level=3")
    chrome_options.add_argument("--silent")

    linux_driver = "/usr/local/bin/chromedriver"
    if os.path.isfile(linux_driver):
        return webdriver.Chrome(
            service=Service(linux_driver),
            options=chrome_options
        )

    for attempt in range(max_retries):
        try:
            driver = webdriver.Chrome(
                service=Service(ChromeDriverManager().install()),
                options=chrome_options
            )
            driver.set_page_load_timeout(45)
            return driver
        except Exception as e:
            print(f"  ⚠️ Ошибка создания драйвера (попытка {attempt+1}/{max_retries}): {e}")
            time.sleep(3)
            continue
    raise Exception("Не удалось запустить Chrome после нескольких попыток")

def get_qualification_links(page: int) -> List[Dict[str, str]]:
    driver = None
    try:
        driver = get_driver()
        url = f"{BASE_URL}{LIST_URL}?page={page}"
        print(f"  Загрузка страницы {page}: {url}")
        driver.get(url)
        try:
            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "a[href*='/pk/detail/']"))
            )
        except TimeoutException:
            print(f"  ⚠️ Таймаут на странице {page}, возможно, она пуста")
            driver.quit()
            return []
        
        time.sleep(1)
        links = []
        items = driver.find_elements(By.CSS_SELECTOR, "a[href*='/pk/detail/']")
        for item in items:
            href = item.get_attribute('href')
            if not href:
                continue
            code = href.split('/')[-1]
            try:
                parent = item.find_element(By.XPATH, "..")
                full_text = parent.text.strip()
            except:
                full_text = item.text.strip()
            
            name = re.sub(r'\s*ПОДРОБНЕЕ\s*.*$', '', full_text, flags=re.IGNORECASE)
            name = re.sub(r'\s*\d{2}\.\d{5}\.\d{2}$', '', name).strip()
            if not name:
                name = code
            
            links.append({'code': code, 'name': name, 'url': href})
        driver.quit()
        
        # Удаляем дубликаты по коду
        unique = {}
        for item in links:
            if item['code'] not in unique:
                unique[item['code']] = item
        return list(unique.values())
    except Exception as e:
        print(f"  Ошибка при обработке страницы {page}: {e}")
        if driver:
            driver.quit()
        return []

def get_all_qualification_links(max_pages: int = MAX_PAGES) -> List[Dict[str, str]]:
    all_links = {}
    page = 1
    consecutive_empty = 0
    
    while page <= max_pages:
        links = get_qualification_links(page)
        if not links:
            consecutive_empty += 1
            print(f"  Страница {page} пуста (попытка {consecutive_empty})")
            # Если 20 страниц подряд пустые — вероятно, конец
            if consecutive_empty >= 20:
                print("  Достигнут конец списка (20 пустых страниц подряд)")
                break
        else:
            consecutive_empty = 0
            for link in links:
                if link['code'] not in all_links:
                    all_links[link['code']] = link
            print(f"  Страница {page}: найдено {len(links)} квалификаций, всего собрано {len(all_links)}")
        
        page += 1
        time.sleep(0.5)
    
    print(f"  Итого собрано ссылок: {len(all_links)}")
    return list(all_links.values())

def parse_qualification_detail(url: str) -> dict:
    driver = None
    try:
        driver = get_driver()
        print(f"    Загрузка детальной страницы: {url}")
        driver.get(url)
        try:
            WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CLASS_NAME, "task__row"))
            )
        except TimeoutException:
            print("    ⚠️ Таймаут загрузки детальной страницы")
            driver.quit()
            return None
        
        time.sleep(1)
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
            'raw_data': ''
        }

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
            text = content_elem.get_text(separator=' ', strip=True) if content_elem else ''

            title_lower = title.lower()
            if 'наименование квалификации' in title_lower:
                result['name'] = text
            elif 'уровень квалификации' in title_lower:
                result['level'] = text
            elif 'трудовые функции' in title_lower:
                tf_blocks = row.find_all('div', class_='task__cell-item')
                for block in tf_blocks:
                    header = block.find('div', class_='task__cell-item-tf-header')
                    if header:
                        num = header.find('div', class_='task__cell-item-tf-header-num')
                        code_elem = header.find('div', class_='task__cell-item-tf-header-code')
                        name_elem = header.find('div', class_='task__cell-item-tf-header-name')
                        if code_elem and name_elem:
                            result['labor_functions'].append({
                                'number': num.get_text(strip=True) if num else '',
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
            elif 'вид профессиональной деятельности' in title_lower:
                result['activity_area'] = text
            elif 'наименование профессионального стандарта' in title_lower:
                result['prof_standard_name'] = text
            elif 'реквизиты профессионального стандарта' in title_lower:
                result['prof_standard_order'] = text
            elif 'квалификационное требование' in title_lower:
                result['qualification_requirement'] = text
            elif 'возможные наименования должностей' in title_lower:
                if text and text != '-':
                    result['possible_job_titles'] = [t.strip() for t in re.split(r'[,;]\s*', text) if t.strip()]
            elif 'особые условия допуска' in title_lower:
                if text and text != '-':
                    result['special_admission'] = [t.strip() for t in re.split(r'\d+\.\s*', text) if t.strip() and len(t.strip()) > 2]
            elif 'перечень документов для прохождения профессионального экзамена' in title_lower:
                if text and text != '-':
                    result['exam_documents'] = [t.strip() for t in re.split(r'\d+\.\s*', text) if t.strip() and len(t.strip()) > 2]
            elif 'срок действия свидетельства' in title_lower:
                result['certificate_validity'] = text

        return result
    except Exception as e:
        print(f"    Ошибка парсинга детальной страницы: {e}")
        if driver:
            driver.quit()
        return None

def save_qualification_to_db(qualification_data: dict):
    if not qualification_data:
        return
    session = SessionLocal()
    try:
        existing = session.query(Qualification).filter(Qualification.code == qualification_data['code']).first()
        if existing:
            for key, value in qualification_data.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            print(f"    Обновлена квалификация {qualification_data['code']}")
        else:
            new_qual = Qualification(**qualification_data)
            session.add(new_qual)
            print(f"    Добавлена квалификация {qualification_data['code']}")
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"    Ошибка сохранения квалификации {qualification_data.get('code')}: {e}")
    finally:
        session.close()

def fetch_all_qualifications(max_pages: int = MAX_PAGES, save: bool = True):
    print("=" * 60)
    print("Начинаем сбор квалификаций с сайта НАРК (обновлённый парсер)")
    print("=" * 60)
    
    print("\n[1] Сбор ссылок на квалификации...")
    links = get_all_qualification_links(max_pages)
    print(f"\nВсего найдено квалификаций: {len(links)}")
    
    if not links:
        print("Не найдено ни одной квалификации.")
        return
    
    print("\n[2] Парсинг детальной информации...")
    for idx, link in enumerate(links):
        print(f"  Обработка {idx+1}/{len(links)}: {link['code']} - {link['name'][:50]}...")
        detail = parse_qualification_detail(link['url'])
        if detail and save:
            save_qualification_to_db(detail)
        time.sleep(0.3)
    
    print("\n" + "=" * 60)
    print("✅ Парсинг завершён!")
    print("=" * 60)

if __name__ == "__main__":
    fetch_all_qualifications(save=True)