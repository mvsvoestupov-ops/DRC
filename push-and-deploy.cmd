@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

REM === правьте только этот блок при необходимости ===
set "SSH_HOST=201.34.149.65"
set "SSH_PORT=22"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
set "REMOTE_DIR=/opt/drc"
set "BRANCH=main"
set "VITE_API_URL=https://drc.ao-nk.online/api"
set "COMMIT_MSG=DRC: ОКСО из XML/HTML в списке ПС, деплой без OOM-разбора HTML"
REM ==================================================

REM Запуск из cmd:
REM   C:\IT\DRC\push-and-deploy.cmd
REM Без подтверждения:
REM   C:\IT\DRC\push-and-deploy.cmd /y
REM Только деплой уже запушенной ветки:
REM   C:\IT\DRC\push-and-deploy.cmd /deploy

if /I "%~1"=="/deploy" goto :deploy
if /I "%~1"=="/y" goto :ready
if not "%~1"=="" set "COMMIT_MSG=%~1"

echo.
echo Репозиторий: %CD%
echo Ветка:       %BRANCH%
echo Сервер:      %SSH_USER%@%SSH_HOST%:%SSH_PORT%  %REMOTE_DIR%
echo Коммит:      %COMMIT_MSG%
echo.
echo Что сделает скрипт:
echo   1. git commit текущих правок
echo   2. git push origin %BRANCH%
echo   3. ssh: pull, pip без torch/CUDA, ремонт ТФ/ОТФ в существующей БД,
echo      seed 0019/0020, сборка фронта с VITE_API_URL, nginx
echo.
echo Файл базы на сервере не подменяется.
echo Чаты, пароли, .env, venv, profstandart.db и frontend_old_backup в коммит не попадут.
echo SSH спросит пароль, если ключа нет.
echo.
git status
echo.
echo Enter = commit + push + deploy. Ctrl+C = отмена.
pause >nul

:ready
echo.

git add -A
git restore --staged -- ^
  "chat 2.txt" ^
  "chat_290726.txt" ^
  "chat_Фулстек-разработчик_20260728_170951.txt" ^
  "frontend_old_backup" ^
  "DRCFigma" ^
  "пароли и команды.txt" ^
  "PassForDRC_mail.txt" ^
  "frontend/.env" ^
  "backend/venv" ^
  "backend/profstandart.db" 2>nul

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%COMMIT_MSG%"
  if errorlevel 1 (
    echo Ошибка git commit.
    exit /b 1
  )
) else (
  echo Нечего коммитить, пушу текущий HEAD.
)

echo.
echo == git push origin %BRANCH%
git push origin %BRANCH%
if errorlevel 1 (
  echo Ошибка git push.
  exit /b 1
)

:deploy
set "SSH_OPTS=-p %SSH_PORT%"
if exist "%SSH_KEY%" (
  set "SSH_OPTS=-i %SSH_KEY% -p %SSH_PORT%"
  echo SSH-ключ: %SSH_KEY%
) else (
  echo Ключ не найден: %SSH_KEY%
  echo Пробую обычный ssh без -i
)

echo.
echo == deploy %SSH_USER%@%SSH_HOST%
type "%~dp0deploy-remote.sh" | ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "export VITE_API_URL=%VITE_API_URL% BRANCH=%BRANCH% REMOTE_DIR=%REMOTE_DIR%; tr -d '\r' | bash -s"
if errorlevel 1 (
  echo.
  echo Деплой не прошёл. Если ssh ругается на порт, в начале файла поставьте SSH_PORT=2222
  echo Если ключ в другом месте — поправьте SSH_KEY.
  exit /b 1
)

echo.
echo Готово: https://drc.ao-nk.online
endlocal
