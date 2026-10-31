@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0\.."
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\_query_tf_c_1674.py > scripts\output\_query_tf_c_1674_stdout.txt 2>&1
) else (
  python scripts\_query_tf_c_1674.py > scripts\output\_query_tf_c_1674_stdout.txt 2>&1
)
