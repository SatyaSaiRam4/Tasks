"""WhatsApp auto-replies: when Memo last told a number its messages aren't read (once a day).

Revision ID: d4a7e2b9c1f5
Revises: c9e1a4d7f3b6
Create Date: 2026-10-15 10:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "d4a7e2b9c1f5"
down_revision = "c9e1a4d7f3b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_auto_replies",
        sa.Column("phone", sa.String(20), primary_key=True),
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("whatsapp_auto_replies")
