from sqlalchemy import Column, Integer, DateTime, ForeignKey, Numeric, CheckConstraint
from app.database.base import Base
from sqlalchemy.orm import relationship
from datetime import datetime, timezone


class Wallet(Base):
    __tablename__ = "wallet"

    wallet_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), unique=True, nullable=False)
    balance = Column(Numeric(12, 2), default=100000)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.utcnow())
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.utcnow(), onupdate=datetime.utcnow())

    user = relationship("User", back_populates="wallet")

    # A wallet balance must never go negative — the DB backstops the app guards.
    __table_args__ = (CheckConstraint("balance >= 0", name="ck_wallet_balance_nonneg"),)