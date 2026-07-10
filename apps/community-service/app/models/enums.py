"""DB enums for community_db."""
from __future__ import annotations

from enum import Enum


class GroupStatus(str, Enum):
    pending = "pending"
    active = "active"
    suspended = "suspended"
    closed = "closed"


class MemberRole(str, Enum):
    owner = "owner"
    moderator = "moderator"
    member = "member"


class MemberStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    left = "left"
    banned = "banned"


class PostType(str, Enum):
    normal = "normal"
    call_for_donation = "call_for_donation"
    thank_you = "thank_you"
    announcement = "announcement"


class ContentStatus(str, Enum):
    active = "active"
    pending_review = "pending_review"
    hidden = "hidden"
    blocked = "blocked"
