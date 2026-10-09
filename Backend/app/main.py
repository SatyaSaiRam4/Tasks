import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import FRONTEND_ORIGIN
from app.db.session import SessionLocal, test_connection
from app.modules.auth.service import seed_admin
from app.workers.reminder_worker import start_reminder_worker, stop_reminder_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed by Alembic (`alembic upgrade head`), not created here.
    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()
    start_reminder_worker()
    yield
    stop_reminder_worker()


app = FastAPI(title="Memo API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.__class__.__name__.upper(),
                "message": exc.detail,
                "request_id": getattr(request.state, "request_id", None),
            }
        },
        headers=exc.headers,
    )


# HEAD too: uptime monitors (e.g. UptimeRobot) send HEAD requests by default.
@app.api_route("/health", methods=["GET", "HEAD"])
@app.api_route("/health/live", methods=["GET", "HEAD"])
def health_live():
    """Liveness for uptime monitors: the process is up. No auth, no database."""
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready():
    db_ok = test_connection()
    return {"status": "ok" if db_ok else "degraded", "database": db_ok}


app.include_router(api_router)
