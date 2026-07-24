"""
Forgot-password flow (OTP over email).

Three endpoints, all under the `/auth` prefix:
  POST /auth/forgot-password  — email a one-time code to the account
  POST /auth/verify-otp       — check a code is valid (does NOT consume it)
  POST /auth/reset-password    — submit code + new password to change it

Security notes:
- The code is stored hashed (see PasswordResetOTP) and never returned to the client.
- forgot-password always responds the same way whether or not the email exists,
  so the endpoint can't be used to enumerate registered accounts. (A genuine SMTP
  misconfiguration still surfaces a 5xx so it's caught during setup.)
- Wrong guesses are counted and the code is burned after OTP_MAX_ATTEMPTS or on expiry.
"""
import logging
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.config import settings
from app.models.users import User
from app.models.password_reset import PasswordResetOTP
from app.auth.utils import hash_password, verify_password
from app.schemas.PasswordReset import (
    ForgotPasswordRequest,
    VerifyOTPRequest,
    ResetPasswordRequest,
)
from app.service.email import send_password_reset_otp

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

# Same generic message for every forgot-password outcome (see module docstring).
_GENERIC_SENT_MSG = (
    "If an account exists for that email, a reset code has been sent to it."
)


def _generate_otp(length: int) -> str:
    """A zero-padded numeric code of the configured length (cryptographically random)."""
    return "".join(secrets.choice("0123456789") for _ in range(length))


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Generate a fresh OTP for the account and email it. Response is intentionally
    generic so callers can't tell whether the email is registered."""
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    # Don't leak whether the account exists (or is disabled) — respond generically.
    if not user or getattr(user, "is_active", True) is False:
        return {"message": _GENERIC_SENT_MSG}

    otp = _generate_otp(settings.OTP_LENGTH)

    try:
        # Invalidate the user's previous unused codes so only the newest works.
        db.query(PasswordResetOTP).filter(
            PasswordResetOTP.user_id == user.user_id,
            PasswordResetOTP.is_used.is_(False),
        ).update({PasswordResetOTP.is_used: True}, synchronize_session=False)

        record = PasswordResetOTP(
            user_id=user.user_id,
            otp_hash=hash_password(otp),
            expires_at=datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
            is_used=False,
            attempts=0,
            created_at=datetime.utcnow(),
        )
        db.add(record)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Failed to create reset OTP for %s: %s", email, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not start the password reset. Please try again.",
        )

    # Send the email. A failure here is a server/config problem, not a user error;
    # burn the just-created code so a stale unusable one isn't left behind.
    try:
        send_password_reset_otp(user.email, user.full_name, otp)
    except RuntimeError as e:
        # SMTP not configured — a developer setup issue; make it obvious.
        record.is_used = True
        db.commit()
        logger.error("SMTP not configured: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is not configured. Please contact the administrator.",
        )
    except Exception as e:
        record.is_used = True
        db.commit()
        logger.error("Failed to send reset email to %s: %s", email, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not send the reset email. Please try again later.",
        )

    return {"message": _GENERIC_SENT_MSG}


def _get_active_otp(user: User, otp: str, db: Session, *, consume: bool):
    """
    Resolve and validate the user's current reset code against `otp`.

    Shared by verify-otp and reset-password. Increments the attempt counter on a
    wrong guess, burns the code when attempts are exhausted or it has expired, and
    (when `consume=True`) marks it used on success. Raises HTTPException(400) on
    any failure; returns the validated record on success.
    """
    record = (
        db.query(PasswordResetOTP)
        .filter(
            PasswordResetOTP.user_id == user.user_id,
            PasswordResetOTP.is_used.is_(False),
        )
        .order_by(PasswordResetOTP.created_at.desc())
        .first()
    )

    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired code. Please request a new one.",
    )

    if not record:
        raise invalid

    if record.expires_at < datetime.utcnow():
        record.is_used = True
        db.commit()
        raise invalid

    if record.attempts >= settings.OTP_MAX_ATTEMPTS:
        record.is_used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many incorrect attempts. Please request a new code.",
        )

    if not verify_password(otp.strip(), record.otp_hash):
        record.attempts += 1
        remaining = max(settings.OTP_MAX_ATTEMPTS - record.attempts, 0)
        # Burn the code if that was the last allowed attempt.
        if remaining == 0:
            record.is_used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Incorrect code. Please request a new one."
                if remaining == 0
                else f"Incorrect code. {remaining} attempt(s) remaining."
            ),
        )

    if consume:
        record.is_used = True
        db.commit()

    return record


@router.post("/verify-otp")
def verify_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    """Pre-check a code before showing the new-password form. Does not consume it —
    the same code is submitted again to /auth/reset-password."""
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Match the reset-path error so verify vs reset can't be used to enumerate.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired code. Please request a new one.",
        )

    _get_active_otp(user, payload.otp, db, consume=False)
    return {"message": "Code verified.", "valid": True}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Verify the code and set the new password, consuming the code on success."""
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired code. Please request a new one.",
        )

    # Validates and consumes (marks used) the code, or raises 400.
    _get_active_otp(user, payload.otp, db, consume=True)

    try:
        user.password = hash_password(payload.new_password)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Failed to reset password for %s: %s", email, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password. Please try again.",
        )

    return {"message": "Password reset successfully. You can now log in."}
