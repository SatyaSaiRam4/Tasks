"""WhatsApp inbound: message ids already handled, so two servers act on a reply once.

Only adds one table; nothing existing is changed.

Revision ID: f2c4a8d1e7b3
Revises: e8b3f1c6a2d7
Create Date: 2026-10-17 10:00:00
"""

import sqlalchemy as sa

from alembic import op

revision = "f2c4a8d1e7b3"
down_revision = "e8b3f1c6a2d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_inbound_seen",
        sa.Column("message_id", sa.String(160), primary_key=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_whatsapp_inbound_seen_received_at", "whatsapp_inbound_seen", ["received_at"])


def downgrade() -> None:
    op.drop_index("ix_whatsapp_inbound_seen_received_at", table_name="whatsapp_inbound_seen")
    op.drop_table("whatsapp_inbound_seen")
