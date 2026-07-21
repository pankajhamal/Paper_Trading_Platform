from pydantic import BaseModel, Field


class WalletDeposit(BaseModel):
    """Request body for loading paper funds into the wallet."""
    amount: float = Field(gt=0, le=10_000_000, description="Amount in NPR to load (max Rs. 10,000,000).")


class WalletWithdraw(BaseModel):
    """Request body for requesting a withdrawal (subject to admin approval)."""
    amount: float = Field(gt=0, le=10_000_000, description="Amount in NPR to withdraw.")
