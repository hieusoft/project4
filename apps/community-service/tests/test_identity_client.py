"""Nap ten/avatar tac gia cho feed qua identity-service."""
import uuid
from unittest.mock import AsyncMock

import httpx
import pytest

from app.clients.identity import IdentityClient


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.text = str(payload)

    def json(self):
        return self._payload


class FakeClient:
    """Thay cho httpx.AsyncClient trong `async with`."""

    def __init__(self, responses=None, raises=None):
        self._responses = list(responses or [])
        self._raises = raises
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, url, params=None):
        self.calls.append((url, params))
        if self._raises:
            raise self._raises
        return self._responses.pop(0)


def patch_httpx(monkeypatch, fake):
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    return fake


@pytest.mark.asyncio
async def test_returns_profiles_keyed_by_id(monkeypatch):
    uid = uuid.uuid4()
    fake = patch_httpx(
        monkeypatch,
        FakeClient([
            FakeResponse({
                "data": [
                    {
                        "id": str(uid),
                        "full_name": "Nguyen Van An",
                        "username": "nguyenvanan",
                        "avatar_url": "https://cdn/a.jpg",
                    }
                ]
            })
        ]),
    )

    result = await IdentityClient("http://identity:3001").get_profiles([uid])

    assert result[str(uid)]["full_name"] == "Nguyen Van An"
    assert fake.calls[0][0] == "http://identity:3001/profile/batch"


@pytest.mark.asyncio
async def test_deduplicates_author_ids(monkeypatch):
    """Nhieu bai cung tac gia chi hoi identity mot lan."""
    uid = uuid.uuid4()
    fake = patch_httpx(
        monkeypatch,
        FakeClient([FakeResponse({"data": [{"id": str(uid)}]})]),
    )

    await IdentityClient().get_profiles([uid, uid, uid])

    ids = fake.calls[0][1]["ids"].split(",")
    assert ids == [str(uid)]


@pytest.mark.asyncio
async def test_splits_into_batches(monkeypatch):
    """URL khong duoc phinh to khi feed co nhieu tac gia."""
    ids = [uuid.uuid4() for _ in range(120)]
    fake = patch_httpx(
        monkeypatch,
        FakeClient([FakeResponse({"data": []}) for _ in range(3)]),
    )

    await IdentityClient().get_profiles(ids)

    assert len(fake.calls) == 3
    for _, params in fake.calls:
        assert len(params["ids"].split(",")) <= 50


@pytest.mark.asyncio
async def test_empty_input_skips_request(monkeypatch):
    fake = patch_httpx(monkeypatch, FakeClient())

    assert await IdentityClient().get_profiles([]) == {}
    assert fake.calls == []


@pytest.mark.asyncio
async def test_network_error_returns_empty_map(monkeypatch):
    """Identity chet thi feed van hien bai, chi thieu ten tac gia."""
    patch_httpx(
        monkeypatch,
        FakeClient(raises=httpx.ConnectError("refused")),
    )

    assert await IdentityClient().get_profiles([uuid.uuid4()]) == {}


@pytest.mark.asyncio
async def test_error_status_is_skipped(monkeypatch):
    patch_httpx(
        monkeypatch,
        FakeClient([FakeResponse({"error": "boom"}, status_code=500)]),
    )

    assert await IdentityClient().get_profiles([uuid.uuid4()]) == {}


@pytest.mark.asyncio
async def test_ignores_malformed_entries(monkeypatch):
    uid = uuid.uuid4()
    patch_httpx(
        monkeypatch,
        FakeClient([
            FakeResponse({
                "data": [
                    "khong phai dict",
                    {"full_name": "Thieu id"},
                    {"id": str(uid), "full_name": "Hop le"},
                ]
            })
        ]),
    )

    result = await IdentityClient().get_profiles([uid])

    assert list(result) == [str(uid)]
