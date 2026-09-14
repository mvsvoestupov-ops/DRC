@echo off
setlocal
cd /d "%~dp0"
echo === Догрузка ПС 23.020 (reg 367, утратил силу) ===
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\load_one_ps.py 23.020 367
) else (
  python scripts\load_one_ps.py 23.020 367
)
pause
