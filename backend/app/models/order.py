from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database.base import Base
from sqlalchemy.orm import relationship

class Order(Base):
    __tablename__ = "orders"

    order_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    stock_id = Column(Integer, ForeignKey("stocks.stock_id", ondelete="CASCADE"), nullable=False)
    order_type = Column(String, nullable=False)       # "BUY" or "SELL"
    order_status = Column(String, default="PENDING")  # "PENDING", "COMPLETED", "CANCELLED"
    quantity = Column(Integer, nullable=False)
    price_limit = Column(Float, nullable=False)       # The target price set by the user
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="orders")