# app/controller/watchlist.py
"""
Watchlist controller.

Lets a user follow stocks they care about. Each entry is a (user, stock) pair;
the GET path joins live price data from the Stock table so the frontend can
render the same columns as the Market screen.
"""
import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.stock import Stock
from app.models.watchlist import Watchlist
from app.models.users import User

logger = logging.getLogger(__name__)


def _serialize(stock: Stock, created_at) -> dict:
    return {
        "stock_id": stock.stock_id,
        "symbol": stock.symbol,
        "company_name": stock.company_name,
        "current_price": stock.last_traded_price,
        "change": stock.change,
        "percent_change": stock.percent_change,
        "volume": stock.volume,
        "added_at": created_at,
    }


def get_watchlist(db: Session, current_user: User) -> list:
    """Return the user's watched stocks with current price data (newest first)."""
    entries = (
        db.query(Watchlist)
        .filter(Watchlist.user_id == current_user.user_id)
        .order_by(Watchlist.created_at.desc())
        .all()
    )

    items = []
    for entry in entries:
        stock = entry.stock or db.query(Stock).filter(Stock.stock_id == entry.stock_id).first()
        if stock:
            items.append(_serialize(stock, entry.created_at))
    return items


def add_to_watchlist(symbol: str, db: Session, current_user: User) -> dict:
    """Add a stock (by symbol) to the user's watchlist."""
    symbol_clean = (symbol or "").upper().strip()
    if not symbol_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A stock symbol is required.",
        )

    stock = db.query(Stock).filter(Stock.symbol == symbol_clean).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock '{symbol_clean}' was not found.",
        )

    existing = (
        db.query(Watchlist)
        .filter(
            Watchlist.user_id == current_user.user_id,
            Watchlist.stock_id == stock.stock_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{symbol_clean} is already in your watchlist.",
        )

    try:
        entry = Watchlist(user_id=current_user.user_id, stock_id=stock.stock_id)
        db.add(entry)
        db.commit()
        db.refresh(entry)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to add {symbol_clean} to watchlist: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add stock to watchlist.",
        )

    return {
        "message": f"{symbol_clean} added to watchlist.",
        "item": _serialize(stock, entry.created_at),
    }


def remove_from_watchlist(symbol: str, db: Session, current_user: User) -> dict:
    """Remove a stock (by symbol) from the user's watchlist."""
    symbol_clean = (symbol or "").upper().strip()

    stock = db.query(Stock).filter(Stock.symbol == symbol_clean).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock '{symbol_clean}' was not found.",
        )

    entry = (
        db.query(Watchlist)
        .filter(
            Watchlist.user_id == current_user.user_id,
            Watchlist.stock_id == stock.stock_id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{symbol_clean} is not in your watchlist.",
        )

    try:
        db.delete(entry)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to remove {symbol_clean} from watchlist: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove stock from watchlist.",
        )

    return {"message": f"{symbol_clean} removed from watchlist.", "symbol": symbol_clean}
