"""Перечень профессий рабочих / должностей служащих (приказ Минпросвещения №534)."""
from sqlalchemy import Column, Integer, String, Text, Index

from .base import Base


class ProfTrainingProfession(Base):
    """
    Профессии рабочих и должности служащих, по которым осуществляется
    профессиональное обучение (приказ Минпросвещения России от 14.07.2023 № 534).
    """

    __tablename__ = "prof_training_professions"
    __table_args__ = (
        Index("ix_ptp_category_section", "category", "section"),
        Index("ix_ptp_name", "name"),
        Index("ix_ptp_okpdtr", "okpdtr_code"),
    )

    id = Column(Integer, primary_key=True)
    item_number = Column(String(32), nullable=False, unique=True, index=True)  # N п/п, напр. 68(1)
    sort_order = Column(Integer, nullable=False, index=True)
    name = Column(Text, nullable=False)
    category = Column(String(32), nullable=False, index=True)  # worker | employee
    section = Column(Text)  # отрасль / раздел перечня
    okpdtr_code = Column(String(32))  # код ОКПДТР (при наличии)
    qualification_rank = Column(String(64))  # разряд / класс / категория
    is_active = Column(Integer, nullable=False, default=1)
    source = Column(String(128), default="minprosveshcheniya_534")
