from fastapi import APIRouter

from app.modules.access.router import router as access_router
from app.modules.auth.router import router as auth_router
from app.modules.clients.router import router as clients_router
from app.modules.employees.router import router as employees_router
from app.modules.projects.router import router as projects_router
from app.modules.users.router import router as users_router

api_router = APIRouter()
for r in (auth_router, access_router, users_router, employees_router, clients_router, projects_router):
    api_router.include_router(r)
