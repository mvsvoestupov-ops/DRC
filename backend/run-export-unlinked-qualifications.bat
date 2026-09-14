@echo off
setlocal
cd /d "%~dp0"
echo === Export unlinked qualifications ===
venv\Scripts\python.exe scripts\export_unlinked_qualifications.py
echo.
pause
