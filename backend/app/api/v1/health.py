from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    """Liveness plus a trivial database round trip. Needs no session cookie."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # any driver error means the DB is unusable
        raise AppError("ServiceUnavailable", "Database is not reachable.", 503) from exc
    return {"status": "ok", "database": "ok"}
