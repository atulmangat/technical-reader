from sqlalchemy import Column, Integer, Text, String, ForeignKey, Index, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class Highlight(Base):
    __tablename__ = "highlights"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=False)
    color = Column(String(20), default="yellow")
    x_position = Column(Float)
    y_position = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Foreign keys
    pdf_id = Column(Integer, ForeignKey("pdfs.id", ondelete="CASCADE"), nullable=False)
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
    )
