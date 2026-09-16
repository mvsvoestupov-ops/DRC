"""Отправка писем через SMTP Яндекса."""
from __future__ import annotations

import hashlib
import html
import os
import secrets
import smtplib
import socket
import ssl
import time
from datetime import datetime, timedelta
from email.message import EmailMessage
from pathlib import Path

CONFIRM_TTL_DAYS = 14
RESET_TTL_HOURS = 2
REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file(BACKEND_DIR / ".env")
_load_env_file(REPO_ROOT / ".env")


def _read_password_file() -> tuple[str, str]:
    path = REPO_ROOT / "PassForDRC_mail.txt"
    if not path.is_file():
        return "", ""
    try:
        lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    except OSError:
        return "", ""
    if not lines:
        return "", ""
    if len(lines) == 1:
        return "", lines[0]
    if "@" in lines[0]:
        return lines[0], lines[1]
    return "", lines[0]


def smtp_settings() -> dict:
    file_user, file_password = _read_password_file()
    user = (os.getenv("SMTP_USER") or file_user or "ao-nkv@yandex.ru").strip()
    password = (os.getenv("SMTP_PASSWORD") or file_password).strip()
    host = (os.getenv("SMTP_HOST") or "smtp.yandex.ru").strip()
    port = int(os.getenv("SMTP_PORT") or "465")
    sender = (os.getenv("SMTP_FROM") or user).strip()
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "sender": sender,
        "from_name": os.getenv("SMTP_FROM_NAME") or "Цифровой реестр компетенций",
    }


def frontend_base_url(request=None) -> str:
    configured = (os.getenv("PUBLIC_APP_URL") or os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
    if configured:
        return configured
    if request is not None:
        origin = (request.headers.get("origin") or "").strip().rstrip("/")
        if origin:
            return origin
        referer = (request.headers.get("referer") or "").strip()
        if referer:
            from urllib.parse import urlparse

            parsed = urlparse(referer)
            if parsed.scheme and parsed.netloc:
                return f"{parsed.scheme}://{parsed.netloc}"
    return "https://drc.ao-nk.online"


def hash_confirm_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_confirm_token(user) -> str:
    raw = secrets.token_urlsafe(32)
    user.email_confirmed = False
    user.email_confirm_token = hash_confirm_token(raw)
    user.email_confirm_expires = datetime.utcnow() + timedelta(days=CONFIRM_TTL_DAYS)
    return raw


def confirmation_link(base_url: str, token: str) -> str:
    return f"{base_url.rstrip('/')}/confirm-email?token={token}"


def issue_reset_token(user) -> str:
    raw = secrets.token_urlsafe(32)
    user.password_reset_token = hash_confirm_token(raw)
    user.password_reset_expires = datetime.utcnow() + timedelta(hours=RESET_TTL_HOURS)
    return raw


def reset_password_link(base_url: str, token: str) -> str:
    return f"{base_url.rstrip('/')}/reset-password?token={token}"


def _invite_bodies(login: str, password: str | None, confirm_url: str) -> tuple[str, str]:
    safe_login = html.escape(login)
    safe_url = html.escape(confirm_url)
    if password:
        safe_password = html.escape(password)
        creds_text = f"Логин (email): {login}\nПароль: {password}\n\n"
        creds_html = (
            f"<p><strong>Логин (email):</strong> {safe_login}<br/>"
            f"<strong>Пароль:</strong> {safe_password}</p>"
        )
        after_text = "После подтверждения войдите на сайт с указанными логином и паролем.\n"
        after_html = "После подтверждения войдите на сайт с указанными логином и паролем."
    else:
        creds_text = f"Логин (email): {login}\nПароль — тот, который был указан в первом письме.\n\n"
        creds_html = (
            f"<p><strong>Логин (email):</strong> {safe_login}<br/>"
            "Пароль — тот, который был указан в первом письме.</p>"
        )
        after_text = "После подтверждения войдите на сайт со своим паролем.\n"
        after_html = "После подтверждения войдите на сайт со своим паролем."
    text = (
        "Здравствуйте!\n\n"
        "Для вас создана учётная запись в Цифровом реестре компетенций.\n\n"
        f"{creds_text}"
        "Чтобы активировать доступ, перейдите по ссылке подтверждения:\n"
        f"{confirm_url}\n\n"
        f"Ссылка действует 14 дней. {after_text}"
        "Если вы не ожидали это письмо, просто проигнорируйте его.\n"
    )
    html_body = f"""\
<html>
  <body style="font-family: Arial, sans-serif; color: #212529; line-height: 1.5;">
    <p>Здравствуйте!</p>
    <p>Для вас создана учётная запись в <strong>Цифровом реестре компетенций</strong>.</p>
    {creds_html}
    <p>
      <a href="{safe_url}" style="display:inline-block;background:#215e71;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;">
        Подтвердить email и активировать доступ
      </a>
    </p>
    <p style="font-size:13px;color:#5c656c;">
      Если кнопка не открывается, скопируйте ссылку в браузер:<br/>
      {safe_url}
    </p>
    <p style="font-size:13px;color:#5c656c;">
      Ссылка действует 14 дней. {after_html}
    </p>
  </body>
</html>
"""
    return text, html_body


def _ipv4_socket(host: str, port: int, timeout: float):
    last_error: OSError | None = None
    for family, socktype, proto, _, sockaddr in socket.getaddrinfo(
        host, port, socket.AF_INET, socket.SOCK_STREAM
    ):
        sock = socket.socket(family, socktype, proto)
        try:
            sock.settimeout(timeout)
            sock.connect(sockaddr)
            return sock
        except OSError as exc:
            last_error = exc
            sock.close()
    if last_error:
        raise last_error
    raise OSError(f"Нет IPv4-адреса для {host}")


class _SMTP_SSL(smtplib.SMTP_SSL):
    def _get_socket(self, host, port, timeout):
        sock = _ipv4_socket(host, port, timeout)
        return self.context.wrap_socket(sock, server_hostname=self._host or host)


class _SMTP(smtplib.SMTP):
    def _get_socket(self, host, port, timeout):
        return _ipv4_socket(host, port, timeout)


def send_email(to_addr: str, subject: str, text_body: str, html_body: str | None = None) -> None:
    settings = smtp_settings()
    if not settings["password"]:
        raise RuntimeError("Не задан пароль SMTP (SMTP_PASSWORD или PassForDRC_mail.txt)")
    if not settings["user"]:
        raise RuntimeError("Не задан ящик SMTP_USER")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f'{settings["from_name"]} <{settings["sender"]}>'
    message["To"] = to_addr
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    context = ssl.create_default_context()
    port = settings["port"]
    host = settings["host"]
    timeout = float(os.getenv("SMTP_TIMEOUT") or "10")
    started = time.monotonic()
    try:
        if port == 465:
            with _SMTP_SSL(host, port, timeout=timeout, context=context) as server:
                server.login(settings["user"], settings["password"])
                server.send_message(message)
        else:
            with _SMTP(host, port, timeout=timeout) as server:
                server.starttls(context=context)
                server.login(settings["user"], settings["password"])
                server.send_message(message)
        print(f"SMTP sent to {to_addr} in {time.monotonic() - started:.1f}s")
    except smtplib.SMTPAuthenticationError as exc:
        raise RuntimeError(
            "Яндекс отклонил вход в почту. Проверьте SMTP_USER и пароль приложения."
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"Не удалось отправить письмо: {exc}") from exc


def send_invite_email(to_addr: str, password: str | None, confirm_url: str) -> None:
    text_body, html_body = _invite_bodies(to_addr, password, confirm_url)
    send_email(
        to_addr,
        "Доступ к Цифровому реестру компетенций",
        text_body,
        html_body,
    )


def send_reset_password_email(to_addr: str, reset_url: str) -> None:
    safe_url = html.escape(reset_url)
    text = (
        "Здравствуйте!\n\n"
        "Мы получили запрос на восстановление пароля в Цифровом реестре компетенций.\n\n"
        "Чтобы задать новый пароль, перейдите по ссылке:\n"
        f"{reset_url}\n\n"
        "Ссылка действует 2 часа. Если вы не запрашивали сброс пароля, проигнорируйте это письмо.\n"
    )
    html_body = f"""\
<html>
  <body style="font-family: Arial, sans-serif; color: #212529; line-height: 1.5;">
    <p>Здравствуйте!</p>
    <p>Мы получили запрос на восстановление пароля в <strong>Цифровом реестре компетенций</strong>.</p>
    <p>
      <a href="{safe_url}" style="display:inline-block;background:#215e71;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;">
        Задать новый пароль
      </a>
    </p>
    <p style="font-size:13px;color:#5c656c;">
      Если кнопка не открывается, скопируйте ссылку в браузер:<br/>
      {safe_url}
    </p>
    <p style="font-size:13px;color:#5c656c;">Ссылка действует 2 часа. Если вы не запрашивали сброс, просто проигнорируйте письмо.</p>
  </body>
</html>
"""
    send_email(to_addr, "Восстановление пароля", text, html_body)
