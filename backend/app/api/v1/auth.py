"""Mock sign-in. A session row is stored server-side and referenced by an httpOnly cookie."""

from fastapi import APIRouter, Request, Response, status

from app.core.config import Settings
from app.core.deps import AppSettings, CurrentUser, DbSession
from app.core.errors import AppError
from app.schemas.auth import LoginRequest, MeResponse
from app.services.auth import authenticate, create_session, end_session

router = APIRouter(prefix="/auth", tags=["auth"])

# Same wording for an unknown user and a wrong password, so accounts can't be probed.
INVALID_CREDENTIALS = "Your authentication information is incorrect. Please try again."


def _set_session_cookie(response: Response, settings: Settings, token: str) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/login", response_model=MeResponse)
def login(body: LoginRequest, response: Response, db: DbSession, settings: AppSettings):
    user = authenticate(db, body.username, body.password)
    if user is None:
        raise AppError("Unauthenticated", INVALID_CREDENTIALS, status.HTTP_401_UNAUTHORIZED)
    token = create_session(db, user, settings.session_ttl_hours)
    db.commit()
    _set_session_cookie(response, settings, token)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, db: DbSession, settings: AppSettings) -> Response:
    """Ends the session if there is one. Always clears the cookie, so it is safe to repeat."""
    token = request.cookies.get(settings.cookie_name)
    if token:
        end_session(db, token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        settings.cookie_name,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )
    return response


@router.get("/me", response_model=MeResponse)
def me(user: CurrentUser):
    return user
