# app/service/seed.py
import logging

from app.database.connection import SessionLocal
from app.database.config import settings
from app.models.users import User
from app.models.wallet import Wallet
from app.auth.utils import hash_password

logger = logging.getLogger(__name__)


def seed_default_admin() -> None:
    """
    Ensure a default admin account exists (credentials come from .env).

    Idempotent:
      - If no user has the configured email, create one with role='admin' + a wallet.
      - If the user already exists but isn't an admin, promote it.
      - If it already exists as an admin, do nothing (password is NOT reset).
    """
    email = settings.DEFAULT_ADMIN_EMAIL
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            if (existing.role or "").lower() != "admin":
                existing.role = "admin"
                db.commit()
                logger.info(f"[seed] Promoted existing user to admin: {email}")
            return

        admin = User(
            full_name=settings.DEFAULT_ADMIN_NAME,
            email=email,
            password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.flush()  # generate user_id

        db.add(Wallet(user_id=admin.user_id, balance=100000))
        db.commit()
        logger.info(f"[seed] Created default admin: {email}")
    except Exception as e:
        db.rollback()
        logger.error(f"[seed] Failed to seed default admin: {e}")
    finally:
        db.close()
