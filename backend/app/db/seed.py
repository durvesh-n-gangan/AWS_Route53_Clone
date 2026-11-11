"""Idempotent demo data: one console user and two sample hosted zones.

All data is fictional: reserved example domains and documentation IP ranges only
(192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 2001:db8::/32).

Run with `python -m app.db.seed` after `alembic upgrade head`.
"""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.ids import new_record_id
from app.core.security import hash_password
from app.models import HostedZone, Record, User
from app.services.validation import qualify_record_name
from app.services.zones import create_zone

logger = logging.getLogger(__name__)

DEMO_USERNAME = "admin"
DEMO_PASSWORD = "admin123"
DEMO_ACCOUNT_ID = "123456789012"

# (record name relative to the zone, type, ttl, values)
_PUBLIC_ZONE_RECORDS: list[tuple[str, str, int, list[str]]] = [
    ("@", "A", 300, ["192.0.2.10"]),
    ("@", "AAAA", 300, ["2001:db8::10"]),
    ("@", "MX", 3600, ["10 mail.example.com.", "20 mail-backup.example.com."]),
    ("@", "TXT", 300, ['"v=spf1 mx -all"']),
    ("@", "CAA", 3600, ['0 issue "ca.example.net"']),
    ("www", "CNAME", 300, ["example.com."]),
    ("api", "A", 60, ["198.51.100.7", "198.51.100.8"]),
    ("mail", "A", 300, ["192.0.2.25"]),
    ("_sip._tcp", "SRV", 300, ["10 5 5060 sip.example.com."]),
]

_PRIVATE_ZONE_RECORDS: list[tuple[str, str, int, list[str]]] = [
    ("db", "A", 300, ["203.0.113.12"]),
    ("cache", "AAAA", 300, ["2001:db8:1::12"]),
    ("db-alias", "PTR", 300, ["db.corp.example.org."]),
]


def _add_records(zone: HostedZone, records: list[tuple[str, str, int, list[str]]]) -> None:
    for name, record_type, ttl, values in records:
        zone.records.append(
            Record(
                id=new_record_id(),
                name=qualify_record_name(name, zone.name),
                type=record_type,
                ttl=ttl,
                values=values,
            )
        )


def seed(db: Session) -> bool:
    """Insert demo data unless the demo user already exists. Returns True if data was added."""
    if db.scalar(select(User).where(User.username == DEMO_USERNAME)) is not None:
        return False

    user = User(
        username=DEMO_USERNAME,
        password_hash=hash_password(DEMO_PASSWORD),
        account_id=DEMO_ACCOUNT_ID,
    )
    db.add(user)

    public_zone = create_zone(
        db,
        user,
        name="example.com",
        comment="Public zone for the demo website",
        tags={"Environment": "demo", "Team": "web"},
    )
    _add_records(public_zone, _PUBLIC_ZONE_RECORDS)

    private_zone = create_zone(
        db,
        user,
        name="corp.example.org",
        zone_type="private",
        comment="Internal services",
        vpcs=[("vpc-0a1b2c3d4e5f67890", "us-east-1")],
    )
    _add_records(private_zone, _PRIVATE_ZONE_RECORDS)

    db.commit()
    return True


def main() -> None:
    from app.db.session import SessionLocal

    logging.basicConfig(level=logging.INFO)
    with SessionLocal() as db:
        if seed(db):
            logger.info("Seeded demo user '%s' and 2 hosted zones.", DEMO_USERNAME)
        else:
            logger.info("Demo data already present; nothing to do.")


if __name__ == "__main__":
    main()
