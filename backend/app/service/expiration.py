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
            # Snapshot candidate IDs only — each order is re-fetched under a row
            # lock below so we never reverse escrow on an order that the matcher
            # or a cancel is concurrently completing (which would double-release).
            pending_order_ids = [
                row[0]
                for row in db.query(Order.order_id)
                .filter(func.lower(Order.status) == "pending")
                .all()
            ]

            now_utc = datetime.utcnow()
            expired_count = 0

            for order_id in pending_order_ids:
                try:
                    # Lock the order row. SKIP LOCKED means if a concurrent cancel
                    # or fill holds this order, we skip it this cycle rather than
                    # block — it'll be retried next tick.
                    order = (
                        db.query(Order)
                        .filter(Order.order_id == order_id)
                        .with_for_update(skip_locked=True)
                        .first()
                    )
                    if order is None:
                        continue

                    # Re-validate UNDER the lock: a matcher fill or cancel may have
                    # completed between the scan and this lock, so the order may no
                    # longer be pending. Never reverse escrow on a stale status.
                    if (order.status or "").lower() != "pending":
                        db.rollback()
                        continue

                    order_age_seconds = (now_utc - order.created_at).total_seconds()
                    if order_age_seconds < EXPIRATION_LIMIT_SECONDS:
                        db.rollback()  # not old enough — release the lock
                        continue

                    order.status = "EXPIRED"
                    remaining_qty = order.remaining_quantity
                    transaction_type = (order.transaction_type or "").upper()

                    if transaction_type == "SELL":
                        # SELL escrow is SHARES: return them to the portfolio.
                        portfolio_entry = db.query(Portfolio).filter(
                            Portfolio.user_id == order.user_id,
                            Portfolio.stock_id == order.stock_id
                        ).with_for_update().first()

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

                        wallet = db.query(Wallet).filter(
                            Wallet.user_id == order.user_id
                        ).with_for_update().first()
                        if wallet:
                            wallet.balance = Decimal(str(wallet.balance)) + refund_amount

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

                    # Commit per-order so one bad row can't roll back the batch.
                    db.commit()
                    expired_count += 1
                except Exception as e:
                    db.rollback()
                    logger.error(f"Failed to expire order #{order_id}: {e}")

            if expired_count > 0:
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