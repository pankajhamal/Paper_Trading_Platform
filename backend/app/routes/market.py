# app/routes/market.py
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends

from app.models.users import User
from app.auth.dependencies import get_current_user
from app.service.nepse import NepseService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["Market"])
nepse_service = NepseService()

# Nepal Standard Time is UTC+05:45
NPT_OFFSET = timedelta(hours=5, minutes=45)


def _normalize_index(raw: dict) -> dict:
    """
    Flatten the bridge's index payload into a uniform series the chart can plot:
    a list of {label, value} points plus summary numbers.

    - intraday: data is [[timestamp, value], ...]
    - daily:    data is [{businessDate, closingIndex, ...}, ...]
    """
    granularity = raw.get("granularity")
    data = raw.get("data") or []
    points = []

    if granularity == "intraday":
        for item in data:
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                try:
                    ts = float(item[0])
                    if ts > 1e12:  # milliseconds -> seconds
                        ts /= 1000.0
                    label = (datetime.utcfromtimestamp(ts) + NPT_OFFSET).strftime("%H:%M")
                    points.append({"label": label, "value": float(item[1])})
                except (TypeError, ValueError):
                    continue
    elif granularity == "daily":
        for item in data:
            if isinstance(item, dict) and item.get("closingIndex") is not None:
                date = item.get("businessDate") or ""
                try:
                    points.append({"label": date, "value": float(item["closingIndex"])})
                except (TypeError, ValueError):
                    continue

    first = points[0]["value"] if points else 0.0
    last = points[-1]["value"] if points else 0.0
    change = last - first
    pct = (change / first * 100) if first else 0.0

    return {
        "granularity": granularity,
        "points": points,
        "current": round(last, 2),
        "change": round(change, 2),
        "percent_change": round(pct, 2),
    }


@router.get("/nepse-index")
async def nepse_index(current_user: User = Depends(get_current_user)):
    """
    Returns the NEPSE index series (from the nepse-bridge) for the dashboard chart.
    """
    raw = await nepse_service.get_nepse_index()
    return _normalize_index(raw)
