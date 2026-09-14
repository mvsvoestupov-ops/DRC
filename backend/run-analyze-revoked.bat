@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Диагностика подсчёта «утратил силу» в XLSX ===
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\analyze_revoked_count.py
) else (
  python scripts\analyze_revoked_count.py
)
pause
