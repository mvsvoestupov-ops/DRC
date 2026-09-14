from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, UniqueConstraint
from .base import Base
import datetime


class FgosSpo(Base):
    """ФГОС (classinform.ru): СПО, бакалавриат, магистратура и др."""

    __tablename__ = "fgos_spo"
    __table_args__ = (
        UniqueConstraint("category", "code", name="uq_fgos_category_code"),
    )

    id = Column(Integer, primary_key=True)
    category = Column(String(32), index=True, nullable=False, default="spo")
    code = Column(String(50), index=True, nullable=False)
    name = Column(Text)
    kind = Column(String(20), default="specialty")  # specialty | profession
    level = Column(String(50), default="СПО")

    industry_code = Column(String(20))   # 2.1 … 2.8
    industry_name = Column(Text)
    group_code = Column(String(20))      # 20.00.00
    group_name = Column(Text)

    order = Column(Text)
    order_date = Column(String(50))
    order_number = Column(String(50))
    qualification = Column(Text)
    # Образовательные квалификации ФГОС (техник / старший техник и т.п.) с привязкой ОК/ПК
    qualification_tracks = Column(JSON)

    study_duration = Column(JSON)
    activity_areas = Column(JSON)
    ok_competencies = Column(JSON)
    pk_competencies = Column(JSON)

    pdf_url = Column(String(512))
    source_url = Column(String(512), unique=True, index=True)

    raw_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
