"""Transactional email templates — minimal, editorial layout.

Design notes:
  - Warm paper background, white card, charcoal type (not teal wash)
  - Single forest-green accent; no emoji badges
  - Table + inline CSS for Gmail/Outlook
"""
from __future__ import annotations

from datetime import datetime
from html import escape


# Palette — calm, trustworthy, charity-adjacent
_INK = "#1c1917"  # near-black
_BODY = "#57534e"  # stone-600
_SOFT = "#a8a29e"  # stone-400
_LINE = "#e7e5e4"  # stone-200
_PAPER = "#f5f4f1"  # warm off-white
_CARD = "#ffffff"
_ACCENT = "#1b5e4a"  # deep forest green
_ACCENT_SOFT = "#e8f2ee"  # mint wash for subtle chips only


def _format_expiry(expires_at: str) -> str:
    """Make ISO timestamps human-readable; fall back to raw string."""
    raw = (expires_at or "").strip()
    if not raw:
        return ""
    try:
        normalized = raw.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        # Prefer local-looking label without forcing TZ conversion in email
        return dt.strftime("%H:%M · %d/%m/%Y")
    except ValueError:
        return raw


def _base(
    *,
    title: str,
    preheader: str,
    body_html: str,
    brand_name: str = "Charity Platform",
) -> str:
    safe_title = escape(title)
    safe_pre = escape(preheader)
    safe_brand = escape(brand_name)

    return f"""\
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>{safe_title}</title>
  <style type="text/css">
    body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
    table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }}
    body {{ margin: 0 !important; padding: 0 !important; width: 100% !important; }}
    @media only screen and (max-width: 620px) {{
      .wrap {{ width: 100% !important; }}
      .pad {{ padding-left: 24px !important; padding-right: 24px !important; }}
      .btn a {{ width: 100% !important; box-sizing: border-box !important; text-align: center !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background-color:{_PAPER};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    {safe_pre}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:{_PAPER};">
    <tr>
      <td align="center" style="padding:40px 16px 48px 16px;">
        <table role="presentation" class="wrap" width="520" cellspacing="0" cellpadding="0" border="0" style="width:520px;max-width:520px;">

          <!-- Wordmark -->
          <tr>
            <td style="padding:0 4px 20px 4px;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400;letter-spacing:0.02em;color:{_INK};">
              {safe_brand}
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:{_CARD};border:1px solid {_LINE};border-radius:4px;">
              <!-- Accent bar -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="height:3px;line-height:3px;font-size:0;background-color:{_ACCENT};border-radius:4px 4px 0 0;">&nbsp;</td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="pad" style="padding:36px 40px 40px 40px;">
                    {body_html}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 4px 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:{_SOFT};">
              <p style="margin:0 0 4px 0;">Bạn nhận email này vì có tài khoản trên {safe_brand}.</p>
              <p style="margin:0;">Nếu không phải bạn yêu cầu, có thể bỏ qua an toàn.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _btn(*, href: str, label: str) -> str:
    safe_href = escape(href, quote=True)
    safe_label = escape(label)
    return f"""\
<table role="presentation" class="btn" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px 0;">
  <tr>
    <td bgcolor="{_ACCENT}" style="background-color:{_ACCENT};border-radius:3px;">
      <a href="{safe_href}" target="_blank"
         style="display:inline-block;padding:13px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:3px;letter-spacing:0.01em;">
        {safe_label}
      </a>
    </td>
  </tr>
</table>
"""


def _h1(text: str) -> str:
    return (
        f'<h1 style="margin:0 0 16px 0;font-family:Georgia,\'Times New Roman\',serif;'
        f'font-size:26px;line-height:1.3;font-weight:400;color:{_INK};">'
        f"{escape(text)}</h1>"
    )


def _p(html: str, *, last: bool = False) -> str:
    mb = "0" if last else "14px"
    return (
        f'<p style="margin:0 0 {mb} 0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;'
        f'font-size:15px;line-height:1.65;color:{_BODY};">{html}</p>'
    )


def _meta_row(label: str, value: str) -> str:
    return (
        f'<tr>'
        f'<td style="padding:8px 0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;'
        f'font-size:13px;color:{_SOFT};width:96px;vertical-align:top;">{escape(label)}</td>'
        f'<td style="padding:8px 0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;'
        f'font-size:13px;color:{_INK};vertical-align:top;">{escape(value)}</td>'
        f"</tr>"
    )


def render_verification_email(
    *,
    verification_url: str,
    expires_at: str,
    recipient_email: str | None = None,
    brand_name: str = "Charity Platform",
) -> tuple[str, str, str]:
    subject = f"Xác minh email của bạn"
    expiry_label = _format_expiry(expires_at)
    email_line = escape(recipient_email) if recipient_email else ""

    meta_rows = ""
    if email_line:
        meta_rows += _meta_row("Email", recipient_email or "")
    if expiry_label:
        meta_rows += _meta_row("Hết hạn", expiry_label)

    meta_block = ""
    if meta_rows:
        meta_block = f"""\
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
       style="margin:24px 0 8px 0;border-top:1px solid {_LINE};border-bottom:1px solid {_LINE};">
  {meta_rows}
</table>
"""

    body = f"""\
{_h1("Xác minh địa chỉ email")}
{_p("Cảm ơn bạn đã đăng ký. Một bước nữa để kích hoạt tài khoản và sử dụng nền tảng quyên góp.")}
{_btn(href=verification_url, label="Xác minh email")}
{_p(
    f'Nếu nút không hoạt động, mở liên kết này:<br/>'
    f'<a href="{escape(verification_url, quote=True)}" '
    f'style="color:{_ACCENT};text-decoration:underline;word-break:break-all;font-size:13px;">'
    f"{escape(verification_url)}</a>",
)}
{meta_block}
{_p(
    "Nếu bạn không tạo tài khoản, hãy bỏ qua email này.",
    last=True,
)}
"""
    html = _base(
        title=subject,
        preheader="Một bước nữa để kích hoạt tài khoản của bạn.",
        body_html=body,
        brand_name=brand_name,
    )
    text = (
        f"{subject}\n\n"
        f"Xác minh email: {verification_url}\n"
        f"Hết hạn: {expiry_label or expires_at}\n\n"
        "Nếu bạn không đăng ký, hãy bỏ qua email này."
    )
    return subject, html, text


def render_verification_success_email(
    *,
    login_url: str,
    recipient_email: str | None = None,
    brand_name: str = "Charity Platform",
) -> tuple[str, str, str]:
    subject = "Tài khoản đã sẵn sàng"
    who = escape(recipient_email) if recipient_email else "bạn"

    body = f"""\
{_h1("Email đã được xác minh")}
{_p(
    f"Xin chào{(' ' + who) if recipient_email else ''}, "
    "tài khoản của bạn đã kích hoạt. Bạn có thể đăng nhập và bắt đầu sử dụng nền tảng."
)}
{_btn(href=login_url, label="Đăng nhập")}
{_p(
    "Từ đây bạn có thể tham gia hội nhóm thiện nguyện, quyên góp đồ dùng, "
    "và theo dõi hành trình món đồ trên gian hàng 0 đồng."
)}
{_p(
    f'Cần hỗ trợ? Phản hồi email này hoặc truy cập '
    f'<a href="{escape(login_url, quote=True)}" style="color:{_ACCENT};text-decoration:underline;">trang đăng nhập</a>.',
    last=True,
)}
"""
    html = _base(
        title=subject,
        preheader="Tài khoản đã kích hoạt — đăng nhập để bắt đầu.",
        body_html=body,
        brand_name=brand_name,
    )
    text = (
        f"{subject}\n\n"
        "Email của bạn đã được xác minh. Tài khoản đã sẵn sàng.\n"
        f"Đăng nhập: {login_url}\n"
    )
    return subject, html, text
