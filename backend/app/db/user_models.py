from sqlalchemy import Column, Integer, String, DateTime, Boolean
from .base import Base
import datetime

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default='user')  # 'admin' or 'user'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)
    email_confirmed = Column(Boolean, default=True)
    email_confirm_token = Column(String(128), nullable=True, index=True)
    email_confirm_expires = Column(DateTime, nullable=True)
    last_name = Column(String(255), nullable=True)
    first_name = Column(String(255), nullable=True)
    middle_name = Column(String(255), nullable=True)
    organization = Column(String(255), nullable=True)
    password_reset_token = Column(String(128), nullable=True, index=True)
    password_reset_expires = Column(DateTime, nullable=True)