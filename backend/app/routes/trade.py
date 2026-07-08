# app/api/trade.py
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas.trade import StockBuy, StockSell
from app.models.users import User
from app.auth.dependencies import get_current_user

# Import the controller functions
from app.controller.buy import execute_buy
from app.controller.sell import execute_sell
from app.controller.cancel import cancel_order

router = APIRouter(prefix="/trade", tags=["Trading"])

@router.post("/buy", status_code=status.HTTP_201_CREATED)
async def buy_stock(
    payload: StockBuy, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    HTTP POST Route for purchasing stock.
    Delegates execution entirely to the Buy Controller.
    """
    return await execute_buy(payload=payload, db=db, current_user=current_user)

@router.post("/sell", status_code=status.HTTP_201_CREATED)
async def sell_stock(
    payload: StockSell, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    HTTP POST Route for selling stock.
    Delegates execution entirely to the Sell Controller.
    """
    return await execute_sell(payload=payload, db=db, current_user=current_user)

@router.post("/cancel/{order_id}", status_code=status.HTTP_200_OK)
async def cancel_stock_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    HTTP POST Route for cancelling a resting (PENDING) limit order.
    Delegates execution entirely to the Cancel Controller, which reverses
    the order's escrow (cash for BUY, shares for SELL) before marking it CANCELLED.
    """
    return await cancel_order(order_id=order_id, db=db, current_user=current_user)