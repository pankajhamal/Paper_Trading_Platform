# app/controllers/orders.py
import logging
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.order import Order
from app.models.users import User

logger = logging.getLogger(__name__)

async def get_user_orders(db: Session, current_user: User) -> list:
    """
    Retrieves the complete order history from the database and shapes the 
    data specifically to match the format of the Orders.jsx table columns.
    """
    try:
        orders = db.query(Order).filter(
            Order.user_id == current_user.user_id
        ).order_by(Order.created_at.desc()).all()
        
        def _display_status(raw: str) -> str:
            status_key = (raw or "").upper()
            if status_key in ("COMPLETED", "FILLED"):
                return "Filled"
            if status_key == "EXPIRED":
                return "Expired"
            if status_key in ("CANCELLED", "CANCELED"):
                return "Cancelled"
            return "Pending"

        return [
            {
                "id": order.order_id,
                "symbol": order.symbol,
                "type": order.transaction_type,  # "BUY" or "SELL"
                "orderType": order.order_type,   # "MARKET" or "LIMIT"
                "qty": order.quantity,
                "limit_price": float(order.limit_price) if order.limit_price else None,
                "status": _display_status(order.status),
                "date": order.created_at.strftime("%Y-%m-%d")
            }
            for order in orders
        ]
    except Exception as e:
        logger.error(f"Error retrieving orders for user {current_user.user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to retrieve order history due to an internal database error."
        )