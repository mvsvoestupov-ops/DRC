@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Обновление администратора ===
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\create_test_users.py
) else (
  python scripts\create_test_users.py
)
pause
