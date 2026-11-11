"""Record set endpoints: /api/v1/hostedzones/{zone_id}/records."""

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.common import MAX_PAGE_SIZE, Page
from app.schemas.record import (
    RecordCreateRequest,
    RecordCreateResponse,
    RecordInput,
    RecordOut,
    RecordType,
    RoutingPolicy,
)
from app.services import records as record_service
from app.services.zones import get_zone

router = APIRouter(prefix="/hostedzones/{zone_id}/records", tags=["records"])


@router.get("", response_model=Page[RecordOut])
def list_records(
    zone_id: str,
    db: DbSession,
    user: CurrentUser,
    search: Annotated[str | None, Query(max_length=255)] = None,
    type: RecordType | None = None,  # noqa: A002 - public query parameter name
    routing_policy: RoutingPolicy | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 10,
):
    zone = get_zone(db, user, zone_id)
    rows, total = record_service.list_records(
        db,
        zone,
        search=search,
        record_type=type,
        routing_policy=routing_policy,
        page=page,
        page_size=page_size,
    )
    return Page[RecordOut](
        items=[RecordOut.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=RecordCreateResponse, status_code=status.HTTP_201_CREATED)
def create_records(zone_id: str, body: RecordCreateRequest, db: DbSession, user: CurrentUser):
    zone = get_zone(db, user, zone_id)
    created = record_service.create_records(db, zone, body.records)
    return RecordCreateResponse(items=[RecordOut.model_validate(r) for r in created])


@router.put("/{record_id}", response_model=RecordOut)
def update_record(
    zone_id: str, record_id: str, body: RecordInput, db: DbSession, user: CurrentUser
):
    zone = get_zone(db, user, zone_id)
    record = record_service.get_record(db, zone, record_id)
    return record_service.update_record(db, zone, record, body)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(zone_id: str, record_id: str, db: DbSession, user: CurrentUser) -> Response:
    zone = get_zone(db, user, zone_id)
    record_service.delete_record(db, record_service.get_record(db, zone, record_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
