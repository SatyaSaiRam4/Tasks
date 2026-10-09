import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core import config
from app.db.session import get_db

from . import service

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.post("/cleanup")
def cleanup(x_cron_secret: str = Header(default=""), db: Session = Depends(get_db)):
    """Daily cleanup, called by the scheduled GitHub Actions workflow."""
    if not config.CRON_SECRET:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
    if not hmac.compare_digest(x_cron_secret, config.CRON_SECRET):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden.")
    return service.run_cleanup(db)
