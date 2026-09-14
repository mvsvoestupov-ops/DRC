"""Парсер ФГОС с classinform.ru (СПО, бакалавриат, магистратура и др.)."""
from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Optional
from urllib.parse import urljoin

import requests
import urllib3
from bs4 import BeautifulSoup

from .db import SessionLocal
from .db.fgos_models import FgosSpo
from .fgos_registry import FGOS_CATEGORIES, FGOS_CATEGORY_BY_ID, FGOS_CATEGORY_IDS

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://classinform.ru"
SPO_ROOT = BASE_URL + "/fgos/2-standarty-srednego-professionalnogo-obrazovaniia.html"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ru-RU,ru;q=0.9",
}

DETAIL_URL_RE = re.compile(
    r"/fgos/(?:\d{2}\.\d{2}\.\d{2}|\d{6}\.\d{2})(?:-[^/]+)?\.html$"
)
CODE_RE = re.compile(r"(?:\d{2}\.\d{2}\.\d{2}|\d{6}\.\d{2})")
GROUP_CODE_RE = re.compile(r"/fgos/(\d{2}\.\d{2}\.\d{2})-")

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts", "output")
LINKS_CACHE = os.path.join(OUTPUT_DIR, "fgos_spo_links.json")
DEFAULT_JSON = os.path.join(OUTPUT_DIR, "fgos_spo.json")

REQUEST_DELAY_SEC = 0.4

NON_SPO_CATEGORIES = [c["id"] for c in FGOS_CATEGORIES if c["id"] != "spo"]

DEFAULT_QUALIFICATION: dict[str, str] = {
    "bachelor": "бакалавр",
    "master": "магистр",
    "specialist": "специалист",
    "aspirantura": "исследователь, преподаватель-исследователь",
    "adjunct": "адъюнкт",
    "ordinatura": "врач",
}


def _industry_url_re(level: int) -> re.Pattern[str]:
    return re.compile(rf"/fgos/{level}\.\d-.*-uroven-{level}\.html")


def _group_url_re(level: int) -> re.Pattern[str]:
    return re.compile(rf"/fgos/\d{{2}}\.00\.00-.*-uroven-{level}\.html")


def _industry_code_re(level: int) -> re.Pattern[str]:
    return re.compile(rf"/fgos/({level}\.\d)-")


def _links_cache_path(category_id: str) -> str:
    return os.path.join(OUTPUT_DIR, f"fgos_{category_id}_links.json")


def _default_json_path(category_id: str) -> str:
    return os.path.join(OUTPUT_DIR, f"fgos_{category_id}.json")


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def get_soup(session: requests.Session, url: str) -> BeautifulSoup:
    resp = session.get(url, verify=False, timeout=60)
    resp.raise_for_status()
    if not resp.encoding or resp.encoding.lower() == "iso-8859-1":
        resp.encoding = resp.apparent_encoding or "utf-8"
    return BeautifulSoup(resp.text, "html.parser")


def extract_links(soup: BeautifulSoup, pattern: re.Pattern[str]) -> list[str]:
    links: list[str] = []
    for a in soup.select("a[href]"):
        href = a.get("href") or ""
        if "/fgos/" not in href:
            continue
        full = urljoin(BASE_URL, href)
        if pattern.search(full):
            links.append(full)
    return sorted(set(links))


def _page_heading(
    soup: BeautifulSoup,
    *,
    level: int | None = None,
) -> tuple[Optional[str], Optional[str]]:
    code = None
    h1 = soup.find("h1")
    if h1:
        m = CODE_RE.search(h1.get_text(" ", strip=True))
        if m:
            code = m.group(0)
    if not code and level is not None:
        for tag in soup.find_all(["h3", "h4"]):
            m = re.search(rf"\b{level}\.\d\b", tag.get_text(" ", strip=True))
            if m:
                code = m.group(0)
                break
    h2 = soup.find("h2")
    name = h2.get_text(" ", strip=True) if h2 else None
    return code, name


def get_industry_links(session: requests.Session, root_url: str, level: int) -> list[str]:
    soup = get_soup(session, root_url)
    return extract_links(soup, _industry_url_re(level))


def get_group_links(session: requests.Session, industry_url: str, level: int) -> list[str]:
    soup = get_soup(session, industry_url)
    return extract_links(soup, _group_url_re(level))


def get_fgos_detail_links(session: requests.Session, group_url: str) -> list[str]:
    soup = get_soup(session, group_url)
    links: list[str] = []
    for a in soup.select("a[href]"):
        href = a.get("href") or ""
        if "/fgos/" not in href:
            continue
        full = urljoin(BASE_URL, href)
        if "-uroven-" in full:
            continue
        if re.search(r"/fgos/\d{2}\.00\.00-", full):
            continue
        if DETAIL_URL_RE.search(full):
            links.append(full)
    return sorted(set(links))


def discover_category_detail_links(
    category_id: str,
    session: Optional[requests.Session] = None,
) -> list[dict[str, str]]:
    """Обходит иерархию категории ФГОС и возвращает метаданные всех карточек."""
    cat = FGOS_CATEGORY_BY_ID.get(category_id)
    if not cat:
        raise ValueError(f"Неизвестная категория ФГОС: {category_id}")

    level = cat["level"]
    root_url = BASE_URL + cat["root_path"]
    industry_code_re = _industry_code_re(level)
    session = session or _session()
    items: list[dict[str, str]] = []
    seen: set[str] = set()

    for industry_url in get_industry_links(session, root_url, level):
        time.sleep(REQUEST_DELAY_SEC)
        ind_code, ind_name = _page_heading(get_soup(session, industry_url), level=level)
        if not ind_code:
            m = industry_code_re.search(industry_url)
            ind_code = m.group(1) if m else ""

        for group_url in get_group_links(session, industry_url, level):
            time.sleep(REQUEST_DELAY_SEC)
            grp_code, grp_name = _page_heading(get_soup(session, group_url), level=level)
            if not grp_code:
                m = GROUP_CODE_RE.search(group_url)
                grp_code = m.group(1) if m else ""

            for detail_url in get_fgos_detail_links(session, group_url):
                if detail_url in seen:
                    continue
                seen.add(detail_url)
                m = CODE_RE.search(detail_url)
                items.append(
                    {
                        "url": detail_url,
                        "code": m.group(0) if m else "",
                        "category": category_id,
                        "industry_code": ind_code or "",
                        "industry_name": ind_name or "",
                        "group_code": grp_code or "",
                        "group_name": grp_name or "",
                    }
                )
            time.sleep(REQUEST_DELAY_SEC)

    return items


def discover_all_detail_links(session: Optional[requests.Session] = None) -> list[dict[str, str]]:
    """Обратная совместимость: только СПО."""
    return discover_category_detail_links("spo", session=session)


def _detect_kind(code: str) -> str:
    return "specialty" if re.fullmatch(r"\d{2}\.\d{2}\.\d{2}", code) else "profession"


def _normalize_competency_lines(items: list[str]) -> list[str]:
    return [re.sub(r"\s+", " ", x).strip() for x in items if x.strip()]


def _slice_between(text: str, start_re: str, end_re: str | None) -> str:
    m = re.search(start_re, text, re.IGNORECASE)
    if not m:
        return ""
    start = m.start()
    if end_re:
        em = re.search(end_re, text[m.end() :], re.IGNORECASE)
        end = m.end() + em.start() if em else len(text)
    else:
        end = len(text)
    return text[start:end]


def _extract_ok_pk(section: str) -> tuple[list[str], list[str]]:
    ok = _normalize_competency_lines(re.findall(r"ОК\s+\d+\.\s+[^;\n]+(?:;|\.)", section))
    pk = _normalize_competency_lines(re.findall(r"ПК\s+\d+\.\d+\.\s+[^;\n]+(?:;|\.)", section))
    return ok, pk


def _extract_he_competencies(section: str) -> tuple[list[str], list[str]]:
    """УК/ПК в ФГОС высшего образования (формат УК-1., ПК-1.)."""
    uk = _normalize_competency_lines(re.findall(r"УК-\d+\.\s+[^;\n]+(?:;|\.)?", section))
    pk = _normalize_competency_lines(re.findall(r"ПК-\d+\.\s+[^;\n]+(?:;|\.)?", section))
    return uk, pk


def _extract_pk_by_activity(section: str) -> list[dict[str, Any]]:
    """ПК, сгруппированные по видам деятельности (5.2.1, 5.4.1 …)."""
    groups: list[dict[str, Any]] = []
    current_activity: str | None = None
    current_pks: list[str] = []

    for raw_line in section.split("\n"):
        line = raw_line.strip()
        if not line:
            continue
        act_m = re.match(r"5\.\d\.\d+\.\s+(.+)", line)
        pk_m = re.match(r"ПК\s+\d+\.\d+\.", line)
        if act_m:
            if current_activity and current_pks:
                groups.append({"activity": current_activity, "competencies": current_pks})
            current_activity = act_m.group(1).rstrip(".")
            current_pks = []
        elif pk_m:
            pk_line = re.sub(r"\s+", " ", line).strip()
            current_pks.append(pk_line)

    if current_activity and current_pks:
        groups.append({"activity": current_activity, "competencies": current_pks})
    return groups


def _parse_table_durations(table_text: str) -> dict[str, str]:
    duration: dict[str, str] = {}
    lines = [re.sub(r"\s+", " ", ln.strip()) for ln in table_text.split("\n") if ln.strip()]
    for i, line in enumerate(lines):
        low = line.lower()
        if "среднее общее образование" in low or "среднего общего образования" in low:
            for j in range(i + 1, min(i + 4, len(lines))):
                if re.search(r"\d+\s+год", lines[j], re.I):
                    duration["on_base_of_school"] = f"на базе среднего общего образования — {lines[j]}"
                    break
        elif "основное общее образование" in low or "основного общего образования" in low:
            for j in range(i + 1, min(i + 4, len(lines))):
                if re.search(r"\d+\s+год", lines[j], re.I):
                    duration["on_base_of_primary"] = f"на базе основного общего образования — {lines[j]}"
                    break
    return duration


def _parse_dual_qualification_tracks(full_text: str) -> list[dict[str, Any]]:
    """ФГОС с базовой и углубленной подготовкой (разделы 5.1–5.4)."""
    if not re.search(r"5\.1\.\s+.+\s+должен обладать общими компетенциями", full_text, re.I):
        return []
    if not re.search(r"5\.3\.\s+.+\s+должен обладать общими компетенциями", full_text, re.I):
        return []

    basic_name_m = re.search(
        r"5\.1\.\s+(.+?)\s+должен обладать общими компетенциями",
        full_text,
        re.I,
    )
    advanced_name_m = re.search(
        r"5\.3\.\s+(.+?)\s+должен обладать общими компетенциями",
        full_text,
        re.I,
    )
    basic_name = basic_name_m.group(1).strip() if basic_name_m else "базовая подготовка"
    advanced_name = advanced_name_m.group(1).strip() if advanced_name_m else "углубленная подготовка"

    table1 = _slice_between(full_text, r"Таблица\s+1", r"3\.3\.|Таблица\s+2")
    table2 = _slice_between(full_text, r"Таблица\s+2", r"3\.4\.|Сроки получения СПО по ППССЗ базовой и углубленной|IV\.")

    ok_basic_block = _slice_between(full_text, r"5\.1\.\s+", r"5\.2\.\s+")
    pk_basic_block = _slice_between(full_text, r"5\.2\.\s+", r"5\.3\.\s+")
    ok_advanced_block = _slice_between(full_text, r"5\.3\.\s+", r"5\.4\.\s+")
    pk_advanced_block = _slice_between(full_text, r"5\.4\.\s+", r"VI\.|V\.\s+ТРЕБОВАНИЯ")

    ok_basic, _ = _extract_ok_pk(ok_basic_block)
    _, pk_basic = _extract_ok_pk(pk_basic_block)
    ok_advanced, _ = _extract_ok_pk(ok_advanced_block)
    _, pk_advanced = _extract_ok_pk(pk_advanced_block)

    return [
        {
            "track": "basic",
            "track_label": "Базовая подготовка",
            "qualification_name": basic_name,
            "study_duration": _parse_table_durations(table1),
            "ok_competencies": ok_basic,
            "pk_competencies": pk_basic,
            "pk_by_activity": _extract_pk_by_activity(pk_basic_block),
        },
        {
            "track": "advanced",
            "track_label": "Углубленная подготовка",
            "qualification_name": advanced_name,
            "study_duration": _parse_table_durations(table2),
            "ok_competencies": ok_advanced,
            "pk_competencies": pk_advanced,
            "pk_by_activity": _extract_pk_by_activity(pk_advanced_block),
        },
    ]


def _parse_standard_qualification_tracks(full_text: str) -> list[dict[str, Any]]:
    """Современный ФГОС: один выпускной уровень, раздел III."""
    if not re.search(r"III\.\s*ТРЕБОВАНИЯ К РЕЗУЛЬТАТАМ", full_text, re.I):
        return []

    section = _slice_between(full_text, r"III\.\s*ТРЕБОВАНИЯ К РЕЗУЛЬТАТАМ", r"\nIV\.\s")
    if not section:
        return []

    qualification = ""
    qual_m = re.search(
        r'квалификаци(?:ей|и)\s+специалиста\s+среднего\s+звена\s+[«"]([^»"]+)[»"]',
        full_text,
        re.I,
    )
    if qual_m:
        qualification = qual_m.group(1).strip()

    ok_block = _slice_between(section, r"3\.2\.\s+", r"3\.3\.\s+")
    pk_block = _slice_between(section, r"3\.3\.\s+", None)
    ok_list, _ = _extract_ok_pk(ok_block or section)
    _, pk_list = _extract_ok_pk(pk_block or section)

    duration: dict[str, str] = {}
    for line in full_text.split("\n"):
        line = line.strip()
        if "на базе среднего общего образования" in line.lower() and "месяц" in line.lower():
            duration["on_base_of_school"] = line
        elif "на базе основного общего образования" in line.lower() and "месяц" in line.lower():
            duration["on_base_of_primary"] = line

    if not ok_list and not pk_list:
        return []

    return [
        {
            "track": "standard",
            "track_label": "Программа подготовки",
            "qualification_name": qualification,
            "study_duration": duration,
            "ok_competencies": ok_list,
            "pk_competencies": pk_list,
            "pk_by_activity": _extract_pk_by_activity_from_table(pk_block or section),
        }
    ]


def _extract_pk_by_activity_from_table(section: str) -> list[dict[str, Any]]:
    """ПК из таблицы 2 (современный ФГОС): виды деятельности + ПК."""
    groups: list[dict[str, Any]] = []
    current_activity: str | None = None
    current_pks: list[str] = []

    for raw_line in section.split("\n"):
        line = raw_line.strip()
        if not line:
            continue
        if re.match(r"ПК\s+\d+\.\d+\.", line):
            pk_line = re.sub(r"\s+", " ", line).strip()
            current_pks.append(pk_line)
            continue
        if re.match(r"^\d+$", line):
            continue
        if line.lower().startswith("виды деятельности"):
            continue
        if line.lower().startswith("профессиональные компетенции"):
            continue
        if re.match(r"^[12]$", line):
            continue
        if current_pks and current_activity:
            groups.append({"activity": current_activity, "competencies": current_pks})
            current_pks = []
        if not re.match(r"^(Таблица|ПК|ОК|\d+\.\d+\.)", line, re.I):
            current_activity = line.rstrip(".")

    if current_activity and current_pks:
        groups.append({"activity": current_activity, "competencies": current_pks})
    return groups


def _parse_qualification_tracks(full_text: str) -> list[dict[str, Any]]:
    dual = _parse_dual_qualification_tracks(full_text)
    if dual:
        return dual
    standard = _parse_standard_qualification_tracks(full_text)
    if standard:
        return standard
    return []


def _tracks_summary(tracks: list[dict[str, Any]]) -> tuple[str, list[str], list[str], dict[str, str]]:
    """qualification, ok, pk, study_duration для обратной совместимости."""
    if not tracks:
        return "", [], [], {}
    names = [t.get("qualification_name") for t in tracks if t.get("qualification_name")]
    qualification = "; ".join(dict.fromkeys(names))
    if len(tracks) == 1:
        t = tracks[0]
        return (
            qualification,
            t.get("ok_competencies") or [],
            t.get("pk_competencies") or [],
            t.get("study_duration") or {},
        )
    return qualification, [], [], tracks[0].get("study_duration") or {}


def parse_fgos_page(
    session: requests.Session,
    url: str,
    *,
    industry_code: str = "",
    industry_name: str = "",
    group_code: str = "",
    group_name: str = "",
    category: str = "spo",
) -> dict[str, Any]:
    cat_meta = FGOS_CATEGORY_BY_ID.get(category, {})
    level_label = cat_meta.get("short_label", "СПО")
    soup = get_soup(session, url)
    full_text = soup.get_text("\n")
    code, name = _page_heading(soup)
    if not code:
        m = CODE_RE.search(url)
        code = m.group(0) if m else None

    order_block = ""
    order_date = ""
    order_number = ""
    order_match = re.search(
        r"(приказом[\s\S]{0,400}?N\s*\d+)",
        full_text,
        re.IGNORECASE,
    )
    if order_match:
        order_block = re.sub(r"\s+", " ", order_match.group(1)).strip()
        date_m = re.search(r"от\s+(\d{1,2}\s+\w+\s+\d{4}\s+г\.)", order_block, re.IGNORECASE)
        num_m = re.search(r"N\s*(\d+)", order_block, re.IGNORECASE)
        order_date = date_m.group(1) if date_m else ""
        order_number = num_m.group(1) if num_m else ""

    qualification = DEFAULT_QUALIFICATION.get(category, "")
    qual_m = re.search(
        r'квалификаци(?:ей|и)\s+специалиста\s+среднего\s+звена\s+[«"]([^»"]+)[»"]',
        full_text,
        re.IGNORECASE,
    )
    if qual_m:
        qualification = qual_m.group(1).strip()
    elif category != "spo":
        qual_he = re.search(
            r'квалификаци(?:ей|и)\s+[«"]([^»"]+)[»"]',
            full_text,
            re.IGNORECASE,
        )
        if qual_he:
            qualification = qual_he.group(1).strip()

    duration: dict[str, str] = {}
    for line in full_text.split("\n"):
        line = line.strip()
        if "на базе среднего общего образования" in line.lower() and "месяц" in line.lower():
            duration["on_base_of_school"] = line
        elif "на базе основного общего образования" in line.lower() and "месяц" in line.lower():
            duration["on_base_of_primary"] = line

    activity_areas: list[str] = []
    areas_m = re.search(
        r"(?:1\.13\.|4\.1\.)\s*Области профессиональной деятельности[^:]*:\s*([^\n]+)",
        full_text,
        re.IGNORECASE,
    )
    if areas_m:
        raw = re.sub(r"\s*<[^>]+>\s*", "", areas_m.group(1))
        parts = re.split(r";\s*", raw)
        activity_areas = [p.strip() for p in parts if p.strip()]
    if not activity_areas:
        areas_m2 = re.search(
            r"4\.1\.\s*Область профессиональной деятельности[^:]*:\s*([^\n]+)",
            full_text,
            re.IGNORECASE,
        )
        if areas_m2:
            activity_areas = [areas_m2.group(1).strip()]

    qualification_tracks = _parse_qualification_tracks(full_text)
    qual_from_tracks, ok_competencies, pk_competencies, duration_from_tracks = _tracks_summary(
        qualification_tracks
    )
    if qual_from_tracks:
        qualification = qual_from_tracks
    if duration_from_tracks:
        duration = duration_from_tracks

    if not qualification_tracks:
        section_iii = full_text
        iii_m = re.search(r"III\.\s*ТРЕБОВАНИЯ К РЕЗУЛЬТАТАМ", full_text, re.IGNORECASE)
        if iii_m:
            section_iii = full_text[iii_m.start() :]
            iv_m = re.search(r"\nIV\.\s", section_iii)
            if iv_m:
                section_iii = section_iii[: iv_m.start()]
        ok_competencies = _normalize_competency_lines(
            re.findall(r"ОК\s+\d+\.\s+[^;\n]+(?:;|\.)", section_iii)
        )
        pk_competencies = _normalize_competency_lines(
            re.findall(r"ПК\s+\d+\.\d+\.\s+[^;\n]+(?:;|\.)", section_iii)
        )
        if not ok_competencies and not pk_competencies:
            ok_competencies, pk_competencies = _extract_he_competencies(section_iii)
        if ok_competencies or pk_competencies:
            qualification_tracks = [
                {
                    "track": "standard",
                    "track_label": "Программа подготовки",
                    "qualification_name": qualification,
                    "study_duration": duration,
                    "ok_competencies": ok_competencies,
                    "pk_competencies": pk_competencies,
                    "pk_by_activity": [],
                }
            ]

    pdf_url = None
    pdf_a = soup.find("a", href=re.compile(r"/fgos/download/.*\.pdf", re.I))
    if pdf_a:
        pdf_url = pdf_a.get("href")

    return {
        "code": code,
        "category": category,
        "name": name,
        "kind": _detect_kind(code or ""),
        "level": level_label,
        "industry_code": industry_code,
        "industry_name": industry_name,
        "group_code": group_code,
        "group_name": group_name,
        "order": order_block,
        "order_date": order_date,
        "order_number": order_number,
        "qualification": qualification,
        "qualification_tracks": qualification_tracks,
        "study_duration": duration,
        "activity_areas": activity_areas,
        "ok_competencies": ok_competencies,
        "pk_competencies": pk_competencies,
        "pdf_url": pdf_url,
        "source_url": url,
        "raw_data": {"source": "classinform.ru", "url": url},
    }


def save_fgos_to_db(data: dict[str, Any]) -> str:
    """Вставка или обновление записи. Возвращает 'insert' | 'update' | 'skip'."""
    code = data.get("code")
    category = data.get("category") or "spo"
    if not code:
        return "skip"

    session = SessionLocal()
    try:
        existing = (
            session.query(FgosSpo)
            .filter(FgosSpo.category == category, FgosSpo.code == code)
            .first()
        )
        fields = {
            k: v
            for k, v in data.items()
            if k in FgosSpo.__table__.columns.keys() and k not in ("id", "created_at")
        }
        if existing:
            for key, value in fields.items():
                setattr(existing, key, value)
            session.commit()
            return "update"
        session.add(FgosSpo(**fields))
        session.commit()
        return "insert"
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_fgos_stats_by_category() -> dict[str, int]:
    session = SessionLocal()
    try:
        rows = session.query(FgosSpo.category, FgosSpo.id).all()
        counts: dict[str, int] = {}
        for category, _ in rows:
            key = category or "spo"
            counts[key] = counts.get(key, 0) + 1
        return counts
    finally:
        session.close()


def get_fgos_stats() -> dict[str, int]:
    session = SessionLocal()
    try:
        total = session.query(FgosSpo).count()
        specialties = session.query(FgosSpo).filter(FgosSpo.kind == "specialty").count()
        professions = session.query(FgosSpo).filter(FgosSpo.kind == "profession").count()
        return {
            "local_count": total,
            "specialties": specialties,
            "professions": professions,
        }
    finally:
        session.close()


def fetch_all_fgos(
    category_id: str = "spo",
    *,
    save_db: bool = True,
    output_file: str | None = None,
    links_only: bool = False,
    delay_sec: float = REQUEST_DELAY_SEC,
) -> dict[str, Any]:
    if category_id not in FGOS_CATEGORY_IDS:
        raise ValueError(f"Неизвестная категория ФГОС: {category_id}")

    cat = FGOS_CATEGORY_BY_ID[category_id]
    session = _session()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    root_url = BASE_URL + cat["root_path"]
    links_cache = _links_cache_path(category_id)
    output_file = output_file or _default_json_path(category_id)

    print(f"Категория: {cat['short_label']} ({category_id})")
    print(f"Корень: {root_url}")
    links = discover_category_detail_links(category_id, session)
    print(f"Найдено карточек: {len(links)}")

    with open(links_cache, "w", encoding="utf-8") as f:
        json.dump({"category": category_id, "count": len(links), "items": links}, f, ensure_ascii=False, indent=2)
    print(f"Индекс ссылок: {links_cache}")

    if links_only:
        return {"category": category_id, "links_count": len(links), "saved": 0, "updated": 0, "failed": 0}

    all_records: list[dict[str, Any]] = []
    saved = updated = failed = 0

    for idx, meta in enumerate(links, 1):
        url = meta["url"]
        print(f"[{idx}/{len(links)}] {meta.get('code', '?')} — {url}")
        try:
            data = parse_fgos_page(
                session,
                url,
                industry_code=meta.get("industry_code", ""),
                industry_name=meta.get("industry_name", ""),
                group_code=meta.get("group_code", ""),
                group_name=meta.get("group_name", ""),
                category=meta.get("category", category_id),
            )
            all_records.append(data)
            if save_db:
                action = save_fgos_to_db(data)
                if action == "insert":
                    saved += 1
                elif action == "update":
                    updated += 1
        except Exception as exc:
            failed += 1
            print(f"  Ошибка: {exc}")
        time.sleep(delay_sec)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)

    stats = get_fgos_stats() if save_db else {}
    result = {
        "category": category_id,
        "links_count": len(links),
        "parsed": len(all_records),
        "saved": saved,
        "updated": updated,
        "failed": failed,
        "output_file": output_file,
        **stats,
    }
    print(
        f"\nГотово [{category_id}]: распознано {len(all_records)}, добавлено {saved}, "
        f"обновлено {updated}, ошибок {failed}"
    )
    if save_db:
        by_cat = get_fgos_stats_by_category()
        print(f"В БД ({category_id}): {by_cat.get(category_id, 0)} записей, всего: {stats.get('local_count', 0)}")
    return result


def fetch_all_fgos_remaining(
    *,
    save_db: bool = True,
    links_only: bool = False,
    delay_sec: float = REQUEST_DELAY_SEC,
) -> dict[str, Any]:
    """Парсинг всех категорий кроме СПО."""
    summary: dict[str, Any] = {"categories": {}, "total_saved": 0, "total_updated": 0, "total_failed": 0}
    for category_id in NON_SPO_CATEGORIES:
        print(f"\n{'=' * 60}\nРаздел: {FGOS_CATEGORY_BY_ID[category_id]['title']}\n{'=' * 60}")
        result = fetch_all_fgos(
            category_id,
            save_db=save_db,
            links_only=links_only,
            delay_sec=delay_sec,
        )
        summary["categories"][category_id] = result
        summary["total_saved"] += result.get("saved", 0)
        summary["total_updated"] += result.get("updated", 0)
        summary["total_failed"] += result.get("failed", 0)
    if save_db and not links_only:
        summary["by_category"] = get_fgos_stats_by_category()
    return summary


def fetch_all_fgos_spo(
    *,
    save_db: bool = True,
    output_file: str = DEFAULT_JSON,
    links_only: bool = False,
    delay_sec: float = REQUEST_DELAY_SEC,
) -> dict[str, Any]:
    return fetch_all_fgos(
        "spo",
        save_db=save_db,
        output_file=output_file,
        links_only=links_only,
        delay_sec=delay_sec,
    )


def reparse_fgos_qualification_tracks(
    *,
    codes: list[str] | None = None,
    delay_sec: float = REQUEST_DELAY_SEC,
) -> dict[str, int]:
    """Перепарсить qualification_tracks для записей уже в БД (по source_url)."""
    session = SessionLocal()
    session_http = _session()
    updated = skipped = failed = 0
    try:
        q = session.query(FgosSpo)
        if codes:
            q = q.filter(FgosSpo.code.in_(codes))
        items = q.all()
        print(f"К перепарсингу: {len(items)} записей")
        for idx, item in enumerate(items, 1):
            url = item.source_url
            if not url:
                skipped += 1
                continue
            if url.startswith("/"):
                url = urljoin(BASE_URL, url)
            print(f"[{idx}/{len(items)}] {item.code} — {url}")
            try:
                data = parse_fgos_page(
                    session_http,
                    url,
                    industry_code=item.industry_code or "",
                    industry_name=item.industry_name or "",
                    group_code=item.group_code or "",
                    group_name=item.group_name or "",
                    category=item.category or "spo",
                )
                fields = {
                    k: v
                    for k, v in data.items()
                    if k in FgosSpo.__table__.columns.keys() and k not in ("id", "created_at", "code")
                }
                for key, value in fields.items():
                    setattr(item, key, value)
                session.commit()
                updated += 1
            except Exception as exc:
                session.rollback()
                failed += 1
                print(f"  Ошибка: {exc}")
            time.sleep(delay_sec)
    finally:
        session.close()
    return {"updated": updated, "skipped": skipped, "failed": failed}
