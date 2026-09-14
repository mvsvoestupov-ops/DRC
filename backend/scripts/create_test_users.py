import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.db.user_models import User
from app.auth import get_password_hash

# Данные для тестовых пользователей
test_users = [
    ("stol1@mail.ru", "pass1"),
    ("stol2@mail.ru", "pass2"),
    ("stol3@mail.ru", "pass3"),
    ("stol4@mail.ru", "pass4"),
    ("stol5@mail.ru", "pass5"),
    ("stol6@mail.ru", "pass6"),
    ("stol7@mail.ru", "pass7"),
]

OLD_ADMIN_EMAIL = "admin@admin.ru"
admin_email = "admin@aonk.ru"
admin_password = "Aonk2026!"


def create_users():
    db = SessionLocal()
    try:
        for email, password in test_users:
            existing = db.query(User).filter(User.email == email).first()
            if not existing:
                new_user = User(
                    email=email,
                    hashed_password=get_password_hash(password),
                    role="user",
                )
                db.add(new_user)
                print(f"Создан пользователь: {email}")
            else:
                print(f"Пользователь {email} уже существует")

        existing_admin = db.query(User).filter(User.email == admin_email).first()
        old_admin = db.query(User).filter(User.email == OLD_ADMIN_EMAIL).first()

        if existing_admin:
            existing_admin.hashed_password = get_password_hash(admin_password)
            existing_admin.role = "admin"
            print(f"Обновлён пароль администратора: {admin_email}")
            if old_admin and old_admin.id != existing_admin.id:
                db.delete(old_admin)
                print(f"Удалён старый администратор: {OLD_ADMIN_EMAIL}")
        elif old_admin:
            old_admin.email = admin_email
            old_admin.hashed_password = get_password_hash(admin_password)
            old_admin.role = "admin"
            print(f"Администратор переименован: {OLD_ADMIN_EMAIL} → {admin_email}")
        else:
            db.add(
                User(
                    email=admin_email,
                    hashed_password=get_password_hash(admin_password),
                    role="admin",
                )
            )
            print(f"Создан администратор: {admin_email}")

        db.commit()
        print("Готово.")
    except Exception as e:
        db.rollback()
        print(f"Ошибка при создании пользователей: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_users()
