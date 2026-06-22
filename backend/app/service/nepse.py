import httpx 
from fastapi import HTTPException, status
from typing import List
from app.core.logger import get_logger
import logging

logger = logging.getLogger(__name__)

class NepseService:
  def __init__(self, bridge_url: str= "http://localhost:3000"):
    self.bridge_url = bridge_url

  
  async def get_live_market(self) ->List:
    """
    Fetches the complete live market snapshot from the Bun bridge.
    """
    async with httpx.AsyncClient() as client:
      try:
        response = await client.get(f"{self.bridge_url}/live-market", timeout=15.0)
        response.raise_for_status()
        return response.json()
      except Exception as e:
        logger.error(f"Failed to fetch live market from bridge: {e}")
        return []

  async def get_live_price_and_name(self, symbol: str) -> tuple[float, str]:
    """
    Calls the Bun sidecar to fetch the LTP and Full Company Name.
    """

    symbol = symbol.upper().strip()

    async with httpx.AsyncClient() as client:
      try:
        response = await client.get(f"{self.bridge_url}/price/{symbol}", timeout=10.0)
        
        if response.status_code == 404:
          raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock symbol '{symbol}' was not found on NEPSE."
          )
        elif response.status_code !=200:

          raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not retrieve valid stock data."
          )
        
        data = response.json()
        ltp = data.get("ltp")
        company_name = data.get("name", symbol)

        return float(ltp), str(company_name)
      
      except httpx.HTTPError as e:
        raise HTTPException(
          status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
          detail="NEPSE interface service is temporarily unreachable."
        )