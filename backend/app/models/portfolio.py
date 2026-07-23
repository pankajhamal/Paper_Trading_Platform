from sqlalchemy import Column, Integer, ForeignKey, Numeric, DateTime, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class Portfolio(Base):
    __tablename__ = "portfolio"

    portfolio_id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    stock_id = Column(Integer, ForeignKey("stocks.stock_id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    average_price = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    #Relationship
    user = relationship("User", back_populates="portfolio")
    stock = relationship("Stock", back_populates="portfolio")

    #A user should have only one portfolio per stock; holdings never go negative
    __table_args__ = (
        UniqueConstraint("user_id", "stock_id", name="uq_user_stock"),
        CheckConstraint("quantity >= 0", name="ck_portfolio_qty_nonneg"),
    )

