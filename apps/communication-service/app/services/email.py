"""Brevo transactional email (+ logging fallback)."""
from __future__ import annotations

import logging

import httpx

from app.core.config import settings
from app.services.email_templates import (
    render_password_changed_email,
    render_password_reset_email,
    render_verification_email,
    render_verification_success_email,
)

logger = logging.getLogger(__name__)

_BREVO_URL = "https://api.brevo.com/v3/smtp/email"


async def send_email(*, to: str, subject: str, html: str, text: str | None = None) -> None:
    if not settings.brevo_enabled:
        logger.info("[dry-run email] to=%s subject=%s", to, subject)
        return

    payload = {
        "sender": {
            "name": settings.brevo_sender_name,
            "email": settings.brevo_sender_email,
        },
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": html,
    }
    if text:
        payload["textContent"] = text

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            _BREVO_URL,
            headers={
                "accept": "application/json",
                "content-type": "application/json",
                "api-key": settings.brevo_api_key,
            },
            json=payload,
        )
        if res.status_code >= 400:
            logger.error("Brevo error %s: %s", res.status_code, res.text)
            res.raise_for_status()
    logger.info("Brevo email sent to %s: %s", to, subject)


async def send_verification_email(
    *, email: str, code: str, expires_at: str
) -> None:
    subject, html, text = render_verification_email(
        code=code,
        expires_at=expires_at,
        recipient_email=email,
        brand_name=settings.brevo_sender_name or "Charity Platform",
    )
    await send_email(to=email, subject=subject, html=html, text=text)


async def send_verification_success_email(*, email: str) -> None:
    """Welcome email after the user successfully verifies their address."""
    login_url = f"{settings.frontend_base}/login"
    subject, html, text = render_verification_success_email(
        login_url=login_url,
        recipient_email=email,
        brand_name=settings.brevo_sender_name or "Charity Platform",
    )
    await send_email(to=email, subject=subject, html=html, text=text)


async def send_password_reset_email(
    *, email: str, code: str, expires_at: str
) -> None:
    subject, html, text = render_password_reset_email(
        code=code,
        expires_at=expires_at,
        recipient_email=email,
        brand_name=settings.brevo_sender_name or "Charity Platform",
    )
    await send_email(to=email, subject=subject, html=html, text=text)


async def send_password_changed_email(*, email: str) -> None:
    """Security notice after password was reset/changed successfully."""
    login_url = f"{settings.frontend_base}/login"
    subject, html, text = render_password_changed_email(
        login_url=login_url,
        recipient_email=email,
        brand_name=settings.brevo_sender_name or "Charity Platform",
    )
    await send_email(to=email, subject=subject, html=html, text=text)
