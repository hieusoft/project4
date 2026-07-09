"""FastAPI dependency providers that assemble repositories + services.

Each provider builds its object graph from the request-scoped asyncpg
connection (DbConn) so all DB work in a request shares one transaction. The
event publisher is the process-wide singleton wired in the app lifespan.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.core.deps import DbConn
from app.events.publisher import publisher
from app.repositories.account import AccountRepository
from app.repositories.activity import ActivityRepository
from app.repositories.otp import OtpRepository
from app.repositories.profile import ProfileRepository
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.role import RoleRepository
from app.services.account_service import AccountService
from app.services.auth_service import AuthService
from app.services.profile_service import ProfileService
from app.services.token_service import TokenService
from app.services.two_factor_service import TwoFactorService


def get_auth_service(conn: DbConn) -> AuthService:
    refresh_tokens = RefreshTokenRepository(conn)
    roles = RoleRepository(conn)
    return AuthService(
        accounts=AccountRepository(conn),
        roles=roles,
        otps=OtpRepository(conn),
        profiles=ProfileRepository(conn),
        activity=ActivityRepository(conn),
        refresh_tokens=refresh_tokens,
        tokens=TokenService(refresh_tokens, roles),
        publisher=publisher,
    )


def get_two_factor_service(conn: DbConn) -> TwoFactorService:
    return TwoFactorService(AccountRepository(conn))


def get_profile_service(conn: DbConn) -> ProfileService:
    return ProfileService(ProfileRepository(conn), ActivityRepository(conn))


def get_account_service(conn: DbConn) -> AccountService:
    return AccountService(AccountRepository(conn), RefreshTokenRepository(conn))


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
TwoFactorServiceDep = Annotated[TwoFactorService, Depends(get_two_factor_service)]
ProfileServiceDep = Annotated[ProfileService, Depends(get_profile_service)]
AccountServiceDep = Annotated[AccountService, Depends(get_account_service)]
