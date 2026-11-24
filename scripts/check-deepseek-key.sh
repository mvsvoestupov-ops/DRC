#!/bin/bash
# Проверка DEEPSEEK_API_KEY на CT без heredoc.
# На hv1 (после git pull, когда скрипт уже в /opt/drc):
#   pct exec 228 -- bash /opt/drc/scripts/check-deepseek-key.sh
# Однострочник без файла (если скрипта ещё нет на CT):
#   pct exec 228 -- bash -lc 'cd /opt/drc/backend && ./venv/bin/python -c "from pathlib import Path; ks=[l.split(\"=\",1)[1].strip().strip(chr(34)+chr(39)) for l in Path(\".env\").read_text(encoding=\"utf-8\").splitlines() if l.startswith(\"DEEPSEEK_API_KEY=\")]; print(\"missing\") if not ks or not ks[0] else print(\"key_set=\", True, \"len=\", len(ks[0]), \"prefix=\", ks[0][:7]+\"…\")"'
set -euo pipefail
ENV_FILE="${1:-/opt/drc/backend/.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing file: $ENV_FILE"
  exit 1
fi
export ENV_FILE
python3 - <<'PY'
import os
from pathlib import Path
path = Path(os.environ["ENV_FILE"])
ks = [
    line.split("=", 1)[1].strip().strip('"').strip("'")
    for line in path.read_text(encoding="utf-8").splitlines()
    if line.startswith("DEEPSEEK_API_KEY=")
]
if not ks or not ks[0]:
    print("DEEPSEEK_API_KEY missing or empty")
else:
    v = ks[0]
    print("key_set=", True, "len=", len(v), "prefix=", (v[:7] + "…") if len(v) >= 7 else "?")
PY
