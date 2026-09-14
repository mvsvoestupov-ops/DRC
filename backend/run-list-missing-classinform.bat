@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === ПС из XLSX, которых нет на classinform.ru ===
if not exist "scripts\output\classinform_ps_index.json" (
  echo Сначала run-build-classinform-index.bat
  pause
  exit /b 1
)
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\list_missing_on_classinform.py
) else (
  python scripts\list_missing_on_classinform.py
)
pause
