from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.record import MAX_TTL

RecordType = Literal["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA"]
RoutingPolicy = Literal["simple"]

MAX_RECORDS_PER_REQUEST = 50


class RecordInput(BaseModel):
    """One record set as entered in the console. `name` may be relative ("www") or "@"."""

    name: str = Field(default="", max_length=255, examples=["www"])
    type: RecordType
    ttl: int = Field(default=300, ge=0, le=MAX_TTL)
    values: list[str] = Field(min_length=1, max_length=100, examples=[["192.0.2.10"]])
    routing_policy: RoutingPolicy = "simple"


class RecordCreateRequest(BaseModel):
    records: list[RecordInput] = Field(min_length=1, max_length=MAX_RECORDS_PER_REQUEST)


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    hosted_zone_id: str
    name: str
    type: RecordType
    ttl: int
    values: list[str]
    routing_policy: str
    set_identifier: str | None
    alias_target: dict[str, Any] | None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("set_identifier", mode="before")
    @classmethod
    def _empty_means_none(cls, value: str | None) -> str | None:
        # Stored as "" so the unique constraint works in SQLite; the API speaks null.
        return value or None


class RecordCreateResponse(BaseModel):
    items: list[RecordOut]
