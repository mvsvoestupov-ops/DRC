@echo off
chcp 65001 >nul
set "SSH_HOST=201.34.149.65"
set "SSH_USER=root"
set "SSH_PORT=22"
set "SSH_KEY="
if exist "%USERPROFILE%\.ssh\id_ed25519_drc" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not defined SSH_KEY if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not defined SSH_KEY if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

if defined SSH_KEY (
  echo SSH-ключ: %SSH_KEY%
  set SSH_OPTS=-i "%SSH_KEY%" -p %SSH_PORT% -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=20
) else (
  echo SSH-ключ не найден — пробую без -i
  set SSH_OPTS=-p %SSH_PORT% -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=20
)

echo == ESCO on server %SSH_USER%@%SSH_HOST%
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "cd /opt/drc/backend && ./venv/bin/python -u -c \"import os; from app.db import SessionLocal; from app.db.esco_models import EscoMeta, EscoOccupation, EscoSkill, EscoOccupationSkill; p='../ESCO/esco-v1.2.0.rdf'; print('rdf_exists', os.path.isfile(p)); print('rdf_size_mb', round(os.path.getsize(p)/1024/1024,1) if os.path.isfile(p) else 0); s=SessionLocal(); m=s.query(EscoMeta).first(); print('meta', 'EMPTY' if not m else 'ok'); print('meta_version', getattr(m,'version',None)); print('meta_source', getattr(m,'source',None)); print('meta_occupations', getattr(m,'occupation_count',None)); print('meta_skills', getattr(m,'skill_count',None)); print('meta_imported_at', getattr(m,'imported_at',None)); print('db_occupations', s.query(EscoOccupation).count()); print('db_skills', s.query(EscoSkill).count()); print('db_relations', s.query(EscoOccupationSkill).count())\""
if errorlevel 1 (
  echo.
  echo SSH/проверка не удалась.
  exit /b 1
)
echo.
echo Ожидаемо при полном импорте: десятки тысяч занятий/навыков, source вида rdf:esco-v1.2.0.rdf
exit /b 0
