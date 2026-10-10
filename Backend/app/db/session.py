import time

from sqlalchemy import create_engine, event, exc, text
from sqlalchemy.orm import sessionmaker

from app.core.config import DATABASE_URL

# How long a pooled connection may sit unused before it is tested again.
IDLE_PING_SECONDS = 60

# Connection pooling: keep 5 connections warm, up to 10 more under load.
# The database is a network hop away, so a "SELECT 1" check before every
# request (pool_pre_ping) would add a full round trip to each one. Instead a
# connection is only tested when it has been idle for a while, which is when
# the server or pooler may have dropped it. TCP keepalives also stop idle
# connections from being cut silently.
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,  # recycle connections every 30min
    pool_use_lifo=True,  # reuse the warmest connection, let extras go idle
    connect_args={"keepalives": 1, "keepalives_idle": 30, "keepalives_interval": 10, "keepalives_count": 3},
)


@event.listens_for(engine, "checkin")
def _mark_idle_start(dbapi_connection, connection_record):
    connection_record.info["idle_since"] = time.monotonic()


@event.listens_for(engine, "checkout")
def _ping_if_idle(dbapi_connection, connection_record, connection_proxy):
    idle_since = connection_record.info.get("idle_since")
    if idle_since is None or time.monotonic() - idle_since < IDLE_PING_SECONDS:
        return
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("SELECT 1")
    except Exception as error:
        # Tells the pool to throw this connection away and open a fresh one.
        raise exc.DisconnectionError() from error
    finally:
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_connection() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        print("Database connection failed:", exc)
        return False
