@echo off
cd /d "%~dp0"
venv\Scripts\python.exe scripts\fix_qual_codes_10104_to_40104.py
pause
