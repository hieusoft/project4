"""Response envelope matching the NestJS TransformInterceptor ({ data: ... })."""
from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class DataEnvelope(BaseModel, Generic[T]):
    data: T


class MessageResponse(BaseModel):
    message: str


class PaginationMeta(BaseModel):
    page: int
    limit: int
    total: int


class Paginated(BaseModel, Generic[T]):
    items: list[T]
    meta: PaginationMeta
