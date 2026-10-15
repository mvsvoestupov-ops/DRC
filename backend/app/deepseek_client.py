"""Клиент ИИ-агента (Chat Completions, OpenAI-compatible)."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import requests

from .mail import BACKEND_DIR, REPO_ROOT, _load_env_file

DEFAULT_BASE = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"


def _ensure_env_loaded() -> None:
    """Перечитать .env перед проверкой ключа (после правки файла без рестарта)."""
    _load_env_file(BACKEND_DIR / ".env")
    _load_env_file(REPO_ROOT / ".env")
    # На случай запуска не из стандартной структуры
    here = Path(__file__).resolve()
    _load_env_file(here.parents[1] / ".env")


def deepseek_configured() -> bool:
    _ensure_env_loaded()
    return bool(os.environ.get("DEEPSEEK_API_KEY", "").strip())


def deepseek_status() -> dict[str, Any]:
    _ensure_env_loaded()
    return {
        "configured": bool(os.environ.get("DEEPSEEK_API_KEY", "").strip()),
        "model": os.environ.get("DEEPSEEK_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL,
        "base_url": os.environ.get("DEEPSEEK_BASE_URL", DEFAULT_BASE).strip() or DEFAULT_BASE,
    }


def chat_json(
    *,
    system: str,
    user: str,
    temperature: float = 0.2,
    timeout: int = 90,
) -> dict[str, Any]:
    """Вызов chat/completions; ожидает JSON в ответе модели."""
    _ensure_env_loaded()
    api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY не задан")

    base = os.environ.get("DEEPSEEK_BASE_URL", DEFAULT_BASE).strip().rstrip("/") or DEFAULT_BASE
    model = os.environ.get("DEEPSEEK_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    url = f"{base}/chat/completions"

    payload = {
        "model": model,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"ИИ-агент HTTP {response.status_code}: {response.text[:500]}")

    data = response.json()
    content = (
        ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    ).strip()
    if not content:
        raise RuntimeError("ИИ-агент вернул пустой ответ")

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", content)
        if not match:
            raise RuntimeError("ИИ-агент вернул не-JSON ответ")
        return json.loads(match.group(0))
