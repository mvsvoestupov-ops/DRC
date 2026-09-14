@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Анализ пропусков индекса НАРК ===
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\analyze_nark_gap.py
) else (
  python scripts\analyze_nark_gap.py
)
echo.
pause
