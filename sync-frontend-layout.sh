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
  echo "==> git fetch/reset $BRANCH"
  git fetch origin "$BRANCH"
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "==> stash local tracked changes on server"
    git stash push -m "frontend-sync-$(date +%Y%m%d%H%M%S)" --quiet || true
  fi
  git checkout -f -B "$BRANCH" "origin/$BRANCH"
  git reset --hard "origin/$BRANCH"
  echo "==> HEAD $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "==> WorkingGroupPanel present: $(test -f frontend/src/app/components/WorkingGroupPanel.tsx && echo yes || echo NO)"
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

# Куда nginx реально отдаёт статику для DRC (не трогаем чужие проекты вроде veche_rg)
mapfile -t NGINX_ROOTS < <(
  # Берём только server-блоки с drc.ao-nk
  awk '
    /server_name/ { sn=$0 }
    /[[:space:]]root[[:space:]]/ {
      if (sn ~ /drc\.ao-nk/) {
        for (i=1;i<=NF;i++) if ($i=="root") { print $(i+1); break }
      }
    }
  ' /etc/nginx/sites-enabled/* /etc/nginx/conf.d/* 2>/dev/null \
    | sed 's|[;[:space:]]||g' \
    | sort -u
)

# Всегда синхронизируем dist → build (исторический CRA path)
TARGETS=("$ROOT/frontend/build" "$ROOT/frontend/dist")
for r in "${NGINX_ROOTS[@]:-}"; do
  [ -n "$r" ] || continue
  # защита: только пути внутри /opt/drc или явно drc
  case "$r" in
    /opt/drc/*|*drc*|*DRC*) TARGETS+=("$r") ;;
    *) echo "==> skip foreign nginx root: $r" ;;
  esac
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

# Маркер новой вёрстки «Рабочая группа»: полоса выбора + CheckCircle2
echo "==> verify WorkingGroup UI markers in dist JS"
WG_HITS="$(grep -Rsl --include='*.js' 'bg-primary/5\|alreadyMember\|CheckCircle2' "$DIST" 2>/dev/null | head -n 5 || true)"
if [ -z "$WG_HITS" ]; then
  # в минифицированном бандле классов может не быть как строк — ищем по логике invite bar
  WG_HITS="$(grep -Rsl --include='*.js' 'alreadyMember\|wg\.invite\|UserPlus' "$DIST" 2>/dev/null | head -n 5 || true)"
fi
if [ -z "$WG_HITS" ]; then
  echo "WARNING: не нашли явных маркеров WG в dist (возможно сильно минифицировано)"
else
  echo "  OK markers in:"
  printf '  %s\n' $WG_HITS
fi

# Сброс кэша nginx (если модуль есть) + touch index
find "${UNIQUE[@]}" -name 'index.html' -exec touch {} \; 2>/dev/null || true
if command -v nginx >/dev/null 2>&1; then
  echo "==> nginx reload (+ optional cache purge)"
  nginx -t
  # некоторые сборки держат proxy_cache — чистим типичные пути
  rm -rf /var/cache/nginx/* 2>/dev/null || true
  systemctl reload nginx
fi

echo "==> done. Обязательно Ctrl+F5 (или окно инкогнито)."
echo "    Сайт: https://drc.ao-nk.online"
echo "    Ожидаемая WG: бейдж «Руководитель», галочка в списке, полоса «Пригласить» справа"
