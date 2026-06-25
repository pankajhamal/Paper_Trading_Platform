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
from app.service.cache import LIVE_MARKET_DEPTH  # Import RAM cache
from app.service.nepse import generate_simulated_depth  # Import offline fallback helper

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

    # 1. Verify Stock exists in your local SQL DB
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Stock '{symbol}' not found in the database. Please wait for background sync."
        )

    # 2. Retrieve Order Book from RAM Cache (Or generate Simulated Depth if off-hours)
    sell_levels = []
    execution_mode = "Live Market Depth (RAM Cache)"

    cached_data = LIVE_MARKET_DEPTH.get(symbol)
    if cached_data:
        # NEPSE standard JSON key for asks is 'sellMarketDepthList'
        sell_levels = cached_data.get("sellMarketDepthList") or []

    # If cache is empty (bridge offline or market closed), generate Synthetic Depth in RAM
    if not sell_levels:
        execution_mode = "Simulated Depth (EOD Price Fallback)"
        sell_levels = generate_simulated_depth(stock.last_traded_price)

    # 3. THE ORDER BOOK WALK ENGINE (The core math)
    remaining_qty_to_buy = quantity
    total_cost = 0.0
    price_breakdown = []

    for level in sell_levels:
        level_qty = int(level.get("quantity") or 0)
        level_price = float(level.get("price") or level.get("rate") or 0.0)

        if level_qty <= 0 or level_price <= 0:
            continue

        if remaining_qty_to_buy <= level_qty:
            # We can fulfill the entire remaining order at this price level
            total_cost += remaining_qty_to_buy * level_price
            price_breakdown.append(f"{remaining_qty_to_buy} shares @ Rs. {level_price}")
            remaining_qty_to_buy = 0
            break
        else:
            # Consume this entire price level and move to the next higher level
            total_cost += level_qty * level_price
            price_breakdown.append(f"{level_qty} shares @ Rs. {level_price}")
            remaining_qty_to_buy -= level_qty

    # If the order book (real or simulated) ran out of sellers before order was complete
    if remaining_qty_to_buy > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Insufficient market supply. You requested {quantity} shares, "
                f"but only {quantity - remaining_qty_to_buy} shares are available for purchase."
            )
        )

    # Calculate final weighted average purchase price
    average_price = total_cost / quantity

    # Convert values to Decimal for database type-safety
    total_cost_dec = Decimal(str(total_cost))
    average_price_dec = Decimal(str(average_price))

    # 4. Open an Atomic Database Transaction Block
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

        # A. Deduct Money from Wallet (storing back as float)
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
                average_price=average_price_dec
            )
            db.add(portfolio_entry)

        # C. Log the Transaction using your exact Transaction columns
        breakdown_str = ", ".join(price_breakdown)
        transaction_log = Transaction(
            user_id=current_user.user_id,
            type="BUY",  # mapped to your 'type' column
            amount=total_cost_dec,  # mapped to your 'amount' column (Decimal)
            description=f"Purchased {quantity} shares of {symbol}. Mode: {execution_mode}. Breakdown: {breakdown_str}",  # mapped to 'description'
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
        "message": f"Stock purchased successfully [{execution_mode}].",
        "symbol": symbol,
        "quantity_purchased": quantity,
        "weighted_average_price": float(average_price_dec),
        "total_cost": float(total_cost_dec),
        "execution_breakdown": price_breakdown,
        "remaining_wallet_balance": wallet.balance
    }

#Sell stock route and logic # app/api/trade.py (Append this route to your existing trade file)
from app.schemas.trade import StockSell
from app.service.nepse import generate_simulated_bid_depth  # Import the new helper

@router.post("/sell", status_code=status.HTTP_201_CREATED)
async def sell_stock(
    payload: StockSell, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    symbol = payload.symbol.upper().strip()
    quantity = payload.quantity

    # 1. Verify Stock exists in your local SQL DB
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Stock '{symbol}' not found in database."
        )

    # 2. Open Database Transaction with pessimistic locking
    try:
        # A. Verify User owns enough shares of this stock in their Portfolio
        portfolio_entry = db.query(Portfolio).filter(
            Portfolio.user_id == current_user.user_id,
            Portfolio.stock_id == stock.stock_id
        ).with_for_update().first()

        if not portfolio_entry or portfolio_entry.quantity < quantity:
            available_qty = portfolio_entry.quantity if portfolio_entry else 0
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient holdings. You own {available_qty} shares of {symbol}, but requested to sell {quantity}."
            )

        # B. Retrieve Order Book from RAM Cache (Or generate Simulated Bids if off-hours)
        buy_levels = []
        execution_mode = "Live Market Depth (RAM Cache)"

        cached_data = LIVE_MARKET_DEPTH.get(symbol)
        if cached_data:
            # We look at 'buyMarketDepthList' (bids) because we are selling to pending buyers
            buy_levels = cached_data.get("buyMarketDepthList") or []

        # If cache is empty (Market is closed or offline), generate Synthetic Bids in RAM
        if not buy_levels:
            execution_mode = "Simulated Depth (EOD Price Fallback)"
            buy_levels = generate_simulated_bid_depth(stock.last_traded_price)

        # C. WALK THE ORDER BOOK BIDS (The selling math)
        remaining_qty_to_sell = quantity
        total_revenue = 0.0
        price_breakdown = []

        for level in buy_levels:
            level_qty = int(level.get("quantity") or 0)
            level_price = float(level.get("price") or 0.0)

            if level_qty <= 0 or level_price <= 0:
                continue

            if remaining_qty_to_sell <= level_qty:
                # Fully complete our sale at this bid price level
                total_revenue += remaining_qty_to_sell * level_price
                price_breakdown.append(f"{remaining_qty_to_sell} shares @ Rs. {level_price}")
                remaining_qty_to_sell = 0
                break
            else:
                # Consume this entire buyer queue and move to the next lower bid price
                total_revenue += level_qty * level_price
                price_breakdown.append(f"{level_qty} shares @ Rs. {level_price}")
                remaining_qty_to_sell -= level_qty

        # If we ran out of buyers on the book before our order completed
        if remaining_qty_to_sell > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient market demand. You wanted to sell {quantity} shares, "
                    f"but there are only {quantity - remaining_qty_to_sell} buyers available."
                )
            )

        average_price = total_revenue / quantity

        # Convert to Decimal for database type-safety
        total_revenue_dec = Decimal(str(total_revenue))
        average_price_dec = Decimal(str(average_price))

        # D. Credit Wallet
        wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).with_for_update().first()
        if not wallet:
            raise HTTPException(status_code=404, detail="Wallet not found.")

        wallet_balance_dec = Decimal(str(wallet.balance))
        wallet.balance = float(wallet_balance_dec + total_revenue_dec)
        
        if hasattr(current_user, 'balance'):
            current_user.balance = float(Decimal(str(current_user.balance)) + total_revenue_dec)

        # E. Update Portfolio
        # NOTE: Selling shares does NOT change the 'average_price' of remaining shares
        portfolio_entry.quantity -= quantity
        
        if portfolio_entry.quantity == 0:
            # Delete portfolio record entirely if they own 0 shares (keeps DB clean)
            db.delete(portfolio_entry)

        # F. Log Transaction using your exact Transaction columns
        breakdown_str = ", ".join(price_breakdown)
        transaction_log = Transaction(
            user_id=current_user.user_id,
            type="SELL",
            amount=total_revenue_dec,
            description=f"Sold {quantity} shares of {symbol}. Mode: {execution_mode}. Breakdown: {breakdown_str}",
            created_at=datetime.utcnow()
        )
        db.add(transaction_log)

        # Commit all modifications together
        db.commit()

    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        logger.error(f"Error executing sell order for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Transaction failed due to an internal database error.")

    # Determine execution mode string for response
    execution_mode_str = "Offline (Closing Price)" if not cached_data else "Live (Market Depth)"

    return {
        "message": f"Stock sold successfully [{execution_mode_str}].",
        "symbol": symbol,
        "quantity_sold": quantity,
        "weighted_average_price": float(average_price_dec),
        "total_revenue": float(total_revenue_dec),
        "execution_breakdown": price_breakdown,
        "remaining_wallet_balance": wallet.balance
    }