@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0\.."
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\_extract_1674_headers.py
) else (
  py -3 scripts\_extract_1674_headers.py
)
