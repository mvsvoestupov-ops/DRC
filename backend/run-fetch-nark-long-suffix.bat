@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Догрузка квалификаций НАРК с длинным суффиксом (40.20900.100–310) ===
echo.
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\fetch_nark_long_suffix.py %*
) else (
  python scripts\fetch_nark_long_suffix.py %*
)
echo.
pause
