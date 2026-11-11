"""Mock authentication: login, logout, sessions and route protection."""

import re
from datetime import timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_session_token
from app.db.base import utcnow
from app.models import User, UserSession
from tests.conftest import DEMO_PASSWORD, DEMO_USERNAME

COOKIE = "r53_session"
LOGIN = "/api/v1/auth/login"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/auth/me"
PUBLIC_PATHS = {LOGIN, LOGOUT, "/api/v1/health"}


def _login(client: TestClient, username: str = DEMO_USERNAME, password: str = DEMO_PASSWORD):
    return client.post(LOGIN, json={"username": username, "password": password})


def _session_count(db: Session) -> int:
    db.expire_all()
    return db.scalar(select(func.count()).select_from(UserSession)) or 0


def test_login_sets_a_secure_session_cookie_and_returns_the_user(
    client: TestClient, user: User, db: Session
) -> None:
    response = _login(client)

    assert response.status_code == 200
    assert response.json() == {"username": "admin", "account_id": "123456789012"}
    set_cookie = response.headers["set-cookie"]
    assert set_cookie.startswith(f"{COOKIE}=")
    assert "HttpOnly" in set_cookie
    assert re.search(r"SameSite=lax", set_cookie, re.IGNORECASE)
    assert "Max-Age=43200" in set_cookie
    assert "Path=/" in set_cookie


def test_only_the_token_digest_is_stored(client: TestClient, user: User, db: Session) -> None:
    _login(client)
    token = client.cookies[COOKIE]

    stored = db.scalars(select(UserSession)).one()
    assert stored.id != token
    assert stored.id == hash_session_token(token)
    assert stored.expires_at - stored.created_at == timedelta(hours=12)


@pytest.mark.parametrize(
    ("username", "password"),
    [(DEMO_USERNAME, "wrong-password"), ("nobody", DEMO_PASSWORD), ("nobody", "x")],
)
def test_bad_credentials_get_the_same_generic_401(
    client: TestClient, user: User, db: Session, username: str, password: str
) -> None:
    response = _login(client, username, password)

    assert response.status_code == 401
    assert response.json()["error"] == {
        "code": "Unauthenticated",
        "message": "Your authentication information is incorrect. Please try again.",
        "details": {},
    }
    assert "set-cookie" not in response.headers
    assert _session_count(db) == 0


def test_login_rejects_empty_fields(client: TestClient, user: User) -> None:
    response = client.post(LOGIN, json={"username": "", "password": ""})

    assert response.status_code == 422
    fields = {item["field"] for item in response.json()["error"]["details"]["fields"]}
    assert fields == {"username", "password"}


def test_me_returns_the_signed_in_user(auth_client: TestClient) -> None:
    response = auth_client.get(ME)

    assert response.status_code == 200
    assert response.json() == {"username": "admin", "account_id": "123456789012"}


def test_me_without_a_cookie_is_401(client: TestClient) -> None:
    response = client.get(ME)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "Unauthenticated"


def test_me_with_an_unknown_token_is_401(client: TestClient, user: User) -> None:
    client.cookies.set(COOKIE, "forged-token")
    assert client.get(ME).status_code == 401


def test_expired_session_is_rejected_and_deleted(auth_client: TestClient, db: Session) -> None:
    stored = db.scalars(select(UserSession)).one()
    stored.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()

    assert auth_client.get(ME).status_code == 401
    assert _session_count(db) == 0


def test_logout_ends_the_session_and_clears_the_cookie(
    auth_client: TestClient, db: Session
) -> None:
    old_token = auth_client.cookies[COOKIE]

    response = auth_client.post(LOGOUT)

    assert response.status_code == 204
    assert f'{COOKIE}=""' in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]
    assert _session_count(db) == 0
    auth_client.cookies.set(COOKIE, old_token)
    assert auth_client.get(ME).status_code == 401


def test_logout_without_a_session_is_harmless(client: TestClient) -> None:
    assert client.post(LOGOUT).status_code == 204


def test_session_survives_across_requests_like_a_page_reload(auth_client: TestClient) -> None:
    for _ in range(3):
        assert auth_client.get(ME).status_code == 200


def test_new_login_removes_this_users_expired_sessions(
    client: TestClient, user: User, db: Session
) -> None:
    db.add(UserSession(id="e" * 64, user_id=user.id, expires_at=utcnow() - timedelta(hours=1)))
    db.commit()

    _login(client)

    db.expire_all()
    assert db.get(UserSession, "e" * 64) is None
    assert _session_count(db) == 1


def test_cookie_ttl_and_secure_flag_follow_settings(app: FastAPI, client: TestClient, user: User):
    app.state.settings = app.state.settings.model_copy(
        update={"session_ttl_hours": 1, "cookie_secure": True}
    )

    set_cookie = _login(client).headers["set-cookie"]

    assert "Max-Age=3600" in set_cookie
    assert "Secure" in set_cookie


def _protected_routes(app: FastAPI) -> list[tuple[str, str]]:
    """Every documented API operation except the public ones, with path params filled in."""
    routes = []
    for path, operations in app.openapi()["paths"].items():
        if not path.startswith("/api/v1") or path in PUBLIC_PATHS:
            continue
        concrete = re.sub(r"\{[^}]+\}", "ZPLACEHOLDER", path)
        routes.extend((method.upper(), concrete) for method in operations)
    return routes


def test_every_non_public_api_route_requires_a_session(app: FastAPI, client: TestClient) -> None:
    routes = _protected_routes(app)
    assert (("GET", ME)) in routes  # sanity: the list is not empty

    for method, path in routes:
        response = client.request(method, path)
        assert response.status_code == 401, f"{method} {path} returned {response.status_code}"
        assert response.json()["error"]["code"] == "Unauthenticated"


# --- sign-in throttling ------------------------------------------------------------------


def test_repeated_failed_logins_are_throttled(client: TestClient, user: User) -> None:
    for _ in range(5):
        assert _login(client, password="wrong").status_code == 401

    blocked = _login(client)  # even the right password is refused while blocked

    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "Throttling"


def test_throttle_is_per_username(client: TestClient, user: User) -> None:
    for _ in range(5):
        _login(client, username="someone-else", password="wrong")

    assert _login(client).status_code == 200


def test_successful_login_resets_the_failure_count(client: TestClient, user: User) -> None:
    for _ in range(4):
        _login(client, password="wrong")
    assert _login(client).status_code == 200

    for _ in range(4):
        assert _login(client, password="wrong").status_code == 401
    assert _login(client).status_code == 200


def test_throttle_window_expires() -> None:
    from app.core.rate_limit import LoginThrottle

    now = [1000.0]
    throttle = LoginThrottle(max_failures=2, window_seconds=60, clock=lambda: now[0])
    throttle.record_failure("1.2.3.4", "Admin")
    throttle.record_failure("1.2.3.4", "admin")
    assert throttle.is_blocked("1.2.3.4", "ADMIN")
    assert not throttle.is_blocked("5.6.7.8", "admin")

    now[0] += 61

    assert not throttle.is_blocked("1.2.3.4", "admin")
