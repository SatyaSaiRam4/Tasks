def import_all_models() -> None:
    """Imports every model module so each registers itself on Base.metadata.

    Kept as the single list of model modules, shared by Alembic's env.py and
    anything else that needs the full metadata. Imports happen inside the
    function to avoid a cycle with app.db.base.
    """
    from app.modules.achievements import models as _achievements  # noqa: F401
    from app.modules.actions import models as _actions  # noqa: F401
    from app.modules.auth import models as _auth  # noqa: F401
    from app.modules.reminders import models as _reminders  # noqa: F401
    from app.modules.streaks import models as _streaks  # noqa: F401
    from app.modules.tracks import models as _tracks  # noqa: F401
    from app.modules.users import models as _users  # noqa: F401
    from app.modules.vault import models as _vault  # noqa: F401
    from app.modules.wallet import models as _wallet  # noqa: F401


# Tables kept in the database for data preservation but no longer mapped by
# any model. Alembic autogenerate must never propose dropping them.
UNMAPPED_LEGACY_TABLES = {"legacy_category_checklist_items"}
