"""quick one-tap confirmation by default for new users

Revision ID: d8f3b1c27a64
Revises: c5e2a9d41f07
Create Date: 2026-10-10 15:00:00
"""

from typing import Sequence, Union

from alembic import op

revision: str = "d8f3b1c27a64"
down_revision: Union[str, Sequence[str], None] = "c5e2a9d41f07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only the default for new rows changes; existing users keep their choice.
    op.alter_column("user_settings", "confirmation_mode", server_default="QUICK")


def downgrade() -> None:
    op.alter_column("user_settings", "confirmation_mode", server_default="STANDARD")
