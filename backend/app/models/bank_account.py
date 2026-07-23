from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, CheckConstraint
from app.database.base import Base
from sqlalchemy.orm import relationship
from datetime import datetime


class BankAccount(Base):
    """
    A user's simulated e-bank account — the source of funds they load into their
    trading wallet. Starts at Rs 100,000. `bank_name` is cosmetic (which bank the
    user last loaded from); there is a single balance regardless of the name.
    """
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), unique=True, nullable=False)
    balance = Column(Numeric(12, 2), default=100000)
    bank_name = Column(String, nullable=False, default="PaperTrade Bank")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.utcnow())
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.utcnow(), onupdate=datetime.utcnow())

    user = relationship("User", back_populates="bank_account")

    # An e-bank balance must never go negative.
    __table_args__ = (CheckConstraint("balance >= 0", name="ck_bank_balance_nonneg"),)
