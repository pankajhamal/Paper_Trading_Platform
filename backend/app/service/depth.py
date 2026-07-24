"""Order-book depth resolution for the matching engine.

Why this module exists: the bridge's `/live-market` response carries prices but
**no order book** — not one of its ~350 entries has a `marketDepth` key. The
engine used to look for depth there, always find nothing, and fall through to a
synthetic ladder, so every fill was simulated even while NEPSE was trading. Real
books come only from the per-symbol `/depth/:symbol` endpoint, which nothing was
calling.

So depth is resolved here, per symbol, through one ordered chain:

  1. inline depth on the cached market item — free, and correct if a future
     bridge build starts shipping books with `/live-market`;
  2. the live `/depth/:symbol` endpoint — the real order book;
  3. the stored snapshot of that symbol's last good book, so a closed market or
     a downed bridge still fills against real prices;
  4. a synthetic ladder around the last traded price — the original fallback.

Two guards keep this honest:

* **Stale books are band-limited.** A stored book is only trusted where its
  levels sit inside NEPSE's ±10% circuit band around the current price. Filling
  a market buy against yesterday's Rs 200 ask when the stock now trades at Rs 260
  would hand out free money.
* **Levels are sorted best-first** (asks ascending, bids descending) before the
  engine walks them. The old code consumed the book in source order, which is
  only safe if the feed is already sorted — not something to bet fills on.

Resolved books are cached in RAM briefly so a matcher cycle and a burst of
orders don't each hit the bridge, and snapshot I/O uses its own short-lived
session so it can never interfere with the caller's trading transaction.
"""
import asyncio
import logging
import time
from typing import Any

from app.database.connection import SessionLocal
from app.service.cache import LIVE_MARKET_DEPTH
from app.service.market_hours import is_market_open_now
from app.service.nepse import (
    NepseService,
    generate_simulated_bid_depth,
    generate_simulated_depth,
)
from app.service.snapshot import load_snapshot, save_snapshot

logger = logging.getLogger(__name__)

nepse_service = NepseService()

# Bridge key names, and the side names this module exposes.
BIDS_KEY = "buyMarketDepthList"
ASKS_KEY = "sellMarketDepthList"
ASKS = "asks"  # what a BUY consumes
BIDS = "bids"  # what a SELL consumes

# How long a resolved book stays usable before the bridge is asked again.
OPEN_TTL_SECONDS = 20        # trading: books move, keep it short
CLOSED_TTL_SECONDS = 300     # closed: the book isn't going to change
FALLBACK_TTL_SECONDS = 60    # nothing real available; don't retry on every order

# Stored depth is only trusted inside NEPSE's ±10% circuit band.
CIRCUIT_BAND = 0.10

# Don't rewrite a symbol's snapshot more than once a minute.
SNAPSHOT_WRITE_INTERVAL_SECONDS = 60

# Bound concurrent bridge calls — a matcher cycle can want many symbols at once.
_bridge_semaphore = asyncio.Semaphore(8)

# symbol -> (expires_at_monotonic, book)
_cache: dict[str, tuple[float, dict]] = {}


def snapshot_key(symbol: str) -> str:
    return f"depth:{symbol.upper().strip()}"


def _normalize(raw: dict, key: str) -> list:
    """Coerce a raw depth list into sorted `{price, quantity}` levels."""
    levels = []
    for level in (raw or {}).get(key) or []:
        if not isinstance(level, dict):
            continue
        try:
            quantity = int(level.get("quantity") or 0)
            price = float(
                level.get("price")
                or level.get("rate")
                or level.get("orderBookOrderPrice")
                or 0.0
            )
        except (TypeError, ValueError):
            continue
        if quantity > 0 and price > 0:
            levels.append({"quantity": quantity, "price": price})

    # Best price first: cheapest ask, highest bid.
    levels.sort(key=lambda level: level["price"], reverse=(key == BIDS_KEY))
    return levels


def _within_band(levels: list, reference_price: float) -> list:
    """Drop stored levels that have drifted outside the circuit band."""
    if not reference_price or reference_price <= 0:
        return levels
    low = reference_price * (1 - CIRCUIT_BAND)
    high = reference_price * (1 + CIRCUIT_BAND)
    return [level for level in levels if low <= level["price"] <= high]


def _book(bids: list, asks: list, source: str) -> dict:
    return {BIDS: bids, ASKS: asks, "source": source}


def _simulated_book(reference_price: float) -> dict:
    """The original synthetic ladder, used when nothing real is available."""
    price = float(reference_price or 0)
    return _book(
        generate_simulated_bid_depth(price),
        generate_simulated_depth(price),
        "simulated",
    )


def _store_snapshot(symbol: str, payload: dict) -> None:
    """Persist a symbol's book on its own session, so the caller's trading
    transaction is never touched by incidental bookkeeping."""
    db = SessionLocal()
    try:
        save_snapshot(db, snapshot_key(symbol), payload, SNAPSHOT_WRITE_INTERVAL_SECONDS)
    finally:
        db.close()


def _read_snapshot(symbol: str) -> Any:
    db = SessionLocal()
    try:
        payload, _ = load_snapshot(db, snapshot_key(symbol))
        return payload
    finally:
        db.close()


async def _fetch_book(symbol: str, reference_price: float) -> dict:
    """Walk the resolution chain once, ignoring the RAM cache."""
    # 1. Depth already attached to the cached whole-market item, if any.
    inline = (LIVE_MARKET_DEPTH.get(symbol) or {}).get("marketDepth")
    if inline:
        bids, asks = _normalize(inline, BIDS_KEY), _normalize(inline, ASKS_KEY)
        if bids or asks:
            return _book(bids, asks, "live")

    # 2. The per-symbol endpoint — the only source of a real book.
    try:
        async with _bridge_semaphore:
            raw = await nepse_service.get_market_depth(symbol)
    except Exception as e:  # get_market_depth already swallows most of these
        logger.warning(f"Depth lookup for {symbol} failed: {e}")
        raw = {}

    bids, asks = _normalize(raw, BIDS_KEY), _normalize(raw, ASKS_KEY)
    if bids or asks:
        _store_snapshot(symbol, {BIDS_KEY: bids, ASKS_KEY: asks})
        return _book(bids, asks, "live")

    # 3. The last good book for this symbol, trusted only near the current price.
    stored = _read_snapshot(symbol)
    if stored:
        bids = _within_band(_normalize(stored, BIDS_KEY), reference_price)
        asks = _within_band(_normalize(stored, ASKS_KEY), reference_price)
        if bids or asks:
            return _book(bids, asks, "snapshot")

    # 4. Synthetic ladder around the last traded price.
    return _simulated_book(reference_price)


async def resolve_book(symbol: str, reference_price: float) -> dict:
    """Both sides of the book for `symbol`, with the source that produced it."""
    symbol = (symbol or "").upper().strip()
    now = time.monotonic()

    cached = _cache.get(symbol)
    if cached and cached[0] > now:
        return cached[1]

    book = await _fetch_book(symbol, reference_price)

    if book["source"] == "simulated":
        ttl = FALLBACK_TTL_SECONDS
    else:
        ttl = OPEN_TTL_SECONDS if is_market_open_now() else CLOSED_TTL_SECONDS
    _cache[symbol] = (now + ttl, book)
    return book


async def resolve_levels(symbol: str, side: str, reference_price: float) -> tuple[list, str]:
    """The levels a fill should walk, plus where they came from.

    `side` is `ASKS` to fill a BUY, `BIDS` to fill a SELL. A one-sided real book
    still falls back to the synthetic ladder for the missing side, so an order
    is never rejected just because nobody is quoting the other way.
    """
    book = await resolve_book(symbol, reference_price)
    levels = book.get(side) or []
    if levels:
        return levels, book["source"]
    return _simulated_book(reference_price)[side], "simulated"


# How each source is described in transaction descriptions and API responses.
SOURCE_LABELS = {
    "live": "Live Market Depth",
    "snapshot": "Last Known Depth (Snapshot)",
    "simulated": "Simulated Depth (EOD Price Fallback)",
}

SOURCE_SUMMARIES = {
    "live": "Live (Market Depth)",
    "snapshot": "Offline (Last Known Depth)",
    "simulated": "Offline (Closing Price)",
}


def clear_cache() -> None:
    """Drop the RAM cache. Used by tests and after a cold restart."""
    _cache.clear()
