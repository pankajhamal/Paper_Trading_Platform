from sqlalchemy import Column, Integer, String, Float, VARCHAR
from app.database.base import Base
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__="users"

    user_id = Column(Integer, primary_key=True)
    full_name = Column(String)
    email = Column(String, unique=True)
    password = Column(String)
    role = Column(VARCHAR)

    wallet=relationship("Wallet", back_populates="user", uselist=False)
    transactions=relationship("Transaction", back_populates="user")
    portfolio = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    orders=relationship("Order", back_populates="user", cascade="all, delete-orphan")