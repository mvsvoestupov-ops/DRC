#!/usr/bin/env bash
set -eu
cd /opt/drc/backend
pkill -f 'scripts/import_esco_rdf.py' 2>/dev/null || true
sleep 1
: > /tmp/esco-import.log
# --clear: снести неполный кэш и залить заново до конца
nohup ./venv/bin/python -u scripts/import_esco_rdf.py --clear --path ../ESCO/esco-v1.2.0.rdf >> /tmp/esco-import.log 2>&1 &
echo "STARTED_PID:$!"
sleep 3
echo "--- log head ---"
head -n 40 /tmp/esco-import.log || true
echo "--- process ---"
pgrep -af 'python.*import_esco_rdf' || echo NOT_RUNNING
