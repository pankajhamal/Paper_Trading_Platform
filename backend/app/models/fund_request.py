from sqlalchemy import Column, Integer, DECIMAL, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database.base import Base


class FundRequest(Base):
    """
    A user's request for more paper money. Unlike a withdrawal, nothing is held
    at request time — an admin approves it (credits the user's e-bank balance) or
    rejects it (no balance change).
    """
    __tablename__ = "fund_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    amount = Column(DECIMAL(12, 2), nullable=False)
    status = Column(String, nullable=False, default="PENDING")  # PENDING | APPROVED | REJECTED
    note = Column(Text, nullable=True)  # optional admin note on review
    reviewed_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
