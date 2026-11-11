@echo off
chcp 65001 >nul
cd /d C:\IT\DRC\backend
if exist venv\Scripts\python.exe (
  venv\Scripts\python.exe scripts\output\_check_fos_progress.py
) else (
  python scripts\output\_check_fos_progress.py
)
echo EXIT=%ERRORLEVEL%
type scripts\output\_check_fos_progress.txt
