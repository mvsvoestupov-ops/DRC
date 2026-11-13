@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

REM === конфигурация сервера АО НК (CT 228) ===
set "JUMP_HOST=10.100.4.20"
set "SSH_PORT=22"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
set "PCT_ID=228"
set "REMOTE_DIR=/opt/drc"
set "BRANCH=main"
set "GIT_URL=git@git.ao-nk.site:svoestupov/drc.git"
set "VITE_API_URL=https://drc.ao-nk.ru/api"
set "SITE_URL=https://drc.ao-nk.ru"
set "COMMIT_MSG=chore: deploy"
REM Деплой как в ps-control: код только из GitLab → на hv1 pct exec + git pull.
REM SSH с ПК на JUMP_HOST часто недоступен — тогда одна команда на консоли hv1.
REM Старый TimeWeb (справка): 201.34.149.65 / drc.ao-nk.online → 301 на .ru
REM =====================================================

REM Запускайте из cmd.exe (не PowerShell Cursor):
REM   push-and-deploy.cmd              — пауза → commit + push + deploy
REM   push-and-deploy.cmd /y           — без паузы
REM   push-and-deploy.cmd /push        — только commit + push
REM   push-and-deploy.cmd /deploy      — только деплой уже запушенной ветки
REM   deploy-only.cmd                  — то же, что /deploy
REM   push-and-deploy.cmd "текст"      — свой commit message
REM
REM Push: GitHub (origin) + GitLab (gitlab). Деплой: CT тянет git@git.ao-nk.site.
REM ESCO RDF на сервер отдельно: upload-esco-to-server.cmd

set "SKIP_PAUSE="
set "PUSH_ONLY="

if /I "%~1"=="/deploy" goto :deploy

if /I "%~1"=="/push" (
  set "PUSH_ONLY=1"
  if /I "%~2"=="/y" (
    set "SKIP_PAUSE=1"
    if not "%~3"=="" set "COMMIT_MSG=%~3"
  ) else if not "%~2"=="" (
    set "COMMIT_MSG=%~2"
  )
  goto :after_args
)
if /I "%~1"=="/y" (
  set "SKIP_PAUSE=1"
  if not "%~2"=="" set "COMMIT_MSG=%~2"
  goto :after_args
)
if not "%~1"=="" set "COMMIT_MSG=%~1"

:after_args
if defined SKIP_PAUSE goto :ready

echo.
echo Репозиторий: %CD%
echo Ветка:       %BRANCH%
echo Прыжок:      %SSH_USER%@%JUMP_HOST%:%SSH_PORT%  → CT %PCT_ID%  %REMOTE_DIR%
echo GitLab:      %GIT_URL%
echo Сайт:        %SITE_URL%
echo Коммит:      %COMMIT_MSG%
if defined PUSH_ONLY echo Режим:       только commit + push
echo.
echo Шаги:
echo   1. git add + commit ^(без секретов и локальной БД^)
echo   2. git push origin + gitlab %BRANCH%
if not defined PUSH_ONLY (
  echo   3. деплой: pct exec %PCT_ID% git pull из GitLab + build/restart
  echo      ^(SSH на %JUMP_HOST% если есть, иначе команда на hv1^)
)
echo.
echo Не попадёт в коммит:
echo   backend/.env, frontend/.env, venv, profstandart.db, ESCO/,
echo   пароли, чаты, PassForDRC_mail.txt, frontend_old_backup
echo.
echo На сервере свой backend/.env ^(DEEPSEEK_API_KEY^). БД не перезаписывается.
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
  "Локальный старт.txt" ^
  "_drc-online-redirect.conf" ^
  "backend/venv" ^
  "backend/profstandart.db" ^
  "ESCO" ^
  "ESCO/esco-v1.2.0.rdf" 2>nul

REM Блокировать commit/push, если в индексе снова оказался огромный RDF
git diff --cached --name-only | findstr /I /C:"esco-v1.2.0.rdf" /C:"ESCO/" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo ОШИБКА: в коммит попал каталог ESCO ^(дамп ^>100 MB^).
  echo Сначала: fix-push-lfs.cmd
  exit /b 1
)

REM Не коммитить ключ, если его снова вписали в example
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
echo == git push origin %BRANCH% ^(GitHub^)
git push -u origin %BRANCH%
if errorlevel 1 (
  echo Ошибка git push origin.
  echo Если снова GH001 Large files — запустите: fix-push-lfs.cmd
  exit /b 1
)

echo.
echo == git push gitlab %BRANCH%
git remote get-url gitlab >nul 2>&1
if errorlevel 1 (
  git remote add gitlab %GIT_URL%
)
REM Для git/ssh на Windows — только прямые слэши в пути к ключу
set "SSH_KEY_UNIX=%USERPROFILE:\=/%"
if exist "%USERPROFILE%\.ssh\id_ed25519" (
  set "SSH_KEY_UNIX=%SSH_KEY_UNIX%/.ssh/id_ed25519"
) else (
  set "SSH_KEY_UNIX=%SSH_KEY_UNIX%/.ssh/id_ed25519_drc"
)
set "GIT_SSH_COMMAND=C:/Windows/System32/OpenSSH/ssh.exe -i %SSH_KEY_UNIX% -o IdentitiesOnly=yes"
git push -u gitlab %BRANCH%
if errorlevel 1 (
  echo Ошибка git push gitlab.
  echo Проверьте VPN и: ssh -T git@git.ao-nk.site
  exit /b 1
)
set "GIT_SSH_COMMAND="

if defined PUSH_ONLY (
  echo.
  echo Push готов. Деплой: deploy-only.cmd  или  push-and-deploy.cmd /deploy
  endlocal
  exit /b 0
)

:deploy
REM Не оставлять GIT_SSH_COMMAND — иначе мешает обычному ssh
set "GIT_SSH_COMMAND="

REM По умолчанию без SWOT-демо на сервере. Для демо: set SEED_SWOT_DEMO=1
if not defined SEED_SWOT_DEMO set "SEED_SWOT_DEMO=0"

REM Ключ: заданный → id_ed25519 → id_ed25519_drc → id_rsa → агент/пароль
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_ed25519_drc" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

set "SSH_IDENTITY="
if exist "%SSH_KEY%" (
  set "SSH_IDENTITY=%SSH_KEY:\=/%"
  echo SSH-ключ: %SSH_KEY%
) else (
  echo Ключ не найден в %%USERPROFILE%%\.ssh — пробую ssh без -i
)

echo.
echo == deploy: GitLab → CT %PCT_ID% %REMOTE_DIR% ^(через %SSH_USER%@%JUMP_HOST%^)

where ssh >nul 2>&1
if errorlevel 1 goto :deploy_manual

REM Как ps-control: pipe remote script → ssh hv1 → pct exec bash -s
if defined SSH_IDENTITY (
  type "%~dp0scripts\remote-pull-deploy.sh" | ssh -p %SSH_PORT% -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new -i "%SSH_IDENTITY%" %SSH_USER%@%JUMP_HOST% "pct exec %PCT_ID% -- env VITE_API_URL=%VITE_API_URL% BRANCH=%BRANCH% GIT_URL=%GIT_URL% REMOTE_DIR=%REMOTE_DIR% SEED_SWOT_DEMO=%SEED_SWOT_DEMO% bash -s"
) else (
  type "%~dp0scripts\remote-pull-deploy.sh" | ssh -p %SSH_PORT% -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new %SSH_USER%@%JUMP_HOST% "pct exec %PCT_ID% -- env VITE_API_URL=%VITE_API_URL% BRANCH=%BRANCH% GIT_URL=%GIT_URL% REMOTE_DIR=%REMOTE_DIR% SEED_SWOT_DEMO=%SEED_SWOT_DEMO% bash -s"
)
if errorlevel 1 goto :deploy_manual
goto :deploy_done

:deploy_manual
echo.
echo SSH до hv1 с этой машины нет — это нормально. Код уже в GitLab.
echo На hv1 ^(консоль Proxmox / терминальный сервер^) выполните:
echo.
echo pct exec %PCT_ID% -- bash -lc "cd %REMOTE_DIR% && git fetch origin %BRANCH% && git reset --hard origin/%BRANCH% && export VITE_API_URL=%VITE_API_URL% BRANCH=%BRANCH% GIT_URL=%GIT_URL% REMOTE_DIR=%REMOTE_DIR% SEED_SWOT_DEMO=%SEED_SWOT_DEMO% && bash ./deploy-remote.sh"
echo.
echo Пришлите хвост вывода. Сайт после деплоя: %SITE_URL%
endlocal
exit /b 0

:deploy_done
echo.
echo Готово: %SITE_URL%
echo Методика: %SITE_URL%/methodology/harmonization
echo Harmoni-BRICS: %SITE_URL%/methodology/harmoni-brics
echo.
echo Ключ ИИ на сервере деплой не трогает ^(backend/.env сохраняется^).
echo Статус ключа смотрите выше в логе remote: «DEEPSEEK_API_KEY задан» или WARNING.
endlocal
exit /b 0
