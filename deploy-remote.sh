#!/usr/bin/env bash
set -euo pipefail

ROOT="${REMOTE_DIR:-/opt/drc}"
API_URL="${VITE_API_URL:-https://drc.ao-nk.online/api}"
BRANCH="${BRANCH:-main}"

echo "==> remote: $(hostname) $(date -Is)"
if [ ! -d "$ROOT/.git" ]; then
  echo "ERROR: $ROOT is not a git repository"
  exit 1
fi

cd "$ROOT"
echo "==> git pull origin $BRANCH"
git pull origin "$BRANCH"

if [ -f backend/profstandart.db ]; then
  echo "==> keeping existing backend/profstandart.db (not overwritten)"
fi

echo "==> backend deps + restart drc-backend"
cd "$ROOT/backend"
if [ -x venv/bin/pip ]; then
  venv/bin/pip install -r requirements.txt
else
  echo "ERROR: $ROOT/backend/venv is missing"
  exit 1
fi
echo "==> seed example competences RUS-PK-0019 / RUS-PK-0020"
venv/bin/python scripts/seed_example_competences.py

systemctl restart drc-backend
systemctl --no-pager --lines=20 status drc-backend || true

echo "==> frontend build (VITE_API_URL=$API_URL)"
cd "$ROOT/frontend"
export VITE_API_URL="$API_URL"
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
  pnpm run build
elif command -v npm >/dev/null 2>&1; then
  npm install
  npm run build
else
  echo "ERROR: pnpm/npm not found on server"
  exit 1
fi

if [ ! -d dist ]; then
  echo "ERROR: frontend/dist was not created"
  exit 1
fi
chown -R www-data:www-data dist 2>/dev/null || true
chmod -R a+rX dist

echo "==> nginx"
nginx -t
systemctl reload nginx

echo "==> done $(git -C "$ROOT" rev-parse --short HEAD)"
