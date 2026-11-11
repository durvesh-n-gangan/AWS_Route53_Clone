from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.validation import validate_domain_name

ZoneType = Literal["public", "private"]
ZoneSort = Literal["name", "-name", "created_at", "-created_at", "record_count", "-record_count"]

MAX_TAGS = 50


class VpcIn(BaseModel):
    vpc_id: str = Field(
        pattern=r"^vpc-[0-9a-f]{8}([0-9a-f]{9})?$", examples=["vpc-0a1b2c3d4e5f67890"]
    )
    region: str = Field(pattern=r"^[a-z]{2}(-gov|-iso[a-z]?)?-[a-z]+-\d$", examples=["us-east-1"])


class VpcOut(VpcIn):
    model_config = ConfigDict(from_attributes=True)


class Tag(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str = Field(min_length=1, max_length=128)
    value: str = Field(default="", max_length=256)


def _unique_tag_keys(tags: list[Tag] | None) -> list[Tag] | None:
    if tags is not None:
        keys = [tag.key for tag in tags]
        if len(keys) != len(set(keys)):
            raise ValueError("Tag keys must be unique.")
    return tags


class HostedZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255, examples=["example.com"])
    comment: str = Field(default="", max_length=256)
    type: ZoneType = "public"
    vpcs: list[VpcIn] = Field(default_factory=list)
    tags: list[Tag] = Field(default_factory=list, max_length=MAX_TAGS)

    @field_validator("name")
    @classmethod
    def _valid_domain(cls, value: str) -> str:
        return validate_domain_name(value)

    @field_validator("tags")
    @classmethod
    def _tags(cls, value: list[Tag]) -> list[Tag]:
        return _unique_tag_keys(value) or []

    @model_validator(mode="after")
    def _vpcs_match_type(self) -> "HostedZoneCreate":
        if self.type == "private" and not self.vpcs:
            raise ValueError("A private hosted zone must be associated with at least one VPC.")
        if self.type == "public" and self.vpcs:
            raise ValueError("A public hosted zone can't be associated with a VPC.")
        return self


class HostedZoneUpdate(BaseModel):
    """Only the description and tags of a zone can change, as in Route 53."""

    comment: str | None = Field(default=None, max_length=256)
    tags: list[Tag] | None = Field(default=None, max_length=MAX_TAGS)

    @field_validator("tags")
    @classmethod
    def _tags(cls, value: list[Tag] | None) -> list[Tag] | None:
        return _unique_tag_keys(value)


class HostedZoneSummary(BaseModel):
    id: str
    name: str
    type: ZoneType
    comment: str
    record_count: int
    created_by: str = "Route 53"
    caller_reference: str
    created_at: datetime
    updated_at: datetime


class HostedZoneDetail(HostedZoneSummary):
    name_servers: list[str]
    tags: list[Tag]
    vpcs: list[VpcOut]
