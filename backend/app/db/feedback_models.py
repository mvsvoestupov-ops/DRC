from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .base import Base
import datetime


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True)
    section = Column(String(100), nullable=False, default="project")
    text = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    attachments = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User")
