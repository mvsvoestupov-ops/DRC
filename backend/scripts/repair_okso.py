"""Backfill OKSO on OTFs from stored HTML/XML. One PS at a time.

Run from backend (optional, not part of deploy):

  venv\\Scripts\\python.exe -u scripts\\repair_okso.py
"""
from __future__ import annotations

import sys
from pathlib import Path

print("repair_okso: start", flush=True)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import SessionLocal
from app.repair_okso import repair_okso_units


def main() -> None:
    session = SessionLocal()
    try:
        result = repair_okso_units(session)
        print("repair_okso: done", flush=True)
        for key, value in result.items():
            print(f"{key}={value}", flush=True)
    finally:
        session.close()


if __name__ == "__main__":
    main()
