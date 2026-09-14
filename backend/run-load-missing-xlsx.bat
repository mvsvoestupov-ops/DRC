@echo off
setlocal
cd /d "%~dp0"
echo === Догрузка недостающих ПС (classinform.ru + XLSX) ===
if not exist "scripts\output\missing_vs_xlsx_2026.json" (
  echo Сначала запустите run-compare-xlsx.bat
  pause
  exit /b 1
)
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\load_missing_from_xlsx.py
) else (
  python scripts\load_missing_from_xlsx.py
)
pause
