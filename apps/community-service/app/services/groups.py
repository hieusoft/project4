"""Group / membership business logic."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import asyncpg
from fastapi import HTTPException, status

from app.core.deps import CurrentUser, require_group_moderator, require_group_owner
from app.events import event_names
from app.events.contracts import (
    GroupApprovedEvent,
    GroupCreatedEvent,
    GroupJoinRequestedEvent,
    GroupMemberApprovedEvent,
)
from app.events.publisher import EventPublisher
from app.models.domain import Group, GroupMember, JoinRequest
from app.models.enums import GroupStatus, MemberRole, MemberStatus
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.schemas.groups import CreateGroupRequest, UpdateGroupRequest


class GroupService:
    def __init__(
        self,
        *,
        conn: asyncpg.Connection,
        publisher: EventPublisher,
    ) -> None:
        self._conn = conn
        self._groups = GroupRepository(conn)
        self._members = MemberRepository(conn)
        self._publisher = publisher

    async def create(self, user: CurrentUser, data: CreateGroupRequest) -> Group:
        group = await self._groups.create(
            name=data.name,
            owner_id=user.uuid,
            description=data.description,
            avatar_url=data.avatar_url,
            cover_url=data.cover_url,
            address=data.address,
            province_code=data.province_code,
            district_code=data.district_code,
            allow_member_post=data.allow_member_post,
            require_post_review=data.require_post_review,
        )
        await self._members.add(
            group_id=group.id,
            user_id=user.uuid,
            role=MemberRole.owner,
            status=MemberStatus.approved,
            joined_at=datetime.now(timezone.utc),
        )
        await self._publisher.publish(
            event_names.GROUP_CREATED,
            GroupCreatedEvent(
                groupId=str(group.id),
                ownerId=str(user.uuid),
                name=group.name,
            ),
        )
        return group

    async def get(self, group_id: uuid.UUID, user: CurrentUser | None) -> Group:
        group = await self._groups.get(group_id)
        if group is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
        if group.status != GroupStatus.active:
            if user is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
            if not user.is_admin and group.owner_id != user.uuid:
                m = await self._members.get(group_id, user.uuid)
                if m is None or m.status != MemberStatus.approved:
                    raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
        return group

    async def list(
        self,
        *,
        status: GroupStatus | None,
        province_code: str | None,
        q: str | None,
        limit: int,
        offset: int,
        user: CurrentUser | None,
    ) -> tuple[list[Group], int]:
        if status is None and (user is None or not user.is_admin):
            status = GroupStatus.active
        return await self._groups.list(
            status=status,
            province_code=province_code,
            q=q,
            limit=limit,
            offset=offset,
        )

    async def list_mine(
        self,
        user: CurrentUser,
        *,
        member_status: MemberStatus | None,
        limit: int,
        offset: int,
    ) -> tuple[list[tuple[Group, MemberRole, MemberStatus]], int]:
        """Groups the current user has joined (default: approved membership)."""
        rows, total = await self._groups.list_for_user(
            user.uuid,
            member_status=member_status,
            limit=limit,
            offset=offset,
        )
        out: list[tuple[Group, MemberRole, MemberStatus]] = []
        for group, role, mstatus in rows:
            out.append((group, MemberRole(role), MemberStatus(mstatus)))
        return out, total

    async def update(
        self, group_id: uuid.UUID, user: CurrentUser, data: UpdateGroupRequest
    ) -> Group:
        await self._require_group(group_id)
        await require_group_moderator(self._conn, group_id=group_id, user=user)
        fields = data.model_dump(exclude_unset=True)
        updated = await self._groups.update(group_id, fields)
        assert updated is not None
        return updated

    async def approve(self, group_id: uuid.UUID, user: CurrentUser) -> Group:
        if not user.is_admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin required")
        group = await self._require_group(group_id)
        if group.status == GroupStatus.active:
            return group
        updated = await self._groups.update(group_id, {"status": GroupStatus.active})
        assert updated is not None
        await self._publisher.publish(
            event_names.GROUP_APPROVED,
            GroupApprovedEvent(
                groupId=str(updated.id),
                ownerId=str(updated.owner_id),
                name=updated.name,
            ),
        )
        return updated

    async def suspend(self, group_id: uuid.UUID, user: CurrentUser) -> Group:
        if not user.is_admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin required")
        await self._require_group(group_id)
        updated = await self._groups.update(
            group_id, {"status": GroupStatus.suspended}
        )
        assert updated is not None
        return updated

    async def request_join(
        self, group_id: uuid.UUID, user: CurrentUser, message: str | None
    ) -> JoinRequest:
        group = await self._require_group(group_id)
        if group.status != GroupStatus.active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Group is not active")
        existing = await self._members.get(group_id, user.uuid)
        if existing and existing.status == MemberStatus.approved:
            raise HTTPException(status.HTTP_409_CONFLICT, "Already a member")
        if existing and existing.status == MemberStatus.banned:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "You are banned from this group"
            )
        try:
            req = await self._members.create_join_request(
                group_id=group_id, user_id=user.uuid, message=message
            )
        except Exception as exc:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Join request already pending"
            ) from exc
        notify = await self._members.list_moderator_user_ids(group_id)
        await self._publisher.publish(
            event_names.GROUP_JOIN_REQUESTED,
            GroupJoinRequestedEvent(
                groupId=str(group_id),
                userId=str(user.uuid),
                notifyUserIds=notify,
            ),
        )
        return req

    async def list_join_requests(
        self,
        group_id: uuid.UUID,
        user: CurrentUser,
        *,
        status: MemberStatus | None,
        limit: int,
        offset: int,
    ) -> tuple[list[JoinRequest], int]:
        await self._require_group(group_id)
        await require_group_moderator(self._conn, group_id=group_id, user=user)
        return await self._members.list_join_requests(
            group_id, status=status, limit=limit, offset=offset
        )

    async def review_join(
        self,
        group_id: uuid.UUID,
        request_id: uuid.UUID,
        user: CurrentUser,
        *,
        approve: bool,
    ) -> JoinRequest:
        await self._require_group(group_id)
        await require_group_moderator(self._conn, group_id=group_id, user=user)
        req = await self._members.get_join_request(request_id)
        if req is None or req.group_id != group_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Join request not found")
        new_status = MemberStatus.approved if approve else MemberStatus.rejected
        reviewed = await self._members.review_join_request(
            request_id, status=new_status, reviewed_by=user.uuid
        )
        if reviewed is None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Request already reviewed")
        if approve:
            await self._members.add(
                group_id=group_id,
                user_id=req.user_id,
                role=MemberRole.member,
                status=MemberStatus.approved,
                joined_at=datetime.now(timezone.utc),
            )
            await self._groups.bump_member_count(group_id, 1)
            await self._publisher.publish(
                event_names.GROUP_MEMBER_APPROVED,
                GroupMemberApprovedEvent(
                    groupId=str(group_id), userId=str(req.user_id)
                ),
            )
        return reviewed

    async def list_members(
        self,
        group_id: uuid.UUID,
        user: CurrentUser | None,
        *,
        status: MemberStatus | None,
        limit: int,
        offset: int,
    ) -> tuple[list[GroupMember], int]:
        await self.get(group_id, user)
        return await self._members.list_for_group(
            group_id, status=status, limit=limit, offset=offset
        )

    async def set_member_role(
        self,
        group_id: uuid.UUID,
        target_user_id: uuid.UUID,
        user: CurrentUser,
        role: MemberRole,
    ) -> GroupMember:
        group = await self._require_group(group_id)
        await require_group_owner(self._conn, group_id=group_id, user=user)
        if role == MemberRole.owner:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Cannot assign owner role this way"
            )
        if target_user_id == group.owner_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Cannot change owner role"
            )
        updated = await self._members.set_role(group_id, target_user_id, role)
        if updated is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
        return updated

    async def set_member_status(
        self,
        group_id: uuid.UUID,
        target_user_id: uuid.UUID,
        user: CurrentUser,
        new_status: MemberStatus,
    ) -> GroupMember:
        group = await self._require_group(group_id)
        await require_group_moderator(self._conn, group_id=group_id, user=user)
        if target_user_id == group.owner_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Cannot change owner status"
            )
        if new_status not in (
            MemberStatus.banned,
            MemberStatus.left,
            MemberStatus.approved,
        ):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid status")
        before = await self._members.get(group_id, target_user_id)
        updated = await self._members.set_status(group_id, target_user_id, new_status)
        if updated is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
        if (
            before
            and before.status == MemberStatus.approved
            and new_status != MemberStatus.approved
        ):
            await self._groups.bump_member_count(group_id, -1)
        if (
            before
            and before.status != MemberStatus.approved
            and new_status == MemberStatus.approved
        ):
            await self._groups.bump_member_count(group_id, 1)
        return updated

    async def _require_group(self, group_id: uuid.UUID) -> Group:
        group = await self._groups.get(group_id)
        if group is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
        return group
