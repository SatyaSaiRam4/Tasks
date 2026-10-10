"""Profile photos: the photo on users, and a privacy switch in settings.

Revision ID: f4b9d2e61c08
Revises: e2a7c4b19d35
Create Date: 2026-10-11 14:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "f4b9d2e61c08"
down_revision = "e2a7c4b19d35"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("photo", sa.LargeBinary(), nullable=True))
    op.add_column("users", sa.Column("photo_mime", sa.String(length=40), nullable=True))
    op.add_column("users", sa.Column("photo_version", sa.Integer(), server_default="0", nullable=False))
    op.add_column("user_settings", sa.Column("show_photo", sa.Boolean(), server_default="true", nullable=False))


def downgrade() -> None:
    op.drop_column("user_settings", "show_photo")
    op.drop_column("users", "photo_version")
    op.drop_column("users", "photo_mime")
    op.drop_column("users", "photo")
