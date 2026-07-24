from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.database.base import Base


class MarketSnapshot(Base):
    """Last-known-good copy of a bridge payload.

    One row per feed (see `service/snapshot.py` for the keys). The bridge only
    has data while NEPSE is trading and the Bun service is up; these rows are
    what the market routes fall back to the rest of the time, so the app shows
    the last real numbers instead of blanks.
    """

    __tablename__ = "market_snapshots"

    # Feed name, e.g. "live_market" / "market_summary" / "nepse_index".
    key = Column(String, primary_key=True)

    # The raw bridge response, stored verbatim so normalization stays in one
    # place (the routes) and a parser change doesn't invalidate stored data.
    payload = Column(JSONB, nullable=False)

    captured_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
