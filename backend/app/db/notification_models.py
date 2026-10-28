from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from .base import Base
import datetime


class Notification(Base):
    """Внутрисистемные уведомления (прежде всего для модераторов)."""

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("ix_notifications_dedupe", "user_id", "kind", "competence_id"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String(64), nullable=False, default="info")
    title = Column(String(255), nullable=False, default="")
    body = Column(Text, nullable=False, default="")
    competence_id = Column(Integer, ForeignKey("competences.id"), nullable=True, index=True)
    link = Column(String(512), nullable=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User")
