@echo off
setlocal
cd /d "%~dp0"
echo === Анализ недостающих профстандартов ===
echo Рабочая папка: %CD%
echo.

if not exist "scripts\output" mkdir "scripts\output"

if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\analyze_missing_standards.py
) else (
  python scripts\analyze_missing_standards.py
)

set ERR=%ERRORLEVEL%
echo.
if exist "missing_standards_report.txt" (
  echo Готово. Отчёт:
  echo   %CD%\missing_standards_report.txt
  echo   %CD%\scripts\output\missing_standards_report.txt
) else (
  echo ОШИБКА: отчёт не создан. Код выхода: %ERR%
  echo Проверьте, что Python установлен и backend\profstandart.db существует.
)
echo.
pause
exit /b %ERR%
