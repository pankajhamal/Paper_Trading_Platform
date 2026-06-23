# app/api/user.py
import logging
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.users import User
from app.models.wallet import Wallet
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction
from app.models.stock import Stock
from app.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)

# Prefixing the routes with "/users"
router = APIRouter(prefix="/users", tags=["User Profile & Assets"])


# 1. Fetch User Profile Details (GET /users/me)
@router.get("/me")
def get_user_profile(current_user: User = Depends(get_current_user)):
    """
    Returns the profile details of the currently logged-in user.
    """
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
    }


# 2. Fetch User's Wallet (GET /users/me/wallet)
@router.get("/me/wallet")
async def get_user_wallet(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the logged-in user's wallet balance.
    """
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).first()
    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Wallet not found."
        )
    return {
        "balance": wallet.balance,
        "currency": "NPR"
    }


# 3. Fetch User's Transaction History (GET /users/me/transactions)
@router.get("/me/transactions")
async def get_user_transactions(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the past trade transaction ledger for the logged-in user (most recent first).
    """
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.user_id
    ).order_by(Transaction.created_at.desc()).all()
    
    return [
        {
            "transaction_id": tx.transaction_id,
            "type": tx.type,
            "amount": float(tx.amount) if tx.amount else 0.0,
            "description": tx.description,
            "created_at": tx.created_at
        }
        for tx in transactions
    ]


# 4. Fetch User's Portfolio Details (GET /users/me/portfolio)
@router.get("/me/portfolio")
async def get_user_portfolio(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Calculates and returns the user's current stock holdings and total portfolio valuation.
    """
    portfolio_entries = db.query(Portfolio).filter(
        Portfolio.user_id == current_user.user_id
    ).all()
    
    holdings = []
    total_invested_value = 0.0
    total_current_value = 0.0

    for entry in portfolio_entries:
        stock = entry.stock
        if not stock:
            stock = db.query(Stock).filter(Stock.stock_id == entry.stock_id).first()
            
        if not stock:
            continue

        qty = entry.quantity
        avg_price = float(entry.average_price)
        current_price = float(stock.last_traded_price)

        invested = qty * avg_price
        current_val = qty * current_price
        profit_loss = current_val - invested
        profit_loss_percentage = (profit_loss / invested * 100) if invested > 0 else 0.0

        total_invested_value += invested
        total_current_value += current_val

        holdings.append({
            "symbol": stock.symbol,
            "company_name": stock.company_name,
            "quantity": qty,
            "average_price": round(avg_price, 2),
            "current_price": round(current_price, 2),
            "invested_value": round(invested, 2),
            "current_value": round(current_val, 2),
            "profit_loss": round(profit_loss, 2),
            "profit_loss_percentage": round(profit_loss_percentage, 2)
        })

    total_profit_loss = total_current_value - total_invested_value
    total_profit_loss_percentage = (total_profit_loss / total_invested_value * 100) if total_invested_value > 0 else 0.0

    return {
        "summary": {
            "total_invested_value": round(total_invested_value, 2),
            "total_current_value": round(total_current_value, 2),
            "total_profit_loss": round(total_profit_loss, 2),
            "total_profit_loss_percentage": round(total_profit_loss_percentage, 2)
        },
        "holdings": holdings
    }