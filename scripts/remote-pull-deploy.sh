#!/bin/bash
# Запуск внутри CT 228 (pct exec … bash -s) или уже на hv1:
#   pct exec 228 -- bash -s < scripts/remote-pull-deploy.sh
# Код только из GitLab; с ПК ничего не копируется.
set -euo pipefail

APPDIR="${REMOTE_DIR:-/opt/drc}"
BRANCH="${BRANCH:-main}"
export VITE_API_URL="${VITE_API_URL:-https://drc.ao-nk.ru/api}"
export BRANCH
export GIT_URL="${GIT_URL:-git@git.ao-nk.site:svoestupov/drc.git}"
export REMOTE_DIR="$APPDIR"
export SEED_SWOT_DEMO="${SEED_SWOT_DEMO:-0}"

cd "$APPDIR"
echo "==> git fetch/reset origin/$BRANCH in $APPDIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
echo "==> HEAD $(git rev-parse --short HEAD)"
# deploy-remote.sh снова синхронизирует git, ставит deps, собирает фронт, рестартит сервис
bash ./deploy-remote.sh
