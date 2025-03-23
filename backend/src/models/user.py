from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from passlib.context import CryptContext
from pydantic import BaseModel
from .base import Base

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(120), unique=True, nullable=False)
    username = Column(String(80), unique=True, nullable=False)
    password_hash = Column(String(128))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Google OAuth fields
    google_id = Column(String(120), unique=True, nullable=True)
    is_google_account = Column(Boolean, default=False)
    
    # User preferences (chat settings, etc.)
    preferences = Column(JSON, nullable=True, default=dict)

    # Relationships
    pdfs = relationship("PDF", backref="owner", lazy="selectin")
    notes = relationship("Note", back_populates="user")
    highlights = relationship("Highlight", back_populates="user")

    def set_password(self, password):
        self.password_hash = pwd_context.hash(password)

    def check_password(self, password):
        return pwd_context.verify(password, self.password_hash)

