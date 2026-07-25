import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.models.domain import Account, RefreshToken, OtpCode
from app.models.enums import AccountStatus, OtpPurpose
from app.schemas.auth import RegisterRequest
from app.services.auth_service import AuthService


@pytest.fixture
def mock_deps(mocker):
    return {
        "accounts": AsyncMock(),
        "roles": AsyncMock(),
        "otps": AsyncMock(),
        "profiles": AsyncMock(),
        "activity": AsyncMock(),
        "refresh_tokens": AsyncMock(),
        "tokens": AsyncMock(),
        "publisher": AsyncMock(),
    }


@pytest.fixture
def auth_service(mock_deps):
    return AuthService(**mock_deps)


@pytest.mark.asyncio
async def test_register_auto_generates_username(auth_service, mock_deps):
    mock_deps["accounts"].get_by_email.return_value = None
    mock_deps["accounts"].get_by_phone.return_value = None
    mock_deps["accounts"].get_by_username.return_value = None
    
    mock_account = Account(
        id=uuid.uuid4(),
        username="test_username",
        email="test@example.com",
        phone=None,
        password_hash="hash",
        status=AccountStatus.unverified,
        email_verified=False,
        totp_enabled=False,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    mock_deps["accounts"].create.return_value = mock_account

    req = RegisterRequest(
        email="john.doe@example.com",
        password="Password123!",
        full_name="John Doe"
    )
    
    # Assert username is initially None
    assert req.username is None
    
    await auth_service.register(req)
    
    # Assert username was auto-generated
    assert req.username is not None
    assert req.username.startswith("johndoe_")
    assert len(req.username) > 8


@pytest.mark.asyncio
async def test_refresh_token_locked_account(auth_service, mock_deps):
    # Mock existing token
    mock_token = RefreshToken(
        id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        token_hash="hash",
        device_info=None,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        revoked_at=None,
        created_at=datetime.now(timezone.utc),
    )
    mock_deps["refresh_tokens"].get_by_hash.return_value = mock_token

    # Mock locked account
    mock_account = Account(
        id=mock_token.account_id,
        username="test_user",
        email="test@example.com",
        password_hash="hash",
        status=AccountStatus.locked,
        email_verified=True,
        totp_enabled=False,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    mock_deps["accounts"].get_by_id.return_value = mock_account

    with pytest.raises(HTTPException) as exc:
        await auth_service.refresh(raw_refresh_token="some_token", device_info=None)
    
    assert exc.value.status_code == 403
    assert "Account is locked" in exc.value.detail
    mock_deps["refresh_tokens"].revoke_all_for_account.assert_called_once_with(mock_account.id)


@pytest.mark.asyncio
async def test_verify_email_locked_account(auth_service, mock_deps):
    # Mock locked account
    mock_account = Account(
        id=uuid.uuid4(),
        username="test_user",
        email="test@example.com",
        password_hash="hash",
        status=AccountStatus.locked,
        email_verified=False,
        totp_enabled=False,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    mock_deps["accounts"].get_by_email.return_value = mock_account

    with pytest.raises(HTTPException) as exc:
        await auth_service.verify_email(email="test@example.com", code="123456")
    
    assert exc.value.status_code == 403
    assert "Account is locked" in exc.value.detail


@pytest.mark.asyncio
async def test_otp_cooldown(auth_service, mock_deps):
    # Mock active OTP created just now
    mock_account = Account(
        id=uuid.uuid4(),
        username="test",
        password_hash="hash",
        status=AccountStatus.active,
        email_verified=True,
        totp_enabled=False,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    mock_deps["accounts"].get_by_email.return_value = mock_account
    
    mock_otp = OtpCode(
        id=uuid.uuid4(),
        account_id=mock_account.id,
        code_hash="hash",
        purpose=OtpPurpose.reset_password,
        attempts=0,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        created_at=datetime.now(timezone.utc), # Created exactly now
    )
    mock_deps["otps"].get_active_for_account.return_value = mock_otp

    # Attempt to request forgot password again
    with pytest.raises(HTTPException) as exc:
        await auth_service.forgot_password(email="test@example.com")
    
    assert exc.value.status_code == 429
    assert "wait 60 seconds" in exc.value.detail
