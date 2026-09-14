@echo off
setlocal
cd /d "%~dp0"
echo === Load PS 40.104 (reg 545) + relink 10.104* quals ===
venv\Scripts\python.exe scripts\load_ps_40104_and_relink.py
echo.
pause
