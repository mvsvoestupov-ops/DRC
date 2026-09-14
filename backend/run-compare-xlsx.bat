@echo off
setlocal
cd /d "%~dp0"
echo === Compare XLSX registry vs DB ===
echo Working dir: %CD%
echo.

if not exist "scripts\output" mkdir "scripts\output"

if not exist "profstandart.db" (
  echo ERROR: profstandart.db not found in %CD%
  echo.
  pause
  exit /b 1
)

if not exist "venv\Scripts\python.exe" (
  echo ERROR: venv\Scripts\python.exe not found
  echo   python -m venv venv
  echo   venv\Scripts\pip.exe install -r requirements.txt
  echo.
  pause
  exit /b 1
)

venv\Scripts\python.exe -c "import openpyxl" 2>nul
if errorlevel 1 (
  echo Installing openpyxl...
  venv\Scripts\pip.exe install "openpyxl>=3.1.0"
)

set "LOG=scripts\output\compare_xlsx_run.log"
venv\Scripts\python.exe scripts\compare_ps_with_xlsx.py %* > "%LOG%" 2>&1

set ERR=%ERRORLEVEL%
type "%LOG%"
echo.

if exist "missing_vs_xlsx_2026.txt" (
  echo OK. Reports:
  echo   %CD%\missing_vs_xlsx_2026.txt
  echo   %CD%\scripts\output\missing_vs_xlsx_2026.json
) else (
  echo ERROR: report not created. Exit code: %ERR%
  if exist "scripts\output\compare_xlsx_error.log" (
    echo.
    type "scripts\output\compare_xlsx_error.log"
  )
  echo.
  echo Log: %CD%\%LOG%
  echo.
  echo If XLSX not found, put path into scripts\xlsx_path.txt ^(UTF-8, one line^)
)

echo.
pause
exit /b %ERR%
