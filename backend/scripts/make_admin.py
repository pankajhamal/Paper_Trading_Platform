"""
Promote an existing user to admin (or demote back to a normal user).

Since registration always creates users with role="user", this one-off script
is how you create your first admin.

Usage (run from the backend/ directory, with the venv active):

    python -m scripts.make_admin user@example.com            # promote to admin
    python -m scripts.make_admin user@example.com --demote    # back to "user"
"""
import argparse
import sys

from app.database.connection import SessionLocal
from app.models.users import User


def main() -> int:
    parser = argparse.ArgumentParser(description="Promote or demote a user's role.")
    parser.add_argument("email", help="Email of the user to update.")
    parser.add_argument("--demote", action="store_true", help="Set role back to 'user'.")
    args = parser.parse_args()

    new_role = "user" if args.demote else "admin"

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).first()
        if not user:
            print(f"❌ No user found with email: {args.email}")
            return 1

        user.role = new_role
        db.commit()
        print(f"✅ {args.email} is now role='{new_role}' (user_id={user.user_id}).")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
