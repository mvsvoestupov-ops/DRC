from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .base import Base

class StandardRaw(Base):
    __tablename__ = 'raw_standards'
    id = Column(Integer, primary_key=True)
    reg_number = Column(String, unique=True, index=True)
    name = Column(Text)
    order_number = Column(String)
    approval_date = Column(String)
    kind_activity = Column(Text)
    purpose = Column(Text)
    element_id = Column(String, nullable=True)

    generalized_functions = relationship("GeneralizedFunctionRaw", back_populates="standard", cascade="all, delete-orphan")

class GeneralizedFunctionRaw(Base):
    __tablename__ = 'raw_generalized_functions'
    id = Column(Integer, primary_key=True)
    standard_id = Column(Integer, ForeignKey('raw_standards.id'))
    code = Column(String)
    name = Column(Text)
    level = Column(String)
    possible_job_titles = Column(JSON)  # список строк

    standard = relationship("StandardRaw", back_populates="generalized_functions")
    particular_functions = relationship("ParticularFunctionRaw", back_populates="generalized", cascade="all, delete-orphan")

class ParticularFunctionRaw(Base):
    __tablename__ = 'raw_particular_functions'
    id = Column(Integer, primary_key=True)
    generalized_id = Column(Integer, ForeignKey('raw_generalized_functions.id'))
    code = Column(String)
    name = Column(Text)
    sub_qualification = Column(String)

    generalized = relationship("GeneralizedFunctionRaw", back_populates="particular_functions")
    labor_actions = relationship("LaborActionRaw", back_populates="particular", cascade="all, delete-orphan")
    skills = relationship("SkillRaw", back_populates="particular", cascade="all, delete-orphan")
    knowledges = relationship("KnowledgeRaw", back_populates="particular", cascade="all, delete-orphan")

class LaborActionRaw(Base):
    __tablename__ = 'raw_labor_actions'
    id = Column(Integer, primary_key=True)
    particular_id = Column(Integer, ForeignKey('raw_particular_functions.id'))
    text = Column(Text)

    particular = relationship("ParticularFunctionRaw", back_populates="labor_actions")

class SkillRaw(Base):
    __tablename__ = 'raw_skills'
    id = Column(Integer, primary_key=True)
    particular_id = Column(Integer, ForeignKey('raw_particular_functions.id'))
    text = Column(Text)

    particular = relationship("ParticularFunctionRaw", back_populates="skills")

class KnowledgeRaw(Base):
    __tablename__ = 'raw_knowledges'
    id = Column(Integer, primary_key=True)
    particular_id = Column(Integer, ForeignKey('raw_particular_functions.id'))
    text = Column(Text)

    particular = relationship("ParticularFunctionRaw", back_populates="knowledges")