"""Last-known-good market data.

The bridge is a *live* feed: it has nothing to give when NEPSE is closed for the
day, when the Bun service isn't running, or when the upstream API errors out.
Without a fallback every market screen empties to blanks and the app looks
broken for the ~19 hours a day the exchange isn't trading.

So every successful bridge payload is persisted here verbatim, and the market
routes serve the stored copy — flagged `is_stale` with an `as_of` timestamp —
whenever the live call comes back empty. Storing the raw payload (rather than
the normalized shape) keeps parsing in one place, so changing a normalizer
doesn't invalidate what's already saved.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.market_snapshot import MarketSnapshot

logger = logging.getLogger(__name__)

# Snapshot keys — one per bridge feed.
LIVE_MARKET = "live_market"
MARKET_SUMMARY = "market_summary"
NEPSE_INDEX = "nepse_index"


def save_snapshot(
    db: Session,
    key: str,
    payload: Any,
    min_write_interval: int = 0,
) -> bool:
    """Upsert the last-known-good payload for `key`.

    `min_write_interval` (seconds) skips the write when the stored copy is still
    that fresh — request-path callers use it so a browser polling every 30s
    doesn't turn into a database write every 30s. Returns True if it wrote.

    Never raises: a failed snapshot must not break the request that produced it.
    """
    if not payload:
        return False
    try:
        existing = db.query(MarketSnapshot).filter(MarketSnapshot.key == key).first()
        now = datetime.now(timezone.utc)

        if existing and min_write_interval:
            captured = existing.captured_at
            if captured is not None:
                if captured.tzinfo is None:
                    captured = captured.replace(tzinfo=timezone.utc)
                if now - captured < timedelta(seconds=min_write_interval):
                    return False

        if existing:
            existing.payload = payload
            existing.captured_at = now
        else:
            db.add(MarketSnapshot(key=key, payload=payload, captured_at=now))
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logger.warning(f"Could not save '{key}' market snapshot: {e}")
        return False


def load_snapshot(db: Session, key: str) -> tuple[Any | None, datetime | None]:
    """Return `(payload, captured_at)` for `key`, or `(None, None)` if unsaved."""
    try:
        row = db.query(MarketSnapshot).filter(MarketSnapshot.key == key).first()
        if not row:
            return None, None
        captured = row.captured_at
        if captured is not None and captured.tzinfo is None:
            captured = captured.replace(tzinfo=timezone.utc)
        return row.payload, captured
    except Exception as e:
        logger.warning(f"Could not load '{key}' market snapshot: {e}")
        return None, None


def as_of(captured_at: datetime | None) -> str | None:
    """ISO timestamp for the API payload, or None when nothing is stored."""
    return captured_at.isoformat() if captured_at else None
