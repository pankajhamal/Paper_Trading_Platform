# app/api/stocks.py
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.stock import Stock
from app.auth.dependencies import get_current_user
from app.models.users import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stocks", tags=["Stocks"])


@router.get("")
def list_stocks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the full list of tradable stocks with their latest price data,
    ordered by trading volume (most active first). Powers the Market screen.
    """
    stocks = db.query(Stock).order_by(Stock.volume.desc()).all()

    return [
        {
            "stock_id": stock.stock_id,
            "symbol": stock.symbol,
            "company_name": stock.company_name,
            "current_price": stock.last_traded_price,
            "change": stock.change,
            "percent_change": stock.percent_change,
            "volume": stock.volume,
            "open_price": stock.open_price,
            "high_price": stock.high_price,
            "low_price": stock.low_price,
        }
        for stock in stocks
    ]


@router.get("/{symbol}")
def get_stock_by_symbol(
    symbol: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches the details of a single stock by its ticker symbol (e.g., NABIL, NICA).
    Used by the React frontend order ticket to display live prices and calculate circuit limits.
    """
    symbol_clean = symbol.upper().strip()
    
    # Query the Stock table by symbol
    stock = db.query(Stock).filter(Stock.symbol == symbol_clean).first()
    
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock with symbol '{symbol_clean}' was not found in the database."
        )
        
    return {
        "stock_id": stock.stock_id,
        "symbol": stock.symbol,
        "company_name": stock.company_name,
        # We map last_traded_price as current_price to match the frontend key 'activeStock.current_price'
        "current_price": stock.last_traded_price, 
        "change": stock.change,
        "percent_change": stock.percent_change,
        "volume": stock.volume,
        "open_price": stock.open_price,
        "high_price": stock.high_price,
        "low_price": stock.low_price
    }