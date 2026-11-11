"""Mock console authentication: credential checks and server-side sessions."""

import logging
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.security import hash_password, hash_session_token, new_session_token, verify_password
from app.db.base import utcnow
from app.models import User, UserSession

logger = logging.getLogger(__name__)

# Verified against when the username does not exist, so a wrong username takes as long
# as a wrong password and response timing does not reveal which accounts exist.
_DUMMY_HASH = hash_password("not-a-real-password")


def authenticate(db: Session, username: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.username == username.strip()))
    if user is None:
        verify_password(password, _DUMMY_HASH)
        return None
    return user if verify_password(password, user.password_hash) else None


def create_session(db: Session, user: User, ttl_hours: int) -> str:
    """Store a new session for `user` and return the raw token for the cookie."""
    now = utcnow()
    # Opportunistic cleanup so expired rows never pile up for this user.
    db.execute(
        delete(UserSession).where(UserSession.user_id == user.id, UserSession.expires_at <= now)
    )
    token = new_session_token()
    db.add(
        UserSession(
            id=hash_session_token(token),
            user_id=user.id,
            created_at=now,
            expires_at=now + timedelta(hours=ttl_hours),
        )
    )
    db.flush()
    logger.info("Session started for user id %s", user.id)
    return token


def resolve_session(db: Session, token: str) -> User | None:
    """Return the user behind a cookie token, deleting the session if it has expired."""
    session = db.get(UserSession, hash_session_token(token))
    if session is None:
        return None
    if session.expires_at <= utcnow():
        db.delete(session)
        db.commit()
        return None
    return session.user


def end_session(db: Session, token: str) -> None:
    db.execute(delete(UserSession).where(UserSession.id == hash_session_token(token)))
    db.commit()
