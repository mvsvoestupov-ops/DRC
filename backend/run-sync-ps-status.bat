@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Синхронизация status/revoked_date из XLSX ===
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\sync_ps_status_from_xlsx.py
) else (
  python scripts\sync_ps_status_from_xlsx.py
)
pause
