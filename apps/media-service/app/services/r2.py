"""Cloudflare R2 access via boto3 (S3-compatible).

boto3 is synchronous; the network calls (HEAD/DELETE) are dispatched to a
thread with asyncio.to_thread so they don't block the event loop. Presigned
URL generation is a local signing operation (no network) so it stays sync.

Object keys are generated server-side — the client's filename is never trusted.
Layout mirrors the reference upload service:
    {folder}/{YYYY}/{MM}/{DD}/{HH}/{mm}/{uuid}.{ext}   (Vietnam time, UTC+7)
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings
from app.schemas.media import MIME_EXT, REF_TYPE_FOLDERS

# Vietnam is UTC+7 (no DST) — stamp keys in local time for easy bucket browsing.
_VN_OFFSET = timedelta(hours=7)

# Lazily initialized so the app can import/start before R2 config is present
# (the endpoint is derived from the account id, which must be non-empty).
_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            region_name="auto",
            endpoint_url=settings.r2_endpoint,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(signature_version="s3v4"),
        )
    return _client


def generate_object_key(ref_type: str, mime_type: str) -> str:
    folder = REF_TYPE_FOLDERS[ref_type]
    ext = MIME_EXT[mime_type]
    vn = datetime.now(timezone.utc) + _VN_OFFSET
    date_path = f"{vn.year:04d}/{vn.month:02d}/{vn.day:02d}/{vn.hour:02d}/{vn.minute:02d}"
    return f"{folder}/{date_path}/{uuid.uuid4()}.{ext}"


def public_url(object_key: str) -> str:
    return f"{settings.r2_public_base}/{object_key}"


def create_presigned_put_url(object_key: str, content_type: str) -> str:
    """Local signing operation (no network call)."""
    return _get_client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.r2_bucket,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=settings.presign_expires_seconds,
    )


async def object_exists(object_key: str) -> bool:
    def _head() -> bool:
        try:
            _get_client().head_object(Bucket=settings.r2_bucket, Key=object_key)
            return True
        except ClientError as err:
            code = err.response.get("Error", {}).get("Code")
            status = err.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if code in ("404", "NoSuchKey", "NotFound") or status == 404:
                return False
            raise

    return await asyncio.to_thread(_head)


async def delete_object(object_key: str) -> None:
    def _delete() -> None:
        _get_client().delete_object(Bucket=settings.r2_bucket, Key=object_key)

    await asyncio.to_thread(_delete)
