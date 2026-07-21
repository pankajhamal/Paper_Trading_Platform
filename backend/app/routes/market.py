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


def _to_float(value) -> float | None:
    """Coerce a bridge value (number or comma-formatted string) to float."""
    if value is None:
        return None
    try:
        if isinstance(value, str):
            value = value.replace(",", "").strip()
            if not value:
                return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _find_summary_value(summary: dict, *needles: str) -> float | None:
    """Case-insensitively locate a summary metric whose key contains all needles."""
    if not isinstance(summary, dict):
        return None
    for key, value in summary.items():
        low = str(key).lower()
        if all(n in low for n in needles):
            parsed = _to_float(value)
            if parsed is not None:
                return parsed
    return None


def _normalize_summary(raw: dict) -> dict:
    """
    Flatten the bridge's {index, summary, marketStatus} payload into the compact
    headline the navbar ticker renders: point, change, %change, turnover, volume,
    and whether the market is currently open.
    """
    index = raw.get("index") or {}
    summary = raw.get("summary") or {}
    status = raw.get("marketStatus") or {}

    nepse = {}
    if isinstance(index, dict):
        # getNepseIndex() returns an object keyed by index name.
        nepse = index.get("NEPSE Index") or index.get("Nepse Index") or {}

    point = _to_float(nepse.get("currentValue")) or _to_float(nepse.get("close"))
    change = _to_float(nepse.get("change"))
    percent_change = _to_float(nepse.get("perChange"))

    turnover = _find_summary_value(summary, "turnover")
    volume = _find_summary_value(summary, "traded", "shares")

    # marketStatus.isOpen is a string like "OPEN"/"CLOSE".
    is_open = None
    if isinstance(status, dict):
        flag = status.get("isOpen")
        if isinstance(flag, str):
            is_open = flag.strip().upper() == "OPEN"
        elif isinstance(flag, bool):
            is_open = flag

    return {
        "point": round(point, 2) if point is not None else None,
        "change": round(change, 2) if change is not None else None,
        "percent_change": round(percent_change, 2) if percent_change is not None else None,
        "turnover": turnover,
        "volume": volume,
        "is_open": is_open,
    }


@router.get("/summary")
async def market_summary(current_user: User = Depends(get_current_user)):
    """
    Returns the NEPSE headline (point, change %, turnover, volume, open status)
    for the top navbar ticker. Fields are null when the live feed is unavailable.
    """
    raw = await nepse_service.get_market_summary()
    return _normalize_summary(raw)
