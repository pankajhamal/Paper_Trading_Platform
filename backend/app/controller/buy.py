# app/controllers/buy.py
import logging
from datetime import datetime
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.trade import StockBuy
from app.models.stock import Stock
from app.models.wallet import Wallet
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction
from app.models.order import Order
from app.models.users import User
from app.service.cache import LIVE_MARKET_DEPTH
from app.service.nepse import generate_simulated_depth

logger = logging.getLogger(__name__)

async def execute_buy(payload: StockBuy, db: Session, current_user: User) -> dict:
    symbol = payload.symbol.upper().strip()
    quantity = payload.quantity
    order_type = getattr(payload, "order_type", "MARKET").upper().strip()
    limit_price = getattr(payload, "limit_price", None)

    # 1. Verify Stock exists
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Stock '{symbol}' not found in the database. Please wait for background sync."
        )

    # --- NEPSE LIMIT PRICE VALIDATIONS ---
    limit_price_dec = Decimal("0.0")
    if order_type == "LIMIT":
        if limit_price is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Limit price is required for LIMIT orders."
            )
        
        limit_price_dec = Decimal(str(limit_price))
        last_price_dec = Decimal(str(stock.last_traded_price))

        # A. NEPSE Circuit Filter Check (+/- 10% of last price)
        lower_circuit = last_price_dec * Decimal("0.90")
        upper_circuit = last_price_dec * Decimal("1.10")

        if limit_price_dec < lower_circuit or limit_price_dec > upper_circuit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Limit price Rs. {limit_price_dec:,.2f} violates NEPSE circuit filter. "
                    f"Must be between Rs. {lower_circuit:,.2f} and Rs. {upper_circuit:,.2f} "
                    f"(+/- 10% of last traded price Rs. {last_price_dec:,.2f})."
                )
            )

        # B. NEPSE Tick Size Check (Must be multiples of Rs. 0.10)
        # We multiply by 10 and verify if the result is an exact whole integer
        if (limit_price_dec * Decimal("10")) % Decimal("1") != Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid limit price. NEPSE tick size requires prices to be in multiples of Rs. 0.10."
            )

    # 2. Retrieve Order Book from RAM Cache or Fallback
    sell_levels = []
    execution_mode = "Live Market Depth (RAM Cache)"
    is_live_execution = True

    cached_data = LIVE_MARKET_DEPTH.get(symbol)
    if cached_data:
        market_depth = cached_data.get("marketDepth") or cached_data
        sell_levels = market_depth.get("sellMarketDepthList") or []

    if not sell_levels:
        is_live_execution = False
        execution_mode = "Simulated Depth (EOD Price Fallback)"
        sell_levels = generate_simulated_depth(stock.last_traded_price)

    # 3. Matching Engine (Walk the Asks)
    remaining_qty_to_buy = quantity
    total_cost_executed = 0.0
    price_breakdown = []

    for level in sell_levels:
        if remaining_qty_to_buy <= 0:
            break

        level_qty = int(level.get("quantity") or 0)
        level_price = float(level.get("price") or level.get("rate") or level.get("orderBookOrderPrice") or 0.0)

        if level_qty <= 0 or level_price <= 0:
            continue

        # Limit Rule: Stop buying if seller price exceeds user's limit
        if order_type == "LIMIT" and level_price > float(limit_price_dec):
            break

        qty_to_take = min(remaining_qty_to_buy, level_qty)
        total_cost_executed += qty_to_take * level_price
        price_breakdown.append(f"{qty_to_take} shares @ Rs. {level_price}")
        remaining_qty_to_buy -= qty_to_take

    # Market Rule: Fail if supply is insufficient
    if order_type == "MARKET" and remaining_qty_to_buy > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient market supply. Requested {quantity}, but only {quantity - remaining_qty_to_buy} available."
        )

    # Calculate financial allocations
    executed_cost_dec = Decimal(str(total_cost_executed))
    escrow_cost_dec = Decimal("0.0")
    
    # If it is a Limit order and we have unfilled shares, escrow the remaining funds
    if order_type == "LIMIT" and remaining_qty_to_buy > 0:
        escrow_cost_dec = Decimal(str(remaining_qty_to_buy)) * limit_price_dec

    total_required_funds = executed_cost_dec + escrow_cost_dec
    purchased_qty = quantity - remaining_qty_to_buy

    average_price_dec = Decimal("0.0")
    if purchased_qty > 0:
        average_price_dec = executed_cost_dec / purchased_qty

    # 4. Database Transaction Block
    try:
        wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).with_for_update().first()
        if not wallet:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found.")

        wallet_balance_dec = Decimal(str(wallet.balance))
        if wallet_balance_dec < total_required_funds:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient balance. Required: Rs. {total_required_funds:,.2f}"
            )

        # A. Deduct total funds (Executed + Escrowed)
        wallet.balance = float(wallet_balance_dec - total_required_funds)
        if hasattr(current_user, 'balance'):
            current_user.balance = float(Decimal(str(current_user.balance)) - total_required_funds)

        # B. Update Portfolio
        if purchased_qty > 0:
            portfolio_entry = db.query(Portfolio).filter(
                Portfolio.user_id == current_user.user_id,
                Portfolio.stock_id == stock.stock_id
            ).with_for_update().first()

            if portfolio_entry:
                total_shares = portfolio_entry.quantity + purchased_qty
                old_total_cost = portfolio_entry.quantity * portfolio_entry.average_price
                new_avg_price = (old_total_cost + executed_cost_dec) / total_shares
                portfolio_entry.quantity = total_shares
                portfolio_entry.average_price = new_avg_price
            else:
                portfolio_entry = Portfolio(
                    user_id=current_user.user_id,
                    stock_id=stock.stock_id,
                    quantity=purchased_qty,
                    average_price=average_price_dec
                )
                db.add(portfolio_entry)

            # Log execution transaction
            db.add(Transaction(
                user_id=current_user.user_id,
                type="BUY",
                amount=executed_cost_dec,
                description=f"Purchased {purchased_qty} shares of {symbol} [{execution_mode}]. Breakdown: {', '.join(price_breakdown)}",
                created_at=datetime.utcnow()
            ))

        # C. Log Escrow Hold transaction
        if escrow_cost_dec > 0:
            db.add(Transaction(
                user_id=current_user.user_id,
                type="ESCROW_HOLD",
                amount=escrow_cost_dec,
                description=f"Escrow hold for {remaining_qty_to_buy} pending shares of {symbol} Limit Buy @ Rs. {limit_price_dec:.2f}",
                created_at=datetime.utcnow()
            ))

        # D. Record Order
        final_status = "COMPLETED" if remaining_qty_to_buy == 0 else "PENDING"
        db.add(Order(
            user_id=current_user.user_id,
            stock_id=stock.stock_id,
            symbol=symbol,
            order_type=order_type,
            transaction_type="BUY",
            quantity=quantity,
            remaining_quantity=remaining_qty_to_buy,
            limit_price=float(limit_price_dec) if order_type == "LIMIT" else None,
            status=final_status,
            created_at=datetime.utcnow()
        ))

        db.commit()

    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        logger.error(f"Error executing buy order for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Transaction failed due to an internal database error.")

    execution_mode_str = "Live (Market Depth)" if is_live_execution else "Offline (Closing Price)"

    return {
        "message": f"Order processed successfully [{execution_mode_str}]. Status: {final_status}.",
        "order_type": order_type,
        "symbol": symbol,
        "quantity_requested": quantity,
        "quantity_filled": purchased_qty,
        "quantity_pending": remaining_qty_to_buy,
        "weighted_average_price": float(average_price_dec),
        "total_executed_cost": float(executed_cost_dec),
        "total_escrow_hold": float(escrow_cost_dec),
        "remaining_wallet_balance": wallet.balance
    }