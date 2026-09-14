"""Диагностика входа admin@aonk.ru."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.auth import authenticate_user, get_password_hash, verify_password
from app.db import SessionLocal
from app.db.user_models import User

EMAIL = "admin@aonk.ru"
PASSWORD = "Aonk2026!"


def main() -> None:
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"users count: {len(users)}")
        for u in users:
            print(
                f"  id={u.id} email={u.email!r} role={u.role!r} "
                f"is_active={u.is_active!r} hash_prefix={str(u.hashed_password)[:20]!r}"
            )

        admin = db.query(User).filter(User.email == EMAIL).first()
        if not admin:
            print(f"NO USER with email {EMAIL}")
            return

        ok_direct = verify_password(PASSWORD, admin.hashed_password)
        print(f"verify_password({PASSWORD!r}): {ok_direct}")

        auth = authenticate_user(db, EMAIL, PASSWORD)
        print(f"authenticate_user: {bool(auth)}")

        # rehash and test again
        admin.hashed_password = get_password_hash(PASSWORD)
        admin.role = "admin"
        admin.is_active = True
        db.commit()
        print("password reset committed")

        auth2 = authenticate_user(db, EMAIL, PASSWORD)
        print(f"authenticate_user after reset: {bool(auth2)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
