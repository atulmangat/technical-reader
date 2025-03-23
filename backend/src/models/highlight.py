from sqlalchemy import Column, Integer, Text, String, ForeignKey, Index, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class Highlight(Base):
    __tablename__ = "highlights"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=False)
    color = Column(String(20), default="yellow")
    note = Column(Text, nullable=True)
    
    # These columns might not exist in the database yet
    # If you get SQLAlchemy errors about missing columns, you'll need to:
    # 1. Either remove these columns from the model, or
    # 2. Run a migration to add these columns to the database
    x_start = Column(Float, nullable=True)
    y_start = Column(Float, nullable=True)
    x_end = Column(Float, nullable=True)
    y_end = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Foreign keys
    pdf_id = Column(String(5), ForeignKey("pdfs.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    pdf = relationship("PDF", back_populates="highlights")
    user = relationship("User", back_populates="highlights")

    # Indexes
    __table_args__ = (
        Index("ix_highlights_pdf_id", "pdf_id"),
        Index("ix_highlights_user_id", "user_id"),
        Index("ix_highlights_page_number", "page_number"),
    )
