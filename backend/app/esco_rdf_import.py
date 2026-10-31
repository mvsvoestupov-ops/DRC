"""Импорт локального ESCO RDF (esco-v1.2.0.rdf) в SQLite-кэш для шага 9.2."""
from __future__ import annotations

import datetime
import mmap
import os
import re
from pathlib import Path
from typing import Any, Callable, Iterator

from lxml import etree
from sqlalchemy.orm import Session

from .db.esco_models import EscoMeta, EscoOccupation, EscoOccupationSkill, EscoSkill
from .esco_registry import ESCO_VERSION, ESCO_VERSION_LABEL

RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
SKOS_NS = "http://www.w3.org/2004/02/skos/core#"
ESCO_NS = "http://data.europa.eu/esco/model#"
XML_NS = "http://www.w3.org/XML/1998/namespace"

SKOS_CONCEPT = f"{{{SKOS_NS}}}Concept"
SKOS_PREFLABEL = f"{{{SKOS_NS}}}prefLabel"
SKOS_BROADER = f"{{{SKOS_NS}}}broader"
ESCO_SKILL_TYPE = f"{{{ESCO_NS}}}skillType"
ESCO_ESSENTIAL_FOR = f"{{{ESCO_NS}}}isEssentialSkillFor"
ESCO_OPTIONAL_FOR = f"{{{ESCO_NS}}}isOptionalSkillFor"
ESCO_RELATED_ESSENTIAL = f"{{{ESCO_NS}}}relatedEssentialSkill"
ESCO_RELATED_OPTIONAL = f"{{{ESCO_NS}}}relatedOptionalSkill"
RDF_ABOUT = f"{{{RDF_NS}}}about"
RDF_RESOURCE = f"{{{RDF_NS}}}resource"
RDF_TYPE = f"{{{RDF_NS}}}type"
XML_LANG = f"{{{XML_NS}}}lang"

ISCO_RE = re.compile(r"/isco/C(\d{1,4})\b", re.I)
BATCH = 400

# Потоковое вырезание skos:Concept без разбора всего документа libxml2.
# Важно: не путать с skos:ConceptScheme — после "Concept" должен быть разделитель тега.
_CONCEPT_START = b"<skos:Concept"
_CONCEPT_END = b"</skos:Concept"
_TAG_BOUNDARY = frozenset(b" \t\r\n>/")
_RDF_OPEN_RE = re.compile(rb"<rdf:RDF\b[\s\S]*?>", re.I)


def default_rdf_path() -> Path:
    env = (os.environ.get("ESCO_RDF_PATH") or "").strip()
    if env:
        return Path(env)
    # backend/app -> repo root
    root = Path(__file__).resolve().parents[2]
    return root / "ESCO" / "esco-v1.2.0.rdf"


def _resource(elem: etree._Element) -> str:
    uri = (elem.get(RDF_RESOURCE) or "").strip()
    if uri:
        return uri
    for child in elem:
        if child.tag == SKOS_CONCEPT:
            about = (child.get(RDF_ABOUT) or "").strip()
            if about:
                return about
    return ""


def _pref_en(elem: etree._Element) -> str:
    for child in elem:
        if child.tag != SKOS_PREFLABEL:
            continue
        if (child.get(XML_LANG) or "").lower() != "en":
            continue
        text = "".join(child.itertext()).strip()
        if text:
            return text[:2000]
    return ""


def _skill_type(elem: etree._Element) -> str:
    for child in elem:
        if child.tag != ESCO_SKILL_TYPE:
            continue
        res = _resource(child).lower()
        if "knowledge" in res:
            return "knowledge"
        if "skill" in res:
            return "skill"
    return ""


def _isco_from_occupation(elem: etree._Element) -> str:
    for child in elem:
        if child.tag != SKOS_BROADER:
            continue
        res = _resource(child)
        m = ISCO_RE.search(res)
        if m:
            return m.group(1)[:4]
        for nested in child:
            if nested.tag != SKOS_CONCEPT:
                continue
            about = (nested.get(RDF_ABOUT) or "").strip()
            m = ISCO_RE.search(about)
            if m:
                return m.group(1)[:4]
    return ""


def _is_occupation(elem: etree._Element, uri: str) -> bool:
    if "/esco/occupation/" not in uri:
        return False
    for child in elem:
        if child.tag != RDF_TYPE:
            continue
        if child.get(RDF_RESOURCE) == f"{ESCO_NS}Occupation":
            return True
    # URI path is enough for leaf occupations in the dump
    return True


def _upsert_occupation(session: Session, uri: str, title: str, isco: str, cache: dict[str, EscoOccupation]) -> None:
    row = cache.get(uri)
    if row is None:
        row = session.query(EscoOccupation).filter(EscoOccupation.uri == uri).first()
        if row is None:
            row = EscoOccupation(uri=uri)
            session.add(row)
        cache[uri] = row
    if title:
        row.title_en = title
    if isco:
        row.isco = isco
        row.code = isco
    row.updated_at = datetime.datetime.utcnow()


def _upsert_skill(session: Session, uri: str, title: str, skill_type: str, cache: dict[str, EscoSkill]) -> None:
    row = cache.get(uri)
    if row is None:
        row = session.query(EscoSkill).filter(EscoSkill.uri == uri).first()
        if row is None:
            row = EscoSkill(uri=uri)
            session.add(row)
        cache[uri] = row
    if title:
        row.title_en = title
    if skill_type:
        row.skill_type = skill_type
    row.updated_at = datetime.datetime.utcnow()


def _link(
    session: Session,
    occupation_uri: str,
    skill_uri: str,
    relation: str,
    seen: set[tuple[str, str, str]],
) -> None:
    key = (occupation_uri, skill_uri, relation)
    if key in seen:
        return
    seen.add(key)
    exists = (
        session.query(EscoOccupationSkill.id)
        .filter(
            EscoOccupationSkill.occupation_uri == occupation_uri,
            EscoOccupationSkill.skill_uri == skill_uri,
            EscoOccupationSkill.relation == relation,
        )
        .first()
    )
    if exists is None:
        session.add(
            EscoOccupationSkill(
                occupation_uri=occupation_uri,
                skill_uri=skill_uri,
                relation=relation,
            )
        )


def _huge_parser(*, recover: bool = False) -> etree.XMLParser:
    return etree.XMLParser(
        huge_tree=True,
        resolve_entities=False,
        no_network=True,
        recover=recover,
        collect_ids=False,
    )


def _rdf_open_tag(path: Path) -> bytes:
    """Открывающий <rdf:RDF ...> со всеми xmlns из дампа — иначе фрагменты не парсятся."""
    with path.open("rb") as fh:
        head = fh.read(256 * 1024)
    m = _RDF_OPEN_RE.search(head)
    if m:
        return m.group(0)
    return (
        b'<rdf:RDF xmlns:rdf="%b" xmlns:skos="%b" xmlns:esco="%b">'
        % (RDF_NS.encode("ascii"), SKOS_NS.encode("ascii"), ESCO_NS.encode("ascii"))
    )


def _concept_from_root(root: etree._Element) -> etree._Element | None:
    if root.tag == SKOS_CONCEPT:
        return root
    for child in root:
        if child.tag == SKOS_CONCEPT:
            return child
    return None


def _parse_concept_blob(
    blob: bytes,
    open_tag: bytes,
    parser: etree.XMLParser,
    recover_parser: etree.XMLParser,
) -> etree._Element | None:
    """Разбор одного skos:Concept как корня — глубина документа не накапливается."""
    wrapped = open_tag + blob + b"</rdf:RDF>"
    for p in (parser, recover_parser):
        try:
            root = etree.fromstring(wrapped, parser=p)
        except etree.XMLSyntaxError:
            continue
        elem = _concept_from_root(root)
        if elem is not None:
            return elem
    return None


def _tag_name_boundary_ok(buf: bytearray, name_end: int) -> bool | None:
    """True если имя тега закончилось; None если нужно ещё данных."""
    if name_end >= len(buf):
        return None
    return buf[name_end] in _TAG_BOUNDARY


def _find_concept_start(buf: bytearray, pos: int) -> int:
    """Индекс настоящего '<skos:Concept' (не ConceptScheme). -1 нет; -2 нужно больше данных."""
    p = pos
    while True:
        i = buf.find(_CONCEPT_START, p)
        if i < 0:
            return -1
        ok = _tag_name_boundary_ok(buf, i + len(_CONCEPT_START))
        if ok is None:
            return -2
        if ok:
            return i
        p = i + len(_CONCEPT_START)


def _find_concept_end(buf: bytearray, pos: int) -> int:
    """Индекс '</skos:Concept' с границей имени. -1 нет; -2 нужно больше данных."""
    p = pos
    while True:
        i = buf.find(_CONCEPT_END, p)
        if i < 0:
            return -1
        ok = _tag_name_boundary_ok(buf, i + len(_CONCEPT_END))
        if ok is None:
            return -2
        if ok:
            return i
        p = i + len(_CONCEPT_END)


def _next_concept_token(buf: bytearray, pos: int) -> tuple[str, int, int] | None:
    """
    Следующий токен skos:Concept: ('start'|'end'|'empty', token_start, after_token).
    None = нужно больше данных или токена в буфере нет.
    """
    start = _find_concept_start(buf, pos)
    end = _find_concept_end(buf, pos)
    if start == -2 or end == -2:
        return None
    if start < 0 and end < 0:
        return None
    if end >= 0 and (start < 0 or end < start):
        gt = buf.find(b">", end + len(_CONCEPT_END) - 1)
        if gt < 0:
            return None
        return ("end", end, gt + 1)
    if start < 0:
        return None
    gt = buf.find(b">", start)
    if gt < 0:
        return None
    token = bytes(buf[start : gt + 1])
    if token.rstrip().endswith(b"/>"):
        return ("empty", start, gt + 1)
    return ("start", start, gt + 1)


# Потолок на один skill/occupation (mmap не держит копию всего файла в RAM).
_MAX_CONCEPT_BYTES = 8 * 1024 * 1024
# Только целевые concept: skill и occupation (не ISCO/ConceptScheme и т.п.).
_ESCO_CONCEPT_OPEN_RE = re.compile(
    rb'<skos:Concept\s[^>]*\brdf:about="(https?://data\.europa\.eu/esco/'
    rb'(?:skill|occupation)/[^"]+)"[^>]*(/>|>)',
    re.I,
)


def _concept_end_offset(mm: mmap.mmap, start: int) -> int:
    """Индекс сразу после закрывающего </skos:Concept> (с учётом вложенности), либо cap."""
    limit = min(len(mm), start + _MAX_CONCEPT_BYTES)
    window = bytearray(mm[start:limit])
    depth = 0
    pos = 0
    while True:
        tok = _next_concept_token(window, pos)
        if tok is None:
            return start + len(window)
        kind, _t0, t1 = tok
        if kind == "start":
            depth += 1
        elif kind == "empty":
            if depth == 0:
                return start + t1
        else:
            depth -= 1
            if depth == 0:
                return start + t1
        pos = t1


def _iter_concept_blobs(path: Path) -> Iterator[bytes]:
    """
    Полный проход по RDF через mmap: только skos:Concept skill|occupation.
    Не копирует 1.3GB в heap — отсюда нет OOM как у bytearray-сканера.
    """
    with path.open("rb") as fh:
        with mmap.mmap(fh.fileno(), 0, access=mmap.ACCESS_READ) as mm:
            for m in _ESCO_CONCEPT_OPEN_RE.finditer(mm):
                start = m.start()
                open_end = m.end()
                if m.group(0).rstrip().endswith(b"/>"):
                    yield bytes(mm[start:open_end])
                    continue
                end = _concept_end_offset(mm, start)
                yield bytes(mm[start:end])


_ABOUT_RE = re.compile(rb'\brdf:about="([^"]+)"')
_PREFLABEL_RE = re.compile(rb"<skos:prefLabel\b([^>]*)>(.*?)</skos:prefLabel>", re.I | re.S)
_SKILL_TYPE_RES_RE = re.compile(rb"<esco:skillType\b[^>]*\brdf:resource=\"([^\"]+)\"", re.I)
_SKILL_TYPE_BODY_RE = re.compile(rb"<esco:skillType\b[^>]*>(.*?)</esco:skillType>", re.I | re.S)
_BROADER_RE = re.compile(rb"<skos:broader\b([^>]*?)(?:/>|>(.*?)</skos:broader>)", re.I | re.S)
_PROP_RE = re.compile(
    rb"<esco:(isEssentialSkillFor|isOptionalSkillFor|relatedEssentialSkill|relatedOptionalSkill)\b"
    rb"([^>]*?)(?:/>|>(.*?)</esco:\1>)",
    re.I | re.S,
)
_RESOURCE_ATTR_RE = re.compile(rb'\brdf:resource="([^"]+)"')


def _pref_en_from_blob(blob: bytes) -> str:
    for m in _PREFLABEL_RE.finditer(blob):
        attrs = m.group(1)
        if b'xml:lang="en"' not in attrs and b"xml:lang='en'" not in attrs:
            continue
        text = re.sub(rb"<[^>]+>", b"", m.group(2)).decode("utf-8", "ignore").strip()
        if text:
            return text[:2000]
    return ""


def _skill_type_from_blob(blob: bytes) -> str:
    m = _SKILL_TYPE_RES_RE.search(blob)
    res = m.group(1).decode("utf-8", "ignore") if m else ""
    if not res:
        m2 = _SKILL_TYPE_BODY_RE.search(blob)
        if m2:
            am = _ABOUT_RE.search(m2.group(1))
            res = am.group(1).decode("utf-8", "ignore") if am else ""
    low = res.lower()
    if "knowledge" in low:
        return "knowledge"
    if "skill" in low:
        return "skill"
    return ""


def _resources_from_prop(attrs: bytes, body: bytes | None) -> list[str]:
    out: list[str] = []
    m = _RESOURCE_ATTR_RE.search(attrs)
    if m:
        out.append(m.group(1).decode("utf-8", "ignore"))
    if body:
        for am in _ABOUT_RE.finditer(body):
            out.append(am.group(1).decode("utf-8", "ignore"))
    return out


def _isco_from_blob(blob: bytes) -> str:
    for m in _BROADER_RE.finditer(blob):
        for uri in _resources_from_prop(m.group(1), m.group(2)):
            mm = ISCO_RE.search(uri)
            if mm:
                return mm.group(1)[:4]
    return ""


def _prop_links_from_blob(blob: bytes) -> list[tuple[str, str]]:
    """[(prop_local_name, resource_uri), ...]"""
    out: list[tuple[str, str]] = []
    for m in _PROP_RE.finditer(blob):
        prop = m.group(1).decode("ascii", "ignore")
        for uri in _resources_from_prop(m.group(2), m.group(3)):
            out.append((prop, uri))
    return out


def import_esco_rdf(
    session: Session,
    rdf_path: Path | str | None = None,
    *,
    progress: Callable[[dict[str, Any]], None] | None = None,
    clear_existing: bool = False,
) -> dict[str, Any]:
    path = Path(rdf_path) if rdf_path else default_rdf_path()
    path = path.resolve()
    if not path.is_file():
        raise FileNotFoundError(
            f"Файл ESCO RDF не найден: {path}. "
            "Положите esco-v1.2.0.rdf в каталог ESCO/ или задайте ESCO_RDF_PATH."
        )

    with path.open("rb") as probe_fh:
        probe = probe_fh.read(1_000_000)
    probe_raw = probe.count(_CONCEPT_START)
    probe_real = 0
    p = 0
    while True:
        i = _find_concept_start(bytearray(probe), p)
        if i < 0:
            break
        probe_real += 1
        p = i + len(_CONCEPT_START)
    print(
        f"Диагностика RDF: abs={path} size={path.stat().st_size} "
        f"probe_raw={probe_raw} probe_Concept={probe_real} head={probe[:120]!r}",
        flush=True,
    )
    if probe_real == 0:
        raise RuntimeError(
            "В первых 1MB нет настоящего '<skos:Concept' (не ConceptScheme). "
            "Перезалейте ESCO/esco-v1.2.0.rdf через upload-esco-to-server.cmd"
        )

    if clear_existing:
        session.query(EscoOccupationSkill).delete()
        session.query(EscoSkill).delete()
        session.query(EscoOccupation).delete()
        session.commit()

    occ_cache: dict[str, EscoOccupation] = {}
    skill_cache: dict[str, EscoSkill] = {}
    link_seen: set[tuple[str, str, str]] = set()
    counts = {"occupations": 0, "skills": 0, "relations": 0, "concepts": 0}
    pending = 0
    blobs = 0
    parsed = 0

    print(
        "Старт полного разбора skill/occupation через mmap "
        "(ориентир: ~3000 занятий, ~15000 навыков)…",
        flush=True,
    )
    for blob in _iter_concept_blobs(path):
        blobs += 1
        about = _ABOUT_RE.search(blob)
        if not about:
            continue
        uri = about.group(1).decode("utf-8", "ignore").strip()
        if not uri:
            continue
        parsed += 1
        counts["concepts"] += 1

        if "/esco/skill/" in uri:
            title = _pref_en_from_blob(blob)
            stype = _skill_type_from_blob(blob)
            if title or stype:
                _upsert_skill(session, uri, title, stype, skill_cache)
                counts["skills"] += 1
                pending += 1
            for prop, target in _prop_links_from_blob(blob):
                if "/esco/occupation/" not in target:
                    continue
                if prop.lower() == "isessentialskillfor":
                    _link(session, target, uri, "essential", link_seen)
                    counts["relations"] += 1
                    pending += 1
                elif prop.lower() == "isoptionalskillfor":
                    _link(session, target, uri, "optional", link_seen)
                    counts["relations"] += 1
                    pending += 1
        elif "/esco/occupation/" in uri:
            title = _pref_en_from_blob(blob)
            isco = _isco_from_blob(blob)
            if title or isco:
                _upsert_occupation(session, uri, title, isco, occ_cache)
                counts["occupations"] += 1
                pending += 1
            for prop, target in _prop_links_from_blob(blob):
                if "/esco/skill/" not in target:
                    continue
                if prop.lower() == "relatedessentialskill":
                    _link(session, uri, target, "essential", link_seen)
                    counts["relations"] += 1
                    pending += 1
                elif prop.lower() == "relatedoptionalskill":
                    _link(session, uri, target, "optional", link_seen)
                    counts["relations"] += 1
                    pending += 1

        if blobs % 100 == 0:
            print(
                f"  … blobs={blobs} concepts={counts['concepts']} "
                f"skills≈{counts['skills']} occ≈{counts['occupations']} rel≈{counts['relations']}",
                flush=True,
            )
            if progress:
                progress(dict(counts))

        if pending >= BATCH:
            session.commit()
            pending = 0

        # Не раздувать RAM кэшами SQLAlchemy на всём дампе.
        if blobs % 500 == 0:
            session.commit()
            pending = 0
            session.expunge_all()
            occ_cache.clear()
            skill_cache.clear()
            if len(link_seen) > 200_000:
                link_seen.clear()

    if pending:
        session.commit()

    scan_stats = {"blobs": blobs, "parsed": parsed}
    if progress:
        progress({**counts, **scan_stats, "phase": "scan_done"})

    meta = session.query(EscoMeta).first()
    if meta is None:
        meta = EscoMeta(version=ESCO_VERSION)
        session.add(meta)
    meta.version = ESCO_VERSION
    meta.source = f"rdf:{path.name}"
    meta.occupation_count = session.query(EscoOccupation).count()
    meta.skill_count = session.query(EscoSkill).count()
    meta.imported_at = datetime.datetime.utcnow()
    session.commit()

    result = {
        "ok": True,
        "path": str(path),
        "version": ESCO_VERSION_LABEL,
        "source": meta.source,
        "blobs": int(scan_stats.get("blobs") or 0),
        "parsed": int(scan_stats.get("parsed") or 0),
        "concepts": counts["concepts"],
        "occupations": meta.occupation_count,
        "skills": meta.skill_count,
        "relations": session.query(EscoOccupationSkill).count(),
        "concepts_seen": counts["concepts"],
        "imported_at": meta.imported_at.isoformat() if meta.imported_at else None,
    }
    if progress:
        progress(result)
    return result
