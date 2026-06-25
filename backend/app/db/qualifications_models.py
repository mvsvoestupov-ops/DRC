from sqlalchemy import Column, Integer, String, Text, JSON, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base
import datetime

class Qualification(Base):
    __tablename__ = 'qualifications'
    
    id = Column(Integer, primary_key=True)
    code = Column(String(50), unique=True, index=True, nullable=False)  # код квалификации
    name = Column(Text, nullable=False)                                 # наименование
    level = Column(String(20))                                         # уровень (например, "6.1")
    activity_area = Column(Text)                                       # вид профессиональной деятельности
    labor_functions = Column(JSON)                                     # список {number, code, name}
    
    prof_standard_name = Column(Text)                                  # название ПС
    prof_standard_order = Column(Text)                                 # реквизиты ПС (приказ)
    prof_standard_id = Column(Integer, ForeignKey('raw_standards.id')) # ссылка на ПС (после связывания)
    
    qualification_requirement = Column(Text)                           # квалификационное требование
    possible_job_titles = Column(JSON)                                 # список должностей
    special_admission = Column(JSON)                                   # особые условия допуска
    exam_documents = Column(JSON)                                      # перечень документов для экзамена
    certificate_validity = Column(String(100))                         # срок действия свидетельства
    
    # Классификаторы (если появятся на странице)
    okz_codes = Column(JSON)
    okpdtr_codes = Column(JSON)
    okso_codes = Column(JSON)
    
    council_protocol = Column(Text)                                    # реквизиты протокола Совета
    nark_order = Column(Text)                                          # реквизиты приказа НАРК
    
    raw_data = Column(JSON)                                            # сырые данные для отладки
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Связь с профстандартом (если найден)
    professional_standard = relationship("StandardRaw", backref="qualifications")