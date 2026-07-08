# app/service/alert_checker.py
"""
Price-alert checker.

Runs as a background task. Every cycle it scans ACTIVE alerts and trips any whose
target has been crossed by the stock's current price:
  - ABOVE: last_traded_price >= target_price
  - BELOW: last_traded_price <= target_price

Triggered alerts are marked TRIGGERED with a timestamp so the frontend can surface
them. Rows are locked with SKIP LOCKED so a concurrent delete never races.
"""
import asyncio
import logging
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.alert import Alert
from app.models.stock import Stock

logger = logging.getLogger(__name__)

ALERT_CHECK_INTERVAL_SECONDS = 60


def _is_crossed(condition: str, price: Decimal, target: Decimal) -> bool:
    if condition == "ABOVE":
        return price >= target
    if condition == "BELOW":
        return price <= target
    return False


async def check_price_alerts():
    """Background loop: trip active price alerts when the market crosses them."""
    # Let the first market sync populate stock prices
    await asyncio.sleep(20)

    while True:
        db_generator = get_db()
        db: Session = next(db_generator)
        try:
            active_ids = [
                row[0]
                for row in db.query(Alert.alert_id)
                .filter(func.upper(Alert.status) == "ACTIVE")
                .all()
            ]

            triggered = 0
            for alert_id in active_ids:
                try:
                    alert = (
                        db.query(Alert)
                        .filter(Alert.alert_id == alert_id)
                        .with_for_update(skip_locked=True)
                        .first()
                    )
                    if alert is None or (alert.status or "").upper() != "ACTIVE":
                        db.rollback()
                        continue

                    stock = db.query(Stock).filter(Stock.stock_id == alert.stock_id).first()
                    if not stock or stock.last_traded_price is None:
                        db.rollback()
                        continue

                    price = Decimal(str(stock.last_traded_price))
                    target = Decimal(str(alert.target_price))

                    if _is_crossed(alert.condition, price, target):
                        alert.status = "TRIGGERED"
                        alert.triggered_at = datetime.utcnow()
                        db.commit()
                        triggered += 1
                        logger.info(
                            f"Alert #{alert.alert_id} triggered: {stock.symbol} "
                            f"{alert.condition} {target} (price {price})."
                        )
                    else:
                        db.rollback()
                except Exception as e:
                    db.rollback()
                    logger.error(f"Failed to evaluate alert #{alert_id}: {e}")

            if triggered:
                logger.info(f"Alert cycle complete. Triggered {triggered} alert(s).")

        except Exception as e:
            db.rollback()
            logger.error(f"Alert checker cycle failed: {e}")
        finally:
            db.close()

        await asyncio.sleep(ALERT_CHECK_INTERVAL_SECONDS)
