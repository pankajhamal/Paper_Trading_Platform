from sqlalchemy import Column, Integer, String, Float, VARCHAR
from app.database.base import Base
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__="users"

    id = Column(Integer, primary_key=True, unique=True)
    full_name = Column(String)
    email = Column(String, unique=True)
    password = Column(String)
    balance = Column(Float, default=100000)
    role = Column(VARCHAR)

    wallet=relationship("Wallet", back_populates="user", uselist=False)
    transaction=relationship("Transaction", back_populates="user")