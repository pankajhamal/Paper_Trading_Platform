# app/services/expiration.py
import asyncio
import logging
from datetime import datetime
from decimal import Decimal

from app.database.config import settings
from app.database.connection import get_db
from app.models.order import Order
from app.models.wallet import Wallet
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction
from sqlalchemy import func

logger = logging.getLogger(__name__)

async def cancel_expired_daily_orders():
    """
    Background task that expires stale pending limit orders and reverses their
    escrow back to the user:
      - BUY  -> refund the escrowed cash (remaining_qty * limit_price) to wallet
      - SELL -> restore the escrowed shares (remaining_qty) to the portfolio
    """
    # Wait 10 seconds on startup once to let the main server fully boot
    await asyncio.sleep(10)

    # Order lifetime is configurable (see Settings.ORDER_EXPIRY_MINUTES)
    EXPIRATION_LIMIT_SECONDS = settings.ORDER_EXPIRY_MINUTES * 60

    while True:
        db_generator = get_db()
        db = next(db_generator)
        
        try:
            # 1. Fetch all pending orders
            pending_orders = db.query(Order).filter(func.lower(Order.status) == "pending").all()
            
            if pending_orders:
                now_utc = datetime.utcnow()
                expired_count = 0
                
                for order in pending_orders:
                    # Calculate the age of the order in seconds
                    # Since order.created_at is stored in UTC, we subtract from datetime.utcnow()
                    order_age_seconds = (now_utc - order.created_at).total_seconds()
                    
                    # If the order has exceeded its configured lifetime
                    if order_age_seconds >= EXPIRATION_LIMIT_SECONDS:
                        # Update order status to EXPIRED
                        order.status = "EXPIRED"
                        expired_count += 1

                        remaining_qty = order.remaining_quantity
                        transaction_type = (order.transaction_type or "").upper()

                        if transaction_type == "SELL":
                            # SELL escrow is SHARES: return them to the portfolio.
                            portfolio_entry = db.query(Portfolio).filter(
                                Portfolio.user_id == order.user_id,
                                Portfolio.stock_id == order.stock_id
                            ).first()

                            if portfolio_entry:
                                portfolio_entry.quantity += remaining_qty
                            else:
                                portfolio_entry = Portfolio(
                                    user_id=order.user_id,
                                    stock_id=order.stock_id,
                                    quantity=remaining_qty,
                                    average_price=Decimal(str(order.limit_price))
                                )
                                db.add(portfolio_entry)

                            db.add(Transaction(
                                user_id=order.user_id,
                                type="ASSET_ESCROW_RELEASE",
                                amount=Decimal("0.0"),
                                description=(
                                    f"Returned {remaining_qty} unsold shares of {order.symbol} "
                                    f"to portfolio (expired Limit Sell)."
                                ),
                                created_at=datetime.utcnow()
                            ))
                        else:
                            # BUY escrow is CASH: refund (remaining_qty * limit_price).
                            refund_amount = Decimal(str(remaining_qty)) * Decimal(str(order.limit_price))

                            wallet = db.query(Wallet).filter(Wallet.user_id == order.user_id).first()
                            if wallet:
                                wallet.balance = float(Decimal(str(wallet.balance)) + refund_amount)

                            db.add(Transaction(
                                user_id=order.user_id,
                                type="ESCROW_RELEASE",
                                amount=refund_amount,
                                description=(
                                    f"Refund of Rs. {refund_amount:,.2f} for expired {order.symbol} "
                                    f"Limit Buy (unfilled {remaining_qty} shares)."
                                ),
                                created_at=datetime.utcnow()
                            ))
                
                if expired_count > 0:
                    db.commit()
                    logger.info(
                        f"Expired {expired_count} pending orders "
                        f"(older than {settings.ORDER_EXPIRY_MINUTES} min) and reversed their escrow."
                    )

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to process order expirations: {e}")
        finally:
            db.close()

        await asyncio.sleep(settings.EXPIRY_SCAN_INTERVAL_SECONDS)