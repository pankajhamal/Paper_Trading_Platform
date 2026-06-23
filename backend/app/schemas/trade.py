from pydantic import BaseModel, Field

class StockBuy(BaseModel):
  symbol: str = Field(..., description="Stock symbol eg. NABIL")
  quantity: int = Field(..., gt=0, description="Quantity of share to buy(must be greater than 0)")
  
