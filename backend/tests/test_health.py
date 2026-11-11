from fastapi.testclient import TestClient


def test_health_returns_ok_without_a_session(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_reports_503_when_the_database_is_unreachable(app, client: TestClient) -> None:
    from app.db.session import get_db

    class _BrokenSession:
        def execute(self, *_args: object) -> None:
            raise RuntimeError("disk gone")

    app.dependency_overrides[get_db] = lambda: _BrokenSession()
    response = client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ServiceUnavailable"


def test_seed_on_start_populates_an_empty_database(monkeypatch, session_factory) -> None:
    from sqlalchemy import func, select

    from app.core.config import Settings
    from app.db import session as db_session
    from app.main import create_app
    from app.models import HostedZone

    monkeypatch.setattr(db_session, "SessionLocal", session_factory)
    application = create_app(Settings(database_url="sqlite://", seed_on_start=True))

    with TestClient(application):
        pass  # entering the client runs the lifespan startup hook

    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(HostedZone)) == 2


def test_openapi_docs_are_served(client: TestClient) -> None:
    assert client.get("/docs").status_code == 200
    assert "/api/v1/health" in client.get("/openapi.json").json()["paths"]


def test_cors_allows_the_configured_frontend_origin_with_credentials(client: TestClient) -> None:
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_cors_rejects_unknown_origins(client: TestClient) -> None:
    response = client.options(
        "/api/v1/health",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )

    assert "access-control-allow-origin" not in response.headers
