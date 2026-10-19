@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\_verify_okz_repair.py %*
) else (
  python scripts\_verify_okz_repair.py %*
)
