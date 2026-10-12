"""WhatsApp inbound log: every webhook call, numbers masked, for diagnosis.

Revision ID: c9e1a4d7f3b6
Revises: b3f6c2a9d8e1
Create Date: 2026-10-14 19:00:00
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c9e1a4d7f3b6"
down_revision = "b3f6c2a9d8e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_inbound_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("token_ok", sa.Boolean(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
    )
    op.create_index("ix_whatsapp_inbound_log_received_at", "whatsapp_inbound_log", ["received_at"])


def downgrade() -> None:
    op.drop_index("ix_whatsapp_inbound_log_received_at", table_name="whatsapp_inbound_log")
    op.drop_table("whatsapp_inbound_log")
