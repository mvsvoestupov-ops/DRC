@echo off
chcp 65001 >nul
cd /d C:\IT\DRC
set "LOG=C:\IT\DRC\backend\scripts\output\_agent_push_deploy.log"
if not exist "backend\scripts\output" mkdir "backend\scripts\output"
echo === %date% %time% === > "%LOG%"
echo. >> "%LOG%"
echo == git status -sb == >> "%LOG%"
git status -sb >> "%LOG%" 2>&1
echo. >> "%LOG%"
git add backend/app/repair_missing_tf_from_html.py backend/scripts/repair_missing_tf_from_html.py deploy-remote.sh
if errorlevel 1 (
  echo git add FAILED >> "%LOG%"
  exit /b 1
)
git commit -m "fix: stream missing-TF HTML repair to avoid OOM on deploy" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo commit exit: %errorlevel% >> "%LOG%"
)
for /f "delims=" %%h in ('git rev-parse HEAD 2^>nul') do set COMMIT=%%h
echo COMMIT_HASH=%COMMIT% >> "%LOG%"
echo. >> "%LOG%"
echo == git push == >> "%LOG%"
git push -u origin main >> "%LOG%" 2>&1
set PUSH_RC=%errorlevel%
echo PUSH_RC=%PUSH_RC% >> "%LOG%"
if %PUSH_RC% neq 0 exit /b %PUSH_RC%
echo. >> "%LOG%"
echo == deploy only == >> "%LOG%"
call push-and-deploy.cmd /deploy >> "%LOG%" 2>&1
set DEPLOY_RC=%errorlevel%
echo DEPLOY_RC=%DEPLOY_RC% >> "%LOG%"
exit /b %DEPLOY_RC%
