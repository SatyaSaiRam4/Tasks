"""reminder alarm option

Revision ID: c5e2a9d41f07
Revises: a41c7e2f9b10
Create Date: 2026-10-10 10:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c5e2a9d41f07"
down_revision: str | Sequence[str] | None = "a41c7e2f9b10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "reminders",
        sa.Column("alarm_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("reminders", "alarm_enabled")
