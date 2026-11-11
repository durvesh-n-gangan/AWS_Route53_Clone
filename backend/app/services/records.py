"""Record set business logic: listing, batch create, update and delete with Route 53 rules."""

import logging
from collections.abc import Sequence

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.ids import new_record_id
from app.db.base import utcnow
from app.models import HostedZone, Record
from app.schemas.record import RecordInput
from app.services.record_validation import RecordValidationError, ValidRecord, validate_record
from app.services.zones import _escape_like

logger = logging.getLogger(__name__)

INVALID_BATCH = "InvalidChangeBatch"


def list_records(
    db: Session,
    zone: HostedZone,
    *,
    search: str | None = None,
    record_type: str | None = None,
    routing_policy: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[Record], int]:
    query = select(Record).where(Record.hosted_zone_id == zone.id)
    if search and search.strip():
        pattern = f"%{_escape_like(search.strip().lower())}%"
        query = query.where(
            or_(
                func.lower(Record.name).like(pattern, escape="\\"),
                func.lower(cast(Record.values, String)).like(pattern, escape="\\"),
            )
        )
    if record_type:
        query = query.where(Record.type == record_type)
    if routing_policy:
        query = query.where(Record.routing_policy == routing_policy)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    # Like the console: the zone's own NS and SOA first, then by name and type.
    rows = db.scalars(
        query.order_by(Record.is_default.desc(), Record.name, Record.type)
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    return list(rows), total


def get_record(db: Session, zone: HostedZone, record_id: str) -> Record:
    record = db.get(Record, record_id)
    if record is None or record.hosted_zone_id != zone.id:
        raise AppError("NoSuchResourceRecordSet", f"No record found with ID: {record_id}", 404)
    return record


def _conflict(
    candidate: ValidRecord,
    zone: HostedZone,
    others: Sequence[tuple[str, str]],
) -> str | None:
    """Route 53's uniqueness and CNAME rules against the other (name, type) pairs."""
    zone_name = zone.name
    same_name_types = {record_type for name, record_type in others if name == candidate.name}
    if candidate.type in same_name_types:
        return (
            f"Tried to create resource record set [name='{candidate.name}', "
            f"type='{candidate.type}'] but it already exists"
        )
    if candidate.type == "CNAME" and same_name_types:
        return (
            f"RRSet of type CNAME with DNS name {candidate.name} is not permitted as it "
            f"conflicts with other records with the same DNS name in zone {zone_name}"
        )
    if "CNAME" in same_name_types:
        return (
            f"RRSet of type {candidate.type} with DNS name {candidate.name} is not permitted "
            f"because a conflicting RRSet of type CNAME with the same DNS name already exists "
            f"in zone {zone_name}"
        )
    return None


def _existing_keys(db: Session, zone: HostedZone, exclude_id: str | None = None):
    query = select(Record.name, Record.type).where(Record.hosted_zone_id == zone.id)
    if exclude_id:
        query = query.where(Record.id != exclude_id)
    return [(name, record_type) for name, record_type in db.execute(query)]


def _batch_error(status: int, message: str, errors: list[dict[str, str] | None]) -> AppError:
    return AppError(INVALID_BATCH, message, status, details={"errors": errors})


def create_records(db: Session, zone: HostedZone, inputs: Sequence[RecordInput]) -> list[Record]:
    """Create several record sets atomically: either all are written or none are."""
    errors: list[dict[str, str] | None] = [None] * len(inputs)
    valid: list[ValidRecord | None] = [None] * len(inputs)
    for index, item in enumerate(inputs):
        try:
            valid[index] = validate_record(
                zone.name, name=item.name, record_type=item.type, ttl=item.ttl, values=item.values
            )
        except RecordValidationError as exc:
            errors[index] = {exc.field: exc.message}

    if any(errors):
        failed = sum(1 for error in errors if error)
        raise _batch_error(422, f"{failed} of {len(inputs)} records are not valid.", errors)

    taken = _existing_keys(db, zone)
    for index, candidate in enumerate(valid):
        assert candidate is not None
        problem = _conflict(candidate, zone, taken)
        if problem:
            errors[index] = {"name": problem}
        taken.append((candidate.name, candidate.type))

    if any(errors):
        first = next(error for error in errors if error)
        raise _batch_error(409, next(iter(first.values())), errors)

    created = [
        Record(
            id=new_record_id(),
            hosted_zone_id=zone.id,
            name=candidate.name,
            type=candidate.type,
            ttl=candidate.ttl,
            values=candidate.values,
        )
        for candidate in valid
        if candidate is not None
    ]
    db.add_all(created)
    db.commit()
    logger.info("Created %d record(s) in zone %s", len(created), zone.id)
    return created


def update_record(db: Session, zone: HostedZone, record: Record, item: RecordInput) -> Record:
    try:
        candidate = validate_record(
            zone.name,
            name=item.name,
            record_type=item.type,
            ttl=item.ttl,
            values=item.values,
            allow_soa=record.is_default and record.type == "SOA",
        )
    except RecordValidationError as exc:
        raise AppError(
            "InvalidInput",
            exc.message,
            422,
            details={"fields": [{"field": exc.field, "message": exc.message}]},
        ) from exc

    if record.is_default and (candidate.name != record.name or candidate.type != record.type):
        raise AppError(
            INVALID_BATCH,
            "You can change only the TTL and values of the hosted zone's default NS and SOA "
            "records.",
            409,
        )
    problem = _conflict(candidate, zone, _existing_keys(db, zone, exclude_id=record.id))
    if problem:
        raise AppError(INVALID_BATCH, problem, 409)

    record.name = candidate.name
    record.type = candidate.type
    record.ttl = candidate.ttl
    record.values = candidate.values
    record.updated_at = utcnow()
    db.commit()
    db.refresh(record)
    return record


def default_record_message(record: Record) -> str:
    if record.type == "SOA":
        return "A HostedZone must contain exactly one SOA record."
    return "A HostedZone must contain at least one NS record for the zone itself."


def delete_record(db: Session, record: Record) -> None:
    if record.is_default:
        raise AppError(INVALID_BATCH, default_record_message(record), 409)
    db.delete(record)
    db.commit()
    logger.info("Deleted record %s", record.id)
