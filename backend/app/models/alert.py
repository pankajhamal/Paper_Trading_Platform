from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class Alert(Base):
    __tablename__ = "alerts"

    alert_id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    stock_id = Column(Integer, ForeignKey("stocks.stock_id", ondelete="CASCADE"), nullable=False)

    # "ABOVE" -> trip when price >= target; "BELOW" -> trip when price <= target
    condition = Column(String, nullable=False)
    target_price = Column(Numeric(12, 2), nullable=False)

    # "ACTIVE" until the market crosses the target, then "TRIGGERED"
    status = Column(String, nullable=False, default="ACTIVE")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    triggered_at = Column(DateTime(timezone=True), nullable=True)

    stock = relationship("Stock")
