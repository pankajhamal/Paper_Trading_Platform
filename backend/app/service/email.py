"""
Minimal SMTP email sender.

Uses the stdlib `smtplib` (no extra dependency) and the MAIL_* settings from
`.env`. In development those point at Mailtrap's sandbox, so every message lands
in the Mailtrap inbox instead of a real one — safe for testing the OTP flow.

Route handlers here are sync (`def`), so FastAPI runs them in a threadpool;
the blocking SMTP call therefore does not stall the event loop.
"""
import smtplib
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

from app.database.config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    """
    Send one email via the configured SMTP server.

    Raises RuntimeError if SMTP credentials are not configured, and propagates
    any smtplib error so the caller can decide how to surface the failure.
    """
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        raise RuntimeError(
            "SMTP is not configured. Set MAIL_USERNAME and MAIL_PASSWORD in .env "
            "(get them from your Mailtrap sandbox inbox)."
        )

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = formataddr((settings.MAIL_FROM_NAME, settings.MAIL_FROM))
    message["To"] = to_email

    if text_body:
        message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.MAIL_HOST, settings.MAIL_PORT, timeout=15) as server:
        if settings.MAIL_STARTTLS:
            server.starttls(context=ssl.create_default_context())
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.sendmail(settings.MAIL_FROM, [to_email], message.as_string())

    logger.info("Sent '%s' email to %s", subject, to_email)


def send_password_reset_otp(to_email: str, full_name: str | None, otp: str) -> None:
    """Send the password-reset one-time code email."""
    name = (full_name or "there").split(" ")[0]
    minutes = settings.OTP_EXPIRY_MINUTES

    subject = "Your password reset code"
    text_body = (
        f"Hi {name},\n\n"
        f"Your password reset code is: {otp}\n\n"
        f"It expires in {minutes} minutes. If you didn't request this, you can "
        f"safely ignore this email — your password won't change.\n\n"
        f"— {settings.MAIL_FROM_NAME}"
    )
    html_body = f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Reset your password</h2>
  <p style="margin:0 0 20px;font-size:14px;color:#64748b">Hi {name}, use the code below to reset your password.</p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px">
    <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#059669;font-variant-numeric:tabular-nums">{otp}</div>
  </div>
  <p style="margin:0 0 8px;font-size:13px;color:#64748b">This code expires in <strong>{minutes} minutes</strong>.</p>
  <p style="margin:0;font-size:13px;color:#94a3b8">If you didn't request this, ignore this email — your password won't change.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
  <p style="margin:0;font-size:12px;color:#94a3b8">{settings.MAIL_FROM_NAME}</p>
</div>"""

    send_email(to_email, subject, html_body, text_body)
