@echo off

chcp 65001 >nul 2>&1

setlocal

cd /d "%~dp0"

echo === Сравнение официального XLSX и экспорта с сайта Минтруда ===

if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\compare_two_xlsx.py %*
) else (
  python scripts\compare_two_xlsx.py %*
)

pause
