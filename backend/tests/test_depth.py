"""Order-book depth resolution.

The engine used to look for depth on the whole-market payload, never find any,
and fill every order against a synthetic ladder. These tests pin the real chain:
inline depth -> the per-symbol bridge endpoint -> the stored snapshot -> the
synthetic ladder, plus the two guards that keep stale books honest.
"""
import asyncio
import uuid

import pytest

from app.database.connection import SessionLocal
from app.models.market_snapshot import MarketSnapshot
from app.service import depth as depth_service
from app.service.cache import LIVE_MARKET_DEPTH
from app.service.depth import ASKS, BIDS, resolve_levels, snapshot_key
from app.service.snapshot import save_snapshot

REFERENCE_PRICE = 100.0


class FakeBridge:
    """Serves a canned book, and records which symbols were asked for."""

    def __init__(self, book=None):
        self.book = book or {"buyMarketDepthList": [], "sellMarketDepthList": []}
        self.calls = []

    async def get_market_depth(self, symbol):
        self.calls.append(symbol)
        return self.book


@pytest.fixture
def symbol():
    """A symbol nothing else knows about, with all caches cleared around it."""
    sym = f"DPT{uuid.uuid4().hex[:6].upper()}"
    depth_service.clear_cache()
    LIVE_MARKET_DEPTH.pop(sym, None)
    yield sym
    depth_service.clear_cache()
    LIVE_MARKET_DEPTH.pop(sym, None)
    db = SessionLocal()
    db.query(MarketSnapshot).filter(MarketSnapshot.key == snapshot_key(sym)).delete()
    db.commit()
    db.close()


@pytest.fixture
def bridge(request):
    """Swap in a fake bridge for one test, restoring the session-wide stub after."""
    original = depth_service.nepse_service

    def install(book=None):
        fake = FakeBridge(book)
        depth_service.nepse_service = fake
        request.addfinalizer(lambda: setattr(depth_service, "nepse_service", original))
        return fake

    return install


def resolve(symbol, side, price=REFERENCE_PRICE):
    return asyncio.run(resolve_levels(symbol, side, price))


# --------------------------------------------------------------- live depth

def test_live_depth_is_used_and_beats_the_simulated_ladder(symbol, bridge):
    bridge({
        "sellMarketDepthList": [
            {"quantity": 50, "orderBookOrderPrice": 101.5},
            {"quantity": 80, "orderBookOrderPrice": 100.5},
        ],
        "buyMarketDepthList": [{"quantity": 40, "orderBookOrderPrice": 99.0}],
    })

    levels, source = resolve(symbol, ASKS)

    assert source == "live"
    # Bridge key `orderBookOrderPrice` is normalized to `price`.
    assert levels[0] == {"quantity": 80, "price": 100.5}
    assert [level["price"] for level in levels] == [100.5, 101.5]


def test_asks_sort_cheapest_first_and_bids_highest_first(symbol, bridge):
    bridge({
        "sellMarketDepthList": [
            {"quantity": 10, "price": 105.0},
            {"quantity": 10, "price": 101.0},
            {"quantity": 10, "price": 103.0},
        ],
        "buyMarketDepthList": [
            {"quantity": 10, "price": 95.0},
            {"quantity": 10, "price": 99.0},
            {"quantity": 10, "price": 97.0},
        ],
    })

    asks, _ = resolve(symbol, ASKS)
    assert [level["price"] for level in asks] == [101.0, 103.0, 105.0]

    bids, _ = resolve(symbol, BIDS)
    assert [level["price"] for level in bids] == [99.0, 97.0, 95.0]


def test_junk_levels_are_dropped(symbol, bridge):
    bridge({
        "sellMarketDepthList": [
            {"quantity": 0, "price": 101.0},       # no size
            {"quantity": 10, "price": 0},          # no price
            {"quantity": None, "price": None},     # nulls
            "not-a-level",                         # wrong type
            {"quantity": 25, "price": 102.0},      # the only good one
        ],
    })

    levels, source = resolve(symbol, ASKS)

    assert source == "live"
    assert levels == [{"quantity": 25, "price": 102.0}]


def test_inline_depth_on_the_market_item_wins_without_a_bridge_call(symbol, bridge):
    fake = bridge()
    LIVE_MARKET_DEPTH[symbol] = {
        "symbol": symbol,
        "marketDepth": {
            "sellMarketDepthList": [{"quantity": 15, "price": 100.2}],
            "buyMarketDepthList": [],
        },
    }

    levels, source = resolve(symbol, ASKS)

    assert source == "live"
    assert levels == [{"quantity": 15, "price": 100.2}]
    assert fake.calls == [], "inline depth should short-circuit the HTTP lookup"


# ----------------------------------------------------------------- caching

def test_book_is_cached_so_a_burst_of_orders_hits_the_bridge_once(symbol, bridge):
    fake = bridge({"sellMarketDepthList": [{"quantity": 10, "price": 101.0}]})

    for _ in range(4):
        resolve(symbol, ASKS)

    assert fake.calls == [symbol]


# ------------------------------------------------------------ snapshot path

def test_snapshot_serves_the_book_when_the_bridge_is_empty(symbol, bridge):
    fake = bridge({"sellMarketDepthList": [{"quantity": 12, "price": 101.0}]})
    resolve(symbol, ASKS)          # capture it while the feed is up
    assert fake.calls == [symbol]

    depth_service.clear_cache()
    bridge()                       # feed goes dark

    levels, source = resolve(symbol, ASKS)

    assert source == "snapshot"
    assert levels == [{"quantity": 12, "price": 101.0}]


def test_stale_levels_outside_the_circuit_band_are_refused(symbol, bridge):
    # A book captured when the stock traded near Rs 100...
    db = SessionLocal()
    save_snapshot(db, snapshot_key(symbol), {
        "sellMarketDepthList": [{"quantity": 10, "price": 101.0}],
        "buyMarketDepthList": [],
    })
    db.close()
    bridge()  # bridge offline

    # ...must not fill an order once the stock trades at Rs 260: 101 is far
    # below the ±10% band, and filling there would hand out free money.
    levels, source = resolve(symbol, ASKS, price=260.0)

    assert source == "simulated"
    assert min(level["price"] for level in levels) > 260.0


def test_snapshot_levels_inside_the_band_are_still_used(symbol, bridge):
    db = SessionLocal()
    save_snapshot(db, snapshot_key(symbol), {
        "sellMarketDepthList": [
            {"quantity": 10, "price": 101.0},   # within ±10% of 100
            {"quantity": 10, "price": 140.0},   # drifted far out
        ],
        "buyMarketDepthList": [],
    })
    db.close()
    bridge()

    levels, source = resolve(symbol, ASKS)

    assert source == "snapshot"
    assert levels == [{"quantity": 10, "price": 101.0}]


# ----------------------------------------------------------- simulated path

def test_falls_back_to_the_simulated_ladder_with_nothing_else_available(symbol, bridge):
    bridge()

    levels, source = resolve(symbol, ASKS)

    assert source == "simulated"
    assert [level["price"] for level in levels] == [101.0, 102.0, 103.0, 104.0, 105.0]


def test_order_walks_real_levels_in_price_order(client, user_headers, test_stock, bridge):
    """The whole path: a market buy consumes the real book cheapest-first.

    Deliberately hands the engine an UNSORTED book — the old code walked levels
    in source order, which would have filled the expensive level first.
    """
    depth_service.clear_cache()
    bridge({
        "sellMarketDepthList": [
            {"quantity": 10, "price": 101.0},   # deliberately not first
            {"quantity": 5, "price": 100.5},    # this is the best ask
        ],
        "buyMarketDepthList": [],
    })

    resp = client.post("/trade/buy", headers=user_headers["headers"], json={
        "symbol": test_stock["symbol"], "quantity": 8, "order_type": "MARKET",
    })
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()

    assert body["depth_source"] == "live"
    # 5 @ 100.5 (502.5) then 3 @ 101.0 (303.0) -> 805.50 total, 100.6875 average.
    # Source order would have filled 8 @ 101.0 = 808.00 instead.
    assert body["quantity_filled"] == 8
    assert body["total_executed_cost"] == pytest.approx(805.5)
    assert body["weighted_average_price"] == pytest.approx(100.6875)


def test_market_order_is_rejected_when_the_real_book_is_too_thin(client, user_headers, test_stock, bridge):
    """A market order must not silently rest; insufficient depth is a 400."""
    depth_service.clear_cache()
    bridge({"sellMarketDepthList": [{"quantity": 3, "price": 100.5}], "buyMarketDepthList": []})

    resp = client.post("/trade/buy", headers=user_headers["headers"], json={
        "symbol": test_stock["symbol"], "quantity": 50, "order_type": "MARKET",
    })

    assert resp.status_code == 400
    assert "Insufficient market supply" in resp.json()["detail"]


def test_matcher_fills_a_resting_order_when_the_real_book_reaches_it(
    client, user_headers, test_stock, bridge
):
    """A limit order that rests today must fill off the real book, not a ladder."""
    from app.models.order import Order
    from app.service.matcher import run_matching_cycle
    from tests.conftest import wallet_balance

    headers = user_headers["headers"]
    depth_service.clear_cache()
    fake = bridge({
        "sellMarketDepthList": [{"quantity": 100, "price": 105.0}],
        "buyMarketDepthList": [],
    })

    # LIMIT BUY 10 @ 99: the best ask is 105, so nothing fills and it rests.
    resp = client.post("/trade/buy", headers=headers, json={
        "symbol": test_stock["symbol"], "quantity": 10,
        "order_type": "LIMIT", "limit_price": 99,
    })
    assert resp.status_code in (200, 201), resp.text
    assert resp.json()["quantity_pending"] == 10
    assert wallet_balance(client, headers) == 100000.0 - 990.0   # escrowed 10 * 99

    # The book improves: someone now offers at 98.5, inside the limit.
    fake.book = {
        "sellMarketDepthList": [{"quantity": 100, "price": 98.5}],
        "buyMarketDepthList": [],
    }
    depth_service.clear_cache()

    db = SessionLocal()
    try:
        asyncio.run(run_matching_cycle(db))
    finally:
        db.close()

    db = SessionLocal()
    order = (
        db.query(Order)
        .filter(Order.user_id == user_headers["user_id"])
        .order_by(Order.order_id.desc())
        .first()
    )
    status, remaining = order.status, order.remaining_quantity
    db.close()

    assert status == "COMPLETED"
    assert remaining == 0
    # Escrowed 990 at the limit, executed 985 at the real ask -> 5 comes back.
    assert wallet_balance(client, headers) == 100000.0 - 985.0


def test_one_sided_book_simulates_only_the_missing_side(symbol, bridge):
    """A real book with bids but no asks shouldn't block a buy."""
    bridge({
        "buyMarketDepthList": [{"quantity": 30, "price": 99.0}],
        "sellMarketDepthList": [],
    })

    bids, bids_source = resolve(symbol, BIDS)
    assert bids_source == "live"
    assert bids == [{"quantity": 30, "price": 99.0}]

    asks, asks_source = resolve(symbol, ASKS)
    assert asks_source == "simulated"
    assert asks[0]["price"] == 101.0
