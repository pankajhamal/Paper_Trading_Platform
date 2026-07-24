# app/routes/market.py
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.users import User
from app.auth.dependencies import get_current_user
from app.service.nepse import NepseService
from app.service.market_hours import is_market_open_now
from app.service.snapshot import (
    MARKET_SUMMARY,
    NEPSE_INDEX,
    as_of,
    load_snapshot,
    save_snapshot,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["Market"])
nepse_service = NepseService()

# A browser polls the navbar every 30s; don't turn that into a write that often.
SNAPSHOT_WRITE_INTERVAL_SECONDS = 60

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
async def nepse_index(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the NEPSE index series for the dashboard chart.

    Live from the bridge when it's up; otherwise the last stored series, tagged
    `is_stale` + `as_of` so the chart can label it rather than render empty.
    """
    raw = await nepse_service.get_nepse_index()
    if raw:
        save_snapshot(db, NEPSE_INDEX, raw, SNAPSHOT_WRITE_INTERVAL_SECONDS)
        return {**_normalize_index(raw), "is_stale": False, "as_of": None}

    stored, captured_at = load_snapshot(db, NEPSE_INDEX)
    if not stored:
        return {**_normalize_index({}), "is_stale": False, "as_of": None}

    logger.info("NEPSE index feed unavailable; serving the snapshot from %s.", captured_at)
    return {**_normalize_index(stored), "is_stale": True, "as_of": as_of(captured_at)}


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


async def resolve_summary(db: Session) -> dict:
    """The navbar headline, live if possible and from the snapshot if not.

    Shared with the public landing page so both surfaces degrade identically.
    When serving a snapshot, `is_open` is recomputed from the NPT trading
    calendar — the stored status was true when captured, and repeating it would
    claim the market is open hours after it closed.
    """
    raw = await nepse_service.get_market_summary()
    if raw:
        save_snapshot(db, MARKET_SUMMARY, raw, SNAPSHOT_WRITE_INTERVAL_SECONDS)
        return {**_normalize_summary(raw), "is_stale": False, "as_of": None}

    stored, captured_at = load_snapshot(db, MARKET_SUMMARY)
    if not stored:
        return {**_normalize_summary({}), "is_stale": False, "as_of": None}

    logger.info("Market summary feed unavailable; serving the snapshot from %s.", captured_at)
    return {
        **_normalize_summary(stored),
        "is_open": is_market_open_now(),
        "is_stale": True,
        "as_of": as_of(captured_at),
    }


@router.get("/summary")
async def market_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the NEPSE headline (point, change %, turnover, volume, open status)
    for the top navbar ticker. Falls back to the last stored snapshot when the
    live feed is unavailable, so the ticker never blanks out.
    """
    return await resolve_summary(db)
