# -*- coding: utf-8 -*-
"""CLI: rebuild PS rows with classinform TF headers missing a trailing dot.

  venv\\Scripts\\python.exe -u scripts\\repair_missing_tf_from_html.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

print("repair_missing_tf_from_html: start", flush=True)

from app.db import SessionLocal  # noqa: E402
from app.repair_missing_tf_from_html import repair_missing_tf_from_html  # noqa: E402


def main() -> int:
    session = SessionLocal()
    try:
        result = repair_missing_tf_from_html(session)
        print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
        print("repair_missing_tf_from_html: done", flush=True)
        return 0 if not result.get("errors") else 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
