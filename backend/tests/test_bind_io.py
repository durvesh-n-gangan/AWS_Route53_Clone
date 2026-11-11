"""BIND import/export (docs/PLAN.md §5.6)."""

import json

import pytest
from fastapi.testclient import TestClient

ZONES = "/api/v1/hostedzones"

ZONE_FILE = """\
$ORIGIN example.com.
$TTL 3600
; comment line
@       IN  SOA ns1.example.com. admin.example.com. ( 2024010101 ; serial
                7200 3600 1209600 300 )
@       IN  NS  ns1.example.com.
@           A   192.0.2.10
        300 IN  A   192.0.2.11          ; same owner, second value
www     IN  CNAME   example.com.
mail        A   192.0.2.25
@       IN  MX  10 mail.example.com.
@       IN  TXT "v=spf1 mx -all" "second; string"
_sip._tcp 600 IN SRV 10 5 5060 sip.example.com.
@       IN  CAA 0 issue "ca.example.net"
sub     IN  NS  ns1.other.example.
"""


@pytest.fixture
def zone(auth_client: TestClient) -> dict:
    return auth_client.post(ZONES, json={"name": "example.com"}).json()


def _import(client: TestClient, zone: dict, text: str, mode: str = "preview"):
    return client.post(f"{ZONES}/{zone['id']}/import", params={"mode": mode}, data={"text": text})


def test_preview_parses_a_realistic_zone_file(auth_client: TestClient, zone: dict) -> None:
    body = _import(auth_client, zone, ZONE_FILE).json()

    assert body["mode"] == "preview"
    assert body["created"] == 0
    assert (body["ready"], body["skipped"], body["errors"]) == (8, 2, 0)
    rows = {(r["name"], r["type"]): r for r in body["rows"]}
    assert rows[("example.com.", "SOA")]["status"] == "skipped"
    assert rows[("example.com.", "NS")]["status"] == "skipped"
    apex_a = rows[("example.com.", "A")]
    assert apex_a["values"] == ["192.0.2.10", "192.0.2.11"]
    assert apex_a["ttl"] == 3600  # the first line's TTL wins for the record set
    assert rows[("example.com.", "TXT")]["values"] == ['"v=spf1 mx -all" "second; string"']
    assert rows[("_sip._tcp.example.com.", "SRV")]["ttl"] == 600
    assert rows[("sub.example.com.", "NS")]["status"] == "ready"
    # Preview writes nothing.
    assert auth_client.get(f"{ZONES}/{zone['id']}").json()["record_count"] == 2


def test_commit_imports_ready_rows_only(auth_client: TestClient, zone: dict) -> None:
    text = ZONE_FILE + "broken  IN  A  999.1.1.1\nweird IN HINFO x y\n"

    body = _import(auth_client, zone, text, mode="commit").json()

    assert body["created"] == 8
    assert body["errors"] == 2
    messages = [r["message"] for r in body["rows"] if r["status"] == "error"]
    assert any("999.1.1.1" in m for m in messages)
    assert any("HINFO records are not supported" in m for m in messages)
    assert auth_client.get(f"{ZONES}/{zone['id']}").json()["record_count"] == 10


def test_preview_flags_records_that_already_exist(auth_client: TestClient, zone: dict) -> None:
    auth_client.post(
        f"{ZONES}/{zone['id']}/records",
        json={"records": [{"name": "mail", "type": "A", "ttl": 300, "values": ["192.0.2.99"]}]},
    )

    rows = _import(auth_client, zone, "mail 300 IN A 192.0.2.25\n").json()["rows"]

    assert rows[0]["status"] == "error"
    assert "already exists" in rows[0]["message"]


@pytest.mark.parametrize(
    ("text", "fragment"),
    [
        ("$INCLUDE other.zone\n", "not supported"),
        ("www IN\n", "no type"),
        ("www IN A\n", "no value"),
        ("www CH A 192.0.2.1\n", "Only the IN class"),
        ("$TTL abc\nwww A 192.0.2.1\n", "not a valid TTL"),
        ("www.other.org. IN A 192.0.2.1\n", "must be in the zone"),
    ],
)
def test_bad_lines_become_row_errors(
    auth_client: TestClient, zone: dict, text: str, fragment: str
) -> None:
    body = _import(auth_client, zone, text).json()
    assert any(fragment in r["message"] for r in body["rows"] if r["status"] == "error")


def test_commit_with_nothing_importable_is_422(auth_client: TestClient, zone: dict) -> None:
    response = _import(auth_client, zone, "bad IN A 300.0.0.1\n", mode="commit")
    assert response.status_code == 422


def test_empty_file_is_422(auth_client: TestClient, zone: dict) -> None:
    assert _import(auth_client, zone, "   \n").status_code == 422


def test_import_accepts_an_uploaded_file(auth_client: TestClient, zone: dict) -> None:
    response = auth_client.post(
        f"{ZONES}/{zone['id']}/import",
        files={"file": ("example.zone", b"www 300 IN A 192.0.2.7\n", "text/plain")},
    )
    assert response.json()["ready"] == 1


def test_non_utf8_upload_is_rejected(auth_client: TestClient, zone: dict) -> None:
    response = auth_client.post(
        f"{ZONES}/{zone['id']}/import", files={"file": ("x.zone", b"\xff\xfe\x00", "text/plain")}
    )
    assert response.status_code == 422


def test_bind_export_round_trips_into_another_zone(auth_client: TestClient, zone: dict) -> None:
    _import(auth_client, zone, ZONE_FILE, mode="commit")

    exported = auth_client.get(f"{ZONES}/{zone['id']}/export", params={"format": "bind"})

    assert exported.status_code == 200
    assert exported.headers["content-disposition"] == 'attachment; filename="example.com.zone"'
    assert "$ORIGIN example.com." in exported.text

    copy = auth_client.post(
        ZONES,
        json={
            "name": "example.com",
            "type": "private",
            "vpcs": [{"vpc_id": "vpc-0a1b2c3d4e5f67890", "region": "us-east-1"}],
        },
    ).json()
    body = _import(auth_client, copy, exported.text, mode="commit").json()

    assert body["errors"] == 0
    original = auth_client.get(f"{ZONES}/{zone['id']}/records", params={"page_size": 100}).json()
    copied = auth_client.get(f"{ZONES}/{copy['id']}/records", params={"page_size": 100}).json()

    def sets(page):
        return {
            (r["name"], r["type"], r["ttl"], tuple(r["values"]))
            for r in page["items"]
            if not r["is_default"]
        }

    assert sets(copied) == sets(original)


def test_json_export(auth_client: TestClient, zone: dict) -> None:
    response = auth_client.get(f"{ZONES}/{zone['id']}/export", params={"format": "json"})

    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["content-disposition"] == 'attachment; filename="example.com.json"'
    body = json.loads(response.text)
    assert body["hosted_zone"]["name"] == "example.com."
    assert [r["type"] for r in body["records"]] == ["NS", "SOA"]
    assert set(body["records"][0]) == {"name", "type", "ttl", "values"}


def test_export_unknown_zone_is_404(auth_client: TestClient) -> None:
    assert auth_client.get(f"{ZONES}/ZNOPE/export").status_code == 404
