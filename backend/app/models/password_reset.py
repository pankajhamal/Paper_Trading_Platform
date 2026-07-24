from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database.base import Base


class PasswordResetOTP(Base):
    """
    A one-time code emailed to a user who forgot their password.

    Security model (a 6-digit code is only ~1e6 wide, so these matter):
    - the code is stored **hashed** (never in plaintext), like a password;
    - it expires after a few minutes (`expires_at`);
    - `attempts` is capped so it can't be brute-forced before it expires;
    - `is_used` burns it after a successful reset.
    Requesting a new code invalidates the user's previous unused ones.
    """
    __tablename__ = "password_reset_otps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    otp_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, nullable=False, default=False, server_default="false")
    attempts = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
