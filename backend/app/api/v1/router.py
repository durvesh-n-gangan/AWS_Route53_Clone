"""Aggregates every v1 router; mounted under /api/v1 by the app factory.

Only /health and the auth endpoints are public. Resource routers are added to
`protected_router`, which requires a valid session for every route it holds.
"""

from fastapi import APIRouter, Depends

from app.api.v1 import auth, health, hosted_zones, records, zone_files
from app.core.deps import get_current_user

protected_router = APIRouter(dependencies=[Depends(get_current_user)])
protected_router.include_router(hosted_zones.router)
protected_router.include_router(records.router)
protected_router.include_router(zone_files.router)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(protected_router)
