"""Локальный кэш классификатора ESCO (занятия, навыки, связи)."""

from sqlalchemy import Column, Integer, String, Text, DateTime, UniqueConstraint, Index
import datetime

from .base import Base


class EscoOccupation(Base):
    __tablename__ = "esco_occupations"
    __table_args__ = (Index("ix_esco_occupations_isco", "isco"),)

    id = Column(Integer, primary_key=True)
    uri = Column(String(255), unique=True, nullable=False, index=True)
    code = Column(String(32), default="")
    isco = Column(String(8), default="")
    title_en = Column(Text, default="")
    alt_en = Column(Text, default="")
    description_en = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class EscoSkill(Base):
    __tablename__ = "esco_skills"

    id = Column(Integer, primary_key=True)
    uri = Column(String(255), unique=True, nullable=False, index=True)
    title_en = Column(Text, default="")
    skill_type = Column(String(32), default="")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class EscoOccupationSkill(Base):
    __tablename__ = "esco_occupation_skills"
    __table_args__ = (
        UniqueConstraint("occupation_uri", "skill_uri", "relation", name="uq_esco_occ_skill"),
        Index("ix_esco_occ_skill_occ", "occupation_uri"),
    )

    id = Column(Integer, primary_key=True)
    occupation_uri = Column(String(255), nullable=False)
    skill_uri = Column(String(255), nullable=False)
    relation = Column(String(16), nullable=False, default="essential")


class EscoMeta(Base):
    __tablename__ = "esco_meta"

    id = Column(Integer, primary_key=True)
    version = Column(String(32), default="v1.2.0")
    source = Column(String(64), default="api")
    occupation_count = Column(Integer, default=0)
    skill_count = Column(Integer, default=0)
    imported_at = Column(DateTime, default=datetime.datetime.utcnow)
