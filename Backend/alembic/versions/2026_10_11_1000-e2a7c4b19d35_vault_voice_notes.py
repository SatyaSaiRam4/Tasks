"""vault voice notes

Revision ID: e2a7c4b19d35
Revises: d8f3b1c27a64
Create Date: 2026-10-11 10:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2a7c4b19d35"
down_revision: Union[str, Sequence[str], None] = "d8f3b1c27a64"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("vault_entries", sa.Column("audio", sa.LargeBinary(), nullable=True))
    op.add_column("vault_entries", sa.Column("audio_mime", sa.String(length=40), nullable=True))
    op.add_column("vault_entries", sa.Column("audio_seconds", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("vault_entries", "audio_seconds")
    op.drop_column("vault_entries", "audio_mime")
    op.drop_column("vault_entries", "audio")
