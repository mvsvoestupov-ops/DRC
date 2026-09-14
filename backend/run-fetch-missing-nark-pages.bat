@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Точечная догрузка квалификаций НАРК ===
echo 1) аудит страниц 1-405, повтор пустых/слабых
echo 2) при необходимости фильтры ОПД/СПК
echo 3) загрузка недостающих карточек в БД
echo.
echo Отчёт по страницам: scripts\output\nark_page_audit.txt
echo.
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\fetch_missing_nark_pages.py %*
) else (
  python scripts\fetch_missing_nark_pages.py %*
)
echo.
pause
