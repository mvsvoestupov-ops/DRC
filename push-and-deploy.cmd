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
set "COMMIT_MSG=Harmoni-BRICS шаг 9.1, методика и ИИ-агент"
REM ==================================================

REM Запуск из cmd.exe (не из PowerShell-обёртки Cursor):
REM   C:\IT\DRC\push-and-deploy.cmd
REM Без подтверждения:
REM   C:\IT\DRC\push-and-deploy.cmd /y
REM Только деплой уже запушенной ветки:
REM   C:\IT\DRC\push-and-deploy.cmd /deploy
REM Свой текст коммита:
REM   C:\IT\DRC\push-and-deploy.cmd "свой текст коммита"

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
echo   1. git add + commit текущих правок
echo   2. git push origin %BRANCH%
echo   3. ssh: pull, pip без torch/CUDA, ремонт ТФ/ОТФ,
echo      seed примеров, сборка фронта, restart backend, nginx
echo.
echo Не попадёт в коммит:
echo   backend/.env, frontend/.env, venv, profstandart.db,
echo   пароли, чаты, PassForDRC_mail.txt, frontend_old_backup
echo.
echo На сервере нужен свой backend/.env ^(в т.ч. DEEPSEEK_API_KEY для ИИ-агента^).
echo Локальный .env на VPS не копируется.
echo.
echo Файл базы на сервере не подменяется.
echo SSH спросит пароль, если ключа нет.
echo.
git status
echo.
echo Enter = commit + push + deploy. Ctrl+C = отмена.
pause >nul

:ready
echo.

git add -A

REM Снять с индекса секреты и тяжёлые/локальные артефакты
git restore --staged -- ^
  "backend/.env" ^
  "frontend/.env" ^
  ".env" ^
  "chat 2.txt" ^
  "chat_290726.txt" ^
  "chat_Фулстек-разработчик_20260728_170951.txt" ^
  "frontend_old_backup" ^
  "DRCFigma" ^
  "пароли и команды.txt" ^
  "PassForDRC_mail.txt" ^
  "backend/venv" ^
  "backend/profstandart.db" 2>nul

REM На всякий случай: не коммитить ключ, если его снова вписали в example
findstr /C:"sk-" "backend\.env.example" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo ОШИБКА: в backend\.env.example похоже лежит API-ключ.
  echo Перенесите ключ в backend\.env и очистите .env.example.
  exit /b 1
)

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
  echo Деплой не прошёл.
  echo   - порт: SSH_PORT в начале push-and-deploy.cmd
  echo   - ключ: SSH_KEY
  echo   - только деплой без push: push-and-deploy.cmd /deploy
  exit /b 1
)

echo.
echo Готово: https://drc.ao-nk.online
echo Методика Harmoni-BRICS: https://drc.ao-nk.online/methodology/harmoni-brics
echo.
echo Если ИИ-агент на сервере без ключа:
echo   ssh на VPS и пропишите DEEPSEEK_API_KEY в %REMOTE_DIR%/backend/.env
echo   затем: systemctl restart drc-backend   ^(или ваш unit^)
endlocal
exit /b 0
