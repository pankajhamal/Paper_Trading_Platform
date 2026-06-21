from sqlalchemy import Column, Integer, String, Float, VARCHAR, DateTime
from app.database.base import Base
from sqlalchemy.orm import relationship
from datetime import datetime

class Stock(Base):
  __tablename__="stocks"

  stock_id = Column(Integer, primary_key=True, index=True)

  symbol = Column(String, unique=True, index=True, nullable=False)  # e.g., NICA, UPPER
  company_name = Column(String, nullable=True)

  # Price Data
  last_traded_price = Column(Float, default=0.0)
  change = Column(Float, default=0.0)
  percent_change = Column(Float, default=0.0)

  # Daily Stats
  open_price = Column(Float, default=0.0)
  high_price = Column(Float, default=0.0)
  low_price = Column(Float, default=0.0)
  volume = Column(Integer, default=0)

  last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

  portfolio = relationship("Portfolio", back_populates="stock")