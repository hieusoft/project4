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


def _get_client():
    """S3 client pointed at the internal SeaweedFS endpoint (Docker network)."""
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            region_name=settings.seaweed_s3_region,
            endpoint_url=settings.seaweed_s3_endpoint,
            aws_access_key_id=settings.seaweed_access_key_id,
            aws_secret_access_key=settings.seaweed_secret_access_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
            ),
        )
    return _client


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
    """Local signing operation (no network call).

    Signed against the internal endpoint, then host is rewritten to the
    public endpoint so browsers can reach SeaweedFS (e.g. localhost:8333).
    """
    url = _get_client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.seaweed_bucket,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=settings.presign_expires_seconds,
    )
    internal = settings.seaweed_s3_endpoint.rstrip("/")
    public = settings.seaweed_s3_public_endpoint.rstrip("/")
    if public and public != internal and url.startswith(internal):
        url = public + url[len(internal) :]
    return url


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
