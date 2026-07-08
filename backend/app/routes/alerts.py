# app/routes/alerts.py
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.users import User
from app.auth.dependencies import get_current_user
from app.controller.alerts import get_alerts, create_alert, delete_alert

router = APIRouter(prefix="/alerts", tags=["Alerts"])


class AlertCreate(BaseModel):
    symbol: str
    condition: str  # "ABOVE" or "BELOW"
    target_price: float = Field(gt=0)


@router.get("")
def read_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's price alerts."""
    return get_alerts(db=db, current_user=current_user)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_alert_route(
    payload: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a price alert for a stock."""
    return create_alert(
        symbol=payload.symbol,
        condition=payload.condition,
        target_price=payload.target_price,
        db=db,
        current_user=current_user,
    )


@router.delete("/{alert_id}")
def delete_alert_route(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a price alert."""
    return delete_alert(alert_id=alert_id, db=db, current_user=current_user)
