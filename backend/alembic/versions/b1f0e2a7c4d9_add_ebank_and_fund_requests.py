"""add e-bank (bank_accounts) and fund_requests tables

Revision ID: b1f0e2a7c4d9
Revises: 64aa07c97bb3
Create Date: 2026-07-23 13:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1f0e2a7c4d9'
down_revision: Union[str, Sequence[str], None] = '64aa07c97bb3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: create bank_accounts + fund_requests, backfill banks."""
    op.create_table(
        'bank_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('balance', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('bank_name', sa.String(), nullable=False, server_default='PaperTrade Bank'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index(op.f('ix_bank_accounts_id'), 'bank_accounts', ['id'], unique=False)

    op.create_table(
        'fund_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.DECIMAL(precision=12, scale=2), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('reviewed_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.user_id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_fund_requests_id'), 'fund_requests', ['id'], unique=False)

    # Backfill: give every existing user a default e-bank account (Rs 100,000).
    op.execute(
        """
        INSERT INTO bank_accounts (user_id, balance, bank_name, created_at, updated_at)
        SELECT u.user_id, 100000, 'PaperTrade Bank', NOW(), NOW()
        FROM users u
        WHERE NOT EXISTS (
            SELECT 1 FROM bank_accounts b WHERE b.user_id = u.user_id
        )
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_fund_requests_id'), table_name='fund_requests')
    op.drop_table('fund_requests')
    op.drop_index(op.f('ix_bank_accounts_id'), table_name='bank_accounts')
    op.drop_table('bank_accounts')
