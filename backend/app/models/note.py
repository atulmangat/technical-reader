from sqlalchemy import Column, Integer, Text, Float, ForeignKey, Index, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=False)
    x_position = Column(Float)
    y_position = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign keys
    pdf_id = Column(Integer, ForeignKey("pdfs.id", ondelete="CASCADE"), nullable=False)
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
    )
