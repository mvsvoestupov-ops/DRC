@echo off

chcp 65001 >nul 2>&1

setlocal

cd /d "%~dp0"

echo === Парсинг ФГОС с classinform.ru ===

echo.

if exist "venv\Scripts\python.exe" (

  venv\Scripts\python.exe scripts\parse_fgos_spo.py --save-db %*

) else (

  python scripts\parse_fgos_spo.py --save-db %*

)

echo.

pause

