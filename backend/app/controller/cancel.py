# app/controller/cancel.py
"""
Manual cancellation of a resting (PENDING) limit order.

Reverses the order's escrow back to the user, exactly like the expiry path:
  - BUY  -> refund the escrowed cash (remaining_qty * limit_price) to the wallet
  - SELL -> restore the escrowed shares (remaining_qty) to the portfolio
Then marks the order CANCELLED.
"""
import logging
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.wallet import Wallet
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction
from app.models.users import User

logger = logging.getLogger(__name__)


async def cancel_order(order_id: int, db: Session, current_user: User) -> dict:
    # 1. Fetch the order, scoped to the requesting user, and lock the row
    order = (
        db.query(Order)
        .filter(
            Order.order_id == order_id,
            Order.user_id == current_user.user_id,
        )
        .with_for_update()
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order #{order_id} not found.",
        )

    # 2. Only pending orders hold escrow and can be cancelled
    if (order.status or "").upper() != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order #{order_id} is '{order.status}' and cannot be cancelled. "
                   f"Only PENDING orders can be cancelled.",
        )

    remaining_qty = order.remaining_quantity or 0
    transaction_type = (order.transaction_type or "").upper()

    try:
        refunded_cash = Decimal("0.0")
        returned_shares = 0

        if transaction_type == "SELL":
            # SELL escrow is SHARES: return them to the portfolio.
            if remaining_qty > 0:
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
                    portfolio_entry.quantity += remaining_qty
                else:
                    portfolio_entry = Portfolio(
                        user_id=order.user_id,
                        stock_id=order.stock_id,
                        quantity=remaining_qty,
                        average_price=Decimal(str(order.limit_price or 0)),
                    )
                    db.add(portfolio_entry)

                returned_shares = remaining_qty
                db.add(Transaction(
                    user_id=order.user_id,
                    type="ASSET_ESCROW_RELEASE",
                    amount=Decimal("0.0"),
                    description=(
                        f"Returned {remaining_qty} unsold shares of {order.symbol} "
                        f"to portfolio (cancelled Limit Sell #{order_id})."
                    ),
                    created_at=datetime.utcnow(),
                ))

        else:
            # BUY escrow is CASH: refund (remaining_qty * limit_price).
            if remaining_qty > 0 and order.limit_price is not None:
                refund_amount = Decimal(str(remaining_qty)) * Decimal(str(order.limit_price))
                wallet = (
                    db.query(Wallet)
                    .filter(Wallet.user_id == order.user_id)
                    .with_for_update()
                    .first()
                )
                if wallet:
                    wallet.balance = float(Decimal(str(wallet.balance)) + refund_amount)

                refunded_cash = refund_amount
                db.add(Transaction(
                    user_id=order.user_id,
                    type="ESCROW_RELEASE",
                    amount=refund_amount,
                    description=(
                        f"Refund of Rs. {refund_amount:,.2f} for cancelled {order.symbol} "
                        f"Limit Buy #{order_id} (unfilled {remaining_qty} shares)."
                    ),
                    created_at=datetime.utcnow(),
                ))

        order.status = "CANCELLED"
        db.commit()

    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        logger.error(f"Error cancelling order #{order_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel order due to an internal database error.",
        )

    return {
        "message": f"Order #{order_id} cancelled successfully.",
        "order_id": order_id,
        "symbol": order.symbol,
        "status": "CANCELLED",
        "cancelled_quantity": remaining_qty,
        "refunded_cash": float(refunded_cash),
        "returned_shares": returned_shares,
    }
