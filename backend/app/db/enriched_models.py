from sqlalchemy import Column, Integer, String, Text, ForeignKey, Table, JSON
from sqlalchemy.orm import relationship
from .base import Base

# Промежуточные таблицы для связей многие-ко-многим
action_skill = Table(
    'enriched_action_skill',
    Base.metadata,
    Column('action_id', Integer, ForeignKey('enriched_labor_actions.id')),
    Column('skill_id', Integer, ForeignKey('enriched_skills.id'))
)

action_knowledge = Table(
    'enriched_action_knowledge',
    Base.metadata,
    Column('action_id', Integer, ForeignKey('enriched_labor_actions.id')),
    Column('knowledge_id', Integer, ForeignKey('enriched_knowledges.id'))
)

class EnrichedStandard(Base):
    __tablename__ = 'enriched_standards'
    id = Column(Integer, primary_key=True)
    reg_number = Column(String, unique=True, index=True)
    name = Column(Text)
    order_number = Column(String)
    approval_date = Column(String)
    kind_activity = Column(Text)
    purpose = Column(Text)

    generalized_functions = relationship("EnrichedGeneralizedFunction", back_populates="standard", cascade="all, delete-orphan")

class EnrichedGeneralizedFunction(Base):
    __tablename__ = 'enriched_generalized_functions'
    id = Column(Integer, primary_key=True)
    standard_id = Column(Integer, ForeignKey('enriched_standards.id'))
    code = Column(String)
    name = Column(Text)
    level = Column(String)
    possible_job_titles = Column(JSON)

    standard = relationship("EnrichedStandard", back_populates="generalized_functions")
    particular_functions = relationship("EnrichedParticularFunction", back_populates="generalized", cascade="all, delete-orphan")

class EnrichedParticularFunction(Base):
    __tablename__ = 'enriched_particular_functions'
    id = Column(Integer, primary_key=True)
    generalized_id = Column(Integer, ForeignKey('enriched_generalized_functions.id'))
    code = Column(String)
    name = Column(Text)
    sub_qualification = Column(String)

    generalized = relationship("EnrichedGeneralizedFunction", back_populates="particular_functions")
    labor_actions = relationship("EnrichedLaborAction", back_populates="particular", cascade="all, delete-orphan")

class EnrichedLaborAction(Base):
    __tablename__ = 'enriched_labor_actions'
    id = Column(Integer, primary_key=True)
    particular_id = Column(Integer, ForeignKey('enriched_particular_functions.id'))
    text = Column(Text)

    particular = relationship("EnrichedParticularFunction", back_populates="labor_actions")
    skills = relationship("EnrichedSkill", secondary=action_skill, back_populates="actions")
    knowledges = relationship("EnrichedKnowledge", secondary=action_knowledge, back_populates="actions")

class EnrichedSkill(Base):
    __tablename__ = 'enriched_skills'
    id = Column(Integer, primary_key=True)
    text = Column(Text, unique=True)   # уникальность для избежания дублей

    actions = relationship("EnrichedLaborAction", secondary=action_skill, back_populates="skills")

class EnrichedKnowledge(Base):
    __tablename__ = 'enriched_knowledges'
    id = Column(Integer, primary_key=True)
    text = Column(Text, unique=True)

    actions = relationship("EnrichedLaborAction", secondary=action_knowledge, back_populates="knowledges")