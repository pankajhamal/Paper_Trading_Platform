# app/routes/watchlist.py
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.users import User
from app.auth.dependencies import get_current_user
from app.controller.watchlist import (
    get_watchlist,
    add_to_watchlist,
    remove_from_watchlist,
)

router = APIRouter(prefix="/watchlist", tags=["Watchlist"])


class WatchlistAdd(BaseModel):
    symbol: str


@router.get("")
def read_watchlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's watched stocks with live price data."""
    return get_watchlist(db=db, current_user=current_user)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_watchlist_item(
    payload: WatchlistAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a stock to the current user's watchlist."""
    return add_to_watchlist(symbol=payload.symbol, db=db, current_user=current_user)


@router.delete("/{symbol}")
def delete_watchlist_item(
    symbol: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a stock from the current user's watchlist."""
    return remove_from_watchlist(symbol=symbol, db=db, current_user=current_user)
