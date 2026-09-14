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
    professional_area_code = Column(String, nullable=True)
    okved_codes = Column(JSON, nullable=True)
    status = Column(String, default="active", server_default="active")
    revoked_date = Column(String, nullable=True)
    # Макет ПС
    ps_code = Column(String, nullable=True, index=True)
    okved_units = Column(JSON, nullable=True)
    opd_code = Column(String, nullable=True)
    opd_name = Column(Text, nullable=True)
    okz_group_code = Column(String, nullable=True)
    okz_group_name = Column(Text, nullable=True)
    developer_org = Column(Text, nullable=True)
    developer_head = Column(Text, nullable=True)
    co_developers = Column(JSON, nullable=True)
    effective_date = Column(String, nullable=True)
    expiration_date = Column(String, nullable=True)
    abbreviations = Column(JSON, nullable=True)
    source_xml = Column(Text, nullable=True)
    source_html = Column(Text, nullable=True)
    source_kind = Column(String, nullable=True)
    # СПК, за которым закреплён ПС (из Reestr_PS.xlsx, кол. «Ответственная организация»)
    spk_name = Column(Text, nullable=True, index=True)

    generalized_functions = relationship(
        "GeneralizedFunctionRaw", back_populates="standard", cascade="all, delete-orphan"
    )


class GeneralizedFunctionRaw(Base):
    __tablename__ = 'raw_generalized_functions'
    id = Column(Integer, primary_key=True)
    standard_id = Column(Integer, ForeignKey('raw_standards.id'))
    code = Column(String)
    name = Column(Text)
    level = Column(String)
    possible_job_titles = Column(JSON)
    okz_codes = Column(JSON, nullable=True)
    okpdtr_codes = Column(JSON, nullable=True)
    okso_codes = Column(JSON, nullable=True)
    okz_units = Column(JSON, nullable=True)
    okpdtr_units = Column(JSON, nullable=True)
    okso_units = Column(JSON, nullable=True)
    etks_units = Column(JSON, nullable=True)
    education_training = Column(Text, nullable=True)
    practical_experience = Column(Text, nullable=True)
    special_admission = Column(Text, nullable=True)
    other_characteristics = Column(Text, nullable=True)

    standard = relationship("StandardRaw", back_populates="generalized_functions")
    particular_functions = relationship(
        "ParticularFunctionRaw", back_populates="generalized", cascade="all, delete-orphan"
    )


class ParticularFunctionRaw(Base):
    __tablename__ = 'raw_particular_functions'
    id = Column(Integer, primary_key=True)
    generalized_id = Column(Integer, ForeignKey('raw_generalized_functions.id'))
    code = Column(String)
    name = Column(Text)
    sub_qualification = Column(String)
    other_characteristics = Column(Text, nullable=True)

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
