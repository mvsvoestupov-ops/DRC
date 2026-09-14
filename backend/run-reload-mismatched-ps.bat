@echo off
setlocal
cd /d "%~dp0"
echo === Reload mismatched PS from Mintrud (critical regs) ===
echo Working dir: %CD%
echo.

if not exist "venv\Scripts\python.exe" (
  echo ERROR: venv not found
  pause
  exit /b 1
)

set "LOG=scripts\output\reload_mismatched_ps_run.log"
venv\Scripts\python.exe scripts\reload_mismatched_ps.py %* > "%LOG%" 2>&1
set ERR=%ERRORLEVEL%
type "%LOG%"
echo.
echo Log: %CD%\%LOG%
echo Result JSON: %CD%\scripts\output\reload_mismatched_ps.json
echo.
pause
exit /b %ERR%
