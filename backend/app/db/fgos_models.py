from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from sqlalchemy.orm import relationship
from .base import Base
import datetime

class FgosSpo(Base):
    __tablename__ = 'fgos_spo'
    
    id = Column(Integer, primary_key=True)
    code = Column(String(50), unique=True, index=True)      # код специальности, например "20.02.04"
    name = Column(String(255))                              # название
    level = Column(String(50))                              # уровень образования (СПО)
    order = Column(Text)                                    # реквизиты приказа
    qualification = Column(Text)                            # квалификация (из п.1.1)
    study_duration = Column(JSON)                           # сроки обучения (словарь)
    activity_areas = Column(JSON)                           # области деятельности (список)
    ok_competencies = Column(JSON)                          # общие компетенции (список)
    pk_competencies = Column(JSON)                          # профессиональные компетенции (список)
    pdf_url = Column(String(255))                           # ссылка на PDF
    raw_data = Column(JSON)                                 # для отладки
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)