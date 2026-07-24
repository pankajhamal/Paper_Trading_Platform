"""add market_snapshots table

Stores the last-known-good payload from each nepse-bridge feed so market
screens keep showing real numbers when the bridge is down or NEPSE is closed.

Revision ID: e4f6c8d0a3b2
Revises: d3e5b7c9f2a1
Create Date: 2026-07-24 08:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e4f6c8d0a3b2'
down_revision: Union[str, Sequence[str], None] = 'd3e5b7c9f2a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: create market_snapshots."""
    op.create_table(
        'market_snapshots',
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('captured_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('key'),
    )


def downgrade() -> None:
    """Downgrade schema: drop market_snapshots."""
    op.drop_table('market_snapshots')
