from sqlalchemy.orm import Session
from app.models.stock import Stock
from app.service.nepse import NepseService
from fastapi import HTTPException
import logging

nepse_service = NepseService()

logger = logging.getLogger(__name__)

async def get_or_update_stock(db: Session, symbol: str) -> Stock:
  symbol = symbol.upper().strip()

  #Fetch live data from our Bun service 
  try:
    live_price, company_name = await nepse_service.get_live_price_and_name(symbol)
  except Exception as e:
    #Fallback to Nepse local DB if NEPSE service is unreachable
    existing_stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if existing_stock:
      return existing_stock
    raise e
  
  #Update DB with live values
  existing_stock = db.query(Stock).filter(Stock.symbol == symbol).first()
  if existing_stock:
    existing_stock.last_traded_price = live_price
    existing_stock.company_name = company_name
  else:
    existing_stock = Stock(
      symbol = symbol,
      company_name = company_name,
      last_traded_price = live_price
    )
    db.add(existing_stock)
  
  try:
    db.commit()
    db.refresh(existing_stock)
  except Exception as e:
    db.rollback()
    logger.error(f"Failed to commit stock {symbol} to database: {e}")

  return existing_stock