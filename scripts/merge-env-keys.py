#!/usr/bin/env python3
"""Merge selected KEY=value lines into /opt/drc/backend/.env without printing secrets.

Usage on CT (stdin = fragment with KEY= lines):
  python3 /opt/drc/scripts/merge-env-keys.py </tmp/drc-env-sync.env
"""
from __future__ import annotations

import sys
from pathlib import Path

ENV_PATH = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/drc/backend/.env")
PREFIXES = ("DEEPSEEK_API_KEY=", "SMTP_", "PUBLIC_APP_URL=")

incoming = [ln.rstrip("\r\n") for ln in sys.stdin.read().splitlines() if ln.strip() and not ln.lstrip().startswith("#")]
incoming = [ln for ln in incoming if ln.startswith(PREFIXES)]
if not incoming:
    print("no matching keys in stdin", file=sys.stderr)
    sys.exit(1)

ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
cur = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.exists() else ""
kept = [ln for ln in cur.splitlines() if not ln.startswith(PREFIXES)]
# drop trailing empties, then append incoming block
while kept and not kept[-1].strip():
    kept.pop()
out = "\n".join(kept + ([""] if kept else []) + incoming).rstrip() + "\n"
ENV_PATH.write_text(out, encoding="utf-8")
print("env updated keys=", len(incoming))
