"""Small CLI helper: create tables and seed the admin account.

Usage:
    python3 manage.py
"""

from app.db.session import SessionLocal, create_tables, test_connection
from app.modules.auth.service import seed_admin


def main() -> None:
    if not test_connection():
        raise SystemExit(1)
    print("Database connection successful.")

    create_tables()
    print("Tables created.")

    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()
    print("Admin account ready.")


if __name__ == "__main__":
    main()
