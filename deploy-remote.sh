#!/usr/bin/env bash
set -euo pipefail

API_URL="${VITE_API_URL:-https://drc.ao-nk.online/api}"
BRANCH="${BRANCH:-main}"
GIT_URL="${GIT_URL:-https://github.com/mvsvoestupov-ops/DRC.git}"
PREFERRED="${REMOTE_DIR:-/opt/drc}"

echo "==> remote: $(hostname) $(date -Is)"

unit_workdir() {
  local unit="$1"
  systemctl show -p WorkingDirectory --value "$unit" 2>/dev/null | sed 's|/backend/*$||' || true
}

discover_root() {
  local candidate
  for candidate in \
    "$PREFERRED" \
    /opt/drc \
    /var/www/drc \
    /var/www/drc.ao-nk.online \
    /var/www/drc.ao-nk.ru \
    /var/www/html \
    /root/DRC \
    /root/drc
  do
    if [ -d "$candidate/.git" ]; then
      echo "$candidate"
      return 0
    fi
  done

  local unit wd
  for unit in drc-backend fastapi-backend uvicorn drc; do
    wd="$(unit_workdir "$unit")"
    if [ -n "$wd" ] && [ "$wd" != "/" ] && [ -d "$wd/.git" ]; then
      echo "$wd"
      return 0
    fi
    if [ -n "$wd" ] && [ -d "$wd/backend" ] && [ -d "$wd/frontend" ]; then
      echo "$wd"
      return 0
    fi
  done

  local nginx_root
  nginx_root="$(grep -RhoE 'root[[:space:]]+/[^;]+' /etc/nginx 2>/dev/null | awk '{print $2}' | head -n 1 || true)"
  if [ -n "$nginx_root" ]; then
    candidate="$(dirname "$nginx_root")"
    candidate="$(dirname "$candidate")"
    if [ -d "$candidate/.git" ] || { [ -d "$candidate/backend" ] && [ -d "$candidate/frontend" ]; }; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

ensure_git() {
  local root="$1"
  mkdir -p "$root"
  cd "$root"
  if [ -d .git ]; then
    echo "==> git pull origin $BRANCH in $root"
    git remote get-url origin >/dev/null 2>&1 || git remote add origin "$GIT_URL"
    git fetch origin "$BRANCH"
    git checkout -B "$BRANCH" "origin/$BRANCH"
    return 0
  fi
  echo "==> $root has no .git, fetching $GIT_URL (database files stay untracked)"
  git init
  git remote add origin "$GIT_URL" 2>/dev/null || git remote set-url origin "$GIT_URL"
  git fetch origin "$BRANCH"
  git checkout -f -B "$BRANCH" "origin/$BRANCH"
}

detect_service() {
  local unit
  for unit in drc-backend fastapi-backend drc uvicorn; do
    if systemctl status "${unit}.service" >/dev/null 2>&1 || systemctl status "$unit" >/dev/null 2>&1; then
      echo "$unit"
      return 0
    fi
  done
  systemctl list-units --type=service --all --no-legend 2>/dev/null \
    | awk '/drc|fastapi|uvicorn/ { gsub(/[●*]/,""); print $1; exit }' \
    | sed 's/\.service$//'
}

ROOT="$(discover_root || true)"
if [ -z "${ROOT:-}" ]; then
  if [ -d "$PREFERRED/backend/app" ] && [ -d "$PREFERRED/frontend" ]; then
    ROOT="$PREFERRED"
  else
    echo "ERROR: cannot find DRC on the server."
    echo "==> systemd:"
    systemctl list-units --type=service --all --no-legend | grep -Ei 'drc|fastapi|uvicorn|nginx' || true
    echo "==> paths:"
    ls -ld /opt/drc /var/www/drc* /var/www/html /root/DRC /root/drc 2>/dev/null || true
    echo "==> nginx roots:"
    grep -RhoE 'root[[:space:]]+/[^;]+' /etc/nginx 2>/dev/null || true
    exit 1
  fi
fi
echo "==> app root: $ROOT"

ensure_git "$ROOT"
cd "$ROOT"

if [ -f backend/profstandart.db ]; then
  echo "==> keeping existing backend/profstandart.db (not overwritten)"
fi

echo "==> backend deps"
cd "$ROOT/backend"
if [ -x venv/bin/pip ]; then
  venv/bin/pip install -r requirements.txt
else
  echo "ERROR: $ROOT/backend/venv is missing"
  exit 1
fi

echo "==> seed example competences RUS-PK-0019 / RUS-PK-0020"
venv/bin/python scripts/seed_example_competences.py

SERVICE="$(detect_service || true)"
if [ -n "${SERVICE:-}" ]; then
  echo "==> restart $SERVICE"
  systemctl restart "$SERVICE"
  systemctl --no-pager --lines=20 status "$SERVICE" || true
else
  echo "WARNING: backend systemd unit not found, skip restart"
fi

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

OUT=""
if [ -d dist ]; then
  OUT="$ROOT/frontend/dist"
elif [ -d build ]; then
  OUT="$ROOT/frontend/build"
fi
if [ -z "$OUT" ]; then
  echo "ERROR: frontend dist/build was not created"
  exit 1
fi
chown -R www-data:www-data "$OUT" 2>/dev/null || true
chmod -R a+rX "$OUT"

# If nginx still points at the old CRA build folder, copy Vite output there too.
if [ -d "$ROOT/frontend/build" ] && [ "$OUT" = "$ROOT/frontend/dist" ]; then
  mkdir -p "$ROOT/frontend/build"
  cp -a "$ROOT/frontend/dist/." "$ROOT/frontend/build/"
fi

echo "==> nginx"
nginx -t
systemctl reload nginx

echo "==> done $(git -C "$ROOT" rev-parse --short HEAD) in $ROOT"
