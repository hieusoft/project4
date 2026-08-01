"""Feed tong hop bai viet tu nhieu hoi nhom (GET /community/feed)."""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.repositories.posts import PostRepository


def post_row(
    *,
    group_name="Cong dong Ha Noi",
    pinned=False,
    content="Noi dung",
    my_role=None,
    my_status=None,
    is_liked=False,
    owner_id=None,
):
    now = datetime.now(timezone.utc)
    gid = uuid.uuid4()
    return {
        "id": uuid.uuid4(),
        "group_id": gid,
        "author_id": uuid.uuid4(),
        "content": content,
        "type": "normal",
        "ref_id": None,
        "status": "active",
        "is_pinned": pinned,
        "like_count": 3,
        "comment_count": 1,
        "created_at": now,
        "updated_at": now,
        "group_name": group_name,
        "group_slug": "cong-dong-ha-noi",
        "group_avatar_url": None,
        "group_owner_id": owner_id or uuid.uuid4(),
        "my_role": my_role,
        "my_status": my_status,
        "is_liked": is_liked,
    }



def image_row(post_id, *, order=0):
    return {
        "id": uuid.uuid4(),
        "post_id": post_id,
        "image_url": f"https://cdn/{order}.jpg",
        "sort_order": order,
    }


@pytest.mark.asyncio
async def test_feed_returns_posts_with_group_info():
    conn = AsyncMock()
    row = post_row()
    conn.fetchval.return_value = 1
    conn.fetch.return_value = [row]

    items, total = await PostRepository(conn).list_feed(limit=20, offset=0)

    assert total == 1
    post, group = items[0]
    assert post.content == "Noi dung"
    assert group["name"] == "Cong dong Ha Noi"
    assert group["id"] == row["group_id"]


@pytest.mark.asyncio
async def test_feed_only_active_posts_in_active_groups():
    conn = AsyncMock()
    conn.fetchval.return_value = 0
    conn.fetch.return_value = []

    await PostRepository(conn).list_feed(limit=20, offset=0)

    sql = conn.fetch.await_args.args[0]
    assert "p.status = 'active'" in sql
    assert "g.status = 'active'" in sql
    assert "JOIN groups g" in sql


@pytest.mark.asyncio
async def test_feed_orders_by_recency_not_pinned():
    """Ghim chi co y nghia trong 1 nhom; dua len feed chung se gay nhieu."""
    conn = AsyncMock()
    conn.fetchval.return_value = 0
    conn.fetch.return_value = []

    await PostRepository(conn).list_feed(limit=20, offset=0)

    sql = conn.fetch.await_args.args[0]
    assert "ORDER BY p.created_at DESC" in sql
    assert "is_pinned DESC" not in sql


@pytest.mark.asyncio
async def test_feed_filters_by_group_ids():
    conn = AsyncMock()
    conn.fetchval.return_value = 0
    conn.fetch.return_value = []
    ids = [uuid.uuid4(), uuid.uuid4()]

    await PostRepository(conn).list_feed(limit=20, offset=0, group_ids=ids)

    sql = conn.fetch.await_args.args[0]
    assert "p.group_id = ANY($1::uuid[])" in sql
    assert conn.fetch.await_args.args[1] == ids


@pytest.mark.asyncio
async def test_feed_short_circuits_on_empty_group_filter():
    """Loc theo danh sach rong -> khong can cham DB."""
    conn = AsyncMock()

    items, total = await PostRepository(conn).list_feed(
        limit=20, offset=0, group_ids=[]
    )

    assert (items, total) == ([], 0)
    conn.fetch.assert_not_awaited()
    conn.fetchval.assert_not_awaited()


@pytest.mark.asyncio
async def test_list_images_for_batches_in_one_query():
    """Chan N+1 khi dung anh cho feed."""
    conn = AsyncMock()
    ids = [uuid.uuid4() for _ in range(3)]
    conn.fetch.return_value = [image_row(ids[0]), image_row(ids[0], order=1)]

    grouped = await PostRepository(conn).list_images_for(ids)

    assert conn.fetch.await_count == 1
    assert len(grouped[ids[0]]) == 2
    assert grouped[ids[1]] == []


@pytest.mark.asyncio
async def test_list_images_for_skips_query_when_empty():
    conn = AsyncMock()

    assert await PostRepository(conn).list_images_for([]) == {}
    conn.fetch.assert_not_awaited()


@pytest.mark.asyncio
async def test_feed_route_registered_before_post_detail():
    """/feed phai dung truoc /posts/{post_id} de khong bi nuot thanh path param."""
    from app.routers import posts as module

    paths = [r.path for r in module.router.routes]
    assert "/feed" in paths


# ==========================================================================
# Trang thai thanh vien cua nguoi xem
# ==========================================================================
@pytest.mark.asyncio
async def test_feed_reports_membership_of_viewer():
    conn = AsyncMock()
    conn.fetchval.return_value = 1
    conn.fetch.return_value = [
        post_row(my_role="member", my_status="approved", is_liked=True)
    ]

    items, _ = await PostRepository(conn).list_feed(
        limit=20, offset=0, viewer_id=uuid.uuid4()
    )

    _, group = items[0]
    assert group["my_status"] == "approved"
    assert group["_is_liked"] is True


@pytest.mark.asyncio
async def test_feed_marks_non_member_when_no_membership_row():
    conn = AsyncMock()
    conn.fetchval.return_value = 1
    conn.fetch.return_value = [post_row()]

    items, _ = await PostRepository(conn).list_feed(
        limit=20, offset=0, viewer_id=uuid.uuid4()
    )

    _, group = items[0]
    assert group["my_status"] is None
    assert group["_is_liked"] is False


@pytest.mark.asyncio
async def test_feed_treats_group_owner_as_member():
    """Chu nhom co the thieu ban ghi group_members nhung van la thanh vien."""
    owner = uuid.uuid4()
    conn = AsyncMock()
    conn.fetchval.return_value = 1
    conn.fetch.return_value = [post_row(owner_id=owner)]

    items, _ = await PostRepository(conn).list_feed(
        limit=20, offset=0, viewer_id=owner
    )

    _, group = items[0]
    assert group["my_role"] == "owner"
    assert group["my_status"] == "approved"


@pytest.mark.asyncio
async def test_feed_skips_membership_join_for_anonymous():
    """Khach chua dang nhap: khong JOIN thua, luon tra false."""
    conn = AsyncMock()
    conn.fetchval.return_value = 1
    conn.fetch.return_value = [post_row()]

    items, _ = await PostRepository(conn).list_feed(limit=20, offset=0)

    sql = conn.fetch.await_args.args[0]
    assert "LEFT JOIN group_members" not in sql
    assert "LEFT JOIN post_reactions" not in sql
    _, group = items[0]
    assert group["my_status"] is None
    assert group["_is_liked"] is False


@pytest.mark.asyncio
async def test_feed_joins_membership_for_signed_in_viewer():
    conn = AsyncMock()
    conn.fetchval.return_value = 0
    conn.fetch.return_value = []
    viewer = uuid.uuid4()

    await PostRepository(conn).list_feed(limit=20, offset=0, viewer_id=viewer)

    sql = conn.fetch.await_args.args[0]
    assert "LEFT JOIN group_members" in sql
    assert "LEFT JOIN post_reactions" in sql
    assert viewer in conn.fetch.await_args.args

