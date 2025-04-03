from datetime import datetime
import random
import string
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

    id = Column(String(5), primary_key=True)
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
    highlights = relationship(
        "Highlight", back_populates="pdf", cascade="all, delete-orphan"
    )

    @staticmethod
    def generate_unique_id(db, user_id):
        """
        Generate a random 5-character string ID that is unique for the user
        """
        while True:
            # Generate random 5-character string
            random_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
            
            # Check if this ID is already used by this user
            existing = db.query(PDF).filter(
                PDF.id == random_id,
                PDF.user_id == user_id
            ).first()
            
            # If not found, we have a unique ID
            if not existing:
                return random_id
