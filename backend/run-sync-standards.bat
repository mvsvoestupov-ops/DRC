@echo off
setlocal
cd /d "%~dp0"
echo === Синхронизация профстандартов по отчёту ===
echo.

if not exist "scripts\output\missing_standards_report.json" (
  echo Сначала нужен отчёт. Запускаю анализ...
  if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe scripts\analyze_missing_standards.py
  ) else (
    python scripts\analyze_missing_standards.py
  )
  if not exist "scripts\output\missing_standards_report.json" (
    echo ОШИБКА: отчёт не создан. Запустите run-analyze-standards.bat
    pause
    exit /b 1
  )
)

if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\sync_standards_from_report.py %*
) else (
  python scripts\sync_standards_from_report.py %*
)

set ERR=%ERRORLEVEL%
echo.
if %ERR%==0 (
  echo Готово. Лог: %CD%\sync_standards_log.txt
) else (
  echo Завершено с ошибками. Код: %ERR%
)
echo.
pause
exit /b %ERR%
