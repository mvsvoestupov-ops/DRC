"""Клиент ИИ-агента (Chat Completions, OpenAI-compatible)."""
from __future__ import annotations

import json
import os
import re
from typing import Any

import requests

from . import mail as _mail  # noqa: F401 — подгружает backend/.env и корневой .env

DEFAULT_BASE = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"


def deepseek_configured() -> bool:
    return bool(os.environ.get("DEEPSEEK_API_KEY", "").strip())


def deepseek_status() -> dict[str, Any]:
    return {
        "configured": deepseek_configured(),
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
