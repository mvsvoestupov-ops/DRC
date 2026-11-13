@echo off
REM SWOT-сборка: тот же деплой на CT 228, без демо SWOT на сервере.
REM Из cmd.exe: push-and-deploy-swot.cmd [/y|/push|/deploy|"сообщение"]
cd /d "%~dp0"
set "SEED_SWOT_DEMO=0"
if /I "%~1"=="/deploy" (
  call "%~dp0push-and-deploy.cmd" /deploy
  exit /b %ERRORLEVEL%
)
if /I "%~1"=="/push" (
  call "%~dp0push-and-deploy.cmd" /push %*
  exit /b %ERRORLEVEL%
)
if /I "%~1"=="/y" (
  if not "%~2"=="" (
    call "%~dp0push-and-deploy.cmd" /y %~2
  ) else (
    call "%~dp0push-and-deploy.cmd" /y "feat(swot): deploy to drc.ao-nk.ru"
  )
  exit /b %ERRORLEVEL%
)
if not "%~1"=="" (
  call "%~dp0push-and-deploy.cmd" %*
  exit /b %ERRORLEVEL%
)
call "%~dp0push-and-deploy.cmd" "feat(swot): deploy to drc.ao-nk.ru"
exit /b %ERRORLEVEL%
