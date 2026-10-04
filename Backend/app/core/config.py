# config.py: Load environment variables using dotenv
import os
from dotenv import load_dotenv

# Load environment variables from .env file
# override=True ensures .env values take precedence over existing system
# env vars (e.g. the system-defined USER variable on Linux)
load_dotenv(override=True)


# ---------------------------------------------------------------------------
# Database credentials
# ---------------------------------------------------------------------------
DB_USER = os.getenv("USER")
DB_PASSWORD = os.getenv("PASSWORD")
DB_HOST = os.getenv("HOST")
DB_PORT = os.getenv("PORT")
DB_NAME = os.getenv("DATABASE")


def validate_env_vars() -> None:
    missing = []
    for var in ["USER", "PASSWORD", "HOST", "PORT", "DATABASE"]:
        if not os.getenv(var):
            missing.append(var)
    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}"
        )


# Validate on import
validate_env_vars()

# Build the database URL from the individual credentials
DATABASE_URL = (
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?sslmode=require"
)


# ---------------------------------------------------------------------------
# JWT / auth settings
# ---------------------------------------------------------------------------
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-super-secret-key-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))


# ---------------------------------------------------------------------------
# SMTP / email settings (reserved for future OTP / password-reset emails)
# ---------------------------------------------------------------------------
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587").strip())
SMTP_USER = os.getenv("SMTP_USER", "").strip()
# Gmail App Passwords are displayed in 4-char groups for readability but must
# be used without spaces. Strip all whitespace to be safe.
SMTP_PASSWORD = "".join(os.getenv("SMTP_PASSWORD", "").split())
SMTP_FROM = (os.getenv("SMTP_FROM") or SMTP_USER or "no-reply@rememberly.app").strip()
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Rememberly")

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM = (os.getenv("RESEND_FROM") or "Rememberly <onboarding@resend.dev>").strip()

EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "auto").strip().lower()
# When true, OTP/reset codes are printed to the console instead of emailed.
SMTP_DEBUG = os.getenv("SMTP_DEBUG", "true").lower() in ("1", "true", "yes")


# ---------------------------------------------------------------------------
# Hardcoded admin bootstrap credentials (seeded into the DB with a hashed
# password on startup). Login still happens through the normal auth flow.
# ---------------------------------------------------------------------------
ADMIN_NAME = os.getenv("ADMIN_NAME", "Admin")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@rememberly.app")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@123")


# ---------------------------------------------------------------------------
# Supabase Storage (reserved for future attachments/avatars)
# ---------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "attachments").strip()


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

# ---------------------------------------------------------------------------
# Redis (reserved for future background job / cache use)
# ---------------------------------------------------------------------------
REDIS_URL = os.getenv("REDIS_URL", "")  # e.g. redis://default:password@host:port

# ---------------------------------------------------------------------------
# MSG91 WhatsApp (optional reminder side-channel). Leave MSG91_AUTH_KEY blank
# to disable — reminders still work as local push notifications either way.
# ---------------------------------------------------------------------------
MSG91_AUTH_KEY = os.getenv("MSG91_AUTH_KEY", "").strip()
MSG91_WHATSAPP_INTEGRATED_NUMBER = os.getenv("MSG91_WHATSAPP_INTEGRATED_NUMBER", "").strip()
MSG91_WHATSAPP_TEMPLATE_NAME = os.getenv("MSG91_WHATSAPP_TEMPLATE_NAME", "").strip()
MSG91_WHATSAPP_NAMESPACE = os.getenv("MSG91_WHATSAPP_NAMESPACE", "").strip()

# How often the reminder worker polls for due WhatsApp sends.
REMINDER_POLL_SECONDS = int(os.getenv("REMINDER_POLL_SECONDS", "20"))
