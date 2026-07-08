# app/controller/alerts.py
"""
Price-alert controller.

A user sets a target price on a stock with a direction:
  - ABOVE: notify me when the price rises to/above the target
  - BELOW: notify me when the price falls to/below the target

Alerts start ACTIVE. A background checker (service/alert_checker.py) flips them
to TRIGGERED once the market crosses the target.
"""
import logging
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.stock import Stock
from app.models.alert import Alert
from app.models.users import User

logger = logging.getLogger(__name__)

VALID_CONDITIONS = {"ABOVE", "BELOW"}


def _serialize(alert: Alert, stock: Stock) -> dict:
    return {
        "alert_id": alert.alert_id,
        "symbol": stock.symbol if stock else None,
        "company_name": stock.company_name if stock else None,
        "condition": alert.condition,
        "target_price": float(alert.target_price),
        "current_price": float(stock.last_traded_price) if stock else None,
        "status": alert.status,
        "created_at": alert.created_at,
        "triggered_at": alert.triggered_at,
    }


def get_alerts(db: Session, current_user: User) -> list:
    """Return the user's alerts (newest first) with the stock's current price."""
    alerts = (
        db.query(Alert)
        .filter(Alert.user_id == current_user.user_id)
        .order_by(Alert.created_at.desc())
        .all()
    )
    result = []
    for alert in alerts:
        stock = alert.stock or db.query(Stock).filter(Stock.stock_id == alert.stock_id).first()
        result.append(_serialize(alert, stock))
    return result


def create_alert(symbol: str, condition: str, target_price: float, db: Session, current_user: User) -> dict:
    """Create a price alert after validating the stock, direction and target."""
    symbol_clean = (symbol or "").upper().strip()
    condition_clean = (condition or "").upper().strip()

    if condition_clean not in VALID_CONDITIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Condition must be either 'ABOVE' or 'BELOW'.",
        )

    if target_price is None or target_price <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target price must be greater than zero.",
        )

    stock = db.query(Stock).filter(Stock.symbol == symbol_clean).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock '{symbol_clean}' was not found.",
        )

    current_price = float(stock.last_traded_price or 0)

    # Reject targets that are already met, so an alert never triggers instantly.
    if condition_clean == "ABOVE" and target_price <= current_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An ABOVE alert must be higher than the current price (Rs. {current_price:,.2f}).",
        )
    if condition_clean == "BELOW" and target_price >= current_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A BELOW alert must be lower than the current price (Rs. {current_price:,.2f}).",
        )

    try:
        alert = Alert(
            user_id=current_user.user_id,
            stock_id=stock.stock_id,
            condition=condition_clean,
            target_price=Decimal(str(target_price)),
            status="ACTIVE",
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create alert for {symbol_clean}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create alert.",
        )

    return {"message": f"Alert set for {symbol_clean}.", "alert": _serialize(alert, stock)}


def delete_alert(alert_id: int, db: Session, current_user: User) -> dict:
    """Delete one of the user's alerts."""
    alert = (
        db.query(Alert)
        .filter(Alert.alert_id == alert_id, Alert.user_id == current_user.user_id)
        .first()
    )
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert #{alert_id} was not found.",
        )

    try:
        db.delete(alert)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete alert #{alert_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete alert.",
        )

    return {"message": f"Alert #{alert_id} deleted.", "alert_id": alert_id}
