@echo off
REM Только commit + push в GitHub (без деплоя на VPS).
cd /d "%~dp0"
call "%~dp0push-and-deploy.cmd" /push %*
