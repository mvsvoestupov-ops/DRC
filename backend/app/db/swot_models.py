"""SWOT-анализ на стратегической сессии: 6 столов × 4 темы."""

from __future__ import annotations

import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from .base import Base

SWOT_TOPICS = (
    "network_programs",
    "graduate_selection",
    "education_export",
    "migration_regulation",
)

SWOT_TABLE_COUNT = 6


class SwotTable(Base):
    __tablename__ = "swot_tables"

    id = Column(Integer, primary_key=True)
    number = Column(Integer, unique=True, nullable=False, index=True)
    title = Column(String(120), nullable=False, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    analyses = relationship("SwotAnalysis", back_populates="table", cascade="all, delete-orphan")


class SwotAnalysis(Base):
    __tablename__ = "swot_analyses"
    __table_args__ = (
        UniqueConstraint("table_id", "user_id", "topic", name="uq_swot_table_user_topic"),
    )

    id = Column(Integer, primary_key=True)
    table_id = Column(Integer, ForeignKey("swot_tables.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    topic = Column(String(64), nullable=False, index=True)
    strengths = Column(Text, default="")
    weaknesses = Column(Text, default="")
    opportunities = Column(Text, default="")
    threats = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    table = relationship("SwotTable", back_populates="analyses")
    user = relationship("User")
