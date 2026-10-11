"""Vault photos (encrypted images on Vault notes) and the tap sound setting.

Revision ID: a7c3e9f15b20
Revises: f4b9d2e61c08
Create Date: 2026-10-11 18:00:00
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a7c3e9f15b20"
down_revision = "f4b9d2e61c08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vault_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entry_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vault_entries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("mime", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_vault_images_entry_id", "vault_images", ["entry_id"])
    op.create_index("ix_vault_images_user_id", "vault_images", ["user_id"])
    op.add_column("user_settings", sa.Column("tap_sound", sa.Boolean(), server_default="false", nullable=False))


def downgrade() -> None:
    op.drop_column("user_settings", "tap_sound")
    op.drop_index("ix_vault_images_user_id", table_name="vault_images")
    op.drop_index("ix_vault_images_entry_id", table_name="vault_images")
    op.drop_table("vault_images")
