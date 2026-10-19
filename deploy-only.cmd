@echo off
REM Только деплой уже запушенной ветки main (без commit/push).
REM Запускайте из cmd.exe: C:\IT\DRC\deploy-only.cmd
cd /d "%~dp0"
call "%~dp0push-and-deploy.cmd" /deploy
