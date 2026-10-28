"""Создание и выдача внутрисистемных уведомлений."""

from __future__ import annotations

import datetime
from typing import Any

from sqlalchemy.orm import Session

from .db.notification_models import Notification
from .db.user_models import User
from .auth import user_role


KIND_STEP7_DONE = "wizard_step7_done"
KIND_REVIEW_SUBMITTED = "review_submitted"


def resources_mto_filled(resources: Any) -> bool:
    """Шаг 7 (МТО): в блоках A, B и C есть хотя бы по одной непустой позиции."""
    if not isinstance(resources, dict):
        return False
    for key in ("A", "B", "C"):
        items = resources.get(key) or []
        if not isinstance(items, list):
            return False
        if not any(str(item or "").strip() for item in items):
            return False
    return True


def list_moderator_users(session: Session) -> list[User]:
    users = session.query(User).all()
    return [row for row in users if user_role(row) == "moderator" and getattr(row, "is_active", 1)]


def notification_exists(
    session: Session,
    *,
    user_id: int,
    kind: str,
    competence_id: int | None,
) -> bool:
    query = session.query(Notification.id).filter(
        Notification.user_id == user_id,
        Notification.kind == kind,
    )
    if competence_id is None:
        query = query.filter(Notification.competence_id.is_(None))
    else:
        query = query.filter(Notification.competence_id == competence_id)
    return session.query(query.exists()).scalar()


def notify_moderators(
    session: Session,
    *,
    kind: str,
    title: str,
    body: str,
    competence_id: int | None = None,
    link: str | None = None,
) -> int:
    """Создаёт уведомления всем модераторам (без дублей одного kind+competence)."""
    created = 0
    for user in list_moderator_users(session):
        if notification_exists(
            session,
            user_id=user.id,
            kind=kind,
            competence_id=competence_id,
        ):
            continue
        session.add(
            Notification(
                user_id=user.id,
                kind=kind,
                title=(title or "")[:255],
                body=body or "",
                competence_id=competence_id,
                link=link,
            )
        )
        created += 1
    return created


def serialize_notification(row: Notification) -> dict:
    return {
        "id": row.id,
        "kind": row.kind,
        "title": row.title,
        "body": row.body,
        "competence_id": row.competence_id,
        "link": row.link,
        "read_at": row.read_at.isoformat() if row.read_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "is_read": bool(row.read_at),
    }


def mark_notification_read(session: Session, row: Notification) -> Notification:
    if not row.read_at:
        row.read_at = datetime.datetime.utcnow()
    return row
