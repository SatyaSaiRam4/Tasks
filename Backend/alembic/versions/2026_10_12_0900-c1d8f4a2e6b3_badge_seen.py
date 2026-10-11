"""Badge congratulations: the highest streak badge each user has been congratulated for.

Revision ID: c1d8f4a2e6b3
Revises: a7c3e9f15b20
Create Date: 2026-10-12 09:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "c1d8f4a2e6b3"
down_revision = "a7c3e9f15b20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_settings", sa.Column("badge_seen", sa.Integer(), server_default="-1", nullable=False))


def downgrade() -> None:
    op.drop_column("user_settings", "badge_seen")
