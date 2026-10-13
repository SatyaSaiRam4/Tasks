"""Payments (Razorpay), the WhatsApp plan and its usage ledger, and wallet points.

Only adds tables, columns and constraints; nothing existing is dropped or
rewritten. Existing wallet redemptions (if any) get points = rupees x 50, the
rate the new choices use (500 points = ₹10).

Revision ID: e8b3f1c6a2d7
Revises: d4a7e2b9c1f5
Create Date: 2026-10-16 10:00:00
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "e8b3f1c6a2d7"
down_revision = "d4a7e2b9c1f5"
branch_labels = None
depends_on = None

UUID = postgresql.UUID(as_uuid=True)
TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "payment_orders",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("purpose", sa.String(40), nullable=False),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("mode", sa.String(8), nullable=False),
        sa.Column("provider_order_id", sa.String(64), nullable=False, unique=True),
        sa.Column("provider_payment_id", sa.String(64), nullable=True, unique=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("failure_reason", sa.String(255), nullable=True),
        sa.Column("checked_at", TS, nullable=True),
        sa.Column("paid_at", TS, nullable=True),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("updated_at", TS, nullable=False),
        sa.CheckConstraint("amount_paise > 0", name="ck_payment_orders_amount_positive"),
        sa.CheckConstraint("status IN ('CREATED', 'PAID', 'FAILED', 'EXPIRED')", name="ck_payment_orders_status"),
    )
    op.create_index("ix_payment_orders_user_created", "payment_orders", ["user_id", "created_at"])

    op.create_table(
        "payment_events",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("provider_event_id", sa.String(80), nullable=False, unique=True),
        sa.Column("event", sa.String(60), nullable=False),
        sa.Column("provider_order_id", sa.String(64), nullable=True),
        sa.Column("provider_payment_id", sa.String(64), nullable=True),
        sa.Column("result", sa.String(120), nullable=False),
        sa.Column("received_at", TS, nullable=False),
    )
    op.create_index("ix_payment_events_provider_order_id", "payment_events", ["provider_order_id"])

    op.create_table(
        "whatsapp_plans",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payment_order_id", UUID, sa.ForeignKey("payment_orders.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("messages_granted", sa.Integer(), nullable=False),
        sa.Column("messages_carried", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("messages_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("starts_at", TS, nullable=False),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("ended_at", TS, nullable=True),
        sa.Column("created_at", TS, nullable=False),
        sa.CheckConstraint("messages_used >= 0", name="ck_whatsapp_plans_used_nonnegative"),
        sa.CheckConstraint("messages_used <= messages_granted + messages_carried", name="ck_whatsapp_plans_used_within_allowance"),
        sa.CheckConstraint("expires_at > starts_at", name="ck_whatsapp_plans_period"),
    )
    op.create_index("ix_whatsapp_plans_user_id", "whatsapp_plans", ["user_id"])
    op.create_index("uq_whatsapp_plans_one_open", "whatsapp_plans", ["user_id"], unique=True, postgresql_where=sa.text("ended_at IS NULL"))

    op.create_table(
        "whatsapp_usage",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reminder_id", UUID, sa.ForeignKey("reminders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("plan_id", UUID, sa.ForeignKey("whatsapp_plans.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source", sa.String(8), nullable=False),
        sa.Column("idempotency_key", sa.String(120), nullable=False, unique=True),
        sa.Column("scheduled_for", TS, nullable=True),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("counted", sa.Boolean(), nullable=False),
        sa.Column("delivery_status", sa.String(16), nullable=True),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("updated_at", TS, nullable=False),
        sa.CheckConstraint("source IN ('FREE', 'PLAN', 'NONE')", name="ck_whatsapp_usage_source"),
        sa.CheckConstraint("status IN ('ATTEMPTED', 'ACCEPTED', 'REJECTED', 'UNKNOWN', 'BLOCKED')", name="ck_whatsapp_usage_status"),
    )
    op.create_index("ix_whatsapp_usage_user_source", "whatsapp_usage", ["user_id", "source", "counted"])

    # Wallet: points per redemption, request ids, and the payout record.
    op.add_column("wallet_redemptions", sa.Column("points", sa.Integer(), nullable=True))
    op.execute("UPDATE wallet_redemptions SET points = amount * 50 WHERE points IS NULL")
    op.alter_column("wallet_redemptions", "points", nullable=False)
    op.add_column("wallet_redemptions", sa.Column("request_id", sa.String(64), nullable=True))
    op.add_column("wallet_redemptions", sa.Column("payout_reference", sa.String(120), nullable=True))
    op.add_column("wallet_redemptions", sa.Column("note", sa.String(255), nullable=True))
    op.add_column("wallet_redemptions", sa.Column("decided_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    op.add_column("wallet_redemptions", sa.Column("decided_at", TS, nullable=True))
    op.create_check_constraint("ck_wallet_redemptions_amount_positive", "wallet_redemptions", "amount > 0")
    op.create_check_constraint("ck_wallet_redemptions_points_positive", "wallet_redemptions", "points > 0")
    op.create_check_constraint("ck_wallet_redemptions_status", "wallet_redemptions", "status IN ('PENDING', 'PAID', 'REJECTED')")
    op.create_unique_constraint("uq_wallet_redemptions_user_request", "wallet_redemptions", ["user_id", "request_id"])


def downgrade() -> None:
    op.drop_constraint("uq_wallet_redemptions_user_request", "wallet_redemptions", type_="unique")
    op.drop_constraint("ck_wallet_redemptions_status", "wallet_redemptions", type_="check")
    op.drop_constraint("ck_wallet_redemptions_points_positive", "wallet_redemptions", type_="check")
    op.drop_constraint("ck_wallet_redemptions_amount_positive", "wallet_redemptions", type_="check")
    for column in ("decided_at", "decided_by", "note", "payout_reference", "request_id", "points"):
        op.drop_column("wallet_redemptions", column)
    op.drop_index("ix_whatsapp_usage_user_source", table_name="whatsapp_usage")
    op.drop_table("whatsapp_usage")
    op.drop_index("uq_whatsapp_plans_one_open", table_name="whatsapp_plans")
    op.drop_index("ix_whatsapp_plans_user_id", table_name="whatsapp_plans")
    op.drop_table("whatsapp_plans")
    op.drop_index("ix_payment_events_provider_order_id", table_name="payment_events")
    op.drop_table("payment_events")
    op.drop_index("ix_payment_orders_user_created", table_name="payment_orders")
    op.drop_table("payment_orders")
