@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Догрузка недостающих квалификаций с nok-nark.ru ===
echo Рекомендуется: run-fetch-missing-qualifications.bat
echo   (обход по ОПД/СПК — без пустых ответов после page 375)
echo.
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\fetch_qualifications.py --only-missing %*
) else (
  python scripts\fetch_qualifications.py --only-missing %*
)
echo.
pause
