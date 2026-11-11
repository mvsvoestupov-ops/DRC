@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

REM ============================================================
REM  Push + deploy: ролевой поток конструктора + шаги 9–9.2
REM
REM  В коммит:
REM  - шаг 7: «Направить на экспертизу» только у руководителя
REM  - участники не проходят дальше МТО
REM  - валидация ОС по конструктору V2 (не legacy)
REM  - после статуса «действующая» открываются шаги 9 / 9.1 / 9.2
REM  - кнопки продолжения на карточке и в «Моих проектах»
REM
REM  Запуск из cmd.exe (не из PowerShell Cursor):
REM    C:\IT\DRC\push-role-wizard-flow.cmd
REM    C:\IT\DRC\push-role-wizard-flow.cmd /y
REM    C:\IT\DRC\push-role-wizard-flow.cmd /push
REM    C:\IT\DRC\push-role-wizard-flow.cmd /deploy
REM ============================================================

set "MSG=fix: role-gated wizard submit, V2 FOS gate, unlock steps 9-9.2 after active status"

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
