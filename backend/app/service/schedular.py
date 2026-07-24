# app/services/scheduler.py
import asyncio
import logging
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.stock import Stock
from app.service.nepse import NepseService
from app.service.cache import LIVE_MARKET_DEPTH
from app.service.snapshot import (
    LIVE_MARKET,
    MARKET_SUMMARY,
    NEPSE_INDEX,
    load_snapshot,
    save_snapshot,
)

logger = logging.getLogger(__name__)
nepse_service = NepseService()


def _fill_depth_cache(stocks: list) -> int:
    """Replace the RAM depth cache with `stocks`, keyed by uppercase symbol."""
    LIVE_MARKET_DEPTH.clear()
    for item in stocks:
        symbol = (item.get("symbol") or "").strip().upper()
        if symbol:
            LIVE_MARKET_DEPTH[symbol] = item
    return len(LIVE_MARKET_DEPTH)


def restore_market_cache() -> int:
    """Warm the depth cache from the last saved market snapshot.

    Called at startup so a restart while the bridge is down (or outside trading
    hours) still has real order books to match against, instead of falling all
    the way back to simulated depth. Returns how many symbols were restored.
    """
    db: Session = next(get_db())
    try:
        stocks, captured_at = load_snapshot(db, LIVE_MARKET)
        if not stocks:
            logger.info("No market snapshot stored yet; depth cache starts empty.")
            return 0
        count = _fill_depth_cache(stocks)
        logger.info(f"Restored {count} symbols into the depth cache from the snapshot taken at {captured_at}.")
        return count
    finally:
        db.close()


async def _snapshot_headline_feeds(db: Session) -> None:
    """Persist the index/summary feeds too, so the navbar and index chart have
    something real to show once the bridge goes away."""
    summary = await nepse_service.get_market_summary()
    if summary:
        save_snapshot(db, MARKET_SUMMARY, summary)

    index = await nepse_service.get_nepse_index()
    if index:
        save_snapshot(db, NEPSE_INDEX, index)


async def update_all_stock_prices():
    """
    Periodically fetches the entire NEPSE market, sorts by volume,
    deduplicates the list, and updates all stocks in the database.
    """
    # Wait 5 seconds on startup once
    await asyncio.sleep(5)
    
    while True:
        logger.info("Starting background update for NEPSE stocks...")
        db_generator = get_db()
        db: Session = next(db_generator)
        
        try:
            # 1. Fetch entire market in one network call
            market_data = await nepse_service.get_live_market()
            if not market_data:
                # Bridge down, or NEPSE closed and serving nothing. Keep whatever
                # depth we already hold; only reach for the snapshot if the cache
                # is cold (e.g. this is the first cycle after a restart).
                if LIVE_MARKET_DEPTH:
                    logger.warning(
                        f"Empty market data received. Keeping {len(LIVE_MARKET_DEPTH)} cached symbols."
                    )
                else:
                    stored, captured_at = load_snapshot(db, LIVE_MARKET)
                    if stored:
                        logger.warning(
                            f"Empty market data received. Restored {_fill_depth_cache(stored)} "
                            f"symbols from the snapshot taken at {captured_at}."
                        )
                    else:
                        logger.warning("Empty market data received, and no snapshot stored. Skipping cycle.")
                await asyncio.sleep(300)
                continue
            
            logger.info(f"Received {len(market_data)} raw stocks from the NEPSE Bun bridge.")

            # 2. DEDUPLICATE incoming stocks by symbol (Prevents UniqueViolation DB crashes)
            unique_stocks = []
            seen_symbols = set()
            for item in market_data:
                symbol = item.get("symbol")
                if symbol:
                    symbol = symbol.strip().upper()
                    if symbol not in seen_symbols:
                        seen_symbols.add(symbol)
                        unique_stocks.append(item)
            
            logger.info(f"Deduplicated to {len(unique_stocks)} unique stocks.")

            # 3. UPDATE RAM CACHE using deduplicated list
            _fill_depth_cache(unique_stocks)

            # 3b. Persist it as the fallback for when the feed goes away.
            save_snapshot(db, LIVE_MARKET, unique_stocks)

            # Helper to safely extract trading volume for sorting
            def get_volume(item):
                return int(item.get("totalTradeQuantity") or item.get("volume") or item.get("totalTradedQuantity") or 0)

            # 4. Sort unique stocks descending by trading volume
            sorted_stocks = sorted(unique_stocks, key=get_volume, reverse=True)
            all_stocks = sorted_stocks
            
            # 5. Update database rows
            for item in all_stocks:
                symbol = item.get("symbol").strip().upper()
                
                # Safely extract price and change details
                ltp = item.get("ltp") or item.get("lastTradedPrice") or item.get("closePrice") or 0.0
                company_name = item.get("securityName") or item.get("companyName") or symbol
                volume = get_volume(item)
                change = float(item.get("priceChange") or item.get("change") or 0.0)
                pct_change = float(item.get("percentageChange") or item.get("percent_change") or 0.0)
                
                # Safe conversions to prevent NoneType crashes
                open_price = float(item.get("openPrice") or 0.0)
                high_price = float(item.get("highPrice") or 0.0)
                low_price = float(item.get("lowPrice") or 0.0)

                existing_stock = db.query(Stock).filter(Stock.symbol == symbol).first()
                
                if existing_stock:
                    # Update existing record
                    existing_stock.last_traded_price = float(ltp)
                    existing_stock.company_name = company_name
                    existing_stock.volume = volume
                    existing_stock.change = change
                    existing_stock.percent_change = pct_change
                    existing_stock.open_price = open_price
                    existing_stock.high_price = high_price
                    existing_stock.low_price = low_price
                else:
                    # Create new record safely
                    existing_stock = Stock(
                        symbol=symbol,
                        company_name=company_name,
                        last_traded_price=float(ltp),
                        volume=volume,
                        change=change,
                        percent_change=pct_change,
                        open_price=open_price,
                        high_price=high_price,
                        low_price=low_price
                    )
                    db.add(existing_stock)
            
            db.commit()
            logger.info(f"Successfully updated {len(all_stocks)} unique stocks in database and RAM cache.")

            # 6. Refresh the headline snapshots while the feed is still up.
            await _snapshot_headline_feeds(db)


        except Exception as e:
            db.rollback()
            logger.error(f"Failed to process stock update: {e}")
        finally:
            db.close()

        # Sleep for 5 minutes before running the next update cycle
        await asyncio.sleep(300)

