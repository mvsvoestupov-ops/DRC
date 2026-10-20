"""Импорт локального ESCO RDF (esco-v1.2.0.rdf) в SQLite-кэш для шага 9.2."""
from __future__ import annotations

import datetime
import os
import re
from pathlib import Path
from typing import Any, Callable

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


def import_esco_rdf(
    session: Session,
    rdf_path: Path | str | None = None,
    *,
    progress: Callable[[dict[str, Any]], None] | None = None,
    clear_existing: bool = False,
) -> dict[str, Any]:
    path = Path(rdf_path) if rdf_path else default_rdf_path()
    if not path.is_file():
        raise FileNotFoundError(
            f"Файл ESCO RDF не найден: {path}. "
            "Положите esco-v1.2.0.rdf в каталог ESCO/ или задайте ESCO_RDF_PATH."
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

    context = etree.iterparse(str(path), events=("end",), tag=SKOS_CONCEPT, huge_tree=True)
    for _event, elem in context:
        counts["concepts"] += 1
        uri = (elem.get(RDF_ABOUT) or "").strip()
        try:
            if "/esco/skill/" in uri:
                title = _pref_en(elem)
                stype = _skill_type(elem)
                if title or stype:
                    _upsert_skill(session, uri, title, stype, skill_cache)
                    counts["skills"] += 1
                    pending += 1
                for child in elem:
                    if child.tag == ESCO_ESSENTIAL_FOR:
                        occ = _resource(child)
                        if occ and "/esco/occupation/" in occ:
                            _link(session, occ, uri, "essential", link_seen)
                            counts["relations"] += 1
                            pending += 1
                    elif child.tag == ESCO_OPTIONAL_FOR:
                        occ = _resource(child)
                        if occ and "/esco/occupation/" in occ:
                            _link(session, occ, uri, "optional", link_seen)
                            counts["relations"] += 1
                            pending += 1
            elif _is_occupation(elem, uri):
                title = _pref_en(elem)
                isco = _isco_from_occupation(elem)
                if title or isco:
                    _upsert_occupation(session, uri, title, isco, occ_cache)
                    counts["occupations"] += 1
                    pending += 1
                for child in elem:
                    if child.tag == ESCO_RELATED_ESSENTIAL:
                        skill = _resource(child)
                        if skill and "/esco/skill/" in skill:
                            _link(session, uri, skill, "essential", link_seen)
                            counts["relations"] += 1
                            pending += 1
                    elif child.tag == ESCO_RELATED_OPTIONAL:
                        skill = _resource(child)
                        if skill and "/esco/skill/" in skill:
                            _link(session, uri, skill, "optional", link_seen)
                            counts["relations"] += 1
                            pending += 1
        finally:
            elem.clear()
            while elem.getprevious() is not None:
                del elem.getparent()[0]

        if pending >= BATCH:
            session.commit()
            pending = 0
            if progress:
                progress(dict(counts))

    if pending:
        session.commit()

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
        "occupations": meta.occupation_count,
        "skills": meta.skill_count,
        "relations": session.query(EscoOccupationSkill).count(),
        "concepts_seen": counts["concepts"],
        "imported_at": meta.imported_at.isoformat() if meta.imported_at else None,
    }
    if progress:
        progress(result)
    return result
