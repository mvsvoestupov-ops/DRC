@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

REM ============================================================
REM  Push + deploy: ролевой поток конструктора
REM  - разработка останавливается на шаге 7 (МТО)
REM  - руководитель подтверждает отправку на валидацию → шаг 8
REM  - модератор/админ назначают экспертов, эксперты проводят экспертизу
REM  - после утверждения UI-статус «действующая», шаги 9+ открываются
REM
REM  Запуск из cmd.exe (не из PowerShell Cursor):
REM    C:\IT\DRC\push-role-wizard-flow.cmd
REM    C:\IT\DRC\push-role-wizard-flow.cmd /y
REM    C:\IT\DRC\push-role-wizard-flow.cmd /push
REM    C:\IT\DRC\push-role-wizard-flow.cmd /deploy
REM ============================================================

set "MSG=fix: restore role-gated wizard — stop at step 7, validation at 8, active after expertise"

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
