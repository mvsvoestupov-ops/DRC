@echo off

chcp 65001 >nul 2>&1

setlocal

cd /d "%~dp0"

echo === Экспорт реестра ПС с сайта Минтруда в Excel ===

if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\export_mintrud_registry_to_xlsx.py %*
) else (
  python scripts\export_mintrud_registry_to_xlsx.py %*
)

pause
