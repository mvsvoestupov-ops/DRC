@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Сравнение XLSX с сайтом Минтруда ===
if not exist "scripts\xlsx_path.txt" (
  echo Укажите путь к XLSX в scripts\xlsx_path.txt
  pause
  exit /b 1
)
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\compare_xlsx_vs_mintrud_site.py %*
) else (
  python scripts\compare_xlsx_vs_mintrud_site.py %*
)
pause
