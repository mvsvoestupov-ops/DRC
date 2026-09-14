from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base
import datetime


class AssessmentTool(Base):
    """Оценочное средство НАРК (https://nok-nark.ru/os/detail/{code}/)."""

    __tablename__ = "assessment_tools"

    id = Column(Integer, primary_key=True)
    code = Column(String(60), unique=True, index=True, nullable=False)
    name = Column(Text, nullable=False)
    qualification_code = Column(String(50), index=True)
    qualification_id = Column(Integer, ForeignKey("qualifications.id"), index=True)

    spk_name = Column(Text)
    prof_standard_name = Column(Text)
    prof_standard_order = Column(Text)
    activity_area = Column(Text)
    qualification_label = Column(Text)

    material_support = Column(Text)
    staffing = Column(Text)
    sample_tasks_url = Column(Text)
    pmk_sample_tasks_url = Column(Text)

    document_type = Column(String(100))
    document_number = Column(String(100))
    document_date = Column(String(50))

    # active — актуальная ревизия (.002 при наличии .001 и т.д.); inactive — замещена новой
    status = Column(String(20), default="active", server_default="active", index=True)

    source_url = Column(Text)
    raw_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    qualification = relationship("Qualification", back_populates="assessment_tools")
