import uuid
from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(UTC)


class WalletRedemption(Base):
    """A request to turn streak points into money, paid to a mobile number.

    Points come from best-streak milestones (500 points at a best streak of
    500, 1000 more at 1000; each once, ever). A redemption spends 500 points
    (₹10) or 1000 points (₹20); it counts against the points straight away, so
    the same points can never be claimed twice. Payouts are made by hand:
    `status` starts PENDING and an admin marks it PAID (with the payment
    reference, who and when) or REJECTED (the points come back). These rows
    are the redemption ledger: they're never deleted or changed otherwise.
    """

    __tablename__ = "wallet_redemptions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_wallet_redemptions_amount_positive"),
        CheckConstraint("points > 0", name="ck_wallet_redemptions_points_positive"),
        CheckConstraint("status IN ('PENDING', 'PAID', 'REJECTED')", name="ck_wallet_redemptions_status"),
        # The app's request id: a repeated request returns the first redemption.
        UniqueConstraint("user_id", "request_id", name="uq_wallet_redemptions_user_request"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # whole rupees
    points: Mapped[int] = mapped_column(Integer, nullable=False)  # points spent (50 per rupee)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payout_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)  # UPI / bank reference
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)  # why it was rejected
    decided_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
