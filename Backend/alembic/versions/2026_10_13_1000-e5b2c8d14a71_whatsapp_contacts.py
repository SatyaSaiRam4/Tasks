"""WhatsApp consent: numbers verified by their owners (and STOP).

Revision ID: e5b2c8d14a71
Revises: e6c2d9a4f8b3
Create Date: 2026-10-13 10:00:00
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "e5b2c8d14a71"
down_revision = "e6c2d9a4f8b3"
branch_labels = None
depends_on = None

status_enum = postgresql.ENUM("PENDING", "VERIFIED", "STOPPED", name="whatsapp_contact_status", create_type=False)


def upgrade() -> None:
    status_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "whatsapp_contacts",
        sa.Column("phone", sa.String(length=20), primary_key=True),
        sa.Column("status", status_enum, nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=True),
        sa.Column("code_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("whatsapp_contacts")
    status_enum.drop(op.get_bind(), checkfirst=True)
