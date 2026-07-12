"""Object storage via SeaweedFS S3 gateway (boto3).

boto3 is synchronous; network calls (PUT/HEAD/DELETE) are dispatched with
asyncio.to_thread so they don't block the event loop. Presigned URL generation
is a local signing operation (no network) so it stays sync.

Object keys are generated server-side — the client's filename is never trusted.
Layout:
    {folder}/{YYYY}/{MM}/{DD}/{HH}/{mm}/{uuid}.{ext}   (Vietnam time, UTC+7)
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings
from app.schemas.media import MIME_EXT, REF_TYPE_FOLDERS

logger = logging.getLogger(__name__)

# Vietnam is UTC+7 (no DST) — stamp keys in local time for easy bucket browsing.
_VN_OFFSET = timedelta(hours=7)

_client = None
_presign_client = None

_BOTO_CONFIG = Config(
    signature_version="s3v4",
    s3={"addressing_style": "path"},
)


def _make_client(endpoint_url: str):
    return boto3.client(
        "s3",
        region_name=settings.seaweed_s3_region,
        endpoint_url=endpoint_url,
        aws_access_key_id=settings.seaweed_access_key_id,
        aws_secret_access_key=settings.seaweed_secret_access_key,
        config=_BOTO_CONFIG,
    )


def _get_client():
    """S3 client for server-side ops (Docker network → seaweedfs)."""
    global _client
    if _client is None:
        _client = _make_client(settings.seaweed_s3_endpoint)
    return _client


def _get_presign_client():
    """S3 client for presigned URLs — must use the browser-facing host.

    SigV4 signs the Host header. Signing with the internal hostname then
    rewriting the URL breaks verification (403 SignatureDoesNotMatch).
    """
    global _presign_client
    if _presign_client is None:
        endpoint = (
            settings.seaweed_s3_public_endpoint.rstrip("/")
            or settings.seaweed_s3_endpoint
        )
        _presign_client = _make_client(endpoint)
    return _presign_client


def generate_object_key(ref_type: str, mime_type: str) -> str:
    folder = REF_TYPE_FOLDERS[ref_type]
    ext = MIME_EXT[mime_type]
    vn = datetime.now(timezone.utc) + _VN_OFFSET
    date_path = (
        f"{vn.year:04d}/{vn.month:02d}/{vn.day:02d}/{vn.hour:02d}/{vn.minute:02d}"
    )
    return f"{folder}/{date_path}/{uuid.uuid4()}.{ext}"


def public_url(object_key: str) -> str:
    """Browser-reachable URL: {PUBLIC_BASE}/{object_key}."""
    return f"{settings.seaweed_public_base}/{object_key}"


def create_presigned_put_url(object_key: str, content_type: str) -> str:
    """Local signing operation (no network call) against the public endpoint."""
    return _get_presign_client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.seaweed_bucket,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=settings.presign_expires_seconds,
    )


async def put_object(object_key: str, body: bytes, content_type: str) -> None:
    """Server-side upload (used by multipart proxy for browser clients)."""

    def _put() -> None:
        _get_client().put_object(
            Bucket=settings.seaweed_bucket,
            Key=object_key,
            Body=body,
            ContentType=content_type,
        )

    await asyncio.to_thread(_put)


async def object_exists(object_key: str) -> bool:
    def _head() -> bool:
        try:
            _get_client().head_object(
                Bucket=settings.seaweed_bucket, Key=object_key
            )
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
        _get_client().delete_object(
            Bucket=settings.seaweed_bucket, Key=object_key
        )

    await asyncio.to_thread(_delete)


async def ensure_bucket() -> None:
    """Create the media bucket if it does not exist (idempotent)."""

    def _ensure() -> None:
        client = _get_client()
        bucket = settings.seaweed_bucket
        try:
            client.head_bucket(Bucket=bucket)
            logger.info("SeaweedFS bucket already exists: %s", bucket)
            return
        except ClientError as err:
            status = err.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            code = err.response.get("Error", {}).get("Code")
            if status not in (404, 403) and code not in (
                "404",
                "NoSuchBucket",
                "NotFound",
            ):
                # 403 can mean "exists but no head permission" — try create anyway
                if status != 403:
                    raise
        try:
            client.create_bucket(Bucket=bucket)
            logger.info("Created SeaweedFS bucket: %s", bucket)
        except ClientError as err:
            code = err.response.get("Error", {}).get("Code")
            # Race: another replica created it, or it already exists
            if code in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
                logger.info("SeaweedFS bucket already exists: %s", bucket)
                return
            raise

    await asyncio.to_thread(_ensure)
