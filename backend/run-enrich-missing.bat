@echo off
setlocal
cd /d "%~dp0"
echo === Обогащение недостающих профстандартов ===
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\enrich_missing_standards.py %*
) else (
  python scripts\enrich_missing_standards.py %*
)
pause
