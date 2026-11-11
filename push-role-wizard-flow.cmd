@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

REM ============================================================
REM  Push + deploy (текущий пакет ролевого потока + временно снятые
REM  контроли — список на возврат: docs\temp-relaxed-validation.md)
REM
REM  Запуск из cmd.exe:
REM    C:\IT\DRC\push-role-wizard-flow.cmd
REM    C:\IT\DRC\push-role-wizard-flow.cmd /y
REM    C:\IT\DRC\push-role-wizard-flow.cmd /push
REM    C:\IT\DRC\push-role-wizard-flow.cmd /deploy
REM ============================================================

set "MSG=TEMP: restore later — relax TD-ZU/FOS/PS gates for review testing; see docs/temp-relaxed-validation.md"

if /I "%~1"=="/deploy" (
  call "%~dp0push-and-deploy.cmd" /deploy
  exit /b %ERRORLEVEL%
)
if /I "%~1"=="/push" (
  call "%~dp0push-and-deploy.cmd" /push /y "%MSG%"
  exit /b %ERRORLEVEL%
)
if /I "%~1"=="/y" (
  call "%~dp0push-and-deploy.cmd" /y "%MSG%"
  exit /b %ERRORLEVEL%
)

call "%~dp0push-and-deploy.cmd" "%MSG%"
exit /b %ERRORLEVEL%
