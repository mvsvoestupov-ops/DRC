@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

REM ============================================================
REM  Push + deploy: шаг 6 (ОС v2), скрытый 6.0 OLD, сид/содержание
REM
REM  Запуск из cmd.exe:
REM    C:\IT\DRC\deploy-fos-step6.cmd
REM    C:\IT\DRC\deploy-fos-step6.cmd /y          — без паузы
REM    C:\IT\DRC\deploy-fos-step6.cmd /push       — только commit+push
REM    C:\IT\DRC\deploy-fos-step6.cmd /deploy     — только ssh-деплой
REM ============================================================

set "SSH_HOST=201.34.149.65"
set "SSH_PORT=22"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
set "REMOTE_DIR=/opt/drc"
set "BRANCH=main"
set "VITE_API_URL=https://drc.ao-nk.online/api"
set "SITE_URL=https://drc.ao-nk.online"
set "COMMIT_MSG=ФОС: шаг 6 = ОС v2, шаг 6.0 OLD скрыт; сид практики и доступ к Содержанию"

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
echo  Деплой ФОС шаг 6 / скрытый 6.0 OLD
echo ============================================================
echo Репозиторий: %CD%
echo Ветка:       %BRANCH%
echo Сервер:      %SSH_USER%@%SSH_HOST%  %REMOTE_DIR%
echo Сайт:        %SITE_URL%
echo Коммит:      %COMMIT_MSG%
if defined PUSH_ONLY echo Режим:       только commit + push
echo.
echo В индекс:
echo   - AssessmentConstructor* / assessmentV2 / assessmentConstructor
echo   - NewCompetencyPage ^(скрытие 6.0, подписи шагов^)
echo   - i18n, types, vitest, backend assessment_tools_v2
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
echo == stage FOS step 6 files
git add -- ^
  "frontend/src/lib/assessmentV2.ts" ^
  "frontend/src/lib/assessmentV2.test.ts" ^
  "frontend/src/lib/assessmentConstructor.ts" ^
  "frontend/src/app/components/AssessmentConstructor.tsx" ^
  "frontend/src/app/components/AssessmentConstructorV2.tsx" ^
  "frontend/src/app/components/AssessmentTestingFields.tsx" ^
  "frontend/src/app/pages/NewCompetencyPage.tsx" ^
  "frontend/src/api/types.ts" ^
  "frontend/src/i18n/extraRu.ts" ^
  "frontend/src/i18n/extraEn.ts" ^
  "frontend/src/i18n/extraVi.ts" ^
  "frontend/src/i18n/extraHi.ts" ^
  "frontend/src/i18n/extraZh.ts" ^
  "frontend/package.json" ^
  "frontend/pnpm-lock.yaml" ^
  "frontend/vitest.config.ts" ^
  "backend/app/main.py" ^
  "backend/app/activity.py" ^
  "deploy-fos-step6.cmd" ^
  "deploy-fos-step6-now.cmd" ^
  "deploy-step61-assessment.cmd" ^
  "deploy-step61-assessment-now.cmd"

if errorlevel 1 (
  echo Ошибка git add.
  exit /b 1
)

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
  echo Push готов. Деплой: deploy-fos-step6.cmd /deploy
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
echo Проверьте: шаг 6 = ОС v2, шаг 6.0 OLD не виден в навигаторе.
endlocal
exit /b 0
