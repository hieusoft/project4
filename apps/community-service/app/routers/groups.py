"""Group + membership routes. Kong strips /api/community."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUserDep, OptionalUserDep
from app.models.enums import GroupStatus, MemberRole, MemberStatus
from app.schemas.common import DataEnvelope, Page, PageMeta
from app.schemas.groups import (
    CreateGroupRequest,
    GroupOut,
    JoinGroupRequest,
    JoinRequestOut,
    MemberOut,
    MyGroupOut,
    UpdateGroupRequest,
    UpdateMemberRoleRequest,
    UpdateMemberStatusRequest,
)
from app.services.providers import GroupServiceDep

router = APIRouter(tags=["groups"])


def _group_out(g) -> GroupOut:
    return GroupOut.model_validate(g, from_attributes=True)


@router.post(
    "/groups",
    status_code=status.HTTP_201_CREATED,
    response_model=DataEnvelope[GroupOut],
)
async def create_group(
    body: CreateGroupRequest, user: CurrentUserDep, service: GroupServiceDep
):
    g = await service.create(user, body)
    return DataEnvelope(data=_group_out(g))


@router.get("/groups", response_model=DataEnvelope[Page[GroupOut]])
async def list_groups(
    service: GroupServiceDep,
    user: OptionalUserDep,
    status_filter: GroupStatus | None = Query(default=None, alias="status"),
    province_code: str | None = None,
    q: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Public catalog of groups (default: active only). Not membership-filtered."""
    items, total = await service.list(
        status=status_filter,
        province_code=province_code,
        q=q,
        limit=limit,
        offset=offset,
        user=user,
    )
    return DataEnvelope(
        data=Page(
            items=[_group_out(g) for g in items],
            meta=PageMeta(total=total, limit=limit, offset=offset),
        )
    )


@router.get("/groups/me", response_model=DataEnvelope[Page[MyGroupOut]])
async def list_my_groups(
    service: GroupServiceDep,
    user: CurrentUserDep,
    member_status: MemberStatus | None = Query(
        default=MemberStatus.approved,
        alias="member_status",
        description="Filter by membership status; omit/null for all",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Groups the current user belongs to (joined / owns), with my_role + my_status."""
    rows, total = await service.list_mine(
        user, member_status=member_status, limit=limit, offset=offset
    )
    items = [
        MyGroupOut(
            **_group_out(g).model_dump(),
            my_role=role,
            my_status=mstatus,
        )
        for g, role, mstatus in rows
    ]
    return DataEnvelope(
        data=Page(
            items=items,
            meta=PageMeta(total=total, limit=limit, offset=offset),
        )
    )


@router.get("/groups/{group_id}", response_model=DataEnvelope[GroupOut])
async def get_group(
    group_id: uuid.UUID, service: GroupServiceDep, user: OptionalUserDep
):
    g = await service.get(group_id, user)
    return DataEnvelope(data=_group_out(g))


@router.patch("/groups/{group_id}", response_model=DataEnvelope[GroupOut])
async def update_group(
    group_id: uuid.UUID,
    body: UpdateGroupRequest,
    user: CurrentUserDep,
    service: GroupServiceDep,
):
    g = await service.update(group_id, user, body)
    return DataEnvelope(data=_group_out(g))


@router.post(
    "/admin/groups/{group_id}/approve",
    response_model=DataEnvelope[GroupOut],
)
async def approve_group(
    group_id: uuid.UUID, user: CurrentUserDep, service: GroupServiceDep
):
    g = await service.approve(group_id, user)
    return DataEnvelope(data=_group_out(g))


@router.post(
    "/admin/groups/{group_id}/suspend",
    response_model=DataEnvelope[GroupOut],
)
async def suspend_group(
    group_id: uuid.UUID, user: CurrentUserDep, service: GroupServiceDep
):
    g = await service.suspend(group_id, user)
    return DataEnvelope(data=_group_out(g))


@router.post(
    "/groups/{group_id}/join",
    status_code=status.HTTP_201_CREATED,
    response_model=DataEnvelope[JoinRequestOut],
)
async def join_group(
    group_id: uuid.UUID,
    user: CurrentUserDep,
    service: GroupServiceDep,
    body: JoinGroupRequest | None = None,
):
    req = await service.request_join(
        group_id, user, body.message if body else None
    )
    return DataEnvelope(data=JoinRequestOut.model_validate(req, from_attributes=True))


@router.get(
    "/groups/{group_id}/join-requests",
    response_model=DataEnvelope[Page[JoinRequestOut]],
)
async def list_join_requests(
    group_id: uuid.UUID,
    user: CurrentUserDep,
    service: GroupServiceDep,
    status_filter: MemberStatus | None = Query(default=MemberStatus.pending, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    items, total = await service.list_join_requests(
        group_id, user, status=status_filter, limit=limit, offset=offset
    )
    return DataEnvelope(
        data=Page(
            items=[
                JoinRequestOut.model_validate(i, from_attributes=True) for i in items
            ],
            meta=PageMeta(total=total, limit=limit, offset=offset),
        )
    )


@router.post(
    "/groups/{group_id}/join-requests/{request_id}/approve",
    response_model=DataEnvelope[JoinRequestOut],
)
async def approve_join(
    group_id: uuid.UUID,
    request_id: uuid.UUID,
    user: CurrentUserDep,
    service: GroupServiceDep,
):
    req = await service.review_join(group_id, request_id, user, approve=True)
    return DataEnvelope(data=JoinRequestOut.model_validate(req, from_attributes=True))


@router.post(
    "/groups/{group_id}/join-requests/{request_id}/reject",
    response_model=DataEnvelope[JoinRequestOut],
)
async def reject_join(
    group_id: uuid.UUID,
    request_id: uuid.UUID,
    user: CurrentUserDep,
    service: GroupServiceDep,
):
    req = await service.review_join(group_id, request_id, user, approve=False)
    return DataEnvelope(data=JoinRequestOut.model_validate(req, from_attributes=True))


@router.get(
    "/groups/{group_id}/members",
    response_model=DataEnvelope[Page[MemberOut]],
)
async def list_members(
    group_id: uuid.UUID,
    service: GroupServiceDep,
    user: OptionalUserDep,
    status_filter: MemberStatus | None = Query(
        default=MemberStatus.approved, alias="status"
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    items, total = await service.list_members(
        group_id, user, status=status_filter, limit=limit, offset=offset
    )
    return DataEnvelope(
        data=Page(
            items=[MemberOut.model_validate(i, from_attributes=True) for i in items],
            meta=PageMeta(total=total, limit=limit, offset=offset),
        )
    )


@router.put(
    "/groups/{group_id}/members/{user_id}/role",
    response_model=DataEnvelope[MemberOut],
)
async def set_member_role(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    body: UpdateMemberRoleRequest,
    user: CurrentUserDep,
    service: GroupServiceDep,
):
    m = await service.set_member_role(group_id, user_id, user, body.role)
    return DataEnvelope(data=MemberOut.model_validate(m, from_attributes=True))


@router.put(
    "/groups/{group_id}/members/{user_id}/status",
    response_model=DataEnvelope[MemberOut],
)
async def set_member_status(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    body: UpdateMemberStatusRequest,
    user: CurrentUserDep,
    service: GroupServiceDep,
):
    m = await service.set_member_status(group_id, user_id, user, body.status)
    return DataEnvelope(data=MemberOut.model_validate(m, from_attributes=True))
