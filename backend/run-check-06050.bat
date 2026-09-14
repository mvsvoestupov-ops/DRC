@echo off

chcp 65001 >nul 2>&1

setlocal

cd /d "%~dp0"

echo === Проверка дубликата кода ПС 06.050 (reg 1586 / 1587) ===

if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\check_duplicate_ps_code.py 06.050 %*
) else (
  python scripts\check_duplicate_ps_code.py 06.050 %*
)

pause
