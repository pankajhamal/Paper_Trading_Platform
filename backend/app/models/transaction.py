from sqlalchemy import Column, Integer, DECIMAL, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base

class Transaction(Base):
  __tablename__="transactions"

  transaction_id = Column(Integer, primary_key=True)
  type = Column(Text)
  amount = Column(DECIMAL)
  user_id = Column(Integer, ForeignKey("users.user_id"))
  description = Column(String)
  created_at = Column(DateTime)

  user = relationship("User", back_populates="transactions")