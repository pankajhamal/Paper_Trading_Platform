# app/services/scheduler.py
import asyncio
import logging
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.stock import Stock
from app.service.nepse import NepseService
from app.service.cache import LIVE_MARKET_DEPTH

logger = logging.getLogger(__name__)
nepse_service = NepseService()

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
                logger.warning("Empty market data received. Skipping cycle.")
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
            LIVE_MARKET_DEPTH.clear()
            for item in unique_stocks:
                symbol = item.get("symbol").strip().upper()
                LIVE_MARKET_DEPTH[symbol] = item

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
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to process stock update: {e}")
        finally:
            db.close()

        # Sleep for 5 minutes before running the next update cycle
        await asyncio.sleep(300)

