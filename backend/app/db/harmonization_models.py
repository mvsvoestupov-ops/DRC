"""Версии международной гармонизации (раздел 9.2)."""

from __future__ import annotations

import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from .base import Base


class HarmonizationVersion(Base):
    __tablename__ = "harmonization_versions"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False, default="")
    status = Column(String(32), nullable=False, default="draft")  # draft | in_review | archived
    ready_for_apply = Column(Boolean, nullable=False, default=False)
    notes = Column(Text, default="")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    steps = relationship(
        "HarmonizationStepState",
        back_populates="version",
        cascade="all, delete-orphan",
    )
    passport_links = relationship(
        "PassportHarmonization",
        back_populates="version",
        cascade="all, delete-orphan",
    )


class HarmonizationStepState(Base):
    __tablename__ = "harmonization_step_states"
    __table_args__ = (
        UniqueConstraint("version_id", "step", name="uq_harmonization_version_step"),
    )

    id = Column(Integer, primary_key=True)
    version_id = Column(Integer, ForeignKey("harmonization_versions.id"), nullable=False, index=True)
    step = Column(Integer, nullable=False)  # 1, 2, 4, 5
    status = Column(String(32), nullable=False, default="empty")  # empty | ai_draft | edited | verified
    payload = Column(JSON, default=dict)
    ai_meta = Column(JSON, default=dict)
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    version = relationship("HarmonizationVersion", back_populates="steps")


class PassportHarmonization(Base):
    __tablename__ = "passport_harmonizations"
    __table_args__ = (
        UniqueConstraint("competence_id", "version_id", name="uq_passport_harmonization_comp_ver"),
    )

    id = Column(Integer, primary_key=True)
    competence_id = Column(Integer, ForeignKey("competences.id"), nullable=False, index=True)
    version_id = Column(Integer, ForeignKey("harmonization_versions.id"), nullable=False, index=True)
    step3_status = Column(String(32), nullable=False, default="empty")
    step3_payload = Column(JSON, default=dict)
    step3_ai_meta = Column(JSON, default=dict)
    step3_verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    step3_verified_at = Column(DateTime, nullable=True)
    step6_status = Column(String(32), nullable=False, default="empty")
    step6_payload = Column(JSON, default=dict)
    step6_ai_meta = Column(JSON, default=dict)
    step6_verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    step6_verified_at = Column(DateTime, nullable=True)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    version = relationship("HarmonizationVersion", back_populates="passport_links")
