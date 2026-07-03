# app/schemas/trade.py
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal

class StockBuy(BaseModel):
    symbol: str = Field(..., description="Stock symbol eg. NABIL")
    quantity: int = Field(..., gt=0, description="Quantity of share to buy(must be greater than 0)")
    order_type: Optional[str] = Field("MARKET", description="Type of order: MARKET or LIMIT")
    limit_price: Optional[Decimal] = Field(None, gt=0, description="Limit price per share (Required only for LIMIT orders)")

class StockSell(BaseModel):
    symbol: str = Field(..., description="Stock symbol, e.g., NABIL")
    quantity: int = Field(..., gt=0, description="Quantity of shares to sell (must be greater than 0)")
    order_type: Optional[str] = Field("MARKET", description="Type of order: MARKET or LIMIT")
    limit_price: Optional[Decimal] = Field(None, gt=0, description="Limit price per share (Required only for LIMIT orders)")