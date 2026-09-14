"""
Парсер квалификаций с nok-nark.ru (без Selenium).

На сайте ~4054 квалификации на 406 страницах (по 10 записей; «из 406» — это страницы, не записи).
Суффикс кода бывает из 2–3 цифр: 40.20900.01 и 40.20900.100.
"""
from __future__ import annotations

import json
import os
import re
import time
from typing import Dict, List, Optional
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup

from .db import SessionLocal
from .db.qualifications_models import Qualification

BASE_URL = "https://nok-nark.ru"
LIST_URL = "/pk/list/"
MAX_LIST_PAGES = 500
SITE_TOTAL_PAGES = 406  # счётчик «из N» на nok-nark.ru — страницы, не записи
EXPECTED_SITE_COUNT = 4054
# 40.20900.01 … 40.20900.310 — суффикс 2–4 цифры; старый \d{2} обрезал .100 до .10
CODE_TOKEN = r"\d{2}\.\d{5}\.\d{2,4}"
CODE_PATTERN = re.compile(rf"\b({CODE_TOKEN})\b")
CODE_EXACT = re.compile(rf"^{CODE_TOKEN}$")
LONG_SUFFIX_PAGE_START = 368
LONG_SUFFIX_PAGE_END = 392
PAGE_DELAY_SEC = 0.35
EMPTY_PAGE_ROUNDS = 5

_LINKS_CACHE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "scripts",
    "output",
    "nark_qualification_links.json",
)

_PAGE_AUDIT_PATH = os.path.join(
    os.path.dirname(_LINKS_CACHE_PATH),
    "nark_page_audit.json",
)
_PAGE_AUDIT_TXT = os.path.join(
    os.path.dirname(_LINKS_CACHE_PATH),
    "nark_page_audit.txt",
)
_LONG_SUFFIX_CODES_PATH = os.path.join(
    os.path.dirname(_LINKS_CACHE_PATH),
    "nark_long_suffix_codes.json",
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ru-RU,ru;q=0.9",
}


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def _fetch_html(session: requests.Session, url: str, retries: int = 3) -> Optional[str]:
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=60)
            resp.raise_for_status()
            if resp.encoding is None or resp.encoding.lower() == "iso-8859-1":
                resp.encoding = resp.apparent_encoding or "utf-8"
            return resp.text
        except Exception as e:
            print(f"    Ошибка загрузки {url} (попытка {attempt + 1}/{retries}): {e}")
            time.sleep(1.5 * (attempt + 1))
    return None


def parse_total_pages(html: str) -> int:
    """Число страниц пагинации (на сайте «из 405» или data-page)."""
    parsed = parse_list_total_pages(html)
    if parsed and parsed > 0:
        return parsed

    page_of = re.search(r"(\d+)\s*из\s*(\d+)", html, flags=re.IGNORECASE)
    if page_of:
        current, total = int(page_of.group(1)), int(page_of.group(2))
        if total >= current >= 1:
            return total

    totals = [int(n) for n in re.findall(r"из\s*(\d+)", html, flags=re.IGNORECASE)]
    # игнорируем «из 1», «из 10» — это не общее число страниц
    significant = [t for t in totals if t >= 50]
    if significant:
        return max(significant)

    return SITE_TOTAL_PAGES


def parse_list_total_pages(html: str, *, filtered: bool = False) -> Optional[int]:
    """
    Пагинация nok-nark: блок .pagination__goto «N из M» и data-page в .pagination.

    На страницах с фильтром в HTML часто остаётся глобальное «из 405» в data-page —
    для filtered=True опираемся только на .pagination__goto.
    """
    soup = BeautifulSoup(html, "html.parser")
    lower = html.lower()
    if "квалификации не найдены" in lower:
        return 0

    goto_total: Optional[int] = None
    goto = soup.select_one(".pagination__goto")
    if goto:
        text = goto.get_text(" ", strip=True)
        m = re.search(r"(\d+)\s*из\s*(\d+)", text, flags=re.IGNORECASE)
        if m:
            goto_total = int(m.group(2))

    if filtered:
        return goto_total

    if goto_total is not None and goto_total >= 50:
        return goto_total

    pagination = soup.select_one(".pagination")
    scope = pagination if pagination else soup
    data_pages: List[int] = []
    for el in scope.select("[data-page]"):
        raw = (el.get("data-page") or "").strip()
        if raw.isdigit():
            val = int(raw)
            if val > 0:
                data_pages.append(val)
    if data_pages:
        return max(data_pages)

    return goto_total


def _is_filtered_params(extra_params: Optional[dict]) -> bool:
    if not extra_params:
        return False
    return any(str(k).startswith("filter[") for k in extra_params)


def crawl_full_list_pages(
    session: requests.Session,
    all_links: Dict[str, Dict[str, str]],
    *,
    sort_order: str = "asc",
    start_page: int = 1,
    end_page: int = SITE_TOTAL_PAGES,
    max_retries: int = 10,
) -> int:
    """
    Обход полного реестра page=1..405 без фильтров.
    Сайт периодически отдаёт пустые страницы — собираем список пустых и догружаем в конце.
    """
    extra = {"sort[by]": "CODE", "sort[order]": sort_order}
    empty_pages: List[int] = []
    added = 0

    for page in range(start_page, end_page + 1):
        links = fetch_list_page_links(session, page, retries=max_retries, extra_params=extra)
        if links:
            added += _merge_links(all_links, links)
        else:
            empty_pages.append(page)

        if page == end_page or page % 50 == 0:
            print(
                f"    полный список {sort_order} стр. {page}/{end_page}: "
                f"+{added} за проход, уникальных {len(all_links)}, пустых {len(empty_pages)}"
            )
            _save_links_cache(all_links)

        time.sleep(PAGE_DELAY_SEC)

    for round_idx in range(1, EMPTY_PAGE_ROUNDS + 1):
        if not empty_pages:
            break
        if len(all_links) >= EXPECTED_SITE_COUNT:
            break
        print(
            f"    догрузка пустых ({sort_order}), раунд {round_idx}: "
            f"{len(empty_pages)} стр., сейчас {len(all_links)}/{EXPECTED_SITE_COUNT}"
        )
        still_empty: List[int] = []
        for page in empty_pages:
            links = fetch_list_page_links(
                session, page, retries=max_retries + round_idx, extra_params=extra
            )
            if links:
                added += _merge_links(all_links, links)
            else:
                still_empty.append(page)
            time.sleep(PAGE_DELAY_SEC + 0.15 * round_idx)
        empty_pages = still_empty
        _save_links_cache(all_links)

    return added


def audit_nark_list_pages(
    session: requests.Session,
    all_links: Dict[str, Dict[str, str]],
    *,
    sort_order: str = "asc",
    max_retries: int = 8,
    merge: bool = True,
) -> dict:
    """
    Проверка каждой страницы полного списка 1..405.
    Возвращает список пустых страниц и статистику по каждой.
    """
    extra = {"sort[by]": "CODE", "sort[order]": sort_order}
    empty_pages: List[int] = []
    weak_pages: List[int] = []
    page_stats: Dict[str, dict] = {}
    added = 0

    for page in range(1, SITE_TOTAL_PAGES + 1):
        links = fetch_list_page_links(session, page, retries=max_retries, extra_params=extra)
        count = len(links)
        codes = [item["code"] for item in links]
        page_stats[str(page)] = {"count": count, "codes": codes}

        if merge and links:
            added += _merge_links(all_links, links)

        if count == 0:
            empty_pages.append(page)
        elif page < SITE_TOTAL_PAGES and count < 8:
            weak_pages.append(page)

        if page == 1 or page % 50 == 0 or page == SITE_TOTAL_PAGES:
            print(
                f"    аудит {sort_order} {page}/{SITE_TOTAL_PAGES}: "
                f"на стр. {count}, пустых {len(empty_pages)}, слабых {len(weak_pages)}, "
                f"уникальных {len(all_links)}"
            )
            if merge:
                _save_links_cache(all_links)

        time.sleep(PAGE_DELAY_SEC)

    return {
        "sort_order": sort_order,
        "empty_pages": empty_pages,
        "weak_pages": weak_pages,
        "page_stats": page_stats,
        "added": added,
        "unique_codes": len(all_links),
    }


def crawl_pages_intensive(
    session: requests.Session,
    all_links: Dict[str, Dict[str, str]],
    pages: List[int],
    *,
    sort_orders: tuple[str, ...] = ("asc", "desc"),
    rounds: int = 3,
) -> int:
    """Повторная загрузка только указанных страниц (несколько раундов asc/desc)."""
    if not pages:
        return 0

    unique_pages = sorted(set(pages))
    added = 0
    print(f"    точечная догрузка {len(unique_pages)} стр., раундов {rounds}...")

    for round_idx in range(1, rounds + 1):
        still_empty: List[int] = []
        for order in sort_orders:
            extra = {"sort[by]": "CODE", "sort[order]": order}
            for page in unique_pages:
                links = fetch_list_page_links(
                    session,
                    page,
                    retries=12 + round_idx,
                    extra_params=extra,
                )
                if links:
                    added += _merge_links(all_links, links)
                else:
                    still_empty.append(page)
                time.sleep(PAGE_DELAY_SEC + 0.25 * round_idx)
        unique_pages = sorted(set(still_empty))
        _save_links_cache(all_links)
        print(
            f"      раунд {round_idx}/{rounds}: +{added} за сессию, "
            f"уникальных {len(all_links)}, ещё пустых {len(unique_pages)}"
        )
        if not unique_pages:
            break
        if len(all_links) >= EXPECTED_SITE_COUNT:
            break

    return added


def complete_index_from_missing_pages(
    session: Optional[requests.Session] = None,
    *,
    merge_cache: bool = True,
) -> dict:
    """
    1) аудит всех 405 страниц;
    2) повторная загрузка пустых/слабых страниц;
    3) обновление кэша ссылок.
    """
    session = session or _session()
    all_links = _load_links_cache() if merge_cache else {}
    before = len(all_links)

    print("\n  === Аудит страниц реестра НАРК (1–405, asc) ===")
    audit_asc = audit_nark_list_pages(session, all_links, sort_order="asc", merge=True)

    retry_pages = sorted(set(audit_asc["empty_pages"] + audit_asc["weak_pages"]))
    if retry_pages:
        print(
            f"\n  === Повтор {len(retry_pages)} проблемных страниц "
            f"(пустых {len(audit_asc['empty_pages'])}, слабых {len(audit_asc['weak_pages'])}) ==="
        )
        crawl_pages_intensive(session, all_links, retry_pages, rounds=4)

    if len(all_links) < EXPECTED_SITE_COUNT * 0.995:
        print("\n  === Аудит desc (добор пропусков) ===")
        audit_desc = audit_nark_list_pages(session, all_links, sort_order="desc", merge=True)
        retry_desc = sorted(
            set(audit_desc["empty_pages"] + audit_desc["weak_pages"]) - set(retry_pages)
        )
        combined_retry = sorted(set(retry_pages) | set(audit_desc["empty_pages"]))
        if combined_retry and len(all_links) < EXPECTED_SITE_COUNT:
            print(f"\n  === Финальный повтор {len(combined_retry)} страниц ===")
            crawl_pages_intensive(session, all_links, combined_retry, rounds=3)
        if retry_desc:
            crawl_pages_intensive(session, all_links, retry_desc, rounds=2)

    _save_links_cache(all_links)
    index_gap = max(0, EXPECTED_SITE_COUNT - len(all_links))

    report = {
        "before": before,
        "after": len(all_links),
        "expected": EXPECTED_SITE_COUNT,
        "index_gap": index_gap,
        "empty_pages_asc": audit_asc["empty_pages"],
        "weak_pages_asc": audit_asc["weak_pages"],
        "page_counts_asc": {k: v["count"] for k, v in audit_asc["page_stats"].items()},
    }

    os.makedirs(os.path.dirname(_PAGE_AUDIT_PATH), exist_ok=True)
    with open(_PAGE_AUDIT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    with open(_PAGE_AUDIT_TXT, "w", encoding="utf-8") as f:
        f.write(
            f"Индекс до: {before}, после: {len(all_links)}, ожидается: {EXPECTED_SITE_COUNT}\n"
            f"Дыра в индексе: {index_gap}\n\n"
            f"Пустые страницы (asc): {len(audit_asc['empty_pages'])}\n"
            f"{', '.join(map(str, audit_asc['empty_pages']))}\n\n"
            f"Слабые страницы (<8 записей, asc): {len(audit_asc['weak_pages'])}\n"
            f"{', '.join(map(str, audit_asc['weak_pages']))}\n"
        )

    print(
        f"\n  Индекс после точечного обхода: {len(all_links)} "
        f"(+{len(all_links) - before}, дыра ~{index_gap})"
    )
    print(f"  Отчёт по страницам: {_PAGE_AUDIT_TXT}")
    return report


def fetch_list_page_links(
    session: requests.Session,
    page: int,
    *,
    retries: int = 5,
    extra_params: Optional[dict] = None,
) -> List[Dict[str, str]]:
    """Загрузка страницы списка с повторами (сайт иногда отдаёт пустую страницу)."""
    url = get_list_page_url(page, extra_params)
    for attempt in range(retries):
        html = _fetch_html(session, url, retries=2)
        if not html:
            time.sleep(2.0 * (attempt + 1))
            continue

        links = parse_qualification_links_from_html(html)
        if links:
            return links

        # При фильтре «из N» небольшое — не требуем page > 405
        if "квалификации не найдены" in html.lower():
            return []

        time.sleep(2.0 * (attempt + 1))

    return []


def parse_qualification_links_from_html(html: str) -> List[Dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    items: Dict[str, Dict[str, str]] = {}

    for link in soup.find_all("a", href=True):
        href = link["href"]
        if "/pk/detail/" not in href:
            continue
        if href.startswith("/"):
            url = f"{BASE_URL}{href}"
        elif href.startswith("http"):
            url = href
        else:
            url = f"{BASE_URL}/{href.lstrip('/')}"

        code = url.rstrip("/").split("/")[-1]
        if not CODE_EXACT.fullmatch(code):
            continue

        name = link.get_text(" ", strip=True)
        if name.lower() in ("подробнее", "detail"):
            card = link.find_parent(["div", "li", "article"])
            if card:
                texts = [
                    t.strip()
                    for t in card.stripped_strings
                    if t.strip().lower() not in ("подробнее", code.lower())
                ]
                name = texts[0] if texts else code
        name = re.sub(r"\s*подробнее\s*$", "", name, flags=re.IGNORECASE).strip()
        name = re.sub(rf"\s*{re.escape(code)}\s*$", "", name).strip() or code

        items[code] = {"code": code, "name": name, "url": url.split("?")[0].rstrip("/") + "/"}

    for code in CODE_PATTERN.findall(html):
        items.setdefault(
            code,
            {
                "code": code,
                "name": code,
                "url": f"{BASE_URL}/pk/detail/{code}/",
            },
        )

    return list(items.values())


def get_list_page_url(page: int, extra_params: Optional[dict] = None) -> str:
    params = {"page": page, "sort[by]": "CODE", "sort[order]": "asc"}
    if extra_params:
        params.update(extra_params)
    query = urlencode(params)
    return f"{BASE_URL}{LIST_URL}?{query}"


def get_qualification_links_page(session: requests.Session, page: int) -> List[Dict[str, str]]:
    url = get_list_page_url(page)
    html = _fetch_html(session, url)
    if not html:
        return []
    if "квалификации не найдены" in html.lower() and not parse_qualification_links_from_html(html):
        return []
    return parse_qualification_links_from_html(html)


def _load_links_cache() -> Dict[str, Dict[str, str]]:
    if not os.path.isfile(_LINKS_CACHE_PATH):
        return {}
    try:
        with open(_LINKS_CACHE_PATH, encoding="utf-8") as f:
            data = json.load(f)
        items = data.get("items") if isinstance(data, dict) else data
        out: Dict[str, Dict[str, str]] = {}
        for item in items or []:
            code = (item.get("code") or "").strip()
            if CODE_EXACT.fullmatch(code):
                out[code] = {
                    "code": code,
                    "name": item.get("name") or code,
                    "url": item.get("url") or f"{BASE_URL}/pk/detail/{code}/",
                }
        return out
    except Exception as exc:
        print(f"  ⚠ Не удалось прочитать кэш ссылок: {exc}")
        return {}


def _save_links_cache(all_links: Dict[str, Dict[str, str]]) -> None:
    try:
        os.makedirs(os.path.dirname(_LINKS_CACHE_PATH), exist_ok=True)
        payload = {
            "count": len(all_links),
            "expected": EXPECTED_SITE_COUNT,
            "items": list(all_links.values()),
        }
        with open(_LINKS_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"  Кэш ссылок: {_LINKS_CACHE_PATH} ({len(all_links)})")
    except Exception as exc:
        print(f"  ⚠ Не удалось сохранить кэш ссылок: {exc}")


def parse_list_filter_options(html: str) -> Dict[str, List[Dict[str, str]]]:
    """Внутренние ID фильтров с первой страницы списка (не коды 01/001)."""
    soup = BeautifulSoup(html, "html.parser")
    out: Dict[str, List[Dict[str, str]]] = {"areas": [], "spks": []}

    for opt in soup.select('select[name="filter[SPK_PROF_AREA]"] option'):
        value = (opt.get("value") or "").strip()
        if not value:
            continue
        out["areas"].append({"id": value, "label": opt.get_text(" ", strip=True)})

    for opt in soup.select('select[name="filter[PROPERTY_SPK_ID]"] option'):
        value = (opt.get("value") or "").strip()
        if not value:
            continue
        out["spks"].append({"id": value, "label": opt.get_text(" ", strip=True)})

    return out


def _merge_links(
    all_links: Dict[str, Dict[str, str]],
    links: List[Dict[str, str]],
) -> int:
    before = len(all_links)
    for link in links:
        all_links.setdefault(link["code"], link)
    return len(all_links) - before


def crawl_filtered_list(
    session: requests.Session,
    all_links: Dict[str, Dict[str, str]],
    *,
    filter_key: str,
    filter_id: str,
    label: str,
    max_pages: int = 250,
    sort_order: str = "asc",
) -> int:
    """
    Обход списка по одному фильтру.
    Полный реестр (~405 стр.) после ~375 часто пустой; по ОПД/СПК — короткие стабильные списки.
    Число страниц берём из data-page пагинации, не из глобальных «405».
    """
    extra = {
        filter_key: filter_id,
        "sort[by]": "CODE",
        "sort[order]": sort_order,
    }
    first_html = _fetch_html(session, get_list_page_url(1, extra), retries=4)
    if not first_html:
        print(f"    ⚠ {label}: нет ответа")
        return 0

    filtered = _is_filtered_params(extra)
    first_links = parse_qualification_links_from_html(first_html)
    if "квалификации не найдены" in first_html.lower() and not first_links:
        print(f"    {label}: пусто")
        return 0

    parsed_pages = parse_list_total_pages(first_html, filtered=filtered)
    if parsed_pages is None:
        total_pages = max_pages
        pages_src = "dynamic"
    elif parsed_pages <= 0:
        print(f"    {label}: пусто (0 стр.)")
        return 0
    else:
        total_pages = min(parsed_pages, max_pages)
        pages_src = f"pager={parsed_pages}"

    added = 0
    empty_pages: List[int] = []
    pages_done = 0
    for page in range(1, total_pages + 1):
        if page == 1:
            links = first_links or fetch_list_page_links(
                session, 1, retries=6, extra_params=extra
            )
        else:
            links = fetch_list_page_links(session, page, retries=6, extra_params=extra)

        pages_done = page
        if links:
            added += _merge_links(all_links, links)
        else:
            empty_pages.append(page)

        time.sleep(PAGE_DELAY_SEC)

    for round_idx in range(1, 4):
        if not empty_pages:
            break
        still_empty: List[int] = []
        for page in empty_pages:
            links = fetch_list_page_links(
                session, page, retries=8 + round_idx, extra_params=extra
            )
            if links:
                added += _merge_links(all_links, links)
            else:
                still_empty.append(page)
            time.sleep(PAGE_DELAY_SEC + 0.1 * round_idx)
        empty_pages = still_empty

    print(
        f"    {label}: {pages_src}, обошли {pages_done}, "
        f"+{added}, всего {len(all_links)}"
        + (f", пустых стр. {len(empty_pages)}" if empty_pages else "")
    )
    return added


def discover_links_by_filters(
    session: Optional[requests.Session] = None,
    *,
    use_areas: bool = True,
    use_spks: bool = True,
    merge_cache: bool = True,
    also_desc: bool = True,
    skip_full_list: bool = False,
) -> List[Dict[str, str]]:
    """
    Сбор всех кодов через фильтры ОПД и/или СПК вместо сплошного page=1..405.
    """
    session = session or _session()
    all_links = _load_links_cache() if merge_cache else {}
    if all_links:
        print(f"  Кэш ссылок загружен: {len(all_links)}")

    print("  Чтение опций фильтров...")
    first_html = _fetch_html(session, get_list_page_url(1), retries=5)
    if not first_html:
        if all_links:
            print("  ⚠ Сайт недоступен — используем кэш")
            return list(all_links.values())
        raise RuntimeError("Не удалось загрузить список квалификаций")

    options = parse_list_filter_options(first_html)
    print(f"  ОПД: {len(options['areas'])}, СПК: {len(options['spks'])}")

    if not skip_full_list:
        print("\n  Полный реестр без фильтров (1–405, asc)...")
        crawl_full_list_pages(session, all_links, sort_order="asc")
        _save_links_cache(all_links)

        if len(all_links) < EXPECTED_SITE_COUNT * 0.995:
            print("\n  Полный реестр без фильтров (1–405, desc)...")
            crawl_full_list_pages(session, all_links, sort_order="desc")
            _save_links_cache(all_links)
    else:
        print("  (полный обход страниц пропущен — уже выполнен аудит)")

    large_filters: List[tuple] = []  # (key, id, label) для desc-добора

    if use_areas:
        print("\n  Обход по областям профессиональной деятельности...")
        for idx, area in enumerate(options["areas"], 1):
            print(f"  [{idx}/{len(options['areas'])}] {area['label']}")
            before = len(all_links)
            crawl_filtered_list(
                session,
                all_links,
                filter_key="filter[SPK_PROF_AREA]",
                filter_id=area["id"],
                label=area["label"],
                sort_order="asc",
            )
            gained = len(all_links) - before
            if gained >= 80:
                large_filters.append(
                    ("filter[SPK_PROF_AREA]", area["id"], area["label"])
                )
            if idx % 5 == 0:
                _save_links_cache(all_links)

    if use_spks:
        print("\n  Обход по СПК (добор кодов без ОПД / пересечения)...")
        for idx, spk in enumerate(options["spks"], 1):
            print(f"  [{idx}/{len(options['spks'])}] {spk['label']}")
            before = len(all_links)
            crawl_filtered_list(
                session,
                all_links,
                filter_key="filter[PROPERTY_SPK_ID]",
                filter_id=spk["id"],
                label=spk["label"],
                sort_order="asc",
            )
            gained = len(all_links) - before
            if gained >= 80:
                large_filters.append(
                    ("filter[PROPERTY_SPK_ID]", spk["id"], spk["label"])
                )
            if idx % 5 == 0:
                _save_links_cache(all_links)

    if also_desc and len(all_links) < EXPECTED_SITE_COUNT * 0.98 and large_filters:
        print(
            f"\n  Добор desc по крупным фильтрам "
            f"({len(large_filters)} шт., сейчас {len(all_links)}/{EXPECTED_SITE_COUNT})..."
        )
        for key, fid, label in large_filters:
            crawl_filtered_list(
                session,
                all_links,
                filter_key=key,
                filter_id=fid,
                label=label,
                sort_order="desc",
            )
            _save_links_cache(all_links)

    # Стабильные «ранние» страницы полного списка (page>375 ломается)
    if len(all_links) < EXPECTED_SITE_COUNT * 0.99:
        print("\n  Добор «хвоста» полного списка 301–405...")
        for order in ("asc", "desc"):
            crawl_full_list_pages(
                session,
                all_links,
                sort_order=order,
                start_page=301,
                end_page=SITE_TOTAL_PAGES,
                max_retries=12,
            )
            _save_links_cache(all_links)

    _save_links_cache(all_links)
    gap = max(0, EXPECTED_SITE_COUNT - len(all_links))
    print(f"\n  Итого уникальных кодов: {len(all_links)} (ожидается ~{EXPECTED_SITE_COUNT})")
    if gap:
        print(
            f"  ⚠ До ожидаемых на сайте не хватает в индексе: ~{gap}. "
            f"Перезапустите скрипт или проверьте доступность nok-nark.ru."
        )
    return list(all_links.values())


def _load_long_suffix_fallback() -> List[Dict[str, str]]:
    """Жёсткий список 40.20900.100–310 — если обход страниц снова обрежет коды."""
    codes: List[str] = []
    if os.path.isfile(_LONG_SUFFIX_CODES_PATH):
        try:
            with open(_LONG_SUFFIX_CODES_PATH, encoding="utf-8") as f:
                data = json.load(f)
            raw = data.get("codes") if isinstance(data, dict) else data
            codes = [str(c).strip() for c in (raw or []) if CODE_EXACT.fullmatch(str(c).strip())]
        except Exception as exc:
            print(f"  ⚠ Не удалось прочитать {_LONG_SUFFIX_CODES_PATH}: {exc}")
    if not codes:
        codes = [f"40.20900.{n}" for n in range(100, 311)]
    return [
        {"code": code, "name": code, "url": f"{BASE_URL}/pk/detail/{code}/"}
        for code in codes
    ]


def recover_long_suffix_codes(
    session: Optional[requests.Session] = None,
    *,
    merge_cache: bool = True,
    start_page: int = LONG_SUFFIX_PAGE_START,
    end_page: int = LONG_SUFFIX_PAGE_END,
) -> dict:
    """
    Добор кодов с суффиксом из 3+ цифр (страницы ~370–391: 40.20900.100–310).
    Старый шаблон \\d{2} принимал 40.20900.100 как 40.20900.10 — индекс «терял» ~211 записей.
    """
    session = session or _session()
    all_links = _load_links_cache() if merge_cache else {}
    before = len(all_links)
    extra = {"sort[by]": "CODE", "sort[order]": "asc"}
    added = 0
    long_codes: List[str] = []

    print(
        f"\n  === Добор длинных суффиксов (стр. {start_page}–{end_page}) ==="
    )
    for page in range(start_page, end_page + 1):
        links = fetch_list_page_links(session, page, retries=8, extra_params=extra)
        for item in links:
            if re.search(r"\.\d{3,}$", item["code"]):
                long_codes.append(item["code"])
        added += _merge_links(all_links, links)
        time.sleep(PAGE_DELAY_SEC)

    fallback = _load_long_suffix_fallback()
    added += _merge_links(all_links, fallback)
    if merge_cache:
        _save_links_cache(all_links)

    unique_long = sorted(set(long_codes) | {item["code"] for item in fallback})
    print(
        f"  Длинные суффиксы: {len(unique_long)}, индекс {before} → {len(all_links)}"
    )
    return {
        "before": before,
        "after": len(all_links),
        "added": added,
        "long_suffix_codes": unique_long,
    }


def fetch_qualifications_by_codes(
    codes: List[str],
    *,
    save: bool = True,
    delay: float = 0.15,
) -> dict:
    """Загрузка карточек по списку кодов (пропуск уже существующих в БД)."""
    unique = []
    seen = set()
    for raw in codes:
        code = (raw or "").strip()
        if not CODE_EXACT.fullmatch(code) or code in seen:
            continue
        seen.add(code)
        unique.append(code)

    db_codes = get_db_qualification_codes()
    to_fetch = [c for c in unique if c not in db_codes]
    print(f"  К загрузке карточек: {len(to_fetch)} (уже в БД: {len(unique) - len(to_fetch)})")

    processed: List[str] = []
    failed: List[dict] = []
    if not to_fetch:
        stats = get_qualification_stats()
        return {
            "processed": processed,
            "failed": failed,
            "local_count": stats["local_count"],
            **stats,
        }

    http = _session()
    db_session = SessionLocal() if save else None
    try:
        for idx, code in enumerate(to_fetch, 1):
            if idx == 1 or idx % 25 == 0 or idx == len(to_fetch):
                print(f"  [{idx}/{len(to_fetch)}] {code}")
            url = f"{BASE_URL}/pk/detail/{code}/"
            detail = parse_qualification_detail(url, http)
            if not detail:
                failed.append({"code": code, "error": "пустой ответ", "url": url})
                continue
            if not detail.get("name"):
                detail["name"] = code
            if save and db_session:
                save_qualification_to_db(detail, db_session)
                if idx % 25 == 0:
                    db_session.commit()
            processed.append(code)
            time.sleep(delay)
        if save and db_session:
            db_session.commit()
    finally:
        if db_session:
            db_session.close()

    if save and processed:
        relink_session = SessionLocal()
        try:
            from .qualification_links import relink_all_qualifications

            link_result = relink_all_qualifications(
                relink_session, update_existing=True, commit=True
            )
            print(
                f"\nСвязано квалификаций с ПС: {link_result.linked} "
                f"(не найдено ПС: {link_result.not_found})"
            )
        finally:
            relink_session.close()

    stats = get_qualification_stats()
    print(f"  Скачано: {len(processed)}, ошибок: {len(failed)}, в БД: {stats['local_count']}")
    return {
        "processed": processed,
        "failed": failed,
        "local_count": stats["local_count"],
        **stats,
    }


def recover_long_suffix_and_fetch(*, save: bool = True, delay: float = 0.15) -> dict:
    """Обход стр. 368–392 + fallback-список + загрузка отсутствующих карточек."""
    print("=" * 60)
    print("Догрузка квалификаций НАРК с длинным суффиксом кода")
    print("=" * 60)
    recovered = recover_long_suffix_codes(merge_cache=True)
    codes = recovered.get("long_suffix_codes") or [
        item["code"] for item in _load_long_suffix_fallback()
    ]
    fetched = fetch_qualifications_by_codes(codes, save=save, delay=delay)
    return {**recovered, **fetched}


def get_db_qualification_codes() -> set[str]:
    session = SessionLocal()
    try:
        return {r[0] for r in session.query(Qualification.code).all() if r[0]}
    finally:
        session.close()


def find_missing_qualification_links(
    session: Optional[requests.Session] = None,
    *,
    rediscover: bool = True,
    use_areas: bool = True,
    use_spks: bool = True,
    skip_page_audit: bool = False,
) -> dict:
    """Сравнивает индекс сайта с БД; при rediscover=True обновляет индекс."""
    http = session or _session()
    if rediscover:
        recover_long_suffix_codes(http, merge_cache=True)
        cached = _load_links_cache()
        if not skip_page_audit and len(cached) < EXPECTED_SITE_COUNT * 0.995:
            complete_index_from_missing_pages(http, merge_cache=True)
        cached = _load_links_cache()
        if len(cached) < EXPECTED_SITE_COUNT * 0.995 and (use_areas or use_spks):
            print("\n  Добор через фильтры ОПД/СПК (после обхода страниц)...")
            discover_links_by_filters(
                http,
                use_areas=use_areas,
                use_spks=use_spks,
                merge_cache=True,
                skip_full_list=not skip_page_audit,
            )
        links = list(_load_links_cache().values())
    else:
        cached = _load_links_cache()
        if not cached:
            links = discover_links_by_filters(http, use_areas=use_areas, use_spks=use_spks)
        else:
            print(f"  Используем кэш без обхода сайта: {len(cached)}")
            links = list(cached.values())

    by_code = {item["code"]: item for item in links}
    db_codes = get_db_qualification_codes()
    missing_codes = sorted(set(by_code) - db_codes)
    missing_links = [by_code[c] for c in missing_codes]
    index_gap = max(0, EXPECTED_SITE_COUNT - len(by_code))

    return {
        "site_count": len(by_code),
        "expected_site_count": EXPECTED_SITE_COUNT,
        "index_gap": index_gap,
        "db_count": len(db_codes),
        "missing_count": len(missing_codes),
        "missing_codes": missing_codes,
        "missing_links": missing_links,
        "extra_in_db": sorted(db_codes - set(by_code)),
    }


def fetch_missing_qualifications(
    *,
    save: bool = True,
    delay: float = 0.15,
    rediscover: bool = True,
    use_areas: bool = True,
    use_spks: bool = True,
    skip_page_audit: bool = False,
    report_path: Optional[str] = None,
) -> dict:
    """
    1) аудит и точечная догрузка страниц списка 1–405;
    2) при необходимости — фильтры ОПД/СПК;
    3) загрузка карточек /pk/detail/{code}/ для кодов, которых нет в БД.
    """
    print("=" * 60)
    print("Адресная догрузка недостающих квалификаций НАРК")
    print("=" * 60)

    http = _session()
    gap = find_missing_qualification_links(
        http,
        rediscover=rediscover,
        use_areas=use_areas,
        use_spks=use_spks,
        skip_page_audit=skip_page_audit,
    )

    print(
        f"\nНа сайте (индекс): {gap['site_count']}, ожидается ~{EXPECTED_SITE_COUNT}, "
        f"дыра в индексе: {gap.get('index_gap', 0)}"
    )
    print(
        f"В БД: {gap['db_count']}, не хватает в БД (из известного индекса): {gap['missing_count']}"
    )
    if gap.get("index_gap"):
        print(
            f"  ⚠ Индекс неполный (~{gap['index_gap']} кодов не найдены в списках). "
            f"Сначала добиваем индекс полным обходом 1–405, затем карточки."
        )
    if gap["extra_in_db"]:
        print(
            f"  В БД есть, в индексе сайта нет: {len(gap['extra_in_db'])} "
            f"(устаревшие коды или неполный индекс)"
        )
    if gap["site_count"] < EXPECTED_SITE_COUNT * 0.98:
        print(
            f"  ⚠ Индекс меньше ожидаемых ~{EXPECTED_SITE_COUNT}: "
            f"перезапустите скрипт ещё раз (кэш накопительный)."
        )

    report_dir = os.path.join(os.path.dirname(_LINKS_CACHE_PATH))
    os.makedirs(report_dir, exist_ok=True)
    if not report_path:
        report_path = os.path.join(report_dir, "missing_qualifications_report.json")
    report_txt = os.path.splitext(report_path)[0] + ".txt"

    report = {
        "expected_site_count": EXPECTED_SITE_COUNT,
        "site_count": gap["site_count"],
        "index_gap": gap.get("index_gap", 0),
        "db_count": gap["db_count"],
        "missing_count": gap["missing_count"],
        "missing_codes": gap["missing_codes"],
        "extra_in_db": gap["extra_in_db"],
        "processed": [],
        "failed": [],
    }

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    with open(report_txt, "w", encoding="utf-8") as f:
        f.write(
            f"Ожидается: {EXPECTED_SITE_COUNT}\n"
            f"Индекс: {gap['site_count']}, дыра в индексе: {gap.get('index_gap', 0)}\n"
            f"БД: {gap['db_count']}, не хватает в БД: {gap['missing_count']}\n\n"
        )
        for code in gap["missing_codes"]:
            f.write(f"{code}\t{BASE_URL}/pk/detail/{code}/\n")
    print(f"  Отчёт: {report_path}")
    print(f"  Список: {report_txt}")

    links = gap["missing_links"]
    if not links:
        print("Нечего загружать (все коды из индекса уже в БД).")
        if gap.get("index_gap"):
            print(
                f"  Но индекс неполный (~{gap['index_gap']} кодов) — "
                f"перезапустите скрипт для повторного обхода списков."
            )
        report["local_count"] = get_qualification_stats()["local_count"]
        report["index_gap"] = gap.get("index_gap", 0)
        return report

    processed: List[str] = []
    failed: List[dict] = []
    db_session = SessionLocal() if save else None

    print(f"\nЗагрузка {len(links)} карточек по прямым URL...")
    try:
        for idx, link in enumerate(links, 1):
            if idx == 1 or idx % 25 == 0 or idx == len(links):
                print(f"  [{idx}/{len(links)}] {link['code']}")
            detail = parse_qualification_detail(link["url"], http)
            if not detail:
                failed.append({"code": link["code"], "error": "пустой ответ", "url": link["url"]})
                continue
            if not detail.get("name"):
                detail["name"] = link.get("name") or link["code"]
            if save and db_session:
                save_qualification_to_db(detail, db_session)
                if idx % 25 == 0:
                    db_session.commit()
            processed.append(link["code"])
            time.sleep(delay)
        if save and db_session:
            db_session.commit()
    finally:
        if db_session:
            db_session.close()

    if save and processed:
        relink_session = SessionLocal()
        try:
            from .qualification_links import relink_all_qualifications

            link_result = relink_all_qualifications(relink_session, update_existing=True, commit=True)
            print(
                f"\nСвязано квалификаций с ПС: {link_result.linked} "
                f"(не найдено ПС: {link_result.not_found})"
            )
        finally:
            relink_session.close()

    stats = get_qualification_stats()
    report["processed"] = processed
    report["failed"] = failed
    report["local_count"] = stats["local_count"]
    report["db_count_after"] = stats["local_count"]
    report["index_gap"] = gap.get("index_gap", 0)
    report["still_missing"] = sorted(set(gap["missing_codes"]) - set(processed))

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(
        f"Скачано: {len(processed)}, ошибок: {len(failed)}, "
        f"в БД: {stats['local_count']}, ещё нет: {len(report['still_missing'])}"
    )
    print("=" * 60)
    return report


def get_all_qualification_links(session: Optional[requests.Session] = None) -> List[Dict[str, str]]:
    session = session or _session()
    all_links = _load_links_cache()
    if all_links:
        print(f"  Кэш ссылок загружен: {len(all_links)}")

    print("  Определение числа страниц...")
    first_html = _fetch_html(session, get_list_page_url(1), retries=5)
    if not first_html:
        if all_links:
            print("  ⚠ Сайт недоступен — используем только кэш ссылок")
            return list(all_links.values())
        raise RuntimeError("Не удалось загрузить первую страницу реестра квалификаций")

    parsed_pages = parse_total_pages(first_html)
    total_pages = max(parsed_pages, SITE_TOTAL_PAGES)
    print(f"  Будет обойдено страниц: {total_pages} (в HTML: {parsed_pages})")

    empty_pages: List[int] = []

    for page in range(1, total_pages + 1):
        if page == 1:
            links = parse_qualification_links_from_html(first_html)
            if not links:
                links = fetch_list_page_links(session, 1, retries=8)
        else:
            links = fetch_list_page_links(session, page)

        if links:
            for link in links:
                all_links.setdefault(link["code"], link)
        else:
            empty_pages.append(page)
            if page <= 5 or page > total_pages - 5 or page % 50 == 0:
                print(f"  ⚠ Страница {page}: пусто после повторов")

        if page == 1 or page % 25 == 0 or page == total_pages:
            print(
                f"  Страница {page}/{total_pages}, "
                f"на странице: {len(links)}, уникальных кодов: {len(all_links)}"
            )

        time.sleep(PAGE_DELAY_SEC)

    for round_idx in range(1, EMPTY_PAGE_ROUNDS + 1):
        if not empty_pages:
            break
        if len(all_links) >= EXPECTED_SITE_COUNT:
            break

        print(
            f"  Дозагрузка пустых страниц, раунд {round_idx}/{EMPTY_PAGE_ROUNDS}: "
            f"{len(empty_pages)} стр., собрано {len(all_links)}/{EXPECTED_SITE_COUNT}"
        )
        still_empty: List[int] = []
        for page in empty_pages:
            links = fetch_list_page_links(session, page, retries=10)
            if links:
                for link in links:
                    all_links.setdefault(link["code"], link)
            else:
                still_empty.append(page)
            time.sleep(PAGE_DELAY_SEC + 0.2 * round_idx)
        empty_pages = still_empty
        _save_links_cache(all_links)

    # Если всё ещё мало — пробуем страницы за пределами «официальных» 405
    if len(all_links) < EXPECTED_SITE_COUNT * 0.98:
        extra_start = total_pages + 1
        extra_end = min(MAX_LIST_PAGES, total_pages + 30)
        print(f"  Доп. страницы {extra_start}–{extra_end}...")
        for page in range(extra_start, extra_end + 1):
            links = fetch_list_page_links(session, page, retries=5)
            if not links:
                continue
            before = len(all_links)
            for link in links:
                all_links.setdefault(link["code"], link)
            print(f"    страница {page}: +{len(all_links) - before}, всего {len(all_links)}")
            time.sleep(PAGE_DELAY_SEC)

    _save_links_cache(all_links)
    print(f"  Итого собрано ссылок: {len(all_links)} (ожидается ~{EXPECTED_SITE_COUNT})")
    missing = EXPECTED_SITE_COUNT - len(all_links)
    if missing > 0:
        print(
            f"  ⚠ Не хватает ~{missing} ссылок. "
            f"Запустите ещё раз --only-missing (кэш накопительный)."
        )
    return list(all_links.values())


def parse_qualification_detail_html(html: str, url: str) -> Optional[dict]:
    soup = BeautifulSoup(html, "html.parser")

    result = {
        "code": url.rstrip("/").split("/")[-1],
        "name": "",
        "level": "",
        "labor_functions": [],
        "activity_area": "",
        "prof_standard_name": "",
        "prof_standard_order": "",
        "qualification_requirement": "",
        "possible_job_titles": [],
        "special_admission": [],
        "exam_documents": [],
        "certificate_validity": "",
        "okz_codes": [],
        "okpdtr_codes": [],
        "okso_codes": [],
        "council_protocol": "",
        "nark_order": "",
        "raw_data": "",
    }

    code_span = soup.find("span", class_="item-detail__tabs-content-header")
    if code_span:
        code_text = code_span.get_text(strip=True)
        if code_text:
            result["code"] = code_text

    rows = soup.find_all("div", class_="task__row")
    for row in rows:
        title_elem = row.find("h3", class_="task__cell-title")
        if not title_elem:
            continue
        title = title_elem.get_text(strip=True)
        content_elem = row.find("p", class_="task__cell-item")
        if not content_elem:
            content_elem = row.find("div", class_="task__cell-content")
        text = content_elem.get_text(separator=" ", strip=True) if content_elem else ""
        title_lower = title.lower()

        if "наименование квалификации" in title_lower:
            result["name"] = text
        elif "уровень квалификации" in title_lower:
            result["level"] = text
        elif "трудовые функции" in title_lower:
            tf_blocks = row.find_all("div", class_="task__cell-item")
            for block in tf_blocks:
                header = block.find("div", class_="task__cell-item-tf-header")
                if header:
                    num = header.find("div", class_="task__cell-item-tf-header-num")
                    code_elem = header.find("div", class_="task__cell-item-tf-header-code")
                    name_elem = header.find("div", class_="task__cell-item-tf-header-name")
                    if code_elem and name_elem:
                        result["labor_functions"].append(
                            {
                                "number": num.get_text(strip=True) if num else "",
                                "code": code_elem.get_text(strip=True),
                                "name": name_elem.get_text(strip=True),
                            }
                        )
            if not result["labor_functions"]:
                for item in row.find_all("p", class_="task__cell-item"):
                    text_item = item.get_text(strip=True)
                    match = re.match(r"(\d+)\s*\.\s*([A-Z]/\d+\.\d+)\s*(.+)", text_item)
                    if match:
                        result["labor_functions"].append(
                            {
                                "number": match.group(1),
                                "code": match.group(2),
                                "name": match.group(3).strip(),
                            }
                        )
        elif "вид профессиональной деятельности" in title_lower:
            result["activity_area"] = text
        elif "наименование профессионального стандарта" in title_lower:
            result["prof_standard_name"] = text
        elif "реквизиты профессионального стандарта" in title_lower:
            result["prof_standard_order"] = text
        elif "квалификационное требование" in title_lower:
            result["qualification_requirement"] = text
        elif "возможные наименования должностей" in title_lower:
            if text and text != "-":
                result["possible_job_titles"] = [
                    t.strip() for t in re.split(r"[,;]\s*", text) if t.strip()
                ]
        elif "особые условия допуска" in title_lower:
            if text and text != "-":
                result["special_admission"] = [
                    t.strip()
                    for t in re.split(r"\d+\.\s*", text)
                    if t.strip() and len(t.strip()) > 2
                ]
        elif "перечень документов для прохождения профессионального экзамена" in title_lower:
            if text and text != "-":
                result["exam_documents"] = [
                    t.strip()
                    for t in re.split(r"\d+\.\s*", text)
                    if t.strip() and len(t.strip()) > 2
                ]
        elif "срок действия свидетельства" in title_lower:
            result["certificate_validity"] = text
        elif "реквизиты протокола" in title_lower:
            result["council_protocol"] = text
        elif "реквизиты приказа" in title_lower and "нарк" in title_lower:
            result["nark_order"] = text

    if not result["name"]:
        h1 = soup.find("h1")
        if h1:
            result["name"] = h1.get_text(strip=True)

    return result if result["name"] or result["code"] else None


def parse_qualification_detail(url: str, session: Optional[requests.Session] = None) -> Optional[dict]:
    session = session or _session()
    html = _fetch_html(session, url)
    if not html:
        return None
    return parse_qualification_detail_html(html, url)


def save_qualification_to_db(qualification_data: dict, session=None, *, auto_link: bool = True) -> None:
    if not qualification_data:
        return
    own_session = session is None
    if own_session:
        session = SessionLocal()
    try:
        existing = (
            session.query(Qualification)
            .filter(Qualification.code == qualification_data["code"])
            .first()
        )
        if existing:
            for key, value in qualification_data.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            record = existing
        else:
            record = Qualification(**qualification_data)
            session.add(record)
        if auto_link:
            if own_session:
                session.flush()
            from .qualification_links import StandardLookup, link_qualification_record

            lookup = StandardLookup(session)
            link_qualification_record(record, lookup, update_existing=True)
        if own_session:
            session.commit()
    except Exception as e:
        if own_session:
            session.rollback()
        raise RuntimeError(
            f"Ошибка сохранения квалификации {qualification_data.get('code')}: {e}"
        ) from e
    finally:
        if own_session:
            session.close()


def get_qualification_stats() -> dict:
    from .qualification_links import (
        ps_code_from_qualification_code,
        standards_qualification_coverage,
    )

    session = SessionLocal()
    try:
        local = session.query(Qualification).count()
        coverage = standards_qualification_coverage(session)
        quals = session.query(
            Qualification.id,
            Qualification.code,
            Qualification.prof_standard_id,
            Qualification.prof_standard_name,
        ).all()
    finally:
        session.close()

    xlsx_codes = _load_xlsx_ps_codes()
    without_ps = 0
    linked_to_ps = 0
    revoked = 0
    for _id, code, ps_id, ps_name in quals:
        code_s = code or ""
        without = is_qualification_without_ps(code_s, ps_name)
        if without:
            without_ps += 1
        elif ps_id is not None:
            linked_to_ps += 1
        expected = ps_code_from_qualification_code(code_s)
        if (not without) and expected and expected not in xlsx_codes:
            revoked += 1

    return {
        "local_count": local,
        "expected": EXPECTED_SITE_COUNT,
        "index_count": len(_load_links_cache()),
        "missing": max(0, EXPECTED_SITE_COUNT - local),
        "total": local,
        **coverage,
        "linked_to_ps": linked_to_ps,
        "without_ps": without_ps,
        "revoked": revoked,
        "xlsx_ps_codes": sorted(xlsx_codes),
    }


def is_qualification_without_ps(code: str | None, prof_standard_name: str | None = None) -> bool:
    """
    Маркер «без ПС»:
    — в коде после первой точки есть 00000 (напр. 27.00000.01);
    — или название ПС начинается с «Нет связанного профессионального стандарта».
    """
    code_s = (code or "").strip()
    if code_s and "." in code_s and "00000" in code_s.split(".", 1)[1]:
        return True
    name = (prof_standard_name or "").strip().lower().replace("ё", "е")
    return name.startswith("нет связанного профессионального стандарта")


def _is_without_ps_code(code: str) -> bool:
    """Обратная совместимость: только проверка кода."""
    return is_qualification_without_ps(code, None)


_xlsx_ps_codes_cache: set[str] | None = None


def _load_xlsx_ps_codes() -> set[str]:
    """Коды ПС из официального Excel-реестра (кэш на процесс)."""
    global _xlsx_ps_codes_cache
    if _xlsx_ps_codes_cache is not None:
        return _xlsx_ps_codes_cache

    codes: set[str] = set()
    try:
        import sys

        scripts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")
        if scripts_dir not in sys.path:
            sys.path.insert(0, scripts_dir)
        from compare_ps_with_xlsx import collect_xlsx_ps_codes

        codes = collect_xlsx_ps_codes(None)
    except Exception as exc:
        print(f"Не удалось загрузить коды ПС из XLSX для статистики: {exc}")

    _xlsx_ps_codes_cache = codes
    return codes


def fetch_all_qualifications(
    save: bool = True,
    only_missing: bool = False,
    delay: float = 0.15,
) -> dict:
    """
    only_missing=True — загружать только коды, которых ещё нет в БД.
    """
    print("=" * 60)
    print("Сбор квалификаций с сайта НАРК")
    print("=" * 60)

    http = _session()
    discover_links_by_filters(http, merge_cache=True)
    cached = _load_links_cache()
    links = list(cached.values())
    site_total = len(links)
    print(f"\nНайдено в индексе: {site_total} (ожидается ~{EXPECTED_SITE_COUNT})")

    existing_codes: set[str] = set()
    if only_missing:
        session = SessionLocal()
        try:
            existing_codes = {r[0] for r in session.query(Qualification.code).all() if r[0]}
        finally:
            session.close()
        links = [l for l in links if l["code"] not in existing_codes]
        print(f"Уже в БД: {len(existing_codes)}, к загрузке: {len(links)}")

    if not links:
        stats = get_qualification_stats()
        print("Нечего загружать.")
        return {"site_count": site_total, "processed": 0, "failed": [], **stats}

    processed: List[str] = []
    failed: List[dict] = []
    db_session = SessionLocal() if save else None

    print("\nПарсинг карточек квалификаций...")
    try:
        for idx, link in enumerate(links, 1):
            if idx == 1 or idx % 50 == 0 or idx == len(links):
                print(f"  [{idx}/{len(links)}] {link['code']}")
            detail = parse_qualification_detail(link["url"], http)
            if not detail:
                failed.append({"code": link["code"], "error": "пустой ответ"})
                continue
            if not detail.get("name"):
                detail["name"] = link.get("name") or link["code"]
            if save and db_session:
                save_qualification_to_db(detail, db_session, auto_link=False)
                if idx % 25 == 0:
                    db_session.commit()
            processed.append(link["code"])
            time.sleep(delay)
        if save and db_session:
            db_session.commit()
    finally:
        if db_session:
            db_session.close()

    if save:
        relink_session = SessionLocal()
        try:
            from .qualification_links import relink_all_qualifications

            link_result = relink_all_qualifications(relink_session, update_existing=True, commit=True)
            print(
                f"\nСвязано квалификаций с ПС: {link_result.linked} "
                f"(не найдено ПС: {link_result.not_found})"
            )
        finally:
            relink_session.close()

    stats = get_qualification_stats()
    gap = max(0, EXPECTED_SITE_COUNT - stats["local_count"])
    index_gap = max(0, EXPECTED_SITE_COUNT - site_total)
    print("\n" + "=" * 60)
    print(
        f"Обработано: {len(processed)}, ошибок: {len(failed)}, "
        f"в БД: {stats['local_count']}, индекс: {site_total}"
    )
    if index_gap:
        print(f"Индекс неполный: ~{index_gap} — run-fetch-missing-qualifications.bat")
    if gap:
        print(f"До ожидаемых ~{EXPECTED_SITE_COUNT} в БД не хватает: {gap}")
        print("Повторите: venv\\Scripts\\python.exe scripts\\fetch_missing_qualifications.py")
    print("=" * 60)
    return {
        "site_count": site_total,
        "processed": processed,
        "failed": failed,
        "expected_site_count": EXPECTED_SITE_COUNT,
        "missing_vs_expected": gap,
        **stats,
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Загрузка квалификаций с nok-nark.ru")
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="Загрузить только отсутствующие в БД",
    )
    parser.add_argument(
        "--links-only",
        action="store_true",
        help="Только собрать ссылки, без карточек",
    )
    parser.add_argument(
        "--by-filters",
        action="store_true",
        help="Собрать ссылки через фильтры ОПД/СПК (обход пустых page>375)",
    )
    args = parser.parse_args()

    if args.by_filters:
        links = discover_links_by_filters()
        print(f"Ссылок: {len(links)}")
    elif args.links_only:
        links = get_all_qualification_links()
        print(f"Ссылок: {len(links)}")
    else:
        fetch_all_qualifications(save=True, only_missing=args.only_missing)
