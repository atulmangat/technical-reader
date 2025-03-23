from sqlalchemy import Column, Integer, Text, Float, ForeignKey, Index, DateTime, Enum, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    note = Column(Text, nullable=True)  # User's note about the highlight
    page_number = Column(Integer, nullable=False)
    # Position coordinates for the highlight (optional)
    x_position = Column(Float, nullable=True)
    y_position = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
   
    # Foreign keys
    pdf_id = Column(String(5), ForeignKey("pdfs.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    pdf = relationship("PDF", back_populates="notes")
    user = relationship("User", back_populates="notes")

    # Indexes
    __table_args__ = (
        Index("ix_notes_pdf_id", "pdf_id"),
        Index("ix_notes_user_id", "user_id"),
        Index("ix_notes_page_number", "page_number"),
    )
