"""tracks actions streaks vault

Categories -> Tracks, Tasks -> Actions (with per-date completions), Notes ->
encrypted Vault, plus streak history, track completion bonuses, achievements,
per-user settings/privacy, public user IDs, and password reset codes.

Every existing row is preserved:
  * categories become tracks (start_date backfilled from created_at);
  * tasks with no category are moved into an auto-created "General" track;
  * tasks become actions (scheduled_at -> start_date + time_of_day), and every
    previously COMPLETED task becomes an ActionCompletion for its date;
  * task checklist items become action steps;
  * the old category-level checklist (a removed feature) is kept, unmapped, as
    legacy_category_checklist_items;
  * notes are encrypted into vault_entries (needs VAULT_ENCRYPTION_KEYS).

Revision ID: d757e039bb51
Revises: b33bd85d0492
Create Date: 2026-10-04 17:16:00
"""

import json
import os
import secrets
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from cryptography.fernet import Fernet, MultiFernet
from dotenv import load_dotenv
from sqlalchemy.dialects import postgresql

revision: str = "d757e039bb51"
down_revision: Union[str, Sequence[str], None] = "b33bd85d0492"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Existing users all registered from India before timezones were tracked;
# their "days" are computed in IST. New users get their device's zone.
LEGACY_TIMEZONE = "Asia/Kolkata"


def _vault_cipher() -> MultiFernet:
    load_dotenv(override=True)
    keys = [k.strip() for k in os.getenv("VAULT_ENCRYPTION_KEYS", "").split(",") if k.strip()]
    if not keys:
        raise RuntimeError("VAULT_ENCRYPTION_KEYS must be set before running this migration (notes get encrypted).")
    return MultiFernet([Fernet(k) for k in keys])


def _public_id_base(display_name: str) -> str:
    letters = "".join(ch for ch in display_name.upper() if ch.isalnum())[:8]
    return letters or "USER"


def upgrade() -> None:
    bind = op.get_bind()

    # ---- users ------------------------------------------------------------
    op.add_column("users", sa.Column("public_id", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("timezone", sa.String(length=64), server_default="UTC", nullable=False))
    op.add_column("users", sa.Column("avatar", sa.String(length=16), nullable=True))
    op.add_column("users", sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("onboarding_version", sa.Integer(), server_default="0", nullable=False))

    taken: set[str] = set()
    for user_id, display_name in bind.execute(sa.text("SELECT id, display_name FROM users")).fetchall():
        while True:
            candidate = f"{_public_id_base(display_name)}_{secrets.token_hex(3).upper()[:5]}"
            if candidate not in taken:
                break
        taken.add(candidate)
        bind.execute(
            sa.text(
                "UPDATE users SET public_id = :pid, timezone = :tz, "
                "onboarding_completed_at = now(), onboarding_version = 1 WHERE id = :id"
            ),
            {"pid": candidate, "tz": LEGACY_TIMEZONE, "id": user_id},
        )
    op.alter_column("users", "public_id", nullable=False)
    op.create_index("ix_users_public_id", "users", ["public_id"], unique=True)

    op.create_table(
        "password_reset_codes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_password_reset_codes_user_id", "password_reset_codes", ["user_id"])

    # ---- user_settings ----------------------------------------------------
    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("accent_color", sa.String(length=16), nullable=True),
        sa.Column("animations_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("reduced_motion", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("satya_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("confirmation_mode", sa.String(length=16), server_default="STANDARD", nullable=False),
        sa.Column("vault_autolock_minutes", sa.Integer(), server_default="5", nullable=False),
        sa.Column("notify_actions", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("notify_reminders", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("notify_streak_warnings", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("notify_achievements", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_public_profile", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("show_current_streak", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("show_best_streak", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("show_achievements", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.execute("INSERT INTO user_settings (user_id) SELECT id FROM users")
    op.alter_column("user_settings", "updated_at", server_default=None)

    # ---- categories -> tracks ----------------------------------------------
    op.rename_table("categories", "tracks")
    op.execute("ALTER TABLE tracks RENAME CONSTRAINT categories_pkey TO tracks_pkey")
    op.execute("ALTER TABLE tracks RENAME CONSTRAINT categories_user_id_fkey TO tracks_user_id_fkey")
    op.execute("ALTER INDEX ix_categories_user_id RENAME TO ix_tracks_user_id")
    op.add_column("tracks", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("tracks", sa.Column("start_date", sa.Date(), nullable=True))
    op.add_column("tracks", sa.Column("end_date", sa.Date(), nullable=True))
    op.add_column("tracks", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.execute(
        "UPDATE tracks t SET start_date = (t.created_at AT TIME ZONE u.timezone)::date "
        "FROM users u WHERE u.id = t.user_id"
    )
    op.alter_column("tracks", "start_date", nullable=False)
    op.create_check_constraint("ck_tracks_date_range", "tracks", "end_date IS NULL OR end_date >= start_date")

    # The category-level checklist was removed from the product; keep its rows.
    op.rename_table("category_checklist_items", "legacy_category_checklist_items")

    # ---- tasks without a category get a "General" track --------------------
    op.execute(
        """
        INSERT INTO tracks (id, user_id, name, icon, color, sort_order, is_archived, created_at, updated_at, start_date)
        SELECT gen_random_uuid(), x.user_id, 'General', NULL, NULL, 0, false, now(), now(), x.first_day
        FROM (
            SELECT t.user_id, min((coalesce(t.scheduled_at, t.created_at) AT TIME ZONE u.timezone)::date) AS first_day
            FROM tasks t JOIN users u ON u.id = t.user_id
            WHERE t.category_id IS NULL
            GROUP BY t.user_id
        ) x
        """
    )
    op.execute(
        """
        UPDATE tasks t SET category_id = tr.id
        FROM tracks tr
        WHERE t.category_id IS NULL AND tr.user_id = t.user_id AND tr.name = 'General'
          AND tr.created_at >= now() - interval '1 minute'
        """
    )

    # ---- tasks -> actions -----------------------------------------------------
    remaining_types = bind.execute(sa.text("SELECT count(*) FROM task_types")).scalar()
    if remaining_types:
        raise RuntimeError("task_types has rows; refusing to drop it. Migrate them first.")
    op.drop_constraint("tasks_task_type_id_fkey", "tasks", type_="foreignkey")
    op.drop_column("tasks", "task_type_id")
    op.drop_table("task_types")

    op.rename_table("tasks", "actions")
    op.execute("ALTER TABLE actions RENAME CONSTRAINT tasks_pkey TO actions_pkey")
    op.execute("ALTER TABLE actions RENAME CONSTRAINT tasks_user_id_fkey TO actions_user_id_fkey")
    op.execute("ALTER INDEX ix_tasks_user_id RENAME TO ix_actions_user_id")
    op.alter_column("actions", "category_id", new_column_name="track_id")
    op.execute("ALTER INDEX ix_tasks_category_id RENAME TO ix_actions_track_id")
    op.drop_constraint("tasks_category_id_fkey", "actions", type_="foreignkey")
    op.create_foreign_key("actions_track_id_fkey", "actions", "tracks", ["track_id"], ["id"], ondelete="CASCADE")
    op.execute("ALTER TYPE task_priority RENAME TO action_priority")

    op.add_column("actions", sa.Column("time_of_day", sa.Time(), nullable=True))
    op.add_column("actions", sa.Column("start_date", sa.Date(), nullable=True))
    op.add_column("actions", sa.Column("end_date", sa.Date(), nullable=True))
    op.add_column("actions", sa.Column("repeat_type", sa.String(length=12), server_default="ONCE", nullable=False))
    op.add_column("actions", sa.Column("repeat_weekdays", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("actions", sa.Column("repeat_interval_days", sa.Integer(), nullable=True))
    op.add_column("actions", sa.Column("is_required", sa.Boolean(), server_default="true", nullable=False))
    op.add_column("actions", sa.Column("reminder_enabled", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("actions", sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False))
    op.add_column("actions", sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False))
    op.add_column("actions", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    op.execute(
        """
        UPDATE actions a SET
            start_date = (coalesce(a.scheduled_at, a.created_at) AT TIME ZONE u.timezone)::date,
            time_of_day = CASE WHEN a.scheduled_at IS NULL THEN NULL
                               ELSE date_trunc('minute', a.scheduled_at AT TIME ZONE u.timezone)::time END
        FROM users u WHERE u.id = a.user_id
        """
    )
    # Carry over any structured recurrence the old model stored.
    op.execute(
        """
        UPDATE actions SET repeat_type = 'DAILY'
        WHERE repeat_rule IS NOT NULL AND repeat_rule ->> 'frequency' = 'DAILY'
        """
    )
    op.execute(
        """
        UPDATE actions SET repeat_type = 'WEEKLY', repeat_weekdays = repeat_rule -> 'weekdays'
        WHERE repeat_rule IS NOT NULL AND repeat_rule ->> 'frequency' = 'WEEKLY'
        """
    )
    op.alter_column("actions", "start_date", nullable=False)
    op.alter_column("actions", "track_id", nullable=False)
    op.create_check_constraint("ck_actions_date_range", "actions", "end_date IS NULL OR end_date >= start_date")
    op.create_check_constraint(
        "ck_actions_repeat_type", "actions", "repeat_type IN ('ONCE', 'DAILY', 'WEEKLY', 'CUSTOM')"
    )

    # ---- per-date completions ---------------------------------------------
    op.create_table(
        "action_completions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("action_id", sa.UUID(), nullable=False),
        sa.Column("track_id", sa.UUID(), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmation_method", sa.String(length=16), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["action_id"], ["actions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_action_completions_action_id", "action_completions", ["action_id"])
    op.create_index("ix_action_completions_track_id", "action_completions", ["track_id"])
    op.create_index("ix_action_completions_user_date", "action_completions", ["user_id", "scheduled_date"])
    op.create_index(
        "uq_action_completions_live",
        "action_completions",
        ["action_id", "scheduled_date"],
        unique=True,
        postgresql_where=sa.text("revoked_at IS NULL"),
    )
    op.execute(
        """
        INSERT INTO action_completions
            (id, user_id, action_id, track_id, scheduled_date, completed_at, confirmation_method, created_at)
        SELECT gen_random_uuid(), a.user_id, a.id, a.track_id, a.start_date,
               coalesce(a.completed_at, a.updated_at), 'MIGRATED', now()
        FROM actions a WHERE a.status = 'COMPLETED'
        """
    )
    op.drop_column("actions", "status")
    op.drop_column("actions", "completed_at")
    op.drop_column("actions", "scheduled_at")
    op.drop_column("actions", "repeat_rule")
    op.execute("DROP TYPE task_status")

    # ---- task checklist items -> action steps -------------------------------
    op.rename_table("task_checklist_items", "action_steps")
    op.execute("ALTER TABLE action_steps RENAME CONSTRAINT task_checklist_items_pkey TO action_steps_pkey")
    op.alter_column("action_steps", "task_id", new_column_name="action_id")
    op.execute(
        "ALTER TABLE action_steps RENAME CONSTRAINT task_checklist_items_task_id_fkey TO action_steps_action_id_fkey"
    )
    op.execute("ALTER INDEX ix_task_checklist_items_task_id RENAME TO ix_action_steps_action_id")
    op.drop_column("action_steps", "is_completed")

    # ---- notes -> encrypted vault -------------------------------------------
    op.rename_table("notes", "vault_entries")
    op.execute("ALTER TABLE vault_entries RENAME CONSTRAINT notes_pkey TO vault_entries_pkey")
    op.execute("ALTER TABLE vault_entries RENAME CONSTRAINT notes_user_id_fkey TO vault_entries_user_id_fkey")
    op.execute("ALTER INDEX ix_notes_user_id RENAME TO ix_vault_entries_user_id")
    op.add_column("vault_entries", sa.Column("ciphertext", sa.Text(), nullable=True))
    op.add_column("vault_entries", sa.Column("is_favorite", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("vault_entries", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    rows = bind.execute(sa.text("SELECT id, title, content FROM vault_entries")).fetchall()
    if rows:
        cipher = _vault_cipher()
        for entry_id, title, content in rows:
            payload = json.dumps({"title": title, "content": content, "folder": None, "tags": []})
            bind.execute(
                sa.text("UPDATE vault_entries SET ciphertext = :c WHERE id = :id"),
                {"c": cipher.encrypt(payload.encode()).decode(), "id": entry_id},
            )
    op.alter_column("vault_entries", "ciphertext", nullable=False)
    # Plaintext columns are dropped only after every row is safely encrypted.
    op.drop_column("vault_entries", "title")
    op.drop_column("vault_entries", "content")
    op.drop_column("vault_entries", "note_type")
    op.drop_column("vault_entries", "category_id")
    op.drop_column("vault_entries", "task_id")
    op.execute("DROP TYPE note_type")

    op.create_table(
        "vault_credentials",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("pin_hash", sa.String(length=255), nullable=False),
        sa.Column("failed_attempts", sa.Integer(), nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    # ---- reminders ----------------------------------------------------------
    op.add_column("reminders", sa.Column("priority", sa.String(length=8), server_default="NORMAL", nullable=False))
    op.add_column("reminders", sa.Column("track_id", sa.UUID(), nullable=True))
    op.add_column("reminders", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "reminders_track_id_fkey", "reminders", "tracks", ["track_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_reminders_track_id", "reminders", ["track_id"])

    # ---- streaks, track completions, achievements ---------------------------
    op.create_table(
        "daily_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("required_count", sa.Integer(), nullable=False),
        sa.Column("completed_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("streak_after", sa.Integer(), nullable=False),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "record_date", name="uq_daily_records_user_date"),
    )
    op.create_index("ix_daily_records_user_id", "daily_records", ["user_id"])

    op.create_table(
        "streak_states",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("current_streak", sa.Integer(), nullable=False),
        sa.Column("best_streak", sa.Integer(), nullable=False),
        sa.Column("tracking_started_on", sa.Date(), nullable=False),
        sa.Column("last_success_date", sa.Date(), nullable=True),
        sa.Column("last_finalized_date", sa.Date(), nullable=False),
        sa.Column("total_success_days", sa.Integer(), nullable=False),
        sa.Column("total_failed_days", sa.Integer(), nullable=False),
        sa.Column("bonus_points", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "track_completions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("track_id", sa.UUID(), nullable=True),
        sa.Column("track_name", sa.String(length=80), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("required_total", sa.Integer(), nullable=False),
        sa.Column("completed_total", sa.Integer(), nullable=False),
        sa.Column("is_perfect", sa.Boolean(), nullable=False),
        sa.Column("bonus_points", sa.Integer(), nullable=False),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("track_id", name="uq_track_completions_track"),
    )
    op.create_index("ix_track_completions_user_id", "track_completions", ["user_id"])

    op.create_table(
        "user_achievements",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("earned_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "code", name="uq_user_achievements_user_code"),
    )
    op.create_index("ix_user_achievements_user_id", "user_achievements", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_table("user_achievements")
    op.drop_table("track_completions")
    op.drop_table("streak_states")
    op.drop_table("daily_records")

    op.drop_index("ix_reminders_track_id", table_name="reminders")
    op.drop_constraint("reminders_track_id_fkey", "reminders", type_="foreignkey")
    op.drop_column("reminders", "completed_at")
    op.drop_column("reminders", "track_id")
    op.drop_column("reminders", "priority")

    op.drop_table("vault_credentials")

    # ---- vault -> notes (decrypt back to plaintext) -------------------------
    note_type = postgresql.ENUM(
        "QUICK", "CONTEXT", "DECISION", "REFERENCE", "LESSON", "CHECKLIST", name="note_type"
    )
    note_type.create(bind)
    op.add_column("vault_entries", sa.Column("title", sa.String(length=160), nullable=True))
    op.add_column("vault_entries", sa.Column("content", sa.Text(), nullable=True))
    op.add_column(
        "vault_entries",
        sa.Column("note_type", postgresql.ENUM(name="note_type", create_type=False), server_default="QUICK", nullable=False),
    )
    op.add_column("vault_entries", sa.Column("category_id", sa.UUID(), nullable=True))
    op.add_column("vault_entries", sa.Column("task_id", sa.UUID(), nullable=True))
    rows = bind.execute(sa.text("SELECT id, ciphertext FROM vault_entries")).fetchall()
    if rows:
        cipher = _vault_cipher()
        for entry_id, ciphertext in rows:
            data = json.loads(cipher.decrypt(ciphertext.encode()))
            bind.execute(
                sa.text("UPDATE vault_entries SET title = :t, content = :c WHERE id = :id"),
                {"t": data.get("title"), "c": data.get("content") or "", "id": entry_id},
            )
    op.alter_column("vault_entries", "content", nullable=False)
    op.alter_column("vault_entries", "note_type", server_default=None)
    op.drop_column("vault_entries", "deleted_at")
    op.drop_column("vault_entries", "is_favorite")
    op.drop_column("vault_entries", "ciphertext")
    op.execute("ALTER INDEX ix_vault_entries_user_id RENAME TO ix_notes_user_id")
    op.execute("ALTER TABLE vault_entries RENAME CONSTRAINT vault_entries_user_id_fkey TO notes_user_id_fkey")
    op.execute("ALTER TABLE vault_entries RENAME CONSTRAINT vault_entries_pkey TO notes_pkey")
    op.rename_table("vault_entries", "notes")
    op.create_index("ix_notes_category_id", "notes", ["category_id"])
    op.create_index("ix_notes_task_id", "notes", ["task_id"])

    # ---- action steps -> task checklist items -------------------------------
    op.add_column("action_steps", sa.Column("is_completed", sa.Boolean(), server_default="false", nullable=False))
    op.alter_column("action_steps", "is_completed", server_default=None)
    op.execute("ALTER INDEX ix_action_steps_action_id RENAME TO ix_task_checklist_items_task_id")
    op.execute(
        "ALTER TABLE action_steps RENAME CONSTRAINT action_steps_action_id_fkey TO task_checklist_items_task_id_fkey"
    )
    op.alter_column("action_steps", "action_id", new_column_name="task_id")
    op.execute("ALTER TABLE action_steps RENAME CONSTRAINT action_steps_pkey TO task_checklist_items_pkey")
    op.rename_table("action_steps", "task_checklist_items")

    # ---- actions -> tasks (latest live completion becomes COMPLETED) --------
    task_status = postgresql.ENUM("PENDING", "COMPLETED", name="task_status")
    task_status.create(bind)
    op.add_column(
        "actions",
        sa.Column("status", postgresql.ENUM(name="task_status", create_type=False), server_default="PENDING", nullable=False),
    )
    op.add_column("actions", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("actions", sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("actions", sa.Column("repeat_rule", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.execute(
        """
        UPDATE actions a SET status = 'COMPLETED', completed_at = c.completed_at
        FROM (
            SELECT DISTINCT ON (action_id) action_id, completed_at FROM action_completions
            WHERE revoked_at IS NULL ORDER BY action_id, completed_at DESC
        ) c WHERE c.action_id = a.id
        """
    )
    op.execute(
        """
        UPDATE actions a SET scheduled_at = ((a.start_date + a.time_of_day) AT TIME ZONE u.timezone)
        FROM users u WHERE u.id = a.user_id AND a.time_of_day IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE actions SET repeat_rule = CASE
            WHEN repeat_type = 'DAILY' THEN '{"frequency": "DAILY", "interval": 1}'::jsonb
            WHEN repeat_type = 'WEEKLY' THEN jsonb_build_object('frequency', 'WEEKLY', 'interval', 1, 'weekdays', repeat_weekdays)
            ELSE NULL END
        """
    )
    op.alter_column("actions", "status", server_default=None)
    op.drop_table("action_completions")

    op.drop_constraint("ck_actions_repeat_type", "actions", type_="check")
    op.drop_constraint("ck_actions_date_range", "actions", type_="check")
    for column in (
        "deleted_at",
        "sort_order",
        "is_active",
        "reminder_enabled",
        "is_required",
        "repeat_interval_days",
        "repeat_weekdays",
        "repeat_type",
        "end_date",
        "start_date",
        "time_of_day",
    ):
        op.drop_column("actions", column)

    op.execute("ALTER TYPE action_priority RENAME TO task_priority")
    op.drop_constraint("actions_track_id_fkey", "actions", type_="foreignkey")
    op.alter_column("actions", "track_id", new_column_name="category_id", nullable=True)
    op.create_foreign_key(
        "tasks_category_id_fkey", "actions", "tracks", ["category_id"], ["id"], ondelete="SET NULL"
    )
    op.execute("ALTER INDEX ix_actions_track_id RENAME TO ix_tasks_category_id")
    op.execute("ALTER INDEX ix_actions_user_id RENAME TO ix_tasks_user_id")
    op.execute("ALTER TABLE actions RENAME CONSTRAINT actions_user_id_fkey TO tasks_user_id_fkey")
    op.execute("ALTER TABLE actions RENAME CONSTRAINT actions_pkey TO tasks_pkey")
    op.rename_table("actions", "tasks")

    op.create_table(
        "task_types",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("icon", sa.String(length=40), nullable=True),
        sa.Column("color", sa.String(length=20), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_types_user_id", "task_types", ["user_id"])
    op.add_column("tasks", sa.Column("task_type_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "tasks_task_type_id_fkey", "tasks", "task_types", ["task_type_id"], ["id"], ondelete="SET NULL"
    )

    # The auto-created "General" tracks stay as categories (their tasks still point at them).
    op.rename_table("legacy_category_checklist_items", "category_checklist_items")

    op.drop_constraint("ck_tracks_date_range", "tracks", type_="check")
    op.drop_column("tracks", "deleted_at")
    op.drop_column("tracks", "end_date")
    op.drop_column("tracks", "start_date")
    op.drop_column("tracks", "description")
    op.execute("ALTER INDEX ix_tracks_user_id RENAME TO ix_categories_user_id")
    op.execute("ALTER TABLE tracks RENAME CONSTRAINT tracks_user_id_fkey TO categories_user_id_fkey")
    op.execute("ALTER TABLE tracks RENAME CONSTRAINT tracks_pkey TO categories_pkey")
    op.rename_table("tracks", "categories")

    op.drop_table("user_settings")
    op.drop_index("ix_password_reset_codes_user_id", table_name="password_reset_codes")
    op.drop_table("password_reset_codes")

    op.drop_index("ix_users_public_id", table_name="users")
    op.drop_column("users", "onboarding_version")
    op.drop_column("users", "onboarding_completed_at")
    op.drop_column("users", "avatar")
    op.drop_column("users", "timezone")
    op.drop_column("users", "public_id")
