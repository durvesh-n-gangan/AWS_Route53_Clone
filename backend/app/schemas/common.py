from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")

MAX_PAGE_SIZE = 100


class Page(BaseModel, Generic[T]):
    """Every list endpoint returns this shape (PROJECT_PLAN.md section 4)."""

    items: list[T]
    total: int
    page: int
    page_size: int


class BulkDeleteRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=MAX_PAGE_SIZE)


class BulkFailure(BaseModel):
    id: str
    code: str
    message: str


class BulkDeleteResult(BaseModel):
    """Bulk deletes are best-effort: each item succeeds or fails on its own."""

    deleted: list[str]
    failed: list[BulkFailure]
