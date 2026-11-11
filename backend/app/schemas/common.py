from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")

MAX_PAGE_SIZE = 100


class Page(BaseModel, Generic[T]):
    """Every list endpoint returns this shape (PROJECT_PLAN.md section 4)."""

    items: list[T]
    total: int
    page: int
    page_size: int
