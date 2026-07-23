from sqlalchemy import Column, Integer, String, Float, VARCHAR, Boolean
from app.database.base import Base
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__="users"

    user_id = Column(Integer, primary_key=True)
    full_name = Column(String)
    email = Column(String, unique=True)
    password = Column(String)
    role = Column(VARCHAR)
    avatar_url = Column(String, nullable=True)
    # Soft-delete flag: an admin can disable an account without erasing its
    # wallet/transaction history. Disabled users cannot log in or call the API.
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    wallet=relationship("Wallet", back_populates="user", uselist=False)
    bank_account=relationship("BankAccount", back_populates="user", uselist=False)
    transactions=relationship("Transaction", back_populates="user")
    portfolio = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    orders=relationship("Order", back_populates="user", cascade="all, delete-orphan")