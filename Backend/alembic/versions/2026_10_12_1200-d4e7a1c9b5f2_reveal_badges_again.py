"""Reveal badges again: earlier builds recorded badges as congratulated without
showing the unlock on Home, so every held badge gets its reveal once.

Revision ID: d4e7a1c9b5f2
Revises: c1d8f4a2e6b3
Create Date: 2026-10-12 12:00:00
"""

from alembic import op

revision = "d4e7a1c9b5f2"
down_revision = "c1d8f4a2e6b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE user_settings SET badge_seen = -1")


def downgrade() -> None:
    pass  # Nothing to undo: it only cleared a "seen" marker.
