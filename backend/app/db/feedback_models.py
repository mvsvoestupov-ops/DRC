from sqlalchemy import Column, Integer, String, Text, DateTime
from .base import Base
import datetime

class Feedback(Base):
    __tablename__ = 'feedback'

    id = Column(Integer, primary_key=True)
    section = Column(String(100), nullable=False)  # раздел (standards, qualifications, competences, etc.)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)