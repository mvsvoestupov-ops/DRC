@echo off

chcp 65001 >nul 2>&1

setlocal

cd /d "%~dp0"

echo === Парсинг ФГОС (все разделы кроме СПО) ===
echo Лог: scripts\output\parse_fgos_remaining.log
echo.

if exist "venv\Scripts\python.exe" (

  venv\Scripts\python.exe scripts\parse_fgos_spo.py --save-db --remaining %* > scripts\output\parse_fgos_remaining.log 2>&1

) else (

  python scripts\parse_fgos_spo.py --save-db --remaining %* > scripts\output\parse_fgos_remaining.log 2>&1

)

echo.
echo Готово. См. scripts\output\parse_fgos_remaining.log
type scripts\output\parse_fgos_remaining.log | findstr /i "Готово В БД ошибок category links_count"

echo.

pause
