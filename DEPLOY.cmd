@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM ============================================================
REM  Деплой DRC на сервер (commit → push → ssh build/restart)
REM  Запускайте двойным щелчком или из cmd.exe:
REM    C:\IT\DRC\DEPLOY.cmd
REM  Без паузы:
REM    C:\IT\DRC\DEPLOY.cmd /y
REM  Только деплой (код уже в GitHub):
REM    C:\IT\DRC\DEPLOY.cmd /deploy
REM ============================================================

if /I "%~1"=="/deploy" (
  call "%~dp0push-and-deploy.cmd" /deploy
  exit /b %ERRORLEVEL%
)
if /I "%~1"=="/y" (
  call "%~dp0push-and-deploy.cmd" /y
  exit /b %ERRORLEVEL%
)
if not "%~1"=="" (
  call "%~dp0push-and-deploy.cmd" %*
  exit /b %ERRORLEVEL%
)

call "%~dp0push-and-deploy.cmd"
exit /b %ERRORLEVEL%
