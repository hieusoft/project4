from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.core.deps import DbConn
from app.events.publisher import publisher
from app.services.groups import GroupService
from app.services.posts import PostService


def get_group_service(conn: DbConn) -> GroupService:
    return GroupService(conn=conn, publisher=publisher)


def get_post_service(conn: DbConn) -> PostService:
    return PostService(conn=conn, publisher=publisher)


GroupServiceDep = Annotated[GroupService, Depends(get_group_service)]
PostServiceDep = Annotated[PostService, Depends(get_post_service)]
