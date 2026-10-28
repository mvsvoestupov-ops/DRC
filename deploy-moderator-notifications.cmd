@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

REM ============================================================
REM  Push + deploy: уведомления модератора + запрет разработки
REM
REM  Запуск из cmd.exe (не PowerShell Cursor):
REM    C:\IT\DRC\deploy-moderator-notifications.cmd
REM    C:\IT\DRC\deploy-moderator-notifications.cmd /y          — без паузы
REM    C:\IT\DRC\deploy-moderator-notifications.cmd /push       — только commit+push
REM    C:\IT\DRC\deploy-moderator-notifications.cmd /deploy     — только ssh-деплой
REM    C:\IT\DRC\deploy-moderator-notifications-now.cmd         — /y + pause в конце
REM ============================================================

set "SSH_HOST=201.34.149.65"
set "SSH_PORT=22"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
set "REMOTE_DIR=/opt/drc"
set "BRANCH=main"
set "VITE_API_URL=https://drc.ao-nk.online/api"
set "SITE_URL=https://drc.ao-nk.online"
set "COMMIT_MSG=Модератор: уведомления (шаг 7 МТО / экспертиза) и запрет участия в разработке компетенций"

set "SKIP_PAUSE="
set "PUSH_ONLY="

if /I "%~1"=="/deploy" goto :deploy
if /I "%~1"=="/push" (
  set "PUSH_ONLY=1"
  if /I "%~2"=="/y" set "SKIP_PAUSE=1"
  goto :after_args
)
if /I "%~1"=="/y" set "SKIP_PAUSE=1"
if not "%~1"=="" if /I not "%~1"=="/y" if /I not "%~1"=="/push" set "COMMIT_MSG=%~1"

:after_args
if defined SKIP_PAUSE goto :ready

echo.
echo ============================================================
echo  Деплой: уведомления модератора / запрет разработки
echo ============================================================
echo Репозиторий: %CD%
echo Ветка:       %BRANCH%
echo Сервер:      %SSH_USER%@%SSH_HOST%  %REMOTE_DIR%
echo Сайт:        %SITE_URL%
echo Коммит:      %COMMIT_MSG%
if defined PUSH_ONLY echo Режим:       только commit + push
echo.
echo В индекс ^(этот релиз^):
echo   - Notification model + /notifications API
echo   - notify_moderators ^(шаг 7 МТО, отправка на экспертизу^)
echo   - запрет create/update/delete/invite для role=moderator
echo   - NotificationBell, скрытие «Предложить» / создания проектов
echo   - i18n notifications / projects.emptyModerator
echo.
echo Не войдут: _pull_*, competence dumps, .env, venv, ESCO, локальная БД
echo.
echo Enter = продолжить. Ctrl+C = отмена.
pause >nul

:ready
where git >nul 2>&1
if errorlevel 1 (
  echo Ошибка: git не найден в PATH.
  exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo Ошибка: это не git-репозиторий.
  exit /b 1
)

echo.
echo == stage moderator notifications / development ban
git add -- ^
  "backend/app/db/__init__.py" ^
  "backend/app/db/notification_models.py" ^
  "backend/app/notifications.py" ^
  "backend/app/main.py" ^
  "frontend/src/api/client.ts" ^
  "frontend/src/app/components/Layout.tsx" ^
  "frontend/src/app/components/NotificationBell.tsx" ^
  "frontend/src/app/pages/HomePage.tsx" ^
  "frontend/src/app/pages/MyProjectsPage.tsx" ^
  "frontend/src/app/pages/NewCompetencyPage.tsx" ^
  "frontend/src/i18n/extraRu.ts" ^
  "frontend/src/i18n/extraEn.ts" ^
  "frontend/src/i18n/extraHi.ts" ^
  "frontend/src/i18n/extraZh.ts" ^
  "frontend/src/i18n/extraVi.ts" ^
  "deploy-moderator-notifications.cmd" ^
  "deploy-moderator-notifications-now.cmd"

if errorlevel 1 (
  echo Ошибка git add.
  exit /b 1
)

git restore --staged -- ^
  "backend/.env" ^
  "frontend/.env" ^
  ".env" ^
  "backend/venv" ^
  "backend/profstandart.db" 2>nul

echo.
echo == staged files
git diff --cached --name-only
echo.

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%COMMIT_MSG%"
  if errorlevel 1 (
    echo Ошибка git commit.
    exit /b 1
  )
) else (
  echo Нечего коммитить по списку — пушу текущий HEAD.
)

echo.
echo == git push origin %BRANCH%
git push -u origin %BRANCH%
if errorlevel 1 (
  echo Ошибка git push.
  exit /b 1
)

if defined PUSH_ONLY (
  echo.
  echo Push готов. Деплой: deploy-moderator-notifications.cmd /deploy
  endlocal
  exit /b 0
)

:deploy
where ssh >nul 2>&1
if errorlevel 1 (
  echo Ошибка: ssh не найден. Установите OpenSSH Client.
  exit /b 1
)

if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

echo.
echo == deploy %SSH_USER%@%SSH_HOST% → %REMOTE_DIR%
if exist "%SSH_KEY%" (
  echo SSH-ключ: %SSH_KEY%
  type "%~dp0deploy-remote.sh" | ssh -i "%SSH_KEY%" -p %SSH_PORT% -o StrictHostKeyChecking=accept-new %SSH_USER%@%SSH_HOST% "export VITE_API_URL=%VITE_API_URL% BRANCH=%BRANCH% REMOTE_DIR=%REMOTE_DIR%; tr -d '\r' | bash -s"
) else (
  echo SSH-ключ не найден — пробую без -i ^(пароль / агент^)
  type "%~dp0deploy-remote.sh" | ssh -p %SSH_PORT% -o StrictHostKeyChecking=accept-new %SSH_USER%@%SSH_HOST% "export VITE_API_URL=%VITE_API_URL% BRANCH=%BRANCH% REMOTE_DIR=%REMOTE_DIR%; tr -d '\r' | bash -s"
)
if errorlevel 1 (
  echo.
  echo Деплой не прошёл.
  exit /b 1
)

echo.
echo Готово: %SITE_URL%
echo Проверьте под учёткой moderator:
echo   - колокольчик в шапке, уведомления после шага 7 и отправки на экспертизу
echo   - нет «Предложить компетенцию» / создания проектов; /new → Модерация
echo   - назначение ≥3 экспертов на заявке «на экспертизе» по-прежнему работает
endlocal
exit /b 0
