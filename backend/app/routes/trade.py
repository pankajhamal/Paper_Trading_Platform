# app/api/trade.py
import logging
from datetime import datetime
from decimal import Decimal  # Required to handle Numeric(12, 2) columns safely
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas.trade import StockBuy
from app.models.stock import Stock
from app.models.wallet import Wallet
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction
from app.models.users import User
from app.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/trade", tags=["Trading"])

@router.post("/buy", status_code=status.HTTP_201_CREATED)
async def buy_stock(
    payload: StockBuy, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    symbol = payload.symbol.upper().strip()
    quantity = payload.quantity

    # 1. Verify Stock exists and has a valid price
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Stock '{symbol}' not found in the database."
        )

    price = stock.last_traded_price
    if price <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Trading is currently unavailable for this stock (price is zero or invalid)."
        )

    # Convert prices to Decimal to match your Numeric(12, 2) columns perfectly
    price_dec = Decimal(str(price))
    total_cost_dec = price_dec * Decimal(str(quantity))

    # 2. Open an Atomic Database Transaction Block
    try:
        # Fetch wallet with locking to prevent double-spending
        wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).with_for_update().first()
        
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Wallet not found for this user."
            )

        # Convert wallet balance to Decimal for safe comparison
        wallet_balance_dec = Decimal(str(wallet.balance))

        if wallet_balance_dec < total_cost_dec:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient balance. Required: Rs. {total_cost_dec:,.2f}, Available: Rs. {wallet_balance_dec:,.2f}"
            )

        # A. Deduct Money from Wallet (storing back as float or decimal depending on model types)
        # Assuming wallet.balance is a Float/Numeric. If it is Float, cast back to float.
        wallet.balance = float(wallet_balance_dec - total_cost_dec)
        
        if hasattr(current_user, 'balance'):
            current_user.balance = float(Decimal(str(current_user.balance)) - total_cost_dec)

        # B. Create or Update Portfolio Entry (table name is 'portfolio' in your model)
        portfolio_entry = db.query(Portfolio).filter(
            Portfolio.user_id == current_user.user_id,
            Portfolio.stock_id == stock.stock_id
        ).with_for_update().first()

        if portfolio_entry:
            # Weighted average price logic: (Old Qty * Old Price + New Qty * New Price) / Total Qty
            total_shares = portfolio_entry.quantity + quantity
            
            # both portfolio_entry.average_price and total_cost_dec are Decimals
            old_total_cost = portfolio_entry.quantity * portfolio_entry.average_price
            new_total_cost = total_cost_dec
            
            new_avg_price = (old_total_cost + new_total_cost) / total_shares
            
            portfolio_entry.quantity = total_shares
            portfolio_entry.average_price = new_avg_price  # Automatically rounds to (12, 2) in DB
        else:
            # Create a brand new portfolio record using your exact model
            portfolio_entry = Portfolio(
                user_id=current_user.user_id,
                stock_id=stock.stock_id,
                quantity=quantity,
                average_price=price_dec
            )
            db.add(portfolio_entry)

        # C. Log the Transaction using your exact Transaction columns
        transaction_log = Transaction(
            user_id=current_user.user_id,
            type="BUY",  # mapped to your 'type' column
            amount=total_cost_dec,  # mapped to your 'amount' column (Decimal)
            description=f"Purchased {quantity} shares of {symbol} at Rs. {price}",  # mapped to 'description'
            created_at=datetime.utcnow()  # mapped to your 'created_at' column
        )
        db.add(transaction_log)

        # Commit all operations together
        db.commit()

    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        logger.error(f"Error executing buy order for {symbol}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Transaction failed due to an internal database error."
        )

    return {
        "message": "Stock purchased successfully.",
        "symbol": symbol,
        "quantity_purchased": quantity,
        "price_per_share": price,
        "total_cost": float(total_cost_dec),
        "remaining_wallet_balance": wallet.balance
    }