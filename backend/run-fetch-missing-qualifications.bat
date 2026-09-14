@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Догрузка квалификаций НАРК (точечно по страницам) ===
echo Рекомендуется: run-fetch-missing-nark-pages.bat
echo.
echo 1) аудит page 1-405, повтор пустых страниц
echo 2) фильтры ОПД/СПК при необходимости
echo 3) загрузка недостающих карточек
echo.
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\fetch_missing_qualifications.py %*
) else (
  python scripts\fetch_missing_qualifications.py %*
)
echo.
pause
