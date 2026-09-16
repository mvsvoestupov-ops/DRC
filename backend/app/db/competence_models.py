from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from .base import Base
import datetime
import enum

class CompetenceStatus(enum.Enum):
    DRAFT = "проект"
    REVIEW = "на экспертизе"
    APPROVED = "утверждена"

class Competence(Base):
    __tablename__ = 'competences'

    id = Column(Integer, primary_key=True)
    public_code = Column(String(32), unique=True, nullable=True)  # RUS-PK-0001, stable external id
    # Основные поля
    name = Column(String(255), nullable=False)                 # название компетенции
    qualification_name = Column(String(255))                   # название квалификации
    qualification_level = Column(String(20))                   # уровень квалификации
    prof_standard_id = Column(Integer, ForeignKey('raw_standards.id'))
    qualification_id = Column(Integer, ForeignKey('qualifications.id'), nullable=True)
    
    # Трудовые функции (массив кодов и названий)
    labor_functions = Column(JSON)  # [{"code": "A/01.6", "name": "..."}]
    
    # Структура A/B/C (знания, умения, навыки)
    structure = Column(JSON)  # {"A": ["знание1", ...], "B": [...], "C": [...]}
    
    # Дескрипторы уровней
    descriptors = Column(JSON)  # {"A": {"базовый": "...", "продвинутый": "...", "экспертный": "..."}, ...}
    
    # Привязка к дисциплинам/модулям
    discipline_mapping = Column(JSON)  # [{"component": "A1", "discipline": "...", "hours": 72, "control": "экзамен"}]
    
    # Образовательные технологии
    ed_technologies = Column(JSON)  # ["кейс-метод", "проектная работа"]
    
    # Оценочные средства
    assessment_tools = Column(JSON)  # [{"level": "базовый", "tool": "...", "criteria": "...", "for_nok": True}]
    
    # Материально-техническая база
    resources = Column(JSON)  # ["оборудование", "ПО", "помещения"]
    
    # Статус и метаданные
    status = Column(Enum(CompetenceStatus), default=CompetenceStatus.DRAFT)
    developer = Column(String(255))      # разработчик (ОО)
    validator = Column(String(255))      # валидатор (СПК/работодатель)
    validation_notes = Column(Text)      # замечания валидатора
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    is_active = Column(Integer, default=1)
    
    # Дополнительные данные (description, industry, hours и пр.)
    raw_data = Column(JSON, default={})
    
    # Связи
    prof_standard = relationship("StandardRaw", backref="competences")
    qualification = relationship("Qualification", backref="competences")
    
    # Привязка к пользователю
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    user = relationship("User", backref="competences")
    reviewer_links = relationship("CompetenceReviewer", back_populates="competence", cascade="all, delete-orphan")


class CompetenceReviewer(Base):
    __tablename__ = "competence_reviewers"
    __table_args__ = (UniqueConstraint("competence_id", "user_id", name="uq_competence_reviewer"),)

    id = Column(Integer, primary_key=True)
    competence_id = Column(Integer, ForeignKey("competences.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)

    competence = relationship("Competence", back_populates="reviewer_links")
    user = relationship("User")