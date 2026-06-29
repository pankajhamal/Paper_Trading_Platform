import httpx
from typing import List, Dict, Any
from app.core.logger import get_logger
import logging
import random

logger = logging.getLogger(__name__)

def generate_simulated_depth(base_price: float) -> List[Dict[str, Any]]:
    """
    Generates a standardized 5-level selling order book (asks).
    """
    return [
        {"quantity": random.randint(100, 1000), "price": base_price + 1.0},
        {"quantity": random.randint(500, 2000), "price": base_price + 2.0},
        {"quantity": random.randint(1000, 5000), "price": base_price + 3.0},
        {"quantity": random.randint(2000, 10000), "price": base_price + 4.0},
        {"quantity": random.randint(5000, 20000), "price": base_price + 5.0}
    ]

def generate_simulated_bid_depth(base_price: float) -> List[Dict[str, Any]]:
    """
    Generates a standardized 5-level buying order book (bids).
    """
    return [
        {"quantity": random.randint(100, 1000), "price": base_price - 1.0},
        {"quantity": random.randint(500, 2000), "price": base_price - 2.0},
        {"quantity": random.randint(1000, 5000), "price": base_price - 3.0},
        {"quantity": random.randint(2000, 10000), "price": base_price - 4.0},
        {"quantity": random.randint(5000, 20000), "price": base_price - 5.0}
    ]

class NepseService:
    def __init__(self, bridge_url: str = "http://localhost:3000"):
        self.bridge_url = bridge_url

    async def get_live_market(self) -> List:
        """
        Fetches the complete live market snapshot from the Bun bridge.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.bridge_url}/live-market", timeout=15.0
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Failed to fetch live market from bridge: {e}")
                return []

    async def get_market_depth(self, symbol: str) -> dict:
        """
        Fetches live market depth and normalizes the data structure.
        Always returns standard keys: 'buyMarketDepthList' and 'sellMarketDepthList'
        using 'price' and 'quantity'.
        """
        symbol = symbol.upper().strip()
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.bridge_url}/depth/{symbol}", timeout=5.0
                )
                if response.status_code == 200:
                    raw_data = response.json()
                    
                    # Safely extract raw depth lists
                    market_depth = raw_data.get("marketDepth", {})
                    raw_buys = market_depth.get("buyMarketDepthList", [])
                    raw_sells = market_depth.get("sellMarketDepthList", [])
                    
                    # Normalize key names (convert orderBookOrderPrice -> price)
                    normalized_buys = [
                        {
                            "quantity": int(level.get("quantity") or 0),
                            "price": float(level.get("orderBookOrderPrice") or 0.0)
                        }
                        for level in raw_buys
                    ]
                    
                    normalized_sells = [
                        {
                            "quantity": int(level.get("quantity") or 0),
                            "price": float(level.get("orderBookOrderPrice") or 0.0)
                        }
                        for level in raw_sells
                    ]
                    
                    return {
                        "buyMarketDepthList": normalized_buys,
                        "sellMarketDepthList": normalized_sells
                    }
                    
            except Exception as e:
                logger.warning(f"Live market depth for {symbol} unavailable: {e}")
            
            # Return empty standardized lists on failure
            return {
                "buyMarketDepthList": [],
                "sellMarketDepthList": []
            }