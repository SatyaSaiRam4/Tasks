"""WhatsApp consent by reply: no codes, just when the permission message was sent.

Revision ID: f7a3d9b2c6e4
Revises: e5b2c8d14a71
Create Date: 2026-10-13 15:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "f7a3d9b2c6e4"
down_revision = "e5b2c8d14a71"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("whatsapp_contacts", "code_hash")
    op.alter_column("whatsapp_contacts", "code_expires_at", new_column_name="asked_at")


def downgrade() -> None:
    op.alter_column("whatsapp_contacts", "asked_at", new_column_name="code_expires_at")
    op.add_column("whatsapp_contacts", sa.Column("code_hash", sa.String(length=64), nullable=True))
