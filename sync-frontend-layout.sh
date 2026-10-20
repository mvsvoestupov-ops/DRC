#!/usr/bin/env bash
# На сервере: пересобрать фронт из git и выложить туда, куда смотрит nginx.
# Цель: вёрстка на https://drc.ao-nk.online = актуальный код (как локально после build).
set -euo pipefail

API_URL="${VITE_API_URL:-https://drc.ao-nk.online/api}"
BRANCH="${BRANCH:-main}"
PREFERRED="${REMOTE_DIR:-/opt/drc}"

echo "==> sync frontend layout $(date -Is) host=$(hostname)"

discover_root() {
  local candidate
  for candidate in "$PREFERRED" /opt/drc /var/www/drc /var/www/drc.ao-nk.online /var/www/drc.ao-nk.ru /root/DRC /root/drc; do
    if [ -d "$candidate/frontend" ] && { [ -d "$candidate/.git" ] || [ -f "$candidate/frontend/package.json" ]; }; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

ROOT="$(discover_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "ERROR: не найден каталог DRC (ожидали $PREFERRED)"
  exit 1
fi
echo "==> app root: $ROOT"

cd "$ROOT"
if [ -d .git ]; then
  echo "==> git fetch/checkout $BRANCH"
  git fetch origin "$BRANCH" || true
  git checkout -B "$BRANCH" "origin/$BRANCH" 2>/dev/null || git pull --ff-only origin "$BRANCH" || true
  echo "==> HEAD $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
fi

echo "==> frontend build (VITE_API_URL=$API_URL)"
cd "$ROOT/frontend"
export VITE_API_URL="$API_URL"
# чистая сборка — иначе на сервере часто остаётся старый CSS/JS
rm -rf dist build/.vite 2>/dev/null || true
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  pnpm run build
elif command -v npm >/dev/null 2>&1; then
  npm ci 2>/dev/null || npm install
  npm run build
else
  echo "ERROR: pnpm/npm не найдены"
  exit 1
fi

if [ ! -d "$ROOT/frontend/dist" ]; then
  echo "ERROR: нет $ROOT/frontend/dist после build"
  exit 1
fi

DIST="$ROOT/frontend/dist"
echo "==> dist готов: $(du -sh "$DIST" | awk '{print $1}') файлов=$(find "$DIST" -type f | wc -l)"

# Куда nginx реально отдаёт статику для DRC
mapfile -t NGINX_ROOTS < <(
  grep -RhoE 'root[[:space:]]+/[^;]+' /etc/nginx 2>/dev/null \
    | awk '{print $2}' \
    | sed 's|/$||' \
    | sort -u \
    | while read -r r; do
        case "$r" in
          *drc*|*DRC*|*frontend*) echo "$r" ;;
        esac
      done
)

# Всегда синхронизируем dist → build (исторический CRA path)
TARGETS=("$ROOT/frontend/build")
for r in "${NGINX_ROOTS[@]:-}"; do
  [ -n "$r" ] || continue
  TARGETS+=("$r")
done

# уникальные цели
declare -A SEEN=()
UNIQUE=()
for t in "${TARGETS[@]}"; do
  [ -n "$t" ] || continue
  if [ -z "${SEEN[$t]:-}" ]; then
    SEEN[$t]=1
    UNIQUE+=("$t")
  fi
done

echo "==> nginx roots (drc*):"
printf '  %s\n' "${NGINX_ROOTS[@]:-(не найдены — копируем в frontend/build)}"

for dest in "${UNIQUE[@]}"; do
  echo "==> sync $DIST -> $dest"
  mkdir -p "$dest"
  # rsync предпочтительнее: удаляет устаревшие hashed-файлы CSS/JS
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$DIST"/ "$dest"/
  else
    find "$dest" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    cp -a "$DIST"/. "$dest"/
  fi
  chown -R www-data:www-data "$dest" 2>/dev/null || true
  chmod -R a+rX "$dest"
done

# Контрольные маркеры вёрстки (есть ли свежий index и assets)
INDEX_HASH="$(md5sum "$DIST/index.html" 2>/dev/null | awk '{print $1}' || true)"
echo "==> dist/index.html md5=$INDEX_HASH"
for dest in "${UNIQUE[@]}"; do
  if [ -f "$dest/index.html" ]; then
    h="$(md5sum "$dest/index.html" | awk '{print $1}')"
    if [ "$h" = "$INDEX_HASH" ]; then
      echo "  OK  $dest/index.html"
    else
      echo "  FAIL $dest/index.html md5=$h (не совпал с dist)"
      exit 1
    fi
  else
    echo "  FAIL нет $dest/index.html"
    exit 1
  fi
done

echo "==> nginx reload"
nginx -t
systemctl reload nginx

echo "==> done. Жёстко обновите браузер: Ctrl+F5"
echo "    Сайт: https://drc.ao-nk.online"
