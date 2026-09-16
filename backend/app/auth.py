from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader
import os
import secrets
from sqlalchemy.orm import Session
from sqlalchemy import func

from .db import SessionLocal
from .db.user_models import User

UNCONFIRMED_EMAIL_DETAIL = "Подтвердите адрес электронной почты по ссылке из письма"

SECRET_KEY = "your-secret-key-here"  # В продакшене использовать переменную окружения
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 дней

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
DRC_API_KEY = os.getenv("DRC_API_KEY", "")


def _password_bytes(password: str) -> bytes:
    """bcrypt принимает не более 72 байт."""
    return password.encode("utf-8")[:72]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            _password_bytes(plain_password),
            hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password,
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("utf-8")


def generate_user_password(length: int = 12) -> str:
    alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(c.islower() for c in password)
            and any(c.isupper() for c in password)
            and any(c.isdigit() for c in password)
        ):
            return password


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    email = (email or "").strip().lower()
    if not email:
        return None
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user
    return db.query(User).filter(func.lower(User.email) == email).first()


def user_if_password_ok(db: Session, email: str, password: str):
    password = (password or "").strip()
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user


def authenticate_user(db: Session, email: str, password: str):
    user = user_if_password_ok(db, email, password)
    if not user:
        return False
    # SQLite может отдавать 0/1 вместо False/True
    if user.is_active in (False, 0, "0", "false", "False"):
        return False
    if not is_email_confirmed(user):
        return False
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_token_claim(token: str, claim: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get(claim)
    except JWTError:
        return None


def is_user_active(user: User) -> bool:
    return user.is_active not in (False, 0, "0", "false", "False")


def is_email_confirmed(user: User) -> bool:
    value = getattr(user, "email_confirmed", True)
    return value not in (False, 0, "0", "false", "False")


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        impersonated = bool(payload.get("imp"))
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
    finally:
        db.close()
    if user is None:
        raise credentials_exception
    if not is_user_active(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    if not impersonated and not is_email_confirmed(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=UNCONFIRMED_EMAIL_DETAIL)
    return user


async def get_current_admin(current_user: User = Depends(get_current_user)):
    if (current_user.role or "") != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


def is_staff_role(user) -> bool:
    return (getattr(user, "role", None) or "") in ("admin", "expert")


async def get_current_expert(current_user: User = Depends(get_current_user)):
    if not is_staff_role(current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


async def get_current_user_or_api_key(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """JWT пользователя или машинный X-API-Key для сервиса Планов."""
    if DRC_API_KEY and x_api_key and x_api_key == DRC_API_KEY:
        class ServicePrincipal:
            id = 0
            email = "plans-service"
            role = "user"
            is_active = True
        return ServicePrincipal()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    return await get_current_user(token)
