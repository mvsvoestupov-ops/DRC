from sqlalchemy import Column, Integer, String, DateTime
from .base import Base
import datetime

class Registration(Base):
    __tablename__ = 'registrations'

    id = Column(Integer, primary_key=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    organization = Column(String(255), nullable=False)
    position = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)