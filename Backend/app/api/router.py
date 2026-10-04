from fastapi import APIRouter

from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.categories.router import checklist_router as category_checklist_router
from app.modules.categories.router import router as categories_router
from app.modules.notes.router import router as notes_router
from app.modules.reminders.router import router as reminders_router
from app.modules.tasks.router import router as tasks_router
from app.modules.tasks.router import task_checklist_router, task_types_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(categories_router)
api_router.include_router(category_checklist_router)
api_router.include_router(tasks_router)
api_router.include_router(task_types_router)
api_router.include_router(task_checklist_router)
api_router.include_router(notes_router)
api_router.include_router(reminders_router)
api_router.include_router(admin_router)
