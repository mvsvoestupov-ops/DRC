#!/usr/bin/env bash
# Шпаргалка для консоли hv1 (Proxmox / TS).
# Код только из GitLab. ЗАПРЕЩЕНО: O:\ , \\dc1...\Public , копирование .env через шару.
#
# После push с ПК (push-and-deploy.cmd /push):
#
#   pct exec 228 -- bash -lc 'cd /opt/drc && git fetch origin main && git reset --hard origin/main && export VITE_API_URL=https://drc.ao-nk.ru/api BRANCH=main SEED_SWOT_DEMO=0 && bash ./deploy-remote.sh'
#
# Проверка DEEPSEEK_API_KEY без heredoc (не вставлять <<PY в pct exec — получите «>»):
#
#   pct exec 228 -- bash /opt/drc/scripts/check-deepseek-key.sh
#
# Однострочник, если скрипта ещё нет на CT:
#
#   pct exec 228 -- bash -lc 'cd /opt/drc/backend && ./venv/bin/python -c "from pathlib import Path; ks=[l.split(\"=\",1)[1].strip().strip(chr(34)+chr(39)) for l in Path(\".env\").read_text(encoding=\"utf-8\").splitlines() if l.startswith(\"DEEPSEEK_API_KEY=\")]; print(\"missing\") if not ks or not ks[0] else print(\"key_set=\", True, \"len=\", len(ks[0]), \"prefix=\", ks[0][:7]+\"…\")"'
#
# Секреты: правка /opt/drc/backend/.env + systemctl restart drc-backend
#   или с доменной машины: scripts\set-secret.cmd (SSH, не Public)
#
# Pipe с машины, где есть SSH до hv1:
#   type scripts\remote-pull-deploy.sh | ssh root@10.100.4.20 "pct exec 228 -- bash -s"
set -euo pipefail
echo "См. комментарии в начале файла — pct exec / check-deepseek-key / set-secret."
