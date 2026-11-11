"""Aggregates every v1 router; mounted under /api/v1 by the app factory."""

from fastapi import APIRouter

from app.api.v1 import health

api_router = APIRouter()
api_router.include_router(health.router)
