from fastapi import APIRouter

from app.modules.achievements.router import router as achievements_router
from app.modules.actions.router import router as actions_router
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.reminders.router import router as reminders_router
from app.modules.streaks.router import router as streaks_router
from app.modules.tracks.router import router as tracks_router
from app.modules.users.router import router as users_router
from app.modules.vault.router import router as vault_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(dashboard_router)
api_router.include_router(tracks_router)
api_router.include_router(actions_router)
api_router.include_router(streaks_router)
api_router.include_router(achievements_router)
api_router.include_router(reminders_router)
api_router.include_router(vault_router)
api_router.include_router(admin_router)
