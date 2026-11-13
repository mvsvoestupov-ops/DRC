#!/usr/bin/env bash
# Шпаргалка для консоли hv1. Код только из GitLab — диск O: не нужен.
# После push с ПК (push-and-deploy.cmd / push-and-deploy.cmd /push):
#
#   pct exec 228 -- bash -lc 'cd /opt/drc && git fetch origin main && git reset --hard origin/main && export VITE_API_URL=https://drc.ao-nk.ru/api BRANCH=main SEED_SWOT_DEMO=0 && bash ./deploy-remote.sh'
#
# Либо pipe с машины, где есть SSH до hv1 (как ps-control):
#   type scripts\remote-pull-deploy.sh | ssh root@10.100.4.20 "pct exec 228 -- bash -s"
set -euo pipefail
echo "См. комментарии в начале файла — одна команда pct exec."
