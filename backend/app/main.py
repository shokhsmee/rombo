from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import app.models  # noqa: F401  (register all tables)
from app.api import api_router
from app.core.config import settings
from app.core.exceptions import DomainError


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0",
                  docs_url=f"{settings.api_prefix}/docs", openapi_url=f"{settings.api_prefix}/openapi.json")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(DomainError)
    def _domain_error(_: Request, exc: DomainError):
        # One error shape for the whole API: {"error": {"code", "message", "field"}}
        return JSONResponse(status_code=exc.status_code,
                            content={"error": {"code": exc.code, "message": exc.message, "field": exc.field}})

    @app.get("/health", include_in_schema=False)
    def health():
        return {"status": "ok"}

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
