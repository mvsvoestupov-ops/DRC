@echo off
chcp 65001 >nul
setlocal
set "SSH_HOST=201.34.149.65"
set "SSH_USER=root"
set "SSH_PORT=22"
set "SSH_KEY="
if exist "%USERPROFILE%\.ssh\id_ed25519_drc" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not defined SSH_KEY if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not defined SSH_KEY if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"
if defined SSH_KEY (
  set SSH_OPTS=-i "%SSH_KEY%" -p %SSH_PORT% -o StrictHostKeyChecking=accept-new
) else (
  set SSH_OPTS=-p %SSH_PORT% -o StrictHostKeyChecking=accept-new
)

echo == процесс python import
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "pgrep -af 'python.*import_esco_rdf' || echo NOT_RUNNING"

echo.
echo == хвост лога
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "tail -n 40 /tmp/esco-import.log 2>/dev/null || echo NO_LOG"

echo.
echo == OOM?
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "dmesg -T 2>/dev/null | grep -i 'oom\|killed process' | tail -n 5 || journalctl -k -n 50 --no-pager 2>/dev/null | grep -i 'oom\|killed process' | tail -n 5 || echo no_oom_lines"

echo.
echo == счётчики в БД
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "cd /opt/drc/backend && ./venv/bin/python -u -c \"from app.db import SessionLocal; from app.db.esco_models import EscoMeta, EscoOccupation, EscoSkill, EscoOccupationSkill; s=SessionLocal(); m=s.query(EscoMeta).first(); print('meta_source', getattr(m,'source',None)); print('meta_imported_at', getattr(m,'imported_at',None)); print('db_occupations', s.query(EscoOccupation).count()); print('db_skills', s.query(EscoSkill).count()); print('db_relations', s.query(EscoOccupationSkill).count())\""

echo.
echo Повторяйте watch-esco-import.cmd пока NOT_RUNNING и db_* ^> 0.
endlocal
