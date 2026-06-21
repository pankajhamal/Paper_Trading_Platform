from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from app.database.base import Base
from sqlalchemy.orm import relationship

class Wallet(Base):
    __tablename__ = "wallet"

    wallet_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), unique=True, nullable=False)
    balance = Column(Float, default=0.0)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

    user = relationship("User", back_populates="wallet")