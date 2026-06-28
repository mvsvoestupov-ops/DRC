from sqlalchemy import Column, Integer, String, Text
from .base import Base

class FtsStandard(Base):
    __tablename__ = 'fts_standards'
    id = Column(Integer, primary_key=True)
    standard_id = Column(Integer)  # ссылка на raw_standards.id
    name = Column(Text)
    kind_activity = Column(Text)
    purpose = Column(Text)
    labor_functions_text = Column(Text)  # все ТФ и действия в одном поле