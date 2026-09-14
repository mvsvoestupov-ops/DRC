"""
Парсер профстандартов с classinform.ru (актуальнее реестра Минтруда для новых ПС).
"""
from __future__ import annotations

import json
import os
import re
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from .db import SessionLocal
from .db_operations import save_raw_standard
from .db.raw_models import StandardRaw
from .models import (
    ClassifierUnit,
    GeneralizedWorkFunction,
    LaborAction,
    ParticularWorkFunction,
    ProfessionalStandard,
)

CLASSINFORM_ROOT = "https://classinform.ru/"
PROFSTANDARTY_INDEX = urljoin(CLASSINFORM_ROOT, "profstandarty.html")
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

PS_LINK_RE = re.compile(r"profstandarty/(\d{2}\.\d{3})-[^/]+\.html", re.I)
AREA_LINK_RE = re.compile(r"profstandarty/(\d{2})-[^/]+\.html", re.I)
PS_CODE_IN_TITLE_RE = re.compile(r"(\d{2}\.\d{3})")
ORDER_RE = re.compile(
    r"от\s+(\d{2}\.\d{2}\.\d{4})\s+№\s*(\d+[а-яА-Я]?\b)",
    re.IGNORECASE,
)
OKVED_RE = re.compile(r"\b(\d{2}\.\d{2})\b")

INDEX_CACHE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "scripts",
    "output",
    "classinform_ps_index.json",
)

FIELD_LABELS = frozenset(
    {
        "Наименование",
        "Код",
        "Уровень квалификации",
        "Уровень (подуровень) квалификации",
        "Возможные наименования должностей, профессий рабочих",
        "Трудовые действия",
        "Необходимы умения",
        "Необходимые умения",
        "Необходимые знания",
        "Пути достижения квалификации",
        "Образование и обучение",
        "Опыт практической работы",
        "Особые условия допуска к работе",
        "Другие характеристики",
        "Справочная информация",
        "Наименование документа",
    }
)

REF_DOC_ALIASES = {
    "ОКЗ": "okz",
    "ЕТКС": "etks",
    "ЕКС": "etks",
    "ОКПДТР": "okpdtr",
    "ОКСО": "okso",
    "ПЕРЕЧЕНЬ СПО": "okso",
    "ПЕРЕЧЕНЬ ВО": "okso",
    "ОКСВНК": "okso",
}

_ps_index: dict[str, dict] | None = None


def fetch_url(url: str, timeout: int = 60) -> str:
    response = requests.get(url, headers=HEADERS, timeout=timeout)
    response.raise_for_status()
    response.encoding = response.apparent_encoding or "utf-8"
    return response.text


def _page_lines(html: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    text = soup.get_text("\n")
    lines = [ln.strip() for ln in text.splitlines()]
    return [ln for ln in lines if ln]


def _parse_label_blocks(lines: List[str]) -> Dict[str, List[str]]:
    blocks: Dict[str, List[str]] = {}
    current: str | None = None
    for line in lines:
        if line in FIELD_LABELS:
            current = line
            blocks[current] = []
            continue
        if current:
            blocks[current].append(line)
    return blocks


def _field_value(blocks: Dict[str, List[str]], label: str) -> str:
    values = blocks.get(label, [])
    return " ".join(values).strip()


def _list_items(blocks: Dict[str, List[str]], label: str) -> List[str]:
    return [item.strip() for item in blocks.get(label, []) if item.strip() and item.strip() != "-"]


def _slice_lines(lines: List[str], start: str, end_markers: List[str] | None = None) -> List[str]:
    end_markers = end_markers or []
    try:
        start_idx = next(i for i, ln in enumerate(lines) if start in ln)
    except StopIteration:
        return []
    end_idx = len(lines)
    for marker in end_markers:
        for i in range(start_idx + 1, len(lines)):
            if marker in lines[i]:
                end_idx = min(end_idx, i)
                break
    return lines[start_idx:end_idx]


def _extract_metadata(lines: List[str], soup: BeautifulSoup) -> dict:
    h1 = soup.find("h1")
    h2 = soup.find("h2")
    title_code = ""
    if h1:
        m = PS_CODE_IN_TITLE_RE.search(h1.get_text(" ", strip=True))
        title_code = m.group(1) if m else ""

    name = h2.get_text(" ", strip=True) if h2 else ""
    full_text = "\n".join(lines)

    reg_number = ""
    for i, line in enumerate(lines):
        if line == "Регистрационный номер" and i > 0:
            candidate = lines[i - 1].strip()
            if re.fullmatch(r"\d{2,4}", candidate):
                reg_number = candidate
                break
    if not reg_number:
        m = re.search(r"ПРОФЕССИОНАЛЬНЫЙ СТАНДАРТ\s*\n\s*([^\n]+)\s*\n\s*(\d{2,4})\s*\n\s*Регистрационный номер", full_text, re.I)
        if m:
            if not name:
                name = m.group(1).strip()
            reg_number = m.group(2)

    order_number = ""
    approval_date = ""
    om = ORDER_RE.search(full_text)
    if om:
        approval_date = om.group(1)
        order_number = om.group(2)

    section_i = _slice_lines(lines, "I. Общие сведения", ["II. Описание"])
    kind_activity = section_i[1] if len(section_i) > 1 else ""
    if kind_activity.startswith("I."):
        kind_activity = ""

    purpose = ""
    for i, line in enumerate(section_i):
        if "Краткое описание вида профессиональной деятельности" in line:
            if i + 1 < len(section_i):
                purpose = section_i[i + 1]
            break

    ps_code = title_code
    for line in section_i:
        m = PS_CODE_IN_TITLE_RE.fullmatch(line)
        if m:
            ps_code = m.group(1)
            break

    professional_area_code = ps_code.split(".")[0] if ps_code else ""

    okved_codes: List[str] = []
    okved_units: List[ClassifierUnit] = []
    capture_okved = False
    for line in section_i:
        if "(код ОКВЭД" in line or line.startswith("Отнесение к видам экономической"):
            capture_okved = True
            continue
        if capture_okved:
            if "(наименование вида экономической деятельности)" in line:
                break
            if line.startswith("II.") or "функциональная карта" in line.lower():
                break
            m = re.match(r"^(\d{2}(?:\.\d{1,2}){1,3})\s+(.+)$", line)
            if m:
                code, uname = m.group(1), m.group(2).strip()
                if code not in okved_codes:
                    okved_codes.append(code)
                    okved_units.append(ClassifierUnit(code=code, name=uname))
                continue
            for code in OKVED_RE.findall(line):
                if code not in okved_codes:
                    okved_codes.append(code)
                    okved_units.append(ClassifierUnit(code=code, name=""))

    okz_group_code = ""
    okz_group_name = ""
    for i, line in enumerate(section_i):
        if "Группа занятий" in line:
            for j in range(i + 1, min(i + 6, len(section_i))):
                m = re.match(r"^(\d{3,4})\s+(.+)$", section_i[j])
                if m:
                    okz_group_code = m.group(1)
                    okz_group_name = m.group(2).strip(" -")
                    break
            break

    opd_code = professional_area_code
    opd_name = ""
    for i, line in enumerate(section_i):
        if "области профессиональной деятельности" in line.lower() or "(код ОПД" in line:
            for j in range(max(0, i - 3), min(i + 4, len(section_i))):
                m = re.match(r"^(\d{2})\s+(.+)$", section_i[j])
                if m and not section_i[j].startswith("01 ") and len(m.group(2)) > 3:
                    opd_code = m.group(1)
                    opd_name = m.group(2).strip()
                    break
            if not opd_name:
                for j in range(i - 1, max(-1, i - 5), -1):
                    m = re.match(r"^(\d{2})\s+(.+)$", section_i[j])
                    if m:
                        opd_code = m.group(1)
                        opd_name = m.group(2).strip()
                        break
            break

    return {
        "name": name,
        "registration_number": reg_number,
        "order_number": order_number,
        "approval_date": approval_date,
        "kind_activity": kind_activity,
        "purpose": purpose,
        "professional_area_code": professional_area_code,
        "okved_codes": okved_codes,
        "okved_units": okved_units,
        "ps_code": ps_code,
        "okz_group_code": okz_group_code,
        "okz_group_name": okz_group_name,
        "opd_code": opd_code,
        "opd_name": opd_name,
    }


def _clean_dash(value: str) -> str:
    value = (value or "").strip()
    if value in ("-", "—", "–", ""):
        return ""
    return value


def _parse_reference_units(lines: List[str]) -> dict[str, List[ClassifierUnit]]:
    result = {"okz": [], "okpdtr": [], "okso": [], "etks": []}
    started = False
    i = 0
    while i < len(lines):
        line = lines[i]
        if line == "Справочная информация" or line.startswith("Справочная информация"):
            started = True
            i += 1
            continue
        if not started:
            i += 1
            continue
        if line.startswith("3.") or line.startswith("IV.") or pf_header_re_match(line):
            break

        doc_key = None
        doc_raw = line
        # "ОКЗ <1>" или просто "ОКЗ"
        m_doc = re.match(
            r"^(ОКЗ|ЕТКС|ЕКС|ОКПДТР|ОКСО|Перечень СПО|Перечень ВО|ОКСВНК)(?:\s*<[^>]+>)?$",
            line,
            re.I,
        )
        if m_doc:
            doc_raw = m_doc.group(1)
        else:
            m_one = re.match(
                r"^(ОКЗ|ЕТКС|ЕКС|ОКПДТР|ОКСО|Перечень СПО|Перечень ВО|ОКСВНК)\s*<[^>]+>\s*(\S+)\s+(.+)$",
                line,
                re.I,
            )
            if not m_one:
                m_one = re.match(
                    r"^(ОКЗ|ЕТКС|ЕКС|ОКПДТР|ОКСО|Перечень СПО|Перечень ВО|ОКСВНК)\s+(\S+)\s+(.+)$",
                    line,
                    re.I,
                )
            if m_one:
                doc_raw, code, name = m_one.group(1), m_one.group(2).strip(), m_one.group(3).strip()
                if code in ("-", "—"):
                    code = ""
                for alias, mapped in REF_DOC_ALIASES.items():
                    if doc_raw.upper().startswith(alias):
                        result[mapped].append(ClassifierUnit(code=code, name=name))
                        break
                i += 1
                continue
            i += 1
            continue

        for alias, mapped in REF_DOC_ALIASES.items():
            if doc_raw.upper().startswith(alias):
                doc_key = mapped
                break
        if not doc_key:
            i += 1
            continue

        code = ""
        name = ""
        if i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            if nxt not in FIELD_LABELS and not nxt.startswith("3.") and not re.match(
                r"^(ОКЗ|ЕТКС|ЕКС|ОКПДТР|ОКСО|Перечень)", nxt, re.I
            ):
                code = "" if nxt in ("-", "—") else nxt
                i += 1
                if i + 1 < len(lines):
                    nxt2 = lines[i + 1].strip()
                    if nxt2 not in FIELD_LABELS and not nxt2.startswith("3.") and not re.match(
                        r"^(ОКЗ|ЕТКС|ЕКС|ОКПДТР|ОКСО|Перечень|Наименование документа)", nxt2, re.I
                    ):
                        name = "" if nxt2 in ("-", "—") else nxt2
                        i += 1
        result[doc_key].append(ClassifierUnit(code=code, name=name))
        i += 1
    return result


def pf_header_re_match(line: str) -> bool:
    return bool(re.match(r"^3\.\d+\.\d+\.\s+Трудовая функция$", line))


def _parse_section_iii(lines: List[str]) -> List[GeneralizedWorkFunction]:
    section = _slice_lines(lines, "III. Характеристика", ["IV."])
    if not section:
        return []

    gf_blocks: List[tuple[str, List[str]]] = []
    current_header: str | None = None
    current_lines: List[str] = []

    gf_header_re = re.compile(r"^3\.\d+\.\s+Обобщенная трудовая функция$")
    pf_header_re = re.compile(r"^3\.\d+\.\d+\.\s+Трудовая функция$")
    for line in section:
        if gf_header_re.match(line):
            if current_header:
                gf_blocks.append((current_header, current_lines))
            current_header = line
            current_lines = []
        elif current_header:
            current_lines.append(line)
    if current_header:
        gf_blocks.append((current_header, current_lines))

    generalized_functions: List[GeneralizedWorkFunction] = []

    for _, gf_lines in gf_blocks:
        meta_end = 0
        for i, line in enumerate(gf_lines):
            if pf_header_re.match(line):
                meta_end = i
                break
        meta_lines = gf_lines[:meta_end] if meta_end else gf_lines
        meta_blocks = _parse_label_blocks(meta_lines)

        gf_code = _field_value(meta_blocks, "Код")
        gf_name = _field_value(meta_blocks, "Наименование")
        gf_level = _field_value(meta_blocks, "Уровень квалификации")
        titles_raw = _field_value(
            meta_blocks,
            "Возможные наименования должностей, профессий рабочих",
        )
        job_titles = [t.strip() for t in re.split(r"[;,]", titles_raw) if t.strip()]

        education = _clean_dash(
            _field_value(meta_blocks, "Образование и обучение")
            or _field_value(meta_blocks, "Пути достижения квалификации")
        )
        experience = _clean_dash(_field_value(meta_blocks, "Опыт практической работы"))
        admission = _clean_dash(_field_value(meta_blocks, "Особые условия допуска к работе"))
        other_gf = _clean_dash(_field_value(meta_blocks, "Другие характеристики"))
        ref_units = _parse_reference_units(meta_lines)

        particular_functions: List[ParticularWorkFunction] = []
        pf_chunks: List[List[str]] = []
        chunk: List[str] = []
        in_pf = False
        for line in gf_lines:
            if pf_header_re.match(line):
                if chunk:
                    pf_chunks.append(chunk)
                chunk = [line]
                in_pf = True
            elif in_pf:
                if gf_header_re.match(line):
                    break
                chunk.append(line)
        if chunk:
            pf_chunks.append(chunk)

        for pf_lines in pf_chunks:
            pf_blocks = _parse_label_blocks(pf_lines)
            pf_code = _field_value(pf_blocks, "Код")
            pf_name = _field_value(pf_blocks, "Наименование")
            pf_level = _field_value(pf_blocks, "Уровень (подуровень) квалификации")
            labor_actions = [
                LaborAction(text=item) for item in _list_items(pf_blocks, "Трудовые действия")
            ]
            skills = _list_items(pf_blocks, "Необходимые умения") or _list_items(
                pf_blocks, "Необходимы умения"
            )
            knowledges = _list_items(pf_blocks, "Необходимые знания")
            other_pf = _clean_dash(_field_value(pf_blocks, "Другие характеристики"))
            if not pf_code and not pf_name:
                continue
            particular_functions.append(
                ParticularWorkFunction(
                    code=pf_code,
                    name=pf_name,
                    sub_qualification=pf_level,
                    labor_actions=labor_actions,
                    required_skills=skills,
                    necessary_knowledges=knowledges,
                    other_characteristics=other_pf or None,
                )
            )

        if not gf_code and not gf_name and not particular_functions:
            continue

        okz_units = ref_units["okz"]
        okpdtr_units = ref_units["okpdtr"]
        okso_units = ref_units["okso"]
        etks_units = ref_units["etks"]

        generalized_functions.append(
            GeneralizedWorkFunction(
                code=gf_code,
                name=gf_name,
                level=gf_level,
                possible_job_titles=job_titles,
                particular_functions=particular_functions,
                okz_codes=[u.code for u in okz_units if u.code],
                okpdtr_codes=[u.code for u in okpdtr_units if u.code],
                okso_codes=[u.code for u in okso_units if u.code],
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

    return generalized_functions


def _parse_section_iv(lines: List[str]) -> dict:
    section = _slice_lines(lines, "IV. Сведения", ["V."])
    if not section:
        return {"developer_org": "", "developer_head": "", "co_developers": []}

    developer_org = ""
    developer_head = ""
    co_developers: List[str] = []

    try:
        idx_41 = next(i for i, ln in enumerate(section) if "4.1" in ln)
    except StopIteration:
        idx_41 = -1
    try:
        idx_42 = next(i for i, ln in enumerate(section) if "4.2" in ln)
    except StopIteration:
        idx_42 = len(section)

    if idx_41 >= 0:
        block = section[idx_41 + 1 : idx_42]
        orgs = [ln for ln in block if ln and not ln.startswith("Президент") and not ln.startswith("Генеральный")
                and "руководитель" not in ln.lower() and ln not in ("-", "—")]
        # Первая длинная строка — организация
        for ln in orgs:
            if len(ln) > 15 and not re.fullmatch(r"\d+", ln):
                developer_org = ln
                break
        for i, ln in enumerate(block):
            if ln in ("Президент", "Генеральный директор", "Директор", "Председатель") or "руководитель" in ln.lower():
                if i + 1 < len(block):
                    developer_head = f"{ln} {block[i + 1]}".strip()
                else:
                    developer_head = ln
                break
            # "Президент | Ковалев ..."
            m = re.match(r"^(Президент|Генеральный директор|Директор|Председатель)\s+(.+)$", ln, re.I)
            if m:
                developer_head = ln
                break

    if idx_42 < len(section):
        for ln in section[idx_42 + 1 :]:
            cleaned = re.sub(r"^\d+\s+", "", ln).strip(" -")
            if not cleaned or cleaned.startswith("V.") or cleaned.startswith("<"):
                continue
            if cleaned == developer_org:
                continue
            if len(cleaned) > 10:
                co_developers.append(cleaned)

    return {
        "developer_org": developer_org,
        "developer_head": developer_head,
        "co_developers": co_developers,
    }


def _parse_section_v(lines: List[str]) -> List[dict]:
    section = _slice_lines(lines, "V. Сокращения", ["--------------------------------", "<1>"])
    abbreviations: List[dict] = []
    for line in section:
        if line.startswith("V.") or "используемые в" in line.lower():
            continue
        if line.startswith("<") or line.startswith("---"):
            break
        m = re.match(r"^([A-ZА-ЯЁ]{1,15})\s*[-–—]\s*(.+)$", line)
        if m:
            abbreviations.append({"abbr": m.group(1).strip(), "meaning": m.group(2).strip()})
        elif " - " in line or " – " in line or " — " in line:
            parts = re.split(r"\s[-–—]\s", line, maxsplit=1)
            if len(parts) == 2 and len(parts[0]) <= 15:
                abbreviations.append({"abbr": parts[0].strip(), "meaning": parts[1].strip()})
    return abbreviations


def parse_classinform_html(html: str) -> ProfessionalStandard:
    soup = BeautifulSoup(html, "html.parser")
    lines = _page_lines(html)
    meta = _extract_metadata(lines, soup)
    generalized_functions = _parse_section_iii(lines)

    if not generalized_functions:
        section_ii = _slice_lines(lines, "II. Описание", ["III."])
        generalized_functions = _parse_functional_map_fallback(section_ii)

    if not meta["name"]:
        raise ValueError("Не удалось определить наименование профстандарта")
    if not meta["registration_number"]:
        raise ValueError("Не удалось определить регистрационный номер")

    section_iv = _parse_section_iv(lines)
    abbreviations = _parse_section_v(lines)

    return ProfessionalStandard(
        name=meta["name"],
        registration_number=meta["registration_number"],
        order_number=meta["order_number"],
        approval_date=meta["approval_date"],
        kind_activity=meta["kind_activity"],
        purpose=meta["purpose"],
        generalized_functions=generalized_functions,
        professional_area_code=meta["professional_area_code"],
        okved_codes=meta["okved_codes"],
        ps_code=meta.get("ps_code"),
        okved_units=meta.get("okved_units") or [],
        opd_code=meta.get("opd_code"),
        opd_name=meta.get("opd_name"),
        okz_group_code=meta.get("okz_group_code"),
        okz_group_name=meta.get("okz_group_name"),
        developer_org=section_iv.get("developer_org") or None,
        developer_head=section_iv.get("developer_head") or None,
        co_developers=section_iv.get("co_developers") or [],
        abbreviations=abbreviations,
        source_html=html,
        source_kind="classinform_html",
    )


def _parse_functional_map_fallback(section_ii: List[str]) -> List[GeneralizedWorkFunction]:
    """Минимальный разбор раздела II, если раздел III недоступен."""
    if not section_ii:
        return []

    idx = 0
    for i, line in enumerate(section_ii):
        if line == "код" and i > 5:
            idx = i + 1
            break
    if idx >= len(section_ii):
        return []

    generalized_functions: List[GeneralizedWorkFunction] = []
    current_gf: GeneralizedWorkFunction | None = None
    i = idx
    gf_code_re = re.compile(r"^[A-ZА-Я]$")
    pf_code_re = re.compile(r"^[A-ZА-Я](?:/\d{2}\.\d+|\d{2}\.\d+)$")

    while i < len(section_ii):
        line = section_ii[i]
        if line.startswith("III.") or line.startswith("3."):
            break
        if gf_code_re.match(line):
            if current_gf:
                generalized_functions.append(current_gf)
            i += 1
            name = section_ii[i] if i < len(section_ii) else ""
            i += 1
            level = section_ii[i] if i < len(section_ii) and section_ii[i].isdigit() else ""
            if level:
                i += 1
            titles: List[str] = []
            if i < len(section_ii) and not pf_code_re.match(section_ii[i]) and not section_ii[i].isdigit():
                titles = [section_ii[i]]
                i += 1
            current_gf = GeneralizedWorkFunction(
                code=line,
                name=name,
                level=level,
                possible_job_titles=titles,
                particular_functions=[],
            )
            continue
        if current_gf and pf_code_re.match(line):
            pf_code = line
            i += 1
            pf_name = section_ii[i] if i < len(section_ii) else ""
            i += 1
            if i < len(section_ii) and section_ii[i].isdigit():
                i += 1
            current_gf.particular_functions.append(
                ParticularWorkFunction(
                    code=pf_code,
                    name=pf_name,
                    sub_qualification=current_gf.level,
                    labor_actions=[],
                )
            )
            continue
        i += 1

    if current_gf:
        generalized_functions.append(current_gf)
    return generalized_functions


def build_ps_index(refresh: bool = False, delay: float = 0.25) -> dict[str, dict]:
    global _ps_index
    if not refresh and _ps_index is not None:
        return _ps_index

    if not refresh and os.path.exists(INDEX_CACHE_PATH):
        try:
            with open(INDEX_CACHE_PATH, encoding="utf-8") as f:
                cached = json.load(f)
            if isinstance(cached, dict) and cached:
                _ps_index = cached
                return _ps_index
        except (json.JSONDecodeError, OSError):
            pass

    print("Построение индекса classinform.ru (34 раздела)...")
    html = fetch_url(PROFSTANDARTY_INDEX)
    soup = BeautifulSoup(html, "html.parser")

    area_urls: List[str] = []
    for anchor in soup.find_all("a", href=True):
        href = urljoin(CLASSINFORM_ROOT, anchor["href"])
        if AREA_LINK_RE.search(href) and href not in area_urls:
            area_urls.append(href)
    area_urls.sort()

    index: dict[str, dict] = {}
    for area_url in area_urls:
        time.sleep(delay)
        try:
            page_html = fetch_url(area_url)
        except Exception as exc:
            print(f"  Ошибка загрузки {area_url}: {exc}")
            continue
        page_soup = BeautifulSoup(page_html, "html.parser")
        for anchor in page_soup.find_all("a", href=True):
            href = urljoin(CLASSINFORM_ROOT, anchor["href"])
            match = PS_LINK_RE.search(href)
            if not match:
                continue
            ps_code = match.group(1)
            name = anchor.get_text(" ", strip=True)
            if not name or PS_CODE_IN_TITLE_RE.fullmatch(name):
                name = index.get(ps_code, {}).get("name", "")
            index[ps_code] = {
                "url": href,
                "name": name,
                "area_code": ps_code.split(".")[0],
            }

    os.makedirs(os.path.dirname(INDEX_CACHE_PATH), exist_ok=True)
    with open(INDEX_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f"  Индекс: {len(index)} профстандартов")
    _ps_index = index
    return index


def get_ps_url(ps_code: str, index: dict | None = None) -> str | None:
    index = index or build_ps_index()
    entry = index.get(ps_code)
    return entry["url"] if entry else None


def get_tf_data_from_classinform(ps_code: str, index: dict | None = None) -> dict[str, dict]:
    """Умения и знания по названию ТФ со страницы classinform.ru."""
    url = get_ps_url(ps_code, index)
    if not url:
        print(f"  classinform: нет URL для {ps_code}")
        return {}
    print(f"  classinform ТФ: {url}")
    html = fetch_url(url)
    standard = parse_classinform_html(html)
    result: dict[str, dict] = {}
    for gf in standard.generalized_functions:
        for pf in gf.particular_functions:
            if not pf.name:
                continue
            result[pf.name] = {
                "skills": list(pf.required_skills or []),
                "knowledges": list(pf.necessary_knowledges or []),
            }
    return result


def load_ps_from_classinform(
    ps_code: str,
    reg_number: str | None = None,
    index: dict | None = None,
    force: bool = False,
) -> bool:
    index = index or build_ps_index()
    url = get_ps_url(ps_code, index)
    if not url:
        print(f"  ✗ На classinform не найден URL для кода {ps_code}")
        return False

    session = SessionLocal()
    try:
        if reg_number and not force:
            existing = session.query(StandardRaw).filter(StandardRaw.reg_number == reg_number).first()
            if existing and existing.source_html and any(
                getattr(gf, "education_training", None) for gf in existing.generalized_functions
            ):
                print(f"  ПС reg={reg_number} уже заполнен (classinform)")
                return True

        print(f"  classinform: {url}")
        html = fetch_url(url)
        standard = parse_classinform_html(html)
        if reg_number and standard.registration_number != reg_number:
            print(
                f"  ⚠ рег. № на сайте ({standard.registration_number}) "
                f"≠ ожидаемому ({reg_number}) — сохраняем под ожидаемым"
            )
            standard.registration_number = reg_number

        existing = None
        if reg_number:
            existing = session.query(StandardRaw).filter(StandardRaw.reg_number == reg_number).first()
        existing_eid = existing.element_id if existing else None
        if existing_eid and str(existing_eid).isdigit():
            element_id = str(existing_eid)
        else:
            element_id = f"classinform:{ps_code}"
        save_raw_standard(session, standard, element_id=element_id)
        print(f"  ✓ Загружен: {standard.registration_number} — {standard.name[:60]}")
        print(
            f"    ОТФ: {len(standard.generalized_functions)}, "
            f"ТФ: {sum(len(g.particular_functions) for g in standard.generalized_functions)}"
        )
        return True
    except Exception as exc:
        session.rollback()
        print(f"  ✗ Ошибка classinform для {ps_code}: {exc}")
        return False
    finally:
        session.close()
