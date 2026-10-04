from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import DATABASE_URL
from app.db.base import Base

# Create the SQLAlchemy engine with connection pooling
# pool_size: keep 5 connections warm, overflow up to 10 under load
# pool_pre_ping: test connections before use (avoids stale connection errors after sleep)
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,  # recycle connections every 30min
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    # Import models here (not at module load time) so every module registers
    # itself on Base.metadata before create_all runs, without creating an
    # import cycle with app.db.base.
    from app.modules.auth import models as _auth_models  # noqa: F401
    from app.modules.categories import models as _category_models  # noqa: F401
    from app.modules.notes import models as _note_models  # noqa: F401
    from app.modules.reminders import models as _reminder_models  # noqa: F401
    from app.modules.tasks import models as _task_models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def test_connection() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        print("Database connection failed:", exc)
        return False
