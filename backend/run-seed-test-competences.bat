@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Создание 10 тестовых компетенций ===
echo.
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\seed_test_competences.py %*
) else (
  python scripts\seed_test_competences.py %*
)
echo.
pause
