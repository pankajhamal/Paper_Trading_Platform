from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from app.database.base import Base
from sqlalchemy.orm import relationship
from datetime import datetime, timezone


class Wallet(Base):
    __tablename__ = "wallet"

    wallet_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), unique=True, nullable=False)
    balance = Column(Float, default=100000)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.utcnow())
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.utcnow(), onupdate=datetime.utcnow())

    user = relationship("User", back_populates="wallet")