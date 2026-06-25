import httpx
from fastapi import HTTPException, status
from typing import List
from app.core.logger import get_logger
import logging
import random

logger = logging.getLogger(__name__)

def generate_simulated_depth(base_price: float) -> list:
    """
    Generates a simulated, randomized 5-level selling order book (asks)
    around a base closing price for high-fidelity offline trading.
    """
    return [
        # Level 1 Ask: Small quantity close to base price
        {"quantity": random.randint(100, 1000), "price": base_price + 1.0},
        # Level 2 Ask
        {"quantity": random.randint(500, 2000), "price": base_price + 2.0},
        # Level 3 Ask
        {"quantity": random.randint(1000, 5000), "price": base_price + 3.0},
        # Level 4 Ask
        {"quantity": random.randint(2000, 10000), "price": base_price + 4.0},
        # Level 5 Ask: Large supply further away from base price
        {"quantity": random.randint(5000, 20000), "price": base_price + 5.0}
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
        Attempts to fetch live market depth from Bun.
        Returns empty dict on failure/off-hours to trigger local fallback.
        """
        symbol = symbol.upper().strip()
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.bridge_url}/depth/{symbol}", timeout=5.0
                )
                if response.status_code == 200:
                    return response.json()
            except Exception as e:
                logger.warning(f"Live market depth for {symbol} unavailable: {e}")
            return {}
      
      
