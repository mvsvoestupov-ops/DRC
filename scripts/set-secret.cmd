@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0.."

REM Обновить секреты на CT из локального backend\.env по SSH.
REM ЗАПРЕЩЕНО: O:\ , \\dc1.ao-nk.site\Public , любая общая шара.
REM
REM Прямой SSH на CT (доменная машина / VPN):
REM   set CT_HOST=10.100.28.44
REM   scripts\set-secret.cmd
REM
REM Через jump hv1:
REM   set JUMP_HOST=10.100.4.20
REM   set PCT_ID=228
REM   scripts\set-secret.cmd

if not exist "backend\.env" (
  echo Ошибка: нет backend\.env
  exit /b 1
)
if not exist "scripts\merge-env-keys.py" (
  echo Ошибка: нет scripts\merge-env-keys.py
  exit /b 1
)

if not defined CT_HOST if not defined JUMP_HOST set "CT_HOST=10.100.28.44"
if not defined PCT_ID set "PCT_ID=228"
if not defined SSH_USER set "SSH_USER=root"
if not defined SSH_PORT set "SSH_PORT=22"
if not defined SSH_KEY set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_ed25519_drc" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

set "SSH_BASE=ssh -p %SSH_PORT% -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new"
if exist "%SSH_KEY%" set "SSH_BASE=%SSH_BASE% -i %SSH_KEY:\=/%"

set "TMPENV=%TEMP%\drc-env-sync.env"
findstr /B /C:"DEEPSEEK_API_KEY=" /C:"SMTP_" /C:"PUBLIC_APP_URL=" "backend\.env" > "%TMPENV%"
if errorlevel 1 (
  echo Ошибка: в backend\.env нет DEEPSEEK_/SMTP_/PUBLIC_ строк
  del /f /q "%TMPENV%" 2>nul
  exit /b 1
)

echo Синхронизирую секреты с backend\.env ^(значения не печатаю^)...
echo Канал: SSH. Public/O: запрещены.

if defined JUMP_HOST (
  type "%TMPENV%" | %SSH_BASE% %SSH_USER%@%JUMP_HOST% "pct exec %PCT_ID% -- tee /tmp/drc-env-sync.env >nul"
  if errorlevel 1 goto :fail
  type "scripts\merge-env-keys.py" | %SSH_BASE% %SSH_USER%@%JUMP_HOST% "pct exec %PCT_ID% -- tee /tmp/merge-env-keys.py >nul"
  if errorlevel 1 goto :fail
  %SSH_BASE% %SSH_USER%@%JUMP_HOST% "pct exec %PCT_ID% -- bash -lc \"python3 /tmp/merge-env-keys.py /opt/drc/backend/.env < /tmp/drc-env-sync.env && systemctl restart drc-backend && rm -f /tmp/drc-env-sync.env /tmp/merge-env-keys.py && echo restarted\""
  if errorlevel 1 goto :fail
) else (
  type "%TMPENV%" | %SSH_BASE% %SSH_USER%@%CT_HOST% "tee /tmp/drc-env-sync.env >nul"
  if errorlevel 1 goto :fail
  type "scripts\merge-env-keys.py" | %SSH_BASE% %SSH_USER%@%CT_HOST% "tee /tmp/merge-env-keys.py >nul"
  if errorlevel 1 goto :fail
  %SSH_BASE% %SSH_USER%@%CT_HOST% "python3 /tmp/merge-env-keys.py /opt/drc/backend/.env < /tmp/drc-env-sync.env && systemctl restart drc-backend && rm -f /tmp/drc-env-sync.env /tmp/merge-env-keys.py && echo restarted"
  if errorlevel 1 goto :fail
)

del /f /q "%TMPENV%" 2>nul
echo Готово. Проверка на hv1: pct exec %PCT_ID% -- bash /opt/drc/scripts/check-deepseek-key.sh
endlocal
exit /b 0

:fail
del /f /q "%TMPENV%" 2>nul
echo.
echo SSH не прошёл. Варианты без Public:
echo   1^) VPN/TS → CT 10.100.28.44 или hv1 10.100.4.20
echo   2^) на hv1: nano /opt/drc/backend/.env  затем  systemctl restart drc-backend
echo   3^) проверка: pct exec %PCT_ID% -- bash /opt/drc/scripts/check-deepseek-key.sh
endlocal
exit /b 1
