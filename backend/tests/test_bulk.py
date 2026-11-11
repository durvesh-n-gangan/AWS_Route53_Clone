"""Bulk delete endpoints (docs/PLAN.md §5.6)."""

from fastapi.testclient import TestClient

ZONES = "/api/v1/hostedzones"


def _zone(client: TestClient, name: str) -> dict:
    return client.post(ZONES, json={"name": name}).json()


def _add_record(client: TestClient, zone: dict, name: str = "www") -> dict:
    body = {"records": [{"name": name, "type": "A", "ttl": 300, "values": ["192.0.2.1"]}]}
    return client.post(f"{ZONES}/{zone['id']}/records", json=body).json()["items"][0]


def test_bulk_delete_zones_reports_partial_failures(auth_client: TestClient) -> None:
    empty_a = _zone(auth_client, "a.example.com")
    empty_b = _zone(auth_client, "b.example.com")
    busy = _zone(auth_client, "busy.example.com")
    _add_record(auth_client, busy)

    response = auth_client.post(
        f"{ZONES}/bulk-delete", json={"ids": [empty_a["id"], busy["id"], empty_b["id"], "ZNOPE"]}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["deleted"] == [empty_a["id"], empty_b["id"]]
    assert [(f["id"], f["code"]) for f in body["failed"]] == [
        (busy["id"], "HostedZoneNotEmpty"),
        ("ZNOPE", "NoSuchHostedZone"),
    ]
    remaining = [z["id"] for z in auth_client.get(ZONES).json()["items"]]
    assert remaining == [busy["id"]]


def test_bulk_delete_zones_ignores_duplicate_ids(auth_client: TestClient) -> None:
    zone = _zone(auth_client, "dup.example.com")

    body = auth_client.post(f"{ZONES}/bulk-delete", json={"ids": [zone["id"], zone["id"]]}).json()

    assert body == {"deleted": [zone["id"]], "failed": []}


def test_bulk_delete_needs_at_least_one_id(auth_client: TestClient) -> None:
    assert auth_client.post(f"{ZONES}/bulk-delete", json={"ids": []}).status_code == 422


def test_bulk_delete_zones_requires_a_session(client: TestClient) -> None:
    assert client.post(f"{ZONES}/bulk-delete", json={"ids": ["Z1"]}).status_code == 401


def test_bulk_delete_records_skips_default_records(auth_client: TestClient) -> None:
    zone = _zone(auth_client, "records.example.com")
    www = _add_record(auth_client, zone, "www")
    api = _add_record(auth_client, zone, "api")
    records = auth_client.get(f"{ZONES}/{zone['id']}/records").json()["items"]
    soa = next(r for r in records if r["type"] == "SOA")

    response = auth_client.post(
        f"{ZONES}/{zone['id']}/records/bulk-delete", json={"ids": [www["id"], soa["id"], api["id"]]}
    )

    body = response.json()
    assert body["deleted"] == [www["id"], api["id"]]
    assert body["failed"] == [
        {
            "id": soa["id"],
            "code": "InvalidChangeBatch",
            "message": "A HostedZone must contain exactly one SOA record.",
        }
    ]
    assert auth_client.get(f"{ZONES}/{zone['id']}").json()["record_count"] == 2


def test_bulk_delete_records_in_unknown_zone_is_404(auth_client: TestClient) -> None:
    response = auth_client.post(f"{ZONES}/ZNOPE/records/bulk-delete", json={"ids": ["R1"]})
    assert response.status_code == 404
