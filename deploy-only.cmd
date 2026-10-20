@echo off
REM Только деплой уже запушенной ветки (без commit/push).
REM Из cmd.exe: C:\IT\DRC\deploy-only.cmd
cd /d "%~dp0"
call "%~dp0push-and-deploy.cmd" /deploy
exit /b %ERRORLEVEL%
