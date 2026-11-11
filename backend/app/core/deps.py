"""FastAPI dependencies shared by the routers."""

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.db.session import get_db
from app.models import User
from app.services.auth import resolve_session


def get_app_settings(request: Request) -> Settings:
    """The settings the running app was created with (tests inject their own)."""
    return request.app.state.settings


DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_app_settings)]


def get_current_user(request: Request, db: DbSession, settings: AppSettings) -> User:
    token = request.cookies.get(settings.cookie_name)
    user = resolve_session(db, token) if token else None
    if user is None:
        raise AppError("Unauthenticated", "Your session has expired. Sign in to continue.", 401)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
