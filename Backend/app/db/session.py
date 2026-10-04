from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import DATABASE_URL

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


def test_connection() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        print("Database connection failed:", exc)
        return False
