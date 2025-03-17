from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    ForeignKey,
    DateTime,
    JSON,
)
from sqlalchemy.orm import relationship
from .base import Base


class PDF(Base):
    __tablename__ = "pdfs"

    id = Column(Integer, primary_key=True)
    title = Column(String(100), nullable=False)
    filename = Column(String(100), nullable=False)
    file_path = Column(String(200), nullable=False)
    file_size = Column(Integer)
    thumbnail_path = Column(String(200))
    description = Column(Text)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    total_pages = Column(Integer, nullable=True)
    has_embeddings = Column(Boolean, default=False)
    processing_error = Column(String, nullable=True)
    processing_status = Column(
        String(20), default="pending"
    )  # pending, processing, processed, failed
    table_of_contents = Column(JSON, nullable=True)

    # Relationships
    notes = relationship("Note", back_populates="pdf", cascade="all, delete-orphan")
    highlights = relationship(
        "Highlight", back_populates="pdf", cascade="all, delete-orphan"
    )
