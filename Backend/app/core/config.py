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
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DATABASE")


def validate_env_vars() -> None:
    missing = []
    for var in ["USER", "PASSWORD", "HOST", "DB_PORT", "DATABASE"]:
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
# SMTP / email settings (password-reset codes)
# ---------------------------------------------------------------------------
# SMTP_SERVER / SMTP_EMAIL are accepted as aliases of SMTP_HOST / SMTP_USER.
SMTP_HOST = (os.getenv("SMTP_HOST") or os.getenv("SMTP_SERVER") or "smtp.gmail.com").strip()
SMTP_PORT = int((os.getenv("SMTP_PORT") or "587").strip())
SMTP_USER = (os.getenv("SMTP_USER") or os.getenv("SMTP_EMAIL") or "").strip()
# Gmail App Passwords are displayed in 4-char groups for readability but must
# be used without spaces. Strip all whitespace to be safe.
SMTP_PASSWORD = "".join(os.getenv("SMTP_PASSWORD", "").split())
SMTP_FROM = (os.getenv("SMTP_FROM") or SMTP_USER or "no-reply@rememberly.app").strip()
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Memo")

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM = (os.getenv("RESEND_FROM") or "Memo <onboarding@resend.dev>").strip()

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
# Which approved template the reminder uses (see PROJECT.md, "Messages"):
#   "single"   one variable {{1}}: the whole reminder in one line (the
#              original template).
#   "detailed" four variables: {{1}} first name, {{2}} reminder, {{3}} date
#              and time, {{4}} note.
MSG91_WHATSAPP_TEMPLATE_STYLE = os.getenv("MSG91_WHATSAPP_TEMPLATE_STYLE", "single").strip().lower()

# How often the reminder worker polls for due WhatsApp sends.
REMINDER_POLL_SECONDS = int(os.getenv("REMINDER_POLL_SECONDS", "20"))


# ---------------------------------------------------------------------------
# Vault encryption. Comma-separated Fernet keys: the first encrypts, all of
# them can decrypt (so keys can be rotated without re-encrypting at once).
# Generate one with:
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Losing every key means losing every Vault entry — back it up somewhere other
# than the database.
# ---------------------------------------------------------------------------
VAULT_ENCRYPTION_KEYS = [k.strip() for k in os.getenv("VAULT_ENCRYPTION_KEYS", "").split(",") if k.strip()]
# Upper bound on an unlocked Vault session, even with auto-lock set to "Never".
VAULT_SESSION_MAX_MINUTES = int(os.getenv("VAULT_SESSION_MAX_MINUTES", "720"))
VAULT_MAX_FAILED_ATTEMPTS = int(os.getenv("VAULT_MAX_FAILED_ATTEMPTS", "5"))
VAULT_LOCKOUT_MINUTES = int(os.getenv("VAULT_LOCKOUT_MINUTES", "5"))


# ---------------------------------------------------------------------------
# Streaks & Track completion bonus. The bonus is normalized by duration so a
# long perfect Track is worth more than a short one, and very short Tracks earn
# nothing (so the bonus can't be farmed with 1-day Tracks).
#   bonus = floor(duration_days * TRACK_BONUS_PER_DAY * difficulty)
#   difficulty = 1 + min(avg required actions per day - 1, TRACK_BONUS_DIFFICULTY_CAP) * TRACK_BONUS_DIFFICULTY_STEP
# ---------------------------------------------------------------------------
TRACK_BONUS_MIN_DAYS = int(os.getenv("TRACK_BONUS_MIN_DAYS", "7"))
TRACK_BONUS_PER_DAY = float(os.getenv("TRACK_BONUS_PER_DAY", "1.0"))
TRACK_BONUS_DIFFICULTY_STEP = float(os.getenv("TRACK_BONUS_DIFFICULTY_STEP", "0.1"))
TRACK_BONUS_DIFFICULTY_CAP = int(os.getenv("TRACK_BONUS_DIFFICULTY_CAP", "4"))
# Only perfect Tracks earn a bonus unless this is turned off, in which case a
# Track at or above TRACK_BONUS_MIN_COMPLETION earns a proportionally smaller one.
TRACK_BONUS_REQUIRE_PERFECT = os.getenv("TRACK_BONUS_REQUIRE_PERFECT", "true").lower() in ("1", "true", "yes")
TRACK_BONUS_MIN_COMPLETION = float(os.getenv("TRACK_BONUS_MIN_COMPLETION", "0.9"))

# How often the background job finalizes ended days for all users.
STREAK_FINALIZE_MINUTES = int(os.getenv("STREAK_FINALIZE_MINUTES", "15"))


# ---------------------------------------------------------------------------
# Daily cleanup (POST /api/v1/maintenance/cleanup), called by the GitHub
# Actions workflow in .github/workflows/daily-cleanup.yml. The caller must send
# this secret in the X-Cron-Secret header; with it unset the endpoint is off.
# Plans and tasks are deleted this many days after their end date, completed
# reminders this many days after they were marked done. Of the Vault, only
# notes in the bin are removed (after VAULT_BIN_DAYS).
# ---------------------------------------------------------------------------
CRON_SECRET = os.getenv("CRON_SECRET", "").strip()
CLEANUP_AFTER_DAYS = int(os.getenv("CLEANUP_AFTER_DAYS", "7"))
# Vault notes in the bin are deleted for good this many days after deletion.
VAULT_BIN_DAYS = int(os.getenv("VAULT_BIN_DAYS", "30"))

# Limits on what one account can create.
MAX_ACTIVE_PLANS = 10
MAX_TASKS_PER_PLAN = 15
