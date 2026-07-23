from typing import Optional

from pydantic import BaseModel, Field


class WalletDeposit(BaseModel):
    """Request body for loading paper funds into the wallet."""
    amount: float = Field(gt=0, le=10_000_000, description="Amount in NPR to load (max Rs. 10,000,000).")


class WalletWithdraw(BaseModel):
    """Request body for requesting a withdrawal (subject to admin approval)."""
    amount: float = Field(gt=0, le=10_000_000, description="Amount in NPR to withdraw.")


class BankLoad(BaseModel):
    """Request body for loading funds from the e-bank into the trading wallet."""
    amount: float = Field(gt=0, le=10_000_000, description="Amount in NPR to load from the e-bank (max Rs. 10,000,000).")
    bank_name: Optional[str] = Field(default=None, description="Which bank the user is loading from (cosmetic).")


class FundRequestCreate(BaseModel):
    """Request body for requesting more paper money (subject to admin approval)."""
    amount: float = Field(gt=0, le=10_000_000, description="Amount in NPR to request.")
    note: Optional[str] = Field(default=None, description="Optional reason for the request.")
