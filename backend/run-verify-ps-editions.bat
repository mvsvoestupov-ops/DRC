@echo off

chcp 65001 >nul 2>&1

setlocal

cd /d "%~dp0"

echo === Проверка актуальности редакций ПС ===

if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\verify_ps_editions.py %*
) else (
  python scripts\verify_ps_editions.py %*
)

pause
