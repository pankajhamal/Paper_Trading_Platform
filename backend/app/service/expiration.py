# app/services/expiration.py
import asyncio
import logging
from datetime import datetime
from decimal import Decimal

from app.database.connection import get_db
from app.models.order import Order
from app.models.wallet import Wallet
from app.models.transaction import Transaction
from sqlalchemy import func

logger = logging.getLogger(__name__)

async def cancel_expired_daily_orders():
    """
    Background task that runs every 60 seconds.
    It scans for pending limit orders older than 5 hours,
    cancels them, and refunds the escrowed funds to the users' wallets.
    """
    # Wait 10 seconds on startup once to let the main server fully boot
    await asyncio.sleep(10)
    
    # Expiration limit: 5 hours (5 hours * 3600 seconds = 18,000 seconds)
    EXPIRATION_LIMIT_SECONDS = 60
    
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
                    
                    # If the order has been pending for 5 hours or more
                    if order_age_seconds >= EXPIRATION_LIMIT_SECONDS:
                        # Update order status to EXPIRED
                        order.status = "EXPIRED"
                        expired_count += 1
                        
                        # Calculate the exact refund: (Remaining Qty * Limit Price)
                        remaining_qty = Decimal(str(order.remaining_quantity))
                        limit_price = Decimal(str(order.limit_price))
                        refund_amount = remaining_qty * limit_price
                        
                        # 2. Fetch User's Wallet and refund the balance
                        wallet = db.query(Wallet).filter(Wallet.user_id == order.user_id).first()
                        if wallet:
                            wallet_balance_dec = Decimal(str(wallet.balance))
                            wallet.balance = float(wallet_balance_dec + refund_amount)
                        
                        # 3. Log an ESCROW_RELEASE transaction to the permanent ledger
                        db.add(Transaction(
                            user_id=order.user_id,
                            type="ESCROW_RELEASE",
                            amount=refund_amount,
                            description=(
                                f"Refund of Rs. {refund_amount:,.2f} for expired {order.symbol} Limit Order "
                                f"(Exceeded 5-hour pending limit)."
                            ),
                            created_at=datetime.utcnow()
                        ))
                
                if expired_count > 0:
                    db.commit()
                    logger.info(f"Successfully expired {expired_count} pending orders (older than 5 hours).")
                    
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to process order expirations: {e}")
        finally:
            db.close()
            
        # Scan the database again in 60 seconds
        await asyncio.sleep(30)