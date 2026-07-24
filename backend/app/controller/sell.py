# app/controllers/sell.py
import logging
from datetime import datetime
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.trade import StockSell
from app.models.stock import Stock
from app.models.wallet import Wallet
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction
from app.models.order import Order
from app.models.users import User
from app.service.depth import BIDS, SOURCE_LABELS, SOURCE_SUMMARIES, resolve_levels

logger = logging.getLogger(__name__)

async def execute_sell(payload: StockSell, db: Session, current_user: User) -> dict:
    symbol = payload.symbol.upper().strip()
    quantity = payload.quantity
    order_type = getattr(payload, "order_type", "MARKET").upper().strip()
    limit_price = getattr(payload, "limit_price", None)

    # 1. Verify Stock exists
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Stock '{symbol}' not found in the database."
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
        if (limit_price_dec * Decimal("10")) % Decimal("1") != Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid limit price. NEPSE tick size requires prices to be in multiples of Rs. 0.10."
            )

    # 2. Retrieve the bid side of the order book. Resolved BEFORE the portfolio
    #    row lock is taken, because this can hit the bridge over HTTP and a lock
    #    must never be held across a network call.
    buy_levels, depth_source = await resolve_levels(
        symbol, BIDS, float(stock.last_traded_price or 0)
    )
    execution_mode = SOURCE_LABELS[depth_source]

    # 3. Database Transaction block (Portfolio Verification & Locking)
    try:
        portfolio_entry = db.query(Portfolio).filter(
            Portfolio.user_id == current_user.user_id,
            Portfolio.stock_id == stock.stock_id
        ).with_for_update().first()

        # Check if user has enough shares in portfolio (for either market or limit sell)
        if not portfolio_entry or portfolio_entry.quantity < quantity:
            available_qty = portfolio_entry.quantity if portfolio_entry else 0
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient holdings. You own {available_qty} shares of {symbol}, but requested to sell {quantity}."
            )

        # 4. Matching Engine (Walk the Bids)
        remaining_qty_to_sell = quantity
        total_revenue_executed = 0.0
        price_breakdown = []

        for level in buy_levels:
            if remaining_qty_to_sell <= 0:
                break

            level_qty = int(level.get("quantity") or 0)
            level_price = float(level.get("price") or level.get("rate") or level.get("orderBookOrderPrice") or 0.0)

            if level_qty <= 0 or level_price <= 0:
                continue

            # Limit Sell Rule: Stop selling if buyer bids below our limit price
            if order_type == "LIMIT" and level_price < float(limit_price_dec):
                break

            qty_to_take = min(remaining_qty_to_sell, level_qty)
            total_revenue_executed += qty_to_take * level_price
            price_breakdown.append(f"{qty_to_take} shares @ Rs. {level_price}")
            remaining_qty_to_sell -= qty_to_take

        # Market Rule: Fail if supply is insufficient
        if order_type == "MARKET" and remaining_qty_to_sell > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient market demand. You wanted to sell {quantity} shares, but there are only {quantity - remaining_qty_to_sell} buyers available."
            )

        # Calculate final pricing allocations
        revenue_dec = Decimal(str(total_revenue_executed))
        sold_qty = quantity - remaining_qty_to_sell

        average_price_dec = Decimal("0.0")
        if sold_qty > 0:
            average_price_dec = revenue_dec / sold_qty

        # A. Deduct total sold + pending shares from portfolio (locks assets in escrow)
        portfolio_entry.quantity -= quantity
        if portfolio_entry.quantity == 0:
            db.delete(portfolio_entry)

        # B. Credit Wallet only for the actually filled shares
        wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).with_for_update().first()
        if not wallet:
            raise HTTPException(status_code=404, detail="Wallet not found.")

        wallet_balance_dec = Decimal(str(wallet.balance))
        wallet.balance = float(wallet_balance_dec + revenue_dec)
        
        if hasattr(current_user, 'balance'):
            current_user.balance = float(Decimal(str(current_user.balance)) + revenue_dec)

        # C. Log Filled Transaction
        if sold_qty > 0:
            breakdown_str = ", ".join(price_breakdown)
            db.add(Transaction(
                user_id=current_user.user_id,
                type="SELL",
                amount=revenue_dec,
                description=f"Sold {sold_qty} shares of {symbol} [{execution_mode}]. Breakdown: {breakdown_str}",
                created_at=datetime.utcnow()
            ))

        # D. Log Asset Escrow transaction for pending sell portion
        if remaining_qty_to_sell > 0:
            db.add(Transaction(
                user_id=current_user.user_id,
                type="ASSET_ESCROW_HOLD",
                amount=Decimal("0.0"),  # No cash transaction for holding shares
                description=f"Asset hold for {remaining_qty_to_sell} pending shares of {symbol} Limit Sell @ Rs. {limit_price_dec:.2f}",
                created_at=datetime.utcnow()
            ))

        # E. Record Order
        final_status = "COMPLETED" if remaining_qty_to_sell == 0 else "PENDING"
        db.add(Order(
            user_id=current_user.user_id,
            stock_id=stock.stock_id,
            symbol=symbol,
            order_type=order_type,
            transaction_type="SELL",
            quantity=quantity,
            remaining_quantity=remaining_qty_to_sell,
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
        logger.error(f"Error executing sell order for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Transaction failed due to an internal database error.")

    execution_mode_str = SOURCE_SUMMARIES[depth_source]

    return {
        "message": f"Order processed successfully [{execution_mode_str}]. Status: {final_status}.",
        "order_type": order_type,
        "depth_source": depth_source,
        "symbol": symbol,
        "quantity_requested": quantity,
        "quantity_sold": sold_qty,
        "quantity_pending": remaining_qty_to_sell,
        "weighted_average_price": float(average_price_dec),
        "total_revenue": float(revenue_dec),
        "remaining_wallet_balance": wallet.balance
    }