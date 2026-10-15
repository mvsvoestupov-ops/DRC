"""Поиск и кэш занятий/навыков ESCO v1.2 через официальный API."""

from __future__ import annotations

import datetime
import re
from typing import Any
from urllib.parse import quote

import requests
from sqlalchemy.orm import Session

from .db.esco_models import EscoMeta, EscoOccupation, EscoOccupationSkill, EscoSkill

ESCO_API = "https://ec.europa.eu/esco/api"
ESCO_VERSION = "v1.2.0"
ESCO_VERSION_LABEL = "ESCO v1.2"
TIMEOUT = 15
HEADERS = {"Accept": "application/json", "User-Agent": "DRC-ESCO/1.0"}


def _digits(value: Any, size: int = 4) -> str:
    return re.sub(r"\D", "", str(value or ""))[:size]


def _text(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("en") or value.get("literal") or "").strip()
    return str(value or "").strip()


def _isco_from_payload(item: dict[str, Any]) -> str:
    links = item.get("_links") or {}
    groups = links.get("broaderIscoGroup") or []
    if isinstance(groups, dict):
        groups = [groups]
    for group in groups:
        if not isinstance(group, dict):
            continue
        code = _digits(group.get("code") or group.get("uri"))
        if len(code) >= 4:
            return code[:4]
    for raw in item.get("broaderIscoGroup") or []:
        code = _digits(raw)
        if len(code) >= 4:
            return code[:4]
    return _digits(item.get("code"))


def _alt_labels(item: dict[str, Any]) -> str:
    alt = item.get("alternativeLabel") or {}
    values = alt.get("en") if isinstance(alt, dict) else None
    if isinstance(values, list):
        return "; ".join(str(part).strip() for part in values if str(part).strip())[:2000]
    return ""


def serialize_occupation(row: EscoOccupation) -> dict[str, Any]:
    return {
        "uri": row.uri,
        "title": row.title_en,
        "code": row.code or "",
        "isco": row.isco or "",
        "description": row.description_en or "",
        "kind": "occupation",
    }


def serialize_skill(row: EscoSkill, relation: str = "") -> dict[str, Any]:
    return {
        "uri": row.uri,
        "title": row.title_en,
        "skill_type": row.skill_type or "",
        "relation": relation,
        "kind": "skill",
    }


def upsert_occupation(session: Session, item: dict[str, Any]) -> EscoOccupation:
    uri = str(item.get("uri") or "").strip()
    title = _text(item.get("preferredLabel")) or str(item.get("title") or "").strip()
    row = session.query(EscoOccupation).filter(EscoOccupation.uri == uri).first()
    if row is None:
        row = EscoOccupation(uri=uri)
        session.add(row)
    row.code = str(item.get("code") or row.code or "")
    row.isco = _isco_from_payload(item) or row.isco or ""
    if title:
        row.title_en = title
    alt = _alt_labels(item)
    if alt:
        row.alt_en = alt
    description = _text((item.get("description") or {}).get("en") if isinstance(item.get("description"), dict) else "")
    if description:
        row.description_en = description
    row.updated_at = datetime.datetime.utcnow()
    return row


def upsert_skill(session: Session, item: dict[str, Any]) -> EscoSkill | None:
    uri = str(item.get("uri") or "").strip()
    if not uri:
        return None
    title = _text(item.get("preferredLabel")) or str(item.get("title") or "").strip()
    row = session.query(EscoSkill).filter(EscoSkill.uri == uri).first()
    if row is None:
        row = EscoSkill(uri=uri)
        session.add(row)
    if title:
        row.title_en = title
    skill_type = str(item.get("skillType") or item.get("skill_type") or row.skill_type or "")
    if "knowledge" in skill_type:
        row.skill_type = "knowledge"
    elif skill_type:
        row.skill_type = "skill"
    row.updated_at = datetime.datetime.utcnow()
    return row


def _link_skill(session: Session, occupation_uri: str, skill: dict[str, Any], relation: str) -> None:
    skill_uri = str(skill.get("uri") or "").strip()
    if not occupation_uri or not skill_uri:
        return
    upsert_skill(session, skill)
    exists = (
        session.query(EscoOccupationSkill)
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


def esco_get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    query = {"selectedVersion": ESCO_VERSION, "language": "en", **(params or {})}
    response = requests.get(f"{ESCO_API}{path}", params=query, headers=HEADERS, timeout=TIMEOUT)
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, dict) else {}


def esco_search(kind: str, text: str, limit: int = 20, offset: int = 0) -> dict[str, Any]:
    data = esco_get(
        "/search",
        {
            "text": text,
            "type": kind,
            "limit": max(1, min(limit, 50)),
            "offset": max(0, offset),
            "full": "false",
        },
    )
    embedded = data.get("_embedded") or {}
    results = embedded.get("results") if isinstance(embedded, dict) else []
    return {
        "total": int(data.get("total") or 0),
        "items": [item for item in (results or []) if isinstance(item, dict)],
    }


def cache_occupation_profile(session: Session, uri: str) -> EscoOccupation | None:
    if not uri:
        return None
    data = esco_get("/resource/occupation", {"uri": uri})
    if not data.get("uri"):
        return None
    row = upsert_occupation(session, data)
    links = data.get("_links") or {}
    for relation, key in (("essential", "hasEssentialSkill"), ("optional", "hasOptionalSkill")):
        skills = links.get(key) or []
        if isinstance(skills, dict):
            skills = [skills]
        for skill in skills:
            if isinstance(skill, dict):
                _link_skill(session, uri, skill, relation)
    session.commit()
    return row


def _local_occupations(session: Session, needle: str, isco: str, limit: int) -> list[EscoOccupation]:
    qset = session.query(EscoOccupation)
    if isco:
        qset = qset.filter(EscoOccupation.isco.like(f"{isco}%"))
    if needle:
        like = f"%{needle}%"
        qset = qset.filter(
            (EscoOccupation.title_en.ilike(like))
            | (EscoOccupation.code.ilike(like))
            | (EscoOccupation.isco.ilike(like))
            | (EscoOccupation.alt_en.ilike(like))
        )
    return qset.order_by(EscoOccupation.isco, EscoOccupation.title_en).limit(limit).all()


def _local_skills(session: Session, needle: str, limit: int) -> list[EscoSkill]:
    qset = session.query(EscoSkill)
    if needle:
        qset = qset.filter(EscoSkill.title_en.ilike(f"%{needle}%"))
    return qset.order_by(EscoSkill.title_en).limit(limit).all()


def search_occupations(session: Session, q: str = "", isco: str = "", limit: int = 20) -> dict[str, Any]:
    needle = (q or "").strip()
    isco_n = _digits(isco)
    cap = max(1, min(int(limit or 20), 40))
    local = _local_occupations(session, needle, isco_n, cap)
    query = needle or isco_n
    if local and (len(local) >= 5 or not query):
        return {
            "total": len(local),
            "source": "local",
            "version": ESCO_VERSION_LABEL,
            "items": [serialize_occupation(row) for row in local],
        }
    if not query:
        return {
            "total": len(local),
            "source": "local",
            "version": ESCO_VERSION_LABEL,
            "items": [serialize_occupation(row) for row in local],
        }
    remote = esco_search("occupation", query, limit=cap)
    for item in remote["items"]:
        upsert_occupation(session, item)
    session.commit()
    merged = {row.uri: serialize_occupation(row) for row in _local_occupations(session, needle, isco_n, cap)}
    if not merged:
        for item in remote["items"]:
            uri = str(item.get("uri") or "")
            if uri:
                merged[uri] = {
                    "uri": uri,
                    "title": str(item.get("title") or _text(item.get("preferredLabel"))),
                    "code": str(item.get("code") or ""),
                    "isco": _isco_from_payload(item),
                    "description": "",
                    "kind": "occupation",
                }
    items = list(merged.values())[:cap]
    return {
        "total": max(remote["total"], len(items)),
        "source": "esco-api",
        "version": ESCO_VERSION_LABEL,
        "items": items,
    }


def occupation_skills(session: Session, occupation_uri: str, q: str = "", limit: int = 40) -> dict[str, Any]:
    uri = (occupation_uri or "").strip()
    needle = (q or "").strip().lower()
    cap = max(1, min(int(limit or 40), 80))
    cached = session.query(EscoOccupationSkill).filter(EscoOccupationSkill.occupation_uri == uri).all()
    if not cached:
        cache_occupation_profile(session, uri)
        cached = session.query(EscoOccupationSkill).filter(EscoOccupationSkill.occupation_uri == uri).all()
    items: list[dict[str, Any]] = []
    for link in cached:
        skill = session.query(EscoSkill).filter(EscoSkill.uri == link.skill_uri).first()
        if skill is None:
            continue
        if needle and needle not in (skill.title_en or "").lower():
            continue
        payload = serialize_skill(skill, link.relation)
        items.append(payload)
    items.sort(key=lambda row: (0 if row.get("relation") == "essential" else 1, row.get("title") or ""))
    return {
        "total": len(items),
        "source": "local" if cached else "esco-api",
        "version": ESCO_VERSION_LABEL,
        "items": items[:cap],
    }


def search_skills(
    session: Session,
    q: str = "",
    occupation_uri: str = "",
    limit: int = 20,
) -> dict[str, Any]:
    if occupation_uri:
        return occupation_skills(session, occupation_uri, q=q, limit=limit)
    needle = (q or "").strip()
    cap = max(1, min(int(limit or 20), 40))
    local = _local_skills(session, needle, cap)
    if local and (len(local) >= 5 or len(needle) < 2):
        return {
            "total": len(local),
            "source": "local",
            "version": ESCO_VERSION_LABEL,
            "items": [serialize_skill(row) for row in local],
        }
    if len(needle) < 2:
        return {"total": 0, "source": "local", "version": ESCO_VERSION_LABEL, "items": []}
    remote = esco_search("skill", needle, limit=cap)
    for item in remote["items"]:
        upsert_skill(session, item)
    session.commit()
    items = [serialize_skill(row) for row in _local_skills(session, needle, cap)]
    if not items:
        for item in remote["items"]:
            uri = str(item.get("uri") or "")
            if uri:
                items.append(
                    {
                        "uri": uri,
                        "title": str(item.get("title") or _text(item.get("preferredLabel"))),
                        "skill_type": "",
                        "relation": "",
                        "kind": "skill",
                    }
                )
    return {
        "total": max(remote["total"], len(items)),
        "source": "esco-api",
        "version": ESCO_VERSION_LABEL,
        "items": items[:cap],
    }


def refresh_meta(session: Session) -> dict[str, Any]:
    row = session.query(EscoMeta).first()
    if row is None:
        row = EscoMeta(version=ESCO_VERSION)
        session.add(row)
    row.version = ESCO_VERSION
    row.occupation_count = session.query(EscoOccupation).count()
    row.skill_count = session.query(EscoSkill).count()
    row.imported_at = datetime.datetime.utcnow()
    session.commit()
    return status(session)


def status(session: Session) -> dict[str, Any]:
    row = session.query(EscoMeta).first()
    return {
        "version": ESCO_VERSION_LABEL,
        "api_version": ESCO_VERSION,
        "occupations": session.query(EscoOccupation).count(),
        "skills": session.query(EscoSkill).count(),
        "relations": session.query(EscoOccupationSkill).count(),
        "imported_at": row.imported_at.isoformat() if row and row.imported_at else None,
        "source": "https://ec.europa.eu/esco/api",
    }


def import_occupations(session: Session, letters: str = "abcdefghijklmnopqrstuvwxyz") -> dict[str, Any]:
    seen: set[str] = set()
    for letter in letters:
        offset = 0
        while offset < 400:
            remote = esco_search("occupation", letter, limit=50, offset=offset)
            if not remote["items"]:
                break
            for item in remote["items"]:
                uri = str(item.get("uri") or "")
                if uri and uri not in seen:
                    upsert_occupation(session, item)
                    seen.add(uri)
            session.commit()
            offset += 50
            if offset >= remote["total"]:
                break
    return refresh_meta(session)


def esco_portal_url(uri: str, kind: str) -> str:
    encoded = quote(uri or "", safe="")
    if kind == "occupation":
        return f"https://esco.ec.europa.eu/en/classification/occupation?uri={encoded}"
    return f"https://esco.ec.europa.eu/en/classification/skill?uri={encoded}"
