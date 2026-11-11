"""BIND zone-file import (with a per-record preview) and JSON / BIND export.

The reader works line by line so that one bad line becomes one error in the preview instead
of rejecting the whole file. It understands $ORIGIN, $TTL, comments, parentheses spanning
several lines, "@", relative names and owner names inherited from the previous line.
Every record set then goes through the same validation as records created in the console.
"""

import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime

import dns.ttl
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.ids import new_record_id
from app.models import HostedZone, Record
from app.services.record_validation import (
    CREATABLE_TYPES,
    RecordValidationError,
    ValidRecord,
    validate_record,
)
from app.services.records import _conflict, commit_or_conflict
from app.services.validation import normalize_fqdn

MAX_IMPORT_BYTES = 1_000_000
DEFAULT_TTL = 300

_TOKEN = re.compile(r'"(?:[^"\\]|\\.)*"|\S+')
_KNOWN_TYPES = set(CREATABLE_TYPES) | {"SOA"}


@dataclass
class ImportRow:
    name: str
    type: str
    ttl: int
    values: list[str]
    lines: list[int]
    status: str = "ready"  # ready | skipped | error
    message: str = ""
    record: ValidRecord | None = field(default=None, repr=False)


def _strip_comment(line: str) -> str:
    """Remove a ';' comment that is not inside a quoted string."""
    in_quotes = escaped = False
    for index, char in enumerate(line):
        if escaped:
            escaped = False
        elif char == "\\":
            escaped = True
        elif char == '"':
            in_quotes = not in_quotes
        elif char == ";" and not in_quotes:
            return line[:index]
    return line


def _logical_lines(text: str):
    """Yield (line number, starts with whitespace, text) with parentheses joined up."""
    buffer: list[str] = []
    start_line = 0
    starts_blank = False
    depth = 0
    for number, raw in enumerate(text.splitlines(), start=1):
        line = _strip_comment(raw).rstrip()
        if not buffer:
            if not line.strip():
                continue
            start_line, starts_blank = number, raw[:1] in (" ", "\t")
        depth += line.count("(") - line.count(")")
        buffer.append(line.replace("(", " ").replace(")", " "))
        if depth <= 0:
            yield start_line, starts_blank, " ".join(buffer).strip()
            buffer, depth = [], 0
    if buffer:
        yield start_line, starts_blank, " ".join(buffer).strip()


def _absolute(name: str, origin: str) -> str:
    if name == "@":
        return origin
    if name.endswith("."):
        return name.lower()
    return f"{name}.{origin}".lower()


def parse_zone_file(zone: HostedZone, text: str) -> list[ImportRow]:
    """Turn zone-file text into record sets, each marked ready, skipped or error."""
    zone_name = normalize_fqdn(zone.name)
    origin = zone_name
    default_ttl = DEFAULT_TTL
    owner: str | None = None
    grouped: dict[tuple[str, str], ImportRow] = {}
    errors: list[ImportRow] = []

    def line_error(number: int, message: str, name: str = "", record_type: str = "") -> None:
        errors.append(
            ImportRow(name, record_type, 0, [], [number], "error", f"Line {number}: {message}")
        )

    for number, blank_owner, line in _logical_lines(text):
        tokens = _TOKEN.findall(line)
        if not tokens:  # e.g. a line holding only "(" or ")"
            continue
        directive = tokens[0].upper()
        if directive == "$ORIGIN" and len(tokens) == 2:
            origin = normalize_fqdn(_absolute(tokens[1], origin))
            continue
        if directive == "$TTL" and len(tokens) == 2:
            try:
                default_ttl = dns.ttl.from_text(tokens[1])
            except dns.ttl.BadTTL:
                line_error(number, f"{tokens[1]} is not a valid TTL.")
            continue
        if directive.startswith("$"):
            line_error(number, f"The {tokens[0]} directive is not supported.")
            continue

        if not blank_owner:
            owner = _absolute(tokens.pop(0), origin)
        if owner is None:
            line_error(number, "The record has no owner name.")
            continue

        ttl = default_ttl
        failed = False
        while tokens and (tokens[0].upper() in ("IN", "CH", "HS") or tokens[0][0].isdigit()):
            token = tokens.pop(0)
            if token.upper() in ("CH", "HS"):
                line_error(number, "Only the IN class is supported.", owner)
                failed = True
                break
            if token.upper() != "IN":
                try:
                    ttl = dns.ttl.from_text(token)
                except dns.ttl.BadTTL:
                    line_error(number, f"{token} is not a valid TTL.", owner)
                    failed = True
                    break
        if failed:
            continue
        if not tokens:
            line_error(number, "The record has no type.", owner)
            continue

        record_type = tokens.pop(0).upper()
        if record_type not in _KNOWN_TYPES:
            line_error(number, f"{record_type} records are not supported.", owner, record_type)
            continue
        if not tokens:
            line_error(number, "The record has no value.", owner, record_type)
            continue

        key = (owner, record_type)
        row = grouped.get(key)
        if row is None:
            grouped[key] = ImportRow(owner, record_type, ttl, [" ".join(tokens)], [number])
        else:
            row.values.append(" ".join(tokens))
            row.lines.append(number)

    rows = list(grouped.values())
    for row in rows:
        at_apex = row.name == zone_name
        if row.type == "SOA" or (row.type == "NS" and at_apex):
            row.status = "skipped"
            row.message = "Route 53 manages the zone's own SOA and NS records, so this is skipped."
            continue
        try:
            row.record = validate_record(
                zone_name, name=row.name, record_type=row.type, ttl=row.ttl, values=row.values
            )
            row.values = row.record.values
        except RecordValidationError as exc:
            row.status = "error"
            row.message = f"Line {row.lines[0]}: {exc.message}"
    return [*rows, *errors]


def check_conflicts(db: Session, zone: HostedZone, rows: list[ImportRow]) -> None:
    """Mark ready rows that would clash with existing records (or each other) as errors."""
    taken = [
        (name, record_type)
        for name, record_type in db.execute(
            select(Record.name, Record.type).where(Record.hosted_zone_id == zone.id)
        )
    ]
    for row in rows:
        if row.status != "ready" or row.record is None:
            continue
        problem = _conflict(row.record, zone, taken)
        if problem:
            row.status = "error"
            row.message = f"Line {row.lines[0]}: {problem}"
        else:
            taken.append((row.record.name, row.record.type))


def preview_import(db: Session, zone: HostedZone, text: str) -> list[ImportRow]:
    if len(text.encode("utf-8")) > MAX_IMPORT_BYTES:
        raise AppError("InvalidInput", "The zone file can be up to 1 MB.", 422)
    if not text.strip():
        raise AppError("InvalidInput", "The zone file is empty.", 422)
    rows = parse_zone_file(zone, text)
    check_conflicts(db, zone, rows)
    return rows


def commit_import(db: Session, zone: HostedZone, rows: list[ImportRow]) -> int:
    """Create every ready record set in one transaction. Rows with errors are left out."""
    ready = [row.record for row in rows if row.status == "ready" and row.record is not None]
    if not ready:
        raise AppError(
            "InvalidChangeBatch", "The zone file has no records that can be imported.", 422
        )
    db.add_all(
        Record(
            id=new_record_id(),
            hosted_zone_id=zone.id,
            name=record.name,
            type=record.type,
            ttl=record.ttl,
            values=record.values,
        )
        for record in ready
    )
    commit_or_conflict(db)
    return len(ready)


def _sorted_records(db: Session, zone: HostedZone) -> list[Record]:
    return list(
        db.scalars(
            select(Record)
            .where(Record.hosted_zone_id == zone.id)
            .order_by(Record.is_default.desc(), Record.name, Record.type)
        )
    )


def _relative(name: str, origin: str) -> str:
    if name == origin:
        return "@"
    return name[: -len(origin) - 1] if name.endswith(f".{origin}") else name


def export_bind(db: Session, zone: HostedZone) -> str:
    origin = normalize_fqdn(zone.name)
    lines = [
        f"; Zone file for {origin}",
        f"; Exported from the Route 53 console clone on {datetime.now(UTC):%Y-%m-%d %H:%M} UTC",
        f"$ORIGIN {origin}",
        f"$TTL {DEFAULT_TTL}",
    ]
    for record in _sorted_records(db, zone):
        owner = _relative(record.name, origin)
        lines.extend(
            f"{owner}\t{record.ttl}\tIN\t{record.type}\t{value}" for value in record.values
        )
    return "\n".join(lines) + "\n"


def export_json(db: Session, zone: HostedZone) -> str:
    payload = {
        "hosted_zone": {
            "id": zone.id,
            "name": zone.name,
            "type": zone.type,
            "comment": zone.comment,
        },
        "records": [
            {"name": r.name, "type": r.type, "ttl": r.ttl, "values": list(r.values)}
            for r in _sorted_records(db, zone)
        ],
    }
    return json.dumps(payload, indent=2) + "\n"
