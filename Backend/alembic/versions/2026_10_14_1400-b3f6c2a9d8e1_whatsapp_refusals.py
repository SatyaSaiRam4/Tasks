"""WhatsApp: count refusals, so a number can be asked again (but not after 3 a day).

Revision ID: b3f6c2a9d8e1
Revises: a8d4e1f6b2c9
Create Date: 2026-10-14 14:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "b3f6c2a9d8e1"
down_revision = "a8d4e1f6b2c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("whatsapp_contacts", sa.Column("refusals", sa.Integer(), server_default="0", nullable=False))
    op.add_column("whatsapp_contacts", sa.Column("refusals_since", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("whatsapp_contacts", "refusals_since")
    op.drop_column("whatsapp_contacts", "refusals")
