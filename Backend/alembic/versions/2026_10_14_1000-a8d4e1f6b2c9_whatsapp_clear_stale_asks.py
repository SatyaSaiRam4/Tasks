"""WhatsApp: clear "asked" times left over from the code-based version.

When the codes were replaced by the YES reply, numbers that had been tried
with a code kept the code's expiry as their "asked at" time, so they looked
asked already and the permission message was never sent. Clearing it lets
them be asked properly.

Revision ID: a8d4e1f6b2c9
Revises: f7a3d9b2c6e4
Create Date: 2026-10-14 10:00:00
"""

from alembic import op

revision = "a8d4e1f6b2c9"
down_revision = "f7a3d9b2c6e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE whatsapp_contacts SET asked_at = NULL WHERE status = 'PENDING'")


def downgrade() -> None:
    pass  # Nothing to restore: only a timestamp was cleared.
