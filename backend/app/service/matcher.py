# app/service/matcher.py
"""
Limit-order matching engine.

Runs as a background task. On every cycle it scans all PENDING limit orders
and tries to fill their remaining quantity against the current order book
(live NEPSE depth from the RAM cache, or a simulated fallback book).

Escrow model (must mirror what buy.py / sell.py set aside at placement):
  - Limit BUY: cash was deducted at `remaining_quantity * limit_price`.
    When we fill `f` shares for actual `cost`, we release the over-hold
    (`f * limit_price - cost`) back to the wallet, since we always escrow at
    the worst-case limit price but execute at the (cheaper) market price.
  - Limit SELL: shares were removed from the portfolio at placement.
    When we fill `f` shares we simply credit the sale revenue to the wallet;
    there is nothing to add back to the portfolio.
"""
import asyncio
import logging
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.config import settings
from app.database.connection import get_db
from app.models.order import Order
from app.models.stock import Stock
from app.models.wallet import Wallet
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction
from app.service.cache import LIVE_MARKET_DEPTH
from app.service.nepse import generate_simulated_depth, generate_simulated_bid_depth

logger = logging.getLogger(__name__)


def _get_depth_levels(symbol: str, side: str, fallback_price: float) -> list:
    """
    Return order-book levels for a symbol.

    side == "sell" -> asks (used to fill a BUY)
    side == "buy"  -> bids (used to fill a SELL)

    Uses the live RAM cache when available, otherwise a simulated book built
    around the stock's last traded price (same fallback buy.py / sell.py use).
    """
    cached_data = LIVE_MARKET_DEPTH.get(symbol)
    if cached_data:
        market_depth = cached_data.get("marketDepth") or cached_data
        key = "sellMarketDepthList" if side == "sell" else "buyMarketDepthList"
        levels = market_depth.get(key) or []
        if levels:
            return levels

    # Fallback: simulated book around the last known price
    if side == "sell":
        return generate_simulated_depth(fallback_price)
    return generate_simulated_bid_depth(fallback_price)


def _walk_levels(levels: list, remaining_qty: int, limit_price: Decimal, side: str):
    """
    Walk a list of price levels and accumulate fills up to remaining_qty.

    side == "sell": we are BUYING, take levels where price <= limit_price.
    side == "buy":  we are SELLING, take levels where price >= limit_price.

    Returns (filled_qty, total_value, breakdown_list).
    """
    filled_qty = 0
    total_value = Decimal("0.0")
    breakdown = []

    for level in levels:
        if remaining_qty <= 0:
            break

        level_qty = int(level.get("quantity") or 0)
        level_price = float(
            level.get("price")
            or level.get("rate")
            or level.get("orderBookOrderPrice")
            or 0.0
        )

        if level_qty <= 0 or level_price <= 0:
            continue

        level_price_dec = Decimal(str(level_price))

        # Respect the limit price on the correct side of the book
        if side == "sell" and level_price_dec > limit_price:
            break
        if side == "buy" and level_price_dec < limit_price:
            break

        take = min(remaining_qty, level_qty)
        total_value += Decimal(str(take)) * level_price_dec
        breakdown.append(f"{take} shares @ Rs. {level_price}")
        remaining_qty -= take
        filled_qty += take

    return filled_qty, total_value, breakdown


def _fill_buy(order: Order, db: Session) -> int:
    """Try to fill a pending limit BUY. Returns shares newly filled."""
    stock = db.query(Stock).filter(Stock.stock_id == order.stock_id).first()
    if not stock:
        return 0

    limit_price = Decimal(str(order.limit_price))
    levels = _get_depth_levels(order.symbol, "sell", stock.last_traded_price)
    filled_qty, cost, breakdown = _walk_levels(
        levels, order.remaining_quantity, limit_price, "sell"
    )
    if filled_qty <= 0:
        return 0

    wallet = (
        db.query(Wallet)
        .filter(Wallet.user_id == order.user_id)
        .with_for_update()
        .first()
    )
    if not wallet:
        return 0

    # Release the difference between what we escrowed (at limit price) and the
    # actual execution cost back to the wallet.
    escrow_held = Decimal(str(filled_qty)) * limit_price
    refund = escrow_held - cost
    if refund > 0:
        wallet.balance = float(Decimal(str(wallet.balance)) + refund)

    avg_price = cost / Decimal(str(filled_qty))

    # Update or create the portfolio holding at the execution price
    portfolio_entry = (
        db.query(Portfolio)
        .filter(
            Portfolio.user_id == order.user_id,
            Portfolio.stock_id == order.stock_id,
        )
        .with_for_update()
        .first()
    )
    if portfolio_entry:
        total_shares = portfolio_entry.quantity + filled_qty
        old_total_cost = Decimal(str(portfolio_entry.quantity)) * Decimal(
            str(portfolio_entry.average_price)
        )
        portfolio_entry.average_price = (old_total_cost + cost) / total_shares
        portfolio_entry.quantity = total_shares
    else:
        db.add(
            Portfolio(
                user_id=order.user_id,
                stock_id=order.stock_id,
                quantity=filled_qty,
                average_price=avg_price,
            )
        )

    db.add(
        Transaction(
            user_id=order.user_id,
            type="BUY",
            amount=cost,
            description=(
                f"Limit BUY filled: {filled_qty} shares of {order.symbol} "
                f"[Matching Engine]. Breakdown: {', '.join(breakdown)}"
                + (f". Escrow refund Rs. {refund:.2f}" if refund > 0 else "")
            ),
            created_at=datetime.utcnow(),
        )
    )

    order.remaining_quantity -= filled_qty
    if order.remaining_quantity <= 0:
        order.status = "COMPLETED"
    return filled_qty


def _fill_sell(order: Order, db: Session) -> int:
    """Try to fill a pending limit SELL. Returns shares newly filled."""
    stock = db.query(Stock).filter(Stock.stock_id == order.stock_id).first()
    if not stock:
        return 0

    limit_price = Decimal(str(order.limit_price))
    levels = _get_depth_levels(order.symbol, "buy", stock.last_traded_price)
    filled_qty, revenue, breakdown = _walk_levels(
        levels, order.remaining_quantity, limit_price, "buy"
    )
    if filled_qty <= 0:
        return 0

    wallet = (
        db.query(Wallet)
        .filter(Wallet.user_id == order.user_id)
        .with_for_update()
        .first()
    )
    if not wallet:
        return 0

    # Shares were already escrowed out of the portfolio at placement; just pay out.
    wallet.balance = float(Decimal(str(wallet.balance)) + revenue)

    db.add(
        Transaction(
            user_id=order.user_id,
            type="SELL",
            amount=revenue,
            description=(
                f"Limit SELL filled: {filled_qty} shares of {order.symbol} "
                f"[Matching Engine]. Breakdown: {', '.join(breakdown)}"
            ),
            created_at=datetime.utcnow(),
        )
    )

    order.remaining_quantity -= filled_qty
    if order.remaining_quantity <= 0:
        order.status = "COMPLETED"
    return filled_qty


async def match_pending_orders():
    """
    Background loop: periodically fill pending limit orders when the market
    reaches their price.
    """
    # Let the server boot and the first market sync populate the cache
    await asyncio.sleep(15)

    while True:
        db_generator = get_db()
        db: Session = next(db_generator)
        try:
            # Snapshot the candidate IDs only. We deliberately do NOT hold the
            # ORM objects: each order is re-fetched under a row lock below so we
            # never mutate an order a concurrent cancel is also touching.
            pending_order_ids = [
                row[0]
                for row in db.query(Order.order_id)
                .filter(func.lower(Order.status) == "pending")
                .all()
            ]

            total_filled = 0
            for order_id in pending_order_ids:
                try:
                    # Lock the row. SKIP LOCKED means if a concurrent cancel (or a
                    # previous, still-uncommitted fill) holds this order, we skip
                    # it this cycle instead of blocking — it'll be retried next tick.
                    order = (
                        db.query(Order)
                        .filter(Order.order_id == order_id)
                        .with_for_update(skip_locked=True)
                        .first()
                    )
                    if order is None:
                        continue

                    # Re-validate UNDER the lock: between the scan and acquiring
                    # this lock a cancel/fill may have completed, so the order may
                    # no longer be pending. Never act on a stale status.
                    if (order.status or "").lower() != "pending":
                        db.rollback()
                        continue
                    # Only limit orders rest on the book; market orders never pend
                    if (order.order_type or "").upper() != "LIMIT" or not order.limit_price:
                        db.rollback()
                        continue

                    if order.transaction_type.upper() == "BUY":
                        filled = _fill_buy(order, db)
                    else:
                        filled = _fill_sell(order, db)

                    if filled > 0:
                        db.commit()
                        total_filled += filled
                        logger.info(
                            f"Matched {filled} shares for order #{order.order_id} "
                            f"({order.transaction_type} {order.symbol}). "
                            f"Remaining: {order.remaining_quantity}."
                        )
                    else:
                        # Nothing filled — release the row lock immediately so a
                        # cancel isn't blocked waiting on an order we won't touch.
                        db.rollback()
                except Exception as e:
                    db.rollback()
                    logger.error(
                        f"Failed to match order #{order_id}: {e}"
                    )

            if total_filled > 0:
                logger.info(f"Matching cycle complete. Filled {total_filled} shares.")

        except Exception as e:
            db.rollback()
            logger.error(f"Matching engine cycle failed: {e}")
        finally:
            db.close()

        await asyncio.sleep(settings.MATCHER_INTERVAL_SECONDS)
