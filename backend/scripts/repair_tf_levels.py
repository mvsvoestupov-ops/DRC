"""Normalize dirty OTF/TF codes and fill missing qualification levels.

Run from backend:

  venv\\Scripts\\python.exe -u scripts\\repair_tf_levels.py
"""
from __future__ import annotations

import sys
from pathlib import Path

print("repair_tf_levels: start", flush=True)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import SessionLocal
from app.repair_tf_levels import repair_tf_levels


def main() -> None:
    print("repair_tf_levels: opening database", flush=True)
    session = SessionLocal()
    try:
        result = repair_tf_levels(session)
        print("repair_tf_levels: done", flush=True)
        for key, value in result.items():
            if key == "still_missing_sample":
                for row in value:
                    print("  STILL", row, flush=True)
            else:
                print(f"{key}={value}", flush=True)
    finally:
        session.close()


if __name__ == "__main__":
    main()
