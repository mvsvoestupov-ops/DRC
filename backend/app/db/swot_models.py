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


class SwotSummary(Base):
    """Единый сводный SWOT по итогам всех столов (генерирует ИИ-агент)."""

    __tablename__ = "swot_summaries"

    id = Column(Integer, primary_key=True)
    strengths = Column(Text, default="")
    weaknesses = Column(Text, default="")
    opportunities = Column(Text, default="")
    threats = Column(Text, default="")
    resume = Column(Text, default="")
    source_count = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class SwotArchive(Base):
    """Снимок заполненных столов перед очисткой (админ)."""

    __tablename__ = "swot_archives"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False, default="")
    source_count = Column(Integer, default=0)
    summary_strengths = Column(Text, default="")
    summary_weaknesses = Column(Text, default="")
    summary_opportunities = Column(Text, default="")
    summary_threats = Column(Text, default="")
    summary_resume = Column(Text, default="")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    entries = relationship(
        "SwotArchiveEntry",
        back_populates="archive",
        cascade="all, delete-orphan",
    )


class SwotArchiveEntry(Base):
    """Одна сохранённая SWOT-форма из снимка столов."""

    __tablename__ = "swot_archive_entries"

    id = Column(Integer, primary_key=True)
    archive_id = Column(Integer, ForeignKey("swot_archives.id"), nullable=False, index=True)
    table_id = Column(Integer, nullable=True)
    table_number = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    user_email = Column(String(255), nullable=False, default="")
    user_label = Column(String(255), nullable=False, default="")
    topic = Column(String(64), nullable=False, index=True)
    strengths = Column(Text, default="")
    weaknesses = Column(Text, default="")
    opportunities = Column(Text, default="")
    threats = Column(Text, default="")
    source_updated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    archive = relationship("SwotArchive", back_populates="entries")
