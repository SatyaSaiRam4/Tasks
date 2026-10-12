"""google sign-in

users.google_sub links an account to one Google account (Google's stable
"sub" ID), so repeat sign-ins find the same user and never duplicate it.

Revision ID: e6c2d9a4f8b3
Revises: b9e3f7a2c4d1
Create Date: 2026-10-12 17:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e6c2d9a4f8b3"
down_revision: str | Sequence[str] | None = "b9e3f7a2c4d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_sub", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_google_sub"), table_name="users")
    op.drop_column("users", "google_sub")
