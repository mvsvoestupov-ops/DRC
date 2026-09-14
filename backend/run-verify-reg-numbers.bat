@echo off

chcp 65001 >nul 2>&1

setlocal

cd /d "%~dp0"

echo === Проверка рег. номеров ПС (XLSX vs БД) ===

if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\verify_reg_numbers_in_db.py %*
) else (
  python scripts\verify_reg_numbers_in_db.py %*
)

pause
