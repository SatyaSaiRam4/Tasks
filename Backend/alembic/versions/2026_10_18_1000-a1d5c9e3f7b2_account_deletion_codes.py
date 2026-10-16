"""Account deletion codes: the emailed code that confirms deleting an account.

Only adds one table; nothing existing is changed.

Revision ID: a1d5c9e3f7b2
Revises: f2c4a8d1e7b3
Create Date: 2026-10-18 10:00:00
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "a1d5c9e3f7b2"
down_revision = "f2c4a8d1e7b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account_deletion_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code_hash", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_account_deletion_codes_user_id", "account_deletion_codes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_account_deletion_codes_user_id", table_name="account_deletion_codes")
    op.drop_table("account_deletion_codes")
