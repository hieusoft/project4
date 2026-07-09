"""Shared response wrapper matching the platform's TransformInterceptor."""
from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class DataEnvelope(BaseModel, Generic[T]):
    data: T


class MessageResponse(BaseModel):
    message: str
