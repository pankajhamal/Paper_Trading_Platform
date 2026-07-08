from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class Watchlist(Base):
    __tablename__ = "watchlist"

    watchlist_id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    stock_id = Column(Integer, ForeignKey("stocks.stock_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # One-way link to the stock for price data; no back-ref needed on Stock.
    stock = relationship("Stock")

    # A user can watch a given stock only once.
    __table_args__ = (UniqueConstraint("user_id", "stock_id", name="uq_user_watch_stock"),)
