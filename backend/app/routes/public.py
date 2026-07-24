# app/routes/public.py
"""Unauthenticated endpoints for the public landing page.

These expose only non-sensitive, already-public market data (NEPSE index,
listed-scrip count, top movers) so the marketing page can show real numbers
without requiring a login.
"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.stock import Stock
from app.routes.market import resolve_summary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["Public"])


def _row(stock: Stock) -> dict:
    return {
        "symbol": stock.symbol,
        "company_name": stock.company_name,
        "current_price": stock.last_traded_price,
        "percent_change": stock.percent_change,
        "volume": stock.volume,
    }


@router.get("/overview")
async def public_overview(db: Session = Depends(get_db)):
    """Real market snapshot for the landing page: NEPSE headline, listed-scrip
    count, a most-active ticker, and top gainers/losers. All fields degrade
    gracefully (empty/null) when the live feed is unavailable."""
    priced = (Stock.last_traded_price.isnot(None)) & (Stock.last_traded_price > 0)

    listed = db.query(Stock).filter(priced).count()

    most_active = (
        db.query(Stock).filter(priced)
        .order_by(Stock.volume.desc().nullslast())
        .limit(12).all()
    )
    gainers = (
        db.query(Stock)
        .filter(priced, Stock.percent_change.isnot(None))
        .order_by(Stock.percent_change.desc()).limit(5).all()
    )
    losers = (
        db.query(Stock)
        .filter(priced, Stock.percent_change.isnot(None))
        .order_by(Stock.percent_change.asc()).limit(5).all()
    )

    # NEPSE headline: live from the bridge, else the last stored snapshot, else
    # nulls. Never raises — the landing page must render regardless.
    try:
        nepse = await resolve_summary(db)
    except Exception as e:
        logger.warning(f"public overview: market summary unavailable: {e}")
        nepse = {"point": None, "change": None, "percent_change": None,
                 "turnover": None, "volume": None, "is_open": None,
                 "is_stale": False, "as_of": None}

    return {
        "nepse": nepse,
        "listed_scrips": listed,
        "ticker": [_row(s) for s in most_active],
        "gainers": [_row(s) for s in gainers],
        "losers": [_row(s) for s in losers],
    }
