@echo off
setlocal
cd /d "%~dp0"
echo === Сравнение XLSX реестра с индексом classinform.ru ===
if not exist "scripts\output\classinform_ps_index.json" (
  echo Сначала запустите run-build-classinform-index.bat
  pause
  exit /b 1
)
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\compare_xlsx_vs_classinform.py
) else (
  python scripts\compare_xlsx_vs_classinform.py
)
pause
