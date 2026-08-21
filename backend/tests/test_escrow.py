"""Escrow round-trip invariants — the most important money guarantee in the app.

A resting LIMIT order must escrow exactly `remaining_quantity * limit_price`, and
cancelling it must return that exact amount to the wallet — no more, no less.
"""
from tests.conftest import wallet_balance

START = 100000.0  # every new wallet starts at Rs 100,000


def test_limit_buy_escrows_then_cancel_refunds_exactly(client, user_headers, test_stock):
    headers = user_headers["headers"]
    symbol = test_stock["symbol"]
    assert wallet_balance(client, headers) == START

    # LIMIT BUY 10 @ 95: below the simulated ask (101), so it rests fully.
    # Escrow held = 10 * 95 = 950.00
    resp = client.post("/trade/buy", headers=headers, json={
        "symbol": symbol, "quantity": 10, "order_type": "LIMIT", "limit_price": 95,
    })
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    assert body["quantity_pending"] == 10        # nothing filled
    assert body["quantity_filled"] == 0

    # Wallet debited by exactly the escrow amount.
    assert wallet_balance(client, headers) == START - 950.0

    # The order is PENDING.
    orders = client.get("/users/orders", headers=headers).json()
    pending = [o for o in orders if o.get("status", "").lower() == "pending"]
    assert len(pending) == 1
    order_id = pending[0].get("order_id") or pending[0].get("id")

    # Cancel -> escrow returned in full, wallet back to exactly the start.
    cancel = client.post(f"/trade/cancel/{order_id}", headers=headers)
    assert cancel.status_code in (200, 201), cancel.text
    assert wallet_balance(client, headers) == START


def test_limit_buy_rejects_when_below_circuit_floor(client, user_headers, test_stock):
    """±15% circuit filter: last price 100 -> floor 85. A limit of 80 is rejected
    and no escrow is taken."""
    headers = user_headers["headers"]
    symbol = test_stock["symbol"]

    resp = client.post("/trade/buy", headers=headers, json={
        "symbol": symbol, "quantity": 5, "order_type": "LIMIT", "limit_price": 80,
    })
    assert resp.status_code == 400
    assert wallet_balance(client, headers) == START  # untouched


def test_limit_buy_rejects_bad_tick_size(client, user_headers, test_stock):
    """NEPSE tick size is Rs 0.10 — a price of 95.05 must be rejected."""
    headers = user_headers["headers"]
    symbol = test_stock["symbol"]

    resp = client.post("/trade/buy", headers=headers, json={
        "symbol": symbol, "quantity": 5, "order_type": "LIMIT", "limit_price": 95.05,
    })
    assert resp.status_code == 400
    assert wallet_balance(client, headers) == START
