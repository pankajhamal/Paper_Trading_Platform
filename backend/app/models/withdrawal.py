from sqlalchemy import Column, Integer, DECIMAL, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database.base import Base


class WithdrawalRequest(Base):
    """
    A user's request to withdraw paper cash. Funds are held (deducted from the
    wallet) the moment the request is created; an admin then approves it (funds
    stay out) or rejects it (funds are refunded).
    """
    __tablename__ = "withdrawal_requests"

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
