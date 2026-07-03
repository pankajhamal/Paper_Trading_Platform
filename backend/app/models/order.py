# app/models/order.py
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from datetime import datetime
from app.database.base import Base # Adjust import to match your project path
from sqlalchemy.orm import relationship

class Order(Base):
    __tablename__ = "orders"

    order_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    stock_id = Column(Integer, ForeignKey("stocks.stock_id"), nullable=False)
    symbol = Column(String, nullable=False)
    order_type = Column(String, nullable=False) # "MARKET" or "LIMIT"
    transaction_type = Column(String, nullable=False) # "BUY" or "SELL"
    
    quantity = Column(Integer, nullable=False)
    remaining_quantity = Column(Integer, nullable=False) # Track for partial fills
    limit_price = Column(Numeric(12, 2), nullable=True) # Null for Market Orders
    
    status = Column(String, default="PENDING") # "PENDING", "COMPLETED", "CANCELLED"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="orders")