@echo off
cd /d C:\IT\DRC\backend
REM Пример: полный backfill с паузой. Для теста: --limit 5
venv\Scripts\python.exe scripts\backfill_ps_maket.py %*
echo Exit: %ERRORLEVEL%
