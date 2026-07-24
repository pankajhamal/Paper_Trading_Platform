"""Shared pytest fixtures.

These are integration tests: they run against the app's configured database via
the FastAPI TestClient. Each fixture creates uniquely-named throwaway data and
cleans it up afterwards so runs don't collide or pollute real accounts.
"""
import uuid

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.database.connection import SessionLocal
from app.models.users import User
from app.models.stock import Stock
from app.models.wallet import Wallet
from app.models.bank_account import BankAccount
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction
from app.models.order import Order
from app.models.withdrawal import WithdrawalRequest
from app.models.fund_request import FundRequest
from app.service.cache import LIVE_MARKET_DEPTH
from app.service import depth as depth_service


class _OfflineBridge:
    """A bridge that has nothing to say — what the engine sees when nepse-bridge
    is down or NEPSE is closed."""

    async def get_market_depth(self, symbol):
        return {"buyMarketDepthList": [], "sellMarketDepthList": []}


@pytest.fixture(scope="session", autouse=True)
def offline_bridge():
    """Keep the suite hermetic and fast.

    Depth resolution now calls the bridge per symbol, so without this a test
    would fire real HTTP at NEPSE for a made-up ticker and wait out the timeout.
    Stubbing it offline also pins the tests to the fallback path they assert on.
    """
    original = depth_service.nepse_service
    depth_service.nepse_service = _OfflineBridge()
    depth_service.clear_cache()
    yield
    depth_service.nepse_service = original
    depth_service.clear_cache()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def test_stock():
    """A unique stock priced at Rs 100 with NO live depth, so the matching
    engine uses the simulated order book (asks at 101..105)."""
    symbol = f"TST{uuid.uuid4().hex[:6].upper()}"
    db = SessionLocal()
    stock = Stock(
        symbol=symbol,
        company_name="Escrow Test Co",
        last_traded_price=100.0,
        volume=0,
    )
    db.add(stock)
    db.commit()
    db.refresh(stock)
    stock_id = stock.stock_id
    db.close()

    # Ensure no cached live depth for this symbol -> simulated fallback path.
    # (The bridge is stubbed offline session-wide by `offline_bridge`, and no
    # snapshot exists for a symbol invented microseconds ago.)
    LIVE_MARKET_DEPTH.pop(symbol, None)
    depth_service.clear_cache()

    yield {"symbol": symbol, "stock_id": stock_id}

    # Remove any rows referencing this stock before deleting it (FK safety),
    # regardless of fixture teardown ordering.
    db = SessionLocal()
    db.query(Order).filter(Order.stock_id == stock_id).delete()
    db.query(Portfolio).filter(Portfolio.stock_id == stock_id).delete()
    db.query(Stock).filter(Stock.stock_id == stock_id).delete()
    db.commit()
    db.close()


@pytest.fixture
def user_headers(client):
    """Register + log in a unique user; return auth headers and clean up after."""
    email = f"esc_{uuid.uuid4().hex[:8]}@example.com"
    password = "testpass123"
    client.post("/auth/register", json={
        "full_name": "Escrow Tester", "email": email, "password": password,
    })
    resp = client.post("/auth/login", data={"username": email, "password": password})
    token = resp.json()["access_token"]

    db = SessionLocal()
    user_id = db.query(User).filter(User.email == email).first().user_id
    db.close()

    yield {"headers": {"Authorization": f"Bearer {token}"}, "user_id": user_id}

    # Clean up all rows owned by this user (children first for FK safety).
    db = SessionLocal()
    for model in (Transaction, Order, Portfolio, WithdrawalRequest,
                  FundRequest, BankAccount, Wallet):
        db.query(model).filter(model.user_id == user_id).delete()
    db.query(User).filter(User.user_id == user_id).delete()
    db.commit()
    db.close()


def wallet_balance(client, headers):
    return client.get("/users/me/wallet", headers=headers).json()["balance"]
