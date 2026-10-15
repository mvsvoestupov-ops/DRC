@echo off
REM Только деплой уже запушенной ветки main (без commit/push).
cd /d "%~dp0"
call "%~dp0push-and-deploy.cmd" /deploy
