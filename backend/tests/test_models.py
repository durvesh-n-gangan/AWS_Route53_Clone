"""Schema rules (unique keys, checks, cascades) enforced by the database itself."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.ids import new_record_id
from app.core.security import hash_password
from app.models import HostedZone, Record, User, UserSession, VpcAssociation, ZoneTag
from app.services.zones import create_zone


@pytest.fixture
def user(db: Session) -> User:
    account = User(username="tester", password_hash=hash_password("pw"), account_id="111122223333")
    db.add(account)
    db.commit()
    return account


def _record(zone: HostedZone, name: str, record_type: str = "A", **extra: object) -> Record:
    return Record(
        id=new_record_id(),
        hosted_zone_id=zone.id,
        name=name,
        type=record_type,
        ttl=extra.pop("ttl", 300),
        values=extra.pop("values", ["192.0.2.1"]),
        **extra,
    )


def test_deleting_a_zone_row_cascades_to_records_tags_and_vpcs(db: Session, user: User) -> None:
    zone = create_zone(
        db,
        user,
        name="cascade.test",
        zone_type="private",
        vpcs=[("vpc-1234", "us-east-1")],
        tags={"k": "v"},
    )
    db.add(_record(zone, "www.cascade.test."))
    db.commit()

    # Raw SQL bypasses the ORM cascade, so this proves the FK pragma + ON DELETE CASCADE.
    db.execute(text("DELETE FROM hosted_zones WHERE id = :id"), {"id": zone.id})
    db.commit()

    for model in (Record, ZoneTag, VpcAssociation):
        assert db.scalar(select(func.count()).select_from(model)) == 0


def test_deleting_a_user_cascades_to_sessions_and_zones(db: Session, user: User) -> None:
    create_zone(db, user, name="owned.test")
    db.add(
        UserSession(id="h" * 64, user_id=user.id, expires_at=datetime.now(UTC) + timedelta(hours=1))
    )
    db.commit()

    db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user.id})
    db.commit()

    assert db.scalar(select(func.count()).select_from(UserSession)) == 0
    assert db.scalar(select(func.count()).select_from(HostedZone)) == 0
    assert db.scalar(select(func.count()).select_from(Record)) == 0


def test_duplicate_simple_record_set_is_rejected(db: Session, user: User) -> None:
    """set_identifier defaults to '' so the unique constraint works in SQLite."""
    zone = create_zone(db, user, name="dupe.test")
    db.add(_record(zone, "www.dupe.test."))
    db.commit()

    db.add(_record(zone, "www.dupe.test.", values=["192.0.2.2"]))
    with pytest.raises(IntegrityError):
        db.commit()


def test_same_name_different_type_is_allowed(db: Session, user: User) -> None:
    zone = create_zone(db, user, name="mixed.test")
    db.add(_record(zone, "mixed.test.", "A"))
    db.add(_record(zone, "mixed.test.", "AAAA", values=["2001:db8::1"]))
    db.commit()


def test_same_zone_name_and_type_twice_for_one_owner_is_rejected(db: Session, user: User) -> None:
    create_zone(db, user, name="twice.test")
    db.commit()

    with pytest.raises(IntegrityError):
        create_zone(db, user, name="twice.test")


def test_public_and_private_zone_with_same_name_can_coexist(db: Session, user: User) -> None:
    create_zone(db, user, name="split.test")
    create_zone(db, user, name="split.test", zone_type="private", vpcs=[("vpc-1", "eu-west-1")])
    db.commit()


@pytest.mark.parametrize(
    ("field", "value"),
    [("type", "BOGUS"), ("ttl", -1), ("ttl", 2_147_483_648)],
)
def test_record_check_constraints(db: Session, user: User, field: str, value: object) -> None:
    zone = create_zone(db, user, name="checks.test")
    db.commit()

    record = _record(zone, "x.checks.test.")
    setattr(record, field, value)
    db.add(record)
    with pytest.raises(IntegrityError):
        db.commit()


def test_zone_type_check_constraint(db: Session, user: User) -> None:
    with pytest.raises(IntegrityError):
        create_zone(db, user, name="bad-type.test", zone_type="hybrid")


def test_timestamps_are_timezone_aware_utc(db: Session, user: User) -> None:
    zone = create_zone(db, user, name="time.test")
    db.commit()
    db.expire_all()

    reloaded = db.get(HostedZone, zone.id)
    assert reloaded is not None
    assert reloaded.created_at.tzinfo is UTC
    assert reloaded.updated_at >= reloaded.created_at


def test_record_values_round_trip_as_a_json_list(db: Session, user: User) -> None:
    zone = create_zone(db, user, name="json.test")
    db.add(_record(zone, "json.test.", "TXT", values=['"a b"', '"c"']))
    db.commit()
    db.expire_all()

    stored = db.scalar(select(Record).where(Record.type == "TXT"))
    assert stored is not None
    assert stored.values == ['"a b"', '"c"']
    assert stored.set_identifier == ""
    assert stored.routing_policy == "simple"
    assert stored.is_default is False
