# -*- coding: utf-8 -*-
"""CLI: restore PS names overwritten by OKZ titles.

  venv\\Scripts\\python.exe -u scripts\\repair_ps_names_okz_leak.py
  venv\\Scripts\\python.exe -u scripts\\repair_ps_names_okz_leak.py 1674
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

print("repair_ps_names_okz_leak: start", flush=True)

from app.db import SessionLocal  # noqa: E402
from app.repair_ps_names_okz_leak import repair_ps_names_okz_leak  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    argv = list(argv if argv is not None else sys.argv[1:])
    regs = [a for a in argv if a and not a.startswith("-")]
    session = SessionLocal()
    try:
        result = repair_ps_names_okz_leak(session, reg_numbers=regs or None)
        print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
        print("repair_ps_names_okz_leak: done", flush=True)
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
