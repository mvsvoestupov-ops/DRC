@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

REM ============================================================
REM  Push + deploy SWOT (без тестовых данных на сервере)
REM
REM  Запускайте из cmd.exe (не PowerShell Cursor):
REM    push-and-deploy-swot.cmd
REM    push-and-deploy-swot.cmd /y
REM    push-and-deploy-swot.cmd /deploy
REM    push-and-deploy-swot.cmd /push
REM
REM  На сервере НЕ заполняет демо SWOT (SEED_SWOT_DEMO=0).
REM  БД, backend/.env и секреты не перезаписываются.
REM ============================================================

set "SSH_HOST=201.34.149.65"
set "SSH_PORT=22"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
set "REMOTE_DIR=/opt/drc"
set "BRANCH=main"
set "VITE_API_URL=https://drc.ao-nk.online/api"
set "SITE_URL=https://drc.ao-nk.online"
set "COMMIT_MSG=feat(swot): summary archive, clear tables, quadrant colors, strict synthesize"
set "SEED_SWOT_DEMO=0"

set "SKIP_PAUSE="
set "PUSH_ONLY="

if /I "%~1"=="/deploy" goto :deploy

if /I "%~1"=="/push" (
  set "PUSH_ONLY=1"
  if /I "%~2"=="/y" set "SKIP_PAUSE=1"
  if not "%~2"=="" if /I not "%~2"=="/y" set "COMMIT_MSG=%~2"
  goto :after_args
)
if /I "%~1"=="/y" (
  set "SKIP_PAUSE=1"
  goto :after_args
)
if not "%~1"=="" set "COMMIT_MSG=%~1"

:after_args
if defined SKIP_PAUSE goto :ready

echo.
echo === DRC push + deploy (SWOT, без тестовых данных) ===
echo Репозиторий: %CD%
echo Ветка:       %BRANCH%
echo Сервер:      %SSH_USER%@%SSH_HOST%:%SSH_PORT%  %REMOTE_DIR%
echo Сайт:        %SITE_URL%
echo Коммит:      %COMMIT_MSG%
echo SWOT demo:   SEED_SWOT_DEMO=%SEED_SWOT_DEMO% (на сервер не льём)
if defined PUSH_ONLY echo Режим:       только commit + push
echo.
echo Шаги:
echo   1. git add + commit ^(без секретов и локальной БД^)
echo   2. git push origin %BRANCH%
if not defined PUSH_ONLY (
  echo   3. ssh: pull, pip, repair, seed example competences,
  echo      build frontend, restart backend, nginx
  echo      ^(SWOT demo seed НЕ выполняется^)
)
echo.
echo Не попадёт в коммит:
echo   backend/.env, frontend/.env, venv, profstandart.db, ESCO/,
echo   пароли, чаты, PassForDRC_mail.txt, frontend_old_backup
echo.
git status -sb
echo.
echo Enter = продолжить. Ctrl+C = отмена.
pause >nul

:ready
echo.

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

git add -A

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
  "Локальный старт.txt" ^
  "backend/venv" ^
  "backend/profstandart.db" ^
  "ESCO" ^
  "ESCO/esco-v1.2.0.rdf" 2>nul

git diff --cached --name-only | findstr /I /C:"esco-v1.2.0.rdf" /C:"ESCO/" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo ОШИБКА: в коммит попал каталог ESCO ^(дамп ^>100 MB^).
  echo Сначала: fix-push-lfs.cmd
  exit /b 1
)

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
  echo Нечего коммитить — пушу текущий HEAD.
)

echo.
echo == проверка: ESCO не в незапушенных коммитах
git fetch origin %BRANCH% 2>nul
git rev-list --objects origin/%BRANCH%..HEAD 2>nul | findstr /I /C:"ESCO/" /C:"esco-v1.2.0.rdf" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo ОШИБКА: ESCO RDF всё ещё в истории локальных коммитов.
  echo GitHub отклонит push. Запустите: fix-push-lfs.cmd
  exit /b 1
)

echo.
echo == git push origin %BRANCH%
git push -u origin %BRANCH%
if errorlevel 1 (
  echo Ошибка git push.
  echo Если снова GH001 Large files — запустите: fix-push-lfs.cmd
  exit /b 1
)

if defined PUSH_ONLY (
  echo.
  echo Push готов. Деплой: push-and-deploy-swot.cmd /deploy
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

set "SSH_OPTS=-p %SSH_PORT% -o StrictHostKeyChecking=accept-new"
if exist "%SSH_KEY%" (
  set SSH_OPTS=-i %SSH_KEY% -p %SSH_PORT% -o StrictHostKeyChecking=accept-new
  echo SSH-ключ: %SSH_KEY%
) else (
  echo Ключ не найден в %%USERPROFILE%%\.ssh
  echo Пробую ssh без -i ^(пароль / агент^)
)

echo.
echo == deploy %SSH_USER%@%SSH_HOST% → %REMOTE_DIR% ^(SEED_SWOT_DEMO=%SEED_SWOT_DEMO%^)
type "%~dp0deploy-remote.sh" | ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "export VITE_API_URL=%VITE_API_URL% BRANCH=%BRANCH% REMOTE_DIR=%REMOTE_DIR% SEED_SWOT_DEMO=%SEED_SWOT_DEMO%; tr -d '\r' | bash -s"
if errorlevel 1 (
  echo.
  echo Деплой не прошёл.
  echo   - порт/хост: SSH_HOST / SSH_PORT в начале скрипта
  echo   - ключ: SSH_KEY=%SSH_KEY%
  echo   - только деплой: push-and-deploy-swot.cmd /deploy
  exit /b 1
)

echo.
echo Готово: %SITE_URL%
echo SWOT:   %SITE_URL%/swot
echo Итого:  %SITE_URL%/admin/swot
echo.
echo Тестовые SWOT-данные на сервер НЕ заливались.
echo Ключ ИИ на сервере деплой не трогает ^(backend/.env сохраняется^).
endlocal
exit /b 0
