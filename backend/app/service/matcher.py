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
from app.service.depth import ASKS, BIDS, resolve_levels

logger = logging.getLogger(__name__)


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


def _fill_buy(order: Order, db: Session, levels: list) -> int:
    """Try to fill a pending limit BUY against `levels`. Returns shares filled.

    The book is passed in, not fetched here: resolving depth can hit the bridge
    over HTTP and this runs with the order row locked.
    """
    limit_price = Decimal(str(order.limit_price))
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


def _fill_sell(order: Order, db: Session, levels: list) -> int:
    """Try to fill a pending limit SELL against `levels`. Returns shares filled.

    As with `_fill_buy`, the book is resolved by the caller before locking.
    """
    limit_price = Decimal(str(order.limit_price))
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


async def run_matching_cycle(db: Session) -> int:
    """One pass over every pending limit order. Returns shares filled.

    Split out from the loop below so a single cycle can be driven directly
    (tests, or a manual sweep) without waiting on the scheduler.
    """
    # Snapshot the candidate IDs only. We deliberately do NOT hold the ORM
    # objects: each order is re-fetched under a row lock below so we never
    # mutate an order a concurrent cancel is also touching. The symbol/price
    # come along so books can be resolved before any lock is taken.
    candidates = (
        db.query(
            Order.order_id,
            Order.symbol,
            Order.transaction_type,
            Stock.last_traded_price,
        )
        .join(Stock, Stock.stock_id == Order.stock_id)
        .filter(func.lower(Order.status) == "pending")
        .all()
    )
    if not candidates:
        return 0

    # Resolve every book this cycle needs UP FRONT. Depth resolution can make an
    # HTTP call to the bridge, and doing that while holding an order row lock
    # would block a concurrent cancel for the length of a network timeout.
    # One lookup per (symbol, side), reused across every order below.
    wanted = sorted({
        (
            row.symbol,
            ASKS if (row.transaction_type or "").upper() == "BUY" else BIDS,
            float(row.last_traded_price or 0),
        )
        for row in candidates
    })
    resolved = await asyncio.gather(
        *(resolve_levels(sym, side, price) for sym, side, price in wanted),
        return_exceptions=True,
    )
    books = {}
    for (sym, side, _price), result in zip(wanted, resolved):
        if isinstance(result, Exception):
            logger.error(f"Depth resolution failed for {sym} {side}: {result}")
            continue
        books[(sym, side)] = result[0]

    total_filled = 0
    for row in candidates:
        order_id = row.order_id
        try:
            # Lock the row. SKIP LOCKED means if a concurrent cancel (or a
            # previous, still-uncommitted fill) holds this order, we skip it
            # this cycle instead of blocking — it'll be retried next tick.
            order = (
                db.query(Order)
                .filter(Order.order_id == order_id)
                .with_for_update(skip_locked=True)
                .first()
            )
            if order is None:
                continue

            # Re-validate UNDER the lock: between the scan and acquiring this
            # lock a cancel/fill may have completed, so the order may no longer
            # be pending. Never act on a stale status.
            if (order.status or "").lower() != "pending":
                db.rollback()
                continue
            # Only limit orders rest on the book; market orders never pend.
            if (order.order_type or "").upper() != "LIMIT" or not order.limit_price:
                db.rollback()
                continue

            is_buy = order.transaction_type.upper() == "BUY"
            levels = books.get((order.symbol, ASKS if is_buy else BIDS))
            if not levels:
                # No book resolved for this symbol this cycle (the lookup
                # failed); leave the order pending and retry on the next tick.
                db.rollback()
                continue

            if is_buy:
                filled = _fill_buy(order, db, levels)
            else:
                filled = _fill_sell(order, db, levels)

            if filled > 0:
                db.commit()
                total_filled += filled
                logger.info(
                    f"Matched {filled} shares for order #{order.order_id} "
                    f"({order.transaction_type} {order.symbol}). "
                    f"Remaining: {order.remaining_quantity}."
                )
            else:
                # Nothing filled — release the row lock immediately so a cancel
                # isn't blocked waiting on an order we won't touch.
                db.rollback()
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to match order #{order_id}: {e}")

    return total_filled


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
            total_filled = await run_matching_cycle(db)
            if total_filled > 0:
                logger.info(f"Matching cycle complete. Filled {total_filled} shares.")
        except Exception as e:
            db.rollback()
            logger.error(f"Matching engine cycle failed: {e}")
        finally:
            db.close()

        await asyncio.sleep(settings.MATCHER_INTERVAL_SECONDS)
