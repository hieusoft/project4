"""Brevo transactional email (+ logging fallback)."""
from __future__ import annotations

import logging

import httpx

from app.core.config import settings

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
    *, email: str, verification_url: str, expires_at: str
) -> None:
    await send_email(
        to=email,
        subject="Xác minh email — Charity Platform",
        html=(
            f"<p>Xin chào,</p>"
            f"<p>Vui lòng xác minh email:</p>"
            f'<p><a href="{verification_url}">{verification_url}</a></p>'
            f"<p>Hết hạn: {expires_at}</p>"
        ),
        text=f"Xác minh email: {verification_url} (hết hạn {expires_at})",
    )


async def send_password_reset_email(
    *, email: str, reset_url: str, expires_at: str
) -> None:
    await send_email(
        to=email,
        subject="Đặt lại mật khẩu — Charity Platform",
        html=(
            f"<p>Xin chào,</p>"
            f"<p>Đặt lại mật khẩu:</p>"
            f'<p><a href="{reset_url}">{reset_url}</a></p>'
            f"<p>Hết hạn: {expires_at}</p>"
        ),
        text=f"Đặt lại mật khẩu: {reset_url} (hết hạn {expires_at})",
    )
