"""add non-negative CHECK constraints on money and quantity columns

Revision ID: c2d4a6b8e0f1
Revises: b1f0e2a7c4d9
Create Date: 2026-07-23 14:05:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c2d4a6b8e0f1'
down_revision: Union[str, Sequence[str], None] = 'b1f0e2a7c4d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Backstop the application-level guards so balances/quantities can never
    persist as negative even if a lock is slipped or a bug writes bad math."""
    op.create_check_constraint("ck_wallet_balance_nonneg", "wallet", "balance >= 0")
    op.create_check_constraint("ck_bank_balance_nonneg", "bank_accounts", "balance >= 0")
    op.create_check_constraint("ck_portfolio_qty_nonneg", "portfolio", "quantity >= 0")
    op.create_check_constraint("ck_order_quantity_nonneg", "orders", "quantity >= 0")
    op.create_check_constraint("ck_order_remaining_nonneg", "orders", "remaining_quantity >= 0")


def downgrade() -> None:
    op.drop_constraint("ck_order_remaining_nonneg", "orders", type_="check")
    op.drop_constraint("ck_order_quantity_nonneg", "orders", type_="check")
    op.drop_constraint("ck_portfolio_qty_nonneg", "portfolio", type_="check")
    op.drop_constraint("ck_bank_balance_nonneg", "bank_accounts", type_="check")
    op.drop_constraint("ck_wallet_balance_nonneg", "wallet", type_="check")
