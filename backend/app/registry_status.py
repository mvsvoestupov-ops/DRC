"""Статус ПС в реестре (действует / утратил силу) по данным XLSX Минтруда."""
from __future__ import annotations

import re
from typing import NamedTuple

STATUS_ACTIVE = "active"
STATUS_REVOKED = "revoked"

REVOKED_RE = re.compile(
    r"утратил\w*\s+силу|утратили\s+силу",
    re.IGNORECASE,
)
REVOKED_DATE_PATTERNS = (
    re.compile(
        r"утратил\w*\s+силу\s*(?:\(?\s*с\s*)?(\d{2}\.\d{2}\.\d{4})",
        re.IGNORECASE,
    ),
    re.compile(
        r"утратил\w*\s+силу[^0-9]{0,40}(\d{2}\.\d{2}\.\d{4})",
        re.IGNORECASE | re.DOTALL,
    ),
    re.compile(
        r"(\d{2}\.\d{2}\.\d{4})\s*[-–—]?\s*утратил\w*\s+силу",
        re.IGNORECASE,
    ),
)


def _normalize_order_text(order_text: str) -> str:
    return re.sub(r"\s+", " ", (order_text or "").strip())


class RegistryStatusInfo(NamedTuple):
    status: str
    revoked_date: str | None
    order_number_raw: str


def _normalize_date(value: str | None) -> str | None:
    if not value:
        return None
    text = str(value).strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        y, m, d = text.split("-")
        return f"{d}.{m}.{y}"
    if re.fullmatch(r"\d{2}\.\d{2}\.\d{4}", text):
        return text
    if re.fullmatch(r"\d+\.0", text):
        text = text[:-2]
    m = re.fullmatch(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", text)
    if m:
        return f"{int(m.group(1)):02d}.{int(m.group(2)):02d}.{m.group(3)}"
    return text or None


def parse_registry_status(order_text: str) -> RegistryStatusInfo:
    raw = _normalize_order_text(order_text)
    if not REVOKED_RE.search(raw):
        return RegistryStatusInfo(STATUS_ACTIVE, None, raw)

    revoked_date: str | None = None
    for pattern in REVOKED_DATE_PATTERNS:
        match = pattern.search(raw)
        if match:
            revoked_date = _normalize_date(match.group(1))
            break

    return RegistryStatusInfo(STATUS_REVOKED, revoked_date, raw)


def sync_status_to_db(session, xlsx_items: list[dict]) -> dict:
    from .db.enriched_models import EnrichedStandard
    from .db.raw_models import StandardRaw

    by_reg = {item["reg_number"]: item for item in xlsx_items if item.get("reg_number")}

    raw_updated = 0
    enriched_updated = 0
    missing_in_db: list[str] = []

    for reg, item in by_reg.items():
        status = item.get("status") or STATUS_ACTIVE
        revoked_date = item.get("revoked_date") or None

        raw = session.query(StandardRaw).filter(StandardRaw.reg_number == reg).first()
        if raw:
            changed = False
            if raw.status != status:
                raw.status = status
                changed = True
            if (raw.revoked_date or None) != revoked_date:
                raw.revoked_date = revoked_date
                changed = True
            if changed:
                raw_updated += 1
        else:
            missing_in_db.append(reg)

        enriched = session.query(EnrichedStandard).filter(EnrichedStandard.reg_number == reg).first()
        if enriched:
            changed = False
            if enriched.status != status:
                enriched.status = status
                changed = True
            if (enriched.revoked_date or None) != revoked_date:
                enriched.revoked_date = revoked_date
                changed = True
            if changed:
                enriched_updated += 1

    session.commit()

    revoked_in_xlsx = sum(1 for item in xlsx_items if item.get("status") == STATUS_REVOKED)
    revoked_with_date = sum(
        1 for item in xlsx_items if item.get("status") == STATUS_REVOKED and item.get("revoked_date")
    )

    return {
        "xlsx_total": len(xlsx_items),
        "revoked_in_xlsx": revoked_in_xlsx,
        "revoked_with_date": revoked_with_date,
        "raw_updated": raw_updated,
        "enriched_updated": enriched_updated,
        "missing_in_db": missing_in_db,
    }
