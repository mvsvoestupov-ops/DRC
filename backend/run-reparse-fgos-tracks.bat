@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Перепарсинг квалификаций и компетенций ФГОС ===
echo.
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\reparse_fgos_tracks.py %*
) else (
  python scripts\reparse_fgos_tracks.py %*
)
echo.
pause
