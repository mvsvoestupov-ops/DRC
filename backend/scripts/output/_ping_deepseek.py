# -*- coding: utf-8 -*-
"""Ping DeepSeek without printing the API key."""
from __future__ import annotations

import os
import sys

BACKEND = os.environ.get("DRC_BACKEND", "")
if BACKEND:
    sys.path.insert(0, BACKEND)
    os.chdir(BACKEND)
else:
    here = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    sys.path.insert(0, here)
    os.chdir(here)

from app.deepseek_client import deepseek_status, chat_json  # noqa: E402


def main() -> int:
    status = deepseek_status()
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    print(f"configured={status['configured']}")
    print(f"model={status['model']}")
    print(f"base_url={status['base_url']}")
    print(f"key_len={len(key)}")
    if not status["configured"]:
        print("result=NO_KEY")
        return 2
    try:
        data = chat_json(
            system="Reply with JSON only.",
            user='Return {"ok": true}',
            temperature=0,
            timeout=30,
        )
        print(f"result=LIVE keys={list(data)[:6] if isinstance(data, dict) else type(data).__name__}")
        return 0
    except Exception as exc:
        text = str(exc).replace(key, "***") if key else str(exc)
        print(f"result=FAIL {text[:400]}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
