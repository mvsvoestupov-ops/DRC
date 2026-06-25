import re
import time
import json
import sys
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from app.db import SessionLocal
from app.db.fgos_models import FgosSpo

BASE_URL = "https://classinform.ru"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

def get_soup(url):
    """Загружает страницу и возвращает BeautifulSoup объект."""
    print(f"  Загрузка: {url}")
    resp = requests.get(url, headers=HEADERS, verify=False)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, 'html.parser')

def extract_links(soup, container_selector="a[href*='/fgos/']", filter_pattern=None):
    """Извлекает ссылки по селектору, опционально фильтруя по регулярному выражению."""
    links = []
    for a in soup.select(container_selector):
        href = a.get('href')
        if not href:
            continue
        if filter_pattern and not re.search(filter_pattern, href):
            continue
        full_url = urljoin(BASE_URL, href)
        links.append(full_url)
    return list(set(links))

def get_level_links():
    """Главная → ссылки на уровни образования."""
    soup = get_soup(BASE_URL + "/fgos.html")
    return extract_links(soup, filter_pattern=r"standarty-srednego-professionalnogo-obrazovaniia")

def get_industry_links(level_url):
    """Страница уровня СПО → ссылки на отрасли (2.1, 2.2, ...)."""
    soup = get_soup(level_url)
    return extract_links(soup, filter_pattern=r"/fgos/2\.\d-.*-uroven-2\.html")

def get_group_links(industry_url):
    """Страница отрасли → ссылки на укрупнённые группы (20.00.00, ...)."""
    soup = get_soup(industry_url)
    return extract_links(soup, filter_pattern=r"/fgos/\d{2}\.\d{2}\.\d{2}-.*-uroven-2\.html")

def get_fgos_links(group_url):
    """Страница группы → ссылки на конкретные ФГОС."""
    soup = get_soup(group_url)
    return extract_links(soup, filter_pattern=r"/fgos/\d{2}\.\d{2}\.\d{2}-[^/]*\.html$")

def parse_fgos_page(url):
    """Извлекает все данные с детальной страницы ФГОС."""
    soup = get_soup(url)
    data = {'url': url}

    # Код и название
    h1 = soup.find('h1')
    if h1:
        code_match = re.search(r'(\d{2}\.\d{2}\.\d{2})', h1.text)
        data['code'] = code_match.group(1) if code_match else None
    h2 = soup.find('h2')
    data['name'] = h2.text.strip() if h2 else None

    full_text = soup.get_text(separator='\n')

    # Реквизиты приказа
    order_match = re.search(r'приказом[^.]*\.', full_text, re.IGNORECASE)
    data['order'] = order_match.group(0).strip() if order_match else ''

    # Квалификация
    qual_match = re.search(r'квалификация\s+[^\.]+\.', full_text, re.IGNORECASE)
    data['qualification'] = qual_match.group(0).strip() if qual_match else ''

    # Сроки обучения
    duration = {}
    for line in full_text.split('\n'):
        if 'на базе среднего общего образования' in line and 'года' in line:
            duration['on_base_of_school'] = line.strip()
        elif 'на базе основного общего образования' in line and 'года' in line:
            duration['on_base_of_primary'] = line.strip()
    data['study_duration'] = duration

    # Области профессиональной деятельности
    areas_match = re.search(r'Области профессиональной деятельности[^:]*:(.*?)(?=\d+\.\d+\.|$)', full_text, re.DOTALL)
    if areas_match:
        areas_text = areas_match.group(1).strip()
        areas = re.findall(r'(\d+)\s+([^,]+(?:,|$))', areas_text)
        data['activity_areas'] = [f"{a[0]} {a[1].strip()}" for a in areas]
    else:
        data['activity_areas'] = []

    # Общие компетенции (ОК)
    ok_list = re.findall(r'ОК\s+\d+\.\s*[^;]+(?:;|\.)', full_text)
    data['ok_competencies'] = [ok.strip() for ok in ok_list]

    # Профессиональные компетенции (ПК)
    pk_list = re.findall(r'ПК\s+\d+\.\d+\.\s*[^;]+(?:;|\.)', full_text)
    data['pk_competencies'] = [pk.strip() for pk in pk_list]

    # Ссылка на PDF
    pdf_link = soup.find('a', href=re.compile(r'/fgos/download/.*\.pdf'))
    data['pdf_url'] = pdf_link.get('href') if pdf_link else None

    data['level'] = 'СПО'
    return data

def save_to_db(data):
    """Сохраняет запись ФГОС в базу данных (с проверкой дубликатов по коду)."""
    session = SessionLocal()
    try:
        existing = session.query(FgosSpo).filter_by(code=data.get('code')).first()
        if existing:
            for key, value in data.items():
                if key != 'code' and hasattr(existing, key):
                    setattr(existing, key, value)
            print(f"  Обновлён ФГОС {data.get('code')}")
        else:
            new_fgos = FgosSpo(**data)
            session.add(new_fgos)
            print(f"  Добавлен ФГОС {data.get('code')}")
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"  Ошибка сохранения {data.get('code')}: {e}")
    finally:
        session.close()

def collect_all_fgos_spo(output_file='fgos_spo.json', save_db=False):
    """
    Обходит все уровни, отрасли, группы и собирает все ФГОС СПО.
    Сохраняет в JSON и опционально в БД.
    """
    all_fgos = []

    level_links = get_level_links()
    print(f"Найдено уровней: {len(level_links)}")
    for level_url in level_links:
        print(f"Обработка уровня: {level_url}")
        industry_links = get_industry_links(level_url)
        print(f"  Отраслей: {len(industry_links)}")
        for ind_url in industry_links:
            print(f"    Обработка отрасли: {ind_url}")
            group_links = get_group_links(ind_url)
            print(f"      Групп: {len(group_links)}")
            for group_url in group_links:
                print(f"        Обработка группы: {group_url}")
                fgos_links = get_fgos_links(group_url)
                print(f"          ФГОС: {len(fgos_links)}")
                for fgos_url in fgos_links:
                    print(f"            Парсинг: {fgos_url}")
                    data = parse_fgos_page(fgos_url)
                    all_fgos.append(data)
                    if save_db:
                        save_to_db(data)
                    time.sleep(0.5)  # пауза между запросами
                time.sleep(1)
            time.sleep(1)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_fgos, f, ensure_ascii=False, indent=2)
    print(f"\n✅ Сохранено {len(all_fgos)} записей в {output_file}")
    return all_fgos

if __name__ == "__main__":
    save_db = '--save-db' in sys.argv
    collect_all_fgos_spo(save_db=save_db)