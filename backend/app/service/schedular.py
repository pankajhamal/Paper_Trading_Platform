# This is responsible for updating the database every 5 minutes
import asyncio
import logging
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.stock import Stock
from app.service.nepse import NepseService

logger = logging.getLogger(__name__)
nepse_service = NepseService()

async def update_all_stock_prices():
    """
    Periodically fetches the entire NEPSE market, sorts by volume,
    and updates the top 50 stocks in the database.
    """
    await asyncio.sleep(5)
    while True:
        # Run every 5 minutes (300 seconds)
        await asyncio.sleep(300)
        logger.info("Starting background update for top 50 stocks...")
        
        db_generator = get_db()
        db: Session = next(db_generator)
        
        try:
            # 1. Fetch entire market in one network call
            market_data = await nepse_service.get_live_market()
            if not market_data:
                logger.warning("Empty market data received. Skipping cycle.")
                continue
            
            logger.info(f"Received {len(market_data)} total stocks from the NEPSE Bun bridge.")
            
            # Helper to safely extract trading volume for sorting
            def get_volume(item):
                return int(item.get("totalTradeQuantity") or item.get("volume") or item.get("totalTradedQuantity") or 0)

            # 2. Sort stocks descending by trading volume
            sorted_stocks = sorted(market_data, key=get_volume, reverse=True)
            # top_50 = sorted_stocks[:50]
            all_stocks = sorted_stocks
            
            # 3. Update database rows
            for item in all_stocks:
                symbol = item.get("symbol")
                if not symbol:
                    continue
                
                # Safely extract price and change details
                ltp = item.get("ltp") or item.get("lastTradedPrice") or item.get("closePrice") or 0.0
                company_name = item.get("securityName") or item.get("companyName") or symbol
                volume = get_volume(item)
                change = float(item.get("priceChange") or item.get("change") or 0.0)
                pct_change = float(item.get("percentageChange") or item.get("percent_change") or 0.0)
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
                    # Create new record if stock is not in our database yet
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
            logger.info("Successfully updated Top 50 stocks in database.")
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to process top 50 stock update: {e}")
        finally:
            db.close()

        