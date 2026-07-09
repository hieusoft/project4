from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import CurrentUserDep, DbConn
from app.repositories.devices import DevicesRepository

router = APIRouter(prefix="/devices", tags=["devices"])

_PLATFORMS = frozenset({"android", "ios", "web"})


class RegisterDeviceBody(BaseModel):
    fcm_token: str = Field(alias="fcmToken")
    platform: str

    model_config = {"populate_by_name": True}


class UnregisterDeviceBody(BaseModel):
    fcm_token: str = Field(alias="fcmToken")

    model_config = {"populate_by_name": True}


@router.post("/tokens")
async def register_token(body: RegisterDeviceBody, user: CurrentUserDep, conn: DbConn):
    platform = body.platform.lower().strip()
    if platform not in _PLATFORMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="platform must be android | ios | web",
        )
    token = body.fcm_token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="fcmToken is required")
    row = await DevicesRepository(conn).upsert(user.id, token, platform)
    return {
        "id": str(row["id"]),
        "user_id": str(row["user_id"]),
        "platform": row["platform"],
        "updated_at": row["updated_at"].isoformat()
        if hasattr(row["updated_at"], "isoformat")
        else row["updated_at"],
    }


@router.delete("/tokens")
async def unregister_token(
    body: UnregisterDeviceBody, user: CurrentUserDep, conn: DbConn
):
    ok = await DevicesRepository(conn).remove(user.id, body.fcm_token.strip())
    return {"removed": ok}
