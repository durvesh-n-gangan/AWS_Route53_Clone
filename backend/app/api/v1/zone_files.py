"""Zone file import and export: /api/v1/hostedzones/{zone_id}/import and /export."""

from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, Query, Response, UploadFile

from app.core.deps import CurrentUser, DbSession
from app.core.errors import AppError
from app.schemas.record import ImportResponse, ImportRowOut
from app.services import bind_io
from app.services.zones import get_zone

router = APIRouter(prefix="/hostedzones/{zone_id}", tags=["zone files"])


@router.post("/import", response_model=ImportResponse)
def import_zone_file(
    zone_id: str,
    db: DbSession,
    user: CurrentUser,
    mode: Literal["preview", "commit"] = "preview",
    text: Annotated[str | None, Form(max_length=bind_io.MAX_IMPORT_BYTES)] = None,
    file: Annotated[UploadFile | None, File()] = None,
):
    """Preview (default) or import a BIND zone file sent as `text` or as an uploaded `file`."""
    zone = get_zone(db, user, zone_id)
    if file is not None:
        raw = file.file.read(bind_io.MAX_IMPORT_BYTES + 1)
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise AppError("InvalidInput", "The zone file must be UTF-8 text.", 422) from exc
    else:
        content = text or ""

    rows = bind_io.preview_import(db, zone, content)
    created = bind_io.commit_import(db, zone, rows) if mode == "commit" else 0
    return ImportResponse(
        mode=mode,
        rows=[
            ImportRowOut(
                name=row.name,
                type=row.type,
                ttl=row.ttl,
                values=row.values,
                lines=row.lines,
                status=row.status,  # type: ignore[arg-type]
                message=row.message,
            )
            for row in rows
        ],
        ready=sum(row.status == "ready" for row in rows),
        skipped=sum(row.status == "skipped" for row in rows),
        errors=sum(row.status == "error" for row in rows),
        created=created,
    )


@router.get("/export")
def export_zone(
    zone_id: str,
    db: DbSession,
    user: CurrentUser,
    format: Annotated[Literal["bind", "json"], Query()] = "bind",  # noqa: A002
) -> Response:
    zone = get_zone(db, user, zone_id)
    base_name = zone.name.rstrip(".")
    if format == "json":
        body, media_type, filename = (
            bind_io.export_json(db, zone),
            "application/json",
            f"{base_name}.json",
        )
    else:
        body, media_type, filename = (
            bind_io.export_bind(db, zone),
            "text/plain",
            f"{base_name}.zone",
        )
    return Response(
        content=body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
