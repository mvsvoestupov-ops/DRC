import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
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

admin_email = "admin@admin.ru"
admin_password = "Aonk2019!"

def create_users():
    db = SessionLocal()
    try:
        # Создаём тестовых пользователей
        for email, password in test_users:
            existing = db.query(User).filter(User.email == email).first()
            if not existing:
                new_user = User(
                    email=email,
                    hashed_password=get_password_hash(password),
                    role="user"
                )
                db.add(new_user)
                print(f"Создан пользователь: {email}")
            else:
                print(f"Пользователь {email} уже существует")

        # Создаём администратора
        existing_admin = db.query(User).filter(User.email == admin_email).first()
        if not existing_admin:
            new_admin = User(
                email=admin_email,
                hashed_password=get_password_hash(admin_password),
                role="admin"
            )
            db.add(new_admin)
            print(f"Создан администратор: {admin_email}")
        else:
            print(f"Администратор {admin_email} уже существует")

        db.commit()
        print("Все пользователи успешно созданы (или уже существовали).")
    except Exception as e:
        db.rollback()
        print(f"Ошибка при создании пользователей: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_users()