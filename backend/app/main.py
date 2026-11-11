"""FastAPI application factory. Run with `uvicorn app.main:app --reload` from backend/."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers

API_PREFIX = "/api/v1"

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if settings.seed_on_start:
            from app.db.seed import seed
            from app.db.session import SessionLocal

            with SessionLocal() as db:
                if seed(db):
                    logger.info("Seeded demo data on startup.")
        yield

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Mock Route 53 console API. No real DNS is served and no AWS calls are made.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )
    register_exception_handlers(app)
    app.include_router(api_router, prefix=API_PREFIX)
    return app


app = create_app()
