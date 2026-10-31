@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal

set "SSH_HOST=201.34.149.65"
set "SSH_USER=root"
set "SSH_PORT=22"
set "SSH_KEY="
if exist "%USERPROFILE%\.ssh\id_ed25519_drc" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not defined SSH_KEY if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not defined SSH_KEY if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

if defined SSH_KEY (
  set SSH_OPTS=-i "%SSH_KEY%" -p %SSH_PORT% -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30
  set SCP_OPTS=-i "%SSH_KEY%" -P %SSH_PORT% -o StrictHostKeyChecking=accept-new
) else (
  set SSH_OPTS=-p %SSH_PORT% -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30
  set SCP_OPTS=-P %SSH_PORT% -o StrictHostKeyChecking=accept-new
)

echo == 1/5 upload importer + starter
scp %SCP_OPTS% "%~dp0backend\app\esco_rdf_import.py" %SSH_USER%@%SSH_HOST%:/opt/drc/backend/app/esco_rdf_import.py
if errorlevel 1 exit /b 1
scp %SCP_OPTS% "%~dp0backend\scripts\import_esco_rdf.py" %SSH_USER%@%SSH_HOST%:/opt/drc/backend/scripts/import_esco_rdf.py
if errorlevel 1 exit /b 1
scp %SCP_OPTS% "%~dp0backend\scripts\start_esco_import.sh" %SSH_USER%@%SSH_HOST%:/opt/drc/backend/scripts/start_esco_import.sh
if errorlevel 1 exit /b 1

echo == 2/5 chmod + strip CRLF
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "sed -i 's/\r$//' /opt/drc/backend/scripts/start_esco_import.sh && chmod +x /opt/drc/backend/scripts/start_esco_import.sh"
if errorlevel 1 exit /b 1

echo == 3/5 verify markers
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "grep -n '_TAG_BOUNDARY\|_find_concept_start' /opt/drc/backend/app/esco_rdf_import.py | head"
if errorlevel 1 exit /b 1

echo == 4/5 start import background
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "bash /opt/drc/backend/scripts/start_esco_import.sh"
if errorlevel 1 exit /b 1

echo.
echo == 5/5
echo Импорт в фоне. Лог: /tmp/esco-import.log
echo Смотреть прогресс:
echo   C:\IT\DRC\watch-esco-import.cmd
endlocal
exit /b 0
