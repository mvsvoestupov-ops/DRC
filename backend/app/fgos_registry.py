"""Категории ФГОС на classinform.ru (уровни 2–8)."""
from __future__ import annotations

from typing import TypedDict

BASE = "https://classinform.ru"


class FgosCategory(TypedDict):
    id: str
    level: int
    title: str
    short_label: str
    root_path: str
    parse_hint: str


FGOS_CATEGORIES: list[FgosCategory] = [
    {
        "id": "spo",
        "level": 2,
        "title": "Федеральные государственные образовательные стандарты среднего профессионального образования",
        "short_label": "СПО",
        "root_path": "/fgos/2-standarty-srednego-professionalnogo-obrazovaniia.html",
        "parse_hint": "run-parse-fgos.bat",
    },
    {
        "id": "bachelor",
        "level": 3,
        "title": "Федеральные государственные образовательные стандарты высшего профессионального образования по направлениям подготовки бакалавриата",
        "short_label": "Бакалавриат",
        "root_path": "/fgos/3-standarty-vysshego-professionalnogo-obrazovaniia-po-napravleniiam-podgotovki-bakalavriata.html",
        "parse_hint": "run-parse-fgos.bat --category bachelor",
    },
    {
        "id": "master",
        "level": 4,
        "title": "Федеральные государственные образовательные стандарты высшего профессионального образования по направлениям подготовки магистров",
        "short_label": "Магистратура",
        "root_path": "/fgos/4-standarty-vysshego-professionalnogo-obrazovaniia-po-napravleniiam-podgotovki-magistrov.html",
        "parse_hint": "run-parse-fgos.bat --category master",
    },
    {
        "id": "specialist",
        "level": 5,
        "title": "Федеральные государственные образовательные стандарты высшего профессионального образования по направлениям подготовки специалитета",
        "short_label": "Специалитет",
        "root_path": "/fgos/5-standarty-vysshego-professionalnogo-obrazovaniia-po-napravleniiam-podgotovki-spetcialiteta.html",
        "parse_hint": "run-parse-fgos.bat --category specialist",
    },
    {
        "id": "aspirantura",
        "level": 6,
        "title": "Федеральные государственные образовательные стандарты высшего образования по направлениям подготовки кадров высшей квалификации в аспирантуре",
        "short_label": "Аспирантура",
        "root_path": "/fgos/6-standarty-vysshego-obrazovaniia-po-napravleniiam-podgotovki-kadrov-vysshei-kvalifikatcii-v-aspiranture.html",
        "parse_hint": "run-parse-fgos.bat --category aspirantura",
    },
    {
        "id": "adjunct",
        "level": 7,
        "title": "Федеральные государственные образовательные стандарты высшего образования по направлениям подготовки кадров высшей квалификации по программам подготовки научно-педагогических кадров в адъюнктуре",
        "short_label": "Адъюнктура",
        "root_path": "/fgos/7-standarty-vysshego-obrazovaniia-po-napravleniiam-podgotovki-kadrov-vysshei-kvalifikatcii-po-programmam-podgotovki-nauchno-pedagogicheskikh-kadrov-v-adiunkture.html",
        "parse_hint": "run-parse-fgos.bat --category adjunct",
    },
    {
        "id": "ordinatura",
        "level": 8,
        "title": "Федеральные государственные образовательные стандарты высшего образования по направлениям подготовки кадров высшей квалификации по программам ординатуры",
        "short_label": "Ординатура",
        "root_path": "/fgos/8-standarty-vysshego-obrazovaniia-po-napravleniiam-podgotovki-kadrov-vysshei-kvalifikatcii-po-programmam-ordinatury.html",
        "parse_hint": "run-parse-fgos.bat --category ordinatura",
    },
]

FGOS_CATEGORY_BY_ID = {c["id"]: c for c in FGOS_CATEGORIES}
FGOS_CATEGORY_IDS = {c["id"] for c in FGOS_CATEGORIES}


def category_root_url(category_id: str) -> str | None:
    cat = FGOS_CATEGORY_BY_ID.get(category_id)
    if not cat:
        return None
    return BASE + cat["root_path"]
