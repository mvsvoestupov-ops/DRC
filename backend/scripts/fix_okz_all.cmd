@echo off
cd /d C:\IT\DRC\backend
if exist venv\Scripts\python.exe (
  venv\Scripts\python.exe scripts\fix_okz_all.py %*
) else (
  python scripts\fix_okz_all.py %*
  if errorlevel 1 py -3 scripts\fix_okz_all.py %*
)
