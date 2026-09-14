@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Загрузка оценочных средств с nok-nark.ru ===
echo Связь с квалификациями — по коду (ОС = квалификация + .NNN)
echo.
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\fetch_assessment_tools.py --only-missing %*
) else (
  python scripts\fetch_assessment_tools.py --only-missing %*
)
echo.
pause
