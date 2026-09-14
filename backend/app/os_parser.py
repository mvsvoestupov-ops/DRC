"""
Парсер оценочных средств НАРК (nok-nark.ru/os/).

Код ОС = код квалификации + трёхзначный суффикс: 01.00100.01.001, 40.20900.100.001.
На сайте ~2227 карточек на 223 страницах (по 10; последняя — 7).
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
from sqlalchemy.exc import OperationalError

from .db import SessionLocal
from .db.assessment_tools_models import AssessmentTool
from .db.qualifications_models import Qualification
from .progress import assessment_tools_fetch_progress

BASE_URL = "https://nok-nark.ru"
LIST_URL = "/os/list/"
MAX_LIST_PAGES = 400
SITE_TOTAL_PAGES = 223
EXPECTED_SITE_COUNT = 2227  # 222×10 + 7 на последней странице
OS_CODE_TOKEN = r"\d{2}\.\d{5}\.\d{2,4}\.\d{3}"
OS_CODE_PATTERN = re.compile(rf"\b({OS_CODE_TOKEN})\b")
OS_CODE_EXACT = re.compile(rf"^{OS_CODE_TOKEN}$")
QUAL_FROM_OS = re.compile(rf"^({r'\d{2}\.\d{5}\.\d{2,4}'})\.\d{{3}}$")
PAGE_DELAY_SEC = 0.35

_LINKS_CACHE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "scripts",
    "output",
    "nark_os_links.json",
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ru-RU,ru;q=0.9",
}

_MODEL_FIELDS = {
    "code",
    "name",
    "qualification_code",
    "qualification_id",
    "spk_name",
    "prof_standard_name",
    "prof_standard_order",
    "activity_area",
    "qualification_label",
    "material_support",
    "staffing",
    "sample_tasks_url",
    "pmk_sample_tasks_url",
    "document_type",
    "document_number",
    "document_date",
    "source_url",
    "raw_data",
}


def qualification_code_from_os(code: str | None) -> str:
    text = (code or "").strip()
    match = QUAL_FROM_OS.match(text)
    return match.group(1) if match else ""


OS_REVISION_RE = re.compile(r"^(.+)\.(\d{3})$")
STATUS_ACTIVE = "active"
STATUS_INACTIVE = "inactive"


def os_revision_parts(code: str | None) -> tuple[str, int] | tuple[None, None]:
    """16.12700.03.002 → ('16.12700.03', 2)."""
    text = (code or "").strip()
    match = OS_REVISION_RE.match(text)
    if not match:
        return None, None
    return match.group(1), int(match.group(2))


def sync_assessment_tool_revision_status(session=None) -> dict:
    """
    В группе xx.yyyyy.zz.* активна только максимальная ревизия (.003 > .002 > .001).
    Предыдущие получают status=inactive.
    """
    own = session is None
    if own:
        session = SessionLocal()
    try:
        tools = session.query(AssessmentTool).all()
        groups: dict[str, list[AssessmentTool]] = {}
        singles: list[AssessmentTool] = []
        for tool in tools:
            base, rev = os_revision_parts(tool.code)
            # Предпочитаем qualification_code как ключ группы, иначе базу из кода ОС
            group_key = (tool.qualification_code or "").strip() or (base or "")
            if not group_key or rev is None:
                singles.append(tool)
                continue
            groups.setdefault(group_key, []).append(tool)

        activated = 0
        deactivated = 0
        for group_tools in groups.values():
            best_rev = -1
            best_tool: AssessmentTool | None = None
            for tool in group_tools:
                _base, rev = os_revision_parts(tool.code)
                rev_n = rev if rev is not None else -1
                if rev_n > best_rev:
                    best_rev = rev_n
                    best_tool = tool
            for tool in group_tools:
                if tool is best_tool:
                    if (tool.status or STATUS_ACTIVE) != STATUS_ACTIVE:
                        tool.status = STATUS_ACTIVE
                        activated += 1
                    else:
                        tool.status = STATUS_ACTIVE
                else:
                    if (tool.status or STATUS_ACTIVE) != STATUS_INACTIVE:
                        tool.status = STATUS_INACTIVE
                        deactivated += 1
                    else:
                        tool.status = STATUS_INACTIVE

        for tool in singles:
            if not (tool.status or "").strip():
                tool.status = STATUS_ACTIVE

        session.commit()
        return {
            "groups": len(groups),
            "activated": activated,
            "deactivated": deactivated,
            "singles": len(singles),
            "total": len(tools),
        }
    except Exception:
        session.rollback()
        raise
    finally:
        if own:
            session.close()


QUAL_CODE_IN_TEXT = re.compile(r"\d{2}\.\d{5}\.\d{2,4}")


def _expand_104_aliases(code: str) -> list[str]:
    if not code:
        return []
    aliases = [code]
    if code.startswith("10.104"):
        aliases = ["40.104" + code[6:], code]
    elif code.startswith("40.104"):
        aliases = [code, "10.104" + code[6:]]
    return aliases


def _codes_from_text(*texts: str) -> list[str]:
    found: list[str] = []
    for text in texts:
        if not text:
            continue
        for match in QUAL_CODE_IN_TEXT.findall(text):
            if match not in found:
                found.append(match)
    return found


def _candidate_qualification_codes(
    qcode: str,
    *extra_texts: str,
    os_code: str | None = None,
) -> list[str]:
    """Коды квалификации для поиска в БД (включая 10.104 → 40.104 и код из названия ОС)."""
    raw: list[str] = []

    def _add_raw(code: str) -> None:
        if code and code not in raw:
            raw.append(code)

    _add_raw(qcode)
    _add_raw(qualification_code_from_os(os_code))
    for code in _codes_from_text(*extra_texts):
        _add_raw(code)

    out: list[str] = []
    for code in raw:
        for alias in _expand_104_aliases(code):
            if alias not in out:
                out.append(alias)
    return out


def _normalize_qual_name(value: str | None) -> str:
    text = QUAL_CODE_IN_TEXT.sub(" ", value or "")
    text = text.split(" - ")[0]
    text = text.lower().replace("ё", "е")
    text = re.sub(r"[^a-zа-я0-9]+", " ", text, flags=re.IGNORECASE)
    return text.strip()


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


def _set_progress(**kwargs) -> None:
    assessment_tools_fetch_progress.update(kwargs)


def parse_list_total_pages(html: str) -> int:
    soup = BeautifulSoup(html, "html.parser")
    goto = soup.select_one(".pagination__goto")
    if goto:
        text = goto.get_text(" ", strip=True)
        m = re.search(r"(\d+)\s*из\s*(\d+)", text, flags=re.IGNORECASE)
        if m:
            total = int(m.group(2))
            if total >= 1:
                return total

    page_of = re.search(r"(\d+)\s*из\s*(\d+)", html, flags=re.IGNORECASE)
    if page_of:
        current, total = int(page_of.group(1)), int(page_of.group(2))
        if total >= current >= 1:
            return total

    totals = [int(n) for n in re.findall(r"из\s*(\d+)", html, flags=re.IGNORECASE)]
    significant = [t for t in totals if t >= 20]
    if significant:
        return max(significant)
    return SITE_TOTAL_PAGES


def get_list_page_url(page: int) -> str:
    query = urlencode({"page": page, "sort[by]": "CODE", "sort[order]": "asc"})
    return f"{BASE_URL}{LIST_URL}?{query}"


def _card_fields(card) -> dict:
    text = card.get_text("\n", strip=True) if card else ""
    result = {"name": "", "activity_area": "", "spk_name": ""}

    def _line_after(label: str) -> str:
        m = re.search(rf"{re.escape(label)}\s*[:：]?\s*(.+)", text, flags=re.IGNORECASE)
        if not m:
            return ""
        return m.group(1).strip().split("\n")[0].strip()

    result["name"] = _line_after("Профессиональная квалификация")
    result["activity_area"] = _line_after("Вид профессиональной деятельности")
    result["spk_name"] = _line_after("Совет по профессиональным квалификациям")
    return result


def parse_os_links_from_html(html: str) -> List[Dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    items: Dict[str, Dict[str, str]] = {}

    for link in soup.find_all("a", href=True):
        href = link["href"]
        if "/os/detail/" not in href:
            continue
        if href.startswith("/"):
            url = f"{BASE_URL}{href}"
        elif href.startswith("http"):
            url = href
        else:
            url = f"{BASE_URL}/{href.lstrip('/')}"

        code = url.rstrip("/").split("/")[-1]
        if not OS_CODE_EXACT.fullmatch(code):
            continue

        card = link.find_parent(["div", "li", "article"])
        extra = _card_fields(card)
        name = extra.get("name") or ""
        if not name or name.lower() in ("подробнее", "detail"):
            name = link.get_text(" ", strip=True)
        if name.lower() in ("подробнее", "detail", code.lower()):
            name = extra.get("name") or code
        name = re.sub(r"\s*подробнее\s*$", "", name, flags=re.IGNORECASE).strip()
        name = re.sub(rf"\s*{re.escape(code)}\s*$", "", name).strip() or code

        items[code] = {
            "code": code,
            "name": name,
            "url": url.split("?")[0].rstrip("/") + "/",
            "activity_area": extra.get("activity_area") or "",
            "spk_name": extra.get("spk_name") or "",
            "qualification_code": qualification_code_from_os(code),
        }

    for code in OS_CODE_PATTERN.findall(html):
        items.setdefault(
            code,
            {
                "code": code,
                "name": code,
                "url": f"{BASE_URL}/os/detail/{code}/",
                "activity_area": "",
                "spk_name": "",
                "qualification_code": qualification_code_from_os(code),
            },
        )

    return list(items.values())


def fetch_list_page_links(session: requests.Session, page: int, retries: int = 5) -> List[Dict[str, str]]:
    url = get_list_page_url(page)
    for attempt in range(retries):
        html = _fetch_html(session, url, retries=2)
        if not html:
            time.sleep(2.0 * (attempt + 1))
            continue
        links = parse_os_links_from_html(html)
        if links:
            return links
        lower = html.lower()
        if "не найден" in lower and "оцен" in lower:
            return []
        time.sleep(2.0 * (attempt + 1))
    return []


def _load_links_cache() -> Dict[str, Dict[str, str]]:
    if not os.path.isfile(_LINKS_CACHE_PATH):
        return {}
    try:
        with open(_LINKS_CACHE_PATH, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if isinstance(v, dict) and v.get("code")}
        if isinstance(data, list):
            return {item["code"]: item for item in data if item.get("code")}
    except Exception as exc:
        print(f"Не удалось прочитать кэш ОС: {exc}")
    return {}


def _save_links_cache(items: Dict[str, Dict[str, str]]) -> None:
    os.makedirs(os.path.dirname(_LINKS_CACHE_PATH), exist_ok=True)
    with open(_LINKS_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def _commit_with_retry(session, attempts: int = 8) -> None:
    for attempt in range(attempts):
        try:
            session.commit()
            return
        except OperationalError as exc:
            if "locked" not in str(exc).lower() and "busy" not in str(exc).lower():
                raise
            print(f"    SQLite busy, повтор коммита {attempt + 1}/{attempts}")
            time.sleep(0.6 * (attempt + 1))
    session.commit()


def crawl_os_list(
    session: Optional[requests.Session] = None,
    *,
    merge_cache: bool = True,
    skip_if_complete: bool = False,
) -> Dict[str, Dict[str, str]]:
    items: Dict[str, Dict[str, str]] = _load_links_cache() if merge_cache else {}
    if skip_if_complete and len(items) >= EXPECTED_SITE_COUNT:
        print(f"Индекс ОС из кэша: {len(items)}")
        return items
    http = session or _session()

    first_url = get_list_page_url(1)
    first_html = _fetch_html(http, first_url)
    if not first_html:
        print("Не удалось загрузить первую страницу списка ОС")
        return items

    total_pages = min(parse_list_total_pages(first_html) or SITE_TOTAL_PAGES, MAX_LIST_PAGES)
    for link in parse_os_links_from_html(first_html):
        items[link["code"]] = link
    print(f"ОС: страниц {total_pages}, после стр. 1: {len(items)}")
    _set_progress(message=f"Сбор ссылок ОС: страница 1/{total_pages}", site_count=len(items))

    for page in range(2, total_pages + 1):
        links = fetch_list_page_links(http, page)
        for link in links:
            items[link["code"]] = link
        if page % 20 == 0 or page == total_pages:
            print(f"  ОС список [{page}/{total_pages}] уникальных: {len(items)}")
            _set_progress(
                message=f"Сбор ссылок ОС: страница {page}/{total_pages}",
                site_count=len(items),
            )
        time.sleep(PAGE_DELAY_SEC)

    _save_links_cache(items)
    print(f"Индекс ОС: {len(items)} (ожидается ~{EXPECTED_SITE_COUNT})")
    return items


def _cell_text(content_elem, *, multiline: bool = False) -> str:
    if not content_elem:
        return ""
    sep = "\n" if multiline else " "
    return content_elem.get_text(separator=sep, strip=True)


def _cell_link_or_text(content_elem) -> str:
    if not content_elem:
        return ""
    a = content_elem.find("a", href=True)
    if a:
        href = (a.get("href") or "").strip()
        text = a.get_text(strip=True)
        if href.startswith("http"):
            return href
        return text or href
    return _cell_text(content_elem)


def parse_os_detail_html(html: str, url: str, list_meta: Optional[dict] = None) -> Optional[dict]:
    soup = BeautifulSoup(html, "html.parser")
    code = url.rstrip("/").split("/")[-1]
    meta = list_meta or {}

    result = {
        "code": code,
        "name": "",
        "qualification_code": qualification_code_from_os(code),
        "spk_name": meta.get("spk_name") or "",
        "prof_standard_name": "",
        "prof_standard_order": "",
        "activity_area": meta.get("activity_area") or "",
        "qualification_label": "",
        "material_support": "",
        "staffing": "",
        "sample_tasks_url": "",
        "pmk_sample_tasks_url": "",
        "document_type": "",
        "document_number": "",
        "document_date": "",
        "source_url": url.rstrip("/") + "/",
        "raw_data": {},
    }

    h1 = soup.find("h1")
    if h1:
        result["name"] = h1.get_text(" ", strip=True)

    code_span = soup.find("span", class_="item-detail__tabs-content-header")
    if code_span:
        code_text = code_span.get_text(strip=True)
        if OS_CODE_EXACT.fullmatch(code_text):
            result["code"] = code_text
            result["qualification_code"] = qualification_code_from_os(code_text)

    for row in soup.find_all("div", class_="task__row"):
        title_elem = row.find("h3", class_="task__cell-title")
        if not title_elem:
            continue
        title = title_elem.get_text(strip=True)
        content_elem = row.find("p", class_="task__cell-item")
        if not content_elem:
            content_elem = row.find("div", class_="task__cell-content")
        text = _cell_text(content_elem)
        title_lower = title.lower()

        if "совет по профессиональным квалификациям" in title_lower:
            result["spk_name"] = text
        elif title_lower.startswith("профессиональный стандарт"):
            result["prof_standard_name"] = text
        elif "реквизиты профессионального стандарта" in title_lower:
            result["prof_standard_order"] = text
        elif "профессиональная квалификация" in title_lower:
            result["qualification_label"] = text
        elif "материально-техническом обеспечении" in title_lower:
            result["material_support"] = _cell_text(content_elem, multiline=True)
        elif "кадровом обеспечении" in title_lower:
            result["staffing"] = _cell_text(content_elem, multiline=True)
        elif "пмк" in title_lower and "примеров заданий" in title_lower:
            result["pmk_sample_tasks_url"] = _cell_link_or_text(content_elem)
        elif "примеров заданий" in title_lower:
            result["sample_tasks_url"] = _cell_link_or_text(content_elem)
        elif "тип документа" in title_lower:
            result["document_type"] = text
        elif title_lower in ("номер", "номер:"):
            result["document_number"] = text
        elif title_lower in ("дата", "дата:"):
            result["document_date"] = text

    if not result["name"]:
        label = result["qualification_label"]
        qcode = result["qualification_code"]
        if label:
            cleaned = re.sub(rf"^{re.escape(qcode)}\.?\s*", "", label).strip()
            result["name"] = cleaned or meta.get("name") or result["code"]
        else:
            result["name"] = meta.get("name") or result["code"]

    result["raw_data"] = {
        "list_name": meta.get("name") or "",
        "qualification_label": result["qualification_label"],
    }
    return result


def parse_os_detail(url: str, session: Optional[requests.Session] = None, list_meta: Optional[dict] = None) -> Optional[dict]:
    http = session or _session()
    html = _fetch_html(http, url)
    if not html:
        return None
    return parse_os_detail_html(html, url, list_meta)


def _qualification_lookups(session) -> tuple[Dict[str, int], Dict[str, int], Dict[int, str]]:
    rows = session.query(Qualification.id, Qualification.code, Qualification.name).all()
    by_code: Dict[str, int] = {}
    by_name: Dict[str, int] = {}
    id_to_code: Dict[int, str] = {}
    for qid, code, name in rows:
        if code:
            by_code[code] = qid
        id_to_code[qid] = code or ""
        key = _normalize_qual_name(name)
        if key:
            by_name.setdefault(key, qid)
    return by_code, by_name, id_to_code


def _resolve_qualification(
    *,
    os_code: str | None,
    qcode: str | None,
    name: str | None,
    qualification_label: str | None,
    by_code: Dict[str, int],
    by_name: Dict[str, int],
    id_to_code: Dict[int, str],
) -> tuple[str, int | None]:
    candidates = _candidate_qualification_codes(
        qcode or "",
        qualification_label or "",
        name or "",
        os_code=os_code,
    )
    for candidate in candidates:
        qid = by_code.get(candidate)
        if qid:
            return id_to_code.get(qid) or candidate, qid
    key = _normalize_qual_name(qualification_label or name or "")
    if key:
        qid = by_name.get(key)
        if qid:
            return id_to_code.get(qid) or (qcode or ""), qid
    return qcode or qualification_code_from_os(os_code), None


def save_assessment_tool(data: dict, session, lookups=None) -> None:
    if not data or not data.get("code"):
        return
    payload = {k: v for k, v in data.items() if k in _MODEL_FIELDS}
    by_code, by_name, id_to_code = lookups or _qualification_lookups(session)
    resolved_code, qid = _resolve_qualification(
        os_code=payload.get("code"),
        qcode=payload.get("qualification_code") or qualification_code_from_os(payload.get("code")),
        name=payload.get("name"),
        qualification_label=payload.get("qualification_label"),
        by_code=by_code,
        by_name=by_name,
        id_to_code=id_to_code,
    )
    payload["qualification_code"] = resolved_code
    payload["qualification_id"] = qid

    existing = session.query(AssessmentTool).filter(AssessmentTool.code == payload["code"]).first()
    if existing:
        for key, value in payload.items():
            setattr(existing, key, value)
    else:
        session.add(AssessmentTool(**payload))


def link_assessment_tools_to_qualifications(session=None) -> dict:
    own = session is None
    if own:
        session = SessionLocal()
    try:
        by_code, by_name, id_to_code = _qualification_lookups(session)
        tools = session.query(AssessmentTool).all()
        linked = 0
        unlinked = 0
        unlinked_items: list[dict] = []
        for tool in tools:
            resolved_code, qid = _resolve_qualification(
                os_code=tool.code,
                qcode=tool.qualification_code or qualification_code_from_os(tool.code),
                name=tool.name,
                qualification_label=tool.qualification_label,
                by_code=by_code,
                by_name=by_name,
                id_to_code=id_to_code,
            )
            if resolved_code:
                tool.qualification_code = resolved_code
            if qid:
                tool.qualification_id = qid
                linked += 1
            else:
                tool.qualification_id = None
                unlinked += 1
                unlinked_items.append(
                    {
                        "code": tool.code,
                        "name": tool.name,
                        "qualification_code": tool.qualification_code,
                    }
                )
        session.commit()
        rev = sync_assessment_tool_revision_status(session)
        return {
            "linked": linked,
            "unlinked": unlinked,
            "total": len(tools),
            "unlinked_items": unlinked_items,
            "revisions": rev,
        }
    except Exception:
        session.rollback()
        raise
    finally:
        if own:
            session.close()


def get_assessment_tool_stats() -> dict:
    session = SessionLocal()
    try:
        local = session.query(AssessmentTool).count()
        active = (
            session.query(AssessmentTool)
            .filter((AssessmentTool.status == STATUS_ACTIVE) | (AssessmentTool.status.is_(None)))
            .count()
        )
        inactive = (
            session.query(AssessmentTool)
            .filter(AssessmentTool.status == STATUS_INACTIVE)
            .count()
        )
        linked = (
            session.query(AssessmentTool)
            .filter(AssessmentTool.qualification_id.isnot(None))
            .filter((AssessmentTool.status == STATUS_ACTIVE) | (AssessmentTool.status.is_(None)))
            .count()
        )
        quals_with_os = (
            session.query(AssessmentTool.qualification_id)
            .filter(AssessmentTool.qualification_id.isnot(None))
            .filter((AssessmentTool.status == STATUS_ACTIVE) | (AssessmentTool.status.is_(None)))
            .distinct()
            .count()
        )
    finally:
        session.close()

    index_count = len(_load_links_cache())
    expected = EXPECTED_SITE_COUNT
    return {
        "local_count": local,
        "active": active,
        "inactive": inactive,
        "expected": expected,
        "index_count": index_count,
        "missing": max(0, expected - local),
        "linked": linked,
        "unlinked": max(0, active - linked),
        "qualifications_with_os": quals_with_os,
        "total": local,
    }


def fetch_all_assessment_tools(
    save: bool = True,
    only_missing: bool = False,
    delay: float = 0.15,
    rediscover: bool = True,
) -> dict:
    print("=" * 60)
    print("Сбор оценочных средств с сайта НАРК")
    print("=" * 60)

    _set_progress(
        status="running",
        message="Сбор ссылок оценочных средств с nok-nark.ru...",
        processed=0,
        failed=0,
        site_count=0,
        linked=0,
    )

    http = _session()
    if rediscover:
        cached = crawl_os_list(http, merge_cache=True, skip_if_complete=only_missing)
    else:
        cached = _load_links_cache()
        if not cached:
            cached = crawl_os_list(http, merge_cache=False)

    links = list(cached.values())
    site_total = len(links)
    print(f"\nНайдено в индексе ОС: {site_total} (ожидается ~{EXPECTED_SITE_COUNT})")
    _set_progress(site_count=site_total, message=f"Индекс ОС: {site_total}. Загрузка карточек...")

    existing_codes: set[str] = set()
    if only_missing:
        session = SessionLocal()
        try:
            existing_codes = {r[0] for r in session.query(AssessmentTool.code).all() if r[0]}
        finally:
            session.close()
        links = [item for item in links if item["code"] not in existing_codes]
        print(f"Уже в БД: {len(existing_codes)}, к загрузке: {len(links)}")

    if not links:
        link_result = {"linked": 0, "unlinked": 0, "total": 0}
        if save:
            link_result = link_assessment_tools_to_qualifications()
            print(
                f"Связано ОС с квалификациями: {link_result['linked']} "
                f"(без квалификации: {link_result['unlinked']})"
            )
        stats = get_assessment_tool_stats()
        print("Нечего загружать.")
        return {"site_count": site_total, "processed": [], "failed": [], "link_result": link_result, **stats}

    processed: List[str] = []
    failed: List[dict] = []
    db_session = SessionLocal() if save else None
    lookups = _qualification_lookups(db_session) if db_session else None

    print("\nПарсинг карточек оценочных средств...")
    try:
        for idx, link in enumerate(links, 1):
            if idx == 1 or idx % 50 == 0 or idx == len(links):
                print(f"  [{idx}/{len(links)}] {link['code']}")
                _set_progress(
                    processed=len(processed),
                    failed=len(failed),
                    message=f"Карточки ОС: {idx}/{len(links)}",
                )
            detail = parse_os_detail(link["url"], http, list_meta=link)
            if not detail:
                failed.append({"code": link["code"], "error": "пустой ответ"})
                continue
            if not detail.get("name"):
                detail["name"] = link.get("name") or link["code"]
            if not detail.get("activity_area"):
                detail["activity_area"] = link.get("activity_area") or ""
            if not detail.get("spk_name"):
                detail["spk_name"] = link.get("spk_name") or ""
            if save and db_session:
                try:
                    save_assessment_tool(detail, db_session, lookups)
                    if idx % 25 == 0:
                        _commit_with_retry(db_session)
                except Exception as exc:
                    failed.append({"code": link["code"], "error": str(exc)})
                    try:
                        db_session.rollback()
                    except Exception:
                        pass
                    continue
            processed.append(link["code"])
            time.sleep(delay)
        if save and db_session:
            _commit_with_retry(db_session)
    finally:
        if db_session:
            db_session.close()

    link_result = {"linked": 0, "unlinked": 0, "total": 0}
    if save:
        link_result = link_assessment_tools_to_qualifications()
        print(
            f"\nСвязано ОС с квалификациями: {link_result['linked']} "
            f"(без квалификации: {link_result['unlinked']})"
        )

    stats = get_assessment_tool_stats()
    gap = max(0, EXPECTED_SITE_COUNT - stats["local_count"])
    print("\n" + "=" * 60)
    print(
        f"Обработано: {len(processed)}, ошибок: {len(failed)}, "
        f"в БД: {stats['local_count']}, индекс: {site_total}, "
        f"связано: {stats['linked']}"
    )
    if gap:
        print(f"До ожидаемых ~{EXPECTED_SITE_COUNT} не хватает: {gap}")
    print("=" * 60)
    return {
        "site_count": site_total,
        "processed": processed,
        "failed": failed,
        "expected_site_count": EXPECTED_SITE_COUNT,
        "missing_vs_expected": gap,
        "link_result": link_result,
        **stats,
    }
