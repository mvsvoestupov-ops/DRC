@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

REM Пересобрать фронт на сервере и выложить в каталоги nginx,
REM чтобы вёрстка совпадала с актуальным кодом (как локально).

set "SSH_HOST=201.34.149.65"
set "SSH_PORT=22"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
set "REMOTE_DIR=/opt/drc"
set "BRANCH=main"
set "VITE_API_URL=https://drc.ao-nk.online/api"

if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

set "SSH_OPTS=-p %SSH_PORT% -o StrictHostKeyChecking=accept-new"
if exist "%SSH_KEY%" (
  set "SSH_OPTS=-i %SSH_KEY% -p %SSH_PORT% -o StrictHostKeyChecking=accept-new"
  echo SSH-ключ: %SSH_KEY%
) else (
  echo Ключ не найден, обычный ssh ^(пароль / агент^)
)

echo.
echo == sync frontend layout on %SSH_USER%@%SSH_HOST%
echo    REMOTE_DIR=%REMOTE_DIR%  BRANCH=%BRANCH%
echo.

type "%~dp0sync-frontend-layout.sh" | ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "export VITE_API_URL=%VITE_API_URL% BRANCH=%BRANCH% REMOTE_DIR=%REMOTE_DIR%; tr -d '\r' | bash -s"
if errorlevel 1 (
  echo.
  echo Синхронизация не удалась.
  exit /b 1
)

echo.
echo Готово: https://drc.ao-nk.online
echo Обновите страницу с очисткой кэша: Ctrl+F5
endlocal
